/**
 * Public home page (B-31): the approved Atlas × Obsidian marketing layout (PAGE_BY_PAGE_BLUEPRINT §1.1,
 * UX-04) as a production page. Server-rendered; the header, the appearance switch and the request form are the
 * only client islands. No synthetic data, no demo notice, no link into `/design-preview`, no sign-in until B-05.
 *
 * Section order: hero (Obsidian) → how it works → services → quote comparison → categories → quality →
 * about → FAQ → sourcing request (Obsidian) → footer.
 */
import type { ReactNode } from "react";
import type { InquiryMode } from "@/server/inquiry/config";
import {
  ABOUT,
  BENEFITS,
  CATEGORIES,
  COMPARE,
  CONTACT,
  FAQ,
  FOOTER,
  HERO,
  HOW,
  QUALITY,
  SERVICES,
  SITE_NAME,
} from "../content";
import {
  Badge,
  Icon,
  QuoteStatusTag,
  StatusChip,
  buttonClasses,
  cx,
  type IconName,
} from "../design-system";
import { FOOTER_NAV, SECTION_IDS, SITE_LINKS } from "../links";
import { AppearanceSwitch } from "./AppearanceSwitch";
import { InquirySection } from "./InquirySection";
import { BrandMark, BridgeFigure } from "./marks";
import { SiteHeader } from "./SiteHeader";
import { SkipLink } from "./SkipLink";

const WRAP = "mx-auto w-full max-w-[1200px] px-4 sm:px-8";

function SectionIntro({
  headingId,
  eyebrow,
  title,
  lead,
  className,
}: {
  headingId: string;
  eyebrow: string;
  title: string;
  lead?: string | undefined;
  className?: string | undefined;
}) {
  return (
    <div className={cx("max-w-2xl", className)}>
      <p className="text-[13px] font-semibold tracking-[0.08em] text-(--fbg-action-primary) uppercase">
        {eyebrow}
      </p>
      <h2
        id={headingId}
        className="fbg-display mt-3 text-[30px] leading-[1.1] text-(--fbg-text-primary) md:text-[40px]"
      >
        {title}
      </h2>
      {lead ? (
        <p className="mt-4 text-[17px] leading-relaxed text-(--fbg-text-secondary) md:text-[18px]">
          {lead}
        </p>
      ) : null}
    </div>
  );
}

function Band({ id, surface, children }: { id: string; surface?: boolean; children: ReactNode }) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-heading`}
      className={cx(surface && "border-y border-(--fbg-border-subtle) bg-(--fbg-bg-surface)")}
    >
      <div className={cx(WRAP, "py-16 md:py-24")}>{children}</div>
    </section>
  );
}

export function SiteHome({ inquiryMode }: { inquiryMode: InquiryMode }) {
  return (
    <div className="min-h-dvh bg-(--fbg-bg-canvas) text-(--fbg-text-primary)">
      <SkipLink />
      <SiteHeader />

      <main id={SECTION_IDS.main} className="outline-none">
        {/* Hero: always Obsidian */}
        <section
          id={SECTION_IDS.top}
          aria-labelledby="hero-heading"
          className="fbg-obsidian fbg-hero-obsidian text-(--fbg-text-primary)"
        >
          <div
            className={cx(
              WRAP,
              "grid gap-10 pt-12 pb-14 md:pt-20 md:pb-20 lg:grid-cols-[1.4fr_1fr] lg:items-center lg:gap-12 lg:pt-24",
            )}
          >
            <div className="min-w-0">
              <p className="fbg-rise flex flex-wrap items-center gap-x-3 gap-y-2 text-[14px] text-(--fbg-text-secondary)">
                <Badge tone="brand" icon={null}>
                  {HERO.badge}
                </Badge>
                <span>{HERO.audience}</span>
              </p>
              <h1
                id="hero-heading"
                className="fbg-display fbg-rise fbg-rise-2 mt-6 text-[40px] leading-[1.04] sm:text-[52px] lg:text-[48px] lg:whitespace-nowrap xl:text-[58px]"
              >
                {HERO.headline.map((line, i) => (
                  <span
                    key={line}
                    className={cx(
                      "block",
                      i === HERO.headline.length - 1 && "text-(--fbg-action-primary)",
                    )}
                  >
                    {line}
                  </span>
                ))}
              </h1>
              <p className="fbg-rise fbg-rise-3 mt-6 max-w-xl text-[17px] leading-relaxed text-(--fbg-text-secondary) md:text-[18px]">
                {HERO.lead}
              </p>
              <div className="fbg-rise fbg-rise-3 mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <a
                  href={SITE_LINKS.startRequest}
                  className={cx(buttonClasses("primary", "lg"), "w-full sm:w-auto")}
                >
                  {HERO.primaryCta}
                  <Icon name="chevron-right" size={18} />
                </a>
                <a
                  href={`#${SECTION_IDS.how}`}
                  className={cx(
                    buttonClasses("secondary", "lg"),
                    "w-full border-(--fbg-border-subtle) bg-transparent sm:w-auto",
                  )}
                >
                  {HERO.secondaryCta}
                </a>
              </div>
              <p className="fbg-rise fbg-rise-3 mt-6 max-w-xl text-[13px] leading-relaxed text-(--fbg-text-muted)">
                {HERO.role}
              </p>
            </div>
            <div className="hidden text-(--fbg-action-primary) sm:block">
              <BridgeFigure />
            </div>
          </div>

          <div className="border-t border-(--fbg-border-divider)">
            <ul className={cx(WRAP, "grid gap-x-8 gap-y-6 py-10 sm:grid-cols-2 lg:grid-cols-4")}>
              {BENEFITS.map((b) => (
                <li key={b.title} className="min-w-0">
                  <h3 className="flex items-center gap-2 text-[15px] font-semibold">
                    <Icon name="check" size={16} className="text-(--fbg-action-primary)" />
                    {b.title}
                  </h3>
                  <p className="mt-1.5 text-[14px] leading-relaxed text-(--fbg-text-secondary)">
                    {b.body}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* How it works */}
        <Band id={SECTION_IDS.how}>
          <SectionIntro
            headingId={`${SECTION_IDS.how}-heading`}
            eyebrow={HOW.eyebrow}
            title={HOW.title}
            lead={HOW.lead}
          />
          <ol className="relative mt-12 grid gap-8 lg:grid-cols-5 lg:gap-6">
            <span
              aria-hidden
              className="absolute top-[18px] right-[10%] left-[10%] hidden h-px bg-(--fbg-border-subtle) lg:block"
            />
            {HOW.steps.map((s, i) => (
              <li key={s.title} className="relative flex gap-4 lg:flex-col lg:gap-5">
                <span className="fbg-num relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-(--fbg-bg-inverse) text-sm font-semibold text-(--fbg-text-inverse) ring-4 ring-(--fbg-bg-canvas)">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <h3 className="text-[17px] font-semibold">{s.title}</h3>
                  <p className="mt-1.5 text-[15px] leading-relaxed text-(--fbg-text-secondary)">
                    {s.body}
                  </p>
                  <p className="mt-3 flex items-center gap-1.5 text-[13px] text-(--fbg-text-secondary)">
                    <Icon name="user" size={13} />
                    {s.who}
                  </p>
                </div>
              </li>
            ))}
          </ol>
          <div className="mt-14 grid overflow-hidden rounded-(--fbg-radius-card) border border-(--fbg-border-subtle) bg-(--fbg-bg-surface) md:grid-cols-3">
            {HOW.boundaries.map((b, i) => (
              <div
                key={b.title}
                className={cx(
                  "p-6",
                  i > 0 && "border-t border-(--fbg-border-divider) md:border-t-0 md:border-l",
                )}
              >
                <h3 className="text-[15px] font-semibold">{b.title}</h3>
                <p className="mt-1.5 text-[15px] leading-relaxed text-(--fbg-text-secondary)">
                  {b.body}
                </p>
              </div>
            ))}
          </div>
        </Band>

        {/* Services */}
        <Band id={SECTION_IDS.services} surface>
          <SectionIntro
            headingId={`${SECTION_IDS.services}-heading`}
            eyebrow={SERVICES.eyebrow}
            title={SERVICES.title}
            lead={SERVICES.lead}
          />
          <div className="mt-12 grid gap-10 lg:grid-cols-[1.5fr_1fr] lg:gap-12">
            <ul className="grid gap-8 sm:grid-cols-2">
              {SERVICES.items.map((s) => (
                <li key={s.title} className="min-w-0">
                  <span className="flex h-11 w-11 items-center justify-center rounded-(--fbg-radius-control) bg-(--fbg-accent-subtle) text-(--fbg-action-primary)">
                    <Icon name={s.icon as IconName} size={20} />
                  </span>
                  <h3 className="mt-4 text-[17px] font-semibold">{s.title}</h3>
                  <p className="mt-1.5 text-[15px] leading-relaxed text-(--fbg-text-secondary)">
                    {s.body}
                  </p>
                </li>
              ))}
            </ul>
            <div className="fbg-raised rounded-(--fbg-radius-card) border border-(--fbg-border-subtle) p-6 sm:p-7">
              <h3 className="text-[13px] font-semibold tracking-[0.08em] text-(--fbg-text-secondary) uppercase">
                {SERVICES.receiveTitle}
              </h3>
              <ul className="mt-4 flex flex-col divide-y divide-(--fbg-border-divider)">
                {SERVICES.receive.map((line) => (
                  <li key={line} className="flex gap-3 py-3.5 first:pt-0 last:pb-0">
                    <Icon
                      name="document"
                      size={18}
                      className="mt-0.5 shrink-0 text-(--fbg-action-primary)"
                    />
                    <span className="text-[15px] leading-relaxed">{line}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Band>

        {/* Quote comparison */}
        <Band id={SECTION_IDS.compare}>
          <SectionIntro
            headingId={`${SECTION_IDS.compare}-heading`}
            eyebrow={COMPARE.eyebrow}
            title={COMPARE.title}
            lead={COMPARE.lead}
          />
          <div className="mt-12 grid gap-5 lg:grid-cols-3">
            <div className="rounded-(--fbg-radius-card) border border-(--fbg-border-subtle) bg-(--fbg-bg-surface) p-6">
              <h3 className="text-[15px] font-semibold">{COMPARE.mustMatchTitle}</h3>
              <ul className="mt-4 flex flex-col gap-4">
                {COMPARE.mustMatch.map((m) => (
                  <li key={m.label} className="flex gap-3">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-(--fbg-accent-subtle) text-(--fbg-action-primary)">
                      <Icon name="check" size={12} />
                    </span>
                    <span>
                      <span className="block text-[15px] font-medium">{m.label}</span>
                      <span className="block text-[14px] text-(--fbg-text-secondary)">
                        {m.note}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-5 border-t border-(--fbg-border-divider) pt-4 text-[14px] leading-relaxed text-(--fbg-text-secondary)">
                {COMPARE.currencyNote}
              </p>
            </div>
            <div className="rounded-(--fbg-radius-card) border border-(--fbg-border-subtle) bg-(--fbg-bg-surface) p-6">
              <h3 className="text-[15px] font-semibold">{COMPARE.costTitle}</h3>
              <dl className="mt-4 flex flex-col gap-4">
                {COMPARE.costLines.map((c) => (
                  <div key={c.status}>
                    <dt>
                      <StatusChip status={c.status} />
                    </dt>
                    <dd className="mt-1.5 text-[14px] text-(--fbg-text-secondary)">{c.note}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div className="rounded-(--fbg-radius-card) border border-(--fbg-border-subtle) bg-(--fbg-bg-surface) p-6">
              <h3 className="text-[15px] font-semibold">{COMPARE.quoteTitle}</h3>
              <dl className="mt-4 flex flex-col gap-4">
                {COMPARE.quoteTags.map((q) => (
                  <div key={q.tag}>
                    <dt>
                      <QuoteStatusTag kind={q.tag} />
                    </dt>
                    <dd className="mt-1.5 text-[14px] text-(--fbg-text-secondary)">{q.note}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </Band>

        {/* Categories */}
        <Band id={SECTION_IDS.categories} surface>
          <SectionIntro
            headingId={`${SECTION_IDS.categories}-heading`}
            eyebrow={CATEGORIES.eyebrow}
            title={CATEGORIES.title}
            lead={CATEGORIES.lead}
          />
          <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {CATEGORIES.items.map((c) => (
              <li
                key={c.title}
                className="flex flex-col rounded-(--fbg-radius-card) border border-(--fbg-border-subtle) bg-(--fbg-bg-canvas) p-6"
              >
                <h3 className="text-[17px] font-semibold">{c.title}</h3>
                <p className="fbg-zh mt-1 text-[15px] text-(--fbg-text-secondary)" lang="zh-CN">
                  {c.zh}
                </p>
                <p className="mt-6 text-[12px] font-medium tracking-[0.06em] text-(--fbg-text-secondary) uppercase">
                  {CATEGORIES.exampleLabel}
                </p>
                <p className="mt-1 text-[14px] leading-relaxed">{c.example}</p>
              </li>
            ))}
            <li className="flex flex-col rounded-(--fbg-radius-card) border border-dashed border-(--fbg-border-strong)/50 p-6">
              <h3 className="text-[17px] font-semibold">{CATEGORIES.otherTitle}</h3>
              <p className="mt-2 flex-1 text-[14px] leading-relaxed text-(--fbg-text-secondary)">
                {CATEGORIES.otherBody}
              </p>
              <a
                href={SITE_LINKS.startRequest}
                className="mt-5 inline-flex min-h-11 items-center gap-1 self-start text-[15px] font-medium text-(--fbg-link) hover:underline"
              >
                {CATEGORIES.otherCta}
                <Icon name="chevron-right" size={16} />
              </a>
            </li>
          </ul>
          <p className="mt-8 flex max-w-4xl gap-3 text-[14px] leading-relaxed text-(--fbg-text-secondary)">
            <Icon name="info" size={16} className="mt-0.5 shrink-0" />
            {CATEGORIES.restricted}
          </p>
        </Band>

        {/* Quality process */}
        <Band id={SECTION_IDS.quality}>
          <div className="grid gap-12 lg:grid-cols-[1fr_1.15fr] lg:gap-16">
            <div>
              <SectionIntro
                headingId={`${SECTION_IDS.quality}-heading`}
                eyebrow={QUALITY.eyebrow}
                title={QUALITY.title}
                lead={QUALITY.lead}
              />
              <div className="mt-8 rounded-(--fbg-radius-card) border border-(--fbg-border-subtle) bg-(--fbg-bg-sunken) p-5">
                <h3 className="text-[15px] font-semibold">{QUALITY.limitsTitle}</h3>
                <p className="mt-1.5 text-[15px] leading-relaxed text-(--fbg-text-secondary)">
                  {QUALITY.limits}
                </p>
              </div>
            </div>
            <ul className="flex flex-col divide-y divide-(--fbg-border-subtle) self-start rounded-(--fbg-radius-card) border border-(--fbg-border-subtle) bg-(--fbg-bg-surface)">
              {QUALITY.checks.map((c) => (
                <li key={c.label} className="p-5 sm:p-6">
                  <Badge
                    tone={c.kind === "check" ? "teal" : "neutral"}
                    icon={c.kind === "check" ? "shield" : "message"}
                  >
                    {c.label}
                  </Badge>
                  <p className="mt-2.5 text-[15px] leading-relaxed text-(--fbg-text-secondary)">
                    {c.body}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </Band>

        {/* About */}
        <Band id={SECTION_IDS.about} surface>
          <div className="grid gap-12 lg:grid-cols-[1fr_1.15fr] lg:gap-16">
            <div>
              <SectionIntro
                headingId={`${SECTION_IDS.about}-heading`}
                eyebrow={ABOUT.eyebrow}
                title={ABOUT.title}
                lead={ABOUT.lead}
              />
              <p className="mt-6 text-[14px] text-(--fbg-text-secondary)">{ABOUT.entity}</p>
            </div>
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <div>
                <h3 className="text-[13px] font-semibold tracking-[0.08em] text-(--fbg-text-secondary) uppercase">
                  {ABOUT.isTitle}
                </h3>
                <ul className="mt-4 flex flex-col gap-4">
                  {ABOUT.is.map((line) => (
                    <li key={line} className="flex gap-3 text-[15px] leading-relaxed">
                      <Icon
                        name="check"
                        size={16}
                        className="mt-1 shrink-0 text-(--fbg-action-primary)"
                      />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="text-[13px] font-semibold tracking-[0.08em] text-(--fbg-text-secondary) uppercase">
                  {ABOUT.notTitle}
                </h3>
                <ul className="mt-4 flex flex-col gap-4">
                  {ABOUT.not.map((line) => (
                    <li key={line} className="flex gap-3 text-[15px] leading-relaxed">
                      <Icon name="x" size={16} className="mt-1 shrink-0 text-(--fbg-text-muted)" />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </Band>

        {/* FAQ */}
        <Band id={SECTION_IDS.faq}>
          <div className="grid gap-10 lg:grid-cols-[1fr_1.6fr] lg:gap-16">
            <SectionIntro
              headingId={`${SECTION_IDS.faq}-heading`}
              eyebrow={FAQ.eyebrow}
              title={FAQ.title}
            />
            <div className="divide-y divide-(--fbg-border-subtle) border-y border-(--fbg-border-subtle)">
              {FAQ.items.map((item) => (
                <details key={item.q} className="group">
                  <summary className="flex min-h-14 cursor-pointer items-center justify-between gap-4 py-4 text-[16px] font-medium">
                    <h3 className="text-[16px] font-medium">{item.q}</h3>
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-(--fbg-border-subtle)">
                      <Icon name="plus" size={14} className="fbg-faq-icon" />
                    </span>
                  </summary>
                  <p className="max-w-2xl pb-5 text-[15px] leading-relaxed text-(--fbg-text-secondary)">
                    {item.a}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </Band>

        {/* Sourcing request: always Obsidian */}
        <section
          id={SECTION_IDS.contact}
          aria-labelledby={`${SECTION_IDS.contact}-heading`}
          className="fbg-obsidian fbg-hero-obsidian text-(--fbg-text-primary)"
        >
          <div
            className={cx(WRAP, "grid gap-12 py-16 md:py-24 lg:grid-cols-[1fr_1.25fr] lg:gap-16")}
          >
            <div className="min-w-0">
              <SectionIntro
                headingId={`${SECTION_IDS.contact}-heading`}
                eyebrow={CONTACT.eyebrow}
                title={CONTACT.title}
                lead={CONTACT.lead}
              />
              <h3 className="mt-10 text-[13px] font-semibold tracking-[0.08em] text-(--fbg-text-secondary) uppercase">
                {CONTACT.nextTitle}
              </h3>
              <ol className="mt-5 flex flex-col gap-5">
                {CONTACT.next.map((n, i) => (
                  <li key={n.title} className="flex gap-4">
                    <span className="fbg-num flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-(--fbg-border-subtle) text-[13px] font-semibold text-(--fbg-action-primary)">
                      {i + 1}
                    </span>
                    <span>
                      <span className="block text-[15px] font-semibold">{n.title}</span>
                      <span className="mt-0.5 block text-[14px] leading-relaxed text-(--fbg-text-secondary)">
                        {n.body}
                      </span>
                    </span>
                  </li>
                ))}
              </ol>
              {SITE_LINKS.signIn ? null : (
                <p className="mt-10 text-[13px] text-(--fbg-text-muted)">{CONTACT.signInNote}</p>
              )}
            </div>
            <div className="min-w-0">
              <InquirySection mode={inquiryMode} />
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-(--fbg-border-subtle)">
        <div className={cx(WRAP, "py-12")}>
          <div className="grid gap-10 md:grid-cols-[1.2fr_1fr] lg:grid-cols-[1.4fr_1fr_auto]">
            <div className="max-w-sm">
              <p className="flex items-center gap-2.5 font-semibold">
                <BrandMark size={22} className="text-(--fbg-action-primary)" />
                {SITE_NAME}
              </p>
              <p className="mt-3 text-[14px] leading-relaxed text-(--fbg-text-secondary)">
                {FOOTER.tagline}
              </p>
              <p className="mt-4">
                <Badge tone="neutral" icon={null}>
                  {FOOTER.pilot}
                </Badge>
              </p>
            </div>
            <nav aria-label="Footer">
              <ul className="grid grid-cols-2 gap-x-6 gap-y-1 text-[14px]">
                {FOOTER_NAV.map((n) => (
                  <li key={n.href}>
                    <a
                      href={n.href}
                      className="inline-flex min-h-10 items-center text-(--fbg-text-secondary) hover:text-(--fbg-text-primary)"
                    >
                      {n.label}
                    </a>
                  </li>
                ))}
                {SITE_LINKS.signIn ? (
                  <li>
                    <a
                      href={SITE_LINKS.signIn}
                      className="inline-flex min-h-10 items-center text-(--fbg-text-secondary) hover:text-(--fbg-text-primary)"
                    >
                      Sign in
                    </a>
                  </li>
                ) : null}
              </ul>
            </nav>
            <div className="flex flex-col items-start gap-2">
              <p className="text-[13px] text-(--fbg-text-secondary)">{FOOTER.appearance}</p>
              <AppearanceSwitch />
            </div>
          </div>
          <p className="mt-10 border-t border-(--fbg-border-divider) pt-6 text-[13px] text-(--fbg-text-secondary)">
            {FOOTER.legal}
          </p>
        </div>
      </footer>
    </div>
  );
}
