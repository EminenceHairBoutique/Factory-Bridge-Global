/**
 * QueueStore over real pgmq (migration 0012 queues, 0012b grants) and the 0012 ledger tables. Every method is one
 * service_role transaction (see db.ts). Integration-tested in pg-store.integration.test.ts against the local
 * Supabase stack; never against PGlite (no pgmq there).
 */
import type { SqlClient } from "../ai/store.js";
import type { ServiceRoleDb } from "../db.js";
import type { JobEnvelope } from "./envelope.js";
import { LeaseLostError } from "./errors.js";
import {
  assertQueueName,
  decideExisting,
  type ClaimOutcome,
  type ClaimRequest,
  type CompleteRequest,
  type DeadLetterRequest,
  type LedgerStatus,
  type QueueMessage,
  type QueueProbe,
  type QueueStore,
  type RetryRequest,
} from "./store.js";

interface ReadRow {
  msg_id: string;
  read_ct: number;
  enqueued_at: Date;
  message: unknown;
}

interface LedgerDbRow {
  id: string;
  status: LedgerStatus;
  msg_id: string | null;
  payload_hash: string | null;
  attempts: number;
}

function nonNegativeInt(n: number, what: string): number {
  if (!Number.isInteger(n) || n < 0) throw new Error(`${what} must be a non-negative integer`);
  return n;
}

export class PgQueueStore implements QueueStore {
  constructor(private readonly db: ServiceRoleDb) {}

  async read(
    queue: string,
    visibilityTimeoutSeconds: number,
    limit: number,
  ): Promise<QueueMessage[]> {
    assertQueueName(queue);
    nonNegativeInt(visibilityTimeoutSeconds, "visibility timeout");
    if (limit <= 0) return [];
    const rows = await this.db.tx((tx) =>
      tx.query<ReadRow>(
        "select msg_id::text as msg_id, read_ct, enqueued_at, message from pgmq.read($1::text, $2::integer, $3::integer)",
        [queue, visibilityTimeoutSeconds, limit],
      ),
    );
    return rows.map((r) => ({
      queue,
      msgId: r.msg_id,
      readCount: r.read_ct,
      enqueuedAt: r.enqueued_at,
      message: r.message,
    }));
  }

  async claim(req: ClaimRequest): Promise<ClaimOutcome> {
    assertQueueName(req.queue);
    return this.db.tx(async (tx) => {
      // A concurrent insert of the same key makes this wait for that transaction, then do nothing.
      const inserted = await tx.query<{ id: string }>(
        `insert into public.job_executions (queue, idempotency_key, msg_id, payload_hash, worker_id)
         values ($1, $2, $3::bigint, $4, $5)
         on conflict (queue, idempotency_key) do nothing
         returning id`,
        [req.queue, req.idempotencyKey, req.msgId, req.payloadHash, req.workerId],
      );
      const fresh = inserted[0];
      if (fresh !== undefined) return { kind: "run", executionId: fresh.id, attempt: 1 };

      const rows = await tx.query<LedgerDbRow>(
        `select id, status, msg_id::text as msg_id, payload_hash, attempts
           from public.job_executions
          where queue = $1 and idempotency_key = $2
            for update`,
        [req.queue, req.idempotencyKey],
      );
      const row = rows[0];
      if (row === undefined) throw new Error("job_executions row vanished during claim");

      const takeOver = async (): Promise<ClaimOutcome> => {
        const updated = await tx.query<{ attempts: number }>(
          `update public.job_executions
              set attempts = attempts + 1, msg_id = $2::bigint, worker_id = $3, started_at = now(),
                  payload_hash = coalesce(payload_hash, $4)
            where id = $1
        returning attempts`,
          [row.id, req.msgId, req.workerId, req.payloadHash],
        );
        const attempt = updated[0]?.attempts;
        if (attempt === undefined) throw new Error("job_executions take-over updated no row");
        return { kind: "run", executionId: row.id, attempt };
      };

      const decision = decideExisting(
        {
          id: row.id,
          status: row.status,
          msgId: row.msg_id,
          payloadHash: row.payload_hash,
          attempts: row.attempts,
        },
        req,
      );
      switch (decision.kind) {
        case "conflict":
          return { kind: "conflict" };
        case "duplicate":
          return { kind: "duplicate", status: decision.status };
        case "take_over":
          return takeOver();
        case "check_holder": {
          // The queue name passed QUEUE_NAME ([a-z0-9_]), so the quoted identifier cannot be broken out of.
          const held = await tx.query<{ one: number }>(
            `select 1 as one from pgmq."q_${req.queue}" where msg_id = $1::bigint`,
            [decision.holderMsgId],
          );
          if (held.length > 0) return { kind: "busy", holderMsgId: decision.holderMsgId };
          return takeOver(); // the holder was archived or deleted without finishing the ledger row
        }
      }
    });
  }

  async complete(req: CompleteRequest, work: (tx: SqlClient) => Promise<void>): Promise<void> {
    assertQueueName(req.queue);
    await this.db.tx(async (tx) => {
      await work(tx);
      const done = await tx.query<{ id: string }>(
        `update public.job_executions
            set status = 'succeeded', finished_at = now(), error = null
          where id = $1 and status = 'running'
      returning id`,
        [req.executionId],
      );
      if (done.length === 0) throw new LeaseLostError(req.executionId);
      await tx.query("select pgmq.archive($1::text, $2::bigint) as archived", [
        req.queue,
        req.msgId,
      ]);
    });
  }

  async scheduleRetry(req: RetryRequest): Promise<void> {
    assertQueueName(req.queue);
    nonNegativeInt(req.delaySeconds, "retry delay");
    await this.db.tx(async (tx) => {
      const updated = await tx.query<{ id: string }>(
        `update public.job_executions set error = $2
          where id = $1 and status = 'running'
      returning id`,
        [req.executionId, req.error],
      );
      if (updated.length === 0) throw new LeaseLostError(req.executionId);
      await tx.query("select msg_id from pgmq.set_vt($1::text, $2::bigint, $3::integer)", [
        req.queue,
        req.msgId,
        req.delaySeconds,
      ]);
    });
  }

  async deadLetter(req: DeadLetterRequest): Promise<void> {
    assertQueueName(req.queue);
    await this.db.tx(async (tx) => {
      if (req.executionId !== null) {
        const updated = await tx.query<{ id: string }>(
          `update public.job_executions
              set status = 'failed', finished_at = now(), error = $2, attempts = greatest(attempts, $3)
            where id = $1 and status = 'running'
        returning id`,
          [req.executionId, req.error, req.attempts],
        );
        // Another delivery finished the job first: filing a dead letter now would contradict the ledger.
        if (updated.length === 0) throw new LeaseLostError(req.executionId);
      }
      await tx.query(
        `insert into public.jobs_dead_letter (queue, msg_id, idempotency_key, message, error, attempts)
         values ($1, $2::bigint, $3, $4::jsonb, $5, $6)`,
        [
          req.queue,
          req.msgId,
          req.idempotencyKey,
          JSON.stringify(req.message === undefined ? null : req.message),
          req.error,
          Math.max(1, req.attempts),
        ],
      );
      await tx.query("select pgmq.archive($1::text, $2::bigint) as archived", [
        req.queue,
        req.msgId,
      ]);
    });
  }

  async ack(queue: string, msgId: string): Promise<void> {
    assertQueueName(queue);
    await this.db.tx((tx) =>
      tx.query("select pgmq.archive($1::text, $2::bigint) as archived", [queue, msgId]),
    );
  }

  async setVisibility(queue: string, msgId: string, seconds: number): Promise<void> {
    assertQueueName(queue);
    nonNegativeInt(seconds, "visibility");
    await this.db.tx((tx) =>
      tx.query("select msg_id from pgmq.set_vt($1::text, $2::bigint, $3::integer)", [
        queue,
        msgId,
        seconds,
      ]),
    );
  }

  async probe(queues: readonly string[]): Promise<QueueProbe[]> {
    queues.forEach(assertQueueName);
    return this.db.tx(async (tx) => {
      const listed = new Set(
        (
          await tx.query<{ queue_name: string }>("select queue_name from pgmq.list_queues()", [])
        ).map((r) => r.queue_name),
      );
      const out: QueueProbe[] = [];
      for (const name of queues) {
        if (!listed.has(name)) {
          out.push({ name, present: false, readable: false });
          continue;
        }
        // metrics() reads the queue table and its sequence: it proves the 0012b grants, not just that a row exists.
        await tx.query("savepoint fbg_probe", []);
        try {
          await tx.query("select queue_length from pgmq.metrics($1::text)", [name]);
          await tx.query("release savepoint fbg_probe", []);
          out.push({ name, present: true, readable: true });
        } catch {
          await tx.query("rollback to savepoint fbg_probe", []);
          out.push({ name, present: true, readable: false });
        }
      }
      return out;
    });
  }

  /** Producer side (service_role). Used by tests today; by the web tier's enqueue path once B-05 lands. */
  async send(queue: string, envelope: JobEnvelope, delaySeconds = 0): Promise<string> {
    assertQueueName(queue);
    nonNegativeInt(delaySeconds, "delay");
    const rows = await this.db.tx((tx) =>
      tx.query<{ msg_id: string }>(
        "select s::text as msg_id from pgmq.send($1::text, $2::jsonb, $3::integer) as s",
        [queue, JSON.stringify(envelope), delaySeconds],
      ),
    );
    const id = rows[0]?.msg_id;
    if (id === undefined) throw new Error("pgmq.send returned no msg_id");
    return id;
  }
}
