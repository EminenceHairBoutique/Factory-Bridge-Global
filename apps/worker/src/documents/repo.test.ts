/**
 * The commit-stage SQL helpers against a scripted transaction: what they do when the document is no longer
 * `scanning`, and how inserts are batched. The statements themselves run for real in
 * handlers/documents.integration.test.ts.
 */
import { describe, expect, it } from "vitest";
import type { SqlClient } from "../ai/store.js";
import { finalizeParsed, finalizeRejected, jsonBatches } from "./repo.js";

const DOC = "d0000000-0000-4000-8000-000000000001";
const ORG = "a0000000-0000-4000-8000-000000000001";
const SHA = "b".repeat(64);

function tx(status: string | null): {
  client: SqlClient;
  calls: { text: string; params: readonly unknown[] }[];
} {
  const calls: { text: string; params: readonly unknown[] }[] = [];
  const client: SqlClient = {
    query<T>(text: string, params: readonly unknown[]): Promise<T[]> {
      calls.push({ text, params });
      if (/for update/.test(text))
        return Promise.resolve((status === null ? [] : [{ status }]) as T[]);
      if (/returning id/.test(text)) return Promise.resolve([{ id: DOC }] as T[]);
      return Promise.resolve([]);
    },
  };
  return { client, calls };
}

const rejection = {
  documentId: DOC,
  orgId: ORG,
  uploadedBy: null,
  code: "malware_detected" as const,
  detail: null,
  sha256: SHA,
  scanResult: {},
  securityEvent: { engine: "clamav", signature: "Test.Sig" },
};

describe("finalize when the document is no longer scanning", () => {
  it("parsed: writes nothing", async () => {
    for (const status of ["parsed", "rejected", "discarded", null]) {
      const { client, calls } = tx(status);
      const result = await finalizeParsed(client, {
        documentId: DOC,
        orgId: ORG,
        uploadedBy: null,
        sha256: SHA,
        promotedBucket: "documents",
        promotedPath: `${ORG}/${DOC}/x.pdf`,
        scanResult: {},
        pageCount: 1,
        pages: [{ page_no: 1, text: "t", layout: {} }],
        cells: [],
      });
      expect(result).toBe("skipped");
      expect(calls).toHaveLength(1); // the lock, and nothing after it
    }
  });

  it("rejected for malware on a document already parsed: its state is left alone, but the detection is recorded", async () => {
    const { client, calls } = tx("parsed");
    expect(await finalizeRejected(client, rejection)).toBe("skipped");
    expect(calls.filter((c) => /update public\.documents/.test(c.text))).toHaveLength(0);
    const event = calls.find((c) => /record_security_event\('scan_rejected'/.test(c.text))!;
    expect(event.params[0]).toBe(ORG);
    expect(JSON.parse(event.params[1] as string)).toEqual({
      document_id: DOC,
      reason: "malware_detected",
      sha256: SHA,
      engine: "clamav",
      signature: "Test.Sig",
      late_detection: true,
      document_status: "parsed",
    });
  });

  it("rejected for any other reason, or for a document that does not exist: nothing at all", async () => {
    const other = tx("parsed");
    await finalizeRejected(other.client, {
      ...rejection,
      code: "corrupt_file",
      securityEvent: null,
    });
    expect(other.calls).toHaveLength(1);
    const missing = tx(null);
    expect(await finalizeRejected(missing.client, rejection)).toBe("skipped");
    expect(missing.calls).toHaveLength(1);
  });

  it("while scanning: rejected with the reason, the security event and no late flag", async () => {
    const { client, calls } = tx("scanning");
    expect(await finalizeRejected(client, rejection)).toBe("written");
    const update = calls.find((c) => /set status = 'rejected'/.test(c.text))!;
    expect(update.params.slice(0, 4)).toEqual([DOC, ORG, "malware_detected", SHA]);
    const event = calls.find((c) => /record_security_event/.test(c.text))!;
    expect(JSON.parse(event.params[1] as string)).not.toHaveProperty("late_detection");
  });
});

describe("insert batching", () => {
  it("bounds batches by row count and by serialized size, and loses nothing", () => {
    expect(jsonBatches([])).toEqual([]);
    const small = Array.from({ length: 6_000 }, (_, i) => ({ row_no: i }));
    const bySmall = jsonBatches(small);
    expect(bySmall.map((b) => (JSON.parse(b) as unknown[]).length)).toEqual([2_500, 2_500, 1_000]);

    // 30 cells of 300 kB each: under the row limit, far over the size limit for one statement
    const big = Array.from({ length: 30 }, (_, i) => ({ row_no: i, raw: "x".repeat(300_000) }));
    const byBig = jsonBatches(big);
    expect(byBig.length).toBeGreaterThanOrEqual(5);
    expect(Math.max(...byBig.map((b) => b.length))).toBeLessThanOrEqual(2_000_000 + 300_100);
    const back = byBig.flatMap((b) => JSON.parse(b) as { row_no: number }[]);
    expect(back.map((r) => r.row_no)).toEqual(big.map((r) => r.row_no));

    // one record larger than the size limit still travels, alone
    const huge = jsonBatches([{ raw: "y".repeat(3_000_000) }, { raw: "z" }]);
    expect(huge).toHaveLength(2);
  });
});
