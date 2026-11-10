/**
 * Process-wide state for the sourcing-request action (see rate-limit.ts for why this is best-effort only).
 * 5 attempts per client key per 10 minutes; replayed submission ids are answered for 24 hours.
 */
import type { InquiryFormState } from "@/site/inquiry-state";
import { RecentResults, SlidingWindowLimiter } from "./rate-limit";

export const inquiryLimiter = new SlidingWindowLimiter(5, 10 * 60 * 1000);
export const inquiryRecent = new RecentResults<InquiryFormState["status"]>(24 * 60 * 60 * 1000);
