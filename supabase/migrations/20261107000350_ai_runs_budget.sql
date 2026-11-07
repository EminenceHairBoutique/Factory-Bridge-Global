-- 0003b ai_runs_budget — Factory Bridge Global (B-16b; ADR-029; MIGRATION_DEPENDENCY_MAP §2 row 0003b)
-- `ai_runs` is pulled forward from the planned 0010 ai_review: it depends only on organizations (0002)
-- and the security-event writer (0003). `ai_extractions`, `review_tasks`, `human_corrections` still
-- land in 0010 and will reference ai_runs(id).
--
-- Invariants:
--   * ai_runs is append-only. Rows are written ONLY by app.record_ai_run() from the worker (service_role);
--     `authenticated` has no INSERT/UPDATE/DELETE; nobody has UPDATE/DELETE (like audit_events).
--   * Cost is stored as an integer number of nano-USD exactly as the adapter computed it; `cost_usd`
--     is a generated read-only view of the same number. No money arithmetic happens in SQL floats.
--   * The monthly budget check is a deterministic SQL sum over this UTC month. A race between two
--     concurrent jobs can overshoot the cap by at most one call; the cap is a spend guard, not a ledger lock.
--   * Refusals and safety signals become security_events rows inside the same transaction as the run.

-- ============================================================================
-- 1. security_events: new kinds for AI spend and safety signals
-- ============================================================================

alter table public.security_events drop constraint security_events_kind_check;
alter table public.security_events add constraint security_events_kind_check
  check (kind in ('rls_denied', 'rate_limited', 'scan_rejected', 'webhook_sig_fail', 'injection_flag',
                  'auth_anomaly', 'privileged_access', 'ai_budget_exceeded', 'ai_canary_leak'));

-- ============================================================================
-- 2. Tables
-- ============================================================================

create table public.ai_budgets (
  org_id               uuid primary key references public.organizations (id) on delete cascade,
  monthly_cap_nano_usd bigint not null check (monthly_cap_nano_usd >= 0),      -- 0 = AI disabled for the org
  alert_threshold_pct  smallint not null default 80 check (alert_threshold_pct between 1 and 100),
  note                 text check (note is null or char_length(note) <= 300),
  updated_by           uuid,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
comment on table public.ai_budgets is 'Per-organization monthly AI spend cap (nano-USD). Absent row → platform default passed by the worker. Set only via app.set_ai_budget (platform admin), audited.';

create table public.ai_runs (
  id                          uuid primary key default gen_random_uuid(),
  org_id                      uuid not null references public.organizations (id) on delete cascade,
  at                          timestamptz not null default now(),
  purpose                     text not null check (purpose in ('extract', 'translate', 'normalize', 'match', 'draft', 'flag')),
  provider                    text not null check (char_length(provider) between 1 and 40),
  model                       text not null check (char_length(model) between 1 and 80),
  prompt_template_id          text not null check (char_length(prompt_template_id) between 1 and 64),
  prompt_version              text not null check (char_length(prompt_version) between 1 and 128),   -- sha256 of the template file (AiResult.promptHash)
  input_hash                  text check (input_hash is null or char_length(input_hash) = 64),       -- sha256 of the untrusted input
  status                      text not null check (status in ('ok', 'schema_invalid', 'provider_error', 'budget_exceeded', 'canary_leak', 'budget_refused')),
  error                       text check (error is null or char_length(error) <= 2000),
  input_tokens                integer not null default 0 check (input_tokens >= 0),
  output_tokens               integer not null default 0 check (output_tokens >= 0),
  cache_read_input_tokens     integer not null default 0 check (cache_read_input_tokens >= 0),
  cache_creation_input_tokens integer not null default 0 check (cache_creation_input_tokens >= 0),
  cost_nano_usd               bigint not null default 0 check (cost_nano_usd >= 0),
  cost_usd                    numeric(12,6) generated always as ((cost_nano_usd::numeric / 1000000000)::numeric(12,6)) stored,
  latency_ms                  integer not null default 0 check (latency_ms >= 0),
  attempts                    smallint not null default 0 check (attempts between 0 and 2),
  flags                       text[] not null default '{}'::text[],
  triggered_by                uuid,                                   -- auth.users(id); not an FK so the ledger outlives the user
  job_id                      text check (job_id is null or char_length(job_id) <= 120),  -- idempotency key from the queue
  request_id                  text check (request_id is null or char_length(request_id) <= 120)
);
comment on table public.ai_runs is 'Append-only ledger of every AI call (ADR-007, AI_EVALUATION_PLAN §2). Written only via app.record_ai_run (service_role). status budget_refused = refused by the org monthly budget before any call; budget_exceeded = per-call cap inside the adapter.';
create unique index ai_runs_org_job_idx on public.ai_runs (org_id, job_id) where job_id is not null;
create index ai_runs_org_at_idx on public.ai_runs (org_id, at desc);
create index ai_runs_status_at_idx on public.ai_runs (status, at desc);

-- ============================================================================
-- 3. Triggers (ai_budgets is the only mutable table here)
-- ============================================================================

create trigger ai_budgets_set_updated_at before update on public.ai_budgets
  for each row execute function app.set_updated_at();
create trigger ai_budgets_owner_guard before update on public.ai_budgets
  for each row execute function app.prevent_owner_change('org_id');
create trigger ai_budgets_audit after insert or update or delete on public.ai_budgets
  for each row execute function app.audit_row_change('org_id');

-- ============================================================================
-- 4. Functions
-- ============================================================================

-- Start of the current UTC month; budgets are monthly in UTC regardless of the org's timezone.
create or replace function app.ai_month_start()
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select (date_trunc('month', (now() at time zone 'utc')) at time zone 'utc');
$$;

-- True when the session is the worker (service_role), mirroring app.record_audit_event's override check.
create or replace function app.is_service_role()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(current_setting('role', true), '') = 'service_role'
      or coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role';
$$;

-- Budget position of an org for the current UTC month. The platform default cap is passed by the caller
-- (worker env AI_MONTHLY_BUDGET_USD_DEFAULT) so one knob governs every org without a row.
-- Callable by the worker (service_role) and by the org's owner/admin or platform admin.
create or replace function app.ai_budget_status(p_org uuid, p_default_cap_nano_usd bigint)
returns table (
  cap_nano_usd       bigint,
  spent_nano_usd     bigint,
  remaining_nano_usd bigint,
  month_start        timestamptz,
  exceeded           boolean,
  alert              boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_cap   bigint;
  v_pct   smallint;
  v_spent bigint;
begin
  if p_default_cap_nano_usd is null or p_default_cap_nano_usd < 0 then
    raise exception 'default cap must be a non-negative integer' using errcode = 'invalid_parameter_value';
  end if;
  if not app.is_service_role()
     and not (app.has_role(p_org, array['owner', 'admin']::public.member_role[]) or app.is_platform_admin()) then
    raise exception 'not authorized to read the AI budget of organization %', p_org using errcode = 'insufficient_privilege';
  end if;
  select b.monthly_cap_nano_usd, b.alert_threshold_pct into v_cap, v_pct
    from public.ai_budgets b where b.org_id = p_org;
  v_cap := coalesce(v_cap, p_default_cap_nano_usd);
  v_pct := coalesce(v_pct, 80);
  select coalesce(sum(r.cost_nano_usd), 0)::bigint into v_spent
    from public.ai_runs r
   where r.org_id = p_org and r.at >= app.ai_month_start();
  return query select
    v_cap,
    v_spent,
    greatest(v_cap - v_spent, 0)::bigint,
    app.ai_month_start(),
    v_spent >= v_cap,
    v_spent * 100 >= v_cap * v_pct;
end;
$$;

-- The only way to write an ai_runs row. Worker (service_role) only. Idempotent on (org_id, job_id).
-- Emits security_events in the same transaction for refusals and safety signals.
create or replace function app.record_ai_run(
  p_org                 uuid,
  p_purpose             text,
  p_provider            text,
  p_model               text,
  p_prompt_template_id  text,
  p_prompt_version      text,
  p_status              text,
  p_input_tokens        integer,
  p_output_tokens       integer,
  p_cache_read_tokens   integer,
  p_cache_create_tokens integer,
  p_cost_nano_usd       bigint,
  p_latency_ms          integer,
  p_attempts            smallint,
  p_flags               text[],
  p_error               text default null,
  p_input_hash          text default null,
  p_triggered_by        uuid default null,
  p_job_id              text default null,
  p_request_id          text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not app.is_service_role() then
    raise exception 'ai_runs are written only by the worker (service_role)' using errcode = 'insufficient_privilege';
  end if;
  insert into public.ai_runs
    (org_id, purpose, provider, model, prompt_template_id, prompt_version, status, error,
     input_tokens, output_tokens, cache_read_input_tokens, cache_creation_input_tokens,
     cost_nano_usd, latency_ms, attempts, flags, input_hash, triggered_by, job_id, request_id)
  values
    (p_org, p_purpose, p_provider, p_model, p_prompt_template_id, p_prompt_version, p_status, left(p_error, 2000),
     p_input_tokens, p_output_tokens, p_cache_read_tokens, p_cache_create_tokens,
     p_cost_nano_usd, p_latency_ms, p_attempts, coalesce(p_flags, '{}'::text[]), p_input_hash, p_triggered_by, p_job_id, p_request_id)
  on conflict (org_id, job_id) where job_id is not null do nothing
  returning id into v_id;
  if v_id is null then
    -- replay of an already-recorded job: return the existing row, record nothing twice
    select r.id into v_id from public.ai_runs r where r.org_id = p_org and r.job_id = p_job_id;
    return v_id;
  end if;
  if p_status = 'budget_refused' then
    perform app.record_security_event('ai_budget_exceeded', p_org,
      jsonb_build_object('ai_run_id', v_id, 'purpose', p_purpose, 'job_id', p_job_id));
  elsif p_status = 'canary_leak' then
    perform app.record_security_event('ai_canary_leak', p_org,
      jsonb_build_object('ai_run_id', v_id, 'purpose', p_purpose, 'model', p_model, 'prompt_version', p_prompt_version));
  end if;
  if 'embedded_instruction_detected' = any (coalesce(p_flags, '{}'::text[])) then
    perform app.record_security_event('injection_flag', p_org,
      jsonb_build_object('ai_run_id', v_id, 'purpose', p_purpose, 'prompt_version', p_prompt_version));
  end if;
  return v_id;
end;
$$;

-- Platform admin (or the worker) sets/replaces an org's monthly cap. Audited through the row trigger.
create or replace function app.set_ai_budget(
  p_org          uuid,
  p_cap_nano_usd bigint,
  p_alert_pct    smallint default 80,
  p_note         text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (app.is_service_role() or app.is_platform_admin()) then
    raise exception 'only a platform admin may set AI budgets' using errcode = 'insufficient_privilege';
  end if;
  insert into public.ai_budgets (org_id, monthly_cap_nano_usd, alert_threshold_pct, note, updated_by)
  values (p_org, p_cap_nano_usd, coalesce(p_alert_pct, 80), p_note, auth.uid())
  on conflict (org_id) do update
    set monthly_cap_nano_usd = excluded.monthly_cap_nano_usd,
        alert_threshold_pct  = excluded.alert_threshold_pct,
        note                 = excluded.note,
        updated_by           = excluded.updated_by;
end;
$$;

revoke execute on function
  app.ai_month_start(),
  app.is_service_role(),
  app.ai_budget_status(uuid, bigint),
  app.record_ai_run(uuid, text, text, text, text, text, text, integer, integer, integer, integer, bigint, integer, smallint, text[], text, text, uuid, text, text),
  app.set_ai_budget(uuid, bigint, smallint, text)
  from public, anon;
grant execute on function
  app.ai_month_start(),
  app.is_service_role(),
  app.ai_budget_status(uuid, bigint),
  app.set_ai_budget(uuid, bigint, smallint, text)
  to authenticated, service_role;
-- record_ai_run: worker only (the function re-checks the role; the grant keeps authenticated from even calling it).
grant execute on function
  app.record_ai_run(uuid, text, text, text, text, text, text, integer, integer, integer, integer, bigint, integer, smallint, text[], text, text, uuid, text, text)
  to service_role;

-- ============================================================================
-- 5. Privileges and RLS (SECURITY_PERMISSION_MATRIX §2 rows ai_runs / ai_budgets)
-- ============================================================================

alter table public.ai_runs    enable row level security;
alter table public.ai_runs    force row level security;
alter table public.ai_budgets enable row level security;
alter table public.ai_budgets force row level security;

revoke all on public.ai_runs, public.ai_budgets from public, anon, authenticated, service_role;
grant select on public.ai_runs, public.ai_budgets to authenticated;
grant select, insert on public.ai_runs to service_role;                 -- append-only: no UPDATE/DELETE for anyone
grant select, insert, update on public.ai_budgets to service_role;      -- no DELETE: a cap is replaced, never silently removed

-- ai_runs: spend transparency for the org's owner/admin; oversight for compliance and platform admin.
-- Unassigned internal operators see nothing (there is no project assignment yet to scope them by).
create policy ai_runs_select on public.ai_runs for select to authenticated
  using (
       app.has_role(org_id, array['owner', 'admin']::public.member_role[])
    or app.is_platform_admin()
    or app.has_role(app.internal_org_id(), array['compliance_reviewer']::public.member_role[])
  );

create policy ai_budgets_select on public.ai_budgets for select to authenticated
  using (app.has_role(org_id, array['owner', 'admin']::public.member_role[]) or app.is_platform_admin());
