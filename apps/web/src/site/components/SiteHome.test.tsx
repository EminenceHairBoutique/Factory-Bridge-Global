import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { InquiryMode } from "@/server/inquiry/config";
import { findProhibitedClaims } from "../claims";
import { FOOTER_NAV, SECTION_IDS, SITE_LINKS, SITE_NAV } from "../links";
import { SiteHome } from "./SiteHome";

function render(mode: InquiryMode) {
  return renderToStaticMarkup(<SiteHome inquiryMode={mode} />);
}

function attrValues(html: string, attr: string): string[] {
  return [...html.matchAll(new RegExp(`\\s${attr}="([^"]*)"`, "g"))].map((m) => m[1] ?? "");
}

/** Visible text; element boundaries become "¶" so words from adjacent elements never join into a phrase. */
function text(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ¶ ")
    .replace(/&amp;/g, "&")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ");
}

const html = render("not_configured");
const ids = new Set(attrValues(html, "id"));
const hrefs = attrValues(html, "href");

describe("public home page markup (B-31)", () => {
  it("has exactly one h1, a main landmark and a skip link to it", () => {
    expect(html.match(/<h1[\s>]/g)).toHaveLength(1);
    expect(html).toContain(`<main id="${SECTION_IDS.main}"`);
    expect(hrefs).toContain(`#${SECTION_IDS.main}`);
  });

  it("every navigation anchor and call to action lands on a rendered section", () => {
    const targets = [
      ...SITE_NAV.map((n) => n.href),
      ...FOOTER_NAV.map((n) => n.href),
      SITE_LINKS.startRequest,
    ];
    for (const href of targets) expect(ids, href).toContain(href.slice(1));
    for (const href of hrefs) {
      if (href.startsWith("#")) expect(ids, href).toContain(href.slice(1));
      else expect(href, "only in-page anchors until real routes exist").toMatch(/^\/$/);
    }
  });

  it("never links to the design preview, fake sign-in or synthetic dashboards", () => {
    expect(html).not.toMatch(/design-preview/);
    expect(SITE_LINKS.signIn).toBeNull();
    expect(text(html)).not.toMatch(/\bSign in\b/);
  });

  it("renders no prohibited claims and no preview vocabulary", () => {
    expect(findProhibitedClaims(text(html))).toEqual([]);
  });

  it("gives every form control a label", () => {
    const controls = [...html.matchAll(/<(input|select|textarea)\b([^>]*)>/g)]
      .map((m) => m[2] ?? "")
      .filter((attrs) => !/type="hidden"/.test(attrs));
    expect(controls.length).toBeGreaterThanOrEqual(8);
    const labelled = new Set(attrValues(html, "for"));
    for (const attrs of controls) {
      const id = /\sid="([^"]+)"/.exec(attrs)?.[1];
      expect(id, attrs).toBeDefined();
      expect(labelled, attrs).toContain(id);
    }
  });

  it("switches the form off, and says so, when no delivery mechanism is configured", () => {
    expect(html).toMatch(/<fieldset disabled=""/);
    expect(text(html)).toContain("Online requests open when the pilot launches.");
    expect(text(html)).not.toContain("Test mode");
  });

  it("announces test mode in a dry run and leaves the form usable", () => {
    const dry = render("dry_run");
    expect(dry).not.toMatch(/<fieldset disabled=""/);
    expect(text(dry)).toContain("Test mode");
    expect(text(dry)).not.toContain("Online requests open when the pilot launches.");
  });

  it("shows neither notice when real delivery is configured", () => {
    const live = render("resend");
    expect(live).not.toMatch(/<fieldset disabled=""/);
    expect(text(live)).not.toContain("Test mode");
    expect(text(live)).not.toContain("Online requests open when the pilot launches.");
    // The page never carries delivery secrets or addresses; only the mode reached it.
    expect(live).not.toMatch(/re_[A-Za-z0-9]|api\.resend\.com|INQUIRY_TO_EMAIL/);
  });

  it("marks the Chinese product glosses with lang=zh-CN", () => {
    expect(html.match(/lang="zh-CN"/g)?.length).toBeGreaterThanOrEqual(3);
  });
});
