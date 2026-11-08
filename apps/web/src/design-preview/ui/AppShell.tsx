"use client";

/**
 * AppShell — Atlas × Obsidian V1 (IA §3; docs/design/atlas-obsidian/INFORMATION_ARCHITECTURE.md).
 * Desktop/tablet: collapsible left rail (248 px), top bar with org switcher, locale and notifications; the rail's
 * bottom area holds organization, appearance and account. Phone: top bar with a navigation sheet and a four-tab
 * bottom bar (Home · Projects · Inbox · Account); "New request" is a prominent action on Home, not a tab.
 *
 * Prototype only: links point at other design-preview screens; destinations that do not exist yet render as
 * disabled entries labelled "Planned" so the navigation model is visible without pretending they work.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { THEME_OPTIONS, ThemeScope, useTheme } from "../theme";
import { Icon, type IconName } from "./icons";
import { SegmentedControl, cx } from "./primitives";
import { useEscapeKey } from "./useEscapeKey";

export type Workspace = "buyer" | "ops" | "supplier";
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
    orgSwitcher: string;
    notifications: string;
    signedIn: string;
    primaryNav: string;
    mobileNav: string;
    navigation: string;
    closeNav: string;
    close: string;
    stripe: string;
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
    orgSwitcher: "Organization switcher (prototype)",
    notifications: "Notifications, 3 unread",
    signedIn: "Signed in as Demo Buyer",
    primaryNav: "Primary",
    mobileNav: "Primary (mobile)",
    navigation: "Navigation",
    closeNav: "Close navigation",
    close: "Close",
    stripe: "DEMO DATA — NOT REAL SUPPLIER QUOTATIONS. Synthetic records for design review only.",
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
    orgSwitcher: "切换企业（原型）",
    notifications: "通知，3 条未读",
    signedIn: "当前登录：演示供应商A",
    primaryNav: "主导航",
    mobileNav: "主导航（手机）",
    navigation: "导航",
    closeNav: "关闭导航",
    close: "关闭",
    stripe: "演示数据 — 非真实供应商报价。DEMO DATA — NOT REAL SUPPLIER QUOTATIONS.",
    themeLabels: ["Atlas", "Obsidian", "跟随系统"],
  },
};

const WORKSPACE_LOCALE: Record<Workspace, ShellLocale> = {
  buyer: "en-US",
  ops: "en-US",
  supplier: "zh-CN",
};

interface NavItem {
  label: string;
  /** Shorter label for the phone tab bar. */
  short?: string;
  icon: IconName;
  href?: string;
  badge?: number;
  /** One of the four phone tabs. */
  mobile?: boolean;
  /** Order in the phone tab bar when it differs from the sidebar order. */
  mobileOrder?: number;
}

const BUYER_NAV: NavItem[] = [
  {
    label: "Overview",
    short: "Home",
    icon: "home",
    href: "/design-preview/buyer/dashboard",
    mobile: true,
  },
  {
    label: "Projects",
    icon: "folder",
    href: "/design-preview/buyer/dashboard#projects",
    mobile: true,
  },
  { label: "Quotes", icon: "compare", href: "/design-preview/buyer/compare" },
  { label: "Messages", short: "Inbox", icon: "message", badge: 1, mobile: true },
  { label: "Documents", icon: "document" },
];

const BUYER_NAV_BOTTOM: NavItem[] = [
  { label: "Organization", icon: "building" },
  { label: "Team and account", short: "Account", icon: "user", mobile: true },
];

const OPS_NAV: NavItem[] = [
  {
    label: "Work queue",
    short: "Queue",
    icon: "list",
    href: "/design-preview/ops/queue",
    mobile: true,
  },
  { label: "Projects", icon: "folder", mobile: true },
  { label: "Research", icon: "search" },
  { label: "Suppliers", icon: "building", href: "/design-preview/ops/suppliers" },
  {
    label: "Reviews",
    icon: "eye",
    href: "/design-preview/ops/quote-review",
    badge: 4,
    mobile: true,
  },
  { label: "Cases", icon: "flag" },
  { label: "Admin", icon: "lock" },
];

const OPS_NAV_BOTTOM: NavItem[] = [
  { label: "Outreach approvals", icon: "message", badge: 2 },
  { label: "Account", icon: "user", mobile: true },
];

const SUPPLIER_NAV: NavItem[] = [
  { label: "工作台", icon: "home", href: "/design-preview/supplier/dashboard", mobile: true },
  { label: "企业资料", icon: "building", href: "/design-preview/supplier/onboarding" },
  { label: "产品目录", icon: "list" },
  {
    label: "阶梯报价",
    short: "报价",
    icon: "compare",
    href: "/design-preview/supplier/pricing",
    mobile: true,
    mobileOrder: 2,
  },
  {
    label: "询价单",
    icon: "document",
    href: "/design-preview/supplier/rfqs",
    badge: 2,
    mobile: true,
    mobileOrder: 1,
  },
  { label: "文件与消息", icon: "message", badge: 1 },
  { label: "数据共享设置", icon: "lock", href: "/design-preview/supplier/sharing" },
];

const SUPPLIER_NAV_BOTTOM: NavItem[] = [{ label: "账户", icon: "user", mobile: true }];

const WORKSPACE_META: Record<Workspace, { name: string; org: string; avatar: string }> = {
  buyer: { name: "Buyer workspace", org: "Demo Buyer Co.", avatar: "DB" },
  ops: { name: "Sourcing operations", org: "Factory Bridge Global · internal", avatar: "DB" },
  supplier: { name: "供应商工作台", org: "演示供应商A（Supplier A, demo）", avatar: "演" },
};

const NAV: Record<Workspace, { main: NavItem[]; bottom: NavItem[] }> = {
  buyer: { main: BUYER_NAV, bottom: BUYER_NAV_BOTTOM },
  ops: { main: OPS_NAV, bottom: OPS_NAV_BOTTOM },
  supplier: { main: SUPPLIER_NAV, bottom: SUPPLIER_NAV_BOTTOM },
};

export function DemoStripe({ locale = "en-US" }: { locale?: ShellLocale }) {
  return (
    <div
      role="status"
      lang={locale}
      className="fbg-demo-stripe border-b border-(--fbg-status-warning)/40 px-4 py-1.5 text-center text-xs font-semibold tracking-wide text-(--fbg-text-primary)"
    >
      {CHROME[locale].stripe}
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
  const nav = NAV[workspace].main;
  const navBottom = NAV[workspace].bottom;
  const meta = WORKSPACE_META[workspace];
  const locale = WORKSPACE_LOCALE[workspace];
  const t = CHROME[locale];
  const mobileTabs = [...nav, ...navBottom]
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item.mobile)
    .sort((a, b) => (a.item.mobileOrder ?? a.index) - (b.item.mobileOrder ?? b.index))
    .map(({ item }) => item)
    .slice(0, 4);

  useEffect(() => {
    setSheetOpen(false);
  }, [pathname]);
  useEscapeKey(sheetOpen, () => setSheetOpen(false));

  const isActive = (item: NavItem) =>
    item.href !== undefined && pathname !== null && item.href.split("#")[0] === pathname;

  const railItem = (item: NavItem) => {
    const active = isActive(item);
    const base = cx(
      "flex items-center gap-3 rounded-(--fbg-radius-control) px-3 py-2.5 text-sm",
      collapsed && "justify-center px-0",
      active ? "bg-white/12 text-white" : "text-white/72",
      item.href ? "hover:bg-white/8 hover:text-white" : "cursor-default opacity-60",
    );
    const inner = (
      <>
        <Icon name={item.icon} size={18} className="shrink-0" />
        {!collapsed ? <span className="flex-1 truncate">{item.label}</span> : null}
        {!collapsed && item.badge ? (
          <span className="fbg-num rounded-full bg-(--fbg-action-primary) px-1.5 text-[11px] font-semibold text-(--fbg-action-on-primary)">
            {item.badge}
          </span>
        ) : null}
        {!collapsed && !item.href ? (
          <span className="text-[11px] text-white/50">{t.planned}</span>
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
      <div className="flex min-h-[calc(100dvh-33px)]">
        {/* Left rail (tablet and up) */}
        <aside
          className={cx(
            "hidden shrink-0 flex-col bg-(--fbg-rail-bg) text-(--fbg-rail-fg) md:flex",
            collapsed ? "w-16" : "w-(--fbg-rail-w)",
          )}
        >
          <div
            className={cx(
              "flex h-16 items-center border-b border-white/10",
              collapsed ? "justify-center" : "px-4",
            )}
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-(--fbg-radius-chip) bg-(--fbg-action-primary) text-(--fbg-action-on-primary)">
              <BrandMark size={22} />
            </span>
            {!collapsed ? (
              <span className="ml-3 min-w-0">
                <span className="block truncate text-sm font-semibold leading-4">
                  Factory Bridge Global
                </span>
                <span className="block truncate text-[11px] leading-4 text-white/60">
                  {meta.name}
                </span>
              </span>
            ) : null}
          </div>
          <nav
            aria-label={t.primaryNav}
            className="fbg-no-scrollbar flex-1 space-y-0.5 overflow-y-auto p-2"
          >
            {nav.map(railItem)}
          </nav>
          <div className="space-y-0.5 border-t border-white/10 p-2">
            {navBottom.map(railItem)}
            {!collapsed ? (
              <div className="px-3 pt-2 pb-1">
                <p className="mb-1.5 text-[11px] text-white/50">{t.appearance}</p>
                <AppearanceSwitch locale={locale} />
              </div>
            ) : null}
            <button
              type="button"
              onClick={() => setCollapsed((v) => !v)}
              className="flex w-full items-center justify-center gap-2 rounded-(--fbg-radius-control) px-3 py-2 text-xs text-white/70 hover:bg-white/8 hover:text-white"
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
          <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-(--fbg-border-subtle) bg-(--fbg-bg-canvas)/92 px-3 backdrop-blur sm:px-5">
            <button
              type="button"
              className="rounded-(--fbg-radius-control) p-2.5 text-(--fbg-text-primary) hover:bg-(--fbg-hover) md:hidden"
              onClick={() => setSheetOpen(true)}
              aria-label={t.openNav}
            >
              <Icon name="menu" size={20} />
            </button>
            <div className="min-w-0 flex-1">
              <p className="hidden text-xs text-(--fbg-text-secondary) sm:block">{meta.name}</p>
              <h1 className="truncate text-base font-semibold text-(--fbg-text-primary)">
                {title}
              </h1>
            </div>
            <div className="flex items-center gap-1 sm:gap-2">
              <button
                type="button"
                className="hidden h-10 items-center gap-2 rounded-(--fbg-radius-control) border border-(--fbg-border-subtle) bg-(--fbg-bg-surface) px-3 text-sm text-(--fbg-text-primary) hover:border-(--fbg-border-strong) lg:inline-flex"
                aria-haspopup="listbox"
                title={t.orgSwitcher}
              >
                <Icon name="building" size={14} className="text-(--fbg-text-secondary)" />
                <span className="max-w-44 truncate">{meta.org}</span>
                <Icon name="chevron-down" size={14} className="text-(--fbg-text-secondary)" />
              </button>
              <LocaleToggle initial={locale} />
              <button
                type="button"
                className="relative rounded-(--fbg-radius-control) p-2.5 text-(--fbg-text-primary) hover:bg-(--fbg-hover)"
                aria-label={t.notifications}
              >
                <Icon name="bell" size={18} />
                <span className="fbg-num absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-(--fbg-brand-accent) px-1 text-[10px] font-semibold text-(--fbg-text-inverse)">
                  3
                </span>
              </button>
              <span
                className="hidden h-9 w-9 items-center justify-center rounded-full bg-(--fbg-action-primary) text-xs font-semibold text-(--fbg-action-on-primary) sm:flex"
                aria-label={t.signedIn}
              >
                {meta.avatar}
              </span>
            </div>
          </header>

          <div className="flex min-w-0 flex-1">
            <main className="min-w-0 flex-1 px-4 pt-6 pb-28 sm:px-6 md:pb-10 lg:px-8 xl:px-10">
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

      {/* Phone bottom tab bar: four destinations */}
      <nav
        aria-label={t.mobileNav}
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-(--fbg-border-subtle) bg-(--fbg-bg-surface) pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        {mobileTabs.map((item) => {
          const active = isActive(item);
          const cls = cx(
            "flex min-h-14 min-w-0 flex-col items-center justify-center gap-0.5 py-2 text-[11px]",
            active ? "text-(--fbg-action-primary)" : "text-(--fbg-text-secondary)",
            !item.href && "opacity-50",
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
              {[...nav, ...navBottom].map((item) => (
                <li key={item.label}>
                  {item.href ? (
                    <Link
                      href={item.href}
                      className={cx(
                        "flex min-h-11 items-center gap-3 rounded-(--fbg-radius-control) px-3 py-2.5 text-[15px]",
                        isActive(item)
                          ? "bg-(--fbg-selected) font-medium text-(--fbg-text-primary)"
                          : "text-(--fbg-text-primary) hover:bg-(--fbg-hover)",
                      )}
                    >
                      <Icon name={item.icon} size={18} className="text-(--fbg-text-secondary)" />
                      <span className="flex-1">{item.label}</span>
                      {item.badge ? (
                        <span className="fbg-num rounded-full bg-(--fbg-action-primary) px-1.5 text-[11px] font-semibold text-(--fbg-action-on-primary)">
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
            </ul>
            <div className="mt-3 border-t border-(--fbg-border-subtle) px-1 pt-3">
              <p className="mb-1.5 text-xs text-(--fbg-text-secondary)">{t.appearance}</p>
              <AppearanceSwitch size="md" locale={locale} />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function LocaleToggle({ initial }: { initial: ShellLocale }) {
  const [locale, setLocale] = useState<ShellLocale>(initial);
  return (
    <div
      role="radiogroup"
      aria-label="Interface language"
      className="inline-flex rounded-(--fbg-radius-control) border border-(--fbg-border-subtle) bg-(--fbg-bg-surface) p-0.5"
    >
      {(
        [
          { value: "en-US", label: "EN" },
          { value: "zh-CN", label: "中文" },
        ] as const
      ).map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={locale === o.value}
          onClick={() => setLocale(o.value)}
          lang={o.value}
          className={cx(
            "h-8 rounded-[7px] px-2.5 text-xs font-medium",
            locale === o.value
              ? "bg-(--fbg-bg-inverse) text-(--fbg-text-inverse)"
              : "text-(--fbg-text-secondary) hover:text-(--fbg-text-primary)",
          )}
          title="Locale switch is visual only in this prototype; buyer screens are English."
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
