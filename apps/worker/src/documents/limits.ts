/**
 * Hard limits for untrusted documents (docs/SECURITY.md §4). The database repeats the ones it can express
 * (25 MB, 500 pages, cell coordinates); everything else exists only here and is passed to the parser sandbox with
 * each request, so the sandbox has no limits of its own to drift.
 */
import type { SandboxLimits } from "./sandbox/protocol.mts";

export const MAX_DOCUMENT_BYTES = 26_214_400; // 25 MB — documents.bytes CHECK and the bucket file_size_limit
export const MAX_PDF_PAGES = 500; // documents.page_count CHECK
export const MAX_SHEET_CELLS = 50_000;

export const DEFAULT_SANDBOX_LIMITS: SandboxLimits = {
  maxInputBytes: MAX_DOCUMENT_BYTES,
  maxPdfPages: MAX_PDF_PAGES,
  maxCells: MAX_SHEET_CELLS,
  maxSheets: 200,
  maxCellChars: 32_767, // Excel's own per-cell ceiling
  maxTextChars: 8_000_000, // all page text of one PDF
  maxLayoutItems: 100_000, // all positioned text runs of one PDF
  maxZipEntries: 2_000,
  maxZipEntryBytes: 64 * 1024 * 1024, // one inflated part
  maxZipInflatedBytes: 128 * 1024 * 1024, // every part the reader inflates, together
  maxImagePixels: 64_000_000,
  maxOutputBytes: MAX_DOCUMENT_BYTES, // a re-encoded image must still fit the bucket limit
  // The whole JSON answer of one parse. Text is capped at 8 M characters, but JSON escaping can multiply that
  // (a control character becomes six), so the serialized size has its own ceiling — below the runner's stdout cap.
  maxResponseChars: 48 * 1024 * 1024,
};

/** V8 heap ceiling of the parser child, in MB. Off-heap buffers are bounded by the limits above, not by this. */
export const DEFAULT_PARSER_HEAP_MB = 512;
