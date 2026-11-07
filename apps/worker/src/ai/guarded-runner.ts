/**
 * GuardedAiRunner — the only way worker jobs call an AI provider (B-16b).
 *
 *   budget check (org monthly cap) → provider.complete() → ai_runs row (+ security_events via the DB fn)
 *
 * The provider never sees the organization; the runner adds tenancy, the ledger row and the refusal.
 * A refusal is recorded as status `budget_refused` with zero usage and surfaces to the job as an
 * AiResult error `budget_exceeded`, so callers handle both cap kinds the same way. If the ledger write
 * fails after a paid call, the error propagates: a job must fail loudly rather than lose spend.
 */
import { createHash } from "node:crypto";
import { getTemplate, type AiProvider, type AiRequest, type AiResult } from "@fbg/ai";
import type { z } from "zod";
import type { AiRunRecord, AiRunStore } from "./store.js";

export interface AiRunContext {
  readonly orgId: string;
  readonly triggeredBy?: string;
  readonly jobId?: string;
  readonly requestId?: string;
}

export interface GuardedAiRunnerOptions {
  readonly provider: AiProvider;
  readonly store: AiRunStore;
  /** Platform default monthly cap for orgs without an ai_budgets row (env AI_MONTHLY_BUDGET_USD_DEFAULT). */
  readonly defaultMonthlyCapUsd: number;
  /**
   * Flags to persist from a validated output (e.g. quote_extraction_v1.flags). The DB turns
   * `embedded_instruction_detected` into a security_events row. Return [] when the schema has none.
   */
  readonly outputFlags?: (output: unknown) => readonly string[];
  readonly onEvent?: (event: GuardedAiEvent) => void;
}

export type GuardedAiEvent =
  | { kind: "budget_refused"; orgId: string; spentNanoUsd: number; capNanoUsd: number }
  | { kind: "budget_alert"; orgId: string; spentNanoUsd: number; capNanoUsd: number }
  | { kind: "run_recorded"; orgId: string; runId: string; status: string; costNanoUsd: number };

export function usdToNano(usd: number): number {
  if (!Number.isFinite(usd) || usd < 0) throw new Error("usd must be a non-negative finite number");
  return Math.round(usd * 1_000_000_000);
}

export function hashUntrustedInput(req: AiRequest<z.ZodTypeAny>): string {
  const h = createHash("sha256");
  for (const item of req.untrustedContent) {
    h.update(item.label);
    h.update("\u0000");
    h.update(item.text);
    h.update("\u0000");
  }
  return h.digest("hex");
}

function modelOf(provider: AiProvider): string {
  const m = (provider as { model?: unknown }).model;
  return typeof m === "string" && m.length > 0 ? m : "unknown";
}

export class GuardedAiRunner {
  private readonly defaultCapNanoUsd: number;

  constructor(private readonly opts: GuardedAiRunnerOptions) {
    this.defaultCapNanoUsd = usdToNano(opts.defaultMonthlyCapUsd);
  }

  async run<TSchema extends z.ZodTypeAny>(
    req: AiRequest<TSchema>,
    ctx: AiRunContext,
  ): Promise<AiResult<z.infer<TSchema>>> {
    const { provider, store } = this.opts;
    const template = getTemplate(req.template);
    const base = {
      orgId: ctx.orgId,
      purpose: req.purpose,
      provider: provider.name,
      model: modelOf(provider),
      promptTemplateId: req.template.id,
      promptVersion: template.hash,
      inputHash: hashUntrustedInput(req),
      ...(ctx.triggeredBy !== undefined ? { triggeredBy: ctx.triggeredBy } : {}),
      ...(ctx.jobId !== undefined ? { jobId: ctx.jobId } : {}),
      ...(ctx.requestId !== undefined ? { requestId: ctx.requestId } : {}),
    };

    const budget = await store.budgetStatus(ctx.orgId, this.defaultCapNanoUsd);
    if (budget.exceeded) {
      const refused: AiRunRecord = {
        ...base,
        status: "budget_refused",
        inputTokens: 0,
        outputTokens: 0,
        cacheReadInputTokens: 0,
        cacheCreationInputTokens: 0,
        costNanoUsd: 0,
        latencyMs: 0,
        attempts: 0,
        flags: [],
        error: `monthly AI budget exhausted: spent ${budget.spentNanoUsd} of ${budget.capNanoUsd} nano-USD`,
      };
      const runId = await store.recordRun(refused);
      this.opts.onEvent?.({
        kind: "budget_refused",
        orgId: ctx.orgId,
        spentNanoUsd: budget.spentNanoUsd,
        capNanoUsd: budget.capNanoUsd,
      });
      this.opts.onEvent?.({
        kind: "run_recorded",
        orgId: ctx.orgId,
        runId,
        status: "budget_refused",
        costNanoUsd: 0,
      });
      return {
        ok: false,
        error: "budget_exceeded",
        detail: `organization ${ctx.orgId} has exhausted its monthly AI budget; job refused before any model call`,
        provider: provider.name,
        model: base.model,
        promptHash: template.hash,
      };
    }
    if (budget.alert) {
      this.opts.onEvent?.({
        kind: "budget_alert",
        orgId: ctx.orgId,
        spentNanoUsd: budget.spentNanoUsd,
        capNanoUsd: budget.capNanoUsd,
      });
    }

    const result = await provider.complete(req);
    const usage = result.usage;
    const flags: string[] = result.ok
      ? [...result.flags, ...(this.opts.outputFlags?.(result.output) ?? [])]
      : [];
    const record: AiRunRecord = {
      ...base,
      model: result.model,
      status: result.ok ? "ok" : result.error,
      inputTokens: usage?.inputTokens ?? 0,
      outputTokens: usage?.outputTokens ?? 0,
      cacheReadInputTokens: usage?.cacheReadInputTokens ?? 0,
      cacheCreationInputTokens: usage?.cacheCreationInputTokens ?? 0,
      costNanoUsd: usage?.costNanoUsd ?? 0,
      latencyMs: usage?.latencyMs ?? 0,
      attempts: usage?.attempts ?? 0,
      flags: [...new Set(flags)],
      ...(result.ok ? {} : { error: result.detail.slice(0, 2000) }),
    };
    const runId = await store.recordRun(record);
    this.opts.onEvent?.({
      kind: "run_recorded",
      orgId: ctx.orgId,
      runId,
      status: record.status,
      costNanoUsd: record.costNanoUsd,
    });
    return result;
  }
}
