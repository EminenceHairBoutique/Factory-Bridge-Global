# DECISIONS — Architecture Decision Records

Living document. Append new ADRs; never edit an accepted ADR's substance — supersede it. Status values: `proposed` (awaiting founder), `accepted`, `superseded by ADR-n`, `rejected`.

---

## ADR-001 — Greenfield build; monorepo with pnpm workspaces
**Status:** accepted (engineering default; no founder impact)
**Context:** Repo contains docs only (2 commits, no code). Specs prefer Next.js/TypeScript/Supabase.
**Decision:** Greenfield. Single repo, `pnpm` workspaces: `apps/web`, `apps/worker`, `packages/{domain,ai,db,i18n}`. No microservices.
**Consequences:** Shared types and domain logic across web and worker; one CI pipeline; simple for a small team.

## ADR-002 — Next.js App Router on Vercel for all UI surfaces
**Status:** accepted
**Context:** Spec §6 default stack; founder's other projects use Vite+React, but this product needs server-side auth, server actions, SSR for a public site, and route handlers.
**Decision:** Next.js (App Router) + React + TypeScript + Tailwind. Public, buyer, supplier and ops surfaces are route groups in one app with separate layouts and middleware-enforced org-type gating.
**Alternatives:** Vite SPA + separate API — rejected: more plumbing for auth/SSR; two deploys.

## ADR-003 — Supabase (Postgres, Auth, Storage) with RLS as the second authorization layer
**Status:** accepted
**Decision:** One Supabase project per environment. RLS enabled and forced on every tenant table; server-side policy module is the first layer. Service-role usage confined to worker and reviewed privileged modules.
**Consequences:** Negative RLS tests are mandatory in CI; generated types in `packages/db`.

## ADR-004 — Unified `organizations` table with `org_type` (buyer | supplier | internal)
**Status:** accepted
**Context:** Spec lists separate supplier and buyer entities; a unified org model with typed extensions (`supplier_profiles`) keeps membership/invite/RLS logic single-path.
**Decision:** One org table; exactly one `internal` org; internal operators access buyer projects only via `project_assignments`.
**Alternatives:** Separate `suppliers` tenancy — rejected: duplicates auth/membership code.

## ADR-005 — Confidential-by-default data classes and restricted contact table
**Status:** accepted
**Decision:** `rights_class` and `visibility_scope` are required columns on quotes/documents/catalog rows. `supplier_contacts` is a separate restricted table; buyer-facing views exclude it; exports redact unless a grant exists.

## ADR-006 — Durable jobs on a Postgres queue processed by a separate always-on worker
**Status:** **proposed** (host choice needs founder approval = paid account)
**Context:** Document parsing + AI extraction can take minutes; Vercel functions are the wrong place. Supabase supports pgmq; pg-boss is a mature Node alternative on plain Postgres.
**Decision (proposed):** pgmq (Supabase-native, visible in dashboard) with a Node worker in `apps/worker`; fallback pg-boss if pgmq ergonomics disappoint in Phase 1 spike. Worker host: **Railway or Fly.io** — choose after a 1-day spike on scan-sidecar memory needs.
**Founder action:** approve one paid worker host (gate G1).

## ADR-007 — Provider-agnostic AI adapter; Anthropic as first provider; no tools in extraction prompts
**Status:** accepted
**Decision:** `packages/ai` adapter with versioned prompt templates and zod/JSON-schema structured outputs. First provider Anthropic (founder already uses the API). Extraction/translation/matching prompts have no tool access. Second provider added only for evaluation comparisons.

## ADR-008 — Money and quantities as `numeric(18,6)` / `decimal.js`; FX applied by rate row id
**Status:** accepted
**Context:** Label prices can be fractions of a cent; CNY/USD precision matters; floats are unacceptable.
**Decision:** Postgres `numeric(18,6)` for unit prices and quantities (`numeric(18,8)` for FX), `decimal.js` in TS, rounding only at presentation. FX rows are stored daily with source; conversions reference `fx_rate_id`.

## ADR-009 — Upload quarantine with malware scanning before promotion
**Status:** **proposed** (scanner choice)
**Decision (proposed):** Quarantine bucket → worker verifies magic bytes/size/page caps → scan → promote. Scanner: ClamAV sidecar in the worker (free, memory-heavy) **or** a hosted scanning API (cost per file). Decide in Phase 1 spike; `blocked` status for real-document intake until chosen.

## ADR-010 — FX rate source
**Status:** proposed
**Decision (proposed):** Start with a free ECB-derived daily feed for USD/CNY reference (e.g., Frankfurter API) stored in `fx_rates` with `source`; buyers can see the rate and date. Move to a commercial provider if intraday or bank-rate alignment is required. **Note:** ECB reference rates are not transaction rates; the report footer says so.

## ADR-011 — Chinese full-text search tokenization
**Status:** proposed (Phase 2)
**Decision (proposed):** Evaluate `pg_jieba`/`zhparser` availability on Supabase; fallback to trigram (`pg_trgm`) + pgvector multilingual embeddings over permissioned rows. Decide with real catalog data.

## ADR-012 — Phase 1 outreach is human-executed and logged; no system-sent supplier messages
**Status:** accepted
**Decision:** In Phase 1 the system drafts; an operator approves and sends via the operator's existing business channel (WeChat/email/phone), then logs channel, time and text. System-dispatched messages (portal/email) arrive in Phase 2 with the same approval gate.

## ADR-013 — Pilot families
**Status:** **accepted 2026-11-07 (founder, OQ-15)**
**Decision:** Pilot A: custom roll labels + printed folding cartons; Pilot B: human-hair bundles as a parallel internal design-partner pilot. Other categories stay extensible in the taxonomy but are not built into the MVP. See `PILOT_CATEGORY_SELECTION.md`.

## ADR-014 — Repository and product naming
**Status:** accepted 2026-11-07 (founder action)
**Context:** GitHub repo and README said "Great Wall Bridge"; all specs say "Factory Bridge Global".
**Decision:** Product and repo are "Factory Bridge Global". Founder created `EminenceHairBoutique/Factory-Bridge-Global` with fresh history (Phase 0 docs as initial commit) and a local checkout at `C:\dev\Factory Bridge Global`. `Great-Wall-Bridge` is superseded; archive it on GitHub to avoid confusion. Prior commit history (4 commits) is not carried over; the Phase 0 session report records what it contained.

## ADR-015 — Master spec file location
**Status:** accepted (path) / proposed (duplicate removal, OQ-01b)
**Context:** Commit `bcb72ec` (2026-11-07) placed the spec at `docs/FACTORY_BRIDGE_MASTER_ENGINEERING_SPEC.md`, matching the kickoff prompt, and left a byte-identical copy at `docs/research/FACTORY_BRIDGE_MASTER_ENGINEERING_SPEC.md`.
**Decision:** `docs/FACTORY_BRIDGE_MASTER_ENGINEERING_SPEC.md` is canonical and is what `CLAUDE.md` references. **Proposed:** delete the `docs/research/` copy (`git rm docs/research/FACTORY_BRIDGE_MASTER_ENGINEERING_SPEC.md`) so two copies cannot drift.

## ADR-017 — Toolchain pins (B-01)
**Status:** accepted
**Context:** At scaffold time the npm registry offered TypeScript 7.0.x, ESLint 10, Vitest 5, Next.js 16.4, React 19.3, Tailwind 4.3, zod 4.6.
**Decision:** TypeScript pinned to `~5.9` because `typescript-eslint` 8.x declares `typescript <6.1`; revisit when typescript-eslint supports TS 7. ESLint 10 flat config, Vitest 5, Next 16 App Router, Tailwind v4 (`@theme` tokens), zod 4. `pnpm` 10 via `packageManager` field (Corepack). Playwright added in B-05 when there is a flow to drive.
**Consequences:** Upgrading TypeScript is a deliberate ADR change, not a routine bump.

## ADR-018 — Where code is validated before it reaches the founder's machine
**Status:** accepted
**Context:** The working copy lives in a OneDrive-synced folder; `node_modules` there is a sync hazard, and the agent's shell on that mount cannot delete files (git lock-file problem).
**Decision:** Agents build and run checks in a scratch environment, then deliver only source files + `pnpm-lock.yaml` into the repo folder. The founder (or Claude Code) performs commits and pushes. Founder is advised to move the repo outside OneDrive before local `pnpm install`.

## ADR-019 — Executable migration order; helpers defined after the tables they read
**Status:** accepted (Phase 0.5)
**Context:** The Phase 0 plan put membership-dependent `language sql` helpers in migration 0001 and `project_assignments` in 0002, before `memberships`/`sourcing_projects` existed; Postgres validates SQL-function bodies at `CREATE`, so `supabase db reset` would have failed. Three policy helpers were referenced but never defined; `source_permissions ↔ documents` formed a cycle; the tier exclusion constraint lacked `btree_gist`.
**Decision:** Adopt `docs/MIGRATION_DEPENDENCY_MAP.md` as the normative order (0001 bootstrap → 0002 tenancy core → 0003 audit → … → 0012 jobs). Every helper is catalogued with its defining migration; `app.current_org_type()` is replaced by `app.is_member_of_type()`; `supplier_org_of`, `brief_item_project`, `catalog_grant_active`, `quotation_visible` are defined. The cycle is closed by adding `source_permissions.evidence_document_id` in 0007. All helpers use `SET search_path = ''` with schema-qualified references and restricted `EXECUTE`.
**Consequences:** Supersedes `SCHEMA_PLAN.md` §5 (Phase 0 text). B-03/B-04 redefined; audit moved to B-04b.

## ADR-020 — Access is granted by ownership, assignment or an active grant — never by a label
**Status:** accepted (Phase 0.5)
**Context:** The Phase 0 quotation policy let any buyer read catalog rows whose `visibility_scope = 'platform_buyers'`, i.e. a column value (which a supplier could set) acted as the grant.
**Decision:** Read predicates evaluate **active rights only**: org membership, project assignment, `quote_visibility_grants`, `contact_disclosure_grants`, or `source_permissions` (supplier, unexpired, unrevoked, viewer in `buyer_visibility`, field in `scope.fields`). `visibility_scope`/`rights_class` remain as declared intent, validated for consistency at write time and never consulted on read. Ownership columns are immutable via `app.prevent_owner_change`. Revocation semantics are fixed in `SECURITY_PERMISSION_MATRIX.md` §3.4 (catalog disappears immediately; a buyer's received negotiated quotes stay as their transaction record).
**Consequences:** `SECURITY_PERMISSION_MATRIX.md` is normative for both `packages/domain/policy` and RLS; B-07 tests every "—" cell.

## ADR-021 — Confirmed quotation payload is immutable; lifecycle lives in `quotation_states`
**Status:** accepted (Phase 0.5); supersedes the `quote_status` enum values of ADR-00x/Phase 0 (`draft`, `needs_review` removed)
**Context:** "Confirmed quotations are immutable" contradicted the required `expired/withdrawn/superseded` transitions and B-18's "UPDATE rejected by trigger".
**Decision:** `quotations` = commercial payload, immutable (trigger raises on UPDATE/DELETE). `quotation_states` (1:1) = `status ∈ {confirmed, superseded, expired, withdrawn}`, `is_current`, `superseded_by`; writable only by `app.transition_quotation` / `app.supersede_quotation` (SECURITY DEFINER, audited, idempotent, `FOR UPDATE` on `quote_groups`, unique partial index on `is_current`). Pre-confirmation state is `review_status` on `review_tasks`. `valid_until IS NULL` = validity unconfirmed, flagged, never auto-expired, never perpetual.
**Consequences:** `packages/domain/src/enums.ts` `QUOTE_STATUSES` updated; `ARCHITECTURE.md` §3.3 and `SCHEMA_PLAN.md` §2.6 rewritten; B-18 acceptance criteria rewritten.

## ADR-022 — Audit foundation lands in migration 0003, before any business table
**Status:** accepted (Phase 0.5)
**Context:** B-26 scheduled audit tables after uploads, quotes and exports — the actions most needing traceability.
**Decision:** `audit_events`, `security_events`, `document_access_log`, `app.record_audit_event` (actor from `auth.uid()`; `actor_override` only for `service_role`) and the row-change trigger are migration 0003 (B-04b). `authenticated` has no INSERT on `audit_events`. DB event log is the legal record; app request logs (pino/Sentry) are operational and redacted. Retention follows OQ-07.
**Consequences:** B-26 shrinks to the explorer UI; B-07 depends on B-04b.

## ADR-023 — Effort is stated in engineering-person-days; calendar claims require a staffing decision
**Status:** accepted (Phase 0.5)
**Context:** Phase 1 was labelled "≈ 6–8 weeks" while the backlog's own sizes sum to ≈ 85 person-days.
**Decision:** Roadmap states person-days and two staffing scenarios (solo 14–18 weeks; two engineers 8–10 weeks) with 20 % contingency; no calendar dates until OQ-18 is answered; no percent-complete figures except from closed backlog items.

## ADR-024 — Tabular exports: XLSX workbook, or ZIP of per-table CSVs
**Status:** accepted (Phase 0.5)
**Context:** The spec said "CSV … plus a summary sheet"; a CSV has no sheets.
**Decision:** XLSX with sheets `summary/quotes/landed_cost_lines/assumptions/fx_rates`; CSV export is a ZIP of the same five tables. Every row carries quotation version id, `confirmed_at`, original currency, FX rate id; contacts redacted unless granted.

## ADR-025 — Colloquial Chinese price terms never map to a confirmed Incoterm
**Status:** accepted (Phase 0.5)
**Context:** The glossary mapped 出厂价→EXW and 离岸价→FOB directly; in practice these are informal price descriptions, not contractual trade terms with named places.
**Decision:** Extraction returns `priceBasis: null` plus flag `basis_term_colloquial` (added to `quote_extraction_v1`) unless the document states an Incoterm code and a place; `quotations.basis_confirmed = false` groups as `basis_unknown` in the engine until the supplier confirms. Glossary rows rewritten in `AI_EVALUATION_PLAN.md` §4.

## ADR-026 — Transaction role for development: buyer-side adviser/facilitator (engineering default)
**Status:** accepted as an **engineering default** 2026-11-07 (founder, OQ-04); **commercial/legal terms remain pending**
**Decision:** The software assumes Factory Bridge Global advises and facilitates; it is never buyer, importer of record, or reseller. "Accept quote" produces a purchase handoff/checklist, never an order. Fees are modelled as disclosed service fees separate from supplier prices. Any contract, fee schedule, guarantee or remedy language still requires founder + counsel approval before use (OQ-09, OQ-12).

## ADR-027 — PR-only development with required CI checks on `main`
**Status:** accepted 2026-11-07 (founder, OQ-20)
**Decision:** No direct pushes to `main`. Every change arrives by pull request with the `check` and `rls` CI jobs required. Agents cannot change GitHub settings; the founder configures the ruleset (steps in `STATUS.md` → "Founder actions"). Parallel agent sessions use separate git worktrees and disjoint backlog items.

## ADR-028 — No paid infrastructure or production deployment yet; supplier form is draft-only
**Status:** accepted 2026-11-07 (founder, OQ-16 and OQ-03)
**Decision:** Local development and GitHub Actions are the only environments. No Supabase/Vercel/worker-host paid accounts, no production deploy, no real supplier or buyer data. The bilingual supplier data-authorization form (B-00b) is drafted but **must not be used externally** before legal review (OQ-06).

## ADR-029 — AI call ledger lands before documents; monthly AI budget is a worker-side guard over a SQL sum
**Status:** accepted 2026-11-07 (B-16b)
**Context:** `ai_runs` was planned for migration 0010 (with `ai_extractions`), but cost accounting and the per-org budget guard (B-16) must exist before the first live model call, and `ai_runs` depends only on `organizations` (0002) and the security-event writer (0003).
**Decision:**
1. `ai_runs` moves to migration 0003b (`20261107000350_ai_runs_budget.sql`) as an append-only ledger written **only** by `app.record_ai_run()` from the worker (`service_role`); nobody has UPDATE/DELETE. `ai_extractions`, `review_tasks`, `human_corrections` stay in 0010 and reference `ai_runs(id)`.
2. Cost is stored as the adapter's integer `cost_nano_usd`; `cost_usd` is a generated column. No floating-point money arithmetic in SQL or TS. The ledger value is an accounting signal, never a buyer-facing total.
3. The monthly cap is enforced in the worker (`GuardedAiRunner`) by calling `app.ai_budget_status()` **before** every provider call: a deterministic SQL sum of this UTC month's `cost_nano_usd` vs `ai_budgets.monthly_cap_nano_usd`, or the platform default (`AI_MONTHLY_BUDGET_USD_DEFAULT`) when the org has no row. A refusal is recorded as `status = budget_refused` with zero usage and emits `security_events.kind = ai_budget_exceeded` in the same transaction. Two concurrent jobs can overshoot the cap by at most one call; the cap is a spend guard, not a ledger lock (revisit if per-call costs grow).
4. `security_events.kind` gains `ai_budget_exceeded` and `ai_canary_leak`; a validated output flagged `embedded_instruction_detected` emits `injection_flag`. Event `details` carry ids and purpose only, never model text.
5. Ledger idempotency: `(org_id, job_id)` is unique; a replayed job returns the existing run id. If the ledger write fails after a paid call, the job fails loudly rather than drop the spend record.
**Supersedes:** the 0010 placement of `ai_runs` in `MIGRATION_DEPENDENCY_MAP.md` and the `cost_usd numeric(12,6)` base column in `SCHEMA_PLAN.md`.

## ADR-030 — Suppliers at stage `lead_identified` are internal working data, not directory entries
**Status:** accepted 2026-11-07 (B-08)
**Context:** Operators create supplier profiles while researching (stage `lead_identified`) long before anyone has confirmed a contact. The matrix gives buyers R on "supplier profile (public fields)" but never says *which* suppliers.
**Decision:** `supplier_profiles` rows are readable by any signed-in user only once `stage <> 'lead_identified'`; the supplier's own org and internal staff read at every stage. `supplier_public_profile_v` applies the same filter and carries no contact, USCC or `created_by` columns; it is the only buyer-facing read path. `stage` and `entity_kind_verified` are written only by internal staff (trigger-enforced, independent of RLS); a supplier's insert/update of those columns is reset or raises. Changing the claimed `entity_kind` clears `entity_kind_verified`.

## ADR-031 — Restricted contacts: no operator access until project assignments exist (0008)
**Status:** accepted 2026-11-07 (B-08)
**Context:** Pattern D (SCHEMA_PLAN §3.2) grants assigned operators access to `supplier_contacts` through `project_assignments`, which arrive in migration 0008. Migration 0005 cannot reference them.
**Decision:** 0005 ships the strict subset: platform admins, compliance reviewers, the supplier's own org, and buyer orgs with an active `contact_disclosure_grants` row can read; only platform admins insert; platform admins and the supplier's owner/admin update. Operators — assigned or not — have **no** access until 0008 replaces `supplier_contacts_select/insert/update` and `contact_disclosure_grants_insert/update` with the assignment clause. The policies that consult the other table go through `app.contact_disclosed_to_me()` / `app.contact_org_of()` (SECURITY DEFINER) so the two policies never re-enter each other.

## ADR-032 — Grants are immutable except for revocation; the source register is data
**Status:** accepted 2026-11-07 (B-08)
**Decision:**
1. `contact_disclosure_grants` and `source_permissions` rows cannot be edited after creation except to set `revoked_at` / `revoked_by` / `revoke_reason` (trigger `app.grant_before_update`); a revoked row cannot be un-revoked; re-granting creates a new row (one live grant per `(contact, buyer org)`). Expiry and revocation are re-evaluated on every read — nothing is cached in a label.
2. `source_permissions.scope` is validated by `app.validate_permission_scope()` (allowed keys only; `named_orgs` requires a non-empty uuid list; `platform_buyers` must not carry one). `app.catalog_grant_active()` is the single predicate buyer-facing catalog visibility is evaluated against; `rights_class = internal_market_observation` can never be buyer-visible.
3. `source_systems` is the integration/permission register as **rows**: `marketplace.1688`, `marketplace.taobao`, `marketplace.weidian`, `messaging.wechat` ship with `status = 'blocked'`; only a platform admin may change a status and the migration's re-runnable reference block deliberately does not overwrite `status`. Connector work is gated on that row, not on a code comment.
4. `research_leads.rights_class` is CHECK-pinned to `internal_market_observation` and the table is internal-only. Observed prices never reach a buyer as a price.
5. No 0005 table grants DELETE to `authenticated`; rows are deactivated, archived or revoked.

## ADR-033 — Document status machine; promotion out of quarantine is a transition; storage policies key on the document row
**Status:** accepted 2026-11-07 (B-10)
**Decision:**
1. `documents.status` follows one transition table enforced by trigger: `uploaded → scanning → parsed | rejected`, `parsed → extracted → in_review → accepted`; `discarded` is reachable from every non-terminal state; `rejected`, `accepted`, `discarded` are terminal. A CHECK ties bucket to status (`uploaded/scanning/rejected` ⇒ `quarantine`; `parsed…accepted` ⇒ a served bucket), and `storage_bucket` may change only on `scanning → parsed`, which also requires `sha256`. A file therefore cannot be served before the scan passed, by construction.
2. Signed-in members may only *register* an upload (`uploaded`, `quarantine`, path `<org_id>/<document_id>/<file>`) and later *discard*; every other column and transition belongs to the processing worker (`service_role`, detected with `app.is_trusted_writer()`). `in_review → accepted` will be performed by the 0010 review functions as trusted writers. `document_pages` / `document_cells` are worker-only writes (no INSERT grant to `authenticated`).
3. Readability is one predicate, `app.document_readable()`: members of the owning org, the submitting supplier for its own submissions, platform admins; 0008 adds assigned operators. `rights_class` decides what a file may be *used for*, never who may *read* it.
4. `storage.objects` policies derive everything from the document row: upload only into `quarantine`, only for a document the caller's org owns that is still `uploaded`, at the registered path; read only in served buckets and only when the document is at that bucket+path and readable. A stale or planted object in a served bucket is unreadable. Quarantine is never readable by signed-in users. No UPDATE/DELETE policies for `authenticated`.
5. `document_access_log` is written only by `app.log_document_access()`, which re-runs the read predicate and records `auth.uid()`; the FK to `documents` is `on delete restrict`.
6. CI starts `storage-api` with the local stack: its migrations define the `storage.buckets` columns (`public`, `file_size_limit`, `allowed_mime_types`) the bucket rows depend on. PGlite carries a documented shim of that subset; it proves the SQL, not Supabase Storage.
**Deferred:** the signed-URL issuance endpoint (needs the web app's auth, B-05); `app.document_project()` (needs 0008).

## ADR-034 — Verification is evidence-gated and stages are earned; badges derive from one summary view
**Status:** accepted 2026-11-07 (B-08b)
**Decision:**
1. `supplier_verification_checks.result = 'pass'` requires an `evidence_document_id` that belongs to that supplier (or is an internal upload) and has passed the scan (`parsed` or later). Checks are immutable except `notes`; a later check of the same type supersedes (latest `reviewed_at` wins). `uscc_matched` cannot pass while the profile has no USCC.
2. The required check set per qualification stage (QUALITY_ASSURANCE §2) is data: `supplier_stage_requirements (stage, group_no, check_type)` — every group must be satisfied, any check in a group suffices. `app.supplier_stage_evidenced(supplier, stage)` is cumulative (the stage and every stage below it) and re-evaluated at read time, so an expired or superseded check flips it to false without touching `supplier_profiles.stage`; the badge then reads "expired — re-review needed".
3. A supplier profile is created at `lead_identified` (even by staff); `stage` may only be advanced when `supplier_stage_evidenced` holds for the target and all lower stages (`contact_confirmed` = an active contact with a recorded basis). Demotion is always allowed. The gate trigger is named to fire after 0005's "staff only" check.
4. `supplier_documents` record what the supplier *claims* a file is; `claimed_by_supplier` stays true and `verified_*` stay null until internal staff set them (trigger-enforced). UI copy for an unverified row is "supplier-provided, unverified" (SECURITY.md T20).
5. `supplier_verification_summary_v` is the only buyer-facing read of verification. It runs as its owner (not `security_invoker`), applies `app.supplier_visible()`, and exposes only check types passed/expired, dates, counts and whether the stage is evidenced — never notes, reviewer ids or evidence ids. Badge text is rendered from these columns and names the checks exactly.
6. `check_type` joins the enum registry (`packages/domain/src/enums.ts` → regenerated 0001 block). Evidence FKs on `source_permissions` and `supplier_facilities` are `on delete restrict` and validated by `app.evidence_document_fits()`.

## ADR-035 — Assignment makes the operator; the shortlist scopes what they see
**Status:** accepted 2026-11-07 (B-15)
**Decision:**
1. An internal operator is `I.op+` for a project only through an active `project_assignments` row (platform admins are `I.op+` everywhere). Platform admins assign; a project's active **lead** may add/deactivate **support** assignments on that project; nobody self-assigns. `app.is_assigned_to_project()` is the single predicate.
2. `project_suppliers` (the shortlist) is the link between a buyer project and a supplier. While a row is not `dropped`, that project's assigned operators may read, create and update the supplier's restricted contacts, read its submitted documents, and grant a contact to **that project's buyer org** (not to any other). Dropping the supplier removes the access on the next read. Operators therefore never hold blanket access to contacts (closes the ADR-031 deferral).
3. `documents.project_id` attaches buyer uploads to a project of the same org (trigger); assigned operators read those (closes the ADR-033 deferral). `app.document_readable()` is replaced with both clauses.
4. Compliance reviewers read projects and briefs and may change only `compliance_hold` / `compliance_note` (trigger-enforced); `lead_operator_id` is staff-only; `org_id`s are immutable (`app.prevent_owner_change`); Pattern-B children get `org_id` from the parent via the generic `app.assert_same_org(parent_table, fk_column)` trigger, which raises on a supplied mismatch.
5. Briefs start `draft`; `draft → ready` (buyer), `ready → in_sourcing` (assigned operator only — it precedes outreach, which humans approve), `in_sourcing → closed`, `ready → draft` to reopen. `ai_proposal` is stored as data; `confirmed_spec_id` must be a platform or own-org specification and is set by a person.
6. A brief item on a `blocked` taxonomy node is refused at insert; on a `review_required` node it is created with `compliance_hold = true`, which only compliance / platform admin may clear.
7. Not yet: audit-trail reads scoped to assigned projects (matrix `I.op+` AU) — `audit_events` policies are unchanged; RFQs, supplier messages and quote groups (0009) will hang off `project_suppliers`.

## ADR-036 — Quotations are written only by two functions; the lifecycle table lives in both TS and SQL and is tested equal
**Status:** accepted 2026-11-07 (B-20; implements ADR-021)
**Decision:**
1. `authenticated` holds SELECT only on `quote_groups`, `quotations`, `quote_tiers`, `quote_fees`, `quotation_states`, `quote_status_events`. Every write happens inside `app.supersede_quotation` (version 1 or a new version in the same thread) or `app.transition_quotation` (`expired`, `withdrawn`), both SECURITY DEFINER, both audited, both idempotent on a caller-supplied key (≥ 8 chars; a replay returns the first result and writes nothing). A reason (≥ 3 chars) is mandatory. Nothing is confirmed by a job: `supersede_quotation` requires `auth.uid()`.
2. `quotations`, `quote_tiers`, `quote_fees` raise on UPDATE/DELETE for everyone including the superuser (trigger). CHECKs pin the payload's honesty: `price_basis = unknown ⇒ basis_confirmed = false`; `valid_until ≥ quote_date` (NULL = unconfirmed); `quote_type ↔ buyer_org_id` (catalog/listing have no buyer); `quote_type ↔ rights_class` (listing ⇒ internal observation; catalog ⇒ catalog-permission or supplier-private; negotiated/final ⇒ customer-private / buyer-uploaded / supplier-private); `visibility_scope` consistent with type — and never consulted by reads.
3. Tier bands are `[min, max)`; overlap is impossible by `EXCLUDE USING gist`. MOQ, gaps, unit compatibility and non-monotonic prices are domain-engine flags, not DB errors.
4. The actor is derived, never passed: `app.quote_actor_for()` yields `system` (service_role, no uid), `platform_admin`, `assigned_operator` (brief item's project, or shortlist link for the buyer org × supplier), `supplier_owner`, `reviewer` (buyer member+), or null. `app.quote_transition_allowed(from, to, actor, via_supersede)` is the transition table; `supabase/tests/quotations.test.ts` enumerates every `(from, to, actor, via)` against `packages/domain` `canTransition` and fails on any divergence.
5. One current version per thread is a partial unique index, not application logic; both functions lock the `quote_groups` row. Superseding keeps the old version's row and events (`expired` → `superseded` is recorded as such).
6. `quote_visibility_grants` attach to an exact version, are created by assigned operators / platform admins with a reason, are immutable except revocation, and are the only way a third org reads a negotiated quotation. Catalog quotes are readable by buyers only while `app.catalog_grant_active(supplier, my org, 'price_tiers')` holds; internal staff read catalog and listing quotes without assignment.
7. Not in 0009: `extraction_id` FK (0010), `app.expire_quotations()` + schedule (0012), the domain engine's comparison snapshots (0011).

## ADR-037 — Landed-cost inputs are rows with provenance; a stored result cannot claim more than its inputs
**Status:** accepted 2026-11-07 (B-21)
**Decision:**
1. `fx_rates` are append-only rows `(base, quote, rate, rate_date, source, is_reference)`; written by the FX worker (`service_role`) or a platform admin by hand (audited, `recorded_by`); never updated — a correction is a new row under its own source. `app.fx_rate_for(base, quote, as_of, lag = 3)` implements QUOTE_ENGINE_SPEC §2.5 (exact day, else latest prior within the lag, else NULL = `missing_fx`); the TS engine implements the same rule and snapshots pin the row ids actually used.
2. `freight_estimates.status = 'sourced'` requires a `document_id` (a real quote); otherwise it is `estimated` or `missing`; a `provider` entry names the provider.
3. `duty_assumptions` are recorded by a signed-in person only (a job or AI run cannot insert — trigger), with an explicit `basis` (`buyer_provided | broker_advice | operator_lookup | unverified`); a `rate_pct` requires a basis other than `unverified`; `reviewed_by_broker` requires a broker name; HTS is a format-checked *candidate*.
4. `comparison_snapshots` are immutable (trigger, superuser included) and bind `brief_item`, `quantity`, `as_of`, `inputs_hash` (sha256), `engine_version`, every `fx_rate_id` (each must exist) and the result. `landed_cost_scenarios` are immutable, one per `(snapshot, quotation version)`, reference the quotation by `restrict` FK (a superseded version stays readable in the snapshot), and are validated: known line types only, statuses from `cost_line_status`, sourced/estimated lines carry a non-negative amount and currency, a `goods` line always present, `complete ⇔ no missing line`, `partial ⇒ landed_total IS NULL` and `eligible_for_ranking = false`. The writer must be able to see the quotation (`app.quotation_visible`).
5. Reads/writes follow the project (Pattern B): buyer owner/admin/member and assigned operators write; viewers read; compliance has no access; platform admins read.
6. Migration numbering: 0011 is applied before 0010 (`ai_review`, Claude Code) exists; the two are independent. Once a remote database exists, migrations must be added only with later timestamps (the CLI refuses out-of-order pushes) — 0010 will therefore get a timestamp after 0011 when it lands.

## ADR-038 — Queues and schedules live in the database where the extensions exist; the worker is the only queue client
**Status:** accepted 2026-11-08 (B-25 / B-11 schema half; implements ADR-006's pgmq choice — the worker *host* remains founder gate G1)
**Decision:**
1. Migration 0012 creates the pgmq queues (`fbg_documents`, `fbg_extraction`, `fbg_notifications`, `fbg_fx`) and the pg_cron schedules (`fbg_expire_quotations` 06:15 UTC, `fbg_notify_expiring_quotations` 06:30 UTC) inside guarded blocks that run only where `pgmq` / `pg_cron` are available. On PGlite the blocks are skipped with a NOTICE; the suite asserts that on the real stack (`engine: postgres`) both extensions are present and the queues/schedules exist — a missing extension on CI is a failure, not a pass. Schema `pgmq` is usable by `service_role` only.
2. `job_executions` is the worker's idempotency ledger: UNIQUE `(queue, idempotency_key)`; a redelivered message is a unique violation, never a second run. `jobs_dead_letter` holds poison messages with error and attempts; platform admins resolve (`requeued | discarded | fixed_manually`) and may change nothing else; internal staff read.
3. `notifications` are written only by the worker or `app.notify()` (SECURITY DEFINER; not executable by `authenticated`); a recipient reads their own rows and may change `read_at` only; `dedupe_key` is unique so sweeps are idempotent. Kinds are a CHECK list.
4. `app.expire_quotations()` expires every current `confirmed` quotation with `valid_until < current_date` through `app.transition_quotation` (key `expire:<id>:<date>`, actor `system` via a transaction-local `request.jwt.claim.role = service_role`), then notifies the buyer org's owners/admins once. NULL `valid_until` never expires automatically. `app.notify_expiring_quotations(n)` reminds owners/admins/members once per quotation within `n` days. Both are callable by `service_role` / cron only.
5. The worker consumer, retries, visibility timeouts and `/health` (the code half of B-11) are built against these tables; the FX job's provider is ADR-010 (still proposed).

## ADR-039 — The review gate: AI output becomes a quotation only when a person accepts it; operators intake into the buyer's tenant
**Status:** accepted 2026-11-09 (B-18, migration 0010 `ai_review`; timestamp `20261109000100` sorts after 0012 per ADR-037 §6); **amended 2026-11-10 (M0, §9)** — 0010 merged to `main` via PR #34 (`21c58e6`) before the M0 fixes landed, so per the append-only rule they ship as forward migration **0010b** `20261110000100_ai_review_hardening.sql`; 0010 is never edited
**Decision:**
1. `ai_extractions` are immutable, worker-written, and require a parsed document and an `ai_runs` row with `purpose = 'extract'` and an output (`ok` / `schema_invalid`). Their content — including anything a supplier document injected — is data; no column of an extraction is ever read as approval.
2. One `review_tasks` row per extraction (UNIQUE `(kind, subject_id)`), created `pending` by the worker. Ownership derives from the document (`org_id`, `project_id`); supplier-owned documents are refused (Phase 2 path). Status moves only through `app.start_review`, `app.reject_review` (reason ≥ 3 chars) and `app.accept_extraction`; `authenticated` has SELECT only. Resolved tasks cannot be reopened.
3. **Who decides:** buyer owner/admin/member of the task's org, the project's assigned operators, internal operators for internal-org tasks, platform admins. Viewers read; compliance, unassigned operators, other buyers and suppliers see nothing.
4. `app.accept_extraction` requires a signed-in person (a job is refused), forces `document_id` and `extraction_id` from the task (a payload citing another document is overridden), fills supplier / brief item / buyer org from the task, refuses a payload naming a different supplier, and calls `app.supersede_quotation` — so every 0009 rule (honesty CHECKs, tiers, actors, idempotency) applies. Replaying the same key returns the same quotation.
5. `human_corrections` are append-only (field path, before ≠ after, reason, `corrected_by = auth.uid()`), accepted only while the task is open.
6. A document moves `in_review → accepted` when its last open extraction task resolves and at least one was accepted (an all-rejected document stays `in_review` for re-run or discard). The move is made by `app.review_document_transition`, which raises the trusted-writer claim for one statement and restores it — never callable by `authenticated`.
7. **Operator intake:** an operator assigned to a project may register a document **owned by the buyer org** on that project, as `source_type = 'operator_import'` only, and upload its object to quarantine (0006's `documents_insert/update` and `fbg_quarantine_insert` are replaced). The quote stays confidential to the buyer by construction.
8. `quotations.extraction_id` gains its FK (`restrict`); `quote_fees.fee_type` adds the extractor's `inland_freight` and `export_doc`. `prompt_templates` mirrors the prompt registry (template id + sha256 version; one active per template; internal read).
9. **M0 hardening (2026-11-10, migration 0010b; found in the M0 review of the B-18 commit; each item has a test that fails against 0010 alone):**
   - *Replay needs the right to decide.* `app.accept_extraction` checks `app.review_task_decidable` **before** the idempotent-replay shortcut, so a viewer or outsider holding an earlier idempotency key learns nothing.
   - *Provenance is the document's, not the payload's.* Besides `document_id` / `extraction_id`, the accepted payload's `source_type` and `rights_class` are overwritten from the document row — a corrected payload cannot re-label a buyer-private operator import as a supplier-portal or catalog price.
   - *Operators touch only their own imports.* The replaced `documents_update` lets an assigned operator update (i.e. discard) a buyer-project document only when `source_type = 'operator_import'`; the buyer's own uploads stay readable to the operator but unchangeable (§7 narrowed).
   - *Resolution invariants hold for privileged roles too.* The `review_tasks` UPDATE trigger now refuses any status change without a signed-in person (`auth.uid()` null ⇒ a job, even `service_role` with table grants), requires `resolved_by = auth.uid()` on accept/reject, requires an accepted extraction task's `result_quotation_id` to cite the task's own document **and** extraction, and freezes a resolved task entirely (any column other than `updated_at`), not only its status (§2 strengthened). A future automated status (e.g. expiry) therefore needs its own ADR and migration.

## ADR-016 — No marketplace or messaging automation; connectors gated by the data-rights matrix
**Status:** accepted
**Decision:** S2 and S6 in `INTEGRATIONS_AND_PERMISSIONS.md` are permanently blocked. API connectors (S8–S11) require recorded license/scopes and founder approval before design is turned into code.

## ADR-040 — Public sourcing requests: fail-closed delivery adapters, no storage (proposed)
**Status:** **proposed** 2026-11-10 (B-31). Founder decision required before any delivery is switched on. Numbered after ADR-039 (merged in PR #34, `21c58e6`).
**Context:** PRD §7 allows a request-a-call form on the Phase 1 public site, and B-31 names Resend. Nothing is approved to deliver it: no paid accounts or production deploy (OQ-16 / ADR-028), no sending domain or entity (OQ-02), no privacy policy (OQ-06, SECURITY.md §8), no `anon` write path in the schema (SCHEMA_PLAN.md: `anon` receives none), and the worker that would own an email outbox (ARCHITECTURE.md §2, ADR-038) does not consume queues yet (B-11).
**Decision (proposed):**
1. The form posts to a Next.js server action (`apps/web/src/app/(site)/actions.ts`); `apps/web/src/server/inquiry/handle.ts` validates with a strict zod schema (minimum fields: name, work email, company, product family, optional quantity, message, consent; no uploads, no phone), rejects a filled honeypot or a form sent less than 2 s after it was shown (measured by the browser alone, no clock comparison), applies a per-client in-memory limit (5 per 10 minutes; best-effort only — the durable limiter is B-28), and deduplicates by an idempotency key derived from a browser-made submission id plus a hash of the validated content (an unchanged retry is delivered once; an edited retry is a new delivery). Every unsuccessful outcome echoes the visitor's input back to their own form.
2. Delivery is chosen by `INQUIRY_DELIVERY` and **fails closed**: unset/`disabled`/anything unknown or partially configured → `not_configured` (the page shows the form switched off and says why; the action refuses). `dry_run` validates end to end and sends/stores nothing; it is refused on a production `APP_ENV`. `resend` sends one plain-text email to a single fixed internal inbox (`INQUIRY_TO_EMAIL`) with the visitor only as Reply-To, a subject built from the product-family enum, and that idempotency key as the Resend `Idempotency-Key`.
3. Nothing is written to the database and nothing personal is logged (outcome codes only). The page receives only the delivery *mode*; keys and addresses stay in the server action.
4. The visitor is told "sent" only when the provider accepted the message; test mode and the switched-off state say plainly that nothing was sent or stored; a provider or network failure says delivery could not be confirmed (a timeout can follow a successful send), never "nothing was sent".
**Departure from ARCHITECTURE.md §2** (email via the worker outbox): a direct send from the web request is proposed for this single low-volume internal notification because the worker is not operational; when B-11 lands, move delivery behind `fbg_notifications` with the `job_executions` ledger and keep the same adapter contract.
**Founder decisions this needs:** provider and account (Resend or other, OQ-16); sending domain and `EMAIL_FROM` (OQ-02); recipient inbox; privacy-notice text and policy (OQ-06, counsel); whether requests should also be stored (retention, OQ-07); honeypot + timing vs a CAPTCHA (a third-party script and account); a CSP for the public pages (SECURITY.md T15).
**Consequences:** the public page can launch with the form switched off, or switch it on with environment configuration only; a prerendered page picks up a changed mode on the next build. The Resend adapter is unit-tested against a mocked `fetch` only and has never sent a real email.