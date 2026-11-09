/**
 * DEMO DATA — NOT REAL SUPPLIER QUOTATIONS. Synthetic research leads for the operations research
 * inbox (PRD US-O1; migration 0005 `research_leads` and `source_systems`; INTEGRATIONS row S1).
 * A lead is a typed observation from a human reading a listing: reference, Chinese search term,
 * title, an indicative price range, MOQ and the date. No page copies, no images, no bulk capture.
 * Rights class is always `internal_market_observation`; buyers never see a lead or its prices.
 */
import type { RightsClass } from "@fbg/domain";

export const RESEARCH_TODAY = "2026-11-07";

/** Stale after 30 days (INTEGRATIONS S1, configurable). */
export const LEAD_STALE_DAYS = 30;

export interface SourceSystem {
  code: string;
  provider: string;
  status: "manual" | "blocked";
  note: string;
}

/** Mirrors `source_systems`: blocked means no research is recorded against it until the register changes. */
export const SOURCE_SYSTEMS: SourceSystem[] = [
  {
    code: "cn.1688",
    provider: "1688.com",
    status: "manual",
    note: "Manual reading only; ToS reviewed 2026-10-07 (restricts automated access and republication).",
  },
  {
    code: "cn.taobao",
    provider: "Taobao",
    status: "manual",
    note: "Manual reading only; consumer listings, rarely factory-direct.",
  },
  {
    code: "cn.weidian",
    provider: "Weidian",
    status: "manual",
    note: "Manual reading only; seller shops, verify the operator is a factory.",
  },
  {
    code: "referral",
    provider: "Referral or trade show",
    status: "manual",
    note: "Introduced by a partner or met at a show; record who introduced them.",
  },
  {
    code: "com.alibaba",
    provider: "Alibaba.com",
    status: "blocked",
    note: "Not in the integrations register yet; no leads recorded until docs/INTEGRATIONS_AND_PERMISSIONS.md lists the exact permission.",
  },
];

export type LeadStatus = "new" | "linked" | "dismissed";

export interface ResearchLead {
  id: string;
  taxonomy: string;
  sourceSystem: string;
  referenceUrl: string;
  searchTermZh: string;
  titleZh: string;
  observedMinPrice: number | null;
  observedMaxPrice: number | null;
  currency: string;
  observedMoq: number | null;
  observedUnit: string;
  observedAt: string;
  notes: string;
  recordedBy: string;
  rightsClass: RightsClass;
  status: LeadStatus;
  linkedSupplierId: string | null;
  dismissedReason: string | null;
}

export const RESEARCH_LEADS: ResearchLead[] = [
  {
    id: "rl_labels_1",
    taxonomy: "Labels",
    sourceSystem: "cn.1688",
    referenceUrl: "https://detail.1688.com/offer/demo-000000001.html",
    searchTermZh: "不干胶标签 定制 卷装 铜版纸",
    titleZh: "厂家定制不干胶标签 卷筒铜版纸 哑膜 多色印刷",
    observedMinPrice: 0.03,
    observedMaxPrice: 0.08,
    currency: "CNY",
    observedMoq: 10000,
    observedUnit: "pc",
    observedAt: "2026-11-05",
    notes:
      "Lists own press line in the description; Dongguan address. Listing price depends on size and lamination; not comparable to our brief.",
    recordedBy: "Operator (demo)",
    rightsClass: "internal_market_observation",
    status: "new",
    linkedSupplierId: null,
    dismissedReason: null,
  },
  {
    id: "rl_cartons_1",
    taxonomy: "Folding cartons",
    sourceSystem: "cn.1688",
    referenceUrl: "https://detail.1688.com/offer/demo-000000002.html",
    searchTermZh: "折叠纸盒 白卡纸 定做 彩盒",
    titleZh: "白卡纸彩盒定做 折叠包装盒 烫金 UV",
    observedMinPrice: 0.45,
    observedMaxPrice: 1.2,
    currency: "CNY",
    observedMoq: 3000,
    observedUnit: "pc",
    observedAt: "2026-11-01",
    notes:
      "Shop shows a Foshan factory address; same seller as the lead already linked to the Foshan carton factory? Check before creating a duplicate.",
    recordedBy: "Operator (demo)",
    rightsClass: "internal_market_observation",
    status: "new",
    linkedSupplierId: null,
    dismissedReason: null,
  },
  {
    id: "rl_hair_1",
    taxonomy: "Hair bundles",
    sourceSystem: "cn.weidian",
    referenceUrl: "https://weidian.com/item.html?itemID=demo-3",
    searchTermZh: "真人发 发帘 双马尾 12A",
    titleZh: "12A 双马尾真人发帘 可定制长度",
    observedMinPrice: 180,
    observedMaxPrice: 320,
    currency: "CNY",
    observedMoq: 10,
    observedUnit: "bundle",
    observedAt: "2026-09-28",
    notes: "Reseller shop, no factory named. Keep as a price reference only.",
    recordedBy: "Operator (demo)",
    rightsClass: "internal_market_observation",
    status: "new",
    linkedSupplierId: null,
    dismissedReason: null,
  },
  {
    id: "rl_cartons_foshan",
    taxonomy: "Folding cartons",
    sourceSystem: "cn.1688",
    referenceUrl: "https://detail.1688.com/offer/demo-000000004.html",
    searchTermZh: "佛山 纸盒厂 折叠盒",
    titleZh: "佛山纸品厂 折叠盒 瓦楞彩盒 来图定制",
    observedMinPrice: 0.5,
    observedMaxPrice: 0.9,
    currency: "CNY",
    observedMoq: 5000,
    observedUnit: "pc",
    observedAt: "2026-11-03",
    notes: "Factory named in the listing; created the supplier record from this lead.",
    recordedBy: "Operator (demo)",
    rightsClass: "internal_market_observation",
    status: "linked",
    linkedSupplierId: "sup_lead1",
    dismissedReason: null,
  },
  {
    id: "rl_labels_taobao",
    taxonomy: "Labels",
    sourceSystem: "cn.taobao",
    referenceUrl: "https://item.taobao.com/item.htm?id=demo-5",
    searchTermZh: "标签贴纸 定制",
    titleZh: "创意标签贴纸 定制 小批量",
    observedMinPrice: 0.1,
    observedMaxPrice: 0.3,
    currency: "CNY",
    observedMoq: 100,
    observedUnit: "pc",
    observedAt: "2026-10-20",
    notes: "Consumer print shop; not a factory.",
    recordedBy: "Operator (demo)",
    rightsClass: "internal_market_observation",
    status: "dismissed",
    linkedSupplierId: null,
    dismissedReason: "Not a manufacturer; consumer print shop.",
  },
];

export const TAXONOMIES = ["Labels", "Folding cartons", "Hair bundles"] as const;
