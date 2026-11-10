import type { Metadata } from "next";
import "@/design-preview/design-preview.css";
import "@/site/site.css";
import { NOT_FOUND, SITE_NAME } from "@/site/content";
import { ThemeScope, buttonClasses } from "@/site/design-system";
import { BrandMark } from "@/site/components/marks";

/**
 * Site-wide 404 (B-31). Also what `/design-preview/*` returns in a production build (its layout calls
 * notFound()), so the gated routes look exactly like any unknown path. Mentions nothing about the preview.
 * No next/font here: the root 404 is part of every route's module graph, and importing the marketing fonts
 * would preload them on every page (future /app, /ops, /supplier too). It uses the fallback font stack.
 */
export const metadata: Metadata = {
  title: `${NOT_FOUND.title} — ${SITE_NAME}`,
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <ThemeScope className="fbg-site">
      <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-(--fbg-bg-canvas) px-4 text-center text-(--fbg-text-primary)">
        <a href="/" className="flex items-center gap-2.5 font-semibold">
          <span className="flex h-9 w-9 items-center justify-center rounded-(--fbg-radius-chip) bg-(--fbg-action-primary) text-(--fbg-action-on-primary)">
            <BrandMark size={24} />
          </span>
          {SITE_NAME}
        </a>
        <div>
          <p className="fbg-num text-[13px] font-semibold tracking-[0.08em] text-(--fbg-action-primary) uppercase">
            404
          </p>
          <h1 className="fbg-display mt-2 text-[32px] leading-tight md:text-[40px]">
            {NOT_FOUND.title}
          </h1>
          <p className="mt-3 text-[16px] text-(--fbg-text-secondary)">{NOT_FOUND.body}</p>
        </div>
        <a href="/" className={buttonClasses("primary", "lg")}>
          {NOT_FOUND.cta}
        </a>
      </main>
    </ThemeScope>
  );
}
