/**
 * 演示数据 — 非真实供应商报价。DEMO DATA — NOT REAL SUPPLIER QUOTATIONS.
 *
 * 演示供应商A's document library (IA `/supplier/documents` 文件资料). Status follows the real
 * `document_status` pipeline; the review state is separate because a scanned and parsed file is
 * still 供应商提供，未核验 until a platform check marks it reviewed (PRD, SECURITY.md T20). File
 * names match the onboarding record in `supplier.ts`; no bytes exist behind these rows.
 */
import type { DocumentStatus } from "@fbg/domain";

export const SUPPLIER_DOCS_TODAY = "2026-11-07";

export type SdCategory = "企业资质" | "报价与询价" | "产品资料" | "样品与检验" | "消息附件";

export const SD_CATEGORIES: SdCategory[] = [
  "企业资质",
  "报价与询价",
  "产品资料",
  "样品与检验",
  "消息附件",
];

export type SdShare = "仅平台" | "已授权买家" | "按产品可见范围";

export const SD_SHARE_EXPLANATION: Record<SdShare, string> = {
  仅平台: "只有平台运营可见。身份类文件永不向买家展示；证书可在“数据共享设置”中开放给买家。",
  已授权买家: "发送给对应询价单或会话的买家可见；其他买家不可见。",
  按产品可见范围: "随产品的可见范围展示给已授权的买家。",
};

export interface SdReview {
  state: "未核验" | "已核验" | "已拒绝";
  by: string | null;
  at: string | null;
  note: string | null;
  /** Platform verification check that references this file, when reviewed. */
  checkRef: string | null;
}

export interface SdLink {
  kind: "认证项" | "询价单" | "产品" | "消息" | "导入";
  label: string;
  href: string | null;
}

export interface SdAccess {
  action: "查看" | "下载" | "签名链接";
  who: string;
  at: string;
}

export interface SupplierDocument {
  id: string;
  name: string;
  category: SdCategory;
  mime: string;
  bytes: number;
  version: number;
  /** "2026-11-05 10:12" */
  uploadedAt: string;
  uploadedBy: "我方" | "平台";
  status: DocumentStatus;
  scanReason: string | null;
  review: SdReview;
  expiresAt: string | null;
  linked: SdLink | null;
  /** Onboarding document type this file satisfies, when it is a certification item. */
  requiredKey: string | null;
  sharedWith: SdShare;
  access: SdAccess[];
  supersedes: string | null;
}

export const SUPPLIER_DOCUMENTS: SupplierDocument[] = [
  {
    id: "sd_licence",
    name: "营业执照-2026.pdf",
    category: "企业资质",
    mime: "application/pdf",
    bytes: 1_240_000,
    version: 1,
    uploadedAt: "2026-10-18 09:40",
    uploadedBy: "我方",
    status: "accepted",
    scanReason: null,
    review: {
      state: "已核验",
      by: "平台运营",
      at: "2026-10-20",
      note: "营业执照与统一社会信用代码一致；注册地址已记录。",
      checkRef: "chk_a_licence",
    },
    expiresAt: null,
    linked: { kind: "认证项", label: "营业执照", href: "/design-preview/supplier/onboarding" },
    requiredKey: "licence",
    sharedWith: "仅平台",
    access: [
      { action: "签名链接", who: "平台运营", at: "2026-10-20 10:05" },
      { action: "查看", who: "平台运营", at: "2026-10-20 10:06" },
    ],
    supersedes: null,
  },
  {
    id: "sd_rep",
    name: "授权书+身份证.pdf",
    category: "企业资质",
    mime: "application/pdf",
    bytes: 2_030_000,
    version: 1,
    uploadedAt: "2026-10-18 09:52",
    uploadedBy: "我方",
    status: "accepted",
    scanReason: null,
    review: {
      state: "已核验",
      by: "平台运营",
      at: "2026-10-20",
      note: "授权书已加盖公章；授权代表身份与登记信息一致。",
      checkRef: "chk_a_rep",
    },
    expiresAt: null,
    linked: {
      kind: "认证项",
      label: "法定代表人或授权代表身份证明",
      href: "/design-preview/supplier/onboarding",
    },
    requiredKey: "rep_id",
    sharedWith: "仅平台",
    access: [{ action: "查看", who: "平台运营", at: "2026-10-20 10:12" }],
    supersedes: null,
  },
  {
    id: "sd_premises_rejected",
    name: "厂房照片.zip",
    category: "企业资质",
    mime: "application/zip",
    bytes: 18_400_000,
    version: 1,
    uploadedAt: "2026-11-06 15:20",
    uploadedBy: "我方",
    status: "rejected",
    scanReason: "压缩包不支持。请直接上传 JPG、PNG 或 PDF；文件将在 7 天后从隔离区删除。",
    review: { state: "未核验", by: null, at: null, note: null, checkRef: null },
    expiresAt: null,
    linked: { kind: "认证项", label: "生产场地证明", href: "/design-preview/supplier/onboarding" },
    requiredKey: "premises",
    sharedWith: "仅平台",
    access: [],
    supersedes: null,
  },
  {
    id: "sd_export",
    name: "对外贸易经营者备案.pdf",
    category: "企业资质",
    mime: "application/pdf",
    bytes: 640_000,
    version: 1,
    uploadedAt: "2026-11-05 11:30",
    uploadedBy: "我方",
    status: "in_review",
    scanReason: null,
    review: { state: "未核验", by: null, at: null, note: null, checkRef: null },
    expiresAt: null,
    linked: { kind: "认证项", label: "出口资质", href: "/design-preview/supplier/onboarding" },
    requiredKey: "export",
    sharedWith: "仅平台",
    access: [{ action: "签名链接", who: "平台运营", at: "2026-11-06 09:15" }],
    supersedes: null,
  },
  {
    id: "sd_iso",
    name: "ISO9001-证书.pdf",
    category: "企业资质",
    mime: "application/pdf",
    bytes: 880_000,
    version: 1,
    uploadedAt: "2026-10-25 14:02",
    uploadedBy: "我方",
    status: "accepted",
    scanReason: null,
    review: {
      state: "已核验",
      by: "平台运营",
      at: "2026-10-28",
      note: "证书编号已在发证机构网站核对。买家仅在您开放“证书与检测报告”后看到。",
      checkRef: "chk_a_iso",
    },
    expiresAt: "2026-11-30",
    linked: {
      kind: "认证项",
      label: "体系与产品证书",
      href: "/design-preview/supplier/onboarding",
    },
    requiredKey: "certs",
    sharedWith: "仅平台",
    access: [{ action: "查看", who: "平台运营", at: "2026-10-28 16:40" }],
    supersedes: null,
  },
  {
    id: "sd_quote_022",
    name: "报价单-RFQ-DEMO-2026-022.pdf",
    category: "报价与询价",
    mime: "application/pdf",
    bytes: 310_000,
    version: 1,
    uploadedAt: "2026-11-03 10:48",
    uploadedBy: "我方",
    status: "accepted",
    scanReason: null,
    review: {
      state: "已核验",
      by: "平台运营",
      at: "2026-11-03",
      note: "已审核并转达买家；买家比价使用的是您在“提交报价”中填写的结构化价格，此文件作为依据保存。",
      checkRef: null,
    },
    expiresAt: null,
    linked: {
      kind: "询价单",
      label: "RFQ-DEMO-2026-022 · 牛皮纸套 单色印刷",
      href: "/design-preview/supplier/rfqs?rfq=rfq_3",
    },
    requiredKey: null,
    sharedWith: "已授权买家",
    access: [
      { action: "签名链接", who: "平台运营", at: "2026-11-03 14:10" },
      { action: "查看", who: "平台买家（美国 · 佐治亚州）", at: "2026-11-04 02:35" },
    ],
    supersedes: null,
  },
  {
    id: "sd_spec_labels",
    name: "标签规格书-v3.pdf",
    category: "产品资料",
    mime: "application/pdf",
    bytes: 450_000,
    version: 3,
    uploadedAt: "2026-10-30 16:05",
    uploadedBy: "我方",
    status: "parsed",
    scanReason: null,
    review: { state: "未核验", by: null, at: null, note: null, checkRef: null },
    expiresAt: null,
    linked: {
      kind: "产品",
      label: "BOPP 卷筒不干胶标签 50 × 76 mm · 规格 v3",
      href: "/design-preview/supplier/pricing?product=sp_labels",
    },
    requiredKey: null,
    sharedWith: "按产品可见范围",
    access: [{ action: "查看", who: "平台买家（美国 · 新泽西州）", at: "2026-11-05 03:10" }],
    supersedes: "sd_spec_labels_v2",
  },
  {
    id: "sd_catalog_import",
    name: "catalog-2026-11.csv",
    category: "产品资料",
    mime: "text/csv",
    bytes: 18_400,
    version: 1,
    uploadedAt: "2026-11-07 08:55",
    uploadedBy: "我方",
    status: "parsed",
    scanReason: null,
    review: { state: "未核验", by: null, at: null, note: null, checkRef: null },
    expiresAt: null,
    linked: {
      kind: "导入",
      label: "批量导入 · 7 行 · 2 个产品待确认",
      href: "/design-preview/supplier/catalog/import",
    },
    requiredKey: null,
    sharedWith: "仅平台",
    access: [],
    supersedes: null,
  },
  {
    id: "sd_sample_photo",
    name: "签样照片-标签.jpg",
    category: "样品与检验",
    mime: "image/jpeg",
    bytes: 2_100_000,
    version: 1,
    uploadedAt: "2026-10-24 16:35",
    uploadedBy: "我方",
    status: "accepted",
    scanReason: null,
    review: {
      state: "已核验",
      by: "平台运营",
      at: "2026-10-28",
      note: "买家已确认签样通过；平台已记录“样品已确认”核验项。",
      checkRef: "chk_a_sample",
    },
    expiresAt: null,
    linked: {
      kind: "消息",
      label: "签样：50 × 76 mm 哑膜 BOPP 标签",
      href: "/design-preview/supplier/messages?thread=sm_sample",
    },
    requiredKey: null,
    sharedWith: "已授权买家",
    access: [{ action: "查看", who: "平台买家（美国 · 新泽西州）", at: "2026-10-25 01:20" }],
    supersedes: null,
  },
];
