-- 0012 jobs_notifications — Factory Bridge Global (MIGRATION_DEPENDENCY_MAP §2 row 0012; SCHEMA_PLAN §2.10; ADR-006
-- (pgmq + separate worker, proposed → host still a founder gate); B-11 / B-25)
--
-- What this migration establishes:
--   * pgmq queues + pg_cron schedules — created ONLY where the extensions are available (Supabase local/hosted). On
--     PGlite the guarded blocks are skipped and the suite asserts that explicitly; on CI (real Supabase) the suite
--     asserts the queues and schedules exist. Nothing here is a silent fallback.
--   * job_executions      the worker's idempotency ledger: one row per (queue, idempotency_key); a duplicate delivery
--                         is a unique violation, never a second run. Worker-only; platform admins may read.
--   * jobs_dead_letter    poison messages after N attempts, with error and attempts; platform admins resolve
--                         (resolution columns only — trigger). Internal read.
--   * notifications       per-user rows (user_id, org_id, kind, payload, dedupe_key); a user reads their own and may
--                         set read_at — nothing else (trigger). Written only by the worker or app.notify().
--   * app.notify()        the one writer of notifications (SECURITY DEFINER; not callable by authenticated).
--   * app.expire_quotations()           the daily sweep: every current `confirmed` quotation with valid_until < today →
--                                       app.transition_quotation(..., 'expired', ...) as `system`, idempotent key
--                                       'expire:<id>:<date>', then notifies the buyer org's owners/admins.
--   * app.notify_expiring_quotations(n) reminders for quotations expiring within n days, deduped per quotation×user.
--
-- NULL valid_until never expires automatically (validity unconfirmed is a flag, not a date).

-- ============================================================================
-- 1. Tables
-- ============================================================================

create table public.job_executions (
  id              uuid primary key default gen_random_uuid(),
  queue           text not null check (queue ~ '^[a-z0-9_]+$'),
  idempotency_key text not null check (length(idempotency_key) between 8 and 200),
  msg_id          bigint,
  payload_hash    text check (payload_hash is null or payload_hash ~ '^[0-9a-f]{64}$'),
  status          text not null default 'running' check (status in ('running', 'succeeded', 'failed')),
  attempts        integer not null default 1 check (attempts >= 1),
  worker_id       text,
  started_at      timestamptz not null default now(),
  finished_at     timestamptz,
  error           text,
  unique (queue, idempotency_key),
  check ((status = 'running') = (finished_at is null))
);
comment on table public.job_executions is
  'Worker idempotency ledger (B-11): a message is processed once per (queue, idempotency_key). Written by the worker only.';
create index job_executions_queue_idx on public.job_executions (queue, started_at desc);

create table public.jobs_dead_letter (
  id              uuid primary key default gen_random_uuid(),
  queue           text not null check (queue ~ '^[a-z0-9_]+$'),
  msg_id          bigint,
  idempotency_key text,
  message         jsonb not null,
  error           text not null,
  attempts        integer not null check (attempts >= 1),
  first_failed_at timestamptz not null default now(),
  last_failed_at  timestamptz not null default now(),
  resolved_at     timestamptz,
  resolved_by     uuid,
  resolution      text check (resolution is null or resolution in ('requeued', 'discarded', 'fixed_manually')),
  created_at      timestamptz not null default now(),
  check ((resolved_at is null) = (resolution is null)),
  check (resolved_at is null or resolved_by is not null)
);
create index jobs_dead_letter_open_idx on public.jobs_dead_letter (queue, first_failed_at) where resolved_at is null;

create table public.notifications (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null,
  org_id        uuid references public.organizations (id) on delete cascade,
  kind          text not null check (kind in (
                  'quote_expiring', 'quote_expired', 'review_ready', 'document_rejected', 'document_parsed',
                  'assignment_added', 'compliance_hold', 'grant_received', 'generic')),
  payload       jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  dedupe_key    text,
  delivered_via text[] not null default '{in_app}',
  email_sent_at timestamptz,
  created_at    timestamptz not null default now(),
  read_at       timestamptz
);
create index notifications_user_idx on public.notifications (user_id, created_at desc) where read_at is null;
create unique index notifications_dedupe on public.notifications (dedupe_key) where dedupe_key is not null;

-- ============================================================================
-- 2. Functions
-- ============================================================================

-- The one writer of notifications. Not granted to authenticated: called by the worker (service_role) or by
-- SECURITY DEFINER functions below. Returns the row id, or NULL when dedupe_key already exists.
create or replace function app.notify(p_user uuid, p_org uuid, p_kind text, p_payload jsonb default '{}'::jsonb, p_dedupe_key text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into public.notifications (user_id, org_id, kind, payload, dedupe_key)
  values (p_user, p_org, p_kind, coalesce(p_payload, '{}'::jsonb), p_dedupe_key)
  on conflict (dedupe_key) where dedupe_key is not null do nothing
  returning id into v_id;
  return v_id;
end;
$$;

-- Daily sweep (pg_cron or the worker). Runs as the function owner; marks itself as the trusted system actor for the
-- duration of the transaction so app.transition_quotation records acting_as = 'system' (ADR-036 §4).
create or replace function app.expire_quotations()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  v_count integer := 0;
  m record;
begin
  perform set_config('request.jwt.claim.role', 'service_role', true);
  for r in
    select q.id, q.buyer_org_id, q.supplier_id, q.group_id, q.version, q.valid_until
      from public.quotation_states s
      join public.quotations q on q.id = s.quotation_id
     where s.is_current and s.status = 'confirmed'
       and q.valid_until is not null and q.valid_until < current_date
     order by q.valid_until
  loop
    perform app.transition_quotation(r.id, 'expired', 'valid_until passed', 'expire:' || r.id || ':' || current_date);
    v_count := v_count + 1;
    if r.buyer_org_id is not null then
      for m in select user_id from public.memberships
                where org_id = r.buyer_org_id and status = 'active' and role in ('owner', 'admin') loop
        perform app.notify(m.user_id, r.buyer_org_id, 'quote_expired',
                           jsonb_build_object('quotation_id', r.id, 'group_id', r.group_id, 'version', r.version,
                                              'valid_until', r.valid_until),
                           'quote_expired:' || r.id || ':' || m.user_id);
      end loop;
    end if;
  end loop;
  return v_count;
end;
$$;

-- Reminders for current confirmed quotations expiring within p_days (default 7); one per quotation × user.
create or replace function app.notify_expiring_quotations(p_days integer default 7)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  m record;
  v_count integer := 0;
begin
  for r in
    select q.id, q.buyer_org_id, q.group_id, q.version, q.valid_until
      from public.quotation_states s
      join public.quotations q on q.id = s.quotation_id
     where s.is_current and s.status = 'confirmed'
       and q.buyer_org_id is not null
       and q.valid_until is not null
       and q.valid_until >= current_date and q.valid_until <= current_date + p_days
  loop
    for m in select user_id from public.memberships
              where org_id = r.buyer_org_id and status = 'active' and role in ('owner', 'admin', 'member') loop
      if app.notify(m.user_id, r.buyer_org_id, 'quote_expiring',
                    jsonb_build_object('quotation_id', r.id, 'group_id', r.group_id, 'version', r.version,
                                       'valid_until', r.valid_until, 'days_left', r.valid_until - current_date),
                    'quote_expiring:' || r.id || ':' || m.user_id) is not null then
        v_count := v_count + 1;
      end if;
    end loop;
  end loop;
  return v_count;
end;
$$;

-- Trigger functions ---------------------------------------------------------

-- A user may only set/clear read_at on their own notification.
create or replace function app.notification_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not app.is_trusted_writer()
     and (to_jsonb(old) - 'read_at') <> (to_jsonb(new) - 'read_at') then
    raise exception 'notifications: only read_at may be changed by the recipient' using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

-- A dead letter is resolved, not edited.
create or replace function app.dead_letter_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not app.is_trusted_writer() then
    if (to_jsonb(old) - 'resolved_at' - 'resolved_by' - 'resolution') <> (to_jsonb(new) - 'resolved_at' - 'resolved_by' - 'resolution') then
      raise exception 'jobs_dead_letter: only resolution columns may be changed' using errcode = 'insufficient_privilege';
    end if;
    if new.resolved_at is not null and old.resolved_at is null then
      new.resolved_by := auth.uid();
    end if;
  end if;
  return new;
end;
$$;

revoke execute on function
  app.notify(uuid, uuid, text, jsonb, text), app.expire_quotations(), app.notify_expiring_quotations(integer)
  from public, anon, authenticated;
grant execute on function
  app.notify(uuid, uuid, text, jsonb, text), app.expire_quotations(), app.notify_expiring_quotations(integer)
  to service_role;

-- ============================================================================
-- 3. Triggers
-- ============================================================================

create trigger notifications_before_update before update on public.notifications
  for each row execute function app.notification_before_update();
create trigger jobs_dead_letter_before_update before update on public.jobs_dead_letter
  for each row execute function app.dead_letter_before_update();
create trigger jobs_dead_letter_audit after insert or update on public.jobs_dead_letter
  for each row execute function app.audit_row_change('no_org');

-- ============================================================================
-- 4. RLS
-- ============================================================================

alter table public.job_executions   enable row level security;
alter table public.job_executions   force row level security;
alter table public.jobs_dead_letter enable row level security;
alter table public.jobs_dead_letter force row level security;
alter table public.notifications    enable row level security;
alter table public.notifications    force row level security;

revoke all on public.job_executions, public.jobs_dead_letter, public.notifications from public, anon, authenticated;
grant select on public.job_executions to authenticated;                 -- platform admins (policy)
grant select, update on public.jobs_dead_letter to authenticated;       -- internal read; platform admins resolve
grant select, update on public.notifications to authenticated;          -- own rows; read_at only (trigger)
grant all on public.job_executions, public.jobs_dead_letter, public.notifications to service_role;

create policy job_executions_select on public.job_executions for select to authenticated
  using (app.is_platform_admin());

create policy jobs_dead_letter_select on public.jobs_dead_letter for select to authenticated
  using (app.is_internal());
create policy jobs_dead_letter_update on public.jobs_dead_letter for update to authenticated
  using (app.is_platform_admin())
  with check (true);

create policy notifications_select on public.notifications for select to authenticated
  using (user_id = auth.uid());
create policy notifications_update on public.notifications for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ============================================================================
-- 5. Queues and schedules — only where the extensions exist (Supabase); skipped on PGlite, asserted by tests
-- ============================================================================

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pgmq') then
    create extension if not exists pgmq;
    perform pgmq.create('fbg_documents');     -- scan + parse (B-11/B-12)
    perform pgmq.create('fbg_extraction');    -- AI extraction runs (B-18)
    perform pgmq.create('fbg_notifications'); -- email fan-out
    perform pgmq.create('fbg_fx');            -- daily FX fetch (ADR-010)
    -- the worker is the only consumer/producer; signed-in users never touch queues directly
    revoke all on schema pgmq from public, anon, authenticated;
    grant usage on schema pgmq to service_role;
  else
    raise notice 'pgmq not available in this database: queues not created (expected on PGlite)';
  end if;

  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.unschedule(jobid) from cron.job where jobname in ('fbg_expire_quotations', 'fbg_notify_expiring_quotations');
    perform cron.schedule('fbg_expire_quotations', '15 6 * * *', $cron$select app.expire_quotations()$cron$);
    perform cron.schedule('fbg_notify_expiring_quotations', '30 6 * * *', $cron$select app.notify_expiring_quotations(7)$cron$);
  else
    raise notice 'pg_cron not available in this database: sweeps not scheduled (expected on PGlite)';
  end if;
end;
$$;
