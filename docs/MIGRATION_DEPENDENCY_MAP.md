# MIGRATION DEPENDENCY MAP

**Status:** Phase 0.5 corrected plan (supersedes `SCHEMA_PLAN.md` §5 of 2026-11-07 morning; see ADR-019). Only migration `0001` exists as code at the time of writing — see `STATUS.md`. Everything else here is the *executable order* the remaining migrations must follow.
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
   ◄── source_permissions (evidence_document_id added in 0007)
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
quality tables (Phase 3)                                                     0013+ deferred
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
| 0004 | `…_taxonomy_products.sql` | taxonomy, attribute definitions, products, variants, specifications, spec_versions; seeds for pilot families (idempotent `on conflict do nothing`) | 0002, 0003 | planned (B-06) |
| 0005 | `…_suppliers_core.sql` | `supplier_profiles`, `supplier_facilities`, `supplier_contacts` (restricted), `contact_disclosure_grants`, `source_systems`, `source_permissions` (no evidence FK), `research_leads`; `app.supplier_org_of()`; `supplier_public_profile_v` view; RLS | 0003, 0004 | planned (B-08) |
| 0006 | `…_documents_storage.sql` | `documents`, `document_pages`, `document_cells`; add FK `document_access_log.document_id`; storage buckets (`quarantine`, `documents`, `reports`, `supplier-evidence`) + `storage.objects` policies; RLS | 0005 | planned (B-10) |
| 0007 | `…_supplier_evidence.sql` | `supplier_verification_checks`, `supplier_documents`; `alter table source_permissions add column evidence_document_id uuid references documents(id)` | 0006 | planned (B-08b) |
| 0008 | `…_projects_briefs.sql` | `sourcing_projects`, `project_assignments`, `buyer_briefs`, `brief_items`; `app.assert_same_org()` trigger; helpers `app.project_org()`, `app.is_assigned_to_project()`, `app.brief_item_project()`; RLS | 0003 | planned (B-15) |
| 0009 | `…_quotations.sql` | `quote_groups`, `quotations` (immutable), `quote_tiers` (EXCLUDE), `quote_fees`, `quotation_states`, `quote_status_events`, `quote_visibility_grants`; `app.quotation_visible()`, `app.transition_quotation()`, `app.supersede_quotation()`; RLS | 0005, 0006, 0008, btree_gist | planned (B-18) |
| 0010 | `…_ai_review.sql` | `prompt_templates`, `ai_runs`, `ai_extractions`, `review_tasks`, `human_corrections`; RLS | 0006, 0008 | planned (B-18/B-19) |
| 0011 | `…_fx_landed_cost.sql` | `fx_rates`, `freight_estimates`, `duty_assumptions`, `comparison_snapshots`, `landed_cost_scenarios`; RLS | 0008, 0009 | planned (B-21) |
| 0012 | `…_jobs_notifications.sql` | `create extension pgmq`; queues; `jobs_dead_letter`; `notifications`; `app.expire_quotations()` + `cron.schedule` | 0009 | planned (B-11, B-25) |

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
| `app.assert_same_org()` | trigger fn | BEFORE INSERT/UPDATE on denormalized children: `new.org_id` must equal parent's `org_id` | yes | 0008 |
| `app.project_org(p_project uuid)` | `→ uuid` | `sourcing_projects.org_id` | yes | 0008 |
| `app.is_assigned_to_project(p_project uuid)` | `→ boolean` | platform admin **or** row in `project_assignments` for `auth.uid()` | yes | 0008 |
| `app.brief_item_project(p_brief_item uuid)` | `→ uuid` | `brief_items → buyer_briefs → sourcing_projects.id` | yes | 0008 |
| `app.catalog_grant_active(p_supplier uuid, p_viewer_org uuid, p_field text)` | `→ boolean` | an unexpired, unrevoked `source_permissions` row for the supplier whose `scope.buyer_visibility` covers the viewer org (`platform_buyers`, or `named_orgs` containing it) **and** whose `scope.fields` contains `p_field` | yes | 0005 |
| `app.quotation_visible(p_quotation uuid)` | `→ boolean` | the full read rule for quotations (§5 of SECURITY_PERMISSION_MATRIX): owner buyer org, assigned operator, owning supplier org, active `quote_visibility_grants`, or (catalog type **and** `catalog_grant_active(..., 'price_tiers')`) | yes | 0009 |
| `app.transition_quotation(p_quotation uuid, p_to public.quote_status, p_reason text, p_idempotency_key text)` | `→ void` | validates transition table, authorization, writes `quotation_states` + `quote_status_events` + audit in one transaction; `FOR UPDATE` on `quote_groups` row | yes | 0009 |
| `app.supersede_quotation(p_old uuid, p_new_payload jsonb, p_reason text, p_idempotency_key text)` | `→ uuid` | inserts new version in same group, marks old `superseded`, flips `is_current`, audits — atomically | yes | 0009 |
| `app.expire_quotations()` | `→ integer` | pg_cron: every current `confirmed` quotation with `valid_until < current_date` → `transition_quotation(..., 'expired', 'valid_until passed', 'expire:'||id||':'||current_date)` as `acting_as='system'` | yes | 0012 |

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
