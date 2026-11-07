import { describe, expect, it } from "vitest";
import { estimateTokens } from "./tokens.js";

describe("estimateTokens (conservative pre-call estimator)", () => {
  it("counts CJK code points as one token each", () => {
    expect(estimateTokens("起订量：500个")).toBe(5 + Math.ceil(3 / 3)); // 5 CJK (incl. fullwidth colon) + "500"
  });
  it("counts other text at ~3 characters per token, rounding up", () => {
    expect(estimateTokens("abcdef")).toBe(2);
    expect(estimateTokens("abcdefg")).toBe(3);
    expect(estimateTokens("")).toBe(0);
  });
});
