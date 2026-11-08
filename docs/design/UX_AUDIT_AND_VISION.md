# UX Audit and Vision — Track UX-01

**Status:** design track, session 1 (2026-11-07). Prototypes implemented under `apps/web/src/design-preview/`; nothing deployed. All screen data is synthetic and labelled **DEMO DATA — NOT REAL SUPPLIER QUOTATIONS**.

## 1. What existed before this track

| Area | State found on `origin/main` (b40cf09) |
|---|---|
| Public site | One informational landing page (`apps/web/src/app/page.tsx`) using the approved copy set. |
| Buyer / supplier / ops workspaces | No screens. Routes, templates and vocabulary are specified in `docs/UX_INFORMATION_ARCHITECTURE.md`. |
| Visual tokens | Ten color tokens and a font stack declared in `apps/web/src/app/globals.css` (Tailwind v4 `@theme`). Not yet exercised by any component. |
| Component library | None. No icon dependency, no headless UI dependency. |
| i18n | `@fbg/i18n` with 22 fixed badge / status strings in `en-US` and `zh-CN`. |
| Domain vocabulary | `@fbg/domain` enums (quote types, price bases, review statuses, cost-line statuses, …). |
| Backend | Migrations 0001–0005, RLS harness, AI adapter, eval harness — owned by other tracks and untouched here. |

The foundation is unusually well specified for a Phase 1 project: the IA already names every route, every page template and the exact status vocabulary. The gap was purely visual and interactive: no one had yet shown what "evidence-based" looks like on a screen.

## 2. Product truths the UI must express

These come straight from `CLAUDE.md` §4, the master spec §15 and the IA §1. They are design constraints, not slogans.

1. **Every number has provenance.** Price → quote type, basis, currency, tier, confirmed date, validity, source document. Converted value → FX rate, source, date. Cost line → sourced / estimated / missing.
2. **Unknown is never a default.** Missing Incoterm is `unknown`; a null `valid_until` is "validity unconfirmed", never "valid forever".
3. **Comparison is grouped before it is ranked.** Same spec, same trade term and place. Cross-group ranking only when every normalising line is present.
4. **Verification is a record, not a badge.** Badge text is generated from completed check rows; the popover shows what, who, when, until. No record → no badge.
5. **Humans approve side effects.** Outbound messages, "verified" status, supplier selection, handoff, money. Send buttons stay disabled until approvals exist.
6. **Confidential by default.** Contacts hidden unless a disclosure grant exists; internal research clearly banded.
7. **No claims without substantiation.** No counters, no savings figures, no "verified factory" without the linked check.

## 3. Vision

Factory Bridge Global should feel like a **procurement ledger with a conscience**: calm, dense where density helps, and always able to answer "where did this come from?" in one click. The visual reference is modern financial-operations software, not a marketplace. The emotional target for a buyer is *relief*: the system has already done the comparability work and is honest about what it does not know.

### Design principles (applied in the prototypes)

| Principle | How it shows up |
|---|---|
| Provenance over decoration | Freshness chips and source references sit next to every price. Cards and panels are ruled, not shadowed. |
| One accent, one job | Copper is used only for primary actions and the active mobile tab. Teal is reserved for data provenance ("sourced", confirmed). Status colors always pair with text and an icon. |
| Structure encodes meaning | Group headers in the comparison are the comparability groups themselves. Borders separate what must not be compared; a double-red rule marks a missing line, a dashed amber rule an estimate. |
| Say what is missing | Partial totals read "Partial — excludes: freight, duties". Empty states tell the user the next action. |
| Keep the argument on screen | The comparison page opens with a short, plain-language explanation of why EXW and FOB are not ranked together, and the controls that would change that sit beside it. |
| Mobile is a first-class reader, desktop is the editor | Phones get the bottom tab bar, stacked cards and a swipeable quote carousel; dense matrix editing and extraction review stay desktop-first. |

## 4. Audit of the proposed visual system

The IA §4 palette (ink navy, warm paper, copper, teal) was adopted without change. One documented refinement: **tints are derived with opacity modifiers** (`bg-teal/10`, `border-warn/40`) rather than adding new tokens, which keeps the shared `globals.css` untouched and makes dark-mode work a token swap later.

Reviewed against common generated-dashboard tells, the prototypes deliberately avoid:

- KPI tiles with invented totals (quote counts on the dashboard are derived from the demo records);
- uniform rounded-card grids and drop shadows (ruled panels, 6 px radius, no shadow);
- tracked-out all-caps eyebrow labels and decorative numbering (numbers appear only on the wizard stepper, which is a real sequence);
- gradient washes, hero stats, star ratings, logo walls, countdowns, strike-through prices (all banned by IA §1).

## 5. What this session delivered

| Deliverable | Location |
|---|---|
| Isolation gate with unit tests | `apps/web/src/design-preview/gate.ts`, `gate.test.ts` |
| Design primitives (buttons, badges, freshness chip, status chip, evidence popover, fields, stepper, segmented control, notices, panels) | `apps/web/src/design-preview/ui/primitives.tsx`, `icons.tsx` |
| Application shell (navy rail, top bar, mobile tab bar, "More" sheet, evidence drawer slot) | `apps/web/src/design-preview/ui/AppShell.tsx` |
| Buyer dashboard | `/design-preview/buyer/dashboard` |
| New sourcing request wizard (5 steps, validation, local autosave, local-only file list, compliance-hold categories, submit gate) | `/design-preview/buyer/new-request` |
| Quote comparison (basis groups, tier selection, FX display, landed-cost line status, forwarder estimate + duty assumption interaction, evidence drawer, clarification approval flow) | `/design-preview/buyer/compare` |
| Operations quotation review concept (queue, split view, anchors, confidence bands, corrections, accept gate) | `/design-preview/ops/quote-review` |
| Display-only comparison helper mirroring QUOTE_ENGINE_SPEC §2, with tests | `apps/web/src/design-preview/compare-demo.ts`, `compare-demo.test.ts` |
| Documentation | this directory |

## 6. What is deliberately not done

- No supplier (zh-CN) screens are built; they are specified in `SCREEN_INVENTORY_AND_SPECS.md` §4 for the next design session.
- No dark mode. Tokens are structured so it is a swap, but every token pair must be re-verified for contrast first.
- No real data, API, auth, upload or database access. The locale toggle in the top bar is visual only.
- No `apps/mobile`, no Expo. See `MOBILE_READY_ARCHITECTURE.md`.
