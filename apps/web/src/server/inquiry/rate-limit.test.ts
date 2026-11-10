import { describe, expect, it } from "vitest";
import { RecentResults, SlidingWindowLimiter, clientKey } from "./rate-limit";

describe("best-effort abuse controls", () => {
  it("allows `limit` attempts per window per key, then refuses until the window slides", () => {
    const l = new SlidingWindowLimiter(3, 1000);
    expect([l.take("a", 0), l.take("a", 10), l.take("a", 20)]).toEqual([true, true, true]);
    expect(l.take("a", 30)).toBe(false);
    expect(l.take("b", 30)).toBe(true);
    expect(l.take("a", 1001)).toBe(true);
  });

  it("keeps memory bounded by evicting the oldest keys", () => {
    const l = new SlidingWindowLimiter(1, 1000, 2);
    l.take("a", 0);
    l.take("b", 0);
    l.take("c", 0);
    // "a" was evicted, so it starts a fresh window.
    expect(l.take("a", 1)).toBe(true);
    expect(l.take("c", 1)).toBe(false);
  });

  it("remembers recent results until they expire", () => {
    const r = new RecentResults<string>(1000, 2);
    r.set("x", "sent", 0);
    expect(r.get("x", 999)).toBe("sent");
    expect(r.get("x", 1001)).toBeUndefined();
    r.set("a", "1", 0);
    r.set("b", "2", 0);
    r.set("c", "3", 0);
    expect(r.get("a", 1)).toBeUndefined();
    expect(r.get("c", 1)).toBe("3");
  });

  it("derives a client key from proxy headers and refuses anything that is not an address", () => {
    expect(clientKey("203.0.113.7, 10.0.0.1", null)).toBe("203.0.113.7");
    expect(clientKey(null, "2001:db8::1")).toBe("2001:db8::1");
    expect(clientKey("<script>", null)).toBe("unknown");
    expect(clientKey(null, null)).toBe("unknown");
  });
});
