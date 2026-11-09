import { describe, expect, it } from "vitest";
import { compareQuotes } from "./compare-demo";
import {
  COMPARE_MODES,
  rowVisible,
  sectionsForMode,
  summaryFacts,
  type CompareMode,
} from "./compare-modes";
import { DEMO_AS_OF, DEMO_QUOTES } from "./demo-data";

const result = compareQuotes(DEMO_QUOTES, 10_000, DEMO_AS_OF, {});
const all = result.groups.flatMap((g) => g.quotes);
const byId = (id: string) => {
  const e = all.find((x) => x.quote.id === id);
  if (!e) throw new Error(`missing ${id}`);
  return e;
};

describe("comparison presentation modes (UX-04 §4)", () => {
  it("offers Summary, Compare and Full details, in that order", () => {
    expect(COMPARE_MODES.map((m) => m.value)).toEqual(["summary", "compare", "details"]);
  });

  it("Full details keeps every section; Compare drops the specification block", () => {
    expect(sectionsForMode("details")).toEqual(["quote", "spec", "price", "terms", "landed"]);
    expect(sectionsForMode("compare")).toEqual(["quote", "price", "terms", "landed"]);
  });

  it("Compare shows the decision rows only and Full details shows every row", () => {
    const compare: CompareMode = "compare";
    expect(rowVisible(compare, "type", "quote")).toBe(true);
    expect(rowVisible(compare, "validity", "quote")).toBe(true);
    expect(rowVisible(compare, "source", "quote")).toBe(false);
    expect(rowVisible(compare, "comparable", "price")).toBe(true);
    expect(rowVisible(compare, "fees", "price")).toBe(false);
    expect(rowVisible(compare, "evidence", "terms")).toBe(true);
    expect(rowVisible(compare, "spec_material", "spec")).toBe(false);
    for (const key of ["source", "fees", "spec_material", "confirmed"]) {
      expect(rowVisible("details", key, key.startsWith("spec") ? "spec" : "quote")).toBe(true);
    }
  });
});

describe("summary card facts never hide uncertainty", () => {
  it("states the comparable goods cost, validity and what is missing for a ranked quote", () => {
    const f = summaryFacts(byId("q_demo_a"));
    expect(f.ranked).toBe(true);
    expect(f.headline).toBe("$333.33");
    expect(f.validity).toEqual({ label: "Valid until 2026-12-15", tone: "neutral" });
    expect(f.missing.length).toBeGreaterThan(0);
    expect(f.missing).toContain("International freight");
    expect(f.evidenceCount).toBe(2);
    expect(f.landed.complete).toBe(false);
  });

  it("flags a quote without a valid-until date as unconfirmed, not valid", () => {
    expect(summaryFacts(byId("q_demo_b")).validity).toEqual({
      label: "Validity unconfirmed",
      tone: "warn",
    });
  });

  it("gives a not-ranked quote its exclusion reason instead of a price headline", () => {
    const f = summaryFacts(byId("q_demo_d"));
    expect(f.ranked).toBe(false);
    expect(f.headline).toBeNull();
    expect(f.missing).toEqual(["Expired 2026-10-31"]);
    expect(f.validity.tone).toBe("danger");
  });

  it("reports a supplier without any check record as such", () => {
    const noEvidence = all.find((e) => e.quote.evidence.length === 0);
    expect(noEvidence).toBeDefined();
    expect(summaryFacts(noEvidence!).evidenceCount).toBe(0);
  });
});
