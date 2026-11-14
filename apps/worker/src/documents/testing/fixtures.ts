/**
 * SYNTHETIC test fixtures for the document pipeline, generated in memory. Every company, product, price and person
 * in them is invented; no buyer or supplier document is in this repository (CLAUDE.md §4, the repo is public).
 *
 * The builders are deliberately independent of the code under test: the PDF and XLSX writers here share nothing with
 * the readers in ../sandbox, and PDFs are read back by pdf.js, images by libvips. XLSX is the one format where the
 * writer is also ours (hand-written SpreadsheetML following ECMA-376) — no file saved by Excel, WPS or LibreOffice
 * has been through the reader yet; that needs authorized samples (B-30).
 */
import { crc32, deflateRawSync } from "node:zlib";

// ---------------------------------------------------------------------------------------------------------------
// ZIP
// ---------------------------------------------------------------------------------------------------------------

export interface ZipInput {
  readonly name: string;
  readonly data: Buffer | string;
  /** Store instead of deflate. */
  readonly store?: boolean;
  /** Lie about the uncompressed size in both headers (decompression-bomb fixtures). */
  readonly declaredSize?: number;
  /** Set the "encrypted" general-purpose bit. */
  readonly encrypted?: boolean;
}

export function buildZip(inputs: readonly ZipInput[]): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const input of inputs) {
    const data = typeof input.data === "string" ? Buffer.from(input.data, "utf8") : input.data;
    const name = Buffer.from(input.name, "utf8");
    const method = input.store === true ? 0 : 8;
    const body = method === 0 ? data : deflateRawSync(data);
    const size = input.declaredSize ?? data.length;
    const flags = (input.encrypted === true ? 0x1 : 0) | 0x800;

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(flags, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt32LE(crc32(data), 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(size, 22);
    local.writeUInt16LE(name.length, 26);
    locals.push(local, name, body);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(flags, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt32LE(crc32(data), 16);
    central.writeUInt32LE(body.length, 20);
    central.writeUInt32LE(size, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, name);
    offset += 30 + name.length + body.length;
  }
  const directory = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(inputs.length, 8);
  end.writeUInt16LE(inputs.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}

// ---------------------------------------------------------------------------------------------------------------
// XLSX (SpreadsheetML)
// ---------------------------------------------------------------------------------------------------------------

export type CellInput =
  | string
  | number
  | boolean
  | null
  | { readonly formula: string; readonly cached?: string | number }
  | { readonly date: number; readonly format?: "date" | "datetime" | "zh" }
  | { readonly inline: string }
  | { readonly error: string };

export interface SheetInput {
  readonly name: string;
  readonly rows: readonly (readonly CellInput[])[];
  readonly state?: "hidden" | "veryHidden";
}

export interface XlsxOptions {
  readonly date1904?: boolean;
  /** Extra parts, e.g. `xl/vbaProject.bin` for a macro fixture. */
  readonly extraParts?: readonly ZipInput[];
  /** Replace the workbook content type (macro-enabled fixtures). */
  readonly workbookContentType?: string;
  /** Extra `<Override …/>` elements for [Content_Types].xml. */
  readonly extraContentTypes?: string;
  /** Where `_rels/.rels` says the workbook is (default `xl/workbook.xml`); null leaves `_rels/.rels` out. */
  readonly rootWorkbookTarget?: string | null;
  /** Raw contents of `<sheetData>` for the first sheet, replacing its rows (malformed-sheet fixtures). */
  readonly firstSheetData?: string;
  /** Extra `<Relationship …/>` elements for xl/_rels/workbook.xml.rels. */
  readonly extraWorkbookRels?: string;
}

const xmlEscape = (s: string): string =>
  s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

export function columnName(col: number): string {
  let name = "";
  for (let n = col; n > 0; n = Math.floor((n - 1) / 26)) {
    name = String.fromCharCode(65 + ((n - 1) % 26)) + name;
  }
  return name;
}

const HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const MAIN = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
export const XLSX_WORKBOOK_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml";

/** cellXfs: 0 General · 1 yyyy-mm-dd (custom 164) · 2 builtin 22 date-time · 3 builtin 31 yyyy"年"m"月"d"日" */
const STYLES = `${HEAD}<styleSheet xmlns="${MAIN}"><numFmts count="1"><numFmt numFmtId="164" formatCode="yyyy\\-mm\\-dd"/></numFmts><fonts count="1"><font/></fonts><fills count="1"><fill/></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="4"><xf numFmtId="0"/><xf numFmtId="164" applyNumberFormat="1"/><xf numFmtId="22" applyNumberFormat="1"/><xf numFmtId="31" applyNumberFormat="1"/></cellXfs></styleSheet>`;

export function buildXlsx(sheets: readonly SheetInput[], options: XlsxOptions = {}): Buffer {
  const shared: string[] = [];
  const sharedIndex = new Map<string, number>();
  const intern = (s: string): number => {
    let i = sharedIndex.get(s);
    if (i === undefined) {
      i = shared.length;
      shared.push(s);
      sharedIndex.set(s, i);
    }
    return i;
  };

  const sheetXml = sheets.map((sheet, sheetIndex) => {
    let xml = `${HEAD}<worksheet xmlns="${MAIN}"><sheetData>`;
    if (sheetIndex === 0 && options.firstSheetData !== undefined) {
      return `${xml}${options.firstSheetData}</sheetData></worksheet>`;
    }
    sheet.rows.forEach((row, r) => {
      if (row.length === 0) return;
      xml += `<row r="${r + 1}">`;
      row.forEach((cell, c) => {
        if (cell === null) return;
        const ref = `${columnName(c + 1)}${r + 1}`;
        if (typeof cell === "string") xml += `<c r="${ref}" t="s"><v>${intern(cell)}</v></c>`;
        else if (typeof cell === "number") xml += `<c r="${ref}"><v>${cell}</v></c>`;
        else if (typeof cell === "boolean") xml += `<c r="${ref}" t="b"><v>${cell ? 1 : 0}</v></c>`;
        else if ("formula" in cell) {
          const f = `<f>${xmlEscape(cell.formula)}</f>`;
          if (cell.cached === undefined) xml += `<c r="${ref}">${f}</c>`;
          else if (typeof cell.cached === "number")
            xml += `<c r="${ref}">${f}<v>${cell.cached}</v></c>`;
          else xml += `<c r="${ref}" t="str">${f}<v>${xmlEscape(cell.cached)}</v></c>`;
        } else if ("date" in cell) {
          const style = cell.format === "datetime" ? 2 : cell.format === "zh" ? 3 : 1;
          xml += `<c r="${ref}" s="${style}"><v>${cell.date}</v></c>`;
        } else if ("inline" in cell) {
          xml += `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(cell.inline)}</t></is></c>`;
        } else xml += `<c r="${ref}" t="e"><v>${xmlEscape(cell.error)}</v></c>`;
      });
      xml += "</row>";
    });
    return `${xml}</sheetData></worksheet>`;
  });

  const contentTypes = `${HEAD}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="${options.workbookContentType ?? XLSX_WORKBOOK_TYPE}"/>${sheets
    .map(
      (_, i) =>
        `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
    )
    .join(
      "",
    )}<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>${options.extraContentTypes ?? ""}</Types>`;
  const workbook = `${HEAD}<workbook xmlns="${MAIN}" xmlns:r="${REL}"><workbookPr${options.date1904 === true ? ' date1904="1"' : ""}/><sheets>${sheets
    .map(
      (s, i) =>
        `<sheet name="${xmlEscape(s.name)}" sheetId="${i + 1}"${s.state === undefined ? "" : ` state="${s.state}"`} r:id="rId${i + 1}"/>`,
    )
    .join("")}</sheets></workbook>`;
  const workbookRels = `${HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets
    .map(
      (_, i) =>
        `<Relationship Id="rId${i + 1}" Type="${REL}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
    )
    .join("")}${options.extraWorkbookRels ?? ""}</Relationships>`;
  const rootTarget =
    options.rootWorkbookTarget === undefined ? "xl/workbook.xml" : options.rootWorkbookTarget;
  const rootRels = `${HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${REL}/officeDocument" Target="${rootTarget ?? ""}"/></Relationships>`;
  const sharedStrings = `${HEAD}<sst xmlns="${MAIN}" count="${shared.length}" uniqueCount="${shared.length}">${shared
    .map((s) => `<si><t xml:space="preserve">${xmlEscape(s)}</t></si>`)
    .join("")}</sst>`;

  return buildZip([
    { name: "[Content_Types].xml", data: contentTypes },
    ...(rootTarget === null ? [] : [{ name: "_rels/.rels", data: rootRels }]),
    { name: "xl/workbook.xml", data: workbook },
    { name: "xl/_rels/workbook.xml.rels", data: workbookRels },
    { name: "xl/styles.xml", data: STYLES },
    { name: "xl/sharedStrings.xml", data: sharedStrings },
    ...sheetXml.map((data, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, data })),
    ...(options.extraParts ?? []),
  ]);
}

// ---------------------------------------------------------------------------------------------------------------
// PDF
// ---------------------------------------------------------------------------------------------------------------

export interface PdfOptions {
  /** Appended after %%EOF (polyglot fixtures). */
  readonly trailing?: Buffer;
  /** Adds an /OpenAction JavaScript action to the catalog (it must never run). */
  readonly javascript?: string;
  /** Raw content-stream operators appended to the first page (adversarial-geometry fixtures). */
  readonly rawFirstPageContent?: string;
}

function utf16Hex(text: string): string {
  let hex = "";
  for (let i = 0; i < text.length; i++) hex += text.charCodeAt(i).toString(16).padStart(4, "0");
  return hex.toUpperCase();
}

/**
 * A minimal, valid PDF: one text line per array entry, one array per page. ASCII lines use Helvetica; anything else
 * uses the non-embedded CID font STSong-Light with the predefined UniGB-UCS2-H CMap, so reading the Chinese text
 * back requires the parser to load CMaps correctly.
 */
export function buildPdf(pages: readonly (readonly string[])[], options: PdfOptions = {}): Buffer {
  const objects: string[] = [];
  const add = (body: string): number => objects.push(body);
  const catalog = add("");
  const pagesId = add("");
  const helvetica = add(
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
  );
  const descriptor = add(
    "<< /Type /FontDescriptor /FontName /STSong-Light /Flags 6 /FontBBox [-25 -254 1000 880] /ItalicAngle 0 /Ascent 880 /Descent -120 /CapHeight 880 /StemV 93 >>",
  );
  const cidFont = add(
    `<< /Type /Font /Subtype /CIDFontType0 /BaseFont /STSong-Light /CIDSystemInfo << /Registry (Adobe) /Ordering (GB1) /Supplement 4 >> /FontDescriptor ${descriptor} 0 R /DW 1000 >>`,
  );
  const song = add(
    `<< /Type /Font /Subtype /Type0 /BaseFont /STSong-Light /Encoding /UniGB-UCS2-H /DescendantFonts [${cidFont} 0 R] >>`,
  );
  const kids: number[] = [];
  for (const lines of pages) {
    let y = 780;
    let content = "";
    for (const line of lines) {
      content += /^[\x20-\x7e]*$/.test(line)
        ? `BT /F1 12 Tf 72 ${y} Td (${line.replace(/([()\\])/g, "\\$1")}) Tj ET\n`
        : `BT /F2 12 Tf 72 ${y} Td <${utf16Hex(line)}> Tj ET\n`;
      y -= 20;
    }
    if (kids.length === 0 && options.rawFirstPageContent !== undefined) {
      content += `${options.rawFirstPageContent}\n`;
    }
    const stream = add(`<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}endstream`);
    kids.push(
      add(
        `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${helvetica} 0 R /F2 ${song} 0 R >> >> /Contents ${stream} 0 R >>`,
      ),
    );
  }
  let openAction = "";
  if (options.javascript !== undefined) {
    const js = add(`<< /Type /Action /S /JavaScript /JS (${options.javascript}) >>`);
    openAction = ` /OpenAction ${js} 0 R`;
  }
  objects[catalog - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R${openAction} >>`;
  objects[pagesId - 1] =
    `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(" ")}] /Count ${kids.length} >>`;

  let out = "%PDF-1.4\n%âãÏÓ\n";
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(Buffer.byteLength(out, "latin1"));
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = Buffer.byteLength(out, "latin1");
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const o of offsets) out += `${String(o).padStart(10, "0")} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  const pdf = Buffer.from(out, "latin1");
  return options.trailing === undefined ? pdf : Buffer.concat([pdf, options.trailing]);
}

// ---------------------------------------------------------------------------------------------------------------
// Sample documents (synthetic, EN + ZH)
// ---------------------------------------------------------------------------------------------------------------

export const SAMPLE_PDF_PAGES: readonly (readonly string[])[] = [
  [
    "SYNTHETIC SAMPLE - Quotation Q-2026-001",
    "Unit price: USD 1.25 FOB Shenzhen",
    "单价 人民币 8.50 元 含税",
    "MOQ 5000 pcs",
  ],
  ["Page two", "交货期 30 天"],
];

export const SAMPLE_SHEETS: readonly SheetInput[] = [
  {
    name: "报价 Quote",
    rows: [
      ["品名", "Item", "MOQ", "Unit price (CNY)", "Total", "Valid until"],
      [
        "织唛标签",
        "Woven label 20x50mm",
        5000,
        0.085,
        { formula: "C2*D2", cached: 425 },
        { date: 46387 },
      ],
      ["吊牌", "Hang tag", 3000, 0.32, { formula: "C3*D3" }, { date: 46387, format: "zh" }],
    ],
  },
  { name: "Notes", rows: [[{ inline: "含税，不含运费 / tax included, freight excluded" }]] },
];

export const SAMPLE_CSV =
  'Item,品名,MOQ,Unit price\r\n"Woven label, 20x50mm",织唛标签,5000,0.085\r\nHang tag,吊牌,3000,0.32\r\n';

/** A harmless marker the fake scanner treats as "malware", so unit tests never need a real test virus on disk. */
export const FAKE_MALWARE_MARKER = "FBG-FAKE-SCANNER-TEST-SIGNATURE-not-malware";

/**
 * The EICAR anti-malware test file (a harmless 68-byte string every scanner detects by agreement), assembled at run
 * time so that no file in this repository contains it and no developer's antivirus quarantines the checkout.
 */
export function eicarTestFile(): Buffer {
  const parts = ["X5O!P%@AP[4\\PZX54(P^)7CC)7}$", "EICAR-STANDARD-ANTIVIRUS-", "TEST-FILE!$H+H*"];
  return Buffer.from(parts.join(""), "latin1");
}
