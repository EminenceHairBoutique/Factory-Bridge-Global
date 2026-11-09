# UX-04 Simplification and Premium Refinement — Documents, Comparison modes, Public homepage

**Date:** 2026-11-08 · **Track:** UX-04 (continuation of UX-03, same session, same worktree) · **Branch:** `design/ux04-premium-refinement`, stacked on `design/ux03-clarity-pass` (PR #16) · **Scope touched:** `apps/web/src/design-preview/**`, `apps/web/src/app/design-preview/**`, this document and `screenshots/ux-04/`. No backend, Supabase, AI, pricing, worker, CI, environment, production root page or shared production CSS. Preview routes still 404 in production (verified, §5.1).

UX-04 items 1 (dashboard), 5 (shell) and 6 (visual refinement) were delivered by UX-03 (`UX_03_CLARITY_PASS_REPORT.md`). This pass covers item 2 (Documents), item 4 (Quotation comparison) and the homepage addendum. Item 3 (Messages) belongs to the parallel design session that owns the inbox screens (PR #15); it has agreed to apply the conversation-first layout there.

Design philosophy applied: make the simple tasks effortless, keep the complex details one click away, never hide uncertainty.

## 1. Audit of the three screens before this pass

| Screen | What made it heavy | Evidence |
|---|---|---|
| Documents | A large upload intake above the list on every visit; a three-badge header; rows that mixed name, status, six metadata facts and the next step into three lines; the record inspector always open on the right with every section expanded; the document `d_quote_h` preselected on load. | `screenshots/ux-04/before/documents-1366x768-atlas.png` |
| Quotation comparison | One presentation only: a full matrix with every row (quote, eight specification rows, price, terms, seven landed lines) per group, the "why groups" essay and the landed-cost inputs in a two-column panel above it, three header badges, the quantity control squeezing the title. The phone carousel had the same density. | `before/compare-1440x900-atlas.png`, `before/compare-1440-full-page-atlas.png` |
| Marketing preview | Five nav links to `#` (dead), no Home/Contact, the Appearance switch in the public top bar, 72 px headline, bordered card grid for the pillars, no About or Contact section. | `before/marketing-1440x900-atlas.png` |

## 2. What changed

### 2.1 Documents (`screens/BuyerDocuments.tsx`, `documents-view.ts`)

- **List first.** One row per document: file (with kind icon), project, type, status badge, date added, next action. Column headers on tablet and desktop; on phones the project and type fold under the file name and the date and next action take their own lines.
- **Next action is one thing per row** (`nextActionFor`, tested): `Open extraction review` (link) when a buyer review exists, `Operator review in progress`, `Upload a clean copy` after a scan rejection, `See reviewed values` for accepted reviewable quotations, the linked record for other accepted files, `Next: …` for files still in the pipeline, `Discarded`.
- **Inspector on demand.** Nothing is selected on load. Clicking a row opens the record as the right rail on xl screens and as a drawer below (side sheet on tablet, bottom sheet on phones) with focus on `Close` and `Escape` to dismiss; the row shows `aria-pressed`. The record keeps every fact: status and who acts, actions (download link, review, clean copy, discard), scan rejection and extraction-flag notices, the extraction summary, the linked record, then three sections — Provenance and security (source, visibility, file, fingerprint, scan, retention, added; open), Pipeline (open), Access log (collapsed, with count).
- **Upload intake collapsed** until `Add documents` (the one primary action) or the `#upload` anchor opens it; it scrolls into view and focuses the file input. Simulated pipeline unchanged.
- Search by file name added; status tabs, project and kind filters kept (`filterDocuments`, tested). Session action log moved under the list as a collapsed disclosure.

### 2.2 Quotation comparison (`screens/QuoteComparison.tsx`, `compare-modes.ts`)

- **Three presentations of the same evaluated quotes**, switched by a segmented control with a one-line hint; `?mode=summary|compare|details` opens one directly for review links.
  - **Summary** — one card per quote inside its trade-term group: supplier and basis, the comparable goods cost for the selected quantity with unit price and tier, quote type, validity (`Valid until`, `Validity unconfirmed`, `Quote expired`), check-record count or `No verification record`, lead time, payment terms, landed total or `Partial · n lines missing`, and always a `Missing:` line (or `Why not ranked:` with the exclusion reason). `Lowest in group` marks the group's lowest comparable goods cost. `Full details` on a card selects it and switches mode.
  - **Compare** — the side-by-side matrix per group reduced to decision rows: quote type, validity, tier, unit price, comparable goods cost, lead time, payment, verification evidence, and the landed total with what it excludes (the section header says "totals only; Full details lists every line").
  - **Full details** — every row: source reference, confirmed date, the eight specification rows against brief v3 with mismatches marked, tiers and MOQ, goods, one-time fees, every landed line with sourced / estimated / missing status and its source.
- **Nothing ranked across groups** and nothing hidden: groups, exclusions, partial totals, the cross-group ranking status line and the landed-cost inputs are unchanged in logic (`compare-demo.ts` untouched).
- **Calmer frame.** Quantity moved from the header into the inputs panel ("Quantity to price"); forwarder estimate and duty assumption sit in one compact row; the ranking status is one line; the "why groups" explanation is a disclosure. Header metadata is plain text; `Export report` is the one primary action. Phone: Summary cards stack full width; Compare and Full details use the existing carousel with the row set of the mode.

### 2.3 Public homepage preview (`screens/MarketingHome.tsx`, `marketing-nav.ts`)

- **Seven anchored destinations** — Home · How it works · Services · Categories · Quality process · About · Contact — in the top bar (Home as the mark), the phone drawer and the footer; every target exists on the page, no `#` links remain (tested).
- **Sections:** Obsidian hero (headline 40/48/60 px, supporting line, primary `Start a sourcing request`, secondary `How it works`, the approval statement) with the bridge figure now naming its two ends (U.S. buyer · Factory); How it works (five numbered steps with who acts); Services (four, divided by hairlines instead of cards); Categories (three, with the excluded categories stated); Quality process (what each check record means); About (what the service is, and what it is not: no marketplace, no autonomous buying, no scraped data; entity details after legal review); Contact (Obsidian band with the two CTAs and "tell us how you prefer to be reached").
- **Motion:** one entrance on load — eyebrow, headline and actions rise in three beats and the arc is drawn once — then nothing moves; `prefers-reduced-motion` zeroes durations and delays.
- **Chrome:** Appearance switch moved from the public top bar to the footer and the phone drawer; `Sign in` stays.

### 2.4 Shared

- Pre-paint theme boot reworked: the segment layout now emits the boot script as raw HTML and records the stored choice in `<meta name="fbg-theme">`; `design-preview.css` keys the unhydrated tokens off that meta with `:has()`. No React-managed element is touched, so hydration is clean (the UX-03 version set an attribute on `<html>`, which the root layout does not render and React warned about).
- Reduced-motion rule now also zeroes animation delays.

## 3. Files

| File | Change |
|---|---|
| `compare-modes.ts` (new) + `compare-modes.test.ts` (8 tests) | Modes, section and row visibility per mode, `summaryFacts` (headline, validity, missing, landed, evidence count). |
| `documents-view.ts` (new) + `documents-view.test.ts` (6 tests) | `nextActionFor`, `filterDocuments`. |
| `marketing-nav.ts` (new) + `marketing-nav.test.ts` (1 test) | The seven destinations. |
| `screens/BuyerDocuments.tsx` (rewrite) | §2.1. |
| `screens/QuoteComparison.tsx` | Mode switch, Summary cards, mode-aware matrix and carousel, compact inputs panel, header. |
| `screens/MarketingHome.tsx` (rewrite) | §2.3. |
| `app/design-preview/layout.tsx`, `theme.tsx`, `design-preview.css` | Theme boot via meta; hero motion; reduced-motion delays. |
| `app/design-preview/page.tsx` | Index entries for the three screens. |

## 4. Behaviour changes to note

- Documents no longer preselects a document; the record is opened by the user. `Add documents` toggles the intake (`aria-expanded`).
- The comparison opens in Summary. The previous "Show specification rows" checkbox is replaced by the Full details mode. The compare-selection ("Compare n selected") works in every mode.
- The marketing `Appearance` switch is in the footer and the phone drawer, not the top bar.
- Quantity for the comparison is set inside the inputs panel, not in the page header.

## 5. Validation

### 5.1 Commands actually run

| Check | Command | Result |
|---|---|---|
| Unit tests, web | `pnpm --filter @fbg/web test` | 14 files, 104 passed (90 from UX-03 + 14 new) |
| Typecheck | `pnpm --filter @fbg/web typecheck` | `next typegen` ok, `tsc --noEmit` 0 errors |
| Lint | `pnpm exec eslint apps/web/src --max-warnings 0` | 0 problems |
| Full check | `pnpm check` on the final tree | exit 0 — Prettier, typecheck and lint clean; Vitest i18n 4, domain 50, ai 48, web 104, worker 12, eval 12, supabase 124 (PGlite) |
| Production build | `pnpm --filter @fbg/web build` | exit 0, compiled; `/buyer/compare`, `/buyer/documents`, `/marketing` dynamic |
| Production isolation | `NODE_ENV=production next start -p 3105` + curl | `/design-preview/buyer/compare`, `/buyer/documents`, `/marketing` → 404; `/` → 200 |

TDD: `compare-modes.ts`, `documents-view.ts` and `marketing-nav.ts` were written after their tests failed with "Cannot find module", then made green.

### 5.2 Browser checks (fresh tab, dev server on port 3103)

- **Console:** no errors on `/buyer/dashboard?theme=obsidian`, `/buyer/compare` (all three modes), `/buyer/documents` (including the drawer, the intake and a simulated upload) and `/marketing`.
- **Theme boot:** on `?theme=obsidian` the meta is present, the scope is already `obsidian` and hydrated, a link-button computes `#161e29`, zero pending transitions.
- **Comparison:** Summary shows 6 cards, 4 of them `Not ranked` with reasons, `Missing:` lists named landed lines; `Full details` on a card switches the mode and renders 85 table rows including the specification rows and `Inland transport, origin`; Compare renders 34 rows without specification rows; ticking two quotes and `Compare 2 selected` narrows each group's table to the ticked columns.
- **Documents:** 11 rows under six column headers, no inspector on load; selecting a row opens the drawer titled with the file name, focus on `Close`, sections Provenance and security · Pipeline (6) · Access log (3); `Escape` closes it; `Add documents` opens the intake (`aria-expanded="true"`), `Try a sample file` adds a row and opens its record; `/buyer/documents#upload` opens the intake and scrolls to it.
- **Marketing:** six header links, seven footer links, every anchor target present, zero `#` links, one headline animation, appearance switch in the footer only.
- **Phone (375×812):** Summary cards 343 px wide (one column); Compare uses the carousel; the Documents record is a full-width bottom sheet; the site menu lists the seven destinations and `Sign in` at 44 px each, closes on anchor click, and `#about` navigates. **320×700:** no horizontal overflow on the comparison (Full details), Documents or marketing.

### 5.3 Screenshots

`docs/design/atlas-obsidian/screenshots/ux-04/` — `before/` (Documents 1366×768, comparison 1440×900 and full page, marketing 1440×900) and `after/` (comparison Summary / Compare / Full details at 1440×900 in Atlas and Obsidian plus a full-page Summary; Documents 1366×768 in both themes; marketing 1440×900 in both themes and full page; Summary, Documents and marketing at 390×851).

## 6. Known limitations

- Messages (UX-04 item 3) is not in this branch; it is owned by PR #15's session.
- The comparison's Summary cards show one `Lowest in group` marker per trade-term group; cross-group ranking stays unavailable until every landed line is present, exactly as before.
- Marketing copy remains a proposal (OQ-02 entity wording, OQ-04 pricing); the About section states that entity details follow the legal review rather than inventing them. Standalone pages for the seven destinations are specified, not built; the preview anchors to sections.
- Report generation and the clarification send remain simulated or disabled with their reasons, as before.
- No automated accessibility audit; manual checks only.

## 7. Cross-track handoffs

- **B-31 (public homepage integration):** once this preview is approved, replace the production root page with this layout as its own PR: self-host Geist, Inter and Noto Sans SC (H-16), promote the tokens (H-14), carry the hero entrance CSS and the `MARKETING_NAV` anchors to real routes, and keep the copy caveats until OQ-02 / OQ-04 close.
- **H-37 (documents list query):** the list columns map to `documents` (name, kind, status, uploaded_at, project) plus a derived next action; the inspector's access log needs the per-document access-event query (B-10).
- **H-38 (comparison presentation):** `summaryFacts` describes the card DTO the quote engine (B-14) should expose per evaluated quote: comparable goods cost, validity state, missing lines by name, landed completeness, evidence count, exclusion reason.
- Stacked on PR #16: merge #16 first (after #15, per the agreement recorded there), then this branch.
