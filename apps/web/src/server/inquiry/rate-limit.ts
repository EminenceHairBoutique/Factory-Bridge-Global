/**
 * Best-effort, in-memory abuse controls for the public sourcing-request form — B-31.
 *
 * Both structures live in one server process. On a multi-instance or serverless host each instance keeps its
 * own window, so these are a speed bump against casual abuse, not a durable limit; the durable per-key limiter
 * with `security_events` logging is B-28 (which should also key IPv6 clients by /64 prefix and cap deliveries
 * globally — an attacker rotating addresses inside one IPv6 /64 is not limited here). Memory is bounded: the
 * maps evict their least recently used keys past `maxKeys`.
 */

export class SlidingWindowLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly maxKeys = 5_000,
  ) {}

  /** Records one attempt for `key`; returns false when the key is over its limit for the window. */
  take(key: string, now: number): boolean {
    const since = now - this.windowMs;
    const recent = (this.hits.get(key) ?? []).filter((t) => t > since);
    const allowed = recent.length < this.limit;
    if (allowed) recent.push(now);
    // Re-insert on every attempt, refused ones included, so an active offender is the last key evicted.
    this.hits.delete(key);
    this.hits.set(key, recent);
    while (this.hits.size > this.maxKeys) {
      const oldest = this.hits.keys().next().value;
      if (oldest === undefined) break;
      this.hits.delete(oldest);
    }
    return allowed;
  }
}

/** Remembers the outcome of recent submission ids so a replayed submission is answered, not re-sent. */
export class RecentResults<T> {
  private readonly entries = new Map<string, { at: number; value: T }>();

  constructor(
    private readonly ttlMs: number,
    private readonly maxKeys = 5_000,
  ) {}

  get(key: string, now: number): T | undefined {
    const hit = this.entries.get(key);
    if (!hit) return undefined;
    if (now - hit.at > this.ttlMs) {
      this.entries.delete(key);
      return undefined;
    }
    return hit.value;
  }

  set(key: string, value: T, now: number): void {
    this.entries.delete(key);
    this.entries.set(key, { at: now, value });
    while (this.entries.size > this.maxKeys) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }
  }
}

/**
 * The client address used as the rate-limit key. Behind a proxy the left-most `x-forwarded-for` entry is the
 * client as reported by the edge; it is spoofable where no trusted proxy rewrites it, which is acceptable for a
 * best-effort limit. Only used as an in-memory key; never logged or stored.
 */
export function clientKey(forwardedFor: string | null, realIp: string | null): string {
  const first = forwardedFor?.split(",")[0]?.trim();
  const candidate = first || realIp?.trim() || "";
  return /^[0-9a-fA-F:.]{2,45}$/.test(candidate) ? candidate : "unknown";
}
