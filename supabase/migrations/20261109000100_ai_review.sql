-- 0010 ai_review — Factory Bridge Global (MIGRATION_DEPENDENCY_MAP §2 row 0010; SCHEMA_PLAN §2.8; AI_EVALUATION_PLAN;
-- SECURITY_PERMISSION_MATRIX row "Review tasks / extractions"; ADR-021, ADR-036)
--
-- Timestamped after 0012 on purpose (ADR-037 §6): migrations are only ever appended.
--
-- The vertical slice this closes:  document (parsed) → AI extraction (worker) → review task → a PERSON corrects and
-- accepts → app.supersede_quotation (0009) → confirmed quotation that cites its document and extraction.
--
-- What this migration establishes:
--   * prompt_templates     registry mirror of packages/ai prompt versions actually used (template_id, version = sha256);
--                          worker-written; one active version per template; immutable except `active`.
--   * ai_extractions       IMMUTABLE AI output for one document: raw output, validated output, validation errors,
--                          field confidence, anchors, flags; tied to its ai_runs row (purpose 'extract'). Worker-only.
--                          The model's output is data: nothing here is ever treated as approval.
--   * review_tasks         the human gate. Worker creates one per extraction; status (pending → in_review →
--                          accepted | rejected) changes ONLY through app.start_review / app.accept_extraction /
--                          app.reject_review. Ownership derives from the document: the buyer org for project
--                          documents, the internal org for operator documents without a project. Supplier-owned
--                          documents are not reviewed here (Phase 2).
--   * human_corrections    append-only per-field corrections made during review (before/after/reason/who).
--   * app.accept_extraction  a signed-in person turns the reviewed payload into a confirmed quotation via
--                          app.supersede_quotation, with document_id / extraction_id forced from the task; idempotent;
--                          moves the document to `accepted` when its last open extraction task resolves.
--   * operator imports     assigned operators may register documents owned by the buyer org on that buyer's project
--                          (documents + storage upload policies replaced) — the "authorized quote intake" step.
--   * quotations.extraction_id gets its FK; quote_fees.fee_type gains the extractor's `inland_freight`, `export_doc`.

-- ============================================================================
-- 1. Tables
-- ============================================================================

create table public.prompt_templates (
  id          uuid primary key default gen_random_uuid(),
  template_id text not null check (template_id ~ '^[a-z0-9_]{2,64}$'),
  version     text not null check (version ~ '^[0-9a-f]{64}$'),           -- sha256 of the template file
  purpose     text not null check (purpose in ('extract', 'translate', 'normalize', 'match', 'draft', 'flag')),
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (template_id, version)
);
create unique index prompt_templates_one_active on public.prompt_templates (template_id) where active;

create table public.ai_extractions (
  id                 uuid primary key default gen_random_uuid(),
  document_id        uuid not null references public.documents (id) on delete restrict,
  org_id             uuid not null references public.organizations (id) on delete restrict,   -- = document's org (trigger)
  ai_run_id          uuid not null references public.ai_runs (id) on delete restrict,
  prompt_template_id uuid references public.prompt_templates (id) on delete restrict,
  schema_name        text not null check (schema_name ~ '^[a-z0-9_]+$'),
  schema_version     text not null check (length(schema_version) between 1 and 20),
  raw_output         jsonb,                                         -- untrusted model output, kept for audit
  validated_output   jsonb,                                         -- null when the output failed validation
  validation_errors  jsonb not null default '[]'::jsonb check (jsonb_typeof(validation_errors) = 'array'),
  field_confidence   jsonb not null default '{}'::jsonb check (jsonb_typeof(field_confidence) = 'object'),
  anchors            jsonb not null default '{}'::jsonb check (jsonb_typeof(anchors) = 'object'),
  flags              text[] not null default '{}',
  created_at         timestamptz not null default now(),
  check (validated_output is not null or jsonb_array_length(validation_errors) > 0)
);
comment on table public.ai_extractions is
  'Immutable AI extraction of one document (worker-written). Data only — never approval. A person decides through review_tasks.';
create index ai_extractions_document_idx on public.ai_extractions (document_id);

create table public.review_tasks (
  id                     uuid primary key default gen_random_uuid(),
  org_id                 uuid not null references public.organizations (id) on delete restrict,  -- = document's org (trigger)
  project_id             uuid references public.sourcing_projects (id) on delete restrict,      -- = document's project (trigger)
  kind                   text not null check (kind in ('extraction', 'translation', 'spec', 'match')),
  subject_id             uuid not null,                                                          -- ai_extractions.id for kind extraction
  document_id            uuid references public.documents (id) on delete restrict,
  brief_item_id          uuid references public.brief_items (id) on delete restrict,
  supplier_id            uuid references public.supplier_profiles (id) on delete restrict,
  status                 public.review_status not null default 'pending',
  assigned_to            uuid,
  due_at                 timestamptz,
  resolved_by            uuid,
  resolved_at            timestamptz,
  resolution_reason      text,
  result_quotation_id    uuid references public.quotations (id) on delete restrict,
  accept_idempotency_key text unique,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  unique (kind, subject_id),
  check ((status in ('accepted', 'rejected')) = (resolved_at is not null)),
  check ((resolved_at is null) = (resolved_by is null)),
  check (status <> 'accepted' or kind <> 'extraction' or result_quotation_id is not null),
  check (status <> 'rejected' or resolution_reason is not null)
);
comment on table public.review_tasks is
  'The human gate between AI output and a confirmed record. Status changes only through app.start_review / app.accept_extraction / app.reject_review.';
create index review_tasks_org_status_idx on public.review_tasks (org_id, status);
create index review_tasks_project_idx on public.review_tasks (project_id) where project_id is not null;

create table public.human_corrections (
  id             uuid primary key default gen_random_uuid(),
  review_task_id uuid not null references public.review_tasks (id) on delete restrict,
  field_path     text not null check (field_path ~ '^[A-Za-z0-9_.\[\]]{1,120}$'),
  before         jsonb,
  after          jsonb,
  reason         text not null check (length(btrim(reason)) >= 3),
  corrected_by   uuid not null default auth.uid(),
  at             timestamptz not null default now(),
  check (before is distinct from after)
);
create index human_corrections_task_idx on public.human_corrections (review_task_id, at);

-- Deferred from 0009
alter table public.quotations
  add constraint quotations_extraction_fk foreign key (extraction_id) references public.ai_extractions (id) on delete restrict;
alter table public.quote_fees drop constraint quote_fees_fee_type_check;
alter table public.quote_fees add constraint quote_fees_fee_type_check
  check (fee_type in ('tooling', 'plate', 'sample', 'setup', 'packaging', 'inspection', 'inland_freight', 'export_doc', 'other'));

-- ============================================================================
-- 2. Helpers
-- ============================================================================

-- Who may READ a review task: members of its org (buyer roles incl. viewer, or internal staff for internal tasks),
-- operators assigned to its project, platform admins.
create or replace function app.review_task_visible(p_task uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.review_tasks t
     where t.id = p_task
       and (app.is_member(t.org_id)
            or (t.project_id is not null and app.is_assigned_to_project(t.project_id))
            or app.is_platform_admin()));
$$;

-- Who may DECIDE (start / correct / accept / reject): buyer owner/admin/member of its org, the project's assigned
-- operators, internal operators for internal-org tasks, platform admins. Viewers and compliance read only.
create or replace function app.review_task_decidable(p_task uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.review_tasks t
     where t.id = p_task
       and (app.is_platform_admin()
            or (t.project_id is not null and app.is_assigned_to_project(t.project_id))
            or (t.org_id <> app.internal_org_id()
                and app.has_role(t.org_id, array['owner', 'admin', 'member']::public.member_role[]))
            or (t.org_id = app.internal_org_id()
                and app.has_role(t.org_id, array['operator']::public.member_role[]))));
$$;

-- Move a document along its ADR-033 machine on behalf of a review function. The trusted-writer claim is set for this
-- one statement and restored immediately, so it cannot leak into the rest of the caller's transaction.
create or replace function app.review_document_transition(p_document uuid, p_from public.document_status, p_to public.document_status)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_prev text := current_setting('request.jwt.claim.role', true);
  v_rows integer;
begin
  perform set_config('request.jwt.claim.role', 'service_role', true);
  update public.documents set status = p_to where id = p_document and status = p_from;
  get diagnostics v_rows = row_count;
  perform set_config('request.jwt.claim.role', coalesce(v_prev, ''), true);
  return v_rows = 1;
exception when others then
  perform set_config('request.jwt.claim.role', coalesce(v_prev, ''), true);
  raise;
end;
$$;

-- ----------------------------------------------------------------------------
-- Review functions (the only writers of review_tasks.status)
-- ----------------------------------------------------------------------------
create or replace function app.start_review(p_task uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_task public.review_tasks%rowtype;
begin
  select * into v_task from public.review_tasks where id = p_task for update;
  if v_task.id is null or not app.review_task_visible(p_task) then
    raise exception 'review task % not found', p_task using errcode = 'no_data_found';
  end if;
  if not app.review_task_decidable(p_task) then
    raise exception 'not permitted to review task %', p_task using errcode = 'insufficient_privilege';
  end if;
  if v_task.status not in ('pending', 'in_review') then
    raise exception 'review task % is already %', p_task, v_task.status using errcode = 'check_violation';
  end if;
  update public.review_tasks set status = 'in_review', assigned_to = auth.uid(), updated_at = now() where id = p_task;
end;
$$;

create or replace function app.reject_review(p_task uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_task public.review_tasks%rowtype;
begin
  if p_reason is null or length(btrim(p_reason)) < 3 then
    raise exception 'a reason is required' using errcode = 'check_violation';
  end if;
  select * into v_task from public.review_tasks where id = p_task for update;
  if v_task.id is null or not app.review_task_visible(p_task) then
    raise exception 'review task % not found', p_task using errcode = 'no_data_found';
  end if;
  if not app.review_task_decidable(p_task) then
    raise exception 'not permitted to review task %', p_task using errcode = 'insufficient_privilege';
  end if;
  if v_task.status in ('accepted', 'rejected') then
    raise exception 'review task % is already %', p_task, v_task.status using errcode = 'check_violation';
  end if;
  update public.review_tasks
     set status = 'rejected', resolved_by = auth.uid(), resolved_at = now(), resolution_reason = p_reason, updated_at = now()
   where id = p_task;
  -- the document is done once nothing is open and something was accepted (an all-rejected document stays in_review
  -- for an operator to re-run or discard)
  if v_task.document_id is not null
     and not exists (select 1 from public.review_tasks o
                      where o.document_id = v_task.document_id and o.kind = 'extraction' and o.status in ('pending', 'in_review'))
     and exists (select 1 from public.review_tasks o
                  where o.document_id = v_task.document_id and o.kind = 'extraction' and o.status = 'accepted') then
    perform app.review_document_transition(v_task.document_id, 'in_review', 'accepted');
  end if;
  perform app.record_audit_event('review_tasks', p_task, 'reject', jsonb_build_object('status', v_task.status),
                                 jsonb_build_object('status', 'rejected', 'reason', p_reason), v_task.org_id);
end;
$$;

-- Accept an extraction review: the PERSON's payload (corrected in the UI) becomes a confirmed quotation through
-- app.supersede_quotation. document_id and extraction_id are taken from the task, never from the payload.
-- p_old: null for a first version, or the current version this supersedes. Idempotent on p_idempotency_key.
create or replace function app.accept_extraction(p_task uuid, p_payload jsonb, p_old uuid, p_reason text, p_idempotency_key text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_task    public.review_tasks%rowtype;
  v_payload jsonb;
  v_quote   uuid;
begin
  if auth.uid() is null then
    raise exception 'a review is accepted by a signed-in person, never by a job' using errcode = 'insufficient_privilege';
  end if;
  if p_idempotency_key is null or length(p_idempotency_key) < 8 then
    raise exception 'idempotency_key is required (>= 8 chars)' using errcode = 'check_violation';
  end if;
  select * into v_task from public.review_tasks where id = p_task for update;
  if v_task.id is null or not app.review_task_visible(p_task) then
    raise exception 'review task % not found', p_task using errcode = 'no_data_found';
  end if;
  if v_task.status = 'accepted' and v_task.accept_idempotency_key = p_idempotency_key then
    return v_task.result_quotation_id;     -- replay
  end if;
  if not app.review_task_decidable(p_task) then
    raise exception 'not permitted to review task %', p_task using errcode = 'insufficient_privilege';
  end if;
  if v_task.kind <> 'extraction' then
    raise exception 'review task % is not an extraction review', p_task using errcode = 'check_violation';
  end if;
  if v_task.status in ('accepted', 'rejected') then
    raise exception 'review task % is already %', p_task, v_task.status using errcode = 'check_violation';
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'payload must be a JSON object' using errcode = 'check_violation';
  end if;

  -- provenance comes from the task; thread identity from the task when the payload leaves it out
  v_payload := p_payload
    || jsonb_build_object('document_id', v_task.document_id, 'extraction_id', v_task.subject_id);
  if p_old is null then
    if v_task.supplier_id is not null and not (v_payload ? 'supplier_id') then
      v_payload := v_payload || jsonb_build_object('supplier_id', v_task.supplier_id);
    end if;
    if v_task.brief_item_id is not null and not (v_payload ? 'brief_item_id') then
      v_payload := v_payload || jsonb_build_object('brief_item_id', v_task.brief_item_id);
    end if;
    if v_task.project_id is not null and not (v_payload ? 'buyer_org_id') then
      v_payload := v_payload || jsonb_build_object('buyer_org_id', v_task.org_id);
    end if;
    if v_task.supplier_id is not null and (v_payload ->> 'supplier_id')::uuid is distinct from v_task.supplier_id then
      raise exception 'payload.supplier_id differs from the review task' using errcode = 'check_violation';
    end if;
  end if;

  v_quote := app.supersede_quotation(p_old, v_payload, coalesce(nullif(btrim(p_reason), ''), 'review accepted'), p_idempotency_key);

  update public.review_tasks
     set status = 'accepted', resolved_by = auth.uid(), resolved_at = now(), result_quotation_id = v_quote,
         accept_idempotency_key = p_idempotency_key, resolution_reason = p_reason, updated_at = now()
   where id = p_task;

  if v_task.document_id is not null and not exists (
       select 1 from public.review_tasks o
        where o.document_id = v_task.document_id and o.kind = 'extraction' and o.status in ('pending', 'in_review')) then
    perform app.review_document_transition(v_task.document_id, 'in_review', 'accepted');
  end if;
  perform app.record_audit_event('review_tasks', p_task, 'accept', jsonb_build_object('status', v_task.status),
                                 jsonb_build_object('status', 'accepted', 'quotation_id', v_quote, 'reason', p_reason),
                                 v_task.org_id);
  return v_quote;
end;
$$;

-- Trigger functions ---------------------------------------------------------

create or replace function app.prompt_template_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (to_jsonb(old) - 'active') <> (to_jsonb(new) - 'active') then
    raise exception 'prompt_templates are immutable except active' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create or replace function app.ai_extraction_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_doc public.documents%rowtype;
  v_run public.ai_runs%rowtype;
begin
  select * into v_doc from public.documents where id = new.document_id;
  if v_doc.id is null then
    raise exception 'unknown document_id %', new.document_id using errcode = 'foreign_key_violation';
  end if;
  if v_doc.status not in ('parsed', 'extracted', 'in_review') then
    raise exception 'document % has not been parsed (status %)', new.document_id, v_doc.status using errcode = 'check_violation';
  end if;
  select * into v_run from public.ai_runs where id = new.ai_run_id;
  if v_run.purpose is distinct from 'extract' or v_run.status not in ('ok', 'schema_invalid') then
    raise exception 'ai_run_id must be an extract run that returned output (ok / schema_invalid)' using errcode = 'check_violation';
  end if;
  new.org_id := v_doc.org_id;
  return new;
end;
$$;

create or replace function app.review_task_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_doc  public.documents%rowtype;
  v_type public.org_type;
begin
  if tg_op = 'UPDATE' then
    -- identity and provenance never change; status columns are written only by the review functions (no UPDATE grant)
    if (new.org_id, new.project_id, new.kind, new.subject_id, new.document_id) is distinct from
       (old.org_id, old.project_id, old.kind, old.subject_id, old.document_id) then
      raise exception 'review task identity is immutable' using errcode = 'check_violation';
    end if;
    if old.status in ('accepted', 'rejected') and new.status is distinct from old.status then
      raise exception 'a resolved review task cannot be reopened' using errcode = 'check_violation';
    end if;
    return new;
  end if;
  if new.status <> 'pending' then
    raise exception 'a new review task starts as pending' using errcode = 'check_violation';
  end if;
  if new.kind = 'extraction' then
    select d.* into v_doc from public.ai_extractions e join public.documents d on d.id = e.document_id where e.id = new.subject_id;
    if v_doc.id is null then
      raise exception 'extraction review subject % is not an ai_extractions row', new.subject_id using errcode = 'foreign_key_violation';
    end if;
    new.document_id := v_doc.id;
  elsif new.document_id is not null then
    select * into v_doc from public.documents where id = new.document_id;
  end if;
  if v_doc.id is null then
    raise exception 'a review task needs a document' using errcode = 'check_violation';
  end if;
  select o.org_type into v_type from public.organizations o where o.id = v_doc.org_id;
  if v_type = 'supplier' then
    raise exception 'supplier-owned documents are not reviewed through this path (Phase 2)' using errcode = 'check_violation';
  end if;
  new.org_id := v_doc.org_id;
  new.project_id := v_doc.project_id;
  if new.brief_item_id is not null and app.brief_item_project(new.brief_item_id) is distinct from new.project_id then
    raise exception 'brief_item_id must belong to the document''s project' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create or replace function app.human_correction_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status public.review_status;
begin
  select status into v_status from public.review_tasks where id = new.review_task_id;
  if v_status is null then
    raise exception 'unknown review task %', new.review_task_id using errcode = 'foreign_key_violation';
  end if;
  if v_status not in ('pending', 'in_review') then
    raise exception 'corrections are recorded while a review is open (task is %)', v_status using errcode = 'check_violation';
  end if;
  if auth.uid() is null then
    raise exception 'corrections are made by a person' using errcode = 'insufficient_privilege';
  end if;
  new.corrected_by := auth.uid();
  new.at := now();
  return new;
end;
$$;

revoke execute on function
  app.review_task_visible(uuid), app.review_task_decidable(uuid),
  app.start_review(uuid), app.reject_review(uuid, text), app.accept_extraction(uuid, jsonb, uuid, text, text)
  from public, anon;
grant execute on function
  app.review_task_visible(uuid), app.review_task_decidable(uuid),
  app.start_review(uuid), app.reject_review(uuid, text), app.accept_extraction(uuid, jsonb, uuid, text, text)
  to authenticated, service_role;
revoke execute on function app.review_document_transition(uuid, public.document_status, public.document_status)
  from public, anon, authenticated;

-- ============================================================================
-- 3. Triggers
-- ============================================================================

create trigger prompt_templates_before_update before update on public.prompt_templates
  for each row execute function app.prompt_template_before_update();
create trigger ai_extractions_before_insert before insert on public.ai_extractions
  for each row execute function app.ai_extraction_before_insert();
create trigger ai_extractions_immutable before update or delete on public.ai_extractions
  for each row execute function app.immutable_row();
create trigger review_tasks_set_updated_at before update on public.review_tasks
  for each row execute function app.set_updated_at();
create trigger review_tasks_before_write before insert or update on public.review_tasks
  for each row execute function app.review_task_before_write();
create trigger human_corrections_before_insert before insert on public.human_corrections
  for each row execute function app.human_correction_before_insert();
create trigger human_corrections_immutable before update or delete on public.human_corrections
  for each row execute function app.immutable_row();

create trigger ai_extractions_audit after insert on public.ai_extractions
  for each row execute function app.audit_row_change('org_id');
create trigger review_tasks_audit after insert on public.review_tasks
  for each row execute function app.audit_row_change('org_id');
create trigger human_corrections_audit after insert on public.human_corrections
  for each row execute function app.audit_row_change('no_org');
create trigger prompt_templates_audit after insert or update on public.prompt_templates
  for each row execute function app.audit_row_change('no_org');

-- ============================================================================
-- 4. RLS
-- ============================================================================

alter table public.prompt_templates  enable row level security;
alter table public.prompt_templates  force row level security;
alter table public.ai_extractions    enable row level security;
alter table public.ai_extractions    force row level security;
alter table public.review_tasks      enable row level security;
alter table public.review_tasks      force row level security;
alter table public.human_corrections enable row level security;
alter table public.human_corrections force row level security;

revoke all on public.prompt_templates, public.ai_extractions, public.review_tasks, public.human_corrections
  from public, anon, authenticated;
grant select on public.prompt_templates, public.ai_extractions, public.review_tasks to authenticated;
grant select, insert on public.human_corrections to authenticated;
grant all on public.prompt_templates, public.ai_extractions, public.review_tasks, public.human_corrections to service_role;

create policy prompt_templates_select on public.prompt_templates for select to authenticated
  using (app.is_internal());

-- an extraction is readable with its document, or through a review task the caller can see
create policy ai_extractions_select on public.ai_extractions for select to authenticated
  using (app.document_readable(document_id)
      or exists (select 1 from public.review_tasks t
                  where t.kind = 'extraction' and t.subject_id = ai_extractions.id and app.review_task_visible(t.id)));

create policy review_tasks_select on public.review_tasks for select to authenticated
  using (app.review_task_visible(id));

create policy human_corrections_select on public.human_corrections for select to authenticated
  using (app.review_task_visible(review_task_id));
create policy human_corrections_insert on public.human_corrections for insert to authenticated
  with check (app.review_task_decidable(review_task_id));

-- ============================================================================
-- 5. Operator intake into a buyer project (replaces 0006 documents_insert/update and fbg_quarantine_insert)
-- ============================================================================
-- An operator assigned to a project registers the supplier's quote file as a document OWNED BY THE BUYER ORG and
-- attached to that project — confidential to the buyer by construction (0008's guard keeps project_id same-org).

drop policy documents_insert on public.documents;
drop policy documents_update on public.documents;
create policy documents_insert on public.documents for insert to authenticated
  with check (uploaded_by = auth.uid()
          and (app.has_role(org_id, array['owner', 'admin', 'member']::public.member_role[])
               or (org_id = app.internal_org_id()
                   and app.has_role(org_id, array['operator', 'compliance_reviewer', 'platform_admin']::public.member_role[]))
               or (project_id is not null and app.is_assigned_to_project(project_id)
                   and source_type = 'operator_import')));
create policy documents_update on public.documents for update to authenticated
  using (app.has_role(org_id, array['owner', 'admin', 'member']::public.member_role[])
      or (org_id = app.internal_org_id()
          and app.has_role(org_id, array['operator', 'compliance_reviewer', 'platform_admin']::public.member_role[]))
      or (project_id is not null and app.is_assigned_to_project(project_id)))
  with check (true);   -- the 0006 trigger still restricts non-workers to status -> discarded

drop policy fbg_quarantine_insert on storage.objects;
create policy fbg_quarantine_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'quarantine'
    and app.storage_org_id(name) is not null
    and exists (select 1 from public.documents d
                 where d.id = app.storage_doc_id(name)
                   and d.org_id = app.storage_org_id(name)
                   and d.storage_bucket = 'quarantine'
                   and d.storage_path = name
                   and d.status = 'uploaded'
                   and (app.is_member(d.org_id)
                        or (d.project_id is not null and app.is_assigned_to_project(d.project_id)))));
