/**
 * GET /health — the worker's only inbound endpoint (ARCHITECTURE.md §7). Reports real queue connectivity: the
 * probe runs pgmq.list_queues() and pgmq.metrics() for every consumed queue as service_role, so "connected" means the
 * worker can actually read its queues, not merely that a TCP socket opened. 200 only when every queue is readable and
 * the consumer loop is running; 503 otherwise.
 *
 * Deliberately minimal: no error text, host names, queue lengths or worker id in the body (it may be reachable from
 * the internet once hosted); details go to the structured log.
 */
import { createServer, type Server } from "node:http";
import type { Logger } from "pino";
import type { ConsumerStatus } from "./queue/consumer.js";
import { describeError } from "./queue/errors.js";
import type { QueueStore } from "./queue/store.js";

export type QueueState = "ok" | "missing" | "unreadable";

export type QueueConnectivity =
  | { readonly status: "not_configured" }
  | { readonly status: "unreachable" }
  | { readonly status: "permission_denied" }
  | {
      readonly status: "connected" | "degraded";
      readonly queues: Readonly<Record<string, QueueState>>;
    };

export interface HealthBody {
  readonly ok: boolean;
  readonly startedAt: string;
  readonly env: string;
  readonly queue: QueueConnectivity;
  readonly consumer: {
    readonly state: ConsumerStatus["state"] | "disabled";
    readonly inFlight: number;
    readonly lastPollAt: string | null;
  };
}

export class QueueHealthProbe {
  private cached: { at: number; value: QueueConnectivity } | null = null;
  private pending: Promise<QueueConnectivity> | null = null;

  constructor(
    private readonly store: QueueStore | null,
    private readonly queues: readonly string[],
    private readonly log: Pick<Logger, "warn">,
    private readonly cacheMs = 5_000,
    private readonly now: () => number = Date.now,
  ) {}

  /** Cached for `cacheMs` and single-flight, so a scraper cannot turn /health into database load. */
  async check(): Promise<QueueConnectivity> {
    if (this.store === null) return { status: "not_configured" };
    if (this.cached !== null && this.now() - this.cached.at < this.cacheMs)
      return this.cached.value;
    this.pending ??= this.run(this.store).finally(() => {
      this.pending = null;
    });
    return this.pending;
  }

  private async run(store: QueueStore): Promise<QueueConnectivity> {
    let value: QueueConnectivity;
    try {
      const probes = await store.probe(this.queues);
      const queues: Record<string, QueueState> = {};
      for (const p of probes)
        queues[p.name] = !p.present ? "missing" : p.readable ? "ok" : "unreadable";
      const allOk = this.queues.every((q) => queues[q] === "ok");
      value = { status: allOk ? "connected" : "degraded", queues };
    } catch (err) {
      const code = (err as { code?: unknown }).code;
      value = { status: code === "42501" ? "permission_denied" : "unreachable" };
      this.log.warn({ error: describeError(err) }, "queue health probe failed");
    }
    this.cached = { at: this.now(), value };
    return value;
  }
}

export function healthBody(
  startedAt: string,
  env: string,
  queue: QueueConnectivity,
  consumer: ConsumerStatus | null,
): { readonly statusCode: 200 | 503; readonly body: HealthBody } {
  const consumerView = consumer
    ? { state: consumer.state, inFlight: consumer.inFlight, lastPollAt: consumer.lastPollAt }
    : { state: "disabled" as const, inFlight: 0, lastPollAt: null };
  const ok = queue.status === "connected" && consumerView.state === "running";
  return {
    statusCode: ok ? 200 : 503,
    body: { ok, startedAt, env, queue, consumer: consumerView },
  };
}

export function startHealthServer(
  port: number,
  respond: () => Promise<{ readonly statusCode: number; readonly body: HealthBody }>,
  log: Pick<Logger, "info" | "error">,
): Server {
  const server = createServer((req, res) => {
    if (req.url !== "/health" || req.method !== "GET") {
      res.writeHead(404);
      res.end();
      return;
    }
    respond().then(
      ({ statusCode, body }) => {
        res.writeHead(statusCode, {
          "content-type": "application/json",
          "cache-control": "no-store",
        });
        res.end(JSON.stringify(body));
      },
      (err: unknown) => {
        log.error({ error: describeError(err) }, "health handler failed");
        res.writeHead(503, { "content-type": "application/json", "cache-control": "no-store" });
        res.end(JSON.stringify({ ok: false }));
      },
    );
  });
  server.listen(port, () => log.info({ port }, "worker health endpoint listening"));
  return server;
}
