/**
 * B-15 — projects_briefs (0008): buyer-owned projects, assignments that turn I.op− into I.op+, the supplier shortlist
 * that scopes an assigned operator's access to restricted contacts and documents, briefs/items with compliance holds,
 * and the policy replacements deferred from 0005/0006.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { applyMigrations, asUser, expectError, openDb, readSeed, type Db } from "./db.js";

const INTERNAL_ORG = "00000000-0000-4000-8000-000000000001";
const U = {
  aOwner: "b1000000-0000-4000-8000-000000000001",
  aMember: "b1000000-0000-4000-8000-000000000002",
  aViewer: "b1000000-0000-4000-8000-000000000003",
  bOwner: "b2000000-0000-4000-8000-000000000001",
  sOwner: "b3000000-0000-4000-8000-000000000001",
  opLead: "b9000000-0000-4000-8000-000000000001",
  opSupport: "b9000000-0000-4000-8000-000000000002",
  opOther: "b9000000-0000-4000-8000-000000000003",
  comp: "b9000000-0000-4000-8000-000000000004",
  admin: "b9000000-0000-4000-8000-000000000005",
};
const ORG = {
  a: "b1b1b1b1-0000-4000-8000-000000000001",
  b: "b2b2b2b2-0000-4000-8000-000000000001",
  s: "b3b3b3b3-0000-4000-8000-000000000001",
};
const PROJ = {
  a1: "b4000000-0000-4000-8000-000000000001",
  b1: "b4000000-0000-4000-8000-000000000002",
};
const DOC = {
  a1: "b5000000-0000-4000-8000-000000000001",
  s1: "b5000000-0000-4000-8000-000000000002",
};
const REVIEW_TAX = "b6000000-0000-4000-8000-000000000001";
const LABEL_ATTRS = `{"width_mm":50,"height_mm":30,"shape":"rectangle","face_stock":"bopp_white","adhesive":"permanent_acrylic","print_colors":"CMYK 4/0","finish":"matte_lamination"}`;

let db: Db;
let supplierId = "";
let labelsTax = "";
let blockedTax = "";
let briefId = "";
let contactId = "";

const count = async (sql: string, params: unknown[] = []) =>
  Number(
    (await db.query<{ n: string }>(`select count(*)::text as n from (${sql}) q`, params))[0]!.n,
  );
const canSeeProject = (uid: string, project: string) =>
  asUser(db, uid, () => count("select 1 from public.sourcing_projects where id = $1", [project]));

beforeAll(async () => {
  db = await openDb();
  if (db.engine === "pglite") {
    await applyMigrations(db);
    await db.exec(readSeed());
  }
  const orgList = Object.values(ORG)
    .map((o) => `'${o}'`)
    .join(",");
  await db.exec(
    `delete from public.document_access_log where document_id in (select id from public.documents where org_id in (${orgList}))`,
  );
  await db.exec(`delete from public.organizations where id in (${orgList})`);
  await db.exec(`delete from public.product_taxonomy where id = '${REVIEW_TAX}'`);
  await db.exec(
    `delete from auth.users where id in (${Object.values(U)
      .map((u) => `'${u}'`)
      .join(",")})`,
  );
  await db.exec(
    `insert into auth.users (id, email) values ${Object.entries(U)
      .map(([k, id]) => `('${id}', 'prj-${k.toLowerCase()}@example.test')`)
      .join(",")}`,
  );
  await db.exec(`
    insert into public.organizations (id, org_type, legal_name, display_name) values
      ('${ORG.a}', 'buyer', 'Project Buyer A', 'A'), ('${ORG.b}', 'buyer', 'Project Buyer B', 'B'),
      ('${ORG.s}', 'supplier', '项目供应商', 'S');
    insert into public.memberships (org_id, user_id, role) values
      ('${ORG.a}', '${U.aOwner}', 'owner'), ('${ORG.a}', '${U.aMember}', 'member'), ('${ORG.a}', '${U.aViewer}', 'viewer'),
      ('${ORG.b}', '${U.bOwner}', 'owner'), ('${ORG.s}', '${U.sOwner}', 'owner'),
      ('${INTERNAL_ORG}', '${U.opLead}', 'operator'), ('${INTERNAL_ORG}', '${U.opSupport}', 'operator'),
      ('${INTERNAL_ORG}', '${U.opOther}', 'operator'), ('${INTERNAL_ORG}', '${U.comp}', 'compliance_reviewer'),
      ('${INTERNAL_ORG}', '${U.admin}', 'platform_admin');
    insert into public.supplier_profiles (org_id, legal_name_zh) values ('${ORG.s}', '项目供应商有限公司');
    insert into public.product_taxonomy (id, code, name_en, name_zh, compliance_state, sort_order)
      values ('${REVIEW_TAX}', 'test.review_required', 'Test review-required node', '测试', 'review_required', 999);
  `);
  supplierId = (
    await db.query<{ id: string }>("select id from public.supplier_profiles where org_id = $1", [
      ORG.s,
    ])
  )[0]!.id;
  labelsTax = (
    await db.query<{ id: string }>(
      "select id from public.product_taxonomy where code = 'packaging.labels_roll'",
    )
  )[0]!.id;
  blockedTax = (
    await db.query<{ id: string }>(
      "select id from public.product_taxonomy where code = 'restricted.medical_gloves'",
    )
  )[0]!.id;
  // a restricted contact for S (platform admin creates; 0005)
  contactId = (
    await db.query<{ id: string }>(
      "insert into public.supplier_contacts (supplier_id, name, wechat_handle, contact_basis, created_by) values ($1, '项目联系人', 'prj_contact_001', 'operator_sourced', $2) returning id",
      [supplierId, U.admin],
    )
  )[0]!.id;
});

afterAll(async () => {
  // leave the shared database as we found it: the temporary review_required taxonomy node must not survive
  // (taxonomy.test.ts counts roots), and it can only go once the brief items referencing it are gone
  const orgList = Object.values(ORG)
    .map((o) => `'${o}'`)
    .join(",");
  await db.exec(
    `delete from public.document_access_log where document_id in (select id from public.documents where org_id in (${orgList}))`,
  );
  await db.exec(`delete from public.organizations where id in (${orgList})`);
  await db.exec(`delete from public.product_taxonomy where id = '${REVIEW_TAX}'`);
  await db.close();
});

describe("sourcing_projects (Pattern A)", () => {
  it("buyer members create; viewers and suppliers cannot; supplier orgs cannot own a project; B and unassigned operators see nothing", async () => {
    await asUser(db, U.aMember, async () => {
      await db.exec(
        `insert into public.sourcing_projects (id, org_id, name, lead_operator_id, compliance_hold) values ('${PROJ.a1}', '${ORG.a}', 'Q1 label run', '${U.opLead}', true)`,
      );
      const r = await db.query<{ lead: string | null; hold: boolean; incoterm: string }>(
        "select lead_operator_id as lead, compliance_hold as hold, target_incoterm::text as incoterm from public.sourcing_projects where id = $1",
        [PROJ.a1],
      );
      expect(r[0]).toEqual({ lead: null, hold: false, incoterm: "unknown" }); // staff-only columns reset; unknown ≠ EXW
      expect(
        await expectError(
          db,
          "insert into public.sourcing_projects (org_id, name) values ($1, 'not mine')",
          [ORG.b],
        ),
      ).toMatch(/row-level security/);
    });
    await asUser(db, U.aViewer, async () => {
      expect(
        await expectError(
          db,
          "insert into public.sourcing_projects (org_id, name) values ($1, 'viewer')",
          [ORG.a],
        ),
      ).toMatch(/row-level security/);
      expect(await count("select 1 from public.sourcing_projects where id = $1", [PROJ.a1])).toBe(
        1,
      );
      await db.exec(
        `update public.sourcing_projects set name = 'renamed by viewer' where id = '${PROJ.a1}'`,
      ); // 0 rows
    });
    await asUser(db, U.sOwner, async () => {
      expect(
        await expectError(
          db,
          "insert into public.sourcing_projects (org_id, name) values ($1, 'supplier project')",
          [ORG.s],
        ),
      ).toMatch(/buyer organization|row-level security/);
    });
    await asUser(db, U.bOwner, async () => {
      await db.exec(
        `insert into public.sourcing_projects (id, org_id, name) values ('${PROJ.b1}', '${ORG.b}', 'B project')`,
      );
    });
    expect(await canSeeProject(U.bOwner, PROJ.a1)).toBe(0);
    expect(await canSeeProject(U.opLead, PROJ.a1)).toBe(0); // not assigned yet
    expect(await canSeeProject(U.comp, PROJ.a1)).toBe(1); // compliance reads for holds
    expect(await canSeeProject(U.admin, PROJ.a1)).toBe(1);
    expect(
      (
        await db.query<{ n: string }>(
          "select name as n from public.sourcing_projects where id = $1",
          [PROJ.a1],
        )
      )[0]!.n,
    ).toBe("Q1 label run");
  });

  it("buyers cannot set lead_operator_id or compliance_hold; compliance can hold; org_id is immutable", async () => {
    await asUser(db, U.aOwner, async () => {
      expect(
        await expectError(
          db,
          "update public.sourcing_projects set lead_operator_id = $2 where id = $1",
          [PROJ.a1, U.opLead],
        ),
      ).toMatch(/staff only/);
      expect(
        await expectError(
          db,
          "update public.sourcing_projects set compliance_hold = true where id = $1",
          [PROJ.a1],
        ),
      ).toMatch(/compliance reviewers/);
      expect(
        await expectError(db, "update public.sourcing_projects set org_id = $2 where id = $1", [
          PROJ.a1,
          ORG.b,
        ]),
      ).toMatch(/immutable|cannot be changed/i);
      await db.exec(
        `update public.sourcing_projects set status = 'active', target_date = current_date + 60 where id = '${PROJ.a1}'`,
      );
    });
    await asUser(db, U.comp, async () => {
      await db.exec(
        `update public.sourcing_projects set compliance_hold = true, compliance_note = 'destination check' where id = '${PROJ.a1}'`,
      );
      expect(
        await expectError(
          db,
          "update public.sourcing_projects set name = 'compliance rename' where id = $1",
          [PROJ.a1],
        ),
      ).toMatch(/compliance reviewers may only change/);
    });
    const r = await db.query<{ hold: boolean }>(
      "select compliance_hold as hold from public.sourcing_projects where id = $1",
      [PROJ.a1],
    );
    expect(r[0]!.hold).toBe(true);
    await asUser(db, U.comp, async () => {
      await db.exec(
        `update public.sourcing_projects set compliance_hold = false, compliance_note = null where id = '${PROJ.a1}'`,
      );
    });
  });
});

describe("project_assignments (I.op− → I.op+)", () => {
  it("platform admin assigns a lead; the lead adds support; other operators cannot self-assign; non-internal users cannot be assigned", async () => {
    await asUser(db, U.opOther, async () => {
      expect(
        await expectError(
          db,
          "insert into public.project_assignments (project_id, operator_user_id, role) values ($1, $2, 'lead')",
          [PROJ.a1, U.opOther],
        ),
      ).toMatch(/row-level security/);
    });
    await asUser(db, U.admin, async () => {
      expect(
        await expectError(
          db,
          "insert into public.project_assignments (project_id, operator_user_id, role) values ($1, $2, 'lead')",
          [PROJ.a1, U.aOwner],
        ),
      ).toMatch(/internal organisation/);
      await db.exec(
        `insert into public.project_assignments (project_id, operator_user_id, role) values ('${PROJ.a1}', '${U.opLead}', 'lead')`,
      );
      expect(
        await expectError(
          db,
          "insert into public.project_assignments (project_id, operator_user_id, role) values ($1, $2, 'lead')",
          [PROJ.a1, U.opSupport],
        ),
      ).toMatch(/one_lead|unique/);
    });
    await asUser(db, U.opLead, async () => {
      await db.exec(
        `insert into public.project_assignments (project_id, operator_user_id, role) values ('${PROJ.a1}', '${U.opSupport}', 'support')`,
      );
      expect(
        await expectError(
          db,
          "insert into public.project_assignments (project_id, operator_user_id, role) values ($1, $2, 'support')",
          [PROJ.b1, U.opSupport],
        ),
      ).toMatch(/row-level security/); // not lead on B's project
    });
    expect(await canSeeProject(U.opLead, PROJ.a1)).toBe(1);
    expect(await canSeeProject(U.opSupport, PROJ.a1)).toBe(1);
    expect(await canSeeProject(U.opOther, PROJ.a1)).toBe(0);
    expect(await canSeeProject(U.opLead, PROJ.b1)).toBe(0);
    await asUser(db, U.aOwner, async () => {
      expect(
        await count("select 1 from public.project_assignments where project_id = $1", [PROJ.a1]),
      ).toBe(2); // buyer sees who works its project
      expect(
        await expectError(
          db,
          "insert into public.project_assignments (project_id, operator_user_id) values ($1, $2)",
          [PROJ.a1, U.opOther],
        ),
      ).toMatch(/row-level security/);
    });
    await asUser(db, U.bOwner, async () => {
      expect(
        await count("select 1 from public.project_assignments where project_id = $1", [PROJ.a1]),
      ).toBe(0);
    });
  });

  it("an assigned operator can edit the project (not its org) and set the lead operator; deactivating the assignment removes access", async () => {
    await asUser(db, U.opLead, async () => {
      await db.exec(
        `update public.sourcing_projects set lead_operator_id = '${U.opLead}', target_incoterm = 'FOB' where id = '${PROJ.a1}'`,
      );
      expect(
        await expectError(db, "update public.sourcing_projects set org_id = $2 where id = $1", [
          PROJ.a1,
          ORG.b,
        ]),
      ).toMatch(/immutable|cannot be changed/i);
      await db.exec(
        `update public.project_assignments set active = false where project_id = '${PROJ.a1}' and operator_user_id = '${U.opSupport}'`,
      );
    });
    expect(await canSeeProject(U.opSupport, PROJ.a1)).toBe(0);
    await asUser(db, U.opLead, async () => {
      await db.exec(
        `update public.project_assignments set active = true where project_id = '${PROJ.a1}' and operator_user_id = '${U.opSupport}'`,
      );
    });
  });
});

describe("buyer_briefs + brief_items (Pattern B, compliance)", () => {
  it("members create a brief (org derived, must start draft); a mismatched org_id is rejected; blocked taxonomy refused; review_required sets a hold", async () => {
    await asUser(db, U.aMember, async () => {
      expect(
        await expectError(
          db,
          "insert into public.buyer_briefs (project_id, org_id, raw_input_en) values ($1, $2, 'x')",
          [PROJ.a1, ORG.b],
        ),
      ).toMatch(/org_id must equal the parent/);
      expect(
        await expectError(
          db,
          "insert into public.buyer_briefs (project_id, raw_input_en, status) values ($1, 'x', 'ready')",
          [PROJ.a1],
        ),
      ).toMatch(/starts as draft/);
      expect(
        await expectError(db, "insert into public.buyer_briefs (project_id) values ($1)", [
          PROJ.a1,
        ]),
      ).toMatch(/check/);
      briefId = (
        await db.query<{ id: string }>(
          'insert into public.buyer_briefs (project_id, raw_input_en, ai_proposal) values ($1, \'5,000 roll labels 50x30mm, BOPP, matte\', \'{"items":[{"family":"packaging.labels_roll"}]}\') returning id',
          [PROJ.a1],
        )
      )[0]!.id;
      expect(
        await expectError(
          db,
          "insert into public.buyer_briefs (project_id, raw_input_en) values ($1, 'B brief by A')",
          [PROJ.b1],
        ),
      ).toMatch(/row-level security/);
      expect(
        await expectError(
          db,
          "insert into public.brief_items (brief_id, line_no, taxonomy_id, quantity, quantity_unit) values ($1, 1, $2, 1000, 'pcs')",
          [briefId, blockedTax],
        ),
      ).toMatch(/is blocked: no self-service quoting/);
      await db.exec(
        `insert into public.brief_items (brief_id, line_no, taxonomy_id, quantity, quantity_unit, target_unit_price) values ('${briefId}', 1, '${labelsTax}', 5000, 'pcs', 0.04)`,
      );
      const held = await db.query<{ hold: boolean; project_id: string; org_id: string }>(
        "insert into public.brief_items (brief_id, line_no, taxonomy_id, quantity, quantity_unit, compliance_hold) values ($1, 2, $2, 10, 'pcs', false) returning compliance_hold as hold, project_id, org_id",
        [briefId, REVIEW_TAX],
      );
      expect(held[0]).toEqual({ hold: true, project_id: PROJ.a1, org_id: ORG.a });
      expect(
        await expectError(
          db,
          "update public.brief_items set compliance_hold = false where brief_id = $1 and line_no = 2",
          [briefId],
        ),
      ).toMatch(/compliance reviewers/);
      expect(
        await expectError(
          db,
          "insert into public.brief_items (brief_id, line_no, taxonomy_id, quantity, quantity_unit) values ($1, 3, $2, 0, 'pcs')",
          [briefId, labelsTax],
        ),
      ).toMatch(/check/);
    });
    await asUser(db, U.comp, async () => {
      await db.exec(
        `update public.brief_items set compliance_hold = false where brief_id = '${briefId}' and line_no = 2`,
      );
      expect(
        await expectError(
          db,
          "update public.brief_items set quantity = 11 where brief_id = $1 and line_no = 2",
          [briefId],
        ),
      ).toMatch(/compliance reviewers may only change/);
    });
    for (const [u, n] of [
      [U.bOwner, 0],
      [U.opOther, 0],
      [U.opLead, 2],
      [U.aViewer, 2],
      [U.sOwner, 0],
    ] as const) {
      await asUser(db, u, async () => {
        expect(
          await count("select 1 from public.brief_items where brief_id = $1", [briefId]),
          u,
        ).toBe(n);
      });
    }
  });

  it("brief status machine: draft → ready (buyer) → in_sourcing (assigned operator only) → closed; confirmed_spec_id must be platform/own-org", async () => {
    await asUser(db, U.aOwner, async () => {
      expect(
        await expectError(
          db,
          "update public.buyer_briefs set status = 'in_sourcing' where id = $1",
          [briefId],
        ),
      ).toMatch(/invalid brief transition/);
      await db.exec(`update public.buyer_briefs set status = 'ready' where id = '${briefId}'`);
      expect(
        await expectError(
          db,
          "update public.buyer_briefs set status = 'in_sourcing' where id = $1",
          [briefId],
        ),
      ).toMatch(/assigned operator/);
    });
    await asUser(db, U.opOther, async () => {
      await db.exec(
        `update public.buyer_briefs set status = 'in_sourcing' where id = '${briefId}'`,
      ); // not assigned: 0 rows
    });
    await asUser(db, U.opLead, async () => {
      await db.exec(
        `update public.buyer_briefs set status = 'in_sourcing' where id = '${briefId}'`,
      );
      expect(
        await expectError(db, "update public.buyer_briefs set status = 'draft' where id = $1", [
          briefId,
        ]),
      ).toMatch(/invalid brief transition/);
    });
    expect(
      (
        await db.query<{ s: string }>("select status as s from public.buyer_briefs where id = $1", [
          briefId,
        ])
      )[0]!.s,
    ).toBe("in_sourcing");
    // spec of another org cannot be confirmed; own-org spec (via brief item) can
    const item1 = (
      await db.query<{ id: string }>(
        "select id from public.brief_items where brief_id = $1 and line_no = 1",
        [briefId],
      )
    )[0]!.id;
    const item2 = (
      await db.query<{ id: string }>(
        "select id from public.brief_items where brief_id = $1 and line_no = 2",
        [briefId],
      )
    )[0]!.id;
    const foreignSpec = (
      await db.query<{ id: string }>(
        "insert into public.product_specifications (taxonomy_id, brief_item_id, owner_org_id, attributes, text_en, source_lang) values ($1, $2, $3, $4::jsonb, 'foreign-owned spec', 'en-US') returning id",
        [labelsTax, item2, ORG.b, LABEL_ATTRS],
      )
    )[0]!.id;
    const ownSpec = (
      await db.query<{ id: string }>(
        "insert into public.product_specifications (taxonomy_id, brief_item_id, owner_org_id, attributes, text_en, source_lang) values ($1, $2, $3, $4::jsonb, '50x30mm BOPP matte roll label', 'en-US') returning id",
        [labelsTax, item1, ORG.a, LABEL_ATTRS],
      )
    )[0]!.id;
    await asUser(db, U.aOwner, async () => {
      expect(
        await expectError(
          db,
          "update public.buyer_briefs set confirmed_spec_id = $2 where id = $1",
          [briefId, foreignSpec],
        ),
      ).toMatch(/platform or own-org/);
      await db.exec(
        `update public.buyer_briefs set confirmed_spec_id = '${ownSpec}' where id = '${briefId}'`,
      );
      await db.exec(
        `update public.brief_items set specification_id = '${ownSpec}' where id = '${item1}'`,
      );
      expect(
        await expectError(db, "update public.brief_items set specification_id = $2 where id = $1", [
          item1,
          foreignSpec,
        ]),
      ).toMatch(/same taxonomy|own-org/);
    });
  });
});

describe("shortlist scoping: contacts and documents for assigned operators (ADR-035)", () => {
  it("before shortlisting: assigned operator sees 0 contacts; after: reads/creates them; dropped → 0; other operators never", async () => {
    await asUser(db, U.opLead, async () => {
      expect(await count("select 1 from public.supplier_contacts where id = $1", [contactId])).toBe(
        0,
      );
      await db.exec(
        `insert into public.project_suppliers (project_id, supplier_id, reason) values ('${PROJ.a1}', '${supplierId}', 'strong label capability')`,
      );
      expect(await count("select 1 from public.supplier_contacts where id = $1", [contactId])).toBe(
        1,
      );
      await db.exec(
        `insert into public.supplier_contacts (supplier_id, name, phone, contact_basis) values ('${supplierId}', '新联系人', '13900000000', 'operator_sourced')`,
      );
      await db.exec(
        `update public.supplier_contacts set role_title = '销售' where id = '${contactId}'`,
      );
      expect(
        await expectError(
          db,
          "insert into public.project_suppliers (project_id, supplier_id) values ($1, $2)",
          [PROJ.b1, supplierId],
        ),
      ).toMatch(/row-level security/);
    });
    await asUser(db, U.opSupport, async () => {
      expect(
        await count("select 1 from public.supplier_contacts where supplier_id = $1", [supplierId]),
      ).toBe(2);
    });
    await asUser(db, U.opOther, async () => {
      expect(
        await count("select 1 from public.supplier_contacts where supplier_id = $1", [supplierId]),
      ).toBe(0);
      expect(
        await count("select 1 from public.project_suppliers where project_id = $1", [PROJ.a1]),
      ).toBe(0);
    });
    await asUser(db, U.aOwner, async () => {
      expect(
        await count("select 1 from public.project_suppliers where project_id = $1", [PROJ.a1]),
      ).toBe(1); // buyer sees its shortlist
      expect(
        await count("select 1 from public.supplier_contacts where supplier_id = $1", [supplierId]),
      ).toBe(0); // but still no contacts
    });
    await asUser(db, U.opLead, async () => {
      await db.exec(
        `update public.project_suppliers set status = 'dropped' where project_id = '${PROJ.a1}' and supplier_id = '${supplierId}'`,
      );
      expect(
        await count("select 1 from public.supplier_contacts where supplier_id = $1", [supplierId]),
      ).toBe(0);
      await db.exec(
        `update public.project_suppliers set status = 'contacted' where project_id = '${PROJ.a1}' and supplier_id = '${supplierId}'`,
      );
    });
  });

  it("an assigned operator grants a shortlisted contact only to that project's buyer org; the buyer then reads it", async () => {
    await asUser(db, U.opLead, async () => {
      expect(
        await expectError(
          db,
          "insert into public.contact_disclosure_grants (supplier_contact_id, buyer_org_id, reason) values ($1, $2, 'wrong buyer org for this project')",
          [contactId, ORG.b],
        ),
      ).toMatch(/row-level security/);
      await db.exec(
        `insert into public.contact_disclosure_grants (supplier_contact_id, buyer_org_id, reason) values ('${contactId}', '${ORG.a}', 'buyer asked for a direct sampling call')`,
      );
    });
    await asUser(db, U.aOwner, async () => {
      expect(await count("select 1 from public.supplier_contacts where id = $1", [contactId])).toBe(
        1,
      );
    });
    await asUser(db, U.opOther, async () => {
      await db.exec(
        `update public.contact_disclosure_grants set revoked_at = now() where supplier_contact_id = '${contactId}'`,
      ); // 0 rows
    });
    await asUser(db, U.opLead, async () => {
      await db.exec(
        `update public.contact_disclosure_grants set revoked_at = now(), revoke_reason = 'call done' where supplier_contact_id = '${contactId}'`,
      );
    });
    await asUser(db, U.aOwner, async () => {
      expect(await count("select 1 from public.supplier_contacts where id = $1", [contactId])).toBe(
        0,
      );
    });
  });

  it("documents: a buyer upload attached to the project is readable by its assigned operators; a shortlisted supplier's submission too; neither by others", async () => {
    await asUser(db, U.aMember, async () => {
      expect(
        await expectError(
          db,
          `insert into public.documents (id, org_id, project_id, source_type, rights_class, storage_path, original_filename, mime, bytes)
           values ('${DOC.a1}', '${ORG.a}', '${PROJ.b1}', 'buyer_upload', 'buyer_uploaded_private', '${ORG.a}/${DOC.a1}/brief.pdf', 'brief.pdf', 'application/pdf', 100)`,
        ),
      ).toMatch(/own organisation/);
      await db.exec(
        `insert into public.documents (id, org_id, project_id, source_type, rights_class, storage_path, original_filename, mime, bytes)
         values ('${DOC.a1}', '${ORG.a}', '${PROJ.a1}', 'buyer_upload', 'buyer_uploaded_private', '${ORG.a}/${DOC.a1}/brief.pdf', 'brief.pdf', 'application/pdf', 100)`,
      );
    });
    await asUser(db, U.sOwner, async () => {
      await db.exec(
        `insert into public.documents (id, org_id, supplier_id, source_type, rights_class, storage_path, original_filename, mime, bytes)
         values ('${DOC.s1}', '${ORG.s}', '${supplierId}', 'supplier_portal', 'supplier_submitted_private', '${ORG.s}/${DOC.s1}/catalog.pdf', 'catalog.pdf', 'application/pdf', 100)`,
      );
    });
    for (const [u, n] of [
      [U.opLead, 2],
      [U.opSupport, 2],
      [U.opOther, 0],
      [U.bOwner, 0],
      [U.comp, 0],
    ] as const) {
      await asUser(db, u, async () => {
        expect(
          await count("select 1 from public.documents where id in ($1, $2)", [DOC.a1, DOC.s1]),
          u,
        ).toBe(n);
      });
    }
    await asUser(db, U.opLead, async () => {
      expect(
        (
          await db.query<{ id: string }>("select app.log_document_access($1, 'signed_url') as id", [
            DOC.a1,
          ])
        )[0]!.id,
      ).toBeTruthy();
      await db.exec(
        `update public.project_suppliers set status = 'dropped' where project_id = '${PROJ.a1}' and supplier_id = '${supplierId}'`,
      );
      expect(await count("select 1 from public.documents where id = $1", [DOC.s1])).toBe(0);
      expect(await count("select 1 from public.documents where id = $1", [DOC.a1])).toBe(1);
    });
  });
});

describe("grant layer", () => {
  it("no DELETE for authenticated on any 0008 table", async () => {
    await asUser(db, U.admin, async () => {
      for (const t of [
        "sourcing_projects",
        "project_assignments",
        "project_suppliers",
        "buyer_briefs",
        "brief_items",
      ]) {
        expect(await expectError(db, `delete from public.${t}`), t).toMatch(/permission denied/);
      }
    });
  });
});
