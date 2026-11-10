/**
 * Orchestration for one public sourcing-request submission — B-31. Pure apart from the injected dependencies,
 * so every branch is unit tested without a server.
 *
 * Order matters:
 *   1. not configured  → refuse (defense in depth: the form is also switched off)
 *   2. honeypot / too fast → refuse (bots)
 *   3. rate limit       → counts invalid attempts too
 *   4. zod validation   → field errors
 *   5. replay           → the earlier outcome for the same submission id AND the same content, nothing sent twice
 *   6. deliver          → sent | test_sent | error
 * Every unsuccessful outcome echoes the visitor's own input back so nothing typed is lost.
 * Logging: outcome codes only. Never the request body, the email address or the client key.
 */
import { createHash } from "node:crypto";
import type { InquiryFormState } from "@/site/inquiry-state";
import type { InquiryConfig } from "./config";
import { deliverInquiry, type FetchLike } from "./delivery";
import type { RecentResults, SlidingWindowLimiter } from "./rate-limit";
import { echoValues, parseInquiry, readInquiryFields, type Inquiry } from "./schema";

/** A form sent less than this long after it was shown (measured by the browser) is treated as automated. */
export const MIN_FILL_MS = 2_000;
const SUBMISSION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Idempotency key for one delivery: the browser's submission id plus the validated content. Resending the same
 * request (double click, retry after a timeout) reuses the key and is delivered once; editing the request after
 * an error produces a new key, so the provider never sees one key with two different payloads.
 */
export function deliveryKey(submissionId: string, inquiry: Inquiry): string {
  const canonical = JSON.stringify([
    inquiry.name,
    inquiry.email,
    inquiry.company,
    inquiry.productFamily,
    inquiry.quantity ?? null,
    inquiry.message,
  ]);
  const digest = createHash("sha256").update(`${submissionId}\n${canonical}`).digest("hex");
  return `inquiry-${digest.slice(0, 48)}`;
}

export interface InquiryDeps {
  config: InquiryConfig;
  limiter: SlidingWindowLimiter;
  recent: RecentResults<InquiryFormState["status"]>;
  now: number;
  clientKey: string;
  newId: () => string;
  fetchImpl?: FetchLike | undefined;
  log?: ((event: string, detail: Record<string, string>) => void) | undefined;
}

export async function handleInquiry(
  get: (key: string) => unknown,
  prevSeq: number,
  deps: InquiryDeps,
): Promise<InquiryFormState> {
  const seq = prevSeq + 1;
  const log = deps.log ?? (() => undefined);
  const raw = readInquiryFields(get);
  const values = echoValues(raw);

  if (deps.config.mode === "not_configured") {
    return { status: "unavailable", values, seq };
  }

  const honeypot = get("_gotcha");
  if (typeof honeypot === "string" && honeypot.trim() !== "") {
    log("inquiry_rejected", { reason: "honeypot" });
    return { status: "rejected", values, seq };
  }
  // `fillMs` is how long the form was on screen before it was sent, measured entirely by the browser (no clock
  // comparison with the server). Absent without JavaScript, in which case the heuristic is skipped.
  const rawFill = get("fillMs");
  const fillMs = typeof rawFill === "string" && rawFill.trim() !== "" ? Number(rawFill) : NaN;
  if (Number.isFinite(fillMs) && fillMs >= 0 && fillMs < MIN_FILL_MS) {
    log("inquiry_rejected", { reason: "too_fast" });
    return { status: "rejected", values, seq };
  }

  if (!deps.limiter.take(deps.clientKey, deps.now)) {
    log("inquiry_rate_limited", {});
    return { status: "rate_limited", values, seq };
  }

  const parsed = parseInquiry(raw);
  if (!parsed.ok) {
    return { status: "invalid", fieldErrors: parsed.fieldErrors, values: parsed.values, seq };
  }

  const rawId = get("submissionId");
  const submissionId =
    typeof rawId === "string" && SUBMISSION_ID.test(rawId) ? rawId : deps.newId();
  const key = deliveryKey(submissionId, parsed.inquiry);
  const replay = deps.recent.get(key, deps.now);
  if (replay === "sent" || replay === "test_sent") {
    return { status: replay, seq };
  }

  const outcome = await deliverInquiry(deps.config, parsed.inquiry, key, deps.fetchImpl);
  if (!outcome.ok) {
    log("inquiry_delivery_failed", { provider: outcome.provider, error: outcome.error });
    return {
      status: outcome.error === "not_configured" ? "unavailable" : "error",
      values,
      seq,
    };
  }
  const status = outcome.delivered ? "sent" : "test_sent";
  deps.recent.set(key, status, deps.now);
  log("inquiry_accepted", { provider: outcome.provider });
  return { status, seq };
}
