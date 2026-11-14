/**
 * The parser sandbox, for real: these tests start the restricted child process (no mocks) and check both that it
 * parses and that it is contained. They run on every platform the suite runs on (Windows locally, Linux in CI).
 */
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DEFAULT_SANDBOX_LIMITS } from "./limits.js";
import type { ValidProbeResult } from "./results.js";
import { ProcessSandbox, SandboxFailure, assessContainment, verifyContainment } from "./runner.js";
import {
  SAMPLE_CSV,
  SAMPLE_PDF_PAGES,
  SAMPLE_SHEETS,
  buildPdf,
  buildXlsx,
  buildZip,
} from "./testing/fixtures.js";

let dir: string;
const sandbox = new ProcessSandbox({ timeoutMs: 30_000 });

function file(name: string, data: Buffer | string): string {
  const p = path.join(dir, name);
  writeFileSync(p, data);
  return p;
}

beforeAll(() => {
  dir = mkdtempSync(path.join(tmpdir(), "fbg-sandbox-test-"));
});
afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("containment (measured by the probe inside the child)", () => {
  it("denies file access outside the allow-list, writes, processes, threads, network, eval and secrets", async () => {
    process.env.FBG_TEST_SERVICE_ROLE_KEY = "must-not-reach-the-child";
    try {
      const report = await verifyContainment(sandbox);
      expect(report.breaches).toEqual([]);
      expect(report.contained).toBe(true);
      expect(report.probe.permissionModel).toBe(true);
      expect(report.probe.envNames).not.toContain("FBG_TEST_SERVICE_ROLE_KEY");
      // POSIX: the child's environment is empty. Windows: libuv always passes these system variables down
      // (the process cannot start without some of them); none is a credential and nothing else gets through.
      const windowsBaseline = [
        "HOMEDRIVE",
        "HOMEPATH",
        "LOGONSERVER",
        "PATH",
        "SYSTEMDRIVE",
        "SYSTEMROOT",
        "TEMP",
        "USERDOMAIN",
        "USERNAME",
        "USERPROFILE",
        "WINDIR",
      ];
      const unexpected = report.probe.envNames.filter(
        (name) => !(process.platform === "win32" && windowsBaseline.includes(name.toUpperCase())),
      );
      expect(unexpected).toEqual([]);
    } finally {
      delete process.env.FBG_TEST_SERVICE_ROLE_KEY;
    }
  });

  it("reports a breach for every check that is not denied (no silent pass)", () => {
    const base: ValidProbeResult = {
      fsRead: "denied",
      fsWrite: "denied",
      childProcess: "denied",
      workerThread: "denied",
      netFetch: "denied",
      netTcp: "denied",
      netUdp: "denied",
      netDns: "denied",
      codeGeneration: "denied",
      secretVisible: false,
      envNames: [],
      permissionModel: true,
      nodeVersion: "v0",
      platform: "test",
    };
    expect(assessContainment(base).contained).toBe(true);
    expect(assessContainment({ ...base, netTcp: "allowed" }).breaches).toEqual(["netTcp"]);
    expect(assessContainment({ ...base, fsRead: "allowed", secretVisible: true }).breaches).toEqual(
      ["fsRead", "secretVisible"],
    );
    expect(assessContainment({ ...base, permissionModel: false }).contained).toBe(false);
  });
});

describe("parsing through the sandbox", () => {
  it("reads English and Chinese text with page anchors from a PDF", async () => {
    const res = await sandbox.parse("pdf", file("quote.pdf", buildPdf(SAMPLE_PDF_PAGES)), null);
    expect(res.ok).toBe(true);
    if (!res.ok || res.result.kind !== "pdf") throw new Error("expected a pdf result");
    expect(res.result.pageCount).toBe(2);
    const [p1, p2] = res.result.pages;
    expect(p1!.text).toContain("Unit price: USD 1.25 FOB Shenzhen");
    expect(p1!.text.replace(/\s/g, "")).toContain("单价人民币8.50元含税");
    expect(p2!.text.replace(/\s/g, "")).toContain("交货期30天");
    expect([p1!.width, p1!.height]).toEqual([595, 842]);
    const price = p1!.items.find((i) => i[4].includes("USD 1.25"));
    expect(price?.slice(0, 2)).toEqual([72, 760]); // where the fixture drew that line
    expect(res.result.flags).toEqual([]);
  });

  it("is deterministic: the same file gives the same anchors", async () => {
    const p = file("again.pdf", buildPdf(SAMPLE_PDF_PAGES));
    const a = await sandbox.parse("pdf", p, null);
    const b = await sandbox.parse("pdf", p, null);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("reads XLSX cells as cached values and never calculates a formula", async () => {
    const res = await sandbox.parse("xlsx", file("quote.xlsx", buildXlsx(SAMPLE_SHEETS)), null);
    if (!res.ok || res.result.kind !== "sheet") throw new Error("expected a sheet result");
    const { sheets, cells, flags } = res.result;
    expect(sheets.map((s) => s.name)).toEqual(["报价 Quote", "Notes"]);
    const at = (s: number, r: number, c: number) =>
      cells.find((x) => x.s === s && x.r === r && x.c === c);
    expect(at(0, 2, 1)).toMatchObject({ v: "织唛标签", t: "s" });
    expect(at(0, 2, 4)).toMatchObject({ v: "0.085", t: "n" });
    expect(at(0, 2, 5)).toMatchObject({ v: "425", t: "n", f: 1 }); // the cached result the file carries
    expect(at(0, 3, 5)).toEqual({ s: 0, r: 3, c: 5, v: null, t: "n", f: 1 }); // no cached result: missing, not computed
    expect(at(0, 2, 6)).toMatchObject({ v: "46387", d: "2026-12-31" });
    expect(at(0, 3, 6)).toMatchObject({ v: "46387", d: "2026-12-31", z: 'yyyy"年"m"月"d"日"' });
    expect(at(1, 1, 1)?.v).toBe("含税，不含运费 / tax included, freight excluded");
    expect(flags).toEqual(["formula_without_cached_value", "formulas_present"]);
  });

  it("reads CSV fields as text with row/column anchors", async () => {
    const res = await sandbox.parse("csv", file("quote.csv", SAMPLE_CSV), null);
    if (!res.ok || res.result.kind !== "sheet") throw new Error("expected a sheet result");
    expect(res.result.encoding).toBe("utf-8");
    expect(res.result.delimiter).toBe(",");
    expect(res.result.cells.find((c) => c.r === 2 && c.c === 1)?.v).toBe("Woven label, 20x50mm");
    expect(res.result.cells.find((c) => c.r === 3 && c.c === 2)?.v).toBe("吊牌");
    expect(res.result.cells).toHaveLength(12);
  });

  it("re-encodes an image, dropping metadata and anything appended to it", async () => {
    const original = await sharp({
      create: { width: 40, height: 20, channels: 3, background: { r: 200, g: 30, b: 30 } },
    })
      .withExif({ IFD0: { Copyright: "SECRET-EXIF-OWNER", Artist: "someone" } })
      .jpeg()
      .toBuffer();
    expect(original.includes("SECRET-EXIF-OWNER")).toBe(true);
    const polyglot = Buffer.concat([original, Buffer.from("<script>alert(1)</script>TRAILING")]);
    const out = path.join(dir, "out.jpg");
    const res = await sandbox.parse("jpeg", file("photo.jpg", polyglot), out);
    if (!res.ok || res.result.kind !== "image") throw new Error("expected an image result");
    const encoded = readFileSync(out);
    expect(res.result).toMatchObject({ format: "jpeg", width: 40, height: 20 });
    expect(res.result.outputBytes).toBe(encoded.length);
    expect(res.result.flags).toEqual(["metadata_stripped", "ocr_unavailable"]);
    expect(encoded.includes("SECRET-EXIF-OWNER")).toBe(false);
    expect(encoded.includes("TRAILING")).toBe(false);
    expect((await sharp(encoded).metadata()).exif).toBeUndefined();
    expect(createHash("sha256").update(encoded).digest("hex")).not.toBe(
      createHash("sha256").update(polyglot).digest("hex"),
    );
  });

  it("refuses an image whose pixels are not the declared format", async () => {
    const png = await sharp({
      create: { width: 4, height: 4, channels: 3, background: { r: 0, g: 0, b: 0 } },
    })
      .png()
      .toBuffer();
    const res = await sandbox.parse("jpeg", file("really.png", png), path.join(dir, "o2.jpg"));
    expect(res).toMatchObject({ ok: false, code: "type_mismatch" });
  });
});

describe("refusals come back as codes, not crashes", () => {
  const limits = { ...DEFAULT_SANDBOX_LIMITS, maxPdfPages: 5, maxCells: 20 };
  const strict = new ProcessSandbox({ limits, timeoutMs: 30_000 });

  it("too many pages", async () => {
    const pages = Array.from({ length: 6 }, (_, i) => [`page ${i + 1}`]);
    const res = await strict.parse("pdf", file("six.pdf", buildPdf(pages)), null);
    expect(res).toEqual({ ok: false, code: "too_many_pages", detail: "6 pages, limit 5" });
  });

  it("too many cells", async () => {
    const rows = Array.from({ length: 7 }, (_, r) => [r, r + 1, r + 2]);
    const res = await strict.parse(
      "xlsx",
      file("big.xlsx", buildXlsx([{ name: "S", rows }])),
      null,
    );
    expect(res).toMatchObject({ ok: false, code: "too_many_cells" });
  });

  it("the real caps: a 600-page PDF is refused, a 500-page PDF is read (BACKLOG B-12)", async () => {
    const pages = (n: number) => Array.from({ length: n }, (_, i) => [`page ${i + 1}`]);
    const over = await sandbox.parse("pdf", file("600.pdf", buildPdf(pages(600))), null);
    expect(over).toEqual({ ok: false, code: "too_many_pages", detail: "600 pages, limit 500" });
    const at = await sandbox.parse("pdf", file("500.pdf", buildPdf(pages(500))), null);
    if (!at.ok || at.result.kind !== "pdf") throw new Error("expected a pdf result");
    expect(at.result.pageCount).toBe(500);
    expect(at.result.pages[499]!.text).toBe("page 500");
  }, 60_000);

  it("the real caps: 50,001 cells are refused, 50,000 are read", async () => {
    const rows = (n: number) => Array.from({ length: n }, (_, r) => [r, r, r, r, r]);
    const overRows = [...rows(10_000), [1]];
    const over = await sandbox.parse(
      "xlsx",
      file("50001.xlsx", buildXlsx([{ name: "S", rows: overRows }])),
      null,
    );
    expect(over).toEqual({ ok: false, code: "too_many_cells", detail: "more than 50000 cells" });
    const at = await sandbox.parse(
      "xlsx",
      file("50000.xlsx", buildXlsx([{ name: "S", rows: rows(10_000) }])),
      null,
    );
    if (!at.ok || at.result.kind !== "sheet") throw new Error("expected a sheet result");
    expect(at.result.cells).toHaveLength(50_000);
  }, 60_000);

  it("a result too large to hand back is a verdict about the file, not a crash", async () => {
    const tiny = new ProcessSandbox({
      limits: { ...DEFAULT_SANDBOX_LIMITS, maxResponseChars: 400 },
      timeoutMs: 30_000,
    });
    const res = await tiny.parse("csv", file("wide.csv", SAMPLE_CSV.repeat(10)), null);
    expect(res).toEqual({
      ok: false,
      code: "output_too_large",
      detail: "response larger than 400 characters",
    });
    // control characters cost six characters each once serialized: 20 kB of them is a 120 kB answer
    const control = file(
      "ctl.csv",
      Buffer.concat([Buffer.from("a,b\n"), Buffer.alloc(20_000, 0x01)]),
    );
    const capped = new ProcessSandbox({
      limits: { ...DEFAULT_SANDBOX_LIMITS, maxResponseChars: 100_000 },
      timeoutMs: 30_000,
    });
    expect(await capped.parse("csv", control, null)).toMatchObject({
      ok: false,
      code: "output_too_large",
    });
  });

  it("a PDF with a coordinate that is not a finite number is refused as corrupt", async () => {
    const huge = "9".repeat(400);
    const pdf = buildPdf([["first line"]], {
      rawFirstPageContent: `BT /F1 12 Tf ${huge} 700 Td (far away) Tj ET`,
    });
    const res = await sandbox.parse("pdf", file("inf.pdf", pdf), null);
    expect(res).toMatchObject({ ok: false, code: "corrupt_file" });
  });

  it("truncated and garbage PDFs", async () => {
    const pdf = buildPdf(SAMPLE_PDF_PAGES);
    const truncated = await strict.parse("pdf", file("cut.pdf", pdf.subarray(0, 200)), null);
    expect(truncated).toMatchObject({ ok: false, code: "corrupt_file" });
    const garbage = await strict.parse("pdf", file("junk.pdf", "%PDF-1.7\nnot a pdf at all"), null);
    expect(garbage).toMatchObject({ ok: false, code: "corrupt_file" });
  });

  it("macro-enabled workbooks", async () => {
    const withVba = buildXlsx(SAMPLE_SHEETS, {
      extraParts: [{ name: "xl/vbaProject.bin", data: Buffer.from("macro bytes") }],
    });
    expect(await strict.parse("xlsx", file("m.xlsx", withVba), null)).toMatchObject({
      ok: false,
      code: "macro_enabled",
    });
  });

  it("a decompression bomb costs at most the budget", async () => {
    const bomb = buildZip([
      { name: "[Content_Types].xml", data: Buffer.alloc(8 * 1024 * 1024, 0x20), declaredSize: 512 },
    ]);
    expect(await strict.parse("xlsx", file("bomb.xlsx", bomb), null)).toMatchObject({
      ok: false,
      code: "zip_bomb",
    });
  });
});

describe("a child that misbehaves is an infrastructure failure, never a result", () => {
  it("is killed at the timeout", async () => {
    const slow = new ProcessSandbox({ timeoutMs: 400, entryFile: "testing/hang.mts" });
    const started = Date.now();
    await expect(slow.probe()).rejects.toMatchObject({ name: "SandboxFailure", reason: "timeout" });
    expect(Date.now() - started).toBeLessThan(5_000);
  });

  it("is killed when the caller aborts", async () => {
    const slow = new ProcessSandbox({ timeoutMs: 30_000, entryFile: "testing/hang.mts" });
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 200);
    await expect(slow.probe(controller.signal)).rejects.toMatchObject({ reason: "aborted" });
  });

  it("is killed when it floods stdout", async () => {
    const noisy = new ProcessSandbox({
      timeoutMs: 30_000,
      maxStdoutBytes: 1024 * 1024,
      entryFile: "testing/flood.mts",
    });
    await expect(noisy.probe()).rejects.toMatchObject({ reason: "output_too_large" });
  });

  it("is refused when its output does not satisfy the schema", async () => {
    const liar = new ProcessSandbox({ timeoutMs: 30_000, entryFile: "testing/invalid.mts" });
    const p = file("x.pdf", buildPdf([["x"]]));
    await expect(liar.parse("pdf", p, null)).rejects.toMatchObject({ reason: "output_invalid" });
  });

  it("is refused when it answers a different question (a sheet for a PDF job)", async () => {
    const swapped = new ProcessSandbox({ timeoutMs: 30_000, entryFile: "testing/wrongkind.mts" });
    const p = file("y.pdf", buildPdf([["y"]]));
    await expect(swapped.parse("pdf", p, null)).rejects.toMatchObject({ reason: "output_invalid" });
    // the same well-formed answer is accepted for the job it actually belongs to
    const csv = file("y.csv", "smuggled\n");
    await expect(swapped.parse("csv", csv, null)).resolves.toMatchObject({ ok: true });
    await expect(swapped.parse("xlsx", csv, null)).rejects.toMatchObject({
      reason: "output_invalid",
    });
  });

  it("dies at the heap ceiling instead of taking the worker's memory", async () => {
    const hungry = new ProcessSandbox({
      timeoutMs: 60_000,
      heapMb: 64,
      entryFile: "testing/memory.mts",
    });
    const err = await hungry.probe().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(SandboxFailure);
    expect((err as SandboxFailure).reason).toBe("crashed");
  }, 90_000);
});
