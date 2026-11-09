/**
 * Presentation modes for the quotation comparison (UX-04 §4): Summary (cards), Compare (side-by-side decision
 * rows) and Full details (every row, specification, source, check record and landed line). Pure helpers so the
 * row selection and the summary facts are unit tested; all money comes from compare-demo.ts.
 *
 * Nothing here ranks across groups or hides uncertainty: a not-ranked quote keeps its exclusion reason, a
 * missing valid-until stays "unconfirmed", missing landed lines are listed by name.
 */
import { exclusionText, formatMoney, formatQty, type EvaluatedQuote } from "./compare-demo";
import { DEMO_AS_OF, LANDED_LINE_LABEL } from "./demo-data";

export type CompareMode = "summary" | "compare" | "details";

export const COMPARE_MODES: ReadonlyArray<{ value: CompareMode; label: string; hint: string }> = [
  {
    value: "summary",
    label: "Summary",
    hint: "One card per quote with what matters and what is missing",
  },
  { value: "compare", label: "Compare", hint: "Side by side within each trade-term group" },
  {
    value: "details",
    label: "Full details",
    hint: "Every specification, tier, source, check and cost line",
  },
];

export type RowSection = "quote" | "spec" | "price" | "terms" | "landed";

const ALL_SECTIONS: readonly RowSection[] = ["quote", "spec", "price", "terms", "landed"];

export function sectionsForMode(mode: CompareMode): readonly RowSection[] {
  return mode === "details" ? ALL_SECTIONS : ALL_SECTIONS.filter((s) => s !== "spec");
}

/** The decision rows Compare keeps; Full details shows every row of every section it lists. */
const COMPARE_ROWS: ReadonlySet<string> = new Set([
  "type",
  "validity",
  "tier",
  "unit",
  "comparable",
  "lead",
  "payment",
  "evidence",
]);

export function rowVisible(mode: CompareMode, key: string, section: RowSection): boolean {
  if (!sectionsForMode(mode).includes(section)) return false;
  return mode === "details" || COMPARE_ROWS.has(key);
}

export type FactTone = "neutral" | "warn" | "danger" | "ok" | "teal";

export interface SummaryFacts {
  ranked: boolean;
  /** Comparable goods cost (goods + one-time fees) in USD, or null when the quote is not ranked. */
  headline: string | null;
  unit: string | null;
  tier: string | null;
  validity: { label: string; tone: FactTone };
  /** Exclusion reason for a not-ranked quote; otherwise the landed-cost lines with nothing on file. */
  missing: string[];
  landed: { complete: boolean; total: string | null; missingCount: number; estimatedCount: number };
  evidenceCount: number;
}

export function summaryFacts(e: EvaluatedQuote, asOf: string = DEMO_AS_OF): SummaryFacts {
  const ranked = e.exclusion === null;
  const validity: SummaryFacts["validity"] =
    e.quote.validUntil === null
      ? { label: "Validity unconfirmed", tone: "warn" }
      : e.quote.validUntil < asOf
        ? { label: `Quote expired ${e.quote.validUntil}`, tone: "danger" }
        : { label: `Valid until ${e.quote.validUntil}`, tone: "neutral" };
  const tier = e.tier;
  return {
    ranked,
    headline:
      ranked && e.comparableGoodsUsd !== null ? formatMoney(e.comparableGoodsUsd, "USD") : null,
    unit: tier ? formatMoney(tier.unitPrice, e.quote.currency, 4) : null,
    tier: tier
      ? `${formatQty(tier.minQty)}${tier.maxQty === null ? "+" : `–${formatQty(tier.maxQty - 1)}`} tier`
      : null,
    validity,
    missing: e.exclusion
      ? [exclusionText(e.exclusion)]
      : e.missingLines.map((m) => LANDED_LINE_LABEL[m]),
    landed: {
      complete: e.landedComplete,
      total:
        e.landedComplete && e.landedTotalUsd !== null ? formatMoney(e.landedTotalUsd, "USD") : null,
      missingCount: e.missingLines.length,
      estimatedCount: e.estimatedLines.length,
    },
    evidenceCount: e.quote.evidence.length,
  };
}
