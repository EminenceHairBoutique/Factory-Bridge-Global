/**
 * `?theme=atlas|obsidian` forces an appearance for one page load (design review links and screenshot
 * tooling). It is never persisted and `system` cannot be forced. Pure, so it is unit tested.
 */
export type ForcedTheme = "atlas" | "obsidian";

export function parseThemeParam(search: string): ForcedTheme | null {
  const v = new URLSearchParams(search).get("theme");
  return v === "atlas" || v === "obsidian" ? v : null;
}
