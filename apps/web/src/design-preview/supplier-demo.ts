/**
 * Display-only validation and formatting for the supplier (zh-CN) prototypes.
 *
 * Mirrors the ingestion rules in docs/QUOTE_ENGINE_SPEC.md §2.3 (ascending, non-overlapping [min, max) tiers;
 * non-monotonic prices accepted with a warning) and ADR-025 (a colloquial term such as 出厂价 is never defaulted to
 * EXW; a term without its named place is `unknown`). The authoritative validation lives in the database
 * (`quotation_tiers` exclusion constraint, B-18) and in `packages/domain`; this module exists so the editor can
 * explain problems inline in Chinese.
 */
import { PLACE_REQUIRED, type IncotermCode, type SupplierTier } from "./demo-data/supplier";

export interface TierIssue {
  row: number;
  code:
    | "min_required"
    | "price_required"
    | "max_le_min"
    | "not_ascending"
    | "overlap"
    | "gap"
    | "non_monotonic";
  message: string;
}

export interface TierValidation {
  errors: TierIssue[];
  warnings: TierIssue[];
}

export function validateTiers(tiers: readonly SupplierTier[]): TierValidation {
  const errors: TierIssue[] = [];
  const warnings: TierIssue[] = [];
  tiers.forEach((t, i) => {
    const row = i + 1;
    if (t.minQty === null || !Number.isFinite(t.minQty) || t.minQty <= 0)
      errors.push({ row, code: "min_required", message: "请填写起订量（大于 0 的整数）" });
    if (t.unitPrice === null || !Number.isFinite(t.unitPrice) || t.unitPrice < 0)
      errors.push({ row, code: "price_required", message: "请填写单价" });
    if (t.minQty !== null && t.maxQty !== null && t.maxQty <= t.minQty)
      errors.push({ row, code: "max_le_min", message: "区间上限必须大于起订量" });
    if (i > 0) {
      const prev = tiers[i - 1];
      if (prev && prev.minQty !== null && t.minQty !== null) {
        if (t.minQty <= prev.minQty)
          errors.push({ row, code: "not_ascending", message: "各档起订量必须递增" });
        else if (prev.maxQty === null)
          errors.push({
            row,
            code: "overlap",
            message: `第 ${i} 档未设上限（不封顶），其后不能再有档位`,
          });
        else if (t.minQty < prev.maxQty)
          errors.push({ row, code: "overlap", message: `与第 ${i} 档数量区间重叠` });
        else if (t.minQty > prev.maxQty)
          warnings.push({
            row,
            code: "gap",
            message: `与第 ${i} 档之间存在数量空档（${prev.maxQty}–${t.minQty - 1}），该区间将无报价`,
          });
      }
      if (prev && prev.unitPrice !== null && t.unitPrice !== null && t.unitPrice > prev.unitPrice)
        warnings.push({
          row,
          code: "non_monotonic",
          message: "本档单价高于上一档，平台将提示审核人员复核",
        });
    }
  });
  return { errors, warnings };
}

export interface BasisIssue {
  level: "error" | "warning";
  message: string;
}

export function validateBasis(code: IncotermCode, place: string): BasisIssue | null {
  if (code === "unknown")
    return {
      level: "warning",
      message:
        "交易条款将记录为“未注明”。买家无法将此价格纳入比较，平台会向您发起确认。请勿以“出厂价”“离岸价”等口语替代正式条款。",
    };
  if (PLACE_REQUIRED.has(code) && place.trim().length === 0)
    return {
      level: "error",
      message: "请填写指定地点，例如 “FOB 深圳”。没有地点的条款将按“未注明”处理。",
    };
  if (code === "EXW" && place.trim().length === 0)
    return {
      level: "warning",
      message: "建议填写工厂所在地，例如 “EXW 东莞”，便于买家估算内陆运费。",
    };
  return null;
}

export interface QuoteFormInput {
  currency: string;
  unit: string;
  tiers: readonly SupplierTier[];
  basisCode: IncotermCode;
  basisPlace: string;
  validUntil: string;
  leadTimeDays: string;
  specConfirmed: boolean;
}

/** Fields that block submission, in Chinese, mirroring PRD AC-B3.4 plus validity and spec confirmation. */
export function quoteSubmissionGate(input: QuoteFormInput): string[] {
  const missing: string[] = [];
  if (!input.currency) missing.push("货币");
  if (!input.unit) missing.push("单位");
  const tierCheck = validateTiers(input.tiers);
  if (input.tiers.length === 0 || tierCheck.errors.length > 0)
    missing.push("至少一档有效的阶梯价格");
  const basis = validateBasis(input.basisCode, input.basisPlace);
  if (basis?.level === "error") missing.push("交易条款的指定地点");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.validUntil)) missing.push("报价有效期");
  if (!input.specConfirmed) missing.push("确认已按买家规格版本报价");
  return missing;
}

/* ---- Formatting (zh-CN) ------------------------------------------------------------------------ */

export function formatZhDate(iso: string | null): string {
  if (!iso) return "未注明";
  const [y, m, d] = iso.split("-").map((n) => Number(n));
  if (!y || !m || !d) return iso;
  return `${y}年${m}月${d}日`;
}

export function formatZhMoney(amount: number, currency: "CNY" | "USD", digits = 2): string {
  const n = new Intl.NumberFormat("zh-CN", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(amount);
  return `${currency === "CNY" ? "¥" : "$"}${n} ${currency}`;
}

export function formatZhQty(n: number): string {
  return new Intl.NumberFormat("zh-CN").format(n);
}

export function tierRangeZh(t: SupplierTier): string {
  if (t.minQty === null) return "—";
  return t.maxQty === null
    ? `${formatZhQty(t.minQty)} 及以上`
    : `${formatZhQty(t.minQty)} – ${formatZhQty(t.maxQty - 1)}`;
}

/** Days until a date relative to the demo "today"; negative when past. */
export function daysUntil(iso: string | null, today: string): number | null {
  if (!iso) return null;
  const a = new Date(`${iso}T00:00:00Z`).getTime();
  const b = new Date(`${today}T00:00:00Z`).getTime();
  return Math.round((a - b) / 86_400_000);
}

/* ---- Onboarding (企业认证) validators ---------------------------------------------------------- */

const USCC_CHARS = "0123456789ABCDEFGHJKLMNPQRTUWXY";
const USCC_WEIGHTS = [1, 3, 9, 27, 19, 26, 16, 17, 20, 29, 25, 13, 8, 24, 10, 30, 28];

/**
 * 统一社会信用代码 format and check digit (GB 32100-2015). Format only: existence and ownership are verified
 * by the platform against the registration record, never by the client.
 */
export function validateUscc(code: string): string | null {
  const c = code.trim().toUpperCase();
  if (c.length !== 18) return "统一社会信用代码应为 18 位";
  for (const ch of c) if (!USCC_CHARS.includes(ch)) return "包含无效字符（不使用 I、O、S、V、Z）";
  const sum = USCC_WEIGHTS.reduce((acc, w, i) => acc + w * USCC_CHARS.indexOf(c[i] as string), 0);
  const expected = USCC_CHARS[(31 - (sum % 31)) % 31];
  if (c[17] !== expected) return "校验位不正确，请核对营业执照上的代码";
  return null;
}

export function validateCnMobile(value: string): string | null {
  return /^1[3-9]\d{9}$/.test(value.replace(/\s|-/g, "")) ? null : "请填写 11 位中国大陆手机号";
}

export function validateEmail(value: string): string | null {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) ? null : "请填写有效的工作邮箱";
}
