-- 0002 tenancy_core — Factory Bridge Global
-- docs/MIGRATION_DEPENDENCY_MAP.md §2 row 0002, §3 (helpers), §4 (bootstrap/uniqueness).
-- Order inside this file matters: tables → generic trigger functions → membership helpers (they read
-- the tables above; SQL-function bodies are validated at CREATE) → triggers → RLS → mutation functions.
-- Every write that changes tenancy (create org, invite, accept, change role) goes through a
-- SECURITY DEFINER function in schema app; `authenticated` has no direct INSERT/DELETE on these tables.

-- ============================================================================
-- 1. Tables
-- ============================================================================

create table public.organizations (
  id               uuid primary key default gen_random_uuid(),
  org_type         public.org_type not null,
  legal_name       text not null check (char_length(legal_name) between 1 and 200),
  display_name     text not null check (char_length(display_name) between 1 and 120),
  display_name_zh  text check (display_name_zh is null or char_length(display_name_zh) <= 120),
  country          char(2) not null default 'US',
  compliance_state public.compliance_state not null default 'clear',
  status           text not null default 'active' check (status in ('active', 'suspended', 'archived')),
  settings         jsonb not null default '{}'::jsonb,
  created_by       uuid,                                   -- auth.users(id); not an FK so deleting a user keeps the org
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
comment on table public.organizations is 'Tenants: buyer, supplier or the single internal org (ADR-004).';
-- Exactly one internal organization (MIGRATION_DEPENDENCY_MAP §4).
create unique index organizations_one_internal on public.organizations ((true)) where org_type = 'internal';
create index organizations_org_type_idx on public.organizations (org_type);

create table public.user_profiles (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  full_name  text check (full_name is null or char_length(full_name) <= 120),
  locale     text not null default 'en-US' check (locale in ('en-US', 'zh-CN')),
  timezone   text not null default 'America/New_York',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.memberships (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  role        public.member_role not null,
  status      text not null default 'active' check (status in ('active', 'suspended')),
  invited_by  uuid,
  accepted_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (org_id, user_id)
);
create index memberships_user_idx on public.memberships (user_id, org_id) where status = 'active';
create index memberships_org_role_idx on public.memberships (org_id, role);

create table public.invites (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  email       text not null check (position('@' in email) > 1),
  role        public.member_role not null,
  token_hash  text not null unique,                        -- sha256 hex of the raw token; raw token is never stored
  invited_by  uuid not null,
  expires_at  timestamptz not null,
  accepted_at timestamptz,
  accepted_by uuid,
  created_at  timestamptz not null default now(),
  check (expires_at > created_at and expires_at <= created_at + interval '7 days'),
  check ((accepted_at is null) = (accepted_by is null))
);
create index invites_org_idx on public.invites (org_id) where accepted_at is null;

-- ============================================================================
-- 2. Generic trigger functions (no table dependencies)
-- ============================================================================

create or replace function app.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Ownership columns are immutable (SECURITY_PERMISSION_MATRIX §3.5). Column names come from TG_ARGV.
create or replace function app.prevent_owner_change()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  col  text;
  oldv text;
  newv text;
begin
  foreach col in array tg_argv loop
    execute format('select ($1).%I::text, ($2).%I::text', col, col) into oldv, newv using old, new;
    if oldv is distinct from newv then
      raise exception 'column % of %.% is immutable', col, tg_table_schema, tg_table_name
        using errcode = 'check_violation';
    end if;
  end loop;
  return new;
end;
$$;

-- Role must fit the organization type (internal roles vs buyer/supplier roles).
create or replace function app.enforce_membership_role()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  t public.org_type;
begin
  select o.org_type into t from public.organizations o where o.id = new.org_id;
  if t is null then
    raise exception 'organization % does not exist', new.org_id using errcode = 'foreign_key_violation';
  end if;
  if t = 'internal' then
    if new.role not in ('operator', 'compliance_reviewer', 'platform_admin') then
      raise exception 'role % is not valid for the internal organization', new.role using errcode = 'check_violation';
    end if;
  else
    if new.role not in ('owner', 'admin', 'member', 'viewer') then
      raise exception 'role % is not valid for a % organization', new.role, t using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

-- ============================================================================
-- 3. Membership helpers (defined AFTER the tables they read)
--    SECURITY DEFINER so they can read memberships regardless of the caller's RLS;
--    search_path = '' and schema-qualified refs; subject is always auth.uid().
-- ============================================================================

create or replace function app.internal_org_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select o.id from public.organizations o where o.org_type = 'internal' limit 1;
$$;

create or replace function app.is_member(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
     where m.org_id = p_org and m.user_id = auth.uid() and m.status = 'active');
$$;

create or replace function app.has_role(p_org uuid, p_roles public.member_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
     where m.org_id = p_org and m.user_id = auth.uid()
       and m.status = 'active' and m.role = any (p_roles));
$$;

create or replace function app.is_internal()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app.is_member(app.internal_org_id());
$$;

create or replace function app.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app.has_role(app.internal_org_id(), array['platform_admin']::public.member_role[]);
$$;

-- Replaces the undefined "current_org_type": does the user hold an active membership in ANY org of this type?
create or replace function app.is_member_of_type(p_type public.org_type)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
      join public.organizations o on o.id = m.org_id
     where m.user_id = auth.uid() and m.status = 'active' and o.org_type = p_type);
$$;

revoke execute on function
  app.internal_org_id(), app.is_member(uuid), app.has_role(uuid, public.member_role[]),
  app.is_internal(), app.is_platform_admin(), app.is_member_of_type(public.org_type)
  from public, anon;
grant execute on function
  app.internal_org_id(), app.is_member(uuid), app.has_role(uuid, public.member_role[]),
  app.is_internal(), app.is_platform_admin(), app.is_member_of_type(public.org_type)
  to authenticated, service_role;

-- ============================================================================
-- 4. Triggers
-- ============================================================================

create trigger organizations_set_updated_at before update on public.organizations
  for each row execute function app.set_updated_at();
create trigger organizations_owner_guard before update on public.organizations
  for each row execute function app.prevent_owner_change('org_type', 'created_by');

create trigger user_profiles_set_updated_at before update on public.user_profiles
  for each row execute function app.set_updated_at();

create trigger memberships_set_updated_at before update on public.memberships
  for each row execute function app.set_updated_at();
create trigger memberships_owner_guard before update on public.memberships
  for each row execute function app.prevent_owner_change('org_id', 'user_id');
create trigger memberships_role_fits_org before insert or update of role, org_id on public.memberships
  for each row execute function app.enforce_membership_role();

create trigger invites_owner_guard before update on public.invites
  for each row execute function app.prevent_owner_change('org_id', 'email', 'role', 'token_hash', 'invited_by', 'expires_at');

-- ============================================================================
-- 5. Row Level Security (SECURITY_PERMISSION_MATRIX §2; patterns in SCHEMA_PLAN §3.2)
--    FORCE applies policies to the table owner too. It does NOT bind BYPASSRLS roles (service_role).
-- ============================================================================

alter table public.organizations enable row level security;
alter table public.organizations force row level security;
alter table public.user_profiles  enable row level security;
alter table public.user_profiles  force row level security;
alter table public.memberships    enable row level security;
alter table public.memberships    force row level security;
alter table public.invites        enable row level security;
alter table public.invites        force row level security;

-- Table privileges: `authenticated` gets only what a policy can allow; no INSERT/DELETE on tenancy tables.
revoke all on public.organizations, public.user_profiles, public.memberships, public.invites from public, anon, authenticated, service_role;
grant select, update on public.organizations to authenticated;
grant select, insert, update on public.user_profiles to authenticated;
grant select, update on public.memberships to authenticated;
grant select on public.invites to authenticated;
grant all on public.organizations, public.user_profiles, public.memberships, public.invites to service_role;

-- organizations: members see their orgs; internal staff see every org's profile row (names only — contacts
-- and projects are protected by their own tables); owners/admins and platform admins may update.
create policy organizations_select on public.organizations for select to authenticated
  using (app.is_member(id) or app.is_internal());
create policy organizations_update on public.organizations for update to authenticated
  using (app.has_role(id, array['owner', 'admin']::public.member_role[]) or app.is_platform_admin())
  with check (true);  -- org_type/created_by immutable via trigger; other columns are the owner's to edit

-- user_profiles: own row only (teammate display names will come through a view later).
create policy user_profiles_select on public.user_profiles for select to authenticated
  using (user_id = auth.uid() or app.is_platform_admin());
create policy user_profiles_insert on public.user_profiles for insert to authenticated
  with check (user_id = auth.uid());
create policy user_profiles_update on public.user_profiles for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- memberships: own rows, teammates of orgs you belong to, platform admin. Internal membership alone
-- grants nothing here (unassigned operators cannot enumerate buyer teams).
create policy memberships_select on public.memberships for select to authenticated
  using (user_id = auth.uid() or app.is_member(org_id) or app.is_platform_admin());
-- Role/status changes go through app.update_membership(); direct UPDATE is limited to platform admin so
-- an emergency fix is possible and audited (audit trigger attached in 0003).
create policy memberships_update on public.memberships for update to authenticated
  using (app.is_platform_admin()) with check (true);

-- invites: org owners/admins and platform admin can see pending invites (token hash is useless alone).
create policy invites_select on public.invites for select to authenticated
  using (app.has_role(org_id, array['owner', 'admin']::public.member_role[]) or app.is_platform_admin());

-- ============================================================================
-- 6. Mutation functions (SECURITY DEFINER, authorization re-checked inside, audited from 0003 via triggers)
-- ============================================================================

-- Create a buyer or supplier organization and make the caller its owner. Internal org is seeded, never created here.
create or replace function app.create_organization(
  p_org_type      public.org_type,
  p_legal_name    text,
  p_display_name  text,
  p_display_name_zh text default null,
  p_country       char(2) default 'US'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_org uuid;
begin
  if v_uid is null then
    raise exception 'authentication required' using errcode = 'insufficient_privilege';
  end if;
  if p_org_type = 'internal' then
    raise exception 'the internal organization is seeded, not created' using errcode = 'check_violation';
  end if;
  insert into public.organizations (org_type, legal_name, display_name, display_name_zh, country, created_by)
  values (p_org_type, p_legal_name, p_display_name, p_display_name_zh, p_country, v_uid)
  returning id into v_org;
  insert into public.memberships (org_id, user_id, role, status, accepted_at)
  values (v_org, v_uid, 'owner', 'active', now());
  return v_org;
end;
$$;

-- Owner/admin creates an invite; returns the raw token exactly once (only its sha256 is stored).
create or replace function app.create_invite(p_org uuid, p_email text, p_role public.member_role)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid   uuid := auth.uid();
  v_token text;
begin
  if v_uid is null or not app.has_role(p_org, array['owner', 'admin']::public.member_role[]) then
    raise exception 'not authorized to invite to organization %', p_org using errcode = 'insufficient_privilege';
  end if;
  if p_role not in ('owner', 'admin', 'member', 'viewer') then
    raise exception 'invites may only grant buyer/supplier roles' using errcode = 'check_violation';
  end if;
  v_token := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');   -- 256 bits
  insert into public.invites (org_id, email, role, token_hash, invited_by, expires_at)
  values (p_org, lower(p_email), p_role, encode(sha256(convert_to(v_token, 'UTF8')), 'hex'), v_uid, now() + interval '7 days');
  return v_token;
end;
$$;

-- Signed-in user accepts an invite: token must match, be unexpired, unused, and addressed to the caller's email.
create or replace function app.accept_invite(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid   uuid := auth.uid();
  v_email text;
  v_inv   public.invites%rowtype;
  v_mem   uuid;
begin
  if v_uid is null then
    raise exception 'authentication required' using errcode = 'insufficient_privilege';
  end if;
  select lower(u.email) into v_email from auth.users u where u.id = v_uid;
  select * into v_inv from public.invites i
   where i.token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex')
   for update;
  if v_inv.id is null or v_inv.accepted_at is not null or v_inv.expires_at <= now() then
    raise exception 'invite is invalid, used or expired' using errcode = 'invalid_parameter_value';
  end if;
  if v_email is null or v_inv.email <> v_email then
    raise exception 'invite was issued to a different email address' using errcode = 'insufficient_privilege';
  end if;
  insert into public.memberships (org_id, user_id, role, status, invited_by, accepted_at)
  values (v_inv.org_id, v_uid, v_inv.role, 'active', v_inv.invited_by, now())
  on conflict (org_id, user_id) do update set role = excluded.role, status = 'active', accepted_at = now()
  returning id into v_mem;
  update public.invites set accepted_at = now(), accepted_by = v_uid where id = v_inv.id;
  return v_mem;
end;
$$;

-- Owner/admin changes a teammate's role or status (suspend/reactivate). Cannot demote the last owner.
create or replace function app.update_membership(p_membership uuid, p_role public.member_role, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.memberships%rowtype;
  v_owners int;
begin
  select * into v_row from public.memberships where id = p_membership for update;
  if v_row.id is null then
    raise exception 'membership not found' using errcode = 'no_data_found';
  end if;
  if v_uid is null or not (app.has_role(v_row.org_id, array['owner', 'admin']::public.member_role[]) or app.is_platform_admin()) then
    raise exception 'not authorized to manage members of organization %', v_row.org_id using errcode = 'insufficient_privilege';
  end if;
  if p_status not in ('active', 'suspended') then
    raise exception 'invalid status %', p_status using errcode = 'check_violation';
  end if;
  if v_row.role = 'owner' and (p_role <> 'owner' or p_status <> 'active') then
    select count(*) into v_owners from public.memberships m
     where m.org_id = v_row.org_id and m.role = 'owner' and m.status = 'active' and m.id <> v_row.id;
    if v_owners = 0 then
      raise exception 'an organization must keep at least one active owner' using errcode = 'check_violation';
    end if;
  end if;
  update public.memberships set role = p_role, status = p_status where id = p_membership;
end;
$$;

revoke execute on function
  app.create_organization(public.org_type, text, text, text, char),
  app.create_invite(uuid, text, public.member_role),
  app.accept_invite(text),
  app.update_membership(uuid, public.member_role, text)
  from public, anon;
grant execute on function
  app.create_organization(public.org_type, text, text, text, char),
  app.create_invite(uuid, text, public.member_role),
  app.accept_invite(text),
  app.update_membership(uuid, public.member_role, text)
  to authenticated, service_role;
