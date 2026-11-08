/**
 * B-08b — supplier_evidence (0007): evidence-gated verification checks, supplier-claimed documents, the stage gate
 * driven by required-check data, the buyer-facing summary view, and the deferred evidence FKs.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { applyMigrations, asUser, expectError, openDb, readSeed, type Db } from "./db.js";

const INTERNAL_ORG = "00000000-0000-4000-8000-000000000001";
const U = {
  sOwner: "a7000000-0000-4000-8000-000000000001",
  sMember: "a7000000-0000-4000-8000-000000000002",
  s2Owner: "a7000000-0000-4000-8000-000000000003",
  aOwner: "a8000000-0000-4000-8000-000000000001",
  op: "a9000000-0000-4000-8000-000000000001",
  comp: "a9000000-0000-4000-8000-000000000002",
  admin: "a9000000-0000-4000-8000-000000000003",
};
const ORG = {
  s: "a7a7a7a7-0000-4000-8000-000000000001",
  s2: "a7a7a7a7-0000-4000-8000-000000000002",
  a: "a8a8a8a8-0000-4000-8000-000000000001",
};
const DOC = {
  license: "a7d00000-0000-4000-8000-000000000001", // supplier S, served
  pending: "a7d00000-0000-4000-8000-000000000002", // supplier S, still uploaded (quarantine)
  other: "a7d00000-0000-4000-8000-000000000003", // supplier S2, served
  internal: "a7d00000-0000-4000-8000-000000000004", // internal org upload (video-call screenshot), served
};
const SHA = (c: string) => c.repeat(64);

let db: Db;
let s = ""; // supplier_profiles.id for ORG.s
let s2 = "";

const count = async (sql: string, params: unknown[] = []) =>
  Number(
    (await db.query<{ n: string }>(`select count(*)::text as n from (${sql}) q`, params))[0]!.n,
  );
const summary = async (uid: string | null, supplier: string) =>
  asUser(db, uid, () =>
    db.query<{
      stage: string;
      stage_evidenced: boolean;
      passed_checks: string[];
      expired_checks: string[];
    }>(
      "select stage::text as stage, stage_evidenced, passed_checks::text[] as passed_checks, expired_checks::text[] as expired_checks from public.supplier_verification_summary_v where supplier_id = $1",
      [supplier],
    ),
  );

async function registerAndServe(
  id: string,
  org: string,
  supplierId: string | null,
  bucket: "supplier-evidence" | "documents",
  by: string,
  file: string,
  serve = true,
) {
  await asUser(db, by, () =>
    db.exec(
      `insert into public.documents (id, org_id, source_type, rights_class, supplier_id, storage_path, original_filename, mime, bytes)
       values ('${id}', '${org}', '${supplierId ? "supplier_portal" : "operator_import"}', '${supplierId ? "supplier_submitted_private" : "internal_market_observation"}',
               ${supplierId ? `'${supplierId}'` : "null"}, '${org}/${id}/${file}', '${file}', 'image/jpeg', 1000)`,
    ),
  );
  if (!serve) return;
  await asUser(
    db,
    null,
    async () => {
      await db.exec(`update public.documents set status = 'scanning' where id = '${id}'`);
      await db.exec(
        `update public.documents set status = 'parsed', sha256 = '${SHA(id.slice(-1))}', storage_bucket = '${bucket}' where id = '${id}'`,
      );
    },
    "service_role",
  );
}

beforeAll(async () => {
  db = await openDb();
  if (db.engine === "pglite") {
    await applyMigrations(db);
    await db.exec(readSeed());
  }
  // shared-database hygiene (real Postgres): access log first (restrict FK), then the orgs (cascades profiles, contacts,
  // facilities, permissions, checks and supplier documents), then the documents themselves (the internal upload last,
  // once nothing references it any more).
  const orgList = Object.values(ORG)
    .map((o) => `'${o}'`)
    .join(",");
  const docList = `'${Object.values(DOC).join("','")}'`;
  await db.exec(
    `delete from public.document_access_log where document_id in (select id from public.documents where org_id in (${orgList}) or id in (${docList}))`,
  );
  await db.exec(`delete from public.organizations where id in (${orgList})`);
  await db.exec(`delete from public.documents where id in (${docList})`);
  await db.exec(
    `delete from auth.users where id in (${Object.values(U)
      .map((u) => `'${u}'`)
      .join(",")})`,
  );
  await db.exec(
    `insert into auth.users (id, email) values ${Object.entries(U)
      .map(([k, id]) => `('${id}', 'ev-${k.toLowerCase()}@example.test')`)
      .join(",")}`,
  );
  await db.exec(`
    insert into public.organizations (id, org_type, legal_name, display_name) values
      ('${ORG.s}', 'supplier', '证据供应商', 'S'), ('${ORG.s2}', 'supplier', '另一供应商', 'S2'), ('${ORG.a}', 'buyer', 'Evidence Buyer A', 'A');
    insert into public.memberships (org_id, user_id, role) values
      ('${ORG.s}', '${U.sOwner}', 'owner'), ('${ORG.s}', '${U.sMember}', 'member'), ('${ORG.s2}', '${U.s2Owner}', 'owner'),
      ('${ORG.a}', '${U.aOwner}', 'owner'),
      ('${INTERNAL_ORG}', '${U.op}', 'operator'), ('${INTERNAL_ORG}', '${U.comp}', 'compliance_reviewer'), ('${INTERNAL_ORG}', '${U.admin}', 'platform_admin');
    insert into public.supplier_profiles (org_id, legal_name_zh, uscc) values ('${ORG.s}', '证据供应商有限公司', '91440300MA5F1XYW2K');
    insert into public.supplier_profiles (org_id, legal_name_zh) values ('${ORG.s2}', '另一供应商有限公司');
  `);
  s = (
    await db.query<{ id: string }>("select id from public.supplier_profiles where org_id = $1", [
      ORG.s,
    ])
  )[0]!.id;
  s2 = (
    await db.query<{ id: string }>("select id from public.supplier_profiles where org_id = $1", [
      ORG.s2,
    ])
  )[0]!.id;
  await registerAndServe(DOC.license, ORG.s, s, "supplier-evidence", U.sOwner, "license.jpg");
  await registerAndServe(
    DOC.pending,
    ORG.s,
    s,
    "supplier-evidence",
    U.sOwner,
    "pending.jpg",
    false,
  );
  await registerAndServe(DOC.other, ORG.s2, s2, "supplier-evidence", U.s2Owner, "other.jpg");
  await registerAndServe(DOC.internal, INTERNAL_ORG, null, "documents", U.op, "video-call.jpg");
});

afterAll(async () => {
  await db.close();
});

describe("supplier_documents (claimed until staff verify)", () => {
  it("supplier member registers its own served file as a license claim; verification columns are reset; foreign files rejected", async () => {
    await asUser(db, U.sMember, async () => {
      const r = await db.query<{ claimed: boolean; verified_by: string | null; org_id: string }>(
        `insert into public.supplier_documents (supplier_id, document_id, doc_kind, claim_note_zh, verified_by, verified_at)
         values ($1, $2, 'license', '营业执照副本', $3, now()) returning claimed_by_supplier as claimed, verified_by, org_id`,
        [s, DOC.license, U.sMember],
      );
      expect(r[0]).toEqual({ claimed: true, verified_by: null, org_id: ORG.s });
      expect(
        await expectError(
          db,
          "insert into public.supplier_documents (supplier_id, document_id, doc_kind) values ($1, $2, 'photo')",
          [s, DOC.other],
        ),
      ).toMatch(/not attributed to this supplier|row-level security/);
      expect(
        await expectError(
          db,
          "insert into public.supplier_documents (supplier_id, document_id, doc_kind) values ($1, $2, 'photo')",
          [s2, DOC.other],
        ),
      ).toMatch(/row-level security/);
      expect(
        await expectError(
          db,
          "update public.supplier_documents set verified_by = $2, verified_at = now() where document_id = $1",
          [DOC.license, U.sMember],
        ),
      ).toMatch(/staff only/);
    });
    await asUser(db, U.aOwner, async () => {
      expect(await count("select 1 from public.supplier_documents")).toBe(0);
    });
    await asUser(db, U.s2Owner, async () => {
      expect(
        await count("select 1 from public.supplier_documents where supplier_id = $1", [s]),
      ).toBe(0);
    });
  });
});

describe("supplier_verification_checks (evidence-gated)", () => {
  let licenseCheck = "";

  it("a pass needs an evidence document of that supplier that passed the scan; suppliers and buyers cannot record checks", async () => {
    await asUser(db, U.op, async () => {
      expect(
        await expectError(
          db,
          "insert into public.supplier_verification_checks (supplier_id, check_type, result) values ($1, 'business_license_reviewed', 'pass')",
          [s],
        ),
      ).toMatch(/check/);
      expect(
        await expectError(
          db,
          "insert into public.supplier_verification_checks (supplier_id, check_type, result, evidence_document_id) values ($1, 'business_license_reviewed', 'pass', $2)",
          [s, DOC.pending],
        ),
      ).toMatch(/has not passed the scan/);
      expect(
        await expectError(
          db,
          "insert into public.supplier_verification_checks (supplier_id, check_type, result, evidence_document_id) values ($1, 'business_license_reviewed', 'pass', $2)",
          [s, DOC.other],
        ),
      ).toMatch(/belongs to another supplier/);
      // inconclusive without evidence is allowed (it is not a pass)
      await db.exec(
        `insert into public.supplier_verification_checks (supplier_id, check_type, result, notes) values ('${s}', 'reference_checked', 'inconclusive', 'no reply yet')`,
      );
      licenseCheck = (
        await db.query<{ id: string }>(
          "insert into public.supplier_verification_checks (supplier_id, check_type, result, evidence_document_id, valid_until) values ($1, 'business_license_reviewed', 'pass', $2, now() + interval '365 days') returning id",
          [s, DOC.license],
        )
      )[0]!.id;
    });
    for (const u of [U.sOwner, U.aOwner]) {
      await asUser(db, u, async () => {
        expect(
          await expectError(
            db,
            "insert into public.supplier_verification_checks (supplier_id, check_type, result, evidence_document_id) values ($1, 'address_corroborated', 'pass', $2)",
            [s, DOC.license],
          ),
          u,
        ).toMatch(/row-level security/);
      });
    }
    // supplier reads its own checks; buyer and foreign supplier read nothing from the table
    await asUser(db, U.sOwner, async () => {
      expect(
        await count("select 1 from public.supplier_verification_checks where supplier_id = $1", [
          s,
        ]),
      ).toBe(2);
    });
    for (const u of [U.aOwner, U.s2Owner]) {
      await asUser(db, u, async () => {
        expect(await count("select 1 from public.supplier_verification_checks"), u).toBe(0);
      });
    }
  });

  it("checks are immutable except notes; uscc_matched cannot pass without a USCC on the profile", async () => {
    await asUser(db, U.comp, async () => {
      expect(
        await expectError(
          db,
          "update public.supplier_verification_checks set result = 'fail' where id = $1",
          [licenseCheck],
        ),
      ).toMatch(/immutable except notes/);
      expect(
        await expectError(
          db,
          "update public.supplier_verification_checks set valid_until = null where id = $1",
          [licenseCheck],
        ),
      ).toMatch(/immutable except notes/);
      await db.exec(
        `update public.supplier_verification_checks set notes = 'license image legible, name matches' where id = '${licenseCheck}'`,
      );
      expect(
        await expectError(
          db,
          "insert into public.supplier_verification_checks (supplier_id, check_type, result, evidence_document_id) values ($1, 'uscc_matched', 'pass', $2)",
          [s2, DOC.other],
        ),
      ).toMatch(/no USCC/);
    });
  });

  it("staff verify the supplier document, linking the check of the same supplier", async () => {
    await asUser(db, U.op, async () => {
      expect(
        await expectError(
          db,
          "update public.supplier_documents set verified_by = $2, verified_at = now(), verification_check_id = $3 where document_id = $1",
          [DOC.other, U.op, licenseCheck],
        ),
      ).toBeNull(); // S2 has no supplier_documents row yet → 0 rows, fine
      await db.exec(
        `update public.supplier_documents set verified_by = '${U.op}', verified_at = now(), verification_check_id = '${licenseCheck}', claimed_by_supplier = false where document_id = '${DOC.license}'`,
      );
    });
    const r = await db.query<{ verified_by: string; claimed: boolean }>(
      "select verified_by, claimed_by_supplier as claimed from public.supplier_documents where document_id = $1",
      [DOC.license],
    );
    expect(r[0]).toEqual({ verified_by: U.op, claimed: false });
  });
});

describe("stage gate (QUALITY_ASSURANCE §2 as data)", () => {
  it("contact_confirmed needs an active contact; legal_identity_reviewed needs all four identity checks; capabilities needs a facility check", async () => {
    await asUser(db, U.op, async () => {
      expect(
        await expectError(
          db,
          "update public.supplier_profiles set stage = 'contact_confirmed' where id = $1",
          [s],
        ),
      ).toMatch(/requires its entry evidence.*contact_confirmed/);
    });
    await asUser(db, U.admin, async () => {
      await db.exec(
        `insert into public.supplier_contacts (supplier_id, name, wechat_handle, contact_basis) values ('${s}', '李经理', 'li_ev_001', 'supplier_provided')`,
      );
    });
    await asUser(db, U.op, async () => {
      await db.exec(
        `update public.supplier_profiles set stage = 'contact_confirmed' where id = '${s}'`,
      );
      // identity: only business_license passes so far
      expect(
        await expectError(
          db,
          "update public.supplier_profiles set stage = 'legal_identity_reviewed' where id = $1",
          [s],
        ),
      ).toMatch(/missing for legal_identity_reviewed/);
      for (const t of ["uscc_matched", "address_corroborated", "bank_name_matches_entity"]) {
        await db.exec(
          `insert into public.supplier_verification_checks (supplier_id, check_type, result, evidence_document_id) values ('${s}', '${t}', 'pass', '${DOC.license}')`,
        );
      }
      await db.exec(
        `update public.supplier_profiles set stage = 'legal_identity_reviewed' where id = '${s}'`,
      );
      // capabilities: either video_call_held or factory_visit (group 1); internal upload is acceptable evidence
      expect(
        await expectError(
          db,
          "update public.supplier_profiles set stage = 'capabilities_documented' where id = $1",
          [s],
        ),
      ).toMatch(/missing for capabilities_documented/);
      await db.exec(
        `insert into public.supplier_verification_checks (supplier_id, check_type, result, evidence_document_id) values ('${s}', 'video_call_held', 'pass', '${DOC.internal}')`,
      );
      await db.exec(
        `update public.supplier_profiles set stage = 'capabilities_documented' where id = '${s}'`,
      );
      // demotion is always allowed; skipping ahead over a non-evidenced stage is not
      await db.exec(
        `update public.supplier_profiles set stage = 'contact_confirmed' where id = '${s}'`,
      );
      await db.exec(
        `update public.supplier_profiles set stage = 'capabilities_documented' where id = '${s}'`,
      );
      expect(
        await expectError(
          db,
          "update public.supplier_profiles set stage = 'legal_identity_reviewed' where id = $1",
          [s2],
        ),
      ).toMatch(/missing for contact_confirmed/);
    });
    expect(
      (
        await db.query<{ st: string }>(
          "select stage::text as st from public.supplier_profiles where id = $1",
          [s],
        )
      )[0]!.st,
    ).toBe("capabilities_documented");
  });

  it("a later failing check or an expired pass removes the evidence; the stage stays but is no longer evidenced", async () => {
    expect((await summary(U.aOwner, s))[0]).toMatchObject({
      stage: "capabilities_documented",
      stage_evidenced: true,
    });
    // a newer fail for address_corroborated supersedes the pass
    await asUser(db, U.comp, async () => {
      await db.exec(
        `insert into public.supplier_verification_checks (supplier_id, check_type, result, notes) values ('${s}', 'address_corroborated', 'fail', 'map shows a residential address')`,
      );
    });
    let v = (await summary(U.aOwner, s))[0]!;
    expect(v.stage_evidenced).toBe(false);
    expect(v.passed_checks).not.toContain("address_corroborated");
    // a fresh pass restores it; then an expired pass (inserted with past dates) shows under expired_checks
    await asUser(db, U.comp, async () => {
      await db.exec(
        `insert into public.supplier_verification_checks (supplier_id, check_type, result, evidence_document_id) values ('${s}', 'address_corroborated', 'pass', '${DOC.license}')`,
      );
    });
    expect((await summary(U.aOwner, s))[0]!.stage_evidenced).toBe(true);
    await db.exec(
      `insert into public.supplier_verification_checks (supplier_id, check_type, result, evidence_document_id, reviewed_by, reviewed_at, valid_until)
       values ('${s}', 'bank_name_matches_entity', 'pass', '${DOC.license}', '${U.comp}', now() - interval '400 days', now() - interval '35 days')`,
    );
    v = (await summary(U.aOwner, s))[0]!;
    // latest by reviewed_at wins: the old expired pass does not displace the newer unexpired one
    expect(v.passed_checks).toContain("bank_name_matches_entity");
    expect(v.stage_evidenced).toBe(true);
    // now the NEWEST bank check is a pass that has already expired: wait past the previous pass's reviewed_at, then
    // date the new one later than it but with valid_until in the past
    await new Promise((r) => setTimeout(r, 1200));
    await db.exec(
      `insert into public.supplier_verification_checks (supplier_id, check_type, result, evidence_document_id, reviewed_by, reviewed_at, valid_until)
       values ('${s}', 'bank_name_matches_entity', 'pass', '${DOC.license}', '${U.comp}', now() - interval '1 second', now() - interval '500 milliseconds')`,
    );
    v = (await summary(U.aOwner, s))[0]!;
    expect(v.expired_checks).toContain("bank_name_matches_entity");
    expect(v.passed_checks).not.toContain("bank_name_matches_entity");
    expect(v.stage_evidenced).toBe(false);
  });
});

describe("supplier_verification_summary_v (buyer-facing)", () => {
  it("buyers see only visible suppliers and only summarized columns; the supplier sees itself; lead-stage suppliers are absent", async () => {
    const cols = (
      await db.query<{ c: string }>(
        "select column_name as c from information_schema.columns where table_schema = 'public' and table_name = 'supplier_verification_summary_v'",
      )
    ).map((r) => r.c);
    for (const forbidden of [
      "notes",
      "reviewed_by",
      "evidence_document_id",
      "verified_by",
      "wechat_handle",
    ]) {
      expect(cols, forbidden).not.toContain(forbidden);
    }
    await asUser(db, U.aOwner, async () => {
      const ids = (
        await db.query<{ id: string }>(
          "select supplier_id as id from public.supplier_verification_summary_v",
        )
      ).map((r) => r.id);
      expect(ids).toContain(s);
      expect(ids).not.toContain(s2); // still lead_identified
    });
    await asUser(db, U.s2Owner, async () => {
      expect(
        await count("select 1 from public.supplier_verification_summary_v where supplier_id = $1", [
          s2,
        ]),
      ).toBe(1);
    });
    expect((await summary(U.sOwner, s))[0]!.passed_checks).toEqual(
      expect.arrayContaining([
        "business_license_reviewed",
        "uscc_matched",
        "address_corroborated",
        "video_call_held",
      ]),
    );
  });
});

describe("deferred evidence FKs (source_permissions, supplier_facilities)", () => {
  it("evidence must be a scanned document of that supplier or an internal upload; the FK is restrict", async () => {
    await asUser(db, U.op, async () => {
      expect(
        await expectError(
          db,
          `insert into public.source_permissions (supplier_id, rights_class, scope, evidence_document_id) values ($1, 'catalog_public_with_permission', '{"buyer_visibility":"platform_buyers","fields":["product_specs"]}', $2)`,
          [s, DOC.other],
        ),
      ).toMatch(/evidence_document_id must be/);
      expect(
        await expectError(
          db,
          `insert into public.source_permissions (supplier_id, rights_class, scope, evidence_document_id) values ($1, 'catalog_public_with_permission', '{"buyer_visibility":"platform_buyers","fields":["product_specs"]}', $2)`,
          [s, DOC.pending],
        ),
      ).toMatch(/evidence_document_id must be/);
      await db.exec(
        `insert into public.source_permissions (supplier_id, rights_class, scope, evidence_document_id) values ('${s}', 'catalog_public_with_permission', '{"buyer_visibility":"platform_buyers","fields":["product_specs"]}', '${DOC.license}')`,
      );
      await db.exec(
        `insert into public.supplier_facilities (supplier_id, facility_type, address_zh, evidence_document_id) values ('${s}', 'factory', '深圳市某某工业园', '${DOC.internal}')`,
      );
      expect(
        await expectError(
          db,
          "update public.supplier_facilities set evidence_document_id = $2 where supplier_id = $1",
          [s, DOC.other],
        ),
      ).toMatch(/evidence_document_id must be/);
    });
    // restrict: the evidence document cannot be deleted from under its references (superuser attempt)
    expect(
      await expectError(db, "delete from public.documents where id = $1", [DOC.license]),
    ).toMatch(/foreign key|violates/);
  });
});

describe("grant layer", () => {
  it("no DELETE for authenticated; requirements are read-only reference data", async () => {
    await asUser(db, U.admin, async () => {
      expect(await expectError(db, "delete from public.supplier_verification_checks")).toMatch(
        /permission denied/,
      );
      expect(await expectError(db, "delete from public.supplier_documents")).toMatch(
        /permission denied/,
      );
      expect(
        await expectError(
          db,
          "insert into public.supplier_stage_requirements (stage, group_no, check_type) values ('contact_confirmed', 1, 'reference_checked')",
        ),
      ).toMatch(/permission denied/);
      expect(await count("select 1 from public.supplier_stage_requirements")).toBe(6);
    });
  });
});
