/**
 * B-06 — taxonomy, attribute definitions, products/variants/specifications: reference data integrity,
 * deterministic attribute validation, immutability, and tenant isolation (as `authenticated`).
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
  aOwner: "a1000000-0000-4000-8000-000000000001",
  aViewer: "a1000000-0000-4000-8000-000000000002",
  bOwner: "b1000000-0000-4000-8000-000000000001",
  op: "c1000000-0000-4000-8000-000000000001",
  admin: "c1000000-0000-4000-8000-000000000003",
};
const ORG = {
  a: "aaaaaaa1-0000-4000-8000-000000000001",
  b: "bbbbbbb1-0000-4000-8000-000000000001",
};

let db: Db;
let labels: string; // taxonomy id of packaging.labels_roll
let hair: string;

beforeAll(async () => {
  db = await openDb();
  if (db.engine === "pglite") {
    await applyMigrations(db);
    await db.exec(readSeed());
  }
  await db.exec(`delete from public.organizations where id in ('${ORG.a}','${ORG.b}')`);
  await db.exec(
    `delete from auth.users where id in (${Object.values(U)
      .map((u) => `'${u}'`)
      .join(",")})`,
  );
  await db.exec(
    `insert into auth.users (id, email) values ${Object.entries(U)
      .map(([k, id]) => `('${id}', 'tax-${k.toLowerCase()}@example.test')`)
      .join(",")}`,
  );
  await db.exec(`
    insert into public.organizations (id, org_type, legal_name, display_name) values
      ('${ORG.a}', 'buyer', 'Tax Buyer A', 'Tax A'), ('${ORG.b}', 'buyer', 'Tax Buyer B', 'Tax B');
    insert into public.memberships (org_id, user_id, role) values
      ('${ORG.a}', '${U.aOwner}', 'owner'), ('${ORG.a}', '${U.aViewer}', 'viewer'),
      ('${ORG.b}', '${U.bOwner}', 'owner'),
      ('${INTERNAL_ORG}', '${U.op}', 'operator'), ('${INTERNAL_ORG}', '${U.admin}', 'platform_admin');
  `);
  labels = (
    await db.query<{ id: string }>(
      "select id from public.product_taxonomy where code = 'packaging.labels_roll'",
    )
  )[0]!.id;
  hair = (
    await db.query<{ id: string }>(
      "select id from public.product_taxonomy where code = 'hair.bundles'",
    )
  )[0]!.id;
});

afterAll(async () => {
  await db.close();
});

describe("reference data (ADR-013 pilot families)", () => {
  it("has 6 roots and 16 families; exactly 3 pilot families; 6 blocked categories under `restricted`", async () => {
    const roots = await db.query("select 1 from public.product_taxonomy where parent_id is null");
    const children = await db.query(
      "select 1 from public.product_taxonomy where parent_id is not null",
    );
    expect(roots).toHaveLength(6);
    expect(children).toHaveLength(16);
    const pilots = await db.query<{ code: string }>(
      "select code from public.product_taxonomy where pilot_flag and parent_id is not null order by code",
    );
    expect(pilots.map((p) => p.code)).toEqual([
      "hair.bundles",
      "packaging.cartons_folding",
      "packaging.labels_roll",
    ]);
    const blocked = await db.query<{ code: string }>(
      "select code from public.product_taxonomy where compliance_state = 'blocked' and parent_id is not null",
    );
    expect(blocked).toHaveLength(6);
    expect(blocked.map((b) => b.code)).toContain("restricted.pill_press_encapsulation");
  });

  it("every attribute definition has a non-empty Chinese label and enum values carry zh text", async () => {
    const missing = await db.query(
      "select code from public.attribute_definitions where label_zh is null or length(trim(label_zh)) = 0",
    );
    expect(missing).toHaveLength(0);
    const enumsWithoutZh = await db.query(
      `select d.code from public.attribute_definitions d, jsonb_array_elements(d.allowed_values) a
        where d.data_type = 'enum' and (a ->> 'zh' is null or length(a ->> 'zh') = 0)`,
    );
    expect(enumsWithoutZh).toHaveLength(0);
  });

  it("each pilot family has required hard attributes defined", async () => {
    for (const code of ["packaging.labels_roll", "packaging.cartons_folding", "hair.bundles"]) {
      const rows = await db.query<{ n: string }>(
        `select count(*)::text as n from public.attribute_definitions d join public.product_taxonomy t on t.id = d.taxonomy_id
          where t.code = $1 and d.is_hard_default and d.required`,
        [code],
      );
      expect(Number(rows[0]!.n), code).toBeGreaterThanOrEqual(4);
    }
  });

  it("re-running the reference-data block is a no-op (idempotent upserts)", async () => {
    const sql = listMigrations().find((m) => m.name === "taxonomy_products")!.sql;
    const block = sql.slice(
      sql.indexOf("-- BEGIN REFERENCE DATA"),
      sql.indexOf("-- END REFERENCE DATA"),
    );
    const snap = async () =>
      JSON.stringify([
        await db.query(
          "select code, name_en, name_zh, compliance_state, pilot_flag, sort_order from public.product_taxonomy order by code",
        ),
        await db.query(
          "select t.code as tax, d.code, d.label_zh, d.data_type, d.is_hard_default, d.required from public.attribute_definitions d join public.product_taxonomy t on t.id = d.taxonomy_id order by 1, 2",
        ),
      ]);
    const before = await snap();
    await db.exec(block);
    expect(await snap()).toBe(before);
  });
});

describe("deterministic attribute validation", () => {
  it("accepts a valid labels spec and rejects unknown codes, wrong types, bad enum values and missing required", async () => {
    const ok = `{"width_mm":50,"height_mm":76,"shape":"rectangle","face_stock":"bopp_white","adhesive":"permanent_acrylic","print_colors":"CMYK 4/0","finish":"matte_lamination"}`;
    await db.query("select app.validate_attributes($1, $2::jsonb)", [labels, ok]);
    expect(
      await expectError(db, "select app.validate_attributes($1, $2::jsonb)", [
        labels,
        ok.replace("width_mm", "wdth_mm"),
      ]),
    ).toMatch(/unknown attribute "wdth_mm"/);
    expect(
      await expectError(db, "select app.validate_attributes($1, $2::jsonb)", [
        labels,
        ok.replace('"width_mm":50', '"width_mm":"50"'),
      ]),
    ).toMatch(/must be a number/);
    expect(
      await expectError(db, "select app.validate_attributes($1, $2::jsonb)", [
        labels,
        ok.replace("bopp_white", "vinyl"),
      ]),
    ).toMatch(/not an allowed value/);
    expect(
      await expectError(db, "select app.validate_attributes($1, $2::jsonb)", [
        labels,
        `{"width_mm":50}`,
      ]),
    ).toMatch(/missing required attributes: .*height_mm/);
  });

  it("explicit null is allowed (unknown ≠ default) but a hair attribute on a label taxonomy is not", async () => {
    await db.query("select app.validate_attributes($1, $2::jsonb)", [
      labels,
      `{"width_mm":50,"height_mm":76,"shape":"rectangle","face_stock":"bopp_white","adhesive":"permanent_acrylic","print_colors":"CMYK 4/0","finish":"matte_lamination","liner":null}`,
    ]);
    expect(
      await expectError(db, "select app.validate_attributes($1, $2::jsonb)", [
        labels,
        `{"weight_g":100}`,
      ]),
    ).toMatch(/unknown attribute "weight_g"/);
  });
});

describe("products / variants / specifications", () => {
  const validLabel = `{"width_mm":50,"height_mm":76,"shape":"rectangle","face_stock":"bopp_white","adhesive":"permanent_acrylic","print_colors":"CMYK 4/0","finish":"matte_lamination"}`;

  it("buyer A creates an owned product + variant; B, viewer-only reads, and the unassigned operator cannot see it; admin can", async () => {
    const productId = await asUser(db, U.aOwner, async () => {
      const r = await db.query<{ id: string }>(
        `insert into public.products (taxonomy_id, owner_org_id, canonical_name_en) values ($1, $2, 'A roll label 50x76') returning id`,
        [labels, ORG.a],
      );
      await db.query(
        `insert into public.product_variants (product_id, variant_code, attributes) values ($1, 'A-1', $2::jsonb)`,
        [r[0]!.id, validLabel],
      );
      return r[0]!.id;
    });
    const seen = (uid: string) =>
      asUser(db, uid, () => db.query("select id from public.products where id = $1", [productId]));
    expect(await seen(U.aOwner)).toHaveLength(1);
    expect(await seen(U.aViewer)).toHaveLength(1);
    expect(await seen(U.bOwner)).toHaveLength(0);
    expect(await seen(U.op)).toHaveLength(0);
    expect(await seen(U.admin)).toHaveLength(1);
    const variantSeen = await asUser(db, U.bOwner, () =>
      db.query("select id from public.product_variants where product_id = $1", [productId]),
    );
    expect(variantSeen).toHaveLength(0);
    const owner = await db.query<{ owner_org_id: string }>(
      "select owner_org_id from public.product_variants where product_id = $1",
      [productId],
    );
    expect(owner[0]!.owner_org_id).toBe(ORG.a); // denormalized by trigger
  });

  it("viewer cannot create products; buyer cannot create a platform-canonical (owner null) product; operator can", async () => {
    expect(
      await asUser(db, U.aViewer, () =>
        expectError(
          db,
          `insert into public.products (taxonomy_id, owner_org_id, canonical_name_en) values ('${labels}', '${ORG.a}', 'x')`,
        ),
      ),
    ).toMatch(/row-level security/);
    expect(
      await asUser(db, U.aOwner, () =>
        expectError(
          db,
          `insert into public.products (taxonomy_id, canonical_name_en) values ('${labels}', 'canonical')`,
        ),
      ),
    ).toMatch(/row-level security/);
    const id = await asUser(
      db,
      U.op,
      async () =>
        (
          await db.query<{ id: string }>(
            `insert into public.products (taxonomy_id, canonical_name_en, canonical_name_zh) values ('${hair}', 'Canonical bundle', '标准发帘') returning id`,
          )
        )[0]!.id,
    );
    // canonical rows are readable by every signed-in user
    expect(
      await asUser(db, U.bOwner, () =>
        db.query("select id from public.products where id = $1", [id]),
      ),
    ).toHaveLength(1);
  });

  it("buyer A cannot create a product owned by org B (write-side isolation)", async () => {
    expect(
      await asUser(db, U.aOwner, () =>
        expectError(
          db,
          `insert into public.products (taxonomy_id, owner_org_id, canonical_name_en) values ('${labels}', '${ORG.b}', 'sneaky')`,
        ),
      ),
    ).toMatch(/row-level security/);
  });

  it("variant attributes are validated on write and duplicate attribute sets are rejected", async () => {
    const productId = (
      await db.query<{ id: string }>(
        "select id from public.products where owner_org_id = $1 limit 1",
        [ORG.a],
      )
    )[0]!.id;
    expect(
      await asUser(db, U.aOwner, () =>
        expectError(
          db,
          `insert into public.product_variants (product_id, attributes) values ('${productId}', '{"width_mm":"wide"}')`,
        ),
      ),
    ).toMatch(/must be a number|missing required/);
    expect(
      await asUser(db, U.aOwner, () =>
        expectError(
          db,
          `insert into public.product_variants (product_id, variant_code, attributes) values ('${productId}', 'dup', '${validLabel}')`,
        ),
      ),
    ).toMatch(/duplicate key|product_variants_product_id_attributes_hash_key/);
  });

  it("variant key order does not matter for the hash (jsonb canonical form)", async () => {
    const productId = (
      await db.query<{ id: string }>(
        "select id from public.products where owner_org_id = $1 limit 1",
        [ORG.a],
      )
    )[0]!.id;
    const reordered = `{"finish":"matte_lamination","print_colors":"CMYK 4/0","adhesive":"permanent_acrylic","face_stock":"bopp_white","shape":"rectangle","height_mm":76,"width_mm":50}`;
    expect(
      await asUser(db, U.aOwner, () =>
        expectError(
          db,
          `insert into public.product_variants (product_id, variant_code, attributes) values ('${productId}', 'dup2', '${reordered}')`,
        ),
      ),
    ).toMatch(/duplicate key/);
  });

  it("specifications are versioned and immutable; a new version is a new row", async () => {
    const variantId = (
      await db.query<{ id: string }>(
        "select id from public.product_variants where owner_org_id = $1 limit 1",
        [ORG.a],
      )
    )[0]!.id;
    const specId = await asUser(
      db,
      U.aOwner,
      async () =>
        (
          await db.query<{ id: string }>(
            `insert into public.product_specifications (taxonomy_id, variant_id, owner_org_id, version, attributes, hard_attribute_codes, text_en, source_lang)
         values ('${labels}', '${variantId}', '${ORG.a}', 1, '${validLabel}', array['width_mm','height_mm','face_stock'], 'White BOPP 50x76 matte', 'en-US') returning id`,
          )
        )[0]!.id,
    );
    // payload change rejected
    expect(
      await asUser(db, U.aOwner, () =>
        expectError(
          db,
          `update public.product_specifications set text_en = 'changed' where id = '${specId}'`,
        ),
      ),
    ).toMatch(/immutable/);
    // confirmation allowed
    await asUser(db, U.aOwner, () =>
      db.exec(
        `update public.product_specifications set confirmed_by = '${U.aOwner}', confirmed_at = now() where id = '${specId}'`,
      ),
    );
    // version 1 twice rejected, version 2 accepted
    expect(
      await asUser(db, U.aOwner, () =>
        expectError(
          db,
          `insert into public.product_specifications (taxonomy_id, variant_id, owner_org_id, version, attributes) values ('${labels}', '${variantId}', '${ORG.a}', 1, '${validLabel}')`,
        ),
      ),
    ).toMatch(/duplicate key/);
    await asUser(db, U.aOwner, () =>
      db.query(
        `insert into public.product_specifications (taxonomy_id, variant_id, owner_org_id, version, attributes) values ('${labels}', '${variantId}', '${ORG.a}', 2, '${validLabel}')`,
      ),
    );
    expect(
      await asUser(db, U.bOwner, () =>
        db.query("select id from public.product_specifications where variant_id = $1", [variantId]),
      ),
    ).toHaveLength(0);
  });

  it("ownership columns are immutable and every write is audited with the right actor", async () => {
    const productId = (
      await db.query<{ id: string }>(
        "select id from public.products where owner_org_id = $1 limit 1",
        [ORG.a],
      )
    )[0]!.id;
    expect(
      await expectError(
        db,
        `update public.products set owner_org_id = '${ORG.b}' where id = '${productId}'`,
      ),
    ).toMatch(/immutable/);
    const audits = await db.query<{ actor_user_id: string; acting_as: string }>(
      "select actor_user_id, acting_as from public.audit_events where entity_table = 'products' and entity_id = $1 and action = 'insert'",
      [productId],
    );
    expect(audits).toEqual([{ actor_user_id: U.aOwner, acting_as: "member" }]);
  });

  it("taxonomy and attribute definitions are readable by any signed-in user and not writable by buyers", async () => {
    const rows = await asUser(db, U.bOwner, () =>
      db.query("select code from public.product_taxonomy where compliance_state = 'blocked'"),
    );
    expect(rows.length).toBeGreaterThan(0);
    expect(
      await asUser(db, U.bOwner, () =>
        expectError(
          db,
          `update public.product_taxonomy set pilot_flag = true where code = 'restricted'`,
        ),
      ),
    ).toMatch(/permission denied/);
    expect(
      await asUser(db, U.admin, () =>
        expectError(
          db,
          `insert into public.product_taxonomy (code, name_en, name_zh) values ('zzz', 'z', 'z')`,
        ),
      ),
    ).toMatch(/permission denied/);
  });
});
