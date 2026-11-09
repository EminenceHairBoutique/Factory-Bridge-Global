# Screen Inventory and Specifications

Status key: **Prototyped** (interactive, local state, in `apps/web/src/design-preview/`), **Specified** (described here, not built), **Planned** (named in the IA only).

## 1. Inventory

### 1.1 Buyer workspace (English)

| Screen | Route | Status | Backlog |
|---|---|---|---|
| Overview / dashboard | `/app` | Prototyped | B-15, B-24, B-25 |
| Projects list | `/app/projects` | Partially prototyped (table on dashboard) | B-15 |
| New sourcing request | `/app/projects/new` | Prototyped | B-15, B-17, B-27 |
| Project overview | `/app/projects/[id]` | Prototyped (`/design-preview/buyer/project`; see `atlas-obsidian/PROJECT_OVERVIEW_SCREEN.md`) | B-15 |
| Brief & spec builder (AI proposal confirm) | `/app/projects/[id]/brief` | Prototyped (`/design-preview/buyer/brief`; see `atlas-obsidian/BRIEF_CONFIRMATION_SCREEN.md`) | B-17 |
| Documents | `/app/projects/[id]/uploads` | Prototyped (`/design-preview/buyer/documents`; see `atlas-obsidian/DOCUMENTS_AND_EXTRACTION_REVIEW_SCREENS.md`) | B-10, B-11 |
| Extraction review (buyer) | `/app/projects/[id]/review/[taskId]` | Prototyped (`/design-preview/buyer/review?doc=`; shared `ui/ReviewSplit.tsx`, read-only with flag-for-operator) | B-20 |
| Supplier options | `/app/projects/[id]/options` | Specified §3.3 | B-09 |
| Quote comparison + landed cost | `/app/projects/[id]/compare`, `/landed-cost` | Prototyped | B-22, B-14, B-21 |
| Messages / clarifications | `/app/projects/[id]/messages` | Prototyped (`/design-preview/buyer/messages?thread=`; see `atlas-obsidian/BUYER_MESSAGES_SCREEN.md`) | B-24 |
| Reports | `/app/projects/[id]/reports` | Prototyped (`/design-preview/buyer/reports`, `/design-preview/buyer/report?id=`; see `atlas-obsidian/BUYER_REPORTS_SCREENS.md`) | B-23 |
| Supplier public profile | `/app/suppliers/[id]` | Specified §3.4 | B-08b |
| Settings | `/app/settings/*` | Planned | B-05 |
| Sign-in, invitation, organization setup | `/sign-in`, `/invite/[token]`, `/app/onboarding` | Prototyped (`/design-preview/auth`, `/auth/invite`, `/auth/org-setup`; see `atlas-obsidian/AUTH_AND_ORG_SETUP_SCREENS.md`) | B-05 |

### 1.2 Supplier workspace (简体中文 default)

| Screen | Route | Status |
|---|---|---|
| 工作台 Dashboard | `/supplier` | Prototyped (`/design-preview/supplier/dashboard`; see `atlas-obsidian/SUPPLIER_ZH_CN_SCREENS.md`) |
| 企业认证 Onboarding | `/supplier/onboarding` | Prototyped (`/design-preview/supplier/onboarding`; see `atlas-obsidian/SUPPLIER_ONBOARDING_SCREEN.md`) |
| 产品目录 / 批量导入 | `/supplier/catalog`, `/import` | Prototyped (`/design-preview/supplier/catalog`, `/design-preview/supplier/catalog/import`; see `atlas-obsidian/SUPPLIER_ZH_CN_SCREENS.md` §3.6) |
| 价格梯度 editor | `/supplier/catalog/[id]/pricing` | Prototyped (`/design-preview/supplier/pricing`) |
| 询价单 / 提交报价 | `/supplier/rfqs`, `/[id]` | Prototyped (`/design-preview/supplier/rfqs`; Phase 2 feature) |
| 数据共享设置 | `/supplier/settings/data-sharing` | Prototyped (`/design-preview/supplier/sharing`) |
| 消息 | `/supplier/messages` | Prototyped (`/design-preview/supplier/messages?thread=`; see `atlas-obsidian/SUPPLIER_ZH_CN_SCREENS.md` §3.5) |
| 文件资料 | `/supplier/documents` | Prototyped (`/design-preview/supplier/documents?doc=`; see `atlas-obsidian/SUPPLIER_ZH_CN_SCREENS.md` §3.7) |

### 1.3 Internal operations

| Screen | Route | Status |
|---|---|---|
| Quotes awaiting review + review split | `/ops/review`, `/ops/review/[taskId]` | Prototyped (concept, refined onto shared `ui/ReviewSplit.tsx`; document facts, extraction flags incl. the embedded-instruction security notice, pending tasks read-only until assigned) |
| Pipeline board + work queue | `/ops` | Prototyped (`/design-preview/ops/queue`; see `atlas-obsidian/OPS_WORK_QUEUE_SCREEN.md`) |
| Supplier CRM + profile | `/ops/suppliers`, `/[id]` | Prototyped (`/design-preview/ops/suppliers`, `/design-preview/ops/supplier?id=`; see `atlas-obsidian/OPS_SUPPLIER_CRM_SCREEN.md`) |
| Compliance holds | `/ops/compliance` | Prototyped (`/design-preview/ops/compliance?hold=`; see `atlas-obsidian/OPS_COMPLIANCE_REVIEW_SCREEN.md`) |
| Research inbox | `/ops/research` | Specified §5.3 |
| Outreach approval queue | `/ops/outreach` | Specified §5.4 |
| Compliance holds, audit explorer, intake | `/ops/compliance`, `/ops/audit`, `/ops/intake` | Planned |

## 2. Prototyped screens

### 2.1 Buyer dashboard — `/design-preview/buyer/dashboard`

**Job:** answer "what needs me, and how fresh is what I am looking at?" in one screen.

Regions (desktop, top to bottom):
1. Page header: title, lead, meta chips (as-of date, organization), actions (Upload a quote · New sourcing request).
2. **Needs your action** (2/3 width) — list of approval/decision items. Each row: kind icon, title, detail, project name, due text, verb button (Review / Confirm / Review draft / Open comparison / Continue brief), Hide. Sub-text: "Nothing is sent to a supplier, confirmed or ordered without one of these approvals."
3. **Quote status** (1/3) — counts derived from quote records: factory-confirmed, awaiting review, expiring within 60 days, validity unconfirmed, expired. Link to the labels comparison.
4. **Sourcing projects** — filter (All · Needs my action · Quotes in review · Comparison ready); table: project (name, family, brief version, destination), stage strip (7 segments + "step n of 7"), quantity, quotes (confirmed / in review / expiring), next action (links when the destination exists), updated.
5. **Supplier options on the labels project** (2/3) — supplier, city, basis, currency, validity line; evidence badges or "No verification record yet"; footer sentence summarising evidence coverage and the contact-grant rule.
6. **Recent activity** (1/3) — audit-derived list with freshness chips.

Interactions: filter projects; hide action items (local); evidence popovers; links to the other prototypes.

Responsive: below `md` the projects table becomes stacked cards; action rows stack their buttons under the text; the shell switches to the bottom tab bar.

Acceptance mapping: no invented KPIs (CLAUDE.md §4); badges from records (US-O4); contacts hidden (§3.3 matrix).

### 2.2 New sourcing request — `/design-preview/buyer/new-request`

**Job:** capture a brief in the buyer's words with the minimum required to request options (AC-B1.1), while making "unknown" an honest answer.

Steps:
1. **Product** — category radio grid (pilot families; "Another category" routed to operator review; blocked categories visible but disabled with "Compliance review required — not self-service"); product name; English description (required); 中文 description (optional, `lang="zh-CN"`); variants/SKUs rows (add/remove).
2. **Quantity and destination** — quantity (numeric, required), unit, destination ZIP (5-digit, required), city/state, target lead time, target trade term (default "Not sure — advise me" = `unknown`), target unit price (shared with operators only).
3. **Specification and quality** — attribute fields per family (labels / cartons / hair); hard attributes required with "Not sure" allowed; tolerances; compliance checkboxes; sample approval; inspection level; quality notes.
4. **Documents** — drop zone and file picker; client-side type/size check (PDF, XLSX, CSV, PNG, JPG ≤ 25 MB per AC-B2.1) with rejection list; local-only attachment list with "Will be scanned" chips; reference links.
5. **Review and submit** — missing-field notice (lists exactly what blocks submission) or ready notice; summary with per-field `from input` / `missing` tags; "What happens after you submit" (versions, AI proposal with from_input/inferred/missing, operator assignment, extraction review); Submit disabled while required fields are missing; Save draft always available.

Interactions: per-step validation on Continue; completed steps reachable from the stepper; local autosave indicator; submission confirmation state with "Start another request".

Responsive: vertical stepper on `lg+`, horizontally scrolling stepper below; sticky action bar above the tab bar on phones.

Open points for B-15/B-17: attribute definitions should come from `attribute_definitions` (migration 0004) rather than the in-file list; the "Structure with AI" proposal screen is specified in §3.2.

### 2.3 Quote comparison — `/design-preview/buyer/compare`

**Job:** show like-for-like comparison with every exclusion and every missing input explained (US-B4, QUOTE_ENGINE_SPEC §2).

Header: project title; lead sentence; chips for brief version + confirmation date, as-of date, FX reference ("USD @ 7.20 CNY/USD (source, date)"); quantity segmented control (5,000 / 10,000 / 25,000 pcs); Export report (inert; B-23).

**Why these quotes are shown in groups** panel: plain-language explanation; legend for sourced / estimated / missing; **landed-cost inputs**: checkbox to apply the forwarder estimate as `estimated` lines; duty rate + source fields (buyer assumption, never auto-filled); result notice: "Lowest estimated landed cost (all inputs present)" or "Cross-group ranking unavailable: required lines are still missing for …".

Groups: one per `price_basis + place` with eligible quotes, plus **Not ranked**. Group header shows count and "Lowest comparable goods cost: Supplier X" when ≥ 2 quotes.

Matrix rows (per quote column): quote type + validity badges; validity chip; confirmed chip; source document reference and source type; hard spec attributes vs brief (mismatch in danger with "≠ expected"); soft attributes (differs, still comparable); tier list with the selected tier marked and MOQ; unit price (original + converted); goods for quantity; one-time fees; comparable goods cost (sort key); lead time; payment terms; verification evidence; landed-cost lines with status markers and source; estimated landed total (complete) or "Partial — excludes: …".

Excluded quotes show only quote, spec and tier rows plus the reason: Expired date · Below MOQ (MOQ n) · Not comparable — specification differs (attributes) · Price basis not stated.

Evidence drawer (xl right rail; panel below on smaller screens): checks with what/who/when/until; explicit "Not verified" line (product tested, batch inspected); source document with observed/confirmed dates; contact details hidden without a disclosure grant; **Request clarification** → modal with bilingual draft; Send disabled until operator approval (AC-B6.1).

Behaviour verified in the browser: changing quantity re-selects tiers and moves quotes between groups and "Not ranked"; applying the forwarder estimate leaves duties missing (total stays partial); adding a duty assumption with a source completes every included quote and reveals the cross-group ranking.

Responsive: `< lg` renders each group as a horizontally snapping carousel of quote cards with the same rows; the selected card's evidence appears below.

### 2.4 Operations quotation review (concept) — `/design-preview/ops/quote-review`

**Job:** make the operator check each extracted value against its source before anything becomes a quotation (US-B3, AC-B3.1–B3.4).

Regions: internal-workspace notice; header with queue counts; **Queue** (supplier, status, project, document, received, buyer org, assignee); **Review split**: source document pane (synthetic Chinese quotation sheet with addressable lines; active anchor highlighted) and extracted-fields pane (label, confidence band, value input or basis select, anchor button or "Not in document", flag text); **Corrections** (before → after, who, when); **Accept as quotation v1** with the gate (currency, unit, ≥ 1 tier, price basis which may be `unknown`), "Mark basis unknown" shortcut, Reject document.

Interactions: select task; assign a pending task to yourself; click an anchor to highlight and scroll the line; edit a value (creates a correction, raises confidence to high); mark basis unknown; accept (shows the immutable-version notice). Phones toggle between Document and Fields panes.

Design decisions to carry into B-20: the colloquial-term flag (出厂价 → basis unknown) is shown inline on the field and repeated in the gate notice; confidence is a three-segment band plus text, never a percentage; the document pane must become a real PDF/XLSX viewer with page/bbox anchors (B-12 output).

## 3. Specified buyer screens (not built)

### 3.1 Project overview `/app/projects/[id]`
RecordPage: header (name, stage strip, operator, next action), tabs Brief · Documents · Options · Compare · Messages · Reports; activity timeline from audit events; evidence drawer with brief version history.

### 3.2 Brief & spec builder `/app/projects/[id]/brief`
Three columns on desktop (raw input · AI proposal · confirmed), two on tablet, stacked on phone. Each proposed field carries `from_input` (teal), `inferred` (warn, "not used for matching until confirmed"), `missing` (danger, "needed"). ZH translation beside EN. Confirm creates a new brief version; versions listed with timestamps (AC-B1.2, B1.3).

### 3.3 Supplier options `/app/projects/[id]/options`
ListPage of supplier + product rows: spec-fit summary, last updated, price type badge, readiness to quote, evidence badges. No contact column. "Request quotes" opens the approval card.

### 3.4 Supplier public profile `/app/suppliers/[id]`
Reads only `supplier_public_profile_v`: name, city, families, stage badge, checks summary, catalog rows the org is granted. "Contact details hidden" lock line; "Ask operator to request disclosure".

## 4. Specified supplier screens (zh-CN first)

Shared rules: formal register (您), dates 2026年11月7日, ¥ with `CNY` code, Incoterms in Latin letters with gloss (FOB 离岸价), EN toggle in the top bar, same shell with supplier tabs (工作台 · 询价单 · 我的报价 · 产品目录).

4.1 **工作台** — 待处理询价 (RFQs awaiting a response), 待确认价格 (prices awaiting confirmation), 即将过期报价 (expiring quotes), 企业认证状态 (待审核/已核验/需补充).
4.2 **企业认证** — identity, representative, documents; every upload labelled 供应商提供，未核验 until reviewed.
4.3 **产品目录 / 批量导入** — list, 新增产品, template download, preview with per-row errors and diff before commit.
4.4 **价格梯度** — rows: 起订量 · 数量区间 · 单价 · 货币 · 单位 · 交易条款 (select, `unknown` allowed, named place required for FOB/FCA) · 有效期; actions 确认有效 · 更新报价 · 暂停产品; overlapping tiers rejected inline; tier non-monotonic warning.
4.5 **询价单 / 提交报价** — accept / decline / 需要澄清; structured quote form mirroring the quote schema; buyer's approved specification shown read-only in both languages.
4.6 **数据共享设置** — per-field 仅内部 / 平台买家 / 指定买家; 撤销授权 with effect explained (catalog rows disappear from buyer views immediately; issued quotes remain in the buyer's record).

## 5. Specified operations screens

5.1 **Pipeline** — board by stage with SLA timers; cards show buyer org, next action, assignee.
5.2 **Supplier CRM / profile** — tabs Profile · Facilities · Contacts (restricted panel, `contact_basis` required for WeChat handles, visible only when assigned) · Checks (rows with evidence, reviewer, date, expiry; badge preview generated from completed rows) · Documents · Permissions (source_permissions scope editor).
5.3 **Research inbox** — "Internal research reference — not a supplier offer" banner on every row; platform, reference, ZH search term, observed date; `rights_class` fixed.
5.4 **Outreach approval queue** — ApprovalCard: ZH/EN draft tabs, diff from template, approver, send disabled until approved; outbound log columns channel · approver · timestamp.

## 6. Responsive behaviour summary

| Breakpoint | Shell | Lists | Matrix | Wizard | Review |
|---|---|---|---|---|---|
| < 768 (phone) | top bar + bottom tabs + sheet | cards | card carousel per group | horizontal stepper, sticky bar | pane toggle |
| 768–1023 (tablet) | rail (collapsible) | table | card carousel | horizontal stepper | pane toggle |
| 1024–1279 (laptop) | rail | table | matrix, drawer below | vertical stepper | split |
| ≥ 1280 (desktop) | rail | table | matrix + right drawer | vertical stepper | split + sticky queue |
