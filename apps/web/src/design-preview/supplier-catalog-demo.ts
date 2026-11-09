/**
 * Display-only rules for the supplier 产品目录 and 批量导入 previews: a small CSV reader, the
 * template, per-row validation in Chinese that reuses the tier and basis validators, the diff
 * against existing products, and the local "apply" that lands every imported price as 待确认.
 * The real import parses XLSX and CSV server-side in an isolated worker (docs/SECURITY.md §4),
 * re-validates every row and writes audit rows; nothing here is that pipeline.
 */
import {
  INCOTERM_GLOSS,
  type IncotermCode,
  type SupplierProduct,
  type SupplierTier,
  type ZhPriceStatus,
  type ZhVisibility,
} from "./demo-data/supplier";
import { TEMPLATE_COLUMNS, type TemplateKey } from "./demo-data/supplier-import";
import { formatZhQty, tierRangeZh, validateBasis, validateTiers } from "./supplier-demo";

export const PRICE_TONE: Record<ZhPriceStatus, "ok" | "warn" | "danger" | "neutral"> = {
  已确认: "ok",
  待确认: "warn",
  有效期未确认: "warn",
  即将过期: "warn",
  已过期: "danger",
  已暂停: "neutral",
};

export const VISIBILITY_EXPLANATION: Record<ZhVisibility, string> = {
  仅内部: "只有平台运营可见；买家看不到此产品和价格。",
  平台买家: "已确认的价格按“数据共享设置”中的授权向平台买家展示。",
  指定买家: "只向您在阶梯报价中指定、并由平台记录授权的买家展示。",
};

/* ---- CSV ------------------------------------------------------------------------------------- */

const BOM = String.fromCharCode(0xfeff);

/** RFC 4180 reader: quoted fields, doubled quotes, CRLF, a leading byte-order mark; blank lines dropped. */
export function parseCsv(text: string): string[][] {
  const s = text.startsWith(BOM) ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < s.length; i += 1) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i += 1;
        } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && s[i + 1] === "\n") i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((f) => f.trim().length > 0));
}

function normalizeHeader(h: string): string {
  return h.replace(/\*/g, "").replace(/\s+/g, "").trim();
}

export interface ImportRow {
  rowNo: number;
  values: Record<TemplateKey, string>;
}

export interface ImportTable {
  rows: ImportRow[];
  missingColumns: string[];
  unknownColumns: string[];
}

/** Maps the file's header row onto the template columns; data rows are numbered from 2 like a spreadsheet. */
export function readImportTable(text: string): ImportTable {
  const raw = parseCsv(text);
  const header = raw[0] ?? [];
  const index = new Map<TemplateKey, number>();
  const unknown: string[] = [];
  header.forEach((h, i) => {
    const n = normalizeHeader(h);
    const col = TEMPLATE_COLUMNS.find((c) => normalizeHeader(c.header) === n || c.key === n);
    if (col) index.set(col.key, i);
    else if (n.length > 0) unknown.push(h.trim());
  });
  const missing = TEMPLATE_COLUMNS.filter((c) => c.required && !index.has(c.key)).map(
    (c) => c.header,
  );
  const rows: ImportRow[] = raw.slice(1).map((r, i) => {
    const values = Object.fromEntries(
      TEMPLATE_COLUMNS.map((c) => {
        const at = index.get(c.key);
        return [c.key, at === undefined ? "" : (r[at] ?? "").trim()];
      }),
    ) as Record<TemplateKey, string>;
    return { rowNo: i + 2, values };
  });
  return { rows, missingColumns: missing, unknownColumns: unknown };
}

function csvCell(v: string): string {
  return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/** The downloadable template: header plus one worked product with two tiers. The screen adds the byte-order mark. */
export function templateCsv(): string {
  const header = TEMPLATE_COLUMNS.map((c) => c.header + (c.required ? "*" : "")).join(",");
  const first = TEMPLATE_COLUMNS.map((c) => csvCell(c.example)).join(",");
  const secondRow: Partial<Record<TemplateKey, string>> = {
    nameEn: "",
    tierMin: "10000",
    tierMax: "",
    unitPrice: "0.21",
  };
  const second = TEMPLATE_COLUMNS.map((c) => secondRow[c.key] ?? csvCell(c.example)).join(",");
  return `${header}\n${first}\n${second}\n`;
}

/* ---- Validation and diff --------------------------------------------------------------------- */

const CODES: IncotermCode[] = ["EXW", "FCA", "FOB", "CFR", "CIF", "DAP", "DPU", "DDP"];
const SCOPES: ZhVisibility[] = ["仅内部", "平台买家", "指定买家"];
const COLLOQUIAL = /出厂价|离岸价|到岸价|工厂价/;

export interface ProductDraft {
  nameZh: string;
  nameEn: string;
  specVersion: string;
  unit: string;
  currency: "CNY" | "USD";
  basis: { code: IncotermCode; place: string };
  tiers: SupplierTier[];
  toolingFee: { amount: number; included: boolean } | null;
  leadTimeDays: number | null;
  validUntil: string | null;
  visibility: ZhVisibility;
}

export type ImportStatus = "新增" | "更新" | "未变化" | "错误";

export interface ImportDiff {
  field: string;
  before: string;
  after: string;
}

export interface ImportEntry {
  key: string;
  rows: number[];
  draft: ProductDraft | null;
  existingId: string | null;
  status: ImportStatus;
  errors: string[];
  warnings: string[];
  diffs: ImportDiff[];
}

function num(v: string): number | null {
  const cleaned = v.replace(/[,，¥￥$\s]/g, "");
  if (cleaned.length === 0) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function basisLabel(code: IncotermCode, place: string, colloquial?: string): string {
  if (code === "unknown") return `未注明${colloquial ? `（${colloquial}）` : ""}`;
  return place ? `${code} ${place}` : code;
}

function tiersLabel(tiers: readonly SupplierTier[]): string {
  if (tiers.length === 0) return "无";
  return `${tiers.length} 档：${tiers
    .map((t) => `${tierRangeZh(t)} @ ${t.unitPrice === null ? "—" : t.unitPrice}`)
    .join("；")}`;
}

function toolingLabel(t: { amount: number; included: boolean } | null): string {
  return t ? `${formatZhQty(t.amount)}（${t.included ? "含在单价" : "不含单价"}）` : "无";
}

function sameTiers(a: readonly SupplierTier[], b: readonly SupplierTier[]): boolean {
  return (
    a.length === b.length &&
    a.every((t, i) => {
      const u = b[i];
      return !!u && t.minQty === u.minQty && t.maxQty === u.maxQty && t.unitPrice === u.unitPrice;
    })
  );
}

const PRODUCT_LEVEL: Array<{ key: TemplateKey; label: string }> = [
  { key: "specVersion", label: "规格版本" },
  { key: "unit", label: "单位" },
  { key: "currency", label: "货币" },
  { key: "basisCode", label: "交易条款" },
  { key: "basisPlace", label: "指定地点" },
  { key: "toolingFee", label: "模具费" },
  { key: "toolingIncluded", label: "模具费含在单价" },
  { key: "leadTimeDays", label: "交期" },
  { key: "validUntil", label: "有效期至" },
  { key: "visibility", label: "可见范围" },
];

/**
 * Groups rows by 产品名称（中文）, validates each product in Chinese and diffs it against the
 * existing catalog. Rows with errors never import; the rest may.
 */
export function buildImportPreview(
  text: string,
  existing: readonly SupplierProduct[],
  today: string,
): { entries: ImportEntry[]; fileErrors: string[] } {
  const table = readImportTable(text);
  const fileErrors: string[] = [];
  if (table.rows.length === 0) fileErrors.push("文件没有数据行。");
  if (table.missingColumns.length > 0)
    fileErrors.push(`模板缺少列：${table.missingColumns.join("、")}。请使用最新模板。`);
  if (fileErrors.length > 0) return { entries: [], fileErrors };

  const groups = new Map<string, ImportRow[]>();
  for (const r of table.rows) {
    const key = r.values.nameZh.length > 0 ? r.values.nameZh : `__row_${r.rowNo}`;
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }

  const entries: ImportEntry[] = [];
  for (const [key, rows] of groups) {
    const errors: string[] = [];
    const warnings: string[] = [];
    const first = rows[0]!;
    const v = first.values;
    const at = (row: ImportRow, msg: string) => `第 ${row.rowNo} 行：${msg}`;

    if (v.nameZh.length === 0) errors.push(at(first, "缺少产品名称（中文）"));
    for (const r of rows.slice(1))
      for (const f of PRODUCT_LEVEL) {
        const a = v[f.key];
        const b = r.values[f.key];
        if (b.length > 0 && a !== b)
          errors.push(at(r, `与第 ${first.rowNo} 行的产品信息不一致（${f.label}）`));
      }
    if (v.specVersion.length === 0) errors.push(at(first, "缺少规格版本"));
    if (v.unit.length === 0) errors.push(at(first, "缺少单位"));

    const currencyRaw = v.currency.toUpperCase();
    const currency: "CNY" | "USD" | null =
      currencyRaw === "CNY" || currencyRaw === "USD" ? currencyRaw : null;
    if (!currency) errors.push(at(first, "货币须为 CNY 或 USD"));

    const codeRaw = v.basisCode.toUpperCase();
    let code: IncotermCode | null = null;
    if (COLLOQUIAL.test(v.basisCode))
      errors.push(
        at(first, `“${v.basisCode}”不是交易条款代码，请使用 EXW、FOB 等正式代码并填写指定地点`),
      );
    else if ((CODES as string[]).includes(codeRaw)) code = codeRaw as IncotermCode;
    else errors.push(at(first, "交易条款代码无效（EXW、FCA、FOB、CFR、CIF、DAP、DPU、DDP）"));
    if (code) {
      const issue = validateBasis(code, v.basisPlace);
      if (issue?.level === "error") errors.push(at(first, issue.message));
      else if (issue) warnings.push(at(first, issue.message));
    }

    const tiers: SupplierTier[] = rows.map((r, i) => {
      const min = num(r.values.tierMin);
      const max = r.values.tierMax.length === 0 ? null : num(r.values.tierMax);
      const price = num(r.values.unitPrice);
      if (min === null || !Number.isInteger(min) || min <= 0)
        errors.push(at(r, "起订量须为大于 0 的整数"));
      if (r.values.tierMax.length > 0 && (max === null || !Number.isInteger(max)))
        errors.push(at(r, "数量上限须为整数或留空"));
      if (price === null || price < 0) errors.push(at(r, "单价须为数字"));
      return { id: i + 1, minQty: min, maxQty: max, unitPrice: price };
    });
    const tierCheck = validateTiers(tiers);
    for (const e of tierCheck.errors) {
      const row = rows[e.row - 1] ?? first;
      if (e.code !== "min_required" && e.code !== "price_required") errors.push(at(row, e.message));
    }
    for (const w of tierCheck.warnings) warnings.push(at(rows[w.row - 1] ?? first, w.message));

    let toolingFee: ProductDraft["toolingFee"] = null;
    if (v.toolingFee.length > 0) {
      const amount = num(v.toolingFee);
      if (amount === null || amount < 0) errors.push(at(first, "模具费须为数字或留空"));
      else {
        if (
          v.toolingIncluded.length > 0 &&
          v.toolingIncluded !== "是" &&
          v.toolingIncluded !== "否"
        )
          errors.push(at(first, "模具费含在单价须填 是 或 否"));
        toolingFee = { amount, included: v.toolingIncluded === "是" };
      }
    }

    let leadTimeDays: number | null = null;
    if (v.leadTimeDays.length > 0) {
      const d = num(v.leadTimeDays);
      if (d === null || !Number.isInteger(d) || d < 0)
        errors.push(at(first, "交期须为不小于 0 的整数"));
      else leadTimeDays = d;
    }

    let validUntil: string | null = null;
    if (v.validUntil.length === 0)
      warnings.push(at(first, "未填写有效期，价格将标为“有效期未确认”，买家会看到提示"));
    else if (!/^\d{4}-\d{2}-\d{2}$/.test(v.validUntil))
      errors.push(at(first, "有效期至须为 YYYY-MM-DD"));
    else if (v.validUntil < today) errors.push(at(first, `有效期至已过（${v.validUntil}）`));
    else validUntil = v.validUntil;

    let visibility: ZhVisibility = "仅内部";
    if (v.visibility.length > 0) {
      if ((SCOPES as string[]).includes(v.visibility)) visibility = v.visibility as ZhVisibility;
      else errors.push(at(first, "可见范围无效（仅内部 / 平台买家 / 指定买家）"));
    }
    if (visibility === "指定买家")
      warnings.push(at(first, "“指定买家”需在阶梯报价中指定买家并由平台记录授权后生效"));

    const existingProduct = existing.find((p) => p.nameZh === v.nameZh) ?? null;
    const draft: ProductDraft | null =
      errors.length === 0 && currency && code
        ? {
            nameZh: v.nameZh,
            nameEn: v.nameEn.length > 0 ? v.nameEn : (existingProduct?.nameEn ?? ""),
            specVersion: v.specVersion,
            unit: v.unit,
            currency,
            basis: { code, place: v.basisPlace },
            tiers,
            toolingFee,
            leadTimeDays,
            validUntil,
            visibility,
          }
        : null;

    const diffs: ImportDiff[] = [];
    if (draft && existingProduct) {
      const p = existingProduct;
      const push = (field: string, before: string, after: string) => {
        if (before !== after) diffs.push({ field, before, after });
      };
      push("规格版本", p.specVersion, draft.specVersion);
      push("单位", p.unit, draft.unit);
      push("货币", p.currency, draft.currency);
      push(
        "交易条款",
        basisLabel(p.basis.code, p.basis.place, p.basis.colloquial),
        basisLabel(draft.basis.code, draft.basis.place),
      );
      if (!sameTiers(p.tiers, draft.tiers))
        diffs.push({
          field: "阶梯价格",
          before: tiersLabel(p.tiers),
          after: tiersLabel(draft.tiers),
        });
      push("模具费", toolingLabel(p.toolingFee), toolingLabel(draft.toolingFee));
      push(
        "交期",
        p.leadTimeDays === null ? "未注明" : `${p.leadTimeDays} 天`,
        draft.leadTimeDays === null ? "未注明" : `${draft.leadTimeDays} 天`,
      );
      push("有效期至", p.validUntil ?? "未注明", draft.validUntil ?? "未注明");
      push("可见范围", p.visibility, draft.visibility);
    }

    const status: ImportStatus =
      errors.length > 0 ? "错误" : !existingProduct ? "新增" : diffs.length > 0 ? "更新" : "未变化";

    entries.push({
      key,
      rows: rows.map((r) => r.rowNo),
      draft,
      existingId: existingProduct?.id ?? null,
      status,
      errors,
      warnings,
      diffs,
    });
  }
  return { entries, fileErrors };
}

export interface ImportSummary {
  新增: number;
  更新: number;
  未变化: number;
  错误: number;
  importable: number;
}

export function importSummary(entries: readonly ImportEntry[]): ImportSummary {
  const s: ImportSummary = { 新增: 0, 更新: 0, 未变化: 0, 错误: 0, importable: 0 };
  for (const e of entries) {
    s[e.status] += 1;
    if (e.status === "新增" || e.status === "更新") s.importable += 1;
  }
  return s;
}

/**
 * Applies the importable entries locally. Every imported price lands as 待确认 with no
 * confirmation date: nothing reaches a buyer until the supplier confirms it in 阶梯报价.
 */
export function applyImport(
  existing: readonly SupplierProduct[],
  entries: readonly ImportEntry[],
): {
  products: SupplierProduct[];
  imported: Array<{ id: string; nameZh: string; isNew: boolean }>;
} {
  let products = [...existing];
  const imported: Array<{ id: string; nameZh: string; isNew: boolean }> = [];
  let n = 0;
  for (const e of entries) {
    if (!e.draft || (e.status !== "新增" && e.status !== "更新")) continue;
    if (e.existingId) {
      const id = e.existingId;
      products = products.map((p) =>
        p.id === id
          ? {
              ...p,
              ...e.draft,
              basis: { code: e.draft!.basis.code, place: e.draft!.basis.place },
              status: "待确认",
              confirmedAt: null,
            }
          : p,
      );
      imported.push({ id, nameZh: e.key, isNew: false });
    } else {
      n += 1;
      const id = `sp_import_${n}`;
      products.push({ id, ...e.draft, status: "待确认", confirmedAt: null });
      imported.push({ id, nameZh: e.key, isNew: true });
    }
  }
  return { products, imported };
}

/* ---- Catalog --------------------------------------------------------------------------------- */

export interface CatalogSummary {
  total: number;
  已确认: number;
  待确认: number;
  即将过期: number;
  已过期: number;
  已暂停: number;
}

export function catalogSummary(
  products: readonly Pick<SupplierProduct, "status">[],
): CatalogSummary {
  const s: CatalogSummary = {
    total: products.length,
    已确认: 0,
    待确认: 0,
    即将过期: 0,
    已过期: 0,
    已暂停: 0,
  };
  for (const p of products) {
    switch (p.status) {
      case "已确认":
        s.已确认 += 1;
        break;
      case "待确认":
      case "有效期未确认":
        s.待确认 += 1;
        break;
      case "即将过期":
        s.即将过期 += 1;
        break;
      case "已过期":
        s.已过期 += 1;
        break;
      case "已暂停":
        s.已暂停 += 1;
        break;
    }
  }
  return s;
}

export function basisText(p: Pick<SupplierProduct, "basis">): string {
  if (p.basis.code === "unknown")
    return INCOTERM_GLOSS.unknown + (p.basis.colloquial ? `（${p.basis.colloquial}）` : "");
  return `${INCOTERM_GLOSS[p.basis.code]}${p.basis.place ? ` · ${p.basis.place}` : ""}`;
}

/** 暂停 hides the product from buyers; 恢复 puts it back as 待确认 so the supplier re-confirms the price. */
export function toggleSuspended(p: SupplierProduct): SupplierProduct {
  return p.status === "已暂停"
    ? { ...p, status: "待确认", confirmedAt: null }
    : { ...p, status: "已暂停" };
}

/** A new product created from the form has no tiers and must be priced and confirmed in 阶梯报价. */
export function newProduct(
  input: {
    nameZh: string;
    nameEn: string;
    specVersion: string;
    unit: string;
    currency: "CNY" | "USD";
    visibility: ZhVisibility;
  },
  index: number,
): SupplierProduct {
  return {
    id: `sp_new_${index}`,
    nameZh: input.nameZh.trim(),
    nameEn: input.nameEn.trim(),
    specVersion: input.specVersion.trim() || "v1",
    unit: input.unit.trim() || "件",
    currency: input.currency,
    basis: { code: "unknown", place: "" },
    tiers: [],
    toolingFee: null,
    leadTimeDays: null,
    validUntil: null,
    confirmedAt: null,
    status: "待确认",
    visibility: input.visibility,
  };
}

export function validateNewProduct(input: { nameZh: string; unit: string }): string[] {
  const errors: string[] = [];
  if (input.nameZh.trim().length === 0) errors.push("请填写产品名称（中文）");
  if (input.unit.trim().length === 0) errors.push("请填写单位");
  return errors;
}
