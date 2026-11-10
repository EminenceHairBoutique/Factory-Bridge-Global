import { describe, expect, it } from "vitest";
import type { InquiryFormState } from "@/site/inquiry-state";
import type { InquiryConfig } from "./config";
import type { FetchLike } from "./delivery";
import { MIN_FILL_MS, deliveryKey, handleInquiry, type InquiryDeps } from "./handle";
import { RecentResults, SlidingWindowLimiter } from "./rate-limit";
import { parseInquiry, readInquiryFields } from "./schema";

const ID = "6f1c2a1e-7b9d-4c3e-9a51-0f2d3c4b5a69";
const NOW = 1_800_000_000_000;

const fields: Record<string, string> = {
  name: "Jordan Lee",
  email: "jordan@acme-brands.com",
  company: "Acme Brands LLC",
  productFamily: "hair_bundles",
  quantity: "100 bundles",
  message: "100 g double machine weft, 18 to 22 in, natural straight.",
  consent: "yes",
  submissionId: ID,
  fillMs: "30000",
  _gotcha: "",
};

function form(patch: Record<string, string | undefined> = {}) {
  const f: Record<string, string | undefined> = { ...fields, ...patch };
  return (k: string) => f[k];
}

function deps(config: InquiryConfig, extra: Partial<InquiryDeps> = {}) {
  const logs: Array<{ event: string; detail: Record<string, string> }> = [];
  const d: InquiryDeps = {
    config,
    limiter: new SlidingWindowLimiter(5, 600_000),
    recent: new RecentResults<InquiryFormState["status"]>(86_400_000),
    now: NOW,
    clientKey: "203.0.113.7",
    newId: () => "11111111-1111-4111-8111-111111111111",
    log: (event, detail) => logs.push({ event, detail }),
    ...extra,
  };
  return { d, logs };
}

const resend: InquiryConfig = {
  mode: "resend",
  apiKey: "test-key-not-a-secret",
  from: "requests@mail.fbg-test.dev",
  to: "inbox@fbg-test.dev",
};

function recordingFetch(status = 200) {
  const keys: string[] = [];
  const fetchImpl: FetchLike = (_url, init) => {
    keys.push((init.headers as Record<string, string>)["Idempotency-Key"] ?? "");
    return Promise.resolve(new Response('{"id":"x"}', { status }));
  };
  return { fetchImpl, keys, count: () => keys.length };
}

describe("handleInquiry (B-31)", () => {
  it("refuses everything when no delivery mechanism is configured, keeping what was typed", async () => {
    const { d } = deps({ mode: "not_configured", reason: "delivery_disabled" });
    const out = await handleInquiry(form(), 0, d);
    expect(out.status).toBe("unavailable");
    expect(out.seq).toBe(1);
    expect(out.values?.message).toContain("double machine weft");
  });

  it("dry run: a valid request reports test_sent, never sent", async () => {
    const { d } = deps({ mode: "dry_run" });
    expect(await handleInquiry(form(), 4, d)).toEqual({ status: "test_sent", seq: 5 });
  });

  it("resend: a valid request is delivered once; a replay of the same request is not re-sent", async () => {
    const f = recordingFetch();
    const { d } = deps(resend, { fetchImpl: f.fetchImpl });
    expect((await handleInquiry(form(), 0, d)).status).toBe("sent");
    expect((await handleInquiry(form(), 1, d)).status).toBe("sent");
    expect(f.count()).toBe(1);
  });

  it("derives the idempotency key from the submission id and the content", () => {
    const parsed = parseInquiry(readInquiryFields((k) => fields[k]));
    if (!parsed.ok) throw new Error("fixture must be valid");
    const a = deliveryKey(ID, parsed.inquiry);
    expect(a).toMatch(/^inquiry-[0-9a-f]{48}$/);
    expect(deliveryKey(ID, parsed.inquiry)).toBe(a);
    expect(deliveryKey(ID, { ...parsed.inquiry, message: `${parsed.inquiry.message}!` })).not.toBe(
      a,
    );
    expect(deliveryKey("11111111-1111-4111-8111-111111111111", parsed.inquiry)).not.toBe(a);
  });

  it("after a failure, an unchanged retry reuses the key and an edited retry gets a new one", async () => {
    let status = 503;
    const keys: string[] = [];
    const flaky: FetchLike = (_url, init) => {
      keys.push((init.headers as Record<string, string>)["Idempotency-Key"] ?? "");
      return Promise.resolve(new Response("{}", { status }));
    };
    const { d } = deps(resend, { fetchImpl: flaky });
    expect((await handleInquiry(form(), 0, d)).status).toBe("error");
    expect((await handleInquiry(form(), 1, d)).status).toBe("error");
    status = 200;
    expect((await handleInquiry(form({ quantity: "300 bundles" }), 2, d)).status).toBe("sent");
    expect(keys[0]).toBe(keys[1]);
    expect(keys[2]).not.toBe(keys[0]);
  });

  it("returns field errors and echoes values on invalid input, without delivering", async () => {
    const f = recordingFetch();
    const { d } = deps(resend, { fetchImpl: f.fetchImpl });
    const out = await handleInquiry(form({ email: "nope", consent: undefined }), 0, d);
    expect(out.status).toBe("invalid");
    expect(Object.keys(out.fieldErrors ?? {}).sort()).toEqual(["consent", "email"]);
    expect(out.values?.name).toBe("Jordan Lee");
    expect(f.count()).toBe(0);
  });

  it("rejects a filled honeypot and an implausibly fast submission, keeping what was typed", async () => {
    const f = recordingFetch();
    const { d, logs } = deps(resend, { fetchImpl: f.fetchImpl });
    const honeypot = await handleInquiry(form({ _gotcha: "https://spam.test" }), 0, d);
    expect(honeypot.status).toBe("rejected");
    const fast = await handleInquiry(form({ fillMs: String(MIN_FILL_MS - 1) }), 0, d);
    expect(fast.status).toBe("rejected");
    expect(fast.values?.message).toContain("double machine weft");
    expect(f.count()).toBe(0);
    expect(logs.map((l) => l.detail.reason)).toEqual(["honeypot", "too_fast"]);
  });

  it("uses only the browser-measured fill time: absent (no JavaScript) or nonsense skips the check", async () => {
    const { d } = deps({ mode: "dry_run" });
    for (const fillMs of [undefined, "", "abc", "-50", String(MIN_FILL_MS)]) {
      expect((await handleInquiry(form({ fillMs }), 0, d)).status, String(fillMs)).toBe(
        "test_sent",
      );
    }
  });

  it("rate limits per client key, counting invalid attempts too, and keeps the visitor's input", async () => {
    const { d } = deps({ mode: "dry_run" }, { limiter: new SlidingWindowLimiter(2, 600_000) });
    await handleInquiry(form({ email: "bad" }), 0, d);
    await handleInquiry(form({ submissionId: "22222222-2222-4222-8222-222222222222" }), 1, d);
    const out = await handleInquiry(form(), 2, d);
    expect(out.status).toBe("rate_limited");
    expect(out.values?.message).toContain("double machine weft");
  });

  it("reports a provider failure as an error, keeps the visitor's input, and logs no personal data", async () => {
    const failing = recordingFetch(500);
    const { d, logs } = deps(resend, { fetchImpl: failing.fetchImpl });
    const out = await handleInquiry(form(), 0, d);
    expect(out.status).toBe("error");
    expect(out.values?.message).toContain("double machine weft");
    expect(logs).toEqual([
      {
        event: "inquiry_delivery_failed",
        detail: { provider: "resend", error: "provider_rejected" },
      },
    ]);
    const logged = JSON.stringify(logs);
    for (const secret of ["jordan@", "Jordan", "Acme", "203.0.113.7", "test-key-not-a-secret"]) {
      expect(logged).not.toContain(secret);
    }
  });

  it("does not cache failures, so a retry of the same request can still be delivered", async () => {
    let fail = true;
    const flaky: FetchLike = () =>
      Promise.resolve(new Response("{}", { status: fail ? 503 : 200 }));
    const { d } = deps(resend, { fetchImpl: flaky });
    expect((await handleInquiry(form(), 0, d)).status).toBe("error");
    fail = false;
    expect((await handleInquiry(form(), 1, d)).status).toBe("sent");
  });

  it("replaces a malformed submission id with a server-generated one", async () => {
    const f = recordingFetch();
    const { d } = deps(resend, { fetchImpl: f.fetchImpl });
    await handleInquiry(form({ submissionId: "../../etc/passwd" }), 0, d);
    const parsed = parseInquiry(readInquiryFields((k) => fields[k]));
    if (!parsed.ok) throw new Error("fixture must be valid");
    expect(f.keys[0]).toBe(deliveryKey("11111111-1111-4111-8111-111111111111", parsed.inquiry));
  });
});
