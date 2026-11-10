"use server";

/**
 * Server action behind the public sourcing-request form (B-31). Next.js rejects cross-origin action calls
 * (Origin must match Host), caps the body at 1 MB, and the handler validates every field with zod. The delivery
 * configuration, including any API key, is read here on the server and never sent to the browser.
 */
import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { resolveInquiryConfig } from "@/server/inquiry/config";
import { handleInquiry } from "@/server/inquiry/handle";
import { clientKey } from "@/server/inquiry/rate-limit";
import { inquiryLimiter, inquiryRecent } from "@/server/inquiry/runtime";
import type { InquiryFormState } from "@/site/inquiry-state";

export async function submitInquiry(
  prev: InquiryFormState,
  formData: FormData,
): Promise<InquiryFormState> {
  // Both arguments come from the client: refuse anything that is not a form post, and never trust `prev`.
  if (!(formData instanceof FormData)) return { status: "unavailable", seq: 0 };
  const prevSeq =
    typeof prev?.seq === "number" && Number.isSafeInteger(prev.seq) && prev.seq >= 0 ? prev.seq : 0;
  const h = await headers();
  return handleInquiry((key) => formData.get(key), prevSeq, {
    config: resolveInquiryConfig(process.env),
    limiter: inquiryLimiter,
    recent: inquiryRecent,
    now: Date.now(),
    clientKey: clientKey(h.get("x-forwarded-for"), h.get("x-real-ip")),
    newId: randomUUID,
    // Outcome codes only: never the body, the email address or the client key.
    log: (event, detail) => {
      if (event === "inquiry_delivery_failed") console.error(JSON.stringify({ event, ...detail }));
    },
  });
}
