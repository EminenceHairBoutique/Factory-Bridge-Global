# Mobile-Ready Architecture

**Decision scope:** this document plans the native mobile applications (React Native + Expo) without creating `apps/mobile` or installing Expo. It also fixes the vocabulary so "mobile" is never ambiguous in planning documents.

## 1. Three different things

| | Responsive website | PWA | Native application |
|---|---|---|---|
| What it is | The Next.js app rendered at phone widths (what the prototypes do today) | The same website installed to the home screen with a manifest and a service worker | A separate binary built with React Native + Expo, distributed through the App Store / Play Store |
| Runtime | Browser | Browser (standalone window) | Native UI thread + JS engine (Hermes) |
| Offline | No | Partial (cached shell and read-only data) | Yes, designed in (local store, queued writes) |
| Camera / gallery | `<input type="file" capture>` only | same | Full camera control, multi-select gallery, background upload |
| Push notifications | Web Push (iOS requires installed PWA; unreliable for business users) | Web Push | APNs / FCM via Expo Notifications, reliable, badge counts |
| Auth session | Cookie / Supabase browser client | same | Secure keychain storage, biometric unlock, PKCE deep-link callback |
| Deep links | URLs | URLs | Universal links / app links into screens |
| Cost to maintain | Already paid for | Low | A second client: build, review, release, crash reporting |

Recommendation: keep the responsive website as the only mobile surface through Phase 1 and most of Phase 2. Add a PWA manifest only if buyers ask for a home-screen icon. Start the native app when the push-notification and camera-upload jobs below are needed by real users (Phase 3 quality operations), not before.

## 2. What mobile is for

The native app serves the moments where a person is **away from a desk** and the product needs a decision or evidence from them:

| Job | Who | Why native matters |
|---|---|---|
| Approve or reject: outbound RFQ, clarification message, supplier selection, sample approval, order handoff | Buyer owner/admin, operator | Push → open → decide in under a minute; biometric confirm for money-adjacent approvals |
| Read a quote comparison summary and the reasons something is excluded | Buyer | Same component model as the web carousel; offline read of the last snapshot |
| Capture evidence: sample photos, carton labels, inspection photos, shipping documents | Supplier staff on the factory floor, inspectors | Camera, multi-shot, EXIF time, background upload with retry, queue when offline |
| Respond to an RFQ or confirm a price revision | Supplier (zh-CN) | Push in Chinese; forms mirror the web schema; no autonomous sending |
| Track project milestones and exceptions | Buyer, operator | Timeline with freshness, push on delayed milestone / inspection failure |
| Start a sourcing request from a photo or a voice note | Buyer | Captures raw input only; structuring and confirmation still happen on the web |

## 3. Native navigation and layout

```
Tab bar (buyer):  Overview · Projects · Inbox (approvals + messages) · Scan/Upload · More
Tab bar (supplier, zh): 工作台 · 询价单 · 报价 · 拍照上传 · 更多
Tab bar (ops):    Queue · Approvals · Suppliers · Capture · More
```

- Stack navigation inside each tab (Expo Router file routes mirror the web IA: `app/(buyer)/projects/[id]/compare.tsx`).
- Modal sheets for approvals and clarification drafts, always with the approval chain visible (who else must approve).
- Lists use the same density rules as the web cards: 12–13 px meta, 14 px body, tabular numerals.
- Comparison on native: per-group horizontal pager of quote cards (identical row model to `QuoteComparison.tsx`'s `ROWS`), a sticky "comparable goods cost" figure, and a "why not comparable" sheet. Editing landed-cost assumptions stays on the web (see §9).
- Sourcing request on native: a shortened three-step flow (what · how many / where · photos and notes). The specification step is web-only; the native draft lands in the web wizard at step 3.

## 4. Camera and gallery uploads

- Expo Camera / ImagePicker with multi-select; images re-encoded client-side to strip executable payloads, capped at 25 MB per file and 20 files per batch (mirrors AC-B2.1).
- Uploads go to the `quarantine` bucket path `<org_id>/<document_id>/<sha-prefix>-<name>` through a **server-issued signed upload URL** (never the anon key with a permissive policy). Status chips: queued → uploading → scanning → in review / rejected.
- Background upload queue persisted locally; retries with backoff; the user sees per-file status in the Documents list.
- Evidence photos attach to a check row or milestone, never float free, so the badge logic stays record-driven.

## 5. Push notifications

| Event | Recipients | Payload rule |
|---|---|---|
| New quote confirmed | buyer members of the project | title + project name; no prices in the notification body |
| Quote expiring (configurable lead) | buyer owner/admin | date only |
| Approval requested (RFQ, message, selection, handoff) | approvers | approver chain, deep link to the approval sheet |
| Extraction ready for review | assigned operator | document name only |
| Sample approval requested / inspection result / delayed milestone | buyer, operator | state only; details on open |
| RFQ received / price confirmation requested (zh-CN) | supplier members | Chinese copy, formal register |

Requirements: Expo Notifications tokens stored per device in a `device_tokens` table (org-scoped, RLS), revoked on sign-out and role change; notification bodies contain **no prices, no contacts, no document text** (SECURITY.md redaction rule applies); per-user preferences per event type; quiet hours per time zone.

## 6. Project updates and approvals

Approvals are the native app's primary write path. Each approval screen shows: what is being approved (rendered from the same DTO the web uses), who already approved, what happens next, and the audit note that will be written. Confirmation requires biometric or device passcode for: outbound supplier messages, supplier selection, purchase handoff, anything involving deposits. The app never sends to a supplier itself; it records the approval and the server-side job performs the side effect (CLAUDE.md §4 human approval gate).

## 7. Mobile authentication architecture

- Supabase Auth with **PKCE** flow; email OTP and password; magic-link callbacks handled via universal/app links (`fbg://auth/callback` plus `https://<domain>/auth/mobile-callback`).
- Tokens stored in Expo SecureStore (Keychain / Keystore), never AsyncStorage; refresh handled by the Supabase client with a secure storage adapter.
- Biometric gate (expo-local-authentication) to open the app after background, and per high-risk approval.
- Membership is checked live on every request by the server (`app.is_member`), so a revoked role fails at the next call; the app treats any 401/403 as "sign out and explain".
- Device registration and remote sign-out per device from web settings.
- No service-role key, no privileged endpoints, no direct table writes beyond what RLS allows for that user.

## 8. Shared TypeScript types and domain logic

Reuse without duplication:

| Package | Native use |
|---|---|
| `@fbg/domain` | enums, money/FX display helpers, tier selection, Incoterm comparability, lifecycle transitions — all pure TS, already free of I/O. Run on device for display only; authoritative totals still come from the server. |
| `@fbg/i18n` | message catalogs (en-US, zh-CN) through the same `t()` API. |
| `@fbg/db` | generated Supabase types for DTOs. |
| New `@fbg/api-contracts` (proposed) | zod schemas for every HTTP/RPC payload the web and native clients share (comparison snapshot, approval request, upload ticket). |
| New `@fbg/ui-core` (proposed) | design tokens as a TS object, status vocabulary, row models (e.g. the comparison `ROWS` definition split into data + renderer), so web and native render the same semantics with platform-specific primitives. |

The design-preview `compare-demo.ts` is explicitly **not** a shared module; it is replaced by `@fbg/domain` quote engine (B-14).

## 9. API dependencies and security requirements

- All reads through RLS-filtered endpoints or PostgREST with the user JWT; comparison snapshots and landed-cost scenarios fetched as server-rendered DTOs (the engine runs server-side).
- Signed URLs for documents expire ≤ 15 minutes and are logged in `document_access_log`; the app never caches document bytes beyond the session.
- Exports (PDF/CSV) are generated server-side and delivered as signed URLs; the native app only opens them.
- Rate limits per device and per org (B-28) apply to uploads and AI-adjacent calls.
- Certificate pinning is optional; TLS 1.2+ mandatory; no third-party analytics SDK that can see screen content.
- Crash reporting (Sentry RN) with the same redaction rules as the web: no price, document text, or contact strings in breadcrumbs.

## 10. What stays desktop-first

- Extraction review with document anchors (two-pane, precise selection).
- Specification editing and AI-proposal confirmation.
- Landed-cost assumption entry and scenario editing.
- Supplier catalog bulk import and price-tier editing.
- Operations CRM, permissions dashboard, audit explorer, compliance holds.
- Report generation and export configuration.

Native and phone-web show read-only summaries of all of the above with a "Continue on desktop" link that deep-links to the exact record.

## 11. Recommended future Expo monorepo structure

```
apps/
  web/                      # Next.js (unchanged)
  worker/                   # queue consumer (unchanged)
  mobile/                   # Expo app (Expo Router, TypeScript strict)
    app/                    # file-based routes mirroring docs/UX_INFORMATION_ARCHITECTURE.md
      (buyer)/ (supplier)/ (ops)/ auth/
    src/
      features/             # approvals, capture, compare, requests
      components/           # RN primitives implementing @fbg/ui-core semantics
      lib/                  # supabase client (SecureStore adapter), notifications, upload queue
    app.config.ts           # scheme, universal links, EAS profiles (dev / preview / production)
packages/
  domain/  ai/  db/  i18n/  # unchanged
  api-contracts/            # zod schemas shared by web, worker, mobile (proposed)
  ui-core/                  # tokens, status vocabulary, row models (proposed)
```

Tooling notes: pnpm workspaces already in place; Metro needs `watchFolders` for `packages/*` and `node_modules` symlink support (Expo SDK 50+ handles this); EAS Build for binaries; `@fbg/domain` must remain free of Node-only imports (lint rule already exists).

## 12. Readiness checklist before `apps/mobile` is created

- [ ] B-05 auth flows merged (web) and mobile callback routes agreed.
- [ ] B-10/B-11 signed upload URL endpoint exists.
- [ ] B-14 quote engine exposes a serialisable comparison result (`@fbg/api-contracts`).
- [ ] Notification events and `device_tokens` migration designed with RLS and tests.
- [ ] Founder decision on store accounts (Apple Developer, Google Play) — paid accounts need written authorization (CLAUDE.md §4).
