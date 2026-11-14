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
      aiMonthlyBudgetUsdDefault: 50,
      databaseUrl: null,
      workerId: null,
      visibilityTimeoutSeconds: 120,
      backoffBaseSeconds: 10,
      backoffMaxSeconds: 900,
      pollIntervalMs: 1_000,
      jobTimeoutSeconds: 300,
      shutdownGraceMs: 25_000,
    });
  });

  it("rejects invalid numbers and unknown environments", () => {
    expect(() => loadConfig({ WORKER_CONCURRENCY: "0" })).toThrow(/positive integer/);
    expect(() => loadConfig({ JOB_MAX_ATTEMPTS: "3.5" })).toThrow(/positive integer/);
    expect(() => loadConfig({ JOB_VISIBILITY_TIMEOUT_SECONDS: "1e3" })).toThrow(/positive integer/);
    expect(() => loadConfig({ APP_ENV: "prod" })).toThrow(/APP_ENV/);
    expect(() => loadConfig({ AI_MONTHLY_BUDGET_USD_DEFAULT: "-5" })).toThrow(/USD/);
    expect(loadConfig({ AI_MONTHLY_BUDGET_USD_DEFAULT: "12.5" }).aiMonthlyBudgetUsdDefault).toBe(
      12.5,
    );
    expect(loadConfig({ AI_MONTHLY_BUDGET_USD_DEFAULT: "0" }).aiMonthlyBudgetUsdDefault).toBe(0);
    expect(() =>
      loadConfig({ JOB_BACKOFF_BASE_SECONDS: "60", JOB_BACKOFF_MAX_SECONDS: "30" }),
    ).toThrow(/JOB_BACKOFF_MAX_SECONDS/);
  });

  it("requires a database URL outside development and never echoes it in errors", () => {
    expect(() => loadConfig({ APP_ENV: "staging" })).toThrow(/WORKER_DATABASE_URL is required/);
    expect(() => loadConfig({ APP_ENV: "production" })).toThrow(/WORKER_DATABASE_URL is required/);
    const secret = "mysql://worker:s3cr3t-pa55@db.internal/fbg";
    let message = "";
    try {
      loadConfig({ WORKER_DATABASE_URL: secret });
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message).toMatch(/postgres/);
    expect(message).not.toContain("s3cr3t");
    const url = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
    expect(loadConfig({ APP_ENV: "staging", WORKER_DATABASE_URL: url }).databaseUrl).toBe(url);
  });

  it("validates WORKER_ID", () => {
    expect(loadConfig({ WORKER_ID: "worker-1.fly:abc" }).workerId).toBe("worker-1.fly:abc");
    expect(() => loadConfig({ WORKER_ID: "has spaces" })).toThrow(/WORKER_ID/);
  });
});
