/**
 * Worker entrypoint (B-11): pgmq consumer over the four queues of migration 0012 + /health + graceful shutdown.
 * fbg_notifications always has its handler. fbg_documents (B-12 / B-13: scan + parse) gets its handler only when
 * document processing is enabled, complete and its parser sandbox passes the containment probe at start-up
 * (documents/bootstrap.ts); otherwise it fails closed like fbg_extraction and fbg_fx (handlers/index.ts).
 * GuardedAiRunner (B-16b) is deliberately not wired here: no handler calls an AI provider until gate G2.
 */
import { hostname } from "node:os";
import pino from "pino";
import { loadConfig } from "./config.js";
import { createServiceRoleDb, type ServiceRoleDb } from "./db.js";
import { bootstrapDocuments } from "./documents/bootstrap.js";
import { WORKER_QUEUES, defaultHandlers } from "./handlers/index.js";
import { QueueHealthProbe, healthBody, startHealthServer } from "./health.js";
import { Consumer } from "./queue/consumer.js";
import { describeError } from "./queue/errors.js";
import { PgQueueStore } from "./queue/pg-store.js";

const config = loadConfig();
const log = pino({
  level: process.env.LOG_LEVEL ?? "info",
  redact: [
    "*.authorization",
    "*.apiKey",
    "*.serviceRoleKey",
    "*.serviceKey",
    "*.databaseUrl",
    "*.connectionString",
    "req.headers.authorization",
  ],
});

const startedAt = new Date().toISOString();
const workerId = config.workerId ?? `${hostname()}:${process.pid}`;

let db: ServiceRoleDb | null = null;
let consumer: Consumer | null = null;
let store: PgQueueStore | null = null;

if (config.databaseUrl !== null) {
  db = await createServiceRoleDb(config.databaseUrl, {
    // each in-flight job can hold its success transaction and a heartbeat at once, plus reads and /health
    max: config.concurrency * 2 + 2,
    statementTimeoutMs: 30_000,
    applicationName: "fbg-worker",
    onPoolError: (err) => log.error({ error: describeError(err) }, "idle database client error"),
  });
  store = new PgQueueStore(db);
  const documents = await bootstrapDocuments(config.documents, db, log);
  if (documents.enabled) log.info("document processing enabled (scan + sandboxed parse)");
  else
    log.info({ reason: documents.reason }, "document processing off: fbg_documents fails closed");
  consumer = new Consumer({
    store,
    handlers: defaultHandlers(documents.enabled ? { documents: documents.handler } : {}),
    log,
    workerId,
    concurrency: config.concurrency,
    visibilityTimeoutSeconds: config.visibilityTimeoutSeconds,
    maxAttempts: config.jobMaxAttempts,
    backoff: {
      baseSeconds: config.backoffBaseSeconds,
      maxSeconds: config.backoffMaxSeconds,
      jitterRatio: 0.2,
    },
    busyRetrySeconds: Math.min(30, config.visibilityTimeoutSeconds),
    pollIntervalMs: config.pollIntervalMs,
    jobTimeoutMs: config.jobTimeoutSeconds * 1_000,
  });
  consumer.start();
  log.info(
    { workerId, queues: WORKER_QUEUES, concurrency: config.concurrency, env: config.appEnv },
    "queue consumer started",
  );
} else {
  log.warn("WORKER_DATABASE_URL is not set: queue consumer disabled (development only)");
}

const probe = new QueueHealthProbe(store, WORKER_QUEUES, log);
const server = startHealthServer(
  config.healthPort,
  async () => healthBody(startedAt, config.appEnv, await probe.check(), consumer?.status() ?? null),
  log,
);

let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  log.info({ signal }, "shutting down");
  setTimeout(() => process.exit(1), config.shutdownGraceMs + 10_000).unref();
  try {
    if (consumer !== null) {
      const { abandoned } = await consumer.stop(config.shutdownGraceMs);
      if (abandoned > 0) {
        log.warn({ abandoned }, "jobs aborted at shutdown; their messages will be redelivered");
      }
    }
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await db?.close();
    process.exit(0);
  } catch (err) {
    log.error({ error: describeError(err) }, "shutdown failed");
    process.exit(1);
  }
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
