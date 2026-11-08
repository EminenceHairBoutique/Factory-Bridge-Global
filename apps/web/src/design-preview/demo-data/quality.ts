/**
 * DEMO DATA — NOT REAL SUPPLIER QUOTATIONS. Synthetic quality checkpoints for the operations
 * Quality Verification preview, shaped after docs/QUALITY_ASSURANCE.md §3–§7 and the Phase 3 tables
 * in docs/SCHEMA_PLAN.md §2.9 (quality_spec_records, samples, golden_sample_agreements, lots,
 * inspection_jobs, inspection_results, defect_findings, remediation_cases). No inspection partner is
 * contracted; inspector names here are placeholders. Sampling numbers are illustrative.
 */

export const QUALITY_TODAY = "2026-11-07";

export type InspectionType =
  | "sample_evaluation"
  | "pre_production"
  | "during_production"
  | "pre_shipment"
  | "container_loading";
export const INSPECTION_TYPE_LABEL: Record<InspectionType, string> = {
  sample_evaluation: "Sample evaluation",
  pre_production: "Pre-production",
  during_production: "During production",
  pre_shipment: "Pre-shipment",
  container_loading: "Container loading",
};

export type InspectionResultCode = "pass" | "fail" | "pass_with_rework" | "pending";
export type DefectClass = "critical" | "major" | "minor";

export interface SamplingPlan {
  standard: "ISO 2859-1";
  level: "II";
  aqlCritical: number;
  aqlMajor: number;
  aqlMinor: number;
}

export interface QualitySpecRecord {
  id: string;
  family: string;
  specificationId: string;
  version: number;
  approvedByBuyerAt: string | null;
  criticalDimensions: string[];
  tests: string[];
  defectClasses: Record<DefectClass, string[]>;
  samplingPlan: SamplingPlan;
}

export const QSRS: QualitySpecRecord[] = [
  {
    id: "qsr_labels_v3",
    family: "Labels",
    specificationId: "spec_labels_brief_v2",
    version: 3,
    approvedByBuyerAt: "2026-10-20",
    criticalDimensions: [
      "Face stock BOPP white, 60 µm",
      "Adhesive permanent acrylic",
      "Finished size 50 × 76 mm ±0.5 mm",
      "Registration ±0.3 mm",
      "Core 76 mm, 500 labels per roll, unwind 3",
      "Colors CMYK + Pantone 2945 C (ΔE ≤ 2 if spectro available)",
    ],
    tests: [
      "Adhesion on buyer's container (5 supplied)",
      "Rub test",
      "Condensation test (cold chain)",
    ],
    defectClasses: {
      critical: ["Wrong artwork or text", "Missing regulatory text"],
      major: ["Color outside tolerance", "Misregistration", "Lifting edges", "Wrong unwind"],
      minor: ["Small specks outside the live area"],
    },
    samplingPlan: {
      standard: "ISO 2859-1",
      level: "II",
      aqlCritical: 0,
      aqlMajor: 2.5,
      aqlMinor: 4.0,
    },
  },
  {
    id: "qsr_cartons_v1",
    family: "Folding cartons",
    specificationId: "spec_cartons_brief_v1",
    version: 1,
    approvedByBuyerAt: null,
    criticalDimensions: [
      "Board SBS 350 gsm ±5 %",
      "Dieline v2 match",
      "Finished dimensions ±1 mm",
      "Barcode scan grade B or better",
    ],
    tests: [
      "Fold and crease crack test",
      "Scuff test",
      "Barcode scan",
      "Assembly fit with buyer's product sample",
    ],
    defectClasses: {
      critical: ["Wrong dieline", "Unreadable barcode"],
      major: ["Cracking on folds", "Color shift", "Glue failure"],
      minor: ["Minor scuffs on non-face panels"],
    },
    samplingPlan: {
      standard: "ISO 2859-1",
      level: "II",
      aqlCritical: 0,
      aqlMajor: 2.5,
      aqlMinor: 4.0,
    },
  },
];

export type SampleKind = "pre_production" | "golden" | "counter";
export const SAMPLE_KIND_LABEL: Record<SampleKind, string> = {
  pre_production: "Pre-production sample",
  golden: "Golden sample",
  counter: "Counter-sample",
};

export interface SampleRecord {
  id: string;
  trackId: string;
  kind: SampleKind;
  requestedAt: string;
  receivedAt: string | null;
  evaluatedBy: string | null;
  result: "pass" | "fail" | "pending";
  evidenceDocuments: string[];
  note: string;
}

export interface GoldenSampleAgreement {
  id: string;
  sampleId: string;
  buyerSignoffBy: string;
  buyerSignoffAt: string;
  supplierAckAt: string | null;
  documentId: string;
  retainedWhere: string;
}

export interface Lot {
  id: string;
  trackId: string;
  lotCode: string;
  quantity: number;
  producedFrom: string;
  producedTo: string | null;
}

export interface Milestone {
  key: "materials_ready" | "production_start" | "percent_complete" | "packed";
  label: string;
  date: string | null;
  dateKind: "estimated" | "committed" | "reported";
  value?: string;
}

export interface DefectFinding {
  id: string;
  class: DefectClass;
  description: string;
  count: number;
  photoDocumentId: string | null;
}

export interface InspectionResult {
  result: InspectionResultCode;
  sampleSize: number;
  lotSize: number;
  foundCritical: number;
  foundMajor: number;
  foundMinor: number;
  reportDocumentId: string | null;
  inspectorName: string;
  at: string;
  findings: DefectFinding[];
}

export interface InspectionJob {
  id: string;
  trackId: string;
  lotId: string | null;
  type: InspectionType;
  inspectorOrg: string;
  scheduledFor: string;
  checklistVersion: number;
  status: "scheduled" | "in_progress" | "done" | "cancelled";
  result: InspectionResult | null;
}

export type Responsibility =
  "factory" | "fbg_service_error" | "carrier" | "buyer_spec_change" | "undetermined";
export const RESPONSIBILITY_LABEL: Record<Responsibility, string> = {
  factory: "Factory",
  fbg_service_error: "Factory Bridge service error",
  carrier: "Carrier",
  buyer_spec_change: "Buyer specification change",
  undetermined: "Undetermined",
};
export type Resolution =
  | "rework"
  | "replacement"
  | "partial_refund"
  | "full_refund"
  | "credit"
  | "accepted_as_is"
  | "escalated";
export const RESOLUTION_LABEL: Record<Resolution, string> = {
  rework: "Rework",
  replacement: "Replacement",
  partial_refund: "Partial refund",
  full_refund: "Full refund",
  credit: "Credit",
  accepted_as_is: "Accepted as is",
  escalated: "Escalated",
};
export type BuyerDecision = "accept" | "rework" | "reject" | "partial";
export const BUYER_DECISION_LABEL: Record<BuyerDecision, string> = {
  accept: "Accept the lot",
  rework: "Rework and re-inspect",
  reject: "Reject the lot",
  partial: "Partial acceptance",
};

export interface RemediationCase {
  id: string;
  trackId: string;
  source: "inspection" | "receipt" | "buyer";
  responsibility: Responsibility;
  status: "open" | "awaiting_buyer" | "in_remedy" | "closed";
  resolution: Resolution | null;
  buyerDecision: BuyerDecision | null;
  buyerDecisionRef: string | null;
  openedAt: string;
  closedAt: string | null;
  notes: string[];
}

/** One checkpoint track per project × supplier × variant (QA doc §4 workflow). */
export interface QualityTrack {
  id: string;
  project: { id: string; name: string; buyerOrg: string; href: string };
  supplier: { id: string; name: string; href: string };
  variant: string;
  qsrId: string;
  milestones: Milestone[];
  assignee: string | null;
}

export const QUALITY_TRACKS: QualityTrack[] = [
  {
    id: "qt_labels_a",
    project: {
      id: "prj_demo_labels",
      name: "Custom BOPP roll labels",
      buyerOrg: "Demo Buyer Co.",
      href: "/design-preview/buyer/project",
    },
    supplier: {
      id: "sup_a",
      name: "Supplier A (demo)",
      href: "/design-preview/ops/supplier?id=sup_a",
    },
    variant: "50 × 76 mm matte BOPP, Pantone 2945 C",
    qsrId: "qsr_labels_v3",
    milestones: [
      {
        key: "materials_ready",
        label: "Materials ready",
        date: "2026-11-01",
        dateKind: "reported",
      },
      {
        key: "production_start",
        label: "Production start",
        date: "2026-11-03",
        dateKind: "reported",
      },
      {
        key: "percent_complete",
        label: "Progress",
        date: "2026-11-06",
        dateKind: "reported",
        value: "70 % (supplier-reported)",
      },
      { key: "packed", label: "Packed", date: "2026-11-11", dateKind: "estimated" },
    ],
    assignee: "Operator (demo)",
  },
  {
    id: "qt_labels_b",
    project: {
      id: "prj_demo_labels",
      name: "Custom BOPP roll labels",
      buyerOrg: "Demo Buyer Co.",
      href: "/design-preview/buyer/project",
    },
    supplier: {
      id: "sup_b",
      name: "Supplier B (demo)",
      href: "/design-preview/ops/supplier?id=sup_b",
    },
    variant: "50 × 76 mm matte BOPP, Pantone 2945 C (trial lot)",
    qsrId: "qsr_labels_v3",
    milestones: [
      {
        key: "materials_ready",
        label: "Materials ready",
        date: "2026-10-20",
        dateKind: "reported",
      },
      {
        key: "production_start",
        label: "Production start",
        date: "2026-10-22",
        dateKind: "reported",
      },
      {
        key: "percent_complete",
        label: "Progress",
        date: "2026-10-30",
        dateKind: "reported",
        value: "100 %",
      },
      { key: "packed", label: "Packed", date: "2026-11-02", dateKind: "committed" },
    ],
    assignee: "Operator (demo)",
  },
  {
    id: "qt_cartons_e",
    project: {
      id: "prj_demo_cartons",
      name: "Printed folding cartons",
      buyerOrg: "Second Demo Buyer LLC",
      href: "/design-preview/buyer/project",
    },
    supplier: {
      id: "sup_e",
      name: "Supplier E (demo)",
      href: "/design-preview/ops/supplier?id=sup_e",
    },
    variant: "Tuck-end carton 120 × 60 × 40 mm, SBS 350 gsm",
    qsrId: "qsr_cartons_v1",
    milestones: [],
    assignee: null,
  },
];

export const SAMPLES: SampleRecord[] = [
  {
    id: "smp_a_pre",
    trackId: "qt_labels_a",
    kind: "pre_production",
    requestedAt: "2026-10-21",
    receivedAt: "2026-10-27",
    evaluatedBy: "Operator (demo)",
    result: "pass",
    evidenceDocuments: ["sample-photos-2026-10-27/ (12 photos)", "measurements-2026-10-27.csv"],
    note: "Size, registration and unwind within QSR v3; color ΔE 1.4 against Pantone 2945 C.",
  },
  {
    id: "smp_a_golden",
    trackId: "qt_labels_a",
    kind: "golden",
    requestedAt: "2026-10-27",
    receivedAt: "2026-10-27",
    evaluatedBy: "Demo Buyer Co.",
    result: "pass",
    evidenceDocuments: ["golden-sample-agreement-2026-10-28.pdf"],
    note: "Approved by the buyer on 2026-10-28; sealed sample retained.",
  },
  {
    id: "smp_b_pre",
    trackId: "qt_labels_b",
    kind: "pre_production",
    requestedAt: "2026-10-10",
    receivedAt: "2026-10-16",
    evaluatedBy: "Operator (demo)",
    result: "fail",
    evidenceDocuments: ["sample-photos-2026-10-16/ (8 photos)"],
    note: "Unwind direction 2 instead of 3; adhesive lifted at the edge on the buyer's container.",
  },
  {
    id: "smp_b_counter",
    trackId: "qt_labels_b",
    kind: "counter",
    requestedAt: "2026-10-16",
    receivedAt: "2026-10-19",
    evaluatedBy: "Operator (demo)",
    result: "pass",
    evidenceDocuments: ["sample-photos-2026-10-19/ (10 photos)", "adhesion-test-2026-10-19.csv"],
    note: "Counter-sample within QSR v3; buyer approved the trial lot on this basis.",
  },
  {
    id: "smp_e_pre",
    trackId: "qt_cartons_e",
    kind: "pre_production",
    requestedAt: "2026-11-04",
    receivedAt: null,
    evaluatedBy: null,
    result: "pending",
    evidenceDocuments: [],
    note: "Requested after the buyer's approval; not received yet. The QSR is still unapproved by the buyer.",
  },
];

export const GOLDEN_AGREEMENTS: GoldenSampleAgreement[] = [
  {
    id: "gsa_a",
    sampleId: "smp_a_golden",
    buyerSignoffBy: "Demo Buyer Co.",
    buyerSignoffAt: "2026-10-28",
    supplierAckAt: "2026-10-29",
    documentId: "golden-sample-agreement-2026-10-28.pdf",
    retainedWhere: "Factory Bridge office, sealed bag GS-A-001; photos on file",
  },
];

export const LOTS: Lot[] = [
  {
    id: "lot_a_0007",
    trackId: "qt_labels_a",
    lotCode: "L-0007",
    quantity: 10_000,
    producedFrom: "2026-11-03",
    producedTo: null,
  },
  {
    id: "lot_b_0003",
    trackId: "qt_labels_b",
    lotCode: "L-0003",
    quantity: 3_000,
    producedFrom: "2026-10-22",
    producedTo: "2026-10-30",
  },
];

export const INSPECTION_JOBS: InspectionJob[] = [
  {
    id: "ij_a_dp",
    trackId: "qt_labels_a",
    lotId: "lot_a_0007",
    type: "during_production",
    inspectorOrg: "Factory Bridge staff (demo)",
    scheduledFor: "2026-11-05",
    checklistVersion: 3,
    status: "done",
    result: {
      result: "pass",
      sampleSize: 80,
      lotSize: 10_000,
      foundCritical: 0,
      foundMajor: 1,
      foundMinor: 2,
      reportDocumentId: "dp-report-2026-11-05.pdf",
      inspectorName: "Operator (demo)",
      at: "2026-11-05",
      findings: [
        {
          id: "df_a1",
          class: "major",
          description: "Misregistration 0.4 mm on one roll (outside ±0.3 mm); roll set aside",
          count: 1,
          photoDocumentId: "dp-photo-07.jpg",
        },
        {
          id: "df_a2",
          class: "minor",
          description: "Specks outside the live area",
          count: 2,
          photoDocumentId: null,
        },
      ],
    },
  },
  {
    id: "ij_a_psi",
    trackId: "qt_labels_a",
    lotId: "lot_a_0007",
    type: "pre_shipment",
    inspectorOrg: "Third-party inspector (not contracted; placeholder)",
    scheduledFor: "2026-11-12",
    checklistVersion: 3,
    status: "scheduled",
    result: null,
  },
  {
    id: "ij_b_psi",
    trackId: "qt_labels_b",
    lotId: "lot_b_0003",
    type: "pre_shipment",
    inspectorOrg: "Factory Bridge staff (demo)",
    scheduledFor: "2026-11-03",
    checklistVersion: 3,
    status: "done",
    result: {
      result: "fail",
      sampleSize: 125,
      lotSize: 3_000,
      foundCritical: 0,
      foundMajor: 9,
      foundMinor: 4,
      reportDocumentId: "psi-report-L-0003-2026-11-03.pdf",
      inspectorName: "Operator (demo)",
      at: "2026-11-03",
      findings: [
        {
          id: "df_b1",
          class: "major",
          description: "Lifting edges after 24 h on the buyer's container",
          count: 6,
          photoDocumentId: "psi-photo-02.jpg",
        },
        {
          id: "df_b2",
          class: "major",
          description: "Color outside tolerance (ΔE 3.1) on two rolls",
          count: 3,
          photoDocumentId: "psi-photo-05.jpg",
        },
        {
          id: "df_b3",
          class: "minor",
          description: "Specks outside the live area",
          count: 4,
          photoDocumentId: null,
        },
      ],
    },
  },
];

export const REMEDIATION_CASES: RemediationCase[] = [
  {
    id: "rc_b",
    trackId: "qt_labels_b",
    source: "inspection",
    responsibility: "undetermined",
    status: "awaiting_buyer",
    resolution: null,
    buyerDecision: null,
    buyerDecisionRef: null,
    openedAt: "2026-11-03",
    closedAt: null,
    notes: [
      "2026-11-03 Operator (demo): shipment release not recommended; findings and photos sent to the buyer with the four options.",
      "2026-11-05 Operator (demo): supplier proposes re-lamination of the affected rolls within 5 days; responsibility still undetermined (adhesive lot vs container surface).",
    ],
  },
];
