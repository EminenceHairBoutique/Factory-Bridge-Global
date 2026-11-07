/**
 * B-08 — suppliers_core (0005): supplier profiles, restricted contacts + disclosure grants, the source register,
 * rights grants (source_permissions + app.catalog_grant_active) and internal-only research leads.
 * Every tenant assertion runs as `authenticated` with a JWT sub; service_role appears only where its limits are tested.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  applyMigrations,
  asUser,
  expectError,
  listMigrations,
  openDb,
  readSeed,
  type Db,
} from "./db.js";

const INTERNAL_ORG = "00000000-0000-4000-8000-000000000001";
const U = {
  s1Owner: "d1000000-0000-4000-8000-000000000001",
  s1Member: "d1000000-0000-4000-8000-000000000002",
  s2Owner: "d2000000-0000-4000-8000-000000000001",
  aOwner: "d3000000-0000-4000-8000-000000000001",
  aViewer: "d3000000-0000-4000-8000-000000000002",
  bOwner: "d4000000-0000-4000-8000-000000000001",
  op: "d5000000-0000-4000-8000-000000000001",
  comp: "d5000000-0000-4000-8000-000000000002",
  admin: "d5000000-0000-4000-8000-000000000003",
};
const ORG = {
  s1: "dddddd01-0000-4000-8000-000000000001",
  s2: "dddddd02-0000-4000-8000-000000000001",
  a: "dddddd03-0000-4000-8000-000000000001",
  b: "dddddd04-0000-4000-8000-000000000001",
};

let db: Db;
let s1: string; // supplier_profiles.id for ORG.s1
let s2: string;
let contactId: string;
let labelsTax: string;
let manualSource: string;

const count = async (sql: string, params: unknown[] = []) =>
  Number(
    (await db.query<{ n: string }>(`select count(*)::text as n from (${sql}) q`, params))[0]!.n,
  );

beforeAll(async () => {
  db = await openDb();
  if (db.engine === "pglite") {
    await applyMigrations(db);
    await db.exec(readSeed());
  }
  // Shared database on real Postgres: research leads are not org-linked, so remove this suite's own from a previous run.
  await db.exec(`delete from public.research_leads where recorded_by = '${U.op}'`);
  await db.exec(
    `delete from public.organizations where id in (${Object.values(ORG)
      .map((o) => `'${o}'`)
      .join(",")})`,
  );
  await db.exec(
    `delete from auth.users where id in (${Object.values(U)
      .map((u) => `'${u}'`)
      .join(",")})`,
  );
  await db.exec(
    `insert into auth.users (id, email) values ${Object.entries(U)
      .map(([k, id]) => `('${id}', 'sup-${k.toLowerCase()}@example.test')`)
      .join(",")}`,
  );
  await db.exec(`
    insert into public.organizations (id, org_type, legal_name, display_name) values
      ('${ORG.s1}', 'supplier', '深圳市一号印刷有限公司', 'S1'),
      ('${ORG.s2}', 'supplier', '东莞市二号包装有限公司', 'S2'),
      ('${ORG.a}', 'buyer', 'Buyer A LLC', 'A'),
      ('${ORG.b}', 'buyer', 'Buyer B Inc', 'B');
    insert into public.memberships (org_id, user_id, role) values
      ('${ORG.s1}', '${U.s1Owner}', 'owner'), ('${ORG.s1}', '${U.s1Member}', 'member'),
      ('${ORG.s2}', '${U.s2Owner}', 'owner'),
      ('${ORG.a}', '${U.aOwner}', 'owner'), ('${ORG.a}', '${U.aViewer}', 'viewer'),
      ('${ORG.b}', '${U.bOwner}', 'owner'),
      ('${INTERNAL_ORG}', '${U.op}', 'operator'),
      ('${INTERNAL_ORG}', '${U.comp}', 'compliance_reviewer'),
      ('${INTERNAL_ORG}', '${U.admin}', 'platform_admin');
  `);
  labelsTax = (
    await db.query<{ id: string }>(
      "select id from public.product_taxonomy where code = 'packaging.labels_roll'",
    )
  )[0]!.id;
  manualSource = (
    await db.query<{ id: string }>(
      "select id from public.source_systems where code = 'manual_research'",
    )
  )[0]!.id;
});

afterAll(async () => {
  await db.close();
});

describe("source register (source_systems)", () => {
  it("ships the marketplaces and WeChat as status=blocked and manual research as manual", async () => {
    const rows = await db.query<{ code: string; status: string }>(
      "select code, status from public.source_systems order by code",
    );
    const byCode = Object.fromEntries(rows.map((r) => [r.code, r.status]));
    for (const c of [
      "marketplace.1688",
      "marketplace.taobao",
      "marketplace.weidian",
      "messaging.wechat",
    ]) {
      expect(byCode[c], c).toBe("blocked");
    }
    expect(byCode["manual_research"]).toBe("manual");
    expect(byCode["supplier_portal"]).toBe("active");
  });

  it("is internal-only to read; only platform_admin may change status; a re-run of the reference block keeps that decision", async () => {
    await asUser(db, U.aOwner, async () => {
      expect(await count("select 1 from public.source_systems")).toBe(0);
    });
    await asUser(db, U.s1Owner, async () => {
      expect(await count("select 1 from public.source_systems")).toBe(0);
    });
    await asUser(db, U.op, async () => {
      expect(await count("select 1 from public.source_systems")).toBeGreaterThanOrEqual(8);
      // RLS: no update policy for operators → 0 rows affected, status unchanged
      await db.exec(
        "update public.source_systems set status = 'active' where code = 'marketplace.1688'",
      );
    });
    expect(
      (
        await db.query<{ status: string }>(
          "select status from public.source_systems where code = 'marketplace.1688'",
        )
      )[0]!.status,
    ).toBe("blocked");
    await asUser(db, U.admin, async () => {
      await db.exec(
        "update public.source_systems set status = 'manual', notes = 'test: admin decision' where code = 'messaging.wechat'",
      );
    });
    const sql = listMigrations().find((m) => m.name === "suppliers_core")!.sql;
    const block = sql.slice(
      sql.indexOf("-- BEGIN REFERENCE DATA"),
      sql.indexOf("-- END REFERENCE DATA"),
    );
    await db.exec(block);
    const after = await db.query<{ status: string; notes: string }>(
      "select status, notes from public.source_systems where code = 'messaging.wechat'",
    );
    expect(after[0]!.status).toBe("manual"); // status survives re-runs
    expect(after[0]!.notes).not.toBe("test: admin decision"); // notes are migration-owned text
    await asUser(db, U.admin, async () => {
      await db.exec(
        "update public.source_systems set status = 'blocked' where code = 'messaging.wechat'",
      );
    });
  });
});

describe("supplier_profiles", () => {
  it("a supplier owner creates the profile for their own org; buyer orgs are rejected; a foreign supplier org is denied", async () => {
    await asUser(db, U.s1Owner, async () => {
      const rows = await db.query<{ id: string; stage: string; entity_kind_verified: boolean }>(
        `insert into public.supplier_profiles (org_id, legal_name_zh, legal_name_en, uscc, entity_kind, entity_kind_verified, stage, province, city)
         values ($1, '深圳市一号印刷有限公司', 'Shenzhen No.1 Printing Co., Ltd.', '91440300MA5F1XYW2K', 'manufacturer', true, 'capabilities_documented', '广东省', '深圳市')
         returning id, stage, entity_kind_verified`,
        [ORG.s1],
      );
      s1 = rows[0]!.id;
      // claims are accepted; verification columns are reset to defaults for a non-internal writer
      expect(rows[0]!.stage).toBe("lead_identified");
      expect(rows[0]!.entity_kind_verified).toBe(false);
      expect(
        await expectError(
          db,
          "insert into public.supplier_profiles (org_id, legal_name_zh) values ($1, '假冒供应商')",
          [ORG.s2],
        ),
      ).toMatch(/row-level security/);
    });
    await asUser(db, U.aOwner, async () => {
      expect(
        await expectError(
          db,
          "insert into public.supplier_profiles (org_id, legal_name_zh) values ($1, '买家不是供应商')",
          [ORG.a],
        ),
      ).toMatch(/supplier organization|row-level security/);
    });
    await asUser(db, U.op, async () => {
      const rows = await db.query<{ id: string }>(
        "insert into public.supplier_profiles (org_id, legal_name_zh, stage) values ($1, '东莞市二号包装有限公司', 'contact_confirmed') returning id",
        [ORG.s2],
      );
      s2 = rows[0]!.id;
    });
  });

  it("rejects a malformed USCC and a non-http website", async () => {
    await asUser(db, U.s1Owner, async () => {
      expect(
        await expectError(db, "update public.supplier_profiles set uscc = '12345' where id = $1", [
          s1,
        ]),
      ).toMatch(/check/);
      expect(
        await expectError(
          db,
          "update public.supplier_profiles set website = 'ftp://x' where id = $1",
          [s1],
        ),
      ).toMatch(/check/);
    });
  });

  it("the supplier cannot set entity_kind_verified or stage; internal staff can; changing the claim un-verifies it", async () => {
    await asUser(db, U.s1Owner, async () => {
      expect(
        await expectError(
          db,
          "update public.supplier_profiles set entity_kind_verified = true where id = $1",
          [s1],
        ),
      ).toMatch(/staff only/);
      expect(
        await expectError(
          db,
          "update public.supplier_profiles set stage = 'contact_confirmed' where id = $1",
          [s1],
        ),
      ).toMatch(/staff only/);
    });
    await asUser(db, U.op, async () => {
      await db.exec(
        `update public.supplier_profiles set entity_kind_verified = true, stage = 'contact_confirmed' where id = '${s1}'`,
      );
    });
    await asUser(db, U.s1Owner, async () => {
      await db.exec(
        `update public.supplier_profiles set entity_kind = 'trading' where id = '${s1}'`,
      );
      const r = await db.query<{ v: boolean }>(
        "select entity_kind_verified as v from public.supplier_profiles where id = $1",
        [s1],
      );
      expect(r[0]!.v).toBe(false);
    });
    await asUser(db, U.op, async () => {
      await db.exec(
        `update public.supplier_profiles set entity_kind_verified = true where id = '${s1}'`,
      );
    });
  });

  it("org_id is immutable and a supplier member (non-owner) cannot edit the profile", async () => {
    await asUser(db, U.s1Owner, async () => {
      expect(
        await expectError(db, "update public.supplier_profiles set org_id = $2 where id = $1", [
          s1,
          ORG.s2,
        ]),
      ).toMatch(/org_id|immutable|cannot be changed/i);
    });
    await asUser(db, U.s1Member, async () => {
      await db.exec(`update public.supplier_profiles set city = 'hacked' where id = '${s1}'`);
    });
    expect(
      (
        await db.query<{ city: string }>(
          "select city from public.supplier_profiles where id = $1",
          [s1],
        )
      )[0]!.city,
    ).toBe("深圳市");
  });

  it("buyers see only suppliers past lead stage; the supplier sees its own at any stage", async () => {
    await asUser(db, U.op, async () => {
      await db.exec(
        `update public.supplier_profiles set stage = 'lead_identified' where id = '${s2}'`,
      );
    });
    await asUser(db, U.aOwner, async () => {
      const ids = (await db.query<{ id: string }>("select id from public.supplier_profiles")).map(
        (r) => r.id,
      );
      expect(ids).toContain(s1);
      expect(ids).not.toContain(s2);
      const view = (
        await db.query<{ id: string }>("select id from public.supplier_public_profile_v")
      ).map((r) => r.id);
      expect(view).toContain(s1);
      expect(view).not.toContain(s2);
    });
    await asUser(db, U.s2Owner, async () => {
      expect(await count("select 1 from public.supplier_profiles where id = $1", [s2])).toBe(1);
      expect(
        await count("select 1 from public.supplier_public_profile_v where id = $1", [s2]),
      ).toBe(0);
    });
    await asUser(db, U.op, async () => {
      await db.exec(
        `update public.supplier_profiles set stage = 'contact_confirmed' where id = '${s2}'`,
      );
    });
  });

  it("supplier_public_profile_v exposes no contact or internal columns", async () => {
    const cols = (
      await db.query<{ c: string }>(
        "select column_name as c from information_schema.columns where table_schema = 'public' and table_name = 'supplier_public_profile_v'",
      )
    ).map((r) => r.c);
    for (const forbidden of [
      "wechat_handle",
      "phone",
      "email",
      "name",
      "contact_basis",
      "consent_note",
      "uscc",
      "created_by",
    ]) {
      expect(cols, forbidden).not.toContain(forbidden);
    }
    expect(cols).toContain("entity_kind_verified");
  });
});

describe("supplier_facilities", () => {
  it("supplier members add facilities (org_id derived, one primary); visibility follows the profile", async () => {
    await asUser(db, U.s1Member, async () => {
      const r = await db.query<{ org_id: string }>(
        "insert into public.supplier_facilities (supplier_id, facility_type, address_zh, is_primary) values ($1, 'factory', '深圳市宝安区某某路1号', true) returning org_id",
        [s1],
      );
      expect(r[0]!.org_id).toBe(ORG.s1);
      expect(
        await expectError(
          db,
          "insert into public.supplier_facilities (supplier_id, facility_type, address_zh, is_primary) values ($1, 'warehouse', '深圳市宝安区某某路2号', true)",
          [s1],
        ),
      ).toMatch(/one_primary|unique/);
      expect(
        await expectError(
          db,
          "insert into public.supplier_facilities (supplier_id, facility_type, address_zh) values ($1, 'factory', '东莞市某某路1号')",
          [s2],
        ),
      ).toMatch(/row-level security/);
    });
    await asUser(db, U.aViewer, async () => {
      expect(
        await count("select 1 from public.supplier_facilities where supplier_id = $1", [s1]),
      ).toBe(1);
    });
    await asUser(db, U.s2Owner, async () => {
      // a foreign supplier sees the facility (it is directory data) but cannot edit it
      await db.exec(
        `update public.supplier_facilities set address_zh = '篡改' where supplier_id = '${s1}'`,
      );
    });
    expect(
      (
        await db.query<{ a: string }>(
          "select address_zh as a from public.supplier_facilities where supplier_id = $1",
          [s1],
        )
      )[0]!.a,
    ).toBe("深圳市宝安区某某路1号");
  });
});

describe("supplier_contacts (restricted) + contact_disclosure_grants", () => {
  it("platform_admin creates a contact; buyers, foreign suppliers and unassigned operators read 0 rows; supplier org and compliance read it", async () => {
    await asUser(db, U.admin, async () => {
      const r = await db.query<{ id: string; org_id: string }>(
        "insert into public.supplier_contacts (supplier_id, name, role_title, wechat_handle, contact_basis, consent_note) values ($1, '王经理', '外贸经理', 'wang_sz_001', 'operator_sourced', 'shared on 2026-11 call') returning id, org_id",
        [s1],
      );
      contactId = r[0]!.id;
      expect(r[0]!.org_id).toBe(ORG.s1);
    });
    for (const u of [U.aOwner, U.aViewer, U.bOwner, U.s2Owner, U.op]) {
      await asUser(db, u, async () => {
        expect(await count("select 1 from public.supplier_contacts"), u).toBe(0);
        expect(
          await count("select 1 from public.supplier_contacts where id = $1", [contactId]),
          u,
        ).toBe(0);
      });
    }
    for (const u of [U.s1Owner, U.s1Member, U.comp, U.admin]) {
      await asUser(db, u, async () => {
        expect(
          await count("select 1 from public.supplier_contacts where id = $1", [contactId]),
          u,
        ).toBe(1);
      });
    }
  });

  it("buyers and operators cannot insert contacts; a contact needs at least one channel", async () => {
    for (const u of [U.aOwner, U.op, U.s1Owner]) {
      await asUser(db, u, async () => {
        expect(
          await expectError(
            db,
            "insert into public.supplier_contacts (supplier_id, name, phone, contact_basis) values ($1, 'x', '13800000000', 'public_listing')",
            [s1],
          ),
          u,
        ).toMatch(/row-level security/);
      });
    }
    await asUser(db, U.admin, async () => {
      expect(
        await expectError(
          db,
          "insert into public.supplier_contacts (supplier_id, name, contact_basis) values ($1, 'no channel', 'referral')",
          [s1],
        ),
      ).toMatch(/check/);
    });
  });

  it("a disclosure grant with a reason makes the contact readable to that buyer org only; expiry and revocation deny; grants are immutable", async () => {
    await asUser(db, U.aOwner, async () => {
      expect(
        await expectError(
          db,
          "insert into public.contact_disclosure_grants (supplier_contact_id, buyer_org_id, reason) values ($1, $2, 'self-service grant attempt')",
          [contactId, ORG.a],
        ),
      ).toMatch(/row-level security/);
    });
    let grantId = "";
    await asUser(db, U.admin, async () => {
      expect(
        await expectError(
          db,
          "insert into public.contact_disclosure_grants (supplier_contact_id, buyer_org_id, reason) values ($1, $2, 'short')",
          [contactId, ORG.a],
        ),
      ).toMatch(/check/);
      grantId = (
        await db.query<{ id: string }>(
          "insert into public.contact_disclosure_grants (supplier_contact_id, buyer_org_id, reason) values ($1, $2, 'Buyer A sampling call scheduled; supplier agreed to direct contact') returning id",
          [contactId, ORG.a],
        )
      )[0]!.id;
    });
    await asUser(db, U.aOwner, async () => {
      expect(await count("select 1 from public.supplier_contacts where id = $1", [contactId])).toBe(
        1,
      );
      expect(await count("select 1 from public.contact_disclosure_grants")).toBe(1);
      // cannot edit the contact, cannot widen the grant
      await db.exec(
        `update public.supplier_contacts set wechat_handle = 'x' where id = '${contactId}'`,
      );
      await db.exec(
        `update public.contact_disclosure_grants set expires_at = null where id = '${grantId}'`,
      );
    });
    await asUser(db, U.bOwner, async () => {
      expect(await count("select 1 from public.supplier_contacts where id = $1", [contactId])).toBe(
        0,
      );
      expect(await count("select 1 from public.contact_disclosure_grants")).toBe(0);
    });
    await asUser(db, U.admin, async () => {
      expect(
        await expectError(
          db,
          "update public.contact_disclosure_grants set buyer_org_id = $2 where id = $1",
          [grantId, ORG.b],
        ),
      ).toMatch(/buyer_org_id|immutable|cannot be changed/i);
      expect(
        await expectError(
          db,
          "update public.contact_disclosure_grants set reason = 'rewritten' where id = $1",
          [grantId],
        ),
      ).toMatch(/immutable except for revocation/);
      // a second live grant for the same (contact, buyer) is rejected
      expect(
        await expectError(
          db,
          "insert into public.contact_disclosure_grants (supplier_contact_id, buyer_org_id, reason) values ($1, $2, 'duplicate live grant attempt')",
          [contactId, ORG.a],
        ),
      ).toMatch(/one_live|unique/);
      await db.exec(
        `update public.contact_disclosure_grants set revoked_at = now(), revoke_reason = 'test' where id = '${grantId}'`,
      );
    });
    const revoked = await db.query<{ by: string }>(
      "select revoked_by as by from public.contact_disclosure_grants where id = $1",
      [grantId],
    );
    expect(revoked[0]!.by).toBe(U.admin);
    await asUser(db, U.aOwner, async () => {
      expect(await count("select 1 from public.supplier_contacts where id = $1", [contactId])).toBe(
        0,
      );
    });
    await asUser(db, U.admin, async () => {
      expect(
        await expectError(
          db,
          "update public.contact_disclosure_grants set revoked_at = null where id = $1",
          [grantId],
        ),
      ).toMatch(/un-revoked/);
    });
    // expired grant (granted in the past, already expired) → still 0 rows
    await db.exec(
      `insert into public.contact_disclosure_grants (supplier_contact_id, buyer_org_id, granted_by, reason, granted_at, expires_at)
       values ('${contactId}', '${ORG.a}', '${U.admin}', 'expired grant for the harness', now() - interval '2 days', now() - interval '1 day')`,
    );
    await asUser(db, U.aOwner, async () => {
      expect(await count("select 1 from public.supplier_contacts where id = $1", [contactId])).toBe(
        0,
      );
    });
  });

  it("the supplier org can update its own contact; audit rows for contacts are redacted", async () => {
    await asUser(db, U.s1Owner, async () => {
      await db.exec(
        `update public.supplier_contacts set phone = '13800000001' where id = '${contactId}'`,
      );
    });
    const rows = await db.query<{ diff: { after?: { _redacted?: boolean; changed?: string[] } } }>(
      "select diff from public.audit_events where entity_table = 'supplier_contacts' and entity_id = $1 and action = 'update' order by at desc limit 1",
      [contactId],
    );
    expect(rows[0]?.diff.after?._redacted).toBe(true);
    expect(rows[0]?.diff.after?.changed).toContain("phone");
    expect(JSON.stringify(rows[0]?.diff)).not.toContain("13800000001");
    expect(JSON.stringify(rows[0]?.diff)).not.toContain("wang_sz_001");
  });
});

describe("source_permissions + app.catalog_grant_active", () => {
  let platformGrant = "";
  let namedGrant = "";

  it("rejects invalid scopes deterministically", async () => {
    await asUser(db, U.op, async () => {
      const bad = [
        [`{"buyer_visibility":"everyone"}`, /buyer_visibility/],
        [`{"fields":"price_tiers"}`, /fields must be an array/],
        [`{"images":"yes"}`, /must be a boolean/],
        [`{"surprise":true}`, /not allowed/],
        [`{"buyer_visibility":"named_orgs"}`, /named_org_ids/],
        [`{"buyer_visibility":"named_orgs","named_org_ids":["not-a-uuid"]}`, /uuid/],
        [`{"buyer_visibility":"platform_buyers","named_org_ids":["${ORG.a}"]}`, /only allowed/],
        [`[]`, /JSON object/],
      ] as const;
      for (const [scope, re] of bad) {
        expect(
          await expectError(
            db,
            "insert into public.source_permissions (supplier_id, rights_class, scope) values ($1, 'catalog_public_with_permission', $2::jsonb)",
            [s1, scope],
          ),
          scope,
        ).toMatch(re);
      }
      expect(
        await expectError(
          db,
          "insert into public.source_permissions (source_system_id, rights_class, scope) values ($1, 'catalog_public_with_permission', '{}')",
          [manualSource],
        ),
      ).toMatch(/requires supplier_id/);
      expect(
        await expectError(
          db,
          "insert into public.source_permissions (supplier_id, rights_class, scope) values ($1, 'internal_market_observation', '{\"buyer_visibility\":\"platform_buyers\"}')",
          [s1],
        ),
      ).toMatch(/never buyer-visible/);
    });
  });

  it("operator records a platform-wide catalog grant; the predicate is field-scoped", async () => {
    await asUser(db, U.op, async () => {
      platformGrant = (
        await db.query<{ id: string; org_id: string }>(
          `insert into public.source_permissions (supplier_id, rights_class, scope)
           values ($1, 'catalog_public_with_permission', '{"buyer_visibility":"platform_buyers","fields":["product_specs","price_tiers"],"images":true}')
           returning id, org_id`,
          [s1],
        )
      )[0]!.id;
    });
    const active = async (sup: string, org: string, field: string) =>
      (
        await db.query<{ ok: boolean }>("select app.catalog_grant_active($1, $2, $3) as ok", [
          sup,
          org,
          field,
        ])
      )[0]!.ok;
    expect(await active(s1, ORG.a, "price_tiers")).toBe(true);
    expect(await active(s1, ORG.b, "price_tiers")).toBe(true);
    expect(await active(s1, ORG.a, "moq")).toBe(false);
    expect(await active(s2, ORG.a, "price_tiers")).toBe(false);
  });

  it("the supplier's owner self-grants a named-org permission; only the named buyer sees it and passes the predicate", async () => {
    await asUser(db, U.s1Owner, async () => {
      namedGrant = (
        await db.query<{ id: string }>(
          `insert into public.source_permissions (supplier_id, rights_class, scope)
           values ($1, 'catalog_public_with_permission', $2::jsonb) returning id`,
          [
            s1,
            JSON.stringify({
              buyer_visibility: "named_orgs",
              named_org_ids: [ORG.a],
              fields: ["moq"],
            }),
          ],
        )
      )[0]!.id;
      expect(
        await expectError(
          db,
          "insert into public.source_permissions (supplier_id, rights_class, scope) values ($1, 'catalog_public_with_permission', '{}')",
          [s2],
        ),
      ).toMatch(/row-level security/);
    });
    await asUser(db, U.s1Member, async () => {
      expect(
        await expectError(
          db,
          "insert into public.source_permissions (supplier_id, rights_class, scope) values ($1, 'supplier_submitted_private', '{}')",
          [s1],
        ),
      ).toMatch(/row-level security/);
      expect(
        await count("select 1 from public.source_permissions where supplier_id = $1", [s1]),
      ).toBe(2);
    });
    const active = async (org: string) =>
      (
        await db.query<{ ok: boolean }>("select app.catalog_grant_active($1, $2, 'moq') as ok", [
          s1,
          org,
        ])
      )[0]!.ok;
    expect(await active(ORG.a)).toBe(true);
    expect(await active(ORG.b)).toBe(false);
    await asUser(db, U.aOwner, async () => {
      const ids = (
        await db.query<{ id: string }>(
          "select id from public.source_permissions where supplier_id in ($1, $2)",
          [s1, s2],
        )
      ).map((r) => r.id);
      expect(ids.sort()).toEqual([platformGrant, namedGrant].sort());
    });
    await asUser(db, U.bOwner, async () => {
      const ids = (
        await db.query<{ id: string }>(
          "select id from public.source_permissions where supplier_id in ($1, $2)",
          [s1, s2],
        )
      ).map((r) => r.id);
      expect(ids).toEqual([platformGrant]);
    });
    await asUser(db, U.s2Owner, async () => {
      expect(
        await count("select 1 from public.source_permissions where supplier_id in ($1, $2)", [
          s1,
          s2,
        ]),
      ).toBe(1); // a platform-wide grant is visible to every signed-in org; the named one is not
    });
  });

  it("grants are immutable except revocation; revocation and expiry flip the predicate immediately", async () => {
    await asUser(db, U.op, async () => {
      expect(
        await expectError(
          db,
          `update public.source_permissions set scope = '{"buyer_visibility":"platform_buyers","fields":["price_tiers","moq"]}' where id = $1`,
          [platformGrant],
        ),
      ).toMatch(/immutable except for revocation/);
      expect(
        await expectError(
          db,
          "update public.source_permissions set expires_at = now() + interval '1 day' where id = $1",
          [platformGrant],
        ),
      ).toMatch(/immutable except for revocation/);
    });
    await asUser(db, U.aOwner, async () => {
      await db.exec(
        `update public.source_permissions set revoked_at = now() where id = '${platformGrant}'`,
      ); // RLS: 0 rows
    });
    expect(
      (
        await db.query<{ ok: boolean }>(
          "select app.catalog_grant_active($1, $2, 'price_tiers') as ok",
          [s1, ORG.b],
        )
      )[0]!.ok,
    ).toBe(true);
    await asUser(db, U.s1Owner, async () => {
      await db.exec(
        `update public.source_permissions set revoked_at = now(), revoke_reason = 'supplier withdrew consent' where id = '${platformGrant}'`,
      );
    });
    expect(
      (
        await db.query<{ ok: boolean }>(
          "select app.catalog_grant_active($1, $2, 'price_tiers') as ok",
          [s1, ORG.b],
        )
      )[0]!.ok,
    ).toBe(false);
    expect(
      (
        await db.query<{ by: string }>(
          "select revoked_by as by from public.source_permissions where id = $1",
          [platformGrant],
        )
      )[0]!.by,
    ).toBe(U.s1Owner);
    await asUser(db, U.bOwner, async () => {
      expect(
        await count("select 1 from public.source_permissions where supplier_id in ($1, $2)", [
          s1,
          s2,
        ]),
      ).toBe(0); // revoked rows disappear from buyers
    });
    // expired grant inserted directly (past dates) → predicate false
    await db.exec(
      `insert into public.source_permissions (supplier_id, rights_class, scope, recorded_by, granted_at, expires_at)
       values ('${s2}', 'catalog_public_with_permission', '{"buyer_visibility":"platform_buyers","fields":["price_tiers"]}', '${U.op}', now() - interval '2 days', now() - interval '1 day')`,
    );
    expect(
      (
        await db.query<{ ok: boolean }>(
          "select app.catalog_grant_active($1, $2, 'price_tiers') as ok",
          [s2, ORG.a],
        )
      )[0]!.ok,
    ).toBe(false);
  });
});

describe("research_leads (internal_market_observation only)", () => {
  it("operators record leads; rights_class is pinned; min<=max enforced; buyers and suppliers read nothing", async () => {
    await asUser(db, U.op, async () => {
      await db.exec(
        `insert into public.research_leads (taxonomy_id, source_system_id, search_term_zh, title_zh, observed_min_price, observed_max_price, observed_moq, observed_unit, notes)
         values ('${labelsTax}', '${manualSource}', '定制卷筒不干胶标签', '某店铺 卷筒不干胶标签 定制', 0.05, 0.12, 5000, 'pcs', 'tiered listing; indicative only')`,
      );
      expect(
        await expectError(
          db,
          "insert into public.research_leads (taxonomy_id, source_system_id, rights_class) values ($1, $2, 'catalog_public_with_permission')",
          [labelsTax, manualSource],
        ),
      ).toMatch(/check/);
      expect(
        await expectError(
          db,
          "insert into public.research_leads (taxonomy_id, source_system_id, observed_min_price, observed_max_price) values ($1, $2, 2, 1)",
          [labelsTax, manualSource],
        ),
      ).toMatch(/check/);
      expect(
        await count("select 1 from public.research_leads where recorded_by = $1", [U.op]),
      ).toBe(1);
    });
    for (const u of [U.aOwner, U.s1Owner, U.bOwner]) {
      await asUser(db, u, async () => {
        expect(await count("select 1 from public.research_leads"), u).toBe(0);
        expect(
          await expectError(
            db,
            "insert into public.research_leads (taxonomy_id, source_system_id) values ($1, $2)",
            [labelsTax, manualSource],
          ),
          u,
        ).toMatch(/row-level security/);
      });
    }
    await asUser(db, U.comp, async () => {
      expect(
        await count("select 1 from public.research_leads where recorded_by = $1", [U.op]),
      ).toBe(1);
    });
  });
});

describe("grant layer", () => {
  it("authenticated cannot DELETE from any 0005 table (deactivate / revoke instead)", async () => {
    for (const t of [
      "supplier_profiles",
      "supplier_facilities",
      "supplier_contacts",
      "contact_disclosure_grants",
      "source_systems",
      "source_permissions",
      "research_leads",
    ]) {
      await asUser(db, U.admin, async () => {
        expect(await expectError(db, `delete from public.${t}`), t).toMatch(/permission denied/);
      });
    }
  });
});
