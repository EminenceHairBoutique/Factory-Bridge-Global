/**
 * Display-only rules for the operations compliance review preview. They mirror the permission
 * matrix row for compliance holds (operators read; compliance reviewers and platform admins
 * create and update; admin reads are audited), the buyer-facing rule of PRD AC-O5.1 (buyers see
 * only "Compliance review required"), and the decision record every hold needs (who, role, when,
 * reason, conditions). Nothing here changes a brief, a grant or a supplier; the real transitions
 * are server-side and audited.
 */
import type { Hold, HoldKind, HoldState, Outcome } from "./demo-data/ops-compliance";
import { slaFor, type SlaInfo } from "./queue-demo";

export type ViewRole = "operator" | "compliance_reviewer" | "platform_admin";

export const ROLE_LABEL: Record<ViewRole, string> = {
  operator: "Operator",
  compliance_reviewer: "Compliance reviewer",
  platform_admin: "Platform admin",
};

/** Permission matrix: Compliance holds — I.op R; I.comp R C U; I.admin R C U (audited). */
export function canDecide(role: ViewRole): boolean {
  return role === "compliance_reviewer" || role === "platform_admin";
}

export const BUYER_FACING_TEXT = "Compliance review required";

export const HOLD_STATE_LABEL: Record<HoldState, string> = {
  open: "Open",
  under_review: "Under review",
  released: "Released",
  released_with_conditions: "Released with conditions",
  declined: "Declined",
  escalated: "Escalated",
};

export const HOLD_STATE_TONE: Record<HoldState, "warn" | "teal" | "ok" | "danger" | "neutral"> = {
  open: "warn",
  under_review: "teal",
  released: "ok",
  released_with_conditions: "ok",
  declined: "danger",
  escalated: "neutral",
};

export const OUTCOME_LABEL: Record<Outcome, string> = {
  released: "Release",
  released_with_conditions: "Release with conditions",
  declined: "Decline",
  escalated: "Escalate",
};

export const OUTCOME_STATE: Record<Outcome, HoldState> = {
  released: "released",
  released_with_conditions: "released_with_conditions",
  declined: "declined",
  escalated: "escalated",
};

export const ESCALATION_TARGETS = [
  "Founder",
  "Outside counsel",
  "Licensed customs broker",
] as const;

export function isDecided(state: HoldState): boolean {
  return state !== "open" && state !== "under_review";
}

export const REASON_MIN_CHARS = 20;

export interface DecisionInput {
  outcome: Outcome | null;
  reason: string;
  conditions: string[];
  escalateTo: string | null;
}

export interface DecisionValidation {
  ok: boolean;
  errors: string[];
}

/** A decision needs an outcome, a reason a reader can act on, conditions when released with them, and a target when escalated. */
export function validateDecision(input: DecisionInput, role: ViewRole): DecisionValidation {
  const errors: string[] = [];
  if (!canDecide(role))
    errors.push("Only a compliance reviewer or platform admin can record a decision.");
  if (!input.outcome) errors.push("Choose an outcome.");
  if (input.reason.trim().length < REASON_MIN_CHARS)
    errors.push(
      `Write a reason of at least ${REASON_MIN_CHARS} characters; it goes into the audit record.`,
    );
  const conditions = input.conditions.map((c) => c.trim()).filter((c) => c.length > 0);
  if (input.outcome === "released_with_conditions" && conditions.length === 0)
    errors.push("Add at least one condition, or choose Release.");
  if (input.outcome === "escalated" && !input.escalateTo)
    errors.push("Choose who the hold is escalated to.");
  return { ok: errors.length === 0, errors };
}

/** What recording each outcome does downstream, by hold kind. Deterministic copy, never free text. */
export function effectOf(kind: HoldKind, outcome: Outcome): string {
  switch (outcome) {
    case "released":
      switch (kind) {
        case "blocked_category":
        case "export_sensitive":
        case "other_category":
          return "This brief can proceed to supplier options. The category stays blocked for self-service; the release applies to this brief only and is recorded on it.";
        case "disclosure_grant":
          return "The grant becomes active with its requested expiry; the buyer organization can see this contact until then. Revocation stays available to compliance and the supplier.";
        case "supplier_provenance":
          return "The supplier can appear in comparisons for regulated destinations. The stage gate records who released it and why.";
      }
      break;
    case "released_with_conditions":
      switch (kind) {
        case "blocked_category":
        case "export_sensitive":
        case "other_category":
          return "The brief proceeds, and each condition becomes a checkpoint the operator must clear before a sample request, supplier selection or handoff.";
        case "disclosure_grant":
          return "The grant becomes active with the conditions written into it (for example a shorter expiry or a single-purpose limit); they are shown to the operator and the buyer.";
        case "supplier_provenance":
          return "The supplier proceeds while the conditions (documents to provide, dates) are tracked as verification checks with due dates.";
      }
      break;
    case "declined":
      switch (kind) {
        case "blocked_category":
        case "export_sensitive":
        case "other_category":
          return "The brief cannot proceed. The buyer sees “Compliance review required” and the plain-language note you choose; your reason stays internal.";
        case "disclosure_grant":
          return "The draft grant is discarded; the contact stays with the operator and the buyer keeps using platform messages.";
        case "supplier_provenance":
          return "The supplier stays at its current stage and out of regulated-destination comparisons until documentation arrives and a new hold is reviewed.";
      }
      break;
    case "escalated":
      return "The hold stays in force. The escalation target is recorded and notified; the buyer or supplier sees no change until the escalation is resolved.";
  }
  return "";
}

/** Recording a decision claims the hold if needed and appends the audit note. */
export function applyDecision(
  hold: Hold,
  input: DecisionInput,
  by: string,
  role: ViewRole,
  at: string,
): Hold {
  if (!input.outcome || !canDecide(role)) return hold;
  const conditions = input.conditions.map((c) => c.trim()).filter((c) => c.length > 0);
  return {
    ...hold,
    assignee: hold.assignee ?? by,
    state: OUTCOME_STATE[input.outcome],
    decision: {
      outcome: input.outcome,
      by,
      role: role === "platform_admin" ? "platform_admin" : "compliance_reviewer",
      at,
      reason: input.reason.trim(),
      conditions,
      escalateTo: input.outcome === "escalated" ? input.escalateTo : null,
    },
    notes: [
      ...hold.notes,
      {
        at,
        by,
        text: `${OUTCOME_LABEL[input.outcome]}${input.escalateTo ? ` to ${input.escalateTo}` : ""}: ${input.reason.trim()}`,
      },
    ],
  };
}

export function holdSla(hold: Pick<Hold, "dueAt" | "state">, now: string): SlaInfo | null {
  return isDecided(hold.state) ? null : slaFor(hold.dueAt, now);
}

export interface HoldSummary {
  open: number;
  underReview: number;
  overdue: number;
  decided: number;
}

export function holdSummary(holds: readonly Hold[], now: string): HoldSummary {
  const s: HoldSummary = { open: 0, underReview: 0, overdue: 0, decided: 0 };
  for (const h of holds) {
    if (h.state === "open") s.open += 1;
    else if (h.state === "under_review") s.underReview += 1;
    else s.decided += 1;
    if (holdSla(h, now)?.state === "overdue") s.overdue += 1;
  }
  return s;
}

/** Overdue first, then open, then under review, then decided newest first. */
export function sortHolds(holds: readonly Hold[], now: string): Hold[] {
  const rank = (h: Hold) => {
    if (isDecided(h.state)) return 3;
    if (holdSla(h, now)?.state === "overdue") return 0;
    return h.state === "open" ? 1 : 2;
  };
  return [...holds].sort((a, b) => {
    const r = rank(a) - rank(b);
    if (r !== 0) return r;
    return isDecided(a.state)
      ? (b.decision?.at ?? "").localeCompare(a.decision?.at ?? "")
      : a.dueAt.localeCompare(b.dueAt);
  });
}
