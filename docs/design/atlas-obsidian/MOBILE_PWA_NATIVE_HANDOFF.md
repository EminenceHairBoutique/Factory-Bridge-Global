# Mobile, PWA and Native Handoff — Atlas × Obsidian

**Crosswalk:** the native architecture (jobs, navigation, camera, push, auth, shared packages, API security, desktop-first list, Expo monorepo structure, readiness checklist) is in `docs/design/MOBILE_READY_ARCHITECTURE.md`, and the capability matrix in `docs/design/WEB_NATIVE_FEATURE_PARITY.md`. This document adds the **Atlas × Obsidian deltas**: the four-tab IA, theme handling on native, PWA plan, offline policy and touch/Dynamic Type rules. No implementation is claimed; `apps/mobile` does not exist.

## 1. The split, stated once

| Surface | What it is | When |
|---|---|---|
| Responsive website | The Next.js app at phone widths; everything in the preview | Now |
| PWA | Same site, installable; manifest, icons, service worker for the shell; browser-dependent push | When buyers ask for a home-screen icon (low cost) |
| Native (Expo) | Separate binary; camera, reliable push, biometric approvals, offline queue | When Phase 3 quality operations need capture and approvals in the field |

## 2. Buyer mobile IA (supersedes the five-tab model in the earlier doc)

Bottom tabs: **Home · Projects · Inbox · Account**. "Start a sourcing request" is a prominent button on Home and on Projects. Quotes, documents and reports are contextual screens inside a project. Comparison: swipe/select supplier cards, disclosure panel per card, "What is missing" summary line, compare toggle; approvals explicit and guarded (biometric on native).

Operations mobile tabs: Queue · Projects · Reviews · Account. Supplier mobile tabs: 工作台 · 询价单 · 报价 · 账户.

## 3. Theme on mobile

- Web/PWA: `data-theme` on the preview scope; `System` follows `prefers-color-scheme`; the choice is stored per device. The PWA manifest declares `theme_color` `#0F1B2D` and `background_color` `#FAF8F4` (Atlas) with a dark-scheme manifest override where supported.
- Native: `useColorScheme()` for System; the Atlas/Obsidian token objects generated from `tokens.json`; status bar style follows the theme; the marketing hero has no native equivalent.
- Obsidian on OLED: canvas `#0D1118` is intentionally not pure black so raised surfaces remain distinguishable.

## 4. Touch ergonomics, safe areas, Dynamic Type

- Targets ≥ 44 × 44 px: tab bar items are 56 px tall; sheet rows 44 px; primary buttons 44 px; small (36 px) buttons only in dense desktop tables.
- Safe areas: bottom tab bar and sheets pad with `env(safe-area-inset-bottom)`; sticky action bars sit above the tab bar.
- Dynamic Type / text scaling: layouts use rem-free pixel scale on web today; native must scale the 16/14/12 ratios with `allowFontScaling` and cap at 1.3× for dense tables, with a "larger text" layout that stacks table rows.
- Reduced motion respected on both.

## 5. States

Every mobile screen defines: empty (next action named), loading (skeleton rows), error (what failed and the fallback, e.g. "FX rate missing, original currencies shown"), offline (banner "Showing the last snapshot from <time>; actions queue until you reconnect"), and permission-denied (sign out and explain).

## 6. PWA plan

- `manifest.webmanifest`: name, short name, icons (mark on Atlas and Obsidian backgrounds), `display: standalone`, start URL `/app`, scope `/`.
- Service worker: cache the application shell and static assets only. **Do not cache API responses or documents.** Comparison snapshots may be cached in memory for the session only.
- Push: Web Push where supported; iOS requires the installed PWA; treat as best effort and keep email as the reliable channel.
- Offline policy: no confidential supplier or customer document is stored offline until a reviewed encryption, storage and expiry policy exists (SECURITY.md owner).

## 7. Native plan (unchanged from the architecture doc, summarised)

Expo Router mirroring the IA; Supabase PKCE with SecureStore; biometric gate; camera and gallery through a server-issued signed upload URL into quarantine; push via Expo Notifications with a `device_tokens` table (org-scoped RLS) and bodies free of prices, contacts and document text; deep links per record; crash reporting with the same redaction rules as the web; `@fbg/domain` and `@fbg/i18n` reused as pure TypeScript; proposed `@fbg/api-contracts` and `@fbg/ui-core` packages.

## 8. Backend dependencies (owners)

| Need | Owner |
|---|---|
| Mobile auth callback routes and session revocation per device | B-05 |
| Signed upload URL endpoint, quarantine policy | B-10 / B-11 |
| Serialisable comparison result DTO | B-14 / B-22 |
| Notification events and `device_tokens` migration with RLS tests | new backlog item (proposed D-03) |
| Store accounts (Apple, Google) | founder decision; paid accounts need written authorization |
