# PRODUCT REQUIREMENTS — Factory Bridge Global

**Status:** Phase 0 design (nothing built). Supersedes nothing; refines `docs/FACTORY_BRIDGE_MASTER_ENGINEERING_SPEC.md` §6–§8 into buildable requirements with acceptance criteria.
**Related:** `ARCHITECTURE.md`, `SCHEMA_PLAN.md`, `QUOTE_ENGINE_SPEC.md`, `UX_INFORMATION_ARCHITECTURE.md`, `PILOT_CATEGORY_SELECTION.md`.

## 1. Product definition

A U.S.-facing, software-enabled sourcing service. The software productizes a bilingual sourcing operator's work — finding suppliers, collecting authorized quotes, normalizing them, verifying quality — into a repeatable, auditable buyer experience. Revenue model is undecided (OQ-04); the software must support SaaS, managed-service and hybrid without redesign.

### 1.1 Four pillars as measurable objectives (not promises)

| Pillar | Product mechanism | Metric (tracked from Phase 1) | Public claim allowed |
|---|---|---|---|
| Verified quality | Spec records, supplier check states, sample/inspection evidence, precise badges | % options with evidence; inspection pass rate | "Inspected to agreed checklist on <date>" with link to report |
| Competitive price | Like-for-like comparison, tier preservation, fee breakout, landed-cost lines | Options per brief; spread between offers | "Best comparable offer among participating suppliers for this spec/qty/term" only when ≥3 comparable confirmed quotes |
| Speed | Timestamps at every state change; operator queue SLAs | Median brief→first confirmed quote; supplier response rate | "Typical response X business days" only after ≥30 RFQs of pilot data |
| Choice & accountability | 2–5 qualified options target; named operator; escalation tickets | % briefs with ≥2 comparable options | Never guarantee options exist |

## 2. Users

| Persona | Workspace | Phase |
|---|---|---|
| Buyer owner / member / viewer | `/app` (EN) | 1 |
| Internal operator (bilingual sourcing) | `/ops` | 1 |
| Internal admin / compliance reviewer | `/ops` (elevated) | 1 |
| Supplier owner / staff | `/supplier` (zh-CN) | 2 |
| Inspector / third-party partner | scoped links | 3 |
| Public visitor | `/` | 1 (marketing only, no fabricated proof) |

## 3. MVP: the first vertical slice

**Buyer sourcing brief → authorized supplier/quote intake → AI bilingual structured extraction → human review → normalized comparison → PDF/CSV report → quote follow-up.**

Scope rule: a feature is in the MVP only if removing it breaks that sentence.

### 3.1 In scope (Phase 1)

| ID | Requirement |
|---|---|
| R-01 | Buyer org sign-up, invite members, roles owner/member/viewer |
| R-02 | Sourcing project + brief with structured fields and attachments; AI normalizer proposes structured spec (EN+ZH) and lists missing material fields; buyer confirms hard attributes |
| R-03 | Operator manual research intake (lead records, `internal_market_observation`) |
| R-04 | Supplier profile + restricted contacts + vetting checklist states |
| R-05 | Authorized document intake (ops or buyer upload): PDF, XLSX/CSV, JPG/PNG, with `source_type`, `rights_class`, permission reference |
| R-06 | Async parse + AI extraction into `quote_extraction_v1` schema with anchors, confidence, flags, nulls for unknowns |
| R-07 | Review UI: original ↔ extracted; corrections versioned; accept creates immutable quotation v1 |
| R-08 | Comparison for one brief item: spec match, tier selection for requested qty, MOQ, Incoterm comparability, dated FX, fee breakout, landed-cost lines with `missing` |
| R-09 | PDF + CSV report containing assumptions, sources, dates, exclusions |
| R-10 | Quote follow-up: operator drafts bilingual clarification (AI assisted), **approval required**, logged with channel; expiry reminders |
| R-11 | Audit log on every create/update/transition; audit explorer (read-only) |
| R-12 | Tenant isolation with RLS + server policy + negative tests |
| R-13 | Compliance hold flag on categories/products; blocked categories cannot be quoted |

### 3.2 Explicitly out of MVP

Supplier self-service portal (Phase 2), outbound RFQ dispatch by system (Phase 2; Phase 1 outreach is operator-executed and logged), inbound email parsing (Phase 2), any marketplace/API connector (Phase 4), payments/billing (Phase 5; pilot invoices manual), purchase orders, freight API, customs classification, image similarity search, mobile apps.

## 4. User stories with acceptance criteria

Format: **Given / When / Then**. "AC" ids are referenced from `BACKLOG.md`.

### Buyer

**US-B1 Create brief.** As a buyer member I create a sourcing brief for "custom roll labels, 2″×3″, white BOPP, permanent adhesive, 4-color, matte lamination, 10,000 pcs, deliver to NJ 07102."
- AC-B1.1 Given required fields missing (quantity, destination), when I save, then the brief saves as `draft` and the missing fields are listed; I cannot request options until they are present.
- AC-B1.2 When I click "Structure with AI", then I see a proposed structured spec with ZH translation, each field marked `from_input | inferred | missing`; nothing marked `inferred` is used for hard matching until I confirm it.
- AC-B1.3 Raw input, AI proposal, and my confirmed version are stored as separate versions with timestamps.

**US-B2 Upload own quotes.** As a buyer I upload three PDFs I already received.
- AC-B2.1 Files >25 MB or outside the allowed MIME list are rejected with a clear message; accepted files go to quarantine and show status `scanning`.
- AC-B2.2 Within the worker SLA (target < 5 min in dev) each shows `in_review` with extracted fields, or `rejected` with reason.
- AC-B2.3 A buyer from another org cannot fetch the file via signed URL, direct storage path, or API by id (negative test).

**US-B3 Review extraction.** As a buyer (or operator) I see extracted fields beside the source.
- AC-B3.1 Each extracted value shows its source anchor (page/bbox or sheet/cell) and a confidence band; clicking highlights the source.
- AC-B3.2 Unknown fields are `null` and labeled "Not in document" — never a default.
- AC-B3.3 Editing a value stores a `human_corrections` row (before/after/who/when); accepting creates quotation version 1; the AI proposal remains viewable.
- AC-B3.4 A quotation cannot be accepted while `currency`, `unit`, at least one tier, or `price_basis` (may be `unknown`) is missing.

**US-B4 Compare.** As a buyer I compare confirmed quotes for 10,000 pcs.
- AC-B4.1 Quotes whose hard attributes differ from the confirmed brief are shown in a "Not comparable — spec mismatch" group with the differing attributes named.
- AC-B4.2 The tier covering 10,000 is selected; if 10,000 < MOQ, the quote shows "Below MOQ (MOQ 20,000)" and is not ranked.
- AC-B4.3 EXW and FOB quotes are never ranked against each other on goods price alone; they are grouped by `price_basis`, and a combined ranking appears only when every landed-cost line needed to normalize them is `sourced` or `estimated` (never `missing`).
- AC-B4.4 Each converted price shows original currency/amount and the FX rate, source and date used.
- AC-B4.5 An expired quote (`valid_until` < today) appears greyed with "Expired <date>" and is excluded from ranking.

**US-B5 Export.** As a buyer I export the comparison.
- AC-B5.1 PDF and CSV include: brief version id, each quote's source document reference, `confirmed_at`, `valid_until`, `price_basis`, FX rate rows, every landed-cost line with status, assumptions list, exclusions list, generation timestamp.
- AC-B5.2 The PDF contains no supplier contact details unless the buyer's org has a `contact_disclosure_grant` for that supplier.

**US-B6 Follow-up.** As a buyer I ask Supplier B to confirm whether tooling is included.
- AC-B6.1 I can request a clarification; an operator sees it in the queue; an AI-drafted bilingual message is shown; **send is disabled until an operator approves**; the outbound record logs channel, approver, timestamp and message text.
- AC-B6.2 Supplier reply (entered by operator in Phase 1) creates a new quotation version; version 1 is unchanged.

### Internal operator

**US-O1 Record research lead.** AC-O1.1 Lead requires platform, reference, ZH search term, observed date; `rights_class` is fixed to `internal_market_observation`; UI shows "Internal only — not buyer-visible".
**US-O2 Create supplier + contacts.** AC-O2.1 Contacts are stored in `supplier_contacts`; buyers' queries never return that table (negative test); WeChat handle requires `contact_basis` (e.g., `supplier_provided_for_business`).
**US-O3 Intake authorized catalog/quote.** AC-O3.1 Intake requires `source_type`, `rights_class`, and a `source_permissions` reference when `rights_class ∈ {catalog_public_with_permission}`; without it the record is `internal_only`.
**US-O4 Vetting checklist.** AC-O4.1 Each check (identity doc reviewed, address corroborated, video call held, sample received, …) is a row with evidence file, reviewer, date, expiry; badge text is generated from completed checks only.
**US-O5 Compliance hold.** AC-O5.1 A product mapped to a blocked category cannot enter a brief or comparison; the UI shows "Compliance review required".

### Admin

**US-A1 Audit.** AC-A1.1 Every mutation on tenant data writes `audit_events` (actor, org, entity, action, before/after hash, request id); the explorer filters by org/entity/date; rows are append-only (no UPDATE/DELETE grants).

## 5. Non-functional requirements

| Area | Requirement |
|---|---|
| Security | See `SECURITY.md`. RLS on all tenant tables; CI fails on missing policy. |
| Availability | Pilot target: best-effort business hours; no SLA published. |
| Performance | Comparison render < 2 s for ≤ 20 quotes; extraction job p50 < 3 min per document (measure, don't promise). |
| Data retention | Source documents retained for the life of the project + 7 years for accepted quotations tied to orders (OQ-09 to confirm with counsel); deletion workflow honors legal holds. |
| Accessibility | WCAG 2.1 AA for buyer and supplier UIs; keyboard-complete tables. |
| Localization | en-US and zh-CN; numbers/dates/currency formatted per locale; canonical values unchanged. |
| Observability | Sentry on web+worker; structured logs with request id; AI cost per run. |
| Cost control | AI spend per org per month capped (soft limit alerts, hard limit blocks new jobs). |

## 6. Data classes (never conflated)

| Class | `quote_type` / `rights_class` | Who sees |
|---|---|---|
| Marketplace observation | `listing` / `internal_market_observation` | Internal only |
| Supplier-authorized catalog | `supplier_catalog` / `catalog_public_with_permission` | Platform buyers per permission scope |
| Private negotiated quote | `negotiated_private` / `customer_private_quote` | Owning buyer org + assigned ops |
| Final/accepted offer | `final_offer` / `customer_private_quote` | Owning buyer org + assigned ops |
| Landed-cost estimate | derived; never labeled a factory price | Owning buyer org |

## 7. Public-site copy constraints

Allowed headline set from the master spec §2.1. Prohibited until substantiated: "U.S.-based" (pending entity verification, OQ-02), "verified factories", savings percentages, supplier counts, testimonials, logos. The Phase 1 public site is informational with a request-a-call form only.

## 8. Success criteria for the MVP pilot (goals, not metrics yet)

- ≥ 2 external buyer orgs onboarded with signed pilot terms; founder's own hair brand may be a third, internal design-partner tenant.
- ≥ 10 authorized quote documents per pilot product family processed end-to-end.
- ≥ 95 % field-level accuracy after human review on the golden set; pre-review precision and false-confidence rate independently measured (see `AI_EVALUATION_PLAN.md`).
- 0 cross-tenant leaks in the RLS suite; suite runs in CI on every PR.
- 100 % of comparison rows link to a source document and `confirmed_at`.
- At least one buyer exports a report and acts on it (sample request or order outside the platform), with written feedback.
