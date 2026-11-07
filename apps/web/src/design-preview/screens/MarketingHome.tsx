"use client";

/**
 * Marketing home preview — Obsidian hero over Atlas sections (docs/design/atlas-obsidian/PAGE_BY_PAGE_BLUEPRINT.md §1).
 * Copy is the proposed set from the design brief and remains subject to legal/business approval. No testimonials,
 * counters, logos or claims beyond the approved list. Local state only; CTAs link to the prototypes.
 */
import Link from "next/link";
import { useState } from "react";
import { ThemeScope } from "../theme";
import { AppearanceSwitch, BrandMark, DemoStripe } from "../ui/AppShell";
import { Icon, type IconName } from "../ui/icons";
import { Badge, SectionTitle, buttonClasses, cx } from "../ui/primitives";

const NAV = ["How it works", "Services", "Categories", "Quality process", "About"];

const PILLARS: Array<{ icon: IconName; title: string; body: string }> = [
  {
    icon: "building",
    title: "Better supplier access",
    body: "Options come from authorized catalogs and direct factory contact, with a record of who was checked and when.",
  },
  {
    icon: "compare",
    title: "Clearer comparisons",
    body: "Same specification, same trade term, tier selected for your quantity. Every converted price shows its rate.",
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

function BridgeFigure() {
  // Thin-line geometric bridge: two piers, a single arc, cable verticals. Pure SVG, no raster assets.
  return (
    <svg
      viewBox="0 0 640 260"
      className="h-auto w-full max-w-xl"
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth={1.25}
    >
      <path d="M20 210h600" strokeOpacity={0.5} />
      <path d="M120 210V120M520 210V120" />
      <path d="M60 180c90-130 430-130 520 0" strokeOpacity={0.9} />
      {Array.from({ length: 11 }).map((_, i) => {
        const x = 120 + i * 40;
        const t = (x - 320) / 260;
        const y = 180 - 65 * (1 - t * t);
        return <path key={x} d={`M${x} ${y}V210`} strokeOpacity={0.45} />;
      })}
      <circle cx="320" cy="115" r="3" fill="currentColor" stroke="none" />
      <path d="M20 236h600" strokeOpacity={0.15} />
    </svg>
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
    <div className="min-h-dvh bg-(--fbg-bg-canvas) text-(--fbg-text-primary)">
      <DemoStripe />

      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-(--fbg-border-subtle) bg-(--fbg-bg-canvas)/92 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1280px] items-center gap-3 px-4 sm:px-8">
          <Link href="/design-preview/marketing" className="flex items-center gap-2 font-semibold">
            <span className="flex h-8 w-8 items-center justify-center rounded-(--fbg-radius-chip) bg-(--fbg-action-primary) text-(--fbg-action-on-primary)">
              <BrandMark size={22} />
            </span>
            <span className="hidden sm:inline">Factory Bridge Global</span>
          </Link>
          <nav
            aria-label="Marketing"
            className="ml-6 hidden items-center gap-6 text-sm text-(--fbg-text-secondary) lg:flex"
          >
            {NAV.map((n) => (
              <a
                key={n}
                href="#"
                className="hover:text-(--fbg-text-primary)"
                title="Page specified, not prototyped"
              >
                {n}
              </a>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden md:inline-flex">
              <AppearanceSwitch />
            </span>
            <Link
              href="/design-preview/buyer/dashboard"
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
              aria-label="Open menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
            >
              <Icon name={menuOpen ? "x" : "menu"} size={20} />
            </button>
          </div>
        </div>
        {menuOpen ? (
          <nav
            aria-label="Marketing (mobile)"
            className="border-t border-(--fbg-border-subtle) bg-(--fbg-bg-surface) px-5 py-3 lg:hidden"
          >
            <ul className="flex flex-col">
              {NAV.map((n) => (
                <li key={n}>
                  <a
                    href="#"
                    className="block min-h-11 py-2.5 text-[15px] text-(--fbg-text-primary)"
                  >
                    {n}
                  </a>
                </li>
              ))}
              <li className="mt-2 border-t border-(--fbg-border-subtle) pt-3">
                <AppearanceSwitch size="md" />
              </li>
            </ul>
          </nav>
        ) : null}
      </header>

      {/* Obsidian hero: always dark, independent of the workspace appearance */}
      <section className="fbg-obsidian fbg-hero-obsidian text-(--fbg-text-primary)">
        <div className="mx-auto grid max-w-[1280px] gap-10 px-5 py-16 sm:px-8 md:py-24 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:py-28">
          <div className="min-w-0">
            <p className="mb-4 flex items-center gap-2 text-sm text-(--fbg-text-secondary)">
              <Badge tone="brand" icon={null}>
                Pilot program
              </Badge>
              U.S. buyers · Chinese manufacturers
            </p>
            <h1 className="fbg-display text-[38px] leading-[1.05] sm:text-[44px] md:text-[64px] lg:text-[72px]">
              Global sourcing.
              <br />
              Without the guesswork.
            </h1>
            <p className="mt-6 max-w-xl text-lg text-(--fbg-text-secondary)">
              Better supplier access. Clearer comparisons. More confident decisions.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
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
            <p className="mt-6 text-xs text-(--fbg-text-muted)">
              No order is placed, no factory is contacted and no payment is made without your
              written approval.
            </p>
          </div>
          <div className="text-(--fbg-action-primary)">
            <BridgeFigure />
          </div>
        </div>
      </section>

      {/* Value pillars (Atlas) */}
      <section className="mx-auto max-w-[1280px] px-5 py-16 sm:px-8 md:py-20">
        <SectionTitle sub="Four accountable pillars. Each one is a mechanism in the workspace, not a promise on a page.">
          What changes when sourcing has a record
        </SectionTitle>
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PILLARS.map((p) => (
            <li
              key={p.title}
              className="rounded-(--fbg-radius-card) border border-(--fbg-border-subtle) bg-(--fbg-bg-surface) p-5"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-(--fbg-radius-control) bg-(--fbg-accent-subtle) text-(--fbg-action-primary)">
                <Icon name={p.icon} size={18} />
              </span>
              <h3 className="mt-4 text-lg font-semibold">{p.title}</h3>
              <p className="mt-1.5 text-sm text-(--fbg-text-secondary)">{p.body}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* Process timeline */}
      <section id="how" className="border-y border-(--fbg-border-subtle) bg-(--fbg-bg-surface)">
        <div className="mx-auto max-w-[1280px] px-5 py-16 sm:px-8 md:py-20">
          <SectionTitle sub="A sequence with people at every decision. Steps marked with an operator are not automated.">
            How it works
          </SectionTitle>
          <ol className="mt-8 grid gap-6 md:grid-cols-5">
            {STEPS.map((s, i) => (
              <li key={s.title} className="relative flex gap-4 md:flex-col md:gap-3">
                <span className="fbg-num flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-(--fbg-bg-inverse) text-sm font-semibold text-(--fbg-text-inverse)">
                  {i + 1}
                </span>
                <div>
                  <h3 className="text-base font-semibold">{s.title}</h3>
                  <p className="mt-1 text-sm text-(--fbg-text-secondary)">{s.body}</p>
                  <p className="mt-2 text-xs text-(--fbg-text-muted)">{s.who}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Pilot categories */}
      <section className="mx-auto max-w-[1280px] px-5 py-16 sm:px-8 md:py-20">
        <SectionTitle sub="Three product families in the pilot. Other categories go through a review before any quote is requested.">
          Pilot categories
        </SectionTitle>
        <ul className="mt-8 grid gap-4 md:grid-cols-3">
          {CATEGORIES.map((c) => (
            <li
              key={c.title}
              className="rounded-(--fbg-radius-card) border border-(--fbg-border-subtle) bg-(--fbg-bg-surface) p-5"
            >
              <h3 className="text-lg font-semibold">{c.title}</h3>
              <p className="fbg-zh mt-0.5 text-sm text-(--fbg-text-secondary)" lang="zh-CN">
                {c.zh}
              </p>
              <p className="mt-3 text-sm text-(--fbg-text-secondary)">
                Example requirement: {c.example}
              </p>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-(--fbg-text-secondary)">
          Medical devices, sterile vials, ingestibles, finished cosmetics and export-sensitive
          machinery are not available for self-service quoting.
        </p>
      </section>

      {/* Evidence explanation */}
      <section className="border-t border-(--fbg-border-subtle) bg-(--fbg-bg-surface)">
        <div className="mx-auto grid max-w-[1280px] gap-8 px-5 py-16 sm:px-8 md:grid-cols-2 md:py-20">
          <SectionTitle sub="A badge is generated from a check record. Open it and you see what was checked, by whom, on which date, and what it does not cover.">
            Know what was checked
          </SectionTitle>
          <ul className="flex flex-col gap-3 text-sm">
            {[
              [
                "Identity reviewed (date)",
                "Business licence and representative confirmed. Not a product test.",
              ],
              [
                "Sample approved for variant",
                "A golden sample approved by you for one specification.",
              ],
              [
                "Passed inspection per checklist vN",
                "A sampled check of one batch against a named checklist.",
              ],
              ["Contacted", "Only that: a reply was received. It is not a verification."],
            ].map(([k, v]) => (
              <li
                key={k}
                className="flex gap-3 rounded-(--fbg-radius-card) border border-(--fbg-border-subtle) bg-(--fbg-bg-canvas) p-4"
              >
                <Icon
                  name="shield"
                  size={16}
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

      {/* Final CTA */}
      <section className="fbg-obsidian fbg-hero-obsidian text-(--fbg-text-primary)">
        <div className="mx-auto flex max-w-[1280px] flex-col items-start gap-6 px-5 py-16 sm:px-8 md:flex-row md:items-center md:justify-between md:py-20">
          <div>
            <h2 className="fbg-display text-[28px] md:text-[36px]">
              Your sourcing, all in one place.
            </h2>
            <p className="mt-2 max-w-lg text-(--fbg-text-secondary)">
              Pilot pricing by conversation. Request a call and we will walk through your first
              brief together.
            </p>
          </div>
          <Link href="/design-preview/buyer/new-request" className={buttonClasses("primary", "lg")}>
            Start a sourcing request
          </Link>
        </div>
      </section>

      <footer className="mx-auto flex max-w-[1280px] flex-col gap-2 px-5 py-8 text-xs text-(--fbg-text-muted) sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <span>
          Factory Bridge Global · pilot program · copy subject to legal and business approval
        </span>
        <span>Contact · FAQ · Terms · Privacy · 供应商申请</span>
      </footer>
    </div>
  );
}
