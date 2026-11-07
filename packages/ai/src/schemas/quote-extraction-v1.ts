/**
 * quote_extraction_v1 — output contract for the quotation extractor (AI_EVALUATION_PLAN §1).
 * Unknown = null. The model may never invent a value; `anchors` must point at source text.
 * Numeric fields are strings to preserve decimal precision across JSON; domain code parses them.
 */
import { z } from "zod";

const decimalString = z.string().regex(/^-?\d+(\.\d+)?$/, "decimal string");
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD");

export const anchor = z.object({
  page: z.number().int().positive().nullable(),
  sheet: z.string().nullable(),
  cell: z.string().nullable(),
  bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]).nullable(),
  quote: z.string().max(300), // the literal source text supporting the value
});

const confidence = z.enum(["high", "medium", "low"]);

export const extractedField = <T extends z.ZodTypeAny>(value: T) =>
  z.object({ value: value.nullable(), confidence, anchor: anchor.nullable() });

// strictObject: unknown top-level keys (e.g. an injected "approved": true) are a validation error that
// triggers the repair attempt, instead of being silently stripped.
export const quoteExtractionV1 = z.strictObject({
  schema: z.literal("quote_extraction_v1"),
  supplierNameHint: extractedField(z.string().max(200)),
  currency: extractedField(z.enum(["USD", "CNY", "HKD", "EUR"])),
  quantityUnit: extractedField(z.string().max(40)),
  /**
   * Only when the document states an Incoterm CODE. Colloquial terms (出厂价/离岸价/到岸价) MUST yield
   * value: null + flag "basis_term_colloquial" (ADR-025). The engine treats unconfirmed basis as unknown.
   */
  priceBasis: extractedField(z.enum(["EXW", "FCA", "FOB", "CFR", "CIF", "DAP", "DPU", "DDP"])),
  incotermPlace: extractedField(z.string().max(120)),
  moq: extractedField(decimalString),
  tiers: z
    .array(
      z.object({
        minQty: decimalString,
        maxQty: decimalString.nullable(),
        unitPrice: decimalString,
        includes: z.array(z.string().max(80)).max(10),
        anchor: anchor.nullable(),
        confidence,
      }),
    )
    .max(20),
  fees: z
    .array(
      z.object({
        type: z.enum([
          "tooling",
          "sample",
          "setup",
          "packaging",
          "inland_freight",
          "export_doc",
          "other",
        ]),
        amount: decimalString,
        currency: z.enum(["USD", "CNY", "HKD", "EUR"]).nullable(),
        oneTime: z.boolean(),
        includedInUnitPrice: z.boolean(),
        anchor: anchor.nullable(),
        confidence,
      }),
    )
    .max(20),
  productionLeadDays: extractedField(z.number().int().nonnegative()),
  paymentTerms: extractedField(z.string().max(300)),
  quoteDate: extractedField(isoDate),
  validUntil: extractedField(isoDate),
  specAttributes: z.record(z.string(), extractedField(z.string().max(200))),
  missingFields: z.array(z.string().max(60)),
  flags: z.array(
    z.enum([
      "embedded_instruction_detected",
      "basis_term_colloquial",
      "incoterm_place_missing",
      "contradictory_tiers",
      "mixed_currency",
      "relative_validity_date",
      "unit_ambiguous",
      "includes_ambiguous",
      "handwritten",
      "low_ocr_quality",
    ]),
  ),
  notes: z.string().max(500).nullable(),
});

export type QuoteExtractionV1 = z.infer<typeof quoteExtractionV1>;
