/**
 * Worker entrypoint. Phase 1 B-01: health endpoint + graceful shutdown only.
 * B-11 adds the pgmq consumer (idempotency keys, retries, dead letter).
 */
import { createServer } from "node:http";
import pino from "pino";
import { loadConfig } from "./config.js";

const config = loadConfig();
const log = pino({
  level: process.env.LOG_LEVEL ?? "info",
  redact: ["*.authorization", "*.apiKey", "*.serviceRoleKey", "req.headers.authorization"],
});

const startedAt = new Date().toISOString();

const server = createServer((req, res) => {
  if (req.url === "/health" && req.method === "GET") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, startedAt, env: config.appEnv, queue: "not_configured" }));
    return;
  }
  res.writeHead(404);
  res.end();
});

server.listen(config.healthPort, () => {
  log.info({ port: config.healthPort, env: config.appEnv }, "worker health endpoint listening");
});

function shutdown(signal: string): void {
  log.info({ signal }, "shutting down");
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
