/** Environment parsing for the worker. Fails fast on missing required values; never logs secrets. */

export interface WorkerConfig {
  readonly healthPort: number;
  readonly concurrency: number;
  readonly jobMaxAttempts: number;
  readonly appEnv: "development" | "staging" | "production";
  /** Platform default monthly AI cap (USD) for orgs without an ai_budgets row (B-16b). */
  readonly aiMonthlyBudgetUsdDefault: number;
  /**
   * The worker's own Postgres connection (it assumes service_role per transaction). Required outside development;
   * in development an unset value runs the health endpoint only, reporting `queue: not_configured` with HTTP 503.
   */
  readonly databaseUrl: string | null;
  /** Stable id recorded in job_executions.worker_id; defaults to hostname:pid at startup. */
  readonly workerId: string | null;
  readonly visibilityTimeoutSeconds: number;
  readonly backoffBaseSeconds: number;
  readonly backoffMaxSeconds: number;
  readonly pollIntervalMs: number;
  readonly jobTimeoutSeconds: number;
  readonly shutdownGraceMs: number;
}

function intFromEnv(env: NodeJS.ProcessEnv, name: string, fallback: number): number {
  const raw = env[name];
  if (raw === undefined || raw === "") return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0 || String(n) !== raw.trim()) {
    throw new Error(`${name} must be a positive integer`);
  }
  return n;
}

function usdFromEnv(env: NodeJS.ProcessEnv, name: string, fallback: number): number {
  const raw = env[name];
  if (raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) throw new Error(`${name} must be a non-negative number of USD`);
  return n;
}

function databaseUrlFromEnv(env: NodeJS.ProcessEnv): string | null {
  const raw = env.WORKER_DATABASE_URL;
  if (raw === undefined || raw.trim() === "") return null;
  // The value is a secret: the error names the variable, never echoes it.
  if (!/^postgres(ql)?:\/\//.test(raw)) {
    throw new Error("WORKER_DATABASE_URL must be a postgres:// or postgresql:// connection string");
  }
  return raw;
}

function workerIdFromEnv(env: NodeJS.ProcessEnv): string | null {
  const raw = env.WORKER_ID;
  if (raw === undefined || raw === "") return null;
  if (!/^[A-Za-z0-9._:-]{1,64}$/.test(raw)) {
    throw new Error("WORKER_ID must be 1-64 characters of [A-Za-z0-9._:-]");
  }
  return raw;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): WorkerConfig {
  const appEnv = env.APP_ENV ?? "development";
  if (appEnv !== "development" && appEnv !== "staging" && appEnv !== "production") {
    throw new Error(`APP_ENV must be development|staging|production, got "${appEnv}"`);
  }
  const databaseUrl = databaseUrlFromEnv(env);
  if (databaseUrl === null && appEnv !== "development") {
    throw new Error(`WORKER_DATABASE_URL is required when APP_ENV=${appEnv}`);
  }
  const backoffBaseSeconds = intFromEnv(env, "JOB_BACKOFF_BASE_SECONDS", 10);
  const backoffMaxSeconds = intFromEnv(env, "JOB_BACKOFF_MAX_SECONDS", 900);
  if (backoffMaxSeconds < backoffBaseSeconds) {
    throw new Error("JOB_BACKOFF_MAX_SECONDS must be >= JOB_BACKOFF_BASE_SECONDS");
  }
  return {
    healthPort: intFromEnv(env, "WORKER_HEALTH_PORT", 8080),
    concurrency: intFromEnv(env, "WORKER_CONCURRENCY", 2),
    jobMaxAttempts: intFromEnv(env, "JOB_MAX_ATTEMPTS", 5),
    appEnv,
    aiMonthlyBudgetUsdDefault: usdFromEnv(env, "AI_MONTHLY_BUDGET_USD_DEFAULT", 50),
    databaseUrl,
    workerId: workerIdFromEnv(env),
    visibilityTimeoutSeconds: intFromEnv(env, "JOB_VISIBILITY_TIMEOUT_SECONDS", 120),
    backoffBaseSeconds,
    backoffMaxSeconds,
    pollIntervalMs: intFromEnv(env, "WORKER_POLL_INTERVAL_MS", 1_000),
    jobTimeoutSeconds: intFromEnv(env, "JOB_TIMEOUT_SECONDS", 300),
    shutdownGraceMs: intFromEnv(env, "WORKER_SHUTDOWN_GRACE_MS", 25_000),
  };
}
