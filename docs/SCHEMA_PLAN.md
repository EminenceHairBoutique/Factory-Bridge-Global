# SCHEMA PLAN — Factory Bridge Global

**Status:** Phase 0 design, **revised in Phase 0.5 (2026-11-07)** — see ADR-019…ADR-022 and `MIGRATION_DEPENDENCY_MAP.md` (executable order, every helper defined) and `SECURITY_PERMISSION_MATRIX.md` (who may do what, grant evaluation). Only migration `0001` exists as code; everything else is a plan.
**Conventions:** UUID v7 primary keys (`gen_random_uuid()` acceptable until pg 18 `uuidv7()` is available on the Supabase image), `created_at/updated_at timestamptz`, `created_by uuid`, soft-delete only where retention requires (`deleted_at`), every tenant table indexed on its ownership column, all enums as Postgres `enum` types owned by `packages/domain` (single source of truth generated to SQL).

## 1. Tenancy model

One `organizations` table with `org_type ∈ {buyer, supplier, internal}`. Exactly one `internal` org ("Factory Bridge Global Operations"). Buyer and supplier orgs are separate tenants. Relationships are explicit grants, never implied.

```
organizations ──< memberships >── auth.users
      │
      ├── (buyer)   sourcing_projects, buyer_briefs, documents, quotations(buyer_org_id), reports
      ├── (supplier) supplier_profiles, supplier_contacts(restricted), catalog_listings, quotations(supplier_org_id)
      └── (internal) project_assignments → operators see assigned buyer projects + all suppliers
```

### 1.1 Enums (`packages/domain/enums.ts` → SQL)

| Enum | Values |
|---|---|
| `org_type` | `buyer`, `supplier`, `internal` |
| `member_role` | `owner`, `admin`, `member`, `viewer` (buyer/supplier); internal adds `operator`, `compliance_reviewer`, `platform_admin` |
| `rights_class` | `internal_market_observation`, `catalog_public_with_permission`, `customer_private_quote`, `buyer_uploaded_private`, `supplier_submitted_private` |
| `source_type` | `manual_research`, `operator_import`, `buyer_upload`, `supplier_portal`, `supplier_csv_feed`, `inbound_email`, `supplier_api`, `marketplace_api` |
| `visibility_scope` | `internal_only`, `owning_org`, `named_orgs`, `platform_buyers` |
| `quote_type` | `listing`, `supplier_catalog`, `negotiated_private`, `final_offer`, `estimate` |
| `price_basis` | `EXW`, `FCA`, `FOB`, `CFR`, `CIF`, `DAP`, `DPU`, `DDP`, `unknown` |
| `quote_status` | `confirmed`, `superseded`, `expired`, `withdrawn` — lifecycle of a *confirmed* quotation only (ADR-021). Pre-confirmation work is tracked by `review_status` on `review_tasks`. |
| `review_status` | `pending`, `in_review`, `accepted`, `rejected` |
| `document_status` | `uploaded`, `scanning`, `rejected`, `parsed`, `extracted`, `in_review`, `accepted`, `discarded` |
| `supplier_stage` | `lead_identified`, `contact_confirmed`, `legal_identity_reviewed`, `capabilities_documented` |
| `check_type` | `business_license_reviewed`, `uscc_matched`, `address_corroborated`, `video_call_held`, `factory_visit`, `export_license_seen`, `bank_name_matches_entity`, `reference_checked` |
| `inspection_type` | `sample_evaluation`, `pre_production`, `during_production`, `pre_shipment`, `container_loading` |
| `inspection_result` | `pass`, `fail`, `pass_with_rework`, `pending` |
| `cost_line_status` | `sourced`, `estimated`, `missing`, `not_applicable` |
| `compliance_state` | `clear`, `review_required`, `blocked` |

## 2. Tables

Grouped by domain. "Owner" = the column RLS keys on.

### 2.1 Identity & tenancy

| Table | Key columns | Owner |
|---|---|---|
| `organizations` | `id, org_type, legal_name, display_name, display_name_zh, country, compliance_state, settings jsonb` | self |
| `memberships` | `org_id, user_id, role, status(invited|active|suspended), invited_by, accepted_at` | `org_id` |
| `user_profiles` | `user_id (=auth.users.id), full_name, locale('en-US'|'zh-CN'), timezone` | `user_id` |
| `invites` | `org_id, email, role, token_hash, expires_at, accepted_at` | `org_id` |
| `project_assignments` | `project_id, operator_user_id, assigned_by, role(lead|support)` | via project's buyer org + internal |

### 2.2 Suppliers & verification

| Table | Key columns | Owner |
|---|---|---|
| `supplier_profiles` | `org_id (supplier org), legal_name_zh, legal_name_en, uscc (统一社会信用代码), entity_kind(manufacturer|trading|unknown — claimed), entity_kind_verified bool, province, city, website, stage supplier_stage, export_ready_claimed bool` | `org_id` (supplier) + internal read |
| `supplier_facilities` | `supplier_id, address_zh, address_en, facility_type, evidence_document_id` | supplier + internal |
| `supplier_contacts` **(restricted)** | `supplier_id, name, role, wechat_handle, phone, email, contact_basis, consent_note, created_by` | **internal only** by default; supplier org can see its own; buyers only via `contact_disclosure_grants` |
| `contact_disclosure_grants` | `supplier_contact_id, buyer_org_id, granted_by, reason, expires_at, revoked_at` | internal writes; buyer reads own |
| `supplier_verification_checks` | `supplier_id, check_type, result(pass|fail|inconclusive), evidence_document_id, reviewed_by, reviewed_at, valid_until, notes` | internal; supplier reads own; buyer reads summarized view |
| `supplier_documents` | `supplier_id, document_id, doc_kind(license|test_report|certificate|photo|drawing), claimed_by_supplier bool, verified_by, verified_at` | supplier + internal |

### 2.3 Products & multilingual specifications

| Table | Key columns | Owner |
|---|---|---|
| `product_taxonomy` | `id, parent_id, code, name_en, name_zh, compliance_state, pilot_flag` | public read |
| `attribute_definitions` | `taxonomy_id, code, label_en, label_zh, data_type(number|text|enum|bool|dimension), unit, allowed_values jsonb, is_hard_default bool` | public read |
| `products` | `id, taxonomy_id, canonical_name_en, canonical_name_zh, owner_org_id nullable (null = platform canonical)` | owner or public |
| `product_variants` | `product_id, variant_code, attributes jsonb (code→value), attributes_hash` | follows product |
| `product_specifications` | `id, taxonomy_id, variant_id nullable, brief_item_id nullable (FK in 0008), owner_org_id nullable, version int, attributes jsonb, hard_attribute_codes text[], text_en, text_zh, source_lang, translation_run_id, confirmed_by, confirmed_at` — **versioned rows, payload immutable** (trigger); only confirmation columns may change; a new version is a new row (`unique (variant_id, version)`). The separate `spec_versions` table is therefore not needed. | owning org |

Attribute values are canonical: dimensions in mm, mass in g, volume in ml, with the declared display unit stored separately by the UI layer. `attributes_hash` enables exact-match grouping in the comparison engine.

### 2.4 Sources, rights, documents

| Table | Key columns | Owner |
|---|---|---|
| `source_systems` | `code, provider, source_type, capabilities jsonb, status(blocked|manual|active), terms_url, notes` | internal |
| `source_permissions` | `id, supplier_id nullable, source_system_id nullable, rights_class, scope(fields[], images bool, redistribute bool, benchmark bool), evidence_document_id, granted_at, expires_at, revoked_at, recorded_by` | internal; supplier reads own |
| `research_leads` | `taxonomy_id, platform, reference_url, search_term_zh, observed_min_price, observed_max_price, currency, observed_moq, observed_at, notes, rights_class = internal_market_observation (CHECK)` | **internal only** |
| `documents` | `id, org_id (owning tenant), uploaded_by, source_type, rights_class, source_permission_id, storage_bucket, storage_path, original_filename, mime, bytes, sha256, status document_status, scan_result jsonb, page_count, retention_class` | `org_id` + assigned internal |
| `document_pages` | `document_id, page_no, text, layout jsonb, ocr_run_id` | follows document |
| `document_cells` | `document_id, sheet, row, col, raw, parsed` | follows document |
| `document_access_log` | `document_id, user_id, action(view|download|signed_url), at, ip_hash` | internal read |

Storage buckets: `quarantine` (write-only for uploaders, worker read), `documents`, `reports`, `supplier-evidence`. All private. Path convention `<bucket>/<org_id>/<document_id>/<sha256-prefix>-<sanitized-name>`; bucket RLS policies key on the first path segment matching a membership.

### 2.5 Briefs & RFQs

| Table | Key columns | Owner |
|---|---|---|
| `sourcing_projects` | `org_id, name, status, destination_country, destination_postal, target_date, target_incoterm, lead_operator_id` | `org_id` |
| `buyer_briefs` | `project_id, version, raw_input_en, raw_input_zh, ai_proposal jsonb, ai_run_id, confirmed_spec_id, status(draft|ready|in_sourcing|closed)` | via project |
| `brief_items` | `brief_id, line_no, taxonomy_id, specification_id, quantity numeric, quantity_unit, target_unit_price nullable, notes` | via project |
| `rfqs` (Phase 2) | `project_id, brief_item_ids uuid[], status, approved_by, approved_at, dispatched_at, deadline` | via project |
| `rfq_recipients` | `rfq_id, supplier_id, channel(portal|email|operator_wechat|operator_phone), sent_at, responded_at, status` | via project + supplier sees own row |
| `supplier_messages` | `rfq_id nullable, project_id, supplier_id, direction, channel, body_zh, body_en, drafted_by_ai_run_id, approved_by, approved_at, sent_by, sent_at, external_ref` | via project; supplier sees own |

### 2.6 Quotations (immutable payload + separate lifecycle state; ADR-021)

| Table | Key columns | Owner |
|---|---|---|
| `quote_groups` | `id, supplier_id, buyer_org_id nullable (null only for supplier_catalog), brief_item_id nullable, quote_type, created_at` — one group per (supplier, buyer, brief item) negotiation thread; versions live under it | as quotation |
| `quotations` **(immutable)** | `id, group_id, version int (unique per group), supplier_id, buyer_org_id, brief_item_id, specification_id, quote_type, rights_class, source_type, document_id, extraction_id, price_basis, incoterm_place, basis_confirmed bool, currency, quantity_unit, moq numeric, production_lead_days, payment_terms, quote_date, confirmed_at, valid_until date nullable (**NULL = validity unconfirmed**), confirmed_by, created_at` ; `BEFORE UPDATE OR DELETE` trigger raises | `buyer_org_id` (private) / grant-evaluated (catalog) / owning supplier |
| `quote_tiers` | `quotation_id, min_qty, max_qty nullable, unit_price numeric(18,6), price_includes text[]` ; `EXCLUDE USING gist (quotation_id WITH =, numrange(min_qty, coalesce(max_qty,'infinity'),'[)') WITH &&)` (needs `btree_gist`) | follows quotation |
| `quote_fees` | `quotation_id, fee_type, amount numeric(18,6), currency, is_one_time, included_in_unit_price` | follows quotation |
| `quotation_states` (1:1, mutable only via functions) | `quotation_id pk, group_id, status quote_status, is_current bool, superseded_by uuid nullable, state_version int, updated_at` ; `unique (group_id) where is_current`; **no UPDATE grant to `authenticated`** | follows quotation |
| `quote_status_events` (append-only) | `quotation_id, from_status, to_status, actor_user_id, acting_as, reason, idempotency_key unique, at` | follows quotation |
| `quote_visibility_grants` | `quotation_id, grantee_org_id, granted_by, reason, expires_at, revoked_at, revoked_by` ; attached to an exact quotation **version** | internal writes; grantee reads own |

Lifecycle, transition authorizations, concurrency and supersession semantics: `MIGRATION_DEPENDENCY_MAP.md` §6. Visibility rule: `SECURITY_PERMISSION_MATRIX.md` §3.1–3.2 (`app.quotation_visible()`).

### 2.7 AI & review

| Table | Key columns | Owner |
|---|---|---|
| `ai_runs` (**0003b**, append-only) | `id, org_id, at, purpose(extract|translate|normalize|match|draft|flag), provider, model, prompt_template_id, prompt_version (sha256 of template), input_hash, status(ok|schema_invalid|provider_error|budget_exceeded|canary_leak|budget_refused), error, input_tokens, output_tokens, cache_read_input_tokens, cache_creation_input_tokens, cost_nano_usd bigint, cost_usd numeric(12,6) generated, latency_ms, attempts, flags text[], triggered_by, job_id (unique per org), request_id` | `org_id` owner/admin read; compliance + platform admin read; written only by `app.record_ai_run` (service_role) |
| `ai_budgets` (**0003b**) | `org_id pk, monthly_cap_nano_usd bigint (0 = AI disabled), alert_threshold_pct, note, updated_by, created_at, updated_at` — absent row → platform default (`AI_MONTHLY_BUDGET_USD_DEFAULT`) | owner/admin read own; platform admin sets via `app.set_ai_budget` (audited); no delete |
| `ai_extractions` | `ai_run_id, document_id, schema_name, schema_version, raw_output jsonb, validated_output jsonb, validation_errors jsonb, field_confidence jsonb, anchors jsonb, flags text[]` | via document |
| `review_tasks` | `id, org_id, kind(extraction|translation|spec|match), subject_id, status review_status, assigned_to, due_at, resolved_by, resolved_at` | `org_id` + assigned internal |
| `human_corrections` | `review_task_id, field_path, before jsonb, after jsonb, reason, corrected_by, at` | via review task |
| `ai_eval_cases` | `fixture_ref, schema_name, expected jsonb, tags text[], locale` | internal |
| `prompt_templates` | `id, purpose, version, body_hash, active bool` | internal |

### 2.8 Comparison, FX, landed cost

| Table | Key columns | Owner |
|---|---|---|
| `fx_rates` | `base, quote, rate numeric(18,8), rate_date, source(provider name), fetched_at` ; UNIQUE(base,quote,rate_date,source) | public read; worker write |
| `freight_estimates` | `project_id, origin, destination, mode, provider_or_manual, amount, currency, valid_until, document_id, status cost_line_status` | via project |
| `duty_assumptions` | `project_id, hts_candidate text nullable, rate_pct nullable, basis, reviewed_by_broker bool, notes` ; **never auto-filled by AI** | via project |
| `comparison_snapshots` | `brief_item_id, inputs_hash, quantity, result jsonb, fx_rate_ids uuid[], generated_at, engine_version` | via project |
| `landed_cost_scenarios` | `comparison_snapshot_id, quotation_id, lines jsonb[{type,status,amount,currency,source_ref,assumption}], total_status(complete|partial)` | via project |

### 2.9 Quality (Phase 3 tables, designed now)

| Table | Key columns |
|---|---|
| `quality_spec_records` | `taxonomy_id, specification_id, version, critical_dimensions jsonb, tests jsonb, defect_classes jsonb, sampling_plan jsonb, approved_by_buyer_at` |
| `samples` | `project_id, supplier_id, variant_id, sample_kind(pre_production|golden|counter), requested_at, received_at, evaluated_by, result, evidence_document_ids` |
| `golden_sample_agreements` | `sample_id, buyer_signoff_by, supplier_ack_at, document_id` |
| `inspection_jobs` | `project_id, supplier_id, lot_id, inspection_type, inspector_org, scheduled_for, checklist_version, status` |
| `inspection_results` | `job_id, result inspection_result, sample_size, lot_size, aql_major, aql_minor, found_major, found_minor, report_document_id, inspector_name, at` |
| `defect_findings` | `result_id, class(critical|major|minor), description, photo_document_id, count` |
| `remediation_cases` | `project_id, source(inspection|receipt|buyer), responsibility(factory|fbg|carrier|buyer_spec|undetermined), status, resolution, closed_at` |
| `lots` | `project_id, supplier_id, lot_code, quantity, produced_from, produced_to` |

### 2.10 Shipments / handoff (Phase 5 skeleton)

`purchase_intents`, `order_handoffs`, `milestones` (estimated vs committed dates flag), `shipments` (status, carrier, tracking, documents). Designed, not built.

### 2.11 Audit & security

| Table | Key columns |
|---|---|
| `audit_events` (append-only) | `id, at, actor_user_id, actor_org_id, entity_org_id, acting_as(member|internal|platform_admin|system), entity_table, entity_id, action, before_hash, after_hash, diff jsonb (redacted for restricted tables), request_id, ip_hash` — `actor_org_id`/`entity_org_id` are **not** FKs (the log must outlive deleted rows) |
| `security_events` | `kind(rls_denied|rate_limited|scan_rejected|webhook_sig_fail|injection_flag|auth_anomaly|privileged_access|ai_budget_exceeded|ai_canary_leak), actor_user_id, org_id, details jsonb, at` |
| `notifications` | `user_id, org_id, kind, payload, read_at, delivered_via` |
| `jobs_dead_letter` | `queue, msg, error, attempts, first_failed_at` |

`audit_events` has `REVOKE UPDATE, DELETE` for all roles including service role (only `postgres` superuser retains, for legal erasure under a documented procedure).

## 3. Row Level Security

### 3.1 Helper functions

The complete catalogue — signatures, semantics, `SECURITY DEFINER` usage, `SET search_path = ''`, `EXECUTE` grants, the migration each is defined in, and the recursion/privilege analysis — is `MIGRATION_DEPENDENCY_MAP.md` §3. Rules that every helper obeys:

- Defined **after** every table it reads (SQL-function bodies are validated at `CREATE`).
- `SET search_path = ''` and fully schema-qualified references (`public.memberships`, `auth.uid()`), so a caller cannot shadow an object.
- The subject is always `auth.uid()`; no helper takes "which user" as a parameter. The single exception, `app.record_audit_event(... actor_override)`, is gated on the session role being `service_role`.
- `EXECUTE` revoked from `public` and `anon`; granted to `authenticated` (and `service_role` where listed).

Reference implementation of the two most-used helpers (final form lives in migration 0002):

```sql
create or replace function app.is_member(p_org uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.memberships m
    where m.org_id = p_org and m.user_id = auth.uid() and m.status = 'active');
$$;
revoke execute on function app.is_member(uuid) from public, anon;
grant  execute on function app.is_member(uuid) to authenticated, service_role;

create or replace function app.has_role(p_org uuid, p_roles public.member_role[]) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.memberships m
    where m.org_id = p_org and m.user_id = auth.uid()
      and m.status = 'active' and m.role = any(p_roles));
$$;
```

### 3.2 Policy patterns (corrected)

Every tenant table: `enable row level security` **and** `force row level security`; ownership columns protected by `app.prevent_owner_change` (so no policy needs a self-referential `WITH CHECK`); audit trigger attached. `authenticated` receives table grants only where a policy exists; `anon` receives none. Remember `FORCE` does not bind `BYPASSRLS` roles — see `SECURITY_PERMISSION_MATRIX.md` §4.

**Pattern A — org-owned (e.g., `sourcing_projects`)**
```sql
create policy sp_select on public.sourcing_projects for select to authenticated
  using (app.is_member(org_id) or app.is_assigned_to_project(id));
create policy sp_insert on public.sourcing_projects for insert to authenticated
  with check (app.has_role(org_id, array['owner','admin','member']::public.member_role[]));
create policy sp_update on public.sourcing_projects for update to authenticated
  using (app.has_role(org_id, array['owner','admin','member']::public.member_role[])
         or app.is_assigned_to_project(id))
  with check (true);   -- org_id change is blocked by trigger app.prevent_owner_change('org_id')
-- no delete policy; soft-delete via status
```

**Pattern B — children with denormalized `org_id`** (`buyer_briefs`, `brief_items`, `documents`): same shape as A on the child's own `org_id`; trigger `app.assert_same_org()` guarantees the child's `org_id` equals the parent's at insert/update, so policies stay flat and fast.

**Pattern C — quotations (grant-evaluated)**
```sql
create policy q_select on public.quotations for select to authenticated
  using (app.quotation_visible(id));
-- no insert/update/delete policies for authenticated: writes happen inside
-- app.supersede_quotation / app.transition_quotation (SECURITY DEFINER, audited)
```
`app.quotation_visible(q)` = owner buyer org member **or** assigned operator for the brief item's project **or** member of `app.supplier_org_of(supplier_id)` **or** active `quote_visibility_grants` row for `(q, my org)` **or** (`quote_type = 'supplier_catalog'` **and** `app.catalog_grant_active(supplier_id, my_org, 'price_tiers')`) **or** `app.is_platform_admin()`. The `visibility_scope` column is never consulted by this predicate.

**Pattern D — restricted (`supplier_contacts`)**
```sql
create policy sc_select on public.supplier_contacts for select to authenticated
  using (app.is_platform_admin()
      or app.has_role(app.internal_org_id(), array['compliance_reviewer']::public.member_role[])
      or exists (select 1 from public.project_assignments pa                -- assigned operators only
                 join public.quote_groups g on g.supplier_id = supplier_contacts.supplier_id
                 join public.brief_items bi on bi.id = g.brief_item_id
                 where pa.operator_user_id = auth.uid()
                   and pa.project_id = app.brief_item_project(bi.id))
      or app.is_member(app.supplier_org_of(supplier_id))
      or exists (select 1 from public.contact_disclosure_grants g
                 where g.supplier_contact_id = supplier_contacts.id
                   and app.is_member(g.buyer_org_id) and g.revoked_at is null
                   and (g.expires_at is null or g.expires_at > now())));
```
Buyer-facing reads use `supplier_public_profile_v` (no contact columns). An unassigned internal operator (`I.op−`) has **no** access — tested.

**Pattern E — internal-only** (`research_leads`, `source_systems`, `ai_eval_cases`): `using (app.is_internal())`.

**Pattern F — append-only (`audit_events`)**: no `INSERT` grant to `authenticated`; rows are written by `app.record_audit_event` (SECURITY DEFINER) and by the `app.audit_row_change` trigger; `select` for org owners/admins on their own org's events, for assigned operators on their projects, and for compliance/admin; `UPDATE`/`DELETE` revoked from every role.

**Storage:** `SECURITY_PERMISSION_MATRIX.md` §5.

### 3.3 Mandatory negative tests (CI blocks merge; B-07)

Run as `authenticated` with `request.jwt.claim.sub` set per persona — **never** as `service_role`. For each tenant table: A cannot `select/insert/update/delete` B's row by pk, join, RPC, storage path, export. Supplier X cannot read Y's RFQ rows or quotes. Buyer cannot read `supplier_contacts`. Unassigned operator cannot read a project, its documents, quotes or contacts. Expired and revoked grants deny. Ownership-column UPDATE raises. Role removal takes effect on the next statement. Coverage guard: any `public` table missing from the harness list fails.

## 4. Indexes & constraints (selected)

- `memberships (user_id, org_id)` unique; `(org_id, role)`.
- `organizations`: `create unique index organizations_one_internal on public.organizations ((true)) where org_type = 'internal'`.
- `quotations (group_id, version)` unique; `(buyer_org_id, brief_item_id)`, `(supplier_id)`.
- `quotation_states (group_id) where is_current` unique; `(status)`; expiry sweep index on `quotations (valid_until)` joined to current confirmed states.
- `quote_tiers` exclusion constraint as in `MIGRATION_DEPENDENCY_MAP.md` §5 (`btree_gist`).
- `quote_status_events (idempotency_key)` unique.
- `documents (org_id, status)`, `(sha256)`.
- `audit_events (entity_table, entity_id, at desc)`, `(actor_org_id, at desc)`.
- `product_variants (product_id, attributes_hash)` unique.
- CHECK: `research_leads.rights_class = 'internal_market_observation'`; `quotations.price_basis is not null` (use `'unknown'`); `quote_tiers.unit_price >= 0`; `quote_tiers.max_qty is null or max_qty > min_qty`.

## 5. Migration sequencing

Superseded by `MIGRATION_DEPENDENCY_MAP.md` §2 (ADR-019). Summary of the corrected order: 0001 bootstrap (extensions, enums, `app` schema) → 0002 tenancy core + membership helpers → 0003 **audit foundation** → 0004 taxonomy → 0005 suppliers core (+ `supplier_org_of`, `catalog_grant_active`) → 0006 documents + storage → 0007 supplier evidence (closes the `source_permissions ↔ documents` cycle) → 0008 projects/briefs (+ project helpers) → 0009 quotations (+ lifecycle functions) → 0010 AI/review → 0011 FX/landed cost → 0012 jobs/notifications/expiry cron. Each migration ships with its RLS tests; `supabase db reset` must succeed from zero, twice.

## 6. Open schema questions

Tracked in `OPEN_QUESTIONS.md`: OQ-05 (anonymize suppliers to buyers at which stage), OQ-07 (retention periods, also governs `audit_events`), OQ-10 (region), OQ-11 (pgvector/zhparser availability on the Supabase image).
