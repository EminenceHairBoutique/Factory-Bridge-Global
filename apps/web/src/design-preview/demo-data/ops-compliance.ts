/**
 * DEMO DATA — NOT REAL SUPPLIER QUOTATIONS. Synthetic compliance holds for the operations
 * compliance review preview. Holds arise from the blocked-category list (CLAUDE.md §4, master spec
 * §101), export-sensitive machinery, "another category" requests, contact disclosure grant drafts
 * that need compliance approval, and supplier provenance documentation (master spec §289).
 * Buyers only ever see the fixed sentence "Compliance review required" (PRD AC-O5.1); the internal
 * notes and reasons here never reach them.
 */

export const COMPLIANCE_NOW = "2026-11-07T10:00:00Z";

export type HoldKind =
  | "blocked_category"
  | "export_sensitive"
  | "other_category"
  | "disclosure_grant"
  | "supplier_provenance";

export const HOLD_KIND_LABEL: Record<HoldKind, string> = {
  blocked_category: "Blocked category",
  export_sensitive: "Export-sensitive item",
  other_category: "Category outside the pilot",
  disclosure_grant: "Contact disclosure grant",
  supplier_provenance: "Supplier provenance documentation",
};

export type HoldState =
  "open" | "under_review" | "released" | "released_with_conditions" | "declined" | "escalated";

export type Outcome = "released" | "released_with_conditions" | "declined" | "escalated";

export interface HoldNote {
  at: string;
  by: string;
  text: string;
}

export interface HoldDecision {
  outcome: Outcome;
  by: string;
  role: "compliance_reviewer" | "platform_admin";
  at: string;
  reason: string;
  conditions: string[];
  escalateTo: string | null;
}

export interface Hold {
  id: string;
  kind: HoldKind;
  title: string;
  subject: {
    type: "brief" | "supplier" | "grant";
    label: string;
    org: string;
    href: string | null;
  };
  trigger: string;
  policyRef: string;
  createdAt: string;
  dueAt: string;
  assignee: string | null;
  state: HoldState;
  evidence: Array<{ label: string; value: string }>;
  notes: HoldNote[];
  decision: HoldDecision | null;
}

export const DEMO_HOLDS: Hold[] = [
  {
    id: "h_gloves",
    kind: "blocked_category",
    title: "New brief mentions nitrile gloves — blocked category",
    subject: {
      type: "brief",
      label: "Nitrile gloves, powder-free (draft brief v1)",
      org: "Second Demo Buyer LLC",
      href: null,
    },
    trigger:
      "The brief's category mapped to “Medical gloves and devices”, which is on the blocked list; the description also contains “nitrile gloves”.",
    policyRef: "CLAUDE.md §4 blocked categories; master spec §101; PRD AC-O5.1",
    createdAt: "2026-11-07T09:40:00Z",
    dueAt: "2026-11-08T09:40:00Z",
    assignee: null,
    state: "open",
    evidence: [
      { label: "Category chosen", value: "Medical gloves and devices (blocked)" },
      { label: "Matched terms", value: "nitrile gloves; powder-free; examination" },
      { label: "Quantity", value: "50,000 pcs to Houston, TX 77002" },
      {
        label: "Brief excerpt",
        value:
          "“Powder-free nitrile examination gloves, blue, 4 mil, boxes of 100, for a clinic chain.”",
      },
      { label: "Buyer sees", value: "Compliance review required — no quoting until released" },
    ],
    notes: [],
    decision: null,
  },
  {
    id: "h_hplc",
    kind: "export_sensitive",
    title: "Benchtop HPLC system requested for a lab — export-sensitive machinery",
    subject: {
      type: "brief",
      label: "Benchtop HPLC system with autosampler (draft brief v1)",
      org: "Demo Buyer Co.",
      href: null,
    },
    trigger:
      "The brief's description matched “HPLC”, listed under export-sensitive machinery. Classification and licensing questions are outside the pilot's scope.",
    policyRef: "Master spec §101 (HPLC, export-sensitive machinery); §289 trade compliance",
    createdAt: "2026-11-05T14:10:00Z",
    dueAt: "2026-11-06T14:10:00Z",
    assignee: "Compliance (demo)",
    state: "under_review",
    evidence: [
      { label: "Category chosen", value: "Another category (request review)" },
      { label: "Matched terms", value: "HPLC; autosampler; UV detector" },
      { label: "Destination", value: "Newark, NJ 07102" },
      { label: "Buyer sees", value: "Compliance review required — no quoting until released" },
    ],
    notes: [
      {
        at: "2026-11-06 09:20",
        by: "Compliance (demo)",
        text: "Asked the buyer (via operator) for the intended end use and whether a specialist broker is engaged. No answer yet.",
      },
    ],
    decision: null,
  },
  {
    id: "h_grant_b",
    kind: "disclosure_grant",
    title: "Disclosure grant draft: Supplier B contact to Demo Buyer Co.",
    subject: {
      type: "grant",
      label: "Contact disclosure grant (draft) — Supplier B export manager → Demo Buyer Co.",
      org: "Demo Buyer Co.",
      href: "/design-preview/ops/supplier?id=sup_b",
    },
    trigger:
      "Operator (demo) drafted a disclosure grant so the buyer can coordinate sample logistics directly. Grants that expose a supplier contact need compliance approval.",
    policyRef: "Permission matrix §2 contact_disclosure_grants (compliance approval); ADR-030",
    createdAt: "2026-11-06T16:05:00Z",
    dueAt: "2026-11-07T16:05:00Z",
    assignee: null,
    state: "open",
    evidence: [
      { label: "Reason given", value: "Sample shipment coordination for the labels project" },
      { label: "Contact basis", value: "Introduced by partner (recorded 2026-09-28)" },
      { label: "Requested expiry", value: "2026-12-31" },
      { label: "Supplier consent", value: "Portal consent to disclosure recorded 2026-11-06" },
    ],
    notes: [],
    decision: null,
  },
  {
    id: "h_prov_e",
    kind: "supplier_provenance",
    title: "Supplier E facility: provenance documentation not on file",
    subject: {
      type: "supplier",
      label: "Supplier E (demo) — Shenzhen facility",
      org: "Supplier E (demo)",
      href: "/design-preview/ops/supplier?id=sup_e",
    },
    trigger:
      "The supplier reached the capabilities stage without provenance documentation for its facility. Policy requires it before the supplier appears in buyer comparisons for regulated destinations.",
    policyRef: "Master spec §289 (forced labor and provenance documentation); supplier stage gate",
    createdAt: "2026-11-06T11:00:00Z",
    dueAt: "2026-11-07T11:00:00Z",
    assignee: null,
    state: "open",
    evidence: [
      { label: "Stage", value: "Capabilities documented (claimed)" },
      { label: "Missing", value: "Facility provenance statement; labor practices attestation" },
      { label: "On file", value: "Business licence (reviewed), video call held 2026-10-30" },
    ],
    notes: [],
    decision: null,
  },
  {
    id: "h_gummies",
    kind: "blocked_category",
    title: "Vitamin D gummies — ingestible, blocked category",
    subject: {
      type: "brief",
      label: "Vitamin D3 gummies, 60-count (draft brief v1)",
      org: "Second Demo Buyer LLC",
      href: null,
    },
    trigger:
      "The brief's category mapped to “Supplements and ingestibles”, which is on the blocked list.",
    policyRef: "CLAUDE.md §4 blocked categories; master spec §101",
    createdAt: "2026-11-03T15:30:00Z",
    dueAt: "2026-11-04T15:30:00Z",
    assignee: "Compliance (demo)",
    state: "declined",
    evidence: [
      { label: "Category chosen", value: "Supplements and ingestibles (blocked)" },
      { label: "Matched terms", value: "vitamin D3; gummies; dietary supplement" },
    ],
    notes: [
      {
        at: "2026-11-04 10:02",
        by: "Compliance (demo)",
        text: "No category-specific compliance work exists for ingestibles in the pilot. Declined; buyer told the category is not supported.",
      },
    ],
    decision: {
      outcome: "declined",
      by: "Compliance (demo)",
      role: "compliance_reviewer",
      at: "2026-11-04 10:02",
      reason:
        "Ingestibles are outside the pilot and no category-specific compliance work exists; the platform does not sell regulated products by default.",
      conditions: [],
      escalateTo: null,
    },
  },
  {
    id: "h_spatula",
    kind: "other_category",
    title: "Silicone kitchen spatulas — category outside the pilot",
    subject: {
      type: "brief",
      label: "Silicone spatula set, food-contact (draft brief v2)",
      org: "Demo Buyer Co.",
      href: null,
    },
    trigger:
      "The buyer chose “Another category (request review)”. Food-contact items need a documented test basis before samples.",
    policyRef:
      "Master spec §101 (risk-reviewed internal inquiries); §231 quality specification record",
    createdAt: "2026-11-02T10:15:00Z",
    dueAt: "2026-11-03T10:15:00Z",
    assignee: "Compliance (demo)",
    state: "released_with_conditions",
    evidence: [
      { label: "Category chosen", value: "Another category (request review)" },
      { label: "Matched terms", value: "food-contact; silicone; kitchen" },
    ],
    notes: [],
    decision: {
      outcome: "released_with_conditions",
      by: "Compliance (demo)",
      role: "compliance_reviewer",
      at: "2026-11-03 09:10",
      reason:
        "Food-contact silicone is low risk for a sourcing inquiry; the test basis must be documented before any sample or order.",
      conditions: [
        "Supplier provides an FDA 21 CFR 177.2600 (or LFGB) test report for the exact material before a sample is requested.",
        "The quality specification record names the test basis and the lab.",
      ],
      escalateTo: null,
    },
  },
];
