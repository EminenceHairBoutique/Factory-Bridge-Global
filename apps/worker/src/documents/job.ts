/**
 * The `fbg_documents` job contract (B-12 / B-13). This is the interface the upload path (B-05 follow-up) produces
 * against; see docs/reports/2026-11-14_B12_B13_SECURE_DOCUMENT_PIPELINE_REPORT.md §7 for the full hand-off.
 *
 *   queue    fbg_documents
 *   message  { "v": 1, "type": "document.process",
 *              "idempotency_key": "document.process:<document_id>:v1",
 *              "payload": { "document_id": "<uuid>", "org_id": "<uuid>" } }
 *
 * The message carries two ids and nothing else — no path, no file name, no MIME type, no size. Everything the worker
 * acts on is read from the `documents` row, and `org_id` is only an assertion that must match that row: a message
 * naming organization A cannot make the worker touch a document of organization B.
 *
 * The idempotency key is fixed by the document id, so the ledger makes concurrent or repeated deliveries for one
 * document collapse into one run. Re-queuing after a dead letter uses the `:rq<n>` suffix (ADR-041 §7).
 */
import { z } from "zod";

export const DOCUMENTS_QUEUE = "fbg_documents";
export const DOCUMENT_PROCESS = "document.process";

export const documentJobPayload = z.strictObject({
  document_id: z.uuid(),
  org_id: z.uuid(),
});

export type DocumentJobPayload = z.infer<typeof documentJobPayload>;

export function documentJobKey(documentId: string, requeue = 0): string {
  if (!Number.isInteger(requeue) || requeue < 0 || requeue > 9999) {
    throw new Error("requeue must be an integer between 0 and 9999");
  }
  return `${DOCUMENT_PROCESS}:${documentId.toLowerCase()}:v1${requeue === 0 ? "" : `:rq${requeue}`}`;
}

/** True when `key` is the canonical key (or a re-queue of it) for exactly this document. */
export function isDocumentJobKey(key: string, documentId: string): boolean {
  const prefix = `${DOCUMENT_PROCESS}:${documentId.toLowerCase()}:v1`;
  if (!key.startsWith(prefix)) return false;
  const rest = key.slice(prefix.length);
  return rest === "" || /^:rq[1-9][0-9]{0,3}$/.test(rest);
}
