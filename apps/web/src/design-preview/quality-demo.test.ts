import { describe, expect, it } from "vitest";
import { INSPECTION_JOBS, QSRS, QUALITY_TODAY, QUALITY_TRACKS, SAMPLES } from "./demo-data/quality";
import {
  badgeIsAllowed,
  deriveResult,
  inspectionBadge,
  qualitySummary,
  sampleBadge,
  samplingPlanFor,
  sortTracks,
  specBadge,
  trackView,
  validateBuyerDecision,
  validateResult,
} from "./quality-demo";

const plan = QSRS[0]!.samplingPlan;
const views = QUALITY_TRACKS.map((t) => trackView(t, QUALITY_TODAY));
const view = (id: string) => views.find((v) => v.track.id === id)!;

describe("sampling plan (QA doc §5, illustrative)", () => {
  it("resolves the doc's example: lot 3,000 → K, 125 sampled, accept 7 / reject 8 at AQL 2.5", () => {
    const p = samplingPlanFor(3_000, plan)!;
    expect(p).toMatchObject({ codeLetter: "K", sampleSize: 125, illustrative: true });
    expect(p.lines.find((l) => l.class === "major")).toEqual({
      class: "major",
      aql: 2.5,
      accept: 7,
      reject: 8,
    });
    expect(p.lines.find((l) => l.class === "critical")).toEqual({
      class: "critical",
      aql: 0,
      accept: 0,
      reject: 1,
    });
    expect(samplingPlanFor(10_000, plan)).toMatchObject({ codeLetter: "L", sampleSize: 200 });
    expect(samplingPlanFor(0, plan)).toBeNull();
    expect(samplingPlanFor(3_000, { ...plan, aqlMajor: 1.5 })).toBeNull();
  });
  it("derives the result from the accept numbers only", () => {
    const p = samplingPlanFor(3_000, plan)!;
    expect(deriveResult({ critical: 0, major: 7, minor: 10 }, p, false)).toBe("pass");
    expect(deriveResult({ critical: 0, major: 8, minor: 0 }, p, false)).toBe("fail");
    expect(deriveResult({ critical: 1, major: 0, minor: 0 }, p, false)).toBe("fail");
    expect(deriveResult({ critical: 0, major: 2, minor: 0 }, p, true)).toBe("pass_with_rework");
    expect(deriveResult({ critical: 0, major: 0, minor: 11 }, p, true)).toBe("fail");
  });
  it("refuses a result without a report, an inspector, or counts beyond the sample", () => {
    const p = samplingPlanFor(3_000, plan)!;
    const e = validateResult(
      {
        critical: "",
        major: "200",
        minor: "1",
        inspectorName: "",
        reportRef: "",
        reworkFoundUnits: false,
      },
      p,
    );
    expect(Object.keys(e).sort()).toEqual(["critical", "inspectorName", "major", "reportRef"]);
    expect(e.major).toContain("125 units sampled");
  });
});

describe("badge wording (QA doc §3 and §5)", () => {
  it("prints the exact inspection sentence and never a guarantee", () => {
    const b = inspectionBadge(
      INSPECTION_JOBS.find((j) => j.id === "ij_b_psi")!,
      "L-0003",
    );
    expect(b).toBe(
      "Lot L-0003 failed pre-shipment inspection on 2026-11-03: 9 major and 4 minor findings in 125 sampled; 125 of 3,000 units sampled per ISO 2859-1 Level II, AQL 0/2.5/4.0, checklist v3",
    );
    expect(
      inspectionBadge(
        INSPECTION_JOBS.find((j) => j.id === "ij_a_psi")!,
        "L-0007",
      ),
    ).toBe("Pre-shipment inspection pending (2026-11-12, checklist v3)");
    expect(
      inspectionBadge(
        INSPECTION_JOBS.find((j) => j.id === "ij_a_dp")!,
        "L-0007",
      ),
    ).toContain("passed during production inspection on 2026-11-05: 80 of 10,000 units sampled");
    expect(badgeIsAllowed(b)).toBe(true);
    expect(badgeIsAllowed("Quality guaranteed")).toBe(false);
    expect(badgeIsAllowed("Verified factory")).toBe(false);
  });
  it("names sample and spec states exactly", () => {
    expect(
      sampleBadge(
        SAMPLES.find((s) => s.id === "smp_a_pre")!,
        "50 × 76 mm",
      ),
    ).toBe("Sample approved for variant 50 × 76 mm on 2026-10-27");
    expect(
      sampleBadge(
        SAMPLES.find((s) => s.id === "smp_a_golden")!,
        "x",
      ),
    ).toBe("Golden sample on file");
    expect(
      sampleBadge(
        SAMPLES.find((s) => s.id === "smp_b_pre")!,
        "x",
      ),
    ).toBeNull();
    expect(specBadge(QSRS[0]!)).toBe("Spec v3 agreed 2026-10-20");
    expect(specBadge(QSRS[1]!)).toBe("Spec v1 awaiting buyer approval");
  });
});

describe("workflow steps (QA doc §4)", () => {
  it("places Supplier A in production with the pre-shipment inspection scheduled", () => {
    const v = view("qt_labels_a");
    expect(v.steps.map((s) => `${s.key}:${s.state}`)).toEqual([
      "spec:done",
      "sample:done",
      "golden:done",
      "production:current",
      "inspection:current",
      "exceptions:pending",
      "remediation:not_needed",
      "closure:pending",
    ]);
    expect(v.releaseRecommendation).toBe("not_yet");
    expect(v.nextAction).toContain("Record milestones");
  });
  it("places Supplier B at a failed inspection awaiting the buyer's decision, release not recommended", () => {
    const v = view("qt_labels_b");
    expect(v.steps.find((s) => s.key === "exceptions")).toMatchObject({
      state: "current",
      summary: "Failed inspection; the buyer's decision is pending",
    });
    expect(v.releaseRecommendation).toBe("not_recommended");
    expect(v.steps.find((s) => s.key === "sample")?.summary).toBe("2 samples; latest passed");
  });
  it("blocks the cartons track at the unapproved spec", () => {
    const v = view("qt_cartons_e");
    expect(v.steps.slice(0, 2).map((s) => s.state)).toEqual(["current", "blocked"]);
    expect(v.nextAction).toContain("Send the QSR to the buyer");
  });
  it("summarises and orders: buyer decisions first, then scheduled inspections", () => {
    expect(qualitySummary(views)).toEqual({
      scheduled: 1,
      awaitingBuyer: 1,
      openCases: 1,
      samplesPending: 1,
    });
    expect(sortTracks(views).map((v) => v.track.id)).toEqual([
      "qt_labels_b",
      "qt_labels_a",
      "qt_cartons_e",
    ]);
  });
  it("records the buyer's decision only against the buyer's own message", () => {
    expect(validateBuyerDecision(null, "")).toContain("Choose");
    expect(validateBuyerDecision("rework", "th_1")).toContain("the decision is the buyer's");
    expect(validateBuyerDecision("rework", "th_tooling reply 2026-11-06")).toBeNull();
  });
});
