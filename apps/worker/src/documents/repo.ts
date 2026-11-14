/**
 * The document pipeline's database access (B-12 / B-13). Two kinds of statement, kept apart on purpose:
 *
 *  - PgDocumentRepo: short, self-contained service_role transactions used while a document is being examined
 *    (claim it as `scanning`, re-read its status). None of them stays open across a download, a scan or a parse.
 *  - finalizeParsed / finalizeRejected: the writes of the outcome. They take the consumer's success transaction, so
 *    the document's new status, its pages and cells, the ledger's `succeeded` marker and the archive of the message
 *    commit together or not at all (ADR-041 §4, ADR-044).
 *
 * Every statement is keyed on the document id AND its organization id. The worker is service_role — RLS does not
 * apply to it — so the organization check that policies do for a signed-in user is done here, explicitly.
 */
import type { SqlClient } from "../ai/store.js";
import type { ServiceRoleDb } from "../db.js";
import type { RejectCode } from "./errors.js";

export interface DocumentRow {
  readonly id: string;
  readonly orgId: string;
  readonly uploadedBy: string | null;
  readonly status: string;
  readonly storageBucket: string;
  readonly storagePath: string;
  readonly originalFilename: string;
  readonly mime: string;
  readonly bytes: number;
}

export type LoadOutcome =
  /** The document is `uploaded`, or an earlier attempt left it `scanning`: examine it. Nothing has been changed. */
  | { readonly kind: "process"; readonly document: DocumentRow }
  /** Already processed, rejected or discarded: nothing to do. */
  | { readonly kind: "noop"; readonly status: string }
  /** No such document in that organization. Deliberately one answer for "unknown id" and "other organization". */
  | { readonly kind: "not_found" };

export interface DocumentRepo {
  /** Reads the row for (id, organization). Changes nothing. */
  load(documentId: string, orgId: string): Promise<LoadOutcome>;
  /**
   * `uploaded → scanning` in one short transaction; a document already `scanning` stays so. Returns false when the
   * document is in any other state or gone (it was discarded or finished meanwhile). Called only once the object
   * has actually been read from quarantine, so a job that arrives before its upload leaves the document untouched
   * and still uploadable.
   */
  markScanning(documentId: string, orgId: string): Promise<boolean>;
  /** The document's current status, or null when it does not exist in that organization. */
  status(documentId: string, orgId: string): Promise<string | null>;
}

interface DocumentDbRow {
  id: string;
  org_id: string;
  uploaded_by: string | null;
  status: string;
  storage_bucket: string;
  storage_path: string;
  original_filename: string;
  mime: string;
  bytes: string;
}

export class PgDocumentRepo implements DocumentRepo {
  constructor(private readonly db: ServiceRoleDb) {}

  load(documentId: string, orgId: string): Promise<LoadOutcome> {
    return this.db.tx(async (tx): Promise<LoadOutcome> => {
      const rows = await tx.query<DocumentDbRow>(
        `select id, org_id, uploaded_by, status::text as status, storage_bucket, storage_path, original_filename,
                mime, bytes::text as bytes
           from public.documents
          where id = $1::uuid and org_id = $2::uuid`,
        [documentId, orgId],
      );
      const row = rows[0];
      if (row === undefined) return { kind: "not_found" };
      if (row.status !== "uploaded" && row.status !== "scanning") {
        return { kind: "noop", status: row.status };
      }
      return {
        kind: "process",
        document: {
          id: row.id,
          orgId: row.org_id,
          uploadedBy: row.uploaded_by,
          status: row.status,
          storageBucket: row.storage_bucket,
          storagePath: row.storage_path,
          originalFilename: row.original_filename,
          mime: row.mime,
          bytes: Number(row.bytes),
        },
      };
    });
  }

  markScanning(documentId: string, orgId: string): Promise<boolean> {
    return this.db.tx(async (tx) => {
      const rows = await tx.query<{ status: string }>(
        `select status::text as status from public.documents
          where id = $1::uuid and org_id = $2::uuid
            for update`,
        [documentId, orgId],
      );
      const status = rows[0]?.status;
      if (status === "scanning") return true;
      if (status !== "uploaded") return false;
      // Closes the upload window: the storage policy only accepts an object while the row is `uploaded`.
      await tx.query(
        "update public.documents set status = 'scanning' where id = $1::uuid and org_id = $2::uuid and status = 'uploaded'",
        [documentId, orgId],
      );
      return true;
    });
  }

  status(documentId: string, orgId: string): Promise<string | null> {
    return this.db.tx(async (tx) => {
      const rows = await tx.query<{ status: string }>(
        "select status::text as status from public.documents where id = $1::uuid and org_id = $2::uuid",
        [documentId, orgId],
      );
      return rows[0]?.status ?? null;
    });
  }
}

export interface PageRecord {
  readonly page_no: number;
  readonly text: string | null;
  readonly layout: Readonly<Record<string, unknown>>;
}

export interface CellRecord {
  readonly sheet: string;
  readonly row_no: number;
  readonly col_no: number;
  readonly raw: string | null;
  readonly parsed: Readonly<Record<string, unknown>>;
}

export interface ParsedFinalization {
  readonly documentId: string;
  readonly orgId: string;
  readonly uploadedBy: string | null;
  readonly sha256: string;
  readonly promotedBucket: "documents";
  readonly promotedPath: string;
  readonly scanResult: Readonly<Record<string, unknown>>;
  readonly pageCount: number | null;
  readonly pages: readonly PageRecord[];
  readonly cells: readonly CellRecord[];
}

export interface RejectedFinalization {
  readonly documentId: string;
  readonly orgId: string;
  readonly uploadedBy: string | null;
  readonly code: RejectCode;
  readonly detail: string | null;
  readonly sha256: string | null;
  readonly scanResult: Readonly<Record<string, unknown>>;
  /** Extra, non-content facts for the security event (engine, signature). Null = no security event. */
  readonly securityEvent: Readonly<Record<string, unknown>> | null;
}

/** "written" when this call moved the document; "skipped" when it was no longer `scanning` (finished or discarded elsewhere). */
export type FinalizeOutcome = "written" | "skipped";

/** One insert statement carries at most this many rows and roughly this many characters of JSON. */
const MAX_BATCH_ROWS = 2_500;
const MAX_BATCH_CHARS = 2_000_000;

/** Splits records into JSON arrays bounded by row count and by serialized size, so no single statement is huge. */
export function jsonBatches(records: readonly unknown[]): string[] {
  const batches: string[] = [];
  let current: string[] = [];
  let chars = 0;
  for (const record of records) {
    const json = JSON.stringify(record);
    if (
      current.length > 0 &&
      (current.length >= MAX_BATCH_ROWS || chars + json.length > MAX_BATCH_CHARS)
    ) {
      batches.push(`[${current.join(",")}]`);
      current = [];
      chars = 0;
    }
    current.push(json);
    chars += json.length;
  }
  if (current.length > 0) batches.push(`[${current.join(",")}]`);
  return batches;
}

/** Locks the document row and returns its status (null when it does not exist in that organization). */
async function lockStatus(
  tx: SqlClient,
  documentId: string,
  orgId: string,
): Promise<string | null> {
  const rows = await tx.query<{ status: string }>(
    `select status::text as status from public.documents
      where id = $1::uuid and org_id = $2::uuid
        for update`,
    [documentId, orgId],
  );
  return rows[0]?.status ?? null;
}

/** The uploader is told only if they are still an active member of the owning organization. */
async function notifyUploader(
  tx: SqlClient,
  f: { documentId: string; orgId: string; uploadedBy: string | null },
  kind: "document_parsed" | "document_rejected",
  data: Readonly<Record<string, unknown>>,
): Promise<void> {
  if (f.uploadedBy === null) return;
  await tx.query(
    `select app.notify(m.user_id, m.org_id, $3::text, $4::jsonb, $5::text)
       from public.memberships m
      where m.org_id = $1::uuid and m.user_id = $2::uuid and m.status = 'active'`,
    [
      f.orgId,
      f.uploadedBy,
      kind,
      JSON.stringify({ document_id: f.documentId, ...data }),
      `document:${f.documentId}:${kind}`,
    ],
  );
}

/**
 * scanning → parsed, with the page and cell records, in the caller's transaction. Promotion out of quarantine is
 * this status change (ADR-033): the row starts pointing at the served bucket only here, after scan and parse passed.
 */
export async function finalizeParsed(
  tx: SqlClient,
  f: ParsedFinalization,
): Promise<FinalizeOutcome> {
  if ((await lockStatus(tx, f.documentId, f.orgId)) !== "scanning") return "skipped";

  // A document is parsed once (the status guard above); these clear nothing in practice and keep a re-run exact.
  await tx.query("delete from public.document_pages where document_id = $1::uuid", [f.documentId]);
  await tx.query("delete from public.document_cells where document_id = $1::uuid", [f.documentId]);

  for (const batch of jsonBatches(f.pages)) {
    await tx.query(
      `insert into public.document_pages (document_id, page_no, text, layout)
       select $1::uuid, p.page_no, p.text, p.layout
         from jsonb_to_recordset($2::jsonb) as p(page_no integer, text text, layout jsonb)`,
      [f.documentId, batch],
    );
  }
  for (const batch of jsonBatches(f.cells)) {
    await tx.query(
      `insert into public.document_cells (document_id, sheet, row_no, col_no, raw, parsed)
       select $1::uuid, c.sheet, c.row_no, c.col_no, c.raw, c.parsed
         from jsonb_to_recordset($2::jsonb) as c(sheet text, row_no integer, col_no integer, raw text, parsed jsonb)`,
      [f.documentId, batch],
    );
  }

  const updated = await tx.query<{ id: string }>(
    `update public.documents
        set status = 'parsed', storage_bucket = $3, storage_path = $4, sha256 = $5, scan_result = $6::jsonb,
            page_count = $7
      where id = $1::uuid and org_id = $2::uuid and status = 'scanning'
  returning id`,
    [
      f.documentId,
      f.orgId,
      f.promotedBucket,
      f.promotedPath,
      f.sha256,
      JSON.stringify(f.scanResult),
      f.pageCount,
    ],
  );
  if (updated.length !== 1)
    throw new Error("document left the scanning state inside its own transaction");
  await notifyUploader(tx, f, "document_parsed", {});
  return "written";
}

/** scanning → rejected (terminal), in the caller's transaction. The object stays in quarantine. */
export async function finalizeRejected(
  tx: SqlClient,
  f: RejectedFinalization,
): Promise<FinalizeOutcome> {
  const status = await lockStatus(tx, f.documentId, f.orgId);
  if (status !== "scanning") {
    // The document was finished or discarded by something else, so its state is not this job's to change. But a
    // malware verdict on a file that may already be served must not vanish into a log line.
    if (status !== null && f.code === "malware_detected") {
      await tx.query("select app.record_security_event('scan_rejected', $1::uuid, $2::jsonb)", [
        f.orgId,
        JSON.stringify({
          document_id: f.documentId,
          reason: f.code,
          sha256: f.sha256,
          ...f.securityEvent,
          late_detection: true,
          document_status: status,
        }),
      ]);
    }
    return "skipped";
  }
  const reason = f.detail === null ? f.code : `${f.code}: ${f.detail}`;
  const updated = await tx.query<{ id: string }>(
    `update public.documents
        set status = 'rejected', rejected_reason = $3, sha256 = coalesce($4, sha256), scan_result = $5::jsonb
      where id = $1::uuid and org_id = $2::uuid and status = 'scanning'
  returning id`,
    [f.documentId, f.orgId, reason, f.sha256, JSON.stringify(f.scanResult)],
  );
  if (updated.length !== 1)
    throw new Error("document left the scanning state inside its own transaction");
  if (f.securityEvent !== null) {
    await tx.query("select app.record_security_event('scan_rejected', $1::uuid, $2::jsonb)", [
      f.orgId,
      JSON.stringify({
        document_id: f.documentId,
        reason: f.code,
        sha256: f.sha256,
        ...f.securityEvent,
      }),
    ]);
  }
  await notifyUploader(tx, f, "document_rejected", { reason: f.code });
  return "written";
}
