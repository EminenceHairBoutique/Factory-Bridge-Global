/**
 * Public-site navigation contract (B-31).
 *
 * Every destination is a section of the home page, so no entry can be a dead link; components/SiteHome.test.tsx checks that
 * each anchor has a rendered section and that no href points at `/design-preview` (synthetic data, 404 in
 * production) or at an app route that does not exist.
 *
 * Sign in is deliberately absent. B-05 owns `/sign-in` (SCREEN_INVENTORY_AND_SPECS.md); when that route ships,
 * B-05 sets `SITE_LINKS.signIn` to it and the header, phone menu and footer show "Sign in" automatically.
 */

export const SECTION_IDS = {
  top: "top",
  main: "main",
  how: "how-it-works",
  services: "services",
  compare: "compare",
  categories: "categories",
  quality: "quality",
  about: "about",
  faq: "faq",
  contact: "contact",
} as const;

export type SectionId = (typeof SECTION_IDS)[keyof typeof SECTION_IDS];

export interface SiteNavItem {
  label: string;
  href: `#${SectionId}`;
  section: SectionId;
}

function item(label: string, section: SectionId): SiteNavItem {
  return { label, href: `#${section}`, section };
}

/** Top bar (desktop) and phone menu. Contact is the primary button, not a link. */
export const SITE_NAV: readonly SiteNavItem[] = [
  item("How it works", SECTION_IDS.how),
  item("Services", SECTION_IDS.services),
  item("Categories", SECTION_IDS.categories),
  item("Quality process", SECTION_IDS.quality),
  item("About", SECTION_IDS.about),
  item("FAQ", SECTION_IDS.faq),
];

export const FOOTER_NAV: readonly SiteNavItem[] = [
  ...SITE_NAV,
  item("Start a sourcing request", SECTION_IDS.contact),
];

export interface SiteLinks {
  /** Primary call to action everywhere on the site: the sourcing-request form. */
  startRequest: `#${SectionId}`;
  /** Real buyer sign-in (B-05). `null` until that route exists; never a preview or placeholder URL. */
  signIn: `/${string}` | null;
}

export const SITE_LINKS: SiteLinks = {
  startRequest: `#${SECTION_IDS.contact}`,
  signIn: null,
};
