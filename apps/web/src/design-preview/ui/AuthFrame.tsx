"use client";

/**
 * Centered authentication frame: 420 px card on the canvas, brand mark, demo stripe, appearance switch and a
 * locale toggle in the footer (docs/design/atlas-obsidian/PAGE_BY_PAGE_BLUEPRINT.md §2). Used by sign-in,
 * invitation and organization setup. Nothing here submits anywhere.
 */
import Link from "next/link";
import type { ReactNode } from "react";
import { ThemeScope } from "../theme";
import { AppearanceSwitch, BrandMark, DemoStripe } from "./AppShell";
import { cx } from "./primitives";

export function AuthFrame({
  title,
  lead,
  children,
  footer,
  wide = false,
  lang = "en-US",
}: {
  title: ReactNode;
  lead?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
  lang?: "en-US" | "zh-CN";
}) {
  return (
    <ThemeScope>
      <div
        lang={lang}
        className="flex min-h-dvh flex-col bg-(--fbg-bg-canvas) text-(--fbg-text-primary)"
      >
        <DemoStripe locale={lang} />
        <header className="flex items-center justify-between px-5 py-4 sm:px-8">
          <Link
            href="/design-preview/marketing"
            className="flex items-center gap-2 text-sm font-semibold text-(--fbg-text-primary)"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-(--fbg-radius-chip) bg-(--fbg-action-primary) text-(--fbg-action-on-primary)">
              <BrandMark size={22} />
            </span>
            Factory Bridge Global
          </Link>
          <Link
            href="/design-preview"
            className="text-xs text-(--fbg-text-secondary) hover:text-(--fbg-text-primary)"
          >
            Design preview
          </Link>
        </header>
        <main className="flex flex-1 items-start justify-center px-4 py-8 sm:py-12">
          <div className={cx("w-full", wide ? "max-w-3xl" : "max-w-[420px]")}>
            <div className="fbg-raised rounded-(--fbg-radius-dialog) border border-(--fbg-border-subtle) p-6 sm:p-8">
              <h1 className="text-[26px] leading-tight font-semibold tracking-[-0.01em]">
                {title}
              </h1>
              {lead ? <p className="mt-2 text-[15px] text-(--fbg-text-secondary)">{lead}</p> : null}
              <div className="mt-6">{children}</div>
            </div>
            {footer ? (
              <div className="mt-4 text-center text-sm text-(--fbg-text-secondary)">{footer}</div>
            ) : null}
          </div>
        </main>
        <footer className="flex flex-col items-center gap-3 px-5 py-6 text-xs text-(--fbg-text-secondary) sm:flex-row sm:justify-between sm:px-8">
          <span>Pilot program · Terms · Privacy · 供应商申请</span>
          <AppearanceSwitch locale={lang} />
        </footer>
      </div>
    </ThemeScope>
  );
}
