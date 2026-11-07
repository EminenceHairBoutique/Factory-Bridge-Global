import { describe, expect, it } from "vitest";
import { enUS, isLocale, t, zhCN } from "./index.js";

describe("i18n catalogs", () => {
  it("zh-CN has exactly the same keys as en-US (no missing translations)", () => {
    expect(Object.keys(zhCN).sort()).toEqual(Object.keys(enUS).sort());
  });

  it("no empty strings", () => {
    for (const v of [...Object.values(enUS), ...Object.values(zhCN)])
      expect(v.trim().length).toBeGreaterThan(0);
  });

  it("resolves a badge in both locales", () => {
    expect(t("en-US", "badge.factory_confirmed_quote")).toBe("Factory-confirmed quote");
    expect(t("zh-CN", "badge.factory_confirmed_quote")).toBe("工厂确认报价");
  });

  it("isLocale guards unknown values", () => {
    expect(isLocale("zh-CN")).toBe(true);
    expect(isLocale("fr-FR")).toBe(false);
  });
});
