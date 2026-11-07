/** Environment parsing for the worker. Fails fast on missing required values; never logs secrets. */

export interface WorkerConfig {
  readonly healthPort: number;
  readonly concurrency: number;
  readonly jobMaxAttempts: number;
  readonly appEnv: "development" | "staging" | "production";
}

function intFromEnv(env: NodeJS.ProcessEnv, name: string, fallback: number): number {
  const raw = env[name];
  if (raw === undefined || raw === "") return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) throw new Error(`${name} must be a positive integer`);
  return n;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): WorkerConfig {
  const appEnv = env.APP_ENV ?? "development";
  if (appEnv !== "development" && appEnv !== "staging" && appEnv !== "production") {
    throw new Error(`APP_ENV must be development|staging|production, got "${appEnv}"`);
  }
  return {
    healthPort: intFromEnv(env, "WORKER_HEALTH_PORT", 8080),
    concurrency: intFromEnv(env, "WORKER_CONCURRENCY", 2),
    jobMaxAttempts: intFromEnv(env, "JOB_MAX_ATTEMPTS", 5),
    appEnv,
  };
}
