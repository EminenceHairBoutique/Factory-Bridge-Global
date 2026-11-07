import { MockProvider, quoteExtractionV1, TEMPLATES, type AiRequest } from "@fbg/ai";
import { describe, expect, it } from "vitest";
import {
  GuardedAiRunner,
  hashUntrustedInput,
  usdToNano,
  type GuardedAiEvent,
} from "./guarded-runner.js";
import type { AiBudgetStatus, AiRunRecord, AiRunStore } from "./store.js";

const ORG = "aaaaaaaa-0000-4000-8000-000000000001";

class FakeStore implements AiRunStore {
  readonly runs: AiRunRecord[] = [];
  readonly budgetCalls: { orgId: string; defaultCap: number }[] = [];
  failRecord = false;
  constructor(private status: Partial<AiBudgetStatus> = {}) {}
  budgetStatus(orgId: string, defaultCapNanoUsd: number): Promise<AiBudgetStatus> {
    this.budgetCalls.push({ orgId, defaultCap: defaultCapNanoUsd });
    return Promise.resolve({
      capNanoUsd: defaultCapNanoUsd,
      spentNanoUsd: 0,
      remainingNanoUsd: defaultCapNanoUsd,
      monthStart: "2026-11-01T00:00:00.000Z",
      exceeded: false,
      alert: false,
      ...this.status,
    });
  }
  recordRun(run: AiRunRecord): Promise<string> {
    if (this.failRecord) return Promise.reject(new Error("db down"));
    this.runs.push(run);
    return Promise.resolve(`run-${this.runs.length}`);
  }
}

const validOutput = {
  schema: "quote_extraction_v1",
  supplierNameHint: { value: null, confidence: "low", anchor: null },
  currency: { value: "CNY", confidence: "high", anchor: null },
  quantityUnit: { value: "个", confidence: "high", anchor: null },
  priceBasis: { value: null, confidence: "low", anchor: null },
  incotermPlace: { value: null, confidence: "low", anchor: null },
  moq: { value: "100", confidence: "high", anchor: null },
  tiers: [],
  fees: [],
  productionLeadDays: { value: null, confidence: "low", anchor: null },
  paymentTerms: { value: null, confidence: "low", anchor: null },
  quoteDate: { value: null, confidence: "low", anchor: null },
  validUntil: { value: null, confidence: "low", anchor: null },
  specAttributes: {},
  missingFields: [],
  flags: ["embedded_instruction_detected"],
  notes: null,
};

const req: AiRequest<typeof quoteExtractionV1> = {
  purpose: "extract",
  template: TEMPLATES.quotationExtractorV1,
  untrustedContent: [{ label: "document", text: "起订量 100个" }],
  schema: quoteExtractionV1,
};

const extractorFlags = (output: unknown) => (output as { flags: string[] }).flags;

describe("GuardedAiRunner", () => {
  it("checks the org budget with the platform default cap, calls the provider, and records usage, cost, prompt hash and output flags", async () => {
    const store = new FakeStore();
    const provider = MockProvider.returning(validOutput, {
      model: "claude-opus-5-5",
      inputTokens: 1_000_000,
      outputTokens: 0,
    });
    const events: GuardedAiEvent[] = [];
    const runner = new GuardedAiRunner({
      provider,
      store,
      defaultMonthlyCapUsd: 50,
      outputFlags: extractorFlags,
      onEvent: (e) => events.push(e),
    });

    const res = await runner.run(req, { orgId: ORG, jobId: "job-1", triggeredBy: "u-1" });
    expect(res.ok).toBe(true);
    expect(store.budgetCalls).toEqual([{ orgId: ORG, defaultCap: 50_000_000_000 }]);
    expect(store.runs).toHaveLength(1);
    const run = store.runs[0]!;
    expect(run).toMatchObject({
      orgId: ORG,
      purpose: "extract",
      provider: "mock",
      model: "claude-opus-5-5",
      promptTemplateId: "quotation_extractor",
      status: "ok",
      inputTokens: 1_000_000,
      costNanoUsd: 4_000_000_000,
      attempts: 1,
      jobId: "job-1",
      triggeredBy: "u-1",
    });
    expect(run.promptVersion).toMatch(/^[0-9a-f]{64}$/);
    expect(run.inputHash).toBe(hashUntrustedInput(req));
    expect(run.flags).toEqual(["embedded_instruction_detected"]);
    expect(run.error).toBeUndefined();
    expect(events.map((e) => e.kind)).toEqual(["run_recorded"]);
  });

  it("refuses before any model call when the monthly budget is exhausted and records a budget_refused row", async () => {
    const store = new FakeStore({ exceeded: true, spentNanoUsd: 50_000_000_000 });
    const provider = MockProvider.returning(validOutput);
    const events: GuardedAiEvent[] = [];
    const runner = new GuardedAiRunner({
      provider,
      store,
      defaultMonthlyCapUsd: 50,
      onEvent: (e) => events.push(e),
    });

    const res = await runner.run(req, { orgId: ORG, jobId: "job-2" });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toBe("budget_exceeded");
    expect(res.detail).toContain("refused before any model call");
    expect(res.promptHash).toMatch(/^[0-9a-f]{64}$/);
    expect(provider.calls).toHaveLength(0);
    expect(store.runs).toHaveLength(1);
    expect(store.runs[0]).toMatchObject({
      status: "budget_refused",
      costNanoUsd: 0,
      attempts: 0,
      jobId: "job-2",
      flags: [],
    });
    expect(store.runs[0]!.error).toContain("monthly AI budget exhausted");
    expect(events.map((e) => e.kind)).toEqual(["budget_refused", "run_recorded"]);
  });

  it("emits a budget_alert event but still runs when the alert threshold is crossed", async () => {
    const store = new FakeStore({ alert: true, spentNanoUsd: 45_000_000_000 });
    const provider = MockProvider.returning(validOutput);
    const events: GuardedAiEvent[] = [];
    const runner = new GuardedAiRunner({
      provider,
      store,
      defaultMonthlyCapUsd: 50,
      onEvent: (e) => events.push(e),
    });
    const res = await runner.run(req, { orgId: ORG });
    expect(res.ok).toBe(true);
    expect(events.map((e) => e.kind)).toEqual(["budget_alert", "run_recorded"]);
  });

  it("records failed results with their status, detail and usage (canary leak, schema_invalid)", async () => {
    const store = new FakeStore();
    const leaking = new MockProvider(
      (turn) => JSON.stringify({ ...validOutput, notes: turn.tokens.canary }),
      { inputTokens: 10, outputTokens: 5 },
    );
    const runner = new GuardedAiRunner({ provider: leaking, store, defaultMonthlyCapUsd: 50 });
    const res = await runner.run(req, { orgId: ORG });
    expect(!res.ok && res.error).toBe("canary_leak");
    expect(store.runs[0]).toMatchObject({
      status: "canary_leak",
      inputTokens: 10,
      outputTokens: 5,
      attempts: 1,
    });
    expect(store.runs[0]!.error).toContain("canary");

    const invalid = MockProvider.returning({ schema: "quote_extraction_v1" });
    await new GuardedAiRunner({ provider: invalid, store, defaultMonthlyCapUsd: 50 }).run(req, {
      orgId: ORG,
    });
    expect(store.runs[1]).toMatchObject({ status: "schema_invalid", attempts: 2 });
  });

  it("propagates a ledger write failure after a paid call instead of swallowing it", async () => {
    const store = new FakeStore();
    store.failRecord = true;
    const runner = new GuardedAiRunner({
      provider: MockProvider.returning(validOutput),
      store,
      defaultMonthlyCapUsd: 50,
    });
    await expect(runner.run(req, { orgId: ORG })).rejects.toThrow(/db down/);
  });

  it("usdToNano is exact for cent values and rejects negatives", () => {
    expect(usdToNano(50)).toBe(50_000_000_000);
    expect(usdToNano(0.01)).toBe(10_000_000);
    expect(usdToNano(0)).toBe(0);
    expect(() => usdToNano(-1)).toThrow();
    expect(
      () =>
        new GuardedAiRunner({
          provider: MockProvider.returning({}),
          store: new FakeStore(),
          defaultMonthlyCapUsd: Number.NaN,
        }),
    ).toThrow();
  });

  it("hashUntrustedInput changes with content and label, and is independent of trusted context", () => {
    const a = hashUntrustedInput(req);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(
      hashUntrustedInput({
        ...req,
        untrustedContent: [{ label: "document", text: "起订量 200个" }],
      }),
    ).not.toBe(a);
    expect(
      hashUntrustedInput({ ...req, untrustedContent: [{ label: "email", text: "起订量 100个" }] }),
    ).not.toBe(a);
    expect(hashUntrustedInput({ ...req, trustedContext: { locale_hint: "zh-CN" } })).toBe(a);
  });
});
