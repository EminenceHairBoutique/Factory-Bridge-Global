/**
 * MockProvider — deterministic test double that runs the SAME pipeline as the live provider
 * (wrapping, token cap, leak check, parse, validate, repair-once, accounting). Only the model
 * round-trip is faked. Never touches the network.
 */
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

export type MockTurn = ModelTurn;

/** What a responder may return: raw model text, or a partial reply to override stop/usage. */
export type MockReply = string | (Partial<ModelReply> & { readonly text: string });

export type MockResponder = (turn: MockTurn) => MockReply | Promise<MockReply>;

export interface MockProviderOptions {
  readonly model?: string;
  readonly inputTokens?: number;
  readonly outputTokens?: number;
  readonly maxInputTokens?: number;
  readonly defaultMaxOutputTokens?: number;
  readonly maxOutputTokensCap?: number;
}

export class MockProvider implements AiProvider {
  readonly name = "mock";
  readonly model: string;
  /** Every turn the pipeline sent, in order — assert on prompts, attempts and repair messages. */
  readonly calls: MockTurn[] = [];
  private readonly responder: MockResponder;
  private readonly opts: MockProviderOptions;

  constructor(responder: MockResponder, opts: MockProviderOptions = {}) {
    this.responder = responder;
    this.opts = opts;
    this.model = opts.model ?? "mock";
  }

  /** Always answers with `value` serialized as JSON. */
  static returning(value: unknown, opts?: MockProviderOptions): MockProvider {
    return new MockProvider(() => JSON.stringify(value), opts);
  }

  /** Answers successive calls with successive replies; objects are serialized, strings sent raw. */
  static sequence(replies: readonly unknown[], opts?: MockProviderOptions): MockProvider {
    let i = 0;
    return new MockProvider(() => {
      const r = replies[Math.min(i, replies.length - 1)];
      i += 1;
      return typeof r === "string" ? r : JSON.stringify(r);
    }, opts);
  }

  /** Simulates a provider failure (network, 429, …). */
  static failing(message = "simulated provider failure"): MockProvider {
    return new MockProvider(() => {
      throw new ProviderCallError(message);
    });
  }

  /** Simulates a stop reason such as "refusal" or "max_tokens". */
  static stopping(stop: StopKind, text = "", opts?: MockProviderOptions): MockProvider {
    return new MockProvider(() => ({ text, stop }), opts);
  }

  complete<TSchema extends z.ZodTypeAny>(
    req: AiRequest<TSchema>,
  ): Promise<AiResult<z.infer<TSchema>>> {
    return runStructuredCompletion(req, {
      providerName: this.name,
      model: this.model,
      call: async (turn) => {
        this.calls.push(turn);
        const r = await this.responder(turn);
        const partial = typeof r === "string" ? { text: r } : r;
        const reply: ModelReply = {
          text: partial.text,
          model: partial.model ?? this.model,
          stop: partial.stop ?? "end_turn",
          inputTokens: partial.inputTokens ?? this.opts.inputTokens ?? 1_000,
          outputTokens: partial.outputTokens ?? this.opts.outputTokens ?? 500,
          cacheReadInputTokens: partial.cacheReadInputTokens ?? 0,
          cacheCreationInputTokens: partial.cacheCreationInputTokens ?? 0,
          ...(partial.stopDetail !== undefined ? { stopDetail: partial.stopDetail } : {}),
        };
        return reply;
      },
      maxInputTokens: this.opts.maxInputTokens ?? DEFAULT_MAX_INPUT_TOKENS,
      defaultMaxOutputTokens: this.opts.defaultMaxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS,
      maxOutputTokensCap: this.opts.maxOutputTokensCap ?? MAX_OUTPUT_TOKENS_CAP,
    });
  }
}
