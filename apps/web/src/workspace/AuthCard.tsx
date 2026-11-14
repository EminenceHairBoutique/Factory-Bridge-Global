/**
 * Centered card for sign-in, sign-up, code entry, onboarding and invitations (B-05). Production counterpart of the
 * preview's AuthFrame without its demo stripe or preview links; server component.
 */
import type { ReactNode } from "react";
import { BrandMark } from "@/site/components/marks";
import { AUTH_COPY } from "./copy";
import { ThemeScope } from "./ui";

export function AuthCard({
  title,
  lead,
  children,
  footer,
  wide = false,
}: {
  title: ReactNode;
  lead?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  return (
    <ThemeScope>
      <div className="flex min-h-dvh flex-col bg-(--fbg-bg-canvas) text-(--fbg-text-primary)">
        <header className="flex items-center px-5 py-4 sm:px-8">
          <a href="/" className="flex items-center gap-2 text-sm font-semibold">
            <span className="flex h-8 w-8 items-center justify-center rounded-(--fbg-radius-chip) bg-(--fbg-action-primary) text-(--fbg-action-on-primary)">
              <BrandMark size={20} />
            </span>
            {AUTH_COPY.productName}
          </a>
        </header>
        <main className="flex flex-1 items-start justify-center px-4 pt-6 pb-16 sm:pt-12">
          <div
            className={`w-full ${wide ? "max-w-2xl" : "max-w-[420px]"} rounded-(--fbg-radius-card) border border-(--fbg-border-subtle) bg-(--fbg-bg-surface) p-6 sm:p-8`}
          >
            <h1 className="text-[24px] leading-tight font-semibold tracking-[-0.01em]">{title}</h1>
            {lead ? (
              <p className="mt-2 text-[15px] leading-relaxed text-(--fbg-text-secondary)">{lead}</p>
            ) : null}
            <div className="mt-6">{children}</div>
            {footer ? (
              <div className="mt-6 border-t border-(--fbg-border-divider) pt-4 text-sm text-(--fbg-text-secondary)">
                {footer}
              </div>
            ) : null}
          </div>
        </main>
      </div>
    </ThemeScope>
  );
}
