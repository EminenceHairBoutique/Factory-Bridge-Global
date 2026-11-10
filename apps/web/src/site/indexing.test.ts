import { describe, expect, it } from "vitest";
import { isSiteIndexingEnabled } from "./indexing";

describe("search indexing gate (B-31: no indexing before launch approval)", () => {
  it("is off unless a production build, APP_ENV=production and SITE_INDEXING=enabled all hold", () => {
    expect(isSiteIndexingEnabled({})).toBe(false);
    expect(isSiteIndexingEnabled({ NODE_ENV: "development", SITE_INDEXING: "enabled" })).toBe(
      false,
    );
    expect(isSiteIndexingEnabled({ NODE_ENV: "production" })).toBe(false);
    expect(
      isSiteIndexingEnabled({
        NODE_ENV: "production",
        APP_ENV: "staging",
        SITE_INDEXING: "enabled",
      }),
    ).toBe(false);
    expect(
      isSiteIndexingEnabled({
        NODE_ENV: "production",
        APP_ENV: "production",
        SITE_INDEXING: "true",
      }),
    ).toBe(false);
    expect(
      isSiteIndexingEnabled({
        NODE_ENV: "production",
        APP_ENV: "production",
        SITE_INDEXING: "enabled",
      }),
    ).toBe(true);
  });
});
