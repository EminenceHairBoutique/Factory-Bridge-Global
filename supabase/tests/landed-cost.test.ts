/**
 * B-21 — fx_landed_cost (0011): FX rates as rows with the §2.5 lookup rule, freight estimates, person-only duty
 * assumptions, immutable comparison snapshots pinning exact fx rows and quotation versions, and validated landed-cost
 * scenarios where a partial total is never a number.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { applyMigrations, asUser, expectError, openDb, readSeed, type Db } from "./db.js";

const INTERNAL_ORG = "00000000-0000-4000-8000-000000000001";
const U = {
  aOwner: "d1d10000-0000-4000-8000-000000000001",
  aMember: "d1d10000-0000-4000-8000-000000000002",
  aViewer: "d1d10000-0000-4000-8000-000000000003",
  bOwner: "d2d20000-0000-4000-8000-000000000001",
  sOwner: "d3d30000-0000-4000-8000-000000000001",
  opA: "d9d90000-0000-4000-8000-000000000001",
  opOther: "d9d90000-0000-4000-8000-000000000002",
  admin: "d9d90000-0000-4000-8000-000000000003",
};
const ORG = {
  a: "d1d1d1d1-0000-4000-8000-000000000001",
  b: "d2d2d2d2-0000-4000-8000-000000000001",
  s: "d3d3d3d3-0000-4000-8000-000000000001",
};
const PROJ = {
  a: "d4d40000-0000-4000-8000-000000000001",
  b: "d4d40000-0000-4000-8000-000000000002",
};
const DOC = "d5d50000-0000-4000-8000-000000000001";
const SHA = "f".repeat(64);

let db: Db;
let sId = "";
let itemA = "";
let itemB = "";
let quoteA = "";
let quoteB = "";
let rateId = "";
let snapshotId = "";

const count = async (sql: string, params: unknown[] = []) =>
  Number(
    (await db.query<{ n: string }>(`select count(*)::text as n from (${sql}) q`, params))[0]!.n,
  );
const goods = (status = "sourced") => ({
  type: "goods",
  status,
  amount: 210,
  currency: "USD",
  source_ref: "tier:5000",
});
const scenario = (lines: unknown[], total: "complete" | "partial", landed: number | null) =>
  JSON.stringify({ lines, total_status: total, landed_total: landed });

beforeAll(async () => {
  db = await openDb();
  if (db.engine === "pglite") {
    await applyMigrations(db);
    await db.exec(readSeed());
  }
  const orgList = Object.values(ORG)
    .map((o) => `'${o}'`)
    .join(",");
  // shared-database hygiene: snapshots/scenarios/quotations are immutable → lift the triggers for the cleanup only
  await db.exec(`
    alter table public.landed_cost_scenarios disable trigger landed_cost_scenarios_immutable;
    alter table public.comparison_snapshots disable trigger comparison_snapshots_immutable;
    alter table public.quotations disable trigger quotations_immutable;
    alter table public.quote_tiers disable trigger quote_tiers_immutable;
    alter table public.quote_fees disable trigger quote_fees_immutable;
    delete from public.landed_cost_scenarios where org_id in (${orgList});
    delete from public.comparison_snapshots where org_id in (${orgList});
    delete from public.quote_visibility_grants where quotation_id in (select id from public.quotations where buyer_org_id in (${orgList}));
    delete from public.quote_status_events where quotation_id in (select id from public.quotations where buyer_org_id in (${orgList}));
    delete from public.quotation_states where quotation_id in (select id from public.quotations where buyer_org_id in (${orgList}));
    delete from public.quote_tiers where quotation_id in (select id from public.quotations where buyer_org_id in (${orgList}));
    delete from public.quote_fees where quotation_id in (select id from public.quotations where buyer_org_id in (${orgList}));
    delete from public.quotations where buyer_org_id in (${orgList});
    delete from public.quote_groups where buyer_org_id in (${orgList});
    alter table public.landed_cost_scenarios enable trigger landed_cost_scenarios_immutable;
    alter table public.comparison_snapshots enable trigger comparison_snapshots_immutable;
    alter table public.quotations enable trigger quotations_immutable;
    alter table public.quote_tiers enable trigger quote_tiers_immutable;
    alter table public.quote_fees enable trigger quote_fees_immutable;
    delete from public.document_access_log where document_id in (select id from public.documents where org_id in (${orgList}));
    delete from public.organizations where id in (${orgList});
  `);
  await db.exec(
    `alter table public.fx_rates disable trigger fx_rates_immutable; delete from public.fx_rates where source like 'test-%'; alter table public.fx_rates enable trigger fx_rates_immutable;`,
  );
  await db.exec(
    `delete from auth.users where id in (${Object.values(U)
      .map((u) => `'${u}'`)
      .join(",")})`,
  );
  await db.exec(
    `insert into auth.users (id, email) values ${Object.entries(U)
      .map(([k, id]) => `('${id}', 'lc-${k.toLowerCase()}@example.test')`)
      .join(",")}`,
  );
  await db.exec(`
    insert into public.organizations (id, org_type, legal_name, display_name) values
      ('${ORG.a}', 'buyer', 'Landed Buyer A', 'A'), ('${ORG.b}', 'buyer', 'Landed Buyer B', 'B'), ('${ORG.s}', 'supplier', '到岸供应商', 'S');
    insert into public.memberships (org_id, user_id, role) values
      ('${ORG.a}', '${U.aOwner}', 'owner'), ('${ORG.a}', '${U.aMember}', 'member'), ('${ORG.a}', '${U.aViewer}', 'viewer'),
      ('${ORG.b}', '${U.bOwner}', 'owner'), ('${ORG.s}', '${U.sOwner}', 'owner'),
      ('${INTERNAL_ORG}', '${U.opA}', 'operator'), ('${INTERNAL_ORG}', '${U.opOther}', 'operator'), ('${INTERNAL_ORG}', '${U.admin}', 'platform_admin');
    insert into public.supplier_profiles (org_id, legal_name_zh) values ('${ORG.s}', '到岸供应商有限公司');
    insert into public.sourcing_projects (id, org_id, name, created_by) values ('${PROJ.a}', '${ORG.a}', 'A landed', '${U.aOwner}'), ('${PROJ.b}', '${ORG.b}', 'B landed', '${U.bOwner}');
    insert into public.project_assignments (project_id, operator_user_id, role, assigned_by) values ('${PROJ.a}', '${U.opA}', 'lead', '${U.admin}');
  `);
  sId = (
    await db.query<{ id: string }>("select id from public.supplier_profiles where org_id = $1", [
      ORG.s,
    ])
  )[0]!.id;
  const labels = (
    await db.query<{ id: string }>(
      "select id from public.product_taxonomy where code = 'packaging.labels_roll'",
    )
  )[0]!.id;
  for (const [proj, by, setter] of [
    [PROJ.a, U.aOwner, (id: string) => (itemA = id)],
    [PROJ.b, U.bOwner, (id: string) => (itemB = id)],
  ] as const) {
    const brief = (
      await db.query<{ id: string }>(
        "insert into public.buyer_briefs (project_id, raw_input_en, created_by) values ($1, '5k labels', $2) returning id",
        [proj, by],
      )
    )[0]!.id;
    setter(
      (
        await db.query<{ id: string }>(
          "insert into public.brief_items (brief_id, line_no, taxonomy_id, quantity, quantity_unit) values ($1, 1, $2, 5000, 'pcs') returning id",
          [brief, labels],
        )
      )[0]!.id,
    );
  }
  await db.exec(
    `insert into public.project_suppliers (project_id, supplier_id, added_by) values ('${PROJ.a}', '${sId}', '${U.opA}')`,
  );
  await db.exec(
    `insert into public.documents (id, org_id, project_id, uploaded_by, source_type, rights_class, storage_path, original_filename, mime, bytes)
     values ('${DOC}', '${ORG.a}', '${PROJ.a}', '${U.aOwner}', 'buyer_upload', 'buyer_uploaded_private', '${ORG.a}/${DOC}/freight-quote.pdf', 'freight-quote.pdf', 'application/pdf', 100)`,
  );
  await asUser(
    db,
    null,
    async () => {
      await db.exec(`update public.documents set status = 'scanning' where id = '${DOC}'`);
      await db.exec(
        `update public.documents set status = 'parsed', sha256 = '${SHA}', storage_bucket = 'documents' where id = '${DOC}'`,
      );
    },
    "service_role",
  );
  const payload = (buyer: string, item: string) =>
    JSON.stringify({
      supplier_id: sId,
      buyer_org_id: buyer,
      brief_item_id: item,
      quote_type: "negotiated_private",
      rights_class: "customer_private_quote",
      source_type: "operator_import",
      price_basis: "FOB",
      basis_confirmed: true,
      currency: "USD",
      quantity_unit: "pcs",
      quote_date: "2026-11-01",
      valid_until: "2026-12-31",
      tiers: [{ min_qty: 1000, unit_price: 0.042 }],
    });
  quoteA = await asUser(
    db,
    U.aOwner,
    async () =>
      (
        await db.query<{ id: string }>(
          "select app.supersede_quotation(null, $1::jsonb, 'fixture', 'lc-key-a-000001') as id",
          [payload(ORG.a, itemA)],
        )
      )[0]!.id,
  );
  // B's quote exists but is invisible to A (S is not shortlisted on B's project, so opA cannot see it either)
  quoteB = await asUser(
    db,
    U.bOwner,
    async () =>
      (
        await db.query<{ id: string }>(
          "select app.supersede_quotation(null, $1::jsonb, 'fixture', 'lc-key-b-000001') as id",
          [payload(ORG.b, itemB)],
        )
      )[0]!.id,
  );
});

afterAll(async () => {
  await db.close();
});

describe("fx_rates", () => {
  it("the worker and a platform admin write rates; buyers/operators cannot; rows are unique per day+source and immutable; everyone reads", async () => {
    await asUser(
      db,
      null,
      async () => {
        rateId = (
          await db.query<{ id: string }>(
            "insert into public.fx_rates (base, quote, rate, rate_date, source) values ('USD', 'CNY', 7.1234, '2026-11-05', 'test-ecb') returning id",
          )
        )[0]!.id;
        await db.exec(
          "insert into public.fx_rates (base, quote, rate, rate_date, source) values ('USD', 'CNY', 7.1100, '2026-11-01', 'test-ecb')",
        );
        expect(
          await expectError(
            db,
            "insert into public.fx_rates (base, quote, rate, rate_date, source) values ('USD', 'CNY', 7.2, '2026-11-05', 'test-ecb')",
          ),
        ).toMatch(/duplicate|unique/);
        expect(
          await expectError(
            db,
            "insert into public.fx_rates (base, quote, rate, rate_date, source) values ('USD', 'USD', 1, '2026-11-05', 'test-ecb')",
          ),
        ).toMatch(/check/);
        expect(
          await expectError(
            db,
            "insert into public.fx_rates (base, quote, rate, rate_date, source) values ('USD', 'CNY', 0, '2026-11-06', 'test-ecb')",
          ),
        ).toMatch(/check/);
      },
      "service_role",
    );
    for (const u of [U.aOwner, U.opA, U.sOwner]) {
      await asUser(db, u, async () => {
        expect(
          await expectError(
            db,
            "insert into public.fx_rates (base, quote, rate, rate_date, source) values ('USD', 'CNY', 7, '2026-11-06', 'test-manual')",
          ),
          u,
        ).toMatch(/row-level security/);
        expect(await count("select 1 from public.fx_rates where id = $1", [rateId]), u).toBe(1);
      });
    }
    await asUser(db, U.admin, async () => {
      const r = await db.query<{ by: string }>(
        "insert into public.fx_rates (base, quote, rate, rate_date, source) values ('USD', 'CNY', 7.1300, '2026-11-05', 'test-manual-correction') returning recorded_by as by",
      );
      expect(r[0]!.by).toBe(U.admin);
    });
    expect(
      await expectError(db, "update public.fx_rates set rate = 1 where id = $1", [rateId]),
    ).toMatch(/immutable/);
    expect(await expectError(db, "delete from public.fx_rates where id = $1", [rateId])).toMatch(
      /immutable/,
    );
  });

  it("app.fx_rate_for: exact day, else latest prior within 3 days, else null (missing_fx)", async () => {
    const pick = async (asOf: string, lag?: number) =>
      (
        await db.query<{ id: string | null; d: string | null }>(
          "select r.id, r.rate_date::text as d from app.fx_rate_for('USD', 'CNY', $1::date, coalesce($2::int, 3)) f left join public.fx_rates r on r.id = f",
          [asOf, lag ?? null],
        )
      )[0];
    expect((await pick("2026-11-05"))?.d).toBe("2026-11-05");
    expect((await pick("2026-11-07"))?.d).toBe("2026-11-05"); // 2 days lag
    expect((await pick("2026-11-08"))?.d).toBe("2026-11-05"); // 3 days lag, still allowed
    expect((await pick("2026-11-09"))?.d ?? null).toBeNull(); // 4 days → missing_fx
    expect((await pick("2026-11-09", 10))?.d).toBe("2026-11-05");
    expect((await pick("2026-11-03"))?.d).toBe("2026-11-01");
    expect((await pick("2026-10-31"))?.d ?? null).toBeNull(); // nothing before
    expect(
      (
        await db.query<{ f: string | null }>(
          "select app.fx_rate_for('EUR', 'CNY', '2026-11-05') as f",
        )
      )[0]!.f,
    ).toBeNull();
  });
});

describe("freight_estimates", () => {
  it("members and assigned operators record estimates for their project; `sourced` needs a document; viewers read; B and others see nothing", async () => {
    await asUser(db, U.aMember, async () => {
      expect(
        await expectError(
          db,
          "insert into public.freight_estimates (project_id, origin, destination, mode, provider_or_manual, amount, currency, status) values ($1, 'Shenzhen', 'Newark NJ', 'sea_lcl', 'manual', 480, 'USD', 'sourced')",
          [PROJ.a],
        ),
      ).toMatch(/check/);
      expect(
        await expectError(
          db,
          "insert into public.freight_estimates (project_id, origin, destination, mode, provider_or_manual, amount, currency) values ($1, 'Shenzhen', 'Newark NJ', 'sea_lcl', 'provider', 480, 'USD')",
          [PROJ.a],
        ),
      ).toMatch(/check/); // provider needs a name
      await db.exec(
        `insert into public.freight_estimates (project_id, origin, destination, mode, provider_or_manual, amount, currency, valid_until) values ('${PROJ.a}', 'Shenzhen', 'Newark NJ', 'sea_lcl', 'manual', 480, 'USD', '2026-12-15')`,
      );
      await db.exec(
        `insert into public.freight_estimates (project_id, origin, destination, mode, provider_or_manual, provider_name, amount, currency, document_id, status) values ('${PROJ.a}', 'Shenzhen', 'Newark NJ', 'air', 'provider', 'Test Forwarder', 1450, 'USD', '${DOC}', 'sourced')`,
      );
      expect(
        await expectError(
          db,
          "insert into public.freight_estimates (project_id, origin, destination, mode, provider_or_manual, amount, currency) values ($1, 'x', 'y', 'air', 'manual', 1, 'USD')",
          [PROJ.b],
        ),
      ).toMatch(/row-level security/);
    });
    await asUser(db, U.opA, async () => {
      await db.exec(
        `update public.freight_estimates set amount = 500 where project_id = '${PROJ.a}' and mode = 'sea_lcl'`,
      );
    });
    for (const [u, n] of [
      [U.aViewer, 2],
      [U.opA, 2],
      [U.bOwner, 0],
      [U.opOther, 0],
      [U.sOwner, 0],
    ] as const) {
      await asUser(db, u, async () => {
        expect(
          await count("select 1 from public.freight_estimates where project_id = $1", [PROJ.a]),
          u,
        ).toBe(n);
      });
    }
    await asUser(db, U.aViewer, async () => {
      await db.exec(
        `update public.freight_estimates set amount = 1 where project_id = '${PROJ.a}'`,
      ); // 0 rows
    });
    expect(
      (
        await db.query<{ a: string }>(
          "select amount::text as a from public.freight_estimates where project_id = $1 and mode = 'sea_lcl'",
          [PROJ.a],
        )
      )[0]!.a,
    ).toBe("500.00");
  });
});

describe("duty_assumptions (a person, with a basis)", () => {
  it("a job cannot insert one; a rate needs a basis; HTS format is checked; broker review needs a name; isolation holds", async () => {
    await asUser(
      db,
      null,
      async () => {
        expect(
          await expectError(
            db,
            "insert into public.duty_assumptions (project_id, hts_candidate, rate_pct, basis, created_by) values ($1, '4821.10.20', 0, 'operator_lookup', $2)",
            [PROJ.a, U.opA],
          ),
        ).toMatch(/recorded by a person/);
      },
      "service_role",
    );
    await asUser(db, U.aOwner, async () => {
      expect(
        await expectError(
          db,
          "insert into public.duty_assumptions (project_id, rate_pct, basis) values ($1, 3.5, 'unverified')",
          [PROJ.a],
        ),
      ).toMatch(/check/);
      expect(
        await expectError(
          db,
          "insert into public.duty_assumptions (project_id, hts_candidate, basis) values ($1, '4821-10-20', 'unverified')",
          [PROJ.a],
        ),
      ).toMatch(/check/);
      expect(
        await expectError(
          db,
          "insert into public.duty_assumptions (project_id, basis, reviewed_by_broker) values ($1, 'broker_advice', true)",
          [PROJ.a],
        ),
      ).toMatch(/check/);
      expect(
        await expectError(
          db,
          "insert into public.duty_assumptions (project_id, brief_item_id, basis) values ($1, $2, 'unverified')",
          [PROJ.a, itemB],
        ),
      ).toMatch(/must belong to project_id/);
      const r = await db.query<{ by: string; org: string }>(
        "insert into public.duty_assumptions (project_id, brief_item_id, hts_candidate, rate_pct, basis, notes) values ($1, $2, '4821.10.20', 0, 'operator_lookup', 'paper labels, printed — candidate only') returning created_by as by, org_id as org",
        [PROJ.a, itemA],
      );
      expect(r[0]).toEqual({ by: U.aOwner, org: ORG.a });
      expect(
        await expectError(
          db,
          "update public.duty_assumptions set created_by = $2 where project_id = $1",
          [PROJ.a, U.opA],
        ),
      ).toMatch(/immutable|cannot be changed/i);
    });
    for (const [u, n] of [
      [U.opA, 1],
      [U.aViewer, 1],
      [U.bOwner, 0],
      [U.opOther, 0],
    ] as const) {
      await asUser(db, u, async () => {
        expect(
          await count("select 1 from public.duty_assumptions where project_id = $1", [PROJ.a]),
          u,
        ).toBe(n);
      });
    }
  });
});

describe("comparison_snapshots + landed_cost_scenarios", () => {
  it("a member records a snapshot pinning real fx rows; unknown fx ids, foreign brief items and bad hashes are rejected; snapshots are immutable", async () => {
    await asUser(db, U.aMember, async () => {
      expect(
        await expectError(
          db,
          "insert into public.comparison_snapshots (brief_item_id, quantity, quantity_unit, as_of, inputs_hash, engine_version, fx_rate_ids, result) values ($1, 5000, 'pcs', '2026-11-07', $2, 'qe-0.1.0', array['00000000-0000-4000-8000-0000000000ff']::uuid[], '{}')",
          [itemA, SHA],
        ),
      ).toMatch(/unknown rate/);
      expect(
        await expectError(
          db,
          "insert into public.comparison_snapshots (brief_item_id, quantity, quantity_unit, as_of, inputs_hash, engine_version, result) values ($1, 5000, 'pcs', '2026-11-07', 'nothex', 'qe-0.1.0', '{}')",
          [itemA],
        ),
      ).toMatch(/check/);
      expect(
        await expectError(
          db,
          "insert into public.comparison_snapshots (brief_item_id, quantity, quantity_unit, as_of, inputs_hash, engine_version, result) values ($1, 5000, 'pcs', '2026-11-07', $2, 'qe-0.1.0', '{}')",
          [itemB, SHA],
        ),
      ).toMatch(/row-level security/);
      snapshotId = (
        await db.query<{ id: string; org: string; proj: string }>(
          "insert into public.comparison_snapshots (brief_item_id, quantity, quantity_unit, as_of, inputs_hash, engine_version, fx_rate_ids, result) values ($1, 5000, 'pcs', '2026-11-07', $2, 'qe-0.1.0', array[$3]::uuid[], '{\"ranked\":[],\"groups\":1}') returning id, org_id as org, project_id as proj",
          [itemA, SHA, rateId],
        )
      )[0]!.id;
    });
    const s = await db.query<{ org: string; proj: string }>(
      "select org_id as org, project_id as proj from public.comparison_snapshots where id = $1",
      [snapshotId],
    );
    expect(s[0]).toEqual({ org: ORG.a, proj: PROJ.a });
    expect(
      await expectError(db, "update public.comparison_snapshots set result = '{}' where id = $1", [
        snapshotId,
      ]),
    ).toMatch(/immutable/);
    expect(
      await expectError(db, "delete from public.comparison_snapshots where id = $1", [snapshotId]),
    ).toMatch(/immutable/);
  });

  it("scenario lines are validated; complete needs no missing line; partial never carries a total; the quotation must be visible to the writer", async () => {
    const ins = (body: string, quotation = quoteA) =>
      expectError(
        db,
        `insert into public.landed_cost_scenarios (comparison_snapshot_id, quotation_id, lines, total_status, goods_total, goods_currency, landed_total, landed_currency)
         select $1, $2, (b->'lines'), b->>'total_status', 210, 'USD', (b->>'landed_total')::numeric, case when b->>'landed_total' is null then null else 'USD' end
           from (select $3::jsonb as b) x`,
        [snapshotId, quotation, body],
      );
    await asUser(db, U.aMember, async () => {
      expect(
        await ins(scenario([goods(), { type: "teleport", status: "missing" }], "partial", null)),
      ).toMatch(/unknown landed-cost line type/);
      expect(
        await ins(
          scenario([goods(), { type: "international_freight", status: "maybe" }], "partial", null),
        ),
      ).toMatch(/invalid status/);
      expect(
        await ins(
          scenario(
            [goods(), { type: "international_freight", status: "estimated", currency: "USD" }],
            "complete",
            700,
          ),
        ),
      ).toMatch(/needs a non-negative amount/);
      expect(
        await ins(
          scenario([{ type: "international_freight", status: "missing" }], "partial", null),
        ),
      ).toMatch(/always carries a goods line/);
      expect(
        await ins(
          scenario(
            [goods(), { type: "international_freight", status: "missing" }],
            "complete",
            700,
          ),
        ),
      ).toMatch(/cannot be complete while 1 line/);
      expect(
        await ins(
          scenario([goods(), { type: "international_freight", status: "missing" }], "partial", 700),
        ),
      ).toMatch(/check/); // partial with a number
      expect(
        await ins(
          scenario(
            [
              goods(),
              { type: "international_freight", status: "estimated", amount: 480, currency: "USD" },
            ],
            "partial",
            null,
          ),
        ),
      ).toMatch(/partial requires at least one missing/);
      expect(await ins(scenario([goods()], "complete", 210), quoteB)).toMatch(
        /not visible to the writer/,
      );
      // a real partial scenario (freight missing) and a complete one
      expect(
        await ins(
          scenario(
            [
              goods(),
              { type: "international_freight", status: "missing" },
              {
                type: "duties_taxes",
                status: "estimated",
                amount: 0,
                currency: "USD",
                assumption: "duty_assumptions:4821.10.20@0%",
              },
            ],
            "partial",
            null,
          ),
        ),
      ).toBeNull();
    });
    // a second scenario for the same quotation in the same snapshot is a duplicate; complete one for a second snapshot instead
    await asUser(db, U.aMember, async () => {
      expect(await ins(scenario([goods()], "complete", 210))).toMatch(/duplicate|unique/);
    });
    const rows = await db.query<{ eligible: boolean; total: string | null; status: string }>(
      "select eligible_for_ranking as eligible, landed_total::text as total, total_status as status from public.landed_cost_scenarios where comparison_snapshot_id = $1",
      [snapshotId],
    );
    expect(rows).toEqual([{ eligible: false, total: null, status: "partial" }]);
    expect(
      await expectError(
        db,
        "update public.landed_cost_scenarios set landed_total = 1 where comparison_snapshot_id = $1",
        [snapshotId],
      ),
    ).toMatch(/immutable/);
    for (const [u, n] of [
      [U.aViewer, 1],
      [U.opA, 1],
      [U.bOwner, 0],
      [U.opOther, 0],
      [U.sOwner, 0],
    ] as const) {
      await asUser(db, u, async () => {
        expect(
          await count("select 1 from public.comparison_snapshots where id = $1", [snapshotId]),
          u,
        ).toBe(n);
        expect(
          await count(
            "select 1 from public.landed_cost_scenarios where comparison_snapshot_id = $1",
            [snapshotId],
          ),
          u,
        ).toBe(n);
      });
    }
  });

  it("a complete scenario is rankable and carries its total; the snapshot keeps pointing at the exact fx row and quotation version after a supersede", async () => {
    let snap2 = "";
    await asUser(db, U.opA, async () => {
      snap2 = (
        await db.query<{ id: string }>(
          "insert into public.comparison_snapshots (brief_item_id, quantity, quantity_unit, as_of, inputs_hash, engine_version, fx_rate_ids, result) values ($1, 5000, 'pcs', '2026-11-07', $2, 'qe-0.1.0', array[$3]::uuid[], '{\"ranked\":[1]}') returning id",
          [itemA, "e".repeat(64), rateId],
        )
      )[0]!.id;
      await db.exec(
        `insert into public.landed_cost_scenarios (comparison_snapshot_id, quotation_id, lines, total_status, goods_total, goods_currency, landed_total, landed_currency, explanations)
         values ('${snap2}', '${quoteA}', '[{"type":"goods","status":"sourced","amount":210,"currency":"USD"},{"type":"international_freight","status":"estimated","amount":480,"currency":"USD","source_ref":"freight_estimates:sea_lcl"},{"type":"insurance","status":"not_applicable"},{"type":"duties_taxes","status":"estimated","amount":0,"currency":"USD"}]', 'complete', 210, 'USD', 690.00, 'USD', '{estimated:international_freight,estimated:duties_taxes}')`,
      );
    });
    const r = await db.query<{ eligible: boolean; total: string }>(
      "select eligible_for_ranking as eligible, landed_total::text as total from public.landed_cost_scenarios where comparison_snapshot_id = $1",
      [snap2],
    );
    expect(r[0]).toEqual({ eligible: true, total: "690.00" });
    // supersede the quotation: the scenario still references version 1 (restrict FK), and the old version is still readable
    const v2 = await asUser(
      db,
      U.aOwner,
      async () =>
        (
          await db.query<{ id: string }>(
            "select app.supersede_quotation($1, $2::jsonb, 'price revised', 'lc-key-a-000002') as id",
            [
              quoteA,
              JSON.stringify({
                rights_class: "customer_private_quote",
                source_type: "operator_import",
                price_basis: "FOB",
                basis_confirmed: true,
                currency: "USD",
                quantity_unit: "pcs",
                quote_date: "2026-11-07",
                valid_until: "2027-01-31",
                tiers: [{ min_qty: 1000, unit_price: 0.04 }],
              }),
            ],
          )
        )[0]!.id,
    );
    expect(v2).not.toBe(quoteA);
    const pinned = await db.query<{ q: string; st: string }>(
      "select s.quotation_id as q, qs.status::text as st from public.landed_cost_scenarios s join public.quotation_states qs on qs.quotation_id = s.quotation_id where s.comparison_snapshot_id = $1",
      [snap2],
    );
    expect(pinned[0]).toEqual({ q: quoteA, st: "superseded" });
  });
});

describe("grant layer", () => {
  it("no DELETE for authenticated; no UPDATE on snapshots/scenarios/fx", async () => {
    await asUser(db, U.admin, async () => {
      for (const t of [
        "fx_rates",
        "freight_estimates",
        "duty_assumptions",
        "comparison_snapshots",
        "landed_cost_scenarios",
      ]) {
        expect(await expectError(db, `delete from public.${t}`), t).toMatch(/permission denied/);
      }
      for (const t of ["fx_rates", "comparison_snapshots", "landed_cost_scenarios"]) {
        expect(await expectError(db, `update public.${t} set id = id`), t).toMatch(
          /permission denied/,
        );
      }
    });
  });
});
