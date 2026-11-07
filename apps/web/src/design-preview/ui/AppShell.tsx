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

export type Workspace = "buyer" | "ops";

interface NavItem {
  label: string;
  /** Shorter label for the phone tab bar. */
  short?: string;
  icon: IconName;
  href?: string;
  badge?: number;
  /** One of the four phone tabs. */
  mobile?: boolean;
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
  { label: "Work queue", short: "Queue", icon: "list", mobile: true },
  { label: "Projects", icon: "folder", mobile: true },
  { label: "Research", icon: "search" },
  { label: "Suppliers", icon: "building" },
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

const WORKSPACE_META: Record<Workspace, { name: string; org: string }> = {
  buyer: { name: "Buyer workspace", org: "Demo Buyer Co." },
  ops: { name: "Sourcing operations", org: "Factory Bridge Global · internal" },
};

export function DemoStripe() {
  return (
    <div
      role="status"
      className="fbg-demo-stripe border-b border-(--fbg-status-warning)/40 px-4 py-1.5 text-center text-xs font-semibold tracking-wide text-(--fbg-text-primary)"
    >
      DEMO DATA — NOT REAL SUPPLIER QUOTATIONS. Synthetic records for design review only.
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

export function AppearanceSwitch({ size = "sm" }: { size?: "sm" | "md" }) {
  const { theme, setTheme } = useTheme();
  return (
    <SegmentedControl
      label="Appearance"
      size={size}
      options={THEME_OPTIONS}
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
  const nav = workspace === "buyer" ? BUYER_NAV : OPS_NAV;
  const navBottom = workspace === "buyer" ? BUYER_NAV_BOTTOM : OPS_NAV_BOTTOM;
  const meta = WORKSPACE_META[workspace];
  const mobileTabs = [...nav, ...navBottom].filter((i) => i.mobile).slice(0, 4);

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
          <span className="text-[11px] text-white/50">Planned</span>
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
        title={`${item.label} — not in this prototype`}
        aria-disabled
      >
        {inner}
      </span>
    );
  };

  return (
    <div className="min-h-dvh bg-(--fbg-bg-canvas) text-(--fbg-text-primary)">
      <DemoStripe />
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
            aria-label="Primary"
            className="fbg-no-scrollbar flex-1 space-y-0.5 overflow-y-auto p-2"
          >
            {nav.map(railItem)}
          </nav>
          <div className="space-y-0.5 border-t border-white/10 p-2">
            {navBottom.map(railItem)}
            {!collapsed ? (
              <div className="px-3 pt-2 pb-1">
                <p className="mb-1.5 text-[11px] text-white/50">Appearance</p>
                <AppearanceSwitch />
              </div>
            ) : null}
            <button
              type="button"
              onClick={() => setCollapsed((v) => !v)}
              className="flex w-full items-center justify-center gap-2 rounded-(--fbg-radius-control) px-3 py-2 text-xs text-white/70 hover:bg-white/8 hover:text-white"
              aria-pressed={collapsed}
              aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
            >
              <Icon name={collapsed ? "chevron-right" : "chevron-left"} size={16} />
              {!collapsed ? "Collapse" : null}
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
              aria-label="Open navigation"
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
                title="Organization switcher (prototype)"
              >
                <Icon name="building" size={14} className="text-(--fbg-text-secondary)" />
                <span className="max-w-44 truncate">{meta.org}</span>
                <Icon name="chevron-down" size={14} className="text-(--fbg-text-secondary)" />
              </button>
              <LocaleToggle />
              <button
                type="button"
                className="relative rounded-(--fbg-radius-control) p-2.5 text-(--fbg-text-primary) hover:bg-(--fbg-hover)"
                aria-label="Notifications, 3 unread"
              >
                <Icon name="bell" size={18} />
                <span className="fbg-num absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-(--fbg-brand-accent) px-1 text-[10px] font-semibold text-(--fbg-text-inverse)">
                  3
                </span>
              </button>
              <span
                className="hidden h-9 w-9 items-center justify-center rounded-full bg-(--fbg-action-primary) text-xs font-semibold text-(--fbg-action-on-primary) sm:flex"
                aria-label="Signed in as Demo Buyer"
              >
                DB
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
        aria-label="Primary (mobile)"
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
              title={`${item.label} — not in this prototype`}
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
          aria-label="Navigation"
          className="fixed inset-0 z-50 md:hidden"
        >
          <button
            type="button"
            className="absolute inset-0 bg-(--fbg-overlay)"
            aria-label="Close navigation"
            onClick={() => setSheetOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[82dvh] overflow-y-auto rounded-t-(--fbg-radius-dialog) bg-(--fbg-bg-surface) p-3 pb-[max(env(safe-area-inset-bottom),12px)]">
            <div className="mb-2 flex items-center justify-between px-1">
              <p className="text-sm font-semibold text-(--fbg-text-primary)">{meta.name}</p>
              <button
                type="button"
                className="rounded-(--fbg-radius-control) p-2.5 text-(--fbg-text-secondary) hover:bg-(--fbg-hover)"
                onClick={() => setSheetOpen(false)}
                aria-label="Close"
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
                      <span className="text-[11px]">Planned</span>
                    </span>
                  )}
                </li>
              ))}
            </ul>
            <div className="mt-3 border-t border-(--fbg-border-subtle) px-1 pt-3">
              <p className="mb-1.5 text-xs text-(--fbg-text-secondary)">Appearance</p>
              <AppearanceSwitch size="md" />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function LocaleToggle() {
  const [locale, setLocale] = useState<"en-US" | "zh-CN">("en-US");
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
