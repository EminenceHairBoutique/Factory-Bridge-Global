/**
 * Money and quantity arithmetic (ADR-008). Decimal everywhere; rounding only at presentation.
 */
import Decimal from "decimal.js";

Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_EVEN });

export { Decimal };

/** ISO 4217 codes we accept in Phase 1. Extend deliberately. */
export const CURRENCIES = ["USD", "CNY", "HKD", "EUR"] as const;
export type Currency = (typeof CURRENCIES)[number];

export interface Money {
  readonly amount: Decimal;
  readonly currency: Currency;
}

export class CurrencyMismatchError extends Error {
  constructor(a: Currency, b: Currency) {
    super(`Currency mismatch: ${a} vs ${b}`);
    this.name = "CurrencyMismatchError";
  }
}

export function money(amount: Decimal.Value, currency: Currency): Money {
  return { amount: new Decimal(amount), currency };
}

export function add(a: Money, b: Money): Money {
  if (a.currency !== b.currency) throw new CurrencyMismatchError(a.currency, b.currency);
  return { amount: a.amount.plus(b.amount), currency: a.currency };
}

export function multiply(m: Money, factor: Decimal.Value): Money {
  return { amount: m.amount.times(factor), currency: m.currency };
}

export function isCurrency(value: string): value is Currency {
  return (CURRENCIES as readonly string[]).includes(value);
}

/** A dated FX rate row. Conversions must reference the row id so reports can cite source and date. */
export interface FxRate {
  readonly id: string;
  readonly base: Currency;
  readonly quote: Currency;
  readonly rate: Decimal;
  readonly rateDate: string; // ISO date YYYY-MM-DD
  readonly source: string;
}

export interface Converted {
  readonly original: Money;
  readonly converted: Money;
  readonly fxRateId: string;
  readonly rate: Decimal;
  readonly rateDate: string;
  readonly source: string;
}

/**
 * Convert `m` to `rate.quote` using `rate`. `rate` must be base→quote where base === m.currency.
 * Never silently inverts a rate; the caller must fetch the correct direction.
 */
export function convert(m: Money, rate: FxRate): Converted {
  if (rate.base !== m.currency) {
    throw new Error(
      `FX rate ${rate.id} is ${rate.base}→${rate.quote}; cannot convert ${m.currency}`,
    );
  }
  return {
    original: m,
    converted: { amount: m.amount.times(rate.rate), currency: rate.quote },
    fxRateId: rate.id,
    rate: rate.rate,
    rateDate: rate.rateDate,
    source: rate.source,
  };
}

/** Presentation rounding only. Unit prices 4 dp, totals 2 dp (QUOTE_ENGINE_SPEC §2.5). */
export function formatUnitPrice(m: Money): string {
  return `${m.amount.toDecimalPlaces(4, Decimal.ROUND_HALF_EVEN).toFixed(4)} ${m.currency}`;
}

export function formatTotal(m: Money): string {
  return `${m.amount.toDecimalPlaces(2, Decimal.ROUND_HALF_EVEN).toFixed(2)} ${m.currency}`;
}
