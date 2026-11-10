-- 0013 web_auth_rpc — Factory Bridge Global (B-05 / M1, ADR-041)
-- docs/MIGRATION_DEPENDENCY_MAP.md §2 row 0013. Depends on 0002 (tenancy tables, helpers, mutation functions) and
-- 0003 (memberships audit trigger, which keeps recording every change below).
--
-- The Data API exposes `public` only (supabase/config.toml). The web tier therefore reaches the tenancy functions in
-- schema `app` through thin `public` wrappers (ADR-041 §1):
--   * `language sql`, SECURITY INVOKER, `search_path = ''`; the body only calls the `app` function with the same
--     arguments, so every rule (auth.uid(), roles, last-owner guard, token hashing) stays in one place;
--   * EXECUTE for `authenticated` only (Supabase's default privileges in `public` grant ALL on new functions to
--     anon/authenticated/service_role, and Postgres grants EXECUTE to PUBLIC, so both are revoked first);
--   * registered in supabase/tests/rls-coverage.ts PUBLIC_FUNCTIONS; migrations.test.ts fails on any public function
--     that is unregistered, SECURITY DEFINER, unpinned, or executable by anon.
-- Also here: the team-list reader (the only path to teammates' emails) and session revocation on a role change
-- (ADR-041 §5). No table is created, so no RLS policy changes.

-- ============================================================================
-- 1. app.list_org_members — owner/admin of the org (or a platform admin) reads the team with emails
-- ============================================================================

create or replace function app.list_org_members(p_org uuid)
returns table (
  membership_id uuid,
  user_id       uuid,
  email         text,
  full_name     text,
  role          public.member_role,
  status        text,
  accepted_at   timestamptz,
  created_at    timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if auth.uid() is null
     or not (app.has_role(p_org, array['owner', 'admin']::public.member_role[]) or app.is_platform_admin()) then
    raise exception 'not authorized to list members of organization %', p_org using errcode = 'insufficient_privilege';
  end if;
  return query
    select m.id, m.user_id, lower(u.email)::text, pr.full_name, m.role, m.status, m.accepted_at, m.created_at
      from public.memberships m
      join auth.users u on u.id = m.user_id
      left join public.user_profiles pr on pr.user_id = m.user_id
     where m.org_id = p_org
     order by m.created_at, m.id;
end;
$$;
comment on function app.list_org_members(uuid) is
  'Team list with emails for owners/admins of p_org and platform admins (ADR-041 §4). Raises 42501 for anyone else.';

revoke execute on function app.list_org_members(uuid) from public, anon;
grant execute on function app.list_org_members(uuid) to authenticated, service_role;

-- ============================================================================
-- 2. Session revocation on a role or status change (ADR-041 §5)
--    Authorization is never cached (the web guard and RLS read memberships live); this additionally ends the
--    member's sessions everywhere, so the next request on any device must sign in again. auth.sessions is owned
--    by Supabase Auth; deleting a row cascades to its refresh tokens, and getUser() then refuses the old access
--    token ("session not found"). A member's own change (accepting an invite) does not sign them out.
-- ============================================================================

create or replace function app.revoke_member_sessions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.user_id is distinct from auth.uid() then
    delete from auth.sessions s where s.user_id = new.user_id;
  end if;
  return null;
end;
$$;
comment on function app.revoke_member_sessions() is
  'AFTER UPDATE trigger on memberships: a role/status change made by someone else deletes the member''s auth.sessions rows.';
revoke execute on function app.revoke_member_sessions() from public, anon, authenticated;

create trigger memberships_revoke_sessions
  after update of role, status on public.memberships
  for each row
  when (old.role is distinct from new.role or old.status is distinct from new.status)
  execute function app.revoke_member_sessions();

-- ============================================================================
-- 3. Public wrappers (one per user action; SECURITY INVOKER; authenticated only)
-- ============================================================================

create or replace function public.create_organization(
  p_org_type        public.org_type,
  p_legal_name      text,
  p_display_name    text,
  p_display_name_zh text default null,
  p_country         char(2) default 'US'
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select app.create_organization(p_org_type, p_legal_name, p_display_name, p_display_name_zh, p_country);
$$;

create or replace function public.create_invite(p_org uuid, p_email text, p_role public.member_role)
returns text
language sql
security invoker
set search_path = ''
as $$
  select app.create_invite(p_org, p_email, p_role);
$$;

create or replace function public.accept_invite(p_token text)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select app.accept_invite(p_token);
$$;

create or replace function public.update_membership(p_membership uuid, p_role public.member_role, p_status text)
returns void
language sql
security invoker
set search_path = ''
as $$
  select app.update_membership(p_membership, p_role, p_status);
$$;

create or replace function public.list_org_members(p_org uuid)
returns table (
  membership_id uuid,
  user_id       uuid,
  email         text,
  full_name     text,
  role          public.member_role,
  status        text,
  accepted_at   timestamptz,
  created_at    timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from app.list_org_members(p_org);
$$;

comment on function public.create_organization(public.org_type, text, text, text, char) is
  'Data API wrapper for app.create_organization (ADR-041 §1). SECURITY INVOKER; authenticated only.';
comment on function public.create_invite(uuid, text, public.member_role) is
  'Data API wrapper for app.create_invite (ADR-041 §1). Returns the raw token once. SECURITY INVOKER; authenticated only.';
comment on function public.accept_invite(text) is
  'Data API wrapper for app.accept_invite (ADR-041 §1). SECURITY INVOKER; authenticated only.';
comment on function public.update_membership(uuid, public.member_role, text) is
  'Data API wrapper for app.update_membership (ADR-041 §1). SECURITY INVOKER; authenticated only.';
comment on function public.list_org_members(uuid) is
  'Data API wrapper for app.list_org_members (ADR-041 §4). SECURITY INVOKER; authenticated only.';

revoke all on function
  public.create_organization(public.org_type, text, text, text, char),
  public.create_invite(uuid, text, public.member_role),
  public.accept_invite(text),
  public.update_membership(uuid, public.member_role, text),
  public.list_org_members(uuid)
  from public, anon, authenticated, service_role;
grant execute on function
  public.create_organization(public.org_type, text, text, text, char),
  public.create_invite(uuid, text, public.member_role),
  public.accept_invite(text),
  public.update_membership(uuid, public.member_role, text),
  public.list_org_members(uuid)
  to authenticated;
