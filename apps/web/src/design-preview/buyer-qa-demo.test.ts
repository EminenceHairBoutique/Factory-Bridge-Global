import { describe, expect, it } from "vitest";
import { INSPECTION_JOBS, QUALITY_TODAY } from "./demo-data/quality";
import {
  buyerQaSummary,
  buyerStepText,
  buyerTracks,
  decisionConsequence,
  decisionNeeded,
  evidenceFor,
  samplingLimits,
  validateDecision,
} from "./buyer-qa-demo";

const views = buyerTracks("prj_demo_labels", QUALITY_TODAY);
const view = (id: string) => views.find((v) => v.track.id === id)!;

describe("buyer tracks and evidence", () => {
  it("shows only the buyer's project tracks, each badge resolving to what / who / when / scope", () => {
    expect(views.map((v) => v.track.id)).toEqual(["qt_labels_a", "qt_labels_b"]);
    const ev = evidenceFor(view("qt_labels_a"));
    expect(ev.map((e) => e.label)).toEqual([
      "Spec v3 agreed 2026-10-20",
      "Sample approved for variant 50 × 76 mm matte BOPP, Pantone 2945 C on 2026-10-27",
      "Golden sample on file",
      "Lot L-0007 passed during production inspection on 2026-11-05: 80 of 10,000 units sampled per ISO 2859-1 Level II, AQL 0/2.5/4.0, checklist v3",
      "Pre-shipment inspection pending (2026-11-12, checklist v3)",
    ]);
    expect(ev[0]?.evidence.who).toBe("You (buyer approval)");
    expect(ev[3]?.evidence).toMatchObject({
      who: "Operator (demo) (Factory Bridge staff (demo))",
      when: "2026-11-05",
      scope: "Lot L-0007, 10,000 pcs · checklist v3",
    });
    expect(JSON.stringify(ev)).not.toMatch(/wechat|@|\+86/i);
  });
  it("tells the buyer which decisions are theirs", () => {
    expect(decisionNeeded(view("qt_labels_b"), false)).toBe(true);
    expect(decisionNeeded(view("qt_labels_b"), true)).toBe(false);
    expect(decisionNeeded(view("qt_labels_a"), false)).toBe(false);
    expect(buyerQaSummary(views, new Set())).toEqual({
      decisions: 1,
      scheduled: 1,
      awaitingYou: 1,
    });
    expect(buyerQaSummary(views, new Set(["qt_labels_b"])).decisions).toBe(0);
  });
});

describe("sampling limits (QA §5) and decisions", () => {
  it("states the plan's numbers and never claims defect-free", () => {
    const lines = samplingLimits(
      INSPECTION_JOBS.find((j) => j.id === "ij_b_psi")!,
      3_000,
      2.5,
    );
    expect(lines[0]).toBe(
      "125 of 3,000 units were inspected (ISO 2859-1 Level II, code letter K). At AQL 2.5 the lot is accepted with up to 7 major findings and rejected at 8; 9 were found.",
    );
    expect(lines.join(" ")).toContain("does not mean the lot has at most 2.5 % defects");
    expect(lines.join(" ")).not.toMatch(/defect-free|guarantee/i);
  });
  it("requires a decision and the acknowledgement, and a scope note for partial acceptance", () => {
    expect(validateDecision({ decision: null, note: "", acknowledged: false })).toEqual([
      "Choose a decision.",
      "Confirm that you have read what the inspection did and did not cover.",
    ]);
    expect(
      validateDecision({ decision: "partial", note: "rolls 1-3", acknowledged: true }),
    ).toEqual([
      "Say which units or criteria the partial acceptance covers (at least 10 characters).",
    ]);
    expect(validateDecision({ decision: "rework", note: "", acknowledged: true })).toEqual([]);
    expect(decisionConsequence("rework")).toContain("re-inspected before release");
  });
  it("writes the buyer-facing step sentences", () => {
    expect(buyerStepText(view("qt_labels_a"), "spec")).toBe(
      "You approved the quality specification record v3 on 2026-10-20.",
    );
    expect(buyerStepText(view("qt_labels_a"), "golden")).toContain(
      "You signed the golden sample agreement on 2026-10-28",
    );
    expect(buyerStepText(view("qt_labels_a"), "production")).toContain(
      "dates marked estimated are the supplier's estimates",
    );
  });
});
