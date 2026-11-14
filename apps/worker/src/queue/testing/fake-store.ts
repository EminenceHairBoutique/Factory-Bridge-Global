/**
 * In-memory QueueStore for unit tests. Mirrors pg-store.ts semantics (visibility timeouts with a manual clock, the
 * UNIQUE (queue, idempotency_key) ledger via decideExisting(), transactional handler writes, dead letters, archive)
 * so the consumer's retry / idempotency / dead-letter logic is tested without a database. The SQL itself is covered by
 * pg-store.integration.test.ts against real pgmq.
 */
import type { SqlClient } from "../../ai/store.js";
import { LeaseLostError } from "../errors.js";
import {
  decideExisting,
  type ClaimOutcome,
  type ClaimRequest,
  type CompleteRequest,
  type DeadLetterRequest,
  type LedgerRow,
  type QueueMessage,
  type QueueProbe,
  type QueueStore,
  type RetryRequest,
} from "../store.js";

interface FakeMessage {
  readonly msgId: string;
  readCount: number;
  readonly enqueuedAt: Date;
  readonly message: unknown;
  visibleAt: number;
}

export interface FakeLedgerRow extends LedgerRow {
  readonly queue: string;
  readonly idempotencyKey: string;
  error: string | null;
  workerId: string;
}

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

export interface RecordedQuery {
  readonly text: string;
  readonly params: readonly unknown[];
}

export class FakeQueueStore implements QueueStore {
  /** Manual clock in milliseconds; read() only returns messages whose visibility has lapsed. */
  now = 1_000_000;
  readonly queues = new Map<string, Map<string, FakeMessage>>();
  readonly archived = new Map<string, FakeMessage[]>();
  readonly ledger = new Map<string, Mutable<FakeLedgerRow>>();
  readonly deadLetters: DeadLetterRequest[] = [];
  /** Handler queries from transactions that committed. */
  readonly committed: RecordedQuery[] = [];
  /** Handler queries from transactions that rolled back. */
  readonly rolledBack: RecordedQuery[] = [];
  readonly visibilityCalls: { queue: string; msgId: string; seconds: number }[] = [];
  /** Answers handler queries inside complete(); default: no rows. */
  respond: (text: string, params: readonly unknown[]) => unknown[] = () => [];
  /** One-shot injected failures, keyed by method name. */
  readonly failNext = new Map<keyof QueueStore, Error>();
  probeResult: QueueProbe[] | Error = [];
  private nextMsgId = 1;
  private nextExecutionId = 1;

  send(queue: string, message: unknown): string {
    const msgId = String(this.nextMsgId++);
    this.queue(queue).set(msgId, {
      msgId,
      readCount: 0,
      enqueuedAt: new Date(this.now),
      message,
      visibleAt: this.now,
    });
    return msgId;
  }

  advance(ms: number): void {
    this.now += ms;
  }

  pending(queue: string): number {
    return this.queue(queue).size;
  }

  ledgerRow(queue: string, key: string): FakeLedgerRow | undefined {
    return this.ledger.get(`${queue}|${key}`);
  }

  isArchived(queue: string, msgId: string): boolean {
    return (this.archived.get(queue) ?? []).some((m) => m.msgId === msgId);
  }

  private queue(name: string): Map<string, FakeMessage> {
    let q = this.queues.get(name);
    if (q === undefined) {
      q = new Map();
      this.queues.set(name, q);
    }
    return q;
  }

  private maybeFail(method: keyof QueueStore): void {
    const err = this.failNext.get(method);
    if (err !== undefined) {
      this.failNext.delete(method);
      throw err;
    }
  }

  private archive(queue: string, msgId: string): void {
    const q = this.queue(queue);
    const m = q.get(msgId);
    if (m === undefined) return;
    q.delete(msgId);
    const a = this.archived.get(queue) ?? [];
    a.push(m);
    this.archived.set(queue, a);
  }

  private running(executionId: string): Mutable<FakeLedgerRow> | undefined {
    for (const row of this.ledger.values()) {
      if (row.id === executionId && row.status === "running") return row;
    }
    return undefined;
  }

  read(queue: string, visibilityTimeoutSeconds: number, limit: number): Promise<QueueMessage[]> {
    this.maybeFail("read");
    const out: QueueMessage[] = [];
    for (const m of this.queue(queue).values()) {
      if (out.length >= limit) break;
      if (m.visibleAt > this.now) continue;
      m.readCount++;
      m.visibleAt = this.now + visibilityTimeoutSeconds * 1_000;
      out.push({
        queue,
        msgId: m.msgId,
        readCount: m.readCount,
        enqueuedAt: m.enqueuedAt,
        message: structuredClone(m.message),
      });
    }
    return Promise.resolve(out);
  }

  claim(req: ClaimRequest): Promise<ClaimOutcome> {
    this.maybeFail("claim");
    const key = `${req.queue}|${req.idempotencyKey}`;
    const existing = this.ledger.get(key);
    if (existing === undefined) {
      const id = `exec-${this.nextExecutionId++}`;
      this.ledger.set(key, {
        id,
        queue: req.queue,
        idempotencyKey: req.idempotencyKey,
        status: "running",
        msgId: req.msgId,
        payloadHash: req.payloadHash,
        attempts: 1,
        error: null,
        workerId: req.workerId,
      });
      return Promise.resolve({ kind: "run", executionId: id, attempt: 1 });
    }
    const takeOver = (): ClaimOutcome => {
      existing.attempts++;
      existing.msgId = req.msgId;
      existing.workerId = req.workerId;
      existing.payloadHash ??= req.payloadHash;
      return { kind: "run", executionId: existing.id, attempt: existing.attempts };
    };
    const d = decideExisting(existing, req);
    switch (d.kind) {
      case "conflict":
        return Promise.resolve({ kind: "conflict" });
      case "duplicate":
        return Promise.resolve({ kind: "duplicate", status: d.status });
      case "take_over":
        return Promise.resolve(takeOver());
      case "check_holder":
        return Promise.resolve(
          this.queue(req.queue).has(d.holderMsgId)
            ? { kind: "busy", holderMsgId: d.holderMsgId }
            : takeOver(),
        );
    }
  }

  async complete(req: CompleteRequest, work: (tx: SqlClient) => Promise<void>): Promise<void> {
    this.maybeFail("complete");
    const buffer: RecordedQuery[] = [];
    const tx: SqlClient = {
      query: <T>(text: string, params: readonly unknown[]): Promise<T[]> => {
        buffer.push({ text, params });
        return Promise.resolve(this.respond(text, params) as T[]);
      },
    };
    try {
      await work(tx);
    } catch (err) {
      this.rolledBack.push(...buffer);
      throw err;
    }
    const row = this.running(req.executionId);
    if (row === undefined) {
      this.rolledBack.push(...buffer);
      throw new LeaseLostError(req.executionId);
    }
    this.committed.push(...buffer);
    row.status = "succeeded";
    row.error = null;
    this.archive(req.queue, req.msgId);
  }

  scheduleRetry(req: RetryRequest): Promise<void> {
    this.maybeFail("scheduleRetry");
    const row = this.running(req.executionId);
    if (row === undefined) throw new LeaseLostError(req.executionId);
    row.error = req.error;
    const m = this.queue(req.queue).get(req.msgId);
    if (m !== undefined) m.visibleAt = this.now + req.delaySeconds * 1_000;
    return Promise.resolve();
  }

  deadLetter(req: DeadLetterRequest): Promise<void> {
    this.maybeFail("deadLetter");
    if (req.executionId !== null) {
      const row = this.running(req.executionId);
      if (row === undefined) throw new LeaseLostError(req.executionId);
      row.status = "failed";
      row.error = req.error;
      row.attempts = Math.max(row.attempts, req.attempts);
    }
    this.deadLetters.push(req);
    this.archive(req.queue, req.msgId);
    return Promise.resolve();
  }

  ack(queue: string, msgId: string): Promise<void> {
    this.maybeFail("ack");
    this.archive(queue, msgId);
    return Promise.resolve();
  }

  setVisibility(queue: string, msgId: string, seconds: number): Promise<void> {
    this.maybeFail("setVisibility");
    this.visibilityCalls.push({ queue, msgId, seconds });
    const m = this.queue(queue).get(msgId);
    if (m !== undefined) m.visibleAt = this.now + seconds * 1_000;
    return Promise.resolve();
  }

  probe(): Promise<QueueProbe[]> {
    if (this.probeResult instanceof Error) return Promise.reject(this.probeResult);
    return Promise.resolve(this.probeResult);
  }
}
