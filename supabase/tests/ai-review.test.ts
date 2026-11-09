/**
 * B-18 — ai_review (0010): the human gate of the first vertical slice.
 * operator intake into a buyer project → document parsed → AI extraction (worker) → review task → corrections →
 * a PERSON accepts → confirmed quotation citing its document and extraction; document → accepted.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { applyMigrations, asUser, expectError, openDb, readSeed, type Db } from "./db.js";

const INTERNAL_ORG = "00000000-0000-4000-8000-000000000001";
const U = {
  aOwner: "f1f10000-0000-4000-8000-000000000001",
  aMember: "f1f10000-0000-4000-8000-000000000002",
  aViewer: "f1f10000-0000-4000-8000-000000000003",
  bOwner: "f2f20000-0000-4000-8000-000000000001",
  sOwner: "f3f30000-0000-4000-8000-000000000001",
  opA: "f9f90000-0000-4000-8000-000000000001",
  opOther: "f9f90000-0000-4000-8000-000000000002",
  comp: "f9f90000-0000-4000-8000-000000000003",
  admin: "f9f90000-0000-4000-8000-000000000004",
};
const ORG = {
  a: "f1f1f1f1-0000-4000-8000-000000000001",
  b: "f2f2f2f2-0000-4000-8000-000000000001",
  s: "f3f3f3f3-0000-4000-8000-000000000001",
};
const PROJ = "f4f40000-0000-4000-8000-000000000001";
const DOC = {
  op: "f5f50000-0000-4000-8000-000000000001", // operator intake, owned by buyer A, on A's project
  sup: "f5f50000-0000-4000-8000-000000000002", // supplier-owned submission
};
const SHA = (c: string) => c.repeat(64);

let db: Db;
let sId = "";
let itemId = "";
let runId = "";
let templateId = "";
let extractionId = "";
let taskId = "";
let quoteId = "";
let task2 = "";

const count = async (sql: string, params: unknown[] = []) =>
  Number(
    (await db.query<{ n: string }>(`select count(*)::text as n from (${sql}) q`, params))[0]!.n,
  );
const worker = <T>(fn: () => Promise<T>) => asUser(db, null, fn, "service_role");
const docStatus = async (id: string) =>
  (
    await db.query<{ s: string }>("select status::text as s from public.documents where id = $1", [
      id,
    ])
  )[0]!.s;
const reviewedPayload = (over: Record<string, unknown> = {}) =>
  JSON.stringify({
    quote_type: "negotiated_private",
    rights_class: "customer_private_quote",
    source_type: "operator_import",
    price_basis: "FOB",
    incoterm_place: "Shenzhen",
    basis_confirmed: true,
    currency: "USD",
    quantity_unit: "pcs",
    moq: 5000,
    quote_date: "2026-11-05",
    valid_until: "2026-12-31",
    tiers: [
      { min_qty: 5000, max_qty: 20000, unit_price: 0.041 },
      { min_qty: 20000, unit_price: 0.037 },
    ],
    fees: [{ fee_type: "export_doc", amount: 35 }],
    ...over,
  });

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
  // shared-database hygiene (immutable tables: lift their triggers for this cleanup only)
  await db.exec(`
    alter table public.human_corrections disable trigger human_corrections_immutable;
    alter table public.ai_extractions disable trigger ai_extractions_immutable;
    alter table public.quotations disable trigger quotations_immutable;
    alter table public.quote_tiers disable trigger quote_tiers_immutable;
    alter table public.quote_fees disable trigger quote_fees_immutable;
    delete from public.human_corrections where review_task_id in (select id from public.review_tasks where org_id in (${orgList}));
    delete from public.review_tasks where org_id in (${orgList});
    delete from public.quote_status_events where quotation_id in (select id from public.quotations where buyer_org_id in (${orgList}));
    delete from public.quotation_states where quotation_id in (select id from public.quotations where buyer_org_id in (${orgList}));
    delete from public.quote_tiers where quotation_id in (select id from public.quotations where buyer_org_id in (${orgList}));
    delete from public.quote_fees where quotation_id in (select id from public.quotations where buyer_org_id in (${orgList}));
    delete from public.quotations where buyer_org_id in (${orgList});
    delete from public.quote_groups where buyer_org_id in (${orgList});
    delete from public.ai_extractions where org_id in (${orgList});
    alter table public.human_corrections enable trigger human_corrections_immutable;
    alter table public.ai_extractions enable trigger ai_extractions_immutable;
    alter table public.quotations enable trigger quotations_immutable;
    alter table public.quote_tiers enable trigger quote_tiers_immutable;
    alter table public.quote_fees enable trigger quote_fees_immutable;
    delete from public.ai_runs where org_id in (${orgList});
    delete from public.prompt_templates where template_id = 'test_quotation_extractor';
    delete from public.document_access_log where document_id in (select id from public.documents where org_id in (${orgList}));
    delete from public.organizations where id in (${orgList});
    delete from auth.users where id in (${userList});
  `);
  await db.exec(
    `begin; set local storage.allow_delete_query = 'true'; delete from storage.objects where name like 'f1f1f1f1-%' or name like 'f3f3f3f3-%'; commit;`,
  );
  await db.exec(
    `insert into auth.users (id, email) values ${Object.entries(U)
      .map(([k, id]) => `('${id}', 'rev-${k.toLowerCase()}@example.test')`)
      .join(",")}`,
  );
  await db.exec(`
    insert into public.organizations (id, org_type, legal_name, display_name) values
      ('${ORG.a}', 'buyer', 'Review Buyer A', 'A'), ('${ORG.b}', 'buyer', 'Review Buyer B', 'B'), ('${ORG.s}', 'supplier', '审核供应商', 'S');
    insert into public.memberships (org_id, user_id, role) values
      ('${ORG.a}', '${U.aOwner}', 'owner'), ('${ORG.a}', '${U.aMember}', 'member'), ('${ORG.a}', '${U.aViewer}', 'viewer'),
      ('${ORG.b}', '${U.bOwner}', 'owner'), ('${ORG.s}', '${U.sOwner}', 'owner'),
      ('${INTERNAL_ORG}', '${U.opA}', 'operator'), ('${INTERNAL_ORG}', '${U.opOther}', 'operator'),
      ('${INTERNAL_ORG}', '${U.comp}', 'compliance_reviewer'), ('${INTERNAL_ORG}', '${U.admin}', 'platform_admin');
    insert into public.supplier_profiles (org_id, legal_name_zh) values ('${ORG.s}', '审核供应商有限公司');
    insert into public.sourcing_projects (id, org_id, name, created_by) values ('${PROJ}', '${ORG.a}', 'Review project', '${U.aOwner}');
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
});

afterAll(async () => {
  await db.close();
});

describe("operator intake into a buyer project (0006 policies replaced)", () => {
  it("an assigned operator registers the supplier's quote as a buyer-owned project document and uploads it to quarantine; others cannot", async () => {
    await asUser(db, U.opOther, async () => {
      expect(
        await expectError(
          db,
          `insert into public.documents (id, org_id, project_id, source_type, rights_class, storage_path, original_filename, mime, bytes)
           values ($1, $2, $3, 'operator_import', 'customer_private_quote', $4, 'quote.pdf', 'application/pdf', 2048)`,
          [DOC.op, ORG.a, PROJ, `${ORG.a}/${DOC.op}/quote.pdf`],
        ),
      ).toMatch(/row-level security/);
    });
    await asUser(db, U.opA, async () => {
      // only as an operator import, never pretending to be a buyer upload
      expect(
        await expectError(
          db,
          `insert into public.documents (id, org_id, project_id, source_type, rights_class, storage_path, original_filename, mime, bytes)
           values ($1, $2, $3, 'buyer_upload', 'buyer_uploaded_private', $4, 'quote.pdf', 'application/pdf', 2048)`,
          [DOC.op, ORG.a, PROJ, `${ORG.a}/${DOC.op}/quote.pdf`],
        ),
      ).toMatch(/row-level security/);
      await db.exec(
        `insert into public.documents (id, org_id, project_id, source_type, rights_class, storage_path, original_filename, mime, bytes)
         values ('${DOC.op}', '${ORG.a}', '${PROJ}', 'operator_import', 'customer_private_quote', '${ORG.a}/${DOC.op}/quote.pdf', '报价单.pdf', 'application/pdf', 2048)`,
      );
      await db.exec(
        `insert into storage.objects (bucket_id, name) values ('quarantine', '${ORG.a}/${DOC.op}/quote.pdf')`,
      );
    });
    await asUser(db, U.opOther, async () => {
      expect(
        await expectError(
          db,
          "insert into storage.objects (bucket_id, name) values ('quarantine', $1)",
          [`${ORG.a}/${DOC.op}/other.pdf`],
        ),
      ).toMatch(/row-level security/);
    });
    for (const [u, n] of [
      [U.aViewer, 1],
      [U.opA, 1],
      [U.opOther, 0],
      [U.bOwner, 0],
      [U.sOwner, 0],
    ] as const) {
      await asUser(db, u, async () => {
        expect(await count("select 1 from public.documents where id = $1", [DOC.op]), u).toBe(n);
      });
    }
    // the worker scans and parses it
    await worker(async () => {
      await db.exec(`update public.documents set status = 'scanning' where id = '${DOC.op}'`);
      await db.exec(
        `update public.documents set status = 'parsed', sha256 = '${SHA("1")}', storage_bucket = 'documents' where id = '${DOC.op}'`,
      );
    });
  });
});

describe("worker: prompt template, ai run, extraction, review task", () => {
  it("only the worker writes templates/extractions/tasks; extraction requires a parsed document and an extract run; extractions are immutable", async () => {
    await worker(async () => {
      templateId = (
        await db.query<{ id: string }>(
          "insert into public.prompt_templates (template_id, version, purpose) values ('test_quotation_extractor', $1, 'extract') returning id",
          [SHA("a")],
        )
      )[0]!.id;
      expect(
        await expectError(
          db,
          "insert into public.prompt_templates (template_id, version, purpose) values ('test_quotation_extractor', $1, 'extract')",
          [SHA("b")],
        ),
      ).toMatch(/one_active|unique/);
      expect(
        await expectError(
          db,
          "update public.prompt_templates set purpose = 'draft' where id = $1",
          [templateId],
        ),
      ).toMatch(/immutable except active/);
      runId = (
        await db.query<{ id: string }>(
          "insert into public.ai_runs (org_id, purpose, provider, model, prompt_template_id, prompt_version, status, input_tokens, output_tokens) values ($1, 'extract', 'mock', 'mock-1', 'test_quotation_extractor', $2, 'ok', 1200, 400) returning id",
          [ORG.a, SHA("a")],
        )
      )[0]!.id;
      const draftRun = (
        await db.query<{ id: string }>(
          "insert into public.ai_runs (org_id, purpose, provider, model, prompt_template_id, prompt_version, status) values ($1, 'draft', 'mock', 'mock-1', 'x', $2, 'ok') returning id",
          [ORG.a, SHA("c")],
        )
      )[0]!.id;
      expect(
        await expectError(
          db,
          "insert into public.ai_extractions (document_id, ai_run_id, schema_name, schema_version, validated_output) values ($1, $2, 'quote_extraction', 'v1', '{}')",
          [DOC.op, draftRun],
        ),
      ).toMatch(/extract run/);
      expect(
        await expectError(
          db,
          "insert into public.ai_extractions (document_id, ai_run_id, schema_name, schema_version) values ($1, $2, 'quote_extraction', 'v1')",
          [DOC.op, runId],
        ),
      ).toMatch(/check/); // no output and no errors
      const ex = await db.query<{ id: string; org: string }>(
        `insert into public.ai_extractions (document_id, ai_run_id, prompt_template_id, schema_name, schema_version, raw_output, validated_output, field_confidence, anchors, flags)
         values ($1, $2, $3, 'quote_extraction', 'v1', $4::jsonb, $4::jsonb, '{"currency":"high","priceBasis":"low"}', '{"tiers[0].unitPrice":{"page":1,"quote":"0.041"}}', '{basis_term_colloquial}')
         returning id, org_id as org`,
        [
          DOC.op,
          runId,
          templateId,
          JSON.stringify({
            schema: "quote_extraction_v1",
            currency: { value: "USD" },
            priceBasis: { value: null },
            approved: true,
          }),
        ],
      );
      extractionId = ex[0]!.id;
      expect(ex[0]!.org).toBe(ORG.a);
      expect(
        await expectError(db, "update public.ai_extractions set flags = '{}' where id = $1", [
          extractionId,
        ]),
      ).toMatch(/immutable/);
      await db.exec(`update public.documents set status = 'extracted' where id = '${DOC.op}'`);
      expect(
        await expectError(
          db,
          "insert into public.review_tasks (kind, subject_id, status) values ('extraction', $1, 'accepted')",
          [extractionId],
        ),
      ).toMatch(/starts as pending|check/);
      const t = await db.query<{ id: string; org: string; proj: string; doc: string }>(
        "insert into public.review_tasks (kind, subject_id, brief_item_id, supplier_id, due_at) values ('extraction', $1, $2, $3, now() + interval '1 day') returning id, org_id as org, project_id as proj, document_id as doc",
        [extractionId, itemId, sId],
      );
      taskId = t[0]!.id;
      expect(t[0]).toMatchObject({ org: ORG.a, proj: PROJ, doc: DOC.op });
      expect(
        await expectError(
          db,
          "insert into public.review_tasks (kind, subject_id) values ('extraction', $1)",
          [extractionId],
        ),
      ).toMatch(/unique|duplicate/);
      expect(
        await expectError(
          db,
          "insert into public.review_tasks (kind, subject_id) values ('extraction', gen_random_uuid())",
        ),
      ).toMatch(/not an ai_extractions row/);
      // a second, invalid extraction of the same document (e.g. a re-run) gets its own task
      const ex2 = (
        await db.query<{ id: string }>(
          "insert into public.ai_extractions (document_id, ai_run_id, schema_name, schema_version, validation_errors, raw_output) values ($1, $2, 'quote_extraction', 'v1', '[\"tiers: overlapping\"]', '{\"garbage\":true}') returning id",
          [DOC.op, runId],
        )
      )[0]!.id;
      task2 = (
        await db.query<{ id: string }>(
          "insert into public.review_tasks (kind, subject_id) values ('extraction', $1) returning id",
          [ex2],
        )
      )[0]!.id;
      await db.exec(`update public.documents set status = 'in_review' where id = '${DOC.op}'`);
    });
    for (const u of [U.aOwner, U.opA, U.admin]) {
      await asUser(db, u, async () => {
        expect(
          await expectError(
            db,
            "insert into public.ai_extractions (document_id, ai_run_id, schema_name, schema_version, validated_output) values ($1, $2, 'x', 'v1', '{}')",
            [DOC.op, runId],
          ),
          u,
        ).toMatch(/permission denied/);
        expect(
          await expectError(
            db,
            "insert into public.review_tasks (kind, subject_id) values ('extraction', $1)",
            [extractionId],
          ),
          u,
        ).toMatch(/permission denied/);
        expect(
          await expectError(
            db,
            "update public.review_tasks set status = 'accepted' where id = $1",
            [taskId],
          ),
          u,
        ).toMatch(/permission denied/);
      });
    }
  });

  it("a supplier-owned document cannot enter this review path; a review task cannot point a brief item at another project", async () => {
    await asUser(db, U.sOwner, async () => {
      await db.exec(
        `insert into public.documents (id, org_id, supplier_id, source_type, rights_class, storage_path, original_filename, mime, bytes)
         values ('${DOC.sup}', '${ORG.s}', '${sId}', 'supplier_portal', 'supplier_submitted_private', '${ORG.s}/${DOC.sup}/q.pdf', 'q.pdf', 'application/pdf', 100)`,
      );
    });
    await worker(async () => {
      await db.exec(`update public.documents set status = 'scanning' where id = '${DOC.sup}'`);
      await db.exec(
        `update public.documents set status = 'parsed', sha256 = '${SHA("2")}', storage_bucket = 'supplier-evidence' where id = '${DOC.sup}'`,
      );
      const ex = (
        await db.query<{ id: string }>(
          "insert into public.ai_extractions (document_id, ai_run_id, schema_name, schema_version, validated_output) values ($1, $2, 'quote_extraction', 'v1', '{}') returning id",
          [DOC.sup, runId],
        )
      )[0]!.id;
      expect(
        await expectError(
          db,
          "insert into public.review_tasks (kind, subject_id) values ('extraction', $1)",
          [ex],
        ),
      ).toMatch(/Phase 2/);
    });
  });
});

describe("visibility", () => {
  it("buyer A (incl. viewer), the assigned operator and platform admin see the task and extraction; B, other operators, compliance and the supplier do not", async () => {
    for (const [u, n] of [
      [U.aOwner, 1],
      [U.aViewer, 1],
      [U.opA, 1],
      [U.admin, 1],
      [U.bOwner, 0],
      [U.opOther, 0],
      [U.comp, 0],
      [U.sOwner, 0],
    ] as const) {
      await asUser(db, u, async () => {
        expect(await count("select 1 from public.review_tasks where id = $1", [taskId]), u).toBe(n);
        expect(
          await count("select 1 from public.ai_extractions where id = $1", [extractionId]),
          u,
        ).toBe(n);
      });
    }
    await asUser(db, U.aOwner, async () => {
      expect(await count("select 1 from public.prompt_templates")).toBe(0); // internal only
    });
  });
});

describe("the human gate", () => {
  it("viewers and outsiders cannot start, correct, accept or reject; a member starts the review and records corrections", async () => {
    for (const u of [U.aViewer]) {
      await asUser(db, u, async () => {
        expect(await expectError(db, "select app.start_review($1)", [taskId]), u).toMatch(
          /not permitted/,
        );
        expect(
          await expectError(
            db,
            "insert into public.human_corrections (review_task_id, field_path, before, after, reason) values ($1, 'priceBasis', 'null', '\"FOB\"', 'stated FOB on p.1')",
            [taskId],
          ),
          u,
        ).toMatch(/row-level security/);
      });
    }
    for (const u of [U.bOwner, U.opOther, U.sOwner, U.comp]) {
      await asUser(db, u, async () => {
        expect(await expectError(db, "select app.start_review($1)", [taskId]), u).toMatch(
          /not found/,
        );
        expect(
          await expectError(
            db,
            "select app.accept_extraction($1, $2::jsonb, null, 'x', 'rev-key-outsider1')",
            [taskId, reviewedPayload()],
          ),
          u,
        ).toMatch(/not found/);
      });
    }
    await asUser(db, U.aMember, async () => {
      await db.exec(`select app.start_review('${taskId}')`);
      await db.exec(
        `insert into public.human_corrections (review_task_id, field_path, before, after, reason) values ('${taskId}', 'priceBasis', 'null', '"FOB"', 'supplier wrote 离岸价 and FOB Shenzhen on p.1')`,
      );
      expect(
        await expectError(
          db,
          "insert into public.human_corrections (review_task_id, field_path, before, after, reason) values ($1, 'currency', '\"USD\"', '\"USD\"', 'no-op change')",
          [taskId],
        ),
      ).toMatch(/check/);
      expect(
        await expectError(
          db,
          "update public.human_corrections set reason = 'rewritten' where review_task_id = $1",
          [taskId],
        ),
      ).toMatch(/permission denied/);
    });
    const t = await db.query<{ s: string; a: string }>(
      "select status::text as s, assigned_to as a from public.review_tasks where id = $1",
      [taskId],
    );
    expect(t[0]).toEqual({ s: "in_review", a: U.aMember });
    const c = await db.query<{ by: string }>(
      "select corrected_by as by from public.human_corrections where review_task_id = $1",
      [taskId],
    );
    expect(c).toEqual([{ by: U.aMember }]);
    await asUser(db, U.opA, async () => {
      expect(
        await count("select 1 from public.human_corrections where review_task_id = $1", [taskId]),
      ).toBe(1);
    });
  });

  it("a job cannot accept; a signed-in member accepts → confirmed quotation citing document + extraction; replay is a no-op; document → accepted", async () => {
    await worker(async () => {
      expect(
        await expectError(
          db,
          "select app.accept_extraction($1, $2::jsonb, null, 'auto', 'rev-key-worker01')",
          [taskId, reviewedPayload()],
        ),
      ).toMatch(/signed-in person/);
    });
    await asUser(db, U.aMember, async () => {
      expect(
        await expectError(db, "select app.accept_extraction($1, $2::jsonb, null, 'x', 'short')", [
          taskId,
          reviewedPayload(),
        ]),
      ).toMatch(/idempotency_key/);
      expect(
        await expectError(
          db,
          "select app.accept_extraction($1, $2::jsonb, null, 'x', 'rev-key-wrongsup')",
          [taskId, reviewedPayload({ supplier_id: "00000000-0000-4000-8000-0000000000aa" })],
        ),
      ).toMatch(/differs from the review task/);
      // a payload that tries to cite another document or extraction is overridden by the task's provenance
      quoteId = (
        await db.query<{ id: string }>(
          "select app.accept_extraction($1, $2::jsonb, null, 'matches PDF p.1 after FOB correction', 'rev-key-accept01') as id",
          [taskId, reviewedPayload({ document_id: DOC.sup, extraction_id: null })],
        )
      )[0]!.id;
    });
    const q = await db.query<{
      doc: string;
      ex: string;
      buyer: string;
      item: string;
      sup: string;
      by: string;
    }>(
      "select document_id as doc, extraction_id as ex, buyer_org_id as buyer, brief_item_id as item, supplier_id as sup, confirmed_by as by from public.quotations where id = $1",
      [quoteId],
    );
    expect(q[0]).toEqual({
      doc: DOC.op,
      ex: extractionId,
      buyer: ORG.a,
      item: itemId,
      sup: sId,
      by: U.aMember,
    });
    expect(
      await count(
        "select 1 from public.quote_fees where quotation_id = $1 and fee_type = 'export_doc'",
        [quoteId],
      ),
    ).toBe(1);
    const t = await db.query<{ s: string; q: string; by: string }>(
      "select status::text as s, result_quotation_id as q, resolved_by as by from public.review_tasks where id = $1",
      [taskId],
    );
    expect(t[0]).toEqual({ s: "accepted", q: quoteId, by: U.aMember });
    expect(await docStatus(DOC.op)).toBe("in_review"); // the second extraction's task is still open
    // replay: same key → same quotation, nothing new
    const again = await asUser(
      db,
      U.aMember,
      async () =>
        (
          await db.query<{ id: string }>(
            "select app.accept_extraction($1, $2::jsonb, null, 'retry', 'rev-key-accept01') as id",
            [taskId, reviewedPayload()],
          )
        )[0]!.id,
    );
    expect(again).toBe(quoteId);
    expect(
      await count("select 1 from public.quotations where extraction_id = $1", [extractionId]),
    ).toBe(1);
    // resolved: no reopening, no further corrections, no second accept with a new key
    await asUser(db, U.aOwner, async () => {
      expect(await expectError(db, "select app.start_review($1)", [taskId])).toMatch(
        /already accepted/,
      );
      expect(
        await expectError(db, "select app.reject_review($1, 'changed my mind')", [taskId]),
      ).toMatch(/already accepted/);
      expect(
        await expectError(
          db,
          "select app.accept_extraction($1, $2::jsonb, null, 'again', 'rev-key-accept02')",
          [taskId, reviewedPayload()],
        ),
      ).toMatch(/already accepted/);
      expect(
        await expectError(
          db,
          "insert into public.human_corrections (review_task_id, field_path, before, after, reason) values ($1, 'moq', '5000', '6000', 'late fix')",
          [taskId],
        ),
      ).toMatch(/while a review is open/);
    });
    // the confirmed quotation is visible exactly as 0009 says: buyer A + assigned operator + supplier, not B
    for (const [u, n] of [
      [U.aViewer, 1],
      [U.opA, 1],
      [U.sOwner, 1],
      [U.bOwner, 0],
      [U.opOther, 0],
    ] as const) {
      await asUser(db, u, async () => {
        expect(await count("select 1 from public.quotations where id = $1", [quoteId]), u).toBe(n);
      });
    }
  });

  it("an assigned operator rejects the second extraction with a reason → the document completes; the extraction FK on quotations is enforced", async () => {
    await asUser(db, U.opA, async () => {
      expect(await expectError(db, "select app.reject_review($1, '')", [task2])).toMatch(/reason/);
      await db.exec(
        `select app.reject_review('${task2}', 'duplicate of the accepted extraction; output invalid')`,
      );
    });
    const r = await db.query<{ s: string; by: string }>(
      "select status::text as s, resolved_by as by from public.review_tasks where id = $1",
      [task2],
    );
    expect(r[0]).toEqual({ s: "rejected", by: U.opA });
    expect(await docStatus(DOC.op)).toBe("accepted");
    await asUser(db, U.aOwner, async () => {
      expect(
        await expectError(
          db,
          "select app.supersede_quotation(null, $1::jsonb, 'fk check', 'rev-key-fk-00001')",
          [
            reviewedPayload({
              supplier_id: sId,
              buyer_org_id: ORG.a,
              extraction_id: "00000000-0000-4000-8000-0000000000ee",
              quote_type: "final_offer",
            }),
          ],
        ),
      ).toMatch(/foreign key/);
    });
  });
});

describe("grant layer", () => {
  it("authenticated cannot DELETE or UPDATE review data directly", async () => {
    await asUser(db, U.admin, async () => {
      for (const t of ["prompt_templates", "ai_extractions", "review_tasks", "human_corrections"]) {
        expect(await expectError(db, `delete from public.${t}`), t).toMatch(/permission denied/);
        expect(await expectError(db, `update public.${t} set id = id`), t).toMatch(
          /permission denied/,
        );
      }
      expect(
        await expectError(
          db,
          "select app.review_document_transition($1, 'in_review', 'accepted')",
          [DOC.op],
        ),
      ).toMatch(/permission denied/);
    });
  });
});
