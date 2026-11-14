/**
 * Staged handlers (ADR-044): `prepare` runs with no transaction open, `commit` inside the success transaction, and a
 * failure in either stage goes through the same retry / dead-letter path as any handler. Uses the in-memory store,
 * which records whether a transaction is open.
 */
import pino from "pino";
import { describe, expect, it, vi } from "vitest";
import {
  Consumer,
  type ConsumerOptions,
  type Job,
  type QueueHandler,
  type StagedJobHandler,
} from "./consumer.js";
import { buildEnvelope } from "./envelope.js";
import { PermanentJobError } from "./errors.js";
import { FakeQueueStore } from "./testing/fake-store.js";

const Q = "test_staged";
const log = pino({ level: "silent" });

function consumer(
  store: FakeQueueStore,
  handler: QueueHandler,
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

const envelope = (key: string) => buildEnvelope("test.job", key, { n: 1 });

describe("staged handlers", () => {
  it("prepare runs outside any transaction; commit runs inside it with what prepare returned", async () => {
    const store = new FakeQueueStore();
    const seen: { stage: string; inTransaction: boolean }[] = [];
    const handler: StagedJobHandler<{ value: string }> = {
      prepare(job) {
        seen.push({ stage: "prepare", inTransaction: store.openTransactions > 0 });
        return Promise.resolve({ value: `prepared:${job.idempotencyKey}` });
      },
      async commit(_job, prepared, { tx }) {
        seen.push({ stage: "commit", inTransaction: store.openTransactions > 0 });
        await tx.query("insert into effects (v) values ($1)", [prepared.value]);
      },
    };
    const msgId = store.send(Q, envelope("staged-key-0001"));
    expect(await consumer(store, handler).pollOnce()).toEqual(["succeeded"]);
    expect(seen).toEqual([
      { stage: "prepare", inTransaction: false },
      { stage: "commit", inTransaction: true },
    ]);
    expect(store.committed).toEqual([
      { text: "insert into effects (v) values ($1)", params: ["prepared:staged-key-0001"] },
    ]);
    expect(store.ledgerRow(Q, "staged-key-0001")).toMatchObject({
      status: "succeeded",
      attempts: 1,
    });
    expect(store.isArchived(Q, msgId)).toBe(true);
    expect(store.openTransactions).toBe(0);
  });

  it("a prepare failure is retried with backoff and commit is never reached", async () => {
    const store = new FakeQueueStore();
    const commit = vi.fn((_job: Job, _prepared: number) => Promise.resolve());
    let calls = 0;
    const handler: StagedJobHandler<number> = {
      prepare() {
        calls++;
        return calls < 3
          ? Promise.reject(new Error("scanner_unavailable"))
          : Promise.resolve(calls);
      },
      commit,
    };
    const c = consumer(store, handler);
    store.send(Q, envelope("staged-key-0002"));

    expect(await c.pollOnce()).toEqual(["retry_scheduled"]);
    expect(store.ledgerRow(Q, "staged-key-0002")).toMatchObject({
      status: "running",
      error: "scanner_unavailable",
    });
    expect(store.openTransactions).toBe(0);
    store.advance(10_000);
    expect(await c.pollOnce()).toEqual(["retry_scheduled"]);
    expect(commit).not.toHaveBeenCalled();
    store.advance(20_000);
    expect(await c.pollOnce()).toEqual(["succeeded"]);
    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit.mock.calls[0]![1]).toBe(3);
    expect(store.deadLetters).toHaveLength(0);
  });

  it("a prepare that keeps failing lands in the dead letter after maxAttempts — never a success", async () => {
    const store = new FakeQueueStore();
    const commit = vi.fn(() => Promise.resolve());
    const handler: StagedJobHandler = {
      prepare: () => Promise.reject(new Error("scanner_unavailable: unreachable")),
      commit,
    };
    const c = consumer(store, handler);
    const msgId = store.send(Q, envelope("staged-key-0003"));
    const outcomes: string[] = [];
    for (let i = 0; i < 3; i++) {
      outcomes.push(...(await c.pollOnce()));
      store.advance(120_000);
    }
    expect(outcomes).toEqual(["retry_scheduled", "retry_scheduled", "dead_lettered"]);
    expect(commit).not.toHaveBeenCalled();
    expect(store.committed).toEqual([]);
    expect(store.ledgerRow(Q, "staged-key-0003")).toMatchObject({ status: "failed", attempts: 3 });
    expect(store.deadLetters[0]).toMatchObject({ msgId, attempts: 3 });
    expect(store.deadLetters[0]!.error).toContain("scanner_unavailable");
    expect(store.isArchived(Q, msgId)).toBe(true);
  });

  it("a PermanentJobError from prepare is dead-lettered on the first attempt", async () => {
    const store = new FakeQueueStore();
    const handler: StagedJobHandler = {
      prepare: () =>
        Promise.reject(new PermanentJobError("document_not_found", "no such document")),
      commit: () => Promise.resolve(),
    };
    store.send(Q, envelope("staged-key-0004"));
    expect(await consumer(store, handler).pollOnce()).toEqual(["dead_lettered"]);
    expect(store.deadLetters[0]!.error).toMatch(/document_not_found/);
    expect(store.ledgerRow(Q, "staged-key-0004")).toMatchObject({ status: "failed", attempts: 1 });
  });

  it("a commit failure rolls the transaction back and the whole job (prepare included) is retried", async () => {
    const store = new FakeQueueStore();
    const prepare = vi.fn(() => Promise.resolve("p"));
    let commits = 0;
    const handler: StagedJobHandler<string> = {
      prepare,
      async commit(_job, _p, { tx }) {
        commits++;
        await tx.query("insert into effects (n) values ($1)", [commits]);
        if (commits === 1) throw new Error("deadlock detected");
      },
    };
    const c = consumer(store, handler);
    store.send(Q, envelope("staged-key-0005"));
    expect(await c.pollOnce()).toEqual(["retry_scheduled"]);
    expect(store.committed).toEqual([]);
    expect(store.rolledBack).toHaveLength(1);
    store.advance(10_000);
    expect(await c.pollOnce()).toEqual(["succeeded"]);
    expect(prepare).toHaveBeenCalledTimes(2); // which is why prepare must be repeatable
    expect(store.committed).toEqual([{ text: "insert into effects (n) values ($1)", params: [2] }]);
  });

  it("a prepare that outlives the job timeout is aborted through its signal and retried; commit is skipped", async () => {
    const store = new FakeQueueStore();
    const commit = vi.fn(() => Promise.resolve());
    const handler: StagedJobHandler = {
      prepare: (_job, { signal }) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener("abort", () => reject(new Error("aborted by signal")), {
            once: true,
          });
        }),
      commit,
    };
    store.send(Q, envelope("staged-key-0006"));
    expect(await consumer(store, handler, { jobTimeoutMs: 40 }).pollOnce()).toEqual([
      "retry_scheduled",
    ]);
    expect(commit).not.toHaveBeenCalled();
    expect(store.ledgerRow(Q, "staged-key-0006")?.error).toBe("job_timeout");
    expect(store.openTransactions).toBe(0);
  });

  it("a prepare that returns after the abort does not reach commit", async () => {
    const store = new FakeQueueStore();
    const commit = vi.fn(() => Promise.resolve());
    const handler: StagedJobHandler = {
      prepare: () => new Promise((resolve) => setTimeout(() => resolve("late"), 80)), // ignores the signal
      commit,
    };
    store.send(Q, envelope("staged-key-0007"));
    expect(await consumer(store, handler, { jobTimeoutMs: 20 }).pollOnce()).toEqual([
      "retry_scheduled",
    ]);
    expect(commit).not.toHaveBeenCalled();
  });

  it("when another delivery finished the job during prepare, this one's commit is rolled back (lease lost)", async () => {
    const store = new FakeQueueStore();
    const handler: StagedJobHandler<string> = {
      prepare() {
        // while this delivery was busy outside the database, the ledger row was completed elsewhere
        store.ledger.get(`${Q}|staged-key-0008`)!.status = "succeeded";
        return Promise.resolve("p");
      },
      async commit(_job, p, { tx }) {
        await tx.query("insert into effects (v) values ($1)", [p]);
      },
    };
    store.send(Q, envelope("staged-key-0008"));
    expect(await consumer(store, handler).pollOnce()).toEqual(["lease_lost"]);
    expect(store.committed).toEqual([]);
    expect(store.deadLetters).toHaveLength(0);
  });

  it("extends the message's visibility while prepare runs (heartbeat)", async () => {
    const store = new FakeQueueStore();
    const handler: StagedJobHandler = {
      prepare: () => new Promise((resolve) => setTimeout(resolve, 1_250)),
      commit: () => Promise.resolve(),
    };
    store.send(Q, envelope("staged-key-0009"));
    expect(await consumer(store, handler, { visibilityTimeoutSeconds: 1 }).pollOnce()).toEqual([
      "succeeded",
    ]);
    expect(store.visibilityCalls.length).toBeGreaterThanOrEqual(1);
  });

  it("afterCommit runs once the job is durable, with no transaction open, and receives what prepare returned", async () => {
    const store = new FakeQueueStore();
    const seen: unknown[] = [];
    const handler: StagedJobHandler<string> = {
      prepare: () => Promise.resolve("prepared"),
      commit: () => Promise.resolve(),
      afterCommit(job, prepared) {
        seen.push({
          prepared,
          openTransactions: store.openTransactions,
          ledger: store.ledgerRow(Q, job.idempotencyKey)?.status,
          archived: store.isArchived(Q, job.msgId),
        });
        return Promise.resolve();
      },
    };
    store.send(Q, envelope("staged-key-0010"));
    expect(await consumer(store, handler).pollOnce()).toEqual(["succeeded"]);
    expect(seen).toEqual([
      { prepared: "prepared", openTransactions: 0, ledger: "succeeded", archived: true },
    ]);
  });

  it("a failing afterCommit cannot undo or fail a job that has already succeeded", async () => {
    const store = new FakeQueueStore();
    const handler: StagedJobHandler<string> = {
      prepare: () => Promise.resolve("p"),
      async commit(_job, p, { tx }) {
        await tx.query("insert into effects (v) values ($1)", [p]);
      },
      afterCommit: () => Promise.reject(new Error("storage unavailable")),
    };
    const msgId = store.send(Q, envelope("staged-key-0011"));
    expect(await consumer(store, handler).pollOnce()).toEqual(["succeeded"]);
    expect(store.committed).toHaveLength(1);
    expect(store.ledgerRow(Q, "staged-key-0011")).toMatchObject({
      status: "succeeded",
      error: null,
    });
    expect(store.isArchived(Q, msgId)).toBe(true);
    expect(store.deadLetters).toHaveLength(0);
  });

  it("afterCommit does not run when the commit failed, lost its lease, or the job was a replay", async () => {
    const store = new FakeQueueStore();
    const afterCommit = vi.fn(() => Promise.resolve());
    const failing: StagedJobHandler = {
      prepare: () => Promise.resolve(null),
      commit: () => Promise.reject(new Error("constraint violated")),
      afterCommit,
    };
    store.send(Q, envelope("staged-key-0012"));
    expect(await consumer(store, failing).pollOnce()).toEqual(["retry_scheduled"]);

    const lost: StagedJobHandler = {
      prepare() {
        store.ledger.get(`${Q}|staged-key-0013`)!.status = "succeeded";
        return Promise.resolve(null);
      },
      commit: () => Promise.resolve(),
      afterCommit,
    };
    const store2 = store;
    store2.send(Q, envelope("staged-key-0013"));
    const c = consumer(store2, lost);
    expect((await c.pollOnce()).sort()).toEqual(["lease_lost"]);
    store2.send(Q, envelope("staged-key-0013")); // a replay of a finished key
    expect(await c.pollOnce()).toEqual(["duplicate"]);
    expect(afterCommit).not.toHaveBeenCalled();
  });
});
