# Factory Bridge Global — Supplier Quote Intelligence
## Product, data integrations, architecture, workflows and commercialization blueprint
**Prepared:** November 6, 2026  
**Status:** Proposed architecture and validation plan; not a statement that any marketplace API has granted access.

## Executive recommendation
Build a **private-network B2B sourcing and RFQ operating system**, not a replica of 1688 or Alibaba.com. Start with a narrow product category, 10–20 consenting factories, and a small number of importer/buyer design partners. Use supplier-managed catalogs, spreadsheet uploads, incoming email, and structured RFQs. Add approved marketplace APIs only after confirming technical scope and contractual rights.

The defining product promise: **search relevant suppliers immediately, show source-dated indicative prices, request binding offers asynchronously, compare like-for-like specifications, and estimate landed costs with clearly labeled assumptions.** Never claim that all Chinese factories expose live price or inventory data.

## 1. Problem and target customers
- **Buyer:** US SME importer, wholesale distributor, private-label brand, sourcing agency, or purchasing manager with recurring Chinese factory purchases.
- **Supplier:** Chinese manufacturer, trading company, or export sales team willing to receive qualified RFQs.
- **Problem:** Pricing arrives through WeChat conversations, email, Excel/PDF and marketplace pages; comparing specs, currency, quantity tiers and shipping terms is manual and error-prone.
- **Primary value:** Faster RFQ turnaround, better comparability, searchable quote history, visible source provenance, fewer missed offers.
- **Avoid initial claims:** lowest price in China, automatic real-time factory inventory, customs or compliance guarantees, completely autonomous sourcing.

## 2. The four kinds of 'freshness'
1. **Listing last observed** — when permitted marketplace/catalog data was retrieved, not proof of a confirmed deal price.
2. **Supplier catalog updated** — when the supplier last sent a feed/edited product details.
3. **Quotation confirmed** — when a supplier responded to a particular buyer RFQ with specific quantity/specs/terms.
4. **Quote valid until** — supplier-stated expiration, which can be absent. Absent validity means *unconfirmed*, not unlimited validity.

Show a label per result: `Indicative listing`, `Supplier catalog`, `Verified quotation`, or `Expired/unconfirmed`, plus `Source`, `Last updated`, `Buyer visibility`, and `Valid until` where available.

## 3. How data reaches the application
### A. Approved marketplace APIs
Register as a developer; obtain app permissions and permitted scopes; use authorized seller access when required; verify reuse/display/storage permissions; configure credentials server-side; build source-specific adapter; rate-limit, cache, retry, log, and maintain a source URL and terms record. Query only the approved endpoints and respect contract and usage quotas. **An API existing does not confer general catalog-redistribution rights.**

- **1688:** its official open-platform developer agreement restricts use of data beyond permitted purposes; API eligibility and product access require verification; product/pricing APIs can change. Treat broad searchable access as a business-development dependency.
- **Alibaba.com:** official Open Platform includes permissions, seller authorization and buyer sourcing solutions; the documentation does not mean all global product/search endpoints or private supplier quotations are freely accessible.
- Other marketplaces: evaluate one at a time by written authorization; never assume a web page can be mirrored.
- Do not build the core business around evading anti-bot protections, CAPTCHA, rate limits or authentication controls.

### B. Supplier portal (recommended first)
Each verified supplier creates a Chinese-language account, profile, product variants, price tiers, MOQ, lead times, packaging and trade terms. Provide buttons `确认有效/Confirm current`, `更新报价/Update price`, `暂停产品/Pause product`. Supplier consents to what the public, authenticated buyers and individual RFQ recipients may see. `Supplier product` may be public to permitted platform buyers, while `Private quote` remains restricted to that specific buyer.

### C. XLSX/CSV feeds
Provide Chinese/English templates with fixed columns: supplier SKU, category, product title, Chinese and English description, variant attributes, quantity from/to, unit price, currency, unit, MOQ, lead days, Incoterm, named place, last-confirmed date, validity, source, compliance documents, and contact. Validate units and dates, preview diffs, and import with version history. Allow scheduled uploads (SFTP/email/authorized API) only when supplier consents.

### D. Email-based RFQs and replies
Create an RFQ-specific email reply address such as `rfq+<opaque_token>@inbound.example.com` (illustrative). Send bilingual, standardized quotation requests to opted-in suppliers. Receive replies and attachments with inbound email webhooks (e.g. Resend, Postmark), associate them to the RFQ, store raw originals privately, extract structured fields, and route uncertain fields to a reviewer. Authenticate incoming webhook signatures, handle spoofed sender addresses, and avoid relying solely on the inbound address as authorization.

### E. WeChat / WeCom / Feishu
Personal WeChat chat history is **not** a general-purpose authorized source for reading all customer conversations. MVP: users manually share/export allowed documents or forward quotes to the portal. For qualified enterprise partners, assess official WeCom or Feishu capabilities, permissions and consent for specific business use. Do not assert that a WeCom contact-event API grants full chat-message access. Feishu offers event subscriptions for authorized resources/events, not universal private conversations.

### F. Factory ERP integration
If a supplier uses ERP or an internal inventory system, integrate via their documented API, approved CSV feed, or a signed webhook. They can push product changes/stock events to your endpoint. Validate signatures, idempotency keys, quantity units and timestamps. Stock should still be labeled `Supplier reported`, never guaranteed until order confirmation.

### G. Buyer-uploaded quotes
A buyer can privately upload the quotes already received by their business. The app extracts and compares those documents inside the buyer's own workspace, subject to permission and retention controls. This is a commercially useful MVP even with *zero* marketplace integrations.

## 4. Customer journey, step by step
**Example request:** A US brand wants 2,000 units of a 250 ml PET cosmetic bottle with black pump, retail-quality packaging, delivered to New Jersey within 70 days. Sample quantities and prices below are illustrative, not market quotes.

1. **Buyer registers** and joins an organization workspace; determines who can view confidential prices.
2. **Buyer enters product description** in English, uploads a reference image if useful, chooses quantity, destination, date, and customization.
3. **AI structures a sourcing specification**: `250 mL`, `PET`, `black pump`, `2,000 pieces`, packaging type, required labeling, target dates. It asks for missing requirements rather than inventing them.
4. **Search existing catalog** using exact category/attribute filters plus bilingual keyword/semantic search. Filter suppliers authorized for this buyer and geography.
5. **Results appear immediately** using existing records. A supplier catalog price is visibly different from a confirmed, current quote. The app may refresh permitted external listings without blocking the page.
6. **Buyer selects suppliers** (e.g. 5) and initiates an RFQ. The system drafts a consistent bilingual RFQ asking for exact material, pump spec, MOQ, tiered pricing, tooling, production days, packing CBM/weight, named Incoterm place, payment terms, sample cost, and valid-through date.
7. **Buyer approves the request** and the system sends it using permitted supplier channels. A factory may respond in minutes, hours or days; never promise instant replies.
8. **Responses arrive** by portal or email and become quote-intake jobs. Originals remain retained as evidence (subject to privacy policy).
9. **Extraction pipeline** parses PDF/Excel/email and returns structured JSON with confidence and source citations, plus missing-field flags.
10. **Human verifies ambiguous fields** including mismatched specification, ambiguous currency/unit, mold fee, tax treatment, or Incoterm.
11. **System normalizes** currency at timestamped FX rates, units, packaging, MOQ tiers, and term differences. *Currency conversion does not make EXW and FOB prices comparable.*
12. **Shipping and duties estimates** are added from authorized freight quotations and verified tariff data. Unknown quantities/components are flagged rather than fabricated.
13. **Comparison view** groups comparable offers and shows differences. Sort by estimated landed unit cost only where estimates are sufficiently complete; otherwise show `not comparable`.
14. **Buyer asks follow-up questions**; system can suggest and draft bilingual clarification messages for approval.
15. **Buyer selects an offer**; the app creates a purchase handoff/checklist, not a legally binding order without explicit action and agreed terms.
16. **History remains searchable** with changes, attachments, response metrics and supplier performance; schedule authorized refresh/renewal.

## 5. What 'real-time' actually looks like
- **Immediate:** the app searches its own current, permission-filtered database.
- **Near-real-time:** supplier portal writes, authorized webhooks and inbound emails can update within seconds or minutes *after they reach the system*.
- **Scheduled:** APIs/CSV sources may refresh every 15 minutes, hourly or daily depending on contract, quotas and supplier data.
- **Asynchronous:** custom RFQ offers arrive when humans/factory systems respond; they are not instant market feeds.
- **Unknown:** independently verified factory inventory, custom MOQ and export pricing not submitted by the supplier.

Suggested policy (configurable, not universal): catalog feed `last_sync_at` and `last_confirmed_at`; indicative marketplace offer marked stale after a source-specific threshold; a verified quote becomes stale after `valid_until`; if `valid_until` is missing show `validity unconfirmed` and request revalidation before purchase.

Search should **not** trigger broad scraping of 1688. Instead: `search database -> display provenance -> optionally refresh an authorized source -> update result -> send targeted RFQs`.

## 6. Recommended system architecture
```text
BUYER WEB APP (React/Next.js + TypeScript)
   |-- buyer search, saved specs, RFQ, quote comparison, supplier profiles
   |-- supplier bilingual portal, catalog upload, quote response
   |-- admin review, consent/permissions, audit dashboard
                 |
                 v
SECURE SERVER API (authentication, org permissions, rate limits)
   |-- search service (structured filters + full text + pgvector)
   |-- RFQ orchestration (draft -> approve -> send -> await replies)
   |-- ingestion service (API adapters, CSV/XLSX, email, portal, webhooks)
   |-- quote comparison / landed cost engine (deterministic calculations)
                 |
                 v
QUEUE + WORKERS (retries, dedupe, idempotency, dead-letter queue)
   |-- read originals and attachments
   |-- document parsing, bilingual translation, LLM extraction
   |-- validation and human-review workflow
   |-- normalization and versioning
   |-- embeddings/index refresh
                 |
                 v
SUPABASE POSTGRES / STORAGE / AUTH
   |-- tenant-isolated rows with Row Level Security
   |-- confidential document storage
   |-- audit log and pricing history
                 ^
                 |
APPROVED SOURCES: direct suppliers | authorized APIs | Excel | inbound email
```

**Technical principle:** a frontend/AI agent may *request* an action, but server-side authorization and a validated domain service decide whether it is allowed. LLM text is never trusted instructions for database writes, outbound requests, supplier payments or web actions.

## 7. Suggested database design
- `organizations`, `organization_members`, `roles`
- `suppliers`, `supplier_users`, `supplier_authorizations`, `supplier_visibility_rules`
- `product_categories`, `normalized_products`, `product_variants`, `product_attributes`
- `supplier_products`, `price_tiers`, `marketplace_sources`, `source_listings`
- `rfqs`, `rfq_items`, `rfq_supplier_invitations`, `rfq_messages`
- `supplier_quotes`, `quote_line_items`, `quote_price_tiers`, `quote_versions`, `quote_status_changes`
- `source_documents`, `document_extractions`, `review_tasks`, `job_runs`, `sync_cursors`
- `freight_quotes`, `duty_assumptions`, `fx_snapshots`, `landed_cost_snapshots`
- `audit_events`, `notification_events`, `billing_subscriptions`

Every private business table carries `organization_id` and proper Row Level Security policies. Quotes should also have `buyer_organization_id`, `supplier_id`, `visibility_scope`, `source_document_id`, `received_at`, `confirmed_at`, `valid_until`, `currency`, `unit`, `incoterm`, `incoterm_place`, `quantity_min/max`, and `review_status`. Enforce referential integrity and preserve version history. Do not expose supplier private quotes across buyer accounts by default.

## 8. Structured extraction example
```json
{
  "supplier_id": "example-supplier-id",
  "rfq_id": "example-rfq-id",
  "source_type": "supplier_email_attachment",
  "item": {
    "category": "cosmetic_packaging",
    "material": "PET",
    "volume_ml": 250,
    "closure": "black_pump",
    "quantity_pieces": 2000
  },
  "offer": {
    "unit_price": 0.42,
    "currency": "USD",
    "price_basis": "per_piece",
    "incoterm": "EXW",
    "named_place": "Guangzhou",
    "production_lead_days": 25,
    "valid_until": null
  },
  "missing_fields": ["quote_validity", "packing_cbm", "sample_cost"],
  "review_status": "needs_review"
}
```
No source quote should be accepted blindly from model output. Validate schema, known product attributes, unit/currency logic, supplier identity, attachment provenance, and the source text. Missing data remains `null`.

## 9. Quote-comparison logic
1. Split product requirements into **hard** attributes (material, size, regulatory constraints) and **soft** preferences (color/packaging negotiability).
2. Eliminate suppliers that cannot meet hard constraints.
3. Select a price tier that covers the requested quantity.
4. Keep quantities, pricing basis, currency conversion timestamps and INCOTERMS in separate explicit fields.
5. Account for one-time tooling/mold charges, sample fees, packaging, inland/export freight, international freight, insurance, port/handling, customs broker, duties/taxes and destination delivery **without double-counting included cost**.
6. Use a freight broker/carrier quote when possible; otherwise label the estimate and the assumptions.
7. Do not invent HTS codes, tariff rates, customs value, eligibility, antidumping/countervailing exposure or regulatory approvals. Offer expert review or 'not yet determined'.
8. Version landed-cost estimates to keep a historic record of changes to FX/freight/fees.

**Illustrative quotes only** (same product assumed; all EXW, excluding freight/duties): Factory A: $0.42 x 2,000 = $840; Factory B: $0.39 x 2,000 = $780; Factory C: $0.37 x 2,000 = $740. Without freight, quality checks and timing, C is only the cheapest *item quote*, not necessarily the lowest-landed-cost or lowest-risk option.

## 10. AI responsibilities and boundaries
**Good tasks:** EN/CN translation, multilingual query expansion, field extraction with source attribution, duplicate detection, supplier/product semantic match, RFQ drafting, discrepancy explanation, summarized history, follow-up questions, and human-readable comparison narratives.

**Must be deterministic or verified:** price calculation, FX conversion, quantity tiers, cost addition, role/permission checks, quote freshness, date/time, audit events, document custody and compliance decision-making.

**Human approval required in early versions:** outbound RFQ transmission, marking confidential quotes verified, accepting quotes, purchase handoff, tariff classification and any irreversible financial action.

## 11. Product modules and access types
**Buyer:** register/login, workspace, guided product search, save project/spec, request quotes, upload quotes, compare/export, chat history, notifications, billing.

**Supplier (Chinese-first):** onboarding, company verification, catalog management, RFQ inbox, quote templates, price tiers, lead time, upload CSV, contact preferences, authorized catalog visibility, expiration/reminders.

**Platform admin:** invitation/verification, supplier rights/consents, quote review, ingestion logs, failed job recovery, abuse monitoring, customer support, audit trail, connector status, billing.

**Optional sourcing operator:** human bilingual support, factory outreach, sample coordination, quality control partners, freight coordination. Keep this a separate service from software subscriptions.

## 12. Privacy, platform and regulatory risks
- Secure written permission to collect, process, store, display and retain each supplier's catalog and private offers.
- Customer-submitted documents may contain trade secrets; default to strict tenant isolation and explicit retention/deletion policies.
- Check 1688/Alibaba terms and approved API rights before building marketplace connectors. The mere availability of an API is not a blanket data license.
- China PIPL and cross-border personal-information obligations can apply when exporting identifiable supplier employee/contact data; obtain legal advice for the actual transfer model.
- If the app collects buyer details and supplier contact information, use data minimization, role-based access, encryption and agreements with data processors.
- Treat inbound documents, product pages, AI prompts and emails as untrusted input. Defend against prompt injection, malicious files, spoofing, SSRF, and stored XSS.
- Anti-spam and email deliverability: obtain opt-in from factories; sender verification, suppression and unsubscribe where applicable.
- Never mislabel marketplace products or infer that a supplier is the actual manufacturer without verification.
- Do not present product pricing, customs classification, safety certification, shipping schedules or compliance as guaranteed.

## 13. Engineering decisions
**MVP:** React + TypeScript + Tailwind (or Next.js if SSR/SEO is important), Supabase Postgres/Auth/Storage/RLS, Vercel deployment, server API, Resend inbound/outbound email, Python or TypeScript parsers, AI API for translation/extraction, Postgres full-text search first, pgvector later.

**Async:** use pgmq or managed queue with retries and idempotent processors. Supabase documents show pgmq + pg_cron + Edge Functions + pgvector for automated embeddings. Do not force long-running LLM/document processing into a single synchronous HTTP request.

**Observability:** track ingestion source, source update timestamp, failures, processing latency, extraction accuracy, quote delivery, supplier response time, message cost, and financial reconciliation.

**Deployment:** CI checks for TypeScript, lint, unit tests, security checks, database migrations, integration tests; staging and production environment separation; secrets on server only; backup/restore practice.

**Docker:** useful once local development needs reproducible services, not a prerequisite to the first UI. If using Supabase local development, Docker can support the local stack, but hosted Supabase can be used initially.

## 14. Build milestones (illustrative 12-week sequence)
**Weeks 1–2: Commercial discovery.** Interview 10–15 US importers; collect 20 real, shareable, permissioned example quote documents; interview five Chinese suppliers; choose a single product vertical and define qualification criteria.

**Weeks 3–4: Core private workspace.** Auth, organizations, supplier records, product schemas, files, upload, quote extraction, reviewer edit, searchable catalog. All comparison fields preserve original attachments.

**Weeks 5–6: Supplier portal and RFQ.** Chinese-language onboarding, supplier product uploads, buyer RFQs, recipient tracking, bilingual email templates, inbound replies and message linking.

**Weeks 7–8: Comparison and estimates.** Quantity tiers, spec matching, status/freshness, normalized comparison, quote versioning, labeled cost estimator, PDF/CSV export.

**Weeks 9–10: Reliability.** Tenant isolation, RLS tests, secret scanning, attachment protections, retries, backups, audit and import idempotency; live paid pilot readiness.

**Weeks 11–12: Pilots.** Recruit 3–5 business teams, onboard 10–20 factories, run 20–50 real RFQs, measure successful comparisons and conversion to paid use. Iterate on the most-used workflow.

**Later:** official API partnerships, ERP feeds, approved message integrations, broker/carrier quotation APIs, enterprise SSO, purchase orders, shipment milestones, supplier scoring based on verified history, and buyer-specific agent workflows.

## 15. MVP scope: what NOT to build yet
- Universal real-time Chinese marketplace crawler
- Buying/ordering/payment escrow
- Fully autonomous factory negotiation
- Universal customs duty and certification engine
- Warehouse management, tracking, customs brokerage integration
- Social network or public marketplace reviews
- Fine-tuned proprietary LLM
- Mobile-native app before web traction

## 16. Business model and commercial validation
**Software-only pilot hypothesis:** $99–$299 per buyer organization per month for a narrowly valuable workflow, potentially with per-seat or RFQ usage limits. Offer a higher tier for sourcing teams and custom integrations. These are pricing tests, not researched market rates.

**Managed-service hybrid:** one-time supplier setup or data-migration fee plus software subscription; optional human sourcing/negotiation services priced separately and clearly disclosed.

**Avoid unexamined double-sided incentives:** suppliers who pay for prominence can undermine the neutrality of price comparisons. Label paid placement and make ranking rules clear.

**Key metrics:** activated buyer organizations, uploaded quote count, RFQs sent, supplier response rate, first-response time, percentage of replies parsed without manual correction, successful apples-to-apples comparison rate, median buyer time saved, paid-pilot conversion, retained MRR, gross margin, support minutes per buyer, partner consent coverage.

## 17. Approximate budget for planning, not guaranteed costs
- Prototype software/hosting/email/AI: roughly $100–$500 per month with light usage and careful free-tier use; can exceed this with larger documents, frequent AI calls and active buyers.
- Customer recruitment and supplier onboarding: primarily founder time initially; separate budget for travel, Chinese-language support and vendor verification when needed.
- Compliance, security, accounting and legal advice: variable external expenses; meaningful contingency is especially important for cross-border handling of supplier personal/contact data.
- API partnership licenses, supplier ERP work and freight integrations: unknown until providers approve and quote terms; do not put them into a fixed-budget plan until confirmed.

## 18. Critical commercial decision: who owns the data?
Start as a **buyer-specific private sourcing workspace** with a **supplier-authorized shared catalog**. Do not merge confidential negotiated quotes from one buyer into a public 'market price' feed. Your long-run data moat is voluntary supplier participation, standardized specifications, confirmed quote history, and permitted benchmarking. Any aggregated analytics must be designed around supplier terms and privacy/contractual rights.

## 19. First 10 action items
1. Choose one vertical (suggest: packaging, hair products or other familiar export category).
2. Contact 10 Chinese factories you already know; ask what data formats they can share regularly.
3. Obtain sample catalogs and real quotes with written permission for development/testing.
4. Interview 10 US importers; ask for their last purchase's quote workflow and time wasted.
5. Define a canonical product-spec schema for one category.
6. Build private buyer quote upload plus clean comparison before broad search.
7. Add Chinese supplier portal and CSV update workflow.
8. Add bilingual RFQ emails and inbound parsing, with buyer approval.
9. Run live comparison tests and verify results manually.
10. Try to collect one paid pilot before pursuing expensive platform APIs.

## 20. Source references (official/documentation, checked November 6, 2026)
- 1688 Open Platform announcements: https://aop.alibaba.com/doc/notice.htm
- 1688 Open Platform developer agreement/data-use limits: https://terms.alicdn.com/legal-agreement/terms/suit_bu1_b2b/suit_bu1_b2b202002111645_28701.html
- Alibaba.com Open Platform overview and API permissions: https://openapi.alibaba.com/doc/doc.htm
- Alibaba.com RFQ sourcing process: https://buyer.alibaba.com/page/how_it_wroks.html
- Resend inbound email processing: https://resend.com/features/inbound
- Google Gmail API push notifications: https://developers.google.com/workspace/gmail/api/guides/push
- Feishu event subscriptions: https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/event-subscription-guide/event-subscriptions
- Supabase hybrid search: https://supabase.com/docs/guides/ai/hybrid-search
- Supabase automatic embeddings/queue pattern: https://supabase.com/docs/guides/ai/automatic-embeddings
- ICC Incoterms 2020 overview: https://iccwbo.org/business-solutions/incoterms-rules/incoterms-2020/
- USITC Harmonized Tariff Schedule: https://hts.usitc.gov/
- PRC PIPL official English text: https://en.spp.gov.cn/2021-12/29/c_948419_2.htm

---

## Starter prompt for Claude Code
> You are the principal architect and implementation lead of Factory Bridge Global Supplier Quote Intelligence, a bilingual B2B private sourcing/RFQ SaaS. Begin by reading this blueprint and auditing the actual GitHub repository. Do not claim repository details without inspection. First produce `docs/PRODUCT_REQUIREMENTS.md`, `docs/DATA_RIGHTS_AND_SOURCE_MATRIX.md`, `docs/ARCHITECTURE.md`, `docs/SCHEMA.md`, `docs/SECURITY_THREAT_MODEL.md`, `docs/DELIVERY_PLAN.md`, and `docs/ACCEPTANCE_TESTS.md`. Implement in small reviewable PRs. The V1 goal is buyer organization authentication and tenant isolation, quote upload with original document retention, verified structured extraction with human review, searchable supplier catalog, bilingual supplier portal/CSV upload, and RFQ approval/send/receive. Do not implement scraping, unauthorized marketplaces, autonomous ordering, estimated tariffs disguised as facts, cross-tenant quote pooling, or automatic access to personal WeChat messages. Use server-side auth and RLS, structured schemas, idempotent background jobs, audit records, current documentation, and tests. Prioritize a working end-to-end narrow user journey over a broad unfinished feature list. Document any assumptions, permissions and integration blockers. Before writing production code, present the proposed initial architecture, migrations and PR plan for review.
