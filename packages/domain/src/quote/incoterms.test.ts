import { describe, expect, it } from "vitest";
import { goodsPriceComparability, lineIncludedInBasis, requiredLandedLines } from "./incoterms.js";

describe("goodsPriceComparability (QUOTE_ENGINE_SPEC §2.4)", () => {
  it("QE-05: EXW vs FOB are never comparable on goods price", () => {
    expect(goodsPriceComparability({ basis: "EXW" }, { basis: "FOB" })).toEqual({
      comparable: false,
      reason: "basis_differs",
    });
  });

  it("QE-15: unknown basis is never comparable", () => {
    expect(goodsPriceComparability({ basis: "unknown" }, { basis: "unknown" })).toEqual({
      comparable: false,
      reason: "basis_unknown",
    });
    expect(goodsPriceComparability({ basis: "FOB" }, { basis: "unknown" }).comparable).toBe(false);
  });

  it("same basis and same port are comparable", () => {
    const v = goodsPriceComparability(
      { basis: "FOB", place: "shenzhen" },
      { basis: "FOB", place: "shenzhen" },
    );
    expect(v).toEqual({ comparable: true, key: "FOB:shenzhen" });
  });

  it("same basis, different named ports are flagged place_differs", () => {
    const v = goodsPriceComparability(
      { basis: "FOB", place: "shenzhen" },
      { basis: "FOB", place: "ningbo" },
    );
    expect(v).toEqual({ comparable: false, reason: "place_differs" });
  });

  it("a missing place on one side does not block comparability (caller flags it)", () => {
    const v = goodsPriceComparability({ basis: "EXW", place: "dongguan" }, { basis: "EXW" });
    expect(v.comparable).toBe(true);
  });
});

describe("required landed lines and double-counting guard (§2.6)", () => {
  it("EXW requires every buyer-side line", () => {
    expect(requiredLandedLines("EXW")).toHaveLength(7);
  });

  it("DDP requires nothing further", () => {
    expect(requiredLandedLines("DDP")).toEqual([]);
  });

  it("unknown basis has no determinable requirements", () => {
    expect(requiredLandedLines("unknown")).toBeNull();
  });

  it("QE-06: CIF already includes freight and insurance", () => {
    expect(lineIncludedInBasis("CIF", "international_freight")).toBe(true);
    expect(lineIncludedInBasis("CIF", "insurance")).toBe(true);
    expect(lineIncludedInBasis("CIF", "duties_taxes")).toBe(false);
  });

  it("FOB includes export clearance but not freight", () => {
    expect(lineIncludedInBasis("FOB", "export_clearance_origin_handling")).toBe(true);
    expect(lineIncludedInBasis("FOB", "international_freight")).toBe(false);
  });

  it("goods/tooling/sample are never 'included' by a basis", () => {
    expect(lineIncludedInBasis("DDP", "goods")).toBe(false);
    expect(lineIncludedInBasis("DDP", "tooling")).toBe(false);
  });
});
