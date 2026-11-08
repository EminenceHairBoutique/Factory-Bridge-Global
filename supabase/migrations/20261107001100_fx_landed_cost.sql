-- 0011 fx_landed_cost — Factory Bridge Global (MIGRATION_DEPENDENCY_MAP §2 row 0011; SCHEMA_PLAN §2.7; QUOTE_ENGINE_SPEC
-- §2.5–2.7; matrix rows "Comparison snapshots / landed-cost scenarios" and "FX rates"; ADR-010)
--
-- What this migration establishes:
--   * fx_rates                 reference rates as rows (base, quote, rate, rate_date, source); unique per day and source;
--                              written by the worker (service_role) or a platform admin, readable by every signed-in user.
--                              app.fx_rate_for() applies QUOTE_ENGINE_SPEC §2.5 deterministically: the rate on as_of, else the
--                              latest prior one within 3 days, else NULL (= `missing_fx`, never a silent fallback).
--   * freight_estimates        per project; `sourced` only with a document; otherwise `estimated` / `missing`.
--   * duty_assumptions         per project (optionally per brief item); recorded by a PERSON with an explicit basis —
--                              a job or an AI run cannot insert one (trigger), per the "AI never fills duties" rule.
--   * comparison_snapshots     IMMUTABLE record of one engine run for one brief item: quantity, as_of, inputs_hash,
--                              engine_version, the exact fx_rate_ids used, the result. Every fx id must exist.
--   * landed_cost_scenarios    IMMUTABLE per-quotation lines of a snapshot; validated: known line types, statuses from
--                              cost_line_status, `complete` ⇔ no required line is `missing`, `partial` ⇒ no landed total,
--                              never rankable. The quotation must be visible to the writer.
--
-- The arithmetic itself lives in packages/domain (deterministic TS). This migration makes a stored result unable to
-- claim more than its inputs support.

-- ============================================================================
-- 1. Tables
-- ============================================================================

create table public.fx_rates (
  id           uuid primary key default gen_random_uuid(),
  base         char(3) not null check (base ~ '^[A-Z]{3}$'),
  quote        char(3) not null check (quote ~ '^[A-Z]{3}$'),
  rate         numeric(18, 8) not null check (rate > 0),
  rate_date    date not null,
  source       text not null check (length(source) between 2 and 64),
  is_reference boolean not null default true,     -- ECB-style reference rate, not a transaction rate (ADR-010)
  fetched_at   timestamptz not null default now(),
  recorded_by  uuid,                              -- null for the worker; a platform admin when entered by hand
  unique (base, quote, rate_date, source),
  check (base <> quote)
);
comment on table public.fx_rates is
  'Reference FX rates by day and source. Append-only; a correction is a new row under its own source. Reports cite rate, source and date (ADR-010).';
create index fx_rates_lookup_idx on public.fx_rates (base, quote, rate_date desc);

create table public.freight_estimates (
  id                 uuid primary key default gen_random_uuid(),
  project_id         uuid not null references public.sourcing_projects (id) on delete cascade,
  org_id             uuid not null references public.organizations (id) on delete cascade,   -- = project's buyer org (trigger)
  origin             text not null check (length(origin) between 2 and 120),
  destination        text not null check (length(destination) between 2 and 120),
  mode               text not null check (mode in ('sea_lcl', 'sea_fcl', 'air', 'express', 'rail', 'truck')),
  provider_or_manual text not null check (provider_or_manual in ('provider', 'manual')),
  provider_name      text,
  amount             numeric(18, 2) not null check (amount >= 0),
  currency           char(3) not null check (currency ~ '^[A-Z]{3}$'),
  valid_until        date,
  document_id        uuid references public.documents (id) on delete restrict,
  status             public.cost_line_status not null default 'estimated',
  notes              text,
  created_by         uuid,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  check (status <> 'sourced' or document_id is not null),          -- "sourced" means a real quote document is attached
  check (status <> 'not_applicable'),
  check (provider_or_manual <> 'provider' or provider_name is not null)
);
create index freight_estimates_project_idx on public.freight_estimates (project_id);

create table public.duty_assumptions (
  id                 uuid primary key default gen_random_uuid(),
  project_id         uuid not null references public.sourcing_projects (id) on delete cascade,
  org_id             uuid not null references public.organizations (id) on delete cascade,   -- = project's buyer org (trigger)
  brief_item_id      uuid references public.brief_items (id) on delete cascade,
  hts_candidate      text check (hts_candidate is null or hts_candidate ~ '^[0-9]{4}\.[0-9]{2}\.[0-9]{2}([0-9]{2})?$'),
  rate_pct           numeric(7, 4) check (rate_pct is null or (rate_pct >= 0 and rate_pct <= 100)),
  basis              text not null check (basis in ('buyer_provided', 'broker_advice', 'operator_lookup', 'unverified')),
  reviewed_by_broker boolean not null default false,
  broker_name        text,
  mpf_applies        boolean,
  hmf_applies        boolean,
  notes              text,
  created_by         uuid not null,                                -- always a person (trigger)
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  check (rate_pct is null or basis <> 'unverified'),               -- a number needs a basis
  check (not reviewed_by_broker or broker_name is not null)
);
comment on table public.duty_assumptions is
  'Duty/HTS assumptions recorded by a person with an explicit basis. Never auto-filled by AI or a job (trigger). An HTS candidate is a candidate until a broker reviews it.';
create index duty_assumptions_project_idx on public.duty_assumptions (project_id);

create table public.comparison_snapshots (
  id             uuid primary key default gen_random_uuid(),
  brief_item_id  uuid not null references public.brief_items (id) on delete restrict,
  project_id     uuid not null references public.sourcing_projects (id) on delete restrict,   -- = brief item's project (trigger)
  org_id         uuid not null references public.organizations (id) on delete restrict,       -- = buyer org (trigger)
  quantity       numeric(18, 3) not null check (quantity > 0),
  quantity_unit  text not null check (length(quantity_unit) between 1 and 16),
  as_of          date not null,
  inputs_hash    text not null check (inputs_hash ~ '^[0-9a-f]{64}$'),
  engine_version text not null check (length(engine_version) between 1 and 40),
  fx_rate_ids    uuid[] not null default '{}',
  result         jsonb not null check (jsonb_typeof(result) = 'object'),
  generated_by   uuid,
  generated_at   timestamptz not null default now()
);
comment on table public.comparison_snapshots is
  'Immutable record of one comparison run: exact quotation versions (via scenarios) and exact fx_rate rows. A later transition or rate never alters it.';
create index comparison_snapshots_item_idx on public.comparison_snapshots (brief_item_id, generated_at desc);

create table public.landed_cost_scenarios (
  id                     uuid primary key default gen_random_uuid(),
  comparison_snapshot_id uuid not null references public.comparison_snapshots (id) on delete cascade,
  org_id                 uuid not null references public.organizations (id) on delete restrict,   -- = snapshot's org (trigger)
  quotation_id           uuid not null references public.quotations (id) on delete restrict,
  lines                  jsonb not null,
  total_status           text not null check (total_status in ('complete', 'partial')),
  goods_total            numeric(18, 6) check (goods_total is null or goods_total >= 0),
  goods_currency         char(3) check (goods_currency is null or goods_currency ~ '^[A-Z]{3}$'),
  landed_total           numeric(18, 2) check (landed_total is null or landed_total >= 0),
  landed_currency        char(3) check (landed_currency is null or landed_currency ~ '^[A-Z]{3}$'),
  eligible_for_ranking   boolean not null default false,
  explanations           text[] not null default '{}',
  created_at             timestamptz not null default now(),
  unique (comparison_snapshot_id, quotation_id),
  check ((total_status = 'complete') = (landed_total is not null)),     -- partial totals are never stored as a number
  check ((landed_total is null) = (landed_currency is null)),
  check (not eligible_for_ranking or total_status = 'complete')
);
comment on table public.landed_cost_scenarios is
  'Per-quotation landed-cost lines of a snapshot (QUOTE_ENGINE_SPEC §2.6). partial ⇒ no landed_total and never ranked; the UI renders "Partial — excludes: …" from the missing lines.';

-- ============================================================================
-- 2. Helpers
-- ============================================================================

-- QUOTE_ENGINE_SPEC §2.5: the rate dated as_of, else the latest earlier rate within p_max_lag days, else NULL (missing_fx).
create or replace function app.fx_rate_for(p_base text, p_quote text, p_as_of date, p_max_lag integer default 3)
returns uuid
language sql
stable
set search_path = ''
as $$
  select r.id
    from public.fx_rates r
   where r.base = p_base and r.quote = p_quote
     and r.rate_date <= p_as_of and r.rate_date >= p_as_of - p_max_lag
   order by r.rate_date desc, r.fetched_at desc
   limit 1;
$$;

-- Trigger functions ---------------------------------------------------------

create or replace function app.fx_rate_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not app.is_trusted_writer() then
    new.recorded_by := auth.uid();
    if new.recorded_by is null then
      raise exception 'fx_rates are written by the FX job or a platform admin' using errcode = 'insufficient_privilege';
    end if;
  end if;
  return new;
end;
$$;

create or replace function app.immutable_row()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception '% rows are immutable; generate a new one', tg_table_name using errcode = 'check_violation';
end;
$$;

create or replace function app.duty_assumption_before_write()
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
  if new.brief_item_id is not null and app.brief_item_project(new.brief_item_id) is distinct from new.project_id then
    raise exception 'brief_item_id must belong to project_id' using errcode = 'check_violation';
  end if;
  if tg_op = 'INSERT' then
    if auth.uid() is null then
      raise exception 'duty assumptions are recorded by a person, never by a job or an AI run' using errcode = 'insufficient_privilege';
    end if;
    new.created_by := auth.uid();
  end if;
  return new;
end;
$$;

create or replace function app.freight_estimate_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_doc public.documents%rowtype;
begin
  new.org_id := app.project_org(new.project_id);
  if new.org_id is null then
    raise exception 'unknown project_id %', new.project_id using errcode = 'foreign_key_violation';
  end if;
  if tg_op = 'INSERT' and new.created_by is null then new.created_by := auth.uid(); end if;
  if new.document_id is not null then
    select * into v_doc from public.documents d where d.id = new.document_id;
    if v_doc.id is null or v_doc.status in ('rejected', 'discarded')
       or not (v_doc.org_id = new.org_id or v_doc.org_id = app.internal_org_id()) then
      raise exception 'document_id must be a usable document of the buyer org or Factory Bridge' using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

create or replace function app.comparison_snapshot_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  new.project_id := app.brief_item_project(new.brief_item_id);
  if new.project_id is null then
    raise exception 'unknown brief_item_id %', new.brief_item_id using errcode = 'foreign_key_violation';
  end if;
  new.org_id := app.project_org(new.project_id);
  if new.generated_by is null then new.generated_by := auth.uid(); end if;
  foreach v_id in array new.fx_rate_ids loop
    if not exists (select 1 from public.fx_rates r where r.id = v_id) then
      raise exception 'fx_rate_ids contains an unknown rate %', v_id using errcode = 'foreign_key_violation';
    end if;
  end loop;
  return new;
end;
$$;

-- Line validation (QUOTE_ENGINE_SPEC §2.6): known types, statuses from cost_line_status, non-negative amounts with a
-- currency, and complete ⇔ nothing required is missing.
create or replace function app.landed_cost_scenario_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_line   jsonb;
  v_type   text;
  v_status text;
  v_missing integer := 0;
begin
  select s.org_id into new.org_id from public.comparison_snapshots s where s.id = new.comparison_snapshot_id;
  if new.org_id is null then
    raise exception 'unknown comparison_snapshot_id %', new.comparison_snapshot_id using errcode = 'foreign_key_violation';
  end if;
  if not (app.quotation_visible(new.quotation_id) or app.is_trusted_writer()) then
    raise exception 'quotation % is not visible to the writer', new.quotation_id using errcode = 'insufficient_privilege';
  end if;
  if jsonb_typeof(new.lines) <> 'array' or jsonb_array_length(new.lines) = 0 then
    raise exception 'lines must be a non-empty array' using errcode = 'check_violation';
  end if;
  for v_line in select * from jsonb_array_elements(new.lines) loop
    v_type := v_line ->> 'type';
    v_status := v_line ->> 'status';
    if v_type not in ('goods', 'tooling', 'sample', 'packaging_extra', 'inland_origin', 'export_clearance_origin_handling',
                      'international_freight', 'insurance', 'duties_taxes', 'brokerage', 'destination_handling_delivery') then
      raise exception 'unknown landed-cost line type "%"', v_type using errcode = 'check_violation';
    end if;
    if v_status is null or v_status not in ('sourced', 'estimated', 'missing', 'not_applicable') then
      raise exception 'line % has an invalid status "%"', v_type, v_status using errcode = 'check_violation';
    end if;
    if v_status in ('sourced', 'estimated') then
      if coalesce(jsonb_typeof(v_line -> 'amount'), 'missing') <> 'number' or (v_line ->> 'amount')::numeric < 0 then
        raise exception 'line % (%) needs a non-negative amount', v_type, v_status using errcode = 'check_violation';
      end if;
      if coalesce(v_line ->> 'currency', '') !~ '^[A-Z]{3}$' then
        raise exception 'line % needs an ISO-4217 currency', v_type using errcode = 'check_violation';
      end if;
    end if;
    if v_status = 'missing' then v_missing := v_missing + 1; end if;
  end loop;
  if not exists (select 1 from jsonb_array_elements(new.lines) l where l ->> 'type' = 'goods') then
    raise exception 'a scenario always carries a goods line' using errcode = 'check_violation';
  end if;
  if new.total_status = 'complete' and v_missing > 0 then
    raise exception 'total_status cannot be complete while % line(s) are missing', v_missing using errcode = 'check_violation';
  end if;
  if new.total_status = 'partial' and v_missing = 0 then
    raise exception 'total_status partial requires at least one missing line' using errcode = 'check_violation';
  end if;
  new.eligible_for_ranking := (new.total_status = 'complete');
  return new;
end;
$$;

revoke execute on function app.fx_rate_for(text, text, date, integer) from public, anon;
grant execute on function app.fx_rate_for(text, text, date, integer) to authenticated, service_role;

-- ============================================================================
-- 3. Triggers
-- ============================================================================

create trigger fx_rates_before_insert before insert on public.fx_rates
  for each row execute function app.fx_rate_before_insert();
create trigger fx_rates_immutable before update or delete on public.fx_rates
  for each row execute function app.immutable_row();

create trigger freight_estimates_set_updated_at before update on public.freight_estimates
  for each row execute function app.set_updated_at();
create trigger freight_estimates_validate before insert or update on public.freight_estimates
  for each row execute function app.freight_estimate_before_write();
create trigger freight_estimates_owner_guard before update on public.freight_estimates
  for each row execute function app.prevent_owner_change('project_id', 'org_id');

create trigger duty_assumptions_set_updated_at before update on public.duty_assumptions
  for each row execute function app.set_updated_at();
create trigger duty_assumptions_validate before insert or update on public.duty_assumptions
  for each row execute function app.duty_assumption_before_write();
create trigger duty_assumptions_owner_guard before update on public.duty_assumptions
  for each row execute function app.prevent_owner_change('project_id', 'org_id', 'brief_item_id', 'created_by');

create trigger comparison_snapshots_before_insert before insert on public.comparison_snapshots
  for each row execute function app.comparison_snapshot_before_insert();
create trigger comparison_snapshots_immutable before update or delete on public.comparison_snapshots
  for each row execute function app.immutable_row();

create trigger landed_cost_scenarios_before_insert before insert on public.landed_cost_scenarios
  for each row execute function app.landed_cost_scenario_before_insert();
create trigger landed_cost_scenarios_immutable before update or delete on public.landed_cost_scenarios
  for each row execute function app.immutable_row();

create trigger fx_rates_audit after insert on public.fx_rates
  for each row execute function app.audit_row_change('no_org');
create trigger freight_estimates_audit after insert or update or delete on public.freight_estimates
  for each row execute function app.audit_row_change('org_id');
create trigger duty_assumptions_audit after insert or update or delete on public.duty_assumptions
  for each row execute function app.audit_row_change('org_id');
create trigger comparison_snapshots_audit after insert on public.comparison_snapshots
  for each row execute function app.audit_row_change('org_id');

-- ============================================================================
-- 4. RLS
-- ============================================================================

alter table public.fx_rates              enable row level security;
alter table public.fx_rates              force row level security;
alter table public.freight_estimates     enable row level security;
alter table public.freight_estimates     force row level security;
alter table public.duty_assumptions      enable row level security;
alter table public.duty_assumptions      force row level security;
alter table public.comparison_snapshots  enable row level security;
alter table public.comparison_snapshots  force row level security;
alter table public.landed_cost_scenarios enable row level security;
alter table public.landed_cost_scenarios force row level security;

revoke all on public.fx_rates, public.freight_estimates, public.duty_assumptions, public.comparison_snapshots,
              public.landed_cost_scenarios
  from public, anon, authenticated;
grant select, insert on public.fx_rates to authenticated;                       -- insert reachable by platform_admin only (policy)
grant select, insert, update on public.freight_estimates, public.duty_assumptions to authenticated;
grant select, insert on public.comparison_snapshots, public.landed_cost_scenarios to authenticated;   -- immutable
grant all on public.fx_rates, public.freight_estimates, public.duty_assumptions, public.comparison_snapshots,
             public.landed_cost_scenarios to service_role;

create policy fx_rates_select on public.fx_rates for select to authenticated using (true);
create policy fx_rates_insert on public.fx_rates for insert to authenticated with check (app.is_platform_admin());

-- Pattern B via project: buyer org (owner/admin/member write, viewer read), assigned operators write, platform admin reads
create policy freight_estimates_select on public.freight_estimates for select to authenticated
  using (app.is_member(org_id) or app.is_assigned_to_project(project_id));
create policy freight_estimates_insert on public.freight_estimates for insert to authenticated
  with check (app.has_role(app.project_org(project_id), array['owner', 'admin', 'member']::public.member_role[])
           or app.is_assigned_to_project(project_id));
create policy freight_estimates_update on public.freight_estimates for update to authenticated
  using (app.has_role(org_id, array['owner', 'admin', 'member']::public.member_role[]) or app.is_assigned_to_project(project_id))
  with check (true);

create policy duty_assumptions_select on public.duty_assumptions for select to authenticated
  using (app.is_member(org_id) or app.is_assigned_to_project(project_id));
create policy duty_assumptions_insert on public.duty_assumptions for insert to authenticated
  with check (app.has_role(app.project_org(project_id), array['owner', 'admin', 'member']::public.member_role[])
           or app.is_assigned_to_project(project_id));
create policy duty_assumptions_update on public.duty_assumptions for update to authenticated
  using (app.has_role(org_id, array['owner', 'admin', 'member']::public.member_role[]) or app.is_assigned_to_project(project_id))
  with check (true);

create policy comparison_snapshots_select on public.comparison_snapshots for select to authenticated
  using (app.is_member(org_id) or app.is_assigned_to_project(project_id));
create policy comparison_snapshots_insert on public.comparison_snapshots for insert to authenticated
  with check (app.has_role(app.project_org(app.brief_item_project(brief_item_id)), array['owner', 'admin', 'member']::public.member_role[])
           or app.is_assigned_to_project(app.brief_item_project(brief_item_id)));

create policy landed_cost_scenarios_select on public.landed_cost_scenarios for select to authenticated
  using (exists (select 1 from public.comparison_snapshots s
                  where s.id = comparison_snapshot_id
                    and (app.is_member(s.org_id) or app.is_assigned_to_project(s.project_id))));
create policy landed_cost_scenarios_insert on public.landed_cost_scenarios for insert to authenticated
  with check (exists (select 1 from public.comparison_snapshots s
                       where s.id = comparison_snapshot_id
                         and (app.has_role(s.org_id, array['owner', 'admin', 'member']::public.member_role[])
                              or app.is_assigned_to_project(s.project_id))));
