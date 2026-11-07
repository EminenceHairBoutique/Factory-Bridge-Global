/**
 * Quotation lifecycle transition table (ADR-021; MIGRATION_DEPENDENCY_MAP.md §6).
 * Pure: the database function app.transition_quotation mirrors this table; a test keeps them aligned.
 */
import type { QuoteStatus } from "../enums.js";

export type TransitionActor =
  "reviewer" | "assigned_operator" | "supplier_owner" | "system" | "platform_admin";

interface Rule {
  readonly to: QuoteStatus;
  readonly actors: readonly TransitionActor[];
  readonly viaSupersedeOnly?: boolean;
}

const RULES: Record<QuoteStatus, readonly Rule[]> = {
  confirmed: [
    {
      to: "superseded",
      actors: ["reviewer", "assigned_operator", "platform_admin"],
      viaSupersedeOnly: true,
    },
    { to: "expired", actors: ["system", "assigned_operator", "platform_admin"] },
    { to: "withdrawn", actors: ["assigned_operator", "supplier_owner", "platform_admin"] },
  ],
  expired: [
    {
      to: "superseded",
      actors: ["reviewer", "assigned_operator", "platform_admin"],
      viaSupersedeOnly: true,
    },
  ],
  superseded: [],
  withdrawn: [],
};

export type TransitionVerdict =
  | { allowed: true; viaSupersedeOnly: boolean }
  | { allowed: false; reason: "terminal_state" | "invalid_transition" | "actor_not_permitted" };

export function canTransition(
  from: QuoteStatus,
  to: QuoteStatus,
  actor: TransitionActor,
): TransitionVerdict {
  const rules = RULES[from];
  if (rules.length === 0) return { allowed: false, reason: "terminal_state" };
  const rule = rules.find((r) => r.to === to);
  if (!rule) return { allowed: false, reason: "invalid_transition" };
  if (!rule.actors.includes(actor)) return { allowed: false, reason: "actor_not_permitted" };
  return { allowed: true, viaSupersedeOnly: rule.viaSupersedeOnly ?? false };
}

export function isTerminal(status: QuoteStatus): boolean {
  return RULES[status].length === 0;
}

/** Eligibility for ranking in a comparison: only a current, confirmed quotation. */
export function isEligibleForComparison(status: QuoteStatus, isCurrent: boolean): boolean {
  return status === "confirmed" && isCurrent;
}
