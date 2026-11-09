import { describe, expect, it } from "vitest";
import { COMPLIANCE_NOW, DEMO_HOLDS } from "./demo-data/ops-compliance";
import {
  applyDecision,
  canDecide,
  effectOf,
  holdSla,
  holdSummary,
  sortHolds,
  validateDecision,
} from "./ops-compliance-demo";

const byId = (id: string) => DEMO_HOLDS.find((h) => h.id === id)!;

describe("roles", () => {
  it("lets only compliance reviewers and platform admins decide", () => {
    expect(canDecide("operator")).toBe(false);
    expect(canDecide("compliance_reviewer")).toBe(true);
    expect(canDecide("platform_admin")).toBe(true);
    const v = validateDecision(
      {
        outcome: "released",
        reason: "A reason long enough to pass.",
        conditions: [],
        escalateTo: null,
      },
      "operator",
    );
    expect(v.ok).toBe(false);
    expect(v.errors[0]).toContain("Only a compliance reviewer");
  });
});

describe("validateDecision", () => {
  it("requires an outcome, a usable reason, conditions when released with them, and an escalation target", () => {
    expect(
      validateDecision(
        { outcome: null, reason: "", conditions: [], escalateTo: null },
        "compliance_reviewer",
      ).errors,
    ).toEqual([
      "Choose an outcome.",
      "Write a reason of at least 20 characters; it goes into the audit record.",
    ]);
    expect(
      validateDecision(
        {
          outcome: "released_with_conditions",
          reason: "Food-contact test basis must be documented first.",
          conditions: ["  "],
          escalateTo: null,
        },
        "compliance_reviewer",
      ).errors,
    ).toEqual(["Add at least one condition, or choose Release."]);
    expect(
      validateDecision(
        {
          outcome: "escalated",
          reason: "Licensing question beyond the pilot's scope.",
          conditions: [],
          escalateTo: null,
        },
        "platform_admin",
      ).errors,
    ).toEqual(["Choose who the hold is escalated to."]);
    expect(
      validateDecision(
        {
          outcome: "declined",
          reason: "Ingestibles are outside the pilot scope.",
          conditions: [],
          escalateTo: null,
        },
        "compliance_reviewer",
      ),
    ).toEqual({ ok: true, errors: [] });
  });
});

describe("applyDecision and effects", () => {
  it("records who, role, when, reason and conditions, claims the hold and appends the audit note", () => {
    const hold = byId("h_grant_b");
    const next = applyDecision(
      hold,
      {
        outcome: "released_with_conditions",
        reason: "Sample logistics only; expiry shortened to the sample window.",
        conditions: ["Expiry 2026-12-15", " "],
        escalateTo: null,
      },
      "Compliance (demo)",
      "compliance_reviewer",
      "2026-11-07 10:12",
    );
    expect(next.state).toBe("released_with_conditions");
    expect(next.assignee).toBe("Compliance (demo)");
    expect(next.decision).toMatchObject({
      outcome: "released_with_conditions",
      role: "compliance_reviewer",
      conditions: ["Expiry 2026-12-15"],
      escalateTo: null,
    });
    expect(next.notes[next.notes.length - 1]?.text).toContain(
      "Release with conditions: Sample logistics only",
    );
    expect(
      applyDecision(
        hold,
        { outcome: "released", reason: "x".repeat(30), conditions: [], escalateTo: null },
        "Operator (demo)",
        "operator",
        "t",
      ),
    ).toBe(hold);
  });
  it("describes the downstream effect per kind and outcome", () => {
    expect(effectOf("blocked_category", "released")).toContain("applies to this brief only");
    expect(effectOf("disclosure_grant", "declined")).toContain("draft grant is discarded");
    expect(effectOf("supplier_provenance", "released_with_conditions")).toContain(
      "verification checks",
    );
    expect(effectOf("export_sensitive", "escalated")).toContain("hold stays in force");
  });
});

describe("SLA, summary and ordering", () => {
  it("flags overdue open holds and ignores decided ones", () => {
    expect(holdSla(byId("h_hplc"), COMPLIANCE_NOW)?.state).toBe("overdue");
    expect(holdSla(byId("h_gloves"), COMPLIANCE_NOW)?.state).toBe("due_soon");
    expect(holdSla(byId("h_gummies"), COMPLIANCE_NOW)).toBeNull();
    expect(holdSummary(DEMO_HOLDS, COMPLIANCE_NOW)).toEqual({
      open: 3,
      underReview: 1,
      overdue: 1,
      decided: 2,
    });
  });
  it("puts overdue holds first, then open by due date, then decided newest first", () => {
    const ids = sortHolds(DEMO_HOLDS, COMPLIANCE_NOW).map((h) => h.id);
    expect(ids.slice(0, 2)).toEqual(["h_hplc", "h_prov_e"]);
    expect(ids.slice(-2)).toEqual(["h_gummies", "h_spatula"]);
  });
});
