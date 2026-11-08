/**
 * DEMO DATA — NOT REAL SUPPLIER QUOTATIONS. Synthetic brief for the hair-bundles demo project.
 *
 * Models the three stored versions from PRD AC-B1.3 (raw input → AI proposal → confirmed) and the per-field
 * provenance tags from AC-B1.2 (`from_input` | `inferred` | `missing`). The AI proposal shape mirrors what the
 * `brief_normalizer` prompt (B-17, schema `brief_spec_v1`) is expected to return; see handoff H-27.
 */

export type Provenance = "from_input" | "inferred" | "missing";

export interface ProposedField {
  key: string;
  label: string;
  labelZh: string;
  group: "product" | "spec" | "quantity" | "terms";
  /** Hard attributes are used for exact matching once confirmed. */
  hard: boolean;
  value: string | null;
  valueZh: string | null;
  provenance: Provenance;
  /** Verbatim substring of the raw input that supports the value (from_input), or the reasoning (inferred). */
  snippet?: string | undefined;
  reasoning?: string | undefined;
  options?: string[] | undefined;
  unit?: string | undefined;
}

export const BRIEF_PROJECT = {
  id: "prj_demo_hair",
  name: "Raw hair bundles, 18–22 in, natural black",
  family: "Hair bundles",
};

export const BRIEF_RAW_INPUT = {
  text: "Raw Vietnamese hair bundles, natural black, 18 to 22 inches, straight, double weft. About 300 bundles to Atlanta GA 30303. Need to see a sample first. Must be unprocessed, cuticle intact.",
  textZh: "",
  attachments: [{ name: "reference-bundle-photo.jpg", scanned: true }],
  submittedAt: "2026-11-03 10:15",
  submittedBy: "Demo Buyer",
};

export const BRIEF_VERSIONS = [
  {
    version: 1,
    kind: "raw_input" as const,
    label: "Raw input",
    at: "2026-11-03 10:15",
    by: "Demo Buyer",
    note: "Stored exactly as typed, with the attachment reference.",
  },
  {
    version: 2,
    kind: "ai_proposal" as const,
    label: "AI proposal",
    at: "2026-11-03 10:16",
    by: "brief_normalizer v1.0.0",
    note: "Prompt hash 3f9c…e21a · 11 fields proposed · 3 inferred · 3 missing. Stays viewable after confirmation.",
  },
];

export const BRIEF_PROPOSAL: ProposedField[] = [
  {
    key: "productName",
    label: "Product",
    labelZh: "产品",
    group: "product",
    hard: false,
    value: "Raw hair bundles, straight, natural black",
    valueZh: "原生发束，直发，自然黑",
    provenance: "from_input",
    snippet: "Raw Vietnamese hair bundles, natural black",
  },
  {
    key: "origin",
    label: "Declared origin",
    labelZh: "发源地（声明）",
    group: "spec",
    hard: true,
    value: "Vietnamese",
    valueZh: "越南",
    provenance: "from_input",
    snippet: "Vietnamese",
    options: ["Vietnamese", "Chinese", "Indian", "Not sure"],
  },
  {
    key: "texture",
    label: "Texture",
    labelZh: "发质",
    group: "spec",
    hard: true,
    value: "Straight",
    valueZh: "直发",
    provenance: "from_input",
    snippet: "straight",
    options: ["Straight", "Body wave", "Deep wave", "Curly", "Not sure"],
  },
  {
    key: "lengthRange",
    label: "Length range",
    labelZh: "长度",
    group: "spec",
    hard: true,
    value: "18–22 in",
    valueZh: "18–22 英寸",
    provenance: "from_input",
    snippet: "18 to 22 inches",
    unit: "in",
  },
  {
    key: "color",
    label: "Color",
    labelZh: "颜色",
    group: "spec",
    hard: true,
    value: "Natural black (unprocessed)",
    valueZh: "自然黑（未加工）",
    provenance: "from_input",
    snippet: "natural black",
  },
  {
    key: "processing",
    label: "Processing",
    labelZh: "加工状态",
    group: "spec",
    hard: true,
    value: "Unprocessed (raw)",
    valueZh: "未加工（原生）",
    provenance: "from_input",
    snippet: "unprocessed",
    options: ["Unprocessed (raw)", "Steam processed", "Chemically processed", "Not sure"],
  },
  {
    key: "weft",
    label: "Weft type",
    labelZh: "发帘类型",
    group: "spec",
    hard: true,
    value: "Machine double weft",
    valueZh: "机织双层发帘",
    provenance: "inferred",
    snippet: "double weft",
    reasoning:
      "“Double weft” was stated; “machine” was inferred because hand-tied double wefts are uncommon at this quantity. Confirm or change.",
    options: ["Machine double weft", "Hand-tied double weft", "Single weft", "Not sure"],
  },
  {
    key: "weightPerBundle",
    label: "Weight per bundle",
    labelZh: "每束重量",
    group: "spec",
    hard: true,
    value: "100 g",
    valueZh: "100 克",
    provenance: "inferred",
    reasoning:
      "Not stated. 100 g is the common bundle weight for this length range; suppliers also offer 95 g and 120 g.",
    options: ["95 g", "100 g", "120 g", "Not sure"],
  },
  {
    key: "cuticle",
    label: "Cuticle alignment",
    labelZh: "毛鳞片方向",
    group: "spec",
    hard: true,
    value: "Aligned (cuticle intact)",
    valueZh: "顺向（毛鳞片完整）",
    provenance: "inferred",
    snippet: "cuticle intact",
    reasoning:
      "“Cuticle intact” usually means aligned in one direction; some suppliers read it as merely unstripped. Confirm.",
    options: ["Aligned (cuticle intact)", "Intact but not aligned", "Not sure"],
  },
  {
    key: "grade",
    label: "Grade or thickness",
    labelZh: "等级 / 发量",
    group: "spec",
    hard: false,
    value: null,
    valueZh: null,
    provenance: "missing",
    reasoning:
      "Not stated. Optional, but suppliers quote differently for single-donor vs mixed bundles.",
    options: ["Single donor", "Mixed donor", "Not sure"],
  },
  {
    key: "quantity",
    label: "Quantity",
    labelZh: "数量",
    group: "quantity",
    hard: false,
    value: "300 bundles (approximate)",
    valueZh: "约 300 束",
    provenance: "from_input",
    snippet: "About 300 bundles",
    reasoning: "“About” recorded as approximate; suppliers will quote tiers around this quantity.",
  },
  {
    key: "destination",
    label: "Destination",
    labelZh: "目的地",
    group: "quantity",
    hard: false,
    value: "Atlanta, GA 30303",
    valueZh: "美国 GA 30303",
    provenance: "from_input",
    snippet: "Atlanta GA 30303",
  },
  {
    key: "sample",
    label: "Sample approval",
    labelZh: "样品确认",
    group: "terms",
    hard: false,
    value: "Required before production",
    valueZh: "生产前需确认样品",
    provenance: "from_input",
    snippet: "Need to see a sample first",
  },
  {
    key: "incoterm",
    label: "Target trade term",
    labelZh: "目标交易条款",
    group: "terms",
    hard: false,
    value: null,
    valueZh: null,
    provenance: "missing",
    reasoning:
      "Not stated. Leave as “Not sure — advise me” and quotes will be grouped by whatever term each supplier offers.",
    options: ["Not sure — advise me", "EXW", "FCA", "FOB", "CIF", "DAP", "DDP"],
  },
  {
    key: "leadTime",
    label: "Target lead time",
    labelZh: "目标交期",
    group: "terms",
    hard: false,
    value: null,
    valueZh: null,
    provenance: "missing",
    reasoning: "Not stated. Optional.",
    options: ["No target", "Within 4 weeks", "Within 6 weeks", "Within 8 weeks"],
  },
];

export const GROUP_LABEL: Record<ProposedField["group"], string> = {
  product: "Product",
  spec: "Specification (hard attributes are used for exact matching)",
  quantity: "Quantity and destination",
  terms: "Terms and quality",
};
