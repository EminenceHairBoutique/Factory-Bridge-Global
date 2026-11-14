import pino from "pino";
import { describe, expect, it, vi } from "vitest";
import { notImplementedHandler } from "../handlers/index.js";
import { Consumer, type ConsumerOptions, type JobHandler } from "./consumer.js";
import { buildEnvelope, messageHash } from "./envelope.js";
import { PermanentJobError } from "./errors.js";
import { FakeQueueStore } from "./testing/fake-store.js";

const Q = "test_jobs";
const log = pino({ level: "silent" });

function consumer(
  store: FakeQueueStore,
  handler: JobHandler,
  overrides: Partial<ConsumerOptions> = {},
): Consumer {
  return new Consumer({
    store,
    handlers: new Map([[Q, handler]]),
    log,
    workerId: "w-test",
    concurrency: 2,
    visibilityTimeoutSeconds: 30,
    maxAttempts: 3,
    backoff: { baseSeconds: 10, maxSeconds: 60, jitterRatio: 0 },
    busyRetrySeconds: 5,
    pollIntervalMs: 5,
    jobTimeoutMs: 5_000,
    random: () => 0,
    ...overrides,
  });
}

const envelope = (key: string, payload: Record<string, unknown> = { n: 1 }) =>
  buildEnvelope("test.job", key, payload);

const writing: JobHandler = async (job, { tx }) => {
  await tx.query("insert into effects (key) values ($1)", [job.idempotencyKey]);
};

describe("consumer: success and replay", () => {
  it("runs the handler once inside the success transaction, marks the ledger succeeded and archives the message", async () => {
    const store = new FakeQueueStore();
    const handler = vi.fn(writing);
    const c = consumer(store, handler);
    const msgId = store.send(Q, envelope("job-key-0001", { a: 1 }));

    expect(await c.pollOnce()).toEqual(["succeeded"]);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0]![0]).toMatchObject({
      queue: Q,
      msgId,
      type: "test.job",
      idempotencyKey: "job-key-0001",
      payload: { a: 1 },
      attempt: 1,
    });
    expect(store.ledgerRow(Q, "job-key-0001")).toMatchObject({
      status: "succeeded",
      attempts: 1,
      error: null,
      workerId: "w-test",
    });
    expect(store.committed).toEqual([
      { text: "insert into effects (key) values ($1)", params: ["job-key-0001"] },
    ]);
    expect(store.isArchived(Q, msgId)).toBe(true);
    expect(store.pending(Q)).toBe(0);
    expect(await c.pollOnce()).toEqual([]);
  });

  it("a replay of a finished job (same key, same content, new message) is acknowledged without running", async () => {
    const store = new FakeQueueStore();
    const handler = vi.fn(writing);
    const c = consumer(store, handler);
    store.send(Q, envelope("job-key-0002"));
    expect(await c.drain()).toEqual(["succeeded"]);

    const replay = store.send(Q, envelope("job-key-0002"));
    expect(await c.drain()).toEqual(["duplicate"]);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(store.committed).toHaveLength(1);
    expect(store.isArchived(Q, replay)).toBe(true);
    expect(store.deadLetters).toHaveLength(0);
  });

  it("a duplicate read while the first copy is in flight is deferred (busy), then acknowledged once the first succeeds", async () => {
    const store = new FakeQueueStore();
    let release: () => void = () => undefined;
    const gate = new Promise<void>((r) => (release = r));
    const handler = vi.fn<JobHandler>(async (job, ctx) => {
      await gate;
      await writing(job, ctx);
    });
    const c = consumer(store, handler);
    store.send(Q, envelope("job-key-0003"));
    const dup = store.send(Q, envelope("job-key-0003"));

    const pass = c.pollOnce(); // both copies are read in one pass (concurrency 2)
    await vi.waitFor(() => expect(store.visibilityCalls).toHaveLength(1));
    expect(store.visibilityCalls[0]).toEqual({ queue: Q, msgId: dup, seconds: 5 });
    release();
    expect((await pass).sort()).toEqual(["busy", "succeeded"]);

    store.advance(5_000);
    expect(await c.pollOnce()).toEqual(["duplicate"]);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(store.pending(Q)).toBe(0);
  });

  it("the same key with different content is dead-lettered as a conflict; the original ledger row is untouched", async () => {
    const store = new FakeQueueStore();
    const c = consumer(store, writing);
    store.send(Q, envelope("job-key-0004", { amount: 1 }));
    await c.drain();
    const forged = store.send(Q, envelope("job-key-0004", { amount: 999 }));

    expect(await c.drain()).toEqual(["dead_lettered"]);
    expect(store.deadLetters).toHaveLength(1);
    expect(store.deadLetters[0]).toMatchObject({
      msgId: forged,
      idempotencyKey: "job-key-0004",
      executionId: null,
      attempts: 1,
    });
    expect(store.deadLetters[0]!.error).toMatch(/^idempotency_key_conflict/);
    expect(store.ledgerRow(Q, "job-key-0004")).toMatchObject({ status: "succeeded", attempts: 1 });
    expect(store.committed).toHaveLength(1);
  });
});

describe("consumer: retries, backoff and the dead letter", () => {
  it("a failing job is retried with exponential backoff and lands in the dead letter after maxAttempts", async () => {
    const store = new FakeQueueStore();
    const handler = vi.fn<JobHandler>(() => Promise.reject(new Error("upstream timeout")));
    const c = consumer(store, handler);
    const msgId = store.send(Q, envelope("job-key-0010"));

    expect(await c.pollOnce()).toEqual(["retry_scheduled"]);
    expect(store.ledgerRow(Q, "job-key-0010")).toMatchObject({
      status: "running",
      attempts: 1,
      error: "upstream timeout",
    });
    store.advance(9_999);
    expect(await c.pollOnce()).toEqual([]); // backoff 10 s (attempt 1) not elapsed
    store.advance(1);
    expect(await c.pollOnce()).toEqual(["retry_scheduled"]);
    store.advance(19_999);
    expect(await c.pollOnce()).toEqual([]); // backoff 20 s (attempt 2)
    store.advance(1);
    expect(await c.pollOnce()).toEqual(["dead_lettered"]);

    expect(handler).toHaveBeenCalledTimes(3);
    expect(store.ledgerRow(Q, "job-key-0010")).toMatchObject({
      status: "failed",
      attempts: 3,
      error: "upstream timeout",
    });
    expect(store.deadLetters).toEqual([
      expect.objectContaining({
        queue: Q,
        msgId,
        idempotencyKey: "job-key-0010",
        attempts: 3,
        error: "upstream timeout",
      }),
    ]);
    expect(store.isArchived(Q, msgId)).toBe(true);
    store.advance(3_600_000);
    expect(await c.pollOnce()).toEqual([]);
  });

  it("a transient failure followed by success leaves a succeeded ledger row and no dead letter", async () => {
    const store = new FakeQueueStore();
    let calls = 0;
    const c = consumer(store, async (job, ctx) => {
      calls++;
      if (calls === 1) throw new Error("connection reset");
      await writing(job, ctx);
    });
    store.send(Q, envelope("job-key-0011"));
    expect(await c.pollOnce()).toEqual(["retry_scheduled"]);
    store.advance(10_000);
    expect(await c.pollOnce()).toEqual(["succeeded"]);
    expect(store.ledgerRow(Q, "job-key-0011")).toMatchObject({
      status: "succeeded",
      attempts: 2,
      error: null,
    });
    expect(store.deadLetters).toHaveLength(0);
  });

  it("a failed attempt rolls back the handler's writes", async () => {
    const store = new FakeQueueStore();
    const c = consumer(store, async (job, ctx) => {
      await writing(job, ctx);
      throw new Error("failed after writing");
    });
    store.send(Q, envelope("job-key-0012"));
    expect(await c.pollOnce()).toEqual(["retry_scheduled"]);
    expect(store.committed).toHaveLength(0);
    expect(store.rolledBack).toHaveLength(1);
  });

  it("a PermanentJobError is dead-lettered on its first attempt", async () => {
    const store = new FakeQueueStore();
    const handler = vi.fn<JobHandler>(() =>
      Promise.reject(new PermanentJobError("invalid_payload", "user_id:invalid_format")),
    );
    const c = consumer(store, handler);
    store.send(Q, envelope("job-key-0013"));
    expect(await c.drain()).toEqual(["dead_lettered"]);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(store.ledgerRow(Q, "job-key-0013")).toMatchObject({ status: "failed", attempts: 1 });
    expect(store.deadLetters[0]!.error).toBe(
      "PermanentJobError: invalid_payload: user_id:invalid_format",
    );
  });

  it("a not-implemented queue fails closed: dead letter on the first attempt, never a silent ack", async () => {
    const store = new FakeQueueStore();
    const c = consumer(store, notImplementedHandler(Q, "B-12"));
    const msgId = store.send(Q, envelope("job-key-0014"));
    expect(await c.drain()).toEqual(["dead_lettered"]);
    expect(store.deadLetters[0]).toMatchObject({
      msgId,
      attempts: 1,
      idempotencyKey: "job-key-0014",
    });
    expect(store.deadLetters[0]!.error).toMatch(/not_implemented: no handler for test_jobs yet/);
    expect(store.ledgerRow(Q, "job-key-0014")?.status).toBe("failed");
  });

  it("a job that exceeds its timeout is aborted and retried", async () => {
    const store = new FakeQueueStore();
    const c = consumer(
      store,
      (_job, { signal }) =>
        new Promise((_, reject) => {
          signal.addEventListener("abort", () => reject(new Error("aborted by signal")));
        }),
      { jobTimeoutMs: 20 },
    );
    store.send(Q, envelope("job-key-0015"));
    expect(await c.pollOnce()).toEqual(["retry_scheduled"]);
    expect(store.ledgerRow(Q, "job-key-0015")?.error).toBe("job_timeout");
  });
});

describe("consumer: fail-closed input handling", () => {
  it.each([
    ["not an object", "hello"],
    ["missing idempotency key", { v: 1, type: "test.job", payload: {} }],
    ["short key", { v: 1, type: "test.job", idempotency_key: "short", payload: {} }],
    ["unknown version", { v: 2, type: "test.job", idempotency_key: "job-key-0020", payload: {} }],
    [
      "extra top-level field",
      { v: 1, type: "test.job", idempotency_key: "job-key-0020", payload: {}, run_as: "admin" },
    ],
  ])(
    "an invalid envelope (%s) is dead-lettered without touching the ledger or the handler",
    async (_, raw) => {
      const store = new FakeQueueStore();
      const handler = vi.fn(writing);
      const c = consumer(store, handler);
      const msgId = store.send(Q, raw);
      expect(await c.drain()).toEqual(["dead_lettered"]);
      expect(handler).not.toHaveBeenCalled();
      expect(store.ledger.size).toBe(0);
      expect(store.deadLetters[0]).toMatchObject({
        msgId,
        idempotencyKey: null,
        executionId: null,
        attempts: 1,
        message: raw,
      });
      expect(store.deadLetters[0]!.error).toMatch(/^invalid_envelope/);
    },
  );

  it("a message on a queue without a handler is dead-lettered", async () => {
    const store = new FakeQueueStore();
    const c = consumer(store, writing);
    store.send("other_queue", envelope("job-key-0021"));
    const [m] = await store.read("other_queue", 30, 1);
    expect(await c.process(m!)).toBe("dead_lettered");
    expect(store.deadLetters[0]!.error).toMatch(/^no_handler/);
    expect(store.ledger.size).toBe(0);
  });
});

describe("consumer: crashes, lost leases and store failures", () => {
  it("a delivery whose worker died mid-run is taken over when its visibility timeout lapses (attempt 2)", async () => {
    const store = new FakeQueueStore();
    const handler = vi.fn(writing);
    const c = consumer(store, handler);
    store.send(Q, envelope("job-key-0030"));
    // the "crashed" worker read and claimed the message, then vanished without recording an outcome
    const [m] = await store.read(Q, 30, 1);
    await store.claim({
      queue: Q,
      idempotencyKey: "job-key-0030",
      msgId: m!.msgId,
      payloadHash: messageHash(envelope("job-key-0030")),
      workerId: "w-dead",
    });
    expect(await c.pollOnce()).toEqual([]); // still invisible
    store.advance(30_000);
    expect(await c.pollOnce()).toEqual(["succeeded"]);
    expect(handler.mock.calls[0]![0].attempt).toBe(2);
    expect(store.ledgerRow(Q, "job-key-0030")).toMatchObject({
      status: "succeeded",
      attempts: 2,
      workerId: "w-test",
    });
  });

  it("a message that keeps killing the worker is dead-lettered without running once its attempts are used up", async () => {
    const store = new FakeQueueStore();
    const handler = vi.fn(writing);
    const c = consumer(store, handler);
    store.send(Q, envelope("job-key-0031"));
    for (let i = 0; i < 3; i++) {
      const [m] = await store.read(Q, 30, 1);
      await store.claim({
        queue: Q,
        idempotencyKey: "job-key-0031",
        msgId: m!.msgId,
        payloadHash: messageHash(envelope("job-key-0031")),
        workerId: `w-crash-${i}`,
      });
      store.advance(30_000);
    }
    expect(await c.pollOnce()).toEqual(["dead_lettered"]);
    expect(handler).not.toHaveBeenCalled();
    expect(store.ledgerRow(Q, "job-key-0031")).toMatchObject({ status: "failed", attempts: 4 });
    expect(store.deadLetters[0]!.error).toMatch(/^attempts_exhausted/);
  });

  it("when another delivery finished the job first, this delivery's writes are rolled back and nothing is filed", async () => {
    const store = new FakeQueueStore();
    const c = consumer(store, async (job, ctx) => {
      await writing(job, ctx);
      // simulate a concurrent take-over that committed first
      store.ledger.get(`${Q}|${job.idempotencyKey}`)!.status = "succeeded";
    });
    store.send(Q, envelope("job-key-0032"));
    expect(await c.pollOnce()).toEqual(["lease_lost"]);
    expect(store.committed).toHaveLength(0);
    expect(store.rolledBack).toHaveLength(1);
    expect(store.deadLetters).toHaveLength(0);
  });

  it("a store failure is logged, nothing is acknowledged, and the message is processed after its visibility timeout", async () => {
    const store = new FakeQueueStore();
    const c = consumer(store, writing);
    const msgId = store.send(Q, envelope("job-key-0033"));
    store.failNext.set("claim", new Error("connection refused"));
    expect(await c.pollOnce()).toEqual(["store_error"]);
    expect(store.isArchived(Q, msgId)).toBe(false);
    expect(store.pending(Q)).toBe(1);
    store.advance(30_000);
    expect(await c.pollOnce()).toEqual(["succeeded"]);
  });

  it("if filing the dead letter fails, the message stays queued for redelivery (no silent loss)", async () => {
    const store = new FakeQueueStore();
    const c = consumer(store, () => Promise.reject(new PermanentJobError("invalid_payload", "x")));
    const msgId = store.send(Q, envelope("job-key-0034"));
    store.failNext.set("deadLetter", new Error("connection reset"));
    expect(await c.pollOnce()).toEqual(["store_error"]);
    expect(store.isArchived(Q, msgId)).toBe(false);
    expect(store.deadLetters).toHaveLength(0);
    store.advance(30_000);
    expect(await c.pollOnce()).toEqual(["dead_lettered"]);
  });
});

describe("consumer: loop, heartbeat and graceful shutdown", () => {
  it("the poll loop processes messages from every queue and stops gracefully, letting in-flight jobs finish", async () => {
    const store = new FakeQueueStore();
    const seen: string[] = [];
    const slow: JobHandler = async (job) => {
      await new Promise((r) => setTimeout(r, 30));
      seen.push(`${job.queue}:${job.idempotencyKey}`);
    };
    const c = new Consumer({
      store,
      handlers: new Map([
        ["q_one", slow],
        ["q_two", slow],
      ]),
      log,
      workerId: "w-loop",
      concurrency: 2,
      visibilityTimeoutSeconds: 30,
      maxAttempts: 3,
      backoff: { baseSeconds: 1, maxSeconds: 1, jitterRatio: 0 },
      busyRetrySeconds: 1,
      pollIntervalMs: 5,
      jobTimeoutMs: 5_000,
    });
    store.send("q_one", envelope("loop-key-0001"));
    store.send("q_two", envelope("loop-key-0002"));
    store.send("q_one", envelope("loop-key-0003"));
    c.start();
    expect(c.status().state).toBe("running");
    await vi.waitFor(() => expect(seen).toHaveLength(3), { timeout: 2_000 });
    expect(await c.stop(1_000)).toEqual({ abandoned: 0 });
    expect(c.status().state).toBe("stopped");
    expect(seen.sort()).toEqual([
      "q_one:loop-key-0001",
      "q_one:loop-key-0003",
      "q_two:loop-key-0002",
    ]);
    expect(c.status().lastPollAt).not.toBeNull();
  });

  it("stop() aborts jobs still running after the grace period; their messages are left for redelivery", async () => {
    const store = new FakeQueueStore();
    let aborted = false;
    const c = consumer(
      store,
      (_job, { signal }) =>
        new Promise((_, reject) => {
          signal.addEventListener("abort", () => {
            aborted = true;
            reject(new Error("aborted"));
          });
        }),
    );
    store.send(Q, envelope("loop-key-0010"));
    c.start();
    await vi.waitFor(() => expect(c.status().inFlight).toBe(1));
    expect(await c.stop(20)).toEqual({ abandoned: 1 });
    expect(aborted).toBe(true);
    expect(store.deadLetters).toHaveLength(0);
    expect(store.ledgerRow(Q, "loop-key-0010")?.status).toBe("running"); // retry scheduled, not finished
  });

  it("extends the message's visibility while a long job runs (heartbeat)", async () => {
    const store = new FakeQueueStore();
    const c = consumer(store, () => new Promise((r) => setTimeout(r, 1_150)), {
      visibilityTimeoutSeconds: 2,
    });
    const msgId = store.send(Q, envelope("loop-key-0020"));
    expect(await c.pollOnce()).toEqual(["succeeded"]);
    expect(store.visibilityCalls).toEqual([{ queue: Q, msgId, seconds: 2 }]);
  });

  it("a read failure does not kill the loop", async () => {
    const store = new FakeQueueStore();
    const handler = vi.fn(writing);
    const c = consumer(store, handler);
    store.failNext.set("read", new Error("connection refused"));
    store.send(Q, envelope("loop-key-0030"));
    c.start();
    await vi.waitFor(() => expect(handler).toHaveBeenCalledTimes(1), { timeout: 2_000 });
    await c.stop(1_000);
  });

  it("rejects unusable options", () => {
    const store = new FakeQueueStore();
    expect(() => consumer(store, writing, { concurrency: 0 })).toThrow(/concurrency/);
    expect(() => consumer(store, writing, { maxAttempts: 0 })).toThrow(/maxAttempts/);
    expect(() => consumer(store, writing, { handlers: new Map() })).toThrow(/at least one/);
  });
});
