# Supplier Workspace (zh-CN) — Prototyped Screens

**Status:** prototyped 2026-11-07 in the UX-01 / DESIGN-02 design preview (Atlas × Obsidian, same branch, PR #10). Simplified Chinese first per IA §2.3 and master spec §8. All records are synthetic (演示数据). Nothing reads from a database, calls an API, or contacts anyone.

Routes (dev only, 404 in production builds): `/design-preview/supplier/{dashboard,pricing,rfqs,sharing}`.

## 1. Chrome and navigation

- `AppShell` gains `workspace="supplier"`: the shell root carries `lang="zh-CN"`, so Noto Sans SC applies through the existing `:lang(zh-CN)` rule; chrome strings (规划中, 外观, 收起, 打开导航, 通知, 关闭) come from a small locale table; the demo stripe is bilingual (演示数据 — 非真实供应商报价。DEMO DATA — NOT REAL SUPPLIER QUOTATIONS.).
- Sidebar: 工作台 · 企业资料 · 产品目录 · 阶梯报价 · 询价单 · 文件与消息 · 数据共享设置; bottom: 账户 · 外观 (Atlas · Obsidian · 跟随系统).
- Phone tabs: 工作台 · 询价单 · 报价 · 账户 (ordered independently of the sidebar via `mobileOrder`).
- The EN / 中文 toggle defaults to 中文 and remains visual only in the prototype.

## 2. Copy rules applied

| Rule (IA §2.3) | Applied as |
|---|---|
| Formal register | 您 throughout; no machine-translation artefacts; sentence-level copy written for factory staff |
| Dates | `2026年11月7日` via `formatZhDate` |
| Currency | `¥0.2100 CNY` via `formatZhMoney` (symbol plus ISO code); USD as `$0.0270 USD` |
| Numbers | tabular numerals (`.fbg-num`), `zh-CN` grouping |
| Incoterms | Latin code with gloss in selects (FOB 离岸价, EXW 工厂交货 …); `unknown` shown as 未注明（请确认） |
| Buyer identity | 平台买家（美国 · 新泽西州）until a disclosure grant exists |
| Evidence wording | 供应商提供，未核验 on uploads; 企业身份已核验 only with a date |

## 3. Screens

### 3.1 工作台 — `SupplierDashboard.tsx`

Regions: page header (截至 date, supplier name and city, primary action 新增阶梯报价); **待处理询价** (status 待回复 / 需要澄清, reply deadline with days left, red under 3 days; actions 查看并报价 / 回复澄清); **企业认证状态** (overall 需补充 / 待审核 / 已核验, per-item rows with dates or the missing-document note, 上传生产场地证明); **待确认价格** (products whose basis is 未注明 or whose validity is missing, with the exact reason and 补充并确认); **即将过期报价** (within 14 days, 确认有效 extends locally, 更新报价 deep-links to the editor); **最近动态** from the audit trail.

Rules shown: unconfirmed basis or validity never reaches buyers; the platform never quotes on the supplier's behalf.

### 3.2 阶梯报价 — `SupplierPricing.tsx` (+ `ui/TierTable.tsx`)

Product list with status and visibility badges (deep-link `?product=`). Editor: 货币, 计价单位, 交易条款 (code with gloss) + 指定地点 (required for port and destination terms, recommended for EXW, error text inline), colloquial-term notice when the source quote said 出厂价; **tier table** with per-row validation (起订量 required, 上限 > 起订量, ascending, no overlap, no tier after an open-ended one; warnings for gaps and non-monotonic prices), range preview per row, 添加档位; 模具 / 刀模费 with 已包含在单价内; 交期; 有效期至 (required); 可见范围 radio with the "intent, not permission" explanation and named buyers for 指定买家. Sticky action bar: 暂停产品, 更新报价 (→ 待平台审核), 确认有效 (enabled only when tiers are valid, basis is a real term with its place, and validity is set).

Verified in the browser: overlap blocks 确认有效 with the inline message; fixing basis + place + validity enables it; confirming shows the dated message.

### 3.3 询价单 / 提交报价 — `SupplierRfqs.tsx`

List with 全部 / 待回复 / 需要澄清 / 已报价 / 已拒绝 filters (collapsible selector on phones). Detail: buyer label, quantity, destination, target term, received and reply-by dates, attachments with 已通过安全扫描; **买家确认的规格** read-only table with zh and en labels and 必须匹配 / 可有差异 tags; buyer notes; platform clarification notice in both languages when present. Actions by status: 待回复 → 接受并报价 / 需要澄清 / 拒绝; 需要澄清 → 回复澄清 / 接受并报价; 已报价 → 待平台审核 notice; 已拒绝 → neutral notice.

**提交报价** form mirrors the quote schema: 货币, 单位, 交易条款 + 地点, tier table (prefilled from the matching catalog product when one exists), 模具费 + included flag, 交期, 付款方式, 有效期至 (required), 备注, spec-version confirmation checkbox. Submission gate lists in Chinese: 货币, 单位, 至少一档有效的阶梯价格, 交易条款的指定地点, 报价有效期, 确认已按买家规格版本报价. Visibility of a submitted quote is fixed to 仅此买家. Submit → status 已报价, 待平台审核.

Verified in the browser: gate shows 2 missing items on open; setting validity and the confirmation enables submit; submitting changes the list status to 已报价.

### 3.4 数据共享设置 — `SupplierSharing.tsx`

Per-field 仅内部 / 平台买家 / 指定买家 segmented radios; 联系人信息 locked to 仅内部 with the disclosure-grant note; 保存设置 (local). **已记录的授权** table (buyer, field, since, until, status) with 撤销授权 → confirmation dialog stating the three effects from SECURITY_PERMISSION_MATRIX §3.4 (catalog and prices invisible immediately and search rows deleted by a job; issued quotes remain in the buyer's record and can only be withdrawn from new comparisons; audited). Table scrolls inside its panel on phones.

### 3.5 消息 — `SupplierMessages.tsx` (added 2026-11-07, session 13)

The supplier's side of the message threads (IA `/supplier/messages`). Route `/design-preview/supplier/messages?thread=`. Only messages that actually left the platform exist here; a buyer draft that was never approved does not appear. The buyer is an anonymized label (平台买家（美国 · 加利福尼亚州）), never an organization name or a contact.

- **List:** 待回复 first, then 待转达, then newest activity; status tabs 全部 · 待回复 · 已转达 · 已完成 · 通知 with counts; unread dot and bold subject; buyer label, 询价单 reference, latest Chinese line, kind and time. Opening a thread marks it read.
- **Thread:** subject, buyer label, 询价单 reference, kind, status chip with its meaning (买家在等您的回复 / 您的回复待平台核对并转达 / 回复已转达买家 / 会话已结束 / 平台通知); 查看询价单 and the notice's own link. Buyer messages show the Chinese first with the English original and the provenance line (买家原文为英文，中文由平台翻译并经运营核对); supplier replies show 待平台转达 or 已转达 with the time, the platform's English translation once relayed, attachments labelled 供应商提供，未核验, and a 平台说明 when contact details were removed; platform notes are dashed lines.
- **Composer (回复买家):** Chinese text, warnings when the text looks like contact details (平台仅在买家获得授权后共享联系方式，转达前会将其移除) or a price (价格请通过“提交报价”填写；消息中的价格不会进入买家比价), attachments through the shared upload pre-check with Chinese reasons, 提交回复（平台转达）. Blocked on notices, closed threads and while a reply awaits relay. In the preview the relay is simulated after a moment and the linked 询价单 is noted as moving to 待回复.
- **依据 drawer:** 买家 (identity withheld until authorized), 询价单, 渠道 (platform message; WeChat relay only through the business contact the supplier provided in 数据共享设置, executed by the operator, never shared with the buyer), 可见范围, 转达记录 (submitted, relayed, channel, 核对：平台运营), and the session log.
- **Wired:** sidebar 消息 (文件资料 stays planned), 工作台 notice for pending buyer messages, the 询价单 clarification notice links to the thread (在消息中回复).
- **Verified in the browser:** Atlas 1440 interactions (ordering and counts, contact and price warnings, Chinese upload rejection, submit → 待平台转达 → 已转达 with the relay log row and the 询价单 note, contact-removed 平台说明 and English translation on the relayed reply, notices and closed threads blocking the composer, unread count dropping on open, 工作台 and 询价单 links); Obsidian 375 list → thread → back with the composer and facts below the thread; no horizontal page overflow at 320 / 375 / 768 / 1440; no console errors from the preview.
- **Rules (`supplier-messages-demo.ts`, 6 tests):** thread status from the latest buyer or supplier message with 待转达 / 已转达 from `relayedAt`; ordering; counts; `canReply`; `validateReplyZh` (empty, length, contact and price patterns); `relayLog`; Chinese wording for the shared upload reasons.

### 3.6 产品目录 / 批量导入 — `SupplierCatalog.tsx`, `SupplierCatalogImport.tsx` (added 2026-11-07, session 14)

**产品目录** (`/design-preview/supplier/catalog`): header counts (产品, 已确认, 待确认, 需续期), status tabs 全部 · 待确认 · 已确认 · 即将过期 · 已过期 · 已暂停 and a visibility filter; each product shows its Chinese and English names, price-state and visibility chips, 规格版本, 交易条款 with its gloss and place, currency and unit, tier count and lowest price, 有效期至 with days left or overdue and the confirmation date; actions 编辑阶梯报价 (existing products) and 暂停 / 恢复 (恢复 returns the product as 待确认 so the price is re-confirmed). **新增产品** registers a product without prices as 待确认, explains that it must be priced and confirmed in 阶梯报价, and that the preview does not persist it. The 依据 drawer shows what the buyer sees: visibility meaning, named buyers, the "price not confirmed" warning, the tier list, tooling, lead time, validity and confirmation date, plus the three rules (unconfirmed prices never reach a buyer; spec versions keep old quotes but comparisons use the RFQ's version; 数据共享设置 decides fields, visibility decides audiences).

**批量导入** (`/design-preview/supplier/catalog/import`): 1. 下载模板 (CSV, UTF-8 with BOM, `catalog-template v1`, one row per tier) with the column table (required, meaning, example); 2. 上传文件 through the shared upload pre-check (CSV parsed in the browser for the preview; XLSX is explained as server-parsed), pasted CSV, and two sample files; 3. 预览与检查: counts 新增 · 更新 · 未变化 · 错误, one row per product with the source rows, row-numbered errors (口语交易条款, invalid currency, expired date, missing place, invalid scope, overlapping tiers, non-numeric price, inconsistent product fields, missing columns), warnings (EXW without place, gaps, non-monotonic prices, no validity, 指定买家 needs named buyers) and, for updates, the field-by-field diff; 4. 导入 of the clean rows only, every imported price landing as 待确认 with links to confirm in 阶梯报价. The 依据 drawer lists the import rules (matching key, one row per tier, errors skip, 待确认, formal terms only, scan and no formula execution, audit).

**Rules (`supplier-catalog-demo.ts`, 8 tests):** RFC 4180 CSV reader (quotes, doubled quotes, CRLF, byte-order mark), template round-trip and missing-column detection, grouping by 产品名称（中文）, validation reusing `validateTiers` and `validateBasis`, diff against existing products, summary, `applyImport` (待确认, no confirmation date, named buyers preserved), catalog counts, suspend / resume.

**Verified in the browser:** see `DESIGN_02_EXECUTION_REPORT.md` session 14.

## 4. Validation module

`supplier-demo.ts` (11 tests): `validateTiers` (ascending, non-overlapping [min, max), open-ended must be last, gap and non-monotonic warnings), `validateBasis` (unknown → warning, place required for FCA/FOB/CFR/CIF/DAP/DPU/DDP, recommended for EXW), `quoteSubmissionGate`, zh-CN formatters. Display-only; the authoritative checks are the `quotation_tiers` exclusion constraint (B-18) and `packages/domain` (B-14).

## 5. Not built / limitations

- 企业资料, 产品目录 (list and 批量导入), 文件与消息, 账户 are navigation entries only.
- EN toggle is visual; a real bilingual supplier UI needs the zh-CN catalog keys (handoff H-24).
- No real upload, scan, review or audit write; "确认有效" and "撤销授权" change local state only.
- Buyer identity masking is a UI convention here; the real control is RLS plus `contact_disclosure_grants` / `source_permissions`.
