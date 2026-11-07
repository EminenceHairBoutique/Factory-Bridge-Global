/**
 * Price table for cost accounting (AI_EVALUATION_PLAN.md §2 "Cost controls").
 *
 * Integer nano-USD per token so the arithmetic is exact. These numbers are an accounting signal for
 * `ai_runs` and budget alerts — never an authoritative total shown to a buyer. Rates are the
 * Anthropic first-party list prices known at implementation time (2026-11); update when billing
 * statements disagree.
 */

export interface ModelRate {
  /** nano-USD per uncached input token */
  readonly inputNano: number;
  /** nano-USD per output token */
  readonly outputNano: number;
  /** nano-USD per cache-read input token */
  readonly cacheReadNano: number;
  /** nano-USD per cache-creation input token (1.25x input) */
  readonly cacheWriteNano: number;
}

const USD_PER_MTOK_TO_NANO_PER_TOKEN = 1_000; // $1/MTok = 1e9 nano / 1e6 tokens = 1000 nano/token

const perMTok = (input: number, output: number, cacheRead: number): ModelRate => ({
  inputNano: Math.round(input * USD_PER_MTOK_TO_NANO_PER_TOKEN),
  outputNano: Math.round(output * USD_PER_MTOK_TO_NANO_PER_TOKEN),
  cacheReadNano: Math.round(cacheRead * USD_PER_MTOK_TO_NANO_PER_TOKEN),
  cacheWriteNano: Math.round(input * 1.25 * USD_PER_MTOK_TO_NANO_PER_TOKEN),
});

/** Keyed by model id prefix. Longest matching prefix wins. */
export const MODEL_RATES: Readonly<Record<string, ModelRate>> = {
  "claude-fable-5-1": perMTok(10, 50, 0.25),
  "claude-opus-5-5": perMTok(4, 20, 0.2),
  "claude-opus-5": perMTok(5, 25, 0.5),
  "claude-sonnet-5-5": perMTok(2, 10, 0.2),
  "claude-sonnet-5": perMTok(2, 10, 0.2),
  "claude-haiku-5-5": perMTok(0.1, 0.5, 0.01),
  mock: perMTok(0, 0, 0),
};

export function findRate(model: string): ModelRate | null {
  let best: { key: string; rate: ModelRate } | null = null;
  for (const [key, rate] of Object.entries(MODEL_RATES)) {
    if (model === key || model.startsWith(`${key}-`) || model.startsWith(`${key}@`)) {
      if (best === null || key.length > best.key.length) best = { key, rate };
    }
  }
  return best?.rate ?? null;
}

export interface TokenCounts {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly cacheReadInputTokens: number;
  readonly cacheCreationInputTokens: number;
}

export interface CostEstimate {
  readonly nanoUsd: number;
  /** false when the model is not in the price table (cost reported as 0 and flagged). */
  readonly known: boolean;
}

export function estimateCostNanoUsd(model: string, t: TokenCounts): CostEstimate {
  const rate = findRate(model);
  if (rate === null) return { nanoUsd: 0, known: false };
  const nanoUsd =
    t.inputTokens * rate.inputNano +
    t.outputTokens * rate.outputNano +
    t.cacheReadInputTokens * rate.cacheReadNano +
    t.cacheCreationInputTokens * rate.cacheWriteNano;
  return { nanoUsd, known: true };
}

export function nanoToUsd(nano: number): number {
  return nano / 1_000_000_000;
}
