"use client";

/**
 * AppShell (IA §3): collapsible left rail, top bar with org switcher + locale + notifications, content.
 * On phones the rail becomes a bottom tab bar; secondary destinations live behind a "More" sheet.
 *
 * Prototype only: links point at other design-preview screens; destinations that do not exist yet are
 * rendered as disabled entries so the navigation model is visible without pretending they work.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Icon, type IconName } from "./icons";
import { cx } from "./primitives";

export type Workspace = "buyer" | "ops";

interface NavItem {
  label: string;
  /** Shorter label for the phone tab bar. */
  short?: string;
  icon: IconName;
  href?: string;
  badge?: number;
  mobile?: boolean;
}

const BUYER_NAV: NavItem[] = [
  { label: "Overview", icon: "home", href: "/design-preview/buyer/dashboard", mobile: true },
  {
    label: "Projects",
    icon: "folder",
    href: "/design-preview/buyer/dashboard#projects",
    mobile: true,
  },
  {
    label: "New request",
    short: "New",
    icon: "plus",
    href: "/design-preview/buyer/new-request",
    mobile: true,
  },
  {
    label: "Compare quotes",
    short: "Compare",
    icon: "compare",
    href: "/design-preview/buyer/compare",
    mobile: true,
  },
  { label: "Documents", icon: "document" },
  { label: "Suppliers", icon: "building" },
  { label: "Messages", icon: "message", badge: 1 },
  { label: "Reports", icon: "download" },
  { label: "Settings", icon: "settings" },
];

const OPS_NAV: NavItem[] = [
  { label: "Pipeline", icon: "list", mobile: true },
  {
    label: "Quotes awaiting review",
    short: "Review",
    icon: "eye",
    href: "/design-preview/ops/quote-review",
    badge: 4,
    mobile: true,
  },
  { label: "Supplier CRM", short: "Suppliers", icon: "building", mobile: true },
  { label: "Research inbox", icon: "search" },
  { label: "Outreach approvals", short: "Outreach", icon: "message", badge: 2, mobile: true },
  { label: "Compliance holds", icon: "flag" },
  { label: "Audit explorer", icon: "lock" },
];

const WORKSPACE_META: Record<Workspace, { name: string; org: string; tone: string }> = {
  buyer: { name: "Buyer workspace", org: "Demo Buyer Co.", tone: "bg-ink" },
  ops: {
    name: "Sourcing operations",
    org: "Factory Bridge Global · internal",
    tone: "bg-[#13263d]",
  },
};

export function DemoStripe() {
  return (
    <div
      role="status"
      className="fbg-demo-stripe border-b border-warn/40 px-4 py-1.5 text-center text-[12px] font-semibold tracking-wide text-ink"
    >
      DEMO DATA — NOT REAL SUPPLIER QUOTATIONS. Synthetic records for design review only.
    </div>
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
  /** Optional "Evidence drawer" content (IA §3). Shown as a column on xl screens, a sheet below. */
  rightRail?: ReactNode;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [railOpen, setRailOpen] = useState(false);
  const nav = workspace === "buyer" ? BUYER_NAV : OPS_NAV;
  const meta = WORKSPACE_META[workspace];

  useEffect(() => {
    setMoreOpen(false);
    setRailOpen(false);
  }, [pathname]);

  const isActive = (item: NavItem) =>
    item.href !== undefined && pathname !== null && item.href.split("#")[0] === pathname;

  const railItem = (item: NavItem) => {
    const active = isActive(item);
    const base = cx(
      "flex items-center gap-3 rounded-md px-3 py-2 text-[13.5px]",
      collapsed && "justify-center px-0",
      active ? "bg-white/12 text-white" : "text-white/70",
      item.href ? "hover:bg-white/8 hover:text-white" : "cursor-default opacity-60",
    );
    const inner = (
      <>
        <Icon name={item.icon} size={18} className="shrink-0" />
        {!collapsed ? <span className="flex-1 truncate">{item.label}</span> : null}
        {!collapsed && item.badge ? (
          <span className="fbg-num rounded-full bg-accent px-1.5 text-[11px] font-semibold text-white">
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
    <div className="fbg-dp min-h-dvh bg-paper text-ink">
      <DemoStripe />
      <div className="flex min-h-[calc(100dvh-33px)]">
        {/* Left rail (tablet and up) */}
        <aside
          className={cx(
            "hidden shrink-0 flex-col text-white md:flex",
            meta.tone,
            collapsed ? "w-16" : "w-60",
          )}
        >
          <div
            className={cx(
              "flex h-14 items-center border-b border-white/10",
              collapsed ? "justify-center" : "px-4",
            )}
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-accent text-[13px] font-bold">
              FB
            </span>
            {!collapsed ? (
              <span className="ml-3 min-w-0">
                <span className="block truncate text-[13px] font-semibold leading-4">
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
            className="flex-1 space-y-0.5 overflow-y-auto fbg-no-scrollbar p-2"
          >
            {nav.map(railItem)}
          </nav>
          <div className="border-t border-white/10 p-2">
            <button
              type="button"
              onClick={() => setCollapsed((v) => !v)}
              className="flex w-full items-center justify-center gap-2 rounded-md px-3 py-2 text-[12px] text-white/70 hover:bg-white/8 hover:text-white"
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
          <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-line bg-paper/95 px-3 backdrop-blur sm:px-5">
            <button
              type="button"
              className="rounded-md p-2 text-ink hover:bg-ink/5 md:hidden"
              onClick={() => setRailOpen(true)}
              aria-label="Open navigation"
            >
              <Icon name="menu" size={20} />
            </button>
            <div className="min-w-0 flex-1">
              <p className="hidden text-[12px] text-slate sm:block">{meta.name}</p>
              <h1 className="truncate text-[15px] font-semibold text-ink sm:text-base">{title}</h1>
            </div>
            <div className="flex items-center gap-1 sm:gap-2">
              <button
                type="button"
                className="hidden h-9 items-center gap-2 rounded-md border border-line bg-surface px-3 text-[13px] text-ink hover:border-ink/30 sm:inline-flex"
                aria-haspopup="listbox"
                title="Organization switcher (prototype)"
              >
                <Icon name="building" size={14} className="text-slate" />
                <span className="max-w-40 truncate">{meta.org}</span>
                <Icon name="chevron-down" size={14} className="text-slate" />
              </button>
              <LocaleToggle />
              <button
                type="button"
                className="relative rounded-md p-2 text-ink hover:bg-ink/5"
                aria-label="Notifications, 3 unread"
              >
                <Icon name="bell" size={18} />
                <span className="fbg-num absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-white">
                  3
                </span>
              </button>
              <span
                className="hidden h-8 w-8 items-center justify-center rounded-full bg-teal text-[12px] font-semibold text-white sm:flex"
                aria-label="Signed in as Demo Buyer"
              >
                DB
              </span>
            </div>
          </header>

          <div className="flex min-w-0 flex-1">
            <main className="min-w-0 flex-1 px-4 pt-5 pb-24 sm:px-6 md:pb-8 lg:px-8">
              {children}
            </main>
            {rightRail ? (
              <aside className="hidden w-80 shrink-0 border-l border-line bg-surface p-4 xl:block">
                {rightRail}
              </aside>
            ) : null}
          </div>
        </div>
      </div>

      {/* Mobile bottom tab bar */}
      <nav
        aria-label="Primary (mobile)"
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        {nav
          .filter((i) => i.mobile)
          .slice(0, 4)
          .map((item) => {
            const active = isActive(item);
            const cls = cx(
              "flex min-w-0 flex-col items-center gap-0.5 py-2 text-[11px]",
              active ? "text-accent" : "text-slate",
              !item.href && "opacity-50",
            );
            return item.href ? (
              <Link
                key={item.label}
                href={item.href}
                className={cls}
                aria-current={active ? "page" : undefined}
              >
                <Icon name={item.icon} size={20} />
                <span className="max-w-full truncate px-0.5">{item.short ?? item.label}</span>
              </Link>
            ) : (
              <span key={item.label} className={cls} aria-disabled>
                <Icon name={item.icon} size={20} />
                <span className="max-w-full truncate px-0.5">{item.short ?? item.label}</span>
              </span>
            );
          })}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          className="flex flex-col items-center gap-0.5 py-2 text-[11px] text-slate"
          aria-haspopup="dialog"
          aria-expanded={moreOpen}
        >
          <Icon name="menu" size={20} />
          More
        </button>
      </nav>

      {/* Mobile sheets */}
      {(moreOpen || railOpen) && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Navigation"
          className="fixed inset-0 z-50 md:hidden"
        >
          <button
            type="button"
            className="absolute inset-0 bg-ink/40"
            aria-label="Close navigation"
            onClick={() => {
              setMoreOpen(false);
              setRailOpen(false);
            }}
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[80dvh] overflow-y-auto rounded-t-xl bg-surface p-3 pb-[max(env(safe-area-inset-bottom),12px)]">
            <div className="mb-2 flex items-center justify-between px-1">
              <p className="text-[13px] font-semibold text-ink">{meta.name}</p>
              <button
                type="button"
                className="rounded-md p-2 text-slate hover:bg-ink/5"
                onClick={() => {
                  setMoreOpen(false);
                  setRailOpen(false);
                }}
                aria-label="Close"
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
                      className={cx(
                        "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm",
                        isActive(item)
                          ? "bg-ink/5 font-medium text-ink"
                          : "text-ink hover:bg-ink/5",
                      )}
                    >
                      <Icon name={item.icon} size={18} className="text-slate" />
                      <span className="flex-1">{item.label}</span>
                      {item.badge ? (
                        <span className="fbg-num rounded-full bg-accent px-1.5 text-[11px] font-semibold text-white">
                          {item.badge}
                        </span>
                      ) : null}
                    </Link>
                  ) : (
                    <span className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm text-slate/70">
                      <Icon name={item.icon} size={18} />
                      <span className="flex-1">{item.label}</span>
                      <span className="text-[11px]">Planned</span>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

function LocaleToggle() {
  const [locale, setLocale] = useState<"en-US" | "zh-CN">("en-US");
  return (
    <div
      role="radiogroup"
      aria-label="Interface language"
      className="inline-flex rounded-md border border-line bg-surface p-0.5"
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
            "h-7 rounded px-2 text-[12px] font-medium",
            locale === o.value ? "bg-ink text-white" : "text-slate hover:text-ink",
          )}
          title="Locale switch is visual only in this prototype; buyer screens are English."
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
