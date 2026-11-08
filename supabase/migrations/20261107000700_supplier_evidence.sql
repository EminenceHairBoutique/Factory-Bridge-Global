-- 0007 supplier_evidence — Factory Bridge Global (MIGRATION_DEPENDENCY_MAP §2 row 0007; QUALITY_ASSURANCE §2/§7; matrix row
-- "Supplier verification checks"; CLAUDE.md §4 "verified supplier" only with the linked check record)
--
-- What this migration establishes:
--   * supplier_verification_checks   one row per check performed by Factory Bridge staff: check_type, result, the evidence
--                                    document, reviewer, date, validity. A `pass` REQUIRES an evidence document that belongs
--                                    to that supplier and has passed the scan. Rows are immutable except `notes` (a new check
--                                    supersedes an old one; nothing is edited into a pass). ADR-034.
--   * supplier_documents             what a supplier says a file is (license, certificate, ...). `claimed_by_supplier` stays
--                                    true until staff record `verified_by/verified_at`, optionally linking the check.
--   * supplier_stage_requirements    the required check set per qualification stage, as DATA (QUALITY_ASSURANCE §2).
--   * app.supplier_stage_evidenced() deterministic: are all required groups for a stage currently passed and unexpired?
--   * stage gate                     supplier_profiles.stage can only be advanced to a stage whose evidence exists now
--                                    (and every stage below it). Demotion is always allowed.
--   * supplier_verification_summary_v  the ONLY buyer-facing read of verification: passed/expired check types, dates,
--                                    whether the current stage is still evidenced. No notes, no reviewer ids, no evidence ids.
--   * evidence FKs                   source_permissions.evidence_document_id, supplier_facilities.evidence_document_id (0005
--                                    could not reference documents; 0006 created them).
--
-- Badges are rendered from the summary view and say exactly which checks passed and when. Never "verified factory".

-- ============================================================================
-- 1. Tables
-- ============================================================================

create table public.supplier_verification_checks (
  id                   uuid primary key default gen_random_uuid(),
  supplier_id          uuid not null references public.supplier_profiles (id) on delete cascade,
  org_id               uuid not null references public.organizations (id) on delete cascade,   -- denormalized = supplier org (trigger-set)
  check_type           public.check_type not null,
  result               text not null check (result in ('pass', 'fail', 'inconclusive')),
  evidence_document_id uuid references public.documents (id) on delete restrict,
  reviewed_by          uuid not null default auth.uid(),
  reviewed_at          timestamptz not null default now(),
  valid_until          timestamptz check (valid_until is null or valid_until > reviewed_at),
  checklist_version    text not null default 'v1',
  notes                text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  check (result <> 'pass' or evidence_document_id is not null)      -- a pass without evidence is not a pass
);
comment on table public.supplier_verification_checks is
  'What Factory Bridge staff actually checked, with evidence. Immutable except notes; a later check supersedes. Badges derive from supplier_verification_summary_v only.';
create index supplier_verification_checks_supplier_idx on public.supplier_verification_checks (supplier_id, check_type, reviewed_at desc);

create table public.supplier_documents (
  id                    uuid primary key default gen_random_uuid(),
  supplier_id           uuid not null references public.supplier_profiles (id) on delete cascade,
  org_id                uuid not null references public.organizations (id) on delete cascade,  -- denormalized = supplier org (trigger-set)
  document_id           uuid not null unique references public.documents (id) on delete restrict,
  doc_kind              text not null check (doc_kind in ('license', 'test_report', 'certificate', 'photo', 'drawing')),
  claimed_by_supplier   boolean not null default true,
  claim_note_zh         text,
  claim_note_en         text,
  verified_by           uuid,
  verified_at           timestamptz,
  verification_check_id uuid references public.supplier_verification_checks (id) on delete set null,
  created_by            uuid,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  check ((verified_by is null) = (verified_at is null))
);
comment on table public.supplier_documents is
  'A supplier''s own description of a file. Shown as "supplier-provided, unverified" until verified_by/verified_at are set by staff (SECURITY.md T20).';
create index supplier_documents_supplier_idx on public.supplier_documents (supplier_id);

-- Required check set per stage. `group_no`: every group must be satisfied; within a group any one check_type suffices.
create table public.supplier_stage_requirements (
  stage      public.supplier_stage not null,
  group_no   smallint not null check (group_no > 0),
  check_type public.check_type not null,
  primary key (stage, group_no, check_type)
);
comment on table public.supplier_stage_requirements is 'QUALITY_ASSURANCE §2 entry evidence as data. Read by app.supplier_stage_evidenced().';

-- Evidence columns deferred from 0005 (documents did not exist yet; see map §2 "circular references").
alter table public.source_permissions
  add column evidence_document_id uuid references public.documents (id) on delete restrict;
alter table public.supplier_facilities
  add column evidence_document_id uuid references public.documents (id) on delete restrict;

-- ============================================================================
-- 2. Helpers
-- ============================================================================

-- Ordinal of a stage for "advance vs demote" comparisons (explicit, not enum declaration order).
create or replace function app.supplier_stage_rank(p_stage public.supplier_stage)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case p_stage
    when 'lead_identified'         then 0
    when 'contact_confirmed'       then 1
    when 'legal_identity_reviewed' then 2
    when 'capabilities_documented' then 3
  end;
$$;

-- Latest check per (supplier, check_type) that is a current, unexpired pass.
create or replace function app.supplier_passed_checks(p_supplier uuid)
returns setof public.check_type
language sql
stable
security definer
set search_path = ''
as $$
  select c.check_type
    from (select distinct on (check_type) check_type, result, valid_until
            from public.supplier_verification_checks
           where supplier_id = p_supplier
           order by check_type, reviewed_at desc, created_at desc) c
   where c.result = 'pass' and (c.valid_until is null or c.valid_until > now());
$$;

-- Latest check per type that WAS a pass but has expired (the badge must say "expired — re-review needed").
create or replace function app.supplier_expired_checks(p_supplier uuid)
returns setof public.check_type
language sql
stable
security definer
set search_path = ''
as $$
  select c.check_type
    from (select distinct on (check_type) check_type, result, valid_until
            from public.supplier_verification_checks
           where supplier_id = p_supplier
           order by check_type, reviewed_at desc, created_at desc) c
   where c.result = 'pass' and c.valid_until is not null and c.valid_until <= now();
$$;

-- Is the evidence for `p_stage` present right now? Cumulative: a stage is evidenced only if it and every stage below it
-- are. contact_confirmed = an active contact with a recorded basis; higher stages = every required group (for that stage
-- and the ones below) has a current, unexpired pass. lead_identified needs nothing. Expiry of any required check flips
-- this to false — the badge then reads "expired — re-review needed" (QUALITY_ASSURANCE §2).
create or replace function app.supplier_stage_evidenced(p_supplier uuid, p_stage public.supplier_stage)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_stage = 'lead_identified' then true
    else
      exists (select 1 from public.supplier_contacts c where c.supplier_id = p_supplier and c.is_active)
      and not exists (
        select 1
          from (select distinct r.stage, r.group_no from public.supplier_stage_requirements r
                 where app.supplier_stage_rank(r.stage) <= app.supplier_stage_rank(p_stage)) g
         where not exists (
           select 1 from public.supplier_stage_requirements r
            where r.stage = g.stage and r.group_no = g.group_no
              and r.check_type in (select * from app.supplier_passed_checks(p_supplier))))
      and (p_stage = 'contact_confirmed'
           or exists (select 1 from public.supplier_stage_requirements r where r.stage = p_stage))
  end;
$$;

-- Trigger functions ---------------------------------------------------------

create or replace function app.verification_check_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_doc public.documents%rowtype;
  v_uscc text;
begin
  if tg_op = 'UPDATE' then
    if (to_jsonb(old) - 'notes' - 'updated_at') <> (to_jsonb(new) - 'notes' - 'updated_at') then
      raise exception 'supplier_verification_checks are immutable except notes; record a new check' using errcode = 'check_violation';
    end if;
    return new;
  end if;
  new.org_id := app.supplier_org_of(new.supplier_id);
  if new.org_id is null then
    raise exception 'unknown supplier_id %', new.supplier_id using errcode = 'foreign_key_violation';
  end if;
  if new.evidence_document_id is not null then
    select * into v_doc from public.documents d where d.id = new.evidence_document_id;
    if v_doc.id is null then
      raise exception 'evidence document % does not exist', new.evidence_document_id using errcode = 'foreign_key_violation';
    end if;
    if v_doc.status not in ('parsed', 'extracted', 'in_review', 'accepted') then
      raise exception 'evidence document has not passed the scan (status %)', v_doc.status using errcode = 'check_violation';
    end if;
    if v_doc.supplier_id is distinct from new.supplier_id and v_doc.org_id <> app.internal_org_id() then
      raise exception 'evidence document belongs to another supplier' using errcode = 'check_violation';
    end if;
  end if;
  if new.check_type = 'uscc_matched' and new.result = 'pass' then
    select s.uscc into v_uscc from public.supplier_profiles s where s.id = new.supplier_id;
    if v_uscc is null then
      raise exception 'uscc_matched cannot pass while the profile has no USCC' using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

create or replace function app.supplier_document_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_doc public.documents%rowtype;
  v_staff boolean := app.is_internal() or app.is_trusted_writer();
begin
  new.org_id := app.supplier_org_of(new.supplier_id);
  if new.org_id is null then
    raise exception 'unknown supplier_id %', new.supplier_id using errcode = 'foreign_key_violation';
  end if;
  select * into v_doc from public.documents d where d.id = new.document_id;
  if v_doc.id is null then
    raise exception 'document % does not exist', new.document_id using errcode = 'foreign_key_violation';
  end if;
  if v_doc.supplier_id is distinct from new.supplier_id then
    raise exception 'document is not attributed to this supplier (documents.supplier_id)' using errcode = 'check_violation';
  end if;
  if v_doc.status in ('rejected', 'discarded') then
    raise exception 'a rejected or discarded document cannot be a supplier document' using errcode = 'check_violation';
  end if;
  if tg_op = 'INSERT' then
    if new.created_by is null then new.created_by := auth.uid(); end if;
    if not v_staff then
      new.verified_by := null; new.verified_at := null; new.verification_check_id := null; new.claimed_by_supplier := true;
    end if;
  else
    if not v_staff and (new.verified_by is distinct from old.verified_by or new.verified_at is distinct from old.verified_at
                        or new.verification_check_id is distinct from old.verification_check_id
                        or new.claimed_by_supplier is distinct from old.claimed_by_supplier) then
      raise exception 'verification columns are set by Factory Bridge staff only' using errcode = 'insufficient_privilege';
    end if;
  end if;
  if new.verification_check_id is not null and not exists (
       select 1 from public.supplier_verification_checks c
        where c.id = new.verification_check_id and c.supplier_id = new.supplier_id) then
    raise exception 'verification_check_id must reference a check of the same supplier' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

-- Stage gate on supplier_profiles: a profile is born at lead_identified (stages are earned, never declared), and
-- advancing requires current evidence for the target stage and every stage below it. Demotion is always allowed.
create or replace function app.supplier_stage_gate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_stage public.supplier_stage;
begin
  if tg_op = 'INSERT' then
    if new.stage <> 'lead_identified' then
      raise exception 'a new supplier profile starts at lead_identified; stages are earned through checks' using errcode = 'check_violation';
    end if;
    return new;
  end if;
  if app.supplier_stage_rank(new.stage) > app.supplier_stage_rank(old.stage) then
    -- report the lowest stage whose evidence is missing (supplier_stage_evidenced is cumulative)
    foreach v_stage in array array['contact_confirmed', 'legal_identity_reviewed', 'capabilities_documented']::public.supplier_stage[] loop
      if app.supplier_stage_rank(v_stage) <= app.supplier_stage_rank(new.stage)
         and not app.supplier_stage_evidenced(new.id, v_stage) then
        raise exception 'stage % requires its entry evidence (QUALITY_ASSURANCE §2): missing for %', new.stage, v_stage
          using errcode = 'check_violation';
      end if;
    end loop;
  end if;
  return new;
end;
$$;

-- Evidence on permissions/facilities must be a scanned document of that supplier (or an internal upload).
create or replace function app.evidence_document_fits(p_document uuid, p_supplier uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.documents d
     where d.id = p_document
       and d.status in ('parsed', 'extracted', 'in_review', 'accepted')
       and (d.supplier_id = p_supplier or d.org_id = app.internal_org_id()));
$$;

create or replace function app.evidence_column_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.evidence_document_id is not null and not app.evidence_document_fits(new.evidence_document_id, new.supplier_id) then
    raise exception 'evidence_document_id must be a scanned document of this supplier (or an internal upload)' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

revoke execute on function
  app.supplier_stage_rank(public.supplier_stage), app.supplier_passed_checks(uuid), app.supplier_expired_checks(uuid),
  app.supplier_stage_evidenced(uuid, public.supplier_stage), app.evidence_document_fits(uuid, uuid)
  from public, anon;
grant execute on function
  app.supplier_stage_rank(public.supplier_stage), app.supplier_passed_checks(uuid), app.supplier_expired_checks(uuid),
  app.supplier_stage_evidenced(uuid, public.supplier_stage), app.evidence_document_fits(uuid, uuid)
  to authenticated, service_role;

-- ============================================================================
-- 3. Triggers
-- ============================================================================

create trigger supplier_verification_checks_set_updated_at before update on public.supplier_verification_checks
  for each row execute function app.set_updated_at();
create trigger supplier_verification_checks_validate before insert or update on public.supplier_verification_checks
  for each row execute function app.verification_check_before_write();

create trigger supplier_documents_set_updated_at before update on public.supplier_documents
  for each row execute function app.set_updated_at();
create trigger supplier_documents_validate before insert or update on public.supplier_documents
  for each row execute function app.supplier_document_before_write();
create trigger supplier_documents_owner_guard before update on public.supplier_documents
  for each row execute function app.prevent_owner_change('supplier_id', 'org_id', 'document_id');

-- Named to fire AFTER 0005's supplier_profiles_validate (same-level triggers fire in name order), so a supplier that
-- tries to set its own stage gets "staff only" and staff get the evidence error.
create trigger supplier_profiles_validate_stage_gate before insert or update of stage on public.supplier_profiles
  for each row execute function app.supplier_stage_gate();

create trigger source_permissions_evidence before insert on public.source_permissions
  for each row execute function app.evidence_column_guard();
create trigger supplier_facilities_evidence before insert or update of evidence_document_id on public.supplier_facilities
  for each row execute function app.evidence_column_guard();

create trigger supplier_verification_checks_audit after insert or update or delete on public.supplier_verification_checks
  for each row execute function app.audit_row_change('org_id');
create trigger supplier_documents_audit after insert or update or delete on public.supplier_documents
  for each row execute function app.audit_row_change('org_id');
create trigger supplier_stage_requirements_audit after insert or update or delete on public.supplier_stage_requirements
  for each row execute function app.audit_row_change('no_org');

-- ============================================================================
-- 4. Buyer-facing summary view
-- ============================================================================
-- Deliberately NOT security_invoker: buyers have no policy on the checks table, so the view runs as its owner and
-- applies the one rule buyers get — a supplier they may see (app.supplier_visible) and nothing but summarized facts.
create view public.supplier_verification_summary_v
with (security_barrier = true)
as
select s.id as supplier_id,
       s.org_id,
       s.stage,
       app.supplier_stage_evidenced(s.id, s.stage)                       as stage_evidenced,   -- false ⇒ "expired — re-review needed"
       s.entity_kind,
       s.entity_kind_verified,
       coalesce((select array_agg(t order by t) from app.supplier_passed_checks(s.id) t), '{}')  as passed_checks,
       coalesce((select array_agg(t order by t) from app.supplier_expired_checks(s.id) t), '{}') as expired_checks,
       (select max(c.reviewed_at) from public.supplier_verification_checks c
         where c.supplier_id = s.id and c.result = 'pass')               as last_passed_check_at,
       (select count(*) from public.supplier_documents d
         where d.supplier_id = s.id and d.verified_at is not null)       as verified_document_count,
       (select count(*) from public.supplier_documents d
         where d.supplier_id = s.id and d.verified_at is null)           as unverified_document_count
  from public.supplier_profiles s
 where app.supplier_visible(s.id);
comment on view public.supplier_verification_summary_v is
  'The ONLY buyer-facing read of supplier verification. Says which check types currently pass / have expired and whether the stage is still evidenced. No notes, reviewers or evidence ids.';

-- ============================================================================
-- 5. RLS
-- ============================================================================

alter table public.supplier_verification_checks enable row level security;
alter table public.supplier_verification_checks force row level security;
alter table public.supplier_documents            enable row level security;
alter table public.supplier_documents            force row level security;
alter table public.supplier_stage_requirements   enable row level security;
alter table public.supplier_stage_requirements   force row level security;

revoke all on public.supplier_verification_checks, public.supplier_documents, public.supplier_stage_requirements,
              public.supplier_verification_summary_v
  from public, anon, authenticated;
grant select, insert, update on public.supplier_verification_checks, public.supplier_documents to authenticated;
grant select on public.supplier_stage_requirements, public.supplier_verification_summary_v to authenticated;
grant all on public.supplier_verification_checks, public.supplier_documents, public.supplier_stage_requirements to service_role;
grant select on public.supplier_verification_summary_v to service_role;

-- checks: internal read/write (operators, compliance, platform admin); supplier reads its own; buyers only via the view
create policy supplier_verification_checks_select on public.supplier_verification_checks for select to authenticated
  using (app.is_internal() or app.is_member(org_id));
create policy supplier_verification_checks_insert on public.supplier_verification_checks for insert to authenticated
  with check (reviewed_by = auth.uid()
          and app.has_role(app.internal_org_id(), array['operator', 'compliance_reviewer', 'platform_admin']::public.member_role[]));
create policy supplier_verification_checks_update on public.supplier_verification_checks for update to authenticated
  using (app.has_role(app.internal_org_id(), array['operator', 'compliance_reviewer', 'platform_admin']::public.member_role[]))
  with check (true);   -- notes only (trigger)

-- supplier_documents: the supplier's org and internal staff read; supplier (owner/admin/member) and staff create; staff verify
create policy supplier_documents_select on public.supplier_documents for select to authenticated
  using (app.is_internal() or app.is_member(org_id));
create policy supplier_documents_insert on public.supplier_documents for insert to authenticated
  with check (app.has_role(app.supplier_org_of(supplier_id), array['owner', 'admin', 'member']::public.member_role[])
           or app.has_role(app.internal_org_id(), array['operator', 'compliance_reviewer', 'platform_admin']::public.member_role[]));
create policy supplier_documents_update on public.supplier_documents for update to authenticated
  using (app.has_role(org_id, array['owner', 'admin', 'member']::public.member_role[])
      or app.has_role(app.internal_org_id(), array['operator', 'compliance_reviewer', 'platform_admin']::public.member_role[]))
  with check (true);   -- verification columns gated by trigger

-- requirements: reference data readable by every signed-in user; written by migrations only
create policy supplier_stage_requirements_select on public.supplier_stage_requirements for select to authenticated using (true);

-- ============================================================================
-- 6. Reference data (idempotent)
-- ============================================================================
-- BEGIN REFERENCE DATA
insert into public.supplier_stage_requirements (stage, group_no, check_type) values
  ('legal_identity_reviewed', 1, 'business_license_reviewed'),
  ('legal_identity_reviewed', 2, 'uscc_matched'),
  ('legal_identity_reviewed', 3, 'address_corroborated'),
  ('legal_identity_reviewed', 4, 'bank_name_matches_entity'),
  ('capabilities_documented', 1, 'video_call_held'),
  ('capabilities_documented', 1, 'factory_visit')
on conflict do nothing;
-- END REFERENCE DATA
