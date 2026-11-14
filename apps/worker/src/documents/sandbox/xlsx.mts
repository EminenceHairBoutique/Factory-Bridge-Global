/**
 * XLSX → cells (sandbox side). Reads the package with zip.mts and xml.mts and returns every non-empty cell with its
 * sheet / row / column anchor and the value the file itself stores.
 *
 * There is no formula engine anywhere in this code path. A formula cell contributes the cached result that Excel
 * (or whichever program saved the file) wrote next to it; when no cached result is present the value is null and the
 * document is flagged — nothing is ever calculated. Macros are refused, external links are never followed, embedded
 * objects are never opened.
 */
import { readFileSync } from "node:fs";
import {
  SandboxReject,
  type SandboxLimits,
  type SheetCell,
  type SheetMeta,
  type SheetResult,
} from "./protocol.mts";
import { attrByLocalName, decodeXml, tokenize } from "./xml.mts";
import { ZipArchive } from "./zip.mts";

const WORKBOOK_MAIN = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml";
const WORKSHEET_REL = /\/relationships\/worksheet$/;
const MAX_ROW = 1_048_576;
const MAX_COL = 16_384;
const MAX_SHEET_NAME = 64; // documents_cells.sheet CHECK; Excel itself stops at 31

/** Built-in number formats that matter for typing (ECMA-376 §18.8.30, plus the zh-CN/zh-TW date slots). */
const BUILTIN_FORMATS: Readonly<Record<number, string>> = {
  0: "General",
  1: "0",
  2: "0.00",
  3: "#,##0",
  4: "#,##0.00",
  9: "0%",
  10: "0.00%",
  11: "0.00E+00",
  12: "# ?/?",
  13: "# ??/??",
  14: "m/d/yyyy",
  15: "d-mmm-yy",
  16: "d-mmm",
  17: "mmm-yy",
  18: "h:mm AM/PM",
  19: "h:mm:ss AM/PM",
  20: "h:mm",
  21: "h:mm:ss",
  22: "m/d/yyyy h:mm",
  27: 'yyyy"年"m"月"',
  28: 'm"月"d"日"',
  29: 'm"月"d"日"',
  30: "m-d-yy",
  31: 'yyyy"年"m"月"d"日"',
  32: 'h"时"mm"分"',
  33: 'h"时"mm"分"ss"秒"',
  34: 'AM/PM h"时"mm"分"',
  35: 'AM/PM h"时"mm"分"ss"秒"',
  36: 'yyyy"年"m"月"',
  37: "#,##0 ;(#,##0)",
  38: "#,##0 ;[Red](#,##0)",
  39: "#,##0.00;(#,##0.00)",
  40: "#,##0.00;[Red](#,##0.00)",
  45: "mm:ss",
  46: "[h]:mm:ss",
  47: "mmss.0",
  48: "##0.0E+0",
  49: "@",
  50: 'yyyy"年"m"月"',
  51: 'm"月"d"日"',
  52: 'yyyy"年"m"月"',
  53: 'm"月"d"日"',
  54: 'm"月"d"日"',
  55: 'AM/PM h"时"mm"分"',
  56: 'AM/PM h"时"mm"分"ss"秒"',
  57: 'yyyy"年"m"月"',
  58: 'm"月"d"日"',
};

/** True when a number format renders a date or time: any d/m/y/h/s token outside literals and colour/condition brackets. */
export function isDateFormat(code: string): boolean {
  if (code === "General" || code === "@") return false;
  const bare = code
    .replace(/"[^"]*"/g, "")
    .replace(/\\./g, "")
    .replace(/\[(?!h+\]|m+\]|s+\])[^\]]*\]/gi, "")
    .replace(/AM\/PM|A\/P/gi, "");
  return /[dmyhs]/i.test(bare);
}

/** Excel serial → ISO text. Returns null outside the representable range. Never guesses a time zone. */
export function serialToIso(serial: number, date1904: boolean): string | null {
  if (!Number.isFinite(serial) || serial < 0 || serial >= 2_958_466) return null;
  let days = Math.floor(serial);
  let seconds = Math.round((serial - days) * 86_400);
  if (seconds >= 86_400) {
    seconds = 0;
    days += 1;
  }
  const hh = String(Math.floor(seconds / 3600)).padStart(2, "0");
  const mm = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  const time = `${hh}:${mm}:${ss}`;
  if (days === 0) return date1904 && seconds === 0 ? "1904-01-01" : time;
  let epochDays: number;
  if (date1904) {
    epochDays = Date.UTC(1904, 0, 1) / 86_400_000 + days;
  } else {
    if (days === 60) return null; // 1900-02-29 does not exist (the Lotus 1-2-3 leap-year bug)
    // Serial 1 is 1900-01-01; from serial 61 on, the phantom leap day shifts everything by one.
    epochDays = Date.UTC(1899, 11, days < 60 ? 31 : 30) / 86_400_000 + days;
  }
  const date = new Date(epochDays * 86_400_000).toISOString().slice(0, 10);
  return seconds === 0 ? date : `${date}T${time}`;
}

/** "BC12" → [row 12, column 55]; null when the reference is not a plain A1 cell reference. */
export function parseCellRef(ref: string): readonly [number, number] | null {
  const m = /^([A-Z]{1,3})([1-9][0-9]{0,6})$/.exec(ref);
  if (m === null) return null;
  let col = 0;
  for (const ch of m[1]!) col = col * 26 + (ch.charCodeAt(0) - 64);
  const row = Number(m[2]);
  return row <= MAX_ROW && col <= MAX_COL ? [row, col] : null;
}

function clean(text: string, limits: SandboxLimits): string {
  if (text.length > limits.maxCellChars) {
    throw new SandboxReject("unsupported_structure", "cell text longer than a cell can hold");
  }
  return text.includes("\u0000") ? text.replaceAll("\u0000", "") : text;
}

function partPath(base: string, target: string): string {
  const joined = target.startsWith("/") ? target.slice(1) : `${base}${target}`;
  const out: string[] = [];
  for (const segment of joined.split("/")) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") {
      if (out.length === 0) throw new SandboxReject("corrupt_file", "relationship leaves package");
      out.pop();
    } else out.push(segment);
  }
  return out.join("/");
}

interface Workbook {
  readonly sheets: readonly { name: string; relId: string; hidden: boolean }[];
  readonly date1904: boolean;
}

function readContentTypes(zip: ZipArchive): void {
  if (!zip.has("[Content_Types].xml")) {
    throw new SandboxReject("corrupt_file", "not an OOXML package");
  }
  let workbookType: string | null = null;
  for (const tok of tokenize(decodeXml(zip.read("[Content_Types].xml")))) {
    if (tok.type !== "open") continue;
    const type = tok.attrs["ContentType"] ?? "";
    if (
      /macroEnabled|vbaProject|macrosheet|dialogsheet|ms-excel\.(sheet\.binary|addin|template)/i.test(
        type,
      )
    ) {
      throw new SandboxReject("macro_enabled", "macro or binary workbook content type");
    }
    if (tok.name === "Override" && /^\/?xl\/workbook\.xml$/i.test(tok.attrs["PartName"] ?? "")) {
      workbookType = type;
    }
  }
  if (workbookType !== WORKBOOK_MAIN) {
    throw new SandboxReject("unsupported_structure", "not a plain .xlsx workbook");
  }
}

/**
 * The package's own root relationships must name exactly one workbook, at the standard location. Spreadsheet
 * programs open whatever `_rels/.rels` points at; if this reader looked at a fixed part name instead, a file could
 * show one set of numbers to a person and a different set to us.
 */
function requireStandardWorkbook(zip: ZipArchive): void {
  if (!zip.has("_rels/.rels")) {
    throw new SandboxReject("corrupt_file", "package relationships missing");
  }
  const targets: string[] = [];
  for (const tok of tokenize(decodeXml(zip.read("_rels/.rels")))) {
    if (tok.type !== "open" || tok.name !== "Relationship") continue;
    if (!/\/officeDocument$/.test(tok.attrs["Type"] ?? "")) continue;
    if ((tok.attrs["TargetMode"] ?? "Internal") !== "Internal") {
      throw new SandboxReject("unsupported_structure", "external workbook");
    }
    targets.push(partPath("", tok.attrs["Target"] ?? ""));
  }
  if (targets.length !== 1 || targets[0] !== "xl/workbook.xml") {
    throw new SandboxReject("unsupported_structure", "workbook is not at its standard location");
  }
}

function readWorkbook(zip: ZipArchive, limits: SandboxLimits): Workbook {
  const sheets: { name: string; relId: string; hidden: boolean }[] = [];
  let date1904 = false;
  const names = new Set<string>();
  for (const tok of tokenize(decodeXml(zip.read("xl/workbook.xml")))) {
    if (tok.type !== "open") continue;
    if (tok.name === "workbookPr") {
      const v = tok.attrs["date1904"];
      date1904 = v === "1" || v === "true";
    } else if (tok.name === "sheet") {
      const name = tok.attrs["name"] ?? "";
      const relId = attrByLocalName(tok.attrs, "id", true) ?? "";
      if (name.length < 1 || name.length > MAX_SHEET_NAME || name.includes("\u0000")) {
        throw new SandboxReject("unsupported_structure", "sheet name length");
      }
      if (names.has(name.toLowerCase())) {
        throw new SandboxReject("corrupt_file", "duplicate sheet name");
      }
      names.add(name.toLowerCase());
      const state = tok.attrs["state"] ?? "visible";
      sheets.push({ name, relId, hidden: state !== "visible" });
      if (sheets.length > limits.maxSheets) {
        throw new SandboxReject("unsupported_structure", `more than ${limits.maxSheets} sheets`);
      }
    }
  }
  if (sheets.length === 0) throw new SandboxReject("corrupt_file", "workbook has no sheets");
  return { sheets, date1904 };
}

function readRelationships(zip: ZipArchive): Map<string, { target: string; worksheet: boolean }> {
  const rels = new Map<string, { target: string; worksheet: boolean }>();
  if (!zip.has("xl/_rels/workbook.xml.rels")) {
    throw new SandboxReject("corrupt_file", "workbook relationships missing");
  }
  for (const tok of tokenize(decodeXml(zip.read("xl/_rels/workbook.xml.rels")))) {
    if (tok.type !== "open" || tok.name !== "Relationship") continue;
    const id = tok.attrs["Id"];
    const target = tok.attrs["Target"];
    if (id === undefined || target === undefined) continue;
    if (/macrosheet|dialogsheet|vbaProject/i.test(tok.attrs["Type"] ?? "")) {
      throw new SandboxReject("macro_enabled", "macro sheet relationship");
    }
    if ((tok.attrs["TargetMode"] ?? "Internal") !== "Internal") continue; // never followed
    rels.set(id, {
      target: partPath("xl/", target),
      worksheet: WORKSHEET_REL.test(tok.attrs["Type"] ?? ""),
    });
  }
  return rels;
}

function readSharedStrings(zip: ZipArchive, limits: SandboxLimits): string[] {
  const name = "xl/sharedStrings.xml";
  if (!zip.has(name)) return [];
  const strings: string[] = [];
  let current: string | null = null;
  let inText = false;
  let phonetic = 0;
  for (const tok of tokenize(decodeXml(zip.read(name)))) {
    if (tok.type === "open") {
      if (tok.name === "si") {
        current = "";
        if (tok.selfClosing) {
          strings.push("");
          current = null;
        }
      } else if (tok.name === "rPh") {
        if (!tok.selfClosing) phonetic++; // phonetic guide text is not part of the cell's value
      } else if (tok.name === "t" && !tok.selfClosing) {
        inText = true;
      }
    } else if (tok.type === "close") {
      if (tok.name === "si" && current !== null) {
        strings.push(clean(current, limits));
        current = null;
      } else if (tok.name === "rPh") {
        phonetic = Math.max(0, phonetic - 1);
      } else if (tok.name === "t") {
        inText = false;
      }
    } else if (inText && phonetic === 0 && current !== null) {
      current += tok.text;
      if (current.length > limits.maxCellChars) {
        throw new SandboxReject(
          "unsupported_structure",
          "shared string longer than a cell can hold",
        );
      }
    }
  }
  return strings;
}

/** cellXfs index → number format code (only non-General ones are kept). */
function readStyles(zip: ZipArchive): Map<number, string> {
  const formats = new Map<number, string>();
  const name = "xl/styles.xml";
  if (!zip.has(name)) return formats;
  const custom = new Map<number, string>();
  let inCellXfs = false;
  let xfIndex = 0;
  for (const tok of tokenize(decodeXml(zip.read(name)))) {
    if (tok.type === "open") {
      if (tok.name === "numFmt") {
        const id = Number(tok.attrs["numFmtId"]);
        const code = tok.attrs["formatCode"];
        if (Number.isInteger(id) && code !== undefined && code.length <= 255) custom.set(id, code);
      } else if (tok.name === "cellXfs") {
        inCellXfs = !tok.selfClosing;
      } else if (tok.name === "xf" && inCellXfs) {
        const id = Number(tok.attrs["numFmtId"] ?? "0");
        const code = custom.get(id) ?? BUILTIN_FORMATS[id];
        if (code !== undefined && code !== "General") formats.set(xfIndex, code);
        xfIndex++;
      }
    } else if (tok.type === "close" && tok.name === "cellXfs") {
      inCellXfs = false;
    }
  }
  return formats;
}

interface SheetContext {
  readonly sheetIndex: number;
  readonly shared: readonly string[];
  readonly formats: ReadonlyMap<number, string>;
  readonly date1904: boolean;
  readonly limits: SandboxLimits;
  readonly cells: SheetCell[];
  readonly flags: Set<string>;
  /** Characters of cell text returned so far, across all sheets (one shared string can sit in many cells). */
  readonly budget: { chars: number };
}

const NUMERIC = /^-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d{1,9})?)?(Z|[+-]\d{2}:\d{2})?)?$/;

function readSheet(xml: string, ctx: SheetContext): number {
  let row = 0;
  let col = 0;
  let count = 0;
  // state of the cell being read
  let inCell = false;
  let type = "n";
  let style = -1;
  let cellRow = 0;
  let cellCol = 0;
  let value: string | null = null;
  let inline: string | null = null;
  let formula = false;
  let capture: "v" | "t" | null = null;
  let phonetic = 0;
  const seen = new Set<number>();

  const finish = (): void => {
    inCell = false;
    capture = null;
    const z = style >= 0 ? ctx.formats.get(style) : undefined;
    if (value === "" && type !== "str") value = null; // <v></v>: no cached value
    let v: string | null;
    let t: SheetCell["t"];
    switch (type) {
      case "s": {
        if (value === null) return;
        const idx = Number(value);
        const text = Number.isInteger(idx) ? ctx.shared[idx] : undefined;
        if (text === undefined) throw new SandboxReject("corrupt_file", "shared string index");
        v = text;
        t = "s";
        break;
      }
      case "inlineStr":
        v = inline;
        t = "s";
        break;
      case "str":
        v = value;
        t = "s";
        break;
      case "b":
        v = value === null ? null : value === "1" || value === "true" ? "TRUE" : "FALSE";
        t = "b";
        break;
      case "e":
        v = value;
        t = "e";
        break;
      case "d":
        if (value !== null && !ISO_DATE.test(value)) {
          throw new SandboxReject("corrupt_file", "date cell is not an ISO 8601 date");
        }
        v = value;
        t = "d";
        break;
      case "n":
        if (value !== null && !NUMERIC.test(value)) {
          throw new SandboxReject("corrupt_file", "non-numeric value in a numeric cell");
        }
        v = value;
        t = "n";
        break;
      default:
        throw new SandboxReject("unsupported_structure", "unknown cell type");
    }
    if (v === null && !formula) return; // a styled but empty cell
    if (v === "" && !formula) return;
    if (v !== null) v = clean(v, ctx.limits);
    // Two cells claiming one address: a spreadsheet program shows one of them, and we could not say which.
    const anchor = cellRow * (MAX_COL + 1) + cellCol;
    if (seen.has(anchor)) throw new SandboxReject("corrupt_file", "duplicate cell reference");
    seen.add(anchor);
    if (v !== null) {
      ctx.budget.chars += v.length;
      if (ctx.budget.chars > ctx.limits.maxTextChars) {
        throw new SandboxReject(
          "output_too_large",
          `more than ${ctx.limits.maxTextChars} characters of cell text`,
        );
      }
    }
    if (formula && v === null) ctx.flags.add("formula_without_cached_value");
    if (formula) ctx.flags.add("formulas_present");

    const cell: { -readonly [K in keyof SheetCell]: SheetCell[K] } = {
      s: ctx.sheetIndex,
      r: cellRow,
      c: cellCol,
      v,
      t,
    };
    if (formula) cell.f = 1;
    if (z !== undefined && t === "n") {
      cell.z = z;
      if (v !== null && isDateFormat(z)) {
        const iso = serialToIso(Number(v), ctx.date1904);
        if (iso !== null) cell.d = iso;
      }
    }
    ctx.cells.push(cell);
    count++;
    if (ctx.cells.length > ctx.limits.maxCells) {
      throw new SandboxReject("too_many_cells", `more than ${ctx.limits.maxCells} cells`);
    }
  };

  for (const tok of tokenize(xml)) {
    if (tok.type === "open") {
      switch (tok.name) {
        case "row": {
          const r = tok.attrs["r"];
          row = r === undefined ? row + 1 : Number(r);
          if (!Number.isInteger(row) || row < 1 || row > MAX_ROW) {
            throw new SandboxReject("corrupt_file", "row number out of range");
          }
          col = 0;
          break;
        }
        case "c": {
          const ref = tok.attrs["r"];
          if (ref === undefined) {
            cellRow = row;
            cellCol = col + 1;
          } else {
            const parsed = parseCellRef(ref);
            if (parsed === null) throw new SandboxReject("corrupt_file", "cell reference");
            [cellRow, cellCol] = parsed;
          }
          if (cellRow < 1 || cellCol < 1 || cellCol > MAX_COL) {
            throw new SandboxReject("corrupt_file", "cell outside the sheet");
          }
          col = cellCol;
          type = tok.attrs["t"] ?? "n";
          const s = tok.attrs["s"];
          style = s === undefined ? -1 : Number(s);
          value = null;
          inline = null;
          formula = false;
          phonetic = 0;
          inCell = true;
          if (tok.selfClosing) finish();
          break;
        }
        case "v":
          if (inCell && !tok.selfClosing) {
            capture = "v";
            value = "";
          }
          break;
        case "f":
          if (inCell) formula = true;
          break;
        case "rPh":
          if (!tok.selfClosing) phonetic++;
          break;
        case "t":
          if (inCell && type === "inlineStr" && phonetic === 0 && !tok.selfClosing) {
            capture = "t";
            inline ??= "";
          }
          break;
        default:
          break;
      }
    } else if (tok.type === "close") {
      if (tok.name === "c" && inCell) finish();
      else if (tok.name === "v" || tok.name === "t") capture = null;
      else if (tok.name === "rPh") phonetic = Math.max(0, phonetic - 1);
    } else if (capture === "v") {
      value = (value ?? "") + tok.text;
      if (value.length > ctx.limits.maxCellChars) {
        throw new SandboxReject("unsupported_structure", "cell text longer than a cell can hold");
      }
    } else if (capture === "t") {
      inline = (inline ?? "") + tok.text;
      if (inline.length > ctx.limits.maxCellChars) {
        throw new SandboxReject("unsupported_structure", "cell text longer than a cell can hold");
      }
    }
  }
  return count;
}

export function parseXlsxBuffer(buf: Buffer, limits: SandboxLimits): SheetResult {
  const zip = new ZipArchive(buf, {
    maxEntries: limits.maxZipEntries,
    maxEntryBytes: limits.maxZipEntryBytes,
    maxInflatedBytes: limits.maxZipInflatedBytes,
  });
  const flags = new Set<string>();
  for (const name of zip.names()) {
    const lower = name.toLowerCase();
    if (/(^|\/)vbaproject\.bin$/.test(lower) || /^xl\/(macrosheets|dialogsheets)\//.test(lower)) {
      throw new SandboxReject("macro_enabled", "macro part in package");
    }
    // Embedded OLE objects and ActiveX controls are whole other files (or code) riding inside the workbook. This
    // reader would never open them, but the workbook is promoted byte for byte, so they would travel with it.
    if (lower.startsWith("xl/embeddings/") || lower.startsWith("xl/activex/")) {
      throw new SandboxReject("unsupported_structure", "embedded objects or controls");
    }
    if (lower.startsWith("xl/externallinks/")) flags.add("external_links_ignored");
  }
  readContentTypes(zip);
  requireStandardWorkbook(zip);
  if (!zip.has("xl/workbook.xml")) throw new SandboxReject("corrupt_file", "workbook part missing");

  const workbook = readWorkbook(zip, limits);
  const rels = readRelationships(zip);
  const shared = readSharedStrings(zip, limits);
  const formats = readStyles(zip);

  const sheets: SheetMeta[] = [];
  const cells: SheetCell[] = [];
  const budget = { chars: 0 };
  for (const sheet of workbook.sheets) {
    const rel = rels.get(sheet.relId);
    if (rel === undefined || !rel.worksheet) {
      flags.add("non_worksheet_skipped"); // chart sheets and the like carry no cells
      continue;
    }
    if (!zip.has(rel.target)) throw new SandboxReject("corrupt_file", "worksheet part missing");
    const sheetIndex = sheets.length;
    const cellCount = readSheet(decodeXml(zip.read(rel.target)), {
      sheetIndex,
      shared,
      formats,
      date1904: workbook.date1904,
      limits,
      cells,
      flags,
      budget,
    });
    if (sheet.hidden) flags.add("hidden_sheets");
    sheets.push({ name: sheet.name, hidden: sheet.hidden, cellCount });
  }
  if (sheets.length === 0) throw new SandboxReject("corrupt_file", "workbook has no worksheets");
  return { kind: "sheet", format: "xlsx", sheets, cells, flags: [...flags].sort() };
}

export function parseXlsxFile(path: string, limits: SandboxLimits): SheetResult {
  return parseXlsxBuffer(readFileSync(path), limits);
}
