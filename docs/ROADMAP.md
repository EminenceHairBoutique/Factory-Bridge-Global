# ROADMAP

**Status:** Living document. Dates are relative to founder approval of Phase 0; no calendar commitments. Each phase lists an exit gate that must be *demonstrated*, not asserted.

## Phase 0 — Evidence-based foundation (this phase; docs complete 2026-11-07, approvals pending)

Deliverables: this document set (`CLAUDE.md`, `docs/*`), repo audit, pilot recommendation, backlog with acceptance criteria.
Founder work in parallel: 30-day validation sprint (`PILOT_CATEGORY_SELECTION.md` §5), counsel engagement (OQ-06), decisions OQ-01…OQ-20.
**Exit gate:** founder approves target buyer, pilot families (OQ-15), data-rights posture (OQ-03/06), transaction role (OQ-04), MVP scope (PRD §3), paid accounts (OQ-16). No public promises exist.

## Phase 1 — Secure internal + buyer quote workspace (≈ 6–8 weeks of focused engineering)

Vertical slice: brief → intake → extraction → review → comparison → report → follow-up, with tenant isolation and audit.

| Week | Increment | Exit check |
|---|---|---|
| 1 | Scaffold monorepo, CI, local Supabase, migrations 0001–0002, auth + orgs + memberships, RLS negative tests | `pnpm test:rls` green; two orgs isolated |
| 2 | Migrations 0003–0006 (taxonomy seed for pilot specs, suppliers + restricted contacts, documents + buckets, projects/briefs); ops supplier CRM + research inbox | Operator can create supplier, contacts hidden from buyer JWT |
| 3 | Upload pipeline (quarantine → scan → parse) + worker + queue; `packages/domain` money/units/tiers | Synthetic PDFs/XLSX parsed; QE-01…QE-15 pass |
| 4 | AI extraction (`quote_extraction_v1`), review UI, human corrections, quotation versions (0007–0008) | 15-fixture smoke eval passes gates on synthetic set |
| 5 | Comparison engine integration, FX rows, landed-cost lines, comparison UI | AC-B4.* pass with synthetic quotes |
| 6 | PDF/CSV report, follow-up drafting + approval log, expiry sweep (pg_cron), audit explorer | AC-B5.*, AC-B6.* pass |
| 7–8 | Hardening: injection suite, rate limits, access logging, Sentry, restore drill, staging deploy; onboard **authorized real** documents from validation sprint into eval set | Full eval ≥ gates on ≥ 50 fixtures; founder demo |

**Exit gate:** repeatable end-to-end workflow with ≥ 2 isolated buyer orgs (one may be the founder's hair brand); RLS and injection suites in CI; no fake live labels; founder approves first external pilot onboarding.

## Phase 2 — Chinese supplier portal + outbound RFQs (≈ 6 weeks)

Supplier onboarding (zh-CN), catalog XLSX import with diff, price-tier editor with 确认有效/更新报价/暂停, RFQ draft → buyer approval → dispatch (portal + Resend email), inbound email webhook with signature verification and attachment pipeline, freshness/expiry reminders, translation review queue, permission settings (数据共享设置).
**Exit gate:** a supplier submits a quote without operator intervention; buyer sees only permitted data; private quotes remain segregated (tests); one RFQ round-trips end-to-end without manual DB edits.

## Phase 3 — Quality operations + managed sourcing (≈ 6 weeks)

QSR templates for pilot families, samples/golden sample flow, inspection jobs + results + defect findings, remediation cases, milestone tracking (estimated vs committed), operator SLA telemetry, approval gates by role (OQ-19), inspector scoped access.
**Exit gate:** one complete documented quality workflow on a real pilot order (sample → PSI → closure) with evidence; contractually defined service offering (OQ-04/12).

## Phase 4 — Licensed connectors and mature search (only if OQ-08 says yes)

Supplier ERP/CSV feed adapters with signed webhooks, sync health, revocation flows; ZH/EN hybrid search over permissioned catalog; image similarity over owned/authorized images; optional licensed marketplace adapter.
**Exit gate:** source licenses and revocation documented per connector; zero drift between rights and published results; integration health measured.

## Phase 5 — Commercial procurement platform

Stripe subscriptions/invoices, usage limits, purchase-intent and order-handoff workflows, freight/broker partner integrations, richer landed-cost scenarios, analytics (permission-aware, k-anonymous), enterprise features.
**Exit gate:** retention evidence, healthy unit economics, ongoing compliance controls.

## Cross-phase tracks

- **Eval set growth:** +10 fixtures/month from corrections (with permission).
- **Security:** quarterly key rotation, access review, restore drill.
- **Docs:** `STATUS.md` updated every session; ADR for every material decision.
