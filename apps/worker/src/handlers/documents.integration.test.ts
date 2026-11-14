/**
 * fbg_documents end to end on the REAL stack (B-12 / B-13): real Postgres + pgmq (as service_role, exactly like the
 * worker), real Supabase Storage over HTTP, and the real restricted parser child process. Nothing here is mocked
 * except, by default, the malware engine:
 *
 *   - without CLAMAV_HOST the scripted FakeScanner stands in (it "detects" a harmless marker string), so this suite
 *     proves the pipeline's behaviour around a verdict, not that malware is detected;
 *   - with CLAMAV_HOST / CLAMAV_PORT the real ClamdScanner is used and the infected case is the EICAR test file.
 *     CI runs it that way.
 *
 * Needs DATABASE_URL (loopback only), SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY of a migrated local Supabase stack;
 * it fails, never skips, without them. Every document, organization and person in it is synthetic.
 */
import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import pg from "pg";
import pino from "pino";
import sharp from "sharp";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createServiceRoleDb, type ServiceRoleDb } from "../db.js";
import { DOCUMENTS_QUEUE, DOCUMENT_PROCESS, documentJobKey } from "../documents/job.js";
import { PgDocumentRepo } from "../documents/repo.js";
import { ProcessSandbox } from "../documents/runner.js";
import {
  ClamdScanner,
  ScannerUnavailableError,
  type MalwareScanner,
  type ScanVerdict,
} from "../documents/scanner.js";
import { SupabaseObjectStore } from "../documents/storage.js";
import { FakeScanner } from "../documents/testing/fakes.js";
import {
  FAKE_MALWARE_MARKER,
  SAMPLE_PDF_PAGES,
  SAMPLE_SHEETS,
  buildPdf,
  buildXlsx,
  eicarTestFile,
} from "../documents/testing/fixtures.js";
import { Consumer, type ConsumerOptions } from "../queue/consumer.js";
import { buildEnvelope } from "../queue/envelope.js";
import { PgQueueStore } from "../queue/pg-store.js";
import { createDocumentsHandler } from "./documents.js";

const url = process.env.DATABASE_URL;
const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !supabaseUrl || !serviceKey) {
  throw new Error(
    "DATABASE_URL, SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set: the document pipeline integration suite needs a local Supabase stack (it never skips silently)",
  );
}
for (const target of [url, supabaseUrl]) {
  const host = new URL(target).hostname;
  if (!["127.0.0.1", "localhost", "[::1]", "::1"].includes(host)) {
    throw new Error(
      `refusing to run the document integration suite against non-loopback host ${host}`,
    );
  }
}

const REAL_CLAMAV = (process.env.CLAMAV_HOST ?? "") !== "";
const APP_NAME = "fbg-worker-itest-docs";
const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const ORG_A = randomUUID();
const ORG_B = randomUUID();
const USER_A = randomUUID(); // member of ORG_A
const USER_B = randomUUID(); // member of ORG_B
const log = pino({ level: "silent" });
const sha = (data: Buffer) => createHash("sha256").update(data).digest("hex");

let admin: pg.Client;
let db: ServiceRoleDb;
let queue: PgQueueStore;
let storage: SupabaseObjectStore;
const created: { id: string; org: string }[] = [];

async function q<T extends pg.QueryResultRow>(text: string, params: unknown[] = []): Promise<T[]> {
  return (await admin.query<T>(text, params)).rows;
}

/** Runs `text` as a signed-in user would reach the database through the API: role `authenticated`, RLS on. */
async function asUser<T extends pg.QueryResultRow>(
  userId: string | null,
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  await admin.query("begin");
  try {
    await admin.query(userId === null ? "set local role anon" : "set local role authenticated");
    await admin.query("select set_config('request.jwt.claim.sub', $1, true)", [userId ?? ""]);
    await admin.query("select set_config('request.jwt.claims', $1, true)", [
      JSON.stringify(userId === null ? { role: "anon" } : { sub: userId, role: "authenticated" }),
    ]);
    return (await admin.query<T>(text, params)).rows;
  } finally {
    await admin.query("rollback");
  }
}

async function userError(
  userId: string | null,
  text: string,
  params: unknown[] = [],
): Promise<string> {
  try {
    await asUser(userId, text, params);
    return "";
  } catch (err) {
    return (err as Error).message;
  }
}

const rest = (method: string, bucket: string, path: string, body?: Buffer, contentType?: string) =>
  fetch(`${supabaseUrl}/storage/v1/object/${bucket}/${path}`, {
    method,
    headers: {
      apikey: serviceKey,
      authorization: `Bearer ${serviceKey}`,
      ...(contentType === undefined ? {} : { "content-type": contentType, "x-upsert": "true" }),
    },
    ...(body === undefined ? {} : { body: new Uint8Array(body) }),
  });

async function objectBytes(bucket: string, path: string): Promise<Buffer | null> {
  const res = await rest("GET", bucket, path);
  if (!res.ok) return null;
  return Buffer.from(await res.arrayBuffer());
}

/** Registers a document the way the upload path will (row first, then the object into quarantine). */
async function upload(
  org: string,
  user: string,
  filename: string,
  mime: string,
  data: Buffer,
  storedName = "upload.bin",
): Promise<{ id: string; path: string }> {
  const id = randomUUID();
  const path = `${org}/${id}/${storedName}`;
  await q(
    `insert into public.documents (id, org_id, uploaded_by, source_type, rights_class, storage_path, original_filename, mime, bytes)
     values ($1, $2, $3, 'buyer_upload', 'buyer_uploaded_private', $4, $5, $6, $7)`,
    [id, org, user, path, filename, mime, Math.max(1, data.length)],
  );
  const res = await rest("POST", "quarantine", path, data, mime);
  expect(res.ok, `fixture upload ${res.status}`).toBe(true);
  created.push({ id, org });
  return { id, path };
}

const enqueue = (documentId: string, orgId: string, key = documentJobKey(documentId)) =>
  queue.send(
    DOCUMENTS_QUEUE,
    buildEnvelope(DOCUMENT_PROCESS, key, { document_id: documentId, org_id: orgId }),
  );

interface DocRow {
  status: string;
  storage_bucket: string;
  storage_path: string;
  sha256: string | null;
  page_count: number | null;
  rejected_reason: string | null;
  scan_result: Record<string, unknown> | null;
}
const doc = async (id: string): Promise<DocRow> =>
  (
    await q<DocRow>(
      "select status::text as status, storage_bucket, storage_path, sha256, page_count, rejected_reason, scan_result from public.documents where id = $1",
      [id],
    )
  )[0]!;
const count = async (table: "document_pages" | "document_cells", id: string): Promise<number> =>
  Number(
    (
      await q<{ n: string }>(
        `select count(*)::text as n from public.${table} where document_id = $1`,
        [id],
      )
    )[0]!.n,
  );
const ledger = (id: string, key = documentJobKey(id)) =>
  q<{ status: string; attempts: number; error: string | null }>(
    "select status, attempts, error from public.job_executions where queue = $1 and idempotency_key = $2",
    [DOCUMENTS_QUEUE, key],
  );
const deadLetters = (id: string) =>
  q<{ error: string; attempts: number }>(
    "select error, attempts from public.jobs_dead_letter where queue = $1 and idempotency_key like $2 order by created_at",
    [DOCUMENTS_QUEUE, `document.process:${id}:%`],
  );
const idleInTransaction = async (): Promise<number> =>
  Number(
    (
      await q<{ n: string }>(
        "select count(*)::text as n from pg_stat_activity where application_name = $1 and (state like 'idle in transaction%' or xact_start is not null)",
        [APP_NAME],
      )
    )[0]!.n,
  );

/** Wraps a scanner so a test can observe or change the world at the moment the scan runs (mid-prepare). */
class HookedScanner implements MalwareScanner {
  readonly name: string;
  during: (() => Promise<void>) | null = null;
  failNext = 0;
  constructor(private readonly inner: MalwareScanner) {
    this.name = inner.name;
  }
  async scanFile(path: string, signal?: AbortSignal): Promise<ScanVerdict> {
    if (this.failNext > 0) {
      this.failNext--;
      throw new ScannerUnavailableError("unreachable");
    }
    await this.during?.();
    return this.inner.scanFile(path, signal);
  }
}

let scanner: HookedScanner;

function consumer(overrides: Partial<ConsumerOptions> = {}): Consumer {
  const handler = createDocumentsHandler({
    repo: new PgDocumentRepo(db),
    store: storage,
    scanner,
    sandbox: new ProcessSandbox({ timeoutMs: 60_000 }),
  });
  return new Consumer({
    store: queue,
    handlers: new Map([[DOCUMENTS_QUEUE, handler]]),
    log,
    workerId: "itest-docs",
    concurrency: 2,
    visibilityTimeoutSeconds: 60,
    maxAttempts: 3,
    backoff: { baseSeconds: 0, maxSeconds: 0, jitterRatio: 0 },
    busyRetrySeconds: 0,
    pollIntervalMs: 20,
    jobTimeoutMs: 120_000,
    ...overrides,
  });
}

beforeAll(async () => {
  admin = new pg.Client({ connectionString: url });
  await admin.connect();
  expect(await q("select 1 from pg_extension where extname = 'pgmq'")).toHaveLength(1);

  await q("insert into auth.users (id, email) values ($1, $2), ($3, $4)", [
    USER_A,
    `itest-docs-a-${USER_A}@example.test`,
    USER_B,
    `itest-docs-b-${USER_B}@example.test`,
  ]);
  await q(
    `insert into public.organizations (id, org_type, legal_name, display_name)
     values ($1, 'buyer', 'Docs ITest Buyer A (synthetic)', 'DA'), ($2, 'buyer', 'Docs ITest Buyer B (synthetic)', 'DB')`,
    [ORG_A, ORG_B],
  );
  await q(
    "insert into public.memberships (org_id, user_id, role) values ($1, $2, 'member'), ($3, $4, 'member')",
    [ORG_A, USER_A, ORG_B, USER_B],
  );

  db = await createServiceRoleDb(url, {
    max: 8,
    statementTimeoutMs: 30_000,
    applicationName: APP_NAME,
  });
  queue = new PgQueueStore(db);
  storage = new SupabaseObjectStore({ url: supabaseUrl, serviceKey });
});

beforeEach(async () => {
  await q("select pgmq.purge_queue($1)", [DOCUMENTS_QUEUE]);
  scanner = new HookedScanner(
    REAL_CLAMAV
      ? new ClamdScanner({
          host: process.env.CLAMAV_HOST!,
          port: Number(process.env.CLAMAV_PORT ?? "3310"),
          timeoutMs: 120_000,
        })
      : new FakeScanner(),
  );
});

afterAll(async () => {
  await db?.close();
  if (admin === undefined) return;
  await q("select pgmq.purge_queue($1)", [DOCUMENTS_QUEUE]);
  for (const { id, org } of created) {
    const row = (
      await q<{ storage_bucket: string; storage_path: string }>(
        "select storage_bucket, storage_path from public.documents where id = $1",
        [id],
      )
    )[0];
    await rest("DELETE", "quarantine", `${org}/${id}/upload.bin`).catch(() => undefined);
    if (row !== undefined)
      await rest("DELETE", row.storage_bucket, row.storage_path).catch(() => undefined);
    await q("delete from public.job_executions where idempotency_key like $1", [
      `document.process:${id}:%`,
    ]);
    await q("delete from public.jobs_dead_letter where idempotency_key like $1", [
      `document.process:${id}:%`,
    ]);
  }
  await q("delete from public.notifications where user_id = any($1::uuid[])", [[USER_A, USER_B]]);
  await q("delete from public.organizations where id = any($1::uuid[])", [[ORG_A, ORG_B]]);
  await q("delete from auth.users where id = any($1::uuid[])", [[USER_A, USER_B]]);
  await admin.end();
});

describe("a clean, authorized document", () => {
  it("PDF: quarantine → scan → parse → parsed, with page anchors; readable by its organization only", async () => {
    const data = buildPdf(SAMPLE_PDF_PAGES);
    const { id, path } = await upload(
      ORG_A,
      USER_A,
      "Quote 2026 报价.pdf",
      "application/pdf",
      data,
    );

    // before processing: the uploader's own organization cannot read the quarantined object
    const quarantined =
      "select 1 from storage.objects where bucket_id = 'quarantine' and name = $1";
    expect(await asUser(USER_A, quarantined, [path])).toHaveLength(0);

    let openDuringScan = -1;
    scanner.during = async () => {
      openDuringScan = await idleInTransaction(); // measured while the scan is in progress
    };
    const msgId = await enqueue(id, ORG_A);
    expect(await consumer().drain()).toEqual(["succeeded"]);
    expect(openDuringScan).toBe(0); // no SQL transaction is held open across the scan

    const row = await doc(id);
    const promoted = `${ORG_A}/${id}/${sha(data).slice(0, 12)}-Quote_2026.pdf`;
    expect(row).toMatchObject({
      status: "parsed",
      storage_bucket: "documents",
      storage_path: promoted,
      sha256: sha(data),
      page_count: 2,
      rejected_reason: null,
    });
    expect(row.scan_result).toMatchObject({
      v: 1,
      sha256: sha(data),
      bytes: data.length,
      detected_kind: "pdf",
      scanner: { verdict: "clean", engine: REAL_CLAMAV ? "clamav" : "fake" },
      isolation: "process",
      parse: { kind: "pdf", page_count: 2, text_available: true },
      promoted: { bucket: "documents", path: promoted, sha256: sha(data), reencoded: false },
      rejection: null,
    });

    const pages = await q<{
      page_no: number;
      org_id: string;
      text: string;
      layout: { items: unknown[]; width: number };
    }>(
      "select page_no, org_id, text, layout from public.document_pages where document_id = $1 order by page_no",
      [id],
    );
    expect(pages.map((p) => [p.page_no, p.org_id])).toEqual([
      [1, ORG_A],
      [2, ORG_A],
    ]);
    expect(pages[0]!.text).toContain("Unit price: USD 1.25 FOB Shenzhen");
    expect(pages[0]!.text.replace(/\s/g, "")).toContain("单价人民币8.50元含税");
    expect(pages[1]!.text.replace(/\s/g, "")).toContain("交货期30天");
    expect(pages[0]!.layout.items).toContainEqual([
      72,
      760,
      expect.any(Number),
      12,
      "Unit price: USD 1.25 FOB Shenzhen",
    ]);
    expect(await count("document_cells", id)).toBe(0);

    // the promoted object is byte-for-byte what was scanned
    expect((await objectBytes("documents", promoted))?.equals(data)).toBe(true);
    // and once `parsed` is durable, the quarantined upload is gone: the served copy is the document now
    expect(
      await q("select 1 from storage.objects where bucket_id = 'quarantine' and name = $1", [path]),
    ).toHaveLength(0);

    // queue bookkeeping agrees
    expect(await ledger(id)).toEqual([{ status: "succeeded", attempts: 1, error: null }]);
    expect(
      await q(`select 1 from pgmq."a_${DOCUMENTS_QUEUE}" where msg_id = $1::bigint`, [msgId]),
    ).toHaveLength(1);
    expect(
      await q(`select 1 from pgmq."q_${DOCUMENTS_QUEUE}" where msg_id = $1::bigint`, [msgId]),
    ).toHaveLength(0);

    // tenant isolation, as signed-in users (RLS on): A reads, B and anonymous see nothing
    const served = "select 1 from storage.objects where bucket_id = 'documents' and name = $1";
    const pagesSql = "select 1 from public.document_pages where document_id = $1";
    const docSql = "select 1 from public.documents where id = $1";
    expect(await asUser(USER_A, served, [promoted])).toHaveLength(1);
    expect(await asUser(USER_A, pagesSql, [id])).toHaveLength(2);
    expect(await asUser(USER_B, served, [promoted])).toHaveLength(0);
    expect(await asUser(USER_B, pagesSql, [id])).toHaveLength(0);
    expect(await asUser(USER_B, docSql, [id])).toHaveLength(0);
    expect(await asUser(USER_A, quarantined, [path])).toHaveLength(0); // quarantine stays unreadable
    expect(await userError(null, pagesSql, [id])).toMatch(/permission denied/);

    // the uploader is told, once
    const notes = await q<{ kind: string; payload: unknown }>(
      "select kind, payload from public.notifications where user_id = $1 and dedupe_key = $2",
      [USER_A, `document:${id}:document_parsed`],
    );
    expect(notes).toEqual([{ kind: "document_parsed", payload: { document_id: id } }]);
  });

  it("XLSX: cell records with anchors; cached values only; a large sheet is stored in one transaction", async () => {
    const rows = Array.from({ length: 2_000 }, (_, r) => [
      `item ${r + 1}`,
      r + 1,
      (r + 1) * 0.5,
      { formula: `B${r + 1}*C${r + 1}`, cached: (r + 1) * (r + 1) * 0.5 },
    ]);
    const data = buildXlsx([...SAMPLE_SHEETS, { name: "Bulk", rows }]);
    const { id } = await upload(ORG_A, USER_A, "报价单.xlsx", XLSX_MIME, data);
    await enqueue(id, ORG_A);
    expect(await consumer().drain()).toEqual(["succeeded"]);

    const row = await doc(id);
    expect(row).toMatchObject({ status: "parsed", storage_bucket: "documents", page_count: null });
    expect(row.storage_path).toBe(`${ORG_A}/${id}/${sha(data).slice(0, 12)}-document.xlsx`); // ASCII key for a Chinese name
    expect(await count("document_cells", id)).toBe(8_019);
    const cell = (sheet: string, r: number, c: number) =>
      q<{ raw: string | null; parsed: Record<string, unknown>; org_id: string }>(
        "select raw, parsed, org_id from public.document_cells where document_id = $1 and sheet = $2 and row_no = $3 and col_no = $4",
        [id, sheet, r, c],
      );
    expect(await cell("报价 Quote", 2, 5)).toEqual([
      { raw: "425", parsed: { type: "number", formula: true, cached: true }, org_id: ORG_A },
    ]);
    expect(await cell("报价 Quote", 3, 5)).toEqual([
      { raw: null, parsed: { type: "number", formula: true, cached: false }, org_id: ORG_A },
    ]);
    expect((await cell("Bulk", 2000, 4))[0]).toMatchObject({ raw: "2000000" });
    expect(row.scan_result).toMatchObject({
      parse: {
        kind: "xlsx",
        cell_count: 8_019,
        flags: ["formula_without_cached_value", "formulas_present"],
      },
    });
    expect(
      await asUser(USER_B, "select 1 from public.document_cells where document_id = $1", [id]),
    ).toHaveLength(0);
  });
});

describe("images", () => {
  it("PNG: the re-encoded copy is scanned in its own right and is what gets served; the original is removed", async () => {
    const original = await sharp({
      create: { width: 48, height: 32, channels: 3, background: { r: 20, g: 90, b: 160 } },
    })
      .withExif({ IFD0: { Copyright: "SYNTHETIC-EXIF-MARK", Artist: "nobody" } })
      .png()
      .toBuffer();
    expect(original.includes("SYNTHETIC-EXIF-MARK")).toBe(true);
    const { id, path } = await upload(ORG_A, USER_A, "label photo.png", "image/png", original);

    const scannedHashes: string[] = [];
    const inner = scanner;
    const recording: MalwareScanner = {
      name: inner.name,
      async scanFile(file, signal) {
        scannedHashes.push(sha(await readFile(file)));
        return inner.scanFile(file, signal);
      },
    };
    await enqueue(id, ORG_A);
    const handler = createDocumentsHandler({
      repo: new PgDocumentRepo(db),
      store: storage,
      scanner: recording,
      sandbox: new ProcessSandbox({ timeoutMs: 60_000 }),
    });
    const c = consumer({ handlers: new Map([[DOCUMENTS_QUEUE, handler]]) });
    expect(await c.drain()).toEqual(["succeeded"]);

    const row = await doc(id);
    expect(row).toMatchObject({ status: "parsed", storage_bucket: "documents", page_count: 1 });
    expect(row.sha256).toBe(sha(original)); // provenance: the hash of what was uploaded
    const served = await objectBytes("documents", row.storage_path);
    expect(served).not.toBeNull();
    expect(served!.equals(original)).toBe(false);
    expect(served!.includes("SYNTHETIC-EXIF-MARK")).toBe(false);
    expect((await sharp(served!).metadata()).exif).toBeUndefined();
    // both files were shown to the scanner: the upload, then the copy that is actually served
    expect(scannedHashes).toEqual([sha(original), sha(served!)]);
    expect(row.scan_result).toMatchObject({
      scanner: { verdict: "clean" },
      promoted: { sha256: sha(served!), reencoded: true, scanner: { verdict: "clean" } },
      parse: { kind: "image", text_available: false, ocr: "unavailable" },
    });
    expect(
      await q<{ text: string | null; layout: Record<string, unknown> }>(
        "select text, layout from public.document_pages where document_id = $1",
        [id],
      ),
    ).toEqual([
      {
        text: null, // no OCR: nothing was read from the picture, and the record says so
        layout: {
          v: 1,
          kind: "image",
          unit: "px",
          width: 48,
          height: 32,
          format: "png",
          ocr: "unavailable",
        },
      },
    ]);
    // the un-stripped original, with its metadata, does not outlive the promotion
    expect(
      await q("select 1 from storage.objects where bucket_id = 'quarantine' and name = $1", [path]),
    ).toHaveLength(0);
  });
});

describe("a job that arrives before its upload", () => {
  it("leaves the document untouched and still uploadable; a later job then processes it", async () => {
    const data = buildPdf(SAMPLE_PDF_PAGES);
    const id = randomUUID();
    const path = `${ORG_A}/${id}/upload.bin`;
    await q(
      `insert into public.documents (id, org_id, uploaded_by, source_type, rights_class, storage_path, original_filename, mime, bytes)
       values ($1, $2, $3, 'buyer_upload', 'buyer_uploaded_private', $4, 'early.pdf', 'application/pdf', $5)`,
      [id, ORG_A, USER_A, path, data.length],
    );
    created.push({ id, org: ORG_A });
    await enqueue(id, ORG_A); // no object in quarantine yet
    expect(await consumer({ maxAttempts: 2 }).drain()).toEqual([
      "retry_scheduled",
      "dead_lettered",
    ]);
    expect(await doc(id)).toMatchObject({ status: "uploaded", storage_bucket: "quarantine" });
    expect((await deadLetters(id))[0]!.error).toBe("TransientDocumentError: object_missing");

    // the upload arrives (the storage policy still accepts it, because the row is still `uploaded`)…
    expect((await rest("POST", "quarantine", path, data, "application/pdf")).ok).toBe(true);
    // …and a re-queue completes it
    await enqueue(id, ORG_A, documentJobKey(id, 1));
    expect(await consumer().drain()).toEqual(["succeeded"]);
    expect((await doc(id)).status).toBe("parsed");
    expect(await count("document_pages", id)).toBe(2);
  });
});

describe("malware", () => {
  it(`${REAL_CLAMAV ? "EICAR (real ClamAV)" : "marker (fake scanner)"}: rejected, quarantined, audited, never parsed or promoted`, async () => {
    const data = REAL_CLAMAV
      ? eicarTestFile()
      : Buffer.from(`name,price\n${FAKE_MALWARE_MARKER},1\n`);
    const { id, path } = await upload(ORG_A, USER_A, "prices.csv", "text/csv", data);
    await enqueue(id, ORG_A);
    expect(await consumer().drain()).toEqual(["succeeded"]);

    const row = await doc(id);
    expect(row).toMatchObject({
      status: "rejected",
      storage_bucket: "quarantine",
      storage_path: path,
      rejected_reason: "malware_detected",
      sha256: sha(data),
      page_count: null,
    });
    expect(row.scan_result).toMatchObject({
      scanner: { verdict: "infected" },
      parse: null,
      promoted: null,
      rejection: { code: "malware_detected" },
    });
    expect(await count("document_pages", id)).toBe(0);
    expect(await count("document_cells", id)).toBe(0);

    // the rejected upload stays where it is, for forensics (service role only)
    expect(
      await q("select 1 from storage.objects where bucket_id = 'quarantine' and name = $1", [path]),
    ).toHaveLength(1);
    // nothing of this document exists in a served bucket
    expect(
      await q("select 1 from storage.objects where bucket_id <> 'quarantine' and name like $1", [
        `${ORG_A}/${id}/%`,
      ]),
    ).toHaveLength(0);
    // and the quarantined object is unreachable for the uploader (no signed URL can be issued for it either:
    // the policy that governs both denies it)
    expect(
      await asUser(
        USER_A,
        "select 1 from storage.objects where bucket_id = 'quarantine' and name = $1",
        [path],
      ),
    ).toHaveLength(0);

    const events = await q<{ kind: string; org_id: string; details: Record<string, unknown> }>(
      "select kind, org_id, details from public.security_events where details ->> 'document_id' = $1",
      [id],
    );
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      kind: "scan_rejected",
      org_id: ORG_A,
      details: { document_id: id, reason: "malware_detected", sha256: sha(data) },
    });
    if (REAL_CLAMAV) expect(String(events[0]!.details["signature"])).toMatch(/eicar/i);
    expect(
      await q(
        "select 1 from public.notifications where user_id = $1 and kind = 'document_rejected' and dedupe_key = $2",
        [USER_A, `document:${id}:document_rejected`],
      ),
    ).toHaveLength(1);

    // terminal: a re-queue does not resurrect it
    await enqueue(id, ORG_A, documentJobKey(id, 1));
    expect(await consumer().drain()).toEqual(["succeeded"]);
    expect((await doc(id)).status).toBe("rejected");
  });
});

describe("cross-tenant and unprivileged access", () => {
  it("a job naming organization B for A's document touches nothing and is dead-lettered", async () => {
    const data = buildPdf([["A's confidential quote"]]);
    const { id, path } = await upload(ORG_A, USER_A, "a.pdf", "application/pdf", data);
    await enqueue(id, ORG_B);
    expect(await consumer().drain()).toEqual(["dead_lettered"]);

    expect(await doc(id)).toMatchObject({
      status: "uploaded",
      storage_bucket: "quarantine",
      storage_path: path,
      sha256: null,
    });
    expect(await count("document_pages", id)).toBe(0);
    expect(await deadLetters(id)).toEqual([
      {
        error: "PermanentJobError: document_not_found: no such document in that organization",
        attempts: 1,
      },
    ]);
    expect(
      await q("select 1 from storage.objects where bucket_id = 'documents' and name like $1", [
        `%/${id}/%`,
      ]),
    ).toHaveLength(0);
    expect(
      await q("select 1 from storage.objects where bucket_id = 'documents' and name like $1", [
        `${ORG_B}/%`,
      ]),
    ).toHaveLength(0);
  });

  it("signed-in and anonymous users cannot do the worker's part", async () => {
    const { id } = await upload(ORG_A, USER_A, "mine.pdf", "application/pdf", buildPdf([["x"]]));
    // cannot write parse output
    expect(
      await userError(
        USER_A,
        "insert into public.document_pages (document_id, page_no, text) values ($1, 1, 'forged')",
        [id],
      ),
    ).toMatch(/permission denied/);
    expect(
      await userError(
        USER_A,
        "insert into public.document_cells (document_id, sheet, row_no, col_no, raw) values ($1, 's', 1, 1, 'forged')",
        [id],
      ),
    ).toMatch(/permission denied/);
    // cannot promote their own upload or declare it scanned
    expect(
      await userError(
        USER_A,
        "update public.documents set status = 'parsed', storage_bucket = 'documents' where id = $1",
        [id],
      ),
    ).toMatch(/members may only discard|invalid document transition/);
    expect(
      await userError(
        USER_A,
        'update public.documents set scan_result = \'{"scanner":{"verdict":"clean"}}\' where id = $1',
        [id],
      ),
    ).toMatch(/members may only discard/);
    // cannot touch the queue at all, in either direction
    for (const user of [USER_A, null]) {
      expect(await userError(user, "select pgmq.send('fbg_documents', '{}'::jsonb)")).toMatch(
        /permission denied/,
      );
      expect(await userError(user, "select * from pgmq.read('fbg_documents', 1, 1)")).toMatch(
        /permission denied/,
      );
    }
    // another organization's member cannot even see the row, let alone change it
    expect(
      await asUser(
        USER_B,
        "update public.documents set status = 'discarded' where id = $1 returning id",
        [id],
      ),
    ).toHaveLength(0);
    expect((await doc(id)).status).toBe("uploaded");
  });
});

describe("failure, retry and recovery", () => {
  it("scanner unavailable: retried, then dead-lettered; never parsed; no transaction left open", async () => {
    const { id, path } = await upload(
      ORG_A,
      USER_A,
      "q.pdf",
      "application/pdf",
      buildPdf(SAMPLE_PDF_PAGES),
    );
    scanner.failNext = 99;
    await enqueue(id, ORG_A);
    const outcomes = await consumer().drain();
    expect(outcomes).toEqual(["retry_scheduled", "retry_scheduled", "dead_lettered"]);
    expect(await doc(id)).toMatchObject({
      status: "scanning",
      storage_bucket: "quarantine",
      storage_path: path,
      sha256: null,
      scan_result: null,
    });
    expect(await count("document_pages", id)).toBe(0);
    expect(await ledger(id)).toEqual([
      {
        status: "failed",
        attempts: 3,
        error: "TransientDocumentError: scanner_unavailable: unreachable",
      },
    ]);
    expect(await deadLetters(id)).toEqual([
      { error: "TransientDocumentError: scanner_unavailable: unreachable", attempts: 3 },
    ]);
    expect(
      await q("select 1 from storage.objects where bucket_id = 'documents' and name like $1", [
        `${ORG_A}/${id}/%`,
      ]),
    ).toHaveLength(0);
    expect(await idleInTransaction()).toBe(0);
  });

  it("a document left `scanning` by a failed attempt is completed by the retry, exactly once", async () => {
    const { id } = await upload(
      ORG_A,
      USER_A,
      "q.pdf",
      "application/pdf",
      buildPdf(SAMPLE_PDF_PAGES),
    );
    scanner.failNext = 1;
    await enqueue(id, ORG_A);
    expect(await consumer().drain()).toEqual(["retry_scheduled", "succeeded"]);
    expect((await doc(id)).status).toBe("parsed");
    expect(await count("document_pages", id)).toBe(2);
    expect(await ledger(id)).toEqual([{ status: "succeeded", attempts: 2, error: null }]);
  });

  it("duplicate and concurrent deliveries collapse into one run", async () => {
    const { id } = await upload(
      ORG_A,
      USER_A,
      "q.pdf",
      "application/pdf",
      buildPdf(SAMPLE_PDF_PAGES),
    );
    await enqueue(id, ORG_A);
    await enqueue(id, ORG_A);
    await enqueue(id, ORG_A);
    const outcomes = await consumer({ concurrency: 3 }).drain();
    expect(outcomes.filter((o) => o === "succeeded")).toHaveLength(1);
    expect(
      outcomes.filter((o) => o !== "succeeded").every((o) => o === "busy" || o === "duplicate"),
    ).toBe(true);
    expect(outcomes.filter((o) => o === "duplicate")).toHaveLength(2);
    expect(await count("document_pages", id)).toBe(2);
    expect(await ledger(id)).toEqual([{ status: "succeeded", attempts: 1, error: null }]);
    expect(await q(`select 1 from pgmq."q_${DOCUMENTS_QUEUE}"`)).toHaveLength(0);
    // an out-of-order re-queue after the fact is a no-op
    await enqueue(id, ORG_A, documentJobKey(id, 1));
    expect(await consumer().drain()).toEqual(["succeeded"]);
    expect(await count("document_pages", id)).toBe(2);
  });

  it("discarded while it is being scanned: nothing is promoted or written, and it stays discarded", async () => {
    const { id } = await upload(
      ORG_A,
      USER_A,
      "q.pdf",
      "application/pdf",
      buildPdf(SAMPLE_PDF_PAGES),
    );
    scanner.during = async () => {
      // the owner discards it mid-flight (as that member, through RLS and the transition trigger)
      await admin.query("begin");
      await admin.query("set local role authenticated");
      await admin.query("select set_config('request.jwt.claim.sub', $1, true)", [USER_A]);
      await admin.query("select set_config('request.jwt.claims', $1, true)", [
        JSON.stringify({ sub: USER_A, role: "authenticated" }),
      ]);
      await admin.query("update public.documents set status = 'discarded' where id = $1", [id]);
      await admin.query("commit");
    };
    await enqueue(id, ORG_A);
    expect(await consumer().drain()).toEqual(["succeeded"]);
    expect(await doc(id)).toMatchObject({
      status: "discarded",
      storage_bucket: "quarantine",
      sha256: null,
    });
    expect(await count("document_pages", id)).toBe(0);
    expect(
      await q("select 1 from storage.objects where bucket_id = 'documents' and name like $1", [
        `${ORG_A}/${id}/%`,
      ]),
    ).toHaveLength(0);
  });

  it("an unacceptable file is rejected with a reason and leaves no parse output", async () => {
    const zipAsPdf = await upload(
      ORG_A,
      USER_A,
      "q.pdf",
      "application/pdf",
      buildXlsx(SAMPLE_SHEETS),
    );
    const macro = await upload(
      ORG_A,
      USER_A,
      "m.xlsx",
      XLSX_MIME,
      buildXlsx(SAMPLE_SHEETS, { extraParts: [{ name: "xl/vbaProject.bin", data: "vba" }] }),
    );
    await enqueue(zipAsPdf.id, ORG_A);
    await enqueue(macro.id, ORG_A);
    expect(await consumer().drain()).toEqual(["succeeded", "succeeded"]);
    expect(await doc(zipAsPdf.id)).toMatchObject({
      status: "rejected",
      storage_bucket: "quarantine",
      rejected_reason: "type_mismatch: declared pdf, content is zip",
    });
    expect((await doc(zipAsPdf.id)).scan_result).toMatchObject({ scanner: null }); // refused before it reached the scanner
    expect(await doc(macro.id)).toMatchObject({
      status: "rejected",
      rejected_reason: "macro_enabled: macro part in package",
    });
    expect((await doc(macro.id)).scan_result).toMatchObject({ scanner: { verdict: "clean" } }); // clean, and still refused
    for (const d of [zipAsPdf, macro]) {
      expect(await count("document_pages", d.id)).toBe(0);
      expect(await count("document_cells", d.id)).toBe(0);
    }
    expect(
      await q(
        "select 1 from public.security_events where kind = 'scan_rejected' and details ->> 'document_id' = any($1::text[])",
        [[zipAsPdf.id, macro.id]],
      ),
    ).toHaveLength(2);
  });
});
