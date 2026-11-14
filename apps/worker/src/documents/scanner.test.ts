/**
 * Scanner contract and ClamdScanner wire handling, against a fake clamd (testing/fakes.ts). The fake is NOT a virus
 * scanner; real detection is proven separately by scanner.clamav.integration.test.ts against a real ClamAV daemon.
 */
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  ClamdScanner,
  ScannerUnavailableError,
  UnconfiguredScanner,
  parseClamdReply,
  sanitizeSignature,
} from "./scanner.js";
import { closedPort, startFakeClamd, type FakeClamdBehaviour } from "./testing/fakes.js";
import { FAKE_MALWARE_MARKER } from "./testing/fixtures.js";

let dir: string;
let clean: string;
let marked: string;
let large: string;

beforeAll(() => {
  dir = mkdtempSync(path.join(tmpdir(), "fbg-scan-test-"));
  clean = path.join(dir, "clean.bin");
  marked = path.join(dir, "marked.bin");
  large = path.join(dir, "large.bin");
  writeFileSync(clean, "an ordinary file");
  writeFileSync(marked, `prefix ${FAKE_MALWARE_MARKER} suffix`);
  writeFileSync(large, Buffer.alloc(300_000, 0x61)); // several INSTREAM chunks
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

async function withClamd<T>(
  behaviour: FakeClamdBehaviour,
  fn: (scanner: ClamdScanner, received: () => Buffer) => Promise<T>,
  timeoutMs = 2_000,
): Promise<T> {
  const fake = await startFakeClamd(behaviour);
  try {
    return await fn(
      new ClamdScanner({ host: "127.0.0.1", port: fake.port, timeoutMs }),
      fake.received,
    );
  } finally {
    await fake.close();
  }
}

const unavailable = (reason: string) => ({ name: "ScannerUnavailableError", reason });

describe("clamd reply parsing", () => {
  it("recognizes exactly OK and FOUND; everything else is not a verdict", () => {
    expect(parseClamdReply("stream: OK\0")).toEqual({ verdict: "clean" });
    expect(parseClamdReply("stream: Win.Test.EICAR_HDB-1 FOUND")).toEqual({
      verdict: "infected",
      signature: "Win.Test.EICAR_HDB-1",
    });
    expect(parseClamdReply("INSTREAM size limit exceeded. ERROR")).toEqual({ error: "size_limit" });
    expect(parseClamdReply("stream: Can't allocate memory ERROR")).toEqual({ error: "protocol" });
    expect(parseClamdReply("")).toEqual({ error: "protocol" });
    expect(parseClamdReply("OK")).toEqual({ error: "protocol" });
    expect(parseClamdReply("stream: OK and more")).toEqual({ error: "protocol" });
  });

  it("reduces signature names to a safe character set", () => {
    expect(sanitizeSignature("Win.Trojan.Agent-123")).toBe("Win.Trojan.Agent-123");
    expect(sanitizeSignature('evil"\n<script>')).toBe("evil___script_");
    expect(sanitizeSignature("")).toBe("unknown");
    expect(sanitizeSignature("x".repeat(500))).toHaveLength(128);
  });
});

describe("ClamdScanner over the INSTREAM protocol", () => {
  it("streams the whole file in framed chunks and returns clean", async () => {
    await withClamd("normal", async (scanner, received) => {
      expect(await scanner.scanFile(large)).toEqual({
        verdict: "clean",
        engine: "clamav",
        engineVersion: "ClamAV 0.0.0/fake/Thu Jan  1 00:00:00 1970",
      });
      expect(received().length).toBe(300_000);
      expect(received().every((b) => b === 0x61)).toBe(true);
    });
  });

  it("returns infected with the engine's signature name", async () => {
    await withClamd("normal", async (scanner) => {
      expect(await scanner.scanFile(marked)).toMatchObject({
        verdict: "infected",
        signature: "Fake.Test.Marker",
      });
    });
  });

  it.each<[FakeClamdBehaviour, string]>([
    ["error_reply", "protocol"],
    ["garbage", "protocol"],
    ["size_limit", "size_limit"],
    ["drop", "unreachable"],
    // "OK" before the file has been sent is not a verdict about the file
    ["early_ok", "protocol"],
  ])("fails closed when the daemon answers %s", async (behaviour, reason) => {
    await withClamd(behaviour, async (scanner) => {
      await expect(scanner.scanFile(clean)).rejects.toMatchObject(unavailable(reason));
    });
  });

  it("fails closed on a daemon that never answers (timeout)", async () => {
    await withClamd(
      "hang",
      async (scanner) => {
        const started = Date.now();
        await expect(scanner.scanFile(clean)).rejects.toMatchObject(unavailable("timeout"));
        expect(Date.now() - started).toBeLessThan(3_000);
      },
      300,
    );
  });

  it("fails closed when nothing is listening", async () => {
    const scanner = new ClamdScanner({
      host: "127.0.0.1",
      port: await closedPort(),
      timeoutMs: 2_000,
    });
    await expect(scanner.scanFile(clean)).rejects.toMatchObject(unavailable("unreachable"));
  });

  it("fails closed when the caller aborts", async () => {
    await withClamd(
      "hang",
      async (scanner) => {
        const controller = new AbortController();
        setTimeout(() => controller.abort(), 100);
        await expect(scanner.scanFile(clean, controller.signal)).rejects.toMatchObject(
          unavailable("aborted"),
        );
      },
      5_000,
    );
  });

  it("validates its options", () => {
    expect(() => new ClamdScanner({ host: "", port: 3310 })).toThrow(/host/);
    expect(() => new ClamdScanner({ host: "x", port: 0 })).toThrow(/port/);
    expect(() => new ClamdScanner({ host: "x", port: 70_000 })).toThrow(/port/);
  });
});

describe("no scanner configured", () => {
  it("never returns a verdict", async () => {
    const err = await new UnconfiguredScanner().scanFile().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ScannerUnavailableError);
    expect((err as ScannerUnavailableError).reason).toBe("not_configured");
  });
});
