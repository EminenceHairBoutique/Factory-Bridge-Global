import { describe, expect, it } from "vitest";
import {
  daysUntil,
  formatZhDate,
  formatZhMoney,
  quoteSubmissionGate,
  tierRangeZh,
  validateBasis,
  validateCnMobile,
  validateEmail,
  validateTiers,
  validateUscc,
} from "./supplier-demo";

const tier = (
  id: number,
  minQty: number | null,
  maxQty: number | null,
  unitPrice: number | null,
) => ({
  id,
  minQty,
  maxQty,
  unitPrice,
});

describe("validateTiers (display-only mirror of QUOTE_ENGINE_SPEC §2.3)", () => {
  it("accepts ascending, non-overlapping tiers", () => {
    const r = validateTiers([tier(1, 5000, 10000, 0.26), tier(2, 10000, 50000, 0.21)]);
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([]);
  });

  it("rejects overlapping tiers (QE-04)", () => {
    const r = validateTiers([tier(1, 5000, 12000, 0.26), tier(2, 10000, null, 0.21)]);
    expect(r.errors.map((e) => e.code)).toContain("overlap");
  });

  it("rejects a tier after an open-ended one and non-ascending minimums", () => {
    expect(
      validateTiers([tier(1, 5000, null, 0.26), tier(2, 10000, null, 0.21)]).errors.map(
        (e) => e.code,
      ),
    ).toContain("overlap");
    expect(
      validateTiers([tier(1, 10000, 20000, 0.2), tier(2, 5000, 10000, 0.26)]).errors.map(
        (e) => e.code,
      ),
    ).toContain("not_ascending");
  });

  it("warns on gaps and non-monotonic prices without rejecting (QE-14)", () => {
    const r = validateTiers([tier(1, 1000, 2000, 0.3), tier(2, 3000, null, 0.35)]);
    expect(r.errors).toEqual([]);
    expect(r.warnings.map((w) => w.code).sort()).toEqual(["gap", "non_monotonic"]);
  });

  it("requires minimum quantity and price", () => {
    const r = validateTiers([tier(1, null, null, null)]);
    expect(r.errors.map((e) => e.code).sort()).toEqual(["min_required", "price_required"]);
  });
});

describe("validateBasis (ADR-025)", () => {
  it("never defaults a colloquial term to EXW: unknown is a warning, not an error", () => {
    expect(validateBasis("unknown", "")?.level).toBe("warning");
  });
  it("requires a named place for port and destination terms", () => {
    expect(validateBasis("FOB", "")?.level).toBe("error");
    expect(validateBasis("FOB", "深圳")).toBeNull();
    expect(validateBasis("DDP", " ")?.level).toBe("error");
  });
  it("only recommends a place for EXW", () => {
    expect(validateBasis("EXW", "")?.level).toBe("warning");
  });
});

describe("quoteSubmissionGate", () => {
  const ok = {
    currency: "CNY",
    unit: "件",
    tiers: [tier(1, 10000, null, 0.21)],
    basisCode: "FOB" as const,
    basisPlace: "深圳",
    validUntil: "2026-12-31",
    leadTimeDays: "15",
    specConfirmed: true,
  };
  it("passes a complete quote", () => {
    expect(quoteSubmissionGate(ok)).toEqual([]);
  });
  it("lists every blocking field in Chinese", () => {
    const missing = quoteSubmissionGate({
      ...ok,
      currency: "",
      tiers: [],
      basisCode: "FOB",
      basisPlace: "",
      validUntil: "",
      specConfirmed: false,
    });
    expect(missing).toEqual([
      "货币",
      "至少一档有效的阶梯价格",
      "交易条款的指定地点",
      "报价有效期",
      "确认已按买家规格版本报价",
    ]);
  });
  it("allows an unknown basis through the gate (recorded as 未注明)", () => {
    expect(quoteSubmissionGate({ ...ok, basisCode: "unknown", basisPlace: "" })).toEqual([]);
  });
});

describe("zh-CN formatting", () => {
  it("formats dates, money and tier ranges per IA §2.3", () => {
    expect(formatZhDate("2026-11-07")).toBe("2026年11月7日");
    expect(formatZhDate(null)).toBe("未注明");
    expect(formatZhMoney(0.21, "CNY", 4)).toBe("¥0.2100 CNY");
    expect(tierRangeZh(tier(1, 10000, 50000, 0.21))).toBe("10,000 – 49,999");
    expect(tierRangeZh(tier(1, 10000, null, 0.21))).toBe("10,000 及以上");
    expect(daysUntil("2026-11-20", "2026-11-07")).toBe(13);
    expect(daysUntil("2026-10-31", "2026-11-07")).toBe(-7);
  });
});

describe("onboarding validators", () => {
  it("validates the unified social credit code format and check digit", () => {
    expect(validateUscc("91440300MA5DEM00A5")).toBeNull();
    expect(validateUscc("91110000600037341L")).toBeNull();
    expect(validateUscc("91440300MA5DEM00A6")).toMatch(/校验位/);
    expect(validateUscc("91440300MA5DEM00")).toMatch(/18 位/);
    expect(validateUscc("91440300MA5DEM00I5")).toMatch(/无效字符/);
  });
  it("validates mainland mobile numbers and work emails", () => {
    expect(validateCnMobile("138 0013 8000")).toBeNull();
    expect(validateCnMobile("12345678901")).not.toBeNull();
    expect(validateEmail("sales@example.com")).toBeNull();
    expect(validateEmail("sales@")).not.toBeNull();
  });
});
