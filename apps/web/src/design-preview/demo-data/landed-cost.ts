/**
 * DEMO DATA — NOT REAL SUPPLIER QUOTATIONS. Synthetic inputs for the buyer's landed-cost
 * scenarios, shaped after migration 0011 `fx_landed_cost`: reference FX rates by day and source,
 * freight estimates (provider or manual; "sourced" only with a quote document attached), duty
 * assumptions recorded by a person with an explicit basis (never AI-filled), and immutable
 * comparison snapshots with per-quotation landed-cost scenarios. Illustrative numbers only.
 */
import type { LandedLineType } from "./index";

export const LANDED_TODAY = "2026-11-07";
export const LANDED_PROJECT = {
  id: "prj_demo_labels",
  name: "Custom BOPP roll labels",
  briefQty: 10_000,
  unit: "pc",
};

/** `fx_rates`: base CNY, quote USD; `rate` is USD per 1 CNY. Append-only reference rates (ADR-010). */
export interface FxRateRow {
  id: string;
  base: "CNY";
  quote: "USD";
  rate: number;
  rateDate: string;
  source: string;
  isReference: boolean;
}

export const FX_RATES: FxRateRow[] = [
  {
    id: "fx_1028",
    base: "CNY",
    quote: "USD",
    rate: 1 / 7.23,
    rateDate: "2026-10-28",
    source: "Demo reference rate (synthetic)",
    isReference: true,
  },
  {
    id: "fx_1103",
    base: "CNY",
    quote: "USD",
    rate: 1 / 7.21,
    rateDate: "2026-11-03",
    source: "Demo reference rate (synthetic)",
    isReference: true,
  },
  {
    id: "fx_1104",
    base: "CNY",
    quote: "USD",
    rate: 1 / 7.2,
    rateDate: "2026-11-04",
    source: "Demo reference rate (synthetic)",
    isReference: true,
  },
  {
    id: "fx_1105",
    base: "CNY",
    quote: "USD",
    rate: 1 / 7.19,
    rateDate: "2026-11-05",
    source: "Demo reference rate (synthetic)",
    isReference: true,
  },
  {
    id: "fx_1106",
    base: "CNY",
    quote: "USD",
    rate: 1 / 7.2,
    rateDate: "2026-11-06",
    source: "Demo reference rate (synthetic)",
    isReference: true,
  },
  // No rows for 2026-11-07 onward (weekend in the demo): an as-of beyond the 3-day lag has no rate.
];

export type FreightMode = "sea_lcl" | "sea_fcl" | "air" | "express" | "rail" | "truck";
export const FREIGHT_MODE_LABEL: Record<FreightMode, string> = {
  sea_lcl: "Sea LCL",
  sea_fcl: "Sea FCL",
  air: "Air",
  express: "Express",
  rail: "Rail",
  truck: "Truck",
};

/** `freight_estimates`; the per-quote line breakdown is the forwarder's document read into lines (H-41). */
export interface FreightEstimate {
  id: string;
  origin: string;
  destination: string;
  mode: FreightMode;
  providerOrManual: "provider" | "manual";
  providerName: string | null;
  currency: "USD";
  validUntil: string | null;
  documentId: string | null;
  status: "sourced" | "estimated";
  notes: string;
  perQuoteUsd: Record<string, Partial<Record<LandedLineType, number>>>;
}

export const FREIGHT_ESTIMATES: FreightEstimate[] = [
  {
    id: "fe_forwarder",
    origin: "Shenzhen / Dongguan (CN)",
    destination: "Newark, NJ 07102",
    mode: "sea_lcl",
    providerOrManual: "provider",
    providerName: "Demo Forwarder Co.",
    currency: "USD",
    validUntil: "2026-12-06",
    documentId: "d_forwarder",
    status: "estimated",
    notes:
      "Indicative email, not a booking quote; lines stay estimated until a written quote replaces it.",
    perQuoteUsd: {
      q_demo_a: {
        international_freight: 185,
        insurance: 6,
        brokerage: 125,
        destination_handling_delivery: 140,
      },
      q_demo_b: {
        inland_origin: 40,
        export_clearance_origin_handling: 95,
        international_freight: 185,
        insurance: 6,
        brokerage: 125,
        destination_handling_delivery: 140,
      },
      q_demo_e: {
        international_freight: 210,
        insurance: 8,
        brokerage: 125,
        destination_handling_delivery: 160,
      },
    },
  },
  {
    id: "fe_air",
    origin: "Shenzhen / Dongguan (CN)",
    destination: "Newark, NJ 07102",
    mode: "air",
    providerOrManual: "manual",
    providerName: null,
    currency: "USD",
    validUntil: "2026-11-20",
    documentId: null,
    status: "estimated",
    notes:
      "Typed from a phone call with the forwarder; replace with a written quote before any decision.",
    perQuoteUsd: {
      q_demo_a: {
        international_freight: 520,
        insurance: 12,
        brokerage: 125,
        destination_handling_delivery: 140,
      },
      q_demo_b: {
        inland_origin: 40,
        export_clearance_origin_handling: 95,
        international_freight: 520,
        insurance: 12,
        brokerage: 125,
        destination_handling_delivery: 140,
      },
      q_demo_e: {
        international_freight: 580,
        insurance: 14,
        brokerage: 125,
        destination_handling_delivery: 160,
      },
    },
  },
  {
    id: "fe_sourced_oct",
    origin: "Shenzhen (CN)",
    destination: "Newark, NJ 07102",
    mode: "sea_lcl",
    providerOrManual: "provider",
    providerName: "Demo Forwarder Co.",
    currency: "USD",
    validUntil: "2026-10-31",
    documentId: "d_forwarder",
    status: "sourced",
    notes:
      "Written quote (document attached); expired 2026-10-31. Still cited by the October snapshot.",
    perQuoteUsd: {
      q_demo_a: {
        international_freight: 178,
        insurance: 6,
        brokerage: 120,
        destination_handling_delivery: 135,
      },
      q_demo_b: {
        inland_origin: 38,
        export_clearance_origin_handling: 90,
        international_freight: 178,
        insurance: 6,
        brokerage: 120,
        destination_handling_delivery: 135,
      },
    },
  },
];

export type DutyBasis = "buyer_provided" | "broker_advice" | "operator_lookup" | "unverified";
export const DUTY_BASIS_LABEL: Record<DutyBasis, string> = {
  buyer_provided: "Buyer provided",
  broker_advice: "Broker advice",
  operator_lookup: "Operator lookup",
  unverified: "Unverified",
};

/** `duty_assumptions`: always created by a person; a number needs a basis. MPF/HMF rates are illustrative. */
export interface DutyAssumption {
  id: string;
  htsCandidate: string | null;
  ratePct: number | null;
  basis: DutyBasis;
  reviewedByBroker: boolean;
  brokerName: string | null;
  mpfApplies: boolean;
  hmfApplies: boolean;
  mpfRatePct: number;
  hmfRatePct: number;
  notes: string;
  createdBy: string;
  createdAt: string;
}

export const DUTY_ASSUMPTIONS: DutyAssumption[] = [
  {
    id: "da_broker",
    htsCandidate: "4821.10.40",
    ratePct: 0,
    basis: "broker_advice",
    reviewedByBroker: true,
    brokerName: "Demo Customs Brokerage LLC",
    mpfApplies: true,
    hmfApplies: true,
    mpfRatePct: 0.3464,
    hmfRatePct: 0.125,
    notes:
      "Broker reviewed the candidate heading for printed self-adhesive labels; rate illustrative. MPF and HMF per the broker's note (sea arrival).",
    createdBy: "You (demo buyer)",
    createdAt: "2026-11-06",
  },
  {
    id: "da_buyer",
    htsCandidate: "4821.10.40",
    ratePct: 2.5,
    basis: "buyer_provided",
    reviewedByBroker: false,
    brokerName: null,
    mpfApplies: true,
    hmfApplies: false,
    mpfRatePct: 0.3464,
    hmfRatePct: 0.125,
    notes: "Rate from a previous import entry; not reviewed for this product.",
    createdBy: "You (demo buyer)",
    createdAt: "2026-10-27",
  },
  {
    id: "da_unverified",
    htsCandidate: "4821.10",
    ratePct: null,
    basis: "unverified",
    reviewedByBroker: false,
    brokerName: null,
    mpfApplies: false,
    hmfApplies: false,
    mpfRatePct: 0.3464,
    hmfRatePct: 0.125,
    notes:
      "Candidate heading only; no rate recorded. The duties line stays missing until a person records a rate with a basis.",
    createdBy: "Operator (demo)",
    createdAt: "2026-11-02",
  },
];

export interface ScenarioInputs {
  quantity: number;
  asOf: string;
  freightEstimateId: string | null;
  dutyAssumptionId: string | null;
}

/** `comparison_snapshots`: immutable; carries the exact fx rows and inputs it was generated with. */
export interface SavedSnapshot {
  id: string;
  name: string;
  inputs: ScenarioInputs;
  fxRateIds: string[];
  inputsHash: string;
  engineVersion: string;
  generatedBy: string;
  generatedAt: string;
}

export const SAVED_SNAPSHOTS: SavedSnapshot[] = [
  {
    id: "sn_oct",
    name: "October check — written sea quote, buyer duty rate",
    inputs: {
      quantity: 10_000,
      asOf: "2026-10-28",
      freightEstimateId: "fe_sourced_oct",
      dutyAssumptionId: "da_buyer",
    },
    fxRateIds: ["fx_1028"],
    inputsHash: "3f1c…9ad2",
    engineVersion: "preview-0",
    generatedBy: "You (demo buyer)",
    generatedAt: "2026-10-28 15:40",
  },
  {
    id: "sn_nov_partial",
    name: "25,000 pcs — no freight or duty inputs yet",
    inputs: {
      quantity: 25_000,
      asOf: "2026-11-05",
      freightEstimateId: null,
      dutyAssumptionId: null,
    },
    fxRateIds: ["fx_1105"],
    inputsHash: "a77e…10c4",
    engineVersion: "preview-0",
    generatedBy: "You (demo buyer)",
    generatedAt: "2026-11-05 09:12",
  },
  {
    id: "sn_nov_forwarder",
    name: "10,000 pcs — forwarder sea LCL, broker-reviewed duty",
    inputs: {
      quantity: 10_000,
      asOf: "2026-11-07",
      freightEstimateId: "fe_forwarder",
      dutyAssumptionId: "da_broker",
    },
    fxRateIds: ["fx_1106"],
    inputsHash: "c0d9…55b1",
    engineVersion: "preview-0",
    generatedBy: "You (demo buyer)",
    generatedAt: "2026-11-07 08:30",
  },
];
