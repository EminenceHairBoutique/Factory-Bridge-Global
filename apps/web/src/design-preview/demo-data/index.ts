/**
 * DEMO DATA — NOT REAL SUPPLIER QUOTATIONS.
 *
 * Every record in this module is synthetic and exists only so the UX-01 prototypes have believable shape.
 * Numbers follow the worked example in docs/QUOTE_ENGINE_SPEC.md §3 (10,000 BOPP roll labels to NJ) and are
 * explicitly "illustrative numbers only — not market data". Supplier names are placeholders.
 *
 * Field names mirror the price-record contract in CLAUDE.md §4 (quote_type, price_basis, currency, unit,
 * min_qty/max_qty, source_type, rights_class, visibility_scope, observed_at/confirmed_at, valid_until,
 * review_status) so the screens exercise the real vocabulary.
 */
import type { PriceBasis, QuoteType, SourceType } from "@fbg/domain";
import { LABEL_H_FIELDS } from "./documents";

export const DEMO_AS_OF = "2026-11-07";

export interface DemoFxRate {
  id: string;
  pair: "CNY/USD";
  rate: number; // USD per 1 CNY
  rateDate: string;
  source: string;
}

export const DEMO_FX: DemoFxRate = {
  id: "fx_demo_0001",
  pair: "CNY/USD",
  rate: 1 / 7.2,
  rateDate: "2026-11-06",
  source: "Demo reference rate (synthetic)",
};

export type ProjectStage =
  | "brief_draft"
  | "brief_confirmed"
  | "options_in_progress"
  | "quotes_in_review"
  | "comparison_ready"
  | "sample_requested"
  | "handoff_pending";

export const STAGE_LABEL: Record<ProjectStage, string> = {
  brief_draft: "Brief draft",
  brief_confirmed: "Brief confirmed",
  options_in_progress: "Finding supplier options",
  quotes_in_review: "Quotes in review",
  comparison_ready: "Comparison ready",
  sample_requested: "Sample requested",
  handoff_pending: "Awaiting your approval",
};

export const STAGE_ORDER: ProjectStage[] = [
  "brief_draft",
  "brief_confirmed",
  "options_in_progress",
  "quotes_in_review",
  "comparison_ready",
  "sample_requested",
  "handoff_pending",
];

export interface DemoProject {
  id: string;
  name: string;
  family: "Labels" | "Folding cartons" | "Hair bundles";
  stage: ProjectStage;
  quantity: number;
  unit: string;
  destination: string;
  operator: string;
  updatedAt: string;
  quotes: { confirmed: number; inReview: number; expiringSoon: number };
  nextAction: string;
  briefVersion: number;
}

export const DEMO_PROJECTS: DemoProject[] = [
  {
    id: "prj_demo_labels",
    name: "Custom BOPP roll labels, 50 × 76 mm",
    family: "Labels",
    stage: "comparison_ready",
    quantity: 10_000,
    unit: "pcs",
    destination: "Newark, NJ 07102",
    operator: "Operator (demo)",
    updatedAt: "2026-11-06",
    quotes: { confirmed: 3, inReview: 1, expiringSoon: 1 },
    nextAction: "Review comparison and shortlist",
    briefVersion: 3,
  },
  {
    id: "prj_demo_cartons",
    name: "Folding cartons, 350 gsm C1S, matte",
    family: "Folding cartons",
    stage: "quotes_in_review",
    quantity: 5_000,
    unit: "pcs",
    destination: "Carson, CA 90745",
    operator: "Operator (demo)",
    updatedAt: "2026-11-05",
    quotes: { confirmed: 1, inReview: 2, expiringSoon: 0 },
    nextAction: "Confirm 2 extracted quotes",
    briefVersion: 2,
  },
  {
    id: "prj_demo_hair",
    name: "Raw hair bundles, 18–22 in, natural black",
    family: "Hair bundles",
    stage: "brief_draft",
    quantity: 300,
    unit: "bundles",
    destination: "Atlanta, GA 30303",
    operator: "Unassigned",
    updatedAt: "2026-11-03",
    quotes: { confirmed: 0, inReview: 0, expiringSoon: 0 },
    nextAction: "Confirm 3 inferred specification values",
    briefVersion: 2,
  },
  {
    id: "prj_demo_sleeves",
    name: "Kraft paper sleeves, printed 1-color",
    family: "Folding cartons",
    stage: "brief_draft",
    quantity: 0,
    unit: "pcs",
    destination: "—",
    operator: "Unassigned",
    updatedAt: "2026-11-01",
    quotes: { confirmed: 0, inReview: 0, expiringSoon: 0 },
    nextAction: "Add quantity and destination",
    briefVersion: 1,
  },
];

export type ActionKind =
  "review_extraction" | "confirm_spec" | "approve_message" | "quote_expiring" | "complete_brief";

export interface DemoAction {
  id: string;
  kind: ActionKind;
  projectId: string;
  title: string;
  detail: string;
  due?: string;
  href?: string;
}

export const DEMO_ACTIONS: DemoAction[] = [
  {
    id: "act_1",
    kind: "review_extraction",
    projectId: "prj_demo_cartons",
    title: "Review 2 extracted quotes",
    detail:
      "Extracted from supplier PDFs on 2026-11-05. Values stay unconfirmed until you accept them.",
    due: "Suggested within 2 days",
  },
  {
    id: "act_2",
    kind: "quote_expiring",
    projectId: "prj_demo_labels",
    title: "Supplier A quote expires 2026-12-15",
    detail: "Factory-confirmed quote. Ask for revalidation if you plan to order after this date.",
    due: "38 days left",
    href: "/design-preview/buyer/compare",
  },
  {
    id: "act_3",
    kind: "approve_message",
    projectId: "prj_demo_labels",
    title: "Approve clarification to Supplier B",
    detail:
      "Drafted question: is tooling included in the EXW unit price? Nothing is sent until you and an operator approve.",
  },
  {
    id: "act_4",
    kind: "confirm_spec",
    projectId: "prj_demo_hair",
    title: "Confirm 3 inferred specification values",
    detail:
      "Inferred values (cuticle alignment, weft type, weight per bundle) are not used for matching until confirmed.",
    href: "/design-preview/buyer/brief",
  },
  {
    id: "act_5",
    kind: "complete_brief",
    projectId: "prj_demo_sleeves",
    title: "Finish the kraft sleeves brief",
    detail: "Quantity and destination are missing, so supplier options cannot be requested yet.",
    href: "/design-preview/buyer/new-request",
  },
];

export interface DemoEvidence {
  label: string;
  what: string;
  who: string;
  when: string;
  until?: string;
  note?: string;
}

export interface DemoTier {
  minQty: number;
  maxQty: number | null;
  unitPrice: number;
}

export interface DemoFee {
  type: "tooling" | "sample" | "packaging_extra";
  amount: number;
  includedInUnitPrice: boolean;
}

export type LandedLineType =
  | "goods"
  | "tooling"
  | "inland_origin"
  | "export_clearance_origin_handling"
  | "international_freight"
  | "insurance"
  | "duties_taxes"
  | "brokerage"
  | "destination_handling_delivery";

export const LANDED_LINE_LABEL: Record<LandedLineType, string> = {
  goods: "Goods",
  tooling: "Tooling (one-time)",
  inland_origin: "Inland transport, origin",
  export_clearance_origin_handling: "Export clearance and origin handling",
  international_freight: "International freight",
  insurance: "Insurance",
  duties_taxes: "Duties and taxes",
  brokerage: "Brokerage",
  destination_handling_delivery: "Destination handling and delivery",
};

export interface DemoQuote {
  id: string;
  supplier: string;
  city: string;
  quoteType: QuoteType;
  priceBasis: PriceBasis;
  basisPlace: string | null;
  basisConfirmed: boolean;
  currency: "CNY" | "USD";
  unit: string;
  moq: number | null;
  tiers: DemoTier[];
  fees: DemoFee[];
  leadTimeDays: number | null;
  paymentTerms: string | null;
  validUntil: string | null;
  confirmedAt: string;
  observedAt: string;
  sourceType: SourceType;
  sourceRef: string;
  spec: Record<string, string>;
  evidence: DemoEvidence[];
  /** Manual or forwarder-sourced landed-cost inputs that already exist for this quote. */
  landedInputs: Partial<
    Record<LandedLineType, { amountUsd: number; status: "sourced" | "estimated"; source: string }>
  >;
}

export const BRIEF_HARD_SPEC: Record<string, string> = {
  material: "BOPP (white)",
  size: "50 × 76 mm",
  print: "4-color",
  finish: "Matte lamination",
  adhesive: "Permanent",
};

export const BRIEF_SOFT_SPEC: Record<string, string> = {
  core: "76 mm (3 in)",
  windDirection: "Outside wound, #4",
  labelsPerRoll: "500",
};

export const SPEC_LABEL: Record<string, string> = {
  material: "Material",
  size: "Size",
  print: "Print",
  finish: "Finish",
  adhesive: "Adhesive",
  core: "Core",
  windDirection: "Wind direction",
  labelsPerRoll: "Labels per roll",
};

export const DEMO_QUOTES: DemoQuote[] = [
  {
    id: "q_demo_a",
    supplier: "Supplier A (demo)",
    city: "Shenzhen",
    quoteType: "negotiated_private",
    priceBasis: "FOB",
    basisPlace: "Shenzhen",
    basisConfirmed: true,
    currency: "CNY",
    unit: "pcs",
    moq: 5_000,
    tiers: [
      { minQty: 5_000, maxQty: 10_000, unitPrice: 0.26 },
      { minQty: 10_000, maxQty: 50_000, unitPrice: 0.21 },
    ],
    fees: [{ type: "tooling", amount: 300, includedInUnitPrice: false }],
    leadTimeDays: 15,
    paymentTerms: "30% deposit, balance before shipment",
    validUntil: "2026-12-15",
    confirmedAt: "2026-11-04",
    observedAt: "2026-11-03",
    sourceType: "buyer_upload",
    sourceRef: "quote-A-2026-11.pdf, p. 1",
    spec: {
      ...BRIEF_HARD_SPEC,
      core: "76 mm (3 in)",
      windDirection: "Outside wound, #4",
      labelsPerRoll: "500",
    },
    evidence: [
      {
        label: "Identity reviewed (2026-10-20)",
        what: "Business licence matched to legal name; representative confirmed by video call",
        who: "Operator (demo)",
        when: "2026-10-20",
        until: "2027-10-20",
      },
      {
        label: "Sample approved for variant",
        what: "Golden sample for 50 × 76 mm matte BOPP, approved by buyer",
        who: "Demo Buyer Co.",
        when: "2026-10-28",
      },
    ],
    landedInputs: {},
  },
  {
    id: "q_demo_b",
    supplier: "Supplier B (demo)",
    city: "Dongguan",
    quoteType: "negotiated_private",
    priceBasis: "EXW",
    basisPlace: "Dongguan",
    basisConfirmed: true,
    currency: "USD",
    unit: "pcs",
    moq: 10_000,
    tiers: [{ minQty: 10_000, maxQty: null, unitPrice: 0.027 }],
    fees: [{ type: "tooling", amount: 0, includedInUnitPrice: true }],
    leadTimeDays: 12,
    paymentTerms: "T/T 50% deposit",
    validUntil: null,
    confirmedAt: "2026-11-05",
    observedAt: "2026-11-05",
    sourceType: "inbound_email",
    sourceRef: "Email 2026-11-05, operator intake #demo-412",
    spec: {
      ...BRIEF_HARD_SPEC,
      core: "76 mm (3 in)",
      windDirection: "Outside wound, #4",
      labelsPerRoll: "1,000",
    },
    evidence: [
      {
        label: "Identity reviewed (2026-09-30)",
        what: "Business licence reviewed; address corroborated with a second document",
        who: "Operator (demo)",
        when: "2026-09-30",
        until: "2027-09-30",
      },
    ],
    landedInputs: {},
  },
  {
    id: "q_demo_c",
    supplier: "Supplier C (demo)",
    city: "Ningbo",
    quoteType: "negotiated_private",
    priceBasis: "FOB",
    basisPlace: "Ningbo",
    basisConfirmed: true,
    currency: "USD",
    unit: "pcs",
    moq: 2_000,
    tiers: [{ minQty: 2_000, maxQty: null, unitPrice: 0.031 }],
    fees: [],
    leadTimeDays: 10,
    paymentTerms: "T/T 30/70",
    validUntil: "2026-12-31",
    confirmedAt: "2026-11-02",
    observedAt: "2026-11-01",
    sourceType: "supplier_portal",
    sourceRef: "Portal submission #demo-77",
    spec: {
      ...BRIEF_HARD_SPEC,
      material: "Paper (semi-gloss)",
      core: "76 mm (3 in)",
      windDirection: "Outside wound, #4",
      labelsPerRoll: "500",
    },
    evidence: [
      {
        label: "Identity reviewed (2026-10-02)",
        what: "Business licence reviewed",
        who: "Operator (demo)",
        when: "2026-10-02",
        until: "2027-10-02",
      },
    ],
    landedInputs: {},
  },
  {
    id: "q_demo_d",
    supplier: "Supplier D (demo)",
    city: "Guangzhou",
    quoteType: "negotiated_private",
    priceBasis: "FOB",
    basisPlace: "Shenzhen",
    basisConfirmed: true,
    currency: "CNY",
    unit: "pcs",
    moq: 5_000,
    tiers: [{ minQty: 5_000, maxQty: null, unitPrice: 0.2 }],
    fees: [{ type: "tooling", amount: 250, includedInUnitPrice: false }],
    leadTimeDays: 18,
    paymentTerms: "30% deposit",
    validUntil: "2026-10-31",
    confirmedAt: "2026-10-10",
    observedAt: "2026-10-09",
    sourceType: "buyer_upload",
    sourceRef: "quote-D-2026-10.pdf, p. 2",
    spec: {
      ...BRIEF_HARD_SPEC,
      core: "76 mm (3 in)",
      windDirection: "Outside wound, #4",
      labelsPerRoll: "500",
    },
    evidence: [],
    landedInputs: {},
  },
  {
    id: "q_demo_e",
    supplier: "Supplier E (demo)",
    city: "Wenzhou",
    quoteType: "negotiated_private",
    priceBasis: "FOB",
    basisPlace: "Shenzhen",
    basisConfirmed: true,
    currency: "CNY",
    unit: "pcs",
    moq: 20_000,
    tiers: [{ minQty: 20_000, maxQty: null, unitPrice: 0.18 }],
    fees: [],
    leadTimeDays: 20,
    paymentTerms: "L/C or T/T",
    validUntil: "2027-01-15",
    confirmedAt: "2026-11-06",
    observedAt: "2026-11-06",
    sourceType: "supplier_portal",
    sourceRef: "Portal submission #demo-81",
    spec: {
      ...BRIEF_HARD_SPEC,
      core: "76 mm (3 in)",
      windDirection: "Outside wound, #4",
      labelsPerRoll: "500",
    },
    evidence: [
      {
        label: "Identity reviewed (2026-11-01)",
        what: "Business licence reviewed",
        who: "Operator (demo)",
        when: "2026-11-01",
        until: "2027-11-01",
      },
    ],
    landedInputs: {},
  },
  {
    id: "q_demo_f",
    supplier: "Supplier F (demo)",
    city: "Foshan",
    quoteType: "negotiated_private",
    priceBasis: "unknown",
    basisPlace: null,
    basisConfirmed: false,
    currency: "CNY",
    unit: "pcs",
    moq: 5_000,
    tiers: [{ minQty: 5_000, maxQty: null, unitPrice: 0.19 }],
    fees: [],
    leadTimeDays: 14,
    paymentTerms: "30% deposit",
    validUntil: "2026-12-20",
    confirmedAt: "2026-11-06",
    observedAt: "2026-11-06",
    sourceType: "inbound_email",
    sourceRef: "Email 2026-11-06, operator intake #demo-418 (出厂价, no Incoterm code or place)",
    spec: {
      ...BRIEF_HARD_SPEC,
      core: "76 mm (3 in)",
      windDirection: "Outside wound, #4",
      labelsPerRoll: "500",
    },
    evidence: [],
    landedInputs: {},
  },
];

/** Forwarder email (synthetic) that the buyer can apply as `estimated` freight lines. */
export const DEMO_FREIGHT_ESTIMATE = {
  source: "Forwarder email 2026-11-06 (demo)",
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
  } as Record<string, Partial<Record<LandedLineType, number>>>,
};

export const DEMO_DUTY_ASSUMPTION = {
  ratePct: 0, // the demo deliberately records no duty rate; the line stays "Missing" until a broker-sourced value exists
};

/* ----------------------------------------------------------------------------------------------- */
/* Ops quote review                                                                                  */
/* ----------------------------------------------------------------------------------------------- */

export type Confidence = "high" | "medium" | "low";

export interface ExtractedField {
  key: string;
  label: string;
  value: string | null;
  confidence: Confidence;
  anchor: string | null; // "p.1 · line 14" style reference into the source document
  flag?: string;
}

export interface ReviewTask {
  id: string;
  project: string;
  buyerOrg: string;
  supplier: string;
  document: string;
  receivedAt: string;
  assignedTo: string | null;
  status: "pending" | "in_review";
  fields: ExtractedField[];
  /** Document record behind the task (`demo-data/documents.ts`), when one exists. */
  documentId?: string;
}

export const DEMO_REVIEW_QUEUE: ReviewTask[] = [
  {
    id: "rt_demo_1",
    project: "Folding cartons, 350 gsm C1S, matte",
    buyerOrg: "Demo Buyer Co.",
    supplier: "Supplier F (demo)",
    document: "carton-quote-F.pdf (2 pages)",
    receivedAt: "2026-11-05 14:12",
    assignedTo: "Operator (demo)",
    status: "in_review",
    documentId: "d_quote_f",
    fields: [
      {
        key: "currency",
        label: "Currency",
        value: "CNY",
        confidence: "high",
        anchor: "p.1 · header",
      },
      { key: "unit", label: "Unit", value: "pcs", confidence: "high", anchor: "p.1 · table col 3" },
      {
        key: "priceBasis",
        label: "Price basis (Incoterm)",
        value: null,
        confidence: "low",
        anchor: "p.1 · line 9",
        flag: "出厂价 read as a colloquial term — no Incoterm code or named place. Stored as unknown until the supplier confirms.",
      },
      {
        key: "tier1",
        label: "Tier 1",
        value: "3,000–4,999 @ ¥1.85",
        confidence: "high",
        anchor: "p.1 · table row 1",
      },
      {
        key: "tier2",
        label: "Tier 2",
        value: "5,000–9,999 @ ¥1.62",
        confidence: "high",
        anchor: "p.1 · table row 2",
      },
      {
        key: "tier3",
        label: "Tier 3",
        value: "10,000+ @ ¥1.48",
        confidence: "medium",
        anchor: "p.1 · table row 3",
      },
      {
        key: "tooling",
        label: "Tooling fee",
        value: "¥1,200 one-time",
        confidence: "medium",
        anchor: "p.2 · note 2",
      },
      {
        key: "leadTime",
        label: "Lead time",
        value: "18 days after artwork approval",
        confidence: "high",
        anchor: "p.2 · note 1",
      },
      {
        key: "validUntil",
        label: "Valid until",
        value: null,
        confidence: "low",
        anchor: null,
        flag: "Not in document",
      },
      {
        key: "paymentTerms",
        label: "Payment terms",
        value: "30% deposit, 70% before shipment",
        confidence: "high",
        anchor: "p.2 · note 3",
      },
    ],
  },
  {
    id: "rt_demo_2",
    project: "Folding cartons, 350 gsm C1S, matte",
    buyerOrg: "Demo Buyer Co.",
    supplier: "Supplier G (demo)",
    document: "G-offer-2026-11.xlsx (1 sheet)",
    receivedAt: "2026-11-05 16:40",
    assignedTo: null,
    status: "pending",
    fields: [],
  },
  {
    id: "rt_demo_3",
    project: "Custom BOPP roll labels, 50 × 76 mm",
    buyerOrg: "Demo Buyer Co.",
    supplier: "Supplier H (demo)",
    document: "label-quote-H.pdf (1 page)",
    receivedAt: "2026-11-06 09:05",
    assignedTo: null,
    status: "pending",
    documentId: "d_quote_h",
    fields: LABEL_H_FIELDS,
  },
  {
    id: "rt_demo_4",
    project: "Raw hair bundles, 18–22 in",
    buyerOrg: "Second Demo Buyer LLC",
    supplier: "Supplier J (demo)",
    document: "price-list-J.jpg (photo)",
    receivedAt: "2026-11-06 11:30",
    assignedTo: null,
    status: "pending",
    fields: [],
  },
];
