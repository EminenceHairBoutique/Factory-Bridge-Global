import { describe, expect, it } from "vitest";
import { Decimal } from "../money.js";
import { extendedGoodsCost, selectTier, validateTiers, type Tier } from "./tiers.js";

const d = (v: Decimal.Value) => new Decimal(v);

// Illustrative tiers from the research plan: 100–499 @ 10.00, 500–1999 @ 8.40, 2000+ @ 7.30
const tiers: Tier[] = [
  { minQty: d(100), maxQty: d(500), unitPrice: d("10.00") },
  { minQty: d(500), maxQty: d(2000), unitPrice: d("8.40") },
  { minQty: d(2000), unitPrice: d("7.30") },
];

describe("selectTier (QUOTE_ENGINE_SPEC §2.3)", () => {
  it("QE-01: qty 500 selects the 500–1999 tier, never 2000+", () => {
    const r = selectTier(tiers, d(500));
    expect(r.kind).toBe("selected");
    if (r.kind === "selected") {
      expect(r.index).toBe(1);
      expect(r.tier.unitPrice.toString()).toBe("8.4");
    }
  });

  it("qty 600 selects the 500–1999 tier (research plan example)", () => {
    const r = selectTier(tiers, d(600));
    expect(r.kind === "selected" && r.index).toBe(1);
  });

  it("QE-02: qty below MOQ returns below_moq and does not look up a tier", () => {
    const r = selectTier(tiers, d(500), d(1000));
    expect(r).toEqual({ kind: "below_moq", moq: d(1000) });
  });

  it("QE-03: qty 10,000 selects the open-ended 2000+ tier", () => {
    const r = selectTier(tiers, d(10_000));
    expect(r.kind === "selected" && r.index).toBe(2);
  });

  it("qty below the first tier yields no_tier_covers_qty", () => {
    expect(selectTier(tiers, d(50))).toEqual({ kind: "no_tier_covers_qty" });
  });

  it("gap between tiers yields no_tier_covers_qty", () => {
    const gappy: Tier[] = [
      { minQty: d(100), maxQty: d(200), unitPrice: d(1) },
      { minQty: d(300), unitPrice: d(0.9) },
    ];
    expect(selectTier(gappy, d(250))).toEqual({ kind: "no_tier_covers_qty" });
  });

  it("upper bound is exclusive: qty 2000 belongs to the 2000+ tier, not 500–1999", () => {
    const r = selectTier(tiers, d(2000));
    expect(r.kind === "selected" && r.index).toBe(2);
  });
});

describe("validateTiers", () => {
  it("accepts a well-formed ladder with no warnings", () => {
    const v = validateTiers(tiers);
    expect(v.ok).toBe(true);
    expect(v.warnings).toEqual([]);
  });

  it("QE-04: rejects overlapping tiers", () => {
    const v = validateTiers([
      { minQty: d(100), maxQty: d(600), unitPrice: d(10) },
      { minQty: d(500), maxQty: d(2000), unitPrice: d(8) },
    ]);
    expect(v.ok).toBe(false);
    expect(v.issues.some((i) => i.code === "overlap")).toBe(true);
  });

  it("rejects an open-ended tier that is not last", () => {
    const v = validateTiers([
      { minQty: d(100), unitPrice: d(10) },
      { minQty: d(500), maxQty: d(2000), unitPrice: d(8) },
    ]);
    expect(v.issues.some((i) => i.code === "open_ended_not_last")).toBe(true);
  });

  it("QE-14: non-monotonic prices are a warning, not an error", () => {
    const v = validateTiers([
      { minQty: d(100), maxQty: d(500), unitPrice: d(8) },
      { minQty: d(500), unitPrice: d(9) },
    ]);
    expect(v.ok).toBe(true);
    expect(v.warnings).toEqual([{ code: "non_monotonic_tiers", index: 1 }]);
  });

  it("rejects empty, negative price, non-positive min, max<=min", () => {
    expect(validateTiers([]).issues).toEqual([{ code: "empty" }]);
    const v = validateTiers([{ minQty: d(0), maxQty: d(0), unitPrice: d(-1) }]);
    const codes = v.issues.map((i) => i.code).sort();
    expect(codes).toEqual(["max_not_greater_than_min", "negative_price", "non_positive_min"]);
  });
});

describe("extendedGoodsCost (QE-12 precision)", () => {
  it("0.0123 × 1,000,000 is exactly 12300", () => {
    const t: Tier = { minQty: d(1), unitPrice: d("0.0123") };
    expect(extendedGoodsCost(t, d(1_000_000)).toString()).toBe("12300");
  });

  it("no float drift on 0.1 + 0.2 style inputs", () => {
    const t: Tier = { minQty: d(1), unitPrice: d("0.1") };
    expect(extendedGoodsCost(t, d(3)).toString()).toBe("0.3");
  });
});
