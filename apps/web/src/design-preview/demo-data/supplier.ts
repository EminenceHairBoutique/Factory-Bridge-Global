/**
 * 演示数据 — 非真实供应商报价。DEMO DATA — NOT REAL SUPPLIER QUOTATIONS.
 *
 * Synthetic records for the supplier (zh-CN) prototypes. Buyer identity is shown as "平台买家" because supplier
 * views never reveal a buyer organisation without a recorded grant. No contact details exist in these fixtures.
 */

export type ZhVisibility = "仅内部" | "平台买家" | "指定买家";
export type ZhPriceStatus = "已确认" | "待确认" | "有效期未确认" | "即将过期" | "已过期" | "已暂停";
export type IncotermCode =
  "EXW" | "FCA" | "FOB" | "CFR" | "CIF" | "DAP" | "DPU" | "DDP" | "unknown";

export const INCOTERM_GLOSS: Record<IncotermCode, string> = {
  EXW: "EXW 工厂交货",
  FCA: "FCA 货交承运人",
  FOB: "FOB 离岸价",
  CFR: "CFR 成本加运费",
  CIF: "CIF 到岸价（含保险）",
  DAP: "DAP 目的地交货",
  DPU: "DPU 卸货地交货",
  DDP: "DDP 完税后交货",
  unknown: "未注明（请确认）",
};

/** Terms whose price only makes sense with a named place. */
export const PLACE_REQUIRED: ReadonlySet<IncotermCode> = new Set([
  "FCA",
  "FOB",
  "CFR",
  "CIF",
  "DAP",
  "DPU",
  "DDP",
]);

export interface SupplierTier {
  id: number;
  minQty: number | null;
  maxQty: number | null;
  unitPrice: number | null;
}

export interface SupplierProduct {
  id: string;
  nameZh: string;
  nameEn: string;
  specVersion: string;
  unit: string;
  currency: "CNY" | "USD";
  basis: { code: IncotermCode; place: string; colloquial?: string | undefined };
  tiers: SupplierTier[];
  toolingFee: { amount: number; included: boolean } | null;
  leadTimeDays: number | null;
  validUntil: string | null;
  confirmedAt: string | null;
  status: ZhPriceStatus;
  visibility: ZhVisibility;
  namedBuyers?: string[] | undefined;
}

export const SUPPLIER_PROFILE = {
  nameZh: "演示供应商A",
  nameEn: "Supplier A (demo)",
  city: "深圳",
  verification: {
    overall: "需补充" as "待审核" | "已核验" | "需补充",
    items: [
      { label: "营业执照", status: "已核验" as const, date: "2026-10-20" },
      { label: "法定代表人身份", status: "已核验" as const, date: "2026-10-20" },
      {
        label: "生产场地证明",
        status: "需补充" as const,
        note: "请上传近期厂房照片或租赁合同（将标注为“供应商提供，未核验”，待平台审核）",
      },
      { label: "出口资质", status: "待审核" as const, date: "2026-11-05" },
    ],
  },
};

export const SUPPLIER_PRODUCTS: SupplierProduct[] = [
  {
    id: "sp_labels",
    nameZh: "BOPP 卷筒不干胶标签 50 × 76 mm，四色，哑膜，永久胶",
    nameEn: "BOPP roll labels 50 × 76 mm, 4-color, matte lamination, permanent adhesive",
    specVersion: "v3",
    unit: "件",
    currency: "CNY",
    basis: { code: "FOB", place: "深圳" },
    tiers: [
      { id: 1, minQty: 5_000, maxQty: 10_000, unitPrice: 0.26 },
      { id: 2, minQty: 10_000, maxQty: 50_000, unitPrice: 0.21 },
    ],
    toolingFee: { amount: 300, included: false },
    leadTimeDays: 15,
    validUntil: "2026-12-15",
    confirmedAt: "2026-11-04",
    status: "已确认",
    visibility: "指定买家",
    namedBuyers: ["Demo Buyer Co."],
  },
  {
    id: "sp_cartons",
    nameZh: "折叠纸盒 350 g 单铜，四色，哑膜，插舌式",
    nameEn: "Folding carton 350 gsm C1S, 4-color, matte lamination, tuck-end",
    specVersion: "v1",
    unit: "件",
    currency: "CNY",
    basis: { code: "unknown", place: "", colloquial: "出厂价" },
    tiers: [
      { id: 1, minQty: 3_000, maxQty: 5_000, unitPrice: 1.85 },
      { id: 2, minQty: 5_000, maxQty: 10_000, unitPrice: 1.62 },
      { id: 3, minQty: 10_000, maxQty: null, unitPrice: 1.48 },
    ],
    toolingFee: { amount: 1_200, included: false },
    leadTimeDays: 18,
    validUntil: null,
    confirmedAt: null,
    status: "待确认",
    visibility: "仅内部",
  },
  {
    id: "sp_sleeves",
    nameZh: "牛皮纸套 单色印刷",
    nameEn: "Kraft paper sleeve, 1-color print",
    specVersion: "v2",
    unit: "件",
    currency: "CNY",
    basis: { code: "FOB", place: "深圳" },
    tiers: [
      { id: 1, minQty: 2_000, maxQty: 10_000, unitPrice: 0.42 },
      { id: 2, minQty: 10_000, maxQty: null, unitPrice: 0.36 },
    ],
    toolingFee: null,
    leadTimeDays: 12,
    validUntil: "2026-11-20",
    confirmedAt: "2026-10-18",
    status: "即将过期",
    visibility: "平台买家",
  },
  {
    id: "sp_bags",
    nameZh: "PE 自封袋 8 × 12 cm",
    nameEn: "PE zip bag 8 × 12 cm",
    specVersion: "v1",
    unit: "件",
    currency: "CNY",
    basis: { code: "EXW", place: "东莞" },
    tiers: [{ id: 1, minQty: 20_000, maxQty: null, unitPrice: 0.05 }],
    toolingFee: null,
    leadTimeDays: 10,
    validUntil: "2026-10-31",
    confirmedAt: "2026-09-30",
    status: "已过期",
    visibility: "平台买家",
  },
];

export type RfqStatus = "待回复" | "需要澄清" | "已报价" | "已拒绝";

export interface SupplierRfq {
  id: string;
  ref: string;
  buyerLabel: string;
  productZh: string;
  productEn: string;
  quantity: number;
  unit: string;
  destination: string;
  targetBasis: string;
  receivedAt: string;
  replyBy: string;
  status: RfqStatus;
  spec: Array<{ zh: string; en: string; value: string; hard: boolean }>;
  notes: string;
  attachments: Array<{ name: string; scanned: boolean }>;
  clarification?: { question: string; questionEn: string; askedAt: string } | undefined;
  submittedAt?: string | undefined;
}

export const SUPPLIER_RFQS: SupplierRfq[] = [
  {
    id: "rfq_1",
    ref: "RFQ-DEMO-2026-031",
    buyerLabel: "平台买家（美国 · 新泽西州）",
    productZh: "BOPP 卷筒不干胶标签 50 × 76 mm",
    productEn: "Custom BOPP roll labels, 50 × 76 mm",
    quantity: 10_000,
    unit: "件",
    destination: "美国 NJ 07102",
    targetBasis: "FOB 深圳（如可行）",
    receivedAt: "2026-11-06",
    replyBy: "2026-11-13",
    status: "待回复",
    spec: [
      { zh: "面材", en: "Material", value: "BOPP（白色）", hard: true },
      { zh: "尺寸", en: "Size", value: "50 × 76 mm", hard: true },
      { zh: "印刷", en: "Print", value: "四色（CMYK）", hard: true },
      { zh: "表面处理", en: "Finish", value: "哑膜", hard: true },
      { zh: "胶水", en: "Adhesive", value: "永久胶", hard: true },
      { zh: "卷芯", en: "Core", value: "76 mm（3 in）", hard: false },
      { zh: "卷向", en: "Wind direction", value: "外卷，#4", hard: false },
      { zh: "每卷标签数", en: "Labels per roll", value: "500", hard: false },
    ],
    notes: "买家要求在生产前确认样品；稿件已随附。请注明模具费是否包含在单价内。",
    attachments: [{ name: "artwork-lavender-v2.pdf", scanned: true }],
  },
  {
    id: "rfq_2",
    ref: "RFQ-DEMO-2026-027",
    buyerLabel: "平台买家（美国 · 加利福尼亚州）",
    productZh: "折叠纸盒 350 g 单铜 哑膜",
    productEn: "Folding cartons, 350 gsm C1S, matte",
    quantity: 5_000,
    unit: "件",
    destination: "美国 CA 90745",
    targetBasis: "未指定",
    receivedAt: "2026-11-02",
    replyBy: "2026-11-09",
    status: "需要澄清",
    spec: [
      { zh: "纸张", en: "Board", value: "350 g 单铜", hard: true },
      { zh: "尺寸", en: "Size", value: "120 × 60 × 40 mm", hard: true },
      { zh: "印刷", en: "Print", value: "四色（CMYK）", hard: true },
      { zh: "表面处理", en: "Finish", value: "哑膜", hard: true },
      { zh: "盒型", en: "Carton style", value: "插舌式", hard: false },
    ],
    notes: "",
    attachments: [{ name: "dieline-120x60x40.pdf", scanned: true }],
    clarification: {
      question:
        "您提供的“出厂价”是否指 EXW 东莞？请确认交易条款与指定地点，以及刀模费是否已包含在单价内。",
      questionEn:
        "Does “出厂价” mean EXW Dongguan? Please confirm the trade term with its named place, and whether the tooling fee is included in the unit price.",
      askedAt: "2026-11-05",
    },
  },
  {
    id: "rfq_3",
    ref: "RFQ-DEMO-2026-022",
    buyerLabel: "平台买家（美国 · 佐治亚州）",
    productZh: "牛皮纸套 单色印刷",
    productEn: "Kraft paper sleeves, printed 1-color",
    quantity: 8_000,
    unit: "件",
    destination: "美国 GA 30303",
    targetBasis: "FOB",
    receivedAt: "2026-10-28",
    replyBy: "2026-11-04",
    status: "已报价",
    spec: [
      { zh: "纸张", en: "Paper", value: "牛皮纸 120 g", hard: true },
      { zh: "印刷", en: "Print", value: "单色", hard: true },
    ],
    notes: "",
    attachments: [],
    submittedAt: "2026-11-03",
  },
  {
    id: "rfq_4",
    ref: "RFQ-DEMO-2026-019",
    buyerLabel: "平台买家（美国 · 德克萨斯州）",
    productZh: "PET 透明标签",
    productEn: "Clear PET labels",
    quantity: 2_000,
    unit: "件",
    destination: "美国 TX 75001",
    targetBasis: "DDP",
    receivedAt: "2026-10-20",
    replyBy: "2026-10-27",
    status: "已拒绝",
    spec: [],
    notes: "",
    attachments: [],
  },
];

export interface SharingField {
  key: string;
  label: string;
  description: string;
  scope: ZhVisibility;
  locked?: boolean | undefined;
  lockNote?: string | undefined;
}

export const SHARING_FIELDS: SharingField[] = [
  {
    key: "profile",
    label: "企业基本信息",
    description: "企业名称、所在城市、主营品类",
    scope: "平台买家",
  },
  { key: "catalog", label: "产品目录（名称与规格）", description: "不含价格", scope: "平台买家" },
  { key: "tiers", label: "阶梯价格", description: "起订量、数量区间与单价", scope: "指定买家" },
  { key: "images", label: "产品图片", description: "目录图片与样品照片", scope: "仅内部" },
  {
    key: "certs",
    label: "证书与检测报告",
    description: "上传后标注为“供应商提供，未核验”",
    scope: "仅内部",
  },
  { key: "capacity", label: "产能与交期", description: "月产能、标准交期", scope: "平台买家" },
  {
    key: "contacts",
    label: "联系人信息",
    description: "姓名、职务、微信号、电话",
    scope: "仅内部",
    locked: true,
    lockNote: "联系人信息仅在您签署披露授权后，向特定买家显示；平台内部仅限被指派的运营人员查看。",
  },
];

export const SHARING_GRANTS = [
  {
    id: "g1",
    buyer: "Demo Buyer Co.",
    field: "阶梯价格",
    since: "2026-10-20",
    until: "2027-04-20",
    status: "有效" as "有效" | "已撤销",
  },
];

/* ---- 企业认证 (onboarding) ------------------------------------------------------------------------ */

export type DocStatus = "待上传" | "待审核" | "已核验" | "需补充";

export interface OnboardingDocType {
  key: string;
  label: string;
  hint: string;
  required: boolean;
  /** Only required for 生产型工厂 / 工贸一体. */
  factoryOnly?: boolean | undefined;
  certification?: boolean | undefined;
}

export const ONBOARDING_DOC_TYPES: OnboardingDocType[] = [
  {
    key: "licence",
    label: "营业执照",
    hint: "彩色扫描件或清晰照片，需显示统一社会信用代码",
    required: true,
  },
  {
    key: "rep_id",
    label: "法定代表人或授权代表身份证明",
    hint: "身份证正反面；如为授权代表，另需加盖公章的授权书",
    required: true,
  },
  {
    key: "premises",
    label: "生产场地证明",
    hint: "近期厂房照片（含门头与车间）或租赁合同首页",
    required: true,
    factoryOnly: true,
  },
  {
    key: "export",
    label: "出口资质",
    hint: "对外贸易经营者备案登记表或海关注册登记",
    required: false,
  },
  {
    key: "certs",
    label: "体系与产品证书",
    hint: "ISO、BRC、FSC、检测报告等。核验前不会向买家显示为“已认证”",
    required: false,
    certification: true,
  },
  {
    key: "samples",
    label: "样品与车间照片",
    hint: "有助于运营人员判断产能与工艺",
    required: false,
  },
];

export interface OnboardingDoc {
  key: string;
  fileName: string | null;
  size: number | null;
  status: DocStatus;
  reviewerNote?: string | undefined;
  reviewedAt?: string | undefined;
}

export interface OnboardingData {
  company: {
    legalName: string;
    uscc: string;
    companyType: "生产型工厂" | "贸易公司" | "工贸一体" | "";
    province: string;
    city: string;
    address: string;
    foundedYear: string;
    families: string[];
  };
  representative: {
    name: string;
    title: string;
    email: string;
    mobile: string;
    authority: "法定代表人本人" | "授权代表（附授权书）" | "";
    wechat: string;
    contactBasis: boolean;
  };
  documents: OnboardingDoc[];
  trade: {
    incoterms: string[];
    exportExperience: "有" | "无" | "";
    ports: string[];
    currencies: string[];
    monthlyCapacity: string;
    standardLeadDays: string;
    thirdPartyInspection: "接受" | "不接受" | "";
    samples: "可提供" | "不提供" | "";
    sampleFeeNote: string;
  };
  consent: {
    dataProcessing: boolean;
    truthfulness: boolean;
    catalogDefaultInternal: boolean;
  };
}

/** Resume scenario matching 工作台: licence and identity verified, premises proof requested, export pending. */
export const ONBOARDING_PREFILL: OnboardingData = {
  company: {
    legalName: "深圳市演示标签印刷有限公司",
    uscc: "91440300MA5DEM00A5",
    companyType: "生产型工厂",
    province: "广东省",
    city: "深圳市",
    address: "宝安区演示路 88 号 3 栋",
    foundedYear: "2014",
    families: ["卷筒不干胶标签", "折叠纸盒"],
  },
  representative: {
    name: "李演示",
    title: "外贸经理",
    email: "sales@demo-supplier.example",
    mobile: "13800138000",
    authority: "授权代表（附授权书）",
    wechat: "",
    contactBasis: true,
  },
  documents: [
    {
      key: "licence",
      fileName: "营业执照-2026.pdf",
      size: 1_240_000,
      status: "已核验",
      reviewedAt: "2026-10-20",
    },
    {
      key: "rep_id",
      fileName: "授权书+身份证.pdf",
      size: 2_030_000,
      status: "已核验",
      reviewedAt: "2026-10-20",
    },
    {
      key: "premises",
      fileName: null,
      size: null,
      status: "需补充",
      reviewerNote:
        "平台运营（2026年11月5日）：请上传近期厂房照片（含门头与车间）或租赁合同首页，用于核对注册地址与生产场地是否一致。",
    },
    { key: "export", fileName: "对外贸易经营者备案.pdf", size: 640_000, status: "待审核" },
    { key: "certs", fileName: null, size: null, status: "待上传" },
    { key: "samples", fileName: null, size: null, status: "待上传" },
  ],
  trade: {
    incoterms: ["EXW", "FOB", "CIF"],
    exportExperience: "有",
    ports: ["深圳", "广州"],
    currencies: ["CNY", "USD"],
    monthlyCapacity: "约 2,000 万枚标签 / 50 万只纸盒",
    standardLeadDays: "15",
    thirdPartyInspection: "接受",
    samples: "可提供",
    sampleFeeNote: "样品费按实收取，批量订单后抵扣",
  },
  consent: { dataProcessing: true, truthfulness: true, catalogDefaultInternal: true },
};

export const ONBOARDING_EMPTY: OnboardingData = {
  company: {
    legalName: "",
    uscc: "",
    companyType: "",
    province: "",
    city: "",
    address: "",
    foundedYear: "",
    families: [],
  },
  representative: {
    name: "",
    title: "",
    email: "",
    mobile: "",
    authority: "",
    wechat: "",
    contactBasis: false,
  },
  documents: ONBOARDING_DOC_TYPES.map((d) => ({
    key: d.key,
    fileName: null,
    size: null,
    status: "待上传" as const,
  })),
  trade: {
    incoterms: [],
    exportExperience: "",
    ports: [],
    currencies: [],
    monthlyCapacity: "",
    standardLeadDays: "",
    thirdPartyInspection: "",
    samples: "",
    sampleFeeNote: "",
  },
  consent: { dataProcessing: false, truthfulness: false, catalogDefaultInternal: true },
};

export const FAMILY_OPTIONS = ["卷筒不干胶标签", "折叠纸盒", "人发发束", "其他（需平台评估）"];
export const PORT_OPTIONS = ["深圳", "广州", "宁波", "上海", "青岛", "厦门"];
