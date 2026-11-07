/**
 * Anthropic provider (ADR-007). Single-turn structured JSON, NO tools, no prefill.
 *
 * - Structured outputs via `output_config.format` built from the zod schema (the SDK strips
 *   constraints the API cannot enforce — regex, maxLength — which the pipeline re-validates).
 * - System prompt split into a cacheable stable block and a volatile per-call token block.
 * - Only constructible with an API key; `fromEnv()` returns null when ANTHROPIC_API_KEY is absent so
 *   CI and tests can never reach the network by accident.
 * - Returns usage/cost to the caller. No DB writes here.
 */
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";
import type { AiProvider, AiRequest, AiResult } from "../contract.js";
import {
  DEFAULT_MAX_INPUT_TOKENS,
  DEFAULT_MAX_OUTPUT_TOKENS,
  MAX_OUTPUT_TOKENS_CAP,
  ProviderCallError,
  runStructuredCompletion,
  type ModelReply,
  type ModelTurn,
  type StopKind,
} from "../pipeline.js";

export const DEFAULT_ANTHROPIC_MODEL = "claude-opus-5-5";

export type Effort = "low" | "medium" | "high" | "xhigh" | "max";

export interface AnthropicProviderOptions {
  readonly apiKey: string;
  readonly model?: string;
  /** Reasoning effort. Extraction is schema-bound; `medium` is the default. */
  readonly effort?: Effort;
  readonly maxInputTokens?: number;
  readonly defaultMaxOutputTokens?: number;
  readonly maxOutputTokensCap?: number;
  readonly timeoutMs?: number;
  readonly maxRetries?: number;
  readonly baseURL?: string;
}

export class AiConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiConfigError";
  }
}

function mapStop(stop: Anthropic.StopReason | null): StopKind {
  switch (stop) {
    case "end_turn":
    case "stop_sequence":
      return "end_turn";
    case "max_tokens":
      return "max_tokens";
    case "refusal":
      return "refusal";
    case "model_context_window_exceeded":
      return "context_exceeded";
    case "tool_use":
    case "pause_turn":
    case null:
      return "other";
  }
}

export class AnthropicProvider implements AiProvider {
  readonly name = "anthropic";
  readonly model: string;
  private readonly client: Anthropic;
  private readonly effort: Effort;
  private readonly maxInputTokens: number;
  private readonly defaultMaxOutputTokens: number;
  private readonly maxOutputTokensCap: number;
  private readonly timeoutMs: number;

  /**
   * Returns a provider only when ANTHROPIC_API_KEY is set. Model can be overridden with
   * FBG_AI_MODEL. Never throws on a missing key — callers decide how to degrade.
   */
  static fromEnv(env: NodeJS.ProcessEnv = process.env): AnthropicProvider | null {
    const apiKey = env.ANTHROPIC_API_KEY;
    if (apiKey === undefined || apiKey.length === 0) return null;
    const model = env.FBG_AI_MODEL;
    return new AnthropicProvider(
      model !== undefined && model.length > 0 ? { apiKey, model } : { apiKey },
    );
  }

  constructor(opts: AnthropicProviderOptions) {
    if (opts.apiKey.length === 0)
      throw new AiConfigError("AnthropicProvider requires a non-empty apiKey");
    this.model = opts.model ?? DEFAULT_ANTHROPIC_MODEL;
    this.effort = opts.effort ?? "medium";
    this.maxInputTokens = opts.maxInputTokens ?? DEFAULT_MAX_INPUT_TOKENS;
    this.defaultMaxOutputTokens = opts.defaultMaxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS;
    this.maxOutputTokensCap = opts.maxOutputTokensCap ?? MAX_OUTPUT_TOKENS_CAP;
    this.timeoutMs = opts.timeoutMs ?? 120_000;
    this.client = new Anthropic({
      apiKey: opts.apiKey,
      maxRetries: opts.maxRetries ?? 2,
      timeout: this.timeoutMs,
      ...(opts.baseURL !== undefined ? { baseURL: opts.baseURL } : {}),
    });
  }

  complete<TSchema extends z.ZodTypeAny>(
    req: AiRequest<TSchema>,
  ): Promise<AiResult<z.infer<TSchema>>> {
    return runStructuredCompletion(req, {
      providerName: this.name,
      model: this.model,
      call: (turn) => this.call(turn),
      maxInputTokens: this.maxInputTokens,
      defaultMaxOutputTokens: this.defaultMaxOutputTokens,
      maxOutputTokensCap: this.maxOutputTokensCap,
    });
  }

  private async call(turn: ModelTurn): Promise<ModelReply> {
    let res: Anthropic.Message;
    try {
      res = await this.client.messages.create({
        model: this.model,
        max_tokens: turn.maxOutputTokens,
        system: [
          { type: "text", text: turn.system.stable, cache_control: { type: "ephemeral" } },
          { type: "text", text: turn.system.volatile },
        ],
        messages: turn.messages.map((m) => ({ role: m.role, content: m.content })),
        output_config: {
          effort: this.effort,
          format: zodOutputFormat(turn.schema),
        },
        // Deliberately: no `tools`, no `tool_choice`, no prefill (SECURITY.md §5, ADR-007).
      });
    } catch (err) {
      throw new ProviderCallError(describeApiError(err));
    }

    const text = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    const stop = mapStop(res.stop_reason);
    const reply: ModelReply = {
      text,
      model: res.model,
      stop,
      inputTokens: res.usage.input_tokens,
      outputTokens: res.usage.output_tokens,
      cacheReadInputTokens: res.usage.cache_read_input_tokens ?? 0,
      cacheCreationInputTokens: res.usage.cache_creation_input_tokens ?? 0,
      ...(stop === "refusal" && res.stop_details
        ? {
            stopDetail: `${res.stop_details.category ?? "uncategorized"}: ${res.stop_details.explanation ?? ""}`,
          }
        : {}),
    };
    return reply;
  }
}

/** Never echoes request bodies or headers (which could contain the key). */
function describeApiError(err: unknown): string {
  if (err instanceof Anthropic.AuthenticationError)
    return "anthropic: authentication failed (check ANTHROPIC_API_KEY)";
  if (err instanceof Anthropic.RateLimitError) return "anthropic: rate limited (429)";
  if (err instanceof Anthropic.BadRequestError)
    return `anthropic: bad request (400): ${err.message}`;
  if (err instanceof Anthropic.APIConnectionTimeoutError) return "anthropic: request timed out";
  if (err instanceof Anthropic.APIConnectionError) return "anthropic: connection error";
  if (err instanceof Anthropic.APIError)
    return `anthropic: API error ${String(err.status)}: ${err.message}`;
  return `anthropic: ${err instanceof Error ? err.message : String(err)}`;
}
