/**
 * Display-only rules for the buyer inbox. They mirror the approval gate (PRD AC-B6.1, ADR-012:
 * buyer approves the wording, an operator approves and sends, the outbound record logs channel,
 * approver, time and text), the channel rule (platform message by default; WeChat relay only
 * where a contact basis is recorded; email is intake only) and the contact-confidentiality rule.
 * Nothing here sends anything; the real gate is server-side.
 */
import {
  CHANNEL_SHORT,
  type ApprovalRecord,
  type Channel,
  type SupplierRef,
  type Thread,
  type ThreadMessage,
} from "./demo-data/messages";

export type OutboundState =
  "awaiting_your_approval" | "returned_to_you" | "awaiting_operator" | "sent";

export type ThreadStatus =
  | "awaiting_your_approval"
  | "returned_to_you"
  | "awaiting_operator"
  | "awaiting_reply"
  | "replied"
  | "info";

export const THREAD_STATUS_LABEL: Record<ThreadStatus, string> = {
  awaiting_your_approval: "Needs your approval",
  returned_to_you: "Returned to you",
  awaiting_operator: "With the operator",
  awaiting_reply: "Sent, awaiting reply",
  replied: "Supplier replied",
  info: "Notice",
};

export const THREAD_STATUS_TONE: Record<ThreadStatus, "warn" | "teal" | "ok" | "neutral"> = {
  awaiting_your_approval: "warn",
  returned_to_you: "warn",
  awaiting_operator: "teal",
  awaiting_reply: "neutral",
  replied: "ok",
  info: "neutral",
};

/** State of one outbound message from its approval record. */
export function outboundState(m: Pick<ThreadMessage, "direction" | "approval">): OutboundState {
  if (m.direction !== "outbound" || !m.approval) return "sent";
  const a = m.approval;
  if (a.sent.at) return "sent";
  if (a.operator.state === "returned") return "returned_to_you";
  if (a.buyer.state !== "done") return "awaiting_your_approval";
  return "awaiting_operator";
}

/** The thread's status follows its latest non-system message. */
export function threadStatus(t: Pick<Thread, "messages">): ThreadStatus {
  const last = [...t.messages].reverse().find((m) => m.direction !== "system");
  if (!last) return "info";
  if (last.direction === "inbound") return "replied";
  const state = outboundState(last);
  return state === "sent" ? "awaiting_reply" : state;
}

export function needsYou(t: Pick<Thread, "messages">): boolean {
  const s = threadStatus(t);
  return s === "awaiting_your_approval" || s === "returned_to_you";
}

export function lastActivity(t: Pick<Thread, "messages">): string {
  return t.messages[t.messages.length - 1]?.at ?? "";
}

/** Threads that need the buyer come first; otherwise newest activity first. */
export function sortThreads<T extends Pick<Thread, "messages">>(threads: readonly T[]): T[] {
  return [...threads].sort((a, b) => {
    const na = needsYou(a) ? 0 : 1;
    const nb = needsYou(b) ? 0 : 1;
    if (na !== nb) return na - nb;
    return lastActivity(b).localeCompare(lastActivity(a));
  });
}

export interface InboxSummary {
  needsYou: number;
  awaitingOperator: number;
  awaitingReply: number;
  replied: number;
}

export function inboxSummary(threads: readonly Pick<Thread, "messages">[]): InboxSummary {
  const s: InboxSummary = { needsYou: 0, awaitingOperator: 0, awaitingReply: 0, replied: 0 };
  for (const t of threads) {
    switch (threadStatus(t)) {
      case "awaiting_your_approval":
      case "returned_to_you":
        s.needsYou += 1;
        break;
      case "awaiting_operator":
        s.awaitingOperator += 1;
        break;
      case "awaiting_reply":
        s.awaitingReply += 1;
        break;
      case "replied":
        s.replied += 1;
        break;
      case "info":
        break;
    }
  }
  return s;
}

export type ChainState = "done" | "waiting" | "pending" | "returned";

export interface ChainStep {
  who: string;
  state: ChainState;
  at: string | null;
  note: string | null;
}

/** You → Operator → Sent via <channel>, with exactly one step waiting until the message is sent. */
export function approvalChain(a: ApprovalRecord, channel: Channel): ChainStep[] {
  const sent = a.sent.at !== null;
  const buyer: ChainStep = {
    who: "You",
    state: a.buyer.state === "done" ? "done" : "waiting",
    at: a.buyer.at,
    note: a.buyer.note,
  };
  const operator: ChainStep = {
    who: "Operator",
    state:
      a.operator.state === "returned"
        ? "returned"
        : a.operator.state === "done"
          ? "done"
          : a.buyer.state === "done"
            ? "waiting"
            : "pending",
    at: a.operator.at,
    note: a.operator.note,
  };
  if (operator.state === "returned") buyer.state = "waiting";
  const sentStep: ChainStep = {
    who: `Sent via ${CHANNEL_SHORT[a.sent.channel ?? channel]}`,
    state: sent ? "done" : "pending",
    at: a.sent.at,
    note: a.sent.externalRef ? `ref ${a.sent.externalRef}` : null,
  };
  return [buyer, operator, sentStep];
}

/** The buyer may approve a draft only while both approvals are open and both languages exist. */
export function canApprove(m: ThreadMessage): boolean {
  return (
    m.direction === "outbound" &&
    m.approval !== null &&
    m.approval.sent.at === null &&
    m.approval.buyer.state !== "done" &&
    m.en.trim().length > 0 &&
    (m.zh ?? "").trim().length > 0
  );
}

export const DRAFT_MAX_CHARS = 2000;

/** Phone numbers, e-mail addresses and messaging handles have no place in a supplier message. */
const CONTACT_PATTERN = /(\+?\d[\d\s-]{6,}\d)|(@)|(wechat|weixin|微信|whatsapp|telegram)/i;

export interface DraftValidation {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

export function validateDraft(en: string): DraftValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const text = en.trim();
  if (text.length === 0)
    errors.push("Write the question in English; the Chinese draft is prepared from it.");
  if (text.length > DRAFT_MAX_CHARS)
    errors.push(`Keep it under ${DRAFT_MAX_CHARS.toLocaleString("en-US")} characters.`);
  if (CONTACT_PATTERN.test(text))
    warnings.push(
      "This looks like contact details. Contacts are exchanged only under a recorded disclosure grant; the operator removes them from messages.",
    );
  return { ok: errors.length === 0, errors, warnings };
}

/** Platform message always; WeChat relay only where the CRM recorded a contact basis for it. */
export function allowedChannels(
  supplier: Pick<SupplierRef, "wechatConsentRecordedAt"> | null,
): Channel[] {
  if (!supplier) return [];
  return supplier.wechatConsentRecordedAt ? ["platform", "wechat_relay"] : ["platform"];
}

export interface OutboundLogRow {
  messageId: string;
  at: string;
  channel: Channel;
  buyerApprovedBy: string;
  buyerApprovedAt: string;
  operatorApprovedBy: string;
  operatorApprovedAt: string;
  externalRef: string | null;
}

/** Channel · approver · timestamp rows for every message that actually left the system. */
export function outboundLog(t: Pick<Thread, "messages">): OutboundLogRow[] {
  const rows: OutboundLogRow[] = [];
  for (const m of t.messages) {
    const a = m.approval;
    if (m.direction !== "outbound" || !a || !a.sent.at || !a.sent.channel) continue;
    rows.push({
      messageId: m.id,
      at: a.sent.at,
      channel: a.sent.channel,
      buyerApprovedBy: a.buyer.by ?? "—",
      buyerApprovedAt: a.buyer.at ?? "—",
      operatorApprovedBy: a.operator.by ?? "—",
      operatorApprovedAt: a.operator.at ?? "—",
      externalRef: a.sent.externalRef,
    });
  }
  return rows;
}

/** A thread accepts a new question unless it was closed by a system note or has no supplier. */
export function canCompose(t: Pick<Thread, "supplier" | "kind" | "messages">): boolean {
  if (!t.supplier) return false;
  if (t.kind === "sample") return false;
  const last = t.messages[t.messages.length - 1];
  if (last && last.direction === "outbound" && outboundState(last) !== "sent") return false;
  return true;
}
