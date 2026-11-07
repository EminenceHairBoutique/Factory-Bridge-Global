/**
 * Shared structured-completion pipeline used by every provider.
 *
 *   build prompt → pre-call token cap → model call → leak check → parse → zod validate
 *   → (one repair attempt on schema failure) → usage/cost accounting
 *
 * Providers only supply `call` (one round-trip to a model, NO tools). Keeping the security and
 * validation logic here means the MockProvider exercises exactly the same code paths as the live one.
 */
import { performance } from "node:perf_hooks";
import type { z } from "zod";
import type {
  AiAdapterFlag,
  AiErrorCode,
  AiRequest,
  AiResult,
  AiUsage,
  PromptTemplateRef,
} from "./contract.js";
import { estimateCostNanoUsd, nanoToUsd, type TokenCounts } from "./pricing.js";
import { getTemplate, type LoadedTemplate } from "./prompts/registry.js";
import { estimateTokens } from "./tokens.js";
import {
  detectLeak,
  newBoundaryToken,
  newCanaryToken,
  SECURITY_PREAMBLE,
  tokenNotice,
  wrapUntrusted,
} from "./untrusted.js";

export interface SystemPrompt {
  /** Template + security preamble. Identical for every call of a template version → cacheable. */
  readonly stable: string;
  /** Per-call tokens. Must come after the cache breakpoint. */
  readonly volatile: string;
}

export interface TurnMessage {
  readonly role: "user" | "assistant";
  readonly content: string;
}

export interface ModelTurn {
  readonly attempt: 1 | 2;
  readonly system: SystemPrompt;
  readonly messages: readonly TurnMessage[];
  readonly maxOutputTokens: number;
  readonly schema: z.ZodTypeAny;
  readonly schemaName: string;
  /** Exposed so test doubles can simulate leaks. Live providers must ignore this. */
  readonly tokens: { readonly canary: string; readonly boundary: string };
}

export type StopKind = "end_turn" | "max_tokens" | "refusal" | "context_exceeded" | "other";

export interface ModelReply {
  readonly text: string;
  readonly model: string;
  readonly stop: StopKind;
  readonly stopDetail?: string;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly cacheReadInputTokens?: number;
  readonly cacheCreationInputTokens?: number;
}

export type ModelCall = (turn: ModelTurn) => Promise<ModelReply>;

export class ProviderCallError extends Error {
  constructor(
    message: string,
    readonly code: Extract<AiErrorCode, "provider_error" | "budget_exceeded"> = "provider_error",
  ) {
    super(message);
    this.name = "ProviderCallError";
  }
}

export interface PipelineOptions {
  readonly providerName: string;
  /** Model the provider intends to call; the reply's reported model wins for accounting. */
  readonly model: string;
  readonly call: ModelCall;
  /** Pre-call cap on the estimated input tokens (system + user). */
  readonly maxInputTokens: number;
  readonly defaultMaxOutputTokens: number;
  readonly maxOutputTokensCap: number;
}

export const DEFAULT_MAX_INPUT_TOKENS = 60_000;
export const DEFAULT_MAX_OUTPUT_TOKENS = 8_192;
export const MAX_OUTPUT_TOKENS_CAP = 16_384;

export function buildSystemPrompt(
  template: LoadedTemplate,
  tokens: { canary: string; boundary: string },
): SystemPrompt {
  return {
    stable: `${template.system}\n\n${SECURITY_PREAMBLE}`,
    volatile: tokenNotice(tokens.boundary, tokens.canary),
  };
}

export function buildUserPrompt(
  template: LoadedTemplate,
  req: Pick<AiRequest<z.ZodTypeAny>, "untrustedContent" | "trustedContext">,
  boundary: string,
): string {
  const context = JSON.stringify(req.trustedContext ?? {}, null, 2);
  const documents = wrapUntrusted(req.untrustedContent, boundary);
  return template.user.replace("{{CONTEXT}}", context).replace("{{DOCUMENTS}}", documents);
}

/** Strips a ```json fence if the model added one, then parses. Returns undefined on syntax error. */
export function parseJsonOutput(text: string): unknown {
  let body = text.trim();
  const fence = /^```(?:json)?\s*\n([\s\S]*?)\n```\s*$/i.exec(body);
  if (fence?.[1] !== undefined) body = fence[1].trim();
  try {
    return JSON.parse(body) as unknown;
  } catch {
    return undefined;
  }
}

export function formatIssues(issues: readonly z.core.$ZodIssue[]): string {
  return issues
    .slice(0, 25)
    .map((i) => `- ${i.path.map(String).join(".") || "(root)"}: ${i.code} — ${i.message}`)
    .join("\n");
}

function repairInstruction(schemaName: string, issues: string): string {
  return [
    `Your previous reply did not validate against the ${schemaName} schema:`,
    issues,
    "",
    "Return the complete corrected JSON object only. Keep every value that was already valid, do not add fields, do not add commentary. Unknown values remain null.",
  ].join("\n");
}

interface Accumulated {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  attempts: number;
}

function toUsage(
  acc: Accumulated,
  model: string,
  latencyMs: number,
): { usage: AiUsage; known: boolean } {
  const counts: TokenCounts = {
    inputTokens: acc.input,
    outputTokens: acc.output,
    cacheReadInputTokens: acc.cacheRead,
    cacheCreationInputTokens: acc.cacheWrite,
  };
  const cost = estimateCostNanoUsd(model, counts);
  return {
    usage: {
      ...counts,
      costNanoUsd: cost.nanoUsd,
      costUsd: nanoToUsd(cost.nanoUsd),
      latencyMs: Math.round(latencyMs),
      attempts: acc.attempts,
    },
    known: cost.known,
  };
}

export async function runStructuredCompletion<TSchema extends z.ZodTypeAny>(
  req: AiRequest<TSchema>,
  opts: PipelineOptions,
): Promise<AiResult<z.infer<TSchema>>> {
  const template = getTemplate(req.template);
  const tokens = { canary: newCanaryToken(), boundary: newBoundaryToken() };
  const system = buildSystemPrompt(template, tokens);
  const user = buildUserPrompt(template, req, tokens.boundary);
  const maxOutputTokens = Math.min(
    Math.max(1, req.maxOutputTokens ?? opts.defaultMaxOutputTokens),
    opts.maxOutputTokensCap,
  );
  const started = performance.now();
  const acc: Accumulated = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, attempts: 0 };
  let model = opts.model;

  const fail = (error: AiErrorCode, detail: string): AiResult<z.infer<TSchema>> => {
    const base = {
      ok: false as const,
      error,
      detail,
      provider: opts.providerName,
      model,
      promptHash: template.hash,
    };
    if (acc.attempts === 0) return base;
    return { ...base, usage: toUsage(acc, model, performance.now() - started).usage };
  };

  const estimated =
    estimateTokens(system.stable) + estimateTokens(system.volatile) + estimateTokens(user);
  if (estimated > opts.maxInputTokens) {
    return fail(
      "budget_exceeded",
      `estimated input ${estimated} tokens exceeds per-call cap ${opts.maxInputTokens}; split the document before extraction`,
    );
  }

  const messages: TurnMessage[] = [{ role: "user", content: user }];

  for (const attempt of [1, 2] as const) {
    let reply: ModelReply;
    try {
      reply = await opts.call({
        attempt,
        system,
        messages,
        maxOutputTokens,
        schema: req.schema,
        schemaName: template.schema,
        tokens,
      });
    } catch (err) {
      const code = err instanceof ProviderCallError ? err.code : "provider_error";
      const message = err instanceof Error ? err.message : String(err);
      return fail(code, message);
    }
    acc.attempts += 1;
    acc.input += reply.inputTokens;
    acc.output += reply.outputTokens;
    acc.cacheRead += reply.cacheReadInputTokens ?? 0;
    acc.cacheWrite += reply.cacheCreationInputTokens ?? 0;
    model = reply.model;

    const leak = detectLeak(reply.text, tokens);
    if (leak !== null) {
      return fail(
        "canary_leak",
        `${leak} token reproduced in model output on attempt ${attempt}; output discarded`,
      );
    }
    if (reply.stop === "refusal") {
      return fail(
        "provider_error",
        `model refused (${reply.stopDetail ?? "no category"}); needs human review`,
      );
    }
    if (reply.stop === "max_tokens") {
      return fail(
        "budget_exceeded",
        `output truncated at ${maxOutputTokens} tokens on attempt ${attempt}`,
      );
    }
    if (reply.stop === "context_exceeded") {
      return fail("budget_exceeded", "model context window exceeded");
    }

    const parsed = parseJsonOutput(reply.text);
    const issues =
      parsed === undefined
        ? "- (root): invalid_json — output was not a single JSON object"
        : (() => {
            const r = req.schema.safeParse(parsed);
            if (r.success) return null;
            return formatIssues(r.error.issues);
          })();

    if (issues === null) {
      const { usage, known } = toUsage(acc, model, performance.now() - started);
      const flags: AiAdapterFlag[] = [];
      if (attempt === 2) flags.push("repaired");
      if (!known) flags.push("cost_rate_unknown");
      // safeParse succeeded above; re-run to get the typed (and stripped/transformed) value.
      const output = req.schema.parse(parsed);
      return {
        ok: true,
        output,
        usage,
        provider: opts.providerName,
        model,
        promptHash: template.hash,
        flags,
      };
    }

    if (attempt === 1) {
      messages.push({ role: "assistant", content: reply.text });
      messages.push({ role: "user", content: repairInstruction(template.schema, issues) });
      continue;
    }
    return fail(
      "schema_invalid",
      `output failed ${template.schema} validation after one repair attempt:\n${issues}`,
    );
  }
  // unreachable: the loop returns on attempt 2
  return fail("provider_error", "pipeline exited without a result");
}

export type { LoadedTemplate, PromptTemplateRef };
