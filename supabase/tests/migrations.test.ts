import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ENUM_REGISTRY } from "@fbg/domain/enums";
import { extractEnumBlock, generateEnumSql } from "@fbg/domain/sql/enum-sql";
import { applyMigrations, listMigrations, openDb, readSeed, type Db } from "./db.js";
import { AUTHENTICATED_MAX_PRIVILEGES, PUBLIC_READ_TABLES, TENANT_TABLES } from "./rls-coverage.js";

let db: Db;

beforeAll(async () => {
  db = await openDb();
  if (db.engine === "pglite") await applyMigrations(db);
});

afterAll(async () => {
  await db.close();
});

describe("migration files", () => {
  it("follow the Supabase naming convention and are in ascending order", () => {
    const versions = listMigrations().map((m) => m.version);
    expect(versions.length).toBeGreaterThan(0);
    expect(versions).toEqual([...versions].sort());
    expect(new Set(versions).size).toBe(versions.length);
  });

  it("0001: committed enum block equals the generator output (drift guard)", () => {
    const bootstrap = listMigrations().find((m) => m.name === "bootstrap");
    expect(bootstrap).toBeDefined();
    expect(extractEnumBlock(bootstrap!.sql)).toBe(generateEnumSql());
  });
});

describe("applied schema", () => {
  it(`reports which engine ran (${process.env.DATABASE_URL ? "postgres" : "pglite"})`, () => {
    expect(["pglite", "postgres"]).toContain(db.engine);
  });

  it("postgres: every migration file is recorded as applied by the CLI", async () => {
    if (db.engine !== "postgres") return; // PGlite applied them in beforeAll
    const rows = await db.query<{ version: string }>(
      "select version from supabase_migrations.schema_migrations order by version",
    );
    expect(rows.map((r) => r.version)).toEqual(listMigrations().map((m) => m.version));
  });

  it("btree_gist extension is installed (needed by quote_tiers exclusion constraint)", async () => {
    const rows = await db.query("select 1 from pg_extension where extname = 'btree_gist'");
    expect(rows).toHaveLength(1);
  });

  it("every enum in the TypeScript registry exists in public with identical labels and order", async () => {
    for (const [name, labels] of Object.entries(ENUM_REGISTRY)) {
      const rows = await db.query<{ enumlabel: string }>(
        `select e.enumlabel from pg_type t
           join pg_namespace n on n.oid = t.typnamespace
           join pg_enum e on e.enumtypid = t.oid
          where n.nspname = 'public' and t.typname = $1
          order by e.enumsortorder`,
        [name],
      );
      expect(
        rows.map((r) => r.enumlabel),
        `enum ${name}`,
      ).toEqual([...labels]);
    }
  });

  it("no enum exists in public that the registry does not know (reverse drift)", async () => {
    const rows = await db.query<{ typname: string }>(
      `select t.typname from pg_type t join pg_namespace n on n.oid = t.typnamespace
        where n.nspname = 'public' and t.typtype = 'e' order by 1`,
    );
    expect(rows.map((r) => r.typname)).toEqual(Object.keys(ENUM_REGISTRY).sort());
  });

  it("app.current_user_id() follows the JWT sub claim and is null without one", async () => {
    const none = await db.query<{ uid: string | null }>("select app.current_user_id() as uid");
    expect(none[0]?.uid).toBeNull();
    const id = "11111111-1111-4111-8111-111111111111";
    await db.exec(`select set_config('request.jwt.claim.sub', '${id}', false)`);
    const some = await db.query<{ uid: string | null }>("select app.current_user_id() as uid");
    expect(some[0]?.uid).toBe(id);
    await db.exec("select set_config('request.jwt.claim.sub', '', false)");
  });

  it("app functions are not executable by anon or public; authenticated and service_role are", async () => {
    const priv = async (role: string) =>
      (
        await db.query<{ ok: boolean }>(
          `select has_function_privilege($1, 'app.current_user_id()', 'EXECUTE') as ok`,
          [role],
        )
      )[0]?.ok;
    expect(await priv("anon")).toBe(false);
    expect(await priv("authenticated")).toBe(true);
    expect(await priv("service_role")).toBe(true);
  });

  it("schema app is not usable by anon", async () => {
    const rows = await db.query<{ ok: boolean }>(
      `select has_schema_privilege('anon', 'app', 'USAGE') as ok`,
    );
    expect(rows[0]?.ok).toBe(false);
  });
});

describe("RLS coverage guard (fails when a public table is added without harness coverage)", () => {
  it("every table in public is either a registered tenant table or an allow-listed public-read table", async () => {
    const rows = await db.query<{
      tablename: string;
      rowsecurity: boolean;
      forcerowsecurity: boolean;
    }>(
      `select c.relname as tablename, c.relrowsecurity as rowsecurity, c.relforcerowsecurity as forcerowsecurity
         from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r' order by 1`,
    );
    const actual = rows.map((r) => r.tablename).sort();
    const registered = [...TENANT_TABLES.map((t) => t.table), ...PUBLIC_READ_TABLES].sort();
    expect(actual, "public tables must be registered in tests/rls-coverage.ts").toEqual(registered);
    for (const r of rows) {
      expect(r.rowsecurity, `${r.tablename} must have RLS enabled`).toBe(true);
      expect(r.forcerowsecurity, `${r.tablename} must FORCE RLS`).toBe(true);
      const policies = await db.query(
        "select 1 from pg_policies where schemaname = 'public' and tablename = $1",
        [r.tablename],
      );
      expect(policies.length, `${r.tablename} must have at least one policy`).toBeGreaterThan(0);
    }
  });

  it("authenticated holds exactly the allow-listed table privileges on every public table; anon reads nothing", async () => {
    // Supabase default privileges hand ALL on new tables to anon/authenticated/service_role (the PGlite
    // shim in db.ts reproduces this). A migration that forgets to revoke makes RLS the only barrier;
    // this guard catches that for the whole class, not one table at a time.
    const PRIVS = [
      "SELECT",
      "INSERT",
      "UPDATE",
      "DELETE",
      "TRUNCATE",
      "REFERENCES",
      "TRIGGER",
    ] as const;
    const tables = [...TENANT_TABLES.map((t) => t.table), ...PUBLIC_READ_TABLES];
    for (const table of tables) {
      const allowed = AUTHENTICATED_MAX_PRIVILEGES[table];
      expect(allowed, `${table} must have an entry in AUTHENTICATED_MAX_PRIVILEGES`).toBeDefined();
      for (const priv of PRIVS) {
        const rows = await db.query<{ ok: boolean }>(
          "select has_table_privilege($1, $2, $3) as ok",
          ["authenticated", `public.${table}`, priv],
        );
        const expected = (allowed ?? []).includes(priv as never);
        expect(rows[0]?.ok, `authenticated ${priv} on ${table}`).toBe(expected);
      }
      const anon = await db.query<{ ok: boolean }>(
        "select has_table_privilege('anon', $1, 'SELECT') as ok",
        [`public.${table}`],
      );
      expect(anon[0]?.ok, `anon SELECT on ${table}`).toBe(false);
    }
  });

  it("the RLS isolation suite exists once any tenant table exists", () => {
    // B-07 adds tests/rls.test.ts. Until a tenant table exists there is nothing to isolate; this
    // assertion flips to a hard requirement the moment TENANT_TABLES is non-empty.
    if (TENANT_TABLES.length === 0) return;
    const covered = new Set(TENANT_TABLES.map((t) => t.coveredBy));
    expect([...covered]).toContain("rls.test.ts");
  });
});

describe("seed", () => {
  it("applies twice without error (idempotent)", async () => {
    const seed = readSeed();
    await db.exec(seed);
    await db.exec(seed);
  });
});
