import { describe, expect, it } from "vitest";
import { compareQuotes, evaluateQuote, selectTier } from "./compare-demo";
import { DEMO_AS_OF, DEMO_FREIGHT_ESTIMATE, DEMO_QUOTES } from "./demo-data";

const byId = (id: string) => {
  const q = DEMO_QUOTES.find((x) => x.id === id);
  if (!q) throw new Error(`missing demo quote ${id}`);
  return q;
};

describe("design-preview comparison helper (display-only mirror of QUOTE_ENGINE_SPEC §2)", () => {
  it("selects tiers as [min, max) and never a higher tier for a lower quantity", () => {
    const a = byId("q_demo_a");
    expect(selectTier(a, 10_000)?.unitPrice).toBe(0.21);
    expect(selectTier(a, 9_999)?.unitPrice).toBe(0.26);
    expect(selectTier(a, 60_000)).toBeNull();
  });

  it("groups FOB and EXW separately and never ranks across them on goods price", () => {
    const result = compareQuotes(DEMO_QUOTES, 10_000, DEMO_AS_OF, {});
    const keys = result.groups.map((g) => g.key);
    expect(keys).toContain("FOB Shenzhen");
    expect(keys).toContain("EXW Dongguan");
    expect(result.landedRanking).toBeNull();
    expect(result.landedRankingBlockedBy.length).toBeGreaterThan(0);
  });

  it("excludes expired, below-MOQ and hard-mismatch quotes with the right reasons", () => {
    const result = compareQuotes(DEMO_QUOTES, 10_000, DEMO_AS_OF, {});
    const excluded = result.groups.find((g) => g.kind === "excluded");
    const reasons = Object.fromEntries(
      (excluded?.quotes ?? []).map((e) => [e.quote.id, e.exclusion?.code]),
    );
    expect(reasons.q_demo_c).toBe("hard_mismatch");
    expect(reasons.q_demo_d).toBe("expired");
    expect(reasons.q_demo_e).toBe("below_moq");
  });

  it("flags a null valid_until as validity_unconfirmed but keeps the quote", () => {
    const b = evaluateQuote(byId("q_demo_b"), 10_000, DEMO_AS_OF, undefined);
    expect(b.exclusion).toBeNull();
    expect(b.flags).toContain("validity_unconfirmed");
  });

  it("keeps landed totals partial while any required line is missing, even with freight estimates", () => {
    const overrides = Object.fromEntries(
      Object.entries(DEMO_FREIGHT_ESTIMATE.perQuoteUsd).map(([id, lines]) => [
        id,
        Object.fromEntries(
          Object.entries(lines).map(([type, amountUsd]) => [
            type,
            { amountUsd, status: "estimated" as const, source: DEMO_FREIGHT_ESTIMATE.source },
          ]),
        ),
      ]),
    );
    const a = evaluateQuote(byId("q_demo_a"), 10_000, DEMO_AS_OF, overrides.q_demo_a);
    expect(a.estimatedLines).toContain("international_freight");
    expect(a.missingLines).toContain("duties_taxes");
    expect(a.landedComplete).toBe(false);
    expect(a.landedTotalUsd).toBeNull();
  });

  it("converts CNY goods at the recorded demo FX rate for display", () => {
    const a = evaluateQuote(byId("q_demo_a"), 10_000, DEMO_AS_OF, undefined);
    expect(a.goodsOriginal).toBeCloseTo(2_100, 6);
    expect(a.goodsUsd).toBeCloseTo(291.67, 2);
    expect(a.oneTimeFeesUsd).toBeCloseTo(41.67, 2);
  });
});

describe("basis not stated", () => {
  it("never ranks a quote whose price basis is unknown or unconfirmed", () => {
    const result = compareQuotes(DEMO_QUOTES, 10_000, DEMO_AS_OF, {});
    const excluded = result.groups.find((g) => g.kind === "excluded");
    const f = excluded?.quotes.find((e) => e.quote.id === "q_demo_f");
    expect(f?.exclusion?.code).toBe("basis_unknown");
    expect(
      result.groups.some(
        (g) => g.kind === "basis" && g.quotes.some((e) => e.quote.id === "q_demo_f"),
      ),
    ).toBe(false);
  });
});
