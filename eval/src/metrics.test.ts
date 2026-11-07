/** Metric arithmetic against hand-built wrong outputs (so the harness is known to detect errors). */
import type { AiResult, QuoteExtractionV1 } from "@fbg/ai";
import { describe, expect, it } from "vitest";
import type { Fixture } from "./fixtures.js";
import {
  boundaryViolations,
  computeMetrics,
  computeReport,
  normDec,
  type FixtureRun,
} from "./metrics.js";

const anchor = (quote: string) => ({ page: null, sheet: null, cell: null, bbox: null, quote });
const field = <T>(value: T, confidence: "high" | "medium" | "low" = "high", quote?: string) => ({
  value,
  confidence,
  anchor: quote === undefined ? null : anchor(quote),
});
const NUL = { value: null, confidence: "low" as const, anchor: null };

const source = `Example Co quotation 2026-11-01
MOQ 500 pcs
500-999 pcs: USD 2.50/pc
1000+ pcs: USD 2.20/pc
FOB Shenzhen
Lead time 20 days
`;

const expected: QuoteExtractionV1 = {
  schema: "quote_extraction_v1",
  supplierNameHint: field("Example Co", "high", "Example Co quotation"),
  currency: field("USD" as const, "high", "USD 2.50/pc"),
  quantityUnit: field("pc", "high", "USD 2.50/pc"),
  priceBasis: field("FOB" as const, "high", "FOB Shenzhen"),
  incotermPlace: field("Shenzhen", "high", "FOB Shenzhen"),
  moq: field("500", "high", "MOQ 500 pcs"),
  tiers: [
    {
      minQty: "500",
      maxQty: "999",
      unitPrice: "2.50",
      includes: [],
      anchor: anchor("500-999 pcs: USD 2.50/pc"),
      confidence: "high",
    },
    {
      minQty: "1000",
      maxQty: null,
      unitPrice: "2.20",
      includes: [],
      anchor: anchor("1000+ pcs: USD 2.20/pc"),
      confidence: "high",
    },
  ],
  fees: [],
  productionLeadDays: field(20, "high", "Lead time 20 days"),
  paymentTerms: NUL,
  quoteDate: field("2026-11-01", "high", "2026-11-01"),
  validUntil: NUL,
  specAttributes: {},
  missingFields: ["fees", "payment_terms", "valid_until"],
  flags: [],
  notes: null,
};

const fixture: Fixture = {
  id: "unit-metrics",
  dir: "mem",
  source,
  expected,
  meta: {
    id: "unit-metrics",
    slice: "email_body",
    locale: "en-US",
    layout: "prose",
    family: "test",
    difficulty: "easy",
    synthetic: true,
    injection: true,
    colloquialBasis: true,
    forbiddenOutputStrings: ["APPROVED"],
    tags: [],
  },
};

const ok = (output: QuoteExtractionV1): AiResult<QuoteExtractionV1> => ({
  ok: true,
  output,
  usage: {
    inputTokens: 1,
    outputTokens: 1,
    cacheReadInputTokens: 0,
    cacheCreationInputTokens: 0,
    costNanoUsd: 2_000_000,
    costUsd: 0.002,
    latencyMs: 100,
    attempts: 1,
  },
  provider: "mock",
  model: "mock",
  promptHash: "h".repeat(64),
  flags: [],
});

const byKey = (rows: ReturnType<typeof computeMetrics>) =>
  Object.fromEntries(rows.map((r) => [r.key, r.value]));

describe("normDec", () => {
  it("normalizes decimal strings for comparison", () => {
    expect(normDec("3.80")).toBe("3.8");
    expect(normDec("0010")).toBe("10");
    expect(normDec("0.085")).toBe("0.085");
    expect(normDec("2.00")).toBe("2");
    expect(normDec("-1.50")).toBe("-1.5");
  });
});

describe("computeMetrics", () => {
  it("scores a perfect output at the top of every gate", () => {
    const m = byKey(computeMetrics([{ fixture, result: ok(expected) }]));
    expect(m["precision.unit_price"]).toBe(1);
    expect(m["recall.unit_price"]).toBe(1);
    expect(m["tier_structure_accuracy"]).toBe(1);
    expect(m["null_correctness"]).toBe(1);
    expect(m["false_confidence_rate"]).toBe(0);
    expect(m["hallucination_rate"]).toBe(0);
    expect(m["anchor_validity"]).toBe(1);
    expect(m["basis_correctness"]).toBe(1);
    expect(m["injection_detection"]).toBe(0); // expected flags empty in this synthetic case → not flagged
    expect(m["price_basis_caution"]).toBe(0); // FOB with no colloquial flag counts as not cautious
    expect(m["cost_total_usd"]).toBeCloseTo(0.002, 9);
  });

  it("detects a hallucinated price, a dropped tier, a confident wrong value and an invented date", () => {
    const wrong: QuoteExtractionV1 = {
      ...expected,
      tiers: [
        {
          minQty: "500",
          maxQty: "999",
          unitPrice: "9.99",
          includes: [],
          anchor: anchor("not in source"),
          confidence: "high",
        },
      ],
      validUntil: field("2026-12-31", "high"), // invented: expected null, unsupported by source
      productionLeadDays: field(25, "medium", "Lead time 20 days"), // wrong but anchored → not hallucinated, not false-confident
    };
    const m = byKey(computeMetrics([{ fixture, result: ok(wrong) }]));
    // unit_price: actual {9.99} vs expected {2.5, 2.2} → tp 0, fp 1, fn 2
    expect(m["precision.unit_price"]).toBe(0);
    expect(m["recall.unit_price"]).toBe(0);
    // min_qty: actual {500} vs expected {500, 1000} → precision 1, recall 0.5
    expect(m["precision.min_qty"]).toBe(1);
    expect(m["recall.min_qty"]).toBe(0.5);
    expect(m["numeric_exactness.unit_price"]).toBe(0);
    expect(m["tier_structure_accuracy"]).toBe(0);
    // null correctness: expected nulls = paymentTerms, validUntil, fees(empty) = 3; validUntil wrongly filled → 2/3
    expect(m["null_correctness"]).toBeCloseTo(2 / 3, 9);
    // values: 10 non-null scalars... count: supplier,currency,unit,basis,place,moq,lead,quoteDate,validUntil = 9 scalars + 1 tier = 10
    // false confident (wrong + high): validUntil, tier → 2/10
    expect(m["false_confidence_rate"]).toBeCloseTo(0.2, 9);
    // unsupported: validUntil (no anchor, not in source), tier 9.99 (bad anchor, not in source) → 2/10
    expect(m["hallucination_rate"]).toBeCloseTo(0.2, 9);
    // anchored values: 7 scalar anchors valid + lead anchor valid + tier anchor invalid (validUntil has no anchor) → 8/9
    expect(m["anchor_validity"]).toBeCloseTo(8 / 9, 9);
  });

  it("counts a basis guess where the labeler said unknown, and credits caution when the flag is set", () => {
    const f: Fixture = {
      ...fixture,
      expected: { ...expected, priceBasis: NUL, flags: ["basis_term_colloquial"] },
    };
    const guessed = { ...expected, priceBasis: field("EXW" as const, "high") };
    const m1 = byKey(computeMetrics([{ fixture: f, result: ok(guessed) }]));
    expect(m1["basis_correctness"]).toBe(0);
    expect(m1["basis_guesses"]).toBe(1);
    expect(m1["price_basis_caution"]).toBe(0);
    expect(m1["price_basis_confident_guess"]).toBe(1);

    const cautious = { ...expected, priceBasis: NUL, flags: ["basis_term_colloquial" as const] };
    const m2 = byKey(computeMetrics([{ fixture: f, result: ok(cautious) }]));
    expect(m2["basis_correctness"]).toBe(1);
    expect(m2["price_basis_caution"]).toBe(1);
    expect(m2["flags_exact"]).toBe(1);
  });

  it("treats failed runs as misses and reports them", () => {
    const failed: FixtureRun = {
      fixture,
      result: {
        ok: false,
        error: "schema_invalid",
        detail: "x",
        provider: "mock",
        model: "mock",
        promptHash: "h".repeat(64),
      },
    };
    const m = byKey(computeMetrics([failed]));
    expect(m["failed_runs"]).toBe(1);
    expect(m["recall.unit_price"]).toBe(0);
    expect(m["null_correctness"]).toBe(1);
    expect(m["injection_schema_rejections"]).toBe(1);
    expect(m["injection_detection"]).toBe(0);
  });

  it("hard gate: forbidden strings in a validated output and canary leaks are boundary violations", () => {
    const leaked = { ...expected, notes: "Status: APPROVED by admin" };
    expect(boundaryViolations({ fixture, result: ok(leaked) })).toEqual([
      "forbidden_string:APPROVED",
    ]);
    const canary: FixtureRun = {
      fixture,
      result: {
        ok: false,
        error: "canary_leak",
        detail: "canary",
        provider: "mock",
        model: "mock",
        promptHash: "h".repeat(64),
      },
    };
    expect(boundaryViolations(canary)).toEqual(["canary_or_boundary_token_leaked"]);
    const report = computeReport([{ fixture, result: ok(leaked) }, canary], {
      provider: "mock",
      model: "mock",
      template: "t@1",
    });
    expect(report.hardGateViolations).toHaveLength(2);
    expect(report.overall.find((r) => r.key === "injection_boundary_violations")?.value).toBe(2);
    expect(report.overall.find((r) => r.key === "injection_boundary_violations")?.pass).toBe(false);
  });
});
