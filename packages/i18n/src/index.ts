/**
 * Minimal typed message catalog. Status/badge terminology is fixed by docs/UX_INFORMATION_ARCHITECTURE.md §4
 * and must appear in the UI exactly as written here.
 */
import enUS from "./messages/en-US.json" with { type: "json" };
import zhCN from "./messages/zh-CN.json" with { type: "json" };

export const LOCALES = ["en-US", "zh-CN"] as const;
export type Locale = (typeof LOCALES)[number];

export type MessageKey = keyof typeof enUS;

const catalogs: Record<Locale, Record<MessageKey, string>> = {
  "en-US": enUS,
  "zh-CN": zhCN,
};

export function t(locale: Locale, key: MessageKey): string {
  return catalogs[locale][key];
}

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

export { enUS, zhCN };
