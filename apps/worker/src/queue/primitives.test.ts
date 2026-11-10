import { describe, expect, it } from "vitest";
import { backoffSeconds, DEFAULT_BACKOFF } from "./backoff.js";
import {
  buildEnvelope,
  canonicalJson,
  MAX_MESSAGE_CHARS,
  messageHash,
  parseEnvelope,
} from "./envelope.js";
import { describeError, MAX_ERROR_LENGTH, NotImplementedJobError } from "./errors.js";
import { assertQueueName, decideExisting, type LedgerRow } from "./store.js";

describe("backoffSeconds", () => {
  const policy = { baseSeconds: 10, maxSeconds: 900, jitterRatio: 0 };

  it("doubles per failed attempt from the base and caps at the maximum", () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8].map((n) => backoffSeconds(n, policy))).toEqual([
      10, 20, 40, 80, 160, 320, 640, 900,
    ]);
    expect(backoffSeconds(1_000, policy)).toBe(900); // exponent clamped, still finite
  });

  it("adds bounded jitter and never exceeds the cap", () => {
    const jittery = { baseSeconds: 10, maxSeconds: 900, jitterRatio: 0.2 };
    expect(backoffSeconds(1, jittery, () => 0)).toBe(10);
    expect(backoffSeconds(1, jittery, () => 1)).toBe(12);
    expect(backoffSeconds(1, jittery, () => 0.5)).toBe(11);
    expect(backoffSeconds(20, jittery, () => 1)).toBe(900);
    expect(backoffSeconds(1, jittery, () => 7)).toBe(12); // out-of-range random is clamped
  });

  it("a zero base retries immediately (used by integration tests)", () => {
    expect(backoffSeconds(3, { baseSeconds: 0, maxSeconds: 0, jitterRatio: 0.2 })).toBe(0);
  });

  it("rejects nonsense inputs", () => {
    expect(() => backoffSeconds(0, DEFAULT_BACKOFF)).toThrow(/positive integer/);
    expect(() => backoffSeconds(1.5, DEFAULT_BACKOFF)).toThrow(/positive integer/);
    expect(() => backoffSeconds(1, { baseSeconds: 10, maxSeconds: 5, jitterRatio: 0 })).toThrow(
      /invalid backoff/,
    );
    expect(() => backoffSeconds(1, { baseSeconds: 1, maxSeconds: 5, jitterRatio: 2 })).toThrow(
      /invalid backoff/,
    );
  });
});

describe("job envelope", () => {
  const valid = {
    v: 1,
    type: "notification.create",
    idempotency_key: "notify:abc:123",
    payload: { a: 1 },
  };

  it("accepts a well-formed envelope and hashes it", () => {
    const r = parseEnvelope(valid);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.envelope).toEqual(valid);
    expect(r.hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it.each([
    ["a string", "job"],
    ["null", null],
    ["an array", [valid]],
    ["no payload", { v: 1, type: "x.job", idempotency_key: "key-00000001" }],
    ["payload is an array", { ...valid, payload: [1] }],
    ["key too short", { ...valid, idempotency_key: "k1" }],
    ["key with whitespace", { ...valid, idempotency_key: "key with spaces" }],
    ["key with a newline", { ...valid, idempotency_key: "key-0001\ninjected" }],
    ["key too long", { ...valid, idempotency_key: "k".repeat(201) }],
    ["uppercase type", { ...valid, type: "Notification.Create" }],
    ["version 2", { ...valid, v: 2 }],
    ["an unknown top-level field", { ...valid, priority: "high" }],
  ])("rejects %s", (_, raw) => {
    const r = parseEnvelope(raw);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toMatch(/^invalid_envelope: /);
  });

  it("rejects oversized messages before validating them", () => {
    const r = parseEnvelope({ ...valid, payload: { blob: "x".repeat(MAX_MESSAGE_CHARS) } });
    expect(r).toEqual({
      ok: false,
      error: `invalid_envelope: message exceeds ${MAX_MESSAGE_CHARS} characters`,
    });
  });

  it("error summaries name paths and issue codes, never the offending values", () => {
    const offendingValue = "supplier-quote-USD-0.0473";
    const r = parseEnvelope({ ...valid, idempotency_key: offendingValue.replace(/-/g, " ") });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toContain("idempotency_key");
    expect(r.error).not.toContain("0.0473");
  });

  it("hashes equal content equally regardless of key order (jsonb reorders keys)", () => {
    const a = buildEnvelope("x.job", "key-00000001", { b: { y: 2, x: 1 }, a: [1, { d: 4, c: 3 }] });
    const b = parseEnvelope(
      JSON.parse(
        '{"payload":{"a":[1,{"c":3,"d":4}],"b":{"x":1,"y":2}},"idempotency_key":"key-00000001","type":"x.job","v":1}',
      ),
    );
    expect(b.ok && b.hash).toBe(messageHash(a));
    expect(messageHash(buildEnvelope("x.job", "key-00000001", { a: 2 }))).not.toBe(
      messageHash(buildEnvelope("x.job", "key-00000001", { a: 1 })),
    );
    expect(canonicalJson({ b: 1, a: [true, null, "s"] })).toBe('{"a":[true,null,"s"],"b":1}');
  });

  it("buildEnvelope refuses what the consumer would refuse", () => {
    expect(() => buildEnvelope("x.job", "short", {})).toThrow(/invalid envelope/);
  });
});

describe("ledger decision for an existing (queue, idempotency_key) row", () => {
  const row = (over: Partial<LedgerRow>): LedgerRow => ({
    id: "e1",
    status: "running",
    msgId: "10",
    payloadHash: "a".repeat(64),
    attempts: 1,
    ...over,
  });
  const req = { msgId: "10", payloadHash: "a".repeat(64) };

  it("different content under the same key is a conflict, whatever the status", () => {
    for (const status of ["running", "succeeded", "failed"] as const) {
      expect(decideExisting(row({ status }), { ...req, payloadHash: "b".repeat(64) })).toEqual({
        kind: "conflict",
      });
    }
  });

  it("a finished job is a duplicate", () => {
    expect(decideExisting(row({ status: "succeeded" }), req)).toEqual({
      kind: "duplicate",
      status: "succeeded",
    });
    expect(decideExisting(row({ status: "failed" }), { ...req, msgId: "11" })).toEqual({
      kind: "duplicate",
      status: "failed",
    });
  });

  it("a running row held by this message (redelivery after a lapse) is taken over", () => {
    expect(decideExisting(row({}), req)).toEqual({ kind: "take_over" });
    expect(decideExisting(row({ msgId: null, payloadHash: null }), req)).toEqual({
      kind: "take_over",
    });
  });

  it("a running row held by another message needs the holder checked", () => {
    expect(decideExisting(row({ msgId: "9" }), req)).toEqual({
      kind: "check_holder",
      holderMsgId: "9",
    });
  });
});

describe("errors and names", () => {
  it("describeError is bounded, single-line and stack-free", () => {
    expect(describeError(new Error("plain"))).toBe("plain");
    expect(describeError(new NotImplementedJobError("fbg_fx", "ADR-010"))).toBe(
      "NotImplementedJobError: not_implemented: no handler for fbg_fx yet (arrives with ADR-010)",
    );
    expect(describeError(new Error("line1\nline2\u0000"))).toBe("line1 line2");
    expect(describeError("thrown string")).toBe("non-error thrown: string");
    expect(describeError(new Error("x".repeat(5_000)))).toHaveLength(MAX_ERROR_LENGTH);
  });

  it("queue names are restricted to the ledger's pattern", () => {
    expect(() => assertQueueName("fbg_notifications")).not.toThrow();
    for (const bad of ["Fbg", "fbg-notifications", 'x"; drop table y; --', "", "a".repeat(49)]) {
      expect(() => assertQueueName(bad)).toThrow(/invalid queue name/);
    }
  });
});
