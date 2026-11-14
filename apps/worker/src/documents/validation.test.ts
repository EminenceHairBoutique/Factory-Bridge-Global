/** Step-1 validation (B-13): job contract, file names, storage-path binding, content sniffing, streamed intake. */
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DocumentRejectedError, safeDetail } from "./errors.js";
import { extensionOf, isBoundStoragePath, promotedFileName, slugOf } from "./filename.js";
import { createWorkspace, streamToFile } from "./intake.js";
import { documentJobKey, documentJobPayload, isDocumentJobKey } from "./job.js";
import { checkContent, endsWithZipDirectory, readHeadAndTail, sniffHead } from "./sniff.js";
import {
  SAMPLE_CSV,
  SAMPLE_PDF_PAGES,
  SAMPLE_SHEETS,
  buildPdf,
  buildXlsx,
  buildZip,
} from "./testing/fixtures.js";

const ORG = "aaaaaaaa-0000-4000-8000-000000000001";
const DOC = "bbbbbbbb-0000-4000-8000-000000000002";
const OTHER = "cccccccc-0000-4000-8000-000000000003";
const SHA = "a".repeat(64);
const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const pdf = buildPdf(SAMPLE_PDF_PAGES);
const xlsx = buildXlsx(SAMPLE_SHEETS);
const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64, 1)]);
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(64, 1),
]);

function check(mime: string, name: string, data: Buffer) {
  return checkContent({
    declaredMime: mime,
    originalFilename: name,
    head: data.subarray(0, 4096),
    tail: data.subarray(Math.max(0, data.length - 65_557)),
    size: data.length,
  });
}
function rejection(fn: () => unknown): { code: string; detail: string | null } {
  try {
    fn();
  } catch (err) {
    if (err instanceof DocumentRejectedError) return { code: err.code, detail: err.detail };
    throw err;
  }
  throw new Error("expected a rejection");
}

describe("job contract", () => {
  it("accepts exactly two uuids", () => {
    expect(documentJobPayload.safeParse({ document_id: DOC, org_id: ORG }).success).toBe(true);
    for (const bad of [
      {},
      { document_id: DOC },
      { document_id: "1", org_id: ORG },
      { document_id: DOC, org_id: ORG, storage_path: "x" }, // a path in the message is refused, not ignored
      { document_id: DOC, org_id: ORG, mime: "application/pdf" },
    ]) {
      expect(documentJobPayload.safeParse(bad).success, JSON.stringify(bad)).toBe(false);
    }
  });

  it("binds the idempotency key to the document", () => {
    expect(documentJobKey(DOC)).toBe(`document.process:${DOC}:v1`);
    expect(documentJobKey(DOC, 2)).toBe(`document.process:${DOC}:v1:rq2`);
    expect(isDocumentJobKey(documentJobKey(DOC), DOC)).toBe(true);
    expect(isDocumentJobKey(documentJobKey(DOC, 12), DOC)).toBe(true);
    expect(isDocumentJobKey(documentJobKey(OTHER), DOC)).toBe(false);
    expect(isDocumentJobKey(`document.process:${DOC}:v1:anything`, DOC)).toBe(false);
    expect(isDocumentJobKey(`document.process:${DOC}:v2`, DOC)).toBe(false);
    expect(isDocumentJobKey("any-other-key-123", DOC)).toBe(false);
    expect(() => documentJobKey(DOC, -1)).toThrow();
  });
});

describe("file names", () => {
  it("reads the real (last) extension", () => {
    expect(extensionOf("Quote.PDF")).toBe("pdf");
    expect(extensionOf("quote.pdf.exe")).toBe("exe");
    expect(extensionOf("报价单.xlsx")).toBe("xlsx");
    expect(extensionOf("C:\\Users\\x\\quote.csv")).toBe("csv");
    expect(extensionOf("quote.pdf. ")).toBe("pdf");
    expect(extensionOf("noext")).toBe("");
    expect(extensionOf(".hidden")).toBe("");
  });

  it("builds an ASCII object name that cannot traverse or masquerade", () => {
    expect(slugOf("Quote 2026 (final).pdf")).toBe("Quote_2026_final");
    expect(slugOf("../../etc/passwd")).toBe("passwd");
    expect(slugOf("..\\..\\windows\\system32\\cmd.exe")).toBe("cmd");
    expect(slugOf("报价单.xlsx")).toBe("document"); // no ASCII letters left: a neutral name, never an empty one
    expect(slugOf("报价 quote\u202Efdp.exe")).toBe("quote_fdp"); // bidi override removed
    expect(slugOf("CON.pdf")).toBe("file_CON");
    expect(slugOf("a".repeat(300) + ".pdf")).toHaveLength(60);
    expect(promotedFileName(SHA, "quote.pdf.exe", "pdf")).toBe("aaaaaaaaaaaa-quote_pdf.pdf");
    expect(promotedFileName(SHA, "photo.JPEG", "jpeg")).toBe("aaaaaaaaaaaa-photo.jpg");
    expect(() => promotedFileName("nothex", "a.pdf", "pdf")).toThrow();
  });

  it("accepts a storage path only inside the document's own folder", () => {
    expect(isBoundStoragePath(`${ORG}/${DOC}/upload.pdf`, ORG, DOC)).toBe(true);
    for (const bad of [
      `${OTHER}/${DOC}/upload.pdf`, // another organization's folder
      `${ORG}/${OTHER}/upload.pdf`, // another document's folder
      `${ORG}/${DOC}/../${OTHER}/x.pdf`,
      `${ORG}/${DOC}/sub/x.pdf`,
      `${ORG}/${DOC}/`,
      `${ORG}/${DOC}/..`,
      `/${ORG}/${DOC}/x.pdf`,
      `${ORG}/${DOC}/x\u0000.pdf`,
      `${ORG}/${DOC}/报价.pdf`,
    ]) {
      expect(isBoundStoragePath(bad, ORG, DOC), bad).toBe(false);
    }
    expect(isBoundStoragePath(`${ORG}/${DOC}/x.pdf`, "not-a-uuid", DOC)).toBe(false);
  });

  it("stores only machine-written details", () => {
    expect(safeDetail("declared pdf, content is zip")).toBe("declared pdf, content is zip");
    expect(safeDetail("单价 8.50")).toBeNull();
    expect(safeDetail("x".repeat(200))).toBeNull();
    expect(safeDetail('"; drop table')).toBeNull();
    expect(safeDetail("<script src=//evil.example/x.js></script>")).toBeNull(); // no markup, quotes or slashes
    expect(safeDetail("600 pages, limit 500")).toBe("600 pages, limit 500");
    expect(slugOf("quote／2026.pdf")).toBe("2026"); // a fullwidth slash normalizes to "/": cut after it
    expect(new DocumentRejectedError("corrupt_file", "含税").message).toBe("corrupt_file");
  });
});

describe("content sniffing", () => {
  it("names what the bytes are", () => {
    expect(sniffHead(pdf)).toBe("pdf");
    expect(sniffHead(xlsx)).toBe("zip");
    expect(sniffHead(jpeg)).toBe("jpeg");
    expect(sniffHead(png)).toBe("png");
    expect(sniffHead(Buffer.from("RIFF\x10\x00\x00\x00WEBPVP8 ", "latin1"))).toBe("webp");
    expect(sniffHead(Buffer.from(SAMPLE_CSV))).toBe("text");
    expect(sniffHead(Buffer.from("BM-200,Bracket,MZ steel\n"))).toBe("text"); // two-letter magics need their header
    expect(sniffHead(Buffer.from("MZ\x90\x00\x03\x00\x00\x00", "latin1"))).toBe("executable");
    expect(sniffHead(Buffer.from("\x7fELF\x02\x01\x01", "latin1"))).toBe("executable");
    expect(sniffHead(Buffer.from("#!/bin/sh\nrm -rf /\n"))).toBe("executable");
    expect(sniffHead(Buffer.from("\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1", "latin1"))).toBe("ole2");
    expect(sniffHead(Buffer.from("  <!DOCTYPE html><script>"))).toBe("markup");
    expect(sniffHead(Buffer.from('\ufeff<svg xmlns="http://www.w3.org/2000/svg">'))).toBe("markup");
    expect(sniffHead(Buffer.from("{\\rtf1"))).toBe("rtf");
    expect(sniffHead(Buffer.from("GIF89a"))).toBe("gif");
    expect(sniffHead(Buffer.from([0x1f, 0x8b, 0x08]))).toBe("gzip");
    expect(sniffHead(Buffer.from("Rar!\x1a\x07", "latin1"))).toBe("rar");
    expect(sniffHead(Buffer.from([0x00, 0x01, 0x02, 0x03]))).toBe("binary");
  });

  it("accepts each allowed type when MIME, extension and bytes agree", () => {
    expect(check("application/pdf", "quote.pdf", pdf)).toBe("pdf");
    expect(check(XLSX, "报价.xlsx", xlsx)).toBe("xlsx");
    expect(check("text/csv", "quote.CSV", Buffer.from(SAMPLE_CSV))).toBe("csv");
    expect(check("image/jpeg", "photo.jpeg", jpeg)).toBe("jpeg");
    expect(check("image/png", "photo.png", png)).toBe("png");
  });

  it("refuses types that are not on the allow list, whatever the bytes are", () => {
    for (const mime of [
      "application/zip",
      "image/svg+xml",
      "text/html",
      "application/vnd.ms-excel",
      "application/msword",
      "application/x-msdownload",
      "application/vnd.ms-excel.sheet.macroEnabled.12",
      "",
    ]) {
      expect(rejection(() => check(mime, "x.pdf", pdf)).code, mime).toBe("unsupported_type");
    }
  });

  it("refuses a mismatched extension", () => {
    expect(rejection(() => check("application/pdf", "quote.pdf.exe", pdf)).code).toBe(
      "extension_mismatch",
    );
    expect(rejection(() => check("application/pdf", "quote.xlsx", pdf)).code).toBe(
      "extension_mismatch",
    );
    expect(rejection(() => check(XLSX, "macro.xlsm", xlsx)).code).toBe("extension_mismatch");
    expect(rejection(() => check("application/pdf", "noextension", pdf)).code).toBe(
      "extension_mismatch",
    );
  });

  it("refuses content that is not what was declared, and says what it found without quoting it", () => {
    expect(rejection(() => check("application/pdf", "quote.pdf", xlsx))).toEqual({
      code: "type_mismatch",
      detail: "declared pdf, content is zip",
    });
    const exe = Buffer.from("MZ\x90\x00\x03\x00\x00\x00\x04\x00", "latin1");
    expect(rejection(() => check("image/png", "photo.png", exe)).detail).toBe(
      "declared png, content is executable",
    );
    expect(
      rejection(() => check("text/csv", "data.csv", Buffer.from("<html><script>x</script>")))
        .detail,
    ).toBe("declared csv, content is markup");
    expect(rejection(() => check("text/csv", "data.csv", pdf)).code).toBe("type_mismatch");
    expect(
      rejection(() =>
        check(XLSX, "legacy.xlsx", Buffer.from("\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1", "latin1")),
      ).detail,
    ).toBe("declared xlsx, content is ole2");
    expect(rejection(() => check("application/pdf", "empty.pdf", Buffer.alloc(0))).code).toBe(
      "empty_file",
    );
  });

  it("refuses a PDF or image that is also a ZIP archive (polyglot)", () => {
    const zip = buildZip([{ name: "payload.js", data: "alert(1)" }]);
    expect(endsWithZipDirectory(zip)).toBe(true);
    expect(endsWithZipDirectory(pdf)).toBe(false);
    expect(
      rejection(() => check("application/pdf", "q.pdf", buildPdf([["x"]], { trailing: zip }))).code,
    ).toBe("polyglot_suspected");
    expect(rejection(() => check("image/jpeg", "p.jpg", Buffer.concat([jpeg, zip]))).code).toBe(
      "polyglot_suspected",
    );
    expect(check(XLSX, "ok.xlsx", xlsx)).toBe("xlsx"); // an xlsx is a zip; that is its format, not a polyglot
    // unzip tools tolerate trailing bytes, so a stray byte after the archive must not get it past the check
    const padded = Buffer.concat([buildPdf([["x"]], { trailing: zip }), Buffer.from("\n%%EOF\n")]);
    expect(endsWithZipDirectory(padded.subarray(Math.max(0, padded.length - 65_557)))).toBe(true);
    expect(rejection(() => check("application/pdf", "q.pdf", padded)).code).toBe(
      "polyglot_suspected",
    );
  });
});

describe("streamed intake", () => {
  let dir: string;
  beforeAll(() => {
    dir = mkdtempSync(path.join(tmpdir(), "fbg-intake-test-"));
  });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  async function* chunks(data: Buffer, size = 1000): AsyncGenerator<Uint8Array> {
    await Promise.resolve();
    for (let i = 0; i < data.length; i += size) yield data.subarray(i, i + size);
  }

  it("writes, counts and hashes exactly what arrives", async () => {
    const data = Buffer.from("x".repeat(10_500));
    const dest = path.join(dir, "ok.bin");
    const res = await streamToFile(chunks(data), dest, 20_000);
    expect(res).toEqual({ bytes: 10_500, sha256: createHash("sha256").update(data).digest("hex") });
    expect(readFileSync(dest).equals(data)).toBe(true);
    const { head, tail } = await readHeadAndTail(dest, res.bytes);
    expect(head.length).toBe(4096);
    expect(tail.length).toBe(10_500);
  });

  it("stops as soon as the cap is passed, whatever length was declared", async () => {
    let produced = 0;
    async function* endless(): AsyncGenerator<Uint8Array> {
      await Promise.resolve();
      for (;;) {
        produced++;
        yield Buffer.alloc(1000, 1);
      }
    }
    const err = await streamToFile(endless(), path.join(dir, "big.bin"), 5_000).catch(
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(DocumentRejectedError);
    expect((err as DocumentRejectedError).code).toBe("too_large");
    expect(produced).toBeLessThanOrEqual(7);
  });

  it("reports a broken stream as transient, not as a verdict about the file", async () => {
    async function* broken(): AsyncGenerator<Uint8Array> {
      await Promise.resolve();
      yield Buffer.from("partial");
      throw new Error("connection reset");
    }
    await expect(streamToFile(broken(), path.join(dir, "cut.bin"), 5_000)).rejects.toMatchObject({
      name: "TransientDocumentError",
      code: "storage_unavailable",
    });
  });

  it("never overwrites an existing file and cleans its workspace up", async () => {
    const dest = path.join(dir, "exists.bin");
    writeFileSync(dest, "already here");
    await expect(streamToFile(chunks(Buffer.from("new")), dest, 100)).rejects.toMatchObject({
      name: "TransientDocumentError",
    });
    expect(readFileSync(dest, "utf8")).toBe("already here");

    const ws = await createWorkspace(dir);
    expect(path.basename(ws.inputPath)).toBe("input.bin"); // nothing from the upload's name
    writeFileSync(ws.inputPath, "x");
    await ws.dispose();
    expect(existsSync(ws.dir)).toBe(false);
  });
});
