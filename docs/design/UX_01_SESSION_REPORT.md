## Session report — 2026-11-07

Phase: 1 (parallel design track) | Slice: UX-01 UI/UX foundation + mobile readiness

**Implemented:**
- Design-preview segment at `/design-preview` with a production isolation gate (`isDesignPreviewEnabled`), `noindex` metadata, runtime font loading.
- Design primitives and application shell (navy rail, top bar, phone tab bar and navigation sheet, evidence-drawer slot, demo stripe).
- Four interactive prototypes with local state and synthetic data: Buyer dashboard, New sourcing request (5-step wizard), Supplier quotation comparison, Operations quotation review (concept).
- Display-only comparison helper mirroring QUOTE_ENGINE_SPEC §2 rules (tier [min,max), MOQ, hard/soft spec match, basis grouping, FX display, landed-line status, complete-only cross-group ranking).
- Eight design documents in `docs/design/`.

**Tested:**
- `pnpm check` (format:check → typecheck → lint → test, all packages) exit 0 on 2026-11-07: Prettier clean; `tsc` 0 errors; ESLint 0 problems; Vitest 209 tests passed (i18n 4, domain 50, ai 48, web 10 — 4 gate + 6 comparison helper —, worker 12, eval 12, supabase 73 on PGlite).
- `next build` (production) exit 0.
- Production isolation, measured with `next start` on the production build and `curl`: `/design-preview` → 404, `/design-preview/buyer/compare` → 404, `/` → 200, `/api/health` → 200; `/design-preview` body contains no "DEMO DATA" string. With `APP_ENV=staging DESIGN_PREVIEW=enabled` → 200. With `APP_ENV=production DESIGN_PREVIEW=enabled` → 404.
- Browser checks (built-in browser, `next dev` on port 3100): all four screens render with zero console errors at 1440 px, 768 px (tablet) and 375 px (phone); `document.scrollWidth === clientWidth` on every screen at 375 px and 768 px after fixing three overflow defects found during the check (wizard stepper, panel action slot, dashboard action rows); keyboard focus ring visible (2 px copper outline, `:focus-visible` true) on the locale toggle after tabbing; comparison interaction verified end to end (forwarder estimate applied → duties still missing → total partial; duty rate + source entered → cross-group ranking shows Supplier A at $802.46 for 10,000 pcs); review-screen anchor highlight and accept gate verified (basis marked unknown → Accept enabled, correction recorded).
- Contrast ratios computed for every text token pair (see `DESIGN_SYSTEM.md` §1.1); `warn` text fails AA at 3.4–3.6:1 and is flagged in the handoff.

**Deployed:** nothing. No preview deployment, no Vercel project, no paid account.

**Partial:**
- Locale toggle is visual only; supplier (zh-CN) screens are specified (`SCREEN_INVENTORY_AND_SPECS.md` §4), not built.
- Operations screen is a design concept with working interactions, not the B-20 implementation (document pane is a synthetic rendering).
- Export report, organization switcher, notification bell and "Planned" nav rows are inert.
- No automated accessibility audit; manual keyboard and semantics checks only.

**Blocked:** none for this track. Native app work is gated on B-05, B-10/B-11, B-14 and a founder decision on store accounts (see `MOBILE_READY_ARCHITECTURE.md` §12).

**Planned (next design session):** supplier zh-CN prototypes (工作台, 价格梯度 editor, 询价单); brief & spec confirmation screen (§3.2); dark-mode token audit; Playwright smoke tests once B-05 provides the harness.

**Changes:** new files only — `apps/web/src/app/design-preview/**`, `apps/web/src/design-preview/**`, `docs/design/*.md`. No migrations. No shared file, manifest, lockfile, policy, worker, AI, auth or status document edited. Branch `design/ux-mobile-foundation` from `origin/main` (b40cf09) in worktree `C:\dev\wt-ux01`.

**Security review:**
- Tenant isolation: prototypes read no data; every demo record is a constant. Contacts are rendered as "hidden, no disclosure grant" to model the permission matrix; no contact field exists in the demo DTOs.
- Secrets: none added; no environment values read except `NODE_ENV`, `APP_ENV`, `DESIGN_PREVIEW` for the gate.
- Untrusted input: wizard file input keeps only name/size/type in memory; nothing is uploaded or persisted; reference links are stored as strings and rendered as text, not as anchors.
- Idempotency / side effects: no network calls, no storage writes; the only "send" button in the prototypes is disabled by design (AC-B6.1).
- Production exposure: gate tested in both directions on a real production build; pages carry `robots: noindex`.
- Supply chain: no dependency added; icons are inline SVG; fonts load at runtime from Google Fonts on preview pages only (handoff H-2 proposes self-hosting before any production shell).

**Assumptions:**
- The IA §4 palette and Inter + Noto Sans SC are the intended identity; adopted unchanged, with one documented contrast refinement proposed (H-3).
- Pilot families (labels, folding cartons, hair bundles) are the wizard's category set; blocked categories shown from CLAUDE.md §4.
- Worked-example numbers from QUOTE_ENGINE_SPEC §3 are acceptable synthetic data when labelled demo.
- `APP_ENV` (already used by `/api/health`) is the environment name the deployment track will set.

**Budget implications:** none. No paid services, no API calls, no deployments.

**Founder actions required:**
1. Review the prototypes locally (`pnpm --filter @fbg/web dev`, open `/design-preview`) and the PR.
2. Decide on handoff H-3 (darker amber for warning text) — a palette change.
3. Confirm the next design session scope (supplier zh-CN screens first, or brief confirmation screen first).

**Next task:** open the PR for `design/ux-mobile-foundation`; after review, the owning tracks pick up handoff items H-1…H-13; design track continues with the supplier zh-CN prototypes.
