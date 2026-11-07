/**
 * 0003b ai_runs_budget — ledger, budget guard, security events and RLS (B-16b).
 * Same conventions as rls.test.ts: assertions run as `authenticated` with a JWT sub, or as service_role
 * only where the worker path is under test. Fixtures use their own ids so this file can run in parallel
 * with rls.test.ts against one real Postgres.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { applyMigrations, asUser, expectError, openDb, readSeed, type Db } from "./db.js";

const INTERNAL_ORG = "00000000-0000-4000-8000-000000000001";
const U = {
  pOwner: "e1000000-0000-4000-8000-000000000001",
  pViewer: "e1000000-0000-4000-8000-000000000002",
  qOwner: "e2000000-0000-4000-8000-000000000001",
  opUnassigned: "e3000000-0000-4000-8000-000000000001",
  compliance: "e3000000-0000-4000-8000-000000000002",
  admin: "e3000000-0000-4000-8000-000000000003",
};
const ORG = {
  p: "e1e1e1e1-0000-4000-8000-000000000001",
  q: "e2e2e2e2-0000-4000-8000-000000000001",
};
const HASH = "a".repeat(64);
const DEFAULT_CAP = 50_000_000_000; // $50 in nano-USD

let db: Db;

const cleanup = async () => {
  await db.exec(`delete from public.organizations where id in ('${ORG.p}','${ORG.q}')`);
  await db.exec(
    `delete from public.security_events where org_id is null and details->>'purpose' = 'extract'`,
  );
  await db.exec(
    `delete from auth.users where id in (${Object.values(U)
      .map((u) => `'${u}'`)
      .join(",")})`,
  );
};

beforeAll(async () => {
  db = await openDb();
  if (db.engine === "pglite") {
    await applyMigrations(db);
    await db.exec(readSeed());
  }
  await cleanup();
  await db.exec(
    `insert into auth.users (id, email) values ${Object.entries(U)
      .map(([k, id]) => `('${id}', 'ai-${k.toLowerCase()}@example.test')`)
      .join(",")}`,
  );
  await db.exec(`
    insert into public.organizations (id, org_type, legal_name, display_name, created_by) values
      ('${ORG.p}', 'buyer', 'Buyer P LLC', 'Buyer P', '${U.pOwner}'),
      ('${ORG.q}', 'buyer', 'Buyer Q Inc', 'Buyer Q', '${U.qOwner}');
    insert into public.memberships (org_id, user_id, role) values
      ('${ORG.p}', '${U.pOwner}', 'owner'),
      ('${ORG.p}', '${U.pViewer}', 'viewer'),
      ('${ORG.q}', '${U.qOwner}', 'owner'),
      ('${INTERNAL_ORG}', '${U.opUnassigned}', 'operator'),
      ('${INTERNAL_ORG}', '${U.compliance}', 'compliance_reviewer'),
      ('${INTERNAL_ORG}', '${U.admin}', 'platform_admin');
  `);
});

afterAll(async () => {
  await cleanup();
  await db.close();
});

/** Worker-style call to app.record_ai_run as service_role. Returns the run id. */
async function recordRun(
  org: string,
  opts: {
    status?: string;
    costNano?: number;
    flags?: string[];
    jobId?: string | null;
    error?: string | null;
    model?: string;
  } = {},
): Promise<string> {
  const flags = `array[${(opts.flags ?? []).map((f) => `'${f}'`).join(",")}]::text[]`;
  const rows = await asUser(
    db,
    null,
    () =>
      db.query<{ id: string }>(
        `select app.record_ai_run(
           $1::uuid, 'extract', 'mock', $2::text, 'quotation_extractor', $3::text, $4::text,
           1200, 300, 0, 0, $5::bigint, 850, 1::smallint, ${flags},
           $6::text, $7::text, null, $8::text, null) as id`,
        [
          org,
          opts.model ?? "mock",
          HASH,
          opts.status ?? "ok",
          String(opts.costNano ?? 0),
          opts.error ?? null,
          HASH,
          opts.jobId ?? null,
        ],
      ),
    "service_role",
  );
  return rows[0]!.id;
}

async function budget(org: string, asRole: string | null = "service_role") {
  const call = () =>
    db.query<{
      cap_nano_usd: string;
      spent_nano_usd: string;
      remaining_nano_usd: string;
      exceeded: boolean;
      alert: boolean;
    }>(`select * from app.ai_budget_status($1::uuid, $2::bigint)`, [org, String(DEFAULT_CAP)]);
  const rows =
    asRole === "service_role"
      ? await asUser(db, null, call, "service_role")
      : await asUser(db, asRole, call);
  const r = rows[0]!;
  return {
    cap: Number(r.cap_nano_usd),
    spent: Number(r.spent_nano_usd),
    remaining: Number(r.remaining_nano_usd),
    exceeded: r.exceeded,
    alert: r.alert,
  };
}

describe("app.record_ai_run — worker-only, append-only ledger", () => {
  it("service_role records a run; the row carries the prompt hash and an exact nano-USD cost with a derived cost_usd", async () => {
    const id = await recordRun(ORG.p, { costNano: 1_234_567_890, jobId: "job-p-1" });
    const rows = await db.query<{
      prompt_version: string;
      cost_nano_usd: string;
      cost_usd: string;
      status: string;
      input_tokens: number;
    }>(
      "select prompt_version, cost_nano_usd::text, cost_usd::text, status, input_tokens from public.ai_runs where id = $1",
      [id],
    );
    expect(rows[0]).toEqual({
      prompt_version: HASH,
      cost_nano_usd: "1234567890",
      cost_usd: "1.234568",
      status: "ok",
      input_tokens: 1200,
    });
  });

  it("authenticated users cannot call record_ai_run nor INSERT/UPDATE/DELETE ai_runs; service_role has no UPDATE/DELETE", async () => {
    const fnErr = await asUser(db, U.admin, () =>
      expectError(
        db,
        `select app.record_ai_run('${ORG.p}', 'extract', 'mock', 'mock', 't', '${HASH}', 'ok', 0, 0, 0, 0, 0, 0, 0::smallint, '{}'::text[])`,
      ),
    );
    expect(fnErr).toMatch(/permission denied|service_role/);
    for (const sql of [
      `insert into public.ai_runs (org_id, purpose, provider, model, prompt_template_id, prompt_version, status) values ('${ORG.p}', 'extract', 'x', 'x', 'x', 'x', 'ok')`,
      `update public.ai_runs set cost_nano_usd = 0`,
      `delete from public.ai_runs`,
    ]) {
      expect(await asUser(db, U.pOwner, () => expectError(db, sql))).toMatch(/permission denied/);
    }
    for (const sql of [
      `update public.ai_runs set cost_nano_usd = 0`,
      `delete from public.ai_runs`,
    ]) {
      expect(await asUser(db, null, () => expectError(db, sql), "service_role")).toMatch(
        /permission denied/,
      );
    }
  });

  it("is idempotent on (org_id, job_id): a replayed job returns the same id and writes no second row", async () => {
    const a = await recordRun(ORG.p, { jobId: "job-p-replay", costNano: 100 });
    const b = await recordRun(ORG.p, { jobId: "job-p-replay", costNano: 999 });
    expect(b).toBe(a);
    const n = await db.query<{ n: string }>(
      "select count(*)::text as n from public.ai_runs where org_id = $1 and job_id = 'job-p-replay'",
      [ORG.p],
    );
    expect(n[0]!.n).toBe("1");
    // the same job id in ANOTHER org is a different run
    const c = await recordRun(ORG.q, { jobId: "job-p-replay" });
    expect(c).not.toBe(a);
  });

  it("rejects unknown statuses and purposes (no free text into programmatic columns)", async () => {
    expect(
      await asUser(
        db,
        null,
        () =>
          expectError(
            db,
            `select app.record_ai_run('${ORG.p}', 'extract', 'mock', 'mock', 't', '${HASH}', 'verified', 0, 0, 0, 0, 0, 0, 0::smallint, '{}'::text[])`,
          ),
        "service_role",
      ),
    ).toMatch(/check constraint|violates/);
  });
});

describe("security events emitted by the ledger", () => {
  const eventsFor = (org: string, kind: string) =>
    db.query<{ details: Record<string, unknown> }>(
      "select details from public.security_events where org_id = $1 and kind = $2 order by at desc",
      [org, kind],
    );

  it("budget_refused → ai_budget_exceeded; canary_leak → ai_canary_leak; embedded_instruction_detected flag → injection_flag", async () => {
    const refused = await recordRun(ORG.q, { status: "budget_refused", jobId: "job-q-refused" });
    const leak = await recordRun(ORG.q, {
      status: "canary_leak",
      error: "canary token reproduced",
    });
    const flagged = await recordRun(ORG.q, { flags: ["embedded_instruction_detected"] });

    const budgetEv = await eventsFor(ORG.q, "ai_budget_exceeded");
    expect(budgetEv.map((e) => e.details.ai_run_id)).toContain(refused);
    expect(budgetEv[0]!.details.job_id).toBe("job-q-refused");

    const leakEv = await eventsFor(ORG.q, "ai_canary_leak");
    expect(leakEv.map((e) => e.details.ai_run_id)).toContain(leak);
    expect(JSON.stringify(leakEv)).not.toContain("canary token reproduced"); // detail text stays in ai_runs.error

    const injEv = await eventsFor(ORG.q, "injection_flag");
    expect(injEv.map((e) => e.details.ai_run_id)).toContain(flagged);
  });

  it("an ordinary ok run emits no security event", async () => {
    const before = await db.query<{ n: string }>(
      "select count(*)::text as n from public.security_events where org_id = $1",
      [ORG.p],
    );
    await recordRun(ORG.p);
    const after = await db.query<{ n: string }>(
      "select count(*)::text as n from public.security_events where org_id = $1",
      [ORG.p],
    );
    expect(after[0]!.n).toBe(before[0]!.n);
  });
});

describe("app.ai_budget_status — monthly cap, default when no row", () => {
  it("uses the platform default cap when the org has no ai_budgets row and sums this month's spend", async () => {
    const b = await budget(ORG.p);
    expect(b.cap).toBe(DEFAULT_CAP);
    const spent = await db.query<{ s: string }>(
      "select coalesce(sum(cost_nano_usd),0)::text as s from public.ai_runs where org_id = $1 and at >= app.ai_month_start()",
      [ORG.p],
    );
    expect(b.spent).toBe(Number(spent[0]!.s));
    expect(b.remaining).toBe(DEFAULT_CAP - b.spent);
    expect(b.exceeded).toBe(false);
  });

  it("platform admin sets a per-org cap (audited); the status reflects it, flags alert and exceeded", async () => {
    // cap $0.000001 = 1000 nano for org Q; Q already spent 0 (refused/leak/flag runs recorded 0 cost)
    await asUser(db, U.admin, () =>
      db.query(`select app.set_ai_budget('${ORG.q}', 2000::bigint, 50::smallint, 'test cap')`),
    );
    let b = await budget(ORG.q);
    expect(b.cap).toBe(2000);
    expect(b.exceeded).toBe(false);
    expect(b.alert).toBe(false);

    await recordRun(ORG.q, { costNano: 1000 }); // 50 % → alert
    b = await budget(ORG.q);
    expect(b.alert).toBe(true);
    expect(b.exceeded).toBe(false);

    await recordRun(ORG.q, { costNano: 1000 }); // 100 % → exceeded, remaining 0
    b = await budget(ORG.q);
    expect(b.exceeded).toBe(true);
    expect(b.remaining).toBe(0);

    const audit = await db.query<{ action: string; acting_as: string }>(
      "select action, acting_as from public.audit_events where entity_table = 'ai_budgets' and entity_org_id = $1 order by at desc limit 1",
      [ORG.q],
    );
    expect(audit[0]).toEqual({ action: "insert", acting_as: "platform_admin" });
  });

  it("a cap of 0 disables AI for the org (exceeded immediately)", async () => {
    await asUser(db, U.admin, () => db.query(`select app.set_ai_budget('${ORG.p}', 0::bigint)`));
    const b = await budget(ORG.p);
    expect(b.exceeded).toBe(true);
    // restore: replace the cap (no DELETE path exists by design)
    await asUser(db, U.admin, () =>
      db.query(`select app.set_ai_budget('${ORG.p}', ${DEFAULT_CAP}::bigint)`),
    );
    expect((await budget(ORG.p)).exceeded).toBe(false);
  });

  it("org owner may read their own budget status but not another org's; viewer may not; org owner cannot set budgets", async () => {
    expect((await budget(ORG.p, U.pOwner)).cap).toBe(DEFAULT_CAP);
    expect(
      await asUser(db, U.pOwner, () =>
        expectError(db, `select * from app.ai_budget_status('${ORG.q}', 1)`),
      ),
    ).toMatch(/not authorized/);
    expect(
      await asUser(db, U.pViewer, () =>
        expectError(db, `select * from app.ai_budget_status('${ORG.p}', 1)`),
      ),
    ).toMatch(/not authorized/);
    expect(
      await asUser(db, U.pOwner, () =>
        expectError(db, `select app.set_ai_budget('${ORG.p}', 1::bigint)`),
      ),
    ).toMatch(/platform admin/);
  });
});

describe("RLS — who can see the ledger and the caps", () => {
  const runsVisible = (uid: string) =>
    asUser(
      db,
      uid,
      async () =>
        new Set(
          (await db.query<{ org_id: string }>("select org_id from public.ai_runs")).map(
            (r) => r.org_id,
          ),
        ),
    );

  it("org P owner sees only P's runs; Q's owner only Q's; P's viewer none; unassigned operator none", async () => {
    expect(await runsVisible(U.pOwner)).toEqual(new Set([ORG.p]));
    expect(await runsVisible(U.qOwner)).toEqual(new Set([ORG.q]));
    expect(await runsVisible(U.pViewer)).toEqual(new Set());
    expect(await runsVisible(U.opUnassigned)).toEqual(new Set());
  });

  it("compliance reviewer and platform admin see every org's runs", async () => {
    for (const uid of [U.compliance, U.admin]) {
      const seen = await runsVisible(uid);
      expect(seen.has(ORG.p) && seen.has(ORG.q)).toBe(true);
    }
  });

  it("ai_budgets: owner sees own cap only, admin sees all, nobody but service_role/function writes", async () => {
    const own = await asUser(db, U.pOwner, () =>
      db.query<{ org_id: string }>("select org_id from public.ai_budgets"),
    );
    expect(own.map((r) => r.org_id)).toEqual([ORG.p]);
    const all = await asUser(db, U.admin, () =>
      db.query<{ org_id: string }>("select org_id from public.ai_budgets order by org_id"),
    );
    expect(all.map((r) => r.org_id)).toEqual([ORG.p, ORG.q].sort());
    expect(
      await asUser(db, U.admin, () =>
        expectError(db, `update public.ai_budgets set monthly_cap_nano_usd = 1`),
      ),
    ).toMatch(/permission denied/);
    expect(
      await asUser(db, U.admin, () => expectError(db, `delete from public.ai_budgets`)),
    ).toMatch(/permission denied/);
    expect(
      await asUser(
        db,
        null,
        () => expectError(db, `delete from public.ai_budgets`),
        "service_role",
      ),
    ).toMatch(/permission denied/);
  });

  it("org_id of a budget row is immutable even for service_role (owner guard)", async () => {
    expect(
      await asUser(
        db,
        null,
        () =>
          expectError(
            db,
            `update public.ai_budgets set org_id = '${ORG.q}' where org_id = '${ORG.p}'`,
          ),
        "service_role",
      ),
    ).toMatch(/immutable/);
  });
});
