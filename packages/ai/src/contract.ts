/**
 * Provider-agnostic AI adapter contract (ADR-007, docs/AI_EVALUATION_PLAN.md §2).
 *
 * Extraction/translation/matching calls carry NO tools. Outputs are validated against zod schemas
 * before anything is stored. The adapter never writes to the database and never triggers a side
 * effect: it returns usage/cost accounting to the caller, which owns `ai_runs` logging (B-16b).
 */
import type { z } from "zod";

export type AiPurpose = "extract" | "translate" | "normalize" | "match" | "draft" | "flag";

export interface PromptTemplateRef {
  readonly id: string;
  /** Semantic version of the template file under packages/ai/prompts/<id>/<version>.md. */
  readonly version: string;
}

export interface UntrustedContent {
  /** Short machine label (e.g. "document", "email_body"). Sanitized before use. */
  readonly label: string;
  readonly text: string;
}

export interface AiRequest<TSchema extends z.ZodTypeAny> {
  readonly purpose: AiPurpose;
  readonly template: PromptTemplateRef;
  /**
   * Untrusted content (supplier documents, emails, OCR text, prior AI output). The adapter wraps it
   * in delimited data blocks with a per-call boundary token — it is never concatenated into
   * instructions (SECURITY.md §5).
   */
  readonly untrustedContent: readonly UntrustedContent[];
  /** Trusted, platform-supplied key/value context (locale hints, document kind). Never user text. */
  readonly trustedContext?: Readonly<Record<string, string | number | boolean>>;
  readonly schema: TSchema;
  /** Per-call output token cap. Clamped to the provider's hard cap. */
  readonly maxOutputTokens?: number;
}

export interface AiUsage {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly cacheReadInputTokens: number;
  readonly cacheCreationInputTokens: number;
  /** Cost computed from the adapter's price table as an integer number of nano-USD (1e-9 USD). */
  readonly costNanoUsd: number;
  /** Convenience float view of costNanoUsd. Accounting signal only — never an authoritative total. */
  readonly costUsd: number;
  readonly latencyMs: number;
  /** Number of model calls made (1, or 2 when one repair attempt was needed). */
  readonly attempts: number;
}

export type AiErrorCode = "schema_invalid" | "provider_error" | "budget_exceeded" | "canary_leak";

/** Adapter-level flags (distinct from flags inside the schema-validated output). */
export type AiAdapterFlag = "repaired" | "cost_rate_unknown";

export type AiResult<T> =
  | {
      readonly ok: true;
      readonly output: T;
      readonly usage: AiUsage;
      readonly provider: string;
      readonly model: string;
      /** sha256 of the template file; stored by the caller as ai_runs.prompt_version. */
      readonly promptHash: string;
      readonly flags: readonly AiAdapterFlag[];
    }
  | {
      readonly ok: false;
      readonly error: AiErrorCode;
      readonly detail: string;
      readonly provider: string;
      readonly model: string;
      readonly promptHash: string;
      readonly usage?: AiUsage;
    };

export interface AiProvider {
  readonly name: string;
  complete<TSchema extends z.ZodTypeAny>(
    req: AiRequest<TSchema>,
  ): Promise<AiResult<z.infer<TSchema>>>;
}

/** Placeholder provider so callers can be wired before a real provider is configured. Never used in production. */
export class UnconfiguredProvider implements AiProvider {
  readonly name = "unconfigured";
  complete<TSchema extends z.ZodTypeAny>(
    req: AiRequest<TSchema>,
  ): Promise<AiResult<z.infer<TSchema>>> {
    return Promise.resolve({
      ok: false,
      error: "provider_error",
      detail:
        "No AI provider configured. Set ANTHROPIC_API_KEY and use AnthropicProvider.fromEnv().",
      provider: this.name,
      model: "none",
      promptHash: `${req.template.id}@${req.template.version}`,
    });
  }
}
