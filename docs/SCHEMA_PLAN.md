# SCHEMA PLAN — Factory Bridge Global

**Status:** Phase 0 design. No migration exists yet. SQL below is a *plan*, to be turned into reviewed migrations in `supabase/migrations/` during Phase 1 with RLS negative tests alongside.
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
| `quote_status` | `draft`, `needs_review`, `confirmed`, `superseded`, `expired`, `withdrawn` |
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
| `product_specifications` | `id, variant_id nullable, brief_item_id nullable, version int, attributes jsonb, hard_attribute_codes text[], text_en, text_zh, source_lang, translation_run_id, confirmed_by, confirmed_at` | owning org |
| `spec_versions` | immutable history of `product_specifications` | owning org |

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

### 2.6 Quotations (versioned, confidential)

| Table | Key columns | Owner |
|---|---|---|
| `quotations` | `id, quote_group_id, version int, supplier_id, buyer_org_id nullable (null only for supplier_catalog/listing), brief_item_id nullable, specification_id, quote_type, rights_class, visibility_scope, source_type, document_id, extraction_id, price_basis, incoterm_place, currency, quantity_unit, moq numeric, production_lead_days, sample_cost numeric, tooling_cost numeric, payment_terms text, quote_date date, confirmed_at timestamptz, valid_until date nullable, status quote_status, reviewed_by, reviewed_at, superseded_by uuid` | `buyer_org_id` (private) **or** permission scope (catalog); supplier sees own |
| `quote_tiers` | `quotation_id, min_qty numeric, max_qty numeric nullable, unit_price numeric(18,6), price_includes text[], notes` ; CHECK non-overlapping per quotation, `min_qty >= moq` | follows quotation |
| `quote_fees` | `quotation_id, fee_type(tooling|sample|setup|packaging|inland_freight|export_doc|other), amount numeric(18,6), currency, is_one_time bool, included_in_unit_price bool` | follows quotation |
| `quote_visibility_grants` | `quotation_id, grantee_org_id, granted_by, expires_at` | internal writes |
| `quote_status_events` | `quotation_id, from, to, actor, at, reason` | follows quotation |

Rules enforced by constraints + domain code: a quotation is immutable after `status='confirmed'`; corrections create a new version in the same `quote_group_id` and set `superseded_by`. `valid_until NULL` means **validity unconfirmed**, displayed as such.

### 2.7 AI & review

| Table | Key columns | Owner |
|---|---|---|
| `ai_runs` | `id, purpose(extract|translate|normalize|match|draft|flag), provider, model, prompt_template_id, prompt_version, input_hash, input_tokens, output_tokens, cost_usd numeric(12,6), latency_ms, status, error, org_id, triggered_by` | `org_id` + internal |
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
| `audit_events` (append-only) | `id, at, actor_user_id, actor_org_id, acting_as(internal|member|system), entity_table, entity_id, action, before_hash, after_hash, diff jsonb (redacted for restricted tables), request_id, ip_hash` |
| `security_events` | `kind(rls_denied|rate_limited|scan_rejected|webhook_sig_fail|injection_flag), details jsonb, at` |
| `notifications` | `user_id, org_id, kind, payload, read_at, delivered_via` |
| `jobs_dead_letter` | `queue, msg, error, attempts, first_failed_at` |

`audit_events` has `REVOKE UPDATE, DELETE` for all roles including service role (only `postgres` superuser retains, for legal erasure under a documented procedure).

## 3. Row Level Security

### 3.1 Helper functions (SECURITY DEFINER, `search_path` pinned, in schema `app`)

```sql
create schema if not exists app;

create or replace function app.current_user_id() returns uuid
language sql stable as $$ select auth.uid() $$;

create or replace function app.is_member(p_org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from memberships m
                 where m.org_id = p_org and m.user_id = auth.uid() and m.status = 'active');
$$;

create or replace function app.has_role(p_org uuid, p_roles member_role[]) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from memberships m
                 where m.org_id = p_org and m.user_id = auth.uid()
                   and m.status = 'active' and m.role = any(p_roles));
$$;

create or replace function app.internal_org_id() returns uuid
language sql stable as $$ select id from organizations where org_type = 'internal' limit 1 $$;

create or replace function app.is_internal() returns boolean
language sql stable security definer set search_path = public as $$
  select app.is_member(app.internal_org_id());
$$;

create or replace function app.is_platform_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select app.has_role(app.internal_org_id(), array['platform_admin']::member_role[]);
$$;

create or replace function app.is_assigned_to_project(p_project uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select app.is_platform_admin() or exists (
    select 1 from project_assignments pa
    where pa.project_id = p_project and pa.operator_user_id = auth.uid());
$$;

create or replace function app.project_org(p_project uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select org_id from sourcing_projects where id = p_project $$;
```

Design notes: internal operators do **not** get blanket read of buyer data; they need a `project_assignments` row. `platform_admin` is the only blanket role and every read is logged by the application layer (`document_access_log`, `audit_events`). Supabase `authenticated` role gets `SELECT/INSERT/UPDATE` grants only where a policy exists; `anon` gets nothing on tenant tables.

### 3.2 Policy patterns

**Pattern A — org-owned table (e.g., `sourcing_projects`):**
```sql
alter table sourcing_projects enable row level security;
alter table sourcing_projects force row level security;

create policy sp_select on sourcing_projects for select using (
  app.is_member(org_id) or app.is_assigned_to_project(id));
create policy sp_insert on sourcing_projects for insert with check (
  app.has_role(org_id, array['owner','admin','member']::member_role[]));
create policy sp_update on sourcing_projects for update using (
  app.has_role(org_id, array['owner','admin','member']::member_role[]) or app.is_assigned_to_project(id))
  with check (org_id = (select org_id from sourcing_projects s where s.id = sourcing_projects.id));
-- no delete policy: soft delete via status
```

**Pattern B — child of project (e.g., `brief_items` via `buyer_briefs`):** policies call `app.is_member(app.project_org(project_id))` through a stable function or a materialized `org_id` column (preferred: denormalize `org_id` onto children and add a trigger that asserts it equals the parent's; simpler policies, faster plans).

**Pattern C — confidential quotation:**
```sql
create policy q_select on quotations for select using (
     (buyer_org_id is not null and app.is_member(buyer_org_id))                    -- owning buyer
  or (brief_item_id is not null and app.is_assigned_to_project(app.brief_item_project(brief_item_id)))
  or (app.is_member(supplier_org_of(supplier_id)))                                 -- supplier sees own quotes
  or (visibility_scope = 'platform_buyers' and quote_type = 'supplier_catalog'
        and app.current_org_type() = 'buyer')                                      -- permitted catalog
  or exists (select 1 from quote_visibility_grants g
             where g.quotation_id = quotations.id and app.is_member(g.grantee_org_id)
               and (g.expires_at is null or g.expires_at > now()))
  or app.is_platform_admin());
```
Buyers never get `INSERT/UPDATE` on `quotations` directly; writes go through server functions that run the domain validators.

**Pattern D — restricted table (`supplier_contacts`):**
```sql
create policy sc_select on supplier_contacts for select using (
     app.is_internal()
  or app.is_member(supplier_org_of(supplier_id))
  or exists (select 1 from contact_disclosure_grants g
             where g.supplier_contact_id = supplier_contacts.id
               and app.is_member(g.buyer_org_id) and g.revoked_at is null
               and (g.expires_at is null or g.expires_at > now())));
```
Additionally, the buyer-facing API layer selects from a view `supplier_public_profile_v` that excludes contact columns, so even a policy regression cannot surface them through the standard DTO.

**Pattern E — internal-only (`research_leads`, `source_systems`, `ai_eval_cases`):** `using (app.is_internal())`.

**Pattern F — append-only (`audit_events`):** `for insert with check (true)` for `authenticated` via a SECURITY DEFINER writer function; `for select using (app.is_member(actor_org_id) and app.has_role(actor_org_id, array['owner','admin']) or app.is_internal())`; no update/delete policies and grants revoked.

**Storage:** bucket policies mirror Pattern A using `(storage.foldername(name))[1]::uuid` = org id and `app.is_member(...)`; `quarantine` bucket: insert-only for members, select for service role.

### 3.3 Mandatory negative tests (CI blocks merge)

For each tenant table: with user of Org A, attempt `select`, `update`, `delete` on a row of Org B by primary key, by join, by storage path and by RPC; expect 0 rows / permission denied. Plus: supplier X cannot read `rfq_recipients` for supplier Y; buyer cannot read `supplier_contacts`; operator without assignment cannot read project; expired grant denies. Implemented in `supabase/tests/rls.test.ts` (Vitest + `pg`, two JWTs) — see `BACKLOG.md` B-07.

## 4. Indexes & constraints (selected)

- `memberships (user_id, org_id)` unique; `(org_id, role)`.
- `quotations (buyer_org_id, brief_item_id, status)`, `(supplier_id, status)`, `(valid_until) where status='confirmed'` for expiry sweep.
- `quote_tiers` exclusion constraint on `(quotation_id with =, numrange(min_qty, coalesce(max_qty,'infinity'), '[)') with &&)` to forbid overlapping tiers.
- `documents (org_id, status)`, `(sha256)` for dedupe.
- `audit_events (entity_table, entity_id, at desc)`, `(actor_org_id, at desc)`.
- `product_variants (product_id, attributes_hash)` unique.
- CHECK: `research_leads.rights_class = 'internal_market_observation'`; `quotations.price_basis <> null` (use `'unknown'`); `quote_tiers.unit_price >= 0`.

## 5. Migration sequencing (Phase 1)

| # | Migration | Contents |
|---|---|---|
| 0001 | `init_enums_and_helpers` | enums, `app` schema, helper functions |
| 0002 | `tenancy` | organizations, memberships, user_profiles, invites, project_assignments + RLS |
| 0003 | `taxonomy_products` | taxonomy, attribute_definitions, products, variants, specifications + seed for pilot families |
| 0004 | `suppliers` | profiles, facilities, contacts (restricted), grants, checks, documents + RLS |
| 0005 | `sources_documents` | source_systems, source_permissions, research_leads, documents, pages, cells, access_log + storage buckets/policies |
| 0006 | `projects_briefs` | sourcing_projects, buyer_briefs, brief_items + RLS |
| 0007 | `quotations` | quotations, tiers, fees, grants, status_events + RLS + constraints |
| 0008 | `ai_review` | ai_runs, ai_extractions, review_tasks, human_corrections, prompt_templates |
| 0009 | `fx_landed_cost` | fx_rates, freight_estimates, duty_assumptions, comparison_snapshots, landed_cost_scenarios |
| 0010 | `audit_security_jobs` | audit_events (append-only), security_events, notifications, queue setup (pgmq), dead letter |
| 0011 | `quality_skeleton` | Phase 3 tables (created, unused) — optional; may defer |

Each migration ships with its RLS tests. `supabase db reset` must succeed from zero on CI.

## 6. Open schema questions

Tracked in `OPEN_QUESTIONS.md`: OQ-05 (anonymize suppliers to buyers at which stage), OQ-07 (retention periods), OQ-10 (whether internal org is one tenant or per-region), OQ-11 (pgvector/zhparser availability on Supabase image).
