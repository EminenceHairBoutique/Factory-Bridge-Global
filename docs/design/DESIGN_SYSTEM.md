# Design System — Factory Bridge Global

**Scope:** tokens, type, spacing, components and accessibility rules used by the UX-01 prototypes. Source of the color tokens is `apps/web/src/app/globals.css` (shared, untouched by this track); everything else lives in `apps/web/src/design-preview/` until the owning tracks adopt it (see `INTEGRATION_HANDOFF.md`).

## 1. Tokens

### 1.1 Color (from IA §4, unchanged)

| Token | Hex | Role | Contrast (WCAG 2.x, computed 2026-11-07) |
|---|---|---|---|
| `ink` | `#0F1B2D` | primary text, rail background, active segment | on paper 16.3:1, on surface 17.3:1; white on ink 17.3:1 |
| `slate` | `#3A4A5E` | secondary text | on paper 8.5:1, on surface 9.0:1 |
| `paper` | `#FAF8F4` | app background | — |
| `surface` | `#FFFFFF` | panels, tables, inputs | — |
| `line` | `#E4E1DA` | borders, dividers, inactive progress | decorative only |
| `accent` (copper) | `#B3613A` | primary buttons, links, active mobile tab, focus ring | white on accent 4.5:1 (AA normal text, at the threshold); accent text on surface 4.5:1 |
| `teal` | `#1F6F78` | provenance: sourced lines, confirmed, selected column tint | on surface 5.8:1 |
| `ok` | `#2E7D4F` | pass / identity reviewed | on surface 5.0:1 |
| `warn` | `#B7791F` | estimated / validity unconfirmed / compliance hold | on surface 3.6:1, on paper 3.4:1 → **below AA for normal text**; always paired with an icon; handoff proposes a darker amber (see §4) |
| `danger` | `#A33A2E` | missing / expired / mismatch | on surface 6.6:1 |

Tints are derived with opacity modifiers rather than extra tokens: `bg-teal/10`, `bg-warn/10`, `border-danger/30`, `bg-ink/5`, `bg-white/12` (rail hover). Never introduce a second accent.

### 1.2 Typography

| Role | Face | Size / line | Weight | Notes |
|---|---|---|---|---|
| Body | Inter (EN) · Noto Sans SC (ZH, via `lang="zh-CN"` or `.fbg-zh`) | 14 / 21 | 400 | `font-feature-settings: "tnum"` globally |
| Dense UI (tables, chips, hints) | same | 12–13 / 16–18 | 400–500 | |
| Panel title | same | 15 / 20 | 600 | |
| Page title | same | 24 / 30, tracking −0.01em | 600 | |
| Key figures | same | 15 / 20 | 600, `.fbg-num` | tabular lining numerals |

Fonts are loaded at runtime from Google Fonts in the design-preview layout only, so builds stay offline-safe. The production shell should self-host both families (handoff item).

### 1.3 Space, radius, elevation, motion

- Spacing scale: Tailwind defaults; panel padding 16 px; table cell 16 × 8–12 px; page gutter 16 px (phone) / 24 px / 32 px.
- Radius: 6 px (`rounded-md`) for panels, buttons, inputs; 4 px for chips.
- Elevation: none. Panels and tables are ruled with `line`. The only shadow is on popovers (`shadow-sm`).
- Motion: 150 ms color/border transitions on interactive elements; nothing decorative; `prefers-reduced-motion` zeroes all durations.

## 2. Components (`apps/web/src/design-preview/ui/`)

| Component | Props (essentials) | Rules |
|---|---|---|
| `Button` | `variant: primary \| secondary \| ghost \| danger`, `size: sm \| md`, `icon`, `iconRight`, native button props | One primary per view region. `type="button"` by default. Disabled state keeps the label and gets a `title` explaining why when the reason is not visible on screen. |
| `Badge` | `tone: neutral \| teal \| ok \| warn \| danger \| ink`, `icon` | Tone icons are automatic (check / alert); pass `icon={null}` only for pure counts. |
| `FreshnessChip` | `kind: observed \| updated \| confirmed \| valid_until \| expired`, `date` | Always shows the date. `expired` is danger. |
| `StatusChip` | `status: sourced \| estimated \| missing \| not_applicable` | Labels are the fixed `status.*` strings from `@fbg/i18n`. |
| `EvidenceBadge` | `label`, `tone`, `evidence { what, who, when, until?, note? }` | `<details>`-based popover; works without JS and with the keyboard. Label text is generated from the check record, never typed. |
| `Panel` | `title`, `description`, `actions`, `padded` | Header is a flex-wrap row; actions shrink before the title wraps. |
| `PageHeader` | `title`, `lead`, `meta`, `actions` | Meta chips are the place for brief version, as-of date, FX reference. |
| `KeyValue` | `items[]`, `columns` | Definition list for record summaries. |
| `EmptyState` | `title`, `body`, `action` | Explains the next action; never decorative. |
| `Field` / `TextInput` / `TextArea` / `Select` / `Checkbox` | label, hint, error, required | Required marks `*`; optional fields say "(optional)". Errors carry an alert icon. `aria-invalid` on the control. |
| `SegmentedControl` | `options`, `value`, `onChange`, `label` | `role="radiogroup"`; scrolls horizontally when it cannot fit. |
| `Stepper` | `steps`, `current`, `completed`, `onSelect` | Vertical on lg+, horizontal scroll below. Completed steps are reachable; future ones are disabled. |
| `Notice` | `tone`, `title`, `icon` | Inline, never toast. Used for gates ("Cannot accept yet"), isolation banners and prototype disclosures. |
| `AppShell` | `workspace: buyer \| ops`, `title`, `rightRail` | Rail, top bar, bottom tab bar, navigation sheet, demo stripe. |
| `DemoStripe` | — | Must stay on every prototype page. |
| `Icon` | `name`, `size`, `label` | 31 inline SVG glyphs; decorative unless `label` is passed. |

## 3. Status display rules

1. Status is never color alone: every badge carries an icon or a word that would survive greyscale.
2. The cost-line marker is a **border style**, not just a color: solid (sourced), dashed (estimated), double (missing), thin grey (included in trade term).
3. Dates are ISO `YYYY-MM-DD` in the English UI (the demo data uses them throughout); the zh-CN UI renders `2026年11月7日` per IA §2.3. Canonical stored values are never localized.
4. Money: original currency first, converted value second and smaller, with the rate reference available in the page header. Unit prices to 4 dp, totals to 2 dp (QUOTE_ENGINE_SPEC §2.5).

## 4. Accessibility floor (verified in this session where noted)

- Focus: 2 px copper outline with 2 px offset on every interactive element (`:focus-visible`). Verified in the browser on the dashboard.
- Keyboard: segmented controls and tab bars are reachable; the evidence popover opens with Enter/Space on the summary; the navigation sheet has a close button and a backdrop button.
- Touch targets: 40 px controls, 32 px small buttons, 44+ px tab bar items.
- Semantics: `<table>` with `scope`d headers for the matrix; `role="radiogroup"` for toggles; `aria-current="page"`/`"step"`; `aria-pressed` for selectable supplier columns; dialogs are `role="dialog" aria-modal`.
- Reduced motion respected.
- Known gap: `warn` (`#B7791F`) measures 3.4–3.6:1 as text, which fails AA for normal-size text. The prototypes pair every warn usage with an icon and keep it at 12–13 px medium weight. The handoff proposes `#8F5E12` (5.6:1 on surface, 5.2:1 on paper) as the warn **text** color, keeping `#B7791F` for borders and tints, subject to founder sign-off on the palette.
- Not yet verified: screen-reader pass of the comparison table.

## 5. Do / don't

**Do** keep one memorable element per page (the comparability groups, the stepper, the anchor highlight). **Do** write the reason next to the disabled control. **Do** derive counts from records.

**Don't** add drop shadows to cards, all-caps eyebrows, numbered markers on non-sequences, gradients, star ratings, "verified" without a linked check, or any number that has no source.
