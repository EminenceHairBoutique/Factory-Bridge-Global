/**
 * The queue consumer (B-11). Reads each configured queue with a visibility timeout, validates the envelope, claims
 * the job in the idempotency ledger, runs the queue's handler inside the success transaction (a staged handler first
 * prepares outside any transaction, ADR-044), and on failure either schedules a retry with backoff or files a dead letter. Delivery is at-least-once; effects are once (see store.ts).
 *
 * Fail-closed rules:
 *  - a message that is not a valid envelope, or sits on a queue with no handler, is dead-lettered immediately;
 *  - PermanentJobError (bad payload, unknown type, not implemented, unauthorized) is dead-lettered on its attempt;
 *  - anything else is retried until `maxAttempts`, then dead-lettered;
 *  - nothing is ever acknowledged without either succeeding, being a ledger-proven replay, or being dead-lettered.
 *
 * The consumer never calls an AI provider or any external service itself; handlers do, and none does today.
 */
import type { Logger } from "pino";
import type { SqlClient } from "../ai/store.js";
import { backoffSeconds, type BackoffPolicy } from "./backoff.js";
import { parseEnvelope } from "./envelope.js";
import { LeaseLostError, PermanentJobError, describeError } from "./errors.js";
import type { QueueMessage, QueueStore } from "./store.js";

export interface Job {
  readonly queue: string;
  readonly msgId: string;
  readonly type: string;
  readonly idempotencyKey: string;
  /** Validated as a JSON object by the envelope; its fields are still untrusted — each handler validates them. */
  readonly payload: Readonly<Record<string, unknown>>;
  readonly attempt: number;
}

export interface JobContext {
  /** The service_role transaction that also marks the job succeeded and archives the message. */
  readonly tx: SqlClient;
  /** Aborted when the job exceeds its timeout or the worker is shutting down past its grace period. */
  readonly signal: AbortSignal;
  readonly log: Logger;
}

export type JobHandler = (job: Job, ctx: JobContext) => Promise<void>;

/** Context of a staged handler's preparation: there is deliberately no transaction in it. */
export interface PrepareContext {
  /** Aborted when the job exceeds its timeout or the worker is shutting down past its grace period. */
  readonly signal: AbortSignal;
  readonly log: Logger;
}

/**
 * A handler in two stages, for work that is slow or leaves the database (ADR-044): scanning, parsing, transfers.
 *
 *  1. `prepare` runs under the job's ledger claim, visibility heartbeat and timeout, but with NO SQL transaction
 *     open — nothing is locked while it runs. It may be executed again for the same job (retry, crash take-over,
 *     a second delivery after a lost lease), so everything it does must be safe to repeat.
 *  2. `commit` receives what `prepare` returned and runs inside the success transaction, exactly like a plain
 *     JobHandler: its writes, the ledger's `succeeded` marker and the archive of the message commit together or not
 *     at all. It must be quick and must not leave the database.
 *
 * A failure in either stage is handled like any handler failure (retry with backoff, or dead letter).
 */
export interface StagedJobHandler<P = unknown> {
  prepare(job: Job, ctx: PrepareContext): Promise<P>;
  commit(job: Job, prepared: P, ctx: JobContext): Promise<void>;
  /**
   * Optional housekeeping after the success transaction has committed (again with no transaction open). The job
   * has already succeeded: whatever this does or fails to do cannot change that — a rejection is logged and
   * dropped — and it is NOT re-run on a replay, so it may only do what is safe to skip.
   */
  afterCommit?(job: Job, prepared: P, ctx: PrepareContext): Promise<void>;
}

export type QueueHandler = JobHandler | StagedJobHandler;

export interface ConsumerOptions {
  readonly store: QueueStore;
  /** queue name → handler. The consumer reads exactly these queues. */
  readonly handlers: ReadonlyMap<string, QueueHandler>;
  readonly log: Logger;
  readonly workerId: string;
  readonly concurrency: number;
  readonly visibilityTimeoutSeconds: number;
  readonly maxAttempts: number;
  readonly backoff: BackoffPolicy;
  /** How long to hide a message whose key another delivery is processing. */
  readonly busyRetrySeconds: number;
  readonly pollIntervalMs: number;
  readonly jobTimeoutMs: number;
  readonly random?: () => number;
}

export type ProcessOutcome =
  | "succeeded"
  | "retry_scheduled"
  | "dead_lettered"
  | "duplicate"
  | "busy"
  | "lease_lost"
  | "store_error";

export type ConsumerState = "idle" | "running" | "stopping" | "stopped";

export interface ConsumerStatus {
  readonly state: ConsumerState;
  readonly inFlight: number;
  readonly lastPollAt: string | null;
  readonly consecutivePollErrors: number;
}

const MAX_POLL_ERROR_BACKOFF_MS = 30_000;

export class Consumer {
  private readonly queues: readonly string[];
  private state: ConsumerState = "idle";
  private readonly inFlight = new Map<Promise<ProcessOutcome>, AbortController>();
  private loopDone: Promise<void> | null = null;
  private wake: (() => void) | null = null;
  private lastPollAt: Date | null = null;
  private pollErrors = 0;
  private rotation = 0;

  constructor(private readonly opts: ConsumerOptions) {
    if (opts.handlers.size === 0) throw new Error("consumer needs at least one queue handler");
    if (!Number.isInteger(opts.concurrency) || opts.concurrency < 1) {
      throw new Error("concurrency must be a positive integer");
    }
    if (!Number.isInteger(opts.maxAttempts) || opts.maxAttempts < 1) {
      throw new Error("maxAttempts must be a positive integer");
    }
    if (!Number.isInteger(opts.visibilityTimeoutSeconds) || opts.visibilityTimeoutSeconds < 1) {
      throw new Error("visibilityTimeoutSeconds must be a positive integer");
    }
    this.queues = [...opts.handlers.keys()];
  }

  status(): ConsumerStatus {
    return {
      state: this.state,
      inFlight: this.inFlight.size,
      lastPollAt: this.lastPollAt?.toISOString() ?? null,
      consecutivePollErrors: this.pollErrors,
    };
  }

  /** Starts the long-running poll loop. */
  start(): void {
    if (this.state !== "idle") throw new Error(`consumer cannot start from state ${this.state}`);
    this.state = "running";
    this.loopDone = this.loop();
  }

  /**
   * Graceful shutdown: stop reading, let in-flight jobs finish for up to `graceMs`, then abort the rest. An aborted
   * job's message stays invisible until its visibility timeout and is then redelivered (ledger take-over).
   */
  async stop(graceMs: number): Promise<{ readonly abandoned: number }> {
    if (this.state === "idle") {
      this.state = "stopped";
      return { abandoned: 0 };
    }
    if (this.state === "stopped") return { abandoned: 0 };
    this.state = "stopping";
    this.wake?.();
    await this.loopDone;
    const pending = [...this.inFlight.keys()];
    const graceful = await Promise.race([
      Promise.allSettled(pending).then(() => true),
      delay(graceMs).then(() => false),
    ]);
    let abandoned = 0;
    if (!graceful) {
      abandoned = this.inFlight.size;
      for (const controller of this.inFlight.values())
        controller.abort(new Error("worker shutdown"));
      // Handlers that honour the signal settle promptly; do not wait on ones that do not.
      await Promise.race([Promise.allSettled([...this.inFlight.keys()]), delay(2_000)]);
    }
    this.state = "stopped";
    return { abandoned };
  }

  /**
   * Test/maintenance helper: one read pass over every queue, filling up to `concurrency` slots, and wait for those
   * jobs. Returns the outcomes (empty when every queue had nothing visible).
   */
  async pollOnce(): Promise<ProcessOutcome[]> {
    const started: Promise<ProcessOutcome>[] = [];
    for (const queue of this.queues) {
      const free = this.opts.concurrency - started.length;
      if (free <= 0) break;
      const messages = await this.opts.store.read(queue, this.opts.visibilityTimeoutSeconds, free);
      for (const m of messages) started.push(this.process(m));
    }
    return Promise.all(started);
  }

  /** Repeats pollOnce() until a pass finds nothing (or `maxPasses`). */
  async drain(maxPasses = 100): Promise<ProcessOutcome[]> {
    const all: ProcessOutcome[] = [];
    for (let i = 0; i < maxPasses; i++) {
      const outcomes = await this.pollOnce();
      if (outcomes.length === 0) return all;
      all.push(...outcomes);
    }
    return all;
  }

  /** Handle one delivered message end to end. Never throws: store failures are logged and the message is redelivered. */
  async process(msg: QueueMessage, external?: AbortController): Promise<ProcessOutcome> {
    const { store, log } = this.opts;
    const base = { queue: msg.queue, msgId: msg.msgId, readCount: msg.readCount };
    try {
      const parsed = parseEnvelope(msg.message);
      if (!parsed.ok) {
        await store.deadLetter({
          queue: msg.queue,
          msgId: msg.msgId,
          message: msg.message,
          error: parsed.error,
          attempts: Math.max(1, msg.readCount),
          idempotencyKey: null,
          executionId: null,
        });
        log.warn({ ...base, reason: "invalid_envelope" }, "job dead-lettered");
        return "dead_lettered";
      }
      const { envelope, hash } = parsed;
      const ctx = { ...base, type: envelope.type, idempotencyKey: envelope.idempotency_key };

      const handler = this.opts.handlers.get(msg.queue);
      if (handler === undefined) {
        await store.deadLetter({
          queue: msg.queue,
          msgId: msg.msgId,
          message: msg.message,
          error: `no_handler: queue ${msg.queue} has no registered handler`,
          attempts: Math.max(1, msg.readCount),
          idempotencyKey: envelope.idempotency_key,
          executionId: null,
        });
        log.warn({ ...ctx, reason: "no_handler" }, "job dead-lettered");
        return "dead_lettered";
      }

      const claim = await store.claim({
        queue: msg.queue,
        idempotencyKey: envelope.idempotency_key,
        msgId: msg.msgId,
        payloadHash: hash,
        workerId: this.opts.workerId,
      });
      switch (claim.kind) {
        case "duplicate":
          await store.ack(msg.queue, msg.msgId);
          log.info(
            { ...ctx, ledgerStatus: claim.status },
            "job replay acknowledged without running",
          );
          return "duplicate";
        case "busy":
          await store.setVisibility(msg.queue, msg.msgId, this.opts.busyRetrySeconds);
          log.info({ ...ctx, holderMsgId: claim.holderMsgId }, "job key busy; deferred");
          return "busy";
        case "conflict":
          await store.deadLetter({
            queue: msg.queue,
            msgId: msg.msgId,
            message: msg.message,
            error:
              "idempotency_key_conflict: the key was already used for a message with different content",
            attempts: 1,
            idempotencyKey: envelope.idempotency_key,
            executionId: null,
          });
          log.warn({ ...ctx, reason: "idempotency_key_conflict" }, "job dead-lettered");
          return "dead_lettered";
        case "run":
          break;
      }

      if (claim.attempt > this.opts.maxAttempts) {
        // Earlier deliveries started the job and never recorded an outcome (the worker crashed or was killed while
        // running it). A message that takes the worker down must not be run again forever.
        await store.deadLetter({
          queue: msg.queue,
          msgId: msg.msgId,
          message: msg.message,
          error: `attempts_exhausted: ${this.opts.maxAttempts} attempts started without finishing (worker crash or kill)`,
          attempts: claim.attempt,
          idempotencyKey: envelope.idempotency_key,
          executionId: claim.executionId,
        });
        log.warn(
          { ...ctx, attempt: claim.attempt, reason: "unfinished_attempts" },
          "job dead-lettered",
        );
        return "dead_lettered";
      }

      const job: Job = {
        queue: msg.queue,
        msgId: msg.msgId,
        type: envelope.type,
        idempotencyKey: envelope.idempotency_key,
        payload: envelope.payload,
        attempt: claim.attempt,
      };
      const runCtx = { ...ctx, attempt: claim.attempt, executionId: claim.executionId };
      const controller = external ?? new AbortController();
      const stopHeartbeat = this.heartbeat(msg, controller.signal);
      const timeout = setTimeout(
        () => controller.abort(new Error("job_timeout")),
        this.opts.jobTimeoutMs,
      );
      timeout.unref?.();
      try {
        const jobLog = this.opts.log.child({ queue: job.queue, msgId: job.msgId });
        const signal = controller.signal;
        let commit: (tx: SqlClient) => Promise<void>;
        let afterCommit: (() => Promise<void>) | null = null;
        if (typeof handler === "function") {
          commit = (tx) => handler(job, { tx, signal, log: jobLog });
        } else {
          // Stage 1 runs here, before store.complete(): no transaction is open while it works.
          const prepared = await handler.prepare(job, { signal, log: jobLog });
          if (signal.aborted) throw new Error("job aborted before its commit stage");
          commit = (tx) => handler.commit(job, prepared, { tx, signal, log: jobLog });
          if (handler.afterCommit !== undefined) {
            afterCommit = () =>
              handler.afterCommit?.(job, prepared, { signal, log: jobLog }) ?? Promise.resolve();
          }
        }
        await store.complete(
          { queue: msg.queue, msgId: msg.msgId, executionId: claim.executionId },
          commit,
        );
        log.info(runCtx, "job succeeded");
        if (afterCommit !== null) {
          try {
            await afterCommit();
          } catch (err) {
            // The job is done and acknowledged; housekeeping that failed is reported, never retried through the queue.
            log.warn({ ...runCtx, error: describeError(err) }, "post-commit housekeeping failed");
          }
        }
        return "succeeded";
      } catch (err) {
        if (err instanceof LeaseLostError) {
          log.warn(runCtx, "job finished elsewhere; this delivery's writes were rolled back");
          return "lease_lost";
        }
        const error = controller.signal.aborted
          ? describeError(controller.signal.reason ?? err)
          : describeError(err);
        const permanent = err instanceof PermanentJobError;
        if (permanent || claim.attempt >= this.opts.maxAttempts) {
          await store.deadLetter({
            queue: msg.queue,
            msgId: msg.msgId,
            message: msg.message,
            error,
            attempts: claim.attempt,
            idempotencyKey: envelope.idempotency_key,
            executionId: claim.executionId,
          });
          log.warn(
            { ...runCtx, reason: permanent ? "permanent" : "attempts_exhausted", error },
            "job dead-lettered",
          );
          return "dead_lettered";
        }
        const delaySeconds = backoffSeconds(claim.attempt, this.opts.backoff, this.opts.random);
        await store.scheduleRetry({
          queue: msg.queue,
          msgId: msg.msgId,
          executionId: claim.executionId,
          attempt: claim.attempt,
          error,
          delaySeconds,
        });
        log.warn({ ...runCtx, delaySeconds, error }, "job failed; retry scheduled");
        return "retry_scheduled";
      } finally {
        clearTimeout(timeout);
        stopHeartbeat();
      }
    } catch (err) {
      if (err instanceof LeaseLostError) {
        log.warn(base, "job finished elsewhere while recording this failure");
        return "lease_lost";
      }
      // The ledger / queue write itself failed (e.g. the database is unreachable). Nothing was acknowledged, so
      // the message reappears after its visibility timeout and the ledger takes the job over.
      log.error(
        { ...base, error: describeError(err) },
        "queue store error; message left for redelivery",
      );
      return "store_error";
    }
  }

  /** Extends the message's visibility while its handler runs, until the job is aborted. */
  private heartbeat(msg: QueueMessage, signal: AbortSignal): () => void {
    const vt = this.opts.visibilityTimeoutSeconds;
    const timer = setInterval(
      () => {
        if (signal.aborted) {
          clearInterval(timer);
          return;
        }
        this.opts.store.setVisibility(msg.queue, msg.msgId, vt).catch((err: unknown) => {
          this.opts.log.warn(
            { queue: msg.queue, msgId: msg.msgId, error: describeError(err) },
            "visibility heartbeat failed",
          );
        });
      },
      Math.max(1_000, (vt * 1_000) / 2),
    );
    timer.unref?.();
    return () => clearInterval(timer);
  }

  private async loop(): Promise<void> {
    while (this.state === "running") {
      const free = this.opts.concurrency - this.inFlight.size;
      if (free <= 0) {
        await this.idle(this.opts.pollIntervalMs);
        continue;
      }
      let received = 0;
      let failed = false;
      for (let i = 0; i < this.queues.length && this.state === "running"; i++) {
        const queue = this.queues[(this.rotation + i) % this.queues.length]!;
        const slots = this.opts.concurrency - this.inFlight.size;
        if (slots <= 0) break;
        try {
          const messages = await this.opts.store.read(
            queue,
            this.opts.visibilityTimeoutSeconds,
            slots,
          );
          this.lastPollAt = new Date();
          for (const m of messages) {
            received++;
            this.track(m);
          }
        } catch (err) {
          failed = true;
          this.opts.log.error({ queue, error: describeError(err) }, "queue read failed");
        }
      }
      this.rotation = (this.rotation + 1) % this.queues.length;
      if (failed) {
        this.pollErrors++;
        await this.idle(
          Math.min(MAX_POLL_ERROR_BACKOFF_MS, this.opts.pollIntervalMs * 2 ** this.pollErrors),
        );
      } else {
        this.pollErrors = 0;
        if (received === 0) await this.idle(this.opts.pollIntervalMs);
      }
    }
  }

  private track(msg: QueueMessage): void {
    const controller = new AbortController();
    const p = this.process(msg, controller);
    this.inFlight.set(p, controller);
    void p.finally(() => {
      this.inFlight.delete(p);
      this.wake?.(); // a slot freed up
    });
  }

  /** Sleeps `ms`, or less if stop() or a finishing job wakes the loop. */
  private idle(ms: number): Promise<void> {
    return new Promise((resolve) => {
      const done = (): void => {
        clearTimeout(timer); // runs only after `timer` is initialized (timeout or a later wake)
        if (this.wake === done) this.wake = null;
        resolve();
      };
      const timer = setTimeout(done, ms);
      timer.unref?.();
      this.wake = done;
    });
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    const t = setTimeout(resolve, ms);
    t.unref?.();
  });
}
