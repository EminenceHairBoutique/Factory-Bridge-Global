import { describe, expect, it } from "vitest";
import {
  BUYER_NAV,
  BUYER_NAV_BOTTOM,
  NAV,
  activeNavItem,
  mobileTabs,
  navPath,
  type NavItem,
} from "./nav";

const buyerItems = [...BUYER_NAV, ...BUYER_NAV_BOTTOM];

/** How many items the shell would mark aria-current="page" for a pathname. */
function activeCount(items: readonly NavItem[], pathname: string | null): number {
  const active = activeNavItem(items, pathname);
  return items.filter((item) => item === active).length;
}

describe("primary navigation active state (UX-03 defect 1)", () => {
  it.each([
    ["/design-preview/buyer/dashboard", "Overview"],
    ["/design-preview/buyer/projects", "Projects"],
    ["/design-preview/buyer/project", "Projects"],
    ["/design-preview/buyer/new-request", "Projects"],
    ["/design-preview/buyer/brief", "Projects"],
    ["/design-preview/buyer/reports", "Projects"],
    ["/design-preview/buyer/report", "Projects"],
    ["/design-preview/buyer/quotes", "Quotes"],
    ["/design-preview/buyer/compare", "Quotes"],
    ["/design-preview/buyer/documents", "Documents"],
    ["/design-preview/buyer/review", "Documents"],
    ["/design-preview/buyer/messages", "Inbox"],
    ["/design-preview/buyer/messages?thread=th_tooling", "Inbox"],
  ])("%s lights exactly one buyer destination: %s", (pathname, label) => {
    expect(activeNavItem(buyerItems, pathname)?.label).toBe(label);
    expect(activeCount(buyerItems, pathname)).toBe(1);
  });

  it("lights nothing for an unknown path or before the pathname is known", () => {
    expect(activeNavItem(buyerItems, "/design-preview/gallery")).toBeNull();
    expect(activeNavItem(buyerItems, null)).toBeNull();
    expect(activeCount(buyerItems, "/design-preview/gallery")).toBe(0);
  });

  it("never lets an anchor link share the active state with its page", () => {
    const legacy: NavItem[] = [
      { label: "Overview", icon: "home", href: "/design-preview/buyer/dashboard" },
      { label: "Projects", icon: "folder", href: "/design-preview/buyer/dashboard#projects" },
    ];
    expect(navPath("/design-preview/buyer/dashboard#projects")).toBe(
      "/design-preview/buyer/dashboard",
    );
    expect(activeNavItem(legacy, "/design-preview/buyer/dashboard")?.label).toBe("Overview");
    expect(activeCount(legacy, "/design-preview/buyer/dashboard")).toBe(1);
  });

  it("prefers the exact destination, then the longest matching child prefix", () => {
    const items: NavItem[] = [
      { label: "A", icon: "home", href: "/a", match: ["/a/child"] },
      { label: "B", icon: "folder", href: "/a/child/b", match: ["/a/child/b/x"] },
    ];
    expect(activeNavItem(items, "/a/child/b")?.label).toBe("B");
    expect(activeNavItem(items, "/a/child/b/x/y")?.label).toBe("B");
    expect(activeNavItem(items, "/a/child/other")?.label).toBe("A");
    // Prefix matching is segment-aware: "/a/child" does not match "/a/children".
    expect(activeNavItem(items, "/a/children")).toBeNull();
  });

  it("treats triggers (the account sheet) as never active", () => {
    const account = BUYER_NAV_BOTTOM.find((i) => i.action === "account");
    expect(account).toBeDefined();
    expect(account?.href).toBeUndefined();
    for (const pathname of ["/design-preview/buyer/dashboard", "/design-preview/buyer/projects"]) {
      expect(activeNavItem(buyerItems, pathname)).not.toBe(account);
    }
  });
});

describe("phone tab bar", () => {
  it("keeps four buyer tabs: Home, Projects, Inbox and Account", () => {
    const tabs = mobileTabs(BUYER_NAV, BUYER_NAV_BOTTOM);
    expect(tabs.map((t) => t.short ?? t.label)).toEqual(["Home", "Projects", "Inbox", "Account"]);
  });

  it("lights one supplier destination for the catalog and its import screen", () => {
    const items = [...NAV.supplier.main, ...NAV.supplier.bottom];
    expect(activeNavItem(items, "/design-preview/supplier/catalog")?.label).toBe("产品目录");
    expect(activeNavItem(items, "/design-preview/supplier/catalog/import")?.label).toBe("产品目录");
    expect(activeNavItem(items, "/design-preview/supplier/messages")?.label).toBe("消息");
    expect(activeCount(items, "/design-preview/supplier/catalog/import")).toBe(1);
  });

  it("keeps four tabs in every workspace", () => {
    for (const ws of Object.values(NAV)) {
      expect(mobileTabs(ws.main, ws.bottom)).toHaveLength(4);
    }
  });
});

describe("honest navigation entries", () => {
  it("never shows a count badge on a planned (unlinked) destination", () => {
    for (const ws of Object.values(NAV)) {
      for (const item of [...ws.main, ...ws.bottom]) {
        if (item.href === undefined) expect(item.badge).toBeUndefined();
      }
    }
  });

  it("gives every linked buyer destination a distinct route without anchors", () => {
    const hrefs = BUYER_NAV.flatMap((i) => (i.href ? [i.href] : []));
    expect(new Set(hrefs.map(navPath)).size).toBe(hrefs.length);
    expect(hrefs.some((h) => h.includes("#"))).toBe(false);
  });
});
