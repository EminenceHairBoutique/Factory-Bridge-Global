import { describe, expect, it } from "vitest";
import { loadConfig } from "./config.js";

describe("worker config", () => {
  it("uses safe defaults", () => {
    const c = loadConfig({});
    expect(c).toEqual({
      healthPort: 8080,
      concurrency: 2,
      jobMaxAttempts: 5,
      appEnv: "development",
    });
  });

  it("rejects invalid numbers and unknown environments", () => {
    expect(() => loadConfig({ WORKER_CONCURRENCY: "0" })).toThrow(/positive integer/);
    expect(() => loadConfig({ APP_ENV: "prod" })).toThrow(/APP_ENV/);
  });
});
