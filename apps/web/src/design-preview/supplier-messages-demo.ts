/**
 * Display-only rules for the supplier 消息 inbox. They mirror ADR-012 (supplier replies reach the
 * buyer only through an operator relay), the contact-confidentiality rule (contact details are
 * removed from messages unless a disclosure grant exists) and the structured-quote rule (prices
 * belong in 提交报价, never in free text). Nothing here sends or relays anything.
 */
import type { SmThread } from "./demo-data/supplier-messages";

export type SmStatus = "待回复" | "待转达" | "已转达" | "已完成" | "通知";

export const SM_STATUS_TONE: Record<SmStatus, "warn" | "teal" | "ok" | "neutral"> = {
  待回复: "warn",
  待转达: "teal",
  已转达: "ok",
  已完成: "neutral",
  通知: "neutral",
};

export const SM_STATUS_HINT: Record<SmStatus, string> = {
  待回复: "买家在等您的回复",
  待转达: "您的回复待平台核对并转达",
  已转达: "回复已转达买家，等待买家处理",
  已完成: "会话已结束",
  通知: "平台通知，无需回复",
};

/** Follows the latest buyer or supplier message; platform-only threads are notices. */
export function smThreadStatus(t: Pick<SmThread, "messages" | "closed">): SmStatus {
  const last = [...t.messages].reverse().find((m) => m.direction !== "平台");
  if (!last) return "通知";
  if (t.closed) return "已完成";
  if (last.direction === "买家") return "待回复";
  return last.relayedAt ? "已转达" : "待转达";
}

export function smLastActivity(t: Pick<SmThread, "messages">): string {
  return t.messages[t.messages.length - 1]?.at ?? "";
}

const ORDER: Record<SmStatus, number> = { 待回复: 0, 待转达: 1, 已转达: 2, 通知: 3, 已完成: 4 };

/** 待回复 first, then 待转达, then newest activity. */
export function sortSmThreads<T extends Pick<SmThread, "messages" | "closed">>(
  threads: readonly T[],
): T[] {
  return [...threads].sort((a, b) => {
    const oa = ORDER[smThreadStatus(a)];
    const ob = ORDER[smThreadStatus(b)];
    if (oa !== ob) return oa - ob;
    return smLastActivity(b).localeCompare(smLastActivity(a));
  });
}

export interface SmSummary {
  pendingReply: number;
  pendingRelay: number;
  unread: number;
}

export function smSummary(
  threads: readonly Pick<SmThread, "messages" | "closed" | "unread">[],
): SmSummary {
  const s: SmSummary = { pendingReply: 0, pendingRelay: 0, unread: 0 };
  for (const t of threads) {
    const st = smThreadStatus(t);
    if (st === "待回复") s.pendingReply += 1;
    if (st === "待转达") s.pendingRelay += 1;
    if (t.unread) s.unread += 1;
  }
  return s;
}

/** A reply is possible on open buyer threads once the previous reply has been relayed. */
export function canReply(t: Pick<SmThread, "messages" | "closed" | "kind">): boolean {
  if (t.closed || t.kind === "通知") return false;
  const st = smThreadStatus(t);
  return st === "待回复" || st === "已转达";
}

export const REPLY_MAX_CHARS = 2000;

const CONTACT_PATTERN =
  /(1[3-9]\d{9})|(\+?\d[\d\s-]{6,}\d)|(微信|wechat|weixin|\bvx\b|\bwx\b|qq\s*[:：]?\s*\d{5,}|@|whatsapp|telegram|电话|手机)/i;

const PRICE_PATTERN =
  /([¥￥$]\s*\d)|((usd|rmb|人民币|美元)\s*\d)|(\d[\d,]*(\.\d+)?\s*(元|块)(\/|每)?)/i;

export interface ReplyValidation {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

export function validateReplyZh(text: string): ReplyValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const v = text.trim();
  if (v.length === 0) errors.push("请输入回复内容。");
  if (v.length > REPLY_MAX_CHARS)
    errors.push(`回复请控制在 ${REPLY_MAX_CHARS.toLocaleString("en-US")} 字以内。`);
  if (CONTACT_PATTERN.test(v))
    warnings.push(
      "回复中似乎包含联系方式（手机号、微信等）。平台仅在买家获得授权后共享联系方式，转达前会将其移除。",
    );
  if (PRICE_PATTERN.test(v))
    warnings.push("回复中似乎包含价格。价格请通过“提交报价”填写；消息中的价格不会进入买家比价。");
  return { ok: errors.length === 0, errors, warnings };
}

/** Chinese wording for the shared upload pre-check (`documents-demo.ts`). */
export const UPLOAD_REASON_ZH: Record<string, string> = {
  "empty file": "空文件",
  "file type not accepted (PDF, XLSX, CSV, PNG, JPG or WebP only)":
    "不支持的文件类型（仅限 PDF、XLSX、CSV、PNG、JPG、WebP）",
  "larger than 25 MB": "超过 25 MB",
  "file extension does not match its type": "扩展名与文件类型不符",
};

export interface RelayRow {
  messageId: string;
  sentAt: string;
  relayedAt: string;
  channel: string;
  checkedBy: string;
}

/** 转达记录: every supplier reply that the platform has relayed, with when and by whom it was checked. */
export function relayLog(t: Pick<SmThread, "messages">): RelayRow[] {
  return t.messages
    .filter((m) => m.direction === "我方" && m.relayedAt !== null)
    .map((m) => ({
      messageId: m.id,
      sentAt: m.at,
      relayedAt: m.relayedAt ?? "",
      channel: "平台消息",
      checkedBy: "平台运营",
    }));
}
