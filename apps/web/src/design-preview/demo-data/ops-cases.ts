/**
 * DEMO DATA — NOT REAL SUPPLIER QUOTATIONS. Synthetic buyer cases for the operations Buyer Cases
 * module (IA §2.4 `/ops/cases`; master spec §6.8 customer communications: support inbox,
 * source-linked updates, clarification tasks). A case is a buyer's question, data issue, request
 * or complaint, with every update linked to the record it concerns. Turnaround targets are pilot
 * targets, never promised to buyers (master spec "Speed" row).
 */

export const CASES_NOW = "2026-11-07T10:00:00Z";

export type CaseCategory = "question" | "data_issue" | "request" | "complaint";
export const CATEGORY_LABEL: Record<CaseCategory, string> = {
  question: "Question",
  data_issue: "Data issue",
  request: "Request",
  complaint: "Complaint",
};

/** Pilot turnaround targets in hours from opening; internal only. */
export const CASE_TARGET_HOURS: Record<CaseCategory, number> = {
  question: 24,
  data_issue: 24,
  request: 48,
  complaint: 8,
};

export type CaseSource = "platform_message" | "email" | "call";
export const SOURCE_LABEL: Record<CaseSource, string> = {
  platform_message: "Platform message",
  email: "Email",
  call: "Phone call (operator note)",
};

export type CaseStatus = "open" | "awaiting_buyer" | "resolved";

export type ResolutionCode =
  "answered" | "data_corrected" | "fulfilled" | "no_action" | "duplicate";
export const RESOLUTION_LABEL: Record<ResolutionCode, string> = {
  answered: "Answered",
  data_corrected: "Data corrected",
  fulfilled: "Request fulfilled",
  no_action: "No action needed",
  duplicate: "Duplicate of another case",
};

export interface LinkedRecord {
  kind:
    "project" | "thread" | "document" | "quotation" | "report" | "snapshot" | "supplier" | "hold";
  label: string;
  href: string | null;
}

export interface CaseUpdate {
  id: string;
  at: string;
  kind: "buyer_message" | "reply" | "internal_note" | "status" | "escalation";
  by: string;
  text: string;
  /** Buyer-visible updates name the record they concern. */
  linked: LinkedRecord | null;
  buyerVisible: boolean;
}

export interface BuyerCase {
  id: string;
  ref: string;
  buyerOrg: string;
  contactName: string;
  project: { id: string; name: string; href: string } | null;
  subject: string;
  category: CaseCategory;
  source: CaseSource;
  openedAt: string;
  assignee: string | null;
  status: CaseStatus;
  escalation: { to: string; reason: string; at: string } | null;
  resolution: { code: ResolutionCode; note: string; by: string; at: string } | null;
  linked: LinkedRecord[];
  updates: CaseUpdate[];
  queueTaskId: string | null;
}

export const BUYER_CASES: BuyerCase[] = [
  {
    id: "c_duty",
    ref: "CASE-2026-0031",
    buyerOrg: "Second Demo Buyer LLC",
    contactName: "J. Rivera",
    project: {
      id: "prj_demo_hair",
      name: "Raw hair bundles, 18–22 in, natural black",
      href: "/design-preview/buyer/project",
    },
    subject: "How are the landed-cost duty assumptions sourced?",
    category: "question",
    source: "platform_message",
    openedAt: "2026-11-06T16:00:00Z",
    assignee: "Operator 2 (demo)",
    status: "open",
    escalation: null,
    resolution: null,
    linked: [
      {
        kind: "snapshot",
        label: "Landed-cost snapshot sn_nov_forwarder (duty assumption da_broker)",
        href: "/design-preview/buyer/landed-cost?snapshot=sn_nov_forwarder",
      },
      { kind: "thread", label: "Buyer message thread", href: "/design-preview/buyer/messages" },
    ],
    updates: [
      {
        id: "u1",
        at: "2026-11-06 16:00",
        kind: "buyer_message",
        by: "J. Rivera (Second Demo Buyer LLC)",
        text: "The landed-cost table shows a duty line marked estimated. Where does the rate come from, and is it something your team looked up or something we told you?",
        linked: {
          kind: "snapshot",
          label: "Landed-cost snapshot sn_nov_forwarder",
          href: "/design-preview/buyer/landed-cost?snapshot=sn_nov_forwarder",
        },
        buyerVisible: true,
      },
      {
        id: "u2",
        at: "2026-11-06 16:40",
        kind: "internal_note",
        by: "Operator 2 (demo)",
        text: "The assumption on file is broker advice (Demo Customs Brokerage LLC) recorded by the buyer's own user on 2026-11-06; MPF/HMF flagged. Answer must say a person recorded it with a basis and that nothing fills it automatically.",
        linked: null,
        buyerVisible: false,
      },
    ],
    queueTaskId: "t8",
  },
  {
    id: "c_price",
    ref: "CASE-2026-0029",
    buyerOrg: "Demo Buyer Co.",
    contactName: "A. Chen",
    project: {
      id: "prj_demo_labels",
      name: "Custom BOPP roll labels",
      href: "/design-preview/buyer/project",
    },
    subject: "Unit price for Supplier D looks wrong in the comparison",
    category: "data_issue",
    source: "platform_message",
    openedAt: "2026-11-05T14:20:00Z",
    assignee: "Operator (demo)",
    status: "awaiting_buyer",
    escalation: null,
    resolution: null,
    linked: [
      {
        kind: "document",
        label: "quote-D-2026-10.pdf (extraction review)",
        href: "/design-preview/buyer/review?doc=d_quote_d",
      },
      {
        kind: "quotation",
        label: "Supplier D quotation (expired 2026-10-31)",
        href: "/design-preview/buyer/compare",
      },
    ],
    updates: [
      {
        id: "u1",
        at: "2026-11-05 14:20",
        kind: "buyer_message",
        by: "A. Chen (Demo Buyer Co.)",
        text: "Supplier D shows ¥0.20 per label but the PDF we uploaded says ¥0.26 for 5,000. One of them is wrong.",
        linked: {
          kind: "document",
          label: "quote-D-2026-10.pdf",
          href: "/design-preview/buyer/review?doc=d_quote_d",
        },
        buyerVisible: true,
      },
      {
        id: "u2",
        at: "2026-11-05 15:05",
        kind: "internal_note",
        by: "Operator (demo)",
        text: "Checked p. 2 of the PDF: ¥0.26 is the 5,000–9,999 tier, ¥0.20 the 10,000+ tier; the comparison runs at 10,000 so ¥0.20 is right. The quote is also expired (2026-10-31), which is why it sits in Not ranked.",
        linked: null,
        buyerVisible: false,
      },
      {
        id: "u3",
        at: "2026-11-05 15:20",
        kind: "reply",
        by: "Operator (demo)",
        text: "Both numbers are on the quotation: ¥0.26 applies from 5,000 and ¥0.20 from 10,000 pieces. Your comparison is set to 10,000, so it shows ¥0.20. Supplier D's quote expired on 31 October, which is why it is listed under Not ranked. Can you confirm this answers it?",
        linked: {
          kind: "document",
          label: "quote-D-2026-10.pdf, p. 2 tier table",
          href: "/design-preview/buyer/review?doc=d_quote_d",
        },
        buyerVisible: true,
      },
      {
        id: "u4",
        at: "2026-11-05 15:20",
        kind: "status",
        by: "Operator (demo)",
        text: "Awaiting the buyer's confirmation",
        linked: null,
        buyerVisible: false,
      },
    ],
    queueTaskId: null,
  },
  {
    id: "c_slow",
    ref: "CASE-2026-0030",
    buyerOrg: "Second Demo Buyer LLC",
    contactName: "J. Rivera",
    project: {
      id: "prj_demo_hair",
      name: "Raw hair bundles, 18–22 in, natural black",
      href: "/design-preview/buyer/project",
    },
    subject: "Supplier reply took nine days; is this normal?",
    category: "complaint",
    source: "email",
    openedAt: "2026-11-06T09:30:00Z",
    assignee: "Operator 2 (demo)",
    status: "open",
    escalation: {
      to: "Founder",
      reason: "Second complaint about relay time this month; staffing question, not a one-off.",
      at: "2026-11-06 11:10",
    },
    resolution: null,
    linked: [
      {
        kind: "thread",
        label: "Clarification thread (supplier reply relayed 2026-11-05)",
        href: "/design-preview/buyer/messages",
      },
    ],
    updates: [
      {
        id: "u1",
        at: "2026-11-06 09:30",
        kind: "buyer_message",
        by: "J. Rivera (Second Demo Buyer LLC), by email",
        text: "We asked about the hair origin documentation on 27 October and only saw the reply on 5 November. Is nine days normal? We need to plan around this.",
        linked: {
          kind: "thread",
          label: "Clarification thread",
          href: "/design-preview/buyer/messages",
        },
        buyerVisible: true,
      },
      {
        id: "u2",
        at: "2026-11-06 10:45",
        kind: "internal_note",
        by: "Operator 2 (demo)",
        text: "Timeline: buyer draft approved 10-27, sent 10-28, supplier replied 11-03 (WeChat), relay drafted 11-04, operator approval 11-05. Six days at the supplier, two at ours. Do not promise a response time; the pilot has no SLA commitment.",
        linked: null,
        buyerVisible: false,
      },
      {
        id: "u3",
        at: "2026-11-06 11:10",
        kind: "escalation",
        by: "Operator 2 (demo)",
        text: "Escalated to Founder: second complaint about relay time this month; staffing question, not a one-off.",
        linked: null,
        buyerVisible: false,
      },
    ],
    queueTaskId: null,
  },
  {
    id: "c_xlsx",
    ref: "CASE-2026-0027",
    buyerOrg: "Demo Buyer Co.",
    contactName: "A. Chen",
    project: {
      id: "prj_demo_labels",
      name: "Custom BOPP roll labels",
      href: "/design-preview/buyer/project",
    },
    subject: "Can we get the comparison as a spreadsheet with the landed-cost lines?",
    category: "request",
    source: "platform_message",
    openedAt: "2026-11-04T10:00:00Z",
    assignee: "Operator (demo)",
    status: "resolved",
    escalation: null,
    resolution: {
      code: "fulfilled",
      note: "Pointed to the Reports screen; XLSX export with the landed_cost_lines sheet exists at report v1.",
      by: "Operator (demo)",
      at: "2026-11-04 11:30",
    },
    linked: [
      {
        kind: "report",
        label: "Comparison report v1 (XLSX)",
        href: "/design-preview/buyer/report?id=rep_1",
      },
    ],
    updates: [
      {
        id: "u1",
        at: "2026-11-04 10:00",
        kind: "buyer_message",
        by: "A. Chen (Demo Buyer Co.)",
        text: "Our finance team wants the comparison in Excel with the landed-cost lines broken out.",
        linked: null,
        buyerVisible: true,
      },
      {
        id: "u2",
        at: "2026-11-04 11:25",
        kind: "reply",
        by: "Operator (demo)",
        text: "Reports → Export produces an XLSX with five sheets, including landed_cost_lines and assumptions; the rounding rule is in the footer. Report v1 is generated for 10,000 pieces.",
        linked: {
          kind: "report",
          label: "Comparison report v1 (XLSX)",
          href: "/design-preview/buyer/report?id=rep_1",
        },
        buyerVisible: true,
      },
      {
        id: "u3",
        at: "2026-11-04 11:30",
        kind: "status",
        by: "Operator (demo)",
        text: "Resolved: request fulfilled. Buyer confirmed 2026-11-04 14:02.",
        linked: null,
        buyerVisible: false,
      },
    ],
    queueTaskId: null,
  },
  {
    id: "c_verified",
    ref: "CASE-2026-0025",
    buyerOrg: "Demo Buyer Co.",
    contactName: "A. Chen",
    project: null,
    subject: "Is Supplier A a verified factory?",
    category: "question",
    source: "call",
    openedAt: "2026-11-02T15:00:00Z",
    assignee: "Operator (demo)",
    status: "resolved",
    escalation: null,
    resolution: {
      code: "answered",
      note: "Explained the badge semantics: identity reviewed (date), capabilities documented with self-reported items marked; no 'verified factory' badge exists.",
      by: "Operator (demo)",
      at: "2026-11-02 15:40",
    },
    linked: [
      {
        kind: "supplier",
        label: "Supplier A record (checks)",
        href: "/design-preview/ops/supplier?id=sup_a",
      },
    ],
    updates: [
      {
        id: "u1",
        at: "2026-11-02 15:00",
        kind: "buyer_message",
        by: "A. Chen (Demo Buyer Co.), by phone",
        text: "Asked whether Supplier A is a verified factory and whether we can rely on that for the order.",
        linked: null,
        buyerVisible: true,
      },
      {
        id: "u2",
        at: "2026-11-02 15:35",
        kind: "reply",
        by: "Operator (demo)",
        text: "We do not use a 'verified factory' badge. Supplier A's record shows what was checked and when: identity reviewed on 2026-10-20 (licence matched, representative on video), capabilities documented with the self-reported items marked, golden sample approved by you on 2026-10-28. Each badge opens to the check behind it.",
        linked: {
          kind: "supplier",
          label: "Supplier A checks",
          href: "/design-preview/ops/supplier?id=sup_a",
        },
        buyerVisible: true,
      },
      {
        id: "u3",
        at: "2026-11-02 15:40",
        kind: "status",
        by: "Operator (demo)",
        text: "Resolved: answered.",
        linked: null,
        buyerVisible: false,
      },
    ],
    queueTaskId: null,
  },
];
