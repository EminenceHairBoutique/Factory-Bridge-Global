/**
 * Content sniffing (B-13 step 1): what a file IS, decided from its bytes, and whether that agrees with what the
 * upload claimed (declared MIME type and file extension). All three must agree, and the type must be on the allow
 * list of docs/SECURITY.md §4 — PDF, JPEG, PNG, WebP, XLSX, CSV. Everything else (archives, HTML, SVG, legacy
 * Office, executables, scripts) is refused by construction: there is no code path that accepts it.
 *
 * This is validation, not malware scanning. It never decides a file is safe; it only decides a file is not what it
 * says it is. The scanner (scanner.ts) and the parser sandbox run after it.
 */
import { open } from "node:fs/promises";
import { DocumentRejectedError } from "./errors.js";
import { extensionOf, type DocumentKind } from "./filename.js";

export const ALLOWED_MIME: Readonly<Record<string, DocumentKind>> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpeg",
  "image/png": "png",
  "image/webp": "webp",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "text/csv": "csv",
};

const EXTENSIONS: Readonly<Record<DocumentKind, readonly string[]>> = {
  pdf: ["pdf"],
  jpeg: ["jpg", "jpeg"],
  png: ["png"],
  webp: ["webp"],
  xlsx: ["xlsx"],
  csv: ["csv"],
};

/** What the leading bytes say. "text" means "no binary signature and it reads as text". */
export type SniffedType =
  | "pdf"
  | "jpeg"
  | "png"
  | "webp"
  | "zip"
  | "ole2"
  | "gif"
  | "bmp"
  | "tiff"
  | "gzip"
  | "rar"
  | "7z"
  | "executable"
  | "markup"
  | "rtf"
  | "postscript"
  | "text"
  | "binary";

export const HEAD_BYTES = 4096;
/** Enough of the tail to see a ZIP end-of-central-directory record with a maximal comment. */
export const TAIL_BYTES = 22 + 0xffff;

const startsWith = (buf: Buffer, bytes: readonly number[], at = 0): boolean =>
  buf.length >= at + bytes.length && bytes.every((b, i) => buf[at + i] === b);

export function sniffHead(head: Buffer): SniffedType {
  if (startsWith(head, [0x25, 0x50, 0x44, 0x46, 0x2d])) return "pdf"; // %PDF-
  if (startsWith(head, [0xff, 0xd8, 0xff])) return "jpeg";
  if (startsWith(head, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png";
  if (startsWith(head, [0x52, 0x49, 0x46, 0x46]) && startsWith(head, [0x57, 0x45, 0x42, 0x50], 8)) {
    return "webp";
  }
  if (startsWith(head, [0x50, 0x4b, 0x03, 0x04]) || startsWith(head, [0x50, 0x4b, 0x05, 0x06])) {
    return "zip";
  }
  if (startsWith(head, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) return "ole2"; // .xls/.doc, encrypted OOXML
  if (startsWith(head, [0x47, 0x49, 0x46, 0x38])) return "gif";
  // Two-letter signatures also begin ordinary text ("BM-200,…", "MZ…"), so they need their binary header too.
  const hasEarlyNul = head.subarray(0, 64).includes(0x00);
  if (startsWith(head, [0x42, 0x4d]) && startsWith(head, [0x00, 0x00, 0x00, 0x00], 6)) return "bmp";
  if (startsWith(head, [0x49, 0x49, 0x2a, 0x00]) || startsWith(head, [0x4d, 0x4d, 0x00, 0x2a])) {
    return "tiff";
  }
  if (startsWith(head, [0x1f, 0x8b])) return "gzip";
  if (startsWith(head, [0x52, 0x61, 0x72, 0x21])) return "rar";
  if (startsWith(head, [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c])) return "7z";
  if (
    (startsWith(head, [0x4d, 0x5a]) && hasEarlyNul) || // MZ (PE)
    startsWith(head, [0x7f, 0x45, 0x4c, 0x46]) || // ELF
    startsWith(head, [0xcf, 0xfa, 0xed, 0xfe]) || // Mach-O
    startsWith(head, [0xca, 0xfe, 0xba, 0xbe]) || // Mach-O fat / Java class
    startsWith(head, [0x23, 0x21]) // #! script
  ) {
    return "executable";
  }
  if (startsWith(head, [0x7b, 0x5c, 0x72, 0x74, 0x66])) return "rtf"; // {\rtf
  if (startsWith(head, [0x25, 0x21])) return "postscript"; // %!

  // Text-like? A UTF-16 byte-order mark makes NUL bytes legitimate; otherwise any NUL means binary.
  const utf16 = startsWith(head, [0xff, 0xfe]) || startsWith(head, [0xfe, 0xff]);
  let control = 0;
  for (const byte of head) {
    if (byte === 0x00 && !utf16) return "binary";
    if (byte < 0x09 || (byte > 0x0d && byte < 0x20 && byte !== 0x1b)) control++;
  }
  if (!utf16 && control > head.length / 100) return "binary";
  const lead = head
    .subarray(startsWith(head, [0xef, 0xbb, 0xbf]) ? 3 : 0, 512)
    .toString("latin1")
    .replaceAll(utf16 ? "\u0000" : "￿", "") // UTF-16 text: drop the interleaved zero bytes
    .replace(/^[ÿþ]{2}/, "") // …and its byte-order mark
    .trimStart()
    .toLowerCase();
  if (lead.startsWith("<")) return "markup"; // HTML, SVG, XML
  return "text";
}

/** True when the tail ends in a ZIP end-of-central-directory record: most unzip tools would open the file. */
export function endsWithZipDirectory(tail: Buffer): boolean {
  for (let i = tail.length - 22; i >= 0; i--) {
    if (tail.readUInt32LE(i) !== 0x06054b50) continue;
    // A plausible end-of-central-directory record anywhere in the tail, not only one that ends exactly at the end
    // of the file: unzip tools tolerate trailing bytes, so one stray byte must not be a way around this check.
    const entriesHere = tail.readUInt16LE(i + 8);
    const entriesTotal = tail.readUInt16LE(i + 10);
    const commentLength = tail.readUInt16LE(i + 20);
    if (entriesHere === entriesTotal && entriesTotal > 0 && i + 22 + commentLength <= tail.length) {
      return true;
    }
  }
  return false;
}

export interface ContentCheckInput {
  /** documents.mime — what the upload claimed. */
  readonly declaredMime: string;
  /** documents.original_filename — untrusted. */
  readonly originalFilename: string;
  readonly head: Buffer;
  readonly tail: Buffer;
  readonly size: number;
}

/**
 * Declared MIME ↔ extension ↔ magic bytes. Returns the kind to parse as, or throws DocumentRejectedError.
 * The detail names types only (what was claimed, what was found) — never the file name or any content.
 */
export function checkContent(input: ContentCheckInput): DocumentKind {
  if (input.size === 0 || input.head.length === 0) throw new DocumentRejectedError("empty_file");
  const kind = ALLOWED_MIME[input.declaredMime];
  if (kind === undefined)
    throw new DocumentRejectedError("unsupported_type", "declared type not allowed");

  const ext = extensionOf(input.originalFilename);
  if (!EXTENSIONS[kind].includes(ext)) {
    throw new DocumentRejectedError("extension_mismatch", `declared ${kind}`);
  }

  const sniffed = sniffHead(input.head);
  const expected: SniffedType = kind === "xlsx" ? "zip" : kind === "csv" ? "text" : kind;
  if (sniffed !== expected) {
    throw new DocumentRejectedError("type_mismatch", `declared ${kind}, content is ${sniffed}`);
  }
  // A PDF or image that is also a valid ZIP is a polyglot: one file, two meanings, depending on who opens it.
  if (kind !== "xlsx" && endsWithZipDirectory(input.tail)) {
    throw new DocumentRejectedError("polyglot_suspected", `${kind} that is also a zip archive`);
  }
  return kind;
}

/** Reads the head and tail windows of a file on disk for checkContent(). */
export async function readHeadAndTail(
  path: string,
  size: number,
): Promise<{ head: Buffer; tail: Buffer }> {
  const handle = await open(path, "r");
  try {
    const headLength = Math.min(HEAD_BYTES, size);
    const head = Buffer.alloc(headLength);
    await handle.read(head, 0, headLength, 0);
    const tailLength = Math.min(TAIL_BYTES, size);
    const tail = Buffer.alloc(tailLength);
    await handle.read(tail, 0, tailLength, size - tailLength);
    return { head, tail };
  } finally {
    await handle.close();
  }
}
