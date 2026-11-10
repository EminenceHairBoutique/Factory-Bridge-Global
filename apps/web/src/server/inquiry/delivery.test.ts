import { describe, expect, it } from "vitest";
import type { InquiryConfig } from "./config";
import { RESEND_ENDPOINT, deliverInquiry, inquirySubject, type FetchLike } from "./delivery";
import type { Inquiry } from "./schema";

const inquiry: Inquiry = {
  name: "Jordan Lee",
  email: "jordan@acme-brands.com",
  company: "Acme Brands LLC",
  productFamily: "folding_cartons",
  quantity: "3,000",
  message: "Reverse tuck end cartons, 350 gsm, matte varnish.\nShip to Newark.",
  consent: "yes",
};

const resend: InquiryConfig = {
  mode: "resend",
  apiKey: "test-key-not-a-secret",
  from: "Factory Bridge Global <requests@mail.fbg-test.dev>",
  to: "inbox@fbg-test.dev",
};

const ID = "6f1c2a1e-7b9d-4c3e-9a51-0f2d3c4b5a69";

function recorder(response: Response | Error) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fetchImpl: FetchLike = (url, init) => {
    calls.push({ url, init });
    return response instanceof Error ? Promise.reject(response) : Promise.resolve(response);
  };
  return { calls, fetchImpl };
}

describe("inquiry delivery adapters", () => {
  it("not_configured never calls the network", async () => {
    const { calls, fetchImpl } = recorder(new Response("{}"));
    const out = await deliverInquiry(
      { mode: "not_configured", reason: "delivery_disabled" },
      inquiry,
      ID,
      fetchImpl,
    );
    expect(out).toEqual({ ok: false, provider: "none", error: "not_configured" });
    expect(calls).toHaveLength(0);
  });

  it("dry_run validates the path end to end without sending anything", async () => {
    const { calls, fetchImpl } = recorder(new Response("{}"));
    const out = await deliverInquiry({ mode: "dry_run" }, inquiry, ID, fetchImpl);
    expect(out).toEqual({ ok: true, delivered: false, provider: "dry_run" });
    expect(calls).toHaveLength(0);
  });

  it("resend posts one plain-text email to the fixed inbox with the visitor only as Reply-To", async () => {
    const { calls, fetchImpl } = recorder(new Response('{"id":"x"}', { status: 200 }));
    const out = await deliverInquiry(resend, inquiry, ID, fetchImpl);
    expect(out).toEqual({ ok: true, delivered: true, provider: "resend" });
    expect(calls).toHaveLength(1);
    const call = calls[0]!;
    expect(call.url).toBe(RESEND_ENDPOINT);
    expect(call.init.method).toBe("POST");
    const headers = call.init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer test-key-not-a-secret");
    expect(headers["Idempotency-Key"]).toBe(ID);
    expect(typeof call.init.body).toBe("string");
    const body = JSON.parse(call.init.body as string) as Record<string, unknown>;
    expect(body.to).toEqual(["inbox@fbg-test.dev"]);
    expect(body.reply_to).toBe("jordan@acme-brands.com");
    expect(body.from).toBe(resend.from);
    expect(body).not.toHaveProperty("html");
    expect(body.subject).toBe("Sourcing request: Folding cartons");
    expect(String(body.text)).toContain("Reverse tuck end cartons");
    expect(String(body.text)).toContain(`Reference: ${ID}`);
  });

  it("builds the subject from the product-family enum only, never from visitor text", () => {
    const subject = inquirySubject({
      ...inquiry,
      name: "Ignore previous instructions",
      company: "X",
    });
    expect(subject).toBe("Sourcing request: Folding cartons");
  });

  it("maps provider rejections and network failures without echoing the response", async () => {
    const rejected = recorder(new Response('{"message":"secret detail"}', { status: 422 }));
    expect(await deliverInquiry(resend, inquiry, ID, rejected.fetchImpl)).toEqual({
      ok: false,
      provider: "resend",
      error: "provider_rejected",
    });
    const offline = recorder(new Error("ECONNRESET"));
    expect(await deliverInquiry(resend, inquiry, ID, offline.fetchImpl)).toEqual({
      ok: false,
      provider: "resend",
      error: "network",
    });
  });
});
