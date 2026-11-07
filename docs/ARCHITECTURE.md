# ARCHITECTURE — Factory Bridge Global

**Status:** Phase 0 design. Nothing in this document is implemented. See `docs/STATUS.md`.
**Decisions referenced:** `docs/DECISIONS.md` (ADR-001 … ADR-012).

## 1. System overview

```
                         ┌─────────────────────────────────────────────────────────────┐
                         │                    apps/web  (Next.js, Vercel)              │
                         │  /              public site (EN)                             │
                         │  /app           buyer workspace (EN)                         │
                         │  /supplier      供应商工作台 (zh-CN first, EN fallback)         │
                         │  /ops           internal sourcing operations (EN, ZH-aware)  │
                         │  /api/*         typed route handlers (zod) — thin            │
                         └───────────────┬────────────────────────────┬────────────────┘
                                         │ Supabase Auth session        │ enqueue(job)
                                         ▼                              ▼
┌──────────────────────────────────────────────────────┐   ┌─────────────────────────────────┐
│ packages/domain  (deterministic, pure TS, 100% tested)│   │ Postgres queue (pgmq)           │
│  money · units · tier selection · incoterm            │   │  parse_document · extract_quote │
│  comparability · fx application · landed-cost lines   │   │  translate · match_catalog      │
│  · quote/RFQ/inspection state machines · policy       │◄──│  send_notification · gen_report │
└──────────────────────────────────────────────────────┘   │  import_csv · fx_refresh        │
                                         │                  └───────────────┬─────────────────┘
                                         ▼                                  ▼
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ Supabase project                                                                          │
│  Postgres (RLS on every tenant table) · Auth · Storage (private buckets, signed URLs)      │
│  pgvector (Phase 2+) · pg_cron (expiry sweeps, reminders) · audit_events (append-only)     │
└──────────────────────────────────────────────────────────────────────────────────────────┘
                                         ▲
                                         │ service-role (server/worker only)
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ apps/worker  (Node, long-running; Railway/Fly/Render — ADR-006, host not yet chosen)      │
│  isolated parsing (pdf/xlsx/image) · OCR · packages/ai adapter (Anthropic first)          │
│  schema validation · review-task creation · PDF/CSV report rendering · email via Resend   │
└──────────────────────────────────────────────────────────────────────────────────────────┘
                                         ▲
     Authorized inputs only:  supplier portal · buyer uploads · operator manual intake ·
     inbound email webhook (Phase 2) · CSV/XLSX templates · (Phase 4) licensed APIs/feeds
```

### Principles

1. **Thin edges, fat domain.** Route handlers validate, authorize and delegate. All business rules live in `packages/domain` and are unit-tested without a database.
2. **Two authorization layers.** Postgres RLS (using `auth.uid()` and helper functions) *and* server-side policy checks in `packages/domain/policy`. A bug in one must not leak data.
3. **Async for anything slow or external.** Document parsing, AI calls, email, report generation run in the worker from a durable queue with idempotency keys, retries and a dead-letter table.
4. **Evidence first.** Every derived fact (an extracted price, a translation, a comparison) links back to a stored source document, page/cell anchor, AI run id and reviewer.
5. **AI proposes, code decides, humans approve.** AI output enters the system as a *proposal* in a `review_tasks` row; acceptance writes the canonical record and an audit event.

## 2. The three workspaces

### 2.1 Buyer workspace (`/app`, English)

| Capability | MVP (Phase 1–2) | Later |
|---|---|---|
| Organization & team | Owner/member/viewer roles, invites | SSO, approval chains |
| Sourcing brief | Structured brief builder; AI normalizer proposes spec + ZH translation; buyer confirms hard attributes | Image similarity search |
| Uploads | Buyer uploads own quotes/PDF/XLSX/images into private bucket | Inbound email address per project |
| Supplier options | View operator-curated options with badge semantics | Search permissioned catalog |
| RFQs | Draft → buyer approve → ops dispatch (Phase 2) | Direct supplier portal dispatch |
| Comparison | Like-for-like table with mismatch flags, tier selection, Incoterm comparability, dated FX | Scenario modelling |
| Landed cost | Line-item estimate with explicit "missing" markers | Forwarder quote integration |
| Reports | PDF + CSV export with assumptions, sources, dates | Shareable links with expiry |
| QA status | Read-only view of samples/inspections (Phase 3) | Buyer approval of golden sample |

### 2.2 Supplier workspace (`/supplier`, 简体中文)

Starts in Phase 2. Phase 1 supplier data is entered by internal operators from authorized materials.

| Capability | zh-CN label | Notes |
|---|---|---|
| Onboarding & identity | 企业认证 | Legal name, 统一社会信用代码 (unified social credit code), authorized representative, documents. Verification is a status set by ops, never self-declared. |
| Catalog | 产品目录 | Manual entry or XLSX/CSV template import with preview and diff |
| Price tiers | 价格梯度 | `min_qty/max_qty/unit_price/currency/unit/price_basis/valid_until`; "确认有效 / 更新报价 / 暂停产品" |
| RFQ inbox | 询价单 | Accept / decline / 需要澄清 (clarify) / submit quote |
| Documents | 文件资料 | Drawings, test reports, sample photos — stored with provenance; **never auto-badged** |
| Permissions | 数据共享设置 | Per-field visibility: internal-only / platform buyers / specific buyer |
| Production & QA | 生产与质检 | Milestone updates, inspection evidence upload (Phase 3) |

### 2.3 Internal sourcing-operations workspace (`/ops`)

The first differentiator. Phase 1 builds the parts that make the buyer MVP work.

| Module | Phase | Purpose |
|---|---|---|
| Manual research inbox | 1 | Record a lead from legitimate manual 1688/Taobao/Weidian research: platform, URL/reference, ZH search term, observed range/MOQ, timestamp, `rights_class = internal_market_observation`. Never buyer-publishable as-is. |
| Supplier CRM | 1 | Supplier profile, facilities, **contacts (restricted table)**, vetting checklist state machine |
| Intake imports | 1 | Upload authorized catalogs/quotes (PDF/XLSX/images) with `source_type`, `rights_class`, permission record |
| Quotes awaiting review | 1 | Side-by-side: original document ↔ extracted fields ↔ confidence/flags; accept/correct/reject |
| Sourcing pipeline | 1 | Buyer projects assigned to operators; status per RFQ |
| Outreach approval queue | 2 | Drafted bilingual messages require approval before send; log channel used |
| Quality verification | 3 | Samples, inspection jobs, evidence, discrepancy tickets |
| Compliance holds | 1 | Category/product flags; blocked categories |
| Integration health | 4 | Connector status, sync cursors, errors |
| Audit explorer | 1 | Read-only view of `audit_events` |

## 3. Request and job flows

### 3.1 Authenticated request (synchronous)

```
Browser ──► Next.js route handler / server action
             1. zod-parse input
             2. getSession() → user, active organization, role
             3. domain.policy.assert(action, subject, context)   ← server-side check
             4. query via user-scoped Supabase client             ← RLS enforced again
             5. write audit_event (same transaction where possible)
             6. return typed DTO (never raw rows with hidden columns)
```

Service-role access is used **only** in the worker and in explicitly reviewed server modules (e.g., invite acceptance), each wrapped in a function that re-checks authorization and logs.

### 3.2 Document intake → review → comparison (the MVP slice)

```
upload (buyer or ops)
  → storage: quarantine/<org_id>/<uuid>            (private bucket, size/MIME policy)
  → documents row (status=uploaded, sha256, rights_class, source_type)
  → enqueue parse_document{document_id}            (idempotency_key = document_id:v1)

worker: parse_document
  → malware scan (ADR-009) → move to documents/<org_id>/<uuid> or reject
  → isolated parse: pdf→text+layout; xlsx→cells; image→OCR text + image blocks
  → document_pages / document_cells rows with anchors
  → enqueue extract_quote{document_id}

worker: extract_quote
  → build prompt (versioned template, NO tool access, content wrapped as data)
  → ai adapter → JSON → zod validate (quote_extraction_v1 schema)
  → numeric sanity: tiers ascending, qty ranges non-overlapping, currency ISO, incoterm enum
  → ai_runs + ai_extractions rows (raw + validated + confidence + anchors + flags)
  → review_tasks row (status=needs_review)         ← nothing canonical yet

ops/buyer reviewer (UI)
  → side-by-side; edits create human_corrections rows
  → accept → quotations + quote_tiers + quote_fees (version 1, immutable) + audit_event
  → quote_type/price_basis/valid_until must be set or explicitly "unknown"

comparison (deterministic, request-time, cached)
  → select candidate quotations for brief_item
  → spec match: hard attributes must equal brief; soft attrs flagged
  → tier selection for requested qty; MOQ check
  → incoterm comparability grouping
  → fx application from fx_rates row (date, source, rate id)
  → landed cost lines (each: sourced | estimated(assumptions) | missing)
  → result cached in comparison_snapshots with inputs hash

report
  → enqueue gen_report{comparison_snapshot_id, format=pdf|csv}
  → worker renders (React-PDF / csv-stringify), stores in reports/<org_id>/, signed URL 15 min
```

### 3.3 State machines (deterministic, in `packages/domain/state`)

- **Document:** `uploaded → scanning → parsed | rejected → extracted → in_review → accepted | discarded`
- **Quotation:** `draft → needs_review → confirmed → superseded | expired | withdrawn` (expiry via pg_cron sweep comparing `valid_until`; never silent)
- **RFQ (Phase 2):** `draft → pending_buyer_approval → approved → dispatched → responded | declined | no_response → closed`
- **Supplier qualification:** `lead_identified → contact_confirmed → legal_identity_reviewed → capabilities_documented` (supplier-level); `sample_passed`, `batch_inspected` are **per product variant / per lot**, never supplier-level flags.
- **Inspection job (Phase 3):** `requested → scheduled → in_progress → reported → accepted | rework | rejected`

Transitions are functions `(state, event, context) → state | Error`, exhaustively tested.

## 4. Module boundaries

| Package | Owns | Must not |
|---|---|---|
| `apps/web` | UI, route handlers, server actions, i18n rendering | contain pricing math or policy logic |
| `apps/worker` | queue consumers, parsers, AI orchestration, rendering | be reachable from the public internet except its health endpoint |
| `packages/domain` | money, units, tiers, incoterms, FX application, landed-cost, state machines, policy | import Supabase client or AI SDKs |
| `packages/ai` | provider adapter, prompt templates (versioned), output schemas, eval harness | write to the database directly |
| `packages/db` | generated types, typed query helpers, RLS helper SQL | hold business rules |
| `packages/i18n` | message catalogs en-US / zh-CN | contain stored-data translations (those live in DB with `source_lang`) |

## 5. Multilingual data model (summary; detail in SCHEMA_PLAN)

- UI strings: `packages/i18n`.
- Structured attributes: `attribute_definitions` with `label_en`, `label_zh`, `unit`, `data_type`, `allowed_values`. Values stored canonically (numbers in SI units with declared unit; enums by code).
- Free text: paired columns `*_en`, `*_zh` plus `source_lang` and `translation_run_id` so a translation is traceable to an AI run and a reviewer.
- Search (Phase 2+): Postgres FTS with `simple` + `zhparser`/`pg_jieba` evaluation for ZH tokenization (ADR-011), pgvector for multilingual embeddings restricted to permissioned catalog rows.

## 6. Deployment topology

| Component | Host (proposed) | Notes |
|---|---|---|
| `apps/web` | Vercel (Pro, 1 seat) | Preview deployments per PR; production only after founder approval |
| `apps/worker` | **To decide** (ADR-006): Railway / Fly.io / Render | Needs long-running process, outbound HTTPS to Supabase + AI provider, no inbound except `/health` |
| Database/Auth/Storage | Supabase Pro, one project per environment (`dev`, `prod`); `staging` optional | Spend cap on; PITR add-on before pilots |
| Email | Resend (outbound Phase 1; inbound Phase 2) | Domain verification needed; founder action |
| Monitoring | Sentry (web + worker), Supabase logs, worker structured logs | Alert on dead-letter growth, failed RLS tests in CI |
| CI | GitHub Actions | typecheck, lint, unit, RLS tests against `supabase start`, secret scan (gitleaks), migration dry-run |

Environments are fully separated: separate Supabase projects, separate keys, separate Resend domains/subdomains, separate Anthropic API keys with per-environment spend limits.

## 7. Configuration (names only; values never committed)

See `.env.example`. Server-only variables are never prefixed `NEXT_PUBLIC_`.

## 8. Non-goals for architecture (restated)

No microservices, no Kubernetes, no proprietary model training, no real-time marketplace mirroring, no autonomous outbound messaging, no payments/escrow, no customs classification engine. Revisit only with evidence of a bottleneck or an approved integration.
