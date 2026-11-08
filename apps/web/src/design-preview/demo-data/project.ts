/**
 * DEMO DATA — NOT REAL SUPPLIER QUOTATIONS. Synthetic project record for the labels demo project
 * (`prj_demo_labels`): status timeline, documents, message threads with approval chains, reports and an
 * audit-derived activity feed. Shapes mirror docs/SCHEMA_PLAN.md vocabulary (document_status, review_status,
 * acting_as) so the screen exercises the real terms.
 */
import type { DocumentStatus } from "@fbg/domain";

export const PROJECT_ID = "prj_demo_labels";

export interface TimelineStage {
  key: string;
  label: string;
  at: string | null;
  by: string | null;
  detail: string;
  state: "done" | "current" | "pending";
}

export const PROJECT_TIMELINE: TimelineStage[] = [
  {
    key: "brief_draft",
    label: "Brief created",
    at: "2026-11-03 10:15",
    by: "Demo Buyer",
    detail: "Raw input stored as v1 with one attachment.",
    state: "done",
  },
  {
    key: "brief_confirmed",
    label: "Brief confirmed (v3)",
    at: "2026-11-04 09:40",
    by: "Demo Buyer",
    detail:
      "AI proposal v2 reviewed; 2 inferred values accepted, 1 edited. Hard attributes locked.",
    state: "done",
  },
  {
    key: "options_in_progress",
    label: "Supplier options identified",
    at: "2026-11-04 16:05",
    by: "Operator (demo)",
    detail:
      "6 suppliers from authorized catalog and direct contact; outbound RFQ approved by you on 2026-11-04.",
    state: "done",
  },
  {
    key: "quotes_in_review",
    label: "Quotes received and reviewed",
    at: "2026-11-06 11:20",
    by: "Operator (demo)",
    detail: "5 quotations confirmed from documents; 1 still in extraction review (Supplier H).",
    state: "done",
  },
  {
    key: "comparison_ready",
    label: "Comparison ready",
    at: "2026-11-06 11:30",
    by: "System",
    detail: "Groups by trade term; cross-group ranking needs freight and duty inputs.",
    state: "current",
  },
  {
    key: "sample_requested",
    label: "Sample requested",
    at: null,
    by: null,
    detail: "After you shortlist, a sample request goes out only with your approval.",
    state: "pending",
  },
  {
    key: "handoff_pending",
    label: "Order handoff",
    at: null,
    by: null,
    detail: "Supplier selection and purchase handoff require your written approval.",
    state: "pending",
  },
];

export interface ProjectDocument {
  id: string;
  name: string;
  kind: "quote" | "artwork" | "logistics" | "report";
  source: "buyer_upload" | "operator_import" | "inbound_email" | "supplier_portal" | "generated";
  owner: string;
  uploadedAt: string;
  status: DocumentStatus;
  version: string;
  linked?: string | undefined;
}

export const PROJECT_DOCUMENTS: ProjectDocument[] = [
  {
    id: "doc_1",
    name: "quote-A-2026-11.pdf",
    kind: "quote",
    source: "buyer_upload",
    owner: "Demo Buyer",
    uploadedAt: "2026-11-03",
    status: "accepted",
    version: "v1",
    linked: "Quotation A v1 (confirmed 2026-11-04)",
  },
  {
    id: "doc_2",
    name: "quote-D-2026-10.pdf",
    kind: "quote",
    source: "buyer_upload",
    owner: "Demo Buyer",
    uploadedAt: "2026-10-09",
    status: "accepted",
    version: "v1",
    linked: "Quotation D v1 (expired 2026-10-31)",
  },
  {
    id: "doc_3",
    name: "artwork-lavender-v2.pdf",
    kind: "artwork",
    source: "buyer_upload",
    owner: "Demo Buyer",
    uploadedAt: "2026-11-03",
    status: "parsed",
    version: "v2",
    linked: "Attached to RFQ",
  },
  {
    id: "doc_4",
    name: "label-quote-H.pdf",
    kind: "quote",
    source: "operator_import",
    owner: "Operator (demo)",
    uploadedAt: "2026-11-06",
    status: "in_review",
    version: "v1",
    linked: "Extraction review pending",
  },
  {
    id: "doc_5",
    name: "forwarder-email-2026-11-06.eml",
    kind: "logistics",
    source: "inbound_email",
    owner: "Operator (demo)",
    uploadedAt: "2026-11-06",
    status: "extracted",
    version: "v1",
    linked: "Freight estimate (estimated lines)",
  },
  {
    id: "doc_6",
    name: "comparison-report-v1.pdf",
    kind: "report",
    source: "generated",
    owner: "System",
    uploadedAt: "2026-11-06",
    status: "accepted",
    version: "v1",
    linked: "Report v1",
  },
];

export const DOCUMENT_STATUS_LABEL: Record<DocumentStatus, string> = {
  uploaded: "Uploaded",
  scanning: "Scanning",
  rejected: "Rejected",
  parsed: "Parsed",
  extracted: "Extracted",
  in_review: "In review",
  accepted: "Accepted",
  discarded: "Discarded",
};

export type ApprovalStep = {
  who: string;
  state: "done" | "waiting" | "pending";
  at?: string | undefined;
};

export interface MessageThread {
  id: string;
  subject: string;
  counterpart: string;
  kind: "clarification" | "notice" | "sample";
  updatedAt: string;
  status: "awaiting_your_approval" | "awaiting_operator_approval" | "sent" | "replied" | "info";
  chain: ApprovalStep[];
  preview: string;
  previewZh?: string | undefined;
}

export const PROJECT_MESSAGES: MessageThread[] = [
  {
    id: "msg_1",
    subject: "Is tooling included in the EXW unit price?",
    counterpart: "Supplier B (demo)",
    kind: "clarification",
    updatedAt: "2026-11-06",
    status: "awaiting_your_approval",
    chain: [
      { who: "You", state: "waiting" },
      { who: "Operator (demo)", state: "pending" },
      { who: "Sent via platform", state: "pending" },
    ],
    preview:
      "Is tooling included in the quoted EXW unit price, and does the price hold for 10,000 pcs?",
    previewZh: "请确认：EXW 单价是否已包含模具费？该价格是否适用于 10,000 件？",
  },
  {
    id: "msg_2",
    subject: "Golden sample approved for 50 × 76 mm matte BOPP",
    counterpart: "Supplier A (demo)",
    kind: "sample",
    updatedAt: "2026-10-28",
    status: "replied",
    chain: [
      { who: "You", state: "done", at: "2026-10-28" },
      { who: "Operator (demo)", state: "done", at: "2026-10-28" },
      { who: "Sent via platform", state: "done", at: "2026-10-28" },
    ],
    preview:
      "Sample approved by Demo Buyer Co.; check record created (Sample approved for variant).",
  },
  {
    id: "msg_3",
    subject: "Quote from Supplier D expired on 2026-10-31",
    counterpart: "System",
    kind: "notice",
    updatedAt: "2026-10-31",
    status: "info",
    chain: [],
    preview:
      "Expired quotes are excluded from ranking. Ask for revalidation if you still want this supplier in the comparison.",
  },
];

export interface ProjectReport {
  id: string;
  name: string;
  generatedAt: string;
  briefVersion: number;
  fxDate: string;
  quotesIncluded: number;
  assumptions: string[];
  exclusions: string[];
  status: "ready" | "stale";
}

export const PROJECT_REPORTS: ProjectReport[] = [
  {
    id: "rep_1",
    name: "fbg-comparison-prj_demo_labels-v3-2026-11-06.pdf",
    generatedAt: "2026-11-06 11:32",
    briefVersion: 3,
    fxDate: "2026-11-06",
    quotesIncluded: 2,
    assumptions: [
      "FX 7.20 CNY/USD (demo reference rate, 2026-11-06)",
      "No freight or duty inputs: landed totals partial",
    ],
    exclusions: [
      "Supplier C: specification differs (material)",
      "Supplier D: expired 2026-10-31",
      "Supplier E: below MOQ (20,000)",
      "Supplier F: price basis not stated",
    ],
    status: "stale",
  },
];

export interface ActivityEvent {
  id: string;
  at: string;
  actor: string;
  actingAs: "user" | "operator" | "system" | "platform_admin";
  action: string;
  entity: string;
}

export const PROJECT_ACTIVITY: ActivityEvent[] = [
  {
    id: "a1",
    at: "2026-11-06 11:32",
    actor: "System",
    actingAs: "system",
    action: "Generated comparison report v1",
    entity: "report rep_1",
  },
  {
    id: "a2",
    at: "2026-11-06 11:30",
    actor: "System",
    actingAs: "system",
    action: "Comparison snapshot created (brief v3, FX 2026-11-06)",
    entity: "comparison snapshot",
  },
  {
    id: "a3",
    at: "2026-11-06 11:20",
    actor: "Operator (demo)",
    actingAs: "operator",
    action: "Confirmed quotation E v1 from portal submission",
    entity: "quotation q_demo_e",
  },
  {
    id: "a4",
    at: "2026-11-06 09:05",
    actor: "Operator (demo)",
    actingAs: "operator",
    action: "Imported label-quote-H.pdf; extraction queued",
    entity: "document doc_4",
  },
  {
    id: "a5",
    at: "2026-11-05 15:10",
    actor: "Operator (demo)",
    actingAs: "operator",
    action: "Confirmed quotation B v1 from email intake",
    entity: "quotation q_demo_b",
  },
  {
    id: "a6",
    at: "2026-11-05 15:12",
    actor: "Operator (demo)",
    actingAs: "operator",
    action: "Drafted clarification to Supplier B (awaiting buyer approval)",
    entity: "message msg_1",
  },
  {
    id: "a7",
    at: "2026-11-04 16:05",
    actor: "Demo Buyer",
    actingAs: "user",
    action: "Approved outbound RFQ to 6 suppliers",
    entity: "rfq batch",
  },
  {
    id: "a8",
    at: "2026-11-04 09:40",
    actor: "Demo Buyer",
    actingAs: "user",
    action: "Confirmed brief v3",
    entity: "brief v3",
  },
  {
    id: "a9",
    at: "2026-11-03 10:16",
    actor: "System",
    actingAs: "system",
    action: "AI proposal v2 created (brief_normalizer v1.0.0)",
    entity: "brief v2",
  },
  {
    id: "a10",
    at: "2026-11-03 10:15",
    actor: "Demo Buyer",
    actingAs: "user",
    action: "Created project and brief v1",
    entity: "project",
  },
];

export const PROJECT_BRIEF_SUMMARY = {
  version: 3,
  confirmedAt: "2026-11-04 09:40",
  hard: [
    ["Material", "BOPP (white)", "面材：BOPP（白色）"],
    ["Size", "50 × 76 mm", "尺寸：50 × 76 mm"],
    ["Print", "4-color", "印刷：四色"],
    ["Finish", "Matte lamination", "表面处理：哑膜"],
    ["Adhesive", "Permanent", "胶水：永久胶"],
  ],
  soft: [
    ["Core", "76 mm (3 in)", "卷芯：76 mm"],
    ["Wind direction", "Outside wound, #4", "卷向：外卷 #4"],
    ["Labels per roll", "500", "每卷标签数：500"],
  ],
  terms: [
    ["Quantity", "10,000 pcs"],
    ["Destination", "Newark, NJ 07102"],
    ["Target trade term", "FOB if possible"],
    ["Sample approval", "Required before production"],
    ["Compliance", "None specified"],
  ],
};
