# UX-03 Clarity Pass — Focused Navigation and Visual Simplification

**Date:** 2026-11-08 · **Track:** UX-03 — navigation, information hierarchy, visual polish (frontend/design only) · **Branch:** `design/ux03-clarity-pass` in worktree `C:\dev\wt-ux03`, based on `main` at `2360784` (after PR #14) · **Scope touched:** `apps/web/src/design-preview/**`, `apps/web/src/app/design-preview/**`, this document and `screenshots/ux-03/`. No backend, Supabase, AI, pricing, worker, CI, environment or production-shell files.

Independent from the backend, AI, RLS and pricing tracks. Coordinated with the parallel design session (PR #15, Messages) — see §7.

## 1. Audit

### 1.1 Defects found (with evidence)

| # | Defect | Where | Evidence |
|---|---|---|---|
| 1 | Two primary-nav entries selected at once | `ui/AppShell.tsx` | `Projects` pointed at `/buyer/dashboard#projects`; `isActive` compared `href.split("#")[0]` to the pathname, so both `Overview` and `Projects` rendered `aria-current="page"` on the dashboard (before screenshot: both rail rows highlighted). |
| 2 | Duplicate page title, two `<h1>` | `AppShell` top bar + `PageHeader` | The shell rendered `<h1>Overview</h1>` in the sticky bar and `BuyerDashboard` rendered a second `<h1>Overview</h1>` 60 px below it. |
| 3 | Overview crowded: five regions above the fold | `screens/BuyerDashboard.tsx` | Header with two CTAs, five action rows, five quote-status rows, a six-column project table, six supplier-option rows with evidence badges, five audit rows. At 1366×768 the viewport ended inside the fourth action row (before screenshot). |
| 4 | Inert affordances | dashboard, project overview, shell | `Upload a quote` had no handler on both screens; the bell carried a hard-coded `3`; the organization chip was a `button` with `aria-haspopup` and no menu; the EN/中文 toggle changed nothing; `Messages` was planned yet showed a count badge. |
| 5 | Quotes destination mis-scoped | `AppShell` nav | `Quotes` opened the single labels-project comparison, implying an organization-wide list. |
| 6 | Harsh demo banner | `.fbg-demo-stripe` | Black/yellow diagonal stripes above every screen. |
| 7 | Dark-mode gaps | tokens | Obsidian `border-strong` measured 2.9:1 (recorded gap, DESIGN_TOKENS_V1 §2). Found during this pass: a stored Obsidian preference painted Atlas first and then animated every colour over 180 ms on each page load, because the theme was applied after hydration. |
| 8 | Tertiary controls in the rail | `AppShell` | Appearance switch, `Organization`, `Team and account` and `Collapse` all lived in the rail's bottom block. |

### 1.2 Repository and PR state at the start

- `main` was at `d4174fd` (PR #10 merged). PR #14 (reports) was open on `design/ux-mobile-foundation`; it merged into `main` (`2360784`) while this pass was in progress, together with B-10, B-08b and B-15. This branch was fast-forwarded onto that `main` before any shared file was edited.
- PR #15 (buyer and supplier message inboxes, supplier catalog) is open on the same other branch and edits `AppShell.tsx`, `demo-data/index.ts`, `ProjectOverview.tsx`, `QuoteComparison.tsx` and the preview index. Ownership and merge order were agreed with that session (§7).

### 1.3 File ownership (this pass)

Owned and rewritten: `ui/AppShell.tsx`, `screens/BuyerDashboard.tsx`. Owned and edited: `ui/primitives.tsx`, `design-preview.css`, `theme.tsx`, `app/design-preview/layout.tsx`. New: `nav.ts`, `projects-demo.ts`, `theme-param.ts`, `ui/ProjectList.tsx`, `screens/BuyerProjects.tsx`, `screens/BuyerQuotes.tsx`, routes `/buyer/projects`, `/buyer/quotes`, three test files. Small, documented edits to files PR #15 also touches: `ProjectOverview.tsx` (tab prop), `QuoteComparison.tsx` (one back link), `demo-data/index.ts` (two `href`s), preview index (three entries).

## 2. Information architecture (one page)

**The Overview answers three questions and nothing else:** what needs my attention, where are my projects, what should I do next. Everything else is one click away in a dedicated destination.

### 2.1 Buyer destinations

| Sidebar entry | Route | Child routes that keep it active | Status |
|---|---|---|---|
| Overview | `/design-preview/buyer/dashboard` | — | implemented |
| Projects | `/design-preview/buyer/projects` (new) | `/buyer/project`, `/buyer/new-request`, `/buyer/brief`, `/buyer/reports`, `/buyer/report` | implemented |
| Quotes | `/design-preview/buyer/quotes` (new, scoped landing) | `/buyer/compare` | implemented |
| Documents | `/design-preview/buyer/documents` | `/buyer/review` | existing |
| Inbox | `/design-preview/buyer/messages` (PR #15) | thread deep links (`?thread=`) | implemented; count derived from threads awaiting you |
| Account | opens the account-and-appearance sheet | — | trigger, never active |

Active-state rule (`nav.ts`, unit tested): exact path match first, then the longest segment-aware child prefix, otherwise nothing. Anchors and query strings are stripped and no shipped entry uses one. Exactly one entry or none is ever `aria-current="page"` per navigation landmark (rail, phone tabs, phone sheet).

### 2.2 What moved where

| Was on the Overview | Now |
|---|---|
| Five action rows, `Hide` | Three ranked rows; `Show all 5` reveals the rest; `Set aside` moves an item to an explicitly temporary, browser-only group with `Restore` — nothing is dismissed |
| Quote status panel (five counts) | Quotes page tiles; three derived numbers stay as quiet header metadata |
| Six-column project table with filters | Projects page (search, four filters, column headers, in-row disclosure); Overview shows the three most recently updated with the same disclosure |
| Supplier options on the labels project | Project record → Supplier options tab (`/buyer/project?tab=options`), linked from the Overview |
| Recent activity | Project record → Activity tab (`/buyer/project?tab=activity`), linked from the Overview |
| `Upload a quote` button (inert) | Quiet link to `/buyer/documents#upload` (the real upload intake) |
| Organization badge, "As of" badge | Organization label in the top bar and account sheet only; "As of" as plain metadata on tablet and desktop |

### 2.3 Shell

Rail 224 px (collapsed 64 px), 14 px labels, one active entry with a 3 px action-colour bar; bottom block holds only the account button and `Collapse`. Top bar 56 px: organization label (static, titled "switching is not in this prototype"), notifications marked planned (no count), account avatar. The page renders the only `<h1>`. The account sheet (avatar, phone `Account` tab, or the phone navigation sheet) holds who is signed in, the Appearance switch, the interface language statement, and the planned `Organization` / `Team and account` entries. Phone: brand in the top bar, four tabs Home · Projects · Inbox (planned) · Account.

## 3. Before / after concept

### 3.1 Overview wireframe, 1366×768

```
▲ DEMO DATA — NOT REAL SUPPLIER QUOTATIONS · Development preview with synthetic records only.
┌ rail 224 ───┬───────────────────────────────────────────────────────────────────────┐
│ ◆ FBG       │ top bar 56                              Demo Buyer Co.   🔔(planned)  (DB) │
│ ▌Overview   ├───────────────────────────────────────────────────────────────────────┤
│  Projects   │ Overview                                 Upload a quote  [+ New sourcing request] │
│  Quotes     │ Welcome back. 5 items need your attention across 4 sourcing projects.      │
│  Documents  │ As of 2026-11-07 · 4 factory-confirmed quotes · 3 awaiting your review · ⚠ 5 … │
│  Inbox  Planned                                                                       │
│             │ Needs your attention                                       Show all 5   │
│             │ ┌───────────────────────────────────────────────────────────────────┐ │
│             │ │ ✉ Approve clarification to Supplier B   Labels      [Review draft] Set aside │
│             │ │ 👁 Review 2 extracted quotes   Cartons · within 2 days [Review]  Set aside │
│             │ │ ✓ Confirm 3 inferred specification values  Hair     [Confirm]   Set aside │
│             │ └───────────────────────────────────────────────────────────────────┘ │
│             │ Your projects                                     View all 4 projects › │
│             │ ┌───────────────────────────────────────────────────────────────────┐ │
│             │ │ Custom BOPP roll labels   ▮▮▮▮▮░░ Comparison ready  Review comparison  11-06 ▾ │
│             │ │ Folding cartons           ▮▮▮▮░░░ Quotes in review  Confirm 2 quotes   11-05 ▾ │
│ (DB) Demo   │ │ Raw hair bundles          ▮░░░░░░ Brief draft       Confirm 3 values   11-03 ▾ │
│ ‹ Collapse  │ └───────────────────────────────────────────────────────────────────┘ │
└─────────────┴───────────────────────────────────────────────────────────────────────┘
```

Expanding a project row reveals Quantity · Quotes (confirmed, in review, expiring soon) · Operator · Destination · Brief, and the links that exist for that project (Open project, Comparison, Supplier options, Activity, or the brief step). Projects without a record say so instead of linking nowhere.

### 3.2 Phone (390 and 320)

```
▲ DEMO DATA — NOT REAL SUPPLIER QUOTATIONS
☰  ◆ Factory Bridge Global                 (DB)
Overview
Welcome back. 5 items need your attention …
4 factory-confirmed quotes · 3 awaiting … · ⚠ 5 …
Upload a quote   [+ New sourcing request]
Needs your attention                Show all 5
┌ ✉ Approve clarification to Supplier B ┐
│   Labels · [Review draft] Set aside    │ …
Your projects              View all 4 projects ›
┌ Custom BOPP roll labels, 50 × 76 mm  ▾ ┐
│ ▮▮▮▮▮░░ Comparison ready               │
│ Review comparison and shortlist        │
│ Updated 2026-11-06                     │ …
──────────────────────────────────────────
  Home       Projects      Inbox     Account
```

### 3.3 Responsive route map

| Width | Shell | Overview | Projects | Quotes |
|---|---|---|---|---|
| 320–767 | brand top bar, navigation sheet, four tabs, account bottom sheet | stacked header, 44 px primary button, rows with actions on their own line, disclosure rows | search + filters wrap, stacked rows | 2-column tiles, stacked rows |
| 768–1023 | rail beside content | header still stacked (title above actions), rows stacked | same | same |
| ≥ 1024 | rail, 56 px top bar, content max 1120 px | header in one row, three-column attention rows, five-column project rows | column headers, five-column rows | five tiles, four-column rows |

## 4. Implementation

### 4.1 Files

| File | Change |
|---|---|
| `apps/web/src/design-preview/nav.ts` (new) | Navigation model for all three workspaces, `activeNavItem`, `mobileTabs`, `navPath`. |
| `nav.test.ts` (new, 11 tests) | Exactly one active destination for every buyer route; anchors never share the active state; segment-aware prefix rule; triggers never active; four phone tabs per workspace; planned entries never carry a badge; linked buyer routes distinct and anchor-free. |
| `projects-demo.ts` (new) | `rankActions`, `splitActions`, `recentProjects`, `filterProjects`, `quoteStatusSummary`, `addDays`, `projectRoutes`, `PROJECT_TABS`, `parseProjectTab`. Deterministic, fixture-derived. |
| `projects-demo.test.ts` (new, 12 tests) | Ranking order and stability, three-plus-rest split loses nothing, recency order, search and stage filters, quote counts from records (4 confirmed, 3 in review, 3 expiring, 1 unconfirmed, 1 expired), date arithmetic, route mapping, tab parsing. |
| `theme-param.ts` (new) + `theme.test.ts` (new, 1 test) | `?theme=atlas|obsidian` parser. |
| `theme.tsx` | Applies the query override; keeps `html[data-fbg-theme]` in step on change; marks hydration and fixed scopes. |
| `app/design-preview/layout.tsx` | Pre-hydration script that sets `html[data-fbg-theme]` from the stored choice or `?theme=`, so a dark preference paints dark on the first frame. |
| `design-preview.css` | Tokens: `radius-control` 10→8, `radius-dialog` 20→16, `rail-w` 248→224 (+`rail-w-collapsed` 64), `control-h` 44→40 and `control-h-sm` 36→32 at md+ (44/36 kept on phones), `notice-h` 32, `notice-bg`; Obsidian `border-strong` #5b6873→#67747f (3.5:1), `bg-raised` #1c2530→#1d2733; `.fbg-demo-notice` replaces the stripe; `.fbg-nav-active` indicator; pre-paint theme selectors. |
| `ui/primitives.tsx` | `PageHeader` 26/28 px title, 15 px one-line lead, 13 px metadata, actions beside the title from lg; `Panel` 17 px title, divider-weight header border, optional `id`; `SectionTitle` 20/22 px; new `Section` (heading on the canvas, one card below); buttons 14 px / 13 px text with tighter padding. |
| `ui/AppShell.tsx` (rewrite) | Shell as in §2.3; `DemoStripe` kept as the export name with the new notice; `AppearanceSwitch`, `BrandMark` unchanged for the index, gallery, marketing and auth screens; workspace `lang` on the root preserved. |
| `ui/ProjectList.tsx` (new) | Shared project rows with `StageMeter` and the in-row disclosure. |
| `screens/BuyerDashboard.tsx` (rewrite) | Header, Needs your attention, Your projects. |
| `screens/BuyerProjects.tsx`, `app/design-preview/buyer/projects/page.tsx` (new) | Projects page. |
| `screens/BuyerQuotes.tsx`, `app/design-preview/buyer/quotes/page.tsx` (new) | Quotes landing: five status tiles, by-project rows, explicit statement of the missing cross-project list. |
| `screens/ProjectOverview.tsx` | `initialTab` prop; the inert upload button is now a link to the documents intake. `app/design-preview/buyer/project/page.tsx` reads `?tab=` server-side. |
| `screens/QuoteComparison.tsx` | One `All quotes` back link above the header. |
| `screens/BuyerDocuments.tsx` | `id="upload"` on the intake panel (anchor target). |
| `demo-data/index.ts` | `href` on `act_1` (documents) and `act_3` (project messages tab). No counts, stages or quote data changed. |
| `app/design-preview/page.tsx` | Overview entry rewritten; Projects and Quotes entries added. |

### 4.2 Design decisions worth recording

- The Appearance switch moved from the rail into the account sheet (brief §4 allows this; BRAND_DIRECTION_V1 §2 placed it in the rail). Storage key and theme values are unchanged.
- The sidebar order is Overview · Projects · Quotes · Documents · Inbox (planned last) instead of the IA document's Overview · Projects · Quotes · Messages · Documents, so live destinations sit together.
- Notification bell and organization label are honest: the bell is labelled planned with no count; the organization is a static label. The EN/中文 top-bar toggle is gone; the language is stated in the account sheet.
- `Set aside` replaced `Hide`. It is browser-only, says so, and keeps a `Restore` list; the `Show all N` count always equals the fixture count.
- Attention ranking is by who is blocked (approval requests, then unconfirmed data, then time-bound items, then drafts), documented in `projects-demo.ts` and tested.
- The demo notice is sticky on tablet and desktop, scrolls with the page on phones so the sticky header and the tab bar never stack three bars.

## 5. Validation

### 5.1 Commands actually run (observed results)

| Check | Command | Result |
|---|---|---|
| Baseline before any change | `pnpm check` on `main` `d4174fd` in the worktree | exit 0 |
| Unit tests, web | `pnpm --filter @fbg/web test` | 11 files, 90 passed (66 pre-existing + 24 new: nav 11, projects-demo 12, theme 1) |
| Typecheck | `pnpm --filter @fbg/web typecheck` | `next typegen` ok, `tsc --noEmit` 0 errors |
| Lint | `pnpm exec eslint apps/web/src --max-warnings 0` | 0 problems |
| Full check | `pnpm check` on the final tree | exit 0 — Prettier clean, typecheck and lint clean, Vitest: web 90, worker 12, eval 12, supabase 124 (PGlite) |
| Production build | `pnpm --filter @fbg/web build` | exit 0; `/design-preview/buyer/projects` and `/buyer/quotes` listed as dynamic routes |
| Production isolation | `NODE_ENV=production next start -p 3104` + curl | `/design-preview`, `/design-preview/buyer/dashboard`, `/buyer/projects`, `/buyer/quotes` → 404; `/` → 200 |

TDD: every helper in `nav.ts`, `projects-demo.ts` and `theme-param.ts` was written after its test failed (module missing or `projectRoutes is not a function`), then made green.

### 5.2 Browser checks (dev server on port 3103, Claude's browser pane)

Desktop (1024 px pane) and headless Edge 1366×768 / 1440×900, Atlas and Obsidian:

- `aria-current="page"`: rail `["Overview"]` on the dashboard, `["Projects"]` on `/buyer/projects`, `/buyer/project?tab=options` and `/buyer/new-request`, `["Quotes"]` on `/buyer/quotes` and `/buyer/compare`, `["Documents"]` on `/buyer/documents`. One `<h1>` per page. `scrollWidth − clientWidth = 0` everywhere.
- Exactly one primary-coloured action on the Overview (`New sourcing request`); no `<button>` without a handler, label or expanded state.
- Account sheet: opens from the avatar with focus on `Close`, `aria-expanded` true; `Escape` closes it and resets `aria-expanded`.
- Project row disclosure: `aria-expanded` toggles; details list quantity, quotes, operator, destination, brief and the four labels-project links.
- Set aside: first row moves, `Show all 5` shows four live rows plus the set-aside note; `Restore` returns it; toggle reads `Show fewer`.
- Projects: search `carton` → 2 rows; `Comparison ready` with that query → 0 rows and the empty state.
- Comparison: `All quotes` back link present; project record opens on the requested tab (`Supplier options`, `Activity`); `/buyer/documents#upload` scrolls to the intake panel (top 80 px).
- Obsidian via `?theme=obsidian`: `html[data-fbg-theme]` set before hydration, no pending transitions, link-buttons computed `#161e29` / `#f3f7f5`.

Phone (pane at 375×812 and 320×700): no horizontal overflow on Overview, Projects, Quotes, project record, Documents, Comparison, New request, supplier 工作台 and ops Work queue; tabs 57 px tall; primary button 44 px; `Home` the only current tab on the Overview, `Projects` on project-scoped screens, none on Quotes/Documents/Comparison (they are not tabs, per the IA); the `Account` tab opens a full-width bottom sheet with 36 px appearance options; the navigation sheet lists Inbox as planned and `Account and appearance`; supplier shell keeps `lang="zh-CN"` and its four tabs (工作台 · 询价单 · 报价 · 账户); ops tabs Queue · Projects · Reviews · Account.

Tablet (headless Edge 768×1024): header stacks above the actions and project rows stack beside the rail (a squeezed layout found in the first capture was fixed by moving those breakpoints from `md` to `lg`).

### 5.3 Screenshots

`docs/design/atlas-obsidian/screenshots/ux-03/` — `before/` (Overview on `main`, Atlas, 1440×900, 1366×768 and full page) and `after/` (Overview, Projects, Quotes and the project Supplier-options tab at 1440×900, 1366×768, 768×1024, 390×851 and 320×533 in Atlas and Obsidian as listed in the folder). Phone captures use Playwright device emulation through the installed Edge because headless Edge clamps window widths below about 500 px.

### 5.4 Acceptance criteria

| | Criterion | Status |
|---|---|---|
| A | ≤ 3 content regions near the fold at 1366×768 | Met: header, Needs your attention, Your projects (screenshot `after/overview-1366x768-atlas.png`). |
| B | Exactly one active sidebar item, incl. `#projects`, back/forward, refresh, phone tabs; tests | Met: `nav.ts` rule, 11 tests; browser values above. |
| C | One `<h1>`, one prominent CTA | Met. |
| D | Three highest-priority items by default, rest reachable, none lost | Met: `splitActions`, `Show all 5`, set-aside with restore. |
| E | No supplier list or audit history on the Overview; reachable elsewhere | Met: project tabs, deep links. |
| F | All links functional or visibly disabled with a truthful reason | Met on the shell, Overview, Projects, Quotes; see §6 for untouched screens. |
| G | No regression to evidence states, permissions language, quote categories, status semantics, price calculations | Met: fixtures, `compare-demo.ts` and all status labels unchanged; counts derived; 90 web tests green. |
| H | Screenshots at the five sizes in both themes | Met (§5.3); phone sizes are 390×851 and 320×533 device presets. |
| I | Keyboard, focus, 44 px targets, AA, text+icon statuses, no horizontal scroll | Met by construction and measurement: focus ring unchanged, `Escape` handling, 57 px tabs, 44 px phone controls, text+icon badges; contrast matrix unchanged except the dark `border-strong` fix. |
| J | `pnpm check`, build and production 404 | Met (§5.1). |

## 6. Known limitations

- Inbox, supplier 消息 and 产品目录 were wired after PR #15 merged (main merged into this branch); the Overview approval item opens `/buyer/messages?thread=th_tooling`.
- Untouched screens still contain pre-existing buttons with a `title` but no handler (project record `Edit wording`, `Download`; documents `Download`). They were out of scope for this pass and are noted for UX-04.
- Phone screenshots are device presets (393 and 320 px wide) rather than exactly 390×844 / 320×700; the pane measurements were taken at 375×812 and 320×700.
- The 180 ms colour transition still runs when the user switches theme in the sheet (intended); only the page-load flash was removed.
- No automated accessibility audit; manual checks only.
- `docs/STATUS.md` was not edited (outside this track's file scope); a one-line entry is proposed in §7.

## 7. Cross-track handoffs and coordination

- **PR #15 (other design session, Messages + supplier catalog):** agreed by message on 2026-11-08 — #15 merges first; this branch then merges `main`, keeps this shell, and wires `nav.ts`: buyer Inbox → `/design-preview/buyer/messages`, supplier 消息 → `/design-preview/supplier/messages`, 产品目录 → `/design-preview/supplier/catalog`, 文件资料 planned; `act_3` → `/design-preview/buyer/messages?thread=th_tooling`. That session owns the UX-04 conversation-first Messages change.
- **H-34 — cross-project quotes list (backend):** a true organization-wide quotations list needs an RLS-filtered query over `quotations` joined to projects with `visibility_scope` and `rights_class` respected (B-20/B-14). Until then the Quotes page states this and routes through projects.
- **H-35 — notifications:** the bell is planned; needs a notifications/work-items feed (B-15 projects, outbound approvals) before it can show a count.
- **H-36 — theme bootstrap for the production shell:** if H-14 promotes the tokens, carry the pre-paint `html[data-fbg-theme]` pattern (or a cookie) into the production layout instead of the inline script.
- **STATUS.md:** proposed line under UX — "UX-03 clarity pass: buyer Overview/Projects/Quotes and shell implemented in the design preview (local state, synthetic data); tested (`pnpm check`, build, production 404); not deployed."

## 8. Next (UX-04, same track)

Documents redesign, comparison presentation modes (Summary / Compare / Full details) and the marketing-preview refinement follow on a branch stacked on this one; Messages stays with PR #15's session.
