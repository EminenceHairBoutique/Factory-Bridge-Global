# FACTORY BRIDGE GLOBAL — MASTER PRODUCT AND ENGINEERING SPECIFICATION

**Version:** 2.0 — consolidated first-start specification  
**Prepared:** November 6, 2026  
**Status:** Product requirements / proposed implementation, NOT an existing deployed application  
**Owners:** Founder (commercial decisions); Claude Code (assisted engineering); qualified external reviewers for security, customs, legal and category-specific product safety  
**Supersedes:** Earlier Factory Bridge sourcing concept notes and category addenda where there is a conflict

---

## 0. How Claude must use this document

This is the source of truth for the **intended** product. Do not assume a feature exists. Validate the repository and actual deployment before describing completed work. Work incrementally and record decisions. Identify assumptions explicitly; do not hallucinate marketplace API capabilities, factory permissions, product certifications, verified prices or deployment status.

Create a software platform that **augments a real sourcing operation**. An AI chatbot or a price-scraping dashboard alone is insufficient. The service combines the founder's Chinese language/cultural access and factory-negotiation ability with a repeatable, software-led buyer experience.

## 1. Executive product definition

**Name:** Factory Bridge Global (working name; entity, trademark, domain, and licensing status must be independently verified).

**Category:** U.S.-based/U.S.-facing B2B sourcing and procurement intelligence **software + optional managed service**.

**Positioning:** A professional U.S.-based sourcing partner helping businesses access quality-oriented Chinese manufacturers, compare authorized offers fairly, negotiate competitive factory pricing and manage quality, communication and procurement.

**Not:** A marketplace clone of Temu, Alibaba.com, 1688, Taobao, or Weidian; not a promise to provide every Chinese product; not a fulfillment service by default; not an unlicensed customs brokerage; not an importer of record by default; not a service that claims all Chinese products are superior or that consumer marketplace markups are uniformly 10x.

**One-sentence product statement:** *Factory Bridge Global combines U.S.-based customer service, bilingual direct-China sourcing expertise and AI-powered procurement tools to help businesses find verified supplier options, compare transparent landed-cost estimates, and make better quality-controlled purchasing decisions.*

### 1.1 Target buyer

Primary: U.S. small and midsize businesses that import repeatedly or want to source private-label/custom products directly from Chinese manufacturers; secondary: agencies, contract manufacturers, e-commerce brands, industrial purchasers and procurement teams.

Not a low-price consumer shopping portal. Support B2B order quantities, lead times, MOQs, inspection and production realities. If a retail buyer visits, explain the service minimums or offer a lead/referral path; do not pretend to be Temu.

### 1.2 Buyer problems

- Language barrier in finding and communicating with domestic Chinese suppliers.
- Difficult differentiation between genuine factory vs trading firm, and unverified quality claims.
- Marketplace tiered prices don't reflect the precise specification, custom work, quantity, shipping term, export readiness or negotiated deal.
- Hard to compare quotes when factories use different currencies, packaging, units, technical specifications, and trade terms.
- Risk of inconsistent samples versus production lots, late production, difficult after-sales remediation, or poor document trails.
- Lack of transparent end-to-end landed-cost picture and status tracking.
- Fragmented messages and supplier relationships across apps, spreadsheets, emails and contacts.

### 1.3 Value proposition: four accountable pillars

| Pillar | Operational support in product | Claims allowed only when proven |
|---|---|---|
| Quality | Specs, verified supplier evidence, sample signoff, category inspection plans, escalation cases | 'Inspected to agreed plan' rather than blanket defect-free guarantee |
| Competitive price | Transparent quote tiers, matching, negotiation records, fee breakout, landed-cost estimates | 'Best verified comparable offer among participating suppliers' ONLY when applicable and documented |
| Speed | Explicit response timestamps, priority queue, reminders, milestone/SLA measurement, escalation | 'Response within X business hours' only after pilot data and staffing prove it |
| Choice & accountable outcomes | 2–5 qualified options when available, documented tradeoffs, order-stage accountability, issues handling | Never guarantee availability of options or universal commercial success |

**Quality guarantee policy must be a separate approved commercial contract and rules engine** with scope, inspection method, remedies, deadlines, exclusions, liability caps, third-party inspection relationships, cargo insurance role, and responsibility per order. The software should be built to support this future policy, not silently enact promises before approval.

## 2. Competitive differentiation and brand positioning

The founder can search Chinese domestic platforms using Chinese terms and image search, inspect 1688 quantity tiers, and reach factory representatives directly through WeChat. This is valuable discovery and negotiation capability. The product turns these manual capabilities into standardized institutional knowledge and a scalable service.

### 2.1 Do not make unsupported competitor claims

Do not claim that Temu goods are always overpriced/poor quality or uniformly marked up 10x. A valid price comparison requires the *same material/specification*, quantity, sample quality, seller role, shipping method, import duties, payment terms, time, warranty/service and return conditions. Keep actual case studies with evidence and date stamps.

**Proposed public copy:**

- Eyebrow: `U.S.-Based Sourcing & Procurement` (only after domestic business/operating status verified)
- Headline: `Source Better. Verify Quality. Know Your True Cost.`
- Subheadline: `Factory Bridge Global helps U.S. businesses source from Chinese manufacturers with bilingual expertise, qualified supplier options, verified quotations, and transparent procurement support.`
- Primary CTA: `Start a Sourcing Request`
- Secondary CTA: `How Our Quality Process Works`
- Supporting benefits: `Direct Factory Communication`, `Transparent Quote Comparisons`, `Quality Checkpoints`, `One Accountable Sourcing Workspace`.

Never use counterfeit testimonials, fictitious supplier logos, invented savings charts, fake inspections or fabricated 'live supplier' counters. Publicly show case studies only after permission and verified evidence.

## 3. Operating model and procurement responsibilities

The initial default is **buyer-side sourcing adviser / facilitator**: help a buyer discover suppliers and compare offers. No automatic purchase order, deposit, import declaration or shipping commitment. Before any real order, obtain an approved written arrangement specifying who is buyer of record, seller, importer of record, quality-inspection contracting party, consignee, customs broker, carrier and insurer. Do not assume Factory Bridge is the importer/reseller.

**Decision gates:**

1. Entity and U.S.-based operating representation verification.
2. Business model: paid SaaS, managed sourcing fee, retainer, optional commission—disclose conflicts and fees.
3. Contract: whether buyer orders directly from factory or Factory Bridge resells as principal; material changes in liability.
4. Commercial guarantee: approved coverage, quality standard, verification, payment/remediation mechanics.
5. Trade compliance and third-party relationships (licensed customs broker, freight forwarder, inspector).

## 4. Initial product/category strategy

Launch with a **narrow, validated pilot** despite a broad long-term catalog.

**Five research categories and ten product families:**

1. **Custom packaging and labels:** roll labels (`定制卷筒不干胶标签`), printed folding cartons (`定制彩盒包装盒`).
2. **Blank / private-label apparel:** heavyweight cotton T-shirts (`重磅纯棉空白T恤批发`), polyester performance shirts (`速干运动空白T恤批发`).
3. **Human hair / salon supplies:** human-hair bundles (`真人发发帘批发`), lace-front wigs (`真人发蕾丝假发定制`).
4. **Non-medical consumer packaging:** PET/HDPE bottles (`化妆品PET瓶批发`), pumps/closures (`乳液泵头批发`).
5. **General industrial consumables:** industrial heat-sealer consumables (`工业封口机耗材`), custom conveyor belts (`工业PVC输送带定制`).

**Preferred commercial beachhead:** custom labels/folding cartons first; blank apparel second; hair as founder-expertise pilot. All categories require category-specific specifications, supplier and QA evidence. Do not call a product 'medical grade', sterile, pharmaceutical, compliant, authentic, virgin/raw hair, pure cotton or certified without appropriate evidence.

**Deferred/high-risk:** medical gloves, sterile/medical vials, ingestible capsules, finished cosmetics, pill presses, encapsulation equipment, HPLC equipment, potentially controlled or export-sensitive machinery, and products requiring advanced safety or market authorization. Permit only risk-reviewed internal inquiries pending category-specific compliance work; do not sell regulated products by default.

**Pilot success criteria, to refine with founder:** 10+ authorized sourcing records per pilot family, at least 3 credible supplier options for some test briefs, two willing buyer interviewees per family, one evidence-backed sample-to-quote workflow, and one paid pilot or explicit documented refusal reason. These are goals, not existing metrics.

## 5. User types and access model

1. **Public visitor**: can see marketing content, process, FAQ, request introductory call/inquiry. Not exposed to private costs or supplier contacts.
2. **Buyer organization owner**: manages organization, team seats, sourcing briefs, quotes, payments and approvals.
3. **Buyer team member**: accesses permitted projects; roles include viewer, requestor, approver.
4. **Supplier organization owner/member**: sees only its own profile, products, inbound RFQs approved for that supplier and its own responses.
5. **Internal sourcing operator**: sees assigned customer projects and supplier contacts, may normalize source research; cannot approve commercial commitments unless delegated.
6. **Internal admin/compliance reviewer**: manages assignments, supplier verification, regulatory flags, documentation and audit with separation of duties.
7. **Inspector/third-party partner (future)**: scoped, expiring access to specific jobs and documents.

Build multi-tenant authentication, invites, impersonation protections, least privilege, field-level confidentiality and admin action logs. Internal staff must have auditable access. Supplier and customer entities are different tenants; relationships are explicit project-level grants.

## 6. Buyer-facing functional requirements

### 6.1 Buyer onboarding

Company profile, jurisdiction, product categories, order volume band, destination, contact, agreement/consents and role invitations; keep nonessential onboarding short.

### 6.2 Sourcing brief builder

Allow typed English description, Chinese description, optional reference image, link, PDF, spreadsheet and multiple SKUs; quantity and quantity units; material/composition; size/tolerances; desired grade; branding/customization/artwork; compliance requirements; sample approval; destination postal code; target lead time and budget; target Incoterm if known.

AI turns the input into a structured brief but must ask for missing **material** values or tag unknowns. Store raw input, normalized version and review history.

### 6.3 Discovery & options

Search **our permissioned and verified catalog first**, using field filters plus EN/ZH multilingual, keyword and optional semantic/image similarity. Results clearly distinguish supplier, products, spec-fit, last updated, price type and readiness to quote. No claim of global 1688 live search unless approved integration actually exists.

### 6.4 RFQ lifecycle

Buyer drafts → buyer approves outbound → internal review if needed → supplier requests sent → supplier replies → extraction → review → clarification → confirmed/indicative offers → comparison → shortlist → sample request → buyer-approved order handoff. State transitions auditable, time-stamped and idempotent; drafts never send messages automatically.

### 6.5 Quote comparison

Show multiple offers with exact SKU/variant match scores and mismatch reasons, quantity tiers, pack/unit conversions, tooling/setup fees, sample fees, packaging, payment terms, production lead time, shipping terms and quote expiration. Explain why cheaper EXW is not automatically cheaper than more expensive FOB or DDP. No auto-ranking by unit price alone.

### 6.6 Landed cost estimation

Include supplier extended price + documented domestic origin costs + freight and insurance quotes + applicable duties and trade measures + brokerage/port charges + delivery and other buyer-authorized fees. If unavailable, mark explicitly **missing** and avoid presenting a falsely precise total. Use dated FX data and assumptions. Definitive customs classification or duty advice should be reviewed by a qualified licensed customs broker where appropriate.

### 6.7 Quality and order transparency

Project timeline, sample requests, golden sample approval, production checkpoint documents, inspection result, shipment status, exceptions, remediation case and report exports. Users should see exactly what was checked, by whom and when.

### 6.8 Customer communications

Customer-support inbox, source-linked updates, clarification tasks, notifications for a new quote, expiring quote, sample approval request, delayed milestone, inspection failure. Document preferred time zone and business-hours SLA.

## 7. Internal sourcing-operations workspace (the first critical differentiator)

Founder's staff need an admin UI to create and maintain private supplier intelligence from legitimate Chinese marketplace research and direct contact. Support:

- Internal research item with source URL/reference, platform, date, Chinese search term, private notes, author, authorization classification.
- Supplier contact record (company's legal Chinese name, public registration details when lawfully obtained, salesperson role, WeChat handle with consent/legitimate basis, response history, shipping/export capacity, location), and document evidence.
- Manual authorized catalog uploads: xlsx/csv/pdf/images, parsing preview, human mapping and deduplication.
- Tiered price editor: thresholds, currency, unit, quantity break, variant, inclusive/exclusive fees, MOQ, EXW/FOB etc, effective dates, source link and confidence/verification.
- Negotiated quote intake: who requested it, for which customer/quantity/specification, private visibility, terms, validity, consent to further use.
- Standardized supplier vetting checklist and status; *contacted ≠ factory-verified ≠ product-tested ≠ batch-inspected*.
- Follow-up queue and outreach approval (do not silently message via personal WeChat).
- Price history and alerts when supplier confirms a price revision.
- Permissions dashboard: may the source content be stored, translated, indexed, displayed to internal employees, displayed to a buyer or redistributed to other customers?

**Never treat visibility of a domestic platform listing as authorization to reproduce images or republish listing data.** Manual sourcing research may be used to identify leads subject to lawful access and contractual restrictions; commercial data should be built from supplier-authorized materials and independent records.

## 8. Chinese supplier portal

Simplified Chinese is a first-class interface, not a machine-translated afterthought. Factory staff can:

- Verify company identity and authorized representative.
- Add product catalogs or upload Excel pricing sheets.
- Control which information is public/catalog-only/private.
- Enter quantity-tier prices and lead times; mark domestic-vs-export availability.
- Accept, decline or clarify incoming RFQs.
- Attach technical drawings, test reports, sample photos, or certifications with provenance.
- Respond in Chinese and view an accurate copy of the buyer's approved specification.
- Report production milestones and submit QA/inspection evidence.
- Indicate trade readiness and allowed Incoterms; never imply certification from an uploaded unverified file.

Start with upload + portal + approved email replies; later add factory ERP/CSV scheduled feeds and permitted enterprise-messaging integrations.

## 9. Supplier data ingestion architecture

### 9.1 Source classifications

1. **Manual research lead**: recorded as internal research, not automatically buyer-publishable.
2. **Authorized supplier catalog**: signed/recorded permission to store/transform/distribute permitted product fields/images.
3. **Private negotiated quote**: buyer-specific restricted information and specific contract/expiry.
4. **Inbound supplier RFQ response**: securely ingest email/webhook, verify sender/context, then extract and review.
5. **Authorized factory system feed**: scope, auth, polling/event subscription, update SLAs, schema version and revocation.
6. **Licensed marketplace API**: distinct approved access and license conditions; review changed marketplace terms and API versions.

### 9.2 Integration requirements

Adapters expose `source_type`, `provider`, `permission_scope`, `last_sync`, `raw_payload_ref`, `normalized_record`, `ingestion_version`, `provenance`, `visibility`, `expiry`, `error_status`; secure authorization, rate limit, retries/backoff, checkpoints, and disconnect/revoke flow. Never conflate *data refresh event time* and *factory confirmation time*.

### 9.3 Prohibited assumptions

Do not claim to have universal real-time inventory, no-cost 1688 API access, automated personal-WeChat history, or unrestricted product image rights. No credential sharing, bot circumvention, simulated login crawling, or scraping contrary to terms. If an API is inaccessible, mark the integration **blocked** and keep a clean manual import alternative.

### 9.4 Initial update schedule (suggested, not guaranteed)

Supplier portal changes: event-driven; approved CSV feeds: negotiated daily/weekly; quote confirmations: on receipt and human review; sync job health: monitored; pricing validity: prompt renewal before expiration; FX reference: daily or transaction-timestamp dependent; shipping estimates: individually dated. Show freshness publicly.

## 10. AI modules and deterministic components

**AI services (provider-agnostic):**

- `product_brief_normalizer`: EN/ZH structured specs, missing field questions, category schema mapping.
- `quotation_extractor`: OCR/text from authorized documents; schema-constrained extraction with source/page references, review flags and units; no invented fields.
- `multilingual_matcher`: lexical + vector matching with hard gates for material/spec/unit/quantity.
- `supplier_message_drafter`: bilingual RFQ/follow-up drafts; requires user/staff approval before send.
- `quality_anomaly_flagger`: detect contradictions across spec, sample, quote and inspection evidence.
- `sourcing_copilot`: grounded question answering and workflow advice with citations to project evidence and permission-filtered retrieval.

**Deterministic business services:** money arithmetic using decimal types; price tier selection; unit conversion with dimensional validation; Incoterm comparability; FX rate lookup and dated application; landed-cost items; access policy; acceptance rules; quote expiry; order state machine. Never ask an LLM to compute authoritative cost totals.

**AI quality gates:** validated JSON schema, allowed model/tool versions, evidence/citation coverage, unknown field handling, hallucination regression set, 50+ manually reviewed quote examples before production claims, Chinese/English category-specific test sets, error tracking, human override, model cost quotas, prompt injection tests, document size/page limits.

## 11. Quality assurance service and evidence

Supplier qualification comprises separate independent states:

- `lead_identified` → `contact_confirmed` → `legal_identity_reviewed` → `capabilities_documented` → `sample_passed` → `batch_inspected` (last two are per product/lot, not permanent supplier attributes).

A **supplier verified** badge must link to the exact checks completed, review date and validity period. Avoid a general 'factory certified' claim without evidence.

Each category has a **Quality Specification Record** with critical dimensions/materials, tolerances, labeling, finish, performance tests, safety/compliance documentation and sample acceptance criteria. Buyers approve versions and changes.

Potential workflow: pre-production sample → written golden sample agreement → in-process checks as purchased → pre-shipment inspection under approved checklist → exceptions/defect classification → buyer decision → corrective action/reinspection/refund/repair per contract → closure and evidence retention.

For applicable products and where agreed, consider lot sampling according to **ISO 2859-1:2026**, using qualified inspectors and chosen sampling plans; acknowledge that sampling carries residual risk and does not prove zero defects. For regulated categories, specialist requirements supersede generic AQL inspection.

**Future conditional remediation policies** (not active promises) might distinguish Factory Bridge's own service errors, factory defects confirmed by inspection, transit damage and buyer-spec changes, each with responsibility and remedy. Founder/legal approval is mandatory before publishing any guarantee.

## 12. Core data model (proposed; migration details Phase 0)

All sensitive business objects must include `organization_id`, ownership, created/updated timestamps, audit history and explicit access paths when relevant.

- `organizations`, `users`, `memberships`, `roles`, `org_settings`, `invites`
- `supplier_profiles`, `supplier_contacts`, `supplier_facilities`, `supplier_verification_checks`, `supplier_documents`
- `product_taxonomy`, `attribute_definitions`, `products`, `product_variants`, `product_specifications`, `product_spec_versions`
- `source_systems`, `source_permissions`, `raw_source_documents`, `ingestion_jobs`, `sync_status`, `data_lineage`
- `catalog_listings`, `catalog_price_tiers`, `catalog_price_versions`, `availability_observations`
- `sourcing_projects`, `buyer_briefs`, `brief_items`, `attachments`, `rfqs`, `rfq_recipients`, `supplier_messages`
- `quotations`, `quote_line_items`, `quote_tiers`, `quote_fees`, `quote_versions`, `quote_reviews`, `quote_visibility_grants`
- `fx_rates`, `freight_estimates`, `duty_assumptions`, `landed_cost_scenarios`, `scenario_line_items`
- `samples`, `golden_samples`, `inspection_jobs`, `inspection_results`, `defect_findings`, `remediation_cases`
- `purchase_intents` (not necessarily purchase orders), `order_handoffs`, `milestones`, `notifications`
- `subscription_accounts`, `billing_events`, `usage_events`, `feature_entitlements`
- `ai_runs`, `ai_extractions`, `ai_eval_cases`, `human_corrections`, `audit_events`, `security_events`

Mandatory quote properties: `quote_type` [listing|supplier_catalog|negotiated_private|final_offer], product/variant/spec version, quote source ownership, quantity unit, currency, min and max ranges, MOQs, tooling and freight inclusions, Incoterms with named places, expiry, date confirmed, buyer scope, redistribution permission, document evidence and review status.

**No shared, buyer-visible supplier-contact database by default.** Protect trade secrets and negotiated prices. Deletion/retention must account for contracts, privacy and financial/legal records.

## 13. Reference architecture

```text
Public Site / Buyer Portal / Supplier Portal (EN + ZH-CN) / Internal Ops
                 |
     Auth + Organization RBAC + Server-side authorization
                 |
       Typed APIs / Domain services / Audit layer
        |                |               |
  Supabase Postgres    Object Storage   Background Job Queue
  RLS / pgvector      signed URLs       scoped workers
        |                |               |
  Catalog & Quotes  Source documents   Data import / Translation / RFQs
        |                                |               |
  Deterministic pricing/landed costs   AI providers   Authorized connectors
        |                                |               |
        +-------------- Evidence and human review ------+
                           |
                 Buyer comparison + reports
```

Recommended tech: Next.js App Router, React, TypeScript, Tailwind, accessible component system; PostgreSQL and Supabase Auth/RLS/Storage; queued background workers; secure model APIs; server-side PDF/CSV report generation; structured logs/telemetry; Sentry or equivalent; Stripe for subscription billing if authorized. Avoid complex microservices until bottlenecks justify them. Decide Vercel vs a separate worker host based on workload.

## 14. Security, privacy, and compliance requirements

**Security:** server authorization and Postgres RLS, cross-tenant test fixtures, secret management, limited signed object URLs, scoped service credentials, encrypted storage/transit, webhook verification, file type/size policy, malware scanning, isolated document parsing, prompts isolated from untrusted content, upload quarantine, rate limits, idempotency, audit trails, backups and recovery drills, deletion workflow, incident response plan. Use supplier-content sanitization and anti-XSS defenses.

**Data rights:** maintain explicit rights to access, store, transform, display and redistribute each catalog/document source. Private WeChat chats require user/participant authorization and supported integrations; don't assume automated access. Review PRC privacy/cross-border rules, U.S. privacy obligations and supplier confidentiality agreements as applicable.

**Trade compliance:** screen supplier/product risks, forced labor and provenance documentation, applicable import restrictions and product regulations. Do not generate definitive tariff/legal advice from an LLM or conduct regulated customs business without the required license. Use licensed brokerage and specialists when necessary.

**Claims:** FTC substantiation for assertions of 'U.S.-based', 'factory-direct', 'certified', 'verified', 'best price', 'saves X%', 'guaranteed quality', delivery timing and refunds. Make claims only when the company can demonstrate them.

## 15. User experience and brand system

Audience = U.S. businesses and professional manufacturers, not bargain-hunting retail consumers. Visual: polished, restrained, modern B2B procurement service; confidence, clarity and auditability. Suggested design palette: deep navy/slate + warm white + modest copper/teal accents, high readability and accessible contrast. Do not use counterfeit-looking seals, fake marketplace timers, cluttered low-price cards or excessive patriotic imagery. Show U.S.-based service identity accurately after legal review.

**Public site pages:** Home, How It Works, Quality & Inspection Process, Sourcing Categories, Our Services, Pricing / Request Quote, About, Contact, FAQs, Terms, Privacy, Process Transparency, Supplier Apply.

**Buyer app pages:** Overview, New Sourcing Request, Projects, Product/Spec Builder, Supplier Options, RFQs, Quote Comparison, Landed Cost Scenarios, Sample and QA Tracking, Messages, Reports, Billing, Team Settings.

**Supplier app pages (Simplified Chinese):** Dashboard, Company Verification, Product Catalog, Price Tiers, New RFQs, Quotations, Documents, Production/Inspection Requests, Messages, Settings.

**Operations app:** Sourcing Pipeline, Manual Research Inbox, Supplier CRM, Intake Imports, Quotes Awaiting Review, Quality Verification, Buyer Cases, Pricing/Reports, Integration Health, Compliance Holds, Finance/Contracts, Audit Logs.

Real-status badges only: `indicative listing`, `factory-confirmed quote`, `quote expired`, `verified identity (date)`, `sample approved for product variant`, `inspection pending`, `passed inspection per checklist`.

## 16. Revenue model and transparency

Potential models to test, not approved prices:

- SaaS access to research/quote comparison tools with clearly limited RFQ quotas.
- Paid sourcing engagement / RFQ service for hands-on bilingual outreach and review.
- Optional supplier verification / sampling / third-party inspection coordination fees.
- Recurring procurement support retainers for repeat importers.
- Enterprise integrations and procurement workflow customization.

Quote the service fee separately from supplier item prices and freight. If referral/commission compensation exists, disclose it and establish conflict-of-interest handling. Do not assume the founder is acting as reseller/importer. Estimate per-project labor, inspection, AI/token cost, support, customer acquisition and overhead; monitor gross margin by segment.

## 17. Phased implementation roadmap

### Phase 0 — Evidence-based foundation

Repo audit/greenfield plan, buyer interviews, initial legal/data-rights review, product criteria, architecture, schema/RLS and threat model, category schema, source permissions matrix, AI evaluation plan, mock-only UI prototypes and measurable pilot commitments.

**Exit gate:** founder-approved target buyer, pilot product families, data rights strategy, procurement role, MVP scope, test plan, no unsupported public promises.

### Phase 1 — Secure internal + buyer quote workspace

Auth/organizations/RLS; buyer brief; manual operations intake; supplier profiles; secure uploads; AI extraction; human review; quote comparisons; PDF/CSV export; audit logging. Use synthetic/test docs first, then authorized real samples.

**Exit gate:** repeatable end-to-end workflow with at least two buyer orgs isolated; sample tests; seeded, repeatable QA cases; no fake live API labels.

### Phase 2 — Chinese supplier portal + outbound RFQs

Supplier onboarding, catalog upload, price tiers, RFQ drafting and approval, notification, authorized reply intake, data freshness/expiry, translation review.

**Exit gate:** supplier can independently submit a quote, buyer sees only approved data, private prices stay segregated.

### Phase 3 — Quality operations + managed sourcing

Supplier vetting, sample tracking, QC checklists, inspection evidence, deviations, remediation case management, SLA telemetry, role/approval gates and operational dashboards.

**Exit gate:** one complete documented quality workflow, real-world pilot review and a contractually defined service offering.

### Phase 4 — Licensed connectors and mature search

Factory APIs/feeds with agreements, permissioned marketplace APIs where feasible, sync jobs, image similarity over owned/authorized catalog, improved source matching, analytics, richer category coverage.

**Exit gate:** source licenses and revocation flows documented; no drift between source rights and published results; integration health measured.

### Phase 5 — Commercial procurement platform

Purchase-intent workflows, approved order handoffs, freight/broker integration with specialized partners, sophisticated landed-cost scenarios, customer renewals, enterprise features and potential verified supplier performance benchmarking.

**Exit gate:** customer retention evidence, healthy unit economics, ongoing compliance and risk controls, maintained security posture.

## 18. MVP functional acceptance criteria

1. Two sample buyer organizations cannot read or modify each other's sourcing briefs, files, supplier responses or negotiated quotations through UI **or direct API/DB paths**.
2. An operator can store an authorized supplier document with source/rights metadata, upload time, category and review status.
3. A Chinese quote document can be ingested into typed structured fields with original evidence and unknown fields explicitly null/flagged.
4. A reviewer can correct extracted fields; corrections create an auditable version, not silent mutation.
5. A supplier can have multiple product variants and exact price tiers; picking quantity 500 cannot select a 2,000+ tier.
6. Comparison prevents ranking mismatched specifications as equivalent and flags incomparable shipping terms.
7. An expired quote is visibly expired and cannot silently be used as a confirmed current price.
8. Buyer-facing export includes all assumptions, price source date, reference documents available to buyer, and total-cost exclusions.
9. All email/webhook side effects have idempotency keys and verifiable source authentication.
10. AI failure never authorizes a payment, exposes confidential data, or fabricates a final landed-cost figure.
11. Company location, supplier verification, QC badges, and claimed savings have documented evidence before marketing display.
12. Release gates require passing tests, dependency and secret scans, RLS checks, operational review and a rollback plan.

## 19. Business KPIs and learning loops

Track without fabricating: valid buyer interviews, qualified customer leads, trial-to-paid conversion, cost per acquisition, retention, RFQ response rate, median time to first qualified quote, valid supplier options per RFQ, quote accuracy/review correction rate, quote freshness, spec mismatch prevalence, inspection pass/rework rate, customer-reported savings with exact comparable baseline, gross contribution per project and dispute-resolution time.

### Pilot data plan

Initial research target: 10 product families × up to 10 supplier-product offers = 100 internal records. Do not assume 100 offers are license-cleared, verified or public. Obtain written supplier permission and 10–20 qualified supplier introductions over time. Pilot one-to-three products and aim for one to three paying buyers before heavy automation investment.

## 20. Principal risks and mitigations

| Risk | Mitigation |
|---|---|
| Marketplace API unavailable or restricted | Direct supplier catalog permission + manual intake |
| Low apparent China price but high landed cost | itemized landed-cost comparison; dated FX and freight quotes |
| Inferior product quality | testable category specs, golden samples, inspections, evidence and remedies |
| False/borrowed certificates | source verification, expiration checks, qualified inspection |
| Private price leakage | per-buyer quote scope, RLS, API authorization, tests |
| Misleading 'guarantee' claims | legal-reviewed policy and evidence-backed badges/SLAs |
| Factory ignores RFQ | internal operator follow-up queue and measured response availability |
| AI hallucinates prices | deterministic calculation and explicit source references |
| Model/process goes down | resumable jobs, human fallback, retries and alerting |
| Founder overwhelmed by broad scope | pilot category and vertical-slice release plan |
| Customs/import restrictions | broker/expert review, blocked categories, provenance documentation |

## 21. Decisions to obtain before public launch

- Confirm legal entity/DBA/registered address/brand claim and trademark/domain plan.
- Decide exact target segment (U.S. SMB importers vs beauty/packaging brands vs sourcing agencies).
- Confirm first 1–3 product families and buyer interview criteria.
- Define what supplier contact information, prices and images can be distributed under agreements.
- Set order/payment role: sourcing adviser, disclosed intermediary or principal/reseller.
- Define who contracts with third-party inspectors and brokers.
- Establish warranty/quality-remedy/price-match and service SLA terms with counsel; no promises before then.
- Confirm launch geography, trade/compliance screening and insurance needs.
- Choose pricing tiers/fees only after paid pilot results.
- Set founder approval rules for external messages, purchases, deposits and POs.

## 22. Required repository deliverables

`CLAUDE.md`, `README.md`, `docs/PRODUCT_REQUIREMENTS.md`, `docs/ARCHITECTURE.md`, `docs/SCHEMA_PLAN.md`, `docs/INTEGRATIONS_AND_PERMISSIONS.md`, `docs/SECURITY.md`, `docs/QUALITY_ASSURANCE.md`, `docs/AI_EVALUATION_PLAN.md`, `docs/ROADMAP.md`, `docs/DECISIONS.md`, `docs/STATUS.md`, `docs/OPEN_QUESTIONS.md`; plus development environment template with no secrets.

**Do not generate all code at once.** Produce a Phase 0 plan and implement the first vertical slice in reviewed, testable commits.

## 23. Current-source references for engineering validation

These are reference starting points, not licenses or legal conclusions. Re-check official documentation and jurisdictional rules at implementation time.

- FTC advertising substantiation: https://www.ftc.gov/legal-library/browse/ftc-policy-statement-regarding-advertising-substantiation
- 1688 legal statement (effective 2026-10-07): https://terms.alicdn.com/legal-agreement/terms/suit_bu1_b2b/suit_bu1_b2b201802011532_36855.html
- 1688 open platform changes: https://aop.alibaba.com/doc/notice.htm
- ISO 2859-1:2026 acceptance sampling: https://www.iso.org/standard/2859-1
- CBP forced labor import due diligence: https://content.govdelivery.com/accounts/USDHSCBP/bulletins/41bbeed
- CBP import licensing vs customs-broker license: https://www.help.cbp.gov/s/article/Article-1390?language=en_US
- CBP importer basics: https://www.help.cbp.gov/s/article/Article-1894?language=en_US

---

**Concluding instruction to the coding agent:** Build a trusted, evidence-based U.S.-facing sourcing service with transparent supplier options, quality-controlled workflows and robust engineering. Prioritize proven buyer value, authorized data and measured reliability over an oversized automated marketplace.
