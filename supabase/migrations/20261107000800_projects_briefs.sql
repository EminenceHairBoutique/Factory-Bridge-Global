-- 0008 projects_briefs — Factory Bridge Global (MIGRATION_DEPENDENCY_MAP §2 row 0008; SCHEMA_PLAN §2.1/§2.5, Patterns A/B;
-- matrix §2 rows "Sourcing project / brief", "Buyer-uploaded documents", "Supplier contacts"; ADR-031/033 deferrals)
--
-- What this migration establishes:
--   * sourcing_projects      buyer-owned container (Pattern A). Buyer org members create/edit; assigned internal operators
--                            read/edit; compliance reviewers read (holds); platform admins read.
--   * project_assignments    which internal operators work a project. Assigned by a platform admin, or by the project's lead
--                            operator (support roles only). This row is what turns I.op− into I.op+ everywhere (ADR-035).
--   * project_suppliers      the project's supplier shortlist, maintained by assigned operators. It is the link that lets an
--                            assigned operator read a shortlisted supplier's restricted contacts and submitted documents —
--                            scoped to that project, never blanket. 0009's quote_groups hang off it.
--   * buyer_briefs           versioned brief per project with a small status machine (draft → ready → in_sourcing → closed;
--                            ready → draft to reopen). ai_proposal is stored as data; confirmed_spec_id is set by a human.
--   * brief_items            lines with taxonomy, quantity, target price; a blocked taxonomy node is REFUSED, a
--                            review_required node sets compliance_hold that only compliance / platform admin may clear.
--   * app.assert_same_org()  generic denormalization trigger (TG_ARGV: parent table, fk column) — sets/asserts org_id.
--   * helpers                app.project_org(), app.is_assigned_to_project(), app.brief_project(), app.brief_item_project(),
--                            app.supplier_in_my_project() (shortlist link for an assigned operator).
--   * policy replacements    supplier_contacts_*, contact_disclosure_grants_insert/update (ADR-031 deferral) and
--                            app.document_readable() (ADR-033 deferral) now carry the assigned-operator clause.
--   * documents.project_id   buyer uploads attach to a project; product_specifications.brief_item_id gets its FK.
--
-- Deletes: none for authenticated. Projects close, assignments deactivate, shortlist rows are dropped by status.

-- ============================================================================
-- 1. Tables
-- ============================================================================

create table public.sourcing_projects (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid not null references public.organizations (id) on delete cascade,   -- buyer org (trigger: org_type = buyer)
  name                text not null check (length(btrim(name)) between 2 and 160),
  status              text not null default 'draft' check (status in ('draft', 'active', 'on_hold', 'closed')),
  destination_country char(2) not null default 'US' check (destination_country ~ '^[A-Z]{2}$'),
  destination_postal  text,
  target_date         date,
  target_incoterm     public.price_basis not null default 'unknown',   -- unknown ≠ EXW (CLAUDE.md §4)
  lead_operator_id    uuid,                                             -- internal user; set by internal staff only
  compliance_hold     boolean not null default false,                   -- set/cleared by compliance or platform admin only
  compliance_note     text,
  created_by          uuid,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
comment on table public.sourcing_projects is
  'Buyer-owned sourcing project (Pattern A). Internal operators see it only through project_assignments (ADR-035).';
create index sourcing_projects_org_idx on public.sourcing_projects (org_id, status);

create table public.project_assignments (
  id               uuid primary key default gen_random_uuid(),
  project_id       uuid not null references public.sourcing_projects (id) on delete cascade,
  org_id           uuid not null references public.organizations (id) on delete cascade,   -- = project's buyer org (trigger)
  operator_user_id uuid not null,                                                           -- internal member (trigger)
  role             text not null default 'support' check (role in ('lead', 'support')),
  active           boolean not null default true,
  assigned_by      uuid not null default auth.uid(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (project_id, operator_user_id)
);
create index project_assignments_operator_idx on public.project_assignments (operator_user_id) where active;
create unique index project_assignments_one_lead on public.project_assignments (project_id) where active and role = 'lead';

create table public.project_suppliers (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.sourcing_projects (id) on delete cascade,
  org_id      uuid not null references public.organizations (id) on delete cascade,   -- = project's buyer org (trigger)
  supplier_id uuid not null references public.supplier_profiles (id) on delete restrict,
  status      text not null default 'shortlisted' check (status in ('shortlisted', 'contacted', 'quoting', 'dropped')),
  added_by    uuid not null default auth.uid(),
  reason      text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (project_id, supplier_id)
);
comment on table public.project_suppliers is
  'Project shortlist. While a row is not dropped, the project''s assigned operators may read that supplier''s restricted contacts and submitted documents (ADR-035).';
create index project_suppliers_supplier_idx on public.project_suppliers (supplier_id) where status <> 'dropped';

create table public.buyer_briefs (
  id                uuid primary key default gen_random_uuid(),
  project_id        uuid not null references public.sourcing_projects (id) on delete cascade,
  org_id            uuid not null references public.organizations (id) on delete cascade,   -- = project's buyer org (trigger)
  version           integer not null default 1 check (version >= 1),
  raw_input_en      text,
  raw_input_zh      text,
  ai_proposal       jsonb,                                                                  -- AI output: data, never auto-confirmed
  ai_run_id         uuid references public.ai_runs (id) on delete set null,
  confirmed_spec_id uuid references public.product_specifications (id) on delete set null,  -- set by a human
  status            text not null default 'draft' check (status in ('draft', 'ready', 'in_sourcing', 'closed')),
  created_by        uuid,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (project_id, version),
  check (raw_input_en is not null or raw_input_zh is not null)
);

create table public.brief_items (
  id                uuid primary key default gen_random_uuid(),
  brief_id          uuid not null references public.buyer_briefs (id) on delete cascade,
  org_id            uuid not null references public.organizations (id) on delete cascade,   -- = brief's org (trigger)
  project_id        uuid not null references public.sourcing_projects (id) on delete cascade, -- = brief's project (trigger)
  line_no           integer not null check (line_no between 1 and 500),
  taxonomy_id       uuid not null references public.product_taxonomy (id) on delete restrict,
  specification_id  uuid references public.product_specifications (id) on delete set null,
  quantity          numeric(18, 3) not null check (quantity > 0),
  quantity_unit     text not null check (length(quantity_unit) between 1 and 16),
  target_unit_price numeric(18, 6) check (target_unit_price is null or target_unit_price >= 0),
  target_currency   char(3) not null default 'USD' check (target_currency ~ '^[A-Z]{3}$'),
  compliance_hold   boolean not null default false,                                         -- trigger-set from taxonomy; cleared by compliance only
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (brief_id, line_no)
);

-- Deferred FKs / columns
alter table public.product_specifications
  add constraint product_specifications_brief_item_fk foreign key (brief_item_id) references public.brief_items (id) on delete set null;
alter table public.documents
  add column project_id uuid references public.sourcing_projects (id) on delete set null;
create index documents_project_idx on public.documents (project_id) where project_id is not null;

-- ============================================================================
-- 2. Helpers (SECURITY DEFINER, search_path = '')
-- ============================================================================

create or replace function app.project_org(p_project uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.org_id from public.sourcing_projects p where p.id = p_project;
$$;

-- I.op+ for this project: platform admin, or an active assignment for the caller.
create or replace function app.is_assigned_to_project(p_project uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app.is_platform_admin()
      or exists (select 1 from public.project_assignments a
                  where a.project_id = p_project and a.operator_user_id = auth.uid() and a.active);
$$;

create or replace function app.brief_project(p_brief uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select b.project_id from public.buyer_briefs b where b.id = p_brief;
$$;

create or replace function app.brief_item_project(p_brief_item uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select i.project_id from public.brief_items i where i.id = p_brief_item;
$$;

-- The supplier is shortlisted (not dropped) on a project the caller is assigned to.
create or replace function app.supplier_in_my_project(p_supplier uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.project_suppliers ps
     where ps.supplier_id = p_supplier and ps.status <> 'dropped'
       and app.is_assigned_to_project(ps.project_id));
$$;

-- Generic Pattern-B denormalization: TG_ARGV[0] = parent table (public schema), TG_ARGV[1] = this row's FK column.
-- Sets new.org_id from the parent; raises if a caller supplied a different org_id.
create or replace function app.assert_same_org()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_parent_org uuid;
  v_fk uuid;
begin
  v_fk := (to_jsonb(new) ->> tg_argv[1])::uuid;
  execute format('select org_id from public.%I where id = $1', tg_argv[0]) into v_parent_org using v_fk;
  if v_parent_org is null then
    raise exception 'unknown % %', tg_argv[1], v_fk using errcode = 'foreign_key_violation';
  end if;
  if new.org_id is not null and new.org_id <> v_parent_org then
    raise exception 'org_id must equal the parent''s org_id (%.%)', tg_argv[0], tg_argv[1] using errcode = 'check_violation';
  end if;
  new.org_id := v_parent_org;
  return new;
end;
$$;

-- Trigger functions ---------------------------------------------------------

create or replace function app.sourcing_project_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_type public.org_type;
  v_staff boolean := app.is_internal() or app.is_trusted_writer();
  v_compliance boolean := app.is_platform_admin()
                       or app.has_role(app.internal_org_id(), array['compliance_reviewer']::public.member_role[])
                       or app.is_trusted_writer();
begin
  if tg_op = 'INSERT' then
    select o.org_type into v_type from public.organizations o where o.id = new.org_id;
    if v_type is distinct from 'buyer' then
      raise exception 'sourcing_projects.org_id must reference a buyer organization' using errcode = 'check_violation';
    end if;
    if new.created_by is null then new.created_by := auth.uid(); end if;
    if not v_staff then new.lead_operator_id := null; end if;
    if not v_compliance then new.compliance_hold := false; new.compliance_note := null; end if;
    return new;
  end if;
  if new.lead_operator_id is distinct from old.lead_operator_id and not v_staff then
    raise exception 'lead_operator_id is set by Factory Bridge staff only' using errcode = 'insufficient_privilege';
  end if;
  if (new.compliance_hold is distinct from old.compliance_hold or new.compliance_note is distinct from old.compliance_note)
     and not v_compliance then
    raise exception 'compliance_hold is set by compliance reviewers or platform admins only' using errcode = 'insufficient_privilege';
  end if;
  if old.status = 'closed' and new.status <> 'closed' and not v_staff then
    raise exception 'a closed project is reopened by Factory Bridge staff only' using errcode = 'check_violation';
  end if;
  -- a compliance reviewer who is neither a member nor assigned may touch the hold columns only (matrix: "R (hold review only)")
  if not (app.is_member(new.org_id) or app.is_assigned_to_project(new.id) or app.is_trusted_writer())
     and (to_jsonb(old) - 'compliance_hold' - 'compliance_note' - 'updated_at') <> (to_jsonb(new) - 'compliance_hold' - 'compliance_note' - 'updated_at') then
    raise exception 'compliance reviewers may only change compliance_hold / compliance_note' using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

create or replace function app.project_assignment_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.org_id := app.project_org(new.project_id);
  if new.org_id is null then
    raise exception 'unknown project_id %', new.project_id using errcode = 'foreign_key_violation';
  end if;
  if not exists (select 1 from public.memberships m
                  where m.org_id = app.internal_org_id() and m.user_id = new.operator_user_id and m.status = 'active'
                    and m.role in ('operator', 'compliance_reviewer', 'platform_admin')) then
    raise exception 'operator_user_id must be an active member of the internal organisation' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create or replace function app.buyer_brief_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.created_by is null then new.created_by := auth.uid(); end if;
    if new.status <> 'draft' then
      raise exception 'a new brief starts as draft' using errcode = 'check_violation';
    end if;
    return new;
  end if;
  if new.status is distinct from old.status and not (
       (old.status = 'draft'       and new.status = 'ready')
    or (old.status = 'ready'       and new.status in ('draft', 'in_sourcing'))
    or (old.status = 'in_sourcing' and new.status = 'closed')
  ) then
    raise exception 'invalid brief transition % -> %', old.status, new.status using errcode = 'check_violation';
  end if;
  -- entering sourcing is an operator/staff act (it precedes outreach, which humans approve — CLAUDE.md §4)
  if old.status = 'ready' and new.status = 'in_sourcing' and not (app.is_assigned_to_project(new.project_id) or app.is_trusted_writer()) then
    raise exception 'only an assigned operator moves a brief into sourcing' using errcode = 'insufficient_privilege';
  end if;
  if new.confirmed_spec_id is distinct from old.confirmed_spec_id and new.confirmed_spec_id is not null then
    if app.is_trusted_writer() and auth.uid() is null then
      raise exception 'confirmed_spec_id is set by a person, not by a job' using errcode = 'insufficient_privilege';
    end if;
    if not exists (select 1 from public.product_specifications s
                    where s.id = new.confirmed_spec_id and (s.owner_org_id is null or s.owner_org_id = new.org_id)) then
      raise exception 'confirmed_spec_id must be a platform or own-org specification' using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

create or replace function app.brief_item_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_state public.compliance_state;
  v_code text;
  v_compliance boolean := app.is_platform_admin()
                       or app.has_role(app.internal_org_id(), array['compliance_reviewer']::public.member_role[]);
begin
  select b.project_id into new.project_id from public.buyer_briefs b where b.id = new.brief_id;
  if new.project_id is null then
    raise exception 'unknown brief_id %', new.brief_id using errcode = 'foreign_key_violation';
  end if;
  if tg_op = 'UPDATE' and new.taxonomy_id = old.taxonomy_id then
    if new.compliance_hold is distinct from old.compliance_hold and not v_compliance then
      raise exception 'compliance_hold is cleared by compliance reviewers or platform admins only' using errcode = 'insufficient_privilege';
    end if;
    if not (app.is_member(new.org_id) or app.is_assigned_to_project(new.project_id) or app.is_trusted_writer())
       and (to_jsonb(old) - 'compliance_hold' - 'updated_at') <> (to_jsonb(new) - 'compliance_hold' - 'updated_at') then
      raise exception 'compliance reviewers may only change compliance_hold' using errcode = 'insufficient_privilege';
    end if;
  else
    select t.compliance_state, t.code into v_state, v_code from public.product_taxonomy t where t.id = new.taxonomy_id;
    if v_state = 'blocked' then
      raise exception 'category % is blocked: no self-service quoting (CLAUDE.md §4)', v_code using errcode = 'check_violation';
    end if;
    new.compliance_hold := (v_state = 'review_required');
  end if;
  if new.specification_id is not null and not exists (
       select 1 from public.product_specifications s
        where s.id = new.specification_id and s.taxonomy_id = new.taxonomy_id
          and (s.owner_org_id is null or s.owner_org_id = new.org_id)) then
    raise exception 'specification_id must be a platform or own-org specification of the same taxonomy' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

revoke execute on function
  app.project_org(uuid), app.is_assigned_to_project(uuid), app.brief_project(uuid), app.brief_item_project(uuid),
  app.supplier_in_my_project(uuid)
  from public, anon;
grant execute on function
  app.project_org(uuid), app.is_assigned_to_project(uuid), app.brief_project(uuid), app.brief_item_project(uuid),
  app.supplier_in_my_project(uuid)
  to authenticated, service_role;

-- ============================================================================
-- 3. Triggers
-- ============================================================================

create trigger sourcing_projects_set_updated_at before update on public.sourcing_projects
  for each row execute function app.set_updated_at();
create trigger sourcing_projects_validate before insert or update on public.sourcing_projects
  for each row execute function app.sourcing_project_before_write();
create trigger sourcing_projects_owner_guard before update on public.sourcing_projects
  for each row execute function app.prevent_owner_change('org_id');

create trigger project_assignments_set_updated_at before update on public.project_assignments
  for each row execute function app.set_updated_at();
create trigger project_assignments_validate before insert or update on public.project_assignments
  for each row execute function app.project_assignment_before_write();
create trigger project_assignments_owner_guard before update on public.project_assignments
  for each row execute function app.prevent_owner_change('project_id', 'org_id', 'operator_user_id');

create trigger project_suppliers_set_updated_at before update on public.project_suppliers
  for each row execute function app.set_updated_at();
create trigger project_suppliers_denorm before insert or update on public.project_suppliers
  for each row execute function app.assert_same_org('sourcing_projects', 'project_id');
create trigger project_suppliers_owner_guard before update on public.project_suppliers
  for each row execute function app.prevent_owner_change('project_id', 'org_id', 'supplier_id');

create trigger buyer_briefs_set_updated_at before update on public.buyer_briefs
  for each row execute function app.set_updated_at();
create trigger buyer_briefs_denorm before insert or update on public.buyer_briefs
  for each row execute function app.assert_same_org('sourcing_projects', 'project_id');
create trigger buyer_briefs_validate before insert or update on public.buyer_briefs
  for each row execute function app.buyer_brief_before_write();
create trigger buyer_briefs_owner_guard before update on public.buyer_briefs
  for each row execute function app.prevent_owner_change('project_id', 'org_id');

create trigger brief_items_set_updated_at before update on public.brief_items
  for each row execute function app.set_updated_at();
create trigger brief_items_denorm before insert or update on public.brief_items
  for each row execute function app.assert_same_org('buyer_briefs', 'brief_id');
create trigger brief_items_validate before insert or update on public.brief_items
  for each row execute function app.brief_item_before_write();
create trigger brief_items_owner_guard before update on public.brief_items
  for each row execute function app.prevent_owner_change('brief_id', 'org_id', 'project_id');

-- documents.project_id: must be a project of the document's own org (buyer uploads attach to their project)
create or replace function app.document_project_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.project_id is not null and app.project_org(new.project_id) is distinct from new.org_id then
    raise exception 'documents.project_id must be a project of the document''s own organisation' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
create trigger documents_project_guard before insert or update of project_id on public.documents
  for each row execute function app.document_project_guard();

create trigger sourcing_projects_audit after insert or update or delete on public.sourcing_projects
  for each row execute function app.audit_row_change('org_id');
create trigger project_assignments_audit after insert or update or delete on public.project_assignments
  for each row execute function app.audit_row_change('org_id');
create trigger project_suppliers_audit after insert or update or delete on public.project_suppliers
  for each row execute function app.audit_row_change('org_id');
create trigger buyer_briefs_audit after insert or update or delete on public.buyer_briefs
  for each row execute function app.audit_row_change('org_id');
create trigger brief_items_audit after insert or update or delete on public.brief_items
  for each row execute function app.audit_row_change('org_id');

-- ============================================================================
-- 4. RLS
-- ============================================================================

alter table public.sourcing_projects   enable row level security;
alter table public.sourcing_projects   force row level security;
alter table public.project_assignments enable row level security;
alter table public.project_assignments force row level security;
alter table public.project_suppliers   enable row level security;
alter table public.project_suppliers   force row level security;
alter table public.buyer_briefs        enable row level security;
alter table public.buyer_briefs        force row level security;
alter table public.brief_items         enable row level security;
alter table public.brief_items         force row level security;

revoke all on public.sourcing_projects, public.project_assignments, public.project_suppliers, public.buyer_briefs, public.brief_items
  from public, anon, authenticated;
grant select, insert, update on public.sourcing_projects, public.project_assignments, public.project_suppliers,
                                public.buyer_briefs, public.brief_items to authenticated;
grant all on public.sourcing_projects, public.project_assignments, public.project_suppliers, public.buyer_briefs, public.brief_items
  to service_role;

-- Pattern A: sourcing_projects
create policy sourcing_projects_select on public.sourcing_projects for select to authenticated
  using (app.is_member(org_id)
      or app.is_assigned_to_project(id)
      or app.has_role(app.internal_org_id(), array['compliance_reviewer']::public.member_role[]));
create policy sourcing_projects_insert on public.sourcing_projects for insert to authenticated
  with check (app.has_role(org_id, array['owner', 'admin', 'member']::public.member_role[]));
create policy sourcing_projects_update on public.sourcing_projects for update to authenticated
  using (app.has_role(org_id, array['owner', 'admin', 'member']::public.member_role[])
      or app.is_assigned_to_project(id)
      or app.has_role(app.internal_org_id(), array['compliance_reviewer']::public.member_role[]))   -- holds only (trigger)
  with check (true);

-- project_assignments: the buyer org sees who works its project; internal staff see all. Platform admins assign;
-- an active lead operator may add/deactivate support assignments on their own project.
create policy project_assignments_select on public.project_assignments for select to authenticated
  using (app.is_member(org_id) or app.is_internal());
create policy project_assignments_insert on public.project_assignments for insert to authenticated
  with check (assigned_by = auth.uid()
          and (app.is_platform_admin()
               or (role = 'support' and exists (select 1 from public.project_assignments l
                                                 where l.project_id = project_assignments.project_id
                                                   and l.operator_user_id = auth.uid() and l.role = 'lead' and l.active))));
create policy project_assignments_update on public.project_assignments for update to authenticated
  using (app.is_platform_admin()
      or (role = 'support' and exists (select 1 from public.project_assignments l
                                        where l.project_id = project_assignments.project_id
                                          and l.operator_user_id = auth.uid() and l.role = 'lead' and l.active)))
  with check (true);

-- project_suppliers: buyer org reads its shortlist; assigned operators read and maintain it
create policy project_suppliers_select on public.project_suppliers for select to authenticated
  using (app.is_member(org_id) or app.is_assigned_to_project(project_id));
create policy project_suppliers_insert on public.project_suppliers for insert to authenticated
  with check (added_by = auth.uid() and app.is_assigned_to_project(project_id));
create policy project_suppliers_update on public.project_suppliers for update to authenticated
  using (app.is_assigned_to_project(project_id))
  with check (true);

-- Pattern B: buyer_briefs / brief_items on their own org_id, plus assigned operators (and compliance, read)
create policy buyer_briefs_select on public.buyer_briefs for select to authenticated
  using (app.is_member(org_id) or app.is_assigned_to_project(project_id)
      or app.has_role(app.internal_org_id(), array['compliance_reviewer']::public.member_role[]));
create policy buyer_briefs_insert on public.buyer_briefs for insert to authenticated
  with check (app.has_role(app.project_org(project_id), array['owner', 'admin', 'member']::public.member_role[])
           or app.is_assigned_to_project(project_id));
create policy buyer_briefs_update on public.buyer_briefs for update to authenticated
  using (app.has_role(org_id, array['owner', 'admin', 'member']::public.member_role[]) or app.is_assigned_to_project(project_id))
  with check (true);

create policy brief_items_select on public.brief_items for select to authenticated
  using (app.is_member(org_id) or app.is_assigned_to_project(project_id)
      or app.has_role(app.internal_org_id(), array['compliance_reviewer']::public.member_role[]));
create policy brief_items_insert on public.brief_items for insert to authenticated
  with check (app.has_role(app.project_org(app.brief_project(brief_id)), array['owner', 'admin', 'member']::public.member_role[])
           or app.is_assigned_to_project(app.brief_project(brief_id)));
create policy brief_items_update on public.brief_items for update to authenticated
  using (app.has_role(org_id, array['owner', 'admin', 'member']::public.member_role[]) or app.is_assigned_to_project(project_id)
      or app.has_role(app.internal_org_id(), array['compliance_reviewer']::public.member_role[]))   -- hold clearing only (trigger)
  with check (true);

-- ============================================================================
-- 5. Policy replacements deferred from 0005 / 0006 (ADR-031, ADR-033 → ADR-035)
-- ============================================================================

-- supplier_contacts: + assigned operators for shortlisted suppliers (read, create, update)
drop policy supplier_contacts_select on public.supplier_contacts;
drop policy supplier_contacts_insert on public.supplier_contacts;
drop policy supplier_contacts_update on public.supplier_contacts;
create policy supplier_contacts_select on public.supplier_contacts for select to authenticated
  using (app.is_platform_admin()
      or app.has_role(app.internal_org_id(), array['compliance_reviewer']::public.member_role[])
      or app.is_member(org_id)
      or app.contact_disclosed_to_me(id)
      or app.supplier_in_my_project(supplier_id));
create policy supplier_contacts_insert on public.supplier_contacts for insert to authenticated
  with check (app.is_platform_admin() or app.supplier_in_my_project(supplier_id));
create policy supplier_contacts_update on public.supplier_contacts for update to authenticated
  using (app.is_platform_admin()
      or app.has_role(org_id, array['owner', 'admin']::public.member_role[])
      or app.supplier_in_my_project(supplier_id))
  with check (true);

-- contact_disclosure_grants: an assigned operator may grant a shortlisted supplier's contact to THAT project's buyer org
drop policy contact_disclosure_grants_insert on public.contact_disclosure_grants;
drop policy contact_disclosure_grants_update on public.contact_disclosure_grants;
create policy contact_disclosure_grants_insert on public.contact_disclosure_grants for insert to authenticated
  with check (granted_by = auth.uid()
          and (app.is_platform_admin()
               or exists (select 1 from public.project_suppliers ps
                           join public.supplier_contacts c on c.supplier_id = ps.supplier_id
                          where c.id = contact_disclosure_grants.supplier_contact_id
                            and ps.org_id = contact_disclosure_grants.buyer_org_id
                            and ps.status <> 'dropped'
                            and app.is_assigned_to_project(ps.project_id))));
create policy contact_disclosure_grants_update on public.contact_disclosure_grants for update to authenticated
  using (app.is_platform_admin()
      or exists (select 1 from public.project_suppliers ps
                  join public.supplier_contacts c on c.supplier_id = ps.supplier_id
                 where c.id = contact_disclosure_grants.supplier_contact_id
                   and ps.org_id = contact_disclosure_grants.buyer_org_id
                   and app.is_assigned_to_project(ps.project_id)))
  with check (true);   -- revocation columns only (trigger)

-- documents: + assigned operators for documents attached to their project, and for a shortlisted supplier's submissions
create or replace function app.document_readable(p_document uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.documents d
     where d.id = p_document
       and d.status <> 'discarded'
       and (app.is_member(d.org_id)
            or app.is_platform_admin()
            or (d.supplier_id is not null
                and d.rights_class in ('supplier_submitted_private', 'catalog_public_with_permission')
                and app.is_member(app.supplier_org_of(d.supplier_id)))
            or (d.project_id is not null and app.is_assigned_to_project(d.project_id))
            or (d.supplier_id is not null
                and d.rights_class in ('supplier_submitted_private', 'catalog_public_with_permission')
                and app.supplier_in_my_project(d.supplier_id))));
$$;
