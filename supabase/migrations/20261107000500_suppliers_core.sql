-- 0005 suppliers_core — Factory Bridge Global (MIGRATION_DEPENDENCY_MAP §2 row 0005; SCHEMA_PLAN §2.2/§2.4; matrix §2 rows
-- "Supplier profile", "Supplier contacts (restricted)", "Supplier-authorized catalog", "source_permissions", "Research leads")
--
-- What this migration establishes:
--   * supplier_profiles        one per supplier org; claimed fields editable by the supplier, verified fields (entity_kind_verified,
--                              stage) only by internal staff. Buyers see a supplier only once it has left stage 'lead_identified'
--                              (ADR-030) and only through supplier_public_profile_v (no contact columns).
--   * supplier_facilities      addresses; evidence_document_id arrives in 0007 (documents exist from 0006).
--   * supplier_contacts        RESTRICTED (Pattern D). Readable by platform admins, compliance reviewers, the supplier's own org, and a
--                              buyer org holding an active contact_disclosure_grants row. Unassigned internal operators have NO access;
--                              the assigned-operator clause is added in 0008 when project_assignments exist (ADR-031). Audit is redacted.
--   * contact_disclosure_grants internal-created, buyer-readable, immutable except revocation; expiry and revocation deny on the next read.
--   * source_systems           the integration/permission register as DATA: Taobao/1688/Weidian/WeChat rows are status 'blocked' here, so
--                              any connector work is gated by a platform_admin changing a row, not by a code comment (CLAUDE.md §4).
--   * source_permissions       rights grants (rights_class + validated scope). Immutable except revocation. app.catalog_grant_active()
--                              is the single predicate buyers' catalog visibility is evaluated against (grant-evaluated, never a label).
--   * research_leads           internal-only market observations; rights_class is CHECK-pinned to internal_market_observation.
--
-- Deletes: no table grants DELETE to authenticated. Deactivate / revoke / archive instead.

-- ============================================================================
-- 1. Tables
-- ============================================================================

create table public.supplier_profiles (
  id                   uuid primary key default gen_random_uuid(),
  org_id               uuid not null unique references public.organizations (id) on delete cascade,
  legal_name_zh        text not null check (length(btrim(legal_name_zh)) between 2 and 200),
  legal_name_en        text check (legal_name_en is null or length(btrim(legal_name_en)) between 2 and 200),
  -- 统一社会信用代码: 18 chars, digits + uppercase letters excluding I, O, S, V, Z. Format only — NOT a registry match (that is check_type uscc_matched, 0007).
  uscc                 text check (uscc is null or uscc ~ '^[0-9A-HJ-NP-RTUWXY]{18}$'),
  entity_kind          text not null default 'unknown' check (entity_kind in ('manufacturer', 'trading', 'unknown')),  -- as CLAIMED by the supplier
  entity_kind_verified boolean not null default false,       -- internal-only write (trigger)
  province             text,
  city                 text,
  website              text check (website is null or website ~* '^https?://'),
  stage                public.supplier_stage not null default 'lead_identified',   -- internal-only write (trigger)
  export_ready_claimed boolean not null default false,
  intro_zh             text,
  intro_en             text,
  created_by           uuid,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
comment on table public.supplier_profiles is
  'One profile per supplier org. "claimed" columns are the supplier''s own statements; entity_kind_verified and stage are set only by internal staff with evidence (0007 checks).';
create index supplier_profiles_stage_idx on public.supplier_profiles (stage);

create table public.supplier_facilities (
  id            uuid primary key default gen_random_uuid(),
  supplier_id   uuid not null references public.supplier_profiles (id) on delete cascade,
  org_id        uuid not null references public.organizations (id) on delete cascade,   -- denormalized = supplier org (trigger-set)
  facility_type text not null check (facility_type in ('factory', 'warehouse', 'office', 'showroom')),
  address_zh    text not null check (length(btrim(address_zh)) >= 4),
  address_en    text,
  is_primary    boolean not null default false,
  notes         text,
  created_by    uuid,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
  -- evidence_document_id uuid references public.documents(id): added in 0007 (documents are created in 0006)
);
create index supplier_facilities_supplier_idx on public.supplier_facilities (supplier_id);
create unique index supplier_facilities_one_primary on public.supplier_facilities (supplier_id) where is_primary;

create table public.supplier_contacts (
  id            uuid primary key default gen_random_uuid(),
  supplier_id   uuid not null references public.supplier_profiles (id) on delete cascade,
  org_id        uuid not null references public.organizations (id) on delete cascade,   -- denormalized = supplier org (trigger-set)
  name          text not null check (length(btrim(name)) between 1 and 120),
  role_title    text,
  wechat_handle text,
  phone         text,
  email         text check (email is null or email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  contact_basis text not null check (contact_basis in ('supplier_provided', 'operator_sourced', 'public_listing', 'referral')),
  consent_note  text,
  is_active     boolean not null default true,
  created_by    uuid,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  check (wechat_handle is not null or phone is not null or email is not null)
);
comment on table public.supplier_contacts is
  'RESTRICTED. Never joined into buyer-facing views, DTOs, exports or AI prompts; buyers read a contact only through contact_disclosure_grants.';
create index supplier_contacts_supplier_idx on public.supplier_contacts (supplier_id);

create table public.contact_disclosure_grants (
  id                  uuid primary key default gen_random_uuid(),
  supplier_contact_id uuid not null references public.supplier_contacts (id) on delete cascade,
  buyer_org_id        uuid not null references public.organizations (id) on delete cascade,
  granted_by          uuid not null default auth.uid(),
  reason              text not null check (length(btrim(reason)) >= 10),
  granted_at          timestamptz not null default now(),
  expires_at          timestamptz check (expires_at is null or expires_at > granted_at),
  revoked_at          timestamptz,
  revoked_by          uuid,
  revoke_reason       text,
  created_at          timestamptz not null default now(),
  check (revoked_at is null or revoked_by is not null)
);
create index contact_disclosure_grants_contact_idx on public.contact_disclosure_grants (supplier_contact_id);
create index contact_disclosure_grants_buyer_idx on public.contact_disclosure_grants (buyer_org_id);
-- at most one live (unrevoked) grant per (contact, buyer org); re-granting after revocation creates a new row
create unique index contact_disclosure_grants_one_live on public.contact_disclosure_grants (supplier_contact_id, buyer_org_id)
  where revoked_at is null;

create table public.source_systems (
  id           uuid primary key default gen_random_uuid(),
  code         text not null unique check (code ~ '^[a-z0-9_]+(\.[a-z0-9_]+)*$'),
  provider     text not null,
  source_type  public.source_type not null,
  capabilities jsonb not null default '{}'::jsonb check (jsonb_typeof(capabilities) = 'object'),
  status       text not null default 'blocked' check (status in ('blocked', 'manual', 'active')),
  terms_url    text,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
comment on table public.source_systems is
  'Integration/permission register (docs/INTEGRATIONS_AND_PERMISSIONS.md). status=blocked means no connector, import or automation may target this source; only a platform_admin may change it, and only after data-use rights are verified.';

create table public.source_permissions (
  id               uuid primary key default gen_random_uuid(),
  supplier_id      uuid references public.supplier_profiles (id) on delete cascade,
  org_id           uuid references public.organizations (id) on delete cascade,   -- denormalized = supplier org when supplier_id is set (trigger-set)
  source_system_id uuid references public.source_systems (id) on delete restrict,
  rights_class     public.rights_class not null,
  -- scope: {"fields": ["price_tiers", ...], "images": bool, "redistribute": bool, "benchmark": bool,
  --         "buyer_visibility": "internal_only" | "named_orgs" | "platform_buyers", "named_org_ids": [uuid, ...]}
  -- validated by app.validate_permission_scope(); keys outside this list are rejected.
  scope            jsonb not null default '{}'::jsonb,
  granted_at       timestamptz not null default now(),
  expires_at       timestamptz check (expires_at is null or expires_at > granted_at),
  revoked_at       timestamptz,
  revoked_by       uuid,
  revoke_reason    text,
  recorded_by      uuid not null default auth.uid(),
  notes            text,
  created_at       timestamptz not null default now(),
  check (supplier_id is not null or source_system_id is not null),
  check (revoked_at is null or revoked_by is not null)
  -- evidence_document_id uuid references public.documents(id): added in 0007 (cycle with documents.source_permission_id; see map §2)
);
create index source_permissions_supplier_idx on public.source_permissions (supplier_id);
create index source_permissions_source_idx on public.source_permissions (source_system_id);

create table public.research_leads (
  id                 uuid primary key default gen_random_uuid(),
  taxonomy_id        uuid not null references public.product_taxonomy (id) on delete restrict,
  source_system_id   uuid not null references public.source_systems (id) on delete restrict,
  rights_class       public.rights_class not null default 'internal_market_observation'
                     check (rights_class = 'internal_market_observation'),
  reference_url      text,
  search_term_zh     text,
  title_zh           text,
  observed_min_price numeric(18, 4) check (observed_min_price is null or observed_min_price >= 0),
  observed_max_price numeric(18, 4) check (observed_max_price is null or observed_max_price >= 0),
  currency           char(3) not null default 'CNY' check (currency ~ '^[A-Z]{3}$'),
  observed_moq       integer check (observed_moq is null or observed_moq > 0),
  observed_unit      text,
  observed_at        timestamptz not null default now(),
  notes              text,
  recorded_by        uuid not null default auth.uid(),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  check (observed_min_price is null or observed_max_price is null or observed_min_price <= observed_max_price)
);
comment on table public.research_leads is
  'Internal market observations recorded by hand (manual research only — never scraped). Indicative, never a binding offer; never shown to buyers as a price.';
create index research_leads_taxonomy_idx on public.research_leads (taxonomy_id);

-- ============================================================================
-- 2. Helpers (defined after the tables they read; SECURITY DEFINER; search_path = '')
-- ============================================================================

create or replace function app.supplier_org_of(p_supplier uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select s.org_id from public.supplier_profiles s where s.id = p_supplier;
$$;

-- A supplier is visible to a signed-in user when they belong to it, are internal staff, or the supplier has left the
-- lead stage (ADR-030: unconfirmed leads are internal working data, not a directory entry).
create or replace function app.supplier_visible(p_supplier uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.supplier_profiles s
     where s.id = p_supplier
       and (s.stage <> 'lead_identified' or app.is_member(s.org_id) or app.is_internal()));
$$;

-- Grant-evaluated catalog visibility (matrix §3.1). TRUE iff an unexpired, unrevoked catalog_public_with_permission grant
-- for the supplier covers the viewer org (platform_buyers, or named_orgs listing it) AND p_field is in scope.fields.
create or replace function app.catalog_grant_active(p_supplier uuid, p_viewer_org uuid, p_field text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.source_permissions p
     where p.supplier_id = p_supplier
       and p.rights_class = 'catalog_public_with_permission'
       and p.revoked_at is null
       and (p.expires_at is null or p.expires_at > now())
       and (   p.scope ->> 'buyer_visibility' = 'platform_buyers'
            or (p.scope ->> 'buyer_visibility' = 'named_orgs'
                and p.scope -> 'named_org_ids' ? p_viewer_org::text))
       and p.scope -> 'fields' ? p_field);
$$;

-- The contacts policy consults grants and the grants policy consults contacts; both go through these SECURITY DEFINER
-- helpers so neither policy re-enters the other (Postgres would otherwise raise "infinite recursion detected in policy").
create or replace function app.contact_disclosed_to_me(p_contact uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.contact_disclosure_grants g
     where g.supplier_contact_id = p_contact
       and g.revoked_at is null
       and (g.expires_at is null or g.expires_at > now())
       and app.is_member(g.buyer_org_id));
$$;

create or replace function app.contact_org_of(p_contact uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select c.org_id from public.supplier_contacts c where c.id = p_contact;
$$;

-- Deterministic scope validation (no AI, no defaults filled in silently).
create or replace function app.validate_permission_scope(p_scope jsonb)
returns void
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_key text;
  v_vis text;
  v_elem jsonb;
begin
  if p_scope is null or jsonb_typeof(p_scope) <> 'object' then
    raise exception 'scope must be a JSON object' using errcode = 'check_violation';
  end if;
  for v_key in select jsonb_object_keys(p_scope) loop
    if v_key not in ('fields', 'images', 'redistribute', 'benchmark', 'buyer_visibility', 'named_org_ids') then
      raise exception 'scope key "%" is not allowed', v_key using errcode = 'check_violation';
    end if;
  end loop;
  if p_scope ? 'fields' then
    if jsonb_typeof(p_scope -> 'fields') <> 'array' then
      raise exception 'scope.fields must be an array of strings' using errcode = 'check_violation';
    end if;
    for v_elem in select jsonb_array_elements(p_scope -> 'fields') loop
      if jsonb_typeof(v_elem) <> 'string' then
        raise exception 'scope.fields must be an array of strings' using errcode = 'check_violation';
      end if;
    end loop;
  end if;
  foreach v_key in array array['images', 'redistribute', 'benchmark'] loop
    if p_scope ? v_key and jsonb_typeof(p_scope -> v_key) <> 'boolean' then
      raise exception 'scope.% must be a boolean', v_key using errcode = 'check_violation';
    end if;
  end loop;
  v_vis := p_scope ->> 'buyer_visibility';
  if p_scope ? 'buyer_visibility' and v_vis not in ('internal_only', 'named_orgs', 'platform_buyers') then
    raise exception 'scope.buyer_visibility must be internal_only, named_orgs or platform_buyers' using errcode = 'check_violation';
  end if;
  if v_vis = 'named_orgs' then
    if coalesce(jsonb_typeof(p_scope -> 'named_org_ids'), 'missing') <> 'array'
       or jsonb_array_length(p_scope -> 'named_org_ids') = 0 then
      raise exception 'scope.named_org_ids must be a non-empty array of org ids when buyer_visibility = named_orgs' using errcode = 'check_violation';
    end if;
    for v_elem in select jsonb_array_elements(p_scope -> 'named_org_ids') loop
      if jsonb_typeof(v_elem) <> 'string' then
        raise exception 'scope.named_org_ids must contain uuid strings' using errcode = 'check_violation';
      end if;
      perform (v_elem #>> '{}')::uuid;   -- raises invalid_text_representation on a non-uuid
    end loop;
  elsif p_scope ? 'named_org_ids' then
    raise exception 'scope.named_org_ids is only allowed when buyer_visibility = named_orgs' using errcode = 'check_violation';
  end if;
end;
$$;

-- Trigger functions ---------------------------------------------------------

-- Trusted writer = service_role session (jobs, privileged RPCs) — same test as app.record_audit_event.
create or replace function app.is_trusted_writer()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(current_setting('role', true), '') = 'service_role'
      or coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role';
$$;

create or replace function app.supplier_profile_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_type public.org_type;
begin
  if tg_op = 'INSERT' then
    select o.org_type into v_type from public.organizations o where o.id = new.org_id;
    if v_type is distinct from 'supplier' then
      raise exception 'supplier_profiles.org_id must reference a supplier organization' using errcode = 'check_violation';
    end if;
    if new.created_by is null then new.created_by := auth.uid(); end if;
    -- A newly created profile is a claim: verification columns start at their defaults regardless of the caller.
    if not (app.is_internal() or app.is_trusted_writer()) then
      new.entity_kind_verified := false;
      new.stage := 'lead_identified';
    end if;
  else
    if (new.entity_kind_verified is distinct from old.entity_kind_verified or new.stage is distinct from old.stage)
       and not (app.is_internal() or app.is_trusted_writer()) then
      raise exception 'entity_kind_verified and stage are set by Factory Bridge staff only' using errcode = 'insufficient_privilege';
    end if;
    -- A verified entity kind is invalidated when the claim changes.
    if new.entity_kind is distinct from old.entity_kind and new.entity_kind_verified = old.entity_kind_verified then
      new.entity_kind_verified := false;
    end if;
  end if;
  return new;
end;
$$;

-- Children of supplier_profiles carry the supplier org id so policies and audit stay flat (Pattern B).
create or replace function app.supplier_child_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.org_id := app.supplier_org_of(new.supplier_id);
  if new.org_id is null then
    raise exception 'unknown supplier_id %', new.supplier_id using errcode = 'foreign_key_violation';
  end if;
  if tg_op = 'INSERT' and new.created_by is null then new.created_by := auth.uid(); end if;
  return new;
end;
$$;

-- Grants (disclosure + source permissions) are immutable except for revocation; revocation is one-way and stamps the actor.
create or replace function app.grant_before_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old jsonb := to_jsonb(old) - 'revoked_at' - 'revoked_by' - 'revoke_reason';
  v_new jsonb := to_jsonb(new) - 'revoked_at' - 'revoked_by' - 'revoke_reason';
begin
  if v_old <> v_new then
    raise exception '% rows are immutable except for revocation (revoked_at, revoked_by, revoke_reason)', tg_table_name
      using errcode = 'check_violation';
  end if;
  if old.revoked_at is not null and (new.revoked_at is distinct from old.revoked_at or new.revoked_by is distinct from old.revoked_by) then
    raise exception 'a revoked grant cannot be un-revoked or re-stamped' using errcode = 'check_violation';
  end if;
  if new.revoked_at is not null and old.revoked_at is null then
    new.revoked_at := now();
    new.revoked_by := coalesce(auth.uid(), new.revoked_by);
  end if;
  return new;
end;
$$;

create or replace function app.source_permission_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform app.validate_permission_scope(new.scope);
  if new.supplier_id is not null then
    new.org_id := app.supplier_org_of(new.supplier_id);
    if new.org_id is null then
      raise exception 'unknown supplier_id %', new.supplier_id using errcode = 'foreign_key_violation';
    end if;
  else
    new.org_id := null;
  end if;
  if new.rights_class = 'catalog_public_with_permission' and new.supplier_id is null then
    raise exception 'catalog_public_with_permission requires supplier_id' using errcode = 'check_violation';
  end if;
  if new.rights_class = 'internal_market_observation' and (new.scope ->> 'buyer_visibility') not in ('internal_only') then
    raise exception 'internal_market_observation is never buyer-visible' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

revoke execute on function
  app.supplier_org_of(uuid), app.supplier_visible(uuid), app.catalog_grant_active(uuid, uuid, text),
  app.contact_disclosed_to_me(uuid), app.contact_org_of(uuid),
  app.validate_permission_scope(jsonb), app.is_trusted_writer()
  from public, anon;
grant execute on function
  app.supplier_org_of(uuid), app.supplier_visible(uuid), app.catalog_grant_active(uuid, uuid, text),
  app.contact_disclosed_to_me(uuid), app.contact_org_of(uuid),
  app.validate_permission_scope(jsonb), app.is_trusted_writer()
  to authenticated, service_role;

-- ============================================================================
-- 3. Triggers
-- ============================================================================

create trigger supplier_profiles_set_updated_at before update on public.supplier_profiles
  for each row execute function app.set_updated_at();
create trigger supplier_profiles_validate before insert or update on public.supplier_profiles
  for each row execute function app.supplier_profile_before_write();
create trigger supplier_profiles_owner_guard before update on public.supplier_profiles
  for each row execute function app.prevent_owner_change('org_id');

create trigger supplier_facilities_set_updated_at before update on public.supplier_facilities
  for each row execute function app.set_updated_at();
create trigger supplier_facilities_denorm before insert or update on public.supplier_facilities
  for each row execute function app.supplier_child_before_write();
create trigger supplier_facilities_owner_guard before update on public.supplier_facilities
  for each row execute function app.prevent_owner_change('supplier_id', 'org_id');

create trigger supplier_contacts_set_updated_at before update on public.supplier_contacts
  for each row execute function app.set_updated_at();
create trigger supplier_contacts_denorm before insert or update on public.supplier_contacts
  for each row execute function app.supplier_child_before_write();
create trigger supplier_contacts_owner_guard before update on public.supplier_contacts
  for each row execute function app.prevent_owner_change('supplier_id', 'org_id');

create trigger contact_disclosure_grants_immutable before update on public.contact_disclosure_grants
  for each row execute function app.grant_before_update();
create trigger contact_disclosure_grants_owner_guard before update on public.contact_disclosure_grants
  for each row execute function app.prevent_owner_change('supplier_contact_id', 'buyer_org_id');

create trigger source_systems_set_updated_at before update on public.source_systems
  for each row execute function app.set_updated_at();

create trigger source_permissions_validate before insert or update on public.source_permissions
  for each row execute function app.source_permission_before_write();
create trigger source_permissions_immutable before update on public.source_permissions
  for each row execute function app.grant_before_update();

create trigger research_leads_set_updated_at before update on public.research_leads
  for each row execute function app.set_updated_at();

-- Audit (0003). Contacts are redacted: only changed column names are stored, never values.
create trigger supplier_profiles_audit after insert or update or delete on public.supplier_profiles
  for each row execute function app.audit_row_change('org_id');
create trigger supplier_facilities_audit after insert or update or delete on public.supplier_facilities
  for each row execute function app.audit_row_change('org_id');
create trigger supplier_contacts_audit after insert or update or delete on public.supplier_contacts
  for each row execute function app.audit_row_change('org_id', 'redact');
create trigger contact_disclosure_grants_audit after insert or update or delete on public.contact_disclosure_grants
  for each row execute function app.audit_row_change('buyer_org_id');
create trigger source_permissions_audit after insert or update or delete on public.source_permissions
  for each row execute function app.audit_row_change('org_id');
-- internal-only tables have no tenant org; entity_org_id is null and only compliance/platform_admin can read these events
create trigger source_systems_audit after insert or update or delete on public.source_systems
  for each row execute function app.audit_row_change('no_org');
create trigger research_leads_audit after insert or update or delete on public.research_leads
  for each row execute function app.audit_row_change('no_org');

-- ============================================================================
-- 4. Buyer-facing view (no contact columns, no internal notes)
-- ============================================================================

create view public.supplier_public_profile_v
with (security_invoker = true)
as
select s.id, s.org_id, s.legal_name_zh, s.legal_name_en, s.entity_kind, s.entity_kind_verified,
       s.province, s.city, s.website, s.stage, s.export_ready_claimed, s.intro_zh, s.intro_en, s.created_at
  from public.supplier_profiles s
 where s.stage <> 'lead_identified';
comment on view public.supplier_public_profile_v is
  'The ONLY supplier read path for buyer-facing code, exporters and AI prompt builders. security_invoker: the caller''s RLS on supplier_profiles applies.';

-- ============================================================================
-- 5. RLS
-- ============================================================================

alter table public.supplier_profiles         enable row level security;
alter table public.supplier_profiles         force row level security;
alter table public.supplier_facilities       enable row level security;
alter table public.supplier_facilities       force row level security;
alter table public.supplier_contacts         enable row level security;
alter table public.supplier_contacts         force row level security;
alter table public.contact_disclosure_grants enable row level security;
alter table public.contact_disclosure_grants force row level security;
alter table public.source_systems            enable row level security;
alter table public.source_systems            force row level security;
alter table public.source_permissions        enable row level security;
alter table public.source_permissions        force row level security;
alter table public.research_leads            enable row level security;
alter table public.research_leads            force row level security;

-- Supabase default privileges grant ALL to anon/authenticated/service_role on new tables: revoke first, grant back
-- only what a policy can allow. No DELETE for authenticated anywhere in this migration.
revoke all on public.supplier_profiles, public.supplier_facilities, public.supplier_contacts,
              public.contact_disclosure_grants, public.source_systems, public.source_permissions,
              public.research_leads, public.supplier_public_profile_v
  from public, anon, authenticated;
grant select, insert, update on public.supplier_profiles, public.supplier_facilities, public.supplier_contacts,
                                public.contact_disclosure_grants, public.source_permissions, public.research_leads
  to authenticated;
grant select, update on public.source_systems to authenticated;   -- rows are created by migrations; platform_admin edits status
grant select on public.supplier_public_profile_v to authenticated;
grant all on public.supplier_profiles, public.supplier_facilities, public.supplier_contacts,
             public.contact_disclosure_grants, public.source_systems, public.source_permissions,
             public.research_leads to service_role;
grant select on public.supplier_public_profile_v to service_role;

-- supplier_profiles: visible when the supplier is past lead stage, or to its own org / internal staff.
create policy supplier_profiles_select on public.supplier_profiles for select to authenticated
  using (stage <> 'lead_identified' or app.is_member(org_id) or app.is_internal());
create policy supplier_profiles_insert on public.supplier_profiles for insert to authenticated
  with check (app.has_role(org_id, array['owner', 'admin']::public.member_role[])
           or app.has_role(app.internal_org_id(), array['operator', 'platform_admin']::public.member_role[]));
create policy supplier_profiles_update on public.supplier_profiles for update to authenticated
  using (app.has_role(org_id, array['owner', 'admin']::public.member_role[])
      or app.has_role(app.internal_org_id(), array['operator', 'platform_admin']::public.member_role[]))
  with check (true);   -- org_id immutable (trigger); verified columns gated by trigger

-- supplier_facilities: follow the profile's visibility; written by the supplier org (owner/admin/member) and internal operators.
create policy supplier_facilities_select on public.supplier_facilities for select to authenticated
  using (app.supplier_visible(supplier_id));
create policy supplier_facilities_insert on public.supplier_facilities for insert to authenticated
  with check (app.has_role(app.supplier_org_of(supplier_id), array['owner', 'admin', 'member']::public.member_role[])
           or app.has_role(app.internal_org_id(), array['operator', 'platform_admin']::public.member_role[]));
create policy supplier_facilities_update on public.supplier_facilities for update to authenticated
  using (app.has_role(org_id, array['owner', 'admin', 'member']::public.member_role[])
      or app.has_role(app.internal_org_id(), array['operator', 'platform_admin']::public.member_role[]))
  with check (true);

-- supplier_contacts (Pattern D, restricted). 0008 replaces *_select/*_insert/*_update to add the assigned-operator clause
-- (ADR-031); until then unassigned operators — i.e. every operator — have no access, which is the intended strict default.
create policy supplier_contacts_select on public.supplier_contacts for select to authenticated
  using (app.is_platform_admin()
      or app.has_role(app.internal_org_id(), array['compliance_reviewer']::public.member_role[])
      or app.is_member(org_id)
      or app.contact_disclosed_to_me(id));
create policy supplier_contacts_insert on public.supplier_contacts for insert to authenticated
  with check (app.is_platform_admin());
create policy supplier_contacts_update on public.supplier_contacts for update to authenticated
  using (app.is_platform_admin() or app.has_role(org_id, array['owner', 'admin']::public.member_role[]))
  with check (true);

-- contact_disclosure_grants: buyers read grants to their org; the supplier org and internal staff read all for the supplier.
create policy contact_disclosure_grants_select on public.contact_disclosure_grants for select to authenticated
  using (app.is_member(buyer_org_id)
      or app.is_internal()
      or app.is_member(app.contact_org_of(supplier_contact_id)));
create policy contact_disclosure_grants_insert on public.contact_disclosure_grants for insert to authenticated
  with check (app.is_platform_admin() and granted_by = auth.uid());
create policy contact_disclosure_grants_update on public.contact_disclosure_grants for update to authenticated
  using (app.is_platform_admin())
  with check (true);   -- only revocation columns may change (trigger)

-- source_systems: internal read; platform_admin edits (status changes are permission decisions, audited).
create policy source_systems_select on public.source_systems for select to authenticated
  using (app.is_internal());
create policy source_systems_update on public.source_systems for update to authenticated
  using (app.is_platform_admin())
  with check (true);

-- source_permissions: internal read; supplier org reads its own; buyers read catalog grants that name their org
-- or are open to platform buyers. Recorded by internal operators/admins or by the supplier's owner/admin (self-grant
-- of their own catalog rights); revoked by the same (trigger restricts the update to revocation columns).
create policy source_permissions_select on public.source_permissions for select to authenticated
  using (app.is_internal()
      or (org_id is not null and app.is_member(org_id))
      or (rights_class = 'catalog_public_with_permission' and revoked_at is null
          and (scope ->> 'buyer_visibility' = 'platform_buyers'
               or exists (select 1 from public.memberships m
                           where m.user_id = auth.uid() and m.status = 'active'
                             and scope -> 'named_org_ids' ? m.org_id::text))));
create policy source_permissions_insert on public.source_permissions for insert to authenticated
  with check (recorded_by = auth.uid()
          and (app.has_role(app.internal_org_id(), array['operator', 'platform_admin']::public.member_role[])
               or (supplier_id is not null
                   and app.has_role(app.supplier_org_of(supplier_id), array['owner', 'admin']::public.member_role[]))));
create policy source_permissions_update on public.source_permissions for update to authenticated
  using (app.has_role(app.internal_org_id(), array['operator', 'platform_admin']::public.member_role[])
      or (org_id is not null and app.has_role(org_id, array['owner', 'admin']::public.member_role[])))
  with check (true);

-- research_leads (Pattern E): internal only.
create policy research_leads_select on public.research_leads for select to authenticated
  using (app.is_internal());
create policy research_leads_insert on public.research_leads for insert to authenticated
  with check (app.is_internal() and recorded_by = auth.uid());
create policy research_leads_update on public.research_leads for update to authenticated
  using (app.is_internal())
  with check (true);

-- ============================================================================
-- 6. Reference data: the source register (idempotent; re-running this block must change nothing)
-- ============================================================================
-- BEGIN REFERENCE DATA
insert into public.source_systems (code, provider, source_type, status, capabilities, notes) values
  ('manual_research',    'Factory Bridge operators',  'manual_research',  'manual',  '{"import":"typed_by_operator"}',
     'Operators search Chinese platforms by hand and type observations into research_leads. Observations are internal_market_observation only.'),
  ('operator_import',    'Factory Bridge operators',  'operator_import',  'active',  '{"import":"document_upload"}',
     'Documents an operator received directly from a factory (quote sheets, catalogs). Rights recorded per document in source_permissions.'),
  ('buyer_upload',       'Buyer organisations',       'buyer_upload',     'active',  '{"import":"document_upload"}',
     'Buyer-uploaded quotes/specs; rights_class buyer_uploaded_private.'),
  ('supplier_portal',    'Supplier organisations',    'supplier_portal',  'active',  '{"import":"portal_form"}',
     'Supplier-submitted catalog/quote data; publication to buyers requires a catalog_public_with_permission grant.'),
  ('marketplace.1688',   'Alibaba Group (1688.com)',  'marketplace_api',  'blocked', '{}',
     'No API agreement or data-use rights verified. No scraping, session simulation or plugins (CLAUDE.md §4; INTEGRATIONS_AND_PERMISSIONS.md).'),
  ('marketplace.taobao', 'Alibaba Group (Taobao)',    'marketplace_api',  'blocked', '{}',
     'No API agreement or data-use rights verified. No scraping, session simulation or plugins.'),
  ('marketplace.weidian','Weidian',                   'marketplace_api',  'blocked', '{}',
     'No API agreement or data-use rights verified. No scraping, session simulation or plugins.'),
  ('messaging.wechat',   'Tencent (WeChat)',          'supplier_api',     'blocked', '{}',
     'Direct factory communication stays in the operator''s own WeChat; no automation of private chats. Only hand-entered summaries enter the system.')
on conflict (code) do update set provider = excluded.provider, source_type = excluded.source_type,
  capabilities = excluded.capabilities, notes = excluded.notes;
-- NOTE: status is intentionally NOT overwritten on conflict — a platform_admin's decision in the register survives re-runs.
-- END REFERENCE DATA
