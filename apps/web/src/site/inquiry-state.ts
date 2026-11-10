/**
 * The state the sourcing-request server action returns to the form. Shared by the server handler and the client
 * form, so it holds no secrets and no delivery details beyond what the visitor must be told.
 */
import type { InquiryField, InquiryValues } from "@/server/inquiry/schema";

export type InquiryStatus =
  | "idle"
  | "sent" // delivered to the internal inbox
  | "test_sent" // dry run: validated, nothing sent or stored
  | "invalid"
  | "rate_limited"
  | "unavailable" // no approved delivery mechanism configured
  | "rejected" // bot heuristics tripped (honeypot / too fast)
  | "error"; // provider or network failure

export interface InquiryFormState {
  status: InquiryStatus;
  fieldErrors?: Partial<Record<InquiryField, string>> | undefined;
  values?: InquiryValues | undefined;
  /** Bumped on every server response so the form can move focus to the new message. */
  seq: number;
}

export const INITIAL_INQUIRY_STATE: InquiryFormState = { status: "idle", seq: 0 };
