import { describe, expect, it } from "vitest";
import { isDesignPreviewEnabled } from "./gate";

describe("isDesignPreviewEnabled", () => {
  it("is enabled outside production builds", () => {
    expect(isDesignPreviewEnabled({ NODE_ENV: "development" })).toBe(true);
    expect(isDesignPreviewEnabled({ NODE_ENV: "test" })).toBe(true);
    expect(isDesignPreviewEnabled({})).toBe(true);
  });

  it("is disabled in a production build by default", () => {
    expect(isDesignPreviewEnabled({ NODE_ENV: "production" })).toBe(false);
    expect(isDesignPreviewEnabled({ NODE_ENV: "production", DESIGN_PREVIEW: "enabled" })).toBe(
      false,
    );
  });

  it("can never be enabled when APP_ENV is production", () => {
    expect(
      isDesignPreviewEnabled({
        NODE_ENV: "production",
        APP_ENV: "production",
        DESIGN_PREVIEW: "enabled",
      }),
    ).toBe(false);
    expect(
      isDesignPreviewEnabled({
        NODE_ENV: "production",
        APP_ENV: "PROD",
        DESIGN_PREVIEW: "enabled",
      }),
    ).toBe(false);
  });

  it("requires both a non-production APP_ENV and an explicit opt-in", () => {
    expect(isDesignPreviewEnabled({ NODE_ENV: "production", APP_ENV: "staging" })).toBe(false);
    expect(
      isDesignPreviewEnabled({
        NODE_ENV: "production",
        APP_ENV: "staging",
        DESIGN_PREVIEW: "true",
      }),
    ).toBe(false);
    expect(
      isDesignPreviewEnabled({
        NODE_ENV: "production",
        APP_ENV: "staging",
        DESIGN_PREVIEW: "enabled",
      }),
    ).toBe(true);
  });
});
