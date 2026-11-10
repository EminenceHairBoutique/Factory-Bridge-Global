"use client";

/**
 * Public-site top bar (PAGE_BY_PAGE_BLUEPRINT §1.1): mark, section links, Start a request; a menu panel below
 * 1024 px. Sticky, 64 px. While the Obsidian hero is under it the bar is Obsidian too, so the hero reads as one
 * surface; past the hero it takes the visitor's appearance with a hairline and a blur.
 *
 * Behaviour: the link for the section in view carries `aria-current="location"`; the phone menu traps nothing
 * but closes on Escape (focus returns to the toggle), on link activation, and when the viewport widens to the
 * desktop layout. Sign in appears only once B-05 sets SITE_LINKS.signIn to a real route.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { HERO, SITE_NAME } from "../content";
import { Icon, buttonClasses, cx } from "../design-system";
import { SECTION_IDS, SITE_LINKS, SITE_NAV, type SectionId } from "../links";
import { BrandMark } from "./marks";

const HEADER_PX = 64;

export function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [onHero, setOnHero] = useState(true);
  const [active, setActive] = useState<SectionId | null>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Hero overlap and the section in view, recomputed at most once per frame.
  useEffect(() => {
    let frame = 0;
    const measure = () => {
      frame = 0;
      const hero = document.getElementById(SECTION_IDS.top);
      setOnHero(hero ? hero.getBoundingClientRect().bottom > HEADER_PX : false);
      let current: SectionId | null = null;
      for (const item of SITE_NAV) {
        const el = document.getElementById(item.section);
        if (el && el.getBoundingClientRect().top - HEADER_PX - 32 <= 0) current = item.section;
      }
      const contact = document.getElementById(SECTION_IDS.contact);
      if (contact && contact.getBoundingClientRect().top - HEADER_PX - 32 <= 0) current = null;
      setActive(current);
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  const closeMenu = useCallback((restoreFocus: boolean) => {
    setMenuOpen(false);
    if (restoreFocus) toggleRef.current?.focus();
  }, []);

  // Escape closes the phone menu; widening to the desktop layout closes it too.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMenu(true);
    };
    const mq = window.matchMedia("(min-width: 1024px)");
    const onMq = () => {
      if (mq.matches) closeMenu(false);
    };
    document.addEventListener("keydown", onKey);
    mq.addEventListener("change", onMq);
    panelRef.current?.querySelector<HTMLElement>("a, button")?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      mq.removeEventListener("change", onMq);
    };
  }, [menuOpen, closeMenu]);

  const dark = onHero && !menuOpen;

  return (
    <header
      className={cx(
        "sticky top-0 z-40 border-b transition-colors",
        dark
          ? "fbg-obsidian border-transparent bg-[#0d1118] text-(--fbg-text-primary)"
          : "border-(--fbg-border-subtle) bg-(--fbg-bg-canvas)/90 text-(--fbg-text-primary) backdrop-blur-md",
      )}
    >
      <div className="mx-auto flex h-16 max-w-[1200px] items-center gap-3 px-4 sm:px-8">
        <a
          href={`#${SECTION_IDS.top}`}
          className="flex min-h-11 items-center gap-2.5 rounded-(--fbg-radius-control) font-semibold"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-(--fbg-radius-chip) bg-(--fbg-action-primary) text-(--fbg-action-on-primary)">
            <BrandMark size={22} />
          </span>
          <span className="hidden text-[15px] tracking-[-0.01em] sm:inline">{SITE_NAME}</span>
          <span className="fbg-sr-only sm:hidden">{SITE_NAME}</span>
        </a>

        <nav aria-label="Site" className="ml-8 hidden lg:block">
          <ul className="flex items-center gap-1">
            {SITE_NAV.map((n) => {
              const current = active === n.section;
              return (
                <li key={n.href}>
                  <a
                    href={n.href}
                    aria-current={current ? "location" : undefined}
                    className={cx(
                      "relative inline-flex h-10 items-center rounded-(--fbg-radius-control) px-3 text-[14px]",
                      current
                        ? "text-(--fbg-text-primary)"
                        : "text-(--fbg-text-secondary) hover:text-(--fbg-text-primary)",
                    )}
                  >
                    {n.label}
                    <span
                      aria-hidden
                      className={cx(
                        "absolute inset-x-3 -bottom-[13px] h-0.5 rounded-full bg-(--fbg-action-primary) transition-opacity",
                        current ? "opacity-100" : "opacity-0",
                      )}
                    />
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {SITE_LINKS.signIn ? (
            <a
              href={SITE_LINKS.signIn}
              className={cx(buttonClasses("ghost", "sm"), "hidden sm:inline-flex")}
            >
              Sign in
            </a>
          ) : null}
          <a href={SITE_LINKS.startRequest} className={buttonClasses("primary", "sm")}>
            Start a request
          </a>
          <button
            ref={toggleRef}
            type="button"
            className="flex h-11 w-11 items-center justify-center rounded-(--fbg-radius-control) hover:bg-(--fbg-hover) lg:hidden"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            aria-controls="site-menu"
            onClick={() => setMenuOpen((v) => !v)}
          >
            <Icon name={menuOpen ? "x" : "menu"} size={20} />
          </button>
        </div>
      </div>

      <div
        id="site-menu"
        ref={panelRef}
        hidden={!menuOpen}
        // Scrolls inside itself on short screens (landscape phones, zoomed text): the sticky header never grows
        // taller than the viewport, so the last link and the button stay reachable.
        className="max-h-[calc(100dvh-4rem)] overflow-y-auto overscroll-contain border-t border-(--fbg-border-subtle) bg-(--fbg-bg-surface) lg:hidden"
      >
        <nav aria-label="Site (menu)" className="mx-auto max-w-[1200px] px-4 py-2 sm:px-8">
          <ul className="flex flex-col">
            {SITE_NAV.map((n) => (
              <li key={n.href} className="border-b border-(--fbg-border-divider) last:border-b-0">
                <a
                  href={n.href}
                  aria-current={active === n.section ? "location" : undefined}
                  onClick={() => closeMenu(false)}
                  className="flex min-h-12 items-center justify-between text-[16px] text-(--fbg-text-primary)"
                >
                  {n.label}
                  <Icon name="chevron-right" size={16} className="text-(--fbg-text-muted)" />
                </a>
              </li>
            ))}
            {SITE_LINKS.signIn ? (
              <li>
                <a
                  href={SITE_LINKS.signIn}
                  className="flex min-h-12 items-center text-[16px] text-(--fbg-text-primary)"
                >
                  Sign in
                </a>
              </li>
            ) : null}
          </ul>
          <a
            href={SITE_LINKS.startRequest}
            onClick={() => closeMenu(false)}
            className={cx(buttonClasses("primary", "lg"), "mt-3 mb-2 w-full")}
          >
            {HERO.primaryCta}
          </a>
        </nav>
      </div>
    </header>
  );
}
