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

## 6d. Session 6 — Project overview (2026-11-07, same branch)

**Implemented in preview:** `/design-preview/buyer/project` (`ProjectOverview.tsx`, `demo-data/project.ts`): RecordPage for the labels demo project with stage strip, next-action card, status timeline (who and when per step, what unlocks pending steps), quotes at a glance (statuses from the comparison helper), open items, and tabs Brief · Supplier options · Compare · Documents (pipeline statuses, filter) · Messages (approval chain You → Operator → Sent; Approve draft advances it) · Reports (assumptions, exclusions, staleness) · Activity (audit-derived with acting_as labels); evidence drawer with record facts, brief versions and approval gates. Dashboard project row and index entry link to it. Details in `PROJECT_OVERVIEW_SCREEN.md`.

**Tests actually run:** `pnpm check` exit 0 (format, typecheck, lint, Vitest 224); `next build` exit 0; production `next start`: `/design-preview/buyer/project` → 404. Browser: all eight tabs render; Approve draft advances the chain and clears the Overview prompt; no console errors; no horizontal overflow at 320 / 375 / 768 px in Obsidian.

**Cross-track:** H-29 (project record DTO).

## 6e. Session 7 — Operations supplier CRM (2026-11-07, same branch)

**Implemented in preview:** `/design-preview/ops/suppliers` (`OpsSupplierList.tsx`: sortable table with `aria-sort`, search, stage and family filters, checks-due and assigned-to-me toggles, phone cards) and `/design-preview/ops/supplier?id=` (`OpsSupplierRecord.tsx`: generated badge preview, stage gate with requirement list, View-as switch, tabs Profile (claimed vs verified) · Facilities · Contacts (restricted; contact-basis rule; disclosure grant drafts) · Checks (record a check updates the badge) · Documents (rights class; permission required for buyer-visible catalogs) · Permissions (record with evidence; revoke with reason); evidence drawer with assignment and audit). `demo-data/ops-suppliers.ts`; `ops-demo.ts` with 7 new tests. Ops sidebar "Suppliers" and index entry link to it. Details in `OPS_SUPPLIER_CRM_SCREEN.md`.

**Tests actually run:** `pnpm check` exit 0 (format, typecheck, lint, Vitest 231: web 32); `next build` exit 0; production `next start`: both routes → 404. Browser: sorting toggles `aria-sort` and reorders; checks-due filter narrows; badge preview and stage gate render from records; contacts visible as assigned and "Hidden by policy" as unassigned; WeChat handle without basis refused, saved with basis and audited; no console errors; no horizontal overflow at 320 / 375 / 768 px.

**Cross-track:** H-30 (supplier record DTO and server-side badge generation).

## 6f. Session 8 — Sign-in, invitation and organization setup (2026-11-07, same branch)

**Implemented in preview:** `AuthFrame`; `/design-preview/auth` (email one-time code first, password second, forgot-password without account enumeration, EN / 中文 copy, signed-in state), `/design-preview/auth/invite` (organization, inviter, role with can/cannot, accept by proving the address, expired scenario), `/design-preview/auth/org-setup` (company → destination and categories → invite your team with inline role cards → created). `auth-demo.ts` (role table, OTP / password / invite / ZIP validators) with 4 new test groups. Marketing "Sign in" links to it; index entry. Details in `AUTH_AND_ORG_SETUP_SCREENS.md`.

**Tests actually run:** `pnpm check` exit 0 (format, typecheck, lint, Vitest 235: web 36); `next build` exit 0; production `next start`: all three routes → 404. Browser: sign-in email error, code step, short-code rejection, success, 中文 toggle; password and forgot paths; invitation review, join, expired; organization setup validation, own-address rejection, creation with one invitation; no console errors; no horizontal overflow at 320 / 375 / 768 px in Obsidian.

**Cross-track:** H-31 (auth and organization-setup contract; role copy to i18n).

## 6g. Session 9 — Operations work queue and pipeline (2026-11-07, same branch)

**Implemented in preview:** `/design-preview/ops/queue` (`OpsWorkQueue.tsx`, `demo-data/ops-queue.ts`, `queue-demo.ts` with 6 tests): SLA-ordered queue (My queue · Unassigned · All open) with kind and project filters, claim, inline outbound approval showing the chain Buyer approved → Operator → Sent via platform with EN and 中文 text and the channel rule, supplier-reply relay, links into the review split, supplier record and comparison; Pipeline tab with seven stage columns, per-stage targets and days-in-stage. Evidence drawer with the turnaround targets ("not shown to buyers as promises") and the session's audit lines. Ops sidebar "Work queue" and index entry link to it. Details in `OPS_WORK_QUEUE_SCREEN.md`.

**Tests actually run:** `pnpm check` exit 0 (format, typecheck, lint, Vitest 240: web 41); `next build` exit 0; production `next start`: route → 404. Browser: overdue-first ordering, draft chain, approve-and-send, relay, claim from Unassigned, pipeline columns and past-target flags; no console errors; no horizontal page overflow at 320 / 375 / 768 px.

**Cross-track:** H-32 (work-items view and outbound-approval endpoint).

## 6h. Session 10 — Documents and extraction review (2026-11-07, same branch)

**Reuse first:** the operator review's document pane, field pane, confidence band and pane toggle were extracted into `ui/ReviewSplit.tsx` with a read-only mode; the operator screen renders it editable and the new buyer review renders it read-only. The wizard's upload type and size check moved into `documents-demo.ts` and the wizard imports it. Source lines moved into `demo-data/documents.ts` keyed by document id, and review tasks now reference a `documentId`.

**Implemented in preview:** `/design-preview/buyer/documents` (`BuyerDocuments.tsx`): library with pipeline status, who acts next, scan result, extraction flags, linked record and access log per document; upload pre-check with a simulated in-browser pipeline and a sample-file button; status tabs and project/kind filters; discard with confirmation and the evidence rule for accepted documents. `/design-preview/buyer/review?doc=` (`BuyerExtractionReview.tsx`): read-only split with flag-for-operator toggles, notes attached to the review task, the accepted variant with the operator's corrections, and an empty state for unknown ids. Operator review refined: document facts in the header, extraction flags as notices including the security notice for text addressed to the system, pending tasks read-only until assigned. Buyer sidebar "Documents" and project-overview links now reach these screens. Details in `DOCUMENTS_AND_EXTRACTION_REVIEW_SCREENS.md`.

**Defect found and fixed while verifying:** the four query-parameter screens (`?id=`, `?product=`, `?rfq=`, and the new `?doc=`) used `useSearchParams` under a Suspense boundary that wrapped the whole page. In the dev server the streamed segment's reveal sometimes never fired, leaving a blank page with the content in a hidden element. The route files now read `searchParams` on the server and pass a prop; repeated loads render and hydrate within 3 seconds.

**Tests actually run:** `pnpm check` exit 0 (format, typecheck, lint, Vitest 248: web 49); `next build` exit 0; production `next start`: `/design-preview/buyer/documents` and `/design-preview/buyer/review?doc=d_quote_h` → 404. Browser: documents interactions (simulated upload to review, signed-link logging, SVG refused, Escape, discard, rejected and accepted actions), buyer review (flags, anchors, notes attached, corrections, empty state), operator review (flags, fingerprint line, pending → assigned → editable); no console errors; no horizontal page overflow at 320 / 375 / 768 / 1440 in both themes.

**Cross-track:** H-33 (documents, access log, signed links, extraction summary, buyer notes, discard rule; server-side `searchParams`).

## 6i. Session 11 — Buyer reports (2026-11-07, same branch)

**Reuse first:** every number in a report comes from `compare-demo.ts`; `exclusionText` and `forwarderOverrides` moved out of the comparison screen into that helper so the comparison and the report footer share wording and freight inputs. The project overview's own report records were replaced by `demo-data/reports.ts`; its Reports tab, the comparison export dialog and the documents library now point at the new screens.

**Implemented in preview:** `/design-preview/buyer/reports` (`BuyerReports.tsx`): versions with current / stale / superseded derived from the recorded inputs and every reason listed; a generate panel whose "What this version will contain" is derived from the live comparison (ranked and not-ranked counts, trade-term groups, whether cross-group ranking is available, assumption and exclusion counts, FX row, file name); simulated generation that flips earlier versions to superseded; Regenerate with current data; reproducibility facts in the evidence drawer (`ui/ReportFacts.tsx`). `/design-preview/buyer/report?id=` (`BuyerReportView.tsx`): the report rendered per QUOTE_ENGINE_SPEC §5 (running header, facts grid, ranked quotations by trade-term group with selected tier, goods in both currencies, fees, ordering key, landed lines with status, flags and soft differences, the not-ranked list, footer with assumptions, exclusions, rounding rule and disclaimers) and the five ADR-024 tables with a CSV preview; `id=live` renders a preview-generated version from its inputs. `reports-demo.ts` with 9 tests (file name pattern, banker's rounding, status derivation, content and tables, CSV quoting). Details in `BUYER_REPORTS_SCREENS.md`.

**Tests actually run:** `pnpm check` exit 0 (format, typecheck, lint, Vitest 258: web 59); `next build` exit 0; production `next start`: `/design-preview/buyer/reports` and `/design-preview/buyer/report?id=rep_1` → 404. Browser: generate flow, status flips, download-link logging, regenerate pre-fill, empty states, viewer tabs and sheets, comparison dialog link, overview tab; no console errors; no horizontal page overflow at 320 / 375 / 768 / 1440 in both themes.

**Cross-track:** H-34 (reports table, server-side status derivation, generation job, five tables with reproducibility columns).

## 6j. Session 12 — Messages and approvals (2026-11-07, same branch)

**Reuse first:** the approval chain that the project overview, the comparison's clarification dialog and the operator work queue each drew by hand is now one shared chip component (`ui/ApprovalChain.tsx`) fed by one helper (`approvalChain` in `messages-demo.ts`); the overview's own thread records were replaced by `demo-data/messages.ts`, and its Messages tab, the comparison dialog ("Review in Messages") and the dashboard's "Review draft" action now open the inbox thread.

**Implemented in preview:** `/design-preview/buyer/messages?thread=` (`BuyerMessages.tsx`): needs-you-first list with status filters and a project filter; the thread with every message in both languages and its translation provenance (AI-drafted and not yet checked, or checked by the operator); the approval chain You → Operator → Sent via <channel> on every outbound message with Approve wording, Edit wording (the Chinese is re-drafted and both approvals reset) and Withdraw draft; a composer that counts as the buyer's approval and submits to the operator queue, offering WeChat relay only where the CRM recorded a contact basis and warning when the text looks like contact details; inbound flags shown as notices (text addressed to the software, contact details removed, links not opened); attachments linking to the document review; the evidence drawer with who can see the thread, the allowed channels and the outbound log (channel, both approvers, time, reference). `messages-demo.ts` with 10 tests. Details in `BUYER_MESSAGES_SCREEN.md`.

**Tests actually run:** `pnpm check` exit 0 (format, typecheck, lint, Vitest 287: web 69); `next build` exit 0; production `next start`: `/design-preview/buyer/messages` → 404. Browser: ordering and counts, edit → approvals reset, approve → with the operator, composer warning and submission over WeChat relay, revalidation prefill, platform-only channel without a recorded basis, inbound flags and attachment link, closed sample thread, project filter, unknown thread id fallback, overview tab and dashboard links; no console errors; no horizontal page overflow at 375 and 1440 in both themes (320 and 768 could not be held: the browser pane was in use while the checks ran).

**Cross-track:** H-35 (supplier_messages approval record, channel eligibility from contact basis, inbound flags as data, outbound log).

## 6k. Session 13 — Supplier 消息 inbox (2026-11-07, same branch)

**Reuse first:** the supplier inbox is the other side of the buyer threads already in the preview (Supplier A's MOQ and sample conversations) plus the 询价单 clarification the RFQ screen already showed; it reuses the shared upload pre-check (`validateUploads`) with Chinese reasons, the AppShell supplier chrome, and the list-then-thread layout of the buyer inbox.

**Implemented in preview:** `/design-preview/supplier/messages?thread=` (`SupplierMessages.tsx`): 待回复-first list with status tabs and unread marks; threads with buyer questions in Chinese plus the English original and provenance, supplier replies with relay state and the platform's translation once relayed, platform notes, a 平台说明 where contact details were removed, anonymized buyer labels; a reply composer with contact and price warnings, attachments through the upload pipeline, simulated relay; the 依据 drawer with channel and visibility rules and the 转达记录. 工作台 notice, sidebar 消息 and the 询价单 clarification link wired. `supplier-messages-demo.ts` with 6 tests. Details in `SUPPLIER_ZH_CN_SCREENS.md` §3.5.

**Tests actually run:** `pnpm check` exit 0 (format, typecheck, lint, Vitest 293: web 75); `next build` exit 0; production `next start`: `/design-preview/supplier/messages` → 404. Browser: ordering and counts, warnings, attachment rejection in Chinese, submit → 待平台转达 → 已转达 with the relay log row and the 询价单 note, contact-removed notice and English translation on the relayed reply, notice and closed threads blocking the composer, unread count dropping on open, 工作台 and 询价单 links; no console errors from the preview; no horizontal page overflow at 320 / 375 / 768 / 1440 in both themes.

**Cross-track:** H-36 (supplier-side message visibility, relay state, anonymized buyer, attachments through the pipeline, free-text prices are not quotations).

## 6l. Session 14 — Supplier 产品目录 and 批量导入 (2026-11-07, same branch)

**Reuse first:** the catalog lists the same `SUPPLIER_PRODUCTS` the 阶梯报价 editor and 工作台 already use; import validation reuses `validateTiers` and `validateBasis` from `supplier-demo.ts` so a row fails for exactly the reasons the editor would show, and the upload pre-check and its Chinese reasons come from the documents and messages helpers. The AppShell was deliberately left untouched: the UX-03 session is rewriting it and owns the nav wiring (`nav.ts`), so 产品目录 is reached from the 工作台 header and the preview index until that lands.

**Implemented in preview:** `/design-preview/supplier/catalog` (`SupplierCatalog.tsx`) and `/design-preview/supplier/catalog/import` (`SupplierCatalogImport.tsx`) as described in `SUPPLIER_ZH_CN_SCREENS.md` §3.6; `demo-data/supplier-import.ts` (template columns, two sample files); `supplier-catalog-demo.ts` with 8 tests; index entries; 工作台 header link.

**Tests actually run:** `pnpm check` exit 0 (format, typecheck, lint, Vitest 301: web 83); `next build` exit 0; production `next start`: both routes → 404. Browser: catalog counts, tabs and visibility filter, 新增产品 validation and creation notice, 暂停 / 恢复 with the drawer warning; import template download, the valid sample previewing 更新 / 未变化 / 新增 with the labels diff, the error sample showing every row-numbered message, an SVG refused in Chinese, an XLSX explained as server-parsed, pasted CSV, import of the clean rows as 待确认 with the confirm links; no console errors from the preview; widths as recorded in the commit message.

**Cross-track:** H-37 (catalog import contract). Coordination: UX-03 owns AppShell / primitives / BuyerDashboard / design-preview.css; #15 merges first; nav entries for 消息 and 产品目录 handed over.

## 6m. Session 15 — Conversation-first inboxes (2026-11-08, branch `design/ux04-conversation-inbox`, stacked on PR #15)

**Brief (UX-04, relayed by the UX-03 session):** Messages screens conversation-first: compact thread list, spacious conversation panel, supplier info / evidence / approval history in an on-demand drawer, buyer and operator approval requirements still visible and functional.

**Implemented in preview:** `ui/ConversationShell.tsx` (compact list column, conversation column with a sticky composer, Details control opening an overlay drawer with Escape and focus handling, phone list → conversation → back) and `ThreadRow` (status dot, subject + time, meta + status), used by both inboxes. `BuyerMessages.tsx`: approval strip pinned above the conversation (needs your approval with Approve / Edit; returned with the operator's note; with the operator), right-aligned outbound and left-aligned inbound at a 72-character measure, chain and actions kept on every draft, drawer with supplier facts, channels, visibility, outbound log, approval history and the session log. `SupplierMessages.tsx`: status strip with 回复 focusing the composer, the same conversation treatment, 详情 drawer with 买家, 渠道, 可见范围, 转达记录 and the session log. Helpers and tests unchanged (the rules did not move). The AppShell, primitives and stylesheet were not touched (UX-03 owns them); the shell's right rail is simply not used by these two screens any more.

**Tests actually run:** `pnpm check` exit 0 (format, typecheck, lint, Vitest 301: web 83); `next build` exit 0; production `next start`: both inbox routes → 404. Browser: Atlas 1440: list column 304 px, conversation 792 px, 54 px rows; the tooling draft opens with the approval strip and its Approve / Edit; Edit from the strip opens the editor on the draft; Approve from the strip moves the thread to "With the operator", removes the Approve control everywhere and the row updates; Details opens a 384 px drawer with Supplier, Channels, Who can see it, Outbound log, Approval history and the session log, focus moves inside and Escape closes; the Supplier A thread has no strip, a sticky composer, submission adds a second outbound card and the drawer's approval history shows two chains. Supplier: the 出厂价 thread opens with the 待回复 strip, 回复 focuses the composer, 详情 opens the drawer with 买家 · 渠道 · 可见范围 · 转达记录 · 本次操作记录, a reply goes 待平台转达 → 已转达 with the strip following. Obsidian 375: list → conversation → back, the drawer at full width, the sticky composer 56 px above the viewport bottom clearing the tab bar; 320 and 768: no horizontal page overflow on either inbox with the drawer open. No console errors from the preview.

**Cross-track:** none new; H-35 and H-36 unchanged.

## 6n. Session 16 — Supplier 文件资料 (2026-11-08, branch `design/ux04-supplier-documents`, stacked on PR #17)

**Reuse first:** the library resolves the same onboarding certification items (`ONBOARDING_DOC_TYPES`) and file names the 企业认证 flow and 工作台 already show, reuses the shared upload pre-check with the Chinese reasons from the messages helper, and keeps the "供应商提供，未核验 until a platform check" rule from PRD / SECURITY.md T20 as a derived label rather than a stored flag. AppShell untouched (UX-03 wires the sidebar item).

**Implemented in preview:** `/design-preview/supplier/documents?doc=&upload=` (`SupplierDocuments.tsx`) as described in `SUPPLIER_ZH_CN_SCREENS.md` §3.7; `demo-data/supplier-documents.ts` (nine files across 企业资质, 报价与询价, 产品资料, 样品与检验 including a rejected archive and an expiring certificate); `supplier-documents-demo.ts` with 8 tests; 工作台 and onboarding links; index entry.

**Tests actually run:** `pnpm check` exit 0 (format, typecheck, lint, Vitest 309: web 91); `next build` exit 0; production `next start`: the route → 404. Browser: Atlas 1440: counts (9 files, 1 需补充, 1 待平台审核, 1 即将到期); the checklist shows 已拒绝 for 生产场地证明 with the rejected archive and its scan reason first in the list, 待平台审核 for 出口资质, 已核验 for the licence, identity and ISO files; the ISO certificate carries 即将到期（23 天）and the relayed quotation reads 已转达; the licence record refuses 删除 with the evidence reason and shows its check id; 下载链接 is logged; 重新上传 from the checklist pre-selects 企业资质 and 生产场地证明 and focuses the picker; a ZIP is refused in Chinese while a JPG beside it is added and walks 已上传 → 扫描中 → 已解析 → 待平台审核, after which 需补充 reads 0 and the checklist item follows; 替换 on the ISO certificate creates v2 as a fresh upload and marks the old file 已作废; 删除 on the file under review warns that the review is withdrawn, Escape closes, confirming removes it and the checklist item returns to 待上传; the 产品资料 tab shows two files with the spec linking to its product; 工作台 and the onboarding document step link into the library. Obsidian 375: facts below the list and the selected certificate with its expiry; 320 and 768: no horizontal page overflow. No console errors from the preview.

**Cross-track:** H-38 (supplier document library contract).

## 6o. Session 17 — Operations compliance holds (2026-11-08, branch `design/ux04-ops-compliance`, stacked on PR #19)

**Reuse first:** the hold list reuses the work queue's SLA helper (`slaFor`) so a hold's overdue chip agrees with the queue's compliance_hold task, which now opens the hold; the decision form reuses the outreach-approval pattern (effect stated before the action, audit line after) and the view-as role switch from the supplier record.

**Implemented in preview:** `/design-preview/ops/compliance?hold=` (`OpsComplianceReview.tsx`): six holds (nitrile gloves, HPLC, a disclosure grant draft, supplier provenance, a declined ingestible, a food-contact release with conditions); trigger, policy basis, evidence, the buyer-facing sentence, internal notes with add; decision form with four outcomes whose downstream effect is stated per hold kind, a reason of at least 20 characters, conditions list, escalation target; operators cannot decide (fieldset disabled, reason shown); platform-admin actions marked audited; evidence drawer with the blocked list, who may do what and the 24 h target. `ops-compliance-demo.ts` with 6 tests. Details in `OPS_COMPLIANCE_REVIEW_SCREEN.md`.

**Tests actually run:** `pnpm check` exit 0 (format, typecheck, lint, Vitest 315: web 97); `next build` exit 0; production `next start`: the route → 404. Browser (built-in, dev server on :3100): Atlas 1440 — no horizontal overflow, no console errors, list of 5 active holds with the overdue HPLC hold first, view-as Operator disables the decision fieldset and shows the gate text, Claim → Decline with a 9-character reason blocked by the validator, a full reason enabled Record decision and produced the Decision panel, the appended audit note and the rail log line; `?hold=h_grant_b` opened the grant hold with its "Open record" link; the queue (Unassigned / All open) shows "Open hold" → `?hold=h_gloves`. Obsidian 375, 320 and 768 — no horizontal overflow after two fixes (the record button label no longer carries the actor name; the view-as labels shortened to Operator / Compliance / Admin), outcome cards and reason field legible at 320.

**Cross-track:** H-39 (compliance holds contract).

## 6p. Session 18 — Research inbox and new supplier (2026-11-08, branch `design/ux04-ops-crm`, stacked on PR #20)

**Reuse first:** the list screen keeps its table and filters and gains state plus the panel; the panel reuses `contactCanBeSaved` from the record's contacts tab, the `Field` / `Checkbox` primitives and the list–detail layout of the compliance screen; the inbox mirrors the 0005 columns rather than inventing fields.

**Implemented in preview:** `/design-preview/ops/research?lead=` (`OpsResearchInbox.tsx`): five leads (two fresh 1688 leads, a stale Weidian reseller, one already linked to the Foshan carton factory, one dismissed), fresh-first ordering, observation facts with the register status and freshness, record form with the 0005 rules and a blocked Alibaba.com entry, dismiss with a reason, create-supplier handoff. `/design-preview/ops/suppliers?new=1&lead=` (`OpsNewSupplier.tsx` inside `OpsSupplierList.tsx`): prefilled panel, validation, WeChat basis rule, created row first with a "New this session" chip and a notice. `ops-crm-demo.ts` with 8 tests. Details in `OPS_SUPPLIER_CRM_SCREEN.md` §2a–§2b.

**Tests actually run:** `pnpm check` exit 0 (format, typecheck, lint, Vitest 323: web 105); `next build` exit 0; production `next start`: `/design-preview/ops/research` and `/design-preview/ops/suppliers?new=1` → 404. Browser (built-in, dev server on :3100): Atlas 1440 — no overflow or console errors; empty save shows the five required-field errors; Alibaba.com shows the blocked-register refusal; max < min and MOQ 0 rejected; a valid lead saved first in the list with the log line; dismiss with a reason; the create link opened the list panel prefilled (Labels checked, origin fixed to lead, note naming the lead); empty create showed legal name and city errors; a WeChat handle without basis was refused; with basis and name the supplier was created at Lead identified, first in the table with the chip and the notice. Obsidian 375 / 320 / 768 — no horizontal overflow on either page with the forms open after one fix (the listing URL now wraps with `break-all`); "1 days ago" corrected to "1 day ago".

**Cross-track:** H-40 (research inbox and supplier creation contract); Research nav entry for UX-03.

## 6q. Session 19 — Buyer landed-cost scenarios (2026-11-08, branch `design/ux04-landed-cost`, stacked on PR #22)

**Reuse first:** the lines come from the comparison helper's `evaluateQuote` (now taking an optional FX rate, defaulting to the demo reference rate so the comparison and reports are unchanged); status chips reuse `StatusChip`; the list–detail layout and right rail follow the compliance and research screens; the data mirrors migration 0011 rather than inventing fields.

**Implemented in preview:** `/design-preview/buyer/landed-cost?snapshot=` (`BuyerLandedCost.tsx`): three saved snapshots (an October one citing an expired written sea quote and a buyer duty rate, a 25,000-piece one with no inputs, and the current forwarder + broker-reviewed one), a new-scenario panel (quantity, as-of with the resolved FX line, freight estimate, duty assumption; errors block save, warnings shown), the ranking notice, the per-quotation lines table (cards on phones), the explanation list, and the immutable snapshot panel with FX rows and inputs hash. `landed-cost-demo.ts` with 10 tests. Details in `BUYER_LANDED_COST_SCREEN.md`.

**Tests actually run:** `pnpm check` exit 0 (format, typecheck, lint, Vitest 333: web 115); `next build` exit 0; production `next start`: `/design-preview/buyer/landed-cost` → 404. Browser (built-in, dev server on :3100): Atlas 1440 — no overflow or console errors; the current snapshot shows A and B complete with "USD @ 7.2000 CNY per USD (…, 2026-11-06; 1 day before as-of)", fx_1106 cited and the ranking A $790.71 then B $862.27; new scenario: partial totals listing the excluded lines, as-of 2026-11-10 → missing_fx hint and "No USD total" for the CNY quotation while the USD one stays computable, the expired October estimate → error and Save disabled, manual air + unverified duty → two warnings and "Partial — excludes: duties and taxes", forwarder + broker → Save produced snapshot sn_new_4 with its log line; `?snapshot=sn_nov_partial` opens the partial snapshot (three eligible columns, 17 missing chips, ranking blocked by A, B and E); the project overview's Compare tab links here. Obsidian 375 / 320 / 768 — no horizontal overflow; cards replace the table below `md`; the table scrolls inside its panel at 768.

**Cross-track:** H-41 (landed-cost scenarios contract).

## 6r. Session 20 — Operations quality verification (2026-11-08, branch `design/ux04-quality`, stacked on PR #23)

**Reuse first:** the list–detail layout, the right rail and the session log follow the compliance, research and landed-cost screens; badge wording comes straight from QUALITY_ASSURANCE.md §3 and §5; the data mirrors SCHEMA_PLAN §2.9 rather than inventing tables.

**Implemented in preview:** `/design-preview/ops/quality?track=` (`OpsQualityVerification.tsx`): three tracks (Supplier A in production with the pre-shipment inspection scheduled, Supplier B at a failed pre-shipment inspection awaiting the buyer's decision, Supplier E blocked at an unapproved QSR); the eight checkpoints with states and summaries; the QSR with its sampling plan; samples and the golden sample agreement; milestones with date kinds; inspections with the resolved plan, the exact badge sentence and findings; the result form with the derived result; the buyer-decision gate; the remediation case. `quality-demo.ts` with 10 tests. Details in `OPS_QUALITY_VERIFICATION_SCREEN.md`.

**Tests actually run:** `pnpm check` exit 0 (format, typecheck, lint, Vitest 343: web 125); `next build` exit 0; production `next start`: `/design-preview/ops/quality` → 404. Browser (built-in, dev server on :3100): Atlas 1440 — no overflow or console errors; Supplier B listed first with "Buyer decision pending", release "not recommended", the exact §5 sentence for lot L-0003 and "code letter K, 125 units"; a four-character reference kept the decision button disabled with the "decision is the buyer's" sentence, a thread reference enabled it and the decision was recorded; Supplier A's form showed "200 sampled, code letter L", stayed disabled while empty, derived Fail at 11 majors, Pass at 3, Pass with rework with the checkbox, and recording produced the "passed pre-shipment inspection on 2026-11-07 with rework of found units" sentence, release "recommended" and the log line. Obsidian 375 / 320 / 768 — no horizontal overflow on both tracks with the result form open. Screenshots could not be captured this session (the browser pane was not painting); verification is by DOM probes.

**Cross-track:** H-42; Quality nav entry for UX-03.

## 6s. Session 21 — Supplier 我的报价 (2026-11-08, branch `design/ux04-supplier-quotes`, stacked on PR #24)

**Reuse first:** the update form reuses `TierTable`, the basis validator and the RFQ submission gate; statuses and transitions come from migration 0009 and ADR-021 rather than a new vocabulary; the list–detail layout and right rail follow the other zh-CN screens.

**Implemented in preview:** `/design-preview/supplier/quotes?group=` (`SupplierQuotes.tsx`): five threads (one under review, one expiring in 5 days, one expired, one confirmed with a superseded earlier version, one withdrawn); status chips and explanations; read-only terms and tiers; 撤销提交, 撤回报价 and 更新报价 by state with their gates; version history with diffs and events. `supplier-quotes-demo.ts` with 7 tests. Details in `SUPPLIER_ZH_CN_SCREENS.md` §3.8.

**Tests actually run:** `pnpm check` exit 0 (format, typecheck, lint, Vitest 350: web 132); `next build` exit 0; production `next start`: `/design-preview/supplier/quotes` → 404. Browser (built-in, dev server on :3100): Atlas 1440 — no overflow or console errors; list ordered 待审核 → 即将过期 → 已过期 → 已确认 (2 个版本) → 已撤回; the expiring thread offered 更新报价 and 撤回报价, a one-character withdraw reason kept 确认撤回 disabled with the 至少 3 个字 message; the update form listed 报价有效期、确认已按买家规格版本报价、更新原因 as missing, a validity of 2026-12-31 plus a reason cleared the gate and showed the diff 有效期：2026年11月12日 → 2026年12月31日, submitting produced v2 待审核 with the notice that the buyer still sees v1 and the log line; 撤销提交 on the pending thread recorded 提交已撤销. Obsidian 375 / 320 / 768 — no horizontal overflow with the thread view and the update form open; the English "(optional)" suffix on optional fields was replaced by （可选） to match the other supplier screens after the 768 screenshot.

**Cross-track:** H-43; 我的报价 nav entry for UX-03.

## 7. Unresolved items

- Dark `border-strong` contrast (H-21).
- Tabs roving-focus keyboard behaviour (noted in components doc).
- No automated accessibility audit; manual checks only.
- Copy approval for every marketing string (OQ-02, OQ-04, PRD §7).
- `apps/web/AGENTS.md` generated by `next dev` remains untracked (scaffold owner's call).
