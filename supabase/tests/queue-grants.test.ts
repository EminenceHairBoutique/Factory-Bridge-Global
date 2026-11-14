/**
 * B-11 (code half) — 0012b worker_queue_grants: service_role gets exactly the pgmq table/sequence privileges the worker
 * needs on the four queues of 0012 (send / read / set_vt / archive / metrics / list_queues) and nothing more;
 * anon and authenticated still reach nothing in schema pgmq. Engine-aware like jobs.test.ts: on PGlite (no pgmq)
 * the guarded block is a no-op and the suite asserts that; on the real stack a missing pgmq is a failure.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { applyMigrations, asUser, expectError, openDb, readSeed, type Db } from "./db.js";

const QUEUES = ["fbg_documents", "fbg_extraction", "fbg_notifications", "fbg_fx"];

let db: Db;
let hasPgmq = false;

const priv = async (sql: string, params: unknown[]) =>
  (await db.query<{ ok: boolean }>(sql, params))[0]!.ok;
const tablePriv = (role: string, table: string, p: string) =>
  priv("select has_table_privilege($1, $2, $3) as ok", [role, table, p]);

beforeAll(async () => {
  db = await openDb();
  if (db.engine === "pglite") {
    await applyMigrations(db);
    await db.exec(readSeed());
  }
  hasPgmq = (
    await db.query<{ ok: boolean }>(
      "select exists (select 1 from pg_extension where extname = 'pgmq') as ok",
    )
  )[0]!.ok;
});

afterAll(async () => {
  await db.close();
});

describe("worker queue grants (0012b)", () => {
  it("engine check: pgmq exists on the real stack; on PGlite the guarded grants were skipped", () => {
    if (db.engine === "postgres") {
      expect(hasPgmq, "pgmq must be installed on the CI Supabase stack").toBe(true);
    } else {
      expect(hasPgmq).toBe(false);
    }
  });

  it("service_role holds exactly the privileges pgmq's functions need on each fbg queue", async () => {
    if (!hasPgmq) return;
    for (const q of QUEUES) {
      for (const p of ["SELECT", "INSERT", "UPDATE", "DELETE"]) {
        expect(await tablePriv("service_role", `pgmq.q_${q}`, p), `q_${q} ${p}`).toBe(true);
      }
      expect(await tablePriv("service_role", `pgmq.q_${q}`, "TRUNCATE"), `q_${q} TRUNCATE`).toBe(
        false,
      );
      for (const p of ["SELECT", "INSERT"]) {
        expect(await tablePriv("service_role", `pgmq.a_${q}`, p), `a_${q} ${p}`).toBe(true);
      }
      for (const p of ["UPDATE", "DELETE", "TRUNCATE"]) {
        expect(await tablePriv("service_role", `pgmq.a_${q}`, p), `a_${q} ${p}`).toBe(false);
      }
      for (const p of ["USAGE", "SELECT"]) {
        expect(
          await priv("select has_sequence_privilege('service_role', $1, $2) as ok", [
            `pgmq.q_${q}_msg_id_seq`,
            p,
          ]),
          `seq ${q} ${p}`,
        ).toBe(true);
      }
    }
    expect(await tablePriv("service_role", "pgmq.meta", "SELECT")).toBe(true);
    for (const p of ["INSERT", "UPDATE", "DELETE", "TRUNCATE"]) {
      expect(await tablePriv("service_role", "pgmq.meta", p), `meta ${p}`).toBe(false);
    }
    expect(
      await priv("select has_schema_privilege('service_role', 'pgmq', 'CREATE') as ok", []),
    ).toBe(false);
  });

  it("anon and authenticated still have no way into schema pgmq", async () => {
    if (!hasPgmq) return;
    for (const role of ["anon", "authenticated"]) {
      expect(
        await priv("select has_schema_privilege($1, 'pgmq', 'USAGE') as ok", [role]),
        role,
      ).toBe(false);
      for (const q of QUEUES) {
        expect(await tablePriv(role, `pgmq.q_${q}`, "SELECT"), `${role} q_${q}`).toBe(false);
        expect(await tablePriv(role, `pgmq.q_${q}`, "INSERT"), `${role} q_${q}`).toBe(false);
      }
    }
    await asUser(db, "ab100000-0000-4000-8000-0000000000aa", async () => {
      for (const sql of [
        "select * from pgmq.send('fbg_notifications', '{}'::jsonb, 0)",
        "select * from pgmq.read('fbg_notifications', 30, 1)",
        "select * from pgmq.q_fbg_notifications",
      ]) {
        expect(await expectError(db, sql), sql).toMatch(/permission denied/);
      }
    });
  });

  it("as service_role the worker's whole cycle works, and queue administration does not", async () => {
    if (!hasPgmq) return;
    await asUser(
      db,
      null,
      async () => {
        const id = (
          await db.query<{ id: string }>(
            "select s::text as id from pgmq.send('fbg_notifications', '{\"grant_test\":true}'::jsonb, 0) as s",
          )
        )[0]!.id;
        const read = await db.query<{ msg_id: string; read_ct: number }>(
          "select msg_id::text as msg_id, read_ct from pgmq.read('fbg_notifications', 30, 10) where message ->> 'grant_test' = 'true'",
        );
        expect(read.map((r) => r.msg_id)).toContain(id);
        await db.query("select msg_id from pgmq.set_vt('fbg_notifications', $1::bigint, 0)", [id]);
        expect(
          (
            await db.query<{ ok: boolean }>(
              "select pgmq.archive('fbg_notifications', $1::bigint) as ok",
              [id],
            )
          )[0]!.ok,
        ).toBe(true);
        expect(
          (
            await db.query<{ n: string }>(
              "select queue_length::text as n from pgmq.metrics('fbg_notifications')",
            )
          ).length,
        ).toBe(1);
        expect(
          (await db.query<{ q: string }>("select queue_name as q from pgmq.list_queues()")).map(
            (r) => r.q,
          ),
        ).toEqual(expect.arrayContaining(QUEUES));
        expect(await expectError(db, "select pgmq.purge_queue('fbg_notifications')")).toMatch(
          /permission denied/,
        );
        expect(await expectError(db, "select pgmq.create('grant_test_forbidden')")).toMatch(
          /permission denied/,
        );
        expect(await expectError(db, "delete from pgmq.meta")).toMatch(/permission denied/);
        expect(
          await expectError(db, "delete from pgmq.a_fbg_notifications where msg_id = $1::bigint", [
            id,
          ]),
        ).toMatch(/permission denied/);
      },
      "service_role",
    );
  });
});
