-- 0009 quotations — Factory Bridge Global (MIGRATION_DEPENDENCY_MAP §2 row 0009, §5 tier exclusion, §6 immutability vs
-- lifecycle; SCHEMA_PLAN §2.6 + Pattern C; SECURITY_PERMISSION_MATRIX §3.1–3.5; ADR-021; QUOTE_ENGINE_SPEC)
--
-- What this migration establishes:
--   * quote_groups            one negotiation thread per (supplier, buyer org, brief item, quote type); versions live under it.
--   * quotations              the IMMUTABLE commercial payload of one version (BEFORE UPDATE OR DELETE raises). Every price
--                             record carries quote_type, price_basis (unknown ≠ EXW), currency, unit, moq, rights_class,
--                             source_type, document evidence, quote_date, confirmed_at/by, valid_until (NULL = validity
--                             unconfirmed, never perpetual) — CLAUDE.md §4.
--   * quote_tiers             [min, max) quantity bands; overlap impossible by EXCLUDE USING gist (btree_gist from 0001).
--   * quote_fees              one-time / per-unit fees declared with the quote.
--   * quotation_states        the mutable lifecycle, 1:1, written ONLY by app.transition_quotation / app.supersede_quotation
--                             (no INSERT/UPDATE grant to authenticated); exactly one current version per group.
--   * quote_status_events     append-only transition log with idempotency keys.
--   * quote_visibility_grants cross-org read grants attached to an exact quotation version; immutable except revocation.
--   * app.quotation_visible() the single read predicate (Pattern C). visibility_scope on the row is declared intent and is
--                             never consulted by reads.
--   * app.quote_transition_allowed(from, to, actor) mirrors packages/domain/src/quote/lifecycle.ts; a test keeps them equal.
--
-- Nothing here computes a total, converts a currency or ranks anything: that is the domain engine (deterministic TS) over
-- rows this migration keeps honest.

-- ============================================================================
-- 1. Tables
-- ============================================================================

create table public.quote_groups (
  id            uuid primary key default gen_random_uuid(),
  supplier_id   uuid not null references public.supplier_profiles (id) on delete restrict,
  buyer_org_id  uuid references public.organizations (id) on delete restrict,         -- null only for supplier_catalog / listing
  brief_item_id uuid references public.brief_items (id) on delete restrict,
  quote_type    public.quote_type not null,
  created_by    uuid,
  created_at    timestamptz not null default now(),
  check ((quote_type in ('supplier_catalog', 'listing')) = (buyer_org_id is null)),
  check (brief_item_id is null or buyer_org_id is not null)
);
create index quote_groups_supplier_idx on public.quote_groups (supplier_id);
create index quote_groups_buyer_idx on public.quote_groups (buyer_org_id) where buyer_org_id is not null;
create index quote_groups_brief_item_idx on public.quote_groups (brief_item_id) where brief_item_id is not null;

create table public.quotations (
  id                   uuid primary key default gen_random_uuid(),
  group_id             uuid not null references public.quote_groups (id) on delete restrict,
  version              integer not null check (version >= 1),
  supplier_id          uuid not null references public.supplier_profiles (id) on delete restrict,
  buyer_org_id         uuid references public.organizations (id) on delete restrict,
  brief_item_id        uuid references public.brief_items (id) on delete restrict,
  specification_id     uuid references public.product_specifications (id) on delete restrict,
  quote_type           public.quote_type not null,
  rights_class         public.rights_class not null,
  source_type          public.source_type not null,
  visibility_scope     public.visibility_scope not null default 'owning_org',   -- declared intent only (matrix §3.1)
  document_id          uuid references public.documents (id) on delete restrict,
  extraction_id        uuid,                                                    -- ai_extractions (0010), no FK yet
  price_basis          public.price_basis not null default 'unknown',
  incoterm_place       text,
  basis_confirmed      boolean not null default false,
  currency             char(3) not null check (currency ~ '^[A-Z]{3}$'),
  quantity_unit        text not null check (length(quantity_unit) between 1 and 16),
  moq                  numeric(18, 3) check (moq is null or moq > 0),
  production_lead_days integer check (production_lead_days is null or production_lead_days between 0 and 365),
  payment_terms        text,
  quote_date           date not null,
  valid_until          date,                                                    -- NULL = validity unconfirmed (flagged), never perpetual
  notes                text,
  confirmed_by         uuid not null,
  confirmed_at         timestamptz not null default now(),
  created_at           timestamptz not null default now(),
  unique (group_id, version),
  check (price_basis <> 'unknown' or basis_confirmed = false),
  check (valid_until is null or valid_until >= quote_date),
  check ((quote_type in ('supplier_catalog', 'listing')) = (buyer_org_id is null)),
  check (case quote_type
           when 'listing'            then rights_class = 'internal_market_observation'
           when 'supplier_catalog'   then rights_class in ('catalog_public_with_permission', 'supplier_submitted_private')
           when 'estimate'           then rights_class in ('internal_market_observation', 'customer_private_quote')
           else rights_class in ('customer_private_quote', 'buyer_uploaded_private', 'supplier_submitted_private') end),
  check (case
           when quote_type in ('listing', 'estimate') then visibility_scope in ('internal_only', 'owning_org')
           when quote_type = 'supplier_catalog'       then visibility_scope in ('owning_org', 'named_orgs', 'platform_buyers')
           else visibility_scope = 'owning_org' end)
);
comment on table public.quotations is
  'Immutable commercial payload of one quotation version (ADR-021). Lifecycle lives in quotation_states; a change is a new version via app.supersede_quotation. valid_until NULL means validity unconfirmed.';
create index quotations_group_idx on public.quotations (group_id, version desc);
create index quotations_buyer_idx on public.quotations (buyer_org_id) where buyer_org_id is not null;
create index quotations_supplier_idx on public.quotations (supplier_id);

create table public.quote_tiers (
  id             uuid primary key default gen_random_uuid(),
  quotation_id   uuid not null references public.quotations (id) on delete restrict,
  min_qty        numeric(18, 6) not null check (min_qty > 0),
  max_qty        numeric(18, 6) check (max_qty is null or max_qty > min_qty),
  unit_price     numeric(18, 6) not null check (unit_price >= 0),
  price_includes text[] not null default '{}',
  constraint quote_tiers_no_overlap exclude using gist (
    quotation_id with =,
    numrange(min_qty, coalesce(max_qty, 'infinity'::numeric), '[)') with &&
  )
);
create index quote_tiers_quotation_idx on public.quote_tiers (quotation_id, min_qty);

create table public.quote_fees (
  id                     uuid primary key default gen_random_uuid(),
  quotation_id           uuid not null references public.quotations (id) on delete restrict,
  fee_type               text not null check (fee_type in ('tooling', 'plate', 'sample', 'setup', 'packaging', 'inspection', 'other')),
  amount                 numeric(18, 6) not null check (amount >= 0),
  currency               char(3) not null check (currency ~ '^[A-Z]{3}$'),
  is_one_time            boolean not null default true,
  included_in_unit_price boolean not null default false,
  notes                  text
);
create index quote_fees_quotation_idx on public.quote_fees (quotation_id);

create table public.quotation_states (
  quotation_id  uuid primary key references public.quotations (id) on delete restrict,
  group_id      uuid not null references public.quote_groups (id) on delete restrict,
  status        public.quote_status not null,
  is_current    boolean not null default true,
  superseded_by uuid references public.quotations (id) on delete restrict,
  state_version integer not null default 1,
  updated_at    timestamptz not null default now(),
  check ((status = 'superseded') = (superseded_by is not null)),
  check (status <> 'superseded' or is_current = false)
);
create unique index quotation_states_one_current_per_group on public.quotation_states (group_id) where is_current;

create table public.quote_status_events (
  id              uuid primary key default gen_random_uuid(),
  quotation_id    uuid not null references public.quotations (id) on delete restrict,
  from_status     public.quote_status,
  to_status       public.quote_status not null,
  actor_user_id   uuid,
  acting_as       text not null check (acting_as in ('member', 'internal', 'platform_admin', 'system')),
  reason          text not null check (length(btrim(reason)) >= 3),
  idempotency_key text not null unique,
  at              timestamptz not null default now()
);
create index quote_status_events_quotation_idx on public.quote_status_events (quotation_id, at);

create table public.quote_visibility_grants (
  id             uuid primary key default gen_random_uuid(),
  quotation_id   uuid not null references public.quotations (id) on delete restrict,   -- an exact VERSION
  grantee_org_id uuid not null references public.organizations (id) on delete cascade,
  granted_by     uuid not null default auth.uid(),
  reason         text not null check (length(btrim(reason)) >= 10),
  granted_at     timestamptz not null default now(),
  expires_at     timestamptz check (expires_at is null or expires_at > granted_at),
  revoked_at     timestamptz,
  revoked_by     uuid,
  revoke_reason  text,
  created_at     timestamptz not null default now(),
  check (revoked_at is null or revoked_by is not null)
);
create unique index quote_visibility_grants_one_live on public.quote_visibility_grants (quotation_id, grantee_org_id) where revoked_at is null;
create index quote_visibility_grants_grantee_idx on public.quote_visibility_grants (grantee_org_id);

-- ============================================================================
-- 2. Helpers
-- ============================================================================

-- Assigned operator for a (buyer org, supplier) pair: the supplier is shortlisted on a project of that buyer org the caller
-- is assigned to (ADR-035). Used when a quotation has no brief item yet.
create or replace function app.operator_for_buyer_supplier(p_buyer_org uuid, p_supplier uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.project_suppliers ps
     where ps.org_id = p_buyer_org and ps.supplier_id = p_supplier and ps.status <> 'dropped'
       and app.is_assigned_to_project(ps.project_id));
$$;

-- Pattern C read predicate. visibility_scope is NOT consulted.
create or replace function app.quotation_visible(p_quotation uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.quotations q
     where q.id = p_quotation
       and (app.is_platform_admin()
            or (q.buyer_org_id is not null and app.is_member(q.buyer_org_id))
            or app.is_member(app.supplier_org_of(q.supplier_id))
            or (q.brief_item_id is not null and app.is_assigned_to_project(app.brief_item_project(q.brief_item_id)))
            or (q.buyer_org_id is not null and app.operator_for_buyer_supplier(q.buyer_org_id, q.supplier_id))
            or (q.quote_type in ('supplier_catalog', 'listing') and app.is_internal())
            or exists (select 1 from public.quote_visibility_grants g
                        where g.quotation_id = q.id and app.is_member(g.grantee_org_id)
                          and g.revoked_at is null and (g.expires_at is null or g.expires_at > now()))
            or (q.quote_type = 'supplier_catalog' and q.rights_class = 'catalog_public_with_permission'
                and exists (select 1 from public.memberships m
                             where m.user_id = auth.uid() and m.status = 'active'
                               and app.catalog_grant_active(q.supplier_id, m.org_id, 'price_tiers')))));
$$;

-- Who is the caller with respect to this quotation (for the transition table)? First match wins, strongest first.
create or replace function app.quote_actor_for(p_quotation uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when app.is_trusted_writer() and auth.uid() is null then 'system'
    when app.is_platform_admin() then 'platform_admin'
    when exists (select 1 from public.quotations q where q.id = p_quotation
                   and ((q.brief_item_id is not null and app.is_assigned_to_project(app.brief_item_project(q.brief_item_id)))
                        or (q.buyer_org_id is not null and app.operator_for_buyer_supplier(q.buyer_org_id, q.supplier_id))))
      then 'assigned_operator'
    when exists (select 1 from public.quotations q where q.id = p_quotation
                   and app.has_role(app.supplier_org_of(q.supplier_id), array['owner', 'admin']::public.member_role[]))
      then 'supplier_owner'
    when exists (select 1 from public.quotations q where q.id = p_quotation
                   and q.buyer_org_id is not null
                   and app.has_role(q.buyer_org_id, array['owner', 'admin', 'member']::public.member_role[]))
      then 'reviewer'
    else null end;
$$;

-- Transition table — mirrors packages/domain/src/quote/lifecycle.ts RULES exactly (tested).
-- Returns 'ok', 'terminal_state', 'invalid_transition', 'actor_not_permitted' or 'via_supersede_only'.
create or replace function app.quote_transition_allowed(p_from public.quote_status, p_to public.quote_status, p_actor text, p_via_supersede boolean default false)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_from in ('superseded', 'withdrawn') then 'terminal_state'
    when p_from = 'confirmed' and p_to = 'superseded' then
      case when p_actor not in ('reviewer', 'assigned_operator', 'platform_admin') then 'actor_not_permitted'
           when not p_via_supersede then 'via_supersede_only' else 'ok' end
    when p_from = 'confirmed' and p_to = 'expired' then
      case when p_actor in ('system', 'assigned_operator', 'platform_admin') then 'ok' else 'actor_not_permitted' end
    when p_from = 'confirmed' and p_to = 'withdrawn' then
      case when p_actor in ('assigned_operator', 'supplier_owner', 'platform_admin') then 'ok' else 'actor_not_permitted' end
    when p_from = 'expired' and p_to = 'superseded' then
      case when p_actor not in ('reviewer', 'assigned_operator', 'platform_admin') then 'actor_not_permitted'
           when not p_via_supersede then 'via_supersede_only' else 'ok' end
    else 'invalid_transition' end;
$$;

create or replace function app.quote_acting_as(p_actor text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_actor when 'system' then 'system' when 'platform_admin' then 'platform_admin'
                      when 'assigned_operator' then 'internal' else 'member' end;
$$;

-- ----------------------------------------------------------------------------
-- app.transition_quotation: expired / withdrawn only. Superseding goes through app.supersede_quotation.
-- ----------------------------------------------------------------------------
create or replace function app.transition_quotation(p_quotation uuid, p_to public.quote_status, p_reason text, p_idempotency_key text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_state  public.quotation_states%rowtype;
  v_actor  text;
  v_verdict text;
begin
  if p_idempotency_key is null or length(p_idempotency_key) < 8 then
    raise exception 'idempotency_key is required (>= 8 chars)' using errcode = 'check_violation';
  end if;
  if p_reason is null or length(btrim(p_reason)) < 3 then
    raise exception 'a reason is required' using errcode = 'check_violation';
  end if;
  if exists (select 1 from public.quote_status_events e where e.idempotency_key = p_idempotency_key) then
    return;   -- already applied
  end if;
  select * into v_state from public.quotation_states s where s.quotation_id = p_quotation for update;
  if v_state.quotation_id is null then
    raise exception 'quotation % does not exist', p_quotation using errcode = 'no_data_found';
  end if;
  perform 1 from public.quote_groups g where g.id = v_state.group_id for update;
  v_actor := app.quote_actor_for(p_quotation);
  if v_actor is null then
    raise exception 'not permitted to transition quotation %', p_quotation using errcode = 'insufficient_privilege';
  end if;
  v_verdict := app.quote_transition_allowed(v_state.status, p_to, v_actor, false);
  if v_verdict <> 'ok' then
    raise exception 'transition % -> % by % refused: %', v_state.status, p_to, v_actor, v_verdict using errcode = 'check_violation';
  end if;
  update public.quotation_states
     set status = p_to, state_version = state_version + 1, updated_at = now()
   where quotation_id = p_quotation;
  insert into public.quote_status_events (quotation_id, from_status, to_status, actor_user_id, acting_as, reason, idempotency_key)
  values (p_quotation, v_state.status, p_to, auth.uid(), app.quote_acting_as(v_actor), p_reason, p_idempotency_key);
  perform app.record_audit_event('quotation_states', p_quotation, 'transition',
            jsonb_build_object('status', v_state.status),
            jsonb_build_object('status', p_to, 'actor', v_actor, 'reason', p_reason),
            (select q.buyer_org_id from public.quotations q where q.id = p_quotation));
end;
$$;

-- ----------------------------------------------------------------------------
-- app.supersede_quotation: create version 1 (p_old = null, payload names the group) or a new version in the same group.
-- Payload keys (validated here; the web/worker layer validates with zod first):
--   group (p_old null only): supplier_id, buyer_org_id?, brief_item_id?, quote_type
--   quotation: specification_id?, rights_class, source_type, visibility_scope?, document_id?, extraction_id?, price_basis,
--              incoterm_place?, basis_confirmed?, currency, quantity_unit, moq?, production_lead_days?, payment_terms?,
--              quote_date, valid_until?, notes?
--   tiers: [{min_qty, max_qty?, unit_price, price_includes?}] (>= 1)      fees: [{fee_type, amount, currency?, is_one_time?, included_in_unit_price?, notes?}]
-- ----------------------------------------------------------------------------
create or replace function app.supersede_quotation(p_old uuid, p_new_payload jsonb, p_reason text, p_idempotency_key text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_group     public.quote_groups%rowtype;
  v_old_state public.quotation_states%rowtype;
  v_new_id    uuid;
  v_version   integer;
  v_actor     text;
  v_verdict   text;
  v_existing  uuid;
  v_doc       public.documents%rowtype;
  v_tier      jsonb;
  v_fee       jsonb;
  v_quote_type public.quote_type;
  v_supplier  uuid;
  v_buyer     uuid;
  v_brief_item uuid;
begin
  if p_idempotency_key is null or length(p_idempotency_key) < 8 then
    raise exception 'idempotency_key is required (>= 8 chars)' using errcode = 'check_violation';
  end if;
  if p_reason is null or length(btrim(p_reason)) < 3 then
    raise exception 'a reason is required' using errcode = 'check_violation';
  end if;
  if p_new_payload is null or jsonb_typeof(p_new_payload) <> 'object' then
    raise exception 'payload must be a JSON object' using errcode = 'check_violation';
  end if;
  select e.quotation_id into v_existing from public.quote_status_events e where e.idempotency_key = p_idempotency_key;
  if v_existing is not null then
    return v_existing;   -- already applied
  end if;
  if auth.uid() is null then
    raise exception 'a quotation is confirmed by a signed-in person, never by a job' using errcode = 'insufficient_privilege';
  end if;

  -- 1. resolve / create the group -------------------------------------------------------------------------
  if p_old is null then
    v_supplier   := (p_new_payload ->> 'supplier_id')::uuid;
    v_buyer      := (p_new_payload ->> 'buyer_org_id')::uuid;
    v_brief_item := (p_new_payload ->> 'brief_item_id')::uuid;
    v_quote_type := (p_new_payload ->> 'quote_type')::public.quote_type;
    if v_supplier is null or v_quote_type is null then
      raise exception 'payload.supplier_id and payload.quote_type are required for a new quotation' using errcode = 'check_violation';
    end if;
    if v_brief_item is not null and v_buyer is distinct from app.project_org(app.brief_item_project(v_brief_item)) then
      raise exception 'buyer_org_id must be the org that owns brief_item_id' using errcode = 'check_violation';
    end if;
    -- authorisation for a first version
    if not (app.is_platform_admin() or app.is_trusted_writer()
            or (v_buyer is not null and app.has_role(v_buyer, array['owner', 'admin', 'member']::public.member_role[]))
            or (v_brief_item is not null and app.is_assigned_to_project(app.brief_item_project(v_brief_item)))
            or (v_buyer is not null and app.operator_for_buyer_supplier(v_buyer, v_supplier))
            or (v_buyer is null and (app.has_role(app.supplier_org_of(v_supplier), array['owner', 'admin']::public.member_role[])
                                     or app.has_role(app.internal_org_id(), array['operator']::public.member_role[])))) then
      raise exception 'not permitted to create a quotation for this supplier / buyer' using errcode = 'insufficient_privilege';
    end if;
    v_actor := case
      when app.is_platform_admin() then 'platform_admin'
      when app.is_internal() then 'assigned_operator'
      when v_buyer is not null and app.is_member(v_buyer) then 'reviewer'
      else 'supplier_owner' end;
    -- reuse an existing group for the same thread (one group per supplier × buyer × brief item × type)
    select * into v_group from public.quote_groups g
     where g.supplier_id = v_supplier and g.quote_type = v_quote_type
       and g.buyer_org_id is not distinct from v_buyer and g.brief_item_id is not distinct from v_brief_item
     for update;
    if v_group.id is null then
      insert into public.quote_groups (supplier_id, buyer_org_id, brief_item_id, quote_type, created_by)
      values (v_supplier, v_buyer, v_brief_item, v_quote_type, auth.uid())
      returning * into v_group;
    elsif exists (select 1 from public.quotation_states s where s.group_id = v_group.id and s.is_current) then
      raise exception 'this quote thread already has a current version; pass it as p_old to supersede it' using errcode = 'check_violation';
    end if;
    v_version := 1;
  else
    select s.* into v_old_state from public.quotation_states s where s.quotation_id = p_old for update;
    if v_old_state.quotation_id is null then
      raise exception 'quotation % does not exist', p_old using errcode = 'no_data_found';
    end if;
    select * into v_group from public.quote_groups g where g.id = v_old_state.group_id for update;
    if not v_old_state.is_current then
      raise exception 'quotation % is not the current version of its thread', p_old using errcode = 'check_violation';
    end if;
    v_actor := app.quote_actor_for(p_old);
    if v_actor is null then
      raise exception 'not permitted to supersede quotation %', p_old using errcode = 'insufficient_privilege';
    end if;
    v_verdict := app.quote_transition_allowed(v_old_state.status, 'superseded', v_actor, true);
    if v_verdict <> 'ok' then
      raise exception 'transition % -> superseded by % refused: %', v_old_state.status, v_actor, v_verdict using errcode = 'check_violation';
    end if;
    select coalesce(max(q.version), 0) + 1 into v_version from public.quotations q where q.group_id = v_group.id;
  end if;

  -- 2. evidence document (if any) must belong to the thread --------------------------------------------------
  if p_new_payload ? 'document_id' and p_new_payload ->> 'document_id' is not null then
    select * into v_doc from public.documents d where d.id = (p_new_payload ->> 'document_id')::uuid;
    if v_doc.id is null then
      raise exception 'document_id does not exist' using errcode = 'foreign_key_violation';
    end if;
    if v_doc.status in ('rejected', 'discarded') then
      raise exception 'a rejected or discarded document cannot evidence a quotation' using errcode = 'check_violation';
    end if;
    if not (v_doc.org_id is not distinct from v_group.buyer_org_id or v_doc.supplier_id = v_group.supplier_id
            or v_doc.org_id = app.internal_org_id()) then
      raise exception 'document_id must belong to the buyer, the supplier or Factory Bridge' using errcode = 'check_violation';
    end if;
  end if;

  -- 3. tiers are required ---------------------------------------------------------------------------------
  if jsonb_typeof(p_new_payload -> 'tiers') <> 'array' or jsonb_array_length(p_new_payload -> 'tiers') = 0 then
    raise exception 'payload.tiers must be a non-empty array' using errcode = 'check_violation';
  end if;

  -- 4. insert the immutable payload (CHECKs + EXCLUDE do the rest) ------------------------------------------
  insert into public.quotations (
    group_id, version, supplier_id, buyer_org_id, brief_item_id, specification_id, quote_type, rights_class, source_type,
    visibility_scope, document_id, extraction_id, price_basis, incoterm_place, basis_confirmed, currency, quantity_unit, moq,
    production_lead_days, payment_terms, quote_date, valid_until, notes, confirmed_by)
  values (
    v_group.id, v_version, v_group.supplier_id, v_group.buyer_org_id, v_group.brief_item_id,
    (p_new_payload ->> 'specification_id')::uuid, v_group.quote_type,
    (p_new_payload ->> 'rights_class')::public.rights_class,
    (p_new_payload ->> 'source_type')::public.source_type,
    coalesce((p_new_payload ->> 'visibility_scope')::public.visibility_scope, 'owning_org'),
    (p_new_payload ->> 'document_id')::uuid,
    (p_new_payload ->> 'extraction_id')::uuid,
    coalesce((p_new_payload ->> 'price_basis')::public.price_basis, 'unknown'),
    p_new_payload ->> 'incoterm_place',
    coalesce((p_new_payload ->> 'basis_confirmed')::boolean, false),
    p_new_payload ->> 'currency',
    p_new_payload ->> 'quantity_unit',
    (p_new_payload ->> 'moq')::numeric,
    (p_new_payload ->> 'production_lead_days')::integer,
    p_new_payload ->> 'payment_terms',
    (p_new_payload ->> 'quote_date')::date,
    (p_new_payload ->> 'valid_until')::date,
    p_new_payload ->> 'notes',
    auth.uid())
  returning id into v_new_id;

  for v_tier in select * from jsonb_array_elements(p_new_payload -> 'tiers') loop
    insert into public.quote_tiers (quotation_id, min_qty, max_qty, unit_price, price_includes)
    values (v_new_id, (v_tier ->> 'min_qty')::numeric, (v_tier ->> 'max_qty')::numeric, (v_tier ->> 'unit_price')::numeric,
            coalesce((select array_agg(x #>> '{}') from jsonb_array_elements(v_tier -> 'price_includes') x), '{}'));
  end loop;
  if jsonb_typeof(p_new_payload -> 'fees') = 'array' then
    for v_fee in select * from jsonb_array_elements(p_new_payload -> 'fees') loop
      insert into public.quote_fees (quotation_id, fee_type, amount, currency, is_one_time, included_in_unit_price, notes)
      values (v_new_id, v_fee ->> 'fee_type', (v_fee ->> 'amount')::numeric,
              coalesce(v_fee ->> 'currency', p_new_payload ->> 'currency'),
              coalesce((v_fee ->> 'is_one_time')::boolean, true), coalesce((v_fee ->> 'included_in_unit_price')::boolean, false),
              v_fee ->> 'notes');
    end loop;
  end if;

  -- 5. lifecycle: old → superseded (keeps its history), new → confirmed + current ----------------------------
  if p_old is not null then
    update public.quotation_states
       set status = 'superseded', is_current = false, superseded_by = v_new_id, state_version = state_version + 1, updated_at = now()
     where quotation_id = p_old;
    insert into public.quote_status_events (quotation_id, from_status, to_status, actor_user_id, acting_as, reason, idempotency_key)
    values (p_old, v_old_state.status, 'superseded', auth.uid(), app.quote_acting_as(v_actor), p_reason, p_idempotency_key || ':old');
  end if;
  insert into public.quotation_states (quotation_id, group_id, status, is_current)
  values (v_new_id, v_group.id, 'confirmed', true);
  insert into public.quote_status_events (quotation_id, from_status, to_status, actor_user_id, acting_as, reason, idempotency_key)
  values (v_new_id, null, 'confirmed', auth.uid(), app.quote_acting_as(v_actor), p_reason, p_idempotency_key);
  perform app.record_audit_event('quotations', v_new_id, 'confirm', null,
            jsonb_build_object('group_id', v_group.id, 'version', v_version, 'supersedes', p_old, 'actor', v_actor, 'reason', p_reason),
            coalesce(v_group.buyer_org_id, app.supplier_org_of(v_group.supplier_id)));
  return v_new_id;
end;
$$;

-- Trigger functions ---------------------------------------------------------

create or replace function app.quotation_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'quotations are immutable; create a new version via app.supersede_quotation' using errcode = 'check_violation';
end;
$$;

revoke execute on function
  app.operator_for_buyer_supplier(uuid, uuid), app.quotation_visible(uuid), app.quote_actor_for(uuid),
  app.quote_transition_allowed(public.quote_status, public.quote_status, text, boolean), app.quote_acting_as(text),
  app.transition_quotation(uuid, public.quote_status, text, text), app.supersede_quotation(uuid, jsonb, text, text)
  from public, anon;
grant execute on function
  app.operator_for_buyer_supplier(uuid, uuid), app.quotation_visible(uuid), app.quote_actor_for(uuid),
  app.quote_transition_allowed(public.quote_status, public.quote_status, text, boolean), app.quote_acting_as(text),
  app.transition_quotation(uuid, public.quote_status, text, text), app.supersede_quotation(uuid, jsonb, text, text)
  to authenticated, service_role;

-- ============================================================================
-- 3. Triggers
-- ============================================================================

create trigger quotations_immutable before update or delete on public.quotations
  for each row execute function app.quotation_immutable();
create trigger quote_tiers_immutable before update or delete on public.quote_tiers
  for each row execute function app.quotation_immutable();
create trigger quote_fees_immutable before update or delete on public.quote_fees
  for each row execute function app.quotation_immutable();
create trigger quote_groups_owner_guard before update on public.quote_groups
  for each row execute function app.prevent_owner_change('supplier_id', 'buyer_org_id', 'brief_item_id', 'quote_type');
create trigger quotation_states_owner_guard before update on public.quotation_states
  for each row execute function app.prevent_owner_change('quotation_id', 'group_id');
create trigger quote_visibility_grants_immutable before update on public.quote_visibility_grants
  for each row execute function app.grant_before_update();
create trigger quote_visibility_grants_owner_guard before update on public.quote_visibility_grants
  for each row execute function app.prevent_owner_change('quotation_id', 'grantee_org_id');

create trigger quote_groups_audit after insert or update or delete on public.quote_groups
  for each row execute function app.audit_row_change('buyer_org_id');
create trigger quotations_audit after insert or update or delete on public.quotations
  for each row execute function app.audit_row_change('buyer_org_id');
create trigger quotation_states_audit after insert or update or delete on public.quotation_states
  for each row execute function app.audit_row_change('no_org');
create trigger quote_visibility_grants_audit after insert or update or delete on public.quote_visibility_grants
  for each row execute function app.audit_row_change('grantee_org_id');

-- ============================================================================
-- 4. RLS — reads via app.quotation_visible; writes only through the functions above
-- ============================================================================

alter table public.quote_groups            enable row level security;
alter table public.quote_groups            force row level security;
alter table public.quotations              enable row level security;
alter table public.quotations              force row level security;
alter table public.quote_tiers             enable row level security;
alter table public.quote_tiers             force row level security;
alter table public.quote_fees              enable row level security;
alter table public.quote_fees              force row level security;
alter table public.quotation_states        enable row level security;
alter table public.quotation_states        force row level security;
alter table public.quote_status_events     enable row level security;
alter table public.quote_status_events     force row level security;
alter table public.quote_visibility_grants enable row level security;
alter table public.quote_visibility_grants force row level security;

revoke all on public.quote_groups, public.quotations, public.quote_tiers, public.quote_fees, public.quotation_states,
              public.quote_status_events, public.quote_visibility_grants
  from public, anon, authenticated;
grant select on public.quote_groups, public.quotations, public.quote_tiers, public.quote_fees, public.quotation_states,
                public.quote_status_events to authenticated;
grant select, insert, update on public.quote_visibility_grants to authenticated;
grant all on public.quote_groups, public.quotations, public.quote_tiers, public.quote_fees, public.quotation_states,
             public.quote_status_events, public.quote_visibility_grants to service_role;

create policy quote_groups_select on public.quote_groups for select to authenticated
  using (exists (select 1 from public.quotations q where q.group_id = quote_groups.id and app.quotation_visible(q.id)));
create policy quotations_select on public.quotations for select to authenticated
  using (app.quotation_visible(id));
create policy quote_tiers_select on public.quote_tiers for select to authenticated
  using (app.quotation_visible(quotation_id));
create policy quote_fees_select on public.quote_fees for select to authenticated
  using (app.quotation_visible(quotation_id));
create policy quotation_states_select on public.quotation_states for select to authenticated
  using (app.quotation_visible(quotation_id));
create policy quote_status_events_select on public.quote_status_events for select to authenticated
  using (app.quotation_visible(quotation_id));

-- visibility grants: grantee reads its own; the quote's buyer org and internal staff read all; I.op+ / admin create;
-- immutable except revocation (trigger)
create policy quote_visibility_grants_select on public.quote_visibility_grants for select to authenticated
  using (app.is_member(grantee_org_id) or app.is_internal()
      or exists (select 1 from public.quotations q where q.id = quotation_id and q.buyer_org_id is not null and app.is_member(q.buyer_org_id)));
create policy quote_visibility_grants_insert on public.quote_visibility_grants for insert to authenticated
  with check (granted_by = auth.uid()
          and app.quote_actor_for(quotation_id) in ('assigned_operator', 'platform_admin'));
create policy quote_visibility_grants_update on public.quote_visibility_grants for update to authenticated
  using (app.quote_actor_for(quotation_id) in ('assigned_operator', 'platform_admin'))
  with check (true);
