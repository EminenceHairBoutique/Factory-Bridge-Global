/**
 * Display-only rules for the supplier's 生产与质检 page (IA §2.3 `/supplier/production`; master spec
 * supplier role "report production milestones and submit QA/inspection evidence"; QUALITY_ASSURANCE
 * §3–§5, §7). Dates are 已发生 (reported, not after today), 预计 (estimated) or 承诺 (committed, not
 * before today); progress never goes backwards; 包装完成 needs 100 % and packing evidence; moving a
 * committed date needs a reason and is flagged to the buyer as 交期变更. Readiness for an
 * inspection commits the packing date; a reschedule is a request the platform confirms. Corrective
 * action for major and critical findings needs an action, quantity and description, plus evidence
 * when units were reworked or replaced. Results are never edited here. Badge text is fixed.
 */
import {
  INSPECTION_JOBS,
  LOTS,
  QUALITY_TRACKS,
  type DefectFinding,
  type InspectionJob,
  type Milestone,
  type QualityTrack,
} from "./demo-data/quality";
import { validateUploads, type UploadCandidate } from "./documents-demo";
import { samplingPlanFor } from "./quality-demo";
import { formatZhDate, formatZhQty } from "./supplier-demo";

export type MilestoneKey = Milestone["key"];
export type DateKind = Milestone["dateKind"];

export const MILESTONE_ORDER: MilestoneKey[] = [
  "materials_ready",
  "production_start",
  "percent_complete",
  "packed",
];

export const MILESTONE_ZH: Record<MilestoneKey, string> = {
  materials_ready: "材料到位",
  production_start: "开始生产",
  percent_complete: "生产进度",
  packed: "包装完成",
};

export const DATE_KIND_ZH: Record<DateKind, string> = {
  reported: "已发生",
  estimated: "预计",
  committed: "承诺",
};

export const INSPECTION_TYPE_ZH: Record<InspectionJob["type"], string> = {
  sample_evaluation: "样品评估",
  pre_production: "产前检验",
  during_production: "生产中检验",
  pre_shipment: "出货前检验",
  container_loading: "装柜监装",
};

export const DEFECT_CLASS_ZH: Record<DefectFinding["class"], string> = {
  critical: "严重",
  major: "主要",
  minor: "次要",
};

export function supplierTracks(
  supplierId: string,
  tracks: readonly QualityTrack[] = QUALITY_TRACKS,
): QualityTrack[] {
  return tracks.filter((t) => t.supplier.id === supplierId);
}

export function percentOf(milestones: readonly Milestone[]): number {
  const p = milestones.find((m) => m.key === "percent_complete");
  const n = p?.value ? Number.parseInt(p.value, 10) : 0;
  return Number.isFinite(n) ? n : 0;
}

/* ---------- Milestone updates ---------- */

export interface MilestoneInput {
  key: MilestoneKey;
  kind: DateKind;
  date: string;
  percent: string;
  reason: string;
  evidence: string[];
}

export function validateMilestone(
  input: MilestoneInput,
  current: readonly Milestone[],
  today: string,
): string[] {
  const errors: string[] = [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) errors.push("请填写日期。");
  else if (input.kind === "reported" && input.date > today)
    errors.push("“已发生”的日期不能晚于今天。");
  else if (input.kind !== "reported" && input.date < today)
    errors.push("预计或承诺日期不能早于今天。");

  const idx = MILESTONE_ORDER.indexOf(input.key);
  if (input.kind === "reported") {
    const earlier = MILESTONE_ORDER.slice(0, idx).filter(
      (k) => k !== "percent_complete" || input.key === "packed",
    );
    for (const k of earlier) {
      const m = current.find((x) => x.key === k);
      if (!m || m.dateKind !== "reported") errors.push(`请先报告“${MILESTONE_ZH[k]}”已发生。`);
    }
  }

  const pct = Number(input.percent);
  if (input.key === "percent_complete") {
    if (input.percent.trim() === "" || !Number.isInteger(pct) || pct < 0 || pct > 100)
      errors.push("进度须为 0–100 的整数。");
    else if (pct < percentOf(current))
      errors.push(`进度不能低于上次报告的 ${percentOf(current)}%。`);
    if (input.kind !== "reported") errors.push("生产进度只能按已发生报告。");
  }
  if (input.key === "packed" && input.kind === "reported") {
    if (percentOf(current) < 100) errors.push("包装完成前，请先报告生产进度 100%。");
    if (input.evidence.length === 0) errors.push("报告包装完成需附装箱单或包装照片。");
  }

  const existing = current.find((m) => m.key === input.key);
  if (
    existing?.dateKind === "committed" &&
    existing.date !== input.date &&
    input.reason.trim().length < 3
  )
    errors.push("更改承诺日期需填写原因（至少 3 个字），买家将看到“交期变更”。");
  return errors;
}

export function milestoneFlags(input: MilestoneInput, current: readonly Milestone[]): string[] {
  const existing = current.find((m) => m.key === input.key);
  const flags: string[] = [];
  if (existing?.dateKind === "committed" && existing.date !== input.date) flags.push("交期变更");
  if (
    existing &&
    existing.dateKind !== "reported" &&
    existing.date &&
    input.date > existing.date &&
    input.kind !== "reported"
  )
    flags.push("日期推迟");
  return flags;
}

export function applyMilestone(current: readonly Milestone[], input: MilestoneInput): Milestone[] {
  const value =
    input.key === "percent_complete" ? `${Number(input.percent)} %（供应商报告）` : undefined;
  const next: Milestone = {
    key: input.key,
    label: current.find((m) => m.key === input.key)?.label ?? input.key,
    date: input.date,
    dateKind: input.kind,
    ...(value ? { value } : {}),
  };
  const list = current.some((m) => m.key === input.key)
    ? current.map((m) => (m.key === input.key ? next : m))
    : [...current, next];
  return MILESTONE_ORDER.map((k) => list.find((m) => m.key === k)).filter(
    (m): m is Milestone => m !== undefined,
  );
}

export function milestoneSummaryZh(input: MilestoneInput): string {
  const head =
    input.key === "percent_complete"
      ? `生产进度 ${Number(input.percent)}%`
      : MILESTONE_ZH[input.key];
  return `${head}（${DATE_KIND_ZH[input.kind]}，${formatZhDate(input.date)}）${input.reason.trim() ? `；原因：${input.reason.trim()}` : ""}`;
}

/** The shared upload pre-check, reasons in Chinese. */
export function checkEvidence(files: readonly UploadCandidate[]): {
  accepted: string[];
  rejected: Array<{ name: string; reason: string }>;
} {
  const v = validateUploads(files);
  const zh: Record<string, string> = {
    "empty file": "空文件",
    "file type not accepted (PDF, XLSX, CSV, PNG, JPG or WebP only)":
      "不支持此文件类型（仅限 PDF、XLSX、CSV、PNG、JPG、WebP）",
    "larger than 25 MB": "超过 25 MB",
    "file extension does not match its type": "扩展名与文件类型不符",
  };
  return {
    accepted: v.accepted.map((f) => f.name),
    rejected: v.rejected.map((r) => ({ name: r.name, reason: zh[r.reason] ?? r.reason })),
  };
}

/* ---------- Inspection readiness ---------- */

export interface ReadinessItem {
  label: string;
  met: boolean;
  detail: string;
}

/** Pilot readiness conditions for a pre-shipment inspection (design assumption, see the screen doc). */
export function readiness(job: InspectionJob, milestones: readonly Milestone[]): ReadinessItem[] {
  const pct = percentOf(milestones);
  const packed = milestones.find((m) => m.key === "packed");
  const packedBy = packed?.date ?? null;
  return [
    {
      label: "生产完成 100%",
      met: pct >= 100,
      detail: pct >= 100 ? "已报告 100%" : `已报告 ${pct}%；检验前须完成`,
    },
    {
      label: "包装完成不晚于检验日",
      met: packedBy !== null && packedBy <= job.scheduledFor,
      detail: packedBy
        ? `包装完成 ${DATE_KIND_ZH[packed!.dateKind]} ${formatZhDate(packedBy)}，检验 ${formatZhDate(job.scheduledFor)}`
        : "尚未报告包装日期",
    },
  ];
}

export function canConfirmReadiness(
  job: InspectionJob,
  milestones: readonly Milestone[],
  siteReady: boolean,
): string[] {
  const errors: string[] = [];
  if (job.status !== "scheduled") errors.push("此检验不在待安排状态。");
  const packed = readiness(job, milestones)[1]!;
  if (!packed.met) errors.push("包装完成日期晚于检验日，请先更新日期或申请改期。");
  if (!siteReady) errors.push("请确认检验当日现场可提供 QSR v3 与生产留样。");
  return errors;
}

/** Confirming readiness turns an estimated packing date into a committed one. */
export function commitPackedDate(milestones: readonly Milestone[]): Milestone[] {
  return milestones.map((m) =>
    m.key === "packed" && m.dateKind === "estimated" ? { ...m, dateKind: "committed" } : m,
  );
}

export function validateReschedule(
  job: InspectionJob,
  date: string,
  reason: string,
  today: string,
): string[] {
  const errors: string[] = [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) errors.push("请选择建议日期。");
  else if (date <= today) errors.push("建议日期须晚于今天。");
  else if (date === job.scheduledFor) errors.push("建议日期与现定日期相同。");
  if (reason.trim().length < 3) errors.push("请填写改期原因（至少 3 个字）。");
  return errors;
}

/* ---------- Corrective action ---------- */

export type CorrectiveAction = "reworked" | "quarantined" | "replaced" | "process_change";
export const CORRECTIVE_ZH: Record<CorrectiveAction, string> = {
  reworked: "已返工",
  quarantined: "已隔离（不出货）",
  replaced: "已更换",
  process_change: "调整工艺（后续批次）",
};

export interface CorrectiveInput {
  action: CorrectiveAction | null;
  quantity: string;
  description: string;
  evidence: string[];
}

export function validateCorrective(finding: DefectFinding, input: CorrectiveInput): string[] {
  const errors: string[] = [];
  const required = finding.class !== "minor";
  if (!input.action) errors.push("请选择整改方式。");
  const q = Number(input.quantity);
  if (!Number.isInteger(q) || q < 0) errors.push("数量须为 0 或正整数。");
  if (input.description.trim().length < 10)
    errors.push(
      required ? "请说明原因与整改措施（至少 10 个字）。" : "请简要说明（至少 10 个字）。",
    );
  if ((input.action === "reworked" || input.action === "replaced") && input.evidence.length === 0)
    errors.push("返工或更换需附照片或记录。");
  return errors;
}

/* ---------- Badges (zh, fixed wording) ---------- */

export function inspectionBadgeZh(job: InspectionJob, lotCode: string): string {
  const r = job.result;
  const type = INSPECTION_TYPE_ZH[job.type];
  if (!r)
    return `${type}已安排（${formatZhDate(job.scheduledFor)}，检验清单 v${job.checklistVersion}）`;
  const plan = `抽检 ${r.sampleSize} / ${formatZhQty(r.lotSize)} 件，依据 ISO 2859-1 一般检验水平 II，AQL 0/2.5/4.0，检验清单 v${job.checklistVersion}`;
  if (r.result === "fail")
    return `批次 ${lotCode} ${type}未通过（${formatZhDate(r.at)}）：严重 ${r.foundCritical}、主要 ${r.foundMajor}、次要 ${r.foundMinor} 项；${plan}`;
  if (r.result === "pass_with_rework")
    return `批次 ${lotCode} ${type}通过，发现项返工后放行（${formatZhDate(r.at)}）：${plan}`;
  return `批次 ${lotCode} ${type}通过（${formatZhDate(r.at)}）：${plan}`;
}

const FORBIDDEN_ZH = ["零缺陷", "保证质量", "质量保证", "认证工厂", "免检", "百分百合格"];
export function badgeAllowedZh(text: string): boolean {
  return !FORBIDDEN_ZH.some((f) => text.includes(f));
}

export function planTextZh(lotSize: number): string {
  const plan = samplingPlanFor(lotSize, {
    standard: "ISO 2859-1",
    level: "II",
    aqlCritical: 0,
    aqlMajor: 2.5,
    aqlMinor: 4.0,
  });
  if (!plan) return "抽样方案待定";
  const line = (c: "critical" | "major" | "minor") => plan.lines.find((l) => l.class === c)!;
  return `样本量字码 ${plan.codeLetter}，抽检 ${plan.sampleSize} 件；严重 AQL 0 接收 ${line("critical").accept} / 拒收 ${line("critical").reject}，主要 AQL 2.5 接收 ${line("major").accept} / 拒收 ${line("major").reject}，次要 AQL 4.0 接收 ${line("minor").accept} / 拒收 ${line("minor").reject}（示意，以现行标准为准）`;
}

/* ---------- What the supplier has to do ---------- */

export interface PendingAction {
  key: "readiness" | "corrective" | "progress";
  text: string;
}

export function pendingActions(
  track: QualityTrack,
  milestones: readonly Milestone[],
  state: {
    readinessConfirmed: boolean;
    rescheduleRequested: boolean;
    correctiveSubmitted: ReadonlySet<string>;
    lastProgressAt: string | null;
  },
  today: string,
  jobs: readonly InspectionJob[] = INSPECTION_JOBS,
): PendingAction[] {
  const out: PendingAction[] = [];
  const own = jobs.filter((j) => j.trackId === track.id);
  const scheduled = own.find((j) => j.status === "scheduled");
  if (scheduled && !state.readinessConfirmed && !state.rescheduleRequested)
    out.push({
      key: "readiness",
      text: `确认${INSPECTION_TYPE_ZH[scheduled.type]}安排（${formatZhDate(scheduled.scheduledFor)}，批次 ${LOTS.find((l) => l.id === scheduled.lotId)?.lotCode ?? "—"}）`,
    });
  const open = own
    .flatMap((j) => j.result?.findings ?? [])
    .filter((f) => f.class !== "minor" && !state.correctiveSubmitted.has(f.id));
  if (open.length > 0)
    out.push({ key: "corrective", text: `提交整改说明（${open.length} 项主要或严重问题）` });
  const pct = percentOf(milestones);
  const days = state.lastProgressAt
    ? Math.round((Date.parse(today) - Date.parse(state.lastProgressAt.slice(0, 10))) / 86_400_000)
    : null;
  if (pct < 100 && (days === null || days >= 1))
    out.push({
      key: "progress",
      text: `更新生产进度（上次报告 ${pct}%${state.lastProgressAt ? `，${formatZhDate(state.lastProgressAt.slice(0, 10))}` : ""}）`,
    });
  return out;
}
