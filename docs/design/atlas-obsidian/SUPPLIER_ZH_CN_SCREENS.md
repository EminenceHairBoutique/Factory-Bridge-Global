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

## 4. Validation module

`supplier-demo.ts` (11 tests): `validateTiers` (ascending, non-overlapping [min, max), open-ended must be last, gap and non-monotonic warnings), `validateBasis` (unknown → warning, place required for FCA/FOB/CFR/CIF/DAP/DPU/DDP, recommended for EXW), `quoteSubmissionGate`, zh-CN formatters. Display-only; the authoritative checks are the `quotation_tiers` exclusion constraint (B-18) and `packages/domain` (B-14).

## 5. Not built / limitations

- 企业资料, 产品目录 (list and 批量导入), 文件与消息, 账户 are navigation entries only.
- EN toggle is visual; a real bilingual supplier UI needs the zh-CN catalog keys (handoff H-24).
- No real upload, scan, review or audit write; "确认有效" and "撤销授权" change local state only.
- Buyer identity masking is a UI convention here; the real control is RLS plus `contact_disclosure_grants` / `source_permissions`.
