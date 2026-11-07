import { describe, expect, it } from "vitest";
import { PgAiRunStore, type AiRunRecord, type SqlClient } from "./store.js";

class RecordingSql implements SqlClient {
  readonly calls: { text: string; params: readonly unknown[] }[] = [];
  constructor(private readonly rows: unknown[]) {}
  query<T>(text: string, params: readonly unknown[]): Promise<T[]> {
    this.calls.push({ text, params });
    return Promise.resolve(this.rows as T[]);
  }
}

const run: AiRunRecord = {
  orgId: "aaaaaaaa-0000-4000-8000-000000000001",
  purpose: "extract",
  provider: "anthropic",
  model: "claude-opus-5-5",
  promptTemplateId: "quotation_extractor",
  promptVersion: "f".repeat(64),
  status: "ok",
  inputTokens: 1200,
  outputTokens: 300,
  cacheReadInputTokens: 0,
  cacheCreationInputTokens: 0,
  costNanoUsd: 10_800_000_000,
  latencyMs: 900,
  attempts: 1,
  flags: ["repaired"],
  inputHash: "a".repeat(64),
  jobId: "job-7",
};

describe("PgAiRunStore", () => {
  it("maps ai_budget_status rows (bigint strings) to safe integers", async () => {
    const sql = new RecordingSql([
      {
        cap_nano_usd: "50000000000",
        spent_nano_usd: "1234",
        remaining_nano_usd: 49999998766,
        month_start: new Date("2026-11-01T00:00:00Z"),
        exceeded: false,
        alert: false,
      },
    ]);
    const store = new PgAiRunStore(sql);
    const b = await store.budgetStatus(run.orgId, 50_000_000_000);
    expect(b).toEqual({
      capNanoUsd: 50_000_000_000,
      spentNanoUsd: 1234,
      remainingNanoUsd: 49_999_998_766,
      monthStart: "2026-11-01T00:00:00.000Z",
      exceeded: false,
      alert: false,
    });
    expect(sql.calls[0]!.text).toContain("app.ai_budget_status($1::uuid, $2::bigint)");
    expect(sql.calls[0]!.params).toEqual([run.orgId, "50000000000"]);
  });

  it("passes every ledger column to app.record_ai_run in declaration order and returns the id", async () => {
    const sql = new RecordingSql([{ id: "run-id" }]);
    const store = new PgAiRunStore(sql);
    expect(await store.recordRun(run)).toBe("run-id");
    const { text, params } = sql.calls[0]!;
    expect(text).toContain("app.record_ai_run(");
    expect(params).toEqual([
      run.orgId,
      "extract",
      "anthropic",
      "claude-opus-5-5",
      "quotation_extractor",
      "f".repeat(64),
      "ok",
      1200,
      300,
      0,
      0,
      "10800000000",
      900,
      1,
      ["repaired"],
      null,
      "a".repeat(64),
      null,
      "job-7",
      null,
    ]);
  });

  it("rejects an invalid default cap and a missing row", async () => {
    const store = new PgAiRunStore(new RecordingSql([]));
    await expect(store.budgetStatus(run.orgId, -1)).rejects.toThrow(/non-negative/);
    await expect(store.budgetStatus(run.orgId, 1)).rejects.toThrow(/no row/);
    await expect(store.recordRun(run)).rejects.toThrow(/no id/);
  });
});
