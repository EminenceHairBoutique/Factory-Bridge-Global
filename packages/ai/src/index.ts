/**
 * @fbg/ai — provider-agnostic AI adapter (ADR-007), versioned prompt templates, output schemas.
 *
 * Rules enforced here (CLAUDE.md §4, SECURITY.md §5): no tools, untrusted content is delimited data,
 * outputs are zod-validated with one repair attempt, canary/boundary tokens must never leak, per-call
 * token caps, usage/cost returned to the caller — never written to the DB by this package.
 */
export type {
  AiAdapterFlag,
  AiErrorCode,
  AiProvider,
  AiPurpose,
  AiRequest,
  AiResult,
  AiUsage,
  PromptTemplateRef,
  UntrustedContent,
} from "./contract.js";
export { UnconfiguredProvider } from "./contract.js";

export {
  AiConfigError,
  AnthropicProvider,
  DEFAULT_ANTHROPIC_MODEL,
  type AnthropicProviderOptions,
  type Effort,
} from "./providers/anthropic.js";
export {
  MockProvider,
  type MockProviderOptions,
  type MockReply,
  type MockResponder,
  type MockTurn,
} from "./providers/mock.js";

export {
  DEFAULT_MAX_INPUT_TOKENS,
  DEFAULT_MAX_OUTPUT_TOKENS,
  MAX_OUTPUT_TOKENS_CAP,
  ProviderCallError,
  buildSystemPrompt,
  buildUserPrompt,
  parseJsonOutput,
  runStructuredCompletion,
  type ModelCall,
  type ModelReply,
  type ModelTurn,
  type PipelineOptions,
  type StopKind,
  type SystemPrompt,
} from "./pipeline.js";

export {
  PROMPTS_DIR,
  TemplateError,
  getTemplate,
  listTemplates,
  parseTemplateFile,
  type LoadedTemplate,
} from "./prompts/registry.js";

export {
  MODEL_RATES,
  estimateCostNanoUsd,
  findRate,
  nanoToUsd,
  type ModelRate,
} from "./pricing.js";
export { estimateTokens } from "./tokens.js";
export {
  CANARY_PREFIX,
  SECURITY_PREAMBLE,
  detectLeak,
  newBoundaryToken,
  newCanaryToken,
  sanitizeLabel,
  wrapUntrusted,
} from "./untrusted.js";

export { quoteExtractionV1, type QuoteExtractionV1 } from "./schemas/quote-extraction-v1.js";

/** Template refs for the modules implemented so far. */
export const TEMPLATES = {
  quotationExtractorV1: { id: "quotation_extractor", version: "1.0.0" },
} as const;
