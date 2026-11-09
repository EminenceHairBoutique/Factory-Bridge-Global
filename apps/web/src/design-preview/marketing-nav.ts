/**
 * Public-site navigation for the marketing preview (UX-04 addendum). Every destination is a section of the
 * one-page preview, so no entry is a dead link; the specified standalone pages (PAGE_BY_PAGE_BLUEPRINT §1)
 * take these same labels when they are built.
 */
export interface MarketingNavItem {
  label: string;
  href: `#${string}`;
}

export const MARKETING_NAV: readonly MarketingNavItem[] = [
  { label: "Home", href: "#top" },
  { label: "How it works", href: "#how" },
  { label: "Services", href: "#services" },
  { label: "Categories", href: "#categories" },
  { label: "Quality process", href: "#quality" },
  { label: "About", href: "#about" },
  { label: "Contact", href: "#contact" },
];
