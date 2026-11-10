import type { Metadata } from "next";
import type { ReactNode } from "react";
import "@/design-preview/design-preview.css";
import "@/site/site.css";
import { META } from "@/site/content";
import { ThemeScope } from "@/site/design-system";
import { siteFontClasses } from "@/site/fonts";
import { isSiteIndexingEnabled } from "@/site/indexing";
import { SITE_THEME_BOOT } from "@/site/theme-boot";

/**
 * Public-site segment (B-31). Route group `(site)` (ADR-002: route groups with separate layouts) so the
 * marketing fonts, the Atlas × Obsidian token layer and the appearance script stay off future `/app`, `/ops`
 * and `/supplier` routes. Stays `noindex` until the founder opts in (see site/indexing.ts).
 */
const indexable = isSiteIndexingEnabled(process.env);

export const metadata: Metadata = {
  title: META.title,
  description: META.description,
  robots: indexable ? { index: true, follow: true } : { index: false, follow: false },
  openGraph: { title: META.title, description: META.description, type: "website" },
};

export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <span hidden dangerouslySetInnerHTML={{ __html: SITE_THEME_BOOT }} />
      <ThemeScope className={`fbg-site ${siteFontClasses}`}>{children}</ThemeScope>
    </>
  );
}
