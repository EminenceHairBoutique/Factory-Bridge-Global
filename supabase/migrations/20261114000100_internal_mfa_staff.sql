-- 0014 internal_mfa_staff — Factory Bridge Global (B-05b, ADR-043)
-- docs/MIGRATION_DEPENDENCY_MAP.md §2 row 0014. Depends on 0002 (membership helpers, organizations_select, invites),
-- 0003 (record_security_event; the memberships/invites audit triggers record every change below), 0008
-- (is_assigned_to_project) and 0013 (the public-wrapper pattern, ADR-042 §1).
--
-- 1. Internal roles count only at authenticator assurance level 2 (ADR-043 §2). The web guard already refuses /ops
--    below aal2, but the Data API is a second way in: anyone holding an operator's password could sign in against
--    Supabase Auth directly and query PostgREST with the aal1 token. So the database gates internal privileges on the
--    JWT `aal` claim too. One rule, applied where every internal privilege is derived: a membership with an internal
--    role (operator, compliance_reviewer, platform_admin) is ignored by app.is_member / app.has_role /
--    app.is_member_of_type unless the request's JWT says `aal2`. Internal roles exist only in the internal org
--    (0002 enforce_membership_role), so the predicate needs no join. is_internal() and is_platform_admin() are built
--    on those helpers and follow automatically; is_assigned_to_project() is rewritten because its assignment branch
--    did not consult memberships at all.
-- 2. The guard must still see that an aal1 user is internal staff, to send them to MFA enrolment or verification
--    rather than a 404. Own membership rows are always readable (memberships_select: user_id = auth.uid()); the
--    organizations row they join to is now readable through app.holds_membership(), which ignores aal. That exposes
--    the internal org's own name row to its aal1 members and nothing else.
-- 3. Staff provisioning without SQL (ADR-043 §4): app.create_staff_invite issues a single-use, email-bound invite to
--    the internal org for operator or compliance_reviewer, for a platform admin at aal2 only. Acceptance reuses
--    app.accept_invite unchanged. platform_admin itself is still granted only by the bootstrap runbook.
-- No table is created, so no new RLS coverage entries; one policy is replaced (organizations_select).

-- ============================================================================
-- 1. Assurance level of the current request
-- ============================================================================

-- Mirrors auth.uid(): the legacy per-claim setting first, then the claims JSON PostgREST sets for every request.
-- Anything other than 'aal2' (missing claim, aal1, no JWT at all) is aal1. Clients cannot set these settings: the
-- Data API exposes `public` functions only and none of them calls set_config.
create or replace function app.session_aal()
returns text
language sql
stable
set search_path = ''
as $$
  select case coalesce(
                nullif(current_setting('request.jwt.claim.aal', true), ''),
                (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'aal'))
           when 'aal2' then 'aal2'
           else 'aal1'
         end;
$$;
comment on function app.session_aal() is
  'aal2 when the request JWT carries aal = aal2 (TOTP verified in this session), else aal1 (ADR-043 §2).';

revoke execute on function app.session_aal() from public, anon;
grant execute on function app.session_aal() to authenticated, service_role;

-- ============================================================================
-- 2. Membership helpers: internal roles need aal2 (same signatures, grants kept by CREATE OR REPLACE)
-- ============================================================================

create or replace function app.is_member(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
     where m.org_id = p_org and m.user_id = auth.uid() and m.status = 'active'
       and (m.role not in ('operator', 'compliance_reviewer', 'platform_admin') or app.session_aal() = 'aal2'));
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
       and m.status = 'active' and m.role = any (p_roles)
       and (m.role not in ('operator', 'compliance_reviewer', 'platform_admin') or app.session_aal() = 'aal2'));
$$;

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
     where m.user_id = auth.uid() and m.status = 'active' and o.org_type = p_type
       and (m.role not in ('operator', 'compliance_reviewer', 'platform_admin') or app.session_aal() = 'aal2'));
$$;

comment on function app.is_member(uuid) is
  'Active member of p_org. Internal-role memberships count only at aal2 (ADR-043 §2).';
comment on function app.has_role(uuid, public.member_role[]) is
  'Active member of p_org with one of p_roles. Internal roles count only at aal2 (ADR-043 §2).';
comment on function app.is_member_of_type(public.org_type) is
  'Active member of any org of p_type. Internal-role memberships count only at aal2 (ADR-043 §2).';

-- Assigned operators: the assignment alone used to be enough, even after the operator's internal membership was
-- suspended. Now an active internal membership at aal2 (app.is_internal) is required as well.
create or replace function app.is_assigned_to_project(p_project uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app.is_platform_admin()
      or (app.is_internal()
          and exists (select 1 from public.project_assignments a
                       where a.project_id = p_project and a.operator_user_id = auth.uid() and a.active));
$$;
comment on function app.is_assigned_to_project(uuid) is
  'Platform admin, or an active assignment held by an active internal member at aal2 (ADR-035, ADR-043 §2).';

-- ============================================================================
-- 3. The guard's view of an aal1 staff member: their own organization rows
-- ============================================================================

-- Holding an active membership, whatever the role and assurance level. Used ONLY by organizations_select, so that
-- the web guard's memberships ⋈ organizations read still returns an aal1 operator's internal membership (and routes
-- them to MFA). It grants no access to any tenant data.
create or replace function app.holds_membership(p_org uuid)
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
comment on function app.holds_membership(uuid) is
  'Active membership in p_org at any assurance level. Only for organizations_select (ADR-043 §2).';

revoke execute on function app.holds_membership(uuid) from public, anon;
grant execute on function app.holds_membership(uuid) to authenticated, service_role;

drop policy organizations_select on public.organizations;
create policy organizations_select on public.organizations for select to authenticated
  using (app.holds_membership(id) or app.is_internal());

-- ============================================================================
-- 4. Staff provisioning: a platform admin (aal2) invites an operator or compliance reviewer
-- ============================================================================

create or replace function app.create_staff_invite(p_email text, p_role public.member_role)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid   uuid := auth.uid();
  v_org   uuid := app.internal_org_id();
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_token text;
  v_id    uuid;
begin
  -- is_platform_admin() is false below aal2 (section 2), so this also refuses a platform admin without MFA.
  if v_uid is null or v_org is null or not app.is_platform_admin() then
    raise exception 'not authorized to invite internal staff' using errcode = 'insufficient_privilege';
  end if;
  if p_role is null or p_role not in ('operator', 'compliance_reviewer') then
    raise exception 'staff invites may only grant operator or compliance_reviewer' using errcode = 'check_violation';
  end if;
  if char_length(v_email) > 254 or v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then
    raise exception 'invalid email address' using errcode = 'invalid_parameter_value';
  end if;
  if exists (select 1 from public.memberships m
               join auth.users u on u.id = m.user_id
              where m.org_id = v_org and m.status = 'active' and lower(u.email) = v_email) then
    raise exception 'that address already belongs to active internal staff' using errcode = 'unique_violation';
  end if;
  v_token := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');   -- as app.create_invite
  insert into public.invites (org_id, email, role, token_hash, invited_by, expires_at)
  values (v_org, v_email, p_role, encode(sha256(convert_to(v_token, 'UTF8')), 'hex'), v_uid, now() + interval '72 hours')
  returning id into v_id;
  perform app.record_security_event('privileged_access', v_org,
    jsonb_build_object('action', 'staff_invite_created', 'invite_id', v_id, 'role', p_role));
  return v_token;
end;
$$;
comment on function app.create_staff_invite(text, public.member_role) is
  'Platform admin at aal2 invites an operator or compliance reviewer to the internal org; returns the raw token once '
  '(72 h, single use, bound to the email). Accepted through app.accept_invite (ADR-043 §4).';

revoke execute on function app.create_staff_invite(text, public.member_role) from public, anon;
grant execute on function app.create_staff_invite(text, public.member_role) to authenticated, service_role;

create or replace function public.create_staff_invite(p_email text, p_role public.member_role)
returns text
language sql
security invoker
set search_path = ''
as $$
  select app.create_staff_invite(p_email, p_role);
$$;
comment on function public.create_staff_invite(text, public.member_role) is
  'Data API wrapper for app.create_staff_invite (ADR-042 §1, ADR-043 §4). SECURITY INVOKER; authenticated only.';

revoke all on function public.create_staff_invite(text, public.member_role)
  from public, anon, authenticated, service_role;
grant execute on function public.create_staff_invite(text, public.member_role) to authenticated;
