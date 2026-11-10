/**
 * Database access for the migration/RLS test suites.
 *
 * Two engines:
 *  - DATABASE_URL set  → real PostgreSQL (CI runs the local Supabase stack: `supabase start && supabase db reset`).
 *    Migrations are expected to be already applied by the CLI; the suite VERIFIES them.
 *  - DATABASE_URL unset → PGlite (Postgres compiled to WASM, in-process). Dev-time SQL checks only.
 *    Supabase-provided objects (auth schema, roles) are shimmed to the minimum the migrations need.
 *    THIS IS NOT a Supabase integration test and is reported as `engine: pglite` in test names.
 */
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export type Row = Record<string, unknown>;

export interface Db {
  readonly engine: "pglite" | "postgres";
  exec(sql: string): Promise<void>;
  query<T extends Row = Row>(sql: string, params?: unknown[]): Promise<T[]>;
  close(): Promise<void>;
}

const migrationsDir = fileURLToPath(new URL("../migrations/", import.meta.url));
const seedPath = fileURLToPath(new URL("../seed.sql", import.meta.url));

export function listMigrations(): { version: string; name: string; path: string; sql: string }[] {
  return readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => {
      const m = /^(\d{14})_(.+)\.sql$/.exec(f);
      if (!m)
        throw new Error(`Migration file does not follow <14-digit timestamp>_<name>.sql: ${f}`);
      return {
        version: m[1]!,
        name: m[2]!,
        path: migrationsDir + f,
        sql: readFileSync(migrationsDir + f, "utf8"),
      };
    });
}

export function readSeed(): string {
  return readFileSync(seedPath, "utf8");
}

/** Minimal stand-ins for objects the Supabase platform provides. Applied to PGlite only. */
const SUPABASE_SHIM = `
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;
create schema if not exists auth;
-- Supabase's auth.users has many more columns; tests only need id + email.
create table if not exists auth.users (
  id uuid primary key,
  email text,
  created_at timestamptz default now()
);
-- Supabase Auth's sessions table (subset): migration 0013's memberships_revoke_sessions trigger deletes a member's
-- rows here on a role/status change (ADR-041 §5). Deleting a row cascades to refresh tokens on the real stack.
create table if not exists auth.sessions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz default now()
);
-- Mirrors Supabase's auth.uid(): sub claim from the request JWT settings.
create or replace function auth.uid() returns uuid
language sql stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;
-- Supabase sets DEFAULT PRIVILEGES in schema public that grant ALL on every new table, function and
-- sequence to anon, authenticated and service_role. Reproducing them here means a migration that
-- forgets to revoke fails on PGlite exactly as it fails on real Postgres.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;
-- Supabase Storage (storage-api) owns schema storage. The columns below are the subset migration 0006 touches
-- (bucket limits + the objects policies key on bucket_id and name). Supabase grants ALL on these tables to the
-- three API roles and enables RLS on both, so nothing is readable until a policy says so.
create schema if not exists storage;
create table if not exists storage.buckets (
  id                 text primary key,
  name               text not null unique,
  owner              uuid,
  public             boolean not null default false,
  file_size_limit    bigint,
  allowed_mime_types text[],
  created_at         timestamptz default now(),
  updated_at         timestamptz default now()
);
create table if not exists storage.objects (
  id               uuid primary key default gen_random_uuid(),
  bucket_id        text references storage.buckets (id),
  name             text,
  owner            uuid,
  owner_id         text,
  metadata         jsonb,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now(),
  last_accessed_at timestamptz default now(),
  unique (bucket_id, name)
);
create or replace function storage.foldername(name text) returns text[]
language plpgsql immutable as $$
declare _parts text[];
begin
  _parts := string_to_array(name, '/');
  return _parts[1 : array_length(_parts, 1) - 1];
end $$;
create or replace function storage.filename(name text) returns text
language plpgsql immutable as $$
declare _parts text[];
begin
  _parts := string_to_array(name, '/');
  return _parts[array_length(_parts, 1)];
end $$;
-- storage-api forbids direct deletes on its tables (storage.protect_delete, errcode 42501) unless the Storage API's own
-- GUC is set; mirrored here so a test that deletes from storage.objects fails on PGlite the way it fails on Supabase.
create or replace function storage.protect_delete() returns trigger
language plpgsql as $$
begin
  if current_setting('storage.allow_delete_query', true) is distinct from 'true' then
    raise exception 'Direct deletion from storage tables is not allowed. Use the Storage API instead.'
      using hint = 'This prevents accidental data loss from orphaned objects.', errcode = '42501';
  end if;
  return null;
end $$;
-- statement-level, like Supabase's: it fires even when RLS leaves no row to delete
create trigger objects_delete_protect before delete on storage.objects for each statement execute function storage.protect_delete();
create trigger buckets_delete_protect before delete on storage.buckets for each statement execute function storage.protect_delete();
alter table storage.buckets enable row level security;
alter table storage.objects enable row level security;
grant usage on schema storage to anon, authenticated, service_role;
grant all on storage.buckets, storage.objects to anon, authenticated, service_role;
grant execute on function storage.foldername(text), storage.filename(text) to anon, authenticated, service_role;
`;

async function openPglite(): Promise<Db> {
  const { PGlite } = await import("@electric-sql/pglite");
  const { btree_gist } = await import("@electric-sql/pglite/contrib/btree_gist");
  const pg = await PGlite.create({ extensions: { btree_gist } });
  await pg.exec(SUPABASE_SHIM);
  return {
    engine: "pglite",
    exec: async (sql) => {
      await pg.exec(sql);
    },
    query: async <T extends Row>(sql: string, params: unknown[] = []) =>
      (await pg.query<T>(sql, params)).rows,
    close: () => pg.close(),
  };
}

async function openPostgres(url: string): Promise<Db> {
  const { Client } = await import("pg");
  const client = new Client({ connectionString: url });
  await client.connect();
  return {
    engine: "postgres",
    exec: async (sql) => {
      await client.query(sql);
    },
    query: async <T extends Row>(sql: string, params: unknown[] = []) =>
      (await client.query(sql, params)).rows as T[],
    close: () => client.end(),
  };
}

export async function openDb(): Promise<Db> {
  const url = process.env.DATABASE_URL;
  return url ? openPostgres(url) : openPglite();
}

/** PGlite only: apply every migration in order (the CLI does this for real Postgres). */
export async function applyMigrations(db: Db): Promise<string[]> {
  if (db.engine !== "pglite")
    throw new Error("applyMigrations is for PGlite; use `supabase db reset` for Postgres");
  const applied: string[] = [];
  for (const m of listMigrations()) {
    await db.exec(m.sql);
    applied.push(m.version);
  }
  return applied;
}

/** Run `fn` as a signed-in user (RLS enforced) or as service_role (BYPASSRLS), then restore the superuser session. */
export async function asUser<T>(
  db: Db,
  userId: string | null,
  fn: () => Promise<T>,
  role: "authenticated" | "service_role" = "authenticated",
): Promise<T> {
  await db.exec(`set role ${role}`);
  await db.exec(`select set_config('request.jwt.claim.sub', '${userId ?? ""}', false)`);
  await db.exec(`select set_config('request.jwt.claim.role', '${role}', false)`);
  try {
    return await fn();
  } finally {
    await db.exec("reset role");
    await db.exec("select set_config('request.jwt.claim.sub', '', false)");
    await db.exec("select set_config('request.jwt.claim.role', '', false)");
  }
}

/** Returns the error message of a statement expected to fail, or null if it unexpectedly succeeded. */
export async function expectError(
  db: Db,
  sql: string,
  params: unknown[] = [],
): Promise<string | null> {
  try {
    await db.query(sql, params);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}
