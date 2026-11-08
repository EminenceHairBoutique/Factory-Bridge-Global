# Design Tokens V1 — Atlas × Obsidian

**Source of truth for values:** `apps/web/src/design-preview/design-preview.css` (scoped to `.fbg-dp`) and the machine-readable copy `docs/design/atlas-obsidian/tokens.json`. The shared Tailwind theme in `apps/web/src/app/globals.css` is unchanged; its legacy variables are mapped onto these semantic tokens inside the preview scope (see §6).

Supersedes the color table in `docs/design/DESIGN_SYSTEM.md` §1.1.

## 1. Color tokens

### 1.1 Atlas (light)

| Token | Value | Use |
|---|---|---|
| `bg-canvas` | `#FAF8F4` | page background |
| `bg-surface` | `#FFFFFF` | panels, tables, inputs |
| `bg-raised` | `#FFFFFF` + `shadow-raised` | popovers, drawers, dialogs, marketing cards |
| `bg-sunken` | `#F3F0EA` | segmented-control tracks, neutral chip fill, disabled fill |
| `bg-inverse` | `#0F1B2D` | active segment, step marker |
| `text-primary` | `#0F1B2D` | body and headings |
| `text-secondary` | `#3A4A5E` | supporting text, labels |
| `text-muted` | `#6B7684` | placeholders, footers |
| `text-inverse` | `#F3F7F5` | text on inverse / brand fills |
| `border-subtle` | `#E4E1DA` | panel borders, dividers |
| `border-divider` | `#ECE9E3` | row separators |
| `border-strong` | `#7D8894` | input and secondary-button boundaries (non-text contrast) |
| `accent-subtle` | `#E7F2F0` | icon tiles, selected rows |
| `action-primary` / hover / pressed | `#1F6F78` / `#1A5F67` / `#164F56` | primary buttons, links, focus ring, active tab |
| `action-on-primary` | `#FFFFFF` | text on primary |
| `link` | `#1F6F78` | inline links |
| `brand-accent` / subtle | `#B3613A` / `#F5E9E2` | mark, pilot badge, notification dot |
| `status-success` / fill | `#2E7D4F` / `#E4F2EA` | passed, identity reviewed |
| `status-warning` / fill | `#83520A` / `#F7ECD9` | estimated, validity unconfirmed, compliance hold |
| `status-danger` / fill | `#A33A2E` / `#F6E3E0` | missing, expired, mismatch |
| `status-info` / fill | `#1F6F78` / `#E7F2F0` | sourced, confirmed |
| `focus-ring` | `#1F6F78` | 2 px outline, 2 px offset |
| `selected` | `#E7F2F0` | selected column tint, chosen option |
| `hover` / `pressed` | navy at 5 % / 10 % | ghost and secondary states |
| `disabled-fg` / `disabled-bg` | `#9AA3AE` / `#F3F0EA` | |
| `skeleton` / shine | `#ECE9E3` / `#F7F4EE` | loading placeholders |
| `overlay` | navy at 45 % | dialog scrim |
| `rail-bg` / `rail-fg` | `#0F1B2D` / `#F3F7F5` | sidebar (navy in both themes) |
| `chart-1…5` | teal, copper, slate, amber, green | categorical series |

### 1.2 Obsidian (dark)

| Token | Value | Use |
|---|---|---|
| `bg-canvas` | `#0D1118` | page background |
| `bg-surface` | `#161E29` | panels |
| `bg-raised` | `#1C2530` | popovers, drawers, dialogs |
| `bg-sunken` | `#0A0E14` | tracks, neutral fill |
| `bg-inverse` | `#F3F7F5` | active segment |
| `text-primary` | `#F3F7F5` | |
| `text-secondary` | `#A9B9C8` | |
| `text-muted` | `#7F8F9E` | |
| `text-inverse` | `#0D1118` | |
| `border-subtle` / divider / strong | `#36414B` / `#273039` / `#5B6873` | |
| `accent-subtle` | `#1B2F33` | |
| `action-primary` / hover / pressed | `#72D0C3` / `#86DBD0` / `#5FBFB2` | |
| `action-on-primary` | `#0D1118` | |
| `link` | `#8FDCD1` | |
| `brand-accent` / subtle | `#C7AD78` / `#2A2619` | champagne |
| `status-success` / fill | `#7FD3A0` / `#17322A` | chosen independently, not reused from light |
| `status-warning` / fill | `#E6B45C` / `#3A2D14` | |
| `status-danger` / fill | `#F29A8E` / `#3D1F1C` | |
| `status-info` / fill | `#72D0C3` / `#1B2F33` | |
| `focus-ring` | `#72D0C3` | |
| `selected` | `#1B2F33` | |
| `hover` / `pressed` | white at 6 % / 12 % | |
| `disabled-fg` / `disabled-bg` | `#5B6873` / `#121923` | |
| `skeleton` / shine | `#1C2530` / `#273039` | |
| `overlay` | black at 65 % | |
| `rail-bg` / `rail-fg` | `#0A0E14` / `#F3F7F5` | |
| `chart-1…5` | mint, champagne, mist, amber, green | |

`System` follows `prefers-color-scheme` with the same Obsidian values.

## 2. Contrast matrix (WCAG 2.x relative luminance, computed 2026-11-07)

Method: sRGB relative luminance per WCAG 2.x, ratio `(L1 + 0.05) / (L2 + 0.05)`, computed by script over the hex values above. Targets: 4.5:1 normal text, 3:1 large text and non-text UI boundaries.

| Pair | Atlas | Obsidian | Verdict |
|---|---|---|---|
| text-primary on canvas | 16.3 | 17.5 | AAA |
| text-primary on surface | 17.3 | 15.5 | AAA |
| text-primary on raised | 17.3 | 14.3 | AAA |
| text-secondary on canvas | 8.5 | 9.4 | AAA |
| text-secondary on surface | 9.0 | 8.4 | AAA |
| text-secondary on raised | 9.0 | 7.7 | AAA |
| action-primary on surface (links, icons) | 5.8 | 9.2 | AA |
| action-primary on canvas | 5.5 | 10.4 | AA |
| action-on-primary on action-primary (button text) | 5.8 | 10.4 | AA |
| brand-accent on surface (badge text) | 4.5 | 7.7 | AA at threshold (light) |
| text-inverse on brand-accent (brand button) | 4.5 | 8.7 | AA at threshold (light): use only on 15 px+ medium weight |
| status-success on surface | 5.0 | 9.4 | AA |
| status-warning on surface | 6.6 | 8.8 | AA (light value `#83520A` replaces the legacy `#B7791F`, which measured 3.6) |
| status-danger on surface | 6.6 | 7.8 | AA |
| action-primary on accent-subtle | 5.1 | — | AA |
| border-subtle on surface (decorative) | 1.3 | 1.6 | not a control boundary; exempt |
| border-strong on surface (input boundary) | 3.6 | 2.9 | light passes 3:1; **dark fails by 0.1** → see failed list |
| text-muted on surface | 4.6 | 5.1 | AA for 12 px captions |
| disabled-fg on surface / disabled-bg | 2.6 | 3.1 | disabled text is exempt from WCAG contrast; reason is also given in `title` |

**Failed or unmeasured combinations**

- Obsidian `border-strong` `#5B6873` on `#161E29` = 2.9:1, just below the 3:1 non-text target. Inputs also have a 1 px lighter hover state and a visible focus ring, but the resting boundary should move to `#67747F` (3.5:1) in V1.1.
- Light `brand-accent` as text and as a button fill sits exactly at 4.5:1; acceptable, but never at 12 px regular weight.
- Colored chip fills (`*-fill`) with their matching status text were not measured individually; all status chips also carry an icon.
- Marketing hero text over the radial tints was not measured against the tint peaks (tints are ≤ 14 % alpha over `#0D1118`).

## 3. Typography

| Role | Face | Desktop / mobile | Weight | Notes |
|---|---|---|---|---|
| Brand display (public site only) | Geist, fallback Inter | 64–72 / 38–44 px, line 1.05, tracking −0.02em | 600 | `.fbg-display` |
| Page title | Inter | 36 / 28 px | 600, tracking −0.015em | `PageHeader` |
| Section | Inter | 26 / 22 px | 600 | `SectionTitle` |
| Card / panel title | Inter | 18 / 17 px | 600 | `Panel` |
| Body | Inter | 16 px, line 1.5 | 400 | `.fbg-dp` base |
| Dense metadata, tables, chips | Inter | 14 px | 400–500 | |
| Captions | Inter | 12 px minimum | 400–500 | |
| Chinese | Noto Sans SC | same scale | 400–700 | `lang="zh-CN"` or `.fbg-zh` |
| Numbers | any | — | — | `.fbg-num`: tabular lining numerals for prices, rates, MOQs, dates |

Fonts are loaded at runtime from Google Fonts in the preview layout only (Geist, Inter, Noto Sans SC). Production should self-host (handoff).

## 4. Geometry, density, motion

| Token | Value |
|---|---|
| Spacing primitive | 4 px; primary rhythm 8 px |
| `radius-chip` / `radius-control` / `radius-card` / `radius-dialog` | 6 / 10 / 12 / 20 px |
| `control-h` / `control-h-sm` | 44 / 36 px (inputs and primary buttons 44 px; dense table actions 36 px) |
| Touch targets | ≥ 44 × 44 px for tab bar, sheet rows and primary actions |
| `rail-w` / `drawer-w` | 248 / 384 px |
| Marketing max width | 1280 px |
| Page padding | 16–20 px phone, 24 px tablet, 32–40 px desktop |
| `motion` | 180 ms functional transitions; no animated numbers; `prefers-reduced-motion` zeroes all durations |
| Shadows | `shadow-raised` (popover/drawer), `shadow-dialog`; panels have none |

## 5. State semantics

| State | Rendering |
|---|---|
| Hover | `hover` fill (ghost, secondary, rows), stronger border on inputs |
| Pressed | `pressed` fill; primary uses `action-primary-pressed` |
| Selected | `selected` fill + action border (checkbox cards, chosen column) |
| Focus | 2 px `focus-ring` outline, 2 px offset, on `:focus-visible` only |
| Disabled | `disabled-bg` + `disabled-fg`, `cursor-not-allowed`, reason in `title` when not visible |
| Loading | skeleton shimmer (static under reduced motion) or spinner in the button |
| Status | always icon + text; fills from `*-fill`, text from `status-*` |

## 6. Web ↔ Expo mapping

Web: CSS custom properties on `.fbg-dp`, consumed through Tailwind utilities (`text-(--fbg-text-primary)`, `bg-(--fbg-action-primary)`) and legacy names mapped for compatibility (`--color-ink → text-primary`, `--color-paper → bg-canvas`, `--color-line → border-subtle`, `--color-accent → brand-accent`, `--color-teal → action-primary`, `--color-ok/warn/danger → status-*`).

Native (future `apps/mobile`): `tokens.json` is the exchange format. A generated `theme.ts` exports `{ atlas, obsidian }` objects with the same keys; React Native components read `useTheme().colors.actionPrimary`. Typography maps to platform faces (SF / Roboto) for body, Geist for display only where licensing allows bundling; Dynamic Type scales the same ratios.
