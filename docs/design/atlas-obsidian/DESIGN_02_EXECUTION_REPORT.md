# DESIGN-02 Execution Report — Atlas × Obsidian V1

**Date:** 2026-11-07 · **Track:** UX-01, continued as DESIGN-02 (same session, same worktree, same branch by founder instruction) · **Branch:** `design/ux-mobile-foundation` in worktree `C:\dev\wt-ux01` · **PR:** https://github.com/EminenceHairBoutique/Factory-Bridge-Global/pull/10 (open, updated by this commit)

## 1. Designed

- Atlas (light) and Obsidian (dark) semantic token dictionaries with independently chosen dark status colors, state tokens (focus, hover, pressed, selected, disabled, skeleton, overlay), chart series, shadows, geometry (6/10/12/20 px radii, 44/36 px controls, 248 px rail, 384 px drawer), 180 ms motion, and a contrast matrix computed by script (`DESIGN_TOKENS_V1.md`, `tokens.json`).
- Brand direction: positioning, principles, three emblem concepts (A chosen), tone, proposed copy with approval caveat (`BRAND_DIRECTION_V1.md`).
- Public-site sitemap and nine marketing pages, revised buyer sidebar, four-tab mobile IA, role journeys and device matrix (`INFORMATION_ARCHITECTURE.md`, `PAGE_BY_PAGE_BLUEPRINT.md`).
- Component inventory and interaction rules in both themes (`COMPONENTS_AND_INTERACTIONS.md`).
- PWA/native split, theme on mobile, touch and Dynamic Type rules, offline policy, backend dependencies (`MOBILE_PWA_NATIVE_HANDOFF.md`).
- Cross-track proposals H-14…H-23 (`INTEGRATION_HANDOFF.md`).

## 2. Implemented in preview (local state, synthetic data, no services)

| Route | What changed |
|---|---|
| `/design-preview` | index wrapped in the theme scope with an appearance switch; links to all six previews |
| `/design-preview/marketing` | **new** — Obsidian hero with CSS-only bridge figure, Atlas value pillars, process timeline with "who acts", pilot categories with Chinese gloss, evidence explanation, Obsidian closing CTA, responsive top bar with drawer |
| `/design-preview/buyer/dashboard` | token migration; sidebar order Overview · Projects · Quotes · Messages · Documents; four phone tabs |
| `/design-preview/buyer/new-request` | token migration; 44 px controls; wrapping action bar at 320 px |
| `/design-preview/buyer/compare` | view filter (All · Eligible only · Not ranked), specification-row toggle, compare-selected mode (per-column and per-card "Compare"), "What is missing" line and "Show details" disclosure on phone cards, export dialog with PDF/XLSX choice and the not-connected state, basis-not-stated demo quote (Supplier F) shown as Not ranked, Escape closes dialogs |
| `/design-preview/ops/quote-review` | token migration; sidebar Work queue · Projects · Research · Suppliers · Reviews · Cases · Admin |
| `/design-preview/gallery` | **new** — every primitive in Atlas and Obsidian side by side (or current theme), tokens swatches, buttons incl. disabled/loading, quote status tags, freshness and cost-line chips, evidence badge with scope, tabs, segmented control, form controls incl. error and Chinese text, stepper, notices, empty / loading / error states, ruled vs raised panels |

Shared components: `ThemeScope`/`useTheme`/`AppearanceSwitch` (per-device persistence with guarded storage), `BrandMark`, `Tabs`, `Skeleton`, `SkeletonRows`, `ErrorState`, `QuoteStatusTag`, `buttonClasses`, `useEscapeKey`.

## 3. Tests actually run (observed outcomes)

| Check | Command | Result |
|---|---|---|
| Format, typecheck, lint, unit tests (all packages) | `pnpm check` | exit 0 — Prettier clean; `tsc` 0 errors; ESLint 0 problems; Vitest 210 passed (web 11: gate ×4, comparison helper ×7 incl. new `basis_unknown` case) |
| Production build | `next build` | exit 0 |
| Production isolation | `next start` + `curl` | `/design-preview`, `/design-preview/gallery`, `/design-preview/marketing`, `/design-preview/buyer/compare` → 404; `/` → 200; marketing body contains no "DEMO DATA" string |
| Theme switch | browser | `data-theme` toggles atlas ↔ obsidian via the rail control; stored value persists across reload; computed canvas `#0D1118` / `#FAF8F4` |
| Widths | browser, `scrollWidth === clientWidth` | 320: marketing, dashboard, wizard, compare, ops, gallery ✓ (after fixing three overflows); 390: wizard, marketing ✓; 768: dashboard, gallery, compare ✓; 1024: compare ✓; 1440: all ✓ |
| Console | browser | no errors on any preview page in either theme |
| Interactions | browser | compare-selected mode shows exactly the two ticked quotes across their groups; export dialog opens, Generate disabled, file name rendered; dialogs close on Close and on Escape; appearance switch clickable via keyboard focus order |
| Contrast | script (WCAG relative luminance) | all text pairs ≥ 4.5:1 in both themes; dark `border-strong` 2.9:1 (target 3:1) recorded as a gap; disabled text exempt |

Screenshots were produced in the browser pane during the session (desktop Atlas/Obsidian comparison, Obsidian marketing hero, gallery, 320 px comparison, 390 px marketing); they are not committed.

## 4. Not integrated

- Production shell, `globals.css`, root layout, `/` home page, fonts self-hosting, user-level theme persistence (H-14…H-17).
- Global Quotes and Documents views (need RLS-filtered cross-project queries).
- Supplier zh-CN screens (specified only). Marketing pages other than Home (specified only).
- Export generation, FX service, quote engine (B-23, B-21, B-14).

## 5. Future native scope

Per `MOBILE_PWA_NATIVE_HANDOFF.md`: Expo app after B-05/B-10/B-11/B-14 and a founder decision on store accounts; `tokens.json` is the theme exchange format; PWA manifest and shell-only service worker proposed as D-04.

## 6. Cross-track dependencies

H-14 (token promotion), H-16 (fonts), H-18 (navigation), H-19 (comparison DTO and export contract), H-20 (i18n keys), H-22/H-23 (backlog and CI). None applied by this track.

## 6a. Session 3 — Supplier zh-CN screens (2026-11-07, same branch, commit after b8f5ed8)

**Implemented in preview:** `AppShell` supplier workspace (zh-CN chrome, `lang="zh-CN"`, four phone tabs 工作台 · 询价单 · 报价 · 账户); `/design-preview/supplier/dashboard` (工作台), `/pricing` (阶梯报价 editor with shared `TierTable`), `/rfqs` (询价单 inbox + 提交报价 form + clarification and decline flows), `/sharing` (数据共享设置 with grant revocation dialog); `demo-data/supplier.ts`; `supplier-demo.ts` validation and zh-CN formatting with 12 tests; index entries. Details in `SUPPLIER_ZH_CN_SCREENS.md`.

**Tests actually run:** `pnpm check` exit 0 (format, typecheck, lint, Vitest 222 tests: web 23); `next build` exit 0; production `next start`: all four supplier routes → 404, `/` → 200. Browser: Noto Sans SC confirmed loaded (`document.fonts.check`), no console errors on any supplier page in Atlas or Obsidian; no horizontal overflow at 320, 375 and 768 px on all four screens (after bounding the grants table inside its panel); interactions verified — tier overlap blocks 确认有效 and shows the inline message, basis + place + validity enable it; the quote gate lists 2 missing items, completing them enables submit, submission sets 已报价; 撤销授权 opens the effects dialog and marks the grant 已撤销; Escape closes dialogs.

**Not integrated:** 企业资料, 产品目录 / 批量导入, 文件与消息, 账户 (navigation only); EN toggle visual; no upload, scan or audit writes.

**Cross-track:** H-24 (zh-CN catalog keys), H-25 (supplier DTOs and quote submission contract), H-26 (validation parity with B-14 / B-18).

## 6b. Session 4 — Brief confirmation (2026-11-07, same branch)

**Implemented in preview:** `/design-preview/buyer/brief` (`BriefConfirmation.tsx`, `demo-data/brief.ts`): raw input with highlighted source snippets, AI proposal with per-field provenance and Chinese translation, per-field Accept / Edit / Provide / Not sure / Skip, progress notice, versioned confirm (v1 raw, v2 proposal, v3 confirmed; editing after confirmation opens a draft v4), "Request supplier options" blocked while a required attribute is "Not sure". Dashboard action and project row now link to it; index entry added. Details in `BRIEF_CONFIRMATION_SCREEN.md`.

**Tests actually run:** `pnpm check` exit 0 (format, typecheck, lint, Vitest 222); `next build` exit 0; production `next start`: `/design-preview/buyer/brief` → 404. Browser: 9 snippet marks; "9 of 15 values decided" with confirm disabled on load; accept / not sure / skip / provide → 15 of 15 and confirm enabled; confirm adds "Confirmed by you" v3 and the v3 notice; request button disabled with tooltip naming "Weight per bundle"; "Provide a value" after confirmation reopens a draft; no console errors; no horizontal overflow at 320 and 375 px.

**Cross-track:** H-27 (`brief_spec_v1` output and brief-version write contract).

## 6c. Session 5 — Supplier onboarding (2026-11-07, same branch)

**Implemented in preview:** `/design-preview/supplier/onboarding` (`SupplierOnboarding.tsx`, onboarding data in `demo-data/supplier.ts`, validators in `supplier-demo.ts` with 2 new test groups): five-step 企业认证 (企业信息, 授权代表, 资质文件, 贸易能力, 确认提交), opening in the 需补充 state that 工作台 shows, with a blank first-run path; 统一社会信用代码 check-digit validation (GB 32100-2015), mobile and email format checks, contact-basis confirmation for WeChat handles, per-document statuses and the 供应商提供，未核验 label, certificate caveat, consent gate, submitted state. 企业资料 sidebar entry and the 工作台 "上传生产场地证明" action link to it; index entry. Details in `SUPPLIER_ONBOARDING_SCREEN.md`.

**Tests actually run:** `pnpm check` exit 0 (format, typecheck, lint, Vitest 224: web 25); `next build` exit 0; production `next start`: `/design-preview/supplier/onboarding` → 404. Browser: resume state opens on step 3, 下一步 blocked until the premises file is added, added file labelled 供应商提供，未核验, steps 4–5 reachable, 提交补充材料 enabled and the submitted state shown; first-run path shows field errors on empty submit, rejects a wrong check digit, accepts the valid demo code; no console errors; no horizontal overflow at 320 / 375 / 768 px in Obsidian. A stale dev-server module graph produced a 500 on first load that disappeared after a restart; not a code defect.

**Cross-track:** H-28 (onboarding submission and verification-check contract).

## 7. Unresolved items

- Dark `border-strong` contrast (H-21).
- Tabs roving-focus keyboard behaviour (noted in components doc).
- No automated accessibility audit; manual checks only.
- Copy approval for every marketing string (OQ-02, OQ-04, PRD §7).
- `apps/web/AGENTS.md` generated by `next dev` remains untracked (scaffold owner's call).
