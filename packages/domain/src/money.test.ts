import { describe, expect, it } from "vitest";
import {
  add,
  convert,
  formatTotal,
  formatUnitPrice,
  money,
  multiply,
  type FxRate,
} from "./money.js";

describe("money", () => {
  it("adds same-currency amounts exactly", () => {
    const r = add(money("0.1", "USD"), money("0.2", "USD"));
    expect(r.amount.toString()).toBe("0.3");
  });

  it("refuses to add different currencies", () => {
    expect(() => add(money(1, "USD"), money(1, "CNY"))).toThrow(/Currency mismatch/);
  });

  it("multiplies without float drift", () => {
    expect(multiply(money("8.40", "CNY"), 600).amount.toString()).toBe("5040");
  });

  it("QE-10 precondition: converts only with a rate in the correct direction and records provenance", () => {
    const rate: FxRate = {
      id: "fx_1",
      base: "CNY",
      quote: "USD",
      rate: money("0.1389", "USD").amount,
      rateDate: "2026-11-07",
      source: "test-provider",
    };
    const c = convert(money(2100, "CNY"), rate);
    expect(c.converted.currency).toBe("USD");
    expect(c.converted.amount.toString()).toBe("291.69");
    expect(c.fxRateId).toBe("fx_1");
    expect(c.rateDate).toBe("2026-11-07");
    expect(c.original.amount.toString()).toBe("2100");
    expect(() => convert(money(1, "USD"), rate)).toThrow(/cannot convert USD/);
  });

  it("rounds only at presentation with banker's rounding", () => {
    expect(formatUnitPrice(money("0.21245", "USD"))).toBe("0.2124 USD");
    expect(formatUnitPrice(money("0.21255", "USD"))).toBe("0.2126 USD");
    expect(formatTotal(money("291.665", "USD"))).toBe("291.66 USD");
  });
});
