/**
 * Retry backoff: exponential from `baseSeconds`, capped at `maxSeconds`, plus up to `jitterRatio` extra (so a burst of
 * failures does not retry in lockstep). Deterministic given `random`, which tests inject.
 */

export interface BackoffPolicy {
  readonly baseSeconds: number;
  readonly maxSeconds: number;
  /** 0 disables jitter; 0.2 adds up to +20 %. The result never exceeds maxSeconds. */
  readonly jitterRatio: number;
}

export const DEFAULT_BACKOFF: BackoffPolicy = {
  baseSeconds: 10,
  maxSeconds: 900,
  jitterRatio: 0.2,
};

/** Seconds to keep a failed message invisible before attempt `failedAttempt + 1`. Integer, >= 0. */
export function backoffSeconds(
  failedAttempt: number,
  policy: BackoffPolicy,
  random: () => number = Math.random,
): number {
  if (!Number.isInteger(failedAttempt) || failedAttempt < 1) {
    throw new Error("failedAttempt must be a positive integer");
  }
  const { baseSeconds, maxSeconds, jitterRatio } = policy;
  if (baseSeconds < 0 || maxSeconds < baseSeconds || jitterRatio < 0 || jitterRatio > 1) {
    throw new Error("invalid backoff policy");
  }
  // 2^(n-1) grows past any cap quickly; clamp the exponent so the arithmetic stays finite.
  const exponential = baseSeconds * 2 ** Math.min(failedAttempt - 1, 30);
  const capped = Math.min(maxSeconds, exponential);
  const r = Math.min(Math.max(random(), 0), 1);
  return Math.min(maxSeconds, Math.round(capped * (1 + jitterRatio * r)));
}
