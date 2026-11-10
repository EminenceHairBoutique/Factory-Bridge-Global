/**
 * Display-only rules for the operations pipeline board. A project's stage is derived from records
 * and never dragged (CLAUDE.md §4: deterministic state transitions). Each stage lists what the
 * next stage needs, who owes each item (operator, buyer, supplier, compliance), and who records
 * the move: the operator records operator-owned moves once every requirement is met; buyer-owned
 * moves happen only on the buyer's own action (brief confirmation, sample request, written
 * approval). Attention reasons are computed, never chosen. Nothing here writes anywhere.
 */
import {
  PIPELINE_STAGES,
  QUEUE_TASKS,
  type PipelineProject,
  type PipelineStage,
  type QueueTask,
} from "./demo-data/ops-queue";
import { OPERATORS, PROJECT_FACTS, type ProjectFacts } from "./demo-data/pipeline-board";
import { slaFor, stageSla, type StageSla } from "./queue-demo";

export type Owner = "operator" | "buyer" | "supplier" | "compliance";

export const OWNER_LABEL: Record<Owner, string> = {
  operator: "Operator",
  buyer: "Buyer",
  supplier: "Supplier",
  compliance: "Compliance",
};

export interface Requirement {
  label: string;
  owner: Owner;
  met: boolean;
}

export interface Gate {
  next: PipelineStage | "handed_off";
  nextLabel: string;
  recordedBy: "operator" | "buyer";
  requirements: Requirement[];
  waitingOn: Owner | null;
  canRecord: boolean;
  explanation: string;
}

export function openTasksFor(
  projectId: string,
  tasks: readonly QueueTask[] = QUEUE_TASKS,
): QueueTask[] {
  return tasks.filter((t) => t.project?.id === projectId && t.status !== "done");
}

export function stageLabel(stage: PipelineStage | "handed_off"): string {
  if (stage === "handed_off") return "Handed off";
  return PIPELINE_STAGES.find((s) => s.key === stage)?.label ?? stage;
}

function nextStage(stage: PipelineStage): PipelineStage | "handed_off" {
  const i = PIPELINE_STAGES.findIndex((s) => s.key === stage);
  return PIPELINE_STAGES[i + 1]?.key ?? "handed_off";
}

/** What moving to the next stage needs, from the project's records. */
export function gateFor(
  p: PipelineProject,
  facts: ProjectFacts | undefined = PROJECT_FACTS[p.id],
  tasks: readonly QueueTask[] = QUEUE_TASKS,
): Gate {
  const f: ProjectFacts = facts ?? {
    family: "Other",
    briefVersion: 1,
    briefComplete: false,
    briefMissing: null,
    buyerConfirmedBrief: false,
    complianceHoldId: null,
    shortlisted: 0,
    rfqsApprovedSent: 0,
    quotesReceived: 0,
    quotesConfirmed: 0,
    buyerShortlisted: false,
    sampleRequestApprovedSent: false,
    sampleEvaluated: false,
    goldenSigned: false,
    selectionApproved: false,
    projectHref: null,
    history: [],
  };
  const hold: Requirement = {
    label: "Category clear of compliance holds",
    owner: "compliance",
    met: f.complianceHoldId === null,
  };
  const openReviews = openTasksFor(p.id, tasks).filter(
    (t) => t.kind === "extraction_review",
  ).length;
  let recordedBy: Gate["recordedBy"] = "operator";
  let requirements: Requirement[];
  switch (p.stage) {
    case "brief_draft":
      recordedBy = "buyer";
      requirements = [
        {
          label: f.briefComplete
            ? "Hard attributes complete in the brief"
            : `Brief complete (missing: ${f.briefMissing ?? "hard attributes"})`,
          owner: "buyer",
          met: f.briefComplete,
        },
        hold,
        {
          label: `Buyer confirms brief v${f.briefVersion}`,
          owner: "buyer",
          met: f.buyerConfirmedBrief,
        },
      ];
      break;
    case "brief_confirmed":
      requirements = [
        { label: "Lead operator assigned", owner: "operator", met: p.operator !== null },
        hold,
        {
          label: "At least one supplier option shortlisted",
          owner: "operator",
          met: f.shortlisted >= 1,
        },
      ];
      break;
    case "options_in_progress":
      requirements = [
        hold,
        {
          label: "RFQ approved by buyer and operator, and sent",
          owner: "operator",
          met: f.rfqsApprovedSent >= 1,
        },
        {
          label: "At least one quotation document received",
          owner: "supplier",
          met: f.quotesReceived >= 1,
        },
      ];
      break;
    case "quotes_in_review":
      requirements = [
        {
          label:
            openReviews === 0
              ? "Every extraction reviewed"
              : `Every extraction reviewed (${openReviews} open)`,
          owner: "operator",
          met: openReviews === 0,
        },
        {
          label: "At least one confirmed quotation",
          owner: "operator",
          met: f.quotesConfirmed >= 1,
        },
      ];
      break;
    case "comparison_ready":
      recordedBy = "buyer";
      requirements = [
        { label: "Buyer shortlists a supplier", owner: "buyer", met: f.buyerShortlisted },
        {
          label: "Sample request approved by buyer and operator, and sent",
          owner: "buyer",
          met: f.sampleRequestApprovedSent,
        },
      ];
      break;
    case "sample_requested":
      requirements = [
        {
          label: "Sample received and evaluated against the QSR",
          owner: "operator",
          met: f.sampleEvaluated,
        },
        {
          label: "Golden sample agreement signed by the buyer",
          owner: "buyer",
          met: f.goldenSigned,
        },
      ];
      break;
    case "handoff_pending":
      recordedBy = "buyer";
      requirements = [
        {
          label: "Buyer's written approval of supplier selection and purchase handoff",
          owner: "buyer",
          met: f.selectionApproved,
        },
      ];
      break;
  }
  const firstUnmet = requirements.find((r) => !r.met) ?? null;
  const waitingOn = firstUnmet?.owner ?? null;
  const canRecord = recordedBy === "operator" && waitingOn === null;
  const next = nextStage(p.stage);
  const explanation = canRecord
    ? `Every requirement is met. Record the move to ${stageLabel(next)}; it is written to the audit trail.`
    : waitingOn === null
      ? `Moves to ${stageLabel(next)} when the buyer acts; the operator cannot record it.`
      : `Waiting on ${OWNER_LABEL[waitingOn].toLowerCase()}: ${firstUnmet!.label}.`;
  return {
    next,
    nextLabel: stageLabel(next),
    recordedBy,
    requirements,
    waitingOn,
    canRecord,
    explanation,
  };
}

export type Attention =
  "past_target" | "compliance_hold" | "no_lead" | "reminder_due" | "overdue_task";

export const ATTENTION_LABEL: Record<Attention, string> = {
  past_target: "Past target",
  compliance_hold: "Compliance hold",
  no_lead: "No lead operator",
  reminder_due: "Buyer reminder due",
  overdue_task: "Overdue work item",
};

const OPERATOR_STAGES: ReadonlySet<PipelineStage> = new Set([
  "brief_confirmed",
  "options_in_progress",
  "quotes_in_review",
  "sample_requested",
]);
export const BUYER_REMINDER_DAYS = 7;

export function attentionFor(
  p: PipelineProject,
  now: string,
  facts: ProjectFacts | undefined = PROJECT_FACTS[p.id],
  tasks: readonly QueueTask[] = QUEUE_TASKS,
): Attention[] {
  const out: Attention[] = [];
  const s = stageSla(p, now);
  if (facts?.complianceHoldId) out.push("compliance_hold");
  if (s.state === "overdue") out.push("past_target");
  if (s.state === "buyer_clock" && s.daysInStage >= BUYER_REMINDER_DAYS) out.push("reminder_due");
  if (p.operator === null && OPERATOR_STAGES.has(p.stage)) out.push("no_lead");
  if (openTasksFor(p.id, tasks).some((t) => slaFor(t.dueAt, now).state === "overdue"))
    out.push("overdue_task");
  return out;
}

export interface BoardSummary {
  attention: number;
  pastTarget: number;
  unassigned: number;
  holds: number;
}

export function boardSummary(projects: readonly PipelineProject[], now: string): BoardSummary {
  const s: BoardSummary = { attention: 0, pastTarget: 0, unassigned: 0, holds: 0 };
  for (const p of projects) {
    const a = attentionFor(p, now);
    if (a.length > 0) s.attention += 1;
    if (a.includes("past_target")) s.pastTarget += 1;
    if (a.includes("compliance_hold")) s.holds += 1;
    if (p.operator === null) s.unassigned += 1;
  }
  return s;
}

/** Most attention reasons first, then most days in stage. */
export function sortForList(projects: readonly PipelineProject[], now: string): PipelineProject[] {
  return [...projects].sort(
    (a, b) =>
      attentionFor(b, now).length - attentionFor(a, now).length ||
      stageSla(b, now).daysInStage - stageSla(a, now).daysInStage,
  );
}

export interface BoardFilter {
  operator: "all" | "unassigned" | (typeof OPERATORS)[number];
  buyerOrg: string;
  attentionOnly: boolean;
}

export function filterProjects(
  projects: readonly PipelineProject[],
  f: BoardFilter,
  now: string,
): PipelineProject[] {
  return projects.filter((p) => {
    if (f.operator === "unassigned" && p.operator !== null) return false;
    if (f.operator !== "all" && f.operator !== "unassigned" && p.operator !== f.operator)
      return false;
    if (f.buyerOrg !== "all" && p.buyerOrg !== f.buyerOrg) return false;
    if (f.attentionOnly && attentionFor(p, now).length === 0) return false;
    return true;
  });
}

export interface OperatorLoad {
  operator: string;
  projects: number;
  pastTarget: number;
  openTasks: number;
}

export function operatorLoad(
  projects: readonly PipelineProject[],
  now: string,
  tasks: readonly QueueTask[] = QUEUE_TASKS,
): OperatorLoad[] {
  return OPERATORS.map((op) => {
    const mine = projects.filter((p) => p.operator === op);
    return {
      operator: op,
      projects: mine.length,
      pastTarget: mine.filter((p) => attentionFor(p, now).includes("past_target")).length,
      openTasks: mine.reduce((n, p) => n + openTasksFor(p.id, tasks).length, 0),
    };
  });
}

export function validateAssignment(p: PipelineProject, operator: string, reason: string): string[] {
  const errors: string[] = [];
  if (!(OPERATORS as readonly string[]).includes(operator)) errors.push("Choose an operator.");
  else if (operator === p.operator) errors.push("This operator already leads the project.");
  if (p.operator !== null && reason.trim().length < 3)
    errors.push("Give a reason for reassigning (at least 3 characters).");
  return errors;
}

export function assignLead(p: PipelineProject, operator: string): PipelineProject {
  return { ...p, operator };
}

/** Only operator-owned moves with every requirement met; the new stage starts today. */
export function recordStageChange(p: PipelineProject, gate: Gate, today: string): PipelineProject {
  if (!gate.canRecord || gate.next === "handed_off") return p;
  return { ...p, stage: gate.next, enteredStageAt: today };
}

export type { StageSla };
