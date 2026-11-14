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
  /**
   * Document scanning + parsing (B-12 / B-13). Null = disabled: the fbg_documents queue fails closed. It is only
   * ever non-null in development — see documentsFromEnv().
   */
  readonly documents: DocumentProcessingConfig | null;
}

export interface DocumentProcessingConfig {
  /** Supabase project URL the worker reads quarantine from and promotes to. */
  readonly supabaseUrl: string;
  /** Service-role key for Storage. A secret: never logged, never placed in an error message. */
  readonly serviceRoleKey: string;
  readonly scanner: "clamav";
  readonly clamavHost: string;
  readonly clamavPort: number;
  readonly scanTimeoutSeconds: number;
  readonly parseTimeoutSeconds: number;
  readonly parserHeapMb: number;
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

/**
 * Document processing is off unless DOCUMENT_PROCESSING=enabled, and "enabled" is accepted only when everything it
 * needs is present — there is no half-configured mode:
 *
 *  - APP_ENV must be `development`, set explicitly, with NODE_ENV not `production`, and both the database and the
 *    Supabase URL must be loopback hosts. The parser sandbox is process-level containment (Node's permission model
 *    plus a runtime network guard); it is not an operating-system sandbox, and native image-decoding code is
 *    outside it. Until an OS-level boundary exists and is tested, the worker refuses to process uploads anywhere
 *    but against a stack on its own machine (ADR-045). This is a deliberate refusal, not a missing feature flag.
 *  - a database, the Supabase URL and the service-role key (Storage);
 *  - SCANNER=clamav. No other scanner is implemented, and none is the same as "do not process": a document can
 *    only leave quarantine on a clean verdict from an engine that answered (ADR-009, proposed ADR-043).
 */
const LOOPBACK_HOSTS: ReadonlySet<string> = new Set(["127.0.0.1", "localhost", "[::1]", "::1"]);

function documentsFromEnv(
  env: NodeJS.ProcessEnv,
  appEnv: WorkerConfig["appEnv"],
  databaseUrl: string | null,
): DocumentProcessingConfig | null {
  const mode = env.DOCUMENT_PROCESSING ?? "disabled";
  if (mode === "" || mode === "disabled") return null;
  if (mode !== "enabled") throw new Error("DOCUMENT_PROCESSING must be enabled or disabled");
  if (appEnv !== "development") {
    throw new Error(
      `DOCUMENT_PROCESSING cannot be enabled when APP_ENV=${appEnv}: the parser sandbox has process-level isolation only (ADR-045)`,
    );
  }
  // "development" must be said, not assumed: APP_ENV defaults to development when unset, and a hosted worker
  // that merely forgot the variable must not slip through the gate above.
  if (env.APP_ENV !== "development") {
    throw new Error(
      "DOCUMENT_PROCESSING=enabled requires APP_ENV=development to be set explicitly (ADR-045)",
    );
  }
  if (env.NODE_ENV === "production") {
    throw new Error("DOCUMENT_PROCESSING cannot be enabled when NODE_ENV=production (ADR-045)");
  }
  if (databaseUrl === null) {
    throw new Error("DOCUMENT_PROCESSING=enabled requires WORKER_DATABASE_URL");
  }
  // And the label is checked against where the worker actually points: until an OS-level sandbox exists, uploads
  // are processed only against a stack on this machine (local Supabase, CI), never a hosted project.
  let databaseHost: string;
  try {
    databaseHost = new URL(databaseUrl).hostname;
  } catch {
    throw new Error("WORKER_DATABASE_URL must be a valid URL");
  }
  if (!LOOPBACK_HOSTS.has(databaseHost)) {
    throw new Error(
      "DOCUMENT_PROCESSING=enabled requires WORKER_DATABASE_URL to point at a loopback host (ADR-045)",
    );
  }
  const supabaseUrl = env.SUPABASE_URL;
  if (supabaseUrl === undefined || supabaseUrl.trim() === "") {
    throw new Error("DOCUMENT_PROCESSING=enabled requires SUPABASE_URL");
  }
  let parsed: URL;
  try {
    parsed = new URL(supabaseUrl);
  } catch {
    throw new Error("SUPABASE_URL must be a valid URL");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("SUPABASE_URL must be an http(s) URL");
  }
  if (!LOOPBACK_HOSTS.has(parsed.hostname)) {
    throw new Error(
      "DOCUMENT_PROCESSING=enabled requires SUPABASE_URL to point at a loopback host (ADR-045)",
    );
  }
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (
    serviceRoleKey === undefined ||
    serviceRoleKey.trim() === "" ||
    serviceRoleKey === "replace-me"
  ) {
    // The value is a secret: the error names the variable, never echoes it.
    throw new Error("DOCUMENT_PROCESSING=enabled requires SUPABASE_SERVICE_ROLE_KEY");
  }
  const scanner = env.SCANNER ?? "";
  if (scanner !== "clamav") {
    throw new Error(
      "DOCUMENT_PROCESSING=enabled requires SCANNER=clamav (no other scanner is implemented; without one nothing may leave quarantine)",
    );
  }
  const clamavHost = env.CLAMAV_HOST ?? "127.0.0.1";
  if (!/^[A-Za-z0-9.:[\]-]{1,253}$/.test(clamavHost)) {
    throw new Error("CLAMAV_HOST must be a host name or IP address");
  }
  const clamavPort = intFromEnv(env, "CLAMAV_PORT", 3310);
  if (clamavPort > 65_535) throw new Error("CLAMAV_PORT must be 1-65535");
  return {
    supabaseUrl,
    serviceRoleKey,
    scanner: "clamav",
    clamavHost,
    clamavPort,
    scanTimeoutSeconds: intFromEnv(env, "SCAN_TIMEOUT_SECONDS", 60),
    parseTimeoutSeconds: intFromEnv(env, "PARSE_TIMEOUT_SECONDS", 60),
    parserHeapMb: intFromEnv(env, "PARSER_MAX_HEAP_MB", 512),
  };
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
    documents: documentsFromEnv(env, appEnv, databaseUrl),
  };
}
