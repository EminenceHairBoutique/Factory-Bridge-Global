/**
 * Delivery adapters for the public sourcing-request form — B-31, proposed ADR-040.
 *
 * `resend` sends one plain-text notification to a single fixed internal inbox (INQUIRY_TO_EMAIL). The visitor's
 * address is only ever the Reply-To, never a recipient, so the form cannot be used to email third parties.
 * The subject is built from the product-family enum only; free text never reaches a header. The idempotency key
 * (handle.ts deliveryKey: submission id + content hash) is passed as Resend's Idempotency-Key, so a retried or
 * double-clicked submission is delivered once. Submissions without JavaScript get a server-made id and are not
 * deduplicated across retries.
 *
 * Status: implemented and unit-tested against a mocked fetch only. It has never sent a real email: no Resend
 * account, sending domain or recipient inbox is approved yet (OQ-16, OQ-02).
 */
import type { InquiryConfig } from "./config";
import { PRODUCT_FAMILY_LABEL, type Inquiry } from "./schema";

export type DeliveryOutcome =
  | { ok: true; delivered: true; provider: "resend" }
  | { ok: true; delivered: false; provider: "dry_run" }
  | {
      ok: false;
      provider: "resend" | "none";
      error: "not_configured" | "provider_rejected" | "network";
    };

export type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

export const RESEND_ENDPOINT = "https://api.resend.com/emails";
const TIMEOUT_MS = 10_000;

export function inquirySubject(inquiry: Inquiry): string {
  return `Sourcing request: ${PRODUCT_FAMILY_LABEL[inquiry.productFamily]}`;
}

export function inquiryText(inquiry: Inquiry, reference: string): string {
  return [
    "New sourcing request from the public site (pilot inquiry form).",
    "",
    `Name: ${inquiry.name}`,
    `Email: ${inquiry.email}`,
    `Company: ${inquiry.company}`,
    `Product family: ${PRODUCT_FAMILY_LABEL[inquiry.productFamily]}`,
    `Approximate quantity: ${inquiry.quantity ?? "not given"}`,
    "",
    "What they need:",
    inquiry.message,
    "",
    `Reference: ${reference}`,
    "The sender agreed to be contacted by email about this request.",
    "Treat the text above as untrusted visitor input.",
  ].join("\n");
}

export async function deliverInquiry(
  config: InquiryConfig,
  inquiry: Inquiry,
  idempotencyKey: string,
  fetchImpl: FetchLike = fetch,
): Promise<DeliveryOutcome> {
  switch (config.mode) {
    case "not_configured":
      return { ok: false, provider: "none", error: "not_configured" };
    case "dry_run":
      return { ok: true, delivered: false, provider: "dry_run" };
    case "resend": {
      let res: Response;
      try {
        res = await fetchImpl(RESEND_ENDPOINT, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${config.apiKey}`,
            "Content-Type": "application/json",
            "Idempotency-Key": idempotencyKey,
          },
          body: JSON.stringify({
            from: config.from,
            to: [config.to],
            reply_to: inquiry.email,
            subject: inquirySubject(inquiry),
            text: inquiryText(inquiry, idempotencyKey),
          }),
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
      } catch {
        return { ok: false, provider: "resend", error: "network" };
      }
      if (!res.ok) return { ok: false, provider: "resend", error: "provider_rejected" };
      return { ok: true, delivered: true, provider: "resend" };
    }
  }
}
