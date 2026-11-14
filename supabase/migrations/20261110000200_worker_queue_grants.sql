-- 0012b worker_queue_grants — Factory Bridge Global (B-11 code half; ADR-041; amends nothing in 0012, adds privileges only)
--
-- Why this migration exists (measured 2026-11-10 on the CI-pinned stack: Supabase CLI 3.1.0, image
-- supabase/postgres 17.11.0.018, pgmq 1.5.1):
--   * every pgmq function is SECURITY INVOKER and works on per-queue tables (`pgmq.q_<name>`, `pgmq.a_<name>`) and
--     sequences (`pgmq.q_<name>_msg_id_seq`) owned by `postgres`; only `pg_monitor` gets default SELECT on them;
--   * 0012 granted `service_role` USAGE on schema pgmq and nothing else, so as `service_role` (the role the worker
--     assumes with `set local role service_role`, M0 report §6) send / read / set_vt / archive / metrics /
--     list_queues all fail with "permission denied". The worker could not consume its own queues.
--
-- What it grants — the minimum those six functions need, on the four queues 0012 created and nothing else:
--   q_<queue>             SELECT, INSERT, UPDATE, DELETE  read() and set_vt() update vt/read_ct; send() inserts;
--                                                         archive() deletes from here
--   a_<queue>             SELECT, INSERT                  archive() inserts here (INSERT … RETURNING needs SELECT)
--   q_<queue>_msg_id_seq  USAGE, SELECT                   send() draws msg_id; metrics() reads last_value
--   pgmq.meta             SELECT                          list_queues(), metrics()
-- Not granted: TRUNCATE (purge_queue), UPDATE/DELETE on archives or meta, CREATE on the schema (create/drop_queue
-- stay migration-only). anon and authenticated still have no USAGE on schema pgmq, so they reach none of this.
--
-- Guarded like 0012: a no-op with a NOTICE where pgmq is not installed (PGlite); the suite asserts the grants on the
-- real stack (supabase/tests/queue-grants.test.ts). A future queue gets its grants in the migration that creates it.

do $$
declare
  v_queue text;
begin
  if not exists (select 1 from pg_extension where extname = 'pgmq') then
    raise notice 'pgmq not installed in this database: worker queue grants skipped (expected on PGlite)';
    return;
  end if;

  grant select on pgmq.meta to service_role;

  foreach v_queue in array array['fbg_documents', 'fbg_extraction', 'fbg_notifications', 'fbg_fx'] loop
    execute format('grant select, insert, update, delete on table pgmq.%I to service_role', 'q_' || v_queue);
    execute format('grant select, insert on table pgmq.%I to service_role', 'a_' || v_queue);
    execute format('grant usage, select on sequence pgmq.%I to service_role', 'q_' || v_queue || '_msg_id_seq');
  end loop;
end;
$$;
