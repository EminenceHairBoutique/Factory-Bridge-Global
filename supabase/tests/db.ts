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
-- Mirrors Supabase's auth.uid(): sub claim from the request JWT settings.
create or replace function auth.uid() returns uuid
language sql stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;
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
