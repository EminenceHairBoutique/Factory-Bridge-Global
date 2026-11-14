/**
 * CSV → cells (sandbox side). RFC 4180 quoting, a detected delimiter, and a detected encoding (UTF-8, UTF-16 with a
 * byte-order mark, or GB18030 — the usual encoding of spreadsheets exported on Chinese Windows). Every field stays
 * text exactly as written: nothing is typed, trimmed, calculated or interpreted. A field that looks like a formula
 * (`=…`, `@…`) is still just text and is flagged, because a spreadsheet program would run it if someone opened the
 * raw file.
 */
import { readFileSync } from "node:fs";
import {
  SandboxReject,
  type SandboxLimits,
  type SheetCell,
  type SheetResult,
} from "./protocol.mts";

const MAX_ROW = 1_048_576;
const MAX_COL = 16_384;
const DELIMITERS = [",", "\t", ";", "|"] as const;
const SIGNED_NUMBER = /^[+-](?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?%?$/;

export function decodeCsv(bytes: Buffer): { text: string; encoding: string } {
  const attempt = (label: string, input: Uint8Array): string | null => {
    try {
      return new TextDecoder(label, { fatal: true }).decode(input);
    } catch {
      return null;
    }
  };
  let text: string | null;
  let encoding: string;
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    [text, encoding] = [attempt("utf-8", bytes.subarray(3)), "utf-8"];
  } else if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    [text, encoding] = [attempt("utf-16le", bytes.subarray(2)), "utf-16le"];
  } else if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    [text, encoding] = [attempt("utf-16be", bytes.subarray(2)), "utf-16be"];
  } else {
    [text, encoding] = [attempt("utf-8", bytes), "utf-8"];
    if (text === null) [text, encoding] = [attempt("gb18030", bytes), "gb18030"];
  }
  if (text === null) throw new SandboxReject("unsupported_encoding");
  if (text.includes("\u0000")) throw new SandboxReject("corrupt_file", "binary data in text file");
  return { text, encoding };
}

/** The delimiter that splits the first lines most consistently; comma when nothing else clearly wins. */
export function detectDelimiter(text: string): string {
  const sample = text.slice(0, 64 * 1024);
  let best = ",";
  let bestScore = 0;
  for (const delimiter of DELIMITERS) {
    const counts: number[] = [];
    let inQuotes = false;
    let n = 0;
    for (let i = 0; i < sample.length && counts.length < 20; i++) {
      const ch = sample[i]!;
      if (ch === '"') inQuotes = !inQuotes;
      else if (!inQuotes && ch === delimiter) n++;
      else if (!inQuotes && (ch === "\n" || ch === "\r")) {
        if (ch === "\r" && sample[i + 1] === "\n") i++;
        counts.push(n);
        n = 0;
      }
    }
    if (n > 0 || counts.length === 0) counts.push(n);
    const withDelimiter = counts.filter((c) => c > 0);
    if (withDelimiter.length === 0) continue;
    const mode = withDelimiter.sort((a, b) => a - b)[Math.floor(withDelimiter.length / 2)]!;
    const consistent = withDelimiter.filter((c) => c === mode).length;
    const score = consistent * mode;
    if (score > bestScore) {
      bestScore = score;
      best = delimiter;
    }
  }
  return best;
}

export function parseCsvText(
  text: string,
  delimiter: string,
  limits: SandboxLimits,
): { cells: SheetCell[]; formulaLike: boolean } {
  const cells: SheetCell[] = [];
  let formulaLike = false;
  let totalChars = 0;
  let row = 1;
  let col = 1;
  let field = "";
  let inQuotes = false;
  let quoted = false;

  const endField = (): void => {
    if (field !== "") {
      if (col > MAX_COL) throw new SandboxReject("unsupported_structure", "too many columns");
      // What a spreadsheet program would treat as a formula if someone opened the raw file: =, @, a leading tab or
      // carriage return, and + or - unless the field is simply a signed number. Quoted or not makes no difference.
      if (/^[=@\t\r]/.test(field) || (/^[+-]/.test(field) && !SIGNED_NUMBER.test(field))) {
        formulaLike = true;
      }
      totalChars += field.length;
      if (totalChars > limits.maxTextChars) {
        throw new SandboxReject(
          "output_too_large",
          `more than ${limits.maxTextChars} characters of cell text`,
        );
      }
      cells.push({ s: 0, r: row, c: col, v: field, t: "s" });
      if (cells.length > limits.maxCells) {
        throw new SandboxReject("too_many_cells", `more than ${limits.maxCells} cells`);
      }
    }
    field = "";
    quoted = false;
    col++;
  };
  const endRow = (): void => {
    endField();
    row++;
    col = 1;
    if (row > MAX_ROW) throw new SandboxReject("unsupported_structure", "too many rows");
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += ch;
    } else if (ch === '"' && field === "" && !quoted) {
      inQuotes = true;
      quoted = true;
    } else if (ch === delimiter) {
      endField();
    } else if (ch === "\n") {
      endRow();
    } else if (ch === "\r") {
      if (text[i + 1] === "\n") i++;
      endRow();
    } else field += ch;
    if (field.length > limits.maxCellChars) {
      throw new SandboxReject("unsupported_structure", "field longer than a cell can hold");
    }
  }
  if (inQuotes) throw new SandboxReject("corrupt_file", "unterminated quoted field");
  endField();
  return { cells, formulaLike };
}

export function parseCsvBuffer(bytes: Buffer, limits: SandboxLimits): SheetResult {
  const { text, encoding } = decodeCsv(bytes);
  const delimiter = detectDelimiter(text);
  const { cells, formulaLike } = parseCsvText(text, delimiter, limits);
  const flags: string[] = [];
  if (formulaLike) flags.push("formula_like_text");
  return {
    kind: "sheet",
    format: "csv",
    sheets: [{ name: "csv", hidden: false, cellCount: cells.length }],
    cells,
    flags,
    encoding,
    delimiter: delimiter === "\t" ? "tab" : delimiter,
  };
}

export function parseCsvFile(path: string, limits: SandboxLimits): SheetResult {
  return parseCsvBuffer(readFileSync(path), limits);
}
