/**
 * B-20 — quotations (0009): immutable versions, tier exclusion, lifecycle only through functions (mirroring the domain
 * transition table), Pattern-C visibility (owner / assigned operator / supplier / grant / catalog permission), and
 * version-exact visibility grants.
 */
import { QUOTE_STATUSES, type QuoteStatus } from "@fbg/domain/enums";
import { canTransition, type TransitionActor } from "@fbg/domain";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { applyMigrations, asUser, expectError, openDb, readSeed, type Db } from "./db.js";

const INTERNAL_ORG = "00000000-0000-4000-8000-000000000001";
const U = {
  aOwner: "c1000000-0000-4000-8000-000000000001",
  aMember: "c1000000-0000-4000-8000-000000000002",
  aViewer: "c1000000-0000-4000-8000-000000000003",
  bOwner: "c2000000-0000-4000-8000-000000000001",
  sOwner: "c3000000-0000-4000-8000-000000000001",
  s2Owner: "c3000000-0000-4000-8000-000000000002",
  opA: "c9000000-0000-4000-8000-000000000001",
  opOther: "c9000000-0000-4000-8000-000000000002",
  admin: "c9000000-0000-4000-8000-000000000003",
};
const ORG = {
  a: "c1c1c1c1-0000-4000-8000-000000000001",
  b: "c2c2c2c2-0000-4000-8000-000000000001",
  s: "c3c3c3c3-0000-4000-8000-000000000001",
  s2: "c3c3c3c3-0000-4000-8000-000000000002",
};
const PROJ = "c4000000-0000-4000-8000-000000000001";
const DOC = "c5000000-0000-4000-8000-000000000001";

let db: Db;
let sId = "";
let itemId = "";
let v1 = "";
let v2 = "";
let catalogQ = "";

const count = async (sql: string, params: unknown[] = []) =>
  Number(
    (await db.query<{ n: string }>(`select count(*)::text as n from (${sql}) q`, params))[0]!.n,
  );
const state = async (id: string) =>
  (
    await db.query<{
      status: string;
      is_current: boolean;
      superseded_by: string | null;
      state_version: number;
    }>(
      "select status::text as status, is_current, superseded_by, state_version from public.quotation_states where quotation_id = $1",
      [id],
    )
  )[0]!;
const payload = (over: Record<string, unknown> = {}) =>
  JSON.stringify({
    supplier_id: sId,
    buyer_org_id: ORG.a,
    brief_item_id: itemId,
    quote_type: "negotiated_private",
    rights_class: "customer_private_quote",
    source_type: "operator_import",
    document_id: DOC,
    price_basis: "FOB",
    incoterm_place: "Shenzhen",
    basis_confirmed: true,
    currency: "USD",
    quantity_unit: "pcs",
    moq: 5000,
    production_lead_days: 15,
    payment_terms: "30% deposit, 70% before shipment",
    quote_date: "2026-11-01",
    valid_until: "2026-12-31",
    tiers: [
      {
        min_qty: 5000,
        max_qty: 20000,
        unit_price: 0.042,
        price_includes: ["printing", "lamination"],
      },
      { min_qty: 20000, max_qty: null, unit_price: 0.038 },
    ],
    fees: [{ fee_type: "plate", amount: 80, is_one_time: true }],
    ...over,
  });
const supersede = (
  uid: string | null,
  old: string | null,
  body: string,
  reason: string,
  key: string,
  role?: "service_role",
) =>
  asUser(
    db,
    uid,
    async () =>
      (
        await db.query<{ id: string }>(
          "select app.supersede_quotation($1, $2::jsonb, $3, $4) as id",
          [old, body, reason, key],
        )
      )[0]!.id,
    role,
  );
const transition = (
  uid: string | null,
  q: string,
  to: string,
  reason: string,
  key: string,
  role?: "service_role",
) =>
  asUser(
    db,
    uid,
    () =>
      expectError(db, "select app.transition_quotation($1, $2::public.quote_status, $3, $4)", [
        q,
        to,
        reason,
        key,
      ]),
    role,
  );

beforeAll(async () => {
  db = await openDb();
  if (db.engine === "pglite") {
    await applyMigrations(db);
    await db.exec(readSeed());
  }
  const orgList = Object.values(ORG)
    .map((o) => `'${o}'`)
    .join(",");
  // shared-database hygiene: quotations/tiers are immutable (no delete even for superuser via trigger), so a previous
  // run's rows are removed by disabling the immutability triggers for the cleanup only
  await db.exec(`
    alter table public.quotations disable trigger quotations_immutable;
    alter table public.quote_tiers disable trigger quote_tiers_immutable;
    alter table public.quote_fees disable trigger quote_fees_immutable;
    delete from public.quote_visibility_grants where quotation_id in (select id from public.quotations where supplier_id in (select id from public.supplier_profiles where org_id in (${orgList})));
    delete from public.quote_status_events where quotation_id in (select id from public.quotations where supplier_id in (select id from public.supplier_profiles where org_id in (${orgList})));
    delete from public.quotation_states where quotation_id in (select id from public.quotations where supplier_id in (select id from public.supplier_profiles where org_id in (${orgList})));
    delete from public.quote_tiers where quotation_id in (select id from public.quotations where supplier_id in (select id from public.supplier_profiles where org_id in (${orgList})));
    delete from public.quote_fees where quotation_id in (select id from public.quotations where supplier_id in (select id from public.supplier_profiles where org_id in (${orgList})));
    delete from public.quotations where supplier_id in (select id from public.supplier_profiles where org_id in (${orgList}));
    delete from public.quote_groups where supplier_id in (select id from public.supplier_profiles where org_id in (${orgList}));
    alter table public.quotations enable trigger quotations_immutable;
    alter table public.quote_tiers enable trigger quote_tiers_immutable;
    alter table public.quote_fees enable trigger quote_fees_immutable;
    delete from public.document_access_log where document_id in (select id from public.documents where org_id in (${orgList}));
    delete from public.organizations where id in (${orgList});
  `);
  await db.exec(
    `delete from auth.users where id in (${Object.values(U)
      .map((u) => `'${u}'`)
      .join(",")})`,
  );
  await db.exec(
    `insert into auth.users (id, email) values ${Object.entries(U)
      .map(([k, id]) => `('${id}', 'quo-${k.toLowerCase()}@example.test')`)
      .join(",")}`,
  );
  await db.exec(`
    insert into public.organizations (id, org_type, legal_name, display_name) values
      ('${ORG.a}', 'buyer', 'Quote Buyer A', 'A'), ('${ORG.b}', 'buyer', 'Quote Buyer B', 'B'),
      ('${ORG.s}', 'supplier', '报价供应商', 'S'), ('${ORG.s2}', 'supplier', '另一报价供应商', 'S2');
    insert into public.memberships (org_id, user_id, role) values
      ('${ORG.a}', '${U.aOwner}', 'owner'), ('${ORG.a}', '${U.aMember}', 'member'), ('${ORG.a}', '${U.aViewer}', 'viewer'),
      ('${ORG.b}', '${U.bOwner}', 'owner'), ('${ORG.s}', '${U.sOwner}', 'owner'), ('${ORG.s2}', '${U.s2Owner}', 'owner'),
      ('${INTERNAL_ORG}', '${U.opA}', 'operator'), ('${INTERNAL_ORG}', '${U.opOther}', 'operator'),
      ('${INTERNAL_ORG}', '${U.admin}', 'platform_admin');
    insert into public.supplier_profiles (org_id, legal_name_zh) values ('${ORG.s}', '报价供应商有限公司'), ('${ORG.s2}', '另一报价供应商有限公司');
    insert into public.sourcing_projects (id, org_id, name, created_by) values ('${PROJ}', '${ORG.a}', 'Label project', '${U.aOwner}');
    insert into public.project_assignments (project_id, operator_user_id, role, assigned_by) values ('${PROJ}', '${U.opA}', 'lead', '${U.admin}');
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
  const brief = (
    await db.query<{ id: string }>(
      "insert into public.buyer_briefs (project_id, raw_input_en, created_by) values ($1, '5k roll labels', $2) returning id",
      [PROJ, U.aOwner],
    )
  )[0]!.id;
  itemId = (
    await db.query<{ id: string }>(
      "insert into public.brief_items (brief_id, line_no, taxonomy_id, quantity, quantity_unit) values ($1, 1, $2, 5000, 'pcs') returning id",
      [brief, labels],
    )
  )[0]!.id;
  await db.exec(
    `insert into public.project_suppliers (project_id, supplier_id, added_by) values ('${PROJ}', '${sId}', '${U.opA}')`,
  );
  await db.exec(
    `insert into public.documents (id, org_id, project_id, uploaded_by, source_type, rights_class, storage_path, original_filename, mime, bytes)
     values ('${DOC}', '${ORG.a}', '${PROJ}', '${U.aOwner}', 'buyer_upload', 'buyer_uploaded_private', '${ORG.a}/${DOC}/quote.pdf', 'quote.pdf', 'application/pdf', 100)`,
  );
});

afterAll(async () => {
  await db.close();
});

describe("transition table parity with packages/domain lifecycle.ts", () => {
  it("app.quote_transition_allowed agrees with canTransition for every (from, to, actor, via)", async () => {
    const actors: TransitionActor[] = [
      "reviewer",
      "assigned_operator",
      "supplier_owner",
      "system",
      "platform_admin",
    ];
    const mismatches: string[] = [];
    for (const from of QUOTE_STATUSES as readonly QuoteStatus[]) {
      for (const to of QUOTE_STATUSES as readonly QuoteStatus[]) {
        for (const actor of actors) {
          for (const via of [false, true]) {
            const sql = (
              await db.query<{ v: string }>(
                "select app.quote_transition_allowed($1::public.quote_status, $2::public.quote_status, $3, $4) as v",
                [from, to, actor, via],
              )
            )[0]!.v;
            const ts = canTransition(from, to, actor);
            const expected = ts.allowed
              ? ts.viaSupersedeOnly && !via
                ? "via_supersede_only"
                : "ok"
              : ts.reason;
            if (sql !== expected)
              mismatches.push(`${from}->${to} ${actor} via=${via}: sql=${sql} ts=${expected}`);
          }
        }
      }
    }
    expect(mismatches).toEqual([]);
  });
});

describe("version 1 via app.supersede_quotation", () => {
  it("a buyer member confirms v1; payload CHECKs and tier exclusion reject bad quotes; viewers and foreign buyers cannot", async () => {
    await asUser(db, U.aViewer, async () => {
      expect(
        await expectError(
          db,
          "select app.supersede_quotation(null, $1::jsonb, 'viewer try', 'key-viewer-0001')",
          [payload()],
        ),
      ).toMatch(/not permitted/);
    });
    await asUser(db, U.bOwner, async () => {
      expect(
        await expectError(
          db,
          "select app.supersede_quotation(null, $1::jsonb, 'B try', 'key-b-00000001')",
          [payload()],
        ),
      ).toMatch(/not permitted/);
    });
    await asUser(db, U.aMember, async () => {
      expect(
        await expectError(
          db,
          "select app.supersede_quotation(null, $1::jsonb, 'test reason', 'key-tiers-0001')",
          [payload({ tiers: [] })],
        ),
      ).toMatch(/tiers must be a non-empty array/);
      expect(
        await expectError(
          db,
          "select app.supersede_quotation(null, $1::jsonb, 'test reason', 'key-tiers-0002')",
          [
            payload({
              tiers: [
                { min_qty: 100, max_qty: 600, unit_price: 1 },
                { min_qty: 500, max_qty: 2000, unit_price: 0.9 },
              ],
            }),
          ],
        ),
      ).toMatch(/quote_tiers_no_overlap|exclusion/);
      expect(
        await expectError(
          db,
          "select app.supersede_quotation(null, $1::jsonb, 'test reason', 'key-basis-0001')",
          [payload({ price_basis: "unknown", basis_confirmed: true })],
        ),
      ).toMatch(/check/);
      expect(
        await expectError(
          db,
          "select app.supersede_quotation(null, $1::jsonb, 'test reason', 'key-rights-001')",
          [payload({ rights_class: "internal_market_observation" })],
        ),
      ).toMatch(/check/);
      expect(
        await expectError(
          db,
          "select app.supersede_quotation(null, $1::jsonb, 'test reason', 'key-valid-0001')",
          [payload({ valid_until: "2026-10-01" })],
        ),
      ).toMatch(/check/);
      expect(
        await expectError(
          db,
          "select app.supersede_quotation(null, $1::jsonb, 'test reason', 'key-buyer-0001')",
          [payload({ buyer_org_id: ORG.b })],
        ),
      ).toMatch(/owns brief_item_id/);
      expect(
        await expectError(
          db,
          "select app.supersede_quotation(null, $1::jsonb, 'test reason', 'short')",
          [payload()],
        ),
      ).toMatch(/idempotency_key/);
      expect(
        await expectError(
          db,
          "select app.supersede_quotation(null, $1::jsonb, '', 'key-reason-0001')",
          [payload()],
        ),
      ).toMatch(/reason/);
    });
    v1 = await supersede(
      U.aMember,
      null,
      payload(),
      "review accepted: matches supplier PDF p.1",
      "key-v1-00000001",
    );
    expect(v1).toBeTruthy();
    expect(await state(v1)).toMatchObject({
      status: "confirmed",
      is_current: true,
      superseded_by: null,
    });
    expect(await count("select 1 from public.quote_tiers where quotation_id = $1", [v1])).toBe(2);
    expect(await count("select 1 from public.quote_fees where quotation_id = $1", [v1])).toBe(1);
    const ev = await db.query<{ from_status: string | null; to_status: string; acting_as: string }>(
      "select from_status::text as from_status, to_status::text as to_status, acting_as from public.quote_status_events where quotation_id = $1",
      [v1],
    );
    expect(ev).toEqual([{ from_status: null, to_status: "confirmed", acting_as: "member" }]);
    // touching tier bounds are fine: [5000,20000) + [20000,∞)
    const q = await db.query<{ v: number; basis: string; confirmed_by: string }>(
      "select version as v, price_basis::text as basis, confirmed_by from public.quotations where id = $1",
      [v1],
    );
    expect(q[0]).toEqual({ v: 1, basis: "FOB", confirmed_by: U.aMember });
  });

  it("the same idempotency key returns the same id without a second version; a second v1 for the thread is refused", async () => {
    const again = await supersede(U.aMember, null, payload(), "retry", "key-v1-00000001");
    expect(again).toBe(v1);
    expect(await count("select 1 from public.quotations where supplier_id = $1", [sId])).toBe(1);
    await asUser(db, U.aMember, async () => {
      expect(
        await expectError(
          db,
          "select app.supersede_quotation(null, $1::jsonb, 'dup', 'key-v1-dup-0001')",
          [payload()],
        ),
      ).toMatch(/already has a current version/);
    });
  });

  it("quotations, tiers and fees are immutable for everyone; authenticated has no write grant at all", async () => {
    expect(
      await expectError(db, "update public.quotations set currency = 'CNY' where id = $1", [v1]),
    ).toMatch(/immutable/);
    expect(
      await expectError(db, "delete from public.quote_tiers where quotation_id = $1", [v1]),
    ).toMatch(/immutable/);
    expect(
      await expectError(db, "update public.quote_fees set amount = 0 where quotation_id = $1", [
        v1,
      ]),
    ).toMatch(/immutable/);
    await asUser(db, U.admin, async () => {
      expect(
        await expectError(
          db,
          "insert into public.quotations (group_id, version, supplier_id, quote_type, rights_class, source_type, currency, quantity_unit, quote_date, confirmed_by) select group_id, 9, supplier_id, quote_type, rights_class, source_type, currency, quantity_unit, quote_date, confirmed_by from public.quotations where id = $1",
          [v1],
        ),
      ).toMatch(/permission denied/);
      expect(
        await expectError(
          db,
          "update public.quotation_states set status = 'withdrawn' where quotation_id = $1",
          [v1],
        ),
      ).toMatch(/permission denied/);
      expect(
        await expectError(
          db,
          "insert into public.quote_status_events (quotation_id, to_status, acting_as, reason, idempotency_key) values ($1, 'withdrawn', 'platform_admin', 'forged', 'forged-key-0001')",
          [v1],
        ),
      ).toMatch(/permission denied/);
    });
  });
});

describe("visibility (Pattern C)", () => {
  it("buyer org, assigned operator, owning supplier and platform admin read v1; B, other supplier, unassigned operator read nothing", async () => {
    for (const [u, n] of [
      [U.aOwner, 1],
      [U.aViewer, 1],
      [U.opA, 1],
      [U.sOwner, 1],
      [U.admin, 1],
      [U.bOwner, 0],
      [U.s2Owner, 0],
      [U.opOther, 0],
    ] as const) {
      await asUser(db, u, async () => {
        expect(await count("select 1 from public.quotations where id = $1", [v1]), u).toBe(n);
        expect(
          await count("select 1 from public.quote_tiers where quotation_id = $1", [v1]),
          u,
        ).toBe(n * 2);
        expect(
          await count("select 1 from public.quotation_states where quotation_id = $1", [v1]),
          u,
        ).toBe(n);
        expect(
          await count("select 1 from public.quote_status_events where quotation_id = $1", [v1]),
          u,
        ).toBe(n);
        expect(
          await count(
            "select 1 from public.quote_groups g where exists (select 1 from public.quotations q where q.group_id = g.id and q.id = $1)",
            [v1],
          ),
          u,
        ).toBe(n);
      });
    }
  });
});

describe("supersede + transitions", () => {
  it("an assigned operator supersedes v1 with v2; old becomes superseded (history kept), new is current; non-current cannot be superseded", async () => {
    v2 = await supersede(
      U.opA,
      v1,
      payload({ valid_until: "2027-01-31", tiers: [{ min_qty: 5000, unit_price: 0.04 }] }),
      "supplier extended validity",
      "key-v2-00000001",
    );
    expect(await state(v1)).toMatchObject({
      status: "superseded",
      is_current: false,
      superseded_by: v2,
      state_version: 2,
    });
    expect(await state(v2)).toMatchObject({ status: "confirmed", is_current: true });
    expect(
      (
        await db.query<{ v: number }>("select version as v from public.quotations where id = $1", [
          v2,
        ])
      )[0]!.v,
    ).toBe(2);
    await asUser(db, U.aOwner, async () => {
      expect(
        await count(
          "select 1 from public.quotations where group_id = (select group_id from public.quotations where id = $1)",
          [v1],
        ),
      ).toBe(2);
      expect(
        await expectError(
          db,
          "select app.supersede_quotation($1, $2::jsonb, 'stale', 'key-stale-00001')",
          [v1, payload()],
        ),
      ).toMatch(/not the current version/);
    });
    await asUser(db, U.sOwner, async () => {
      expect(
        await expectError(
          db,
          "select app.supersede_quotation($1, $2::jsonb, 'supplier edit', 'key-sup-000001')",
          [v2, payload()],
        ),
      ).toMatch(/actor_not_permitted/);
    });
    await asUser(db, U.bOwner, async () => {
      expect(
        await expectError(
          db,
          "select app.supersede_quotation($1, $2::jsonb, 'B edit', 'key-b-ed-00001')",
          [v2, payload()],
        ),
      ).toMatch(/not permitted/);
    });
    const events = await db.query<{ q: string; to: string }>(
      "select quotation_id as q, to_status::text as to from public.quote_status_events where quotation_id in ($1, $2) order by at",
      [v1, v2],
    );
    expect(events.map((e) => e.to)).toEqual(["confirmed", "superseded", "confirmed"]);
  });

  it("withdraw: buyer reviewer refused, supplier owner allowed with reason; withdrawn is terminal; expired only by operator/system and then superseded by revalidation", async () => {
    expect(await transition(U.aViewer, v2, "withdrawn", "viewer", "key-wd-viewer-01")).toMatch(
      /not permitted/,
    );
    expect(
      await transition(U.aMember, v2, "withdrawn", "buyer wants out", "key-wd-buyer-001"),
    ).toMatch(/actor_not_permitted/);
    expect(await transition(U.aMember, v2, "superseded", "direct", "key-sup-direct-1")).toMatch(
      /via_supersede_only/,
    );
    expect(await transition(U.sOwner, v2, "withdrawn", "", "key-wd-noreason")).toMatch(/reason/);
    expect(
      await transition(
        U.sOwner,
        v2,
        "withdrawn",
        "raw material cost changed; re-quote to follow",
        "key-wd-supplier1",
      ),
    ).toBeNull();
    expect(await state(v2)).toMatchObject({
      status: "withdrawn",
      is_current: true,
      state_version: 2,
    });
    expect(await transition(U.sOwner, v2, "withdrawn", "again", "key-wd-supplier1")).toBeNull(); // idempotent replay: no error, no change
    expect((await state(v2)).state_version).toBe(2);
    expect(
      await transition(U.opA, v2, "expired", "expire after withdrawal", "key-wd-term-0001"),
    ).toMatch(/terminal_state/);
    await asUser(db, U.opA, async () => {
      expect(
        await expectError(
          db,
          "select app.supersede_quotation($1, $2::jsonb, 'after withdrawal', 'key-after-wd-01')",
          [v2, payload()],
        ),
      ).toMatch(/terminal_state/);
    });
    // a fresh thread (final_offer) to exercise expiry
    const v3 = await supersede(
      U.opA,
      null,
      payload({ quote_type: "final_offer", valid_until: "2026-11-05" }),
      "final offer recorded",
      "key-v3-00000001",
    );
    expect(
      await transition(U.aMember, v3, "expired", "buyer says expired", "key-exp-buyer-01"),
    ).toMatch(/actor_not_permitted/);
    expect(
      await transition(null, v3, "expired", "valid_until passed", "expire:" + v3, "service_role"),
    ).toBeNull();
    expect(await state(v3)).toMatchObject({ status: "expired", is_current: true });
    expect(
      (
        await db.query<{ a: string }>(
          "select acting_as as a from public.quote_status_events where idempotency_key = $1",
          ["expire:" + v3],
        )
      )[0]!.a,
    ).toBe("system");
    expect(
      await transition(U.opA, v3, "withdrawn", "withdraw an expired quote", "key-exp-wd-00001"),
    ).toMatch(/invalid_transition/);
    const v4 = await supersede(
      U.aOwner,
      v3,
      payload({ quote_type: "final_offer", valid_until: "2027-03-31" }),
      "supplier revalidated",
      "key-v4-00000001",
    );
    expect(await state(v3)).toMatchObject({ status: "superseded", superseded_by: v4 });
    expect(await state(v4)).toMatchObject({ status: "confirmed", is_current: true });
  });

  it("one current version per group is enforced by the database itself", async () => {
    const gid = (
      await db.query<{ g: string }>("select group_id as g from public.quotations where id = $1", [
        v2,
      ])
    )[0]!.g;
    expect(
      await expectError(
        db,
        "insert into public.quotation_states (quotation_id, group_id, status, is_current) values ($1, $2, 'confirmed', true)",
        [v1, gid],
      ),
    ).toMatch(/duplicate key|one_current_per_group|unique/);
  });
});

describe("quote_visibility_grants (version-exact)", () => {
  it("an assigned operator grants v2 to B with a reason; B sees exactly that version; revocation removes it; B cannot self-grant", async () => {
    await asUser(db, U.bOwner, async () => {
      expect(
        await expectError(
          db,
          "insert into public.quote_visibility_grants (quotation_id, grantee_org_id, reason) values ($1, $2, 'self-service attempt here')",
          [v2, ORG.b],
        ),
      ).toMatch(/row-level security/);
    });
    await asUser(db, U.opOther, async () => {
      expect(
        await expectError(
          db,
          "insert into public.quote_visibility_grants (quotation_id, grantee_org_id, reason) values ($1, $2, 'unassigned operator attempt')",
          [v2, ORG.b],
        ),
      ).toMatch(/row-level security/);
    });
    let gid = "";
    await asUser(db, U.opA, async () => {
      expect(
        await expectError(
          db,
          "insert into public.quote_visibility_grants (quotation_id, grantee_org_id, reason) values ($1, $2, 'short')",
          [v2, ORG.b],
        ),
      ).toMatch(/check/);
      gid = (
        await db.query<{ id: string }>(
          "insert into public.quote_visibility_grants (quotation_id, grantee_org_id, reason) values ($1, $2, 'benchmark shared with buyer consent, 2026-11-07') returning id",
          [v2, ORG.b],
        )
      )[0]!.id;
    });
    await asUser(db, U.bOwner, async () => {
      expect(
        (
          await db.query<{ id: string }>(
            "select id from public.quotations where supplier_id = $1",
            [sId],
          )
        ).map((r) => r.id),
      ).toEqual([v2]);
      expect(await count("select 1 from public.quote_tiers where quotation_id = $1", [v2])).toBe(1);
      expect(await count("select 1 from public.quote_visibility_grants")).toBe(1);
      await db.exec(
        `update public.quote_visibility_grants set expires_at = null where id = '${gid}'`,
      ); // 0 rows
      expect(
        await expectError(
          db,
          "select app.supersede_quotation($1, $2::jsonb, 'grantee edit', 'key-grantee-001')",
          [v2, payload()],
        ),
      ).toMatch(/not permitted/);
    });
    await asUser(db, U.opA, async () => {
      expect(
        await expectError(
          db,
          "update public.quote_visibility_grants set reason = 'rewritten' where id = $1",
          [gid],
        ),
      ).toMatch(/immutable except for revocation/);
      await db.exec(
        `update public.quote_visibility_grants set revoked_at = now(), revoke_reason = 'benchmark done' where id = '${gid}'`,
      );
    });
    await asUser(db, U.bOwner, async () => {
      expect(await count("select 1 from public.quotations where supplier_id = $1", [sId])).toBe(0);
    });
  });
});

describe("supplier catalog quotes + catalog permission", () => {
  it("a supplier owner publishes a catalog quote; buyers see it only while a price_tiers catalog permission is active; internal staff always", async () => {
    await asUser(db, U.s2Owner, async () => {
      expect(
        await expectError(
          db,
          "select app.supersede_quotation(null, $1::jsonb, 'test reason', 'key-cat-wrong-01')",
          [
            payload({
              supplier_id: sId,
              buyer_org_id: null,
              brief_item_id: null,
              quote_type: "supplier_catalog",
              rights_class: "catalog_public_with_permission",
              source_type: "supplier_portal",
              document_id: null,
              visibility_scope: "platform_buyers",
            }),
          ],
        ),
      ).toMatch(/not permitted/); // S2 cannot publish for S
    });
    catalogQ = await supersede(
      U.sOwner,
      null,
      payload({
        buyer_org_id: null,
        brief_item_id: null,
        quote_type: "supplier_catalog",
        rights_class: "catalog_public_with_permission",
        source_type: "supplier_portal",
        document_id: null,
        visibility_scope: "platform_buyers",
      }),
      "catalog price list 2026-Q4",
      "key-catalog-00001",
    );
    for (const [u, n] of [
      [U.bOwner, 0],
      [U.aOwner, 0],
      [U.opOther, 1],
      [U.sOwner, 1],
    ] as const) {
      await asUser(db, u, async () => {
        expect(await count("select 1 from public.quotations where id = $1", [catalogQ]), u).toBe(n);
      });
    }
    let permId = "";
    await asUser(db, U.sOwner, async () => {
      permId = (
        await db.query<{ id: string }>(
          `insert into public.source_permissions (supplier_id, rights_class, scope) values ($1, 'catalog_public_with_permission', '{"buyer_visibility":"platform_buyers","fields":["price_tiers","product_specs"]}') returning id`,
          [sId],
        )
      )[0]!.id;
    });
    for (const u of [U.bOwner, U.aOwner]) {
      await asUser(db, u, async () => {
        expect(await count("select 1 from public.quotations where id = $1", [catalogQ]), u).toBe(1);
        expect(
          await count("select 1 from public.quote_tiers where quotation_id = $1", [catalogQ]),
          u,
        ).toBe(2);
      });
    }
    await asUser(db, U.sOwner, async () => {
      await db.exec(
        `update public.source_permissions set revoked_at = now(), revoke_reason = 'pulled' where id = '${permId}'`,
      );
    });
    await asUser(db, U.bOwner, async () => {
      expect(await count("select 1 from public.quotations where id = $1", [catalogQ])).toBe(0);
    });
    // declared-intent consistency: a negotiated quote cannot claim platform_buyers; a catalog quote cannot claim internal_only
    await asUser(db, U.aMember, async () => {
      expect(
        await expectError(
          db,
          "select app.supersede_quotation(null, $1::jsonb, 'test reason', 'key-scope-00001')",
          [payload({ quote_type: "estimate", visibility_scope: "platform_buyers" })],
        ),
      ).toMatch(/check/);
    });
  });
});

describe("grant layer", () => {
  it("authenticated cannot DELETE from any 0009 table", async () => {
    await asUser(db, U.admin, async () => {
      for (const t of [
        "quote_groups",
        "quotations",
        "quote_tiers",
        "quote_fees",
        "quotation_states",
        "quote_status_events",
        "quote_visibility_grants",
      ]) {
        expect(await expectError(db, `delete from public.${t}`), t).toMatch(/permission denied/);
      }
    });
  });
});
