/**
 * Display-only rules for the operations Quality Verification preview. They mirror
 * docs/QUALITY_ASSURANCE.md: separate, independent states (§1); product-level states and their
 * exact badge wording (§3, §5); the eight-step workflow (§4); the single-sampling acceptance rule
 * (§5, illustrative ISO 2859-1 Level II values — verify against the current standard before use);
 * the buyer's decision after a failed inspection (§4 exceptions); and remediation responsibility and
 * resolution vocabulary (§8). Nothing here is a guarantee, and a lot badge never carries to a supplier.
 */
import {
  BUYER_DECISION_LABEL,
  GOLDEN_AGREEMENTS,
  INSPECTION_JOBS,
  INSPECTION_TYPE_LABEL,
  LOTS,
  QSRS,
  REMEDIATION_CASES,
  SAMPLES,
  type BuyerDecision,
  type DefectClass,
  type InspectionJob,
  type InspectionResultCode,
  type QualitySpecRecord,
  type QualityTrack,
  type RemediationCase,
  type SampleRecord,
  type SamplingPlan,
} from "./demo-data/quality";

/* ---------- Sampling (§5) ---------- */

export interface PlanLine {
  class: DefectClass;
  aql: number;
  accept: number;
  reject: number;
}

export interface ResolvedPlan {
  codeLetter: string;
  sampleSize: number;
  lines: PlanLine[];
  illustrative: true;
}

/** Illustrative single-sampling normal values for General Inspection Level II; verify against the current standard. */
const CODE_LETTERS: Array<{ maxLot: number; letter: string; sampleSize: number }> = [
  { maxLot: 150, letter: "F", sampleSize: 20 },
  { maxLot: 280, letter: "G", sampleSize: 32 },
  { maxLot: 500, letter: "H", sampleSize: 50 },
  { maxLot: 1_200, letter: "J", sampleSize: 80 },
  { maxLot: 3_200, letter: "K", sampleSize: 125 },
  { maxLot: 10_000, letter: "L", sampleSize: 200 },
  { maxLot: 35_000, letter: "M", sampleSize: 315 },
];

const ACCEPT_NUMBERS: Record<string, Record<string, number>> = {
  "2.5": { F: 1, G: 2, H: 3, J: 5, K: 7, L: 10, M: 14 },
  "4": { F: 2, G: 3, H: 5, J: 7, K: 10, L: 14, M: 21 },
  "0": { F: 0, G: 0, H: 0, J: 0, K: 0, L: 0, M: 0 },
};

export function samplingPlanFor(lotSize: number, plan: SamplingPlan): ResolvedPlan | null {
  const row = CODE_LETTERS.find((c) => lotSize <= c.maxLot);
  if (!row || lotSize <= 0) return null;
  const line = (cls: DefectClass, aql: number): PlanLine | null => {
    const table = ACCEPT_NUMBERS[String(aql)];
    const accept = table?.[row.letter];
    return accept === undefined ? null : { class: cls, aql, accept, reject: accept + 1 };
  };
  const lines = [
    line("critical", plan.aqlCritical),
    line("major", plan.aqlMajor),
    line("minor", plan.aqlMinor),
  ];
  if (lines.some((l) => l === null)) return null;
  return {
    codeLetter: row.letter,
    sampleSize: row.sampleSize,
    lines: lines as PlanLine[],
    illustrative: true,
  };
}

export function planText(plan: SamplingPlan): string {
  return `${plan.standard} Level ${plan.level}, AQL ${plan.aqlCritical}/${plan.aqlMajor}/${plan.aqlMinor}`;
}

/** The acceptance rule: every class within its accept number. Majors found but accepted ⇒ pass with rework when the inspector says so. */
export function deriveResult(
  found: { critical: number; major: number; minor: number },
  resolved: ResolvedPlan,
  reworkFoundUnits: boolean,
): InspectionResultCode {
  const over = resolved.lines.some((l) => found[l.class] > l.accept);
  if (over) return "fail";
  return found.major > 0 && reworkFoundUnits ? "pass_with_rework" : "pass";
}

export interface ResultInput {
  critical: string;
  major: string;
  minor: string;
  inspectorName: string;
  reportRef: string;
  reworkFoundUnits: boolean;
}

export type ResultErrors = Partial<Record<keyof ResultInput, string>>;

export function validateResult(input: ResultInput, resolved: ResolvedPlan | null): ResultErrors {
  const e: ResultErrors = {};
  for (const k of ["critical", "major", "minor"] as const) {
    const n = Number(input[k]);
    if (input[k].trim() === "" || !Number.isInteger(n) || n < 0)
      e[k] = "Enter a whole number of zero or more.";
    else if (resolved && n > resolved.sampleSize)
      e[k] = `Cannot exceed the ${resolved.sampleSize} units sampled.`;
  }
  if (!input.inspectorName.trim()) e.inspectorName = "Name the inspector.";
  if (!input.reportRef.trim())
    e.reportRef = "Attach the report document; a result without a report cannot be recorded.";
  return e;
}

/* ---------- Badges (§3, §5): exact wording, never a guarantee ---------- */

export function inspectionBadge(job: InspectionJob, lotCode: string): string {
  const r = job.result;
  if (!r)
    return `${INSPECTION_TYPE_LABEL[job.type]} inspection pending (${job.scheduledFor}, checklist v${job.checklistVersion})`;
  const plan = `${r.sampleSize} of ${r.lotSize.toLocaleString("en-US")} units sampled per ISO 2859-1 Level II, AQL 0/2.5/4.0, checklist v${job.checklistVersion}`;
  const type = INSPECTION_TYPE_LABEL[job.type].toLowerCase();
  if (r.result === "pass") return `Lot ${lotCode} passed ${type} inspection on ${r.at}: ${plan}`;
  if (r.result === "pass_with_rework")
    return `Lot ${lotCode} passed ${type} inspection on ${r.at} with rework of found units: ${plan}`;
  if (r.result === "fail")
    return `Lot ${lotCode} failed ${type} inspection on ${r.at}: ${r.foundMajor} major and ${r.foundMinor} minor findings in ${r.sampleSize} sampled; ${plan}`;
  return `${INSPECTION_TYPE_LABEL[job.type]} inspection pending`;
}

export function sampleBadge(sample: SampleRecord, variant: string): string | null {
  if (sample.result !== "pass" || !sample.receivedAt) return null;
  if (sample.kind === "golden") return "Golden sample on file";
  return `Sample approved for variant ${variant} on ${sample.receivedAt}`;
}

export function specBadge(qsr: QualitySpecRecord): string {
  return qsr.approvedByBuyerAt
    ? `Spec v${qsr.version} agreed ${qsr.approvedByBuyerAt}`
    : `Spec v${qsr.version} awaiting buyer approval`;
}

const FORBIDDEN = [
  "guaranteed",
  "zero defects",
  "defect-free",
  "verified factory",
  "certified supplier",
];
/** Copy guard for anything the screen renders as a badge (QA doc §2 and §5). */
export function badgeIsAllowed(text: string): boolean {
  const t = text.toLowerCase();
  return !FORBIDDEN.some((f) => t.includes(f));
}

/* ---------- Workflow steps (§4) ---------- */

export type StepKey =
  | "spec"
  | "sample"
  | "golden"
  | "production"
  | "inspection"
  | "exceptions"
  | "remediation"
  | "closure";
export type StepState = "done" | "current" | "pending" | "blocked" | "not_needed";

export interface TrackStep {
  key: StepKey;
  label: string;
  state: StepState;
  summary: string;
}

export interface TrackView {
  track: QualityTrack;
  qsr: QualitySpecRecord;
  samples: SampleRecord[];
  golden: ReturnType<typeof GOLDEN_AGREEMENTS.find>;
  jobs: InspectionJob[];
  cases: RemediationCase[];
  steps: TrackStep[];
  nextAction: string;
  releaseRecommendation: "recommended" | "not_recommended" | "not_yet";
}

export function trackView(track: QualityTrack, today: string): TrackView {
  const qsr = QSRS.find((q) => q.id === track.qsrId)!;
  const samples = SAMPLES.filter((s) => s.trackId === track.id);
  const goldenSample = samples.find((s) => s.kind === "golden" && s.result === "pass");
  const golden = goldenSample
    ? GOLDEN_AGREEMENTS.find((g) => g.sampleId === goldenSample.id)
    : undefined;
  const jobs = INSPECTION_JOBS.filter((j) => j.trackId === track.id);
  const cases = REMEDIATION_CASES.filter((c) => c.trackId === track.id);

  const specDone = qsr.approvedByBuyerAt !== null;
  const samplePassed = samples.some((s) => s.kind !== "golden" && s.result === "pass");
  const samplePending = samples.some((s) => s.result === "pending");
  const goldenDone = !!golden && golden.supplierAckAt !== null;
  const productionStarted = track.milestones.some(
    (m) => m.key === "production_start" && m.date !== null && m.date <= today,
  );
  const packed = track.milestones.some(
    (m) => m.key === "packed" && m.dateKind !== "estimated" && m.date !== null && m.date <= today,
  );
  const psi = jobs.find((j) => j.type === "pre_shipment");
  const failed = jobs.some((j) => j.result?.result === "fail");
  const passed = psi?.result && psi.result.result !== "fail";
  const openCase = cases.find((c) => c.status !== "closed");
  const closed = cases.length > 0 && cases.every((c) => c.status === "closed");

  const steps: TrackStep[] = [
    {
      key: "spec",
      label: "Spec",
      state: specDone ? "done" : "current",
      summary: specBadge(qsr),
    },
    {
      key: "sample",
      label: "Sample",
      state: !specDone ? "blocked" : samplePassed ? "done" : samplePending ? "current" : "pending",
      summary: samplePassed
        ? `${samples.filter((s) => s.kind !== "golden").length} sample${samples.length === 1 ? "" : "s"}; latest passed`
        : samplePending
          ? "Requested, not received"
          : !specDone
            ? "Needs the buyer's QSR approval first"
            : "No sample requested",
    },
    {
      key: "golden",
      label: "Golden sample",
      state: goldenDone ? "done" : samplePassed ? "current" : "pending",
      summary: goldenDone
        ? `Signed ${golden.buyerSignoffAt}, supplier acknowledged ${golden.supplierAckAt}`
        : samplePassed
          ? "Agreement not signed"
          : "After a passed sample",
    },
    {
      key: "production",
      label: "Production",
      state: packed ? "done" : productionStarted ? "current" : goldenDone ? "pending" : "blocked",
      summary: productionStarted
        ? track.milestones
            .map((m) =>
              `${m.label} ${m.value ?? ""} ${m.date ?? "—"} (${m.dateKind})`
                .replace(/\s+/g, " ")
                .trim(),
            )
            .join(" · ")
        : goldenDone
          ? "Not started"
          : "Needs a golden sample agreement first",
    },
    {
      key: "inspection",
      label: "Inspection",
      state: psi?.result ? "done" : psi ? "current" : productionStarted ? "pending" : "blocked",
      summary: psi
        ? inspectionBadge(psi, LOTS.find((l) => l.id === psi.lotId)?.lotCode ?? "—")
        : "No pre-shipment inspection scheduled",
    },
    {
      key: "exceptions",
      label: "Exceptions",
      state: failed
        ? openCase?.buyerDecision
          ? "done"
          : "current"
        : passed
          ? "not_needed"
          : "pending",
      summary: failed
        ? openCase?.buyerDecision
          ? `Buyer decided: ${BUYER_DECISION_LABEL[openCase.buyerDecision]}`
          : "Failed inspection; the buyer's decision is pending"
        : passed
          ? "No findings above the acceptance numbers"
          : "After the inspection",
    },
    {
      key: "remediation",
      label: "Remediation",
      state: openCase
        ? openCase.status === "in_remedy"
          ? "current"
          : openCase.buyerDecision
            ? "current"
            : "pending"
        : failed
          ? "pending"
          : "not_needed",
      summary: openCase
        ? `Case ${openCase.id}: responsibility ${openCase.responsibility}, ${openCase.status.replace("_", " ")}`
        : "No open case",
    },
    {
      key: "closure",
      label: "Closure",
      state: closed || (passed && !failed && packed) ? "done" : "pending",
      summary: closed
        ? "Evidence retained; performance record updated with facts only"
        : "After the lot ships or the case closes",
    },
  ];

  const releaseRecommendation =
    failed && !openCase?.buyerDecision ? "not_recommended" : passed ? "recommended" : "not_yet";
  const current =
    steps.find((s) => s.state === "current") ?? steps.find((s) => s.state === "pending");
  const nextAction =
    current?.key === "spec"
      ? "Send the QSR to the buyer for approval; no sample until then."
      : current?.key === "sample"
        ? "Chase the sample; evaluate it against the QSR on receipt and record the result with photos."
        : current?.key === "golden"
          ? "Draft the golden sample agreement for buyer sign-off and supplier acknowledgment."
          : current?.key === "production"
            ? "Record milestones as reported; estimated dates stay estimated until the supplier commits."
            : current?.key === "inspection"
              ? "Confirm the inspector, lot size and checklist version; record the result from the report."
              : current?.key === "exceptions"
                ? "Relay the findings to the buyer and record the buyer's decision with its message reference."
                : current?.key === "remediation"
                  ? "Record responsibility once determined and the remedy agreed; schedule re-inspection if rework."
                  : "Retain evidence and close.";

  return { track, qsr, samples, golden, jobs, cases, steps, nextAction, releaseRecommendation };
}

export interface QualitySummary {
  scheduled: number;
  awaitingBuyer: number;
  openCases: number;
  samplesPending: number;
}

export function qualitySummary(views: readonly TrackView[]): QualitySummary {
  return {
    scheduled: views.reduce((n, v) => n + v.jobs.filter((j) => j.status === "scheduled").length, 0),
    awaitingBuyer: views.filter((v) => v.releaseRecommendation === "not_recommended").length,
    openCases: views.reduce((n, v) => n + v.cases.filter((c) => c.status !== "closed").length, 0),
    samplesPending: views.reduce(
      (n, v) => n + v.samples.filter((s) => s.result === "pending").length,
      0,
    ),
  };
}

/** Buyer decisions pending first, then scheduled inspections, then the rest by project name. */
export function sortTracks(views: readonly TrackView[]): TrackView[] {
  const rank = (v: TrackView) =>
    v.releaseRecommendation === "not_recommended"
      ? 0
      : v.jobs.some((j) => j.status === "scheduled")
        ? 1
        : 2;
  return [...views].sort(
    (a, b) => rank(a) - rank(b) || a.track.project.name.localeCompare(b.track.project.name),
  );
}

/** The buyer's decision is recorded only against a reference to the buyer's own message (approval gate). */
export function validateBuyerDecision(decision: BuyerDecision | null, ref: string): string | null {
  if (!decision) return "Choose the buyer's decision.";
  if (ref.trim().length < 6)
    return "Reference the buyer's message or approval (for example a thread id); the decision is the buyer's, never the operator's.";
  return null;
}

export function buyerDecisionLabel(d: BuyerDecision): string {
  return BUYER_DECISION_LABEL[d];
}
