/**
 * Display-only rules for Buyer Cases. Priority is derived from category and age, never chosen;
 * turnaround targets are internal pilot targets (master spec "Speed": no response-time promise
 * before pilot data proves it); replies to buyers are written by a person, carry the record they
 * concern, and are checked against the no-claims rule (CLAUDE.md §4: no "lowest price", "zero
 * defects", "guaranteed delivery", "verified factory"); internal notes never reach the buyer;
 * resolving needs a code and a note; escalating needs a target and a reason.
 */
import {
  BUYER_CASES,
  CASE_TARGET_HOURS,
  type BuyerCase,
  type CaseStatus,
  type CaseUpdate,
  type LinkedRecord,
  type ResolutionCode,
} from "./demo-data/ops-cases";
import { slaFor, type SlaInfo } from "./queue-demo";

export const STATUS_LABEL: Record<CaseStatus, string> = {
  open: "Open",
  awaiting_buyer: "Awaiting buyer",
  resolved: "Resolved",
};

export const STATUS_TONE: Record<CaseStatus, "warn" | "teal" | "ok"> = {
  open: "warn",
  awaiting_buyer: "teal",
  resolved: "ok",
};

export type Priority = "high" | "normal";

export function targetDueAt(c: Pick<BuyerCase, "openedAt" | "category">): string {
  const d = new Date(c.openedAt);
  d.setUTCHours(d.getUTCHours() + CASE_TARGET_HOURS[c.category]);
  return d.toISOString();
}

/** The pilot target as a chip; null once resolved or while the buyer holds the ball. */
export function caseSla(c: BuyerCase, now: string): SlaInfo | null {
  if (c.status !== "open") return null;
  return slaFor(targetDueAt(c), now);
}

/** Complaints, escalations, data issues on an active comparison, and anything overdue are high. */
export function priorityOf(c: BuyerCase, now: string): Priority {
  if (c.status === "resolved") return "normal";
  if (c.category === "complaint" || c.escalation) return "high";
  if (c.category === "data_issue") return "high";
  if (caseSla(c, now)?.state === "overdue") return "high";
  return "normal";
}

const CLAIM_PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: /lowest\s+price/i, label: "“lowest price”" },
  { re: /zero\s+defects?/i, label: "“zero defects”" },
  { re: /defect[- ]free/i, label: "“defect-free”" },
  { re: /guarantee[ds]?\b/i, label: "“guarantee”" },
  { re: /verified\s+factory/i, label: "“verified factory”" },
  { re: /certified\s+supplier/i, label: "“certified supplier”" },
  { re: /within\s+\d+\s+(business\s+)?(hours|days)/i, label: "a response-time promise" },
];

/** CLAUDE.md §4 no-claims rule plus the no-SLA-promise rule, applied to anything sent to a buyer. */
export function claimsCheck(text: string): string[] {
  return CLAIM_PATTERNS.filter((p) => p.re.test(text)).map((p) => p.label);
}

export interface ReplyInput {
  text: string;
  linkedIndex: number | null;
}

export function validateReply(input: ReplyInput, c: BuyerCase): string[] {
  const errors: string[] = [];
  if (input.text.trim().length < 10) errors.push("Write the reply (at least 10 characters).");
  const claims = claimsCheck(input.text);
  if (claims.length > 0)
    errors.push(
      `Remove ${claims.join(", ")}: replies to buyers carry no claims or response-time promises.`,
    );
  if (c.category === "data_issue" && input.linkedIndex === null)
    errors.push("A data-issue reply must name the record it corrects or confirms.");
  return errors;
}

export function validateNote(text: string): string | null {
  return text.trim().length < 3 ? "Write the note." : null;
}

export function validateResolution(code: ResolutionCode | null, note: string): string[] {
  const errors: string[] = [];
  if (!code) errors.push("Choose a resolution.");
  if (note.trim().length < 10)
    errors.push("Write what resolved it (at least 10 characters); the buyer sees this.");
  return errors;
}

export function validateEscalation(to: string, reason: string): string[] {
  const errors: string[] = [];
  if (!to) errors.push("Choose who the case is escalated to.");
  if (reason.trim().length < 10) errors.push("Give the reason (at least 10 characters).");
  return errors;
}

export const ESCALATION_TARGETS = ["Founder", "Compliance reviewer", "Platform admin"] as const;

function nextId(c: BuyerCase): string {
  return `u${c.updates.length + 1}`;
}

/** A reply is buyer-visible, names its record, and hands the case to the buyer. */
export function applyReply(c: BuyerCase, input: ReplyInput, by: string, at: string): BuyerCase {
  const linked: LinkedRecord | null =
    input.linkedIndex === null ? null : (c.linked[input.linkedIndex] ?? null);
  const reply: CaseUpdate = {
    id: nextId(c),
    at,
    kind: "reply",
    by,
    text: input.text.trim(),
    linked,
    buyerVisible: true,
  };
  const status: CaseUpdate = {
    id: `u${c.updates.length + 2}`,
    at,
    kind: "status",
    by,
    text: "Awaiting the buyer's confirmation",
    linked: null,
    buyerVisible: false,
  };
  return {
    ...c,
    status: "awaiting_buyer",
    assignee: c.assignee ?? by,
    updates: [...c.updates, reply, status],
  };
}

export function applyNote(c: BuyerCase, text: string, by: string, at: string): BuyerCase {
  return {
    ...c,
    updates: [
      ...c.updates,
      {
        id: nextId(c),
        at,
        kind: "internal_note",
        by,
        text: text.trim(),
        linked: null,
        buyerVisible: false,
      },
    ],
  };
}

export function applyResolve(
  c: BuyerCase,
  code: ResolutionCode,
  note: string,
  by: string,
  at: string,
): BuyerCase {
  return {
    ...c,
    status: "resolved",
    resolution: { code, note: note.trim(), by, at },
    updates: [
      ...c.updates,
      {
        id: nextId(c),
        at,
        kind: "status",
        by,
        text: `Resolved: ${note.trim()}`,
        linked: null,
        buyerVisible: true,
      },
    ],
  };
}

export function applyEscalate(
  c: BuyerCase,
  to: string,
  reason: string,
  by: string,
  at: string,
): BuyerCase {
  return {
    ...c,
    escalation: { to, reason: reason.trim(), at },
    updates: [
      ...c.updates,
      {
        id: nextId(c),
        at,
        kind: "escalation",
        by,
        text: `Escalated to ${to}: ${reason.trim()}`,
        linked: null,
        buyerVisible: false,
      },
    ],
  };
}

/** The buyer may reopen within 7 days; the operator reopens on their behalf with the buyer's message. */
export function applyReopen(c: BuyerCase, buyerText: string, at: string): BuyerCase {
  return {
    ...c,
    status: "open",
    resolution: null,
    updates: [
      ...c.updates,
      {
        id: nextId(c),
        at,
        kind: "buyer_message",
        by: `${c.contactName} (${c.buyerOrg})`,
        text: buyerText.trim(),
        linked: null,
        buyerVisible: true,
      },
    ],
  };
}

export interface CasesSummary {
  open: number;
  overdue: number;
  awaitingBuyer: number;
  escalated: number;
}

export function casesSummary(cases: readonly BuyerCase[], now: string): CasesSummary {
  const s: CasesSummary = { open: 0, overdue: 0, awaitingBuyer: 0, escalated: 0 };
  for (const c of cases) {
    if (c.status === "open") s.open += 1;
    if (c.status === "awaiting_buyer") s.awaitingBuyer += 1;
    if (caseSla(c, now)?.state === "overdue") s.overdue += 1;
    if (c.escalation && c.status !== "resolved") s.escalated += 1;
  }
  return s;
}

/** Overdue first, then open high, then open, then awaiting buyer, then resolved newest first. */
export function sortCases(cases: readonly BuyerCase[], now: string): BuyerCase[] {
  const rank = (c: BuyerCase) => {
    if (c.status === "resolved") return 4;
    if (c.status === "awaiting_buyer") return 3;
    if (caseSla(c, now)?.state === "overdue") return 0;
    return priorityOf(c, now) === "high" ? 1 : 2;
  };
  return [...cases].sort((a, b) => rank(a) - rank(b) || b.openedAt.localeCompare(a.openedAt));
}

export function buyerVisibleUpdates(c: BuyerCase): CaseUpdate[] {
  return c.updates.filter((u) => u.buyerVisible);
}

export { BUYER_CASES };
