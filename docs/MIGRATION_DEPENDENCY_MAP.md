# MIGRATION DEPENDENCY MAP

**Status:** Phase 0.5 corrected plan (supersedes `SCHEMA_PLAN.md` §5 of 2026-11-07 morning; see ADR-019). *Implementation as of 2026-11-10 (B-05):* every migration in §2 through 0012 (incl. 0003b, 0010 and its 0010b fixes, merged via #35) is on `main`; 0013 `web_auth_rpc` is on the B-05 PR. Merged migrations are never edited — fixes are forward migrations. `STATUS.md` is authoritative.
**Invariants:** (1) an object is created only after everything it references; (2) a `language sql` helper that reads a table is created in the same migration as that table or later (Postgres validates SQL-function bodies at `CREATE`); (3) no policy references an undefined helper; (4) no ordering problem is ever solved by dropping a constraint or leaving a permissive policy; (5) a fresh `supabase db reset` applies the whole chain with no manual steps.

## 1. Object dependency DAG (edges point at prerequisites)

```
extensions: btree_gist ──────────────────────────────┐
schema app, enums (generated), app.current_user_id() │  0001 bootstrap
auth.uid()  [Supabase-provided; test harness shims it]│
                                                      ▼
organizations ◄── memberships ◄── invites             0002 tenancy_core
     ▲               ▲
     │               └── app.is_member / app.has_role / app.is_internal / app.is_platform_admin
     │                   app.internal_org_id / app.is_member_of_type        (defined AFTER tables, same migration)
     │               app.prevent_owner_change()  app.set_updated_at()        (generic triggers; no table refs)
     │
audit_events ◄── app.record_audit_event() ◄── app.audit_row_change() trigger  0003 audit_foundation
security_events, document_access_log (table only; FK to documents added in 0006)
     │
product_taxonomy ◄── attribute_definitions                                    0004 taxonomy_products
products(owner_org_id→organizations) ◄── product_variants ◄── product_specifications ◄── spec_versions
     │
supplier_profiles(org_id→organizations) ◄── supplier_facilities               0005 suppliers_core
   ◄── supplier_contacts ◄── contact_disclosure_grants(buyer_org_id→organizations)
   ◄── source_permissions (evidence_document_id added in 0007; supplier_facilities.evidence_document_id likewise)
source_systems; research_leads(taxonomy_id→product_taxonomy)
app.supplier_org_of(p_supplier)                                              (after supplier_profiles)
     │
documents(org_id→organizations, source_permission_id→source_permissions)      0006 documents_storage
   ◄── document_pages, document_cells
document_access_log.document_id FK added here; storage buckets + storage.objects policies
     │
supplier_verification_checks(evidence_document_id→documents)                 0007 supplier_evidence
supplier_documents(document_id→documents); ALTER source_permissions ADD evidence_document_id FK
     │
sourcing_projects(org_id) ◄── project_assignments(project_id, operator_user_id)  0008 projects_briefs
   ◄── buyer_briefs(org_id denormalized + trigger) ◄── brief_items(org_id denormalized + trigger)
app.project_org / app.is_assigned_to_project / app.brief_item_project          (after these tables)
     │
quote_groups ◄── quotations(immutable payload; supplier_id, buyer_org_id, brief_item_id, spec, document) 0009 quotations
   ◄── quote_tiers (EXCLUDE USING gist — needs btree_gist from 0001)
   ◄── quote_fees
   ◄── quotation_states (1:1 mutable; is_current unique per group)
   ◄── quote_status_events (append-only; idempotency_key unique)
   ◄── quote_visibility_grants
app.transition_quotation() / app.supersede_quotation() / app.quotation_visible()   (after these tables)
     │
ai_runs(org_id), prompt_templates, ai_extractions(document_id, ai_run_id), review_tasks(org_id), human_corrections  0010 ai_review
     │
fx_rates; freight_estimates(project_id); duty_assumptions(project_id); comparison_snapshots(brief_item_id); landed_cost_scenarios  0011 fx_landed_cost
     │
pgmq queues; jobs_dead_letter; notifications(user_id, org_id); pg_cron expiry sweep → app.expire_quotations()  0012 jobs_notifications
     │
public.{create_organization, create_invite, accept_invite, update_membership, list_org_members} (INVOKER wrappers → app.*)
app.list_org_members; memberships_revoke_sessions → auth.sessions                       0013 web_auth_rpc (B-05)
     │
quality tables (Phase 3)                                                     0014+ deferred
```

**Circular references found and resolved:** `source_permissions.evidence_document_id → documents` while `documents.source_permission_id → source_permissions`. Resolution: `source_permissions` is created in 0005 *without* the evidence column; `documents` is created in 0006 with its FK to `source_permissions`; 0007 adds `source_permissions.evidence_document_id` with its FK. No constraint is weakened; the staged column is justified by the cycle and documented here.

## 2. Executable migration sequence

File names follow the Supabase CLI convention `<YYYYMMDDHHMMSS>_<name>.sql` under `supabase/migrations/`.

| # | File | Creates | Depends on | Code status |
|---|---|---|---|---|
| 0001 | `20261107000100_bootstrap.sql` | `create extension if not exists btree_gist`; schema `app`; **generated** enums (from `packages/domain/src/enums.ts`, drift-tested); `app.current_user_id()`; default-privilege revocation of `EXECUTE` on `app` functions from `public`/`anon`; grant `USAGE` on `app` to `authenticated`, `service_role` | Supabase `auth` schema (`auth.uid()`) | **implemented** (B-03) |
| 0002 | `20261107000200_tenancy_core.sql` | `organizations` (+ unique partial index: exactly one `internal`), `user_profiles`, `memberships`, `invites`; trigger fns `app.set_updated_at()`, `app.prevent_owner_change()`, `app.enforce_membership_role()` (SECURITY DEFINER since PR #5: the org lookup must not depend on the caller's RLS); table privileges revoked from `public, anon, authenticated, service_role` before the explicit grants (Supabase default privileges grant ALL otherwise — fixed in PR #5); helpers `app.internal_org_id()`, `app.is_member()`, `app.has_role()`, `app.is_internal()`, `app.is_platform_admin()`, `app.is_member_of_type()`; RLS + policies; mutation fns `app.create_organization()`, `app.create_invite()`, `app.accept_invite()`, `app.update_membership()` | 0001 | **implemented** (B-04); tested PGlite, CI on real Postgres pending |
| 0003 | `20261107000300_audit_foundation.sql` | `audit_events` (append-only; **no FKs** — the log must outlive its subjects, found by test), `security_events`, `document_access_log` (FK to documents added in 0006); `app.current_acting_as()`, `app.record_audit_event()` (actor from `auth.uid()`; `actor_override` only for `service_role`), `app.record_security_event()`, `app.audit_row_change()` trigger (redaction mode); triggers attached to 0002 tables | 0002 | **implemented** (B-04b); tested PGlite, CI pending |
| 0003b | `20261107000350_ai_runs_budget.sql` | `ai_runs` (append-only AI call ledger, **pulled forward from 0010** — it needs only organizations + the security-event writer; cost stored as integer `cost_nano_usd`, `cost_usd` generated), `ai_budgets` (per-org monthly cap, audited); `security_events.kind` gains `ai_budget_exceeded`, `ai_canary_leak`; `app.ai_month_start()`, `app.is_service_role()`, `app.ai_budget_status()`, `app.record_ai_run()` (service_role only; idempotent on `(org_id, job_id)`; emits security events), `app.set_ai_budget()` (platform admin); RLS | 0002, 0003 | **implemented** (B-16b, ADR-029); tested PGlite, CI pending |
| 0004 | `20261107000400_taxonomy_products.sql` | `product_taxonomy` (6 roots, 16 families incl. 6 **blocked** under `restricted`, 3 pilot), `attribute_definitions` (EN+ZH labels, enum values with ZH), `products`, `product_variants` (`attributes_hash` generated from canonical jsonb), `product_specifications` (versioned, immutable payload; replaces the planned `spec_versions` table); `app.validate_attributes()` deterministic validator + write triggers; **reference data lives in the migration** (idempotent upserts, re-run tested); RLS; audit triggers | 0002, 0003 | **implemented** (B-06); tested PGlite, CI pending |
| 0005 | `20261107000500_suppliers_core.sql` | `supplier_profiles` (one per supplier org; claimed vs verified columns, ADR-030), `supplier_facilities` and `supplier_contacts` (restricted; `org_id` denormalized by trigger), `contact_disclosure_grants` (immutable except revocation, one live per contact×buyer), `source_systems` (register as rows; marketplaces + WeChat `blocked`), `source_permissions` (validated `scope`; no evidence FK until 0007), `research_leads` (rights_class pinned); `app.supplier_org_of()`, `app.supplier_visible()`, `app.catalog_grant_active()`, `app.contact_disclosed_to_me()`, `app.contact_org_of()`, `app.validate_permission_scope()`, `app.is_trusted_writer()`; `supplier_public_profile_v` (`security_invoker`); RLS; audit (contacts redacted) | 0003, 0004 | **implemented** (B-08); tested PGlite, CI pending |
| 0006 | `20261107000600_documents_storage.sql` | `documents` (status machine ADR-033, bucket↔status CHECK, path convention trigger, MIME allow-list, 25 MB cap), `document_pages` (≤ 500), `document_cells` (cached values only); FK `document_access_log.document_id` (restrict); `app.document_readable()`, `app.storage_doc_id()` / `app.storage_org_id()` (safe path parsing), `app.storage_object_readable()`, `app.log_document_access()` (sole writer of the access log); bucket rows (`quarantine`, `documents`, `reports`, `supplier-evidence`, private, limits + MIME lists) + `storage.objects` policies `fbg_quarantine_insert` / `fbg_served_select`; RLS; audit on `documents` | 0005, storage-api | **implemented** (B-10); tested PGlite (storage shim), CI pending |
| 0007 | `20261107000700_supplier_evidence.sql` | `supplier_verification_checks` (pass ⇒ scanned evidence of that supplier; immutable except notes), `supplier_documents` (claimed until staff verify), `supplier_stage_requirements` (QA §2 as data); `app.supplier_stage_rank()`, `app.supplier_passed_checks()`, `app.supplier_expired_checks()`, `app.supplier_stage_evidenced()` (cumulative), `app.evidence_document_fits()`; stage gate trigger on `supplier_profiles` (born at lead, advance only with evidence); `evidence_document_id` FKs on `source_permissions` + `supplier_facilities`; `supplier_verification_summary_v` (owner-run, buyer-facing); RLS; audit | 0006 | **implemented** (B-08b); tested PGlite + local Postgres 16, CI pending |
| 0008 | `20261107000800_projects_briefs.sql` | `sourcing_projects` (Pattern A; buyer org only; staff-only lead, compliance-only hold), `project_assignments` (lead/support; admin or lead assigns), `project_suppliers` (shortlist = access link, ADR-035), `buyer_briefs` (status machine), `brief_items` (blocked refused, review_required → hold); `documents.project_id`; `product_specifications.brief_item_id` FK; `app.assert_same_org(parent, fk)`, `app.project_org()`, `app.is_assigned_to_project()`, `app.brief_project()`, `app.brief_item_project()`, `app.supplier_in_my_project()`; **replaces** `supplier_contacts_*`, `contact_disclosure_grants_insert/update` and `app.document_readable()` with the assigned-operator clauses; RLS; audit | 0003, 0004, 0005, 0006 | **implemented** (B-15); tested PGlite + local Postgres 16 ×4 on one database, CI pending |
| 0009 | `20261107000900_quotations.sql` | `quote_groups`, `quotations` (immutable; honesty CHECKs), `quote_tiers` (EXCLUDE gist), `quote_fees`, `quotation_states` (one current per group), `quote_status_events` (idempotency keys), `quote_visibility_grants` (version-exact; immutable except revocation); `app.quotation_visible()`, `app.quote_actor_for()`, `app.quote_transition_allowed()` (tested equal to the TS table), `app.transition_quotation()`, `app.supersede_quotation()`, `app.operator_for_buyer_supplier()`; SELECT-only grants; RLS; audit | 0005, 0006, 0008, btree_gist | **implemented** (B-20); tested PGlite + local Postgres 16 ×3 on one database, CI pending |
| 0010 | `20261109000100_ai_review.sql` (timestamp after 0012, ADR-037 §6) | `prompt_templates`, `ai_extractions` (immutable, worker-only), `review_tasks` (status via functions only), `human_corrections` (append-only); `app.review_task_visible()`, `app.review_task_decidable()`, `app.start_review()`, `app.reject_review()`, `app.accept_extraction()` (→ `app.supersede_quotation`), `app.review_document_transition()`; FK `quotations.extraction_id`; `quote_fees.fee_type` widened; **replaces** `documents_insert/update` + `fbg_quarantine_insert` for operator intake into a buyer project; RLS | 0006, 0008, 0009, 0011 (`app.immutable_row`) | **implemented** (B-18), merged via #34 (`21c58e6`), CI green on the real stack; never edited after merge — fixes go to 0010b |
| 0010b | `20261110000100_ai_review_hardening.sql` (M0, ADR-039 §9) | replaces `app.accept_extraction` (decide-before-replay; `source_type`/`rights_class` from the document), `app.review_task_before_write` (status only with a signed-in person, `resolved_by = auth.uid()`, accepted task cites its own document + extraction, resolved task frozen) and `documents_update` (assigned operator changes only `operator_import` rows); restates `accept_extraction` grants | 0010 | **implemented** (M0), merged via #35 (`a861da3`); CI green on `main` (run 42797946503) |
| 0011 | `20261107001100_fx_landed_cost.sql` | `fx_rates` (append-only; worker/admin write; public read), `freight_estimates` (sourced ⇒ document), `duty_assumptions` (person-only, basis required), `comparison_snapshots` (immutable; fx ids pinned and verified), `landed_cost_scenarios` (immutable; validated lines; partial ⇒ no total, never rankable); `app.fx_rate_for()`; RLS via project | 0008, 0009 (**not** 0010) | **implemented** (B-21); tested PGlite + local Postgres 16 ×3 on one database, CI pending |
| 0012 | `20261107001200_jobs_notifications.sql` | pgmq queues + pg_cron schedules (guarded by extension availability; asserted on the real stack), `job_executions` (idempotency ledger), `jobs_dead_letter` (admin-resolved), `notifications` (own rows; read_at only; dedupe); `app.notify()`, `app.expire_quotations()`, `app.notify_expiring_quotations()`; RLS | 0009 | **implemented** (B-25 + B-11 schema half); tested PGlite + local Postgres 16 (extension assertion deliberately fails off-Supabase), CI pending |
| 0013 | `20261110000300_web_auth_rpc.sql` (B-05, ADR-042; versioned after B-11's 0012b `20261110000200_worker_queue_grants.sql` on #39) | **no tables.** `public` SECURITY INVOKER wrappers `create_organization`, `create_invite`, `accept_invite`, `update_membership`, `list_org_members` (authenticated only); `app.list_org_members()` (owner/admin or platform admin; the only reader of teammates' emails); trigger `memberships_revoke_sessions` → `app.revoke_member_sessions()` (role/status change by someone else deletes the member's `auth.sessions`) | 0002, 0003, Supabase `auth.sessions` | **implemented** (B-05) on `eng/b05-auth-production`; tested PGlite (19 tests in `web-auth-rpc.test.ts` + public-function guard); real stack: CI on the PR |

## 3. Helper function catalogue (complete; every policy helper is listed here)

All helpers: schema `app`, `SECURITY DEFINER` only where they must read tables the caller cannot, `SET search_path = ''` (empty — every object reference is schema-qualified; this is the only search_path that is safe against caller-created shadowing objects), `STABLE`, `EXECUTE` revoked from `public` and `anon`, granted to `authenticated` (and `service_role` where noted). None reads a caller-controlled GUC except `auth.uid()`, which Supabase derives from the verified JWT.

| Function | Signature | Semantics | SECDEF | Defined in |
|---|---|---|---|---|
| `app.current_user_id()` | `() → uuid` | `auth.uid()` | no | 0001 |
| `app.internal_org_id()` | `() → uuid` | id of the single `internal` org (unique partial index guarantees ≤ 1) | yes | 0002 |
| `app.is_member(p_org uuid)` | `→ boolean` | active membership of `auth.uid()` in `p_org` | yes | 0002 |
| `app.has_role(p_org uuid, p_roles public.member_role[])` | `→ boolean` | active membership with role in set | yes | 0002 |
| `app.is_internal()` | `→ boolean` | `is_member(internal_org_id())` | yes | 0002 |
| `app.is_platform_admin()` | `→ boolean` | `has_role(internal_org_id(), {platform_admin})` | yes | 0002 |
| `app.is_member_of_type(p_type public.org_type)` | `→ boolean` | user has an active membership in **some** org of that type (replaces the undefined `current_org_type()`; there is no "active org" in the JWT) | yes | 0002 |
| `app.record_audit_event(...)` | `(entity_table text, entity_id uuid, action text, before jsonb, after jsonb, acting_as text, actor_override uuid default null)` | writes `audit_events`; `actor_user_id := coalesce(auth.uid(), actor_override)`; `actor_override` honoured only when `current_setting('role') = 'service_role'`, else raises | yes | 0003 |
| `app.audit_row_change()` | trigger fn | row-level AFTER trigger → `record_audit_event` with redaction for restricted tables (`supplier_contacts` diff is replaced by column names) | yes | 0003 |
| `app.prevent_owner_change()` | trigger fn (`TG_ARGV` = column names) | BEFORE UPDATE: raises if any listed column changes (`org_id`, `buyer_org_id`, `supplier_id`, `project_id`, …) | no | 0002 |
| `app.set_updated_at()` | trigger fn | `new.updated_at := now()` | no | 0002 |
| `app.ai_month_start()` | `() → timestamptz` | start of the current UTC month (budgets are monthly in UTC) | no | 0003b |
| `app.is_service_role()` | `() → boolean` | session role or JWT role claim is `service_role` (the worker) | no | 0003b |
| `app.ai_budget_status(p_org uuid, p_default_cap_nano_usd bigint)` | `→ (cap, spent, remaining, month_start, exceeded, alert)` | sum of `ai_runs.cost_nano_usd` this month vs `ai_budgets` cap (or the passed platform default); callable by service_role, the org's owner/admin, platform admin — raises otherwise | yes | 0003b |
| `app.record_ai_run(...)` | `(org, purpose, provider, model, template id, prompt hash, status, tokens…, cost_nano_usd, latency, attempts, flags, error, input_hash, triggered_by, job_id, request_id) → uuid` | the only writer of `ai_runs`; **service_role only**; `on conflict (org_id, job_id) do nothing` → returns the existing id; `budget_refused` → `security_events ai_budget_exceeded`, `canary_leak` → `ai_canary_leak`, flag `embedded_instruction_detected` → `injection_flag` | yes | 0003b |
| `app.set_ai_budget(p_org uuid, p_cap_nano_usd bigint, p_alert_pct smallint, p_note text)` | `→ void` | upsert `ai_budgets`; platform admin or service_role; audited by row trigger | yes | 0003b |
| `app.supplier_org_of(p_supplier uuid)` | `→ uuid` | `supplier_profiles.org_id` | yes | 0005 |
| `app.supplier_stage_rank(p_stage)` / `app.supplier_passed_checks(p_supplier)` / `app.supplier_expired_checks(p_supplier)` | `→ int` / `setof check_type` | ordinal of a stage; latest check per type that is a current pass / an expired pass | yes (sets) | 0007 |
| `app.supplier_stage_evidenced(p_supplier uuid, p_stage)` | `→ boolean` | cumulative: active contact **and** every required group of this stage and the ones below has a current pass (ADR-034) | yes | 0007 |
| `app.evidence_document_fits(p_document uuid, p_supplier uuid)` | `→ boolean` | document passed the scan and is the supplier's own or an internal upload; used by the evidence-column guards | yes | 0007 |
| `app.document_readable(p_document uuid)` | `→ boolean` | not `discarded` and (member of `documents.org_id`, or platform admin, or member of the submitting supplier org for `supplier_submitted_private` / `catalog_public_with_permission` files); 0008 adds assigned operators | yes | 0006 |
| `app.storage_doc_id(p_name text)` / `app.storage_org_id(p_name text)` | `→ uuid` | parse `<org_id>/<document_id>/<file>`; `null` (never an error) on any other shape | no (immutable) | 0006 |
| `app.storage_object_readable(p_bucket text, p_name text)` | `→ boolean` | a non-quarantine document exists at exactly that bucket+path and is `document_readable` | yes | 0006 |
| `app.log_document_access(p_document uuid, p_action text, p_ip_hash text)` | `→ uuid` | re-checks `document_readable` (or trusted writer), inserts the log row with `auth.uid()`; the only writer of `document_access_log` | yes | 0006 |
| `app.supplier_visible(p_supplier uuid)` | `→ boolean` | supplier is past `lead_identified`, or caller is a member of its org, or internal (ADR-030); used by child-table policies | yes | 0005 |
| `app.contact_disclosed_to_me(p_contact uuid)` | `→ boolean` | an unrevoked, unexpired `contact_disclosure_grants` row for the contact whose `buyer_org_id` the caller belongs to; breaks the contacts↔grants policy cycle (ADR-031) | yes | 0005 |
| `app.contact_org_of(p_contact uuid)` | `→ uuid` | `supplier_contacts.org_id` (the supplier org) | yes | 0005 |
| `app.validate_permission_scope(p_scope jsonb)` | `→ void` | raises `check_violation` unless scope has only `fields[]`, `images`, `redistribute`, `benchmark` (booleans), `buyer_visibility` ∈ {internal_only, named_orgs, platform_buyers}, and `named_org_ids` (non-empty uuid list iff `named_orgs`) | no (immutable, no table reads) | 0005 |
| `app.is_trusted_writer()` | `() → boolean` | session role or JWT role claim is `service_role` (same test as `record_audit_event`'s actor override) | no | 0005 |
| `app.assert_same_org(parent_table, fk_column)` | trigger fn (TG_ARGV) | BEFORE INSERT/UPDATE on denormalized children: sets `new.org_id` from the parent; raises if a different `org_id` was supplied | yes | 0008 |
| `app.project_org(p_project uuid)` | `→ uuid` | `sourcing_projects.org_id` | yes | 0008 |
| `app.is_assigned_to_project(p_project uuid)` | `→ boolean` | platform admin **or** an **active** `project_assignments` row for `auth.uid()` | yes | 0008 |
| `app.brief_item_project(p_brief_item uuid)` | `→ uuid` | `brief_items.project_id` (denormalized at write) | yes | 0008 |
| `app.brief_project(p_brief uuid)` | `→ uuid` | `buyer_briefs.project_id` | yes | 0008 |
| `app.supplier_in_my_project(p_supplier uuid)` | `→ boolean` | the supplier is on a non-dropped `project_suppliers` row of a project the caller is assigned to (ADR-035) | yes | 0008 |
| `app.catalog_grant_active(p_supplier uuid, p_viewer_org uuid, p_field text)` | `→ boolean` | an unexpired, unrevoked `source_permissions` row for the supplier whose `scope.buyer_visibility` covers the viewer org (`platform_buyers`, or `named_orgs` containing it) **and** whose `scope.fields` contains `p_field` | yes | 0005 |
| `app.operator_for_buyer_supplier(p_buyer_org uuid, p_supplier uuid)` | `→ boolean` | the supplier is shortlisted (not dropped) on a project of that buyer org the caller is assigned to | yes | 0009 |
| `app.quote_actor_for(p_quotation uuid)` | `→ text` | `system` / `platform_admin` / `assigned_operator` / `supplier_owner` / `reviewer` / null — derived from session + rows, never passed in | yes | 0009 |
| `app.quote_transition_allowed(p_from, p_to, p_actor text, p_via_supersede boolean)` | `→ text` | `ok` / `terminal_state` / `invalid_transition` / `actor_not_permitted` / `via_supersede_only`; mirrors `packages/domain/src/quote/lifecycle.ts` (parity test) | no (immutable) | 0009 |
| `app.quotation_visible(p_quotation uuid)` | `→ boolean` | the full read rule for quotations (§5 of SECURITY_PERMISSION_MATRIX): owner buyer org, assigned operator, owning supplier org, active `quote_visibility_grants`, or (catalog type **and** `catalog_grant_active(..., 'price_tiers')`) | yes | 0009 |
| `app.transition_quotation(p_quotation uuid, p_to public.quote_status, p_reason text, p_idempotency_key text)` | `→ void` | `expired` / `withdrawn` only; derives the actor, checks the table, writes `quotation_states` + `quote_status_events` + audit in one transaction; `FOR UPDATE` on the state and group rows; idempotent | yes | 0009 |
| `app.supersede_quotation(p_old uuid, p_new_payload jsonb, p_reason text, p_idempotency_key text)` | `→ uuid` | `p_old = null`: creates/reuses the thread and inserts version 1 (requires a signed-in person); otherwise inserts the next version, marks the old `superseded` (`superseded_by`), flips `is_current`, writes both events, audits — atomically; payload keys documented in the migration | yes | 0009 |
| `app.fx_rate_for(p_base text, p_quote text, p_as_of date, p_max_lag int = 3)` | `→ uuid` | QUOTE_ENGINE_SPEC §2.5: the `fx_rates` row dated `as_of`, else the latest prior within `max_lag` days, else NULL (`missing_fx`) | no | 0011 |
| `app.immutable_row()` | trigger fn | raises on UPDATE/DELETE (fx_rates, comparison_snapshots, landed_cost_scenarios) | no | 0011 |
| `app.expire_quotations()` | `→ integer` | pg_cron / worker: every current `confirmed` quotation with `valid_until < current_date` → `transition_quotation(..., 'expired', 'valid_until passed', 'expire:'||id||':'||current_date)` as `system` (transaction-local service_role claim), then `app.notify()` to the buyer org's owners/admins (deduped) | yes | 0012 |
| `app.notify_expiring_quotations(p_days int = 7)` | `→ integer` | reminders for current confirmed quotations with `valid_until` within `p_days`; one per quotation × user via `dedupe_key` | yes | 0012 |
| `app.notify(p_user, p_org, p_kind, p_payload, p_dedupe_key)` | `→ uuid` | the only writer of `notifications`; NULL when the dedupe key already exists; `service_role` only | yes | 0012 |
| `app.list_org_members(p_org uuid)` | `→ table(membership_id, user_id, email, full_name, role, status, accepted_at, created_at)` | team list with emails (from `auth.users`) for owners/admins of `p_org` and platform admins; raises 42501 for anyone else (ADR-042 §4) | yes | 0013 |
| `app.revoke_member_sessions()` | trigger fn | AFTER UPDATE OF role, status on `memberships` (only when one changed): when the change was made by someone other than the member, deletes the member's `auth.sessions` rows (refresh tokens cascade) — ADR-042 §5; not executable by `authenticated` | yes | 0013 |

**Data API wrappers (`public`, ADR-042 §1).** The Data API exposes `public` only, so each user action the web tier needs gets one wrapper there: `language sql`, **SECURITY INVOKER**, `search_path = ''`, a body that only calls its `app` function, EXECUTE for `authenticated` only. 0013 adds `public.create_organization`, `public.create_invite`, `public.accept_invite`, `public.update_membership`, `public.list_org_members`. Every public function is registered in `supabase/tests/rls-coverage.ts` `PUBLIC_FUNCTIONS`; the guard in `migrations.test.ts` fails on an unregistered one, a SECURITY DEFINER one, an unpinned `search_path`, a body that does more than call its `app` function, or EXECUTE for `anon` / `PUBLIC` / `service_role`.

**Recursion/privilege analysis:** helpers call only helpers defined earlier in this list; no helper calls a policy-protected table *through* RLS (SECURITY DEFINER reads bypass RLS on `memberships`, which is the point) and none accepts a parameter that selects *which user* to evaluate — the subject is always `auth.uid()`. `record_audit_event`'s `actor_override` is the single exception and is gated on the session role being `service_role`.

## 4. Bootstrap, seeds, uniqueness, cascades

- **Exactly one internal org:** `create unique index organizations_one_internal on public.organizations ((true)) where org_type = 'internal';` The seed (`supabase/seed.sql`) inserts it with a fixed UUID `00000000-0000-4000-8000-000000000001` using `on conflict (id) do nothing` — idempotent across repeated `db reset`.
- **First platform admin:** not seeded. Created by a one-time privileged script after the founder signs up (B-05), which inserts the membership via the service role and writes an audit event. Documented in `docs/runbooks/BOOTSTRAP_ADMIN.md` (B-05 deliverable).
- **Invites:** `token_hash` unique; `expires_at` ≤ 7 days; `accepted_at` set exactly once (CHECK + update guard); acceptance runs in a privileged function that re-verifies the email matches the signed-in user.
- **Memberships:** `unique (org_id, user_id)`; `on delete cascade` from `organizations` (deleting an org is itself forbidden by policy; soft-delete via `status`); `on delete cascade` from `auth.users` so Supabase account deletion leaves no orphans.
- **project_assignments:** `unique (project_id, operator_user_id)`; FK to `sourcing_projects on delete cascade`; `operator_user_id` must be a member of the internal org (trigger check, not FK — `auth.users` is the FK target).
- **Quotations:** `quote_groups(id, supplier_id, buyer_org_id, brief_item_id)`; `quotations(group_id, version)` unique; `quotation_states(quotation_id pk, status, is_current)`; `create unique index one_current_per_group on quotation_states (group_id) where is_current`. Children (`quote_tiers`, `quote_fees`) `on delete restrict` — a confirmed quotation is never deleted; retention/legal erasure is a documented superuser procedure.
- **Ownership columns are immutable** via `app.prevent_owner_change` on every tenant table: `organizations.org_type`; `memberships.org_id,user_id`; `sourcing_projects.org_id`; `buyer_briefs.project_id,org_id`; `brief_items.brief_id,org_id`; `documents.org_id`; `supplier_profiles.org_id`; `quotations.*` (entire row, see §6); `quote_visibility_grants.quotation_id,grantee_org_id`; `contact_disclosure_grants.supplier_contact_id,buyer_org_id`.

## 5. Quote-tier exclusion constraint (correct form)

```sql
create extension if not exists btree_gist;             -- 0001

create table public.quote_tiers (
  id            uuid primary key default gen_random_uuid(),
  quotation_id  uuid not null references public.quotations(id) on delete restrict,
  min_qty       numeric(18,6) not null check (min_qty > 0),
  max_qty       numeric(18,6)          check (max_qty is null or max_qty > min_qty),
  unit_price    numeric(18,6) not null check (unit_price >= 0),
  price_includes text[] not null default '{}',
  constraint quote_tiers_no_overlap exclude using gist (
    quotation_id with =,
    numrange(min_qty, coalesce(max_qty, 'infinity'::numeric), '[)') with &&
  )
);
```
Boundary semantics `[min, max)`: tiers `[100,500)` and `[500,2000)` do **not** overlap (touching bounds are allowed); `[100,600)` and `[500,2000)` are rejected. An unbounded top tier is `[2000, ∞)`. Gaps are allowed at the DB level and surfaced by the domain engine as `no_tier_covers_qty`. MOQ is a column on `quotations` and is enforced by the engine (`below_moq`), not the DB. Non-monotonic prices are allowed (warning flag `non_monotonic_tiers`), matching `QUOTE_ENGINE_SPEC.md` §2.3. Unit compatibility is a domain-engine concern (`unit_incompatible`), since it depends on specification data.

## 6. Quotation immutability vs lifecycle (resolves the contradiction)

- `quotations` holds the **commercial payload only** and is immutable: `BEFORE UPDATE OR DELETE` trigger raises `quotations are immutable; create a new version via app.supersede_quotation`. No `status`, no `superseded_by`, no `valid_until_effective` on this table. (`valid_until` as *stated by the supplier* is payload and stays here; `NULL` means **validity unconfirmed**, never perpetual.)
- `quotation_states` (1:1) holds mutable lifecycle: `status public.quote_status` ∈ {`confirmed`,`superseded`,`expired`,`withdrawn`}, `is_current`, `superseded_by`, `state_version`, `updated_at`. **No direct UPDATE grant** for `authenticated`; changes happen only inside `app.transition_quotation` / `app.supersede_quotation`.
- `quote_status_events` is append-only: `(quotation_id, from_status, to_status, actor_user_id, acting_as, reason, idempotency_key unique, at)`.
- Pre-confirmation work (draft, needs review) lives in `review_tasks`/`ai_extractions` (`review_status`), **not** in `quotations`. Accepting a review inserts the first confirmed `quotations` row. Hence `quote_status` loses `draft`/`needs_review` (ADR-021; enum updated in `packages/domain/src/enums.ts`).

Transition table (authorizer → allowed):

| From → To | Who | Restorable? | Notes |
|---|---|---|---|
| (review accepted) → `confirmed` v1 | reviewer with `member`+ on owning buyer org, or assigned operator | — | insert, inside `app.supersede_quotation` with `p_old = null` |
| `confirmed` → `superseded` | same as above, via `supersede_quotation` only | no | new version inserted in the same transaction; `is_current` flips |
| `confirmed` → `expired` | system (`expire_quotations`) or operator with reason | no — revalidation = new version | `valid_until < current_date`; NULL never expires automatically but is flagged |
| `confirmed` → `withdrawn` | assigned operator, or supplier org `owner/admin` for its own quote, with reason | no | terminal |
| `expired` → `superseded` | as `confirmed → superseded` | — | supplier revalidated; old stays `expired`? **No**: old becomes `superseded`, the event log retains that it had been `expired` |
| `withdrawn` → anything | — | — | terminal |
| `superseded` → anything | — | — | terminal |

Concurrency: `supersede_quotation` takes `select … for update` on the `quote_groups` row; the unique partial index on `is_current` makes a second concurrent accept fail deterministically rather than create two current versions. Idempotency: repeated calls with the same `p_idempotency_key` return the existing result without a second event.

Comparison snapshots store `quotation_id` (= exact version) and `fx_rate_ids`; a later transition never alters an earlier snapshot or report.

## 7. Verification plan for the chain (B-03 … B-18)

- `supabase db reset` from empty succeeds twice in a row (seed idempotency).
- Drift test: generated enum SQL == committed 0001 enum block.
- Helper-order test: each migration applied in isolation against the preceding ones; a `language sql` function referencing a missing table fails at `CREATE`, which is what we want the CI to catch early.
- RLS coverage test: every table in `public` has `relrowsecurity` and `relforcerowsecurity` true and at least one policy, except an explicit allow-list (`fx_rates`, `product_taxonomy`, `attribute_definitions` — public read, still RLS-enabled with a permissive `select` policy).
- Negative tests per table (B-07) run as **non-superuser roles** (`authenticated` with `request.jwt.claim.sub` set), never as `service_role`, because `BYPASSRLS` roles see everything regardless of `FORCE ROW LEVEL SECURITY`.
