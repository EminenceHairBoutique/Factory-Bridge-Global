/**
 * 演示数据 — 非真实供应商报价。DEMO DATA — NOT REAL SUPPLIER QUOTATIONS.
 *
 * The 批量导入 template (one row per price tier; product columns repeated) and two sample files:
 * one that imports cleanly and one that shows every validation message. Column semantics mirror
 * `SupplierProduct` in `supplier.ts` and the quote schema (docs/QUOTE_ENGINE_SPEC.md §2.3, ADR-025).
 */

export const CATALOG_TODAY = "2026-11-07";

export type TemplateKey =
  | "nameZh"
  | "nameEn"
  | "specVersion"
  | "unit"
  | "currency"
  | "basisCode"
  | "basisPlace"
  | "tierMin"
  | "tierMax"
  | "unitPrice"
  | "toolingFee"
  | "toolingIncluded"
  | "leadTimeDays"
  | "validUntil"
  | "visibility";

export interface TemplateColumn {
  key: TemplateKey;
  header: string;
  required: boolean;
  hint: string;
  example: string;
}

export const TEMPLATE_VERSION = "catalog-template v1";

export const TEMPLATE_COLUMNS: readonly TemplateColumn[] = [
  {
    key: "nameZh",
    header: "产品名称（中文）",
    required: true,
    hint: "用于匹配现有产品；同一产品的各档价格各占一行，名称须完全一致",
    example: "BOPP 卷筒不干胶标签 50 × 76 mm，四色，哑膜，永久胶",
  },
  {
    key: "nameEn",
    header: "产品名称（英文）",
    required: false,
    hint: "买家所见的英文名称；留空则由平台翻译并标注",
    example: "BOPP roll labels 50 × 76 mm, 4-color, matte lamination, permanent adhesive",
  },
  { key: "specVersion", header: "规格版本", required: true, hint: "例如 v1、v2", example: "v3" },
  { key: "unit", header: "单位", required: true, hint: "件、套、千件等", example: "件" },
  { key: "currency", header: "货币", required: true, hint: "CNY 或 USD", example: "CNY" },
  {
    key: "basisCode",
    header: "交易条款",
    required: true,
    hint: "EXW、FCA、FOB、CFR、CIF、DAP、DPU、DDP；“出厂价”等口语不是条款",
    example: "FOB",
  },
  {
    key: "basisPlace",
    header: "指定地点",
    required: false,
    hint: "FOB、FCA 等条款必须填写，例如 深圳",
    example: "深圳",
  },
  { key: "tierMin", header: "起订量", required: true, hint: "本档数量下限（含）", example: "5000" },
  {
    key: "tierMax",
    header: "数量上限",
    required: false,
    hint: "本档数量上限（不含）；留空表示不封顶",
    example: "10000",
  },
  {
    key: "unitPrice",
    header: "单价",
    required: true,
    hint: "本档单价，按所填货币",
    example: "0.26",
  },
  {
    key: "toolingFee",
    header: "模具费",
    required: false,
    hint: "一次性费用金额；无则留空",
    example: "300",
  },
  {
    key: "toolingIncluded",
    header: "模具费含在单价",
    required: false,
    hint: "是 / 否",
    example: "否",
  },
  {
    key: "leadTimeDays",
    header: "交期（天）",
    required: false,
    hint: "稿件确认后的生产天数",
    example: "15",
  },
  {
    key: "validUntil",
    header: "有效期至",
    required: false,
    hint: "YYYY-MM-DD；留空则标为“有效期未确认”",
    example: "2027-01-31",
  },
  {
    key: "visibility",
    header: "可见范围",
    required: false,
    hint: "仅内部 / 平台买家 / 指定买家；留空为 仅内部",
    example: "指定买家",
  },
];

const HEADER =
  "产品名称（中文）*,产品名称（英文）,规格版本*,单位*,货币*,交易条款*,指定地点,起订量*,数量上限,单价*,模具费,模具费含在单价,交期（天）,有效期至,可见范围";

/** Imports cleanly: one product updated (labels), one unchanged (sleeves), one new (PET labels). */
export const FIXTURE_VALID_CSV = `${HEADER}
"BOPP 卷筒不干胶标签 50 × 76 mm，四色，哑膜，永久胶","BOPP roll labels 50 × 76 mm, 4-color, matte lamination, permanent adhesive",v3,件,CNY,FOB,深圳,5000,10000,0.26,300,否,15,2027-01-31,指定买家
"BOPP 卷筒不干胶标签 50 × 76 mm，四色，哑膜，永久胶",,v3,件,CNY,FOB,深圳,10000,50000,0.21,300,否,15,2027-01-31,指定买家
"BOPP 卷筒不干胶标签 50 × 76 mm，四色，哑膜，永久胶",,v3,件,CNY,FOB,深圳,50000,,0.19,300,否,15,2027-01-31,指定买家
"牛皮纸套 单色印刷","Kraft paper sleeve, 1-color print",v2,件,CNY,FOB,深圳,2000,10000,0.42,,,12,2026-11-20,平台买家
"牛皮纸套 单色印刷",,v2,件,CNY,FOB,深圳,10000,,0.36,,,12,2026-11-20,平台买家
"PET 透明标签 60 × 40 mm","PET clear labels 60 × 40 mm",v1,件,CNY,FOB,深圳,10000,50000,0.31,500,否,14,2027-02-28,平台买家
"PET 透明标签 60 × 40 mm",,v1,件,CNY,FOB,深圳,50000,,0.27,500,否,14,2027-02-28,平台买家
`;

/** Every row has a problem: colloquial term, bad currency and expired date, missing place and bad scope, overlapping tiers, non-numeric price. */
export const FIXTURE_ERRORS_CSV = `${HEADER}
"折叠纸盒 350 g 单铜，四色，哑膜，插舌式","Folding carton 350 gsm C1S, 4-color, matte lamination, tuck-end",v1,件,CNY,出厂价,,3000,5000,1.85,1200,否,18,2026-12-31,仅内部
"PE 自封袋 8 × 12 cm","PE zip bag 8 × 12 cm",v1,件,RMB,EXW,东莞,20000,,0.05,,,10,2026-10-31,平台买家
"铝箔袋 10 × 15 cm","Foil pouch 10 × 15 cm",v1,件,CNY,FOB,,1000,5000,0.80,,,12,2027-01-31,公开
"铝箔袋 10 × 15 cm",,v1,件,CNY,FOB,,3000,,0.70,,,12,2027-01-31,公开
"纸质吊牌 5 × 9 cm","Paper hang tag 5 × 9 cm",v1,件,CNY,FOB,宁波,2000,10000,abc,,,10,2027-03-31,平台买家
`;
