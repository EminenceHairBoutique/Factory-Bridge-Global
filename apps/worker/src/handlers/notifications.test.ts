import pino from "pino";
import { describe, expect, it } from "vitest";
import type { SqlClient } from "../ai/store.js";
import type { Job } from "../queue/consumer.js";
import { PermanentJobError } from "../queue/errors.js";
import { defaultHandlers, WORKER_QUEUES } from "./index.js";
import { NOTIFICATION_CREATE, notificationsHandler } from "./notifications.js";

const USER = "ab100000-0000-4000-8000-000000000001";
const ORG = "ab1ab1ab-0000-4000-8000-000000000001";
const log = pino({ level: "silent" });

function fakeTx(
  isMember: boolean,
): SqlClient & { calls: { text: string; params: readonly unknown[] }[] } {
  const calls: { text: string; params: readonly unknown[] }[] = [];
  return {
    calls,
    query<T>(text: string, params: readonly unknown[]): Promise<T[]> {
      calls.push({ text, params });
      if (text.includes("public.memberships")) return Promise.resolve([{ ok: isMember }] as T[]);
      if (text.includes("app.notify")) return Promise.resolve([{ id: "n1" }] as T[]);
      return Promise.resolve([]);
    },
  };
}

const job = (payload: Record<string, unknown>, type = NOTIFICATION_CREATE): Job => ({
  queue: "fbg_notifications",
  msgId: "7",
  type,
  idempotencyKey: "notify:review_ready:doc-1",
  payload,
  attempt: 1,
});

const run = (j: Job, tx: SqlClient) =>
  notificationsHandler(j, { tx, signal: new AbortController().signal, log });

describe("fbg_notifications handler", () => {
  it("checks the recipient's active membership, then writes through app.notify with the producer's dedupe key", async () => {
    const tx = fakeTx(true);
    await run(
      job({
        user_id: USER,
        org_id: ORG,
        kind: "review_ready",
        data: { document_id: "d1" },
        dedupe_key: "review_ready:d1:user",
      }),
      tx,
    );
    expect(tx.calls).toHaveLength(2);
    expect(tx.calls[0]!.text).toMatch(
      /from public\.memberships where org_id = \$1::uuid and user_id = \$2::uuid and status = 'active'/,
    );
    expect(tx.calls[0]!.params).toEqual([ORG, USER]);
    expect(tx.calls[1]!.text).toMatch(/app\.notify\(/);
    expect(tx.calls[1]!.params).toEqual([
      USER,
      ORG,
      "review_ready",
      '{"document_id":"d1"}',
      "review_ready:d1:user",
    ]);
  });

  it("without a producer dedupe key the job's own key dedupes, so a replay cannot add a second row", async () => {
    const tx = fakeTx(true);
    await run(job({ user_id: USER, org_id: ORG, kind: "generic" }), tx);
    expect(tx.calls[1]!.params).toEqual([
      USER,
      ORG,
      "generic",
      "{}",
      "job:fbg_notifications:notify:review_ready:doc-1",
    ]);
  });

  it("refuses a recipient who is not an active member of the organization (permanent, nothing written)", async () => {
    const tx = fakeTx(false);
    const err = await run(job({ user_id: USER, org_id: ORG, kind: "quote_expired" }), tx).catch(
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(PermanentJobError);
    expect((err as PermanentJobError).code).toBe("recipient_not_member");
    expect(tx.calls.some((c) => c.text.includes("app.notify"))).toBe(false);
  });

  it.each([
    ["a bad user id", { user_id: "not-a-uuid", org_id: ORG, kind: "generic" }],
    ["no organization", { user_id: USER, kind: "generic" }],
    ["an unknown kind", { user_id: USER, org_id: ORG, kind: "payment_received" }],
    ["an unknown field", { user_id: USER, org_id: ORG, kind: "generic", delivered_via: ["email"] }],
    [
      "oversized data",
      { user_id: USER, org_id: ORG, kind: "generic", data: { b: "x".repeat(5_000) } },
    ],
    [
      "a dedupe key with spaces",
      { user_id: USER, org_id: ORG, kind: "generic", dedupe_key: "a b c d e" },
    ],
  ])(
    "refuses %s as a permanent invalid_payload without touching the database",
    async (_, payload) => {
      const tx = fakeTx(true);
      const err = await run(job(payload), tx).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(PermanentJobError);
      expect((err as PermanentJobError).code).toBe("invalid_payload");
      expect(tx.calls).toHaveLength(0);
      expect((err as Error).message).not.toContain("xxxx"); // values never echoed
    },
  );

  it("refuses message types it does not handle", async () => {
    const tx = fakeTx(true);
    const err = await run(
      job({ user_id: USER, org_id: ORG, kind: "generic" }, "email.send"),
      tx,
    ).catch((e: unknown) => e);
    expect((err as PermanentJobError).code).toBe("unknown_type");
    expect(tx.calls).toHaveLength(0);
  });
});

describe("handler registry", () => {
  it("consumes every queue migration 0012 created; the ones without a handler fail closed", async () => {
    const handlers = defaultHandlers();
    expect([...handlers.keys()].sort()).toEqual([...WORKER_QUEUES].sort());
    // fbg_documents has a handler since B-12 / B-13, but only the entrypoint may enable it: by default it is off.
    const expected = {
      fbg_documents: "not_configured",
      fbg_extraction: "not_implemented",
      fbg_fx: "not_implemented",
    } as const;
    for (const queue of ["fbg_documents", "fbg_extraction", "fbg_fx"] as const) {
      const handler = handlers.get(queue)!;
      if (typeof handler !== "function") throw new Error(`${queue} must fail closed by default`);
      const err = await handler(
        { ...job({}), queue },
        { tx: fakeTx(true), signal: new AbortController().signal, log },
      ).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(PermanentJobError);
      expect((err as PermanentJobError).code).toBe(expected[queue]);
    }
    expect(handlers.get("fbg_notifications")).toBe(notificationsHandler);
  });
});
