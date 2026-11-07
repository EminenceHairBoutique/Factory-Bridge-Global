import { describe, expect, it } from "vitest";
import { estimateCostNanoUsd, findRate, nanoToUsd } from "./pricing.js";

describe("pricing", () => {
  it("computes exact integer nano-USD from the price table (claude-opus-5-5: $4 / $20 / $0.20 / $5)", () => {
    const c = estimateCostNanoUsd("claude-opus-5-5", {
      inputTokens: 1_000_000,
      outputTokens: 100_000,
      cacheReadInputTokens: 500_000,
      cacheCreationInputTokens: 200_000,
    });
    expect(c.known).toBe(true);
    // 4 + 2 + 0.1 + 1.0 USD
    expect(c.nanoUsd).toBe(7_100_000_000);
    expect(nanoToUsd(c.nanoUsd)).toBeCloseTo(7.1, 9);
  });

  it("matches dated / suffixed model ids by longest prefix", () => {
    expect(findRate("claude-opus-5-5-20260401")).toEqual(findRate("claude-opus-5-5"));
    expect(findRate("claude-opus-5")).not.toEqual(findRate("claude-opus-5-5"));
    expect(findRate("claude-opus-5@20260101")?.inputNano).toBe(5_000);
  });

  it("reports unknown models honestly instead of inventing a rate", () => {
    const c = estimateCostNanoUsd("some-future-model", {
      inputTokens: 10,
      outputTokens: 10,
      cacheReadInputTokens: 0,
      cacheCreationInputTokens: 0,
    });
    expect(c).toEqual({ nanoUsd: 0, known: false });
  });

  it("is free for the mock model", () => {
    const c = estimateCostNanoUsd("mock", {
      inputTokens: 1000,
      outputTokens: 1000,
      cacheReadInputTokens: 0,
      cacheCreationInputTokens: 0,
    });
    expect(c).toEqual({ nanoUsd: 0, known: true });
  });
});
