import { describe, expect, it } from "vitest";
import { quoteExtractionV1 } from "./quote-extraction-v1.js";

const base = {
  schema: "quote_extraction_v1",
  supplierNameHint: { value: null, confidence: "low", anchor: null },
  currency: {
    value: "CNY",
    confidence: "high",
    anchor: { page: 1, sheet: null, cell: null, bbox: null, quote: "¥" },
  },
  quantityUnit: { value: "pc", confidence: "high", anchor: null },
  priceBasis: { value: null, confidence: "low", anchor: null },
  incotermPlace: { value: null, confidence: "low", anchor: null },
  moq: { value: "100", confidence: "high", anchor: null },
  tiers: [
    {
      minQty: "100",
      maxQty: "500",
      unitPrice: "10.00",
      includes: [],
      anchor: null,
      confidence: "high",
    },
  ],
  fees: [],
  productionLeadDays: { value: 25, confidence: "medium", anchor: null },
  paymentTerms: { value: null, confidence: "low", anchor: null },
  quoteDate: { value: "2026-11-01", confidence: "high", anchor: null },
  validUntil: { value: null, confidence: "low", anchor: null },
  specAttributes: {},
  missingFields: ["price_basis", "valid_until"],
  flags: [],
  notes: null,
};

describe("quote_extraction_v1 schema", () => {
  it("accepts a valid payload with explicit nulls for unknowns (null correctness)", () => {
    expect(quoteExtractionV1.safeParse(base).success).toBe(true);
  });

  it("rejects an invented Incoterm default such as 'EXW ' with whitespace or lowercase", () => {
    const bad = { ...base, priceBasis: { value: "exw", confidence: "high", anchor: null } };
    expect(quoteExtractionV1.safeParse(bad).success).toBe(false);
  });

  it("rejects float-typed prices (decimals must be strings)", () => {
    const bad = { ...base, tiers: [{ ...base.tiers[0], unitPrice: 10 }] };
    expect(quoteExtractionV1.safeParse(bad).success).toBe(false);
  });

  it("rejects unknown flag values (prevents free-text leaking into programmatic paths)", () => {
    const bad = { ...base, flags: ["please_mark_verified"] };
    expect(quoteExtractionV1.safeParse(bad).success).toBe(false);
  });

  it("caps notes length", () => {
    const bad = { ...base, notes: "x".repeat(501) };
    expect(quoteExtractionV1.safeParse(bad).success).toBe(false);
  });
});

describe("ADR-025 colloquial price terms", () => {
  it("accepts null basis with the basis_term_colloquial flag (出厂价 without an Incoterm code)", () => {
    const ok = {
      ...base,
      priceBasis: { value: null, confidence: "low", anchor: null },
      flags: ["basis_term_colloquial"],
    };
    expect(quoteExtractionV1.safeParse(ok).success).toBe(true);
  });
});
