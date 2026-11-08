# Components and Interactions — Atlas × Obsidian V1

**Crosswalk:** component API and rules were first recorded in `docs/design/DESIGN_SYSTEM.md` §2–§4. This document is the current inventory after the Atlas × Obsidian refinement; where the two differ, this one wins. Implementation: `apps/web/src/design-preview/ui/{primitives,icons,AppShell}.tsx` and `theme.tsx`. Live reference: `/design-preview/gallery` (both themes side by side).

## 1. Inventory

| Component | Variants / states | Accessibility | Theme behaviour |
|---|---|---|---|
| `Button` | primary, secondary, ghost, danger, brand; sm 36 / md 44 / lg 48 px; disabled, loading (`aria-busy`, spinner) | native button, `type="button"` default, reason in `title` when disabled | all colors from tokens; brand variant uses inverse text |
| `buttonClasses()` | same variants for `<Link>` | | |
| `Badge` | tones neutral, teal, ok, warn, danger, ink, brand; optional icon | text + icon always | fills from `*-fill` |
| `QuoteStatusTag` | indicative listing, supplier catalog price, factory-confirmed quote, quote expired, validity unconfirmed, internal research reference | fixed terminology from IA §4 | |
| `FreshnessChip` | observed, updated, confirmed, valid until, expired | date always shown | |
| `StatusChip` | sourced, estimated, missing, not applicable | strings from `@fbg/i18n` | border-style markers in tables |
| `EvidenceBadge` | popover with what / who / when / until / scope / note | `<details>`; keyboard and no-JS | raised surface |
| `Panel` | title, description, actions, padded, raised | `<section>` with `<h2>` | ruled in both themes; raised adds theme shadow |
| `PageHeader`, `SectionTitle` | title scale 36/28 and 26/22 | single `<h1>` per page | |
| `KeyValue` | 1–3 columns | `<dl>` | |
| `EmptyState`, `ErrorState` | icon, title, body, action | `ErrorState` has `role="alert"` | |
| `Skeleton`, `SkeletonRows` | shimmer | `role="status"`, static under reduced motion | |
| `Tabs` | counts, horizontal scroll when overflowing | `role="tablist"`/`tab`, `aria-selected` | action-colored underline |
| `SegmentedControl` | sm/md | `role="radiogroup"`/`radio`, `aria-checked` | inverse fill for the active segment |
| `Field` + `TextInput`, `TextArea`, `Select` | required / optional label, hint, error | `aria-invalid`, `*-error`/`*-hint` ids | 44 px, 10 px radius, strong border |
| `Checkbox` (card style) | checked, disabled | native input inside label | selected fill |
| `Stepper` | current, completed, unreachable | `aria-current="step"`, disabled future steps | |
| `Notice` | tones; title, body, action | `role="alert"` for danger | |
| `AppShell` | buyer / ops; rail collapsed; sheet; evidence drawer slot | landmarks: `aside`, `nav` (labelled), `header`, `main`; `aria-current="page"` | rail stays navy in both themes |
| `AppearanceSwitch` | Atlas / Obsidian / System | radiogroup | persists per device |
| `DemoStripe` | — | `role="status"` | warning tint |
| `BrandMark` | 16–32 px | decorative | currentColor |
| `Icon` | 31 glyphs | hidden unless `label` | |

## 2. Interaction rules

1. **Side effects need an approval chain.** Send, confirm, select and hand off are disabled until the chain is complete, and the disabled control explains why in text (dialog copy or `title`).
2. **Evidence opens in place.** Badge → popover; column header → drawer. Never a new page for evidence.
3. **Comparison controls are reversible.** View filter, specification-row toggle and compare-selected mode never discard state; Clear returns to the full view.
4. **Dialogs** use the 20 px radius, the raised surface, a scrim button labelled Close, and stack from the bottom on phones.
5. **Forms** validate on Continue, keep errors next to the field with an icon, and list all blocking fields again on the review step.
6. **Motion** is 180 ms on color, border and opacity only; the details disclosure rotates its chevron; nothing else animates.
7. **Theme switch** applies instantly; the first paint is always Atlas so server and client markup match, then the stored choice applies.

## 3. Tables

- 14 px text, 16 × 8–12 px cells, sticky first column for row labels, `scope`d headers, section rows as `rowgroup` headers.
- Selected column tinted with `selected`; excluded columns at 80 % opacity with the reason under the supplier name.
- Wide tables scroll inside their panel; the page never scrolls sideways.
- Sorting (ops tables, future): header buttons with `aria-sort`, filter bar sticky under the top bar.

## 4. Evidence drawer

Width 384 px on ≥ 1280 px; otherwise a panel under the content. Sections: verification checks (what/who/when/until/scope), "Not verified" line, source document with observed/confirmed dates, contact details lock line, Request clarification. Contacts are never present in buyer DTOs; the lock line is informational.

## 5. Known gaps

- No automated axe run; manual checks only (focus, roles, overflow).
- Dark `border-strong` is 2.9:1 against surface (target 3:1) — tracked in `DESIGN_TOKENS_V1.md` §2.
- Tabs lack arrow-key roving focus (keyboard users tab through each tab); add in the promotion to `components/ui`.
