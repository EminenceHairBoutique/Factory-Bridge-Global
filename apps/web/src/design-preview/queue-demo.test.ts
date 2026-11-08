import { describe, expect, it } from "vitest";
import { PIPELINE_PROJECTS, QUEUE_NOW, QUEUE_TASKS } from "./demo-data/ops-queue";
import { queueSummary, slaFor, sortByUrgency, stageSla } from "./queue-demo";

describe("slaFor", () => {
  it("labels overdue, due soon and on track from the due time", () => {
    expect(slaFor("2026-11-07T09:05:00Z", QUEUE_NOW)).toMatchObject({
      state: "overdue",
      label: "Overdue 1 h",
    });
    expect(slaFor("2026-11-07T16:30:00Z", QUEUE_NOW)).toMatchObject({
      state: "due_soon",
      label: "Due in 7 h",
    });
    expect(slaFor("2026-11-14T00:00:00Z", QUEUE_NOW)).toMatchObject({
      state: "on_track",
      label: "Due in 7 d",
    });
    expect(slaFor("2026-11-05T10:00:00Z", QUEUE_NOW).label).toBe("Overdue 2 d");
  });
});

describe("sortByUrgency and queueSummary", () => {
  it("puts overdue first and done last", () => {
    const sorted = sortByUrgency(QUEUE_TASKS, QUEUE_NOW);
    expect(sorted[0]?.id).toBe("t3");
    expect(sorted[1]?.id).toBe("t2");
    const withDone = sortByUrgency(
      [{ ...QUEUE_TASKS[2]!, status: "done" }, QUEUE_TASKS[1]!],
      QUEUE_NOW,
    );
    expect(withDone[withDone.length - 1]?.status).toBe("done");
  });
  it("counts open, overdue, due soon, mine and unassigned", () => {
    const s = queueSummary(QUEUE_TASKS, QUEUE_NOW);
    expect(s.open).toBe(9);
    expect(s.overdue).toBe(2);
    expect(s.mine).toBe(4);
    expect(s.unassigned).toBe(3);
  });
});

describe("stageSla", () => {
  it("uses the buyer's clock where no operator SLA applies", () => {
    const labels = PIPELINE_PROJECTS.find((p) => p.id === "prj_demo_labels")!;
    expect(stageSla(labels, QUEUE_NOW).state).toBe("buyer_clock");
  });
  it("flags a stage past its target", () => {
    const hair = PIPELINE_PROJECTS.find((p) => p.id === "prj_demo_hair")!;
    expect(stageSla(hair, QUEUE_NOW)).toMatchObject({ daysInStage: 4, state: "overdue" });
    const cartons = PIPELINE_PROJECTS.find((p) => p.id === "prj_demo_cartons")!;
    expect(stageSla(cartons, QUEUE_NOW).state).toBe("overdue");
  });
});
