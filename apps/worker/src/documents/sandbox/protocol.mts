/**
 * The contract between the worker and its parser sandbox (B-12).
 *
 * Everything under `documents/sandbox/` runs in a separate, restricted Node process (see runner.ts) and may import
 * only Node built-ins, the two parser libraries it is handed by absolute URL, and its sibling `.mts` files. These
 * files use erasable TypeScript only (no enums, no parameter properties) so the same sources run under Node's type
 * stripping in development and tests and as compiled `.mjs` in a build.
 *
 * The worker treats every byte the sandbox returns as untrusted: results.ts re-validates the whole response.
 */

export interface SandboxLimits {
  readonly maxInputBytes: number;
  readonly maxPdfPages: number;
  readonly maxCells: number;
  readonly maxSheets: number;
  readonly maxCellChars: number;
  readonly maxTextChars: number;
  readonly maxLayoutItems: number;
  readonly maxZipEntries: number;
  readonly maxZipEntryBytes: number;
  readonly maxZipInflatedBytes: number;
  readonly maxImagePixels: number;
  readonly maxOutputBytes: number;
  /** Ceiling on the serialized response; a result that would exceed it is refused as `output_too_large`. */
  readonly maxResponseChars: number;
}

export type ParseKind = "pdf" | "xlsx" | "csv" | "jpeg" | "png" | "webp";

export interface ParseRequest {
  readonly op: "parse";
  readonly kind: ParseKind;
  readonly inputPath: string;
  /** Where a re-encoded image is written; the only path the process may write. Null for every other kind. */
  readonly outputPath: string | null;
  readonly limits: SandboxLimits;
  readonly modules: SandboxModules;
}

export interface SandboxModules {
  /** file:// URL of pdfjs-dist/legacy/build/pdf.mjs, or null when the request does not need it. */
  readonly pdfjsUrl: string | null;
  /** Directory of the pdfjs-dist package (CMaps and standard fonts are read from it), with a trailing separator. */
  readonly pdfjsDir: string | null;
  /** file:// URL of sharp's entry point, or null. */
  readonly sharpUrl: string | null;
}

/** Containment self-test: the child tries what it must not be able to do and reports what happened. */
export interface ProbeRequest {
  readonly op: "probe";
  /** A file outside every allowed directory; reading it must fail. */
  readonly forbiddenReadPath: string;
  /** A path the process was not allowed to write; creating it must fail. */
  readonly forbiddenWritePath: string;
  /** A loopback TCP port the parent listens on; connecting must fail. */
  readonly tcpPort: number;
  /** Name of an environment variable the parent holds; it must not be visible. */
  readonly secretEnvName: string;
}

export type SandboxRequest = ParseRequest | ProbeRequest;

export type ProbeOutcome = "denied" | "allowed";

export interface ProbeResult {
  readonly fsRead: ProbeOutcome;
  readonly fsWrite: ProbeOutcome;
  readonly childProcess: ProbeOutcome;
  readonly workerThread: ProbeOutcome;
  readonly netFetch: ProbeOutcome;
  readonly netTcp: ProbeOutcome;
  readonly netUdp: ProbeOutcome;
  readonly netDns: ProbeOutcome;
  readonly codeGeneration: ProbeOutcome;
  /** True when the named secret (or anything else of the parent's environment that matters) reached the child. */
  readonly secretVisible: boolean;
  readonly envNames: readonly string[];
  readonly permissionModel: boolean;
  readonly nodeVersion: string;
  readonly platform: string;
}

/** Codes the sandbox may return; a subset of the worker's RejectCode (errors.ts). */
export type SandboxRejectCode =
  | "corrupt_file"
  | "encrypted_file"
  | "macro_enabled"
  | "zip_bomb"
  | "too_many_pages"
  | "too_many_cells"
  | "unsupported_structure"
  | "unsupported_encoding"
  | "type_mismatch"
  | "image_too_large"
  | "output_too_large"
  | "too_large";

/** One positioned run of text on a PDF page, in PDF user space (origin bottom-left): [x, y, width, height, text]. */
export type PdfTextItem = readonly [number, number, number, number, string];

export interface PdfPage {
  readonly pageNo: number;
  readonly width: number;
  readonly height: number;
  readonly rotation: number;
  readonly text: string;
  readonly items: readonly PdfTextItem[];
  /** True when the page had more runs than the layout budget allowed; `text` is still complete. */
  readonly itemsTruncated: boolean;
}

export interface PdfResult {
  readonly kind: "pdf";
  readonly pageCount: number;
  readonly pages: readonly PdfPage[];
  readonly flags: readonly string[];
}

export interface SheetMeta {
  readonly name: string;
  readonly hidden: boolean;
  readonly cellCount: number;
}

/**
 * One spreadsheet cell.
 *  s  index into `sheets`
 *  r  1-based row, c 1-based column — the source anchor
 *  v  the cached value exactly as the file stores it (a shared string resolved to its text); null when a formula has
 *     no cached result
 *  t  n number · s text · b boolean · e error · d ISO date text
 *  f  1 when the cell holds a formula (never evaluated: `v` is the cached result the file carries)
 *  z  the number format code, when the cell has a non-General one
 *  d  ISO date/time derived from a numeric cell with a date format (deterministic serial conversion)
 */
export interface SheetCell {
  readonly s: number;
  readonly r: number;
  readonly c: number;
  readonly v: string | null;
  readonly t: "n" | "s" | "b" | "e" | "d";
  readonly f?: 1;
  readonly z?: string;
  readonly d?: string;
}

export interface SheetResult {
  readonly kind: "sheet";
  readonly format: "xlsx" | "csv";
  readonly sheets: readonly SheetMeta[];
  readonly cells: readonly SheetCell[];
  readonly flags: readonly string[];
  /** CSV only: the encoding and delimiter that were detected. */
  readonly encoding?: string;
  readonly delimiter?: string;
}

export interface ImageResult {
  readonly kind: "image";
  readonly format: "jpeg" | "png" | "webp";
  readonly width: number;
  readonly height: number;
  /** Size of the re-encoded file written to `outputPath`. */
  readonly outputBytes: number;
  readonly flags: readonly string[];
}

export type ParseResult = PdfResult | SheetResult | ImageResult;

export type SandboxResponse =
  | { readonly ok: true; readonly result: ParseResult }
  | { readonly ok: true; readonly probe: ProbeResult }
  | { readonly ok: false; readonly code: SandboxRejectCode; readonly detail: string | null };

/** Thrown inside the sandbox for a file the parser refuses; child.mts turns it into `{ ok: false, … }`. */
export class SandboxReject extends Error {
  readonly code: SandboxRejectCode;
  readonly detail: string | null;
  constructor(code: SandboxRejectCode, detail?: string) {
    super(detail === undefined ? code : `${code}: ${detail}`);
    this.name = "SandboxReject";
    this.code = code;
    this.detail = detail ?? null;
  }
}

/** Exit code of a child that finished its protocol (accepted or rejected the file). Anything else is a crash. */
export const SANDBOX_EXIT_OK = 0;
