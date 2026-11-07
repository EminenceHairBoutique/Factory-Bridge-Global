# FIRST CLAUDE CODE PROMPT — FACTORY BRIDGE GLOBAL (V2)

Paste this **into Claude Code** after you have created your Claude Project, uploaded the master spec to Project Knowledge, and placed a copy of the master spec into your GitHub repository under `docs/FACTORY_BRIDGE_MASTER_ENGINEERING_SPEC.md`.

---

We are starting **Factory Bridge Global**, a U.S.-facing AI-powered Chinese sourcing and procurement intelligence platform that combines expert bilingual sourcing, direct factory relationships, verified-quality workflows, competitive **total landed cost**, and accountable procurement support.

**This is not another Temu, 1688, Taobao, Weidian, or Alibaba.com competitor.** It is a software-enabled American sourcing service, initially focused on B2B buyers. Our service pillars are: quality verification, competitive transparent pricing, responsiveness/speed, a meaningful choice of qualified supplier options, and clear follow-through. Do not make absolute product, pricing or delivery guarantees without an approved operational program and evidence.

First read `docs/FACTORY_BRIDGE_MASTER_ENGINEERING_SPEC.md` in full. Also follow the Claude Project Instructions. If the file is missing, stop coding and identify the missing document.

## Assignment: PHASE 0 — product architecture and commercial feasibility

1. Inspect the repository if one exists. Tell me what actually exists vs. what is merely planned.
2. Draft a detailed architecture for **buyer**, **Chinese supplier**, and **internal U.S. sourcing-operations** workspaces.
3. Propose and document a narrow MVP: buyer sourcing brief → authorized supplier/quote intake → AI bilingual structured extraction → human review → normalized comparison → PDF/CSV report → quote follow-up.
4. Design a schema with tenants, users, roles, products, multilingual specs, source provenance, source rights, tiered pricing, quote versions, RFQ workflows, suppliers, verification evidence, quality inspections, shipments/estimates, and audit logs.
5. Define RLS policies, server authorization, threat model, upload safety, sensitive quotation separation and confidential supplier-contact handling.
6. Build a **data-rights matrix** for manual 1688/Taobao/Weidian research, direct factory catalog uploads, quote replies, factory API feeds, marketplace-approved APIs, and image/document uploads. Do NOT assume general scraping or private WeChat message extraction is available.
7. Specify the quote engine: compare exactly matched product specifications and quantities; preserve MOQs and tier thresholds; respect EXW/FOB/CIF/DDP distinctions; date FX rates; mark tax/freight estimates and missing data.
8. Specify an AI pipeline for EN/ZH search, document extraction, translation, supplier matching, anomaly detection, RFQ drafts, structured schemas, auditability and a human approval gate.
9. Specify a quality-verification workflow: identity checks, samples, lot/batch inspections, exception handling, QA evidence, and precise badge semantics. Explain the limits of sample inspections.
10. Recommend the **first one-to-three commercial product families** to pilot from custom labels, folding cartons, blank apparel, hair, bottles, pumps and other previously prioritized categories. Provide measurable selection criteria.
11. Draft UX sitemap, page templates, supplier portal in Simplified Chinese, buyer interface in English, and a restrained professional visual system. Avoid a consumer bargain marketplace aesthetic.
12. Create `CLAUDE.md`, `docs/ARCHITECTURE.md`, `docs/PRODUCT_REQUIREMENTS.md`, `docs/SCHEMA_PLAN.md`, `docs/SECURITY.md`, `docs/INTEGRATIONS_AND_PERMISSIONS.md`, `docs/QUALITY_ASSURANCE.md`, `docs/AI_EVALUATION_PLAN.md`, `docs/ROADMAP.md`, `docs/DECISIONS.md`, `docs/STATUS.md`, and `docs/OPEN_QUESTIONS.md` as appropriate for Phase 0. Distinguish a design from tested code.
13. Include launch economics: software, usage-based AI, storage, inspection partner, shipping quotes, customer acquisition and customer support—identifying fixed vs variable expenses and who pays each.
14. Conclude with a prioritized engineering backlog, acceptance criteria, missing legal/commercial decisions and a concise session report.

**Constraints:** Do not launch, place orders, contact factories, deploy, create paid accounts, or commit to external purchases without founder authorization. Do not invent integration permissions, supplier verification, live prices, product quality, customer savings, or test results. Show me exact commands to run and how to validate them.

Start by inspecting the available files and returning a Phase 0 plan. Do not attempt to implement all phases in one pass.
