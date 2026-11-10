import { describe, expect, it } from "vitest";
import { findProhibitedClaims } from "./claims";
import * as content from "./content";

function strings(value: unknown, path: string, out: Array<[string, string]>) {
  if (typeof value === "string") out.push([path, value]);
  else if (Array.isArray(value)) value.forEach((v, i) => strings(v, `${path}[${i}]`, out));
  else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) strings(v, `${path}.${k}`, out);
  }
}

const all: Array<[string, string]> = [];
for (const [name, value] of Object.entries(content)) strings(value, name, all);

describe("public-site copy (PRD §7 copy audit, B-31 acceptance)", () => {
  it("has copy to audit", () => {
    expect(all.length).toBeGreaterThan(80);
  });

  it("contains none of the prohibited claims", () => {
    const hits = all.flatMap(([path, text]) =>
      findProhibitedClaims(text).map((why) => `${path}: "${text}" — ${why}`),
    );
    expect(hits).toEqual([]);
  });

  it("the guard actually catches the claims it is meant to catch", () => {
    for (const bad of [
      "A U.S.-based sourcing team",
      "Lowest price guaranteed",
      "Verified factories only",
      "Save 30% on packaging",
      "We reply within 24 hours",
      "Trusted by 500+ brands",
      "Raw Cambodian hair",
      "Real-time factory inventory",
      "DEMO DATA — NOT REAL SUPPLIER QUOTATIONS",
      "1,200 suppliers on the platform",
      "We are the #1 sourcing partner",
      "#1 in China sourcing",
      "A USA-based team",
      "U.S.‑based sourcing",
      "U.S.–based sourcing",
      "Based in the U.S.",
      "Operated from the USA",
      "Verified quotes only",
      "Pre-vetted suppliers",
      "500+ vetted factories",
      "Hundreds of factories",
      "Authentic human hair",
    ]) {
      expect(findProhibitedClaims(bad), bad).not.toEqual([]);
    }
  });

  it("keeps the restricted-category sentence complete (CLAUDE.md §4)", () => {
    const s = content.CATEGORIES.restricted.toLowerCase();
    for (const term of [
      "medical devices",
      "gloves",
      "sterile vials",
      "pill presses",
      "encapsulators",
      "ingestibles",
      "finished cosmetics",
      "hplc",
    ]) {
      expect(s).toContain(term);
    }
  });

  it("states the service role from ADR-026 and the pricing wording from the IA", () => {
    expect(content.HERO.role).toMatch(/never the buyer, reseller or importer of record/);
    expect(content.ABOUT.is.join(" ")).toContain("Pilot pricing by conversation");
  });

  it("never tells a visitor a request was sent unless it was delivered", () => {
    expect(content.FORM.status.sent.title).toBe("Request sent.");
    for (const [status, msg] of Object.entries(content.FORM.status)) {
      if (status === "sent") continue;
      expect(`${msg.title} ${msg.body}`, status).not.toMatch(/^request sent|we'll reply/i);
    }
    expect(content.FORM.status.test_sent.body).toMatch(/Nothing was sent or stored/);
  });
});
