/**
 * Error taxonomy of the document pipeline (B-12 / B-13). Three outcomes, never mixed:
 *
 *  - DocumentRejectedError — the FILE is unacceptable (wrong type, too large, malware, corrupt, macro, bomb). Terminal
 *    for the document: it becomes `rejected` with this code and stays in quarantine. The job itself succeeds, because
 *    rejecting is the correct, final result of processing it.
 *  - TransientDocumentError — the INFRASTRUCTURE could not answer (storage down, scanner unreachable or timed out,
 *    parser sandbox killed). Never a verdict about the file: the consumer retries with backoff and finally files a
 *    dead letter, and the document stays `scanning` in quarantine. A scanner that cannot answer is never "clean".
 *  - PermanentJobError (queue/errors.ts) — the MESSAGE is unacceptable (bad payload, unknown document, organization
 *    mismatch). Dead-lettered on the first attempt; no document is touched.
 *
 * `detail` is a short machine-written fragment (a limit, a count, a format name). It never carries file contents,
 * file names, extracted text or prices: it is stored in `documents.rejected_reason` and in dead letters.
 */

export const REJECT_CODES = [
  "too_large",
  "size_mismatch",
  "empty_file",
  "unsupported_type",
  "type_mismatch",
  "extension_mismatch",
  "polyglot_suspected",
  "malware_detected",
  "corrupt_file",
  "encrypted_file",
  "macro_enabled",
  "zip_bomb",
  "too_many_pages",
  "too_many_cells",
  "unsupported_structure",
  "unsupported_encoding",
  "image_too_large",
  "output_too_large",
] as const;

export type RejectCode = (typeof REJECT_CODES)[number];

/** Rejections that are security signals, recorded in `security_events` (kind `scan_rejected`) as well. */
export const SECURITY_REJECT_CODES: ReadonlySet<RejectCode> = new Set<RejectCode>([
  "malware_detected",
  "polyglot_suspected",
  "type_mismatch",
  "extension_mismatch",
  "macro_enabled",
  "zip_bomb",
]);

// Letters, digits and a little punctuation: enough for "600 pages, limit 500", and no markup, quotes or slashes.
const DETAIL = /^[A-Za-z0-9 _.,:-]{0,120}$/;

/** Keeps a detail only when it is plainly machine-written; anything else is dropped rather than stored. */
export function safeDetail(detail: string | undefined): string | null {
  if (detail === undefined || detail === "") return null;
  return DETAIL.test(detail) ? detail : null;
}

export class DocumentRejectedError extends Error {
  readonly code: RejectCode;
  readonly detail: string | null;
  constructor(code: RejectCode, detail?: string) {
    const safe = safeDetail(detail);
    super(safe === null ? code : `${code}: ${safe}`);
    this.name = "DocumentRejectedError";
    this.code = code;
    this.detail = safe;
  }
}

export const TRANSIENT_CODES = [
  "storage_unavailable",
  "object_missing",
  "scanner_unavailable",
  "scanner_timeout",
  "parser_unavailable",
  "parser_timeout",
  "parser_crashed",
  "parser_output_invalid",
  "aborted",
] as const;

export type TransientCode = (typeof TRANSIENT_CODES)[number];

export class TransientDocumentError extends Error {
  readonly code: TransientCode;
  constructor(code: TransientCode, detail?: string) {
    const safe = safeDetail(detail);
    super(safe === null ? code : `${code}: ${safe}`);
    this.name = "TransientDocumentError";
    this.code = code;
  }
}
