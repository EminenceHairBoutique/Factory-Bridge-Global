"use client";

/**
 * Marketing home preview — Obsidian hero and closing band over Atlas sections (PAGE_BY_PAGE_BLUEPRINT §1),
 * refined in UX-04: seven anchored destinations (Home · How it works · Services · Categories · Quality process
 * · About · Contact), one orchestrated hero entrance, no dead links, no counters, no testimonials, no claims
 * beyond the approved list. Copy remains a proposal subject to legal and business approval. Local state only;
 * CTAs link to the prototypes.
 */
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { MARKETING_NAV } from "../marketing-nav";
import { ThemeScope } from "../theme";
import { AppearanceSwitch, BrandMark, DemoStripe } from "../ui/AppShell";
import { Icon, type IconName } from "../ui/icons";
import { Badge, buttonClasses, cx } from "../ui/primitives";

const SERVICES: Array<{ icon: IconName; title: string; body: string }> = [
  {
    icon: "building",
    title: "Supplier access",
    body: "Options come from authorized catalogs and direct factory contact, with a record of who was checked and when.",
  },
  {
    icon: "compare",
    title: "Clearer comparisons",
    body: "Same specification, same trade term, the tier for your quantity. Every converted price shows its rate.",
  },
  {
    icon: "message",
    title: "Bilingual clarification",
    body: "Questions to factories are drafted in Chinese and English and sent only after you approve them.",
  },
  {
    icon: "shield",
    title: "Documented checks",
    body: "Identity reviews, sample approvals and inspections are records with evidence, not a generic badge.",
  },
];

const STEPS: Array<{ title: string; body: string; who: string }> = [
  {
    title: "Brief",
    body: "Describe the product, quantity and destination in your own words.",
    who: "You",
  },
  {
    title: "Research and authorized options",
    body: "Operators identify suppliers and request quotes with your approval.",
    who: "Operator, with your approval",
  },
  {
    title: "Quote comparison",
    body: "Like-for-like comparison with missing inputs shown, never hidden.",
    who: "Deterministic engine, reviewed by people",
  },
  {
    title: "Documented checks",
    body: "Identity, samples and inspections recorded with evidence and scope.",
    who: "Operator and inspectors",
  },
  {
    title: "Handoff",
    body: "You approve the supplier and the order; nothing is placed without you.",
    who: "You",
  },
];

const CATEGORIES: Array<{ title: string; zh: string; example: string }> = [
  {
    title: "Custom roll labels",
    zh: "卷筒不干胶标签",
    example: "BOPP, 4-color, matte lamination, permanent adhesive",
  },
  {
    title: "Folding cartons",
    zh: "折叠纸盒",
    example: "350 gsm C1S, tuck-end, soft-touch lamination",
  },
  {
    title: "Human-hair bundles",
    zh: "人发发束",
    example: "Raw, 18–22 in, natural black, double weft",
  },
];

const CHECKS: Array<[string, string]> = [
  [
    "Identity reviewed (date)",
    "Business licence and representative confirmed. Not a product test.",
  ],
  ["Sample approved for variant", "A golden sample approved by you for one specification."],
  ["Passed inspection per checklist vN", "A sampled check of one batch against a named checklist."],
  ["Contacted", "Only that: a reply was received. It is not a verification."],
];

const NOT_THIS: string[] = [
  "Not a marketplace: there is no catalog of listings to browse and no checkout.",
  "Not an autonomous buyer: no order, payment or factory message happens without your written approval.",
  "No scraped data: supplier information comes from authorized catalogs and direct contact, with rights recorded.",
];

function BridgeFigure() {
  // Thin-line bridge: two piers, a single arc drawn once on load, cable verticals, the two ends named.
  return (
    <svg
      viewBox="0 0 640 300"
      className="h-auto w-full max-w-xl"
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth={1.25}
    >
      <path d="M20 230h600" strokeOpacity={0.4} />
      <path d="M120 230V128M520 230V128" className="fbg-rise fbg-rise-2" />
      <path
        d="M60 200c90-130 430-130 520 0"
        pathLength={1}
        className="fbg-draw"
        strokeWidth={1.6}
      />
      {Array.from({ length: 11 }).map((_, i) => {
        const x = 120 + i * 40;
        const t = (x - 320) / 260;
        const y = 200 - 65 * (1 - t * t);
        return (
          <path key={x} d={`M${x} ${y}V230`} strokeOpacity={0.4} className="fbg-rise fbg-rise-3" />
        );
      })}
      <circle cx="320" cy="135" r="3" fill="currentColor" stroke="none" />
      <path d="M20 256h600" strokeOpacity={0.12} />
      <text
        x="120"
        y="284"
        textAnchor="middle"
        fontSize="12"
        fill="currentColor"
        fillOpacity={0.75}
        stroke="none"
        className="fbg-rise fbg-rise-3"
      >
        U.S. buyer
      </text>
      <text
        x="520"
        y="284"
        textAnchor="middle"
        fontSize="12"
        fill="currentColor"
        fillOpacity={0.75}
        stroke="none"
        className="fbg-rise fbg-rise-3"
      >
        Factory
      </text>
    </svg>
  );
}

function MarketingTitle({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="max-w-2xl">
      <h2 className="fbg-display text-[28px] leading-[1.15] md:text-[34px]">{children}</h2>
      {sub ? <p className="mt-3 text-[17px] text-(--fbg-text-secondary)">{sub}</p> : null}
    </div>
  );
}

export function MarketingHome() {
  return (
    <ThemeScope>
      <MarketingBody />
    </ThemeScope>
  );
}

function MarketingBody() {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div id="top" className="min-h-dvh bg-(--fbg-bg-canvas) text-(--fbg-text-primary)">
      <DemoStripe />

      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-(--fbg-border-subtle) bg-(--fbg-bg-canvas)/92 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1280px] items-center gap-3 px-4 sm:px-8">
          <a href="#top" className="flex items-center gap-2 font-semibold">
            <span className="flex h-8 w-8 items-center justify-center rounded-(--fbg-radius-chip) bg-(--fbg-action-primary) text-(--fbg-action-on-primary)">
              <BrandMark size={22} />
            </span>
            <span className="hidden sm:inline">Factory Bridge Global</span>
          </a>
          <nav
            aria-label="Site"
            className="ml-6 hidden items-center gap-6 text-sm text-(--fbg-text-secondary) lg:flex"
          >
            {MARKETING_NAV.filter((n) => n.href !== "#top").map((n) => (
              <a key={n.href} href={n.href} className="hover:text-(--fbg-text-primary)">
                {n.label}
              </a>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <Link
              href="/design-preview/auth"
              className={cx(buttonClasses("ghost", "sm"), "hidden sm:inline-flex")}
            >
              Sign in
            </Link>
            <Link
              href="/design-preview/buyer/new-request"
              className={buttonClasses("primary", "sm")}
            >
              Start a request
            </Link>
            <button
              type="button"
              className="rounded-(--fbg-radius-control) p-2.5 hover:bg-(--fbg-hover) lg:hidden"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              aria-controls="site-menu"
              onClick={() => setMenuOpen((v) => !v)}
            >
              <Icon name={menuOpen ? "x" : "menu"} size={20} />
            </button>
          </div>
        </div>
        {menuOpen ? (
          <nav
            id="site-menu"
            aria-label="Site (mobile)"
            className="border-t border-(--fbg-border-subtle) bg-(--fbg-bg-surface) px-5 py-3 lg:hidden"
          >
            <ul className="flex flex-col">
              {MARKETING_NAV.map((n) => (
                <li key={n.href}>
                  <a
                    href={n.href}
                    onClick={() => setMenuOpen(false)}
                    className="block min-h-11 py-2.5 text-[15px] text-(--fbg-text-primary)"
                  >
                    {n.label}
                  </a>
                </li>
              ))}
              <li className="sm:hidden">
                <Link
                  href="/design-preview/auth"
                  className="block min-h-11 py-2.5 text-[15px] text-(--fbg-text-primary)"
                >
                  Sign in
                </Link>
              </li>
              <li className="mt-2 flex items-center justify-between gap-3 border-t border-(--fbg-border-subtle) pt-3 text-[13px] text-(--fbg-text-secondary)">
                Appearance
                <AppearanceSwitch size="md" />
              </li>
            </ul>
          </nav>
        ) : null}
      </header>

      {/* Obsidian hero: always dark, independent of the workspace appearance */}
      <section className="fbg-obsidian fbg-hero-obsidian text-(--fbg-text-primary)">
        <div className="mx-auto grid max-w-[1280px] gap-12 px-5 py-16 sm:px-8 md:py-24 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:py-28">
          <div className="min-w-0">
            <p className="fbg-rise mb-5 flex flex-wrap items-center gap-2 text-sm text-(--fbg-text-secondary)">
              <Badge tone="brand" icon={null}>
                Pilot program
              </Badge>
              U.S. business buyers · Chinese manufacturers
            </p>
            <h1 className="fbg-display fbg-rise fbg-rise-2 text-[40px] leading-[1.04] sm:text-[48px] md:text-[60px]">
              Global sourcing.
              <br />
              Without the guesswork.
            </h1>
            <p className="fbg-rise fbg-rise-3 mt-6 max-w-xl text-lg text-(--fbg-text-secondary)">
              Better supplier access. Clearer comparisons. More confident decisions.
            </p>
            <div className="fbg-rise fbg-rise-3 mt-8 flex flex-wrap gap-3">
              <Link
                href="/design-preview/buyer/new-request"
                className={buttonClasses("primary", "lg")}
              >
                Start a sourcing request
              </Link>
              <a
                href="#how"
                className={cx(
                  buttonClasses("secondary", "lg"),
                  "border-(--fbg-border-subtle) bg-transparent",
                )}
              >
                How it works
              </a>
            </div>
            <p className="fbg-rise fbg-rise-3 mt-6 text-[13px] text-(--fbg-text-muted)">
              No order is placed, no factory is contacted and no payment is made without your
              written approval.
            </p>
          </div>
          <div className="text-(--fbg-action-primary)">
            <BridgeFigure />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="scroll-mt-16">
        <div className="mx-auto max-w-[1280px] px-5 py-16 sm:px-8 md:py-24">
          <MarketingTitle sub="A sequence with a person at every decision. Steps marked with an operator are not automated.">
            How it works
          </MarketingTitle>
          <ol className="mt-10 grid gap-8 md:grid-cols-5 md:gap-6">
            {STEPS.map((s, i) => (
              <li key={s.title} className="flex gap-4 md:flex-col md:gap-4">
                <span className="fbg-num flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-(--fbg-bg-inverse) text-sm font-semibold text-(--fbg-text-inverse)">
                  {i + 1}
                </span>
                <div>
                  <h3 className="text-[17px] font-semibold">{s.title}</h3>
                  <p className="mt-1.5 text-[15px] text-(--fbg-text-secondary)">{s.body}</p>
                  <p className="mt-2 text-[13px] text-(--fbg-text-muted)">{s.who}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Services */}
      <section
        id="services"
        className="scroll-mt-16 border-y border-(--fbg-border-subtle) bg-(--fbg-bg-surface)"
      >
        <div className="mx-auto max-w-[1280px] px-5 py-16 sm:px-8 md:py-24">
          <MarketingTitle sub="Four accountable services. Each one is a mechanism in the workspace, not a promise on a page.">
            Services
          </MarketingTitle>
          <ul className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-0 lg:divide-x lg:divide-(--fbg-border-subtle)">
            {SERVICES.map((p) => (
              <li key={p.title} className="lg:px-6 lg:first:pl-0 lg:last:pr-0">
                <span className="flex h-10 w-10 items-center justify-center rounded-(--fbg-radius-control) bg-(--fbg-accent-subtle) text-(--fbg-action-primary)">
                  <Icon name={p.icon} size={18} />
                </span>
                <h3 className="mt-4 text-[17px] font-semibold">{p.title}</h3>
                <p className="mt-1.5 text-[15px] text-(--fbg-text-secondary)">{p.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Pilot categories */}
      <section id="categories" className="scroll-mt-16">
        <div className="mx-auto max-w-[1280px] px-5 py-16 sm:px-8 md:py-24">
          <MarketingTitle sub="Three product families in the pilot. Other categories go through a review before any quote is requested.">
            Categories
          </MarketingTitle>
          <ul className="mt-10 grid gap-4 md:grid-cols-3">
            {CATEGORIES.map((c) => (
              <li
                key={c.title}
                className="rounded-(--fbg-radius-card) border border-(--fbg-border-subtle) bg-(--fbg-bg-surface) p-6"
              >
                <h3 className="text-[17px] font-semibold">{c.title}</h3>
                <p className="fbg-zh mt-0.5 text-[15px] text-(--fbg-text-secondary)" lang="zh-CN">
                  {c.zh}
                </p>
                <p className="mt-4 text-[13px] text-(--fbg-text-secondary)">Example requirement</p>
                <p className="mt-0.5 text-[15px]">{c.example}</p>
              </li>
            ))}
          </ul>
          <p className="mt-5 text-[15px] text-(--fbg-text-secondary)">
            Medical devices, sterile vials, ingestibles, finished cosmetics and export-sensitive
            machinery are not available for self-service quoting.
          </p>
        </div>
      </section>

      {/* Quality process */}
      <section
        id="quality"
        className="scroll-mt-16 border-y border-(--fbg-border-subtle) bg-(--fbg-bg-surface)"
      >
        <div className="mx-auto grid max-w-[1280px] gap-10 px-5 py-16 sm:px-8 md:grid-cols-[1fr_1.2fr] md:py-24">
          <MarketingTitle sub="A badge is generated from a check record. Open it and you see what was checked, by whom, on which date, and what it does not cover.">
            Quality process
          </MarketingTitle>
          <ul className="flex flex-col divide-y divide-(--fbg-border-subtle) text-[15px]">
            {CHECKS.map(([k, v]) => (
              <li key={k} className="flex gap-3 py-4 first:pt-0 last:pb-0">
                <Icon
                  name="shield"
                  size={18}
                  className="mt-0.5 shrink-0 text-(--fbg-status-success)"
                />
                <span>
                  <span className="block font-medium">{k}</span>
                  <span className="text-(--fbg-text-secondary)">{v}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* About */}
      <section id="about" className="scroll-mt-16">
        <div className="mx-auto grid max-w-[1280px] gap-10 px-5 py-16 sm:px-8 md:grid-cols-[1fr_1.2fr] md:py-24">
          <MarketingTitle sub="A sourcing and procurement service for U.S. business buyers working with Chinese manufacturers: people research, clarify and verify; software keeps the record.">
            About
          </MarketingTitle>
          <div className="text-[15px]">
            <p className="text-[13px] font-medium text-(--fbg-text-secondary)">What this is not</p>
            <ul className="mt-2 flex flex-col gap-3">
              {NOT_THIS.map((line) => (
                <li key={line} className="flex gap-3">
                  <Icon name="x" size={16} className="mt-1 shrink-0 text-(--fbg-text-muted)" />
                  <span className="text-(--fbg-text-primary)">{line}</span>
                </li>
              ))}
            </ul>
            <p className="mt-6 text-[13px] text-(--fbg-text-muted)">
              Entity and location details are published after the pilot's legal review.
            </p>
          </div>
        </div>
      </section>

      {/* Contact: closing band */}
      <section
        id="contact"
        className="fbg-obsidian fbg-hero-obsidian scroll-mt-16 text-(--fbg-text-primary)"
      >
        <div className="mx-auto flex max-w-[1280px] flex-col items-start gap-8 px-5 py-16 sm:px-8 md:flex-row md:items-center md:justify-between md:py-24">
          <div className="max-w-xl">
            <h2 className="fbg-display text-[28px] md:text-[36px]">
              Your sourcing, all in one place.
            </h2>
            <p className="mt-3 text-[17px] text-(--fbg-text-secondary)">
              Pilot pricing by conversation. Start a sourcing request and tell us how you prefer to
              be reached; we walk through your first brief together.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/design-preview/buyer/new-request"
              className={buttonClasses("primary", "lg")}
            >
              Start a sourcing request
            </Link>
            <Link
              href="/design-preview/auth"
              className={cx(
                buttonClasses("secondary", "lg"),
                "border-(--fbg-border-subtle) bg-transparent",
              )}
            >
              Sign in
            </Link>
          </div>
        </div>
      </section>

      <footer className="mx-auto max-w-[1280px] px-5 py-10 text-[13px] text-(--fbg-text-muted) sm:px-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div className="flex items-center gap-2 text-(--fbg-text-primary)">
            <BrandMark size={20} className="text-(--fbg-action-primary)" />
            <span className="font-semibold">Factory Bridge Global</span>
            <span className="text-(--fbg-text-muted)">· pilot program</span>
          </div>
          <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-2">
            {MARKETING_NAV.map((n) => (
              <a key={n.href} href={n.href} className="hover:text-(--fbg-text-primary)">
                {n.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <span>Appearance</span>
            <AppearanceSwitch />
          </div>
        </div>
        <p className="mt-6">
          Copy on this page is a proposal subject to legal and business approval. Terms, Privacy,
          FAQ and 供应商申请 (supplier application) are specified and not yet built.
        </p>
      </footer>
    </div>
  );
}
