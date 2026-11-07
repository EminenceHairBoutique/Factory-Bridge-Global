-- 0003 audit_foundation — Factory Bridge Global (ADR-022; MIGRATION_DEPENDENCY_MAP §2 row 0003)
-- Lands BEFORE any business table so every later table attaches the audit trigger from its first migration.
-- authenticated has NO insert/update/delete on audit tables; rows are written only by SECURITY DEFINER
-- writers that derive the actor from auth.uid(). An actor override is accepted only from service_role.

-- ============================================================================
-- 1. Tables
-- ============================================================================

create table public.audit_events (
  id             uuid primary key default gen_random_uuid(),
  at             timestamptz not null default now(),
  actor_user_id  uuid,                                            -- null only for system actions without a user
  -- Deliberately NOT foreign keys: the audit log must outlive the rows it describes (an AFTER DELETE audit
  -- row references an org that no longer exists). Ids are retained verbatim as the legal record.
  actor_org_id   uuid,
  entity_org_id  uuid,                                            -- the org the entity belongs to
  acting_as      text not null check (acting_as in ('member', 'internal', 'platform_admin', 'system')),
  entity_table   text not null,
  entity_id      uuid,
  action         text not null,
  before_hash    text,
  after_hash     text,
  diff           jsonb,
  request_id     text,
  ip_hash        text
);
comment on table public.audit_events is 'Append-only legal record of changes. Written only via app.record_audit_event / app.audit_row_change.';
create index audit_events_entity_idx on public.audit_events (entity_table, entity_id, at desc);
create index audit_events_entity_org_idx on public.audit_events (entity_org_id, at desc);
create index audit_events_actor_org_idx on public.audit_events (actor_org_id, at desc);

create table public.security_events (
  id       uuid primary key default gen_random_uuid(),
  at       timestamptz not null default now(),
  kind     text not null check (kind in ('rls_denied', 'rate_limited', 'scan_rejected', 'webhook_sig_fail', 'injection_flag', 'auth_anomaly', 'privileged_access')),
  actor_user_id uuid,
  org_id   uuid references public.organizations (id) on delete set null,
  details  jsonb not null default '{}'::jsonb
);
create index security_events_kind_idx on public.security_events (kind, at desc);

-- Document access log: table now, FK to documents added in 0006 (documents do not exist yet).
create table public.document_access_log (
  id          uuid primary key default gen_random_uuid(),
  at          timestamptz not null default now(),
  document_id uuid not null,
  user_id     uuid,
  org_id      uuid references public.organizations (id) on delete set null,
  action      text not null check (action in ('view', 'download', 'signed_url')),
  ip_hash     text
);
create index document_access_log_doc_idx on public.document_access_log (document_id, at desc);

-- ============================================================================
-- 2. Trusted writers
-- ============================================================================

-- Derive how the current session is acting. service_role (no JWT user) → 'system'.
create or replace function app.current_acting_as()
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    return 'system';
  elsif app.is_platform_admin() then
    return 'platform_admin';
  elsif app.is_internal() then
    return 'internal';
  else
    return 'member';
  end if;
end;
$$;

-- The only way to write an audit row. Actor = auth.uid(); p_actor_override honoured ONLY for service_role.
create or replace function app.record_audit_event(
  p_entity_table   text,
  p_entity_id      uuid,
  p_action         text,
  p_before         jsonb default null,
  p_after          jsonb default null,
  p_entity_org_id  uuid default null,
  p_actor_org_id   uuid default null,
  p_actor_override uuid default null,
  p_request_id     text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_acting text := app.current_acting_as();
  v_id uuid;
begin
  if p_actor_override is not null then
    if coalesce(current_setting('role', true), '') <> 'service_role'
       and coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then
      raise exception 'actor_override is only permitted for service_role' using errcode = 'insufficient_privilege';
    end if;
    v_actor := p_actor_override;
    v_acting := 'system';
  end if;
  insert into public.audit_events
    (actor_user_id, actor_org_id, entity_org_id, acting_as, entity_table, entity_id, action,
     before_hash, after_hash, diff, request_id)
  values
    (v_actor, p_actor_org_id, p_entity_org_id, v_acting, p_entity_table, p_entity_id, p_action,
     case when p_before is null then null else encode(sha256(convert_to(p_before::text, 'UTF8')), 'hex') end,
     case when p_after  is null then null else encode(sha256(convert_to(p_after::text,  'UTF8')), 'hex') end,
     jsonb_build_object('before', p_before, 'after', p_after),
     p_request_id)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function app.record_security_event(p_kind text, p_org uuid, p_details jsonb default '{}'::jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_id uuid;
begin
  insert into public.security_events (kind, actor_user_id, org_id, details)
  values (p_kind, auth.uid(), p_org, coalesce(p_details, '{}'::jsonb))
  returning id into v_id;
  return v_id;
end;
$$;

-- Row-change trigger. TG_ARGV[0] = name of the column holding the entity's org id ('id' for organizations,
-- 'org_id' for most tables). TG_ARGV[1] = 'redact' to store only changed column names (restricted tables).
create or replace function app.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row        jsonb;
  v_old        jsonb;
  v_new        jsonb;
  v_entity_id  uuid;
  v_entity_org uuid;
  v_org_col    text := coalesce(tg_argv[0], 'org_id');
  v_redact     boolean := coalesce(tg_argv[1], '') = 'redact';
  v_changed    text[];
begin
  if tg_op = 'DELETE' then
    v_old := to_jsonb(old); v_row := v_old;
  elsif tg_op = 'INSERT' then
    v_new := to_jsonb(new); v_row := v_new;
  else
    v_old := to_jsonb(old); v_new := to_jsonb(new); v_row := v_new;
  end if;
  v_entity_id  := (v_row ->> 'id')::uuid;
  v_entity_org := (v_row ->> v_org_col)::uuid;
  if v_redact then
    select coalesce(array_agg(k), '{}') into v_changed
      from jsonb_object_keys(coalesce(v_new, v_old)) k
     where v_old is null or v_new is null or (v_old -> k) is distinct from (v_new -> k);
    v_old := case when v_old is null then null else jsonb_build_object('_redacted', true, 'changed', to_jsonb(v_changed)) end;
    v_new := case when v_new is null then null else jsonb_build_object('_redacted', true, 'changed', to_jsonb(v_changed)) end;
  end if;
  perform app.record_audit_event(tg_table_name, v_entity_id, lower(tg_op), v_old, v_new, v_entity_org, null, null, null);
  return coalesce(new, old);
end;
$$;

revoke execute on function
  app.current_acting_as(),
  app.record_audit_event(text, uuid, text, jsonb, jsonb, uuid, uuid, uuid, text),
  app.record_security_event(text, uuid, jsonb)
  from public, anon;
grant execute on function
  app.current_acting_as(),
  app.record_audit_event(text, uuid, text, jsonb, jsonb, uuid, uuid, uuid, text),
  app.record_security_event(text, uuid, jsonb)
  to authenticated, service_role;

-- ============================================================================
-- 3. Attach audit triggers to the tenancy tables (0002)
-- ============================================================================

create trigger organizations_audit after insert or update or delete on public.organizations
  for each row execute function app.audit_row_change('id');
create trigger memberships_audit after insert or update or delete on public.memberships
  for each row execute function app.audit_row_change('org_id');
create trigger invites_audit after insert or update or delete on public.invites
  for each row execute function app.audit_row_change('org_id', 'redact');

-- ============================================================================
-- 4. Privileges and RLS (append-only: no UPDATE/DELETE for any non-superuser role, service_role included)
-- ============================================================================

alter table public.audit_events        enable row level security;
alter table public.audit_events        force row level security;
alter table public.security_events     enable row level security;
alter table public.security_events     force row level security;
alter table public.document_access_log enable row level security;
alter table public.document_access_log force row level security;

revoke all on public.audit_events, public.security_events, public.document_access_log from public, anon, authenticated, service_role;
grant select on public.audit_events, public.security_events, public.document_access_log to authenticated;
grant select, insert on public.audit_events, public.security_events, public.document_access_log to service_role;
-- (service_role may insert for worker-side events but, like everyone else, has no UPDATE/DELETE grant.)

create policy audit_events_select on public.audit_events for select to authenticated
  using (
       (entity_org_id is not null and app.has_role(entity_org_id, array['owner', 'admin']::public.member_role[]))
    or app.is_platform_admin()
    or app.has_role(app.internal_org_id(), array['compliance_reviewer']::public.member_role[])
  );
create policy security_events_select on public.security_events for select to authenticated
  using (app.is_platform_admin()
      or app.has_role(app.internal_org_id(), array['compliance_reviewer']::public.member_role[]));
create policy document_access_log_select on public.document_access_log for select to authenticated
  using (app.is_internal());
