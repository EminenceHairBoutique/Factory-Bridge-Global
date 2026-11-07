/**
 * Quantity-tier selection and validation (docs/QUOTE_ENGINE_SPEC.md §2.3).
 * Tiers are half-open intervals [minQty, maxQty). `maxQty` undefined = open-ended top tier.
 */
import type { Decimal } from "../money.js";

export interface Tier {
  readonly minQty: Decimal;
  readonly maxQty?: Decimal;
  readonly unitPrice: Decimal;
  readonly includes?: readonly string[];
}

export type TierValidationIssue =
  | { code: "empty" }
  | { code: "negative_price"; index: number }
  | { code: "non_positive_min"; index: number }
  | { code: "max_not_greater_than_min"; index: number }
  | { code: "not_ascending"; index: number }
  | { code: "overlap"; index: number }
  | { code: "open_ended_not_last"; index: number };

export type TierWarning = { code: "non_monotonic_tiers"; index: number };

export interface TierValidation {
  readonly ok: boolean;
  readonly issues: readonly TierValidationIssue[];
  readonly warnings: readonly TierWarning[];
}

/** Validate tier structure on ingestion. Warnings do not block; issues do. */
export function validateTiers(tiers: readonly Tier[]): TierValidation {
  const issues: TierValidationIssue[] = [];
  const warnings: TierWarning[] = [];
  if (tiers.length === 0) return { ok: false, issues: [{ code: "empty" }], warnings };

  const sorted = [...tiers].map((t, i) => ({ t, i })).sort((a, b) => a.t.minQty.cmp(b.t.minQty));

  for (let k = 0; k < sorted.length; k++) {
    const entry = sorted[k];
    if (!entry) continue;
    const { t, i } = entry;
    if (t.unitPrice.isNegative()) issues.push({ code: "negative_price", index: i });
    if (t.minQty.lte(0)) issues.push({ code: "non_positive_min", index: i });
    if (t.maxQty !== undefined && t.maxQty.lte(t.minQty)) {
      issues.push({ code: "max_not_greater_than_min", index: i });
    }
    if (t.maxQty === undefined && k !== sorted.length - 1) {
      issues.push({ code: "open_ended_not_last", index: i });
    }
    const prev = k > 0 ? sorted[k - 1] : undefined;
    if (prev) {
      if (prev.t.minQty.eq(t.minQty)) issues.push({ code: "not_ascending", index: i });
      if (prev.t.maxQty === undefined || prev.t.maxQty.gt(t.minQty)) {
        issues.push({ code: "overlap", index: i });
      }
      if (t.unitPrice.gt(prev.t.unitPrice))
        warnings.push({ code: "non_monotonic_tiers", index: i });
    }
  }
  return { ok: issues.length === 0, issues, warnings };
}

export type TierSelection =
  | { kind: "selected"; tier: Tier; index: number }
  | { kind: "below_moq"; moq: Decimal }
  | { kind: "no_tier_covers_qty" };

/**
 * Pick the tier covering `qty`. MOQ is enforced before tier lookup.
 * Picking 500 from tiers 100–499 / 500–1999 / 2000+ returns the middle tier and can never
 * return the 2000+ tier (QE-01, QE-03).
 */
export function selectTier(tiers: readonly Tier[], qty: Decimal, moq?: Decimal): TierSelection {
  if (moq !== undefined && qty.lt(moq)) return { kind: "below_moq", moq };
  for (let i = 0; i < tiers.length; i++) {
    const t = tiers[i];
    if (!t) continue;
    const aboveMin = qty.gte(t.minQty);
    const belowMax = t.maxQty === undefined || qty.lt(t.maxQty);
    if (aboveMin && belowMax) return { kind: "selected", tier: t, index: i };
  }
  return { kind: "no_tier_covers_qty" };
}

/** Extended goods cost for the selected tier. Pure Decimal; rounding happens at presentation. */
export function extendedGoodsCost(tier: Tier, qty: Decimal): Decimal {
  return tier.unitPrice.times(qty);
}
