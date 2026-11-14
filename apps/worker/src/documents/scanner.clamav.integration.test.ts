/**
 * ClamdScanner × a REAL ClamAV daemon (B-13). This is the test that lets anyone say "malware scanning works": the
 * EICAR test file must come back infected and ordinary files clean, from an actual engine with an actual signature
 * database. It runs only through vitest.clamav.config.ts with CLAMAV_HOST / CLAMAV_PORT pointing at clamd, and it
 * fails — never skips — when they are missing, so a green run always means a real scan happened.
 *
 * Locally:  docker run -d -p 127.0.0.1:3310:3310 clamav/clamav:stable
 *           CLAMAV_HOST=127.0.0.1 CLAMAV_PORT=3310 pnpm --filter @fbg/worker test:clamav
 *
 * The EICAR string is assembled in memory (testing/fixtures.ts) and written only to a temp file that is deleted at
 * the end; an on-access antivirus on the developer's machine may remove that file first, in which case the scanner
 * reports "unavailable" and the test fails loudly rather than passing.
 */
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MAX_DOCUMENT_BYTES } from "./limits.js";
import { ClamdScanner } from "./scanner.js";
import {
  SAMPLE_CSV,
  SAMPLE_PDF_PAGES,
  SAMPLE_SHEETS,
  buildPdf,
  buildXlsx,
  eicarTestFile,
} from "./testing/fixtures.js";

const host = process.env.CLAMAV_HOST;
const port = Number(process.env.CLAMAV_PORT ?? "");
if (host === undefined || host === "" || !Number.isInteger(port) || port < 1) {
  throw new Error(
    "CLAMAV_HOST / CLAMAV_PORT are not set: the ClamAV integration suite needs a real clamd (it never skips silently)",
  );
}

const scanner = new ClamdScanner({ host, port, timeoutMs: 120_000 });
let dir: string;
const file = (name: string, data: Buffer | string): string => {
  const p = path.join(dir, name);
  writeFileSync(p, data);
  return p;
};

beforeAll(() => {
  dir = mkdtempSync(path.join(tmpdir(), "fbg-clamav-itest-"));
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe("real ClamAV", () => {
  it("reports its engine and signature database version", async () => {
    expect(await scanner.version()).toMatch(/^ClamAV \d+\.\d+/);
  });

  it("detects the EICAR test file", async () => {
    const verdict = await scanner.scanFile(file("eicar.bin", eicarTestFile()));
    expect(verdict.verdict).toBe("infected");
    if (verdict.verdict !== "infected") return;
    expect(verdict.signature).toMatch(/eicar/i);
    expect(verdict.engineVersion).toMatch(/^ClamAV/);
  });

  it("detects EICAR inside an otherwise ordinary archive-shaped upload", async () => {
    const { buildZip } = await import("./testing/fixtures.js");
    const zip = buildZip([{ name: "invoice.txt", data: eicarTestFile(), store: true }]);
    expect((await scanner.scanFile(file("wrapped.zip", zip))).verdict).toBe("infected");
  });

  it("still sees a payload hidden behind as much padding as the worker's own archive budget allows", async () => {
    // The risk: a scanner with ordinary limits stops unpacking a large archive part-way and answers "OK" for what
    // it did see. The pipeline's ZIP budget (64 MB per part, 128 MB declared in total — limits.ts) is meant to sit
    // inside ClamAV's defaults, so that nothing the worker would accept is too big for the scanner to finish.
    // This is that claim, measured: two 60 MB padding parts FIRST, then the test file.
    const { buildZip } = await import("./testing/fixtures.js");
    const padding = Buffer.alloc(60 * 1024 * 1024);
    const zip = buildZip([
      { name: "xl/media/pad1.bin", data: padding },
      { name: "xl/media/pad2.bin", data: padding },
      { name: "xl/media/payload.bin", data: eicarTestFile(), store: true },
    ]);
    expect(zip.length).toBeLessThan(1024 * 1024); // well under the upload cap: this is a realistic upload size
    const verdict = await scanner.scanFile(file("padded.xlsx", zip));
    expect(verdict.verdict).toBe("infected");
  }, 180_000);

  it("passes the synthetic PDF, XLSX and CSV samples as clean", async () => {
    for (const [name, data] of [
      ["quote.pdf", buildPdf(SAMPLE_PDF_PAGES)],
      ["quote.xlsx", buildXlsx(SAMPLE_SHEETS)],
      ["quote.csv", Buffer.from(SAMPLE_CSV)],
    ] as const) {
      expect(await scanner.scanFile(file(name, data)), name).toMatchObject({ verdict: "clean" });
    }
  });

  it("scans a file at the 25 MB upload cap without hitting the daemon's stream limit", async () => {
    const verdict = await scanner.scanFile(file("cap.bin", Buffer.alloc(MAX_DOCUMENT_BYTES, 0x20)));
    expect(verdict.verdict).toBe("clean");
  }, 180_000);
});
