# DRAFT — NOT FOR USE UNTIL COUNSEL REVIEW (OQ-06)

# 供应商数据授权书 / Supplier Data Authorization Form

> **草稿 — 未经法律顾问审核前不得使用（OQ-06）。**
> **DRAFT — NOT FOR USE UNTIL COUNSEL REVIEW (OQ-06).**
>
> 状态 / Status: Phase 1 draft for counsel (`docs/BACKLOG.md` B-00b). Source: `docs/INTEGRATIONS_AND_PERMISSIONS.md` §3–§4, `docs/SCHEMA_PLAN.md` (`source_permissions`), `docs/SECURITY.md` T3/T16.
> 本表格尚未经任何律师审核，尚未向任何供应商出示，亦未获得任何授权。
> This form has not been reviewed by any lawyer, has not been shown to any supplier, and no authorization has been obtained under it.
>
> 格式说明 / Format: 简体中文在左，英文在右。Simplified Chinese on the left, English on the right. 方括号 `[ ]` 为供应商勾选项；`［＿＿］` 为填写项。Square brackets `[ ]` are supplier checkboxes; `[____]` are fill-in fields.
>
> 每个勾选项在右侧注明其对应的系统字段（`source_permissions.scope`），供内部录入人员使用；供应商无需理解该列。
> Each checkbox is annotated with the system field it maps to (`source_permissions.scope`) for the internal operator who records the grant; suppliers do not need to read that column.

---

## 0. 授权方与被授权方 / Parties

| 简体中文 | English |
|---|---|
| **授权方（供应商）：** 本表第 1 节所列企业。 | **Authorizing party (Supplier):** the enterprise identified in Section 1. |
| **被授权方（平台运营方）：** ［＿＿ 平台运营实体法定名称、注册地 ＿＿］（下称"平台"）。 | **Authorized party (Platform operator):** [____ legal name and jurisdiction of the operating entity ____] (the "Platform"). |
| 平台运营实体名称与注册地待定（见 `docs/OPEN_QUESTIONS.md` OQ-04、OQ-10）。 | Operating-entity name and jurisdiction are not yet decided (see `docs/OPEN_QUESTIONS.md` OQ-04, OQ-10). |

---

## 1. 供应商身份 / Supplier identity

| 简体中文 | English |
|---|---|
| 企业法定名称（与营业执照一致）：［＿＿＿＿＿＿＿＿］ | Legal name of enterprise (as on business license): [________________] |
| 统一社会信用代码（USCC，18 位）：［＿＿＿＿＿＿＿＿］ | Unified Social Credit Code (USCC, 18 characters): [________________] |
| 注册地址：［＿＿＿＿＿＿＿＿］ | Registered address: [________________] |
| 主要产品类别（可多选）：[ ] 不干胶卷标 [ ] 折叠彩盒 [ ] 人发发束 [ ] 其他：［＿＿］ | Primary product families (tick all that apply): [ ] pressure-sensitive roll labels [ ] printed folding cartons [ ] human-hair bundles [ ] other: [____] |
| 签署人姓名：［＿＿＿＿］ 职务：［＿＿＿＿］ | Name of signatory: [________] Title: [________] |
| 签署人确认其有权代表上述企业签署本授权书。 | The signatory confirms they are authorized to sign this form on behalf of the enterprise named above. |
| 业务联系方式（仅限工作邮箱或工作电话；详见第 8 节）：［＿＿＿＿］ | Business contact (work email or work phone only; see Section 8): [________] |

> 内部备注 / Internal note: 录入 `suppliers` 表（法定名称、USCC），并将本表扫描件存为 `documents` 行，其 `id` 填入 `source_permissions.evidence_document_id`。
> Record legal name and USCC on the `suppliers` row; store the signed scan as a `documents` row and put its `id` in `source_permissions.evidence_document_id`.

---

## 2. 授权共享的数据 / What is shared

| 简体中文 | English | 系统字段 / System field |
|---|---|---|
| 供应商授权平台接收、存储并按本授权书使用以下**已勾选**的数据类别。未勾选的类别**不**在授权范围内。 | The Supplier authorizes the Platform to receive, store and use only the data categories **ticked** below under the terms of this form. Unticked categories are **not** authorized. | — |
| [ ] **价格阶梯**（各数量区间的单价、币种、价格条款/贸易术语、有效期） | [ ] **Price tiers** (unit price per quantity band, currency, price basis / Incoterm, validity) | `scope.fields` ∋ `price_tiers` |
| [ ] **最小起订量（MOQ）** | [ ] **Minimum order quantity (MOQ)** | `scope.fields` ∋ `moq` |
| [ ] **生产交期**（打样、批量生产天数） | [ ] **Lead time** (sample and bulk production days) | `scope.fields` ∋ `lead_time` |
| [ ] **产品规格**（材料、尺寸、工艺、公差、认证说明） | [ ] **Product specifications** (materials, dimensions, process, tolerances, certification statements) | `scope.fields` ∋ `specs` |
| [ ] **产品图片**（由供应商提供或指定的产品/工厂图片） | [ ] **Product images** (product or factory images provided or designated by the Supplier) | `scope.fields` ∋ `images` **and** `scope.images = true` |
| 图片附加确认：供应商确认其拥有所提交图片的权利，且图片中不含可识别的个人（如含，须先获得该个人同意或作遮挡处理）。 | Image confirmation: the Supplier confirms it holds the rights to any submitted images and that they contain no identifiable persons (if they do, the person's consent must be obtained first or the image must be redacted). | `scope.images` |
| 提交方式（可多选）：[ ] 电子表格/CSV [ ] PDF 目录 [ ] 平台供应商门户上传 [ ] 电子邮件 | Submission channel (tick all that apply): [ ] spreadsheet / CSV [ ] PDF catalog [ ] Platform supplier-portal upload [ ] email | `documents.source_type` (`supplier_csv_feed`, `supplier_portal`, `inbound_email`, `operator_import`) |
| 平台**不会**从 1688、淘宝、微店、微信、Alibaba.com 等第三方平台抓取或模拟登录获取供应商数据；仅接收供应商直接提交的数据。 | The Platform does **not** scrape or simulate sessions on 1688, Taobao, Weidian, WeChat, Alibaba.com or any third-party platform; it only receives data the Supplier submits directly. | `rights_class = catalog_public_with_permission` |

---

## 3. 可见范围 / Who may see it

| 简体中文 | English | 系统字段 / System field |
|---|---|---|
| 请**只选一项**。 | Tick **exactly one**. | `scope.buyer_visibility` |
| [ ] **平台全部买家**：所有已注册并经平台审核的买家账户可查看第 2 节所授权的目录数据。 | [ ] **All Platform buyers**: every registered buyer account approved by the Platform may view the catalog data authorized in Section 2. | `platform_buyers` |
| [ ] **指定买家**：仅下列买家可查看（填写买家企业名称）：1.［＿＿］ 2.［＿＿］ 3.［＿＿］ | [ ] **Named buyers only**: only the following buyers may view (enter buyer company names): 1. [____] 2. [____] 3. [____] | `named_orgs` (+ grant rows per named org) |
| [ ] **仅平台内部**：仅平台运营人员可查看，用于内部研究与匹配；不向任何买家展示。 | [ ] **Platform internal only**: only Platform operations staff may view, for internal research and matching; nothing is shown to any buyer. | `internal_only` |
| 无论选择哪一项，平台内部运营人员均可查看以履行本授权书所述服务。 | Under every option, Platform operations staff may view the data in order to perform the services described in this form. | `visibility_scope` (see `docs/SCHEMA_PLAN.md` §3) |
| 内部备注：`buyer_visibility` 载于 `docs/INTEGRATIONS_AND_PERMISSIONS.md` §3 的 `scope` 定义，但 `docs/SCHEMA_PLAN.md` 第 2 节 `source_permissions` 行未列出该键；待 B-03/B-05 迁移时对齐（见本文件末尾"待解决"）。 | Internal note: `buyer_visibility` appears in the `scope` definition in `docs/INTEGRATIONS_AND_PERMISSIONS.md` §3 but is missing from the `source_permissions` row in `docs/SCHEMA_PLAN.md` §2; align when migration 0005 is written (see "Open items" at the end). | — |

---

## 4. 允许的用途 / Permitted uses

| 简体中文 | English |
|---|---|
| 平台可在本授权书范围内将所授权数据用于以下用途： | Within the scope of this form, the Platform may use the authorized data to: |
| （a）**展示**：在第 3 节所选可见范围内向买家展示。 | (a) **Display**: show it to buyers within the visibility chosen in Section 3. |
| （b）**翻译**：将中文内容翻译为英文（含使用人工智能翻译工具）；翻译件标注"机器翻译，以中文原件为准"。 | (b) **Translation**: translate Chinese content into English (including with AI translation tools); translations are labelled "machine translation; the Chinese original prevails". |
| （c）**比较**：与其他供应商的报价一并整理为结构化比较，供买家在其自身采购决策中使用。 | (c) **Comparison**: structure it alongside other suppliers' quotations into comparisons for a buyer's own purchasing decisions. |
| （d）**提取与索引**：从提交文件中提取结构化字段并建立内部检索索引。 | (d) **Extraction and indexing**: extract structured fields from submitted documents and build internal search indexes. |
| 所有展示均注明数据来源为供应商提供的目录信息及其更新日期；平台不会将目录价格标注为"已确认报价"，除非供应商就具体询价另行书面确认。 | Every display states that the data is Supplier-provided catalog information and its update date; the Platform will not label a catalog price as a "confirmed quote" unless the Supplier separately confirms it in writing for a specific inquiry. |

---

## 5. 禁止的用途与可选扩展授权 / Prohibited uses and optional extended permissions

| 简体中文 | English | 系统字段 / System field |
|---|---|---|
| 除下方**明确勾选**的扩展授权外，平台**不得**： | Except as **expressly ticked** below, the Platform shall **not**: | — |
| （a）向任何第三方出售、转让、许可或以其他方式**转发**供应商数据； | (a) sell, transfer, license or otherwise **redistribute** Supplier data to any third party; | `scope.redistribute = false` (default) |
| （b）将供应商数据用于**汇总分析、行业基准、营销材料或对外报告**； | (b) use Supplier data in **aggregate analytics, industry benchmarks, marketing materials or external reports**; | `scope.benchmark = false` (default) |
| （c）将供应商数据用于训练面向第三方的机器学习模型； | (c) use Supplier data to train machine-learning models offered to third parties; | — |
| （d）向买家披露供应商的个人联系人信息（见第 8 节）。 | (d) disclose the Supplier's individual contact details to buyers (see Section 8). | `suppliers` restricted columns (SECURITY T3) |
| **可选扩展授权（默认不勾选）：** | **Optional extended permissions (unticked by default):** | — |
| [ ] 供应商**允许**平台将所授权数据纳入**匿名化**的汇总分析与行业基准（不显示供应商名称、USCC 或图片）。 | [ ] The Supplier **permits** the Platform to include the authorized data in **anonymized** aggregate analytics and industry benchmarks (no Supplier name, USCC or images shown). | `scope.benchmark = true` |
| [ ] 供应商**允许**平台将所授权数据转发给平台的服务合作方（如货运代理、验货机构），且仅限为履行买家项目所必需。 | [ ] The Supplier **permits** the Platform to redistribute the authorized data to the Platform's service partners (e.g. freight forwarders, inspection agencies), solely as needed to perform a buyer's project. | `scope.redistribute = true` |
| 内部备注：`redistribute` 与 `benchmark` 均为布尔值；未勾选即为 `false`。"未知"不等于"默认允许"。 | Internal note: `redistribute` and `benchmark` are booleans; an unticked box is recorded as `false`. Unknown is never recorded as permitted. | — |

---

## 6. 期限与撤销 / Duration and revocation

| 简体中文 | English | 系统字段 / System field |
|---|---|---|
| 本授权自签署日起生效：签署日期［＿＿＿＿年＿＿月＿＿日］ | This authorization takes effect on the signing date: [____ (YYYY-MM-DD) ____] | `granted_at` |
| 有效期（只选一项）：[ ] 12 个月 [ ] 24 个月 [ ] 至撤销为止 [ ] 其他：［＿＿］ | Term (tick one): [ ] 12 months [ ] 24 months [ ] until revoked [ ] other: [____] | `expires_at` (null if "until revoked") |
| 供应商可随时以书面方式（电子邮件至［＿＿ 平台指定邮箱 ＿＿］，或通过供应商门户）撤销本授权，无需说明理由。 | The Supplier may revoke this authorization at any time, without giving reasons, in writing (email to [____ Platform-designated address ____] or via the supplier portal). | `revoked_at` |
| 撤销的效果： | Effect of revocation: | — |
| （a）目录数据在收到撤销通知后 ［＿＿ 个工作日，建议 2 ＿＿］ 内停止向买家展示，并转为"仅平台内部"； | (a) catalog data stops being shown to buyers within [____ business days, proposed 2 ____] of receipt of notice and becomes "Platform internal only"; | `visibility_scope → internal_only` |
| （b）图片下架； | (b) images are unpublished; | `scope.images → false` |
| （c）供应商就某买家具体询价已出具的历史报价，作为该买家的交易记录继续对该买家可见，但不再向其他任何方分享； | (c) historical quotations the Supplier issued for a specific buyer's inquiry remain visible to that buyer as its transaction record, but are not re-shared with anyone else; | `quotations` with `buyer_org_id` retained |
| （d）平台在法律要求或争议处理所需的期限内保留本授权书及审计记录。 | (d) the Platform retains this form and audit records for as long as required by law or for dispute handling. | retention: OQ-07 |
| 保留期限尚未确定（OQ-07）；法律顾问须确认。 | Retention periods are not yet decided (OQ-07); counsel must confirm. | — |

---

## 7. 议价报价的保密 / Confidentiality of negotiated quotes

| 简体中文 | English |
|---|---|
| 本授权书仅涉及**目录数据**（第 2 节）。供应商针对某买家具体询价出具的报价（含议价结果、最终报价）**不**属于目录数据。 | This form covers **catalog data** only (Section 2). Quotations the Supplier issues for a specific buyer's inquiry (including negotiated and final offers) are **not** catalog data. |
| 此类报价仅对该买家及平台指定运营人员可见，不会向其他买家展示，不会用于汇总分析，不受第 3 节与第 5 节可选扩展授权的影响。 | Such quotations are visible only to that buyer and assigned Platform operators; they are never shown to other buyers, never used in aggregate analytics, and are unaffected by the visibility chosen in Section 3 or the extended permissions in Section 5. |
| 平台不会向任何买家披露供应商给其他买家的报价。 | The Platform will not disclose to any buyer the prices the Supplier quoted to another buyer. |
| 内部备注：此类报价记录为 `rights_class = customer_private_quote`，`visibility_scope = owning_org`，`quote_type ∈ {negotiated_private, final_offer}`。 | Internal note: such quotations are recorded as `rights_class = customer_private_quote`, `visibility_scope = owning_org`, `quote_type ∈ {negotiated_private, final_offer}`. |

---

## 8. 联系人个人信息最小化 / Personal-data minimization for contacts

| 简体中文 | English |
|---|---|
| 平台仅收集履行服务所必需的**业务联系信息**：联系人姓名或称呼、职务、工作邮箱和/或工作电话。 | The Platform collects only the **business contact information** needed to perform the service: contact name or form of address, job title, work email and/or work phone. |
| 平台**不**收集或存储：身份证号、个人微信聊天截图中的第三方信息、家庭地址、个人银行信息。 | The Platform does **not** collect or store: national ID numbers, third-party information in personal WeChat screenshots, home addresses, or personal banking details. |
| 联系人信息仅对平台运营人员可见，**不向买家展示**，除非供应商另行书面同意。 | Contact information is visible only to Platform operations staff and is **not shown to buyers** unless the Supplier separately agrees in writing. |
| 联系人信息将存储于中华人民共和国境外（存储地区待定，OQ-10）。供应商确认其已告知相关联系人，并（如适用）已取得其同意。 | Contact information will be stored outside the People's Republic of China (storage region to be decided, OQ-10). The Supplier confirms it has informed the relevant contacts and, where applicable, obtained their consent. |
| 联系人可通过［＿＿ 平台指定邮箱 ＿＿］请求查阅、更正或删除其个人信息。 | A contact may request access to, correction of, or deletion of their personal information via [____ Platform-designated address ____]. |
| **法律顾问须确认**：《个人信息保护法》（PIPL）下的跨境传输合法基础（单独同意 / 标准合同备案 / 其他），以及本节措辞是否充分。 | **Counsel must confirm**: the lawful basis for cross-border transfer under the PRC Personal Information Protection Law (PIPL) (separate consent / standard-contract filing / other), and whether this section's wording is sufficient. |
| 内部备注：每条联系人记录须填写 `contact_basis`（见 `docs/SECURITY.md`）。 | Internal note: every contact row must record `contact_basis` (see `docs/SECURITY.md`). |

---

## 9. 语言与效力 / Governing language

| 简体中文 | English |
|---|---|
| 本授权书以简体中文书就，并附英文译文。 | This form is written in Simplified Chinese with an English translation. |
| 两种文本如有不一致，以［＿＿ 中文 / 英文 — 由法律顾问决定 ＿＿］文本为准。 | In case of inconsistency between the two texts, the [____ Chinese / English — to be decided by counsel ____] text prevails. |
| 适用法律与争议解决：［＿＿ 由法律顾问决定 ＿＿］ | Governing law and dispute resolution: [____ to be decided by counsel ____] |
| 本授权书不构成买卖合同、代理协议或独家安排；不保证任何订单。 | This form is not a sales contract, agency agreement or exclusivity arrangement, and does not guarantee any order. |

---

## 10. 签署 / Signatures

| 简体中文 | English |
|---|---|
| **供应商** | **Supplier** |
| 企业名称：［＿＿＿＿＿＿＿＿］ | Enterprise name: [________________] |
| 签署人签字：［＿＿＿＿＿＿＿＿］ | Signatory signature: [________________] |
| 企业公章：［＿＿＿＿］ | Company seal (公章): [________] |
| 日期：［＿＿＿＿年＿＿月＿＿日］ | Date: [____ (YYYY-MM-DD) ____] |
| **平台** | **Platform** |
| 代表签字：［＿＿＿＿＿＿＿＿］ | Representative signature: [________________] |
| 日期：［＿＿＿＿年＿＿月＿＿日］ | Date: [____ (YYYY-MM-DD) ____] |
| 接受的签署形式（法律顾问确认）：[ ] 纸质盖章扫描件 [ ] 电子签名 [ ] 供应商门户点击同意（记录时间戳与 IP） | Accepted forms of execution (counsel to confirm): [ ] signed and sealed paper scan [ ] electronic signature [ ] supplier-portal click-consent (timestamp and IP recorded) |

---

## 附录 A（仅内部）/ Annex A (internal only) — 录入对照表 / Recording map

Operators record one `source_permissions` row per signed form. Nothing is inferred: an unticked box is `false` or omitted, never defaulted to permitted.

| Form item | `source_permissions` column | Value |
|---|---|---|
| §1 legal name, USCC | `supplier_id` → `suppliers` row | FK |
| §2 submission channel | `source_system_id` (nullable) | per channel |
| whole form | `rights_class` | `catalog_public_with_permission` |
| §2 ticked categories | `scope.fields` | subset of `["price_tiers","moq","lead_time","specs","images"]` |
| §2 images box + image confirmation | `scope.images` | `true` only if both ticked |
| §5 benchmark box | `scope.benchmark` | `true` only if ticked |
| §5 redistribute box | `scope.redistribute` | `true` only if ticked |
| §3 single choice | `scope.buyer_visibility` | `platform_buyers` / `named_orgs` / `internal_only` (see open item 1) |
| §10 signed scan or portal consent record | `evidence_document_id` | `documents.id` |
| §6 signing date | `granted_at` | timestamptz |
| §6 term | `expires_at` | null for "until revoked" |
| §6 revocation notice | `revoked_at` | set on receipt |
| operator | `recorded_by` | user id |

**Open items for counsel and schema (do not resolve in this file):**

1. `scope.buyer_visibility` is defined in `docs/INTEGRATIONS_AND_PERMISSIONS.md` §3 but missing from the `source_permissions` row in `docs/SCHEMA_PLAN.md` §2. Align when migration 0005 (`sources_documents`) is written.
2. Governing language precedence and governing law (§9) — counsel decision (OQ-06).
3. PIPL lawful basis for contact data and whether a separate consent form per contact is required (§8) — counsel decision (OQ-06).
4. Retention periods after revocation (§6 d) — OQ-07.
5. Operating entity name and jurisdiction (§0) — OQ-04 / OQ-10.
6. Whether portal click-consent is an acceptable form of execution in the PRC for this purpose (§10) — counsel.
7. Chinese legal terminology in this draft was written by a coding agent and has not been reviewed by a native-speaking legal professional; counsel should re-draft, not merely proofread.
