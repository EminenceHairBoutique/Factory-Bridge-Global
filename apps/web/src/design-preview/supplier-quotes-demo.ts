/**
 * Display-only lifecycle rules for 我的报价. They mirror migration 0009 / ADR-021: a confirmed
 * quotation's payload is immutable, so any change is a new version (供应商 submits, 平台 confirms and
 * marks the old one 已更新); the supplier may withdraw a confirmed quotation (transition table:
 * confirmed → withdrawn by supplier_owner) with a reason of at least three characters; superseded
 * and withdrawn are terminal; a pending submission can be taken back before review. Validity is a
 * date or 未注明, never perpetual. Nothing here writes anywhere.
 */
import type { QuoteStatus } from "@fbg/domain";
import type { IncotermCode, SupplierTier } from "./demo-data/supplier";
import { QUOTE_VERSIONS, type QuoteGroup, type QuoteVersion } from "./demo-data/supplier-quotes";
import {
  daysUntil,
  formatZhDate,
  formatZhMoney,
  quoteSubmissionGate,
  validateTiers,
} from "./supplier-demo";

export type ZhQuoteStatus =
  "待审核" | "审核未通过" | "已确认" | "即将过期" | "已过期" | "已更新" | "已撤回" | "已撤销提交";

export const QUOTE_STATUS_TONE: Record<
  ZhQuoteStatus,
  "neutral" | "teal" | "ok" | "warn" | "danger" | "ink"
> = {
  待审核: "teal",
  审核未通过: "danger",
  已确认: "ok",
  即将过期: "warn",
  已过期: "danger",
  已更新: "neutral",
  已撤回: "neutral",
  已撤销提交: "neutral",
};

export const EXPIRING_DAYS = 7;

export function zhStatus(v: QuoteVersion, today: string): ZhQuoteStatus {
  if (v.reviewStatus === "pending" || v.reviewStatus === "in_review") return "待审核";
  if (v.reviewStatus === "rejected") return v.status === "withdrawn" ? "已撤销提交" : "审核未通过";
  switch (v.status) {
    case "superseded":
      return "已更新";
    case "withdrawn":
      return "已撤回";
    case "expired":
      return "已过期";
    case "confirmed": {
      const left = daysUntil(v.validUntil, today);
      if (left !== null && left < 0) return "已过期";
      if (left !== null && left <= EXPIRING_DAYS) return "即将过期";
      return "已确认";
    }
    case null:
      return "待审核";
  }
}

export function currentVersion(
  group: QuoteGroup,
  versions: readonly QuoteVersion[] = QUOTE_VERSIONS,
): QuoteVersion | null {
  return versions.filter((v) => v.groupId === group.id).find((v) => v.isCurrent) ?? null;
}

export function versionsOf(
  group: QuoteGroup,
  versions: readonly QuoteVersion[] = QUOTE_VERSIONS,
): QuoteVersion[] {
  return versions.filter((v) => v.groupId === group.id).sort((a, b) => b.version - a.version);
}

export function validityText(v: QuoteVersion, today: string): string {
  if (!v.validUntil) return "有效期未注明（买家看到“有效期未确认”）";
  const left = daysUntil(v.validUntil, today) ?? 0;
  if (left < 0) return `已于 ${formatZhDate(v.validUntil)} 过期`;
  return `有效期至 ${formatZhDate(v.validUntil)}（剩余 ${left} 天）`;
}

/** confirmed → withdrawn is allowed for the supplier; everything else is terminal, pending, or needs a new version. */
export function canWithdraw(v: QuoteVersion, today: string): boolean {
  const s = zhStatus(v, today);
  return v.isCurrent && (s === "已确认" || s === "即将过期");
}

/** A pending submission can be taken back before the platform reviews it. */
export function canCancelSubmission(v: QuoteVersion): boolean {
  return v.reviewStatus === "pending";
}

/** A new version may follow the current confirmed, expiring or expired version; not while one is under review. */
export function canUpdate(
  v: QuoteVersion,
  today: string,
  group: QuoteGroup,
  versions: readonly QuoteVersion[] = QUOTE_VERSIONS,
): boolean {
  if (!v.isCurrent) return false;
  if (
    versionsOf(group, versions).some(
      (x) => x.reviewStatus === "pending" || x.reviewStatus === "in_review",
    )
  )
    return false;
  const s = zhStatus(v, today);
  return s === "已确认" || s === "即将过期" || s === "已过期";
}

export function withdrawReasonError(reason: string): string | null {
  return reason.trim().length < 3 ? "请填写撤回原因（至少 3 个字），买家将看到报价已撤回。" : null;
}

export function applyWithdraw(v: QuoteVersion, reason: string, at: string): QuoteVersion {
  return {
    ...v,
    status: "withdrawn",
    events: [
      ...v.events,
      { at, from: "confirmed", to: "withdrawn", actor: "供应商（您）", reason: reason.trim() },
    ],
  };
}

export function applyCancelSubmission(v: QuoteVersion, reason: string, at: string): QuoteVersion {
  return {
    ...v,
    reviewStatus: "rejected",
    status: "withdrawn",
    events: [
      ...v.events,
      {
        at,
        from: "submitted",
        to: "review_rejected",
        actor: "供应商（您）",
        reason: `撤销提交：${reason.trim()}`,
      },
    ],
  };
}

/* ---------- New version (更新报价) ---------- */

export interface VersionDraft {
  currency: "CNY" | "USD";
  unit: string;
  basisCode: IncotermCode;
  basisPlace: string;
  tiers: SupplierTier[];
  toolingAmount: string;
  toolingIncluded: boolean;
  leadTimeDays: string;
  paymentTerms: string;
  validUntil: string;
  notes: string;
  changeReason: string;
  specConfirmed: boolean;
}

export function draftFromVersion(v: QuoteVersion): VersionDraft {
  return {
    currency: v.currency,
    unit: v.unit,
    basisCode: v.basisCode,
    basisPlace: v.basisPlace,
    tiers: v.tiers.map((t) => ({ ...t })),
    toolingAmount: v.toolingAmount === null ? "" : String(v.toolingAmount),
    toolingIncluded: v.toolingIncluded,
    leadTimeDays: String(v.leadTimeDays),
    paymentTerms: v.paymentTerms,
    validUntil: "",
    notes: "",
    changeReason: "",
    specConfirmed: false,
  };
}

export interface VersionDiff {
  field: string;
  before: string;
  after: string;
}

function tiersText(tiers: readonly SupplierTier[], currency: "CNY" | "USD"): string {
  return tiers
    .filter((t) => t.minQty !== null && t.unitPrice !== null)
    .map(
      (t) =>
        `${t.minQty}${t.maxQty === null ? "+" : `–${(t.maxQty ?? 0) - 1}`} @ ${formatZhMoney(t.unitPrice ?? 0, currency, 4)}`,
    )
    .join("；");
}

/** The fields that differ between two versions, in Chinese, for the history and the submission gate. */
export function diffVersions(
  before: QuoteVersion,
  after: Pick<
    QuoteVersion,
    | "currency"
    | "unit"
    | "basisCode"
    | "basisPlace"
    | "tiers"
    | "toolingAmount"
    | "toolingIncluded"
    | "leadTimeDays"
    | "paymentTerms"
    | "validUntil"
  >,
): VersionDiff[] {
  const out: VersionDiff[] = [];
  const push = (field: string, a: string, b: string) => {
    if (a !== b) out.push({ field, before: a, after: b });
  };
  push("货币", before.currency, after.currency);
  push("单位", before.unit, after.unit);
  push(
    "交易条款",
    `${before.basisCode} ${before.basisPlace}`.trim(),
    `${after.basisCode} ${after.basisPlace}`.trim(),
  );
  push(
    "阶梯价格",
    tiersText(before.tiers, before.currency),
    tiersText(after.tiers, after.currency),
  );
  push(
    "模具费",
    before.toolingIncluded
      ? "已含在单价内"
      : before.toolingAmount === null
        ? "无"
        : formatZhMoney(before.toolingAmount, before.currency),
    after.toolingIncluded
      ? "已含在单价内"
      : after.toolingAmount === null
        ? "无"
        : formatZhMoney(after.toolingAmount, after.currency),
  );
  push("交期", `${before.leadTimeDays} 天`, `${after.leadTimeDays} 天`);
  push("付款方式", before.paymentTerms, after.paymentTerms);
  push("有效期", formatZhDate(before.validUntil), formatZhDate(after.validUntil));
  return out;
}

/** The RFQ gate plus: a change reason, a validity after today, and at least one difference from the previous version. */
export function newVersionGate(
  draft: VersionDraft,
  previous: QuoteVersion,
  today: string,
): string[] {
  const missing = quoteSubmissionGate({
    currency: draft.currency,
    unit: draft.unit,
    tiers: draft.tiers,
    basisCode: draft.basisCode,
    basisPlace: draft.basisPlace,
    validUntil: draft.validUntil,
    leadTimeDays: draft.leadTimeDays,
    specConfirmed: draft.specConfirmed,
  });
  if (/^\d{4}-\d{2}-\d{2}$/.test(draft.validUntil) && draft.validUntil <= today)
    missing.push("有效期须晚于今天");
  if (draft.changeReason.trim().length < 3) missing.push("更新原因（至少 3 个字）");
  if (
    validateTiers(draft.tiers).errors.length === 0 &&
    diffVersions(previous, draftAsVersion(draft)).length === 0
  )
    missing.push("与上一版本相同，请修改后再提交");
  return missing;
}

function draftAsVersion(d: VersionDraft) {
  return {
    currency: d.currency,
    unit: d.unit,
    basisCode: d.basisCode,
    basisPlace: d.basisPlace,
    tiers: d.tiers,
    toolingAmount: d.toolingIncluded
      ? null
      : d.toolingAmount.trim()
        ? Number(d.toolingAmount)
        : null,
    toolingIncluded: d.toolingIncluded,
    leadTimeDays: Number(d.leadTimeDays),
    paymentTerms: d.paymentTerms,
    validUntil: d.validUntil || null,
  };
}

/** The new version enters review; the previous stays current until the platform confirms and supersedes it. */
export function applyNewVersion(
  previous: QuoteVersion,
  draft: VersionDraft,
  at: string,
  today: string,
): QuoteVersion {
  const payload = draftAsVersion(draft);
  return {
    id: `${previous.groupId}_v${previous.version + 1}`,
    groupId: previous.groupId,
    version: previous.version + 1,
    reviewStatus: "pending",
    status: null,
    isCurrent: false,
    supersededBy: null,
    ...payload,
    basisConfirmed: true,
    tiers: payload.tiers.map((t) => ({ ...t })),
    quoteDate: today,
    confirmedAt: null,
    notes: draft.notes.trim(),
    submittedAt: today,
    events: [
      {
        at,
        from: null,
        to: "submitted",
        actor: "供应商（您）",
        reason: `更新报价（v${previous.version + 1}）：${draft.changeReason.trim()}`,
      },
    ],
  };
}

/* ---------- Lists ---------- */

export interface QuotesSummary {
  pending: number;
  expiring: number;
  expired: number;
  confirmed: number;
}

export function quotesSummary(
  groups: readonly QuoteGroup[],
  versions: readonly QuoteVersion[],
  today: string,
): QuotesSummary {
  const s: QuotesSummary = { pending: 0, expiring: 0, expired: 0, confirmed: 0 };
  for (const g of groups) {
    const all = versionsOf(g, versions);
    if (all.some((v) => v.reviewStatus === "pending" || v.reviewStatus === "in_review"))
      s.pending += 1;
    const cur = all.find((v) => v.isCurrent);
    if (!cur) continue;
    const st = zhStatus(cur, today);
    if (st === "即将过期") s.expiring += 1;
    else if (st === "已过期") s.expired += 1;
    else if (st === "已确认") s.confirmed += 1;
  }
  return s;
}

const ORDER: Record<ZhQuoteStatus, number> = {
  待审核: 0,
  即将过期: 1,
  已过期: 2,
  审核未通过: 3,
  已确认: 4,
  已更新: 5,
  已撤回: 6,
  已撤销提交: 6,
};

/** Threads needing attention first: under review, expiring, expired; then confirmed; terminal last. */
export function sortGroups(
  groups: readonly QuoteGroup[],
  versions: readonly QuoteVersion[],
  today: string,
): QuoteGroup[] {
  const key = (g: QuoteGroup) => {
    const all = versionsOf(g, versions);
    const pending = all.find((v) => v.reviewStatus === "pending" || v.reviewStatus === "in_review");
    const cur = all.find((v) => v.isCurrent);
    const st = pending ? "待审核" : cur ? zhStatus(cur, today) : "已撤回";
    return ORDER[st];
  };
  return [...groups].sort((a, b) => key(a) - key(b) || a.rfqRef.localeCompare(b.rfqRef));
}

export function eventTextZh(e: QuoteVersion["events"][number]): string {
  const to: Record<string, string> = {
    submitted: "已提交，待平台审核",
    confirmed: "平台确认，已转达买家",
    expired: "已过期",
    superseded: "已被新版本替代",
    withdrawn: "已撤回",
    review_rejected: "提交已撤销",
  };
  return `${e.at} · ${to[e.to] ?? e.to} · ${e.actor} · ${e.reason}`;
}

export function statusExplanation(s: ZhQuoteStatus): string {
  const map: Record<ZhQuoteStatus, string> = {
    待审核: "平台运营核对报价内容后才转达买家；审核期间可撤销提交。",
    审核未通过: "平台未能确认此报价；请查看消息中的说明后重新提交。",
    已确认: "买家可在比较中看到此版本。内容不可修改；如需变更请提交新版本。",
    即将过期: "到期后买家的比较将标注“报价已过期”并移除。可提交新版本延长有效期。",
    已过期: "买家的比较已移除此版本。提交新版本后经平台确认即恢复可见。",
    已更新: "已被更新的版本替代；仅保留作历史记录。",
    已撤回: "您已撤回；买家看到“报价已撤回”。如需重新报价，请等待新的询价。",
    已撤销提交: "提交已撤销，未转达买家。",
  };
  return map[s];
}

export type { QuoteStatus };
