import { describe, expect, it } from "vitest";
import { parseThemeParam } from "./theme-param";

describe("theme query override (design review and screenshots only)", () => {
  it("reads ?theme=atlas|obsidian and ignores anything else", () => {
    expect(parseThemeParam("?theme=obsidian")).toBe("obsidian");
    expect(parseThemeParam("?x=1&theme=atlas")).toBe("atlas");
    expect(parseThemeParam("?theme=system")).toBeNull();
    expect(parseThemeParam("?theme=neon")).toBeNull();
    expect(parseThemeParam("")).toBeNull();
  });
});
