/**
 * Incoterms 2020 comparability rules (docs/QUOTE_ENGINE_SPEC.md §2.4, §2.6).
 * Goods-price ranking is only allowed within the same basis. Cross-basis ranking requires a
 * complete landed-cost normalization, decided elsewhere.
 */
import type { PriceBasis } from "../enums.js";

export type LandedLineType =
  | "goods"
  | "tooling"
  | "sample"
  | "packaging_extra"
  | "inland_origin"
  | "export_clearance_origin_handling"
  | "international_freight"
  | "insurance"
  | "duties_taxes"
  | "brokerage"
  | "destination_handling_delivery";

/**
 * Which buyer-side cost lines are REQUIRED to reach a delivered-to-door total for each basis.
 * Lines not listed are already included in the seller's price for that basis and are forced to
 * `not_applicable` even if an estimate exists (double-counting guard).
 */
const REQUIRED_LINES: Record<Exclude<PriceBasis, "unknown">, readonly LandedLineType[]> = {
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
  DAP: ["duties_taxes", "destination_handling_delivery"],
  DPU: ["duties_taxes"],
  DDP: [],
};

export function requiredLandedLines(basis: PriceBasis): readonly LandedLineType[] | null {
  if (basis === "unknown") return null;
  return REQUIRED_LINES[basis];
}

export function lineIncludedInBasis(basis: PriceBasis, line: LandedLineType): boolean {
  if (basis === "unknown") return false;
  if (line === "goods" || line === "tooling" || line === "sample" || line === "packaging_extra")
    return false;
  return !REQUIRED_LINES[basis].includes(line);
}

export type ComparabilityVerdict =
  | { comparable: true; key: string }
  | { comparable: false; reason: "basis_unknown" | "basis_differs" | "place_differs" };

export interface BasisRef {
  readonly basis: PriceBasis;
  /** Named place, normalized by caller (e.g., port code or lowercase city). */
  readonly place?: string;
}

/** Two quotes are directly comparable on goods price only with the same basis and place. */
export function goodsPriceComparability(a: BasisRef, b: BasisRef): ComparabilityVerdict {
  if (a.basis === "unknown" || b.basis === "unknown")
    return { comparable: false, reason: "basis_unknown" };
  if (a.basis !== b.basis) return { comparable: false, reason: "basis_differs" };
  const pa = a.place ?? "";
  const pb = b.place ?? "";
  if (pa !== pb && pa !== "" && pb !== "") return { comparable: false, reason: "place_differs" };
  return { comparable: true, key: `${a.basis}:${pa || pb}` };
}
