/**
 * B-10 — documents_storage (0006): document records, the ADR-033 status machine, worker-only parse output,
 * the access log writer, and the storage.objects policies (buckets as rows; path convention; A cannot reach B's path).
 * PGlite shims storage.buckets/objects/foldername (tests/db.ts); the real storage schema is exercised by CI.
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
  aOwner: "e1000000-0000-4000-8000-000000000001",
  aMember: "e1000000-0000-4000-8000-000000000002",
  aViewer: "e1000000-0000-4000-8000-000000000003",
  bOwner: "e2000000-0000-4000-8000-000000000001",
  sOwner: "e3000000-0000-4000-8000-000000000001",
  op: "e5000000-0000-4000-8000-000000000001",
  admin: "e5000000-0000-4000-8000-000000000003",
};
const ORG = {
  a: "eeeeee01-0000-4000-8000-000000000001",
  b: "eeeeee02-0000-4000-8000-000000000001",
  s: "eeeeee03-0000-4000-8000-000000000001",
};
const DOC = {
  a1: "f0000000-0000-4000-8000-00000000000a",
  b1: "f0000000-0000-4000-8000-00000000000b",
  s1: "f0000000-0000-4000-8000-00000000000c",
};
const SHA = "a".repeat(64);
const path = (org: string, doc: string, file = "ab12cd34-quote.pdf") => `${org}/${doc}/${file}`;

let db: Db;
let supplierId: string;

const count = async (sql: string, params: unknown[] = []) =>
  Number(
    (await db.query<{ n: string }>(`select count(*)::text as n from (${sql}) q`, params))[0]!.n,
  );
const status = async (id: string) =>
  (
    await db.query<{ s: string }>("select status::text as s from public.documents where id = $1", [
      id,
    ])
  )[0]!.s;

beforeAll(async () => {
  db = await openDb();
  if (db.engine === "pglite") {
    await applyMigrations(db);
    await db.exec(readSeed());
  }
  // Shared database on real Postgres: remove this suite's own fixtures from a previous run, children first
  // (document_access_log → documents is ON DELETE RESTRICT by design).
  await db.exec(`delete from storage.objects where name like 'eeeeee0%'`);
  await db.exec(
    `delete from public.document_access_log where document_id in (select id from public.documents where org_id in (${Object.values(
      ORG,
    )
      .map((o) => `'${o}'`)
      .join(",")}))`,
  );
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
      .map(([k, id]) => `('${id}', 'doc-${k.toLowerCase()}@example.test')`)
      .join(",")}`,
  );
  await db.exec(`
    insert into public.organizations (id, org_type, legal_name, display_name) values
      ('${ORG.a}', 'buyer', 'Doc Buyer A', 'A'), ('${ORG.b}', 'buyer', 'Doc Buyer B', 'B'),
      ('${ORG.s}', 'supplier', '文档供应商', 'S');
    insert into public.memberships (org_id, user_id, role) values
      ('${ORG.a}', '${U.aOwner}', 'owner'), ('${ORG.a}', '${U.aMember}', 'member'), ('${ORG.a}', '${U.aViewer}', 'viewer'),
      ('${ORG.b}', '${U.bOwner}', 'owner'),
      ('${ORG.s}', '${U.sOwner}', 'owner'),
      ('${INTERNAL_ORG}', '${U.op}', 'operator'), ('${INTERNAL_ORG}', '${U.admin}', 'platform_admin');
    insert into public.supplier_profiles (org_id, legal_name_zh, stage) values ('${ORG.s}', '文档供应商有限公司', 'contact_confirmed');
  `);
  supplierId = (
    await db.query<{ id: string }>("select id from public.supplier_profiles where org_id = $1", [
      ORG.s,
    ])
  )[0]!.id;
});

afterAll(async () => {
  await db.close();
});

describe("buckets (reference rows)", () => {
  it("ships four private buckets with the 25 MB cap and MIME allow-lists; re-running the block is a no-op", async () => {
    const rows = await db.query<{
      id: string;
      public: boolean;
      file_size_limit: string;
      n: number;
    }>(
      "select id, public, file_size_limit::text, array_length(allowed_mime_types, 1) as n from storage.buckets where id in ('quarantine','documents','reports','supplier-evidence') order by id",
    );
    expect(rows.map((r) => r.id)).toEqual([
      "documents",
      "quarantine",
      "reports",
      "supplier-evidence",
    ]);
    for (const r of rows) {
      expect(r.public).toBe(false);
      expect(r.file_size_limit).toBe("26214400");
      expect(r.n).toBeGreaterThanOrEqual(2);
    }
    const sql = listMigrations().find((m) => m.name === "documents_storage")!.sql;
    const block = sql.slice(
      sql.indexOf("-- BEGIN REFERENCE DATA"),
      sql.indexOf("-- END REFERENCE DATA"),
    );
    const before = JSON.stringify(await db.query("select * from storage.buckets order by id"));
    await db.exec(block);
    expect(JSON.stringify(await db.query("select * from storage.buckets order by id"))).toBe(
      before,
    );
  });
});

describe("documents: registration, isolation, member limits", () => {
  it("a member registers an upload (quarantine, uploaded); a viewer cannot; the path convention is enforced", async () => {
    await asUser(db, U.aMember, async () => {
      await db.exec(
        `insert into public.documents (id, org_id, source_type, rights_class, storage_path, original_filename, mime, bytes)
         values ('${DOC.a1}', '${ORG.a}', 'buyer_upload', 'buyer_uploaded_private', '${path(ORG.a, DOC.a1)}', 'quote.pdf', 'application/pdf', 1024)`,
      );
      expect(
        await expectError(
          db,
          `insert into public.documents (org_id, source_type, rights_class, storage_path, original_filename, mime, bytes)
           values ('${ORG.a}', 'buyer_upload', 'buyer_uploaded_private', '${ORG.a}/wrong/quote.pdf', 'quote.pdf', 'application/pdf', 1024)`,
        ),
      ).toMatch(/storage_path must be/);
      expect(
        await expectError(
          db,
          `insert into public.documents (id, org_id, source_type, rights_class, storage_path, original_filename, mime, bytes)
           values ('${DOC.b1}', '${ORG.b}', 'buyer_upload', 'buyer_uploaded_private', '${path(ORG.b, DOC.b1)}', 'q.pdf', 'application/pdf', 1024)`,
        ),
      ).toMatch(/row-level security/);
      // a member cannot pre-promote or self-declare a scan result
      expect(
        await expectError(
          db,
          `insert into public.documents (org_id, source_type, rights_class, storage_bucket, storage_path, original_filename, mime, bytes, status, sha256)
           values ('${ORG.a}', 'buyer_upload', 'buyer_uploaded_private', 'documents', '${ORG.a}/00000000-0000-4000-8000-000000000099/x.pdf', 'x.pdf', 'application/pdf', 10, 'parsed', '${SHA}')`,
        ),
      ).toMatch(/start as uploaded in quarantine|storage_path must be/);
    });
    await asUser(db, U.aViewer, async () => {
      expect(
        await expectError(
          db,
          `insert into public.documents (id, org_id, source_type, rights_class, storage_path, original_filename, mime, bytes)
           values ('00000000-0000-4000-8000-000000000098', '${ORG.a}', 'buyer_upload', 'buyer_uploaded_private', '${ORG.a}/00000000-0000-4000-8000-000000000098/x.pdf', 'x.pdf', 'application/pdf', 10)`,
        ),
      ).toMatch(/row-level security/);
    });
    await asUser(db, U.bOwner, async () => {
      await db.exec(
        `insert into public.documents (id, org_id, source_type, rights_class, storage_path, original_filename, mime, bytes)
         values ('${DOC.b1}', '${ORG.b}', 'buyer_upload', 'buyer_uploaded_private', '${path(ORG.b, DOC.b1)}', 'b.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 2048)`,
      );
    });
  });

  it("rejects disallowed MIME types and oversize files", async () => {
    await asUser(db, U.aOwner, async () => {
      for (const [mime, bytes] of [
        ["image/svg+xml", 10],
        ["text/html", 10],
        ["application/zip", 10],
        ["application/pdf", 26214401],
      ] as const) {
        expect(
          await expectError(
            db,
            `insert into public.documents (id, org_id, source_type, rights_class, storage_path, original_filename, mime, bytes)
             values ('00000000-0000-4000-8000-000000000097', '${ORG.a}', 'buyer_upload', 'buyer_uploaded_private', '${ORG.a}/00000000-0000-4000-8000-000000000097/x', 'x', $1, $2)`,
            [mime, bytes],
          ),
          `${mime}/${bytes}`,
        ).toMatch(/check/);
      }
    });
  });

  it("A reads only A's documents; B reads only B's; an unassigned operator reads neither; platform_admin reads both", async () => {
    await asUser(db, U.aViewer, async () => {
      expect(
        (await db.query<{ id: string }>("select id from public.documents")).map((r) => r.id),
      ).toEqual([DOC.a1]);
    });
    await asUser(db, U.bOwner, async () => {
      expect(
        (await db.query<{ id: string }>("select id from public.documents")).map((r) => r.id),
      ).toEqual([DOC.b1]);
    });
    await asUser(db, U.op, async () => {
      expect(await count("select 1 from public.documents")).toBe(0);
    });
    await asUser(db, U.admin, async () => {
      expect(
        await count("select 1 from public.documents where id in ($1, $2)", [DOC.a1, DOC.b1]),
      ).toBe(2);
    });
  });

  it("members cannot edit a document or advance its status; they can discard a non-terminal one", async () => {
    await asUser(db, U.aOwner, async () => {
      expect(
        await expectError(
          db,
          "update public.documents set original_filename = 'renamed.pdf' where id = $1",
          [DOC.a1],
        ),
      ).toMatch(/members may only discard/);
      expect(
        await expectError(db, "update public.documents set status = 'scanning' where id = $1", [
          DOC.a1,
        ]),
      ).toMatch(/invalid document transition/);
      expect(
        await expectError(
          db,
          "update public.documents set status = 'parsed', storage_bucket = 'documents', sha256 = $2 where id = $1",
          [DOC.a1, SHA],
        ),
      ).toMatch(/members may only discard|invalid document transition/);
      expect(
        await expectError(db, "update public.documents set org_id = $2 where id = $1", [
          DOC.a1,
          ORG.b,
        ]),
      ).toMatch(/immutable|members may only discard/);
      // B's row is invisible to A: 0 rows, no error
      await db.exec(`update public.documents set status = 'discarded' where id = '${DOC.b1}'`);
    });
    expect(await status(DOC.b1)).toBe("uploaded");
    await asUser(db, U.bOwner, async () => {
      await db.exec(`update public.documents set status = 'discarded' where id = '${DOC.b1}'`);
      expect(await count("select 1 from public.documents where id = $1", [DOC.b1])).toBe(0); // discarded rows leave the read set
      expect(
        await expectError(db, "update public.documents set status = 'uploaded' where id = $1", [
          DOC.b1,
        ]),
      ).toBeNull(); // 0 rows: no longer readable
    });
    expect(await status(DOC.b1)).toBe("discarded");
  });
});

describe("worker (service_role) status machine — ADR-033", () => {
  it("follows uploaded → scanning → parsed with promotion out of quarantine; illegal jumps are rejected", async () => {
    await asUser(
      db,
      null,
      async () => {
        expect(
          await expectError(db, "update public.documents set status = 'parsed' where id = $1", [
            DOC.a1,
          ]),
        ).toMatch(/invalid document transition uploaded -> parsed/);
        expect(
          await expectError(db, "update public.documents set status = 'extracted' where id = $1", [
            DOC.a1,
          ]),
        ).toMatch(/invalid document transition/);
        // bucket cannot change before the scan passed
        expect(
          await expectError(
            db,
            "update public.documents set storage_bucket = 'documents' where id = $1",
            [DOC.a1],
          ),
        ).toMatch(/storage_bucket changes only|check/);
        await db.exec(`update public.documents set status = 'scanning' where id = '${DOC.a1}'`);
        // parsed requires a hash and leaving quarantine
        expect(
          await expectError(db, "update public.documents set status = 'parsed' where id = $1", [
            DOC.a1,
          ]),
        ).toMatch(/sha256|check/);
        expect(
          await expectError(
            db,
            "update public.documents set status = 'parsed', sha256 = $2 where id = $1",
            [DOC.a1, SHA],
          ),
        ).toMatch(/check/); // still in quarantine
        await db.exec(
          `update public.documents set status = 'parsed', sha256 = '${SHA}', storage_bucket = 'documents', page_count = 3, scan_result = '{"engine":"test","verdict":"clean"}' where id = '${DOC.a1}'`,
        );
        // the path must still be <org>/<id>/...
        expect(
          await expectError(db, "update public.documents set storage_path = $2 where id = $1", [
            DOC.a1,
            `${ORG.b}/${DOC.a1}/moved.pdf`,
          ]),
        ).toMatch(/storage_path must be/);
        // a parsed document cannot go back to quarantine
        expect(
          await expectError(
            db,
            "update public.documents set storage_bucket = 'quarantine' where id = $1",
            [DOC.a1],
          ),
        ).toMatch(/storage_bucket changes only|check/);
      },
      "service_role",
    );
    expect(await status(DOC.a1)).toBe("parsed");
  });

  it("rejected requires a reason and stays in quarantine; terminal states cannot move", async () => {
    await asUser(db, U.sOwner, async () => {
      await db.exec(
        `insert into public.documents (id, org_id, source_type, rights_class, supplier_id, storage_path, original_filename, mime, bytes)
         values ('${DOC.s1}', '${ORG.s}', 'supplier_portal', 'supplier_submitted_private', '${supplierId}', '${path(ORG.s, DOC.s1, "license.jpg")}', '营业执照.jpg', 'image/jpeg', 4096)`,
      );
    });
    await asUser(
      db,
      null,
      async () => {
        await db.exec(`update public.documents set status = 'scanning' where id = '${DOC.s1}'`);
        expect(
          await expectError(db, "update public.documents set status = 'rejected' where id = $1", [
            DOC.s1,
          ]),
        ).toMatch(/check/);
        await db.exec(
          `update public.documents set status = 'rejected', rejected_reason = 'EICAR signature', retention_class = 'forensic_7d' where id = '${DOC.s1}'`,
        );
        expect(
          await expectError(
            db,
            "update public.documents set status = 'parsed', sha256 = $2, storage_bucket = 'documents' where id = $1",
            [DOC.s1, SHA],
          ),
        ).toMatch(/invalid document transition rejected/);
        expect(
          await expectError(db, "update public.documents set status = 'discarded' where id = $1", [
            DOC.s1,
          ]),
        ).toMatch(/invalid document transition rejected/);
      },
      "service_role",
    );
    await asUser(db, U.sOwner, async () => {
      expect(
        await expectError(db, "update public.documents set status = 'discarded' where id = $1", [
          DOC.s1,
        ]),
      ).toMatch(/invalid document transition/);
    });
  });
});

describe("parse output (document_pages / document_cells)", () => {
  it("is worker-only to write, follows the document's readability, and carries the org automatically", async () => {
    await asUser(db, U.aOwner, async () => {
      expect(
        await expectError(
          db,
          "insert into public.document_pages (document_id, page_no, text) values ($1, 1, 'x')",
          [DOC.a1],
        ),
      ).toMatch(/permission denied/);
    });
    await asUser(
      db,
      null,
      async () => {
        await db.exec(
          `insert into public.document_pages (document_id, page_no, text) values ('${DOC.a1}', 1, '报价单 第1页'), ('${DOC.a1}', 2, 'page 2')`,
        );
        await db.exec(
          `insert into public.document_cells (document_id, sheet, row_no, col_no, raw) values ('${DOC.a1}', 'Sheet1', 1, 1, '单价')`,
        );
        expect(
          await expectError(
            db,
            "insert into public.document_pages (document_id, page_no, text) values ($1, 501, 'too many')",
            [DOC.a1],
          ),
        ).toMatch(/check/);
        expect(
          await expectError(
            db,
            "insert into public.document_pages (document_id, page_no, text) values ($1, 1, 'dup')",
            [DOC.a1],
          ),
        ).toMatch(/unique|duplicate/);
      },
      "service_role",
    );
    const org = await db.query<{ org_id: string }>(
      "select org_id from public.document_pages where document_id = $1 limit 1",
      [DOC.a1],
    );
    expect(org[0]!.org_id).toBe(ORG.a);
    await asUser(db, U.aViewer, async () => {
      expect(
        await count("select 1 from public.document_pages where document_id = $1", [DOC.a1]),
      ).toBe(2);
      expect(
        await count("select 1 from public.document_cells where document_id = $1", [DOC.a1]),
      ).toBe(1);
      expect(
        await expectError(
          db,
          "update public.document_pages set text = 'x' where document_id = $1",
          [DOC.a1],
        ),
      ).toMatch(/permission denied/);
    });
    for (const u of [U.bOwner, U.op, U.sOwner]) {
      await asUser(db, u, async () => {
        expect(await count("select 1 from public.document_pages"), u).toBe(0);
        expect(await count("select 1 from public.document_cells"), u).toBe(0);
      });
    }
  });
});

describe("document_access_log via app.log_document_access", () => {
  it("records the actor for a readable document; denies for an unreadable one; direct inserts are impossible", async () => {
    await asUser(db, U.aViewer, async () => {
      const id = (
        await db.query<{ id: string }>(
          "select app.log_document_access($1, 'signed_url', 'iphash') as id",
          [DOC.a1],
        )
      )[0]!.id;
      expect(id).toBeTruthy();
      expect(await expectError(db, "select app.log_document_access($1, 'view')", [DOC.b1])).toMatch(
        /not readable/,
      );
      expect(
        await expectError(db, "select app.log_document_access($1, 'print')", [DOC.a1]),
      ).toMatch(/unknown document access action/);
      expect(
        await expectError(
          db,
          "insert into public.document_access_log (document_id, action) values ($1, 'view')",
          [DOC.a1],
        ),
      ).toMatch(/permission denied/);
    });
    await asUser(db, U.bOwner, async () => {
      expect(
        await expectError(db, "select app.log_document_access($1, 'download')", [DOC.a1]),
      ).toMatch(/not readable/);
    });
    const rows = await db.query<{ user_id: string; org_id: string; action: string }>(
      "select user_id, org_id, action from public.document_access_log where document_id = $1",
      [DOC.a1],
    );
    expect(rows).toEqual([{ user_id: U.aViewer, org_id: ORG.a, action: "signed_url" }]);
    // the FK now holds: a log row cannot point at a non-existent document
    expect(
      await expectError(
        db,
        "insert into public.document_access_log (document_id, action) values ('00000000-0000-4000-8000-0000000000ff', 'view')",
      ),
    ).toMatch(/foreign key/);
  });
});

describe("storage.objects policies", () => {
  it("a member uploads only into quarantine, under their own org, for their own `uploaded` document at the registered path", async () => {
    const DOC_A2 = "f0000000-0000-4000-8000-00000000001a";
    await asUser(db, U.aMember, async () => {
      await db.exec(
        `insert into public.documents (id, org_id, source_type, rights_class, storage_path, original_filename, mime, bytes)
         values ('${DOC_A2}', '${ORG.a}', 'buyer_upload', 'buyer_uploaded_private', '${path(ORG.a, DOC_A2, "spec.png")}', 'spec.png', 'image/png', 100)`,
      );
      // happy path
      await db.exec(
        `insert into storage.objects (bucket_id, name) values ('quarantine', '${path(ORG.a, DOC_A2, "spec.png")}')`,
      );
      // wrong bucket
      expect(
        await expectError(
          db,
          "insert into storage.objects (bucket_id, name) values ('documents', $1)",
          [path(ORG.a, DOC_A2, "spec2.png")],
        ),
      ).toMatch(/row-level security/);
      // another org's folder
      expect(
        await expectError(
          db,
          "insert into storage.objects (bucket_id, name) values ('quarantine', $1)",
          [path(ORG.b, DOC.b1)],
        ),
      ).toMatch(/row-level security/);
      // own org folder but a path not registered on the document row
      expect(
        await expectError(
          db,
          "insert into storage.objects (bucket_id, name) values ('quarantine', $1)",
          [path(ORG.a, DOC_A2, "other-name.png")],
        ),
      ).toMatch(/row-level security/);
      // a document that already left `uploaded` (a1 is parsed) cannot receive a second object
      expect(
        await expectError(
          db,
          "insert into storage.objects (bucket_id, name) values ('quarantine', $1)",
          [path(ORG.a, DOC.a1)],
        ),
      ).toMatch(/row-level security/);
      // garbage paths deny without raising a cast error
      expect(
        await expectError(
          db,
          "insert into storage.objects (bucket_id, name) values ('quarantine', 'not-a-uuid/x/y')",
        ),
      ).toMatch(/row-level security/);
    });
    await asUser(db, U.aViewer, async () => {
      expect(
        await expectError(
          db,
          "insert into storage.objects (bucket_id, name) values ('quarantine', $1)",
          [path(ORG.a, DOC_A2, "spec.png")],
        ),
      ).toMatch(/row-level security|duplicate/);
    });
  });

  it("served objects are readable only through the document's read rule; quarantine is never readable; B cannot guess A's path", async () => {
    // the worker promoted a1 to documents/ (status parsed) — simulate the object copy
    await asUser(
      db,
      null,
      async () => {
        await db.exec(
          `insert into storage.objects (bucket_id, name) values ('documents', '${path(ORG.a, DOC.a1)}')`,
        );
        await db.exec(
          `insert into storage.objects (bucket_id, name) values ('quarantine', '${path(ORG.a, DOC.a1)}')`,
        ); // forensic copy still in quarantine
        // an object in a served bucket whose document is NOT at that path (stale / planted) must be unreadable
        await db.exec(
          `insert into storage.objects (bucket_id, name) values ('documents', '${path(ORG.a, DOC.a1, "stale-copy.pdf")}')`,
        );
      },
      "service_role",
    );
    await asUser(db, U.aViewer, async () => {
      const names = (
        await db.query<{ bucket_id: string; name: string }>(
          "select bucket_id, name from storage.objects order by bucket_id, name",
        )
      ).map((r) => `${r.bucket_id}:${r.name}`);
      expect(names).toEqual([`documents:${path(ORG.a, DOC.a1)}`]);
      // no update/delete
      expect(
        await expectError(db, "delete from storage.objects where name = $1", [path(ORG.a, DOC.a1)]),
      ).toBeNull(); // RLS: 0 rows, no error
    });
    expect(
      await count("select 1 from storage.objects where bucket_id = 'documents' and name = $1", [
        path(ORG.a, DOC.a1),
      ]),
    ).toBe(1);
    for (const u of [U.bOwner, U.op, U.sOwner]) {
      await asUser(db, u, async () => {
        expect(
          await count("select 1 from storage.objects where name = $1", [path(ORG.a, DOC.a1)]),
          u,
        ).toBe(0);
      });
    }
    await asUser(db, U.admin, async () => {
      expect(
        await count("select 1 from storage.objects where bucket_id = 'documents' and name = $1", [
          path(ORG.a, DOC.a1),
        ]),
      ).toBe(1);
      expect(await count("select 1 from storage.objects where bucket_id = 'quarantine'")).toBe(0);
    });
  });

  it("a supplier reads its own submitted file (once served) and nothing of the buyers'", async () => {
    const DOC_S2 = "f0000000-0000-4000-8000-00000000002c";
    await asUser(db, U.sOwner, async () => {
      await db.exec(
        `insert into public.documents (id, org_id, source_type, rights_class, supplier_id, storage_path, original_filename, mime, bytes)
         values ('${DOC_S2}', '${ORG.s}', 'supplier_portal', 'supplier_submitted_private', '${supplierId}', '${path(ORG.s, DOC_S2, "catalog.pdf")}', 'catalog.pdf', 'application/pdf', 4096)`,
      );
    });
    await asUser(
      db,
      null,
      async () => {
        await db.exec(`update public.documents set status = 'scanning' where id = '${DOC_S2}'`);
        await db.exec(
          `update public.documents set status = 'parsed', sha256 = '${"b".repeat(64)}', storage_bucket = 'supplier-evidence' where id = '${DOC_S2}'`,
        );
        await db.exec(
          `insert into storage.objects (bucket_id, name) values ('supplier-evidence', '${path(ORG.s, DOC_S2, "catalog.pdf")}')`,
        );
      },
      "service_role",
    );
    await asUser(db, U.sOwner, async () => {
      expect(
        (await db.query<{ name: string }>("select name from storage.objects")).map((r) => r.name),
      ).toEqual([path(ORG.s, DOC_S2, "catalog.pdf")]);
      expect(await count("select 1 from public.documents where id = $1", [DOC.a1])).toBe(0);
    });
    await asUser(db, U.aOwner, async () => {
      expect(await count("select 1 from public.documents where id = $1", [DOC_S2])).toBe(0);
      expect(
        await count("select 1 from storage.objects where bucket_id = 'supplier-evidence'"),
      ).toBe(0);
    });
  });
});

describe("grant layer", () => {
  it("authenticated cannot DELETE documents or write parse output", async () => {
    await asUser(db, U.admin, async () => {
      expect(await expectError(db, "delete from public.documents")).toMatch(/permission denied/);
      expect(await expectError(db, "delete from public.document_pages")).toMatch(
        /permission denied/,
      );
      expect(
        await expectError(
          db,
          "insert into public.document_cells (document_id, sheet, row_no, col_no) values ($1, 's', 1, 1)",
          [DOC.a1],
        ),
      ).toMatch(/permission denied/);
    });
  });
});
