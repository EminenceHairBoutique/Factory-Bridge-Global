# Web / Native Feature Parity

Legend: **Full** = complete capability · **Read** = read-only or summary · **Start** = can begin, finishes elsewhere · **—** = not offered. "Phone web" is the responsive website at phone width (what the prototypes implement). PWA inherits the phone-web column plus home-screen install and limited push.

| Capability | Desktop web | Phone web / PWA | Native app | Why |
|---|---|---|---|---|
| **Buyer** | | | | |
| Dashboard: actions, quote status, projects | Full | Full (stacked) | Full | Prototyped on web; same DTO on native |
| New sourcing request (5-step wizard) | Full | Full | Start (3 steps: what, quantity/where, photos) | Specification fields need keyboard and reference material; native hands off to web at step 3 |
| Brief & spec confirmation (from_input / inferred / missing) | Full | Read | Read | Three-column comparison needs width |
| Document upload | Full | Full (file picker) | Full (camera, gallery, background queue) | Native adds reliable capture |
| Extraction review | Full | Read | Read | Anchors need two panes and precise selection |
| Supplier options list | Full | Full | Full | List pattern |
| Quote comparison matrix | Full | Full (card carousel) | Full (card pager) | Same row model; matrix only on ≥ 1024 px |
| Landed-cost assumptions (freight estimate, duty rate + source) | Full | Full (form fits) | Read | Keep assumption entry where the source document is at hand |
| Evidence drawer / badge popovers | Full | Full (panel) | Full (sheet) | |
| Request clarification (draft, approval chain) | Full | Full | Full | Primary native job; send remains server-side after operator approval |
| Approvals: RFQ send, supplier selection, sample approval, handoff | Full | Full | Full + biometric | Primary native job |
| Reports (PDF/CSV) | Full | Open | Open | Generated server-side |
| Settings, team, billing | Full | Full | Read + notification preferences | |
| **Supplier (zh-CN)** | | | | |
| 工作台 | Full | Full | Full | |
| 企业认证 (identity documents) | Full | Full | Full (camera) | |
| 产品目录 list | Full | Full | Read | |
| 批量导入 (XLSX/CSV preview, diff) | Full | — | — | Desktop task |
| 价格梯度 editor | Full | Read | Read + "confirm still valid" action | Editing tiers on a phone invites errors; confirming validity is a one-tap job |
| 询价单 accept / decline / clarify | Full | Full | Full | |
| 提交报价 (structured form) | Full | Full | Start (photo of quote sheet → operator extraction) | |
| 生产与质检 milestone updates and evidence photos | Full | Full | Full (camera, offline queue) | Primary native job for factory staff |
| 数据共享设置 | Full | Full | Read | Consent changes should be deliberate |
| **Operations** | | | | |
| Review queue | Full | Read | Read + assign | |
| Review split (anchors, corrections, accept gate) | Full | — | — | Desktop-first by design |
| Outreach approval queue | Full | Full | Full | Approval is a native job |
| Supplier CRM, contacts (restricted), checks | Full | Read | Read + capture evidence | Contact panel visible only to assigned operators on every surface |
| Research inbox | Full | Start (capture a lead) | Start | Lead capture is quick; classification on desktop |
| Compliance holds, audit explorer, intake imports, permissions dashboard | Full | — | — | Desktop-first |
| **Cross-cutting** | | | | |
| Push notifications | — (email) | Limited (Web Push; iOS only when installed) | Full | |
| Offline read of last snapshots | — | Partial (service worker) | Full | |
| Biometric confirmation | — | — | Full | |
| Deep links into records | URLs | URLs | Universal links | |
| Language toggle EN / 中文 | Full | Full | Full | Same catalogs |

## Parity rules

1. Every record visible on native is visible on the web; native never has exclusive data.
2. Every side effect (send, confirm, select, hand off) is an **approval record** on all surfaces; the server performs the effect.
3. Status vocabulary, badge generation and exclusion reasons are rendered from the same shared definitions (`@fbg/i18n`, proposed `@fbg/ui-core`), so a phone never shows a softer status than the desktop.
4. When a surface offers "Start" only, it shows exactly where the task continues and deep-links there.
