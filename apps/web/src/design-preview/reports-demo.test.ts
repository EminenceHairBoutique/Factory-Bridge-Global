import { describe, expect, it } from "vitest";
import { DEMO_AS_OF, DEMO_PROJECTS, DEMO_QUOTES } from "./demo-data";
import { DEMO_REPORTS } from "./demo-data/reports";
import {
  bankersRound,
  buildReport,
  contentForReport,
  presentTotal,
  presentUnit,
  reportFileName,
  reportStatus,
  toCsv,
} from "./reports-demo";

const SEED = DEMO_REPORTS[0]!;
const LABELS = DEMO_PROJECTS.find((p) => p.id === "prj_demo_labels")!;
const CURRENT_QUOTES = DEMO_QUOTES.map((q) => ({
  id: q.id,
  supplier: q.supplier,
  confirmedAt: q.confirmedAt,
}));

describe("reportFileName", () => {
  it("follows the blueprint pattern and ships CSV as a ZIP", () => {
    expect(reportFileName("prj_demo_labels", 3, "2026-11-07", "pdf")).toBe(
      "fbg-comparison-prj_demo_labels-v3-2026-11-07.pdf",
    );
    expect(reportFileName("prj_demo_labels", 3, "2026-11-07", "csv")).toBe(
      "fbg-comparison-prj_demo_labels-v3-2026-11-07.zip",
    );
    expect(SEED.fileName).toBe(
      reportFileName(SEED.projectId, SEED.briefVersion, "2026-11-06", "pdf"),
    );
  });
});

describe("presentation rounding", () => {
  it("rounds half to even at 4 and 2 decimals", () => {
    expect(bankersRound(2.5, 0)).toBe(2);
    expect(bankersRound(3.5, 0)).toBe(4);
    expect(bankersRound(2.51, 0)).toBe(3);
    expect(presentUnit(0.00125)).toBe("0.0012");
    expect(presentUnit(0.00135)).toBe("0.0014");
    expect(presentTotal(10.125)).toBe("10.12");
    expect(presentTotal(10.135)).toBe("10.14");
  });
});

describe("reportStatus", () => {
  it("is current when the snapshot matches the live quotations and the brief", () => {
    const status = reportStatus(SEED, {
      currentBriefVersion: 3,
      currentQuotes: SEED.quotations,
      newestReportId: SEED.id,
    });
    expect(status).toEqual({ state: "current", reasons: [] });
  });
  it("is stale when quotations were confirmed after generation", () => {
    const status = reportStatus(SEED, {
      currentBriefVersion: 3,
      currentQuotes: CURRENT_QUOTES,
      newestReportId: SEED.id,
    });
    expect(status.state).toBe("stale");
    expect(status.reasons).toEqual([
      "2 quotations confirmed after generation: Supplier E (demo), Supplier F (demo)",
    ]);
  });
  it("is superseded when the brief moved on or a newer report exists, keeping every reason", () => {
    const status = reportStatus(SEED, {
      currentBriefVersion: 4,
      currentQuotes: CURRENT_QUOTES,
      newestReportId: "rep_2",
    });
    expect(status.state).toBe("superseded");
    expect(status.reasons).toHaveLength(3);
    expect(status.reasons[0]).toContain("Brief moved to v4");
    expect(status.reasons[1]).toBe("A newer report exists for this project");
  });
});

describe("buildReport (QUOTE_ENGINE_SPEC §5)", () => {
  const content = contentForReport(SEED)!;

  it("re-renders the seeded report from its recorded inputs", () => {
    expect(content.counts).toEqual({ ranked: 2, notRanked: 2, groups: 2 });
    expect(content.groups.map((g) => g.title)).toEqual([
      "EXW Dongguan",
      "FOB Shenzhen",
      "Not ranked",
    ]);
    expect(content.landedRanking.available).toBe(false);
    expect(content.landedRanking.blockedBy).toEqual(["Supplier A (demo)", "Supplier B (demo)"]);
  });

  it("derives exclusions and assumptions from the evaluation, never from free text", () => {
    expect(content.footer.exclusions).toEqual([
      "Supplier C (demo): Not comparable — specification differs (Material)",
      "Supplier D (demo): Expired 2026-10-31",
    ]);
    expect(content.footer.assumptions.some((a) => a.includes("fx_demo_0001"))).toBe(true);
    expect(content.footer.assumptions.some((a) => a.startsWith("Duties and taxes:"))).toBe(true);
    expect(
      content.footer.assumptions.some((a) => a.startsWith("Supplier B (demo): no valid-until")),
    ).toBe(true);
    expect(content.footer.assumptions.some((a) => a.includes("Estimated lines"))).toBe(false);
    expect(content.footer.disclaimers).toContain("Estimates are not customs or legal advice.");
    expect(content.footer.roundingRule).toContain("rounded half to even");
  });

  it("records the forwarder estimate as an assumption when included", () => {
    const withForwarder = buildReport({
      project: LABELS,
      briefVersion: 3,
      quantity: 10_000,
      asOf: DEMO_AS_OF,
      quotes: DEMO_QUOTES,
      includeForwarder: true,
      generatedAt: "preview",
      generatedBy: "test",
    });
    expect(withForwarder.counts).toEqual({ ranked: 2, notRanked: 4, groups: 2 });
    const est = withForwarder.footer.assumptions.find((a) => a.startsWith("Estimated lines"));
    expect(est).toContain("Forwarder email 2026-11-06 (demo)");
    expect(est).toContain("international freight");
    expect(withForwarder.footer.exclusions).toHaveLength(4);
  });

  it("emits the five tables with reproducibility columns on every row", () => {
    expect(content.tables.map((t) => t.name)).toEqual([
      "summary",
      "quotes",
      "landed_cost_lines",
      "assumptions",
      "fx_rates",
    ]);
    const quotes = content.tables[1]!;
    const idCol = quotes.columns.indexOf("quotation_id");
    const fxCol = quotes.columns.indexOf("fx_rate_id");
    const confirmedCol = quotes.columns.indexOf("confirmed_at");
    expect(quotes.rows).toHaveLength(4);
    for (const r of quotes.rows) {
      expect(r[idCol]).toMatch(/^q_demo_/);
      expect(r[fxCol]).toBe("fx_demo_0001");
      expect(r[confirmedCol]).toMatch(/^2026-/);
      expect(r).toHaveLength(quotes.columns.length);
    }
    const lines = content.tables[2]!;
    expect(lines.rows).toHaveLength(4 * 9);
    expect(content.tables[0]!.rows[0]![11]).toBe("blocked: Supplier A (demo), Supplier B (demo)");
  });

  it("quotes CSV cells that contain commas or quotes", () => {
    const csv = toCsv({
      name: "assumptions",
      columns: ["id", "text"],
      rows: [
        ["a1", "plain"],
        ["a2", "has, comma"],
        ["a3", 'he said "x"'],
      ],
    });
    expect(csv.split("\n")).toEqual([
      "id,text",
      "a1,plain",
      'a2,"has, comma"',
      'a3,"he said ""x"""',
    ]);
  });
});
