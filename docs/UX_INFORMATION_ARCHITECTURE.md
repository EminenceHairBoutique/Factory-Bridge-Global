# UX INFORMATION ARCHITECTURE AND VISUAL SYSTEM

**Status:** Phase 0 design. No screens built. Mock-only prototypes may be produced in Phase 0/1 with clearly fake data labeled "DEMO".

## 1. Design intent

Audience: U.S. business buyers and professional Chinese manufacturers. The product is a **procurement workspace**, not a storefront. Everything on screen should answer: *what is this number, where did it come from, how fresh is it, and what has actually been verified?*

Anti-patterns (banned): countdown timers, "hot deal" cards, strike-through prices, supplier logo walls, star ratings without evidence, fake live counters, patriotic imagery, red "SALE" accents, infinite product grids.

## 2. Sitemap

### 2.1 Public site (`/`, EN)
```
/                      Home — headline set from master spec §2.1; CTA "Start a Sourcing Request"
/how-it-works          Brief → options → quotes → comparison → QA → handoff (process, not promises)
/quality-process       What we check, what a badge means, limits of sampling (links QA doc summary)
/categories            Pilot families only; "request another category" form
/services              Software workspace vs managed sourcing (wording pending OQ-04)
/pricing               "Pilot pricing by conversation" until validated (OQ-04)
/about                 Entity facts only after OQ-02
/suppliers/apply       供应商申请 (ZH + EN)
/contact  /faq  /legal/terms  /legal/privacy  /process-transparency
```

### 2.2 Buyer workspace (`/app`, EN)
```
/app                                   Overview: active projects, review tasks, expiring quotes, recent reports
/app/projects                          Projects list
/app/projects/new                      New Sourcing Request (wizard)
/app/projects/[id]                     Project overview: brief, status timeline, assigned operator, next action
/app/projects/[id]/brief               Brief & Spec Builder (raw → AI proposal → confirmed; versions)
/app/projects/[id]/uploads             Documents (status, scan result, review link)
/app/projects/[id]/review/[taskId]     Extraction Review (side-by-side)
/app/projects/[id]/options             Supplier Options (badges, evidence, readiness)
/app/projects/[id]/rfqs                RFQs (Phase 2) — drafts, approvals, recipients, responses
/app/projects/[id]/compare             Quote Comparison (groups, tiers, flags, FX)
/app/projects/[id]/landed-cost         Landed Cost Scenarios (lines with status)
/app/projects/[id]/qa                  Samples & Inspections (Phase 3)
/app/projects/[id]/messages            Clarifications & follow-ups (approval states visible)
/app/projects/[id]/reports             Generated PDF/CSV with assumptions
/app/suppliers/[id]                    Supplier public profile view (no contacts unless granted)
/app/settings/{organization,team,notifications,billing}
```

### 2.3 Supplier workspace (`/supplier`, 简体中文 default; EN toggle)
```
/supplier                              工作台 (Dashboard): 待处理询价、待确认价格、即将过期报价
/supplier/onboarding                   企业认证 (identity, representative, documents) — status shown as 待审核/已核验/需补充
/supplier/catalog                      产品目录 (list, 新增产品, 批量导入)
/supplier/catalog/import               批量导入 (XLSX/CSV template, preview, diff, errors per row)
/supplier/catalog/[id]                 产品详情: 规格、价格梯度、可见范围
/supplier/catalog/[id]/pricing         价格梯度 editor: 起订量 / 数量区间 / 单价 / 货币 / 单位 / 交易条款 / 有效期; buttons 确认有效 · 更新报价 · 暂停产品
/supplier/rfqs                         询价单 inbox: 接受 / 拒绝 / 需要澄清
/supplier/rfqs/[id]                    询价详情 + 提交报价 (structured form mirroring quote schema)
/supplier/quotes                       我的报价 (versions, 状态: 待审核 / 已确认 / 已过期 / 已撤回)
/supplier/documents                    文件资料 (uploads labeled 供应商提供，未核验 until reviewed)
/supplier/production                   生产与质检 (Phase 3): 里程碑更新、检验安排、证据上传
/supplier/messages                     消息
/supplier/settings/{company,team,data-sharing,notifications}
                                       数据共享设置: per-field 仅内部 / 平台买家 / 指定买家; 撤销授权
```
Copy rules for zh-CN: formal business register (您), no machine-translation artifacts; dates `2026年11月7日`; currency `¥` for CNY with code shown; numbers with Chinese grouping optional but canonical values unchanged; Incoterms kept in Latin letters with ZH gloss (FOB 离岸价).

### 2.4 Internal operations (`/ops`)
```
/ops                                   Pipeline board: projects by stage; SLA timers
/ops/research                          Manual Research Inbox (leads; "internal only" banner)
/ops/suppliers                         Supplier CRM (list, stage, checks due)
/ops/suppliers/[id]                    Profile · Facilities · Contacts (restricted panel) · Checks · Documents · Permissions
/ops/intake                            Intake Imports: upload authorized files with source_type / rights_class / permission
/ops/review                            Quotes Awaiting Review (queue, assignment)
/ops/review/[taskId]                   Extraction Review (same component as buyer, more controls)
/ops/outreach                          Outreach Approval Queue (drafts, approve/send/log)
/ops/quality                           Quality Verification (Phase 3)
/ops/cases                             Buyer Cases / tickets
/ops/compliance                        Compliance Holds (categories, products, suppliers)
/ops/integrations                      Integration Health (Phase 4; shows "Unavailable" for blocked)
/ops/audit                             Audit Explorer (read-only)
/ops/admin/{users,orgs,assignments,templates}
```

## 3. Page templates (components, in `apps/web/components`)

| Template | Used by | Key regions |
|---|---|---|
| **AppShell** | all workspaces | left nav (collapsible), top bar with org switcher + locale + notifications, content, right-side "Evidence drawer" |
| **ListPage** | projects, suppliers, quotes, RFQs | filter bar (saved views), dense data table (sticky header, column chooser, CSV export), empty state with next action |
| **RecordPage** | project, supplier, quotation | header (title, status badge, owner, freshness), tabbed sections, activity timeline (audit-derived), evidence drawer |
| **Wizard** | new brief, supplier onboarding, import | stepper, autosave as draft, validation summary, review step |
| **ReviewSplit** | extraction review | left: document viewer with anchors; right: field form with confidence bands, flags, "not in document" |
| **ComparisonMatrix** | compare | groups by basis; quotes as columns; rows: spec attrs (diff highlighting), tier, fees, lead, validity, landed lines with status chips; "why not comparable" expanders |
| **ApprovalCard** | outreach, RFQ approval | draft (ZH/EN tabs), diff from template, approver, send button disabled until approved |
| **BadgeWithEvidence** | everywhere | badge text generated from check rows; popover shows what/who/when/until |
| **FreshnessChip** | prices, listings | `observed` / `updated` / `confirmed` / `valid until` / `expired` with date |
| **StatusLine** | cost lines | `sourced` (solid), `estimated` (dashed, assumption tooltip), `missing` (hollow, red text "Missing — request") |

## 4. Visual system (restrained professional B2B)

| Token | Value (proposal) | Use |
|---|---|---|
| `--color-ink` | #0F1B2D (deep navy) | primary text, headers |
| `--color-slate` | #3A4A5E | secondary text |
| `--color-paper` | #FAF8F4 (warm white) | app background |
| `--color-surface` | #FFFFFF | cards, tables |
| `--color-line` | #E4E1DA | borders |
| `--color-accent` | #B3613A (copper) | primary actions, links (one accent only) |
| `--color-teal` | #1F6F78 | informational, "sourced" status |
| `--color-ok` | #2E7D4F | pass / confirmed |
| `--color-warn` | #B7791F | estimated / validity unconfirmed |
| `--color-danger` | #A33A2E | missing / expired / failed |
| Type | Inter (EN) + Noto Sans SC (ZH), 14 px base, 1.5 line height, tabular numerals for all numbers | |
| Density | compact tables (36 px rows), generous page margins | |
| Radius / shadow | 6 px, minimal shadow | |
| Motion | none decorative; 150 ms state transitions | |

Accessibility: WCAG AA contrast verified for every token pair; focus rings visible; tables navigable by keyboard; all status conveyed by text + icon, never color alone (ZH and EN strings both).

Terminology discipline (appears in UI exactly like this):
EN: *Indicative listing · Supplier catalog price · Factory-confirmed quote · Quote expired · Validity unconfirmed · Identity reviewed (date) · Sample approved for variant · Inspection pending · Passed inspection per checklist vN · Estimated landed cost · Confirmed logistics quote*
ZH: *参考价（平台观察） · 供应商目录价 · 工厂确认报价 · 报价已过期 · 有效期未确认 · 企业身份已核验（日期） · 样品已确认（型号） · 待检验 · 已按检验清单v N 通过检验 · 预估到岸成本 · 已确认物流报价*

## 5. Phase 0/1 prototyping rule

Mockups may be produced for buyer Compare and Review screens and the supplier pricing editor to validate with interviewees. All data in mockups is synthetic and watermarked "DEMO DATA". No mockup is deployed publicly.
