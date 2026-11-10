/**
 * Display-only rules for the buyer's Samples & Inspections page. The buyer sees exactly what was
 * checked, by whom, when and against which checklist version (master spec §6.7; QUALITY_ASSURANCE
 * §1, §3, §5, §7), in the fixed badge wording, with supplier contact data excluded. Decisions
 * after a failed inspection are the buyer's (QA §4 exceptions); the platform relays them and
 * records the recommendation. Nothing here is a guarantee: sampling limits are stated with the
 * numbers of the plan. Reuses the operations quality data and `trackView`.
 */
import {
  BUYER_DECISION_LABEL,
  INSPECTION_TYPE_LABEL,
  LOTS,
  QUALITY_TRACKS,
  type BuyerDecision,
  type InspectionJob,
  type QualityTrack,
} from "./demo-data/quality";
import {
  inspectionBadge,
  sampleBadge,
  samplingPlanFor,
  specBadge,
  trackView,
  type TrackView,
} from "./quality-demo";
import type { EvidenceRecord } from "./ui/primitives";

export function buyerTracks(
  projectId: string,
  today: string,
  tracks: readonly QualityTrack[] = QUALITY_TRACKS,
): TrackView[] {
  return tracks.filter((t) => t.project.id === projectId).map((t) => trackView(t, today));
}

export interface BuyerEvidence {
  label: string;
  tone: "ok" | "warn" | "danger" | "neutral" | "teal";
  evidence: EvidenceRecord;
}

/** Every badge the buyer may see for a track, each resolving to what / who / when / scope. */
export function evidenceFor(view: TrackView): BuyerEvidence[] {
  const out: BuyerEvidence[] = [];
  const { qsr, track } = view;
  out.push({
    label: specBadge(qsr),
    tone: qsr.approvedByBuyerAt ? "ok" : "warn",
    evidence: {
      what: `Quality specification record v${qsr.version}: ${qsr.criticalDimensions.length} critical dimensions, ${qsr.tests.length} tests, defect classes defined`,
      who: qsr.approvedByBuyerAt ? "You (buyer approval)" : "Awaiting your approval",
      when: qsr.approvedByBuyerAt ?? "—",
      scope: `${track.variant}`,
    },
  });
  for (const s of view.samples) {
    const label = sampleBadge(s, track.variant);
    if (!label) continue;
    out.push({
      label,
      tone: "ok",
      evidence: {
        what: `${s.kind === "golden" ? "Golden sample agreed and sealed" : "Sample evaluated against the QSR"}: ${s.note}`,
        who: s.evaluatedBy ?? "—",
        when: s.receivedAt ?? "—",
        scope: track.variant,
        note:
          s.evidenceDocuments.length > 0
            ? `Evidence: ${s.evidenceDocuments.join(", ")}`
            : undefined,
      },
    });
  }
  for (const j of view.jobs) {
    const lot = LOTS.find((l) => l.id === j.lotId);
    const label = inspectionBadge(j, lot?.lotCode ?? "—");
    const r = j.result;
    out.push({
      label,
      tone: !r
        ? "teal"
        : r.result === "fail"
          ? "danger"
          : r.result === "pass_with_rework"
            ? "warn"
            : "ok",
      evidence: {
        what: r
          ? `${INSPECTION_TYPE_LABEL[j.type]} inspection of lot ${lot?.lotCode ?? "—"}: ${r.foundCritical} critical, ${r.foundMajor} major, ${r.foundMinor} minor findings in ${r.sampleSize} units`
          : `${INSPECTION_TYPE_LABEL[j.type]} inspection scheduled for lot ${lot?.lotCode ?? "—"}`,
        who: r ? `${r.inspectorName} (${j.inspectorOrg})` : j.inspectorOrg,
        when: r ? r.at : j.scheduledFor,
        scope: `Lot ${lot?.lotCode ?? "—"}, ${lot ? lot.quantity.toLocaleString("en-US") : "—"} pcs · checklist v${j.checklistVersion}`,
        note: r?.reportDocumentId
          ? `Report: ${r.reportDocumentId} (in Documents)`
          : "No report yet",
      },
    });
  }
  return out;
}

/** QA §5 in plain terms, with the plan's numbers. Never "defect-free". */
export function samplingLimits(job: InspectionJob, lotSize: number, aqlMajor: number): string[] {
  const r = job.result;
  const plan = samplingPlanFor(lotSize, {
    standard: "ISO 2859-1",
    level: "II",
    aqlCritical: 0,
    aqlMajor,
    aqlMinor: 4.0,
  });
  const lines: string[] = [];
  if (r && plan) {
    const major = plan.lines.find((l) => l.class === "major");
    lines.push(
      `${r.sampleSize} of ${lotSize.toLocaleString("en-US")} units were inspected (ISO 2859-1 Level II, code letter ${plan.codeLetter}). At AQL ${aqlMajor} the lot is accepted with up to ${major?.accept} major findings and rejected at ${major?.reject}; ${r.foundMajor} were found.`,
    );
  }
  lines.push(
    `Acceptance means the sample was within the accept number. It does not mean the lot has at most ${aqlMajor} % defects: a lot with a true ${aqlMajor} % major-defect rate is accepted about 95 % of the time, and a materially worse lot still has some chance of acceptance.`,
  );
  lines.push(
    "The inspection covers the checklist items, on the sampled units, at the moment of inspection. Latent defects and units replaced after inspection are outside it unless a specific test is in the QSR.",
  );
  return lines;
}

export function decisionNeeded(view: TrackView, decided: boolean): boolean {
  return view.releaseRecommendation === "not_recommended" && !decided;
}

export function decisionConsequence(d: BuyerDecision): string {
  const map: Record<BuyerDecision, string> = {
    accept:
      "The lot ships as it is. The findings stay on the record; the badge keeps saying the inspection failed.",
    rework:
      "The supplier reworks the found units; the lot is re-inspected before release and the shipping dates become estimated again.",
    reject:
      "The lot does not ship. The remediation case determines responsibility and the remedy under your contract.",
    partial:
      "Only units that pass a full re-screen ship; the rest follow rework or rejection. Re-inspection confirms the screened part.",
  };
  return map[d];
}

export interface DecisionInput {
  decision: BuyerDecision | null;
  note: string;
  acknowledged: boolean;
}

export function validateDecision(input: DecisionInput): string[] {
  const errors: string[] = [];
  if (!input.decision) errors.push("Choose a decision.");
  if (!input.acknowledged)
    errors.push("Confirm that you have read what the inspection did and did not cover.");
  if (input.decision === "partial" && input.note.trim().length < 10)
    errors.push(
      "Say which units or criteria the partial acceptance covers (at least 10 characters).",
    );
  return errors;
}

export function decisionLabel(d: BuyerDecision): string {
  return BUYER_DECISION_LABEL[d];
}

export interface BuyerQaSummary {
  decisions: number;
  scheduled: number;
  awaitingYou: number;
}

/** Counts for the header: decisions pending, inspections scheduled, specs or samples awaiting the buyer. */
export function buyerQaSummary(
  views: readonly TrackView[],
  decided: ReadonlySet<string>,
): BuyerQaSummary {
  return {
    decisions: views.filter((v) => decisionNeeded(v, decided.has(v.track.id))).length,
    scheduled: views.reduce((n, v) => n + v.jobs.filter((j) => j.status === "scheduled").length, 0),
    awaitingYou: views.filter(
      (v) =>
        v.qsr.approvedByBuyerAt === null ||
        v.steps.some((s) => s.key === "golden" && s.state === "current"),
    ).length,
  };
}

/** Buyer-facing sentence per step, from the operations view. */
export function buyerStepText(view: TrackView, key: TrackView["steps"][number]["key"]): string {
  const step = view.steps.find((s) => s.key === key)!;
  switch (key) {
    case "spec":
      return view.qsr.approvedByBuyerAt
        ? `You approved the quality specification record v${view.qsr.version} on ${view.qsr.approvedByBuyerAt}.`
        : `Quality specification record v${view.qsr.version} is waiting for your approval.`;
    case "sample":
      return step.state === "done"
        ? "A pre-production sample was evaluated against your specification and passed."
        : step.state === "current"
          ? "A sample has been requested and is on its way."
          : step.state === "blocked"
            ? "A sample is requested only after you approve the specification."
            : "No sample yet.";
    case "golden":
      return view.golden
        ? `You signed the golden sample agreement on ${view.golden.buyerSignoffAt}; the supplier acknowledged it on ${view.golden.supplierAckAt ?? "—"}. The sealed sample is retained: ${view.golden.retainedWhere}.`
        : step.state === "current"
          ? "The golden sample agreement is waiting for your sign-off."
          : "After a passed sample.";
    case "production":
      return step.state === "current"
        ? "Production is under way; dates marked estimated are the supplier's estimates, not commitments."
        : step.state === "done"
          ? "Production is complete and packed."
          : "Not started.";
    case "inspection":
      return step.summary;
    case "exceptions":
      return step.summary;
    case "remediation":
      return step.summary;
    case "closure":
      return step.summary;
  }
}
