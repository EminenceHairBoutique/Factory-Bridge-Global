/** Minimal valid quote_extraction_v1 payload for tests. Synthetic values only. */
import type { QuoteExtractionV1 } from "../schemas/quote-extraction-v1.js";

export function sampleExtraction(overrides: Partial<QuoteExtractionV1> = {}): QuoteExtractionV1 {
  return {
    schema: "quote_extraction_v1",
    supplierNameHint: { value: null, confidence: "low", anchor: null },
    currency: {
      value: "CNY",
      confidence: "high",
      anchor: { page: null, sheet: null, cell: null, bbox: null, quote: "¥" },
    },
    quantityUnit: { value: "个", confidence: "high", anchor: null },
    priceBasis: { value: null, confidence: "low", anchor: null },
    incotermPlace: { value: null, confidence: "low", anchor: null },
    moq: { value: "100", confidence: "high", anchor: null },
    tiers: [
      {
        minQty: "100",
        maxQty: "499",
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
    missingFields: [
      "supplier_name",
      "price_basis",
      "incoterm_place",
      "payment_terms",
      "valid_until",
    ],
    flags: [],
    notes: null,
    ...overrides,
  };
}
