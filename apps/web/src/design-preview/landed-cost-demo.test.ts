import { describe, expect, it } from "vitest";
import {
  DUTY_ASSUMPTIONS,
  FREIGHT_ESTIMATES,
  FX_RATES,
  LANDED_TODAY,
  SAVED_SNAPSHOTS,
} from "./demo-data/landed-cost";
import {
  buildScenario,
  dutyLine,
  freightLines,
  fxLabel,
  fxRateFor,
  partialText,
  snapshotFrom,
  validateInputs,
} from "./landed-cost-demo";

const fe = (id: string) => FREIGHT_ESTIMATES.find((f) => f.id === id)!;
const da = (id: string) => DUTY_ASSUMPTIONS.find((d) => d.id === id)!;
const snap = (id: string) => SAVED_SNAPSHOTS.find((s) => s.id === id)!;

describe("FX lookup (§2.5, app.fx_rate_for)", () => {
  it("takes the rate dated as-of, else the latest earlier one within 3 days, else nothing", () => {
    expect(fxRateFor(FX_RATES, "CNY", "USD", "2026-11-05")?.id).toBe("fx_1105");
    expect(fxRateFor(FX_RATES, "CNY", "USD", "2026-11-07")?.id).toBe("fx_1106");
    expect(fxRateFor(FX_RATES, "CNY", "USD", "2026-11-09")?.id).toBe("fx_1106");
    expect(fxRateFor(FX_RATES, "CNY", "USD", "2026-11-10")).toBeNull();
    expect(fxRateFor(FX_RATES, "CNY", "USD", "2026-11-02")).toBeNull();
    expect(fxRateFor(FX_RATES, "USD", "CNY", "2026-11-07")).toBeNull();
  });
  it("labels the rate with source, date and lag, and names missing_fx", () => {
    expect(fxLabel(fxRateFor(FX_RATES, "CNY", "USD", "2026-11-07"), "2026-11-07")).toBe(
      "USD @ 7.2000 CNY per USD (Demo reference rate (synthetic), 2026-11-06; 1 day before as-of)",
    );
    expect(fxLabel(null, "2026-11-10")).toContain("missing_fx");
  });
});

describe("freight and duty lines (§2.6)", () => {
  it("mirrors the estimate status and marks sourced only with a document", () => {
    expect(freightLines(fe("fe_forwarder")).q_demo_a?.international_freight).toMatchObject({
      amountUsd: 185,
      status: "estimated",
    });
    expect(freightLines(fe("fe_sourced_oct")).q_demo_b?.inland_origin).toMatchObject({
      amountUsd: 38,
      status: "sourced",
    });
    expect(freightLines(null)).toEqual({});
  });
  it("computes duties only from a recorded rate, adding MPF and HMF when they apply", () => {
    expect(dutyLine(da("da_unverified"), 1000)).toBeNull();
    expect(dutyLine(null, 1000)).toBeNull();
    const broker = dutyLine(da("da_broker"), 1000)!;
    expect(broker.amountUsd).toBeCloseTo(4.714, 3);
    expect(broker.source).toContain("reviewed by Demo Customs Brokerage LLC");
    expect(broker.source).toContain("MPF 0.3464% + HMF 0.125%");
    expect(dutyLine(da("da_buyer"), 1000)!.amountUsd).toBeCloseTo(28.464, 3);
  });
});

describe("validateInputs", () => {
  it("rejects a future as-of, a non-positive quantity and an expired estimate; warns on manual, unverified and missing fx", () => {
    const bad = validateInputs(
      {
        quantity: 0,
        asOf: "2026-11-08",
        freightEstimateId: "fe_sourced_oct",
        dutyAssumptionId: "da_unverified",
      },
      LANDED_TODAY,
    );
    expect(bad.errors.quantity).toBeDefined();
    expect(bad.errors.asOf).toContain("future");
    expect(bad.errors.freightEstimateId).toContain("expired on 2026-10-31");
    expect(bad.warnings.some((w) => w.includes("no rate"))).toBe(true);
    const warn = validateInputs(
      {
        quantity: 10_000,
        asOf: "2026-11-10",
        freightEstimateId: "fe_air",
        dutyAssumptionId: "da_buyer",
      },
      "2026-11-12",
    );
    expect(warn.errors).toEqual({});
    expect(warn.warnings).toHaveLength(3);
  });
});

describe("buildScenario", () => {
  it("completes A and B with the forwarder estimate and broker duty, and ranks them by landed total", () => {
    const r = buildScenario(snap("sn_nov_forwarder").inputs);
    expect(r.fx?.id).toBe("fx_1106");
    const a = r.quotes.find((q) => q.evaluated.quote.id === "q_demo_a")!;
    const b = r.quotes.find((q) => q.evaluated.quote.id === "q_demo_b")!;
    expect(a.totalStatus).toBe("complete");
    expect(a.landedTotalUsd).toBeCloseTo(291.67 + 41.67 + 456 + 1.375, 1);
    expect(b.totalStatus).toBe("complete");
    expect(b.landedTotalUsd).toBeCloseTo(270 + 591 + 1.273, 1);
    expect(r.ranking).toEqual(["q_demo_a", "q_demo_b"]);
    expect(r.blockedBy).toEqual([]);
    expect(
      r.quotes
        .filter((q) => q.totalStatus === "not_ranked")
        .map((q) => q.evaluated.quote.id)
        .sort(),
    ).toEqual(["q_demo_c", "q_demo_d", "q_demo_e", "q_demo_f"]);
    expect(a.explanations).toContain("International freight: estimated, not a sourced quote.");
  });
  it("keeps totals partial without inputs and never ranks", () => {
    const r = buildScenario(snap("sn_nov_partial").inputs);
    expect(r.ranking).toBeNull();
    expect(r.blockedBy.sort()).toEqual([
      "Supplier A (demo)",
      "Supplier B (demo)",
      "Supplier E (demo)",
    ]);
    const a = r.quotes.find((q) => q.evaluated.quote.id === "q_demo_a")!;
    expect(a.landedTotalUsd).toBeNull();
    expect(partialText(a.evaluated.missingLines)).toBe(
      "Partial — excludes: international freight, insurance, duties and taxes, brokerage, destination handling and delivery",
    );
  });
  it("marks CNY quotes missing_fx when no rate is within the lag, while USD quotes can still complete", () => {
    const r = buildScenario({
      quantity: 10_000,
      asOf: "2026-11-10",
      freightEstimateId: "fe_forwarder",
      dutyAssumptionId: "da_broker",
    });
    expect(r.fx).toBeNull();
    const a = r.quotes.find((q) => q.evaluated.quote.id === "q_demo_a")!;
    const b = r.quotes.find((q) => q.evaluated.quote.id === "q_demo_b")!;
    expect(a.totalStatus).toBe("partial");
    expect(a.evaluated.flags).toContain("missing_fx");
    expect(partialText(a.evaluated.missingLines)).toContain("missing_fx");
    expect(b.totalStatus).toBe("complete");
    expect(r.ranking).toBeNull();
  });
  it("uses the expired written quote as sourced lines inside the October snapshot (immutability)", () => {
    const r = buildScenario(snap("sn_oct").inputs);
    expect(r.fx?.id).toBe("fx_1028");
    const b = r.quotes.find((q) => q.evaluated.quote.id === "q_demo_b")!;
    expect(b.evaluated.landed.find((l) => l.type === "international_freight")).toMatchObject({
      status: "sourced",
      amountUsd: 178,
    });
    expect(b.totalStatus).toBe("complete");
  });
});

describe("snapshotFrom", () => {
  it("records the exact fx row and a stable inputs hash", () => {
    const inputs = snap("sn_nov_forwarder").inputs;
    const s = snapshotFrom(
      inputs,
      buildScenario(inputs),
      "sn_x",
      "You (demo buyer)",
      "2026-11-07 10:00",
    );
    expect(s.fxRateIds).toEqual(["fx_1106"]);
    expect(s.inputsHash).toMatch(/^[0-9a-f]{4}…[0-9a-f]{4}$/);
    expect(s.inputsHash).toBe(
      snapshotFrom(inputs, buildScenario(inputs), "sn_y", "x", "y").inputsHash,
    );
    expect(s.name).toBe("10,000 pcs — forwarder sea LCL, broker advice duty");
  });
});
