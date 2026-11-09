# Page-by-Page Blueprint — Atlas × Obsidian

**Crosswalk:** application screens (buyer, operations, supplier) are specified in `docs/design/SCREEN_INVENTORY_AND_SPECS.md`; this blueprint adds the **public marketing pages**, the **appearance and theme rules per page**, and the deltas the Atlas × Obsidian direction introduces to existing specs. Access scope per screen follows `docs/SECURITY_PERMISSION_MATRIX.md`.

Legend: Prototyped · Specified · Future.

## 1. Public marketing (English, no sign-in)

### 1.1 Home — Prototyped (`/design-preview/marketing`)

| Region | Layout | Theme | States / notes |
|---|---|---|---|
| Top bar | mark, five links, Sign in, Start a request; drawer below 1024 px | follows appearance | sticky, 64 px |
| Hero | 2-column ≥ 1024 (copy / bridge figure), stacked below; headline 72 → 44 → 38 px | **Obsidian always** | two radial tints ≤ 14 % alpha; no images |
| Value pillars | 4 cards ≥ 1024, 2 at tablet, 1 at phone | Atlas/Obsidian per appearance | each pillar names a mechanism |
| Process timeline | 5 numbered steps (a real sequence), each with "who acts" | surface band | no step implies automation |
| Pilot categories | 3 cards with Chinese gloss and an example requirement; blocked categories sentence | canvas | |
| Evidence explanation | 2-column: title + four badge meanings including "Contacted ≠ verified" | surface band | |
| Closing CTA | headline + CTA | **Obsidian always** | |
| Footer | approval caveat, links incl. 供应商申请 | | |

Mobile: single column, 16 px gutters, CTAs full width at 320 px, hero figure below copy. Verified: no horizontal overflow at 320, 375, 390, 768, 1024, 1440.

### 1.2 How it works — Specified
Page title 36/28; five sections mirroring the timeline with a "handoff boundaries" box: what the service does, what the buyer decides, what remains the buyer's contract with the factory. Obsidian band only for the closing CTA.

### 1.3 Services — Specified
Editorial modular blocks (alternating text / figure), each with approved-claims copy and a "what you receive" list. No pricing tiers.

### 1.4 Categories — Specified
Three family pages or anchors: requirement examples, attribute fields the brief will ask for, typical MOQ ranges stated as "varies by supplier; shown on each quote". Custom inquiry link.

### 1.5 Quality process — Specified
Scope-limited evidence model: identity review, sample approval, in-line checkpoint, pre-shipment inspection; "sample ≠ batch" diagram; verification limits paragraph.

### 1.6 Pricing — Specified
"Pilot pricing by conversation" card and a request-a-call form (no backend); no plan grid until OQ-04.

### 1.7 About — Specified
Entity facts only after OQ-02; no fabricated scale or team imagery.

### 1.8 Contact / FAQ — Specified
Accordion FAQ on MOQ, timing, quality, confidentiality, next steps; contact form fields only.

### 1.9 Supplier apply 供应商申请 — Future
Chinese-first form: company, representative, families, trade readiness, allowed Incoterms, consent to verification. English toggle.

## 2. Buyer workspace deltas

| Screen | Status | Delta from UX-01 spec |
|---|---|---|
| Login / invitation / forgot password | Prototyped (`/design-preview/auth`, `/auth/invite`; see `AUTH_AND_ORG_SETUP_SCREENS.md`) | Atlas card 420 px on canvas; Obsidian follows system; passwordless OTP primary, password secondary; invitation screen names the organization and role with a one-line explanation of the role |
| Organization onboarding + invitations | Prototyped (`/design-preview/auth/org-setup`) | 3 steps: company, destination and categories, invite team (roles explained inline: owner, admin, member, viewer) |
| Overview | Prototyped | sidebar order; "New sourcing request" primary on Home; no charts |
| Project list | Partially prototyped | search field and saved views to add in B-15; cards below 768 px |
| Create sourcing brief | Prototyped | five steps kept as Product → Quantity and destination → Specification and quality → Documents → Review (equivalent to the brief's Product → Specifications → Quantity → References → Review; the order keeps required fields earliest) |
| Project details | Prototyped (`/design-preview/buyer/project`) | stage strip, next action, status timeline with who/when, quotes at a glance, tabs Brief · Supplier options · Compare · Documents · Messages (approval chains) · Reports · Activity; evidence drawer; see `PROJECT_OVERVIEW_SCREEN.md` |
| Specification builder | Prototyped (`/design-preview/buyer/brief`) | raw input with highlighted sources, AI proposal with from input / inferred / missing provenance and 中文, per-field Accept / Edit / Not sure / Skip, versioned confirm; see `BRIEF_CONFIRMATION_SCREEN.md` |
| Supplier options | Specified | allowed attributes only; evidence labels; no ratings |
| Quote comparison | Prototyped | view filters, compare-selected mode, "What is missing" per card, export dialog with PDF/XLSX states, basis-not-stated quote shown as "Not ranked" |
| Landed cost scenarios | Prototyped (`/design-preview/buyer/landed-cost?snapshot=`) | immutable snapshots citing the exact FX rows and inputs; new scenario with quantity, as-of date (FX by the 3-day lag rule or missing_fx), freight estimate (sourced only with a document; expired ones refused) and person-recorded duty assumption (no rate → line stays missing); per-quotation lines with status and source; total only when complete, else "Partial — excludes: …"; cross-term ranking only when every eligible total is complete; see `BUYER_LANDED_COST_SCREEN.md` |
| Samples and inspections | Prototyped (`/design-preview/buyer/qa?track=`) | per supplier: every quality badge in the fixed wording opening to what / who / when / checklist version / scope; the eight steps in the buyer's words; samples, golden sample agreement, milestones with estimated vs committed dates; inspections with findings and the limits of sampling stated with the plan's numbers; the decision after a failed inspection recorded as the buyer's with an acknowledgement and relayed by the platform; remediation in plain words; no supplier contact data; see `BUYER_QA_STATUS_SCREEN.md` |
| Documents and review | Prototyped (`/design-preview/buyer/documents`, `/design-preview/buyer/review?doc=`) | document library with pipeline status, who acts next, scan result, extraction flags, linked record, access log, simulated upload, discard with confirmation; buyer review reuses `ui/ReviewSplit.tsx` read-only with flag-for-operator and notes; see `DOCUMENTS_AND_EXTRACTION_REVIEW_SCREENS.md` |
| Reports | Prototyped (`/design-preview/buyer/reports`, `/design-preview/buyer/report?id=`) | versioned list with current / stale / superseded derived from recorded inputs, generate panel that lists the next version's content before it exists, file name pattern `fbg-comparison-<project>-v<brief>-<date>.<ext>` (CSV as ZIP), viewer rendered per QUOTE_ENGINE_SPEC §5 with the five ADR-024 tables and a CSV preview; see `BUYER_REPORTS_SCREENS.md` |
| Inbox | Prototyped (`/design-preview/buyer/messages`), conversation-first per UX-04 | compact needs-you-first list; spacious conversation with the approval requirement pinned above it; sticky composer; supplier, evidence and approval history in an on-demand drawer; threads in both languages with translation provenance; approval chain You → Operator → Sent on every outbound message with approve, edit (approvals reset) and withdraw; composer submitting to the operator queue over the channels the recorded contact basis allows; inbound flags; outbound log; see `BUYER_MESSAGES_SCREEN.md` |
| Settings | Specified | organization, team and account |

## 3. Operations deltas

| Screen | Status | Delta |
|---|---|---|
| Review split | Prototyped (shared `ui/ReviewSplit.tsx`) | sidebar renamed Reviews; dialogs use 20 px radius; anchors highlighted with the brand accent; document source, rights class, scan time and fingerprint in the task header; extraction flags as notices (danger for text addressed to the system); pending tasks read-only until Assign to me |
| Suppliers (list and record) | Prototyped (`/design-preview/ops/suppliers`, `/design-preview/ops/supplier`) | sortable list with `aria-sort`, filters; record with generated badge preview, stage gate, claimed vs verified, restricted contacts with contact basis and disclosure grants, checks, documents with rights class, source permissions; see `OPS_SUPPLIER_CRM_SCREEN.md` |
| Research inbox and new supplier | Prototyped (`/design-preview/ops/research?lead=`, `/design-preview/ops/suppliers?new=1&lead=`) | fresh-first lead list with staleness; observation facts labelled internal-only with the source register status; record-a-lead form with the 0005 rules and a blocked register entry; dismiss with a reason; create-supplier panel prefilled from the lead (family and origin, never the name) with the contact-basis rule; created row chipped "New this session"; see `OPS_SUPPLIER_CRM_SCREEN.md` §2a–§2b |
| Compliance holds | Prototyped (`/design-preview/ops/compliance?hold=`) | urgency-ordered hold list with SLA chips; trigger, policy basis, evidence, what the buyer sees, internal notes; decision form stating the effect before recording who, role, when, reason, conditions; view-as role gate; see `OPS_COMPLIANCE_REVIEW_SCREEN.md` |
| Quality verification | Prototyped (`/design-preview/ops/quality?track=`) | one track per project × supplier × variant through the eight QA steps; QSR with the sampling plan resolved for the lot (illustrative); samples and golden sample agreement; milestones chipped reported / committed / estimated; inspections with the exact badge sentence and findings; result derived from the accept numbers with a report required; release recommendation; the buyer's decision recorded only against the buyer's message; remediation case vocabulary; see `OPS_QUALITY_VERIFICATION_SCREEN.md` |
| Buyer cases | Prototyped (`/design-preview/ops/cases?case=`) | cases ordered by derived priority with internal pilot targets; linked records; timeline marking what the buyer sees; reply composer that blocks claims and response-time promises and names the record it concerns; internal notes; resolution with a code and a buyer-visible note; escalation with target and reason; reopen only with the buyer's own message; see `OPS_BUYER_CASES_SCREEN.md` |
| Work queue + pipeline | Prototyped (`/design-preview/ops/queue`) | SLA-ordered queue with claim, inline outbound approval and reply relay; pipeline board by stage with targets; see `OPS_WORK_QUEUE_SCREEN.md` |
| Pipeline board | Prototyped (`/design-preview/ops/pipeline?project=`) | board and list of every project by stage with targets, computed attention reasons, who owes the next move and operator load; filters; a project drawer with the next stage's requirements and owners, recording an operator-owned move only when every requirement is met (stages derived from records, never dragged), lead assignment with a reason to reassign, open work items and stage history; see `OPS_PIPELINE_BOARD_SCREEN.md` |
| Projects, Research, Cases, Admin | Specified | dense tables at 14 px, sortable headers with `aria-sort`, filters in a sticky bar; command palette future |

## 4. Supplier (Chinese-first) — 工作台, 阶梯报价, 询价单 / 提交报价, 数据共享设置 prototyped 2026-11-07 (see `SUPPLIER_ZH_CN_SCREENS.md`); the rest specified

| Screen | Key content |
|---|---|
| 工作台 | 待处理询价 · 待确认价格 · 即将过期报价 · 认证状态 |
| 企业资料 / 企业认证 | **Prototyped** (`/design-preview/supplier/onboarding`): five-step 企业认证 with check-digit-validated 统一社会信用代码, contact basis, documents labelled 供应商提供，未核验 until reviewed, trade readiness, consent; opens in the 需补充 state; see `SUPPLIER_ONBOARDING_SCREEN.md` |
| 产品目录 / 批量导入 | **Prototyped** (`/design-preview/supplier/catalog`, `/design-preview/supplier/catalog/import`): list with price state and visibility, 新增产品 (priced later, 待确认), 暂停 / 恢复; import with template download (CSV, UTF-8 with BOM, one row per tier), file or pasted CSV or sample files, per-product preview with row-numbered Chinese errors and warnings and the diff against the catalog, import of clean rows as 待确认; see `SUPPLIER_ZH_CN_SCREENS.md` §3.6 |
| 阶梯报价 | 起订量 · 数量区间 · 单价 · 货币 · 单位 · 交易条款 (code + 指定地点 required; 出厂价 alone is stored as unknown) · 有效期 · 规格版本; actions 确认有效 · 更新报价 · 暂停产品 |
| 询价单 | accept / decline / 需要澄清; structured quote form mirroring the quote schema; buyer specification shown read-only in both languages |
| 消息 | **Prototyped** (`/design-preview/supplier/messages?thread=`), conversation-first per UX-04 (compact list, status strip, sticky composer, 详情 drawer): buyer questions relayed in Chinese with the English original and translation provenance; the supplier's replies with their relay state (待平台转达 → 已转达); platform notices; anonymized buyer label; reply composer that warns on contact details and prices and routes attachments through the upload pipeline; relay log; see `SUPPLIER_ZH_CN_SCREENS.md` §3.5 |
| 文件资料 | **Prototyped** (`/design-preview/supplier/documents?doc=`): every file with pipeline status, review state (供应商提供，未核验 until a platform check), expiry, linked record and visibility; certification checklist with upload prompts; upload with the shared pre-check and a simulated pipeline; replace as a new version; delete only where not evidence; logged signed links; see `SUPPLIER_ZH_CN_SCREENS.md` §3.7 |
| 我的报价 | **Prototyped** (`/design-preview/supplier/quotes?group=`): one thread per RFQ with immutable versions and the fixed statuses 待审核 / 已确认 / 即将过期 / 已过期 / 已更新 / 已撤回; read-only terms and tiers; 撤销提交 while under review, 撤回报价 with a reason, 更新报价 as a new version that enters review while the previous stays visible to the buyer; version history with diffs and events; see `SUPPLIER_ZH_CN_SCREENS.md` §3.8 |
| 生产与质检 | **Prototyped** (`/design-preview/supplier/production?order=`): the supplier's own orders; milestones with 已发生 / 预计 / 承诺 dates and evidence, progress never lower, a reason and a 交期变更 flag for moved committed dates; inspection schedule with readiness conditions, confirmation (commits the packing date) or a reschedule request; results in the fixed Chinese wording with corrective action per major finding; QSR and samples in Chinese; see `SUPPLIER_ZH_CN_SCREENS.md` §3.9 |
| 数据共享设置 | per-field 仅内部 / 平台买家 / 指定买家; 撤销授权 with its effect explained |

Formats: dates 2026年11月7日, ¥ with `CNY` code, tabular numerals, Incoterms in Latin letters.

## 5. Mobile adaptation summary

Every application page keeps a single column below 768 px, 16 px gutters, sticky top bar, four tabs, sheet navigation. Horizontal scrolling is allowed only inside bounded regions: the comparison card carousel, the stepper, and data tables wider than the viewport (each scrolls inside its panel; the page never scrolls sideways).
