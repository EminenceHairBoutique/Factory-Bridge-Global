import { describe, expect, it } from "vitest";
import { PIPELINE_PROJECTS, QUEUE_NOW } from "./demo-data/ops-queue";
import {
  assignLead,
  attentionFor,
  boardSummary,
  filterProjects,
  gateFor,
  openTasksFor,
  operatorLoad,
  recordStageChange,
  sortForList,
  validateAssignment,
} from "./pipeline-demo";

const p = (id: string) => PIPELINE_PROJECTS.find((x) => x.id === id)!;

describe("open work comes from the queue", () => {
  it("matches the static open-task counts on every card", () => {
    for (const x of PIPELINE_PROJECTS) expect(openTasksFor(x.id).length).toBe(x.openTasks);
  });
});

describe("gates: who owes the next move", () => {
  it("lets the operator record a move only when it is theirs and every requirement is met", () => {
    const hair = gateFor(p("prj_demo_hair"));
    expect(hair).toMatchObject({
      next: "options_in_progress",
      recordedBy: "operator",
      waitingOn: null,
      canRecord: true,
    });
    const cartons = gateFor(p("prj_demo_cartons"));
    expect(cartons.waitingOn).toBe("operator");
    expect(cartons.requirements[0]).toEqual({
      label: "Every extraction reviewed (1 open)",
      owner: "operator",
      met: false,
    });
    expect(cartons.canRecord).toBe(false);
  });
  it("names the supplier, the buyer and compliance when they hold the next step", () => {
    expect(gateFor(p("prj_demo_tea")).explanation).toBe(
      "Waiting on supplier: At least one quotation document received.",
    );
    expect(gateFor(p("prj_demo_mailers")).waitingOn).toBe("buyer");
    expect(gateFor(p("prj_demo_gloves")).waitingOn).toBe("compliance");
    expect(gateFor(p("prj_demo_sleeves")).requirements[0]?.label).toBe(
      "Brief complete (missing: print colors and sleeve dimensions)",
    );
    const labels = gateFor(p("prj_demo_labels"));
    expect(labels).toMatchObject({ recordedBy: "buyer", waitingOn: "buyer", canRecord: false });
  });
  it("never lets the operator record a buyer-owned move, even when its records are complete", () => {
    const g = gateFor(p("prj_demo_labels"), { ...gateFactsComplete() });
    expect(g.waitingOn).toBeNull();
    expect(g.canRecord).toBe(false);
    expect(g.explanation).toContain("when the buyer acts");
  });
});

function gateFactsComplete() {
  return {
    family: "Labels" as const,
    briefVersion: 3,
    briefComplete: true,
    briefMissing: null,
    buyerConfirmedBrief: true,
    complianceHoldId: null,
    shortlisted: 4,
    rfqsApprovedSent: 3,
    quotesReceived: 6,
    quotesConfirmed: 3,
    buyerShortlisted: true,
    sampleRequestApprovedSent: true,
    sampleEvaluated: false,
    goldenSigned: false,
    selectionApproved: false,
    projectHref: null,
    history: [],
  };
}

describe("attention, summary and ordering", () => {
  it("computes the reasons a card needs attention", () => {
    expect(attentionFor(p("prj_demo_cartons"), QUEUE_NOW)).toEqual(["past_target", "overdue_task"]);
    expect(attentionFor(p("prj_demo_gloves"), QUEUE_NOW)).toEqual(["compliance_hold"]);
    expect(attentionFor(p("prj_demo_labels"), QUEUE_NOW)).toEqual(["overdue_task"]);
    expect(attentionFor(p("prj_demo_sleeves"), QUEUE_NOW)).toEqual([]);
    expect(
      attentionFor({ ...p("prj_demo_sleeves"), enteredStageAt: "2026-10-30" }, QUEUE_NOW),
    ).toEqual(["reminder_due"]);
    expect(attentionFor({ ...p("prj_demo_tea"), operator: null }, QUEUE_NOW)).toEqual([
      "past_target",
      "no_lead",
    ]);
  });
  it("summarises the board and orders the list by attention, then days in stage", () => {
    expect(boardSummary(PIPELINE_PROJECTS, QUEUE_NOW)).toEqual({
      attention: 6,
      pastTarget: 4,
      unassigned: 2,
      holds: 1,
    });
    expect(sortForList(PIPELINE_PROJECTS, QUEUE_NOW).map((x) => x.id)).toEqual([
      "prj_demo_cartons",
      "prj_demo_mailers",
      "prj_demo_tea",
      "prj_demo_hair",
      "prj_demo_labels",
      "prj_demo_gloves",
      "prj_demo_sleeves",
    ]);
  });
  it("filters by operator, buyer and attention, and shows operator load", () => {
    expect(
      filterProjects(
        PIPELINE_PROJECTS,
        { operator: "unassigned", buyerOrg: "all", attentionOnly: false },
        QUEUE_NOW,
      ).map((x) => x.id),
    ).toEqual(["prj_demo_sleeves", "prj_demo_gloves"]);
    expect(
      filterProjects(
        PIPELINE_PROJECTS,
        { operator: "Operator 2 (demo)", buyerOrg: "Second Demo Buyer LLC", attentionOnly: true },
        QUEUE_NOW,
      ).map((x) => x.id),
    ).toEqual(["prj_demo_hair", "prj_demo_tea"]);
    expect(operatorLoad(PIPELINE_PROJECTS, QUEUE_NOW)).toEqual([
      { operator: "Operator (demo)", projects: 3, pastTarget: 2, openTasks: 5 },
      { operator: "Operator 2 (demo)", projects: 2, pastTarget: 2, openTasks: 1 },
    ]);
  });
});

describe("actions", () => {
  it("assigns a lead, and needs a reason to reassign", () => {
    expect(validateAssignment(p("prj_demo_sleeves"), "", "")).toEqual(["Choose an operator."]);
    expect(validateAssignment(p("prj_demo_sleeves"), "Operator (demo)", "")).toEqual([]);
    expect(validateAssignment(p("prj_demo_tea"), "Operator (demo)", "")).toEqual([
      "Give a reason for reassigning (at least 3 characters).",
    ]);
    expect(validateAssignment(p("prj_demo_tea"), "Operator 2 (demo)", "load")).toEqual([
      "This operator already leads the project.",
    ]);
    expect(assignLead(p("prj_demo_sleeves"), "Operator (demo)").operator).toBe("Operator (demo)");
  });
  it("records an operator-owned move and starts the new stage clock", () => {
    const hair = p("prj_demo_hair");
    const moved = recordStageChange(hair, gateFor(hair), "2026-11-07");
    expect(moved).toMatchObject({ stage: "options_in_progress", enteredStageAt: "2026-11-07" });
    expect(attentionFor(moved, QUEUE_NOW)).toEqual([]);
    const cartons = p("prj_demo_cartons");
    expect(recordStageChange(cartons, gateFor(cartons), "2026-11-07")).toBe(cartons);
  });
});
