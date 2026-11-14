/**
 * fbg_documents handler (B-12 / B-13), driven through the real Consumer with the in-memory queue store. Storage and
 * the scanner are scripted fakes; the parser sandbox is the REAL restricted child process. The SQL the commit stage
 * issues is recorded here and executed for real in documents.integration.test.ts.
 */
import { createHash } from "node:crypto";
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { Writable } from "node:stream";
import pino from "pino";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DOCUMENTS_QUEUE, DOCUMENT_PROCESS, documentJobKey } from "../documents/job.js";
import { MAX_DOCUMENT_BYTES } from "../documents/limits.js";
import type { DocumentRepo, DocumentRow, LoadOutcome } from "../documents/repo.js";
import { ProcessSandbox, type ParserSandbox } from "../documents/runner.js";
import { FakeScanner, MemoryObjectStore } from "../documents/testing/fakes.js";
import {
  FAKE_MALWARE_MARKER,
  SAMPLE_CSV,
  SAMPLE_PDF_PAGES,
  SAMPLE_SHEETS,
  buildPdf,
  buildXlsx,
  buildZip,
} from "../documents/testing/fixtures.js";
import { Consumer, type ConsumerOptions } from "../queue/consumer.js";
import { buildEnvelope } from "../queue/envelope.js";
import { FakeQueueStore } from "../queue/testing/fake-store.js";
import { createDocumentsHandler } from "./documents.js";

const ORG_A = "aaaaaaaa-0000-4000-8000-00000000000a";
const ORG_B = "bbbbbbbb-0000-4000-8000-00000000000b";
const USER = "cccccccc-0000-4000-8000-00000000000c";
const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const sha = (data: Buffer) => createHash("sha256").update(data).digest("hex");

/** The documents table as far as the handler is concerned, plus answers for the commit stage's statements. */
class FakeDocuments implements DocumentRepo {
  readonly rows = new Map<string, DocumentRow>();
  begins = 0;

  add(
    row: Partial<DocumentRow> & {
      id: string;
      orgId: string;
      data: Buffer;
      originalFilename: string;
      mime: string;
    },
  ): DocumentRow {
    const full: DocumentRow = {
      uploadedBy: USER,
      status: "uploaded",
      storageBucket: "quarantine",
      storagePath: `${row.orgId}/${row.id}/upload.bin`,
      bytes: row.data.length,
      ...row,
    };
    const { data: _data, ...stored } = full as DocumentRow & { data?: Buffer };
    this.rows.set(row.id, stored);
    return stored;
  }

  setStatus(id: string, status: string): void {
    this.rows.set(id, { ...this.rows.get(id)!, status });
  }

  load(documentId: string, orgId: string): Promise<LoadOutcome> {
    this.begins++;
    const row = this.rows.get(documentId);
    if (row === undefined || row.orgId !== orgId) return Promise.resolve({ kind: "not_found" });
    if (row.status !== "uploaded" && row.status !== "scanning") {
      return Promise.resolve({ kind: "noop", status: row.status });
    }
    return Promise.resolve({ kind: "process", document: row });
  }

  markScanning(documentId: string, orgId: string): Promise<boolean> {
    const row = this.rows.get(documentId);
    if (row === undefined || row.orgId !== orgId) return Promise.resolve(false);
    if (row.status === "scanning") return Promise.resolve(true);
    if (row.status !== "uploaded") return Promise.resolve(false);
    this.setStatus(documentId, "scanning");
    return Promise.resolve(true);
  }

  status(documentId: string, orgId: string): Promise<string | null> {
    const row = this.rows.get(documentId);
    return Promise.resolve(row === undefined || row.orgId !== orgId ? null : row.status);
  }

  /** FakeQueueStore.respond: what the database would answer inside the success transaction. */
  respond = (text: string, params: readonly unknown[]): unknown[] => {
    const id = params[0] as string;
    const row = this.rows.get(id);
    if (/for update/.test(text)) return row === undefined ? [] : [{ status: row.status }];
    if (/set status = 'parsed'/.test(text) && row?.status === "scanning") {
      this.rows.set(id, {
        ...row,
        status: "parsed",
        storageBucket: params[2] as string,
        storagePath: params[3] as string,
      });
      return [{ id }];
    }
    if (/set status = 'rejected'/.test(text) && row?.status === "scanning") {
      this.setStatus(id, "rejected");
      return [{ id }];
    }
    return [];
  };
}

let tmpRoot: string;
const logLines: string[] = [];
const log = pino(
  { level: "debug" },
  new Writable({
    write(chunk: Buffer, _enc, done) {
      logLines.push(chunk.toString("utf8"));
      done();
    },
  }),
);

beforeAll(() => {
  tmpRoot = mkdtempSync(path.join(tmpdir(), "fbg-handler-test-"));
});
afterAll(() => rmSync(tmpRoot, { recursive: true, force: true }));

interface World {
  readonly queue: FakeQueueStore;
  readonly docs: FakeDocuments;
  readonly store: MemoryObjectStore;
  readonly scanner: FakeScanner;
  readonly consumer: Consumer;
  upload(
    id: string,
    org: string,
    name: string,
    mime: string,
    data: Buffer,
    over?: Partial<DocumentRow>,
  ): DocumentRow;
  enqueue(id: string, org: string, key?: string): string;
  statements(pattern: RegExp): { text: string; params: readonly unknown[] }[];
}

let n = 0;
const docId = (): string => `d0000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;

function world(
  options: { sandbox?: ParserSandbox; consumer?: Partial<ConsumerOptions> } = {},
): World {
  const queue = new FakeQueueStore();
  const docs = new FakeDocuments();
  const store = new MemoryObjectStore();
  const scanner = new FakeScanner();
  queue.respond = docs.respond;
  const handler = createDocumentsHandler({
    repo: docs,
    store,
    scanner,
    sandbox: options.sandbox ?? new ProcessSandbox({ timeoutMs: 30_000 }),
    tmpRoot,
    now: () => new Date("2026-11-14T00:00:00.000Z"),
  });
  const consumer = new Consumer({
    store: queue,
    handlers: new Map([[DOCUMENTS_QUEUE, handler]]),
    log,
    workerId: "w-test",
    concurrency: 2,
    visibilityTimeoutSeconds: 30,
    maxAttempts: 3,
    backoff: { baseSeconds: 10, maxSeconds: 60, jitterRatio: 0 },
    busyRetrySeconds: 5,
    pollIntervalMs: 5,
    jobTimeoutMs: 60_000,
    random: () => 0,
    ...options.consumer,
  });
  return {
    queue,
    docs,
    store,
    scanner,
    consumer,
    upload(id, org, name, mime, data, over = {}) {
      const row = docs.add({ id, orgId: org, originalFilename: name, mime, data, ...over });
      store.put("quarantine", row.storagePath, data, mime);
      return row;
    },
    enqueue(id, org, key = documentJobKey(id)) {
      return queue.send(
        DOCUMENTS_QUEUE,
        buildEnvelope(DOCUMENT_PROCESS, key, { document_id: id, org_id: org }),
      );
    },
    statements: (pattern) => queue.committed.filter((q) => pattern.test(q.text)),
  };
}

const served = (w: World): string[] =>
  [...w.store.objects.keys()].filter((k) => k.startsWith("documents/"));

describe("clean documents are scanned, parsed and promoted", () => {
  it("PDF: page records with anchors, the scanned bytes promoted, status parsed — in one transaction", async () => {
    const w = world();
    const id = docId();
    const data = buildPdf(SAMPLE_PDF_PAGES);
    w.upload(id, ORG_A, "Quote 2026 报价.pdf", "application/pdf", data);
    const msgId = w.enqueue(id, ORG_A);

    expect(await w.consumer.pollOnce()).toEqual(["succeeded"]);

    const promotedPath = `${ORG_A}/${id}/${sha(data).slice(0, 12)}-Quote_2026.pdf`;
    expect(w.docs.rows.get(id)).toMatchObject({
      status: "parsed",
      storageBucket: "documents",
      storagePath: promotedPath,
    });
    expect(w.store.get("documents", promotedPath)?.equals(data)).toBe(true); // exactly the bytes that were scanned
    expect(w.scanner.scanned).toHaveLength(1);
    expect(path.basename(w.scanner.scanned[0]!)).toBe("input.bin");

    const pages = w.statements(/insert into public\.document_pages/);
    expect(pages).toHaveLength(1);
    const records = JSON.parse(pages[0]!.params[1] as string) as {
      page_no: number;
      text: string;
      layout: { items: unknown[] };
    }[];
    expect(records.map((r) => r.page_no)).toEqual([1, 2]);
    expect(records[0]!.text).toContain("Unit price: USD 1.25 FOB Shenzhen");
    expect(records[0]!.layout).toMatchObject({
      kind: "pdf_text",
      unit: "pt",
      width: 595,
      height: 842,
    });
    expect(records[0]!.layout.items).toContainEqual([
      72,
      760,
      expect.any(Number),
      12,
      "Unit price: USD 1.25 FOB Shenzhen",
    ]);

    const update = w.statements(/set status = 'parsed'/)[0]!;
    expect(update.params.slice(0, 5)).toEqual([id, ORG_A, "documents", promotedPath, sha(data)]);
    expect(update.params[6]).toBe(2); // page_count
    expect(JSON.parse(update.params[5] as string)).toMatchObject({
      v: 1,
      sha256: sha(data),
      bytes: data.length,
      detected_kind: "pdf",
      scanner: { engine: "fake", verdict: "clean" },
      isolation: "process",
      parse: { kind: "pdf", page_count: 2, text_available: true },
      promoted: { bucket: "documents", path: promotedPath, sha256: sha(data), reencoded: false },
      rejection: null,
    });
    expect(w.statements(/app\.notify/)[0]!.params.slice(0, 3)).toEqual([
      ORG_A,
      USER,
      "document_parsed",
    ]);
    expect(w.statements(/record_security_event/)).toHaveLength(0);
    expect(w.queue.ledgerRow(DOCUMENTS_QUEUE, documentJobKey(id))).toMatchObject({
      status: "succeeded",
    });
    expect(w.queue.isArchived(DOCUMENTS_QUEUE, msgId)).toBe(true);
    expect(readdirSync(tmpRoot)).toEqual([]); // the workspace is gone
    // the bytes that were scanned are the bytes that were promoted, and nothing else was shown to the scanner
    expect(w.scanner.scannedHashes).toEqual([sha(data)]);
    // once `parsed` is durable the quarantined upload is removed: the served copy is the document now
    expect(w.store.get("quarantine", `${ORG_A}/${id}/upload.bin`)).toBeUndefined();
    expect(w.store.removed).toEqual([`quarantine/${ORG_A}/${id}/upload.bin`]);
  });

  it("XLSX and CSV: cell records with sheet / row / column anchors", async () => {
    const w = world();
    const x = docId();
    const c = docId();
    w.upload(x, ORG_A, "quote.xlsx", XLSX_MIME, buildXlsx(SAMPLE_SHEETS));
    w.upload(c, ORG_A, "quote.csv", "text/csv", Buffer.from(SAMPLE_CSV));
    w.enqueue(x, ORG_A);
    w.enqueue(c, ORG_A);
    expect(await w.consumer.pollOnce()).toEqual(["succeeded", "succeeded"]);

    const inserts = w.statements(/insert into public\.document_cells/);
    const cellsOf = (id: string) =>
      inserts
        .filter((q) => q.params[0] === id)
        .flatMap(
          (q) =>
            JSON.parse(q.params[1] as string) as {
              sheet: string;
              row_no: number;
              col_no: number;
              raw: string | null;
              parsed: Record<string, unknown>;
            }[],
        );
    const xlsx = cellsOf(x);
    expect(xlsx.find((r) => r.sheet === "报价 Quote" && r.row_no === 2 && r.col_no === 5)).toEqual({
      sheet: "报价 Quote",
      row_no: 2,
      col_no: 5,
      raw: "425",
      parsed: { type: "number", formula: true, cached: true },
    });
    expect(xlsx.find((r) => r.row_no === 3 && r.col_no === 5)).toMatchObject({
      raw: null,
      parsed: { type: "number", formula: true, cached: false },
    });
    expect(xlsx.find((r) => r.row_no === 2 && r.col_no === 6)?.parsed).toEqual({
      type: "number",
      number_format: "yyyy\\-mm\\-dd",
      iso_date: "2026-12-31",
    });
    expect(cellsOf(c)).toHaveLength(12);
    expect(cellsOf(c).every((r) => r.sheet === "csv" && r.parsed["type"] === "text")).toBe(true);
    expect(w.statements(/insert into public\.document_pages/)).toHaveLength(0);
    const xUpdate = w.statements(/set status = 'parsed'/).find((q) => q.params[0] === x)!;
    expect(xUpdate.params[6]).toBeNull(); // page_count does not apply to a spreadsheet
  });

  it("image: the re-encoded copy is what gets promoted, and the record says no text was read", async () => {
    const w = world();
    const id = docId();
    const original = await sharp({
      create: { width: 30, height: 30, channels: 3, background: { r: 10, g: 120, b: 10 } },
    })
      .withExif({ IFD0: { Copyright: "EXIF-OWNER-MARK" } })
      .png()
      .toBuffer();
    w.upload(id, ORG_A, "label.png", "image/png", original);
    w.enqueue(id, ORG_A);
    expect(await w.consumer.pollOnce()).toEqual(["succeeded"]);

    const [key] = served(w);
    const promoted = w.store.objects.get(key!)!.data;
    expect(promoted.equals(original)).toBe(false);
    expect(promoted.includes("EXIF-OWNER-MARK")).toBe(false);
    const update = w.statements(/set status = 'parsed'/)[0]!;
    expect(update.params[4]).toBe(sha(original)); // documents.sha256 stays the upload's hash (provenance)
    const report = JSON.parse(update.params[5] as string) as {
      promoted: Record<string, unknown>;
      parse: Record<string, unknown>;
    };
    expect(report.promoted).toMatchObject({
      sha256: sha(promoted),
      bytes: promoted.length,
      reencoded: true,
      scanner: { engine: "fake", verdict: "clean" }, // the verdict on the copy that is actually served
    });
    // The re-encoded copy is a new file written by the sandbox: it is scanned in its own right, so the promoted
    // bytes are bytes a scanner examined — not merely bytes derived from ones it examined.
    expect(w.scanner.scannedHashes).toEqual([sha(original), sha(promoted)]);
    // the un-stripped original (with its EXIF) does not outlive the promotion
    expect(w.store.get("quarantine", `${ORG_A}/${id}/upload.bin`)).toBeUndefined();
    expect(report.parse).toMatchObject({
      kind: "image",
      text_available: false,
      ocr: "unavailable",
    });
    const pages = JSON.parse(
      w.statements(/insert into public\.document_pages/)[0]!.params[1] as string,
    ) as unknown[];
    expect(pages).toEqual([
      {
        page_no: 1,
        text: null,
        layout: {
          v: 1,
          kind: "image",
          unit: "px",
          width: 30,
          height: 30,
          format: "png",
          ocr: "unavailable",
        },
      },
    ]);
  });
});

describe("unacceptable files are rejected, stay in quarantine, and are never parsed", () => {
  it("malware: rejected with a reason, a security event, and nothing promoted", async () => {
    const w = world();
    const id = docId();
    const data = Buffer.concat([
      buildPdf([["looks fine"]]),
      Buffer.from(`\n%${FAKE_MALWARE_MARKER}\n`),
    ]);
    w.upload(id, ORG_A, "invoice.pdf", "application/pdf", data);
    w.enqueue(id, ORG_A);
    expect(await w.consumer.pollOnce()).toEqual(["succeeded"]); // rejecting IS the successful outcome of the job

    expect(w.docs.rows.get(id)).toMatchObject({ status: "rejected", storageBucket: "quarantine" });
    expect(served(w)).toEqual([]);
    expect(w.statements(/document_pages|document_cells/)).toHaveLength(0);
    const update = w.statements(/set status = 'rejected'/)[0]!;
    expect(update.params.slice(0, 4)).toEqual([id, ORG_A, "malware_detected", sha(data)]);
    expect(JSON.parse(update.params[4] as string)).toMatchObject({
      scanner: { engine: "fake", verdict: "infected", signature: "Fake.Test.Marker" },
      parse: null,
      promoted: null,
      rejection: { code: "malware_detected", detail: null },
    });
    const event = w.statements(/record_security_event\('scan_rejected'/)[0]!;
    expect(event.params[0]).toBe(ORG_A);
    expect(JSON.parse(event.params[1] as string)).toEqual({
      document_id: id,
      reason: "malware_detected",
      sha256: sha(data),
      engine: "fake",
      signature: "Fake.Test.Marker",
    });
    expect(w.statements(/app\.notify/)[0]!.params[2]).toBe("document_rejected");
  });

  it.each([
    [
      "content is not the declared type",
      "quote.pdf",
      "application/pdf",
      () => buildXlsx(SAMPLE_SHEETS),
      "type_mismatch",
      true,
    ],
    [
      "extension does not match",
      "quote.pdf.exe",
      "application/pdf",
      () => buildPdf([["x"]]),
      "extension_mismatch",
      true,
    ],
    [
      "executable posing as an image",
      "photo.png",
      "image/png",
      () => Buffer.from("MZ\x90\x00\x03\x00\x00\x00", "latin1"),
      "type_mismatch",
      true,
    ],
    [
      "HTML posing as CSV",
      "data.csv",
      "text/csv",
      () => Buffer.from("<html><script>alert(1)</script></html>"),
      "type_mismatch",
      true,
    ],
    [
      "PDF that is also a ZIP",
      "q.pdf",
      "application/pdf",
      () => buildPdf([["x"]], { trailing: buildZip([{ name: "a.js", data: "x" }]) }),
      "polyglot_suspected",
      true,
    ],
    [
      "macro workbook",
      "m.xlsx",
      XLSX_MIME,
      () => buildXlsx(SAMPLE_SHEETS, { extraParts: [{ name: "xl/vbaProject.bin", data: "vba" }] }),
      "macro_enabled",
      true,
    ],
    [
      "zip bomb",
      "b.xlsx",
      XLSX_MIME,
      () =>
        buildZip([
          { name: "[Content_Types].xml", data: Buffer.alloc(4_000_000, 0x20), declaredSize: 64 },
        ]),
      "zip_bomb",
      true,
    ],
    [
      "truncated PDF",
      "cut.pdf",
      "application/pdf",
      () => buildPdf(SAMPLE_PDF_PAGES).subarray(0, 300),
      "corrupt_file",
      false,
    ],
    ["empty file", "empty.pdf", "application/pdf", () => Buffer.alloc(0), "empty_file", false],
  ] as const)("%s → %s", async (_name, filename, mime, make, code, securityEvent) => {
    const w = world();
    const id = docId();
    const data = make();
    w.upload(id, ORG_A, filename, mime, data, { bytes: data.length });
    w.enqueue(id, ORG_A);
    expect(await w.consumer.pollOnce()).toEqual(["succeeded"]);
    expect(w.docs.rows.get(id)).toMatchObject({ status: "rejected", storageBucket: "quarantine" });
    expect((w.statements(/set status = 'rejected'/)[0]!.params[2] as string).startsWith(code)).toBe(
      true,
    );
    expect(w.statements(/record_security_event/)).toHaveLength(securityEvent ? 1 : 0);
    expect(served(w)).toEqual([]);
    expect(w.statements(/document_pages|document_cells|set status = 'parsed'/)).toHaveLength(0);
  });

  it("over the page limit and over the cell limit", async () => {
    const limits = {
      ...(await import("../documents/limits.js")).DEFAULT_SANDBOX_LIMITS,
      maxPdfPages: 3,
      maxCells: 5,
    };
    const w = world({ sandbox: new ProcessSandbox({ limits, timeoutMs: 30_000 }) });
    const p = docId();
    const x = docId();
    w.upload(p, ORG_A, "long.pdf", "application/pdf", buildPdf([["1"], ["2"], ["3"], ["4"]]));
    w.upload(
      x,
      ORG_A,
      "wide.xlsx",
      XLSX_MIME,
      buildXlsx([
        {
          name: "S",
          rows: [
            [1, 2, 3],
            [4, 5, 6],
          ],
        },
      ]),
    );
    w.enqueue(p, ORG_A);
    w.enqueue(x, ORG_A);
    expect(await w.consumer.pollOnce()).toEqual(["succeeded", "succeeded"]);
    const reasons = w.statements(/set status = 'rejected'/).map((q) => q.params[2]);
    expect(reasons).toContain("too_many_pages: 4 pages, limit 3");
    expect(reasons).toContain("too_many_cells: more than 5 cells");
    expect(served(w)).toEqual([]);
  });

  it("an object larger than the cap, or of a different size than registered, is rejected before it is scanned", async () => {
    const w = world();
    const big = docId();
    const lied = docId();
    w.upload(big, ORG_A, "big.pdf", "application/pdf", Buffer.alloc(MAX_DOCUMENT_BYTES + 1, 0x25), {
      bytes: MAX_DOCUMENT_BYTES,
    });
    w.upload(lied, ORG_A, "lied.pdf", "application/pdf", buildPdf([["x"]]), { bytes: 10 });
    w.enqueue(big, ORG_A);
    w.enqueue(lied, ORG_A);
    expect(await w.consumer.pollOnce()).toEqual(["succeeded", "succeeded"]);
    const reasons = w
      .statements(/set status = 'rejected'/)
      .map((q) => (q.params[2] as string).split(":")[0]);
    expect(reasons.sort()).toEqual(["size_mismatch", "too_large"]);
    expect(w.scanner.scanned).toEqual([]);
    expect(served(w)).toEqual([]);
  });
});

describe("infrastructure failures are retried or dead-lettered — never a success, never a verdict", () => {
  it("scanner unavailable: retry, then dead letter; the document stays scanning in quarantine", async () => {
    const w = world();
    const id = docId();
    w.upload(id, ORG_A, "quote.pdf", "application/pdf", buildPdf(SAMPLE_PDF_PAGES));
    const msgId = w.enqueue(id, ORG_A);
    w.scanner.unavailable = { times: 99, reason: "unreachable" };

    const outcomes: string[] = [];
    for (let i = 0; i < 3; i++) {
      outcomes.push(...(await w.consumer.pollOnce()));
      w.queue.advance(120_000);
    }
    expect(outcomes).toEqual(["retry_scheduled", "retry_scheduled", "dead_lettered"]);
    expect(w.docs.rows.get(id)).toMatchObject({ status: "scanning", storageBucket: "quarantine" });
    expect(w.queue.committed).toEqual([]); // no status change, no pages, nothing
    expect(served(w)).toEqual([]);
    expect(w.queue.deadLetters[0]).toMatchObject({ msgId, attempts: 3 });
    expect(w.queue.deadLetters[0]!.error).toBe(
      "TransientDocumentError: scanner_unavailable: unreachable",
    );
    expect(w.queue.openTransactions).toBe(0);
    expect(readdirSync(tmpRoot)).toEqual([]);
  });

  it("scanner timeout, then recovery: the retry processes the document normally", async () => {
    const w = world();
    const id = docId();
    w.upload(id, ORG_A, "quote.pdf", "application/pdf", buildPdf(SAMPLE_PDF_PAGES));
    w.enqueue(id, ORG_A);
    w.scanner.unavailable = { times: 1, reason: "timeout" };
    expect(await w.consumer.pollOnce()).toEqual(["retry_scheduled"]);
    expect(w.queue.ledgerRow(DOCUMENTS_QUEUE, documentJobKey(id))?.error).toBe(
      "TransientDocumentError: scanner_timeout: timeout",
    );
    expect(w.docs.rows.get(id)?.status).toBe("scanning");
    w.queue.advance(10_000);
    expect(await w.consumer.pollOnce()).toEqual(["succeeded"]); // begin() accepts a document already `scanning`
    expect(w.docs.rows.get(id)?.status).toBe("parsed");
    expect(w.statements(/insert into public\.document_pages/)).toHaveLength(1); // written once
  });

  it("parser timeout: the child is killed, the job is retried and dead-lettered, the document is not rejected", async () => {
    const w = world({
      sandbox: new ProcessSandbox({ timeoutMs: 300, entryFile: "testing/hang.mts" }),
      consumer: { maxAttempts: 2 },
    });
    const id = docId();
    w.upload(id, ORG_A, "quote.pdf", "application/pdf", buildPdf(SAMPLE_PDF_PAGES));
    w.enqueue(id, ORG_A);
    expect(await w.consumer.pollOnce()).toEqual(["retry_scheduled"]);
    w.queue.advance(60_000);
    expect(await w.consumer.pollOnce()).toEqual(["dead_lettered"]);
    expect(w.queue.deadLetters[0]!.error).toBe("TransientDocumentError: parser_timeout");
    expect(w.docs.rows.get(id)?.status).toBe("scanning");
    expect(w.queue.committed).toEqual([]);
    expect(served(w)).toEqual([]);
  });

  it("parser returning something that is not the protocol is not trusted", async () => {
    const w = world({
      sandbox: new ProcessSandbox({ timeoutMs: 30_000, entryFile: "testing/invalid.mts" }),
    });
    const id = docId();
    w.upload(id, ORG_A, "quote.pdf", "application/pdf", buildPdf(SAMPLE_PDF_PAGES));
    w.enqueue(id, ORG_A);
    expect(await w.consumer.pollOnce()).toEqual(["retry_scheduled"]);
    expect(w.queue.ledgerRow(DOCUMENTS_QUEUE, documentJobKey(id))?.error).toBe(
      "TransientDocumentError: parser_output_invalid",
    );
    expect(w.docs.rows.get(id)?.status).toBe("scanning");
  });

  it("storage down or object missing: transient", async () => {
    const w = world();
    const down = docId();
    const missing = docId();
    w.upload(down, ORG_A, "a.pdf", "application/pdf", buildPdf([["a"]]));
    w.docs.add({
      id: missing,
      orgId: ORG_A,
      originalFilename: "b.pdf",
      mime: "application/pdf",
      data: Buffer.from("x"),
    });
    w.store.failDownloads = 1;
    w.enqueue(down, ORG_A);
    expect(await w.consumer.pollOnce()).toEqual(["retry_scheduled"]);
    expect(w.queue.ledgerRow(DOCUMENTS_QUEUE, documentJobKey(down))?.error).toMatch(
      /storage_unavailable: download/,
    );
    w.enqueue(missing, ORG_A);
    expect(await w.consumer.pollOnce()).toEqual(["retry_scheduled"]);
    expect(w.queue.ledgerRow(DOCUMENTS_QUEUE, documentJobKey(missing))?.error).toMatch(
      /object_missing/,
    );
    // A job that arrives before its upload changes nothing: the document is still `uploaded`, so the object can
    // still be supplied (the storage policy only accepts it in that state) and the job retried.
    expect(w.docs.rows.get(missing)?.status).toBe("uploaded");
    expect(w.docs.rows.get(down)?.status).toBe("uploaded");
    expect(w.scanner.scanned).toEqual([]);
  });

  it("promotion failing: nothing is recorded as parsed", async () => {
    const w = world();
    const id = docId();
    w.upload(id, ORG_A, "quote.pdf", "application/pdf", buildPdf(SAMPLE_PDF_PAGES));
    w.enqueue(id, ORG_A);
    w.store.failUploads = 1;
    expect(await w.consumer.pollOnce()).toEqual(["retry_scheduled"]);
    expect(w.docs.rows.get(id)?.status).toBe("scanning");
    expect(w.queue.committed).toEqual([]);
    w.queue.advance(10_000);
    expect(await w.consumer.pollOnce()).toEqual(["succeeded"]);
    expect(served(w)).toHaveLength(1);
  });
});

describe("a message cannot reach beyond its own document", () => {
  it("naming another organization's document finds nothing: no download, no write, dead letter", async () => {
    const w = world();
    const id = docId();
    w.upload(id, ORG_A, "confidential-quote.pdf", "application/pdf", buildPdf(SAMPLE_PDF_PAGES));
    const msgId = w.enqueue(id, ORG_B); // B asks for A's document
    expect(await w.consumer.pollOnce()).toEqual(["dead_lettered"]);
    expect(w.queue.deadLetters[0]).toMatchObject({ msgId, attempts: 1 });
    expect(w.queue.deadLetters[0]!.error).toBe(
      "PermanentJobError: document_not_found: no such document in that organization",
    );
    expect(w.store.downloads).toEqual([]);
    expect(w.scanner.scanned).toEqual([]);
    expect(w.queue.committed).toEqual([]);
    expect(w.docs.rows.get(id)?.status).toBe("uploaded"); // untouched

    // an unknown id gets the identical answer — the message cannot tell the two cases apart
    const w2 = world();
    w2.enqueue(docId(), ORG_B);
    await w2.consumer.pollOnce();
    expect(w2.queue.deadLetters[0]!.error).toBe(w.queue.deadLetters[0]!.error);
  });

  it("a row whose path points into another organization's folder is refused before any read", async () => {
    const w = world();
    const id = docId();
    const victim = `${ORG_B}/${docId()}/secret.pdf`;
    w.store.put("quarantine", victim, buildPdf([["B's secret"]]));
    w.docs.add({
      id,
      orgId: ORG_A,
      originalFilename: "x.pdf",
      mime: "application/pdf",
      data: Buffer.from("x"),
      storagePath: victim,
    });
    w.enqueue(id, ORG_A);
    expect(await w.consumer.pollOnce()).toEqual(["dead_lettered"]);
    expect(w.queue.deadLetters[0]!.error).toMatch(/document_path_invalid/);
    expect(w.store.downloads).toEqual([]);

    const served2 = world();
    const id2 = docId();
    served2.docs.add({
      id: id2,
      orgId: ORG_A,
      originalFilename: "x.pdf",
      mime: "application/pdf",
      data: Buffer.from("x"),
      storageBucket: "documents",
    });
    served2.enqueue(id2, ORG_A);
    expect(await served2.consumer.pollOnce()).toEqual(["dead_lettered"]); // never reads from a served bucket
  });

  it.each([
    ["extra field (a path smuggled into the payload)", { storage_path: "x" }, "invalid_payload"],
    ["not uuids", { document_id: "1; drop table documents" }, "invalid_payload"],
  ] as const)("invalid payload: %s", async (_n, extra, code) => {
    const w = world();
    const id = docId();
    w.upload(id, ORG_A, "q.pdf", "application/pdf", buildPdf([["x"]]));
    w.queue.send(
      DOCUMENTS_QUEUE,
      buildEnvelope(DOCUMENT_PROCESS, documentJobKey(id), {
        document_id: id,
        org_id: ORG_A,
        ...extra,
      }),
    );
    expect(await w.consumer.pollOnce()).toEqual(["dead_lettered"]);
    expect(w.queue.deadLetters[0]!.error).toContain(code);
    expect(w.docs.begins).toBe(0);
  });

  it("wrong job type or a key not bound to the document is refused", async () => {
    const w = world();
    const id = docId();
    w.upload(id, ORG_A, "q.pdf", "application/pdf", buildPdf([["x"]]));
    w.queue.send(
      DOCUMENTS_QUEUE,
      buildEnvelope("document.delete", documentJobKey(id), { document_id: id, org_id: ORG_A }),
    );
    w.enqueue(id, ORG_A, "some-other-key-0001");
    expect((await w.consumer.pollOnce()).sort()).toEqual(["dead_lettered", "dead_lettered"]);
    expect(w.queue.deadLetters.map((d) => d.error.split(":")[1]!.trim()).sort()).toEqual([
      "invalid_idempotency_key",
      "unknown_type",
    ]);
    expect(w.docs.begins).toBe(0);
  });
});

describe("duplicates, replays, cancellation", () => {
  it("a replay of a processed document is acknowledged without running; a re-queue is a no-op", async () => {
    const w = world();
    const id = docId();
    w.upload(id, ORG_A, "quote.pdf", "application/pdf", buildPdf(SAMPLE_PDF_PAGES));
    w.enqueue(id, ORG_A);
    expect(await w.consumer.pollOnce()).toEqual(["succeeded"]);
    const after = { committed: w.queue.committed.length, downloads: w.store.downloads.length };

    w.enqueue(id, ORG_A); // same key: the ledger answers
    expect(await w.consumer.pollOnce()).toEqual(["duplicate"]);
    w.enqueue(id, ORG_A, documentJobKey(id, 1)); // re-queue key: the handler sees `parsed` and does nothing
    expect(await w.consumer.pollOnce()).toEqual(["succeeded"]);
    expect(w.queue.committed.length).toBe(after.committed);
    expect(w.store.downloads.length).toBe(after.downloads);
    expect(w.statements(/insert into public\.document_pages/)).toHaveLength(1);
  });

  it("two deliveries for one document at the same time: one runs, the other waits", async () => {
    const w = world();
    const id = docId();
    w.upload(id, ORG_A, "quote.pdf", "application/pdf", buildPdf(SAMPLE_PDF_PAGES));
    w.enqueue(id, ORG_A);
    w.enqueue(id, ORG_A);
    expect((await w.consumer.pollOnce()).sort()).toEqual(["busy", "succeeded"]);
    w.queue.advance(5_000);
    expect(await w.consumer.pollOnce()).toEqual(["duplicate"]);
    expect(w.store.downloads).toHaveLength(1);
    expect(w.statements(/set status = 'parsed'/)).toHaveLength(1);
  });

  it("discarded while being examined: nothing is promoted and nothing is written", async () => {
    const w = world();
    const id = docId();
    w.upload(id, ORG_A, "quote.pdf", "application/pdf", buildPdf(SAMPLE_PDF_PAGES));
    w.store.afterDownload = () => w.docs.setStatus(id, "discarded"); // the owner discards it mid-flight
    w.enqueue(id, ORG_A);
    expect(await w.consumer.pollOnce()).toEqual(["succeeded"]);
    expect(w.docs.rows.get(id)?.status).toBe("discarded");
    expect(served(w)).toEqual([]);
    expect(w.queue.committed).toEqual([]);
  });

  it("discarded between promotion and commit: the commit writes nothing", async () => {
    const w = world();
    const id = docId();
    w.upload(id, ORG_A, "quote.pdf", "application/pdf", buildPdf(SAMPLE_PDF_PAGES));
    const upload = w.store.upload.bind(w.store);
    w.store.upload = async (...args) => {
      await upload(...args);
      w.docs.setStatus(id, "discarded");
    };
    w.enqueue(id, ORG_A);
    expect(await w.consumer.pollOnce()).toEqual(["succeeded"]);
    expect(w.docs.rows.get(id)?.status).toBe("discarded");
    expect(w.statements(/insert into|set status/)).toEqual([]);
    // the copy this job had already promoted is taken back out: a discarded document's bytes are not kept
    expect(served(w)).toEqual([]);
    expect(w.store.removed).toHaveLength(1);
    expect(w.store.removed[0]).toMatch(new RegExp(`^documents/${ORG_A}/${id}/`));
    expect(w.store.get("quarantine", `${ORG_A}/${id}/upload.bin`)).toBeDefined(); // not this job's to delete
  });

  it("housekeeping that fails changes nothing about the outcome", async () => {
    const w = world();
    const id = docId();
    w.upload(id, ORG_A, "quote.pdf", "application/pdf", buildPdf(SAMPLE_PDF_PAGES));
    w.store.failRemoves = 1; // storage is down exactly when the quarantined upload should be removed
    w.enqueue(id, ORG_A);
    expect(await w.consumer.pollOnce()).toEqual(["succeeded"]);
    expect(w.docs.rows.get(id)?.status).toBe("parsed");
    expect(w.queue.deadLetters).toHaveLength(0);
    expect(w.store.get("quarantine", `${ORG_A}/${id}/upload.bin`)).toBeDefined(); // left for the retention sweep
    expect(served(w)).toHaveLength(1);
  });

  it("a rejected document's upload stays in quarantine", async () => {
    const w = world();
    const id = docId();
    w.upload(id, ORG_A, "q.pdf", "application/pdf", buildXlsx(SAMPLE_SHEETS)); // not a PDF
    w.enqueue(id, ORG_A);
    expect(await w.consumer.pollOnce()).toEqual(["succeeded"]);
    expect(w.docs.rows.get(id)?.status).toBe("rejected");
    expect(w.store.removed).toEqual([]);
    expect(w.store.get("quarantine", `${ORG_A}/${id}/upload.bin`)).toBeDefined();
  });
});

describe("the re-encoded image is untrusted until it has been checked and scanned itself", () => {
  const png = () =>
    sharp({ create: { width: 12, height: 12, channels: 3, background: { r: 1, g: 2, b: 3 } } })
      .png()
      .toBuffer();

  /** A sandbox that reports a perfectly valid image result but writes whatever it likes as the "re-encoded" file. */
  function forgingSandbox(output: Buffer): ParserSandbox {
    return {
      isolation: "process",
      async parse(_kind, _input, outputPath) {
        writeFileSync(outputPath!, output);
        return Promise.resolve({
          ok: true,
          result: {
            kind: "image",
            format: "png",
            width: 12,
            height: 12,
            outputBytes: output.length,
            flags: ["metadata_stripped", "ocr_unavailable"],
          },
        });
      },
      probe: () => Promise.reject(new Error("not used")),
    };
  }

  it("a re-encoded copy the scanner flags is never promoted: the document is rejected", async () => {
    const w = world();
    const id = docId();
    w.upload(id, ORG_A, "label.png", "image/png", await png());
    w.scanner.infectScan = 2; // the upload scans clean; the copy the sandbox wrote does not
    w.enqueue(id, ORG_A);
    expect(await w.consumer.pollOnce()).toEqual(["succeeded"]);
    expect(w.docs.rows.get(id)).toMatchObject({ status: "rejected", storageBucket: "quarantine" });
    expect(w.statements(/set status = 'rejected'/)[0]!.params[2]).toBe(
      "malware_detected: re-encoded copy",
    );
    expect(w.statements(/record_security_event/)).toHaveLength(1);
    expect(served(w)).toEqual([]);
  });

  it("a scanner that cannot answer for the copy stops the promotion (retry), like any other scan", async () => {
    const w = world();
    const id = docId();
    w.upload(id, ORG_A, "label.png", "image/png", await png());
    w.scanner.unavailableOnScan = 2;
    w.enqueue(id, ORG_A);
    expect(await w.consumer.pollOnce()).toEqual(["retry_scheduled"]);
    expect(w.docs.rows.get(id)?.status).toBe("scanning");
    expect(served(w)).toEqual([]);
    expect(w.queue.committed).toEqual([]);
  });

  it.each([
    ["an executable", Buffer.from("MZ\x90\x00\x03\x00\x00\x00\x04\x00 not an image", "latin1")],
    ["HTML", Buffer.from("<html><script>alert(1)</script></html>")],
    [
      "a different image type",
      Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(32)]),
    ],
  ])("a sandbox that hands back %s instead of the image is not believed", async (_what, forged) => {
    const w = world({ sandbox: forgingSandbox(forged) });
    const id = docId();
    w.upload(id, ORG_A, "label.png", "image/png", await png());
    w.enqueue(id, ORG_A);
    expect(await w.consumer.pollOnce()).toEqual(["retry_scheduled"]);
    expect(w.queue.ledgerRow(DOCUMENTS_QUEUE, documentJobKey(id))?.error).toBe(
      "TransientDocumentError: parser_output_invalid: re-encoded file is not the expected image",
    );
    expect(served(w)).toEqual([]);
    expect(w.scanner.scannedHashes).toHaveLength(1); // the forged file is not even worth a scan
    expect(w.docs.rows.get(id)?.status).toBe("scanning");
  });

  it("a forged copy that is a PNG with a ZIP archive appended is refused too", async () => {
    const forged = Buffer.concat([await png(), buildZip([{ name: "payload.js", data: "x" }])]);
    const w = world({ sandbox: forgingSandbox(forged) });
    const id = docId();
    w.upload(id, ORG_A, "label.png", "image/png", await png());
    w.enqueue(id, ORG_A);
    expect(await w.consumer.pollOnce()).toEqual(["retry_scheduled"]);
    expect(served(w)).toEqual([]);
  });
});

describe("logs", () => {
  it("carry ids, codes and counts — never file names, file content or keys", () => {
    const all = logLines.join("");
    expect(all).toContain("document examined and promoted");
    expect(all).toContain("document rejected");
    for (const secret of [
      "USD 1.25",
      "单价",
      "8.50",
      "织唛标签",
      "confidential-quote",
      "Quote 2026",
      "B's secret",
      "EXIF-OWNER-MARK",
      FAKE_MALWARE_MARKER,
      "input.bin",
    ]) {
      expect(all.includes(secret), secret).toBe(false);
    }
  });
});
