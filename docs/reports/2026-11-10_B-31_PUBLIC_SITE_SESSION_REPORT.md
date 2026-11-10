# Session report — 2026-11-10 — B-31 public website integration

Phase: 1  |  Slice: B-31 public site at `/` + sourcing-request form  |  Branch: `b-31-public-site` (worktree `C:/dev/wt-b31`)
Base: `origin/main` `58775be`, then merged `origin/main` `21c58e6` (PR #34, B-18) — clean merge, all checks re-run after it.
Nothing was merged to `main`, deployed, or sent. No paid account, provider, domain or inbox was created or used.

## Implemented

- **Production home page at `/`** in route group `apps/web/src/app/(site)/` (ADR-002 route groups), built from the approved Atlas × Obsidian design system: Obsidian hero (bridge figure, approved headline set), four benefits, How it works (5 steps with "who acts" + the handoff-boundaries box), Services + "What you receive", Quote comparison (must-match list, cost-line and quote-status legends using the real `StatusChip` / `QuoteStatusTag` primitives), Categories (3 pilot families with Chinese glosses, "something else" path, full restricted-category sentence), Quality process (check meanings incl. "Contacted is not the same as checked", limits paragraph), About ("how we work" / "what we are not"), FAQ (accordion), Start a sourcing request (Obsidian), footer.
- **Navigation:** every link is an in-page anchor to a rendered section (tested). Sticky header that stays Obsidian over the hero, marks the section in view (`aria-current="location"`), phone menu (Escape closes and returns focus, closes on link tap and on widening, scrolls inside itself on short screens), skip link, appearance switch (Atlas / Obsidian / System, persisted), branded 404.
- **Sign in is omitted** (no `/design-preview/auth`, no fake auth). One switch for B-05: `SITE_LINKS.signIn` in `apps/web/src/site/links.ts` — when B-05 ships `/sign-in`, setting it shows Sign in in the header, phone menu and footer.
- **Sourcing-request form** (server action `apps/web/src/app/(site)/actions.ts` → `apps/web/src/server/inquiry/*`): strict zod schema (name, work email, company, product family, optional quantity, message, consent; no uploads, no phone); honeypot; browser-measured fill-time check (no client/server clock comparison); per-client in-memory rate limit (best-effort; durable limiter is B-28); content-keyed idempotency; input echoed back on every unsuccessful outcome; error boundary that keeps the draft if the action call itself fails (deploy skew, network). **Delivery fails closed** (proposed **ADR-040**): `INQUIRY_DELIVERY` unset → form shown switched off with an honest notice and the action refuses; `dry_run` (non-production only) validates end to end and says "not sent"; `resend` (REST via `fetch`, no new dependency) sends one plain-text email to a fixed internal inbox with the visitor as Reply-To only. Nothing is stored; nothing personal is logged.
- **Pre-launch safety:** `noindex` + robots `Disallow: /` unless `SITE_INDEXING=enabled` on `APP_ENV=production` (`site/indexing.ts`); favicon (`app/icon.svg`); `.env.example` placeholders `SITE_INDEXING`, `DESIGN_PREVIEW`, `INQUIRY_DELIVERY`, `INQUIRY_TO_EMAIL`.
- **Copy** in one reviewable module (`apps/web/src/site/content.ts`), drafted from master spec §2.1, ADR-026, QUALITY_ASSURANCE.md and PILOT_CATEGORY_SELECTION.md; prohibited-claims guard (`site/claims.ts`) enforced over every string and over the rendered page.
- **Reuse without touching the design track:** production imports `design-preview/ui/primitives.tsx`, `ui/icons.tsx`, `theme.tsx` and `design-preview.css` through one seam, `apps/web/src/site/design-system.ts`. No design-preview file was modified. `ui/AppShell`, `nav`, `screens/*` and `demo-data/*` are never imported (tested).

## Tested (commands and results, this machine, Windows 11, Node 22, pnpm 10.28)

| Check | Result |
|---|---|
| `pnpm format:check` · `pnpm typecheck` · `pnpm lint` (merged tree) | ✅ all exit 0 |
| `pnpm -r test` (merged tree) | ✅ 572 tests: web 289 (232 existing + **57 new**), supabase 157 (**PGlite**, not real Postgres), domain 50, ai 48, eval 12, worker 12, i18n 4 |
| `next build` (production, default env) | ✅ `/` static; `/robots.txt`, `/icon.svg` added |
| `next start` probes (default env) | ✅ `/` 200 with `noindex`, form switched off + notice, no test banner, 0 `/design-preview` strings; `/design-preview`, `/design-preview/marketing`, `/design-preview/buyer/dashboard`, `/design-preview/supplier/quotes`, `/no-such-page` → 404 (branded, no demo strings); robots `Disallow: /`; security headers unchanged; none of the 14 assets `/` loads contains zod, the schema, preview routes or demo data; marketing fonts preload on `/` only (not on the 404 / other routes) |
| Browser pass (Playwright via installed Edge, production build with `APP_ENV=staging INQUIRY_DELIVERY=dry_run`) | ✅ **54/54**: 6 nav links scroll + mark current; header Obsidian→canvas; hero/header/category/footer CTAs land on their sections; brand link to top; skip link focuses `<main>`; one h1, 8 h2; FAQ by keyboard; appearance persists across reload with dark canvas; **WCAG AA text contrast in Atlas and Obsidian**; test mode announced; invalid submit focuses first error and keeps input (incl. the select); valid dry run says "Test mode … not sent" and never "sent"; "Send another request" empties the form, resets the counter and focuses Name; too-fast submit refused with every field kept; no console errors; phone menu (44 px toggle, focus, Escape, link tap, CTA, scrolls on a 320 px-tall screen); no horizontal overflow at 320/375/390/768/1024/1280/1440; page and form work **without JavaScript** |
| Independent review (5 lenses × skeptic verifier) | 45 findings (some overlapping across lenses) → 26 confirmed, all fixed or recorded below; 19 refuted with reasons (two cheap ones — action-argument guards, limiter eviction order — hardened anyway) |

The browser pass is a session script (`node verify.cjs`), **not** a repository E2E suite — `test:e2e` is still owned by B-05 / M0-D (PR #36).

## Deployed

Nothing. Note (from the M0 track, PR #36): `main` is Git-connected to a protected Vercel project, so *merging* this PR would update that protected build (no env vars → form switched off, `noindex`). See founder actions.

## Partial / blocked

- **Live delivery** ⛔ — needs a founder-approved provider/account (OQ-16), sending domain + `EMAIL_FROM` (OQ-02), recipient inbox, privacy notice (OQ-06). The Resend adapter has only been exercised against a mocked `fetch`.
- **Public launch** ⛔ OQ-02 (entity / "U.S.-based"), OQ-06 (privacy policy), hosting (OQ-16), inquiry delivery (ADR-040). Founder copy approval (H-17): **given 2026-11-10**.
- **CSP** (SECURITY.md T15) not added; recorded in ADR-040.
- **Fonts:** `next/font/google` (self-served at runtime; `next build` needs network) instead of H-16's `next/font/local` — recorded deviation in `site/fonts.ts` and H-16.

## Review findings fixed in this session

Form: echo input on rate-limited / rejected / unavailable responses; select value lost after an invalid submit (React form reset) → keyed remount; client/server clock comparison → browser-measured fill time; "Nothing was sent" after a provider timeout → "couldn't confirm"; reused idempotency key on an edited retry → key = submission id + content hash; lost focus after "Send another request"; stale character counter; no error boundary for a failed action call; zod + schema shipped to the browser (~29 KB gz) → zod-free `site/inquiry-fields.ts`; untyped action arguments → guarded. A11y: phone menu unscrollable on short screens; Obsidian input borders 2.1:1 → opaque token 3.5:1; `tabIndex=-1` on `<main>` → skip-link-managed; radiogroup without arrow keys → toggle buttons; muted text 4.35:1 on the Atlas canvas → secondary; footer brand badge 3.8:1 → neutral. Claims guard: dead `#1` branch; added USA-based / dash variants / "based in the U.S." / "operated from", vetted / verified quotes, counters ("hundreds of factories"), product claims. Copy: confidentiality wording matches the access model; supplier catalogs conditional on authorization (OQ-03); Currency moved out of "must match". Integration: root 404 no longer preloads marketing fonts on every route; favicon 404.

## Changes

New: `apps/web/src/app/(site)/{layout,page}.tsx`, `actions.ts`; `apps/web/src/app/{not-found.tsx,robots.ts,icon.svg}`; `apps/web/src/site/**` (content, links, claims, design-system seam, fonts, theme boot, indexing, inquiry fields/state, site.css, components: SiteHome, SiteHeader, SkipLink, InquirySection, InquiryForm, AppearanceSwitch, marks) + tests; `apps/web/src/server/inquiry/{schema,config,delivery,rate-limit,handle,runtime}.ts` + tests; `apps/web/vitest.config.mjs` (adds the `@/` alias and `.test.tsx`; the 28 existing web test files still run). Deleted: `apps/web/src/app/page.tsx` (moved into the route group). Docs: `.env.example`, `docs/STATUS.md` (B-31 row), `docs/BACKLOG.md` (B-31 ◐), `docs/DECISIONS.md` (ADR-040 proposed), `docs/design/atlas-obsidian/INTEGRATION_HANDOFF.md` (H-16, H-17 notes), screenshots under `docs/design/atlas-obsidian/screenshots/b-31/`. No migration. No dependency or lockfile change.

## Security review

- **Tenant isolation:** no database access at all; no new `anon` path; the form writes nothing.
- **Secrets:** delivery config read only in the server action; the page receives only the mode (tested on the rendered page and in source). No `NEXT_PUBLIC_` delivery variables. Test keys are obviously fake.
- **Untrusted input:** strict zod with length caps and control-character rules (CR/LF blocked in single-line fields); subject built from the enum; visitor address only as Reply-To; plain-text body marked "untrusted visitor input". Server-action arguments type-checked; Next's same-origin check for actions is on.
- **Idempotency:** provider key = submission id + content hash; replays answered from a bounded cache; failures not cached.
- **Rate limits:** best-effort in-memory per client key (5 / 10 min), offenders evicted last; documented gaps (serverless instances, IPv6 /64 rotation) are inputs to B-28.
- **Logging:** outcome codes only; no body, email or client key (tested).
- **Claims:** prohibited-claims guard over all copy and the rendered page; no "U.S.-based", counters, testimonials, savings, SLA or guarantees.

## Assumptions

- The founder's brief ("transform the placeholder… do not merge or deploy without approval") supersedes H-17's "until copy is approved the existing page stays" **for building**; merging remains the copy-approval decision.
- The named spec `FACTORY_BRIDGE_OPUS_5_5_PUBLIC_WEBSITE_NAVIGATION_LAUNCH_PROMPT.md` was not attached (the attachment was the engineering M0 prompt); this session followed the pasted brief plus M6 / B-31.
- Headline set from master spec §2.1 (PRD §7's allowed set), with "verified quotations" softened to "factory-confirmed quotations" and the fourth benefit to "One accountable record" (no live workspace yet).
- Seven sections are anchors on one page rather than the specified standalone pages (blueprint §1.2–1.8); the labels match so they can become routes later.

## Budget implications

None. No new dependency, account or service. `next/font/google` downloads font files at build time (free).

## Founder actions required

1. ~~Approve or edit the public copy~~ — **approved as written 2026-11-10** (founder, in the session; recorded in `content.ts`, H-17, STATUS and BACKLOG). Merging PR #37 still needs its own go-ahead.
2. **Decide inquiry delivery** (ADR-040): provider/account, sending domain, recipient inbox, privacy-notice text (counsel, OQ-06), whether to store requests (OQ-07), CAPTCHA or not. Until then the form stays switched off.
3. Before merging, note that `main` deploys to the protected Vercel project (PR #36 founder action 3).
4. OQ-02 (entity / location claims) and OQ-06 (privacy policy) gate the public launch and `SITE_INDEXING=enabled`.

## Coordination

- **PR #36 (M0-D, draft):** its new `verify:production-build` gate asserts the old placeholder text ("Source Better. Verify Quality.") and the default 404 text ("This page could not be found"). Whichever PR lands second must update the gate to the B-31 markup (e.g. `id="hero-heading"` + "Know your true cost", and "Page not found").
- **B-05:** set `SITE_LINKS.signIn`; extend `site/fonts.ts` rather than add a second Inter; consider group-level `not-found` files for `/app`, `/ops`, `/supplier`; H-1 promotion only needs `site/design-system.ts` repointed.
- **Design track (UX-03):** the preview modules listed above are now production dependencies; three design-system findings are recorded in H-17 (control border opacity, SegmentedControl keyboard contract, brand badge contrast).

## Next task

Founder review of copy + ADR-040 on the PR; then whichever of B-31 / #36 merges second updates the production-build gate strings. After B-05 ships `/sign-in`, flip `SITE_LINKS.signIn` (the render test that asserts no "Sign in" must flip with it).
