/**
 * The examination of one quarantined document (B-13 + B-12): download and hash → claim (`uploaded → scanning`) →
 * content check → malware scan → sandboxed parse → (images: check and scan the re-encoded copy) → promote. It runs
 * as the PREPARE stage of the fbg_documents handler (ADR-044), so no SQL transaction is open while any of it happens,
 * and it may run again for the same document after a crash or a retry — every step is repeatable: the download and
 * the scans only read, the parse is pure, the claim accepts a document already `scanning`, and the promoted object
 * is written under a key derived from the content hash with replace-on-conflict.
 *
 * The rule the whole file exists to keep: the bytes that reach a served bucket are bytes a scanner examined and
 * called clean — the upload itself, or for an image the re-encoded copy, which is scanned in its own right.
 *
 * It returns exactly one of three outcomes and has no other exit:
 *   parsed    the file passed every gate; its promoted copy exists and its pages / cells are ready to store
 *   rejected  the file itself is unacceptable (a code from errors.ts); it stays in quarantine
 *   noop      the document was discarded while it was being examined
 * Anything that is not a statement about the file — storage, scanner or sandbox not answering — throws
 * TransientDocumentError and the job is retried. There is deliberately no branch in which an unavailable scanner
 * or a crashed parser lets a document through.
 */
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import type { Logger } from "pino";
import { PermanentJobError } from "../queue/errors.js";
import {
  DocumentRejectedError,
  SECURITY_REJECT_CODES,
  TransientDocumentError,
  safeDetail,
  type RejectCode,
} from "./errors.js";
import { isBoundStoragePath, promotedFileName, type DocumentKind } from "./filename.js";
import { createWorkspace, streamToFile } from "./intake.js";
import { MAX_DOCUMENT_BYTES } from "./limits.js";
import type { CellRecord, DocumentRepo, DocumentRow, PageRecord } from "./repo.js";
import type { ValidParseResult } from "./results.js";
import { SandboxFailure, type ParserSandbox } from "./runner.js";
import { ScannerUnavailableError, type MalwareScanner, type ScanVerdict } from "./scanner.js";
import { checkContent, endsWithZipDirectory, readHeadAndTail, sniffHead } from "./sniff.js";
import { ObjectNotFoundError, StorageUnavailableError, type ObjectStore } from "./storage.js";

export const QUARANTINE_BUCKET = "quarantine";
export const SERVED_BUCKET = "documents";

const CONTENT_TYPE: Readonly<Record<DocumentKind, string>> = {
  pdf: "application/pdf",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

const CELL_TYPE = { n: "number", s: "text", b: "boolean", e: "error", d: "date" } as const;

export interface PipelineDeps {
  readonly repo: DocumentRepo;
  readonly store: ObjectStore;
  readonly scanner: MalwareScanner;
  readonly sandbox: ParserSandbox;
  /** Parent directory for per-job temporary directories (default: the OS temp directory). */
  readonly tmpRoot?: string;
  readonly now?: () => Date;
}

interface Identity {
  readonly documentId: string;
  readonly orgId: string;
  readonly uploadedBy: string | null;
}

export type DocumentOutcome =
  | { readonly outcome: "noop"; readonly status: string }
  | (Identity & {
      readonly outcome: "rejected";
      readonly code: RejectCode;
      readonly detail: string | null;
      readonly sha256: string | null;
      readonly scanResult: Readonly<Record<string, unknown>>;
      readonly securityEvent: Readonly<Record<string, unknown>> | null;
    })
  | (Identity & {
      readonly outcome: "parsed";
      readonly kind: DocumentKind;
      readonly sha256: string;
      /** Where the upload sat in quarantine; removed once `parsed` is committed. */
      readonly quarantinePath: string;
      readonly promotedPath: string;
      readonly scanResult: Readonly<Record<string, unknown>>;
      readonly pageCount: number | null;
      readonly pages: readonly PageRecord[];
      readonly cells: readonly CellRecord[];
    });

interface Evidence {
  sha256: string | null;
  bytes: number | null;
  kind: DocumentKind | null;
  scan: ScanVerdict | null;
}

function scannerSummary(scan: ScanVerdict | null): Record<string, unknown> | null {
  if (scan === null) return null;
  return {
    engine: scan.engine,
    engine_version: scan.engineVersion,
    verdict: scan.verdict,
    ...(scan.verdict === "infected" ? { signature: scan.signature } : {}),
  };
}

async function sha256OfFile(filePath: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(filePath)) hash.update(chunk as Buffer);
  return hash.digest("hex");
}

function transientFromSandbox(err: SandboxFailure): TransientDocumentError {
  switch (err.reason) {
    case "timeout":
      return new TransientDocumentError("parser_timeout");
    case "aborted":
      return new TransientDocumentError("aborted");
    case "output_invalid":
    case "output_too_large":
      return new TransientDocumentError("parser_output_invalid");
    case "spawn_failed":
      return new TransientDocumentError("parser_unavailable");
    case "crashed":
      return new TransientDocumentError("parser_crashed", err.exit ?? undefined);
  }
}

function toRecords(result: ValidParseResult): {
  pageCount: number | null;
  pages: PageRecord[];
  cells: CellRecord[];
  summary: Record<string, unknown>;
} {
  switch (result.kind) {
    case "pdf": {
      const textAvailable = !result.flags.includes("no_text_layer");
      return {
        pageCount: result.pageCount,
        pages: result.pages.map((p) => ({
          page_no: p.pageNo,
          text: p.text,
          layout: {
            v: 1,
            kind: "pdf_text",
            unit: "pt",
            origin: "bottom-left",
            width: p.width,
            height: p.height,
            rotation: p.rotation,
            items: p.items, // [x, y, width, height, text]
            items_truncated: p.itemsTruncated,
          },
        })),
        cells: [],
        summary: {
          kind: "pdf",
          page_count: result.pageCount,
          text_available: textAvailable,
          ocr: textAvailable ? "not_needed" : "unavailable",
          flags: result.flags,
        },
      };
    }
    case "sheet":
      return {
        pageCount: null,
        pages: [],
        cells: result.cells.map((c) => ({
          sheet: result.sheets[c.s]!.name,
          row_no: c.r,
          col_no: c.c,
          raw: c.v,
          parsed: {
            type: CELL_TYPE[c.t],
            ...(c.f === 1 ? { formula: true, cached: c.v !== null } : {}),
            ...(c.z === undefined ? {} : { number_format: c.z }),
            ...(c.d === undefined ? {} : { iso_date: c.d }),
          },
        })),
        summary: {
          kind: result.format,
          sheets: result.sheets.map((s) => ({
            name: s.name,
            hidden: s.hidden,
            cells: s.cellCount,
          })),
          cell_count: result.cells.length,
          text_available: result.cells.length > 0,
          ...(result.encoding === undefined ? {} : { encoding: result.encoding }),
          ...(result.delimiter === undefined ? {} : { delimiter: result.delimiter }),
          flags: result.flags,
        },
      };
    case "image":
      return {
        pageCount: 1,
        // One page record that says, in so many words, that no text was read from the picture.
        pages: [
          {
            page_no: 1,
            text: null,
            layout: {
              v: 1,
              kind: "image",
              unit: "px",
              width: result.width,
              height: result.height,
              format: result.format,
              ocr: "unavailable",
            },
          },
        ],
        cells: [],
        summary: {
          kind: "image",
          format: result.format,
          width: result.width,
          height: result.height,
          text_available: false,
          ocr: "unavailable",
          flags: result.flags,
        },
      };
  }
}

/**
 * Examines `doc` (as read by DocumentRepo.load: `uploaded`, or `scanning` from an earlier attempt). Throws TransientDocumentError for
 * infrastructure failures and PermanentJobError when the row itself is not something the worker may act on.
 */
export async function examineDocument(
  doc: DocumentRow,
  deps: PipelineDeps,
  signal: AbortSignal,
  log: Logger,
): Promise<DocumentOutcome> {
  const identity: Identity = { documentId: doc.id, orgId: doc.orgId, uploadedBy: doc.uploadedBy };
  const now = deps.now ?? (() => new Date());

  // The row was written by a signed-in user; the path in it is checked again before a service_role read uses it.
  if (
    doc.storageBucket !== QUARANTINE_BUCKET ||
    !isBoundStoragePath(doc.storagePath, doc.orgId, doc.id)
  ) {
    throw new PermanentJobError(
      "document_path_invalid",
      "the document's storage location is not its own quarantine folder",
    );
  }

  const evidence: Evidence = { sha256: null, bytes: null, kind: null, scan: null };
  const report = (extra: Record<string, unknown>): Record<string, unknown> => ({
    v: 1,
    processed_at: now().toISOString(),
    sha256: evidence.sha256,
    bytes: evidence.bytes,
    detected_kind: evidence.kind,
    scanner: scannerSummary(evidence.scan),
    isolation: deps.sandbox.isolation,
    ...extra,
  });
  const rejected = (code: RejectCode, detail: string | null): DocumentOutcome => {
    const security = SECURITY_REJECT_CODES.has(code);
    log.warn({ documentId: doc.id, reason: code }, "document rejected");
    return {
      ...identity,
      outcome: "rejected",
      code,
      detail,
      sha256: evidence.sha256,
      scanResult: report({ parse: null, promoted: null, rejection: { code, detail } }),
      securityEvent: security
        ? {
            ...(evidence.scan?.verdict === "infected"
              ? { engine: evidence.scan.engine, signature: evidence.scan.signature }
              : {}),
            ...(detail === null ? {} : { detail }),
          }
        : null,
    };
  };

  /** Scans one local file. Resolves only with a verdict the engine actually gave; anything else is transient. */
  const scan = async (filePath: string): Promise<ScanVerdict> => {
    try {
      return await deps.scanner.scanFile(filePath, signal);
    } catch (err) {
      if (err instanceof ScannerUnavailableError) {
        throw new TransientDocumentError(
          err.reason === "timeout" ? "scanner_timeout" : "scanner_unavailable",
          err.reason,
        );
      }
      throw new TransientDocumentError("scanner_unavailable", "unexpected scanner failure");
    }
  };

  const workspace = await createWorkspace(deps.tmpRoot);
  try {
    // 1. Download to a private temp file, hashing and counting what actually arrives. The document is still
    //    `uploaded` here: if its object is not there yet, nothing has changed and the upload can still happen.
    let tooLarge: DocumentRejectedError | null = null;
    try {
      const stream = await deps.store.download(QUARANTINE_BUCKET, doc.storagePath, signal);
      const intake = await streamToFile(stream, workspace.inputPath, MAX_DOCUMENT_BYTES, signal);
      evidence.sha256 = intake.sha256;
      evidence.bytes = intake.bytes;
    } catch (err) {
      if (err instanceof ObjectNotFoundError) throw new TransientDocumentError("object_missing");
      if (err instanceof StorageUnavailableError) {
        throw new TransientDocumentError("storage_unavailable", "download");
      }
      if (!(err instanceof DocumentRejectedError)) throw err;
      tooLarge = err;
    }

    // 2. Claim it: uploaded → scanning. From here the object can no longer be supplied or replaced by its owner,
    //    and every outcome below ends in `parsed`, `rejected`, or a retry that finds it `scanning` again.
    if (!(await deps.repo.markScanning(doc.id, doc.orgId))) {
      const status = (await deps.repo.status(doc.id, doc.orgId)) ?? "missing";
      log.info({ documentId: doc.id, status }, "document no longer awaiting a scan; nothing to do");
      return { outcome: "noop", status };
    }
    if (tooLarge !== null) return rejected(tooLarge.code, tooLarge.detail);
    if (evidence.sha256 === null || evidence.bytes === null) {
      throw new TransientDocumentError("storage_unavailable", "download");
    }
    if (evidence.bytes !== doc.bytes) {
      return rejected("size_mismatch", `declared ${doc.bytes} bytes, stored ${evidence.bytes}`);
    }

    // 3. Declared type ↔ extension ↔ magic bytes, and the polyglot check.
    let kind: DocumentKind;
    try {
      const { head, tail } = await readHeadAndTail(workspace.inputPath, evidence.bytes);
      kind = checkContent({
        declaredMime: doc.mime,
        originalFilename: doc.originalFilename,
        head,
        tail,
        size: evidence.bytes,
      });
    } catch (err) {
      if (err instanceof DocumentRejectedError) return rejected(err.code, err.detail);
      throw err;
    }
    evidence.kind = kind;

    // 4. Malware scan. No verdict → no progress; and only the word "clean" lets a file continue.
    evidence.scan = await scan(workspace.inputPath);
    if (evidence.scan.verdict === "infected") return rejected("malware_detected", null);
    if (evidence.scan.verdict !== "clean") {
      throw new TransientDocumentError("scanner_unavailable", "no verdict");
    }

    // 5. Parse in the sandbox. Only a completed protocol counts; a kill or a crash is not a verdict.
    const image = kind === "jpeg" || kind === "png" || kind === "webp";
    let result: ValidParseResult;
    try {
      const response = await deps.sandbox.parse(
        kind,
        workspace.inputPath,
        image ? workspace.outputPath : null,
        signal,
      );
      if (!response.ok) return rejected(response.code, safeDetail(response.detail ?? undefined));
      result = response.result;
    } catch (err) {
      if (err instanceof SandboxFailure) throw transientFromSandbox(err);
      throw err;
    }

    // 6. What gets promoted: the scanned upload itself — or, for an image, its re-encoded copy. That copy was
    //    written by the sandbox (native decoder code), so it is a new untrusted file: it must look like the image
    //    it claims to be, and it gets its own scan. Nothing reaches a served bucket that a scanner did not pass.
    let promotedFile = workspace.inputPath;
    let promotedSha = evidence.sha256;
    let promotedBytes = evidence.bytes;
    let promotedScan: ScanVerdict | null = null;
    if (result.kind === "image") {
      const written = await stat(workspace.outputPath).catch(() => null);
      if (
        written === null ||
        !written.isFile() ||
        written.size !== result.outputBytes ||
        written.size > MAX_DOCUMENT_BYTES
      ) {
        throw new TransientDocumentError(
          "parser_output_invalid",
          "re-encoded image missing or wrong size",
        );
      }
      const { head, tail } = await readHeadAndTail(workspace.outputPath, written.size);
      if (sniffHead(head) !== kind || endsWithZipDirectory(tail)) {
        throw new TransientDocumentError(
          "parser_output_invalid",
          "re-encoded file is not the expected image",
        );
      }
      promotedScan = await scan(workspace.outputPath);
      if (promotedScan.verdict !== "clean") {
        // An image whose re-encoding trips the scanner: refuse the document, and keep both verdicts on record.
        evidence.scan = promotedScan;
        return rejected("malware_detected", "re-encoded copy");
      }
      promotedFile = workspace.outputPath;
      promotedSha = await sha256OfFile(workspace.outputPath);
      promotedBytes = written.size;
    }
    const records = toRecords(result);

    // 7. Discarded meanwhile? Then nothing is promoted.
    const status = await deps.repo.status(doc.id, doc.orgId);
    if (status !== "scanning") {
      log.info(
        { documentId: doc.id, status },
        "document left scanning during processing; nothing promoted",
      );
      return { outcome: "noop", status: status ?? "missing" };
    }

    // 8. Promote by uploading the local file that was scanned (not by copying the quarantine object), so there is
    //    no window in which the promoted bytes could differ from the scanned ones.
    const promotedPath = `${doc.orgId}/${doc.id}/${promotedFileName(evidence.sha256, doc.originalFilename, kind)}`;
    try {
      await deps.store.upload(
        SERVED_BUCKET,
        promotedPath,
        promotedFile,
        CONTENT_TYPE[kind],
        signal,
      );
    } catch (err) {
      if (err instanceof StorageUnavailableError) {
        throw new TransientDocumentError("storage_unavailable", "promotion");
      }
      throw err;
    }

    log.info(
      { documentId: doc.id, kind, pages: records.pages.length, cells: records.cells.length },
      "document examined and promoted",
    );
    return {
      ...identity,
      outcome: "parsed",
      kind,
      sha256: evidence.sha256,
      quarantinePath: doc.storagePath,
      promotedPath,
      scanResult: report({
        parse: records.summary,
        promoted: {
          bucket: SERVED_BUCKET,
          path: promotedPath,
          sha256: promotedSha,
          bytes: promotedBytes,
          reencoded: result.kind === "image",
          // for a re-encoded image: the verdict on the copy that is actually served
          ...(promotedScan === null ? {} : { scanner: scannerSummary(promotedScan) }),
        },
        rejection: null,
      }),
      pageCount: records.pageCount,
      pages: records.pages,
      cells: records.cells,
    };
  } finally {
    await workspace.dispose().catch(() => {
      // quarantined bytes left on the worker's disk are worth knowing about; the path itself is not logged
      log.warn({ documentId: doc.id }, "temporary workspace could not be removed");
    });
  }
}
