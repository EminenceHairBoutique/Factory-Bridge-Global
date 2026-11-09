import { describe, expect, it } from "vitest";
import { MARKETING_NAV } from "./marketing-nav";

describe("public site navigation (UX-04 addendum)", () => {
  it("has the seven destinations in the agreed order, each anchored to a section on the page", () => {
    expect(MARKETING_NAV.map((n) => n.label)).toEqual([
      "Home",
      "How it works",
      "Services",
      "Categories",
      "Quality process",
      "About",
      "Contact",
    ]);
    for (const n of MARKETING_NAV) {
      expect(n.href.startsWith("#")).toBe(true);
      expect(n.href.length).toBeGreaterThan(1);
    }
    expect(new Set(MARKETING_NAV.map((n) => n.href)).size).toBe(MARKETING_NAV.length);
  });
});
