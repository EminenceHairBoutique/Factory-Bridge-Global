/**
 * Display-only rules for the supplier 文件资料 screen. They mirror the upload pipeline
 * (docs/SECURITY.md §4), the "供应商提供，未核验 until a platform check" rule (PRD; SECURITY.md T20),
 * the certification checklist in `ONBOARDING_DOC_TYPES`, and the evidence rule that reviewed files
 * are replaced by a new version rather than deleted. Nothing here uploads, scans or reviews.
 */
import type { DocumentStatus } from "@fbg/domain";
import { ONBOARDING_DOC_TYPES } from "./demo-data/supplier";
import type { SupplierDocument } from "./demo-data/supplier-documents";

export const SD_STATUS_LABEL: Record<DocumentStatus, string> = {
  uploaded: "已上传",
  scanning: "扫描中",
  rejected: "已拒绝",
  parsed: "已解析",
  extracted: "已提取",
  in_review: "待平台审核",
  accepted: "已核验",
  discarded: "已作废",
};

export const SD_STATUS_TONE: Record<DocumentStatus, "neutral" | "teal" | "danger" | "warn" | "ok"> =
  {
    uploaded: "neutral",
    scanning: "teal",
    rejected: "danger",
    parsed: "neutral",
    extracted: "teal",
    in_review: "warn",
    accepted: "ok",
    discarded: "neutral",
  };

/** Quotation files are "relayed" rather than "verified" once the platform accepts them. */
export function statusLabel(doc: Pick<SupplierDocument, "status" | "category">): string {
  if (doc.status === "accepted" && doc.category === "报价与询价") return "已转达";
  return SD_STATUS_LABEL[doc.status];
}

/** Every supplier upload is 供应商提供，未核验 until a platform check references it. */
export function reviewLabel(doc: Pick<SupplierDocument, "review" | "status">): string {
  if (doc.status === "rejected") return "已拒绝";
  if (doc.review.state === "已核验" && doc.review.at) return `已核验（平台 · ${doc.review.at}）`;
  return "供应商提供，未核验";
}

export type ExpiryState = "未注明" | "有效" | "即将到期" | "已到期";

export interface Expiry {
  state: ExpiryState;
  days: number | null;
}

/** Days are relative to the demo "today"; 30 days or less is 即将到期. */
export function expiryState(expiresAt: string | null, today: string): Expiry {
  if (!expiresAt) return { state: "未注明", days: null };
  const a = new Date(`${expiresAt}T00:00:00Z`).getTime();
  const b = new Date(`${today}T00:00:00Z`).getTime();
  const days = Math.round((a - b) / 86_400_000);
  if (days < 0) return { state: "已到期", days };
  if (days <= 30) return { state: "即将到期", days };
  return { state: "有效", days };
}

export type ChecklistState = "待上传" | "扫描中" | "待平台审核" | "已核验" | "已拒绝";

export interface ChecklistItem {
  key: string;
  label: string;
  required: boolean;
  state: ChecklistState;
  document: SupplierDocument | null;
}

/** The onboarding certification items, each resolved to its newest live document. */
export function certificateChecklist(
  docs: readonly SupplierDocument[],
  isFactory = true,
): ChecklistItem[] {
  return ONBOARDING_DOC_TYPES.filter((t) => !(t.factoryOnly && !isFactory)).map((t) => {
    const candidates = docs
      .filter((d) => d.requiredKey === t.key && d.status !== "discarded")
      .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
    const live = candidates.find((d) => d.status !== "rejected") ?? candidates[0] ?? null;
    let state: ChecklistState = "待上传";
    if (live) {
      if (live.status === "rejected") state = "已拒绝";
      else if (live.status === "uploaded" || live.status === "scanning") state = "扫描中";
      else if (live.review.state === "已核验") state = "已核验";
      else state = "待平台审核";
    }
    return { key: t.key, label: t.label, required: t.required, state, document: live };
  });
}

export interface SdSummary {
  total: number;
  needsAction: number;
  inReview: number;
  expiring: number;
  verified: number;
}

/** 需补充 = required certification items that are missing or rejected. */
export function documentsSummary(
  docs: readonly SupplierDocument[],
  today: string,
  isFactory = true,
): SdSummary {
  const live = docs.filter((d) => d.status !== "discarded");
  const checklist = certificateChecklist(docs, isFactory);
  return {
    total: live.length,
    needsAction: checklist.filter(
      (c) => c.required && (c.state === "待上传" || c.state === "已拒绝"),
    ).length,
    inReview: live.filter((d) => d.status === "in_review").length,
    expiring: live.filter((d) => {
      const e = expiryState(d.expiresAt, today).state;
      return e === "即将到期" || e === "已到期";
    }).length,
    verified: live.filter((d) => d.review.state === "已核验").length,
  };
}

export interface Decision {
  ok: boolean;
  reason: string | null;
}

/** Reviewed and relayed files are evidence: they can be superseded by a new version, never deleted. */
export function canDelete(doc: Pick<SupplierDocument, "status" | "review" | "category">): Decision {
  if (doc.status === "discarded") return { ok: false, reason: "已作废的文件不能再操作。" };
  if (doc.review.state === "已核验")
    return {
      ok: false,
      reason: "已核验的文件是认证或报价的依据，不能删除；如有新版本，请使用“替换”。",
    };
  if (doc.status === "rejected")
    return { ok: true, reason: "已拒绝的文件会在 7 天后自动从隔离区删除；您也可以现在移除记录。" };
  if (doc.status === "in_review") return { ok: true, reason: "删除后将撤回平台审核。" };
  return { ok: true, reason: null };
}

export function canReplace(doc: Pick<SupplierDocument, "status">): boolean {
  return doc.status !== "discarded" && doc.status !== "uploaded" && doc.status !== "scanning";
}

/** A signed download link exists only for files that left quarantine and are still in use. */
export function canDownload(doc: Pick<SupplierDocument, "status">): boolean {
  return (
    doc.status === "parsed" ||
    doc.status === "extracted" ||
    doc.status === "in_review" ||
    doc.status === "accepted"
  );
}

/** Where the pipeline goes after a successful step, by category; null when a human acts or it stops. */
export function nextStatusFor(
  status: DocumentStatus,
  category: SupplierDocument["category"],
): DocumentStatus | null {
  switch (status) {
    case "uploaded":
      return "scanning";
    case "scanning":
      return "parsed";
    case "parsed":
      return category === "产品资料" ? null : "in_review";
    case "extracted":
    case "in_review":
    case "accepted":
    case "rejected":
    case "discarded":
      return null;
  }
}

/** Replacing creates version n+1 as a fresh upload and marks the old file 已作废 (kept as history). */
export function replaceDocument(
  docs: readonly SupplierDocument[],
  id: string,
  file: { name: string; type: string; size: number },
  at: string,
): { docs: SupplierDocument[]; created: SupplierDocument | null } {
  const old = docs.find((d) => d.id === id);
  if (!old || !canReplace(old)) return { docs: [...docs], created: null };
  const created: SupplierDocument = {
    ...old,
    id: `${old.id}_v${old.version + 1}`,
    name: file.name,
    mime: file.type,
    bytes: file.size,
    version: old.version + 1,
    uploadedAt: at,
    uploadedBy: "我方",
    status: "uploaded",
    scanReason: null,
    review: { state: "未核验", by: null, at: null, note: null, checkRef: null },
    access: [],
    supersedes: old.id,
  };
  return {
    docs: [created, ...docs.map((d) => (d.id === id ? { ...d, status: "discarded" as const } : d))],
    created,
  };
}

/** One simulated pipeline step for a preview upload. */
export function advanceSupplierDocument(doc: SupplierDocument): SupplierDocument {
  const next = nextStatusFor(doc.status, doc.category);
  return next ? { ...doc, status: next } : doc;
}

export function sortDocuments<T extends Pick<SupplierDocument, "uploadedAt" | "status">>(
  docs: readonly T[],
): T[] {
  const rank = (d: T) => (d.status === "rejected" ? 0 : d.status === "in_review" ? 1 : 2);
  return [...docs].sort((a, b) => rank(a) - rank(b) || b.uploadedAt.localeCompare(a.uploadedAt));
}
