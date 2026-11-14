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
      documents: null,
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

describe("document processing config (B-12 / B-13)", () => {
  const db = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
  const full = {
    APP_ENV: "development",
    DOCUMENT_PROCESSING: "enabled",
    WORKER_DATABASE_URL: db,
    SUPABASE_URL: "http://127.0.0.1:54321",
    SUPABASE_SERVICE_ROLE_KEY: "local-service-role-value",
    SCANNER: "clamav",
  };
  const without = (key: keyof typeof full): Record<string, string> => {
    const rest: Record<string, string> = { ...full };
    delete rest[key];
    return rest;
  };

  it("is off by default, and off means off", () => {
    expect(loadConfig({}).documents).toBeNull();
    expect(loadConfig({ DOCUMENT_PROCESSING: "disabled", SCANNER: "clamav" }).documents).toBeNull();
    expect(() => loadConfig({ DOCUMENT_PROCESSING: "yes" })).toThrow(/enabled or disabled/);
  });

  it("when enabled in development with everything present, carries the scanner and limits", () => {
    expect(loadConfig(full).documents).toEqual({
      supabaseUrl: "http://127.0.0.1:54321",
      serviceRoleKey: "local-service-role-value",
      scanner: "clamav",
      clamavHost: "127.0.0.1",
      clamavPort: 3310,
      scanTimeoutSeconds: 60,
      parseTimeoutSeconds: 60,
      parserHeapMb: 512,
    });
    expect(
      loadConfig({ ...full, CLAMAV_HOST: "clamav.internal", CLAMAV_PORT: "3311" }).documents,
    ).toMatchObject({ clamavHost: "clamav.internal", clamavPort: 3311 });
  });

  it("refuses to enable outside development: process-level isolation is not enough for a hosted worker", () => {
    for (const APP_ENV of ["staging", "production"]) {
      expect(() =>
        loadConfig({ ...full, APP_ENV, SUPABASE_URL: "https://project.supabase.co" }),
      ).toThrow(/cannot be enabled when APP_ENV=.*process-level isolation only \(ADR-045\)/);
    }
  });

  it("has no half-configured mode: every missing piece is a start-up error, and no scanner means no processing", () => {
    expect(() => loadConfig(without("WORKER_DATABASE_URL"))).toThrow(/WORKER_DATABASE_URL/);
    expect(() => loadConfig(without("SUPABASE_URL"))).toThrow(/SUPABASE_URL/);
    expect(() => loadConfig(without("SUPABASE_SERVICE_ROLE_KEY"))).toThrow(
      /SUPABASE_SERVICE_ROLE_KEY/,
    );
    expect(() => loadConfig({ ...full, SUPABASE_SERVICE_ROLE_KEY: "replace-me" })).toThrow(
      /SUPABASE_SERVICE_ROLE_KEY/,
    );
    expect(() => loadConfig(without("SCANNER"))).toThrow(/SCANNER=clamav/);
    expect(() => loadConfig({ ...full, SCANNER: "none" })).toThrow(/SCANNER=clamav/);
    expect(() => loadConfig({ ...full, SCANNER: "hosted" })).toThrow(
      /no other scanner is implemented/,
    );
    expect(() => loadConfig({ ...full, SUPABASE_URL: "ftp://127.0.0.1" })).toThrow(/http\(s\)/);
    expect(() => loadConfig({ ...full, SUPABASE_URL: "not a url" })).toThrow(/valid URL/);
    expect(() => loadConfig({ ...full, CLAMAV_PORT: "70000" })).toThrow(/CLAMAV_PORT/);
    expect(() => loadConfig({ ...full, CLAMAV_HOST: "bad host;rm" })).toThrow(/CLAMAV_HOST/);
  });

  it("'development' must be said and must be true: an unset APP_ENV or a hosted target does not pass the gate", () => {
    // APP_ENV defaults to development when unset — a hosted worker that forgot the variable must not get through
    expect(() => loadConfig(without("APP_ENV"))).toThrow(
      /APP_ENV=development to be set explicitly/,
    );
    expect(() =>
      loadConfig({
        ...without("APP_ENV"),
        NODE_ENV: "production",
        SUPABASE_URL: "https://project.supabase.co",
        WORKER_DATABASE_URL: "postgresql://worker:pw@db.project.supabase.co:5432/postgres",
      }),
    ).toThrow(/APP_ENV=development to be set explicitly/);
    expect(() => loadConfig({ ...full, NODE_ENV: "production" })).toThrow(/NODE_ENV=production/);
    // …and the label is checked against where the worker points: loopback only, for storage and for the database
    expect(() => loadConfig({ ...full, SUPABASE_URL: "https://project.supabase.co" })).toThrow(
      /SUPABASE_URL to point at a loopback host/,
    );
    expect(() => loadConfig({ ...full, SUPABASE_URL: "http://10.0.0.5:54321" })).toThrow(
      /loopback/,
    );
    expect(() =>
      loadConfig({
        ...full,
        WORKER_DATABASE_URL: "postgresql://worker:pw@db.project.supabase.co:5432/postgres",
      }),
    ).toThrow(/WORKER_DATABASE_URL to point at a loopback host/);
    expect(
      loadConfig({ ...full, SUPABASE_URL: "http://localhost:54321" }).documents,
    ).not.toBeNull();
  });

  it("never echoes the service-role key in an error", () => {
    const secret = "sb_secret_DO-NOT-PRINT-ME";
    let message = "";
    try {
      loadConfig({ ...full, SUPABASE_SERVICE_ROLE_KEY: secret, SCANNER: "none" });
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message).not.toBe("");
    expect(message).not.toContain(secret);
  });
});
