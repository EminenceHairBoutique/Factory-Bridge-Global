/**
 * 演示数据 — 非真实供应商报价。DEMO DATA — NOT REAL SUPPLIER QUOTATIONS.
 * Synthetic quotation threads for the supplier's 我的报价 screen, shaped after migration 0009:
 * one `quote_groups` thread per RFQ, immutable `quotations` versions, `quotation_states`
 * (confirmed / superseded / expired / withdrawn; exactly one current version per thread) and
 * `quote_status_events`. Pre-confirmation work is a review task (`review_status`), shown here as 待审核.
 */
import type { QuoteStatus, ReviewStatus } from "@fbg/domain";
import type { IncotermCode, SupplierTier } from "./supplier";

export const QUOTES_TODAY = "2026-11-07";

export interface QuoteEvent {
  at: string;
  from: QuoteStatus | "submitted" | null;
  to: QuoteStatus | "submitted" | "review_rejected";
  actor: "供应商（您）" | "平台运营" | "系统";
  reason: string;
}

export interface QuoteVersion {
  id: string;
  groupId: string;
  version: number;
  /** Pre-confirmation: pending / in_review / rejected. Null once confirmed. */
  reviewStatus: ReviewStatus | null;
  status: QuoteStatus | null;
  isCurrent: boolean;
  supersededBy: string | null;
  currency: "CNY" | "USD";
  unit: string;
  basisCode: IncotermCode;
  basisPlace: string;
  basisConfirmed: boolean;
  tiers: SupplierTier[];
  toolingAmount: number | null;
  toolingIncluded: boolean;
  leadTimeDays: number;
  paymentTerms: string;
  quoteDate: string;
  validUntil: string | null;
  confirmedAt: string | null;
  notes: string;
  submittedAt: string;
  events: QuoteEvent[];
}

export interface QuoteGroup {
  id: string;
  rfqRef: string;
  rfqId: string | null;
  buyerLabel: string;
  productZh: string;
  productEn: string;
  quantity: number;
  unit: string;
  specVersion: string;
  visibility: "仅此买家";
}

export const QUOTE_GROUPS: QuoteGroup[] = [
  {
    id: "qg_sleeve",
    rfqRef: "RFQ-DEMO-2026-022",
    rfqId: "rfq_3",
    buyerLabel: "平台买家（美国 · 佐治亚州）",
    productZh: "牛皮纸套 单色印刷",
    productEn: "Kraft paper sleeves, printed 1-color",
    quantity: 8_000,
    unit: "件",
    specVersion: "规格 v1（2026-10-28）",
    visibility: "仅此买家",
  },
  {
    id: "qg_labels",
    rfqRef: "RFQ-DEMO-2026-012",
    rfqId: null,
    buyerLabel: "平台买家（美国 · 新泽西州）",
    productZh: "BOPP 卷筒不干胶标签 50 × 76 mm",
    productEn: "Custom BOPP roll labels, 50 × 76 mm",
    quantity: 10_000,
    unit: "件",
    specVersion: "规格 v2（2026-10-12）",
    visibility: "仅此买家",
  },
  {
    id: "qg_hair",
    rfqRef: "RFQ-DEMO-2026-015",
    rfqId: null,
    buyerLabel: "平台买家（美国 · 佐治亚州）",
    productZh: "真人发发帘 12A 双马尾",
    productEn: "Human-hair bundles, 12A double drawn",
    quantity: 200,
    unit: "束",
    specVersion: "规格 v1（2026-10-18）",
    visibility: "仅此买家",
  },
  {
    id: "qg_cartons",
    rfqRef: "RFQ-DEMO-2026-008",
    rfqId: null,
    buyerLabel: "平台买家（美国 · 加利福尼亚州）",
    productZh: "折叠纸盒 350 g 单铜 哑膜",
    productEn: "Folding cartons, 350 gsm C1S, matte",
    quantity: 5_000,
    unit: "件",
    specVersion: "规格 v1（2026-08-25）",
    visibility: "仅此买家",
  },
  {
    id: "qg_pet",
    rfqRef: "RFQ-DEMO-2026-005",
    rfqId: null,
    buyerLabel: "平台买家（美国 · 德克萨斯州）",
    productZh: "PET 透明标签 40 × 40 mm",
    productEn: "Clear PET labels, 40 × 40 mm",
    quantity: 3_000,
    unit: "件",
    specVersion: "规格 v1（2026-08-10）",
    visibility: "仅此买家",
  },
];

const labelsTiersV1: SupplierTier[] = [
  { id: 1, minQty: 5_000, maxQty: 10_000, unitPrice: 0.27 },
  { id: 2, minQty: 10_000, maxQty: 50_000, unitPrice: 0.22 },
];
const labelsTiersV2: SupplierTier[] = [
  { id: 1, minQty: 5_000, maxQty: 10_000, unitPrice: 0.26 },
  { id: 2, minQty: 10_000, maxQty: 50_000, unitPrice: 0.21 },
];

export const QUOTE_VERSIONS: QuoteVersion[] = [
  {
    id: "qv_sleeve_1",
    groupId: "qg_sleeve",
    version: 1,
    reviewStatus: "pending",
    status: null,
    isCurrent: true,
    supersededBy: null,
    currency: "CNY",
    unit: "件",
    basisCode: "FOB",
    basisPlace: "深圳",
    basisConfirmed: true,
    tiers: [
      { id: 1, minQty: 5_000, maxQty: 10_000, unitPrice: 0.38 },
      { id: 2, minQty: 10_000, maxQty: null, unitPrice: 0.33 },
    ],
    toolingAmount: 600,
    toolingIncluded: false,
    leadTimeDays: 18,
    paymentTerms: "30% 定金，发货前付清",
    quoteDate: "2026-11-03",
    validUntil: "2026-12-03",
    confirmedAt: null,
    notes: "印刷色为潘通 Black C；纸张 120 g 本色牛皮纸。",
    submittedAt: "2026-11-03",
    events: [
      {
        at: "2026-11-03 16:40",
        from: null,
        to: "submitted",
        actor: "供应商（您）",
        reason: "提交报价（RFQ-DEMO-2026-022）",
      },
    ],
  },
  {
    id: "qv_labels_1",
    groupId: "qg_labels",
    version: 1,
    reviewStatus: null,
    status: "superseded",
    isCurrent: false,
    supersededBy: "qv_labels_2",
    currency: "CNY",
    unit: "件",
    basisCode: "FOB",
    basisPlace: "深圳",
    basisConfirmed: true,
    tiers: labelsTiersV1,
    toolingAmount: 300,
    toolingIncluded: false,
    leadTimeDays: 15,
    paymentTerms: "30% 定金，发货前付清",
    quoteDate: "2026-09-18",
    validUntil: "2026-10-31",
    confirmedAt: "2026-09-20",
    notes: "",
    submittedAt: "2026-09-18",
    events: [
      {
        at: "2026-09-18 10:05",
        from: null,
        to: "submitted",
        actor: "供应商（您）",
        reason: "提交报价（RFQ-DEMO-2026-012）",
      },
      {
        at: "2026-09-20 09:30",
        from: "submitted",
        to: "confirmed",
        actor: "平台运营",
        reason: "核对报价单 quote-A-2026-09.pdf 后确认",
      },
      {
        at: "2026-11-01 00:10",
        from: "confirmed",
        to: "expired",
        actor: "系统",
        reason: "有效期 2026-10-31 已过",
      },
      {
        at: "2026-10-15 11:20",
        from: "expired",
        to: "superseded",
        actor: "平台运营",
        reason: "供应商提交 v2（降价并延长有效期）",
      },
    ],
  },
  {
    id: "qv_labels_2",
    groupId: "qg_labels",
    version: 2,
    reviewStatus: null,
    status: "confirmed",
    isCurrent: true,
    supersededBy: null,
    currency: "CNY",
    unit: "件",
    basisCode: "FOB",
    basisPlace: "深圳",
    basisConfirmed: true,
    tiers: labelsTiersV2,
    toolingAmount: 300,
    toolingIncluded: false,
    leadTimeDays: 15,
    paymentTerms: "30% 定金，发货前付清",
    quoteDate: "2026-10-13",
    validUntil: "2026-12-15",
    confirmedAt: "2026-10-15",
    notes: "v2：每档下调 0.01 元；有效期延至 12 月 15 日。",
    submittedAt: "2026-10-13",
    events: [
      {
        at: "2026-10-13 14:02",
        from: null,
        to: "submitted",
        actor: "供应商（您）",
        reason: "更新报价：降价并延长有效期",
      },
      {
        at: "2026-10-15 11:20",
        from: "submitted",
        to: "confirmed",
        actor: "平台运营",
        reason: "核对后确认为 v2，v1 标记为已更新",
      },
    ],
  },
  {
    id: "qv_hair_1",
    groupId: "qg_hair",
    version: 1,
    reviewStatus: null,
    status: "confirmed",
    isCurrent: true,
    supersededBy: null,
    currency: "USD",
    unit: "束",
    basisCode: "FOB",
    basisPlace: "广州",
    basisConfirmed: true,
    tiers: [
      { id: 1, minQty: 100, maxQty: 500, unitPrice: 42 },
      { id: 2, minQty: 500, maxQty: null, unitPrice: 39.5 },
    ],
    toolingAmount: null,
    toolingIncluded: true,
    leadTimeDays: 12,
    paymentTerms: "50% 定金，发货前付清",
    quoteDate: "2026-10-20",
    validUntil: "2026-11-12",
    confirmedAt: "2026-10-22",
    notes: "来源证明文件随附；颜色 1B。",
    submittedAt: "2026-10-20",
    events: [
      {
        at: "2026-10-20 15:12",
        from: null,
        to: "submitted",
        actor: "供应商（您）",
        reason: "提交报价（RFQ-DEMO-2026-015）",
      },
      {
        at: "2026-10-22 10:00",
        from: "submitted",
        to: "confirmed",
        actor: "平台运营",
        reason: "核对后确认",
      },
    ],
  },
  {
    id: "qv_cartons_1",
    groupId: "qg_cartons",
    version: 1,
    reviewStatus: null,
    status: "expired",
    isCurrent: true,
    supersededBy: null,
    currency: "CNY",
    unit: "件",
    basisCode: "EXW",
    basisPlace: "东莞",
    basisConfirmed: true,
    tiers: [{ id: 1, minQty: 3_000, maxQty: null, unitPrice: 0.85 }],
    toolingAmount: 800,
    toolingIncluded: false,
    leadTimeDays: 20,
    paymentTerms: "30% 定金，发货前付清",
    quoteDate: "2026-08-30",
    validUntil: "2026-10-20",
    confirmedAt: "2026-09-01",
    notes: "",
    submittedAt: "2026-08-30",
    events: [
      {
        at: "2026-08-30 09:00",
        from: null,
        to: "submitted",
        actor: "供应商（您）",
        reason: "提交报价（RFQ-DEMO-2026-008）",
      },
      {
        at: "2026-09-01 10:30",
        from: "submitted",
        to: "confirmed",
        actor: "平台运营",
        reason: "核对后确认",
      },
      {
        at: "2026-10-21 00:10",
        from: "confirmed",
        to: "expired",
        actor: "系统",
        reason: "有效期 2026-10-20 已过",
      },
    ],
  },
  {
    id: "qv_pet_1",
    groupId: "qg_pet",
    version: 1,
    reviewStatus: null,
    status: "withdrawn",
    isCurrent: true,
    supersededBy: null,
    currency: "CNY",
    unit: "件",
    basisCode: "FOB",
    basisPlace: "深圳",
    basisConfirmed: true,
    tiers: [{ id: 1, minQty: 2_000, maxQty: null, unitPrice: 0.3 }],
    toolingAmount: 400,
    toolingIncluded: false,
    leadTimeDays: 14,
    paymentTerms: "30% 定金，发货前付清",
    quoteDate: "2026-08-12",
    validUntil: "2026-10-12",
    confirmedAt: "2026-08-14",
    notes: "",
    submittedAt: "2026-08-12",
    events: [
      {
        at: "2026-08-12 11:00",
        from: null,
        to: "submitted",
        actor: "供应商（您）",
        reason: "提交报价（RFQ-DEMO-2026-005）",
      },
      {
        at: "2026-08-14 09:15",
        from: "submitted",
        to: "confirmed",
        actor: "平台运营",
        reason: "核对后确认",
      },
      {
        at: "2026-10-05 16:45",
        from: "confirmed",
        to: "withdrawn",
        actor: "供应商（您）",
        reason: "PET 原材料涨价，无法按原价供货",
      },
    ],
  },
];
