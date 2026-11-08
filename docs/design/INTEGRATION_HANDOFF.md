# Integration Handoff — Track UX-01 → engineering tracks

This track changed nothing outside `apps/web/src/design-preview/`, `apps/web/src/app/design-preview/` and `docs/design/`. Everything below is a **proposal** for the owning tracks; nothing here has been applied to shared files.

## 1. Files added (all new, no shared file edited)

```
apps/web/src/app/design-preview/layout.tsx           # gate + noindex + font links
apps/web/src/app/design-preview/page.tsx             # index of prototypes
apps/web/src/app/design-preview/buyer/{dashboard,new-request,compare}/page.tsx
apps/web/src/app/design-preview/ops/quote-review/page.tsx
apps/web/src/design-preview/gate.ts (+ gate.test.ts)
apps/web/src/design-preview/design-preview.css
apps/web/src/design-preview/compare-demo.ts (+ compare-demo.test.ts)
apps/web/src/design-preview/demo-data/index.ts
apps/web/src/design-preview/ui/{icons,primitives,AppShell}.tsx
apps/web/src/design-preview/screens/{BuyerDashboard,NewRequestWizard,QuoteComparison,OpsQuoteReview}.tsx
docs/design/*.md
```

No package manifest, lockfile, migration, policy, worker, AI or auth file was touched. `apps/web/src/app/globals.css` and `layout.tsx` are unchanged; the design preview imports the existing theme tokens.

## 2. Proposed cross-track changes (for the owning sessions to accept or reject)

| # | Proposal | Owner | Rationale |
|---|---|---|---|
| H-1 | Promote `design-preview/ui/{primitives,icons,AppShell}.tsx` to `apps/web/src/components/ui/` and `components/shell/` when B-05 (auth + shells) lands; keep `AppShell` props but source nav from route config and real org data. | B-05 | Avoids a second component library; the primitives already follow IA §3/§4. |
| H-2 | Self-host Inter + Noto Sans SC (`next/font/local` or static files) in the root layout; remove the Google Fonts `<link>` from the preview layout at that point. | B-05 | Offline builds, no third-party request on production pages. |
| H-3 | Add `warn` text token: `--color-warn-text: #8F5E12` (5.6:1 on surface) and keep `#B7791F` for borders/tints. | Founder / design | `#B7791F` as text measures 3.4–3.6:1 (below AA). Palette change needs sign-off; the preview pairs every warn with an icon meanwhile. |
| H-4 | `@fbg/i18n`: add keys the screens needed beyond the fixed badge set: `freshness.observed/updated/confirmed/valid_until/expired`, `compare.lowest_comparable_goods_cost`, `compare.lowest_estimated_landed_cost`, `compare.partial_excludes`, `compare.cross_group_unavailable`, `review.not_in_document`, `review.cannot_accept_missing`, `nav.*` for both workspaces, plus zh-CN equivalents. | i18n owner | Prototype strings are inline English; the supplier screens need the same keys in zh-CN. |
| H-5 | B-14 quote engine output should carry everything the comparison UI renders: per-quote `exclusion` (code + params), `flags`, selected tier, original and converted amounts with `fxRateRef`, `landedLines[{type,status,amount,source}]`, `landedComplete`, `missingLines`, `estimatedLines`, per-group `lowestComparableId`, and a top-level `landedRanking | null` with `blockedBy`. `compare-demo.ts` shows the shape; replace it, do not extend it. | B-14 / B-22 | The UI should never recompute money. |
| H-6 | B-15 wizard: attribute fields from `attribute_definitions` (0004) with `label_zh`; blocked categories from taxonomy `compliance_state`; keep the five-step order and the review-step missing-field list (AC-B1.1). | B-15, B-27 | The prototype's in-file lists are placeholders. |
| H-7 | B-17: implement §3.2 of `SCREEN_INVENTORY_AND_SPECS.md` (three-column raw / proposal / confirmed with from_input / inferred / missing tags). | B-17 | |
| H-8 | B-20: adopt the review-split layout; anchors become `{page, bbox}` / `{sheet, cell}` from B-12; corrections table = `human_corrections`; the accept gate is exactly AC-B3.4; keep "Mark basis unknown" as a first-class action for colloquial terms (ADR-025). | B-20 | |
| H-9 | B-24: the clarification modal's approval chain copy ("sent only after you approve and an operator approves") and the disabled Send button are the intended UX for AC-B6.1. | B-24 | |
| H-10 | Environment: document `DESIGN_PREVIEW=enabled` in `.env.example` as a non-production-only flag (the gate ignores it when `APP_ENV` is production or unset). | B-29 | So a staging preview can show the prototypes without any code change. |
| H-11 | `docs/STATUS.md`: add a "Design track UX-01" row: prototypes implemented and browser-checked, nothing deployed, no real data. | STATUS owner | This track does not edit STATUS.md directly. |
| H-12 | Backlog: consider a `D-01` item "supplier zh-CN screens (工作台, 价格梯度, 询价单) prototypes" and `D-02` "dark mode token audit". | BACKLOG owner | Next design session scope. |
| H-13 | Playwright (B-05+): the four preview routes are good smoke targets in dev (`NODE_ENV=test`); add an assertion that `/design-preview` 404s in the production build job. | B-02 / B-05 | Keeps the isolation guarantee under CI. |

## 3. Contracts the UI assumes (for API/DTO design)

- Quote DTO fields used: `quote_type`, `price_basis`, `basis_place`, `basis_confirmed`, `currency`, `unit`, `moq`, `tiers[{min_qty,max_qty,unit_price}]`, `fees[{type,amount,included_in_unit_price}]`, `lead_time_days`, `payment_terms`, `valid_until | null`, `confirmed_at`, `observed_at`, `source_type`, `source_ref`, `spec{}`, `evidence[{label,what,who,when,until}]`.
- Evidence badge label text is produced server-side from check rows (e.g. "Identity reviewed (2026-10-20)"); the UI never composes it.
- Contacts are never present in buyer DTOs (`supplier_public_profile_v`).
- Review task DTO: `fields[{key,label,value|null,confidence,anchor|null,flag?}]`.

## 4. Running the prototypes

```
pnpm --filter @fbg/web dev        # then open http://localhost:3000/design-preview
pnpm --filter @fbg/web test       # gate + comparison helper tests
```

Production builds return 404 for every `/design-preview` route unless `APP_ENV` is a non-production name **and** `DESIGN_PREVIEW=enabled`.

## 5. Known limitations

- Locale toggle is visual; supplier (zh-CN) screens are specified, not built.
- Export report, organization switcher, notifications and "Planned" nav rows are inert.
- `compare-demo.ts` uses floating-point numbers; acceptable for a display prototype with demo data, not for the engine.
- `warn` text contrast below AA (H-3).
- No automated accessibility audit yet; keyboard focus and semantics were checked manually in the browser.

## 6. Note for the scaffold owner

`next dev` (Next.js 16) writes `apps/web/AGENTS.md` into the working tree on every start. This track left it untracked. The scaffold owner (B-01/B-02) should decide whether to commit it or add it to `.gitignore`; the design branch does not include it.
