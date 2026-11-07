/** Configuration-only tests. No network: a provider is never constructed with a usable key here. */
import { describe, expect, it } from "vitest";
import { AiConfigError, AnthropicProvider, DEFAULT_ANTHROPIC_MODEL } from "./anthropic.js";

describe("AnthropicProvider configuration", () => {
  it("fromEnv returns null when ANTHROPIC_API_KEY is absent or empty (CI never calls the API)", () => {
    expect(AnthropicProvider.fromEnv({})).toBeNull();
    expect(AnthropicProvider.fromEnv({ ANTHROPIC_API_KEY: "" })).toBeNull();
  });

  it("fromEnv builds a provider with the default model, or FBG_AI_MODEL when set", () => {
    const a = AnthropicProvider.fromEnv({ ANTHROPIC_API_KEY: "test-key-not-real" });
    expect(a?.name).toBe("anthropic");
    expect(a?.model).toBe(DEFAULT_ANTHROPIC_MODEL);
    const b = AnthropicProvider.fromEnv({
      ANTHROPIC_API_KEY: "test-key-not-real",
      FBG_AI_MODEL: "claude-sonnet-5-5",
    });
    expect(b?.model).toBe("claude-sonnet-5-5");
  });

  it("refuses an empty api key", () => {
    expect(() => new AnthropicProvider({ apiKey: "" })).toThrow(AiConfigError);
  });
});
