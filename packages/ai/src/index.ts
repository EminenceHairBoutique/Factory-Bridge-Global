/**
 * Provider-agnostic AI adapter contract (ADR-007, docs/AI_EVALUATION_PLAN.md §2).
 * Phase 1 B-16 adds the Anthropic implementation. Extraction/translation/matching calls carry
 * NO tools; outputs are validated against zod schemas before anything is stored.
 */
import type { z } from "zod";

export type AiPurpose = "extract" | "translate" | "normalize" | "match" | "draft" | "flag";

export interface PromptTemplateRef {
  readonly id: string;
  readonly version: string; // semantic version of the template file; hashed into ai_runs.prompt_version
}

export interface AiRequest<TSchema extends z.ZodTypeAny> {
  readonly purpose: AiPurpose;
  readonly template: PromptTemplateRef;
  /** Untrusted content is passed here and wrapped as data by the adapter — never concatenated into instructions. */
  readonly untrustedContent: readonly { label: string; text: string }[];
  readonly trustedContext?: Record<string, string | number | boolean>;
  readonly schema: TSchema;
  readonly maxOutputTokens?: number;
}

export interface AiUsage {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly costUsd: number;
  readonly latencyMs: number;
}

export type AiResult<T> =
  | {
      ok: true;
      output: T;
      usage: AiUsage;
      provider: string;
      model: string;
      flags: readonly string[];
    }
  | {
      ok: false;
      error: "schema_invalid" | "provider_error" | "budget_exceeded" | "canary_leak";
      detail: string;
      usage?: AiUsage;
    };

export interface AiProvider {
  readonly name: string;
  complete<TSchema extends z.ZodTypeAny>(
    req: AiRequest<TSchema>,
  ): Promise<AiResult<z.infer<TSchema>>>;
}

/** Placeholder provider so the package compiles and tests can inject behavior. Never used in production. */
export class UnconfiguredProvider implements AiProvider {
  readonly name = "unconfigured";
  complete<TSchema extends z.ZodTypeAny>(
    _req: AiRequest<TSchema>,
  ): Promise<AiResult<z.infer<TSchema>>> {
    return Promise.resolve({
      ok: false,
      error: "provider_error",
      detail: "No AI provider configured. Implement in BACKLOG B-16.",
    });
  }
}

export { quoteExtractionV1 } from "./schemas/quote-extraction-v1.js";
