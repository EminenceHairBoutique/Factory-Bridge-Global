"use client";

/**
 * AppShell — Atlas × Obsidian, UX-03 clarity pass.
 *
 * Desktop/tablet: 224 px rail (collapsible to 64 px) with one active destination, an account button at the
 * bottom and nothing else; a 56 px top bar that carries only the organization label, the planned
 * notifications entry and the account button. The page itself renders the single h1 (PageHeader), so the
 * shell never repeats the title. Phone: top bar with the brand and a navigation sheet, four bottom tabs
 * (Home · Projects · Inbox · Account) where Account opens the account-and-appearance sheet.
 *
 * Navigation data and the active-state rule live in ../nav.ts (unit tested). Planned destinations render
 * disabled with a "Planned" label and no count; nothing here pretends to work.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { NAV, activeNavItem, mobileTabs, type NavItem, type Workspace } from "../nav";
import { THEME_OPTIONS, ThemeScope, useTheme } from "../theme";
import { Icon } from "./icons";
import { SegmentedControl, cx } from "./primitives";
import { useEscapeKey } from "./useEscapeKey";

export type { Workspace } from "../nav";
export type ShellLocale = "en-US" | "zh-CN";

/** Shell chrome strings. Supplier workspace is Simplified-Chinese first (IA §2.3). */
const CHROME: Record<
  ShellLocale,
  {
    planned: string;
    notInPrototype: string;
    appearance: string;
    collapse: string;
    expandNav: string;
    collapseNav: string;
    openNav: string;
    orgCurrent: string;
    notificationsPlanned: string;
    account: string;
    language: string;
    languageNote: string;
    signedIn: string;
    primaryNav: string;
    mobileNav: string;
    navigation: string;
    closeNav: string;
    close: string;
    noticeStrong: string;
    noticeRest: string;
    themeLabels: readonly [string, string, string];
  }
> = {
  "en-US": {
    planned: "Planned",
    notInPrototype: "not in this prototype",
    appearance: "Appearance",
    collapse: "Collapse",
    expandNav: "Expand navigation",
    collapseNav: "Collapse navigation",
    openNav: "Open navigation",
    orgCurrent: "Current organization. Switching organizations is not in this prototype.",
    notificationsPlanned: "Notifications — planned, not in this prototype",
    account: "Account and appearance",
    language: "Interface language",
    languageNote:
      "English. A Chinese buyer interface is planned; the supplier workspace is Chinese-first.",
    signedIn: "Signed in as",
    primaryNav: "Primary",
    mobileNav: "Primary (mobile)",
    navigation: "Navigation",
    closeNav: "Close navigation",
    close: "Close",
    noticeStrong: "DEMO DATA — NOT REAL SUPPLIER QUOTATIONS",
    noticeRest: "Development preview with synthetic records only.",
    themeLabels: ["Atlas", "Obsidian", "System"],
  },
  "zh-CN": {
    planned: "规划中",
    notInPrototype: "原型中暂未提供",
    appearance: "外观",
    collapse: "收起",
    expandNav: "展开导航",
    collapseNav: "收起导航",
    openNav: "打开导航",
    orgCurrent: "当前企业。原型中不支持切换企业。",
    notificationsPlanned: "通知 — 规划中，原型中暂未提供",
    account: "账户与外观",
    language: "界面语言",
    languageNote: "简体中文。英文供应商界面规划中。",
    signedIn: "当前登录",
    primaryNav: "主导航",
    mobileNav: "主导航（手机）",
    navigation: "导航",
    closeNav: "关闭导航",
    close: "关闭",
    noticeStrong: "演示数据 — 非真实供应商报价",
    noticeRest: "DEMO DATA — NOT REAL SUPPLIER QUOTATIONS · 开发预览，仅含合成记录。",
    themeLabels: ["Atlas", "Obsidian", "跟随系统"],
  },
};

const WORKSPACE_LOCALE: Record<Workspace, ShellLocale> = {
  buyer: "en-US",
  ops: "en-US",
  supplier: "zh-CN",
};

const WORKSPACE_META: Record<
  Workspace,
  { name: string; org: string; user: string; avatar: string; accountRows: readonly string[] }
> = {
  buyer: {
    name: "Buyer workspace",
    org: "Demo Buyer Co.",
    user: "Demo Buyer",
    avatar: "DB",
    accountRows: ["Organization", "Team and account"],
  },
  ops: {
    name: "Sourcing operations",
    org: "Factory Bridge Global · internal",
    user: "Demo Operator",
    avatar: "DO",
    accountRows: ["Account settings"],
  },
  supplier: {
    name: "供应商工作台",
    org: "演示供应商A（Supplier A, demo）",
    user: "演示供应商A",
    avatar: "演",
    accountRows: ["账户设置"],
  },
};

/**
 * Demo-data notice. Always rendered above every preview screen; slender and neutral but unmistakable
 * (warning marker, bold statement), and it cannot be dismissed.
 */
export function DemoStripe({ locale = "en-US" }: { locale?: ShellLocale }) {
  const t = CHROME[locale];
  return (
    <div
      role="status"
      lang={locale}
      className="fbg-demo-notice flex items-center justify-center gap-2 px-4 py-1.5 text-center text-[12px] leading-4 text-(--fbg-text-secondary) md:sticky md:top-0 md:z-40"
    >
      <Icon name="alert" size={13} className="shrink-0 text-(--fbg-status-warning)" />
      <span>
        <strong className="font-semibold text-(--fbg-text-primary)">{t.noticeStrong}</strong>
        <span className="hidden sm:inline"> · {t.noticeRest}</span>
      </span>
    </div>
  );
}

export function BrandMark({ size = 28, className }: { size?: number; className?: string }) {
  // Abstract bridge/connection mark: two anchors joined by a single arc, drawn with lines only.
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      aria-hidden
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
    >
      <path d="M4 24h24" />
      <path d="M8 24V14M24 24V14" />
      <path d="M6 16c4-8 16-8 20 0" />
      <circle cx="16" cy="9" r="1.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function AppearanceSwitch({
  size = "sm",
  locale = "en-US",
}: {
  size?: "sm" | "md";
  locale?: ShellLocale;
}) {
  const { theme, setTheme } = useTheme();
  const labels = CHROME[locale].themeLabels;
  return (
    <SegmentedControl
      label={CHROME[locale].appearance}
      size={size}
      options={THEME_OPTIONS.map((o, i) => ({ value: o.value, label: labels[i] ?? o.label }))}
      value={theme}
      onChange={setTheme}
    />
  );
}

export function AppShell({
  workspace,
  title,
  children,
  rightRail,
}: {
  workspace: Workspace;
  /** Names the main landmark for assistive tech. The visible h1 is rendered by the page (PageHeader). */
  title: string;
  children: ReactNode;
  /** Optional "Evidence drawer" content (IA §3). Shown as a column on xl screens, a panel below otherwise. */
  rightRail?: ReactNode;
}) {
  return (
    <ThemeScope>
      <ShellInner workspace={workspace} title={title} rightRail={rightRail}>
        {children}
      </ShellInner>
    </ThemeScope>
  );
}

type AccountAnchor = "rail" | "top" | "tabs";

function ShellInner({
  workspace,
  title,
  children,
  rightRail,
}: {
  workspace: Workspace;
  title: string;
  children: ReactNode;
  rightRail?: ReactNode;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [account, setAccount] = useState<AccountAnchor | null>(null);
  const nav = NAV[workspace].main;
  const navBottom = NAV[workspace].bottom;
  const meta = WORKSPACE_META[workspace];
  const locale = WORKSPACE_LOCALE[workspace];
  const t = CHROME[locale];
  const tabs = mobileTabs(nav, navBottom);
  const activeItem = activeNavItem([...nav, ...navBottom], pathname);

  useEffect(() => {
    setSheetOpen(false);
    setAccount(null);
  }, [pathname]);
  useEscapeKey(sheetOpen, () => setSheetOpen(false));

  const toggleAccount = (anchor: AccountAnchor) =>
    setAccount((current) => (current === anchor ? null : anchor));

  const railItem = (item: NavItem) => {
    const active = item === activeItem;
    const base = cx(
      "relative flex h-10 items-center gap-3 rounded-(--fbg-radius-control) px-3 text-sm",
      collapsed && "justify-center px-0",
      active ? "fbg-nav-active bg-white/12 font-medium text-white" : "text-white/70",
      item.href ? "hover:bg-white/8 hover:text-white" : "cursor-default opacity-55",
    );
    const inner = (
      <>
        <Icon name={item.icon} size={18} className="shrink-0" />
        {!collapsed ? <span className="flex-1 truncate">{item.label}</span> : null}
        {!collapsed && item.badge ? (
          <span className="fbg-num rounded-full bg-white/14 px-1.5 text-[11px] font-semibold text-white">
            {item.badge}
          </span>
        ) : null}
        {!collapsed && !item.href ? (
          <span className="text-[11px] text-white/55">{t.planned}</span>
        ) : null}
      </>
    );
    return item.href ? (
      <Link
        key={item.label}
        href={item.href}
        className={base}
        title={collapsed ? item.label : undefined}
        aria-current={active ? "page" : undefined}
      >
        {inner}
      </Link>
    ) : (
      <span
        key={item.label}
        className={base}
        title={`${item.label} — ${t.notInPrototype}`}
        aria-disabled
      >
        {inner}
      </span>
    );
  };

  return (
    <div lang={locale} className="min-h-dvh bg-(--fbg-bg-canvas) text-(--fbg-text-primary)">
      <DemoStripe locale={locale} />
      <div className="flex min-h-[calc(100dvh-var(--fbg-notice-h))]">
        {/* Left rail (tablet and up) */}
        <aside
          className={cx(
            "hidden shrink-0 flex-col border-r border-white/8 bg-(--fbg-rail-bg) text-(--fbg-rail-fg) md:sticky md:top-(--fbg-notice-h) md:flex md:h-[calc(100dvh-var(--fbg-notice-h))] md:self-start",
            collapsed ? "w-(--fbg-rail-w-collapsed)" : "w-(--fbg-rail-w)",
          )}
        >
          <div className={cx("flex h-14 items-center", collapsed ? "justify-center" : "px-4")}>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-(--fbg-radius-chip) bg-(--fbg-action-primary) text-(--fbg-action-on-primary)">
              <BrandMark size={22} />
            </span>
            {!collapsed ? (
              <span className="ml-3 min-w-0">
                <span className="block truncate text-sm font-semibold leading-4">
                  Factory Bridge Global
                </span>
                <span className="block truncate text-[11px] leading-4 text-white/55">
                  {meta.name}
                </span>
              </span>
            ) : null}
          </div>
          <nav
            aria-label={t.primaryNav}
            className="fbg-no-scrollbar flex-1 space-y-0.5 overflow-y-auto px-2 pt-2"
          >
            {nav.map(railItem)}
          </nav>
          <div className="space-y-1 border-t border-white/10 p-2">
            <button
              type="button"
              onClick={() => toggleAccount("rail")}
              aria-haspopup="dialog"
              aria-expanded={account === "rail"}
              title={collapsed ? t.account : undefined}
              className={cx(
                "flex w-full items-center gap-3 rounded-(--fbg-radius-control) px-2 py-2 text-left hover:bg-white/8",
                collapsed && "justify-center px-0",
              )}
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/14 text-[11px] font-semibold">
                {meta.avatar}
              </span>
              {!collapsed ? (
                <>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium">{meta.user}</span>
                    <span className="block truncate text-[11px] text-white/55">{meta.org}</span>
                  </span>
                  <Icon name="settings" size={16} className="shrink-0 text-white/55" />
                </>
              ) : null}
            </button>
            <button
              type="button"
              onClick={() => setCollapsed((v) => !v)}
              className="flex h-8 w-full items-center justify-center gap-2 rounded-(--fbg-radius-control) text-[12px] text-white/55 hover:bg-white/8 hover:text-white"
              aria-pressed={collapsed}
              aria-label={collapsed ? t.expandNav : t.collapseNav}
            >
              <Icon name={collapsed ? "chevron-right" : "chevron-left"} size={16} />
              {!collapsed ? t.collapse : null}
            </button>
          </div>
        </aside>

        {/* Main column */}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-(--fbg-border-subtle) bg-(--fbg-bg-canvas)/92 px-3 backdrop-blur sm:px-5 md:top-(--fbg-notice-h) lg:px-8 xl:px-10">
            <button
              type="button"
              className="-ml-1 rounded-(--fbg-radius-control) p-2.5 text-(--fbg-text-primary) hover:bg-(--fbg-hover) md:hidden"
              onClick={() => setSheetOpen(true)}
              aria-label={t.openNav}
            >
              <Icon name="menu" size={20} />
            </button>
            <span className="flex min-w-0 items-center gap-2 md:hidden">
              <BrandMark size={20} className="shrink-0 text-(--fbg-action-primary)" />
              <span className="truncate text-sm font-semibold">Factory Bridge Global</span>
            </span>
            <div className="min-w-0 flex-1" />
            <div className="flex items-center gap-1 sm:gap-2">
              <span
                className="hidden items-center gap-1.5 pr-1 text-[13px] text-(--fbg-text-secondary) lg:inline-flex"
                title={t.orgCurrent}
              >
                <Icon name="building" size={14} />
                <span className="max-w-48 truncate">{meta.org}</span>
              </span>
              <span
                role="img"
                aria-label={t.notificationsPlanned}
                title={t.notificationsPlanned}
                className="hidden h-9 w-9 items-center justify-center rounded-(--fbg-radius-control) text-(--fbg-text-muted) md:inline-flex"
              >
                <Icon name="bell" size={18} />
              </span>
              <button
                type="button"
                onClick={() => toggleAccount("top")}
                aria-haspopup="dialog"
                aria-expanded={account === "top"}
                aria-label={t.account}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-(--fbg-action-primary) text-xs font-semibold text-(--fbg-action-on-primary) hover:bg-(--fbg-action-primary-hover)"
              >
                {meta.avatar}
              </button>
            </div>
          </header>

          <div className="flex min-w-0 flex-1">
            <main
              aria-label={title}
              className="min-w-0 flex-1 px-4 pt-5 pb-28 sm:px-6 md:pb-10 lg:px-8 xl:px-10"
            >
              {children}
            </main>
            {rightRail ? (
              <aside className="hidden w-(--fbg-drawer-w) shrink-0 border-l border-(--fbg-border-subtle) bg-(--fbg-bg-surface) p-5 xl:block">
                {rightRail}
              </aside>
            ) : null}
          </div>
        </div>
      </div>

      {/* Phone bottom tab bar: four destinations, the last opens the account sheet */}
      <nav
        aria-label={t.mobileNav}
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-(--fbg-border-subtle) bg-(--fbg-bg-surface) pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        {tabs.map((item) => {
          const active = item === activeItem;
          const cls = cx(
            "flex min-h-14 min-w-0 flex-col items-center justify-center gap-0.5 py-2 text-[11px]",
            active
              ? "font-medium text-(--fbg-action-primary)"
              : "text-(--fbg-text-secondary) hover:text-(--fbg-text-primary)",
            !item.href && !item.action && "opacity-50",
          );
          const inner = (
            <>
              <span className="relative">
                <Icon name={item.icon} size={22} />
                {item.badge ? (
                  <span className="fbg-num absolute -top-1 -right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-(--fbg-brand-accent) px-1 text-[10px] font-semibold text-(--fbg-text-inverse)">
                    {item.badge}
                  </span>
                ) : null}
              </span>
              <span className="max-w-full truncate px-0.5">{item.short ?? item.label}</span>
            </>
          );
          if (item.action === "account") {
            return (
              <button
                key={item.label}
                type="button"
                className={cx(cls, account === "tabs" && "text-(--fbg-text-primary)")}
                onClick={() => toggleAccount("tabs")}
                aria-haspopup="dialog"
                aria-expanded={account === "tabs"}
              >
                {inner}
              </button>
            );
          }
          return item.href ? (
            <Link
              key={item.label}
              href={item.href}
              className={cls}
              aria-current={active ? "page" : undefined}
            >
              {inner}
            </Link>
          ) : (
            <span
              key={item.label}
              className={cls}
              aria-disabled
              title={`${item.label} — ${t.notInPrototype}`}
            >
              {inner}
            </span>
          );
        })}
      </nav>

      {/* Phone navigation sheet */}
      {sheetOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t.navigation}
          className="fixed inset-0 z-50 md:hidden"
        >
          <button
            type="button"
            className="absolute inset-0 bg-(--fbg-overlay)"
            aria-label={t.closeNav}
            onClick={() => setSheetOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[82dvh] overflow-y-auto rounded-t-(--fbg-radius-dialog) bg-(--fbg-bg-surface) p-3 pb-[max(env(safe-area-inset-bottom),12px)]">
            <div className="mb-2 flex items-center justify-between px-1">
              <p className="text-sm font-semibold text-(--fbg-text-primary)">{meta.name}</p>
              <button
                type="button"
                className="rounded-(--fbg-radius-control) p-2.5 text-(--fbg-text-secondary) hover:bg-(--fbg-hover)"
                onClick={() => setSheetOpen(false)}
                aria-label={t.close}
              >
                <Icon name="x" size={18} />
              </button>
            </div>
            <ul className="space-y-0.5">
              {nav.map((item) => (
                <li key={item.label}>
                  {item.href ? (
                    <Link
                      href={item.href}
                      aria-current={item === activeItem ? "page" : undefined}
                      className={cx(
                        "flex min-h-11 items-center gap-3 rounded-(--fbg-radius-control) px-3 py-2.5 text-[15px]",
                        item === activeItem
                          ? "bg-(--fbg-selected) font-medium text-(--fbg-text-primary)"
                          : "text-(--fbg-text-primary) hover:bg-(--fbg-hover)",
                      )}
                    >
                      <Icon name={item.icon} size={18} className="text-(--fbg-text-secondary)" />
                      <span className="flex-1">{item.label}</span>
                      {item.badge ? (
                        <span className="fbg-num rounded-full bg-(--fbg-hover) px-1.5 text-[11px] font-semibold text-(--fbg-text-primary)">
                          {item.badge}
                        </span>
                      ) : null}
                    </Link>
                  ) : (
                    <span className="flex min-h-11 items-center gap-3 rounded-(--fbg-radius-control) px-3 py-2.5 text-[15px] text-(--fbg-text-muted)">
                      <Icon name={item.icon} size={18} />
                      <span className="flex-1">{item.label}</span>
                      <span className="text-[11px]">{t.planned}</span>
                    </span>
                  )}
                </li>
              ))}
              <li>
                <button
                  type="button"
                  onClick={() => {
                    setSheetOpen(false);
                    setAccount("tabs");
                  }}
                  className="flex min-h-11 w-full items-center gap-3 rounded-(--fbg-radius-control) px-3 py-2.5 text-left text-[15px] text-(--fbg-text-primary) hover:bg-(--fbg-hover)"
                >
                  <Icon name="user" size={18} className="text-(--fbg-text-secondary)" />
                  <span className="flex-1">{t.account}</span>
                  <Icon name="chevron-right" size={16} className="text-(--fbg-text-muted)" />
                </button>
              </li>
            </ul>
          </div>
        </div>
      ) : null}

      {account ? (
        <AccountSheet
          locale={locale}
          meta={meta}
          anchor={account}
          onClose={() => setAccount(null)}
        />
      ) : null}
    </div>
  );
}

/**
 * Account and appearance: who is signed in, the organization, the appearance switch, the interface
 * language (stated, not switchable) and the planned account destinations. Bottom sheet on phones, a
 * popover next to its trigger on wider screens.
 */
function AccountSheet({
  locale,
  meta,
  anchor,
  onClose,
}: {
  locale: ShellLocale;
  meta: (typeof WORKSPACE_META)[Workspace];
  anchor: AccountAnchor;
  onClose: () => void;
}) {
  const t = CHROME[locale];
  useEscapeKey(true, onClose);
  return (
    <div role="dialog" aria-modal="true" aria-label={t.account} className="fixed inset-0 z-50">
      <button
        type="button"
        className="absolute inset-0 bg-(--fbg-overlay) md:bg-transparent"
        aria-label={t.close}
        onClick={onClose}
      />
      <div
        className={cx(
          "fbg-raised absolute inset-x-0 bottom-0 flex flex-col gap-4 rounded-t-(--fbg-radius-dialog) border border-(--fbg-border-subtle) p-4 pb-[max(env(safe-area-inset-bottom),16px)]",
          "md:inset-x-auto md:w-80 md:rounded-(--fbg-radius-card) md:pb-4",
          anchor === "rail" ? "md:bottom-3 md:left-3" : "md:top-14 md:right-4 md:bottom-auto",
        )}
      >
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-(--fbg-action-primary) text-xs font-semibold text-(--fbg-action-on-primary)">
            {meta.avatar}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] text-(--fbg-text-secondary)">{t.signedIn}</p>
            <p className="truncate text-sm font-medium text-(--fbg-text-primary)">{meta.user}</p>
            <p className="truncate text-[13px] text-(--fbg-text-secondary)">{meta.org}</p>
          </div>
          <button
            type="button"
            autoFocus
            className="-mt-1 -mr-1 rounded-(--fbg-radius-control) p-2 text-(--fbg-text-secondary) hover:bg-(--fbg-hover)"
            onClick={onClose}
            aria-label={t.close}
          >
            <Icon name="x" size={18} />
          </button>
        </div>
        <div>
          <p className="mb-1.5 text-[12px] font-medium text-(--fbg-text-secondary)">
            {t.appearance}
          </p>
          <AppearanceSwitch size="md" locale={locale} />
        </div>
        <div>
          <p className="mb-0.5 text-[12px] font-medium text-(--fbg-text-secondary)">{t.language}</p>
          <p className="text-[13px] text-(--fbg-text-primary)">{t.languageNote}</p>
        </div>
        <ul className="-mx-1 border-t border-(--fbg-border-divider) pt-2">
          {meta.accountRows.map((row) => (
            <li key={row}>
              <span
                aria-disabled
                title={`${row} — ${t.notInPrototype}`}
                className="flex min-h-10 items-center gap-3 rounded-(--fbg-radius-control) px-2 text-[14px] text-(--fbg-text-muted)"
              >
                <Icon name={row === "Organization" ? "building" : "user"} size={16} />
                <span className="flex-1">{row}</span>
                <span className="text-[11px]">{t.planned}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
