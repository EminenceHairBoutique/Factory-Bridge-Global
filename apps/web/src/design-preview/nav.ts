/**
 * Primary navigation model for the design-preview shell (UX-03).
 *
 * Pure data and rules, no React, so the active-state rule can be unit tested (nav.test.ts).
 * The rule that fixes UX-03 defect 1 ("Overview" and "Projects" both selected):
 *
 *   1. The item whose `href` path equals the current pathname is active.
 *   2. Otherwise the item with the longest `match` prefix that contains the pathname is active
 *      (child screens such as a project record, the brief or a review belong to their parent destination).
 *   3. Otherwise nothing is active. Planned items (no `href`) and triggers (`action`) are never active.
 *
 * Exactly one item or none is returned, so the shell can never render two `aria-current="page"` entries.
 * Anchors (`#section`) are not destinations: `navPath` strips them before comparing, and no shipped entry
 * uses one (see the "honest navigation entries" tests).
 */
import type { IconName } from "./ui/icons";

export type Workspace = "buyer" | "ops" | "supplier";

export interface NavItem {
  label: string;
  /** Shorter label for the phone tab bar. */
  short?: string;
  icon: IconName;
  /** Destination. Items without one are planned and render disabled with a "Planned" label. */
  href?: string;
  /** Child routes that belong to this destination (segment-aware prefixes). */
  match?: readonly string[];
  /** Count shown next to a linked destination. Never set on a planned item. */
  badge?: number;
  /** One of the four phone tabs. */
  mobile?: boolean;
  /** Order in the phone tab bar when it differs from the sidebar order. */
  mobileOrder?: number;
  /** A trigger rather than a destination: opens the account and appearance sheet. */
  action?: "account";
}

/** The path part of an href: no hash, no query. */
export function navPath(href: string): string {
  const cut = href.search(/[#?]/);
  return cut === -1 ? href : href.slice(0, cut);
}

function matchesPrefix(pathname: string, prefix: string): boolean {
  const clean = prefix.endsWith("/") ? prefix.slice(0, -1) : prefix;
  return pathname === clean || pathname.startsWith(`${clean}/`);
}

export function activeNavItem(items: readonly NavItem[], pathname: string | null): NavItem | null {
  if (pathname === null) return null;
  const path = navPath(pathname);

  for (const item of items) {
    if (item.href !== undefined && item.action === undefined && navPath(item.href) === path) {
      return item;
    }
  }

  let best: NavItem | null = null;
  let bestLength = -1;
  for (const item of items) {
    if (item.href === undefined || item.action !== undefined) continue;
    for (const prefix of item.match ?? []) {
      if (matchesPrefix(path, prefix) && prefix.length > bestLength) {
        best = item;
        bestLength = prefix.length;
      }
    }
  }
  return best;
}

/** The four phone tabs, in `mobileOrder` (or sidebar) order. */
export function mobileTabs(
  main: readonly NavItem[],
  bottom: readonly NavItem[],
  limit = 4,
): NavItem[] {
  return [...main, ...bottom]
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item.mobile)
    .sort((a, b) => (a.item.mobileOrder ?? a.index) - (b.item.mobileOrder ?? b.index))
    .map(({ item }) => item)
    .slice(0, limit);
}

/* ------------------------------------------------------------------------------------------------ */
/* Destinations                                                                                       */
/* ------------------------------------------------------------------------------------------------ */

const BUYER = "/design-preview/buyer";

export const BUYER_NAV: readonly NavItem[] = [
  { label: "Overview", short: "Home", icon: "home", href: `${BUYER}/dashboard`, mobile: true },
  {
    label: "Projects",
    icon: "folder",
    href: `${BUYER}/projects`,
    // Project-scoped screens: the record, the brief flows and (PR #14) reports.
    match: [
      `${BUYER}/project`,
      `${BUYER}/new-request`,
      `${BUYER}/brief`,
      `${BUYER}/reports`,
      `${BUYER}/report`,
    ],
    mobile: true,
  },
  { label: "Quotes", icon: "compare", href: `${BUYER}/quotes`, match: [`${BUYER}/compare`] },
  {
    label: "Documents",
    icon: "document",
    href: `${BUYER}/documents`,
    match: [`${BUYER}/review`],
  },
  // Planned: no preview exists yet, so no link and no unread count.
  { label: "Inbox", icon: "message", mobile: true },
];

export const BUYER_NAV_BOTTOM: readonly NavItem[] = [
  { label: "Account", icon: "user", mobile: true, action: "account" },
];

const OPS = "/design-preview/ops";

export const OPS_NAV: readonly NavItem[] = [
  { label: "Work queue", short: "Queue", icon: "list", href: `${OPS}/queue`, mobile: true },
  { label: "Projects", icon: "folder", mobile: true },
  { label: "Research", icon: "search" },
  { label: "Suppliers", icon: "building", href: `${OPS}/suppliers`, match: [`${OPS}/supplier`] },
  { label: "Reviews", icon: "eye", href: `${OPS}/quote-review`, badge: 4, mobile: true },
  { label: "Cases", icon: "flag" },
  { label: "Admin", icon: "lock" },
];

export const OPS_NAV_BOTTOM: readonly NavItem[] = [
  { label: "Outreach approvals", icon: "message" },
  { label: "Account", icon: "user", mobile: true, action: "account" },
];

const SUPPLIER = "/design-preview/supplier";

export const SUPPLIER_NAV: readonly NavItem[] = [
  { label: "工作台", icon: "home", href: `${SUPPLIER}/dashboard`, mobile: true },
  { label: "企业资料", icon: "building", href: `${SUPPLIER}/onboarding` },
  { label: "产品目录", icon: "list" },
  {
    label: "阶梯报价",
    short: "报价",
    icon: "compare",
    href: `${SUPPLIER}/pricing`,
    mobile: true,
    mobileOrder: 2,
  },
  {
    label: "询价单",
    icon: "document",
    href: `${SUPPLIER}/rfqs`,
    badge: 2,
    mobile: true,
    mobileOrder: 1,
  },
  { label: "文件与消息", icon: "message" },
  { label: "数据共享设置", icon: "lock", href: `${SUPPLIER}/sharing` },
];

export const SUPPLIER_NAV_BOTTOM: readonly NavItem[] = [
  { label: "账户", icon: "user", mobile: true, action: "account" },
];

export const NAV: Record<Workspace, { main: readonly NavItem[]; bottom: readonly NavItem[] }> = {
  buyer: { main: BUYER_NAV, bottom: BUYER_NAV_BOTTOM },
  ops: { main: OPS_NAV, bottom: OPS_NAV_BOTTOM },
  supplier: { main: SUPPLIER_NAV, bottom: SUPPLIER_NAV_BOTTOM },
};
