# Supplier Onboarding (企业资料与认证) — Prototyped Screen

**Status:** prototyped 2026-11-07 in the UX-01 / DESIGN-02 design preview (same branch, PR #10). Route `/design-preview/supplier/onboarding` (dev only; 404 in production builds). Specified in `docs/design/SCREEN_INVENTORY_AND_SPECS.md` §4.2 and master spec §8 ("verify company identity and authorized representative", "never imply certification from an uploaded unverified file"). Synthetic data only; files never leave the browser.

## 1. Job

Collect what the platform needs to review a supplier's identity, representative, documents and trade readiness, without ever showing an unverified upload as a verified fact. Verification itself is an operator action that creates check rows (what / who / when / expiry); the UI only reflects their status.

## 2. Entry states

- **需补充 (default):** matches 工作台 — licence and representative identity already 已核验 (dated), 出口资质 待审核, 生产场地证明 需补充 with the reviewer's note. The wizard opens on step 3 with steps 1, 2 and 4 marked complete; the premises row is highlighted and "下一步" is blocked until a file is added. The action reads 提交补充材料.
- **首次填写:** "清空并从头填写（演示）" resets to an empty form starting at step 1; the action reads 提交审核.

## 3. Steps

| Step | Fields | Validation |
|---|---|---|
| 1 企业信息 | 企业名称, 统一社会信用代码, 企业类型 (生产型工厂 / 工贸一体 / 贸易公司), 省份, 所在城市, 注册地址, 成立年份, 主营品类 | name ≥ 4 chars; credit code 18 chars, allowed alphabet, **check digit per GB 32100-2015** (format only; existence is verified by the platform); type, city and at least one family required |
| 2 授权代表 | 姓名, 职务, 工作邮箱, 手机号, 授权依据 (法定代表人本人 / 授权代表附授权书), 微信号, contact-basis confirmation | email and mainland mobile format; authority required; a WeChat handle requires the contact-basis confirmation (maps to `contact_basis = supplier_provided_for_business`, US-O2) |
| 3 资质文件 | 营业执照, 身份证明 / 授权书, 生产场地证明 (factory types only), 出口资质, 体系与产品证书, 样品与车间照片 | PDF / JPG / PNG ≤ 25 MB, client-side; required documents must have a file; every non-verified file shows 供应商提供，未核验; certificates carry the explicit "not shown as 已认证 before verification" note |
| 4 贸易能力 | 可接受的交易条款 (with glosses), 出口经验, 常用出口口岸, 可接受货币, 月产能 (自述), 标准交期, 第三方验货, 样品 | at least one term and one currency; the panel states these are self-declared and not a verification conclusion |
| 5 确认提交 | summary of company and documents with 修改 links; consents: data processing and internal use, truthfulness declaration, catalog default 仅内部 until verified | both consents required; blocking list from steps 1–4 shown and the submit button disabled while any remain |

After submission: 待平台审核 state with the review promise (3 working days), the list of submitted files with their statuses, and the reminder that a passed review becomes 企业身份已核验（日期） with reviewer and basis recorded.

## 4. Copy rules

Formal register (您); dates 2026年11月7日; document statuses 待上传 / 待审核 / 已核验 / 需补充; the phrase 供应商提供，未核验 appears on every unverified file; contacts are described as visible only to assigned operators and never to buyers without a separate disclosure grant.

## 5. Verified in the browser

Resume state opens on step 3 with the 需补充 badge; "下一步" blocked with 请上传生产场地证明; adding a JPEG shows the file with 供应商提供，未核验; steps 4 and 5 reachable; 提交补充材料 enabled and the submitted state shown. First-run path: step 1 shows the field errors on an empty submit; a credit code with a wrong check digit shows 校验位不正确; the valid demo code passes to step 2. No console errors; no horizontal overflow at 320, 375 and 768 px in Obsidian.

## 6. Contract the UI assumes (handoff H-28)

Supplier profile with claimed vs verified columns (migration 0005 already separates them); verification checks as rows with evidence file, reviewer, date, expiry and a reviewer note that the supplier sees on 需补充 (B-08b); documents stored in quarantine with scan status and a `provenance = supplier_provided` label until a check references them; `contact_basis` recorded with the representative's WeChat handle; onboarding submission creates a review task for operators, never a verified state.

## 7. Not built

Real upload, scan and review; 法定代表人 identity verification flows (video call scheduling); English toggle; 企业资料 read view after verification (the wizard's summary step stands in).
