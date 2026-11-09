/**
 * 演示数据 — 非真实供应商报价。DEMO DATA — NOT REAL SUPPLIER QUOTATIONS.
 * Supplier-side view of the quality records in `quality.ts` for 演示供应商A (sup_a): the Chinese
 * order description, the QSR in Chinese (translation checked by the platform), the supplier's own
 * update submissions, and one completed order for history. The shared records (milestones,
 * samples, inspection jobs, findings) are read from `quality.ts` so every workspace agrees.
 */

export const PRODUCTION_TODAY = "2026-11-07";
export const SUPPLIER_ID = "sup_a";

export interface OrderZh {
  trackId: string;
  orderRef: string;
  productZh: string;
  buyerLabel: string;
  quantity: number;
  unit: string;
  specVersion: string;
}

export const ORDERS_ZH: OrderZh[] = [
  {
    trackId: "qt_labels_a",
    orderRef: "PO-DEMO-2026-0412",
    productZh: "BOPP 卷筒不干胶标签 50 × 76 mm 哑膜（潘通 2945 C）",
    buyerLabel: "平台买家（美国 · 新泽西州）",
    quantity: 10_000,
    unit: "件",
    specVersion: "质检标准 v3（买家确认于 2026年10月20日）",
  },
];

/** QSR v3 in Chinese; the English record in `quality.ts` is canonical. */
export const QSR_ZH: Record<
  string,
  {
    critical: string[];
    tests: string[];
    defects: Record<"critical" | "major" | "minor", string[]>;
    checkedBy: string;
    checkedAt: string;
  }
> = {
  qsr_labels_v3: {
    critical: [
      "面材：白色 BOPP，60 µm",
      "胶水：永久型丙烯酸胶",
      "成品尺寸：50 × 76 mm，公差 ±0.5 mm",
      "套印精度：±0.3 mm",
      "卷芯 76 mm，每卷 500 张，出标方向 3",
      "颜色：CMYK + 潘通 2945 C（如有分光仪，ΔE ≤ 2）",
    ],
    tests: ["在买家提供的容器上做粘贴测试（5 个）", "耐磨测试", "冷凝测试（冷链）"],
    defects: {
      critical: ["稿件或文字错误", "缺少法规要求文字"],
      major: ["颜色超出公差", "套印偏差", "边缘翘起", "出标方向错误"],
      minor: ["印刷区外的小污点"],
    },
    checkedBy: "平台运营（演示）",
    checkedAt: "2026-10-20",
  },
};

export const FINDING_ZH: Record<string, string> = {
  df_a1: "一卷套印偏差 0.4 mm（超出 ±0.3 mm），该卷已隔离",
  df_a2: "印刷区外的小污点",
};

export type UpdateState = "待平台核对" | "已转达买家";

export interface SupplierSubmission {
  id: string;
  trackId: string;
  at: string;
  kind: "milestone" | "readiness" | "reschedule" | "corrective";
  summary: string;
  evidence: string[];
  state: UpdateState;
  flags: string[];
}

export const SUBMISSIONS: SupplierSubmission[] = [
  {
    id: "s1",
    trackId: "qt_labels_a",
    at: "2026-11-01 17:20",
    kind: "milestone",
    summary: "材料到位（已发生，2026年11月1日）",
    evidence: ["materials-1101.jpg"],
    state: "已转达买家",
    flags: [],
  },
  {
    id: "s2",
    trackId: "qt_labels_a",
    at: "2026-11-03 09:05",
    kind: "milestone",
    summary: "开始生产（已发生，2026年11月3日）",
    evidence: [],
    state: "已转达买家",
    flags: [],
  },
  {
    id: "s3",
    trackId: "qt_labels_a",
    at: "2026-11-06 18:40",
    kind: "milestone",
    summary: "生产进度 70%（已发生，2026年11月6日）；包装完成预计 2026年11月11日",
    evidence: ["line-photo-1106.jpg"],
    state: "已转达买家",
    flags: [],
  },
];

export interface PastOrder {
  orderRef: string;
  lotCode: string;
  productZh: string;
  buyerLabel: string;
  quantity: number;
  shippedAt: string;
  inspection: string;
  corrective: string;
}

export const PAST_ORDERS: PastOrder[] = [
  {
    orderRef: "PO-DEMO-2026-0388",
    lotCode: "L-0005",
    productZh: "BOPP 卷筒不干胶标签 40 × 60 mm 光膜",
    buyerLabel: "平台买家（美国 · 新泽西州）",
    quantity: 20_000,
    shippedAt: "2026-09-12",
    inspection:
      "批次 L-0005 出货前检验通过（2026年9月8日）：抽检 315 / 20,000 件，依据 ISO 2859-1 一般检验水平 II，AQL 0/2.5/4.0，检验清单 v2",
    corrective: "无整改项",
  },
];

export const RETAINED_ZH: Record<string, string> = {
  gsa_a: "平台办公室（封样袋 GS-A-001），附照片",
};

export const EVIDENCE_SAMPLES = [
  {
    name: "packing-list-L-0007.xlsx",
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    size: 48_000,
    label: "装箱单",
  },
  { name: "packing-photo-01.jpg", type: "image/jpeg", size: 2_400_000, label: "包装照片" },
  { name: "rework-roll-07.jpg", type: "image/jpeg", size: 1_900_000, label: "返工照片" },
  {
    name: "生产记录.docx",
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    size: 120_000,
    label: "生产记录（Word）",
  },
] as const;
