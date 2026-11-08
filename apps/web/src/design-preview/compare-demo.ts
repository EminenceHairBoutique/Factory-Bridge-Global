/**
 * Display-only comparison helper for the UX-01 Quote Comparison prototype.
 *
 * This is NOT the authoritative quote engine. The deterministic engine lives in `packages/domain` (BACKLOG
 * B-14, docs/QUOTE_ENGINE_SPEC.md §2) and will replace this module when the comparison UI is wired (B-22).
 * The rules mirrored here are the ones the UI has to visualise: eligibility (§2.1), hard-spec matching
 * (§2.2), tier selection [min, max) and MOQ (§2.3), grouping by price basis (§2.4), FX display (§2.5),
 * landed-cost line status and the "complete" rule (§2.6), and the "never rank on unit price alone" rule (§2.7).
 *
 * Plain JS numbers are acceptable here because the output is a prototype display with demo data. The real
 * engine uses decimal arithmetic.
 */
import {
  BRIEF_HARD_SPEC,
  BRIEF_SOFT_SPEC,
  DEMO_FREIGHT_ESTIMATE,
  DEMO_FX,
  SPEC_LABEL,
  type DemoQuote,
  type LandedLineType,
} from "./demo-data";

export type LineStatus = "sourced" | "estimated" | "missing" | "not_applicable";

export interface LandedLine {
  type: LandedLineType;
  status: LineStatus;
  amountUsd: number | null;
  source: string | null;
}

export type Exclusion =
  | { code: "expired"; date: string }
  | { code: "below_moq"; moq: number }
  | { code: "hard_mismatch"; attributes: string[] }
  | { code: "no_tier_covers_qty" }
  | { code: "basis_unknown" };

export interface EvaluatedQuote {
  quote: DemoQuote;
  exclusion: Exclusion | null;
  flags: string[];
  tier: DemoQuote["tiers"][number] | null;
  goodsOriginal: number | null;
  goodsUsd: number | null;
  oneTimeFeesOriginal: number;
  oneTimeFeesUsd: number;
  /** goods + one-time fees amortised over qty, in USD — the §2.7 within-group sort key. */
  comparableGoodsUsd: number | null;
  softMismatches: string[];
  landed: LandedLine[];
  landedTotalUsd: number | null;
  landedComplete: boolean;
  missingLines: LandedLineType[];
  estimatedLines: LandedLineType[];
}

export interface ComparabilityGroup {
  key: string;
  title: string;
  kind: "basis" | "excluded";
  quotes: EvaluatedQuote[];
  lowestComparableId: string | null;
}

export interface ComparisonResult {
  groups: ComparabilityGroup[];
  /** Cross-basis ranking by landed total — only when every included quote is `complete`. */
  landedRanking: EvaluatedQuote[] | null;
  landedRankingBlockedBy: string[];
}

export type LandedOverrides = Record<
  string,
  Partial<
    Record<LandedLineType, { amountUsd: number; status: "sourced" | "estimated"; source: string }>
  >
>;

/** [min, max) selection — picking 500 can never select a 2000+ tier. */
export function selectTier(quote: DemoQuote, qty: number) {
  return quote.tiers.find((t) => qty >= t.minQty && (t.maxQty === null || qty < t.maxQty)) ?? null;
}

export function toUsd(amount: number, currency: DemoQuote["currency"]): number {
  return currency === "USD" ? amount : amount * DEMO_FX.rate;
}

const REQUIRED_BY_BASIS: Record<string, LandedLineType[]> = {
  EXW: [
    "inland_origin",
    "export_clearance_origin_handling",
    "international_freight",
    "insurance",
    "duties_taxes",
    "brokerage",
    "destination_handling_delivery",
  ],
  FCA: [
    "international_freight",
    "insurance",
    "duties_taxes",
    "brokerage",
    "destination_handling_delivery",
  ],
  FOB: [
    "international_freight",
    "insurance",
    "duties_taxes",
    "brokerage",
    "destination_handling_delivery",
  ],
  CFR: ["insurance", "duties_taxes", "brokerage", "destination_handling_delivery"],
  CIF: ["duties_taxes", "brokerage", "destination_handling_delivery"],
  DAP: ["duties_taxes"],
  DPU: ["duties_taxes"],
  DDP: [],
};

const ALL_LINES: LandedLineType[] = [
  "goods",
  "tooling",
  "inland_origin",
  "export_clearance_origin_handling",
  "international_freight",
  "insurance",
  "duties_taxes",
  "brokerage",
  "destination_handling_delivery",
];

export function evaluateQuote(
  quote: DemoQuote,
  qty: number,
  asOf: string,
  overrides: LandedOverrides[string] | undefined,
): EvaluatedQuote {
  const flags: string[] = [];
  const hardMismatch = Object.entries(BRIEF_HARD_SPEC)
    .filter(([code, expected]) => (quote.spec[code] ?? null) !== expected)
    .map(([code]) => code);
  const softMismatches = Object.entries(BRIEF_SOFT_SPEC)
    .filter(([code, expected]) => quote.spec[code] !== undefined && quote.spec[code] !== expected)
    .map(([code]) => code);

  let exclusion: Exclusion | null = null;
  if (quote.priceBasis === "unknown" || !quote.basisConfirmed)
    exclusion = { code: "basis_unknown" };
  if (!exclusion && quote.validUntil !== null && quote.validUntil < asOf)
    exclusion = { code: "expired", date: quote.validUntil };
  if (!exclusion && hardMismatch.length > 0)
    exclusion = { code: "hard_mismatch", attributes: hardMismatch };
  if (!exclusion && quote.moq !== null && qty < quote.moq)
    exclusion = { code: "below_moq", moq: quote.moq };

  const tier = selectTier(quote, qty);
  if (!exclusion && tier === null) exclusion = { code: "no_tier_covers_qty" };
  if (quote.validUntil === null) flags.push("validity_unconfirmed");

  const goodsOriginal = tier ? tier.unitPrice * qty : null;
  const goodsUsd = goodsOriginal === null ? null : toUsd(goodsOriginal, quote.currency);
  const oneTimeFeesOriginal = quote.fees
    .filter((f) => !f.includedInUnitPrice)
    .reduce((sum, f) => sum + f.amount, 0);
  const oneTimeFeesUsd = toUsd(oneTimeFeesOriginal, quote.currency);
  const comparableGoodsUsd = goodsUsd === null ? null : goodsUsd + oneTimeFeesUsd;

  const required = new Set(REQUIRED_BY_BASIS[quote.priceBasis] ?? []);
  const inputs = { ...quote.landedInputs, ...(overrides ?? {}) };
  const landed: LandedLine[] = ALL_LINES.map((type) => {
    if (type === "goods")
      return {
        type,
        status: goodsUsd === null ? "missing" : "sourced",
        amountUsd: goodsUsd,
        source: quote.sourceRef,
      };
    if (type === "tooling")
      return oneTimeFeesOriginal > 0
        ? { type, status: "sourced", amountUsd: oneTimeFeesUsd, source: quote.sourceRef }
        : { type, status: "not_applicable", amountUsd: 0, source: null };
    if (!required.has(type)) return { type, status: "not_applicable", amountUsd: 0, source: null };
    const provided = inputs[type];
    if (provided)
      return {
        type,
        status: provided.status,
        amountUsd: provided.amountUsd,
        source: provided.source,
      };
    return { type, status: "missing", amountUsd: null, source: null };
  });

  const missingLines = landed.filter((l) => l.status === "missing").map((l) => l.type);
  const estimatedLines = landed.filter((l) => l.status === "estimated").map((l) => l.type);
  const landedComplete = exclusion === null && missingLines.length === 0;
  const landedTotalUsd = landedComplete
    ? landed.reduce((sum, l) => sum + (l.amountUsd ?? 0), 0)
    : null;

  return {
    quote,
    exclusion,
    flags,
    tier,
    goodsOriginal,
    goodsUsd,
    oneTimeFeesOriginal,
    oneTimeFeesUsd,
    comparableGoodsUsd,
    softMismatches,
    landed,
    landedTotalUsd,
    landedComplete,
    missingLines,
    estimatedLines,
  };
}

export function compareQuotes(
  quotes: DemoQuote[],
  qty: number,
  asOf: string,
  overrides: LandedOverrides,
): ComparisonResult {
  const evaluated = quotes.map((q) => evaluateQuote(q, qty, asOf, overrides[q.id]));
  const included = evaluated.filter((e) => e.exclusion === null);
  const excluded = evaluated.filter((e) => e.exclusion !== null);

  const byBasis = new Map<string, EvaluatedQuote[]>();
  for (const e of included) {
    const key = `${e.quote.priceBasis} ${e.quote.basisPlace ?? ""}`.trim();
    byBasis.set(key, [...(byBasis.get(key) ?? []), e]);
  }

  const groups: ComparabilityGroup[] = [...byBasis.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, list]) => {
      const sorted = [...list].sort((a, b) => {
        const diff = (a.comparableGoodsUsd ?? Infinity) - (b.comparableGoodsUsd ?? Infinity);
        if (diff !== 0) return diff;
        const lead = (a.quote.leadTimeDays ?? Infinity) - (b.quote.leadTimeDays ?? Infinity);
        if (lead !== 0) return lead;
        return (b.quote.validUntil ?? "").localeCompare(a.quote.validUntil ?? "");
      });
      return {
        key,
        title: key,
        kind: "basis" as const,
        quotes: sorted,
        lowestComparableId: sorted.length > 1 ? (sorted[0]?.quote.id ?? null) : null,
      };
    });

  if (excluded.length > 0) {
    groups.push({
      key: "excluded",
      title: "Not ranked",
      kind: "excluded",
      quotes: excluded,
      lowestComparableId: null,
    });
  }

  const blockedBy = included.filter((e) => !e.landedComplete).map((e) => e.quote.supplier);
  const landedRanking =
    included.length > 1 && blockedBy.length === 0
      ? [...included].sort((a, b) => (a.landedTotalUsd ?? 0) - (b.landedTotalUsd ?? 0))
      : null;

  return { groups, landedRanking, landedRankingBlockedBy: blockedBy };
}

export function formatMoney(amount: number, currency: "CNY" | "USD", digits = 2): string {
  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(amount);
  return `${currency === "CNY" ? "¥" : "$"}${formatted}`;
}

export function formatQty(n: number): string {
  return new Intl.NumberFormat("en-US").format(n);
}

/** One sentence per exclusion code; shared by the comparison and the report footer. */
export function exclusionText(x: Exclusion): string {
  switch (x.code) {
    case "expired":
      return `Expired ${x.date}`;
    case "below_moq":
      return `Below MOQ (MOQ ${formatQty(x.moq)})`;
    case "hard_mismatch":
      return `Not comparable — specification differs (${x.attributes.map((a) => SPEC_LABEL[a] ?? a).join(", ")})`;
    case "no_tier_covers_qty":
      return "No price tier covers this quantity";
    case "basis_unknown":
      return "Price basis not stated — request confirmation";
  }
}

/** The forwarder's demo freight estimate as `estimated` landed-cost inputs, per quote. */
export function forwarderOverrides(): LandedOverrides {
  const out: LandedOverrides = {};
  for (const [id, lines] of Object.entries(DEMO_FREIGHT_ESTIMATE.perQuoteUsd)) {
    out[id] = Object.fromEntries(
      Object.entries(lines).map(([type, amountUsd]) => [
        type,
        { amountUsd, status: "estimated" as const, source: DEMO_FREIGHT_ESTIMATE.source },
      ]),
    );
  }
  return out;
}
