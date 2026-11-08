/**
 * DEMO DATA — NOT REAL. Synthetic operator work queue and pipeline for the internal operations prototypes.
 * Task kinds map to the human-approval gates and review steps in CLAUDE.md §4 and the IA §2.4 queues.
 */

export const QUEUE_NOW = "2026-11-07T10:00:00Z";

export type TaskKind =
  | "extraction_review"
  | "outreach_approval"
  | "clarification_relay"
  | "check_due"
  | "intake_permission"
  | "compliance_hold"
  | "buyer_case"
  | "quote_expiring";

export const KIND_LABEL: Record<TaskKind, string> = {
  extraction_review: "Extraction review",
  outreach_approval: "Outreach approval",
  clarification_relay: "Supplier reply to relay",
  check_due: "Verification check due",
  intake_permission: "Intake needs permission",
  compliance_hold: "Compliance hold",
  buyer_case: "Buyer case",
  quote_expiring: "Quote expiring",
};

/** Target turnaround per kind, in hours from creation (pilot SLA proposal; not a contractual promise). */
export const SLA_HOURS: Record<TaskKind, number> = {
  extraction_review: 24,
  outreach_approval: 8,
  clarification_relay: 8,
  check_due: 72,
  intake_permission: 48,
  compliance_hold: 24,
  buyer_case: 24,
  quote_expiring: 120,
};

export type Assignee = "me" | "other" | "unassigned";

export interface QueueTask {
  id: string;
  kind: TaskKind;
  title: string;
  project: { id: string; name: string; buyerOrg: string } | null;
  supplier: { id: string; name: string } | null;
  assignee: Assignee;
  assigneeName: string | null;
  createdAt: string;
  dueAt: string;
  status: "open" | "in_progress" | "done";
  href?: string | undefined;
  /** Outreach approval payload (buyer already approved). */
  draft?: { en: string; zh: string; buyerApprovedAt: string; channel: string } | undefined;
  note?: string | undefined;
}

export const QUEUE_TASKS: QueueTask[] = [
  {
    id: "t1",
    kind: "outreach_approval",
    title: "Clarification to Supplier B: tooling in EXW price",
    project: {
      id: "prj_demo_labels",
      name: "Custom BOPP roll labels, 50 × 76 mm",
      buyerOrg: "Demo Buyer Co.",
    },
    supplier: { id: "sup_b", name: "Supplier B (demo)" },
    assignee: "me",
    assigneeName: "Operator (demo)",
    createdAt: "2026-11-07T08:30:00Z",
    dueAt: "2026-11-07T16:30:00Z",
    status: "open",
    draft: {
      en: "Is tooling included in the quoted EXW unit price, and does the price hold for 10,000 pcs?",
      zh: "请确认：EXW 单价是否已包含模具费？该价格是否适用于 10,000 件？",
      buyerApprovedAt: "2026-11-07 08:30",
      channel: "Platform message (supplier portal) — WeChat relay only with recorded consent",
    },
  },
  {
    id: "t2",
    kind: "extraction_review",
    title: "label-quote-H.pdf: 10 fields extracted, price basis colloquial",
    project: {
      id: "prj_demo_labels",
      name: "Custom BOPP roll labels, 50 × 76 mm",
      buyerOrg: "Demo Buyer Co.",
    },
    supplier: { id: "sup_h", name: "Supplier H (demo)" },
    assignee: "unassigned",
    assigneeName: null,
    createdAt: "2026-11-06T09:05:00Z",
    dueAt: "2026-11-07T09:05:00Z",
    status: "open",
    href: "/design-preview/ops/quote-review",
  },
  {
    id: "t3",
    kind: "extraction_review",
    title: "carton-quote-F.pdf: in review, basis unknown",
    project: {
      id: "prj_demo_cartons",
      name: "Folding cartons, 350 gsm C1S, matte",
      buyerOrg: "Demo Buyer Co.",
    },
    supplier: { id: "sup_f", name: "Supplier F (demo)" },
    assignee: "me",
    assigneeName: "Operator (demo)",
    createdAt: "2026-11-05T14:12:00Z",
    dueAt: "2026-11-06T14:12:00Z",
    status: "in_progress",
    href: "/design-preview/ops/quote-review",
  },
  {
    id: "t4",
    kind: "clarification_relay",
    title: "Supplier A confirmed MOQ 5,000 and tooling ¥300 one-time",
    project: {
      id: "prj_demo_labels",
      name: "Custom BOPP roll labels, 50 × 76 mm",
      buyerOrg: "Demo Buyer Co.",
    },
    supplier: { id: "sup_a", name: "Supplier A (demo)" },
    assignee: "me",
    assigneeName: "Operator (demo)",
    createdAt: "2026-11-07T07:10:00Z",
    dueAt: "2026-11-07T15:10:00Z",
    status: "open",
    note: "Reply received via portal 2026-11-07 07:10; creates quotation A v2 once relayed.",
  },
  {
    id: "t5",
    kind: "check_due",
    title: "Supplier B: address corroboration expires 2026-11-15",
    project: null,
    supplier: { id: "sup_b", name: "Supplier B (demo)" },
    assignee: "unassigned",
    assigneeName: null,
    createdAt: "2026-11-05T00:00:00Z",
    dueAt: "2026-11-14T00:00:00Z",
    status: "open",
    href: "/design-preview/ops/supplier?id=sup_b",
  },
  {
    id: "t6",
    kind: "intake_permission",
    title: "catalog-E-2026Q4.xlsx imported without a source permission",
    project: null,
    supplier: { id: "sup_e", name: "Supplier E (demo)" },
    assignee: "other",
    assigneeName: "Operator 2 (demo)",
    createdAt: "2026-11-06T10:30:00Z",
    dueAt: "2026-11-08T10:30:00Z",
    status: "open",
    href: "/design-preview/ops/supplier?id=sup_e",
    note: "Stays internal only until a permission with evidence is recorded.",
  },
  {
    id: "t7",
    kind: "compliance_hold",
    title: "New brief mentions nitrile gloves — blocked category",
    project: {
      id: "prj_demo_gloves",
      name: "Nitrile gloves, powder-free (draft)",
      buyerOrg: "Second Demo Buyer LLC",
    },
    supplier: null,
    assignee: "unassigned",
    assigneeName: null,
    createdAt: "2026-11-07T09:40:00Z",
    dueAt: "2026-11-08T09:40:00Z",
    status: "open",
    note: "Compliance review required; no self-service quoting. Reviewer: compliance role.",
    href: "/design-preview/ops/compliance?hold=h_gloves",
  },
  {
    id: "t8",
    kind: "buyer_case",
    title: "Second Demo Buyer LLC asks how landed-cost duty assumptions are sourced",
    project: {
      id: "prj_demo_hair",
      name: "Raw hair bundles, 18–22 in, natural black",
      buyerOrg: "Second Demo Buyer LLC",
    },
    supplier: null,
    assignee: "other",
    assigneeName: "Operator 2 (demo)",
    createdAt: "2026-11-06T16:00:00Z",
    dueAt: "2026-11-07T16:00:00Z",
    status: "in_progress",
    href: "/design-preview/ops/cases?case=c_duty",
  },
  {
    id: "t9",
    kind: "quote_expiring",
    title: "Supplier A quote valid until 2026-12-15 — revalidation reminder",
    project: {
      id: "prj_demo_labels",
      name: "Custom BOPP roll labels, 50 × 76 mm",
      buyerOrg: "Demo Buyer Co.",
    },
    supplier: { id: "sup_a", name: "Supplier A (demo)" },
    assignee: "me",
    assigneeName: "Operator (demo)",
    createdAt: "2026-11-07T06:00:00Z",
    dueAt: "2026-12-08T00:00:00Z",
    status: "open",
    href: "/design-preview/buyer/compare",
  },
];

export type PipelineStage =
  | "brief_draft"
  | "brief_confirmed"
  | "options_in_progress"
  | "quotes_in_review"
  | "comparison_ready"
  | "sample_requested"
  | "handoff_pending";

export const PIPELINE_STAGES: Array<{
  key: PipelineStage;
  label: string;
  slaDays: number | null;
  slaNote: string;
}> = [
  {
    key: "brief_draft",
    label: "Brief draft",
    slaDays: null,
    slaNote: "Buyer's clock; nudge after 7 days",
  },
  {
    key: "brief_confirmed",
    label: "Brief confirmed",
    slaDays: 2,
    slaNote: "Assign operator and start options within 2 days",
  },
  {
    key: "options_in_progress",
    label: "Finding options",
    slaDays: 5,
    slaNote: "Options and approved RFQs within 5 days",
  },
  {
    key: "quotes_in_review",
    label: "Quotes in review",
    slaDays: 1,
    slaNote: "Each extraction reviewed within 24 h",
  },
  {
    key: "comparison_ready",
    label: "Comparison ready",
    slaDays: null,
    slaNote: "Buyer's decision; remind weekly",
  },
  {
    key: "sample_requested",
    label: "Sample requested",
    slaDays: 10,
    slaNote: "Sample in transit; chase after 10 days",
  },
  {
    key: "handoff_pending",
    label: "Awaiting approval",
    slaDays: null,
    slaNote: "Buyer's written approval",
  },
];

export interface PipelineProject {
  id: string;
  name: string;
  buyerOrg: string;
  operator: string | null;
  stage: PipelineStage;
  enteredStageAt: string;
  openTasks: number;
}

export const PIPELINE_PROJECTS: PipelineProject[] = [
  {
    id: "prj_demo_labels",
    name: "Custom BOPP roll labels, 50 × 76 mm",
    buyerOrg: "Demo Buyer Co.",
    operator: "Operator (demo)",
    stage: "comparison_ready",
    enteredStageAt: "2026-11-06",
    openTasks: 4,
  },
  {
    id: "prj_demo_cartons",
    name: "Folding cartons, 350 gsm C1S, matte",
    buyerOrg: "Demo Buyer Co.",
    operator: "Operator (demo)",
    stage: "quotes_in_review",
    enteredStageAt: "2026-11-05",
    openTasks: 1,
  },
  {
    id: "prj_demo_hair",
    name: "Raw hair bundles, 18–22 in, natural black",
    buyerOrg: "Second Demo Buyer LLC",
    operator: "Operator 2 (demo)",
    stage: "brief_confirmed",
    enteredStageAt: "2026-11-03",
    openTasks: 1,
  },
  {
    id: "prj_demo_sleeves",
    name: "Kraft paper sleeves, printed 1-color",
    buyerOrg: "Demo Buyer Co.",
    operator: null,
    stage: "brief_draft",
    enteredStageAt: "2026-11-01",
    openTasks: 0,
  },
  {
    id: "prj_demo_gloves",
    name: "Nitrile gloves, powder-free (draft)",
    buyerOrg: "Second Demo Buyer LLC",
    operator: null,
    stage: "brief_draft",
    enteredStageAt: "2026-11-07",
    openTasks: 1,
  },
  {
    id: "prj_demo_tea",
    name: "Tea tin labels, 60 × 90 mm",
    buyerOrg: "Second Demo Buyer LLC",
    operator: "Operator 2 (demo)",
    stage: "options_in_progress",
    enteredStageAt: "2026-10-30",
    openTasks: 0,
  },
  {
    id: "prj_demo_mailers",
    name: "Mailer boxes, E-flute, 2-color",
    buyerOrg: "Demo Buyer Co.",
    operator: "Operator (demo)",
    stage: "sample_requested",
    enteredStageAt: "2026-10-25",
    openTasks: 0,
  },
];
