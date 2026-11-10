/**
 * 演示数据 — 非真实供应商报价。DEMO DATA — NOT REAL SUPPLIER QUOTATIONS.
 *
 * The supplier side (演示供应商A) of the message threads: only messages that actually left the
 * platform are here (a buyer draft that was never approved does not exist for the supplier), the
 * buyer is an anonymized label (供应商视图不展示买家公司名称或联系方式), and every supplier reply
 * carries its relay state. Mirrors `supplier_messages` in docs/SCHEMA_PLAN.md and ADR-012.
 */

export const SUPPLIER_MESSAGES_TODAY = "2026-11-07";

export type SmDirection = "买家" | "我方" | "平台";
export type SmKind = "澄清" | "样品" | "通知" | "报价";

export const SM_KIND_LABEL: Record<SmKind, string> = {
  澄清: "买家澄清",
  样品: "样品",
  通知: "平台通知",
  报价: "报价进度",
};

export interface SmAttachment {
  name: string;
  status: "待扫描" | "已解析" | "审核中";
}

export interface SmMessage {
  id: string;
  direction: SmDirection;
  /** "2026-11-05 11:21" */
  at: string;
  zh: string;
  /** Buyer messages: the buyer's original English. Supplier messages: the platform's translation once relayed. */
  en: string | null;
  translationNote: string | null;
  /** 我方 messages only: null means 待平台转达. */
  relayedAt: string | null;
  attachments: SmAttachment[];
  /** A platform note attached to this message, for example that contact details were removed. */
  notice: string | null;
}

export interface SmThread {
  id: string;
  subject: string;
  kind: SmKind;
  buyerLabel: string;
  rfqId: string | null;
  rfqRef: string | null;
  closed: boolean;
  unread: boolean;
  messages: SmMessage[];
  link: { label: string; href: string } | null;
}

export const SUPPLIER_THREADS: SmThread[] = [
  {
    id: "sm_rfq_2",
    subject: "“出厂价”是否指 EXW 东莞？",
    kind: "澄清",
    buyerLabel: "平台买家（美国 · 加利福尼亚州）",
    rfqId: "rfq_2",
    rfqRef: "RFQ-DEMO-2026-027",
    closed: false,
    unread: true,
    link: null,
    messages: [
      {
        id: "sm_rfq_2_m1",
        direction: "买家",
        at: "2026-11-05 15:31",
        zh: "您提供的“出厂价”是否指 EXW 东莞？请确认交易条款与指定地点，以及刀模费是否已包含在单价内。",
        en: "Does “出厂价” mean EXW Dongguan? Please confirm the trade term with its named place, and whether the tooling fee is included in the unit price.",
        translationNote: "买家原文为英文，中文由平台翻译并经运营核对。",
        relayedAt: null,
        attachments: [],
        notice: null,
      },
    ],
  },
  {
    id: "sm_rfq_1_moq",
    subject: "50 × 76 mm 标签的起订量与模具费",
    kind: "澄清",
    buyerLabel: "平台买家（美国 · 新泽西州）",
    rfqId: "rfq_1",
    rfqRef: "RFQ-DEMO-2026-031",
    closed: false,
    unread: false,
    link: null,
    messages: [
      {
        id: "sm_rfq_1_moq_m1",
        direction: "买家",
        at: "2026-11-05 11:21",
        zh: "请确认 50 × 76 mm 标签的最小起订量，以及模具费是一次性收取还是已含在单价内。",
        en: "Please confirm the minimum order quantity for the 50 × 76 mm labels and whether the tooling fee is one-time or included in the unit price.",
        translationNote: "买家原文为英文，中文由平台翻译并经运营核对。",
        relayedAt: null,
        attachments: [],
        notice: null,
      },
      {
        id: "sm_rfq_1_moq_m2",
        direction: "我方",
        at: "2026-11-07 07:40",
        zh: "最小起订量 5,000 件确认。模具费 300 元一次性收取，不含在单价内。如需进一步沟通可联系我们的销售经理。",
        en: "MOQ 5,000 pcs confirmed. Tooling ¥300 one-time, not included in the unit price. For further discussion you may contact our sales manager.",
        translationNote: "英文由平台翻译，运营核对后转达。",
        relayedAt: "2026-11-07 07:45",
        attachments: [],
        notice:
          "您的回复中包含联系方式，平台已在转达前移除。联系方式仅在买家获得授权后共享；授权可在“数据共享设置”查看。",
      },
      {
        id: "sm_rfq_1_moq_m3",
        direction: "平台",
        at: "2026-11-07 07:45",
        zh: "回复已转达买家。买家据此更新了报价记录：起订量 5,000 件；模具费 300 元一次性收取，不含单价。",
        en: null,
        translationNote: null,
        relayedAt: null,
        attachments: [],
        notice: null,
      },
    ],
  },
  {
    id: "sm_notice_rfq_1",
    subject: "新询价单：BOPP 卷筒不干胶标签 50 × 76 mm",
    kind: "通知",
    buyerLabel: "平台买家（美国 · 新泽西州）",
    rfqId: "rfq_1",
    rfqRef: "RFQ-DEMO-2026-031",
    closed: true,
    unread: true,
    link: { label: "查看询价单", href: "/design-preview/supplier/rfqs?rfq=rfq_1" },
    messages: [
      {
        id: "sm_notice_rfq_1_m1",
        direction: "平台",
        at: "2026-11-06 09:00",
        zh: "新询价单 RFQ-DEMO-2026-031（BOPP 卷筒不干胶标签 50 × 76 mm，10,000 件）已送达，请于 2026-11-13 前回复。报价请通过“提交报价”填写，消息中的价格不会进入买家比价。",
        en: null,
        translationNote: null,
        relayedAt: null,
        attachments: [],
        notice: null,
      },
    ],
  },
  {
    id: "sm_rfq_3_quote",
    subject: "报价已转达买家：牛皮纸套 单色印刷",
    kind: "报价",
    buyerLabel: "平台买家（美国 · 佐治亚州）",
    rfqId: "rfq_3",
    rfqRef: "RFQ-DEMO-2026-022",
    closed: true,
    unread: false,
    link: { label: "查看询价单", href: "/design-preview/supplier/rfqs?rfq=rfq_3" },
    messages: [
      {
        id: "sm_rfq_3_quote_m1",
        direction: "平台",
        at: "2026-11-03 14:20",
        zh: "您对 RFQ-DEMO-2026-022（牛皮纸套 单色印刷）的报价已通过平台审核并转达买家。买家有决定后将在此通知；在此之前请勿重复报价。",
        en: null,
        translationNote: null,
        relayedAt: null,
        attachments: [],
        notice: null,
      },
    ],
  },
  {
    id: "sm_notice_cert",
    subject: "企业认证：生产场地证明需补充",
    kind: "通知",
    buyerLabel: "平台",
    rfqId: null,
    rfqRef: null,
    closed: true,
    unread: false,
    link: { label: "前往企业资料", href: "/design-preview/supplier/onboarding" },
    messages: [
      {
        id: "sm_notice_cert_m1",
        direction: "平台",
        at: "2026-11-05 10:00",
        zh: "企业认证：生产场地证明需补充。请上传近期厂房照片或租赁合同；文件将标注为“供应商提供，未核验”，待平台审核。",
        en: null,
        translationNote: null,
        relayedAt: null,
        attachments: [],
        notice: null,
      },
    ],
  },
  {
    id: "sm_sample",
    subject: "签样：50 × 76 mm 哑膜 BOPP 标签",
    kind: "样品",
    buyerLabel: "平台买家（美国 · 新泽西州）",
    rfqId: null,
    rfqRef: null,
    closed: true,
    unread: false,
    link: null,
    messages: [
      {
        id: "sm_sample_m1",
        direction: "买家",
        at: "2026-10-20 10:06",
        zh: "请寄送一件 50 × 76 mm 哑膜 BOPP 标签（四色、永久胶）的签样至我们的纽瓦克办公室。收到后 5 个工作日内确认。",
        en: "Please send one golden sample of the 50 × 76 mm matte BOPP label (4-color, permanent adhesive) to our Newark office. We will confirm within 5 business days of receipt.",
        translationNote: "买家原文为英文，中文由平台翻译并经运营核对。",
        relayedAt: null,
        attachments: [],
        notice: null,
      },
      {
        id: "sm_sample_m2",
        direction: "我方",
        at: "2026-10-24 16:40",
        zh: "签样已于 10 月 24 日寄出，快递单号已登记在平台。请查收后确认。",
        en: "The golden sample was shipped on 24 October; the tracking number is recorded on the platform. Please confirm on receipt.",
        translationNote: "英文由平台翻译，运营核对后转达。",
        relayedAt: "2026-10-24 17:10",
        attachments: [],
        notice: null,
      },
      {
        id: "sm_sample_m3",
        direction: "平台",
        at: "2026-10-28 11:00",
        zh: "买家已确认签样通过。平台已为该产品记录“样品已确认”核验项，将在买家比价中显示。此会话已结束。",
        en: null,
        translationNote: null,
        relayedAt: null,
        attachments: [],
        notice: null,
      },
    ],
  },
];
