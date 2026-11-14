/**
 * Production shell for `/app`, `/ops` and `/supplier` (B-05). Server component, no demo stripe, no preview routes.
 * Shows the active organization and role (from the guard's live lookup), an org switcher that works without
 * JavaScript, and sign-out. Navigation lists only routes that exist; hiding a link is never the control — every page
 * and action runs the guard itself.
 */
import Link from "next/link";
import type { ReactNode } from "react";
import { t, type Locale, type MessageKey } from "@fbg/i18n";
import {
  eligibleMemberships,
  workspaceForOrgType,
  type WorkspaceKind,
} from "@fbg/domain/workspace";
import { signOut } from "@/app/(auth)/actions";
import type { WorkspaceContext } from "@/server/auth/guard";
import { switchOrganization } from "@/server/auth/switch-org";
import { BrandMark } from "@/site/components/marks";
import { BUYER_COPY, OPS_COPY } from "./copy";
import { Badge, Button, ThemeScope, cx } from "./ui";

export interface NavItem {
  readonly href: string;
  readonly label: string;
  readonly current?: boolean;
}

const WORKSPACE_LABEL: Record<WorkspaceKind, (l: Locale) => string> = {
  buyer: () => BUYER_COPY.workspace,
  internal: () => OPS_COPY.workspace,
  supplier: (l) => t(l, "supplier.workspace"),
};

export function roleLabel(locale: Locale, role: string): string {
  return t(locale, `role.${role}` as MessageKey);
}

export function WorkspaceShell({
  ctx,
  nav,
  locale = "en-US",
  children,
}: {
  ctx: Pick<WorkspaceContext, "kind" | "active" | "memberships" | "user">;
  nav: readonly NavItem[];
  locale?: Locale;
  children: ReactNode;
}) {
  const switchable = ctx.memberships.filter(
    (m) => eligibleMemberships([m], workspaceForOrgType(m.orgType)).length > 0,
  );
  const orgName =
    locale === "zh-CN" ? (ctx.active.orgNameZh ?? ctx.active.orgName) : ctx.active.orgName;
  return (
    <ThemeScope>
      <div lang={locale} className="min-h-dvh bg-(--fbg-bg-canvas) text-(--fbg-text-primary)">
        <header className="border-b border-(--fbg-border-subtle) bg-(--fbg-bg-surface)">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 sm:px-6">
            <Link href="/" className="flex items-center gap-2 text-sm font-semibold">
              <span className="flex h-8 w-8 items-center justify-center rounded-(--fbg-radius-chip) bg-(--fbg-action-primary) text-(--fbg-action-on-primary)">
                <BrandMark size={20} />
              </span>
              <span className="hidden sm:inline">Factory Bridge Global</span>
            </Link>
            <div className="flex min-w-0 items-center gap-2 text-sm">
              <span className="text-(--fbg-text-secondary)">
                {WORKSPACE_LABEL[ctx.kind](locale)}
              </span>
              <span aria-hidden className="text-(--fbg-text-muted)">
                /
              </span>
              <span className="truncate font-medium" data-testid="active-org">
                {orgName}
              </span>
              <Badge tone="neutral">{roleLabel(locale, ctx.active.role)}</Badge>
            </div>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              {switchable.length > 1 ? (
                <form action={switchOrganization} className="flex items-center gap-2">
                  <label htmlFor="org-switch" className="sr-only">
                    {t(locale, "nav.switch_org")}
                  </label>
                  <select
                    id="org-switch"
                    name="orgId"
                    defaultValue={ctx.active.orgId}
                    className="h-(--fbg-control-h-sm) max-w-56 rounded-(--fbg-radius-control) border border-(--fbg-border-strong)/60 bg-(--fbg-bg-surface) px-2 text-[13px]"
                  >
                    {switchable.map((m) => (
                      <option key={m.orgId} value={m.orgId}>
                        {m.orgName} · {roleLabel(locale, m.role)}
                      </option>
                    ))}
                  </select>
                  <Button type="submit" size="sm">
                    {t(locale, "nav.switch")}
                  </Button>
                </form>
              ) : null}
              <span
                className="hidden text-[13px] text-(--fbg-text-secondary) md:inline"
                data-testid="signed-in-email"
              >
                {ctx.user.email}
              </span>
              <form action={signOut}>
                <Button type="submit" size="sm" variant="ghost">
                  {t(locale, "nav.sign_out")}
                </Button>
              </form>
            </div>
          </div>
          {nav.length ? (
            <nav
              aria-label={WORKSPACE_LABEL[ctx.kind](locale)}
              className="mx-auto max-w-6xl px-4 sm:px-6"
            >
              <ul className="flex gap-1 overflow-x-auto">
                {nav.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={item.current ? "page" : undefined}
                      className={cx(
                        "inline-flex h-10 items-center border-b-2 px-3 text-sm",
                        item.current
                          ? "border-(--fbg-action-primary) font-medium text-(--fbg-text-primary)"
                          : "border-transparent text-(--fbg-text-secondary) hover:text-(--fbg-text-primary)",
                      )}
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ) : null}
        </header>
        <main className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6">{children}</main>
      </div>
    </ThemeScope>
  );
}
