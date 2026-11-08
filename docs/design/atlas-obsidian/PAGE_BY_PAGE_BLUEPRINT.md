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
| Login / invitation / forgot password | Specified | Atlas card 420 px on canvas; Obsidian follows system; passwordless OTP primary, password secondary; invitation screen names the organization and role with a one-line explanation of the role |
| Organization onboarding + invitations | Specified | 3 steps: company, destination and categories, invite team (roles explained inline: owner, admin, member, viewer) |
| Overview | Prototyped | sidebar order; "New sourcing request" primary on Home; no charts |
| Project list | Partially prototyped | search field and saved views to add in B-15; cards below 768 px |
| Create sourcing brief | Prototyped | five steps kept as Product → Quantity and destination → Specification and quality → Documents → Review (equivalent to the brief's Product → Specifications → Quantity → References → Review; the order keeps required fields earliest) |
| Project details | Prototyped (`/design-preview/buyer/project`) | stage strip, next action, status timeline with who/when, quotes at a glance, tabs Brief · Supplier options · Compare · Documents · Messages (approval chains) · Reports · Activity; evidence drawer; see `PROJECT_OVERVIEW_SCREEN.md` |
| Specification builder | Prototyped (`/design-preview/buyer/brief`) | raw input with highlighted sources, AI proposal with from input / inferred / missing provenance and 中文, per-field Accept / Edit / Not sure / Skip, versioned confirm; see `BRIEF_CONFIRMATION_SCREEN.md` |
| Supplier options | Specified | allowed attributes only; evidence labels; no ratings |
| Quote comparison | Prototyped | view filters, compare-selected mode, "What is missing" per card, export dialog with PDF/XLSX states, basis-not-stated quote shown as "Not ranked" |
| Documents and review | Concept (ops) | buyer variant reuses the split with fewer controls |
| Reports | Specified | versioned list, assumptions preview, file name pattern `fbg-comparison-<project>-v<brief>-<date>.<ext>` |
| Inbox / settings | Specified | approval stages visible on every thread |

## 3. Operations deltas

| Screen | Status | Delta |
|---|---|---|
| Review split | Prototyped (concept) | sidebar renamed Reviews; dialogs use 20 px radius; anchors highlighted with the brand accent |
| Work queue, Projects, Research, Suppliers, Cases, Admin | Specified | dense tables at 14 px, sortable headers with `aria-sort`, filters in a sticky bar; command palette future |

## 4. Supplier (Chinese-first) — 工作台, 阶梯报价, 询价单 / 提交报价, 数据共享设置 prototyped 2026-11-07 (see `SUPPLIER_ZH_CN_SCREENS.md`); the rest specified

| Screen | Key content |
|---|---|
| 工作台 | 待处理询价 · 待确认价格 · 即将过期报价 · 认证状态 |
| 企业资料 / 企业认证 | **Prototyped** (`/design-preview/supplier/onboarding`): five-step 企业认证 with check-digit-validated 统一社会信用代码, contact basis, documents labelled 供应商提供，未核验 until reviewed, trade readiness, consent; opens in the 需补充 state; see `SUPPLIER_ONBOARDING_SCREEN.md` |
| 产品目录 | list, 新增产品, 批量导入 with preview and per-row errors |
| 阶梯报价 | 起订量 · 数量区间 · 单价 · 货币 · 单位 · 交易条款 (code + 指定地点 required; 出厂价 alone is stored as unknown) · 有效期 · 规格版本; actions 确认有效 · 更新报价 · 暂停产品 |
| 询价单 | accept / decline / 需要澄清; structured quote form mirroring the quote schema; buyer specification shown read-only in both languages |
| 文件与消息 | documents with provenance; messages with approval states |
| 数据共享设置 | per-field 仅内部 / 平台买家 / 指定买家; 撤销授权 with its effect explained |

Formats: dates 2026年11月7日, ¥ with `CNY` code, tabular numerals, Incoterms in Latin letters.

## 5. Mobile adaptation summary

Every application page keeps a single column below 768 px, 16 px gutters, sticky top bar, four tabs, sheet navigation. Horizontal scrolling is allowed only inside bounded regions: the comparison card carousel, the stepper, and data tables wider than the viewport (each scrolls inside its panel; the page never scrolls sideways).
