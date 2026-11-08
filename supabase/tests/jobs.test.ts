/**
 * B-25 / B-11 (schema) — jobs_notifications (0012): worker idempotency ledger, dead letters, per-user notifications,
 * the expiry sweep and expiring-soon reminders, and the queues/schedules where the extensions exist.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { applyMigrations, asUser, expectError, openDb, readSeed, type Db } from "./db.js";

const INTERNAL_ORG = "00000000-0000-4000-8000-000000000001";
const U = {
  aOwner: "ab100000-0000-4000-8000-000000000001",
  aMember: "ab100000-0000-4000-8000-000000000002",
  bOwner: "ab200000-0000-4000-8000-000000000001",
  sOwner: "ab300000-0000-4000-8000-000000000001",
  op: "ab900000-0000-4000-8000-000000000001",
  admin: "ab900000-0000-4000-8000-000000000003",
};
const ORG = {
  a: "ab1ab1ab-0000-4000-8000-000000000001",
  b: "ab2ab2ab-0000-4000-8000-000000000001",
  s: "ab3ab3ab-0000-4000-8000-000000000001",
};

let db: Db;
let sId = "";
let pastQ = "";
let soonQ = "";
let openQ = "";

const count = async (sql: string, params: unknown[] = []) =>
  Number(
    (await db.query<{ n: string }>(`select count(*)::text as n from (${sql}) q`, params))[0]!.n,
  );
const status = async (q: string) =>
  (
    await db.query<{ s: string }>(
      "select status::text as s from public.quotation_states where quotation_id = $1",
      [q],
    )
  )[0]!.s;
const iso = (d: Date) => d.toISOString().slice(0, 10);
const daysFromNow = (n: number) => iso(new Date(Date.now() + n * 86400000));

beforeAll(async () => {
  db = await openDb();
  if (db.engine === "pglite") {
    await applyMigrations(db);
    await db.exec(readSeed());
  }
  const orgList = Object.values(ORG)
    .map((o) => `'${o}'`)
    .join(",");
  const userList = Object.values(U)
    .map((u) => `'${u}'`)
    .join(",");
  await db.exec(`
    delete from public.notifications where user_id in (${userList}) or dedupe_key like 'document_parsed:d1:%';
    delete from public.job_executions where queue like 'test_%';
    delete from public.jobs_dead_letter where queue like 'test_%';
    alter table public.quotations disable trigger quotations_immutable;
    alter table public.quote_tiers disable trigger quote_tiers_immutable;
    alter table public.quote_fees disable trigger quote_fees_immutable;
    delete from public.quote_visibility_grants where quotation_id in (select id from public.quotations where buyer_org_id in (${orgList}));
    delete from public.quote_status_events where quotation_id in (select id from public.quotations where buyer_org_id in (${orgList}));
    delete from public.quotation_states where quotation_id in (select id from public.quotations where buyer_org_id in (${orgList}));
    delete from public.quote_tiers where quotation_id in (select id from public.quotations where buyer_org_id in (${orgList}));
    delete from public.quote_fees where quotation_id in (select id from public.quotations where buyer_org_id in (${orgList}));
    delete from public.quotations where buyer_org_id in (${orgList});
    delete from public.quote_groups where buyer_org_id in (${orgList});
    alter table public.quotations enable trigger quotations_immutable;
    alter table public.quote_tiers enable trigger quote_tiers_immutable;
    alter table public.quote_fees enable trigger quote_fees_immutable;
    delete from public.organizations where id in (${orgList});
    delete from auth.users where id in (${userList});
  `);
  await db.exec(
    `insert into auth.users (id, email) values ${Object.entries(U)
      .map(([k, id]) => `('${id}', 'jobs-${k.toLowerCase()}@example.test')`)
      .join(",")}`,
  );
  await db.exec(`
    insert into public.organizations (id, org_type, legal_name, display_name) values
      ('${ORG.a}', 'buyer', 'Jobs Buyer A', 'A'), ('${ORG.b}', 'buyer', 'Jobs Buyer B', 'B'), ('${ORG.s}', 'supplier', '任务供应商', 'S');
    insert into public.memberships (org_id, user_id, role) values
      ('${ORG.a}', '${U.aOwner}', 'owner'), ('${ORG.a}', '${U.aMember}', 'member'),
      ('${ORG.b}', '${U.bOwner}', 'owner'), ('${ORG.s}', '${U.sOwner}', 'owner'),
      ('${INTERNAL_ORG}', '${U.op}', 'operator'), ('${INTERNAL_ORG}', '${U.admin}', 'platform_admin');
    insert into public.supplier_profiles (org_id, legal_name_zh) values ('${ORG.s}', '任务供应商有限公司');
  `);
  sId = (
    await db.query<{ id: string }>("select id from public.supplier_profiles where org_id = $1", [
      ORG.s,
    ])
  )[0]!.id;
  const quote = async (type: string, quoteDate: string, validUntil: string | null, key: string) =>
    asUser(
      db,
      U.aOwner,
      async () =>
        (
          await db.query<{ id: string }>(
            "select app.supersede_quotation(null, $1::jsonb, 'fixture', $2) as id",
            [
              JSON.stringify({
                supplier_id: sId,
                buyer_org_id: ORG.a,
                quote_type: type,
                rights_class: "customer_private_quote",
                source_type: "operator_import",
                price_basis: "FOB",
                basis_confirmed: true,
                currency: "USD",
                quantity_unit: "pcs",
                quote_date: quoteDate,
                valid_until: validUntil,
                tiers: [{ min_qty: 1000, unit_price: 0.05 }],
              }),
              key,
            ],
          )
        )[0]!.id,
    );
  pastQ = await quote(
    "negotiated_private",
    daysFromNow(-40),
    daysFromNow(-1),
    "jobs-key-past-0001",
  );
  soonQ = await quote("final_offer", daysFromNow(-10), daysFromNow(3), "jobs-key-soon-0001");
  openQ = await quote("estimate", daysFromNow(-10), null, "jobs-key-open-0001");
});

afterAll(async () => {
  await db.close();
});

describe("queues and schedules (engine-aware)", () => {
  it("on Supabase the pgmq queues and cron jobs exist; on PGlite the guarded blocks were skipped and nothing else broke", async () => {
    const hasPgmq = (
      await db.query<{ ok: boolean }>(
        "select exists (select 1 from pg_extension where extname = 'pgmq') as ok",
      )
    )[0]!.ok;
    const hasCron = (
      await db.query<{ ok: boolean }>(
        "select exists (select 1 from pg_extension where extname = 'pg_cron') as ok",
      )
    )[0]!.ok;
    if (db.engine === "postgres") {
      // the real stack must have both — a missing extension here is a CI configuration error, not a pass
      expect(hasPgmq, "pgmq must be installed on the CI Supabase stack").toBe(true);
      expect(hasCron, "pg_cron must be installed on the CI Supabase stack").toBe(true);
    }
    if (hasPgmq) {
      const queues = (
        await db.query<{ q: string }>("select queue_name as q from pgmq.list_queues() order by 1")
      ).map((r) => r.q);
      expect(queues).toEqual(
        expect.arrayContaining(["fbg_documents", "fbg_extraction", "fbg_fx", "fbg_notifications"]),
      );
      await asUser(db, U.admin, async () => {
        expect(await expectError(db, "select * from pgmq.list_queues()")).toMatch(
          /permission denied/,
        );
      });
    } else {
      expect(db.engine).toBe("pglite");
    }
    if (hasCron) {
      const jobs = (
        await db.query<{ n: string; s: string }>(
          "select jobname as n, schedule as s from cron.job where jobname like 'fbg_%' order by 1",
        )
      ).map((r) => `${r.n}@${r.s}`);
      expect(jobs).toEqual([
        "fbg_expire_quotations@15 6 * * *",
        "fbg_notify_expiring_quotations@30 6 * * *",
      ]);
    }
  });
});

describe("job_executions (worker idempotency ledger)", () => {
  it("the worker records a run; the same key on the same queue is a unique violation; a finished run has finished_at; only platform admins read", async () => {
    await asUser(
      db,
      null,
      async () => {
        await db.exec(
          "insert into public.job_executions (queue, idempotency_key, msg_id, worker_id) values ('test_documents', 'scan:doc-0001', 11, 'w1')",
        );
        expect(
          await expectError(
            db,
            "insert into public.job_executions (queue, idempotency_key, msg_id, worker_id) values ('test_documents', 'scan:doc-0001', 12, 'w2')",
          ),
        ).toMatch(/duplicate|unique/);
        await db.exec(
          "insert into public.job_executions (queue, idempotency_key, msg_id, worker_id) values ('test_extraction', 'scan:doc-0001', 13, 'w1')",
        ); // other queue: fine
        expect(
          await expectError(
            db,
            "update public.job_executions set status = 'succeeded' where idempotency_key = 'scan:doc-0001' and queue = 'test_documents'",
          ),
        ).toMatch(/check/); // needs finished_at
        await db.exec(
          "update public.job_executions set status = 'succeeded', finished_at = now() where idempotency_key = 'scan:doc-0001' and queue = 'test_documents'",
        );
        expect(
          await expectError(
            db,
            "insert into public.job_executions (queue, idempotency_key) values ('Bad Queue', 'scan:doc-0002')",
          ),
        ).toMatch(/check/);
      },
      "service_role",
    );
    for (const [u, n] of [
      [U.admin, 2],
      [U.op, 0],
      [U.aOwner, 0],
    ] as const) {
      await asUser(db, u, async () => {
        expect(
          await count("select 1 from public.job_executions where queue like 'test_%'"),
          u,
        ).toBe(n);
        expect(
          await expectError(
            db,
            "insert into public.job_executions (queue, idempotency_key) values ('test_x', 'forged-key-0001')",
          ),
          u,
        ).toMatch(/permission denied/);
      });
    }
  });
});

describe("jobs_dead_letter", () => {
  it("the worker files poison messages; internal staff read; platform admins resolve (resolution columns only); buyers see nothing", async () => {
    let id = "";
    await asUser(
      db,
      null,
      async () => {
        id = (
          await db.query<{ id: string }>(
            "insert into public.jobs_dead_letter (queue, msg_id, idempotency_key, message, error, attempts) values ('test_documents', 99, 'parse:doc-0009', '{\"document_id\":\"x\"}', 'pdf parser: xref table corrupt', 5) returning id",
          )
        )[0]!.id;
        expect(
          await expectError(
            db,
            "insert into public.jobs_dead_letter (queue, message, error, attempts) values ('test_documents', '{}', 'x', 0)",
          ),
        ).toMatch(/check/);
      },
      "service_role",
    );
    await asUser(db, U.aOwner, async () => {
      expect(await count("select 1 from public.jobs_dead_letter where id = $1", [id])).toBe(0);
    });
    await asUser(db, U.op, async () => {
      expect(await count("select 1 from public.jobs_dead_letter where id = $1", [id])).toBe(1);
      await db.exec(
        `update public.jobs_dead_letter set resolved_at = now(), resolution = 'discarded' where id = '${id}'`,
      ); // 0 rows: not admin
    });
    expect(
      (
        await db.query<{ r: string | null }>(
          "select resolution as r from public.jobs_dead_letter where id = $1",
          [id],
        )
      )[0]!.r,
    ).toBeNull();
    await asUser(db, U.admin, async () => {
      expect(
        await expectError(db, "update public.jobs_dead_letter set error = 'edited' where id = $1", [
          id,
        ]),
      ).toMatch(/only resolution columns/);
      expect(
        await expectError(
          db,
          "update public.jobs_dead_letter set resolved_at = now() where id = $1",
          [id],
        ),
      ).toMatch(/check/); // resolution required
      await db.exec(
        `update public.jobs_dead_letter set resolved_at = now(), resolution = 'requeued' where id = '${id}'`,
      );
    });
    const r = await db.query<{ by: string; res: string }>(
      "select resolved_by as by, resolution as res from public.jobs_dead_letter where id = $1",
      [id],
    );
    expect(r[0]).toEqual({ by: U.admin, res: "requeued" });
  });
});

describe("notifications", () => {
  it("written only by the worker / app.notify; a user reads and marks read their own rows and nothing else; dedupe_key is unique", async () => {
    await asUser(db, U.aOwner, async () => {
      expect(
        await expectError(
          db,
          "insert into public.notifications (user_id, kind) values ($1, 'generic')",
          [U.aOwner],
        ),
      ).toMatch(/permission denied/);
      expect(await expectError(db, "select app.notify($1, null, 'generic')", [U.aOwner])).toMatch(
        /permission denied/,
      );
    });
    let id = "";
    await asUser(
      db,
      null,
      async () => {
        id = (
          await db.query<{ id: string }>(
            "select app.notify($1, $2, 'document_parsed', '{\"document_id\":\"d1\"}', 'document_parsed:d1:aOwner') as id",
            [U.aOwner, ORG.a],
          )
        )[0]!.id;
        expect(id).toBeTruthy();
        expect(
          (
            await db.query<{ id: string | null }>(
              "select app.notify($1, $2, 'document_parsed', '{}', 'document_parsed:d1:aOwner') as id",
              [U.aOwner, ORG.a],
            )
          )[0]!.id,
        ).toBeNull(); // deduped
        await db.exec(
          `insert into public.notifications (user_id, org_id, kind, payload) values ('${U.bOwner}', '${ORG.b}', 'generic', '{"text":"hello B"}')`,
        );
        expect(
          await expectError(
            db,
            "insert into public.notifications (user_id, kind) values ($1, 'made_up_kind')",
            [U.aOwner],
          ),
        ).toMatch(/check/);
      },
      "service_role",
    );
    await asUser(db, U.aOwner, async () => {
      expect(await count("select 1 from public.notifications")).toBe(1);
      expect(
        await expectError(db, "update public.notifications set payload = '{}' where id = $1", [id]),
      ).toMatch(/only read_at/);
      expect(
        await expectError(db, "update public.notifications set user_id = $2 where id = $1", [
          id,
          U.bOwner,
        ]),
      ).toMatch(/only read_at|row-level security/);
      await db.exec(`update public.notifications set read_at = now() where id = '${id}'`);
      expect(await count("select 1 from public.notifications where read_at is not null")).toBe(1);
      await db.exec(
        `update public.notifications set read_at = now() where user_id = '${U.bOwner}'`,
      ); // 0 rows
      expect(await expectError(db, "delete from public.notifications where id = $1", [id])).toMatch(
        /permission denied/,
      );
    });
    await asUser(db, U.aMember, async () => {
      expect(await count("select 1 from public.notifications")).toBe(0);
    });
    expect(
      await count("select 1 from public.notifications where user_id = $1 and read_at is not null", [
        U.bOwner,
      ]),
    ).toBe(0);
  });
});

describe("expiry sweep + reminders", () => {
  it("app.expire_quotations expires only current confirmed quotations with a past valid_until, as system, once; owners/admins are notified once", async () => {
    expect(await status(pastQ)).toBe("confirmed");
    const n1 = (await db.query<{ n: number }>("select app.expire_quotations() as n"))[0]!.n;
    expect(n1).toBe(1);
    expect(await status(pastQ)).toBe("expired");
    expect(await status(soonQ)).toBe("confirmed");
    expect(await status(openQ)).toBe("confirmed"); // NULL valid_until never auto-expires
    const ev = await db.query<{ a: string; k: string }>(
      "select acting_as as a, idempotency_key as k from public.quote_status_events where quotation_id = $1 and to_status = 'expired'",
      [pastQ],
    );
    expect(ev).toHaveLength(1);
    expect(ev[0]!.a).toBe("system");
    expect(ev[0]!.k).toMatch(new RegExp(`^expire:${pastQ}:\\d{4}-\\d{2}-\\d{2}$`));
    // owner notified (member is not, for expiry); second sweep is a no-op and adds nothing
    expect(
      await count(
        "select 1 from public.notifications where kind = 'quote_expired' and user_id = $1",
        [U.aOwner],
      ),
    ).toBe(1);
    expect(
      await count(
        "select 1 from public.notifications where kind = 'quote_expired' and user_id = $1",
        [U.aMember],
      ),
    ).toBe(0);
    expect((await db.query<{ n: number }>("select app.expire_quotations() as n"))[0]!.n).toBe(0);
    expect(await count("select 1 from public.notifications where kind = 'quote_expired'")).toBe(1);
    await asUser(db, U.aOwner, async () => {
      const row = (
        await db.query<{ p: { quotation_id: string; valid_until: string } }>(
          "select payload as p from public.notifications where kind = 'quote_expired'",
        )
      )[0]!;
      expect(row.p.quotation_id).toBe(pastQ);
      expect(await expectError(db, "select app.expire_quotations()")).toMatch(/permission denied/);
    });
  });

  it("app.notify_expiring_quotations reminds owners/admins/members once per quotation within the window", async () => {
    expect(
      (await db.query<{ n: number }>("select app.notify_expiring_quotations(7) as n"))[0]!.n,
    ).toBe(2); // aOwner + aMember for soonQ
    expect(
      (await db.query<{ n: number }>("select app.notify_expiring_quotations(7) as n"))[0]!.n,
    ).toBe(0);
    expect(
      (await db.query<{ n: number }>("select app.notify_expiring_quotations(1) as n"))[0]!.n,
    ).toBe(0); // soonQ is 3 days out
    await asUser(db, U.aMember, async () => {
      const rows = await db.query<{ p: { quotation_id: string; days_left: number } }>(
        "select payload as p from public.notifications where kind = 'quote_expiring'",
      );
      expect(rows).toHaveLength(1);
      expect(rows[0]!.p.quotation_id).toBe(soonQ);
      expect(rows[0]!.p.days_left).toBe(3);
    });
  });
});
