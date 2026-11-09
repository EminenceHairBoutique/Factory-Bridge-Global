/**
 * DEMO DATA — NOT REAL SUPPLIER QUOTATIONS. Synthetic message threads for the buyer inbox and the
 * project Messages tab. Shapes mirror `supplier_messages` in docs/SCHEMA_PLAN.md (direction,
 * channel, body_zh, body_en, drafted_by_ai_run_id, approved_by/at, sent_by/at, external_ref) and
 * the approval gate in PRD AC-B6.1 / ADR-012: nothing reaches a supplier before the buyer approves
 * the wording and an operator approves and sends it. Supplier contact handles never appear here.
 */

export const MESSAGES_NOW = "2026-11-07 10:00";

export type Channel = "platform" | "wechat_relay" | "email_intake" | "system";

export const CHANNEL_LABEL: Record<Channel, string> = {
  platform: "Platform message (supplier portal)",
  wechat_relay: "WeChat relay by the operator",
  email_intake: "Email intake mailbox",
  system: "System notice",
};

export const CHANNEL_SHORT: Record<Channel, string> = {
  platform: "platform",
  wechat_relay: "WeChat relay",
  email_intake: "email",
  system: "system",
};

export type InboundFlag =
  "embedded_instruction_detected" | "contact_details_redacted" | "links_not_followed";

export const INBOUND_FLAG_LABEL: Record<InboundFlag, { label: string; body: string }> = {
  embedded_instruction_detected: {
    label: "Text addressed to the software was found and ignored",
    body: "The message contained wording written for the system rather than for you. It was recorded as a security event and not acted on; what you see is the supplier's business content only.",
  },
  contact_details_redacted: {
    label: "Contact details were removed",
    body: "The supplier included a direct contact handle. Contacts are exchanged only under a recorded disclosure grant, so the operator removed it before relaying the reply.",
  },
  links_not_followed: {
    label: "Links were not opened",
    body: "Links in supplier messages are never followed by the platform. Attachments go through the upload pipeline instead.",
  },
};

export type StepState = "pending" | "done" | "returned";

export interface ApprovalRecord {
  buyer: { state: StepState; by: string | null; at: string | null; note: string | null };
  operator: { state: StepState; by: string | null; at: string | null; note: string | null };
  sent: { at: string | null; channel: Channel | null; externalRef: string | null };
}

export interface Translation {
  /** Who produced the other-language rendering. */
  by: "ai" | "operator";
  checkedBy: string | null;
  note: string | null;
}

export type Direction = "outbound" | "inbound" | "system";

export interface ThreadMessage {
  id: string;
  direction: Direction;
  author: string;
  actingAs: "buyer" | "operator" | "supplier" | "system";
  /** "2026-11-07 08:30" */
  at: string;
  en: string;
  zh: string | null;
  translation: Translation | null;
  channel: Channel;
  approval: ApprovalRecord | null;
  attachments: Array<{ documentId: string; name: string }>;
  flags: InboundFlag[];
  draftedByAi: boolean;
}

export interface SupplierRef {
  id: string;
  name: string;
  /** Date the supplier's WeChat contact basis was recorded, when it exists (ops CRM). */
  wechatConsentRecordedAt: string | null;
}

export type ThreadKind = "clarification" | "revalidation" | "sample" | "rfq" | "notice";

export const THREAD_KIND_LABEL: Record<ThreadKind, string> = {
  clarification: "Clarification",
  revalidation: "Revalidation",
  sample: "Sample",
  rfq: "RFQ reply",
  notice: "Notice",
};

export interface Thread {
  id: string;
  projectId: string;
  projectName: string;
  supplier: SupplierRef | null;
  subject: string;
  kind: ThreadKind;
  rfqRef: string | null;
  messages: ThreadMessage[];
}

const LABELS = { id: "prj_demo_labels", name: "Custom BOPP roll labels, 50 × 76 mm" };
const CARTONS = { id: "prj_demo_cartons", name: "Folding cartons, 350 gsm C1S, matte" };
const HAIR = { id: "prj_demo_hair", name: "Raw hair bundles, 18–22 in" };

const SUP_A: SupplierRef = {
  id: "sup_a",
  name: "Supplier A (demo)",
  wechatConsentRecordedAt: "2026-10-18",
};
const SUP_B: SupplierRef = {
  id: "sup_b",
  name: "Supplier B (demo)",
  wechatConsentRecordedAt: "2026-09-28",
};
const SUP_D: SupplierRef = {
  id: "sup_d",
  name: "Supplier D (demo)",
  wechatConsentRecordedAt: null,
};
const SUP_F: SupplierRef = {
  id: "sup_f",
  name: "Supplier F (demo)",
  wechatConsentRecordedAt: null,
};
const SUP_K: SupplierRef = {
  id: "sup_k",
  name: "Supplier K (demo)",
  wechatConsentRecordedAt: null,
};

const CHECKED_BY_OPERATOR: Translation = { by: "ai", checkedBy: "Operator (demo)", note: null };

export const DEMO_THREADS: Thread[] = [
  {
    id: "th_tooling",
    projectId: LABELS.id,
    projectName: LABELS.name,
    supplier: SUP_B,
    subject: "Is tooling included in the EXW unit price?",
    kind: "clarification",
    rfqRef: null,
    messages: [
      {
        id: "m_tooling_0",
        direction: "system",
        author: "System",
        actingAs: "system",
        at: "2026-11-06 14:10",
        en: "Clarification requested from the comparison for Quotation B v1 (EXW Dongguan). The draft below was prepared from your request. Approve the wording; an operator then approves and sends it. Nothing reaches the supplier before both approvals.",
        zh: null,
        translation: null,
        channel: "system",
        approval: null,
        attachments: [],
        flags: [],
        draftedByAi: false,
      },
      {
        id: "m_tooling_1",
        direction: "outbound",
        author: "Drafted for you",
        actingAs: "buyer",
        at: "2026-11-06 14:12",
        en: "Is tooling included in the quoted EXW unit price, and does the price hold for 10,000 pcs?",
        zh: "请确认：EXW 单价是否已包含模具费？该价格是否适用于 10,000 件？",
        translation: {
          by: "ai",
          checkedBy: null,
          note: "Chinese drafted by AI from your request; the operator checks it before sending.",
        },
        channel: "platform",
        approval: {
          buyer: { state: "pending", by: null, at: null, note: null },
          operator: { state: "pending", by: null, at: null, note: null },
          sent: { at: null, channel: null, externalRef: null },
        },
        attachments: [],
        flags: [],
        draftedByAi: true,
      },
    ],
  },
  {
    id: "th_reply_a",
    projectId: LABELS.id,
    projectName: LABELS.name,
    supplier: SUP_A,
    subject: "MOQ and tooling for the 50 × 76 mm labels",
    kind: "clarification",
    rfqRef: null,
    messages: [
      {
        id: "m_reply_a_1",
        direction: "outbound",
        author: "You",
        actingAs: "buyer",
        at: "2026-11-05 09:40",
        en: "Please confirm the minimum order quantity for the 50 × 76 mm labels and whether the tooling fee is one-time or included in the unit price.",
        zh: "请确认 50 × 76 mm 标签的最小起订量，以及模具费是一次性收取还是已含在单价内。",
        translation: CHECKED_BY_OPERATOR,
        channel: "platform",
        approval: {
          buyer: { state: "done", by: "You", at: "2026-11-05 09:40", note: null },
          operator: { state: "done", by: "Operator (demo)", at: "2026-11-05 11:20", note: null },
          sent: {
            at: "2026-11-05 11:21",
            channel: "platform",
            externalRef: "portal-msg-demo-2290",
          },
        },
        attachments: [],
        flags: [],
        draftedByAi: false,
      },
      {
        id: "m_reply_a_2",
        direction: "inbound",
        author: "Supplier A (demo)",
        actingAs: "supplier",
        at: "2026-11-07 07:40",
        en: "MOQ 5,000 pcs confirmed. Tooling ¥300 one-time, not included in the unit price. For further discussion you may contact our sales manager.",
        zh: "最小起订量 5,000 件确认。模具费 300 元一次性收取，不含在单价内。如需进一步沟通可联系我们的销售经理。",
        translation: CHECKED_BY_OPERATOR,
        channel: "platform",
        approval: null,
        attachments: [],
        flags: ["contact_details_redacted"],
        draftedByAi: false,
      },
      {
        id: "m_reply_a_3",
        direction: "system",
        author: "System",
        actingAs: "system",
        at: "2026-11-07 07:45",
        en: "Relayed by Operator (demo). Quotation A v2 was created from this reply: MOQ 5,000 pcs, tooling ¥300 one-time and not included in the unit price. Version 1 stays viewable.",
        zh: null,
        translation: null,
        channel: "system",
        approval: null,
        attachments: [],
        flags: [],
        draftedByAi: false,
      },
    ],
  },
  {
    id: "th_cartons_f",
    projectId: CARTONS.id,
    projectName: CARTONS.name,
    supplier: SUP_F,
    subject: "Does 出厂价 mean EXW Dongguan?",
    kind: "clarification",
    rfqRef: "RFQ-DEMO-2026-027",
    messages: [
      {
        id: "m_cartons_f_1",
        direction: "outbound",
        author: "You",
        actingAs: "buyer",
        at: "2026-11-05 15:02",
        en: "Does “出厂价” mean EXW Dongguan? Please confirm the trade term with its named place, and whether the tooling fee is included in the unit price.",
        zh: "您提供的“出厂价”是否指 EXW 东莞？请确认交易条款与指定地点，以及刀模费是否已包含在单价内。",
        translation: CHECKED_BY_OPERATOR,
        channel: "platform",
        approval: {
          buyer: { state: "done", by: "You", at: "2026-11-05 15:02", note: null },
          operator: { state: "done", by: "Operator (demo)", at: "2026-11-05 15:30", note: null },
          sent: {
            at: "2026-11-05 15:31",
            channel: "platform",
            externalRef: "portal-msg-demo-2304",
          },
        },
        attachments: [],
        flags: [],
        draftedByAi: false,
      },
    ],
  },
  {
    id: "th_hair_k",
    projectId: HAIR.id,
    projectName: HAIR.name,
    supplier: SUP_K,
    subject: "Quotation received by email from Supplier K",
    kind: "rfq",
    rfqRef: "RFQ-DEMO-2026-040",
    messages: [
      {
        id: "m_hair_k_1",
        direction: "inbound",
        author: "Supplier K (demo)",
        actingAs: "supplier",
        at: "2026-11-06 02:14",
        en: "Please find our quotation attached.",
        zh: "附件为报价单，请查收。",
        translation: CHECKED_BY_OPERATOR,
        channel: "email_intake",
        approval: null,
        attachments: [{ documentId: "d_quote_k", name: "quote-K-2026-11.pdf" }],
        flags: ["embedded_instruction_detected", "links_not_followed"],
        draftedByAi: false,
      },
      {
        id: "m_hair_k_2",
        direction: "system",
        author: "System",
        actingAs: "system",
        at: "2026-11-06 08:30",
        en: "The attachment entered the upload pipeline and is in extraction review. Text in the email addressed to the software was recorded as a security event and ignored.",
        zh: null,
        translation: null,
        channel: "system",
        approval: null,
        attachments: [],
        flags: [],
        draftedByAi: false,
      },
    ],
  },
  {
    id: "th_expired_d",
    projectId: LABELS.id,
    projectName: LABELS.name,
    supplier: SUP_D,
    subject: "Quotation D expired on 2026-10-31",
    kind: "revalidation",
    rfqRef: null,
    messages: [
      {
        id: "m_expired_d_1",
        direction: "system",
        author: "System",
        actingAs: "system",
        at: "2026-10-31 00:05",
        en: "Quotation D v1 expired on 2026-10-31. Expired quotations are excluded from ranking. Ask for revalidation if you still want Supplier D in the comparison.",
        zh: null,
        translation: null,
        channel: "system",
        approval: null,
        attachments: [],
        flags: [],
        draftedByAi: false,
      },
    ],
  },
  {
    id: "th_sample",
    projectId: LABELS.id,
    projectName: LABELS.name,
    supplier: SUP_A,
    subject: "Golden sample for the 50 × 76 mm matte BOPP label",
    kind: "sample",
    rfqRef: null,
    messages: [
      {
        id: "m_sample_1",
        direction: "outbound",
        author: "You",
        actingAs: "buyer",
        at: "2026-10-20 09:12",
        en: "Please send one golden sample of the 50 × 76 mm matte BOPP label (4-color, permanent adhesive) to our Newark office. We will confirm within 5 business days of receipt.",
        zh: "请寄送一件 50 × 76 mm 哑膜 BOPP 标签（四色、永久胶）的签样至我们的纽瓦克办公室。收到后 5 个工作日内确认。",
        translation: CHECKED_BY_OPERATOR,
        channel: "platform",
        approval: {
          buyer: { state: "done", by: "You", at: "2026-10-20 09:12", note: null },
          operator: { state: "done", by: "Operator (demo)", at: "2026-10-20 10:05", note: null },
          sent: {
            at: "2026-10-20 10:06",
            channel: "platform",
            externalRef: "portal-msg-demo-2201",
          },
        },
        attachments: [],
        flags: [],
        draftedByAi: false,
      },
      {
        id: "m_sample_2",
        direction: "inbound",
        author: "Supplier A (demo)",
        actingAs: "supplier",
        at: "2026-10-24 16:40",
        en: "The golden sample was shipped on 24 October; the tracking number is recorded on the platform. Please confirm on receipt.",
        zh: "签样已于 10 月 24 日寄出，快递单号已登记在平台。请查收后确认。",
        translation: CHECKED_BY_OPERATOR,
        channel: "platform",
        approval: null,
        attachments: [],
        flags: [],
        draftedByAi: false,
      },
      {
        id: "m_sample_3",
        direction: "system",
        author: "System",
        actingAs: "system",
        at: "2026-10-28 11:00",
        en: "Sample approved by Demo Buyer Co.; check record created (Sample approved for variant).",
        zh: null,
        translation: null,
        channel: "system",
        approval: null,
        attachments: [],
        flags: [],
        draftedByAi: false,
      },
    ],
  },
];
