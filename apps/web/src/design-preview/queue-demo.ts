/**
 * Display-only SLA and ordering rules for the operations work queue prototype. SLA targets are a pilot proposal
 * (docs/design/atlas-obsidian/OPS_WORK_QUEUE_SCREEN.md), not a contractual promise; the real queue derives due
 * times server-side from task creation and the agreed targets.
 */
import type { PipelineProject, QueueTask } from "./demo-data/ops-queue";
import { PIPELINE_STAGES } from "./demo-data/ops-queue";

export type SlaState = "overdue" | "due_soon" | "on_track";

export interface SlaInfo {
  state: SlaState;
  hoursLeft: number;
  label: string;
}

const HOUR = 3_600_000;

export function slaFor(dueAt: string, now: string, soonHours = 24): SlaInfo {
  const diff = new Date(dueAt).getTime() - new Date(now).getTime();
  const hoursLeft = Math.round(diff / HOUR);
  if (hoursLeft < 0) {
    const h = -hoursLeft;
    return {
      state: "overdue",
      hoursLeft,
      label: h >= 48 ? `Overdue ${Math.round(h / 24)} d` : `Overdue ${h} h`,
    };
  }
  if (hoursLeft <= soonHours)
    return {
      state: "due_soon",
      hoursLeft,
      label: hoursLeft === 0 ? "Due now" : `Due in ${hoursLeft} h`,
    };
  return {
    state: "on_track",
    hoursLeft,
    label: hoursLeft >= 48 ? `Due in ${Math.round(hoursLeft / 24)} d` : `Due in ${hoursLeft} h`,
  };
}

/** Overdue first, then soonest due; done tasks last. */
export function sortByUrgency(tasks: readonly QueueTask[], now: string): QueueTask[] {
  return [...tasks].sort((a, b) => {
    if (a.status === "done" && b.status !== "done") return 1;
    if (b.status === "done" && a.status !== "done") return -1;
    return slaFor(a.dueAt, now).hoursLeft - slaFor(b.dueAt, now).hoursLeft;
  });
}

export function queueSummary(tasks: readonly QueueTask[], now: string) {
  const open = tasks.filter((t) => t.status !== "done");
  return {
    open: open.length,
    overdue: open.filter((t) => slaFor(t.dueAt, now).state === "overdue").length,
    dueSoon: open.filter((t) => slaFor(t.dueAt, now).state === "due_soon").length,
    mine: open.filter((t) => t.assignee === "me").length,
    unassigned: open.filter((t) => t.assignee === "unassigned").length,
  };
}

export interface StageSla {
  daysInStage: number;
  state: SlaState | "buyer_clock";
}

export function stageSla(project: PipelineProject, now: string): StageSla {
  const stage = PIPELINE_STAGES.find((s) => s.key === project.stage);
  const days = Math.floor(
    (new Date(now).getTime() - new Date(`${project.enteredStageAt}T00:00:00Z`).getTime()) /
      (24 * HOUR),
  );
  if (!stage || stage.slaDays === null) return { daysInStage: days, state: "buyer_clock" };
  if (days > stage.slaDays) return { daysInStage: days, state: "overdue" };
  if (days === stage.slaDays) return { daysInStage: days, state: "due_soon" };
  return { daysInStage: days, state: "on_track" };
}
