/**
 * The queue store: everything the consumer needs from pgmq + the ledger tables of migration 0012, behind an interface
 * so the retry / idempotency / dead-letter logic is unit-tested with an in-memory fake (testing/fake-store.ts) and the
 * SQL is integration-tested against real pgmq (pg-store.ts).
 *
 * Delivery is at-least-once (a message may be read again after its visibility timeout). Exactly-once *effects* come
 * from the ledger: `job_executions` is UNIQUE (queue, idempotency_key), and a handler's database writes commit in the
 * same transaction as the `succeeded` marker and the archive of the message.
 */
import type { SqlClient } from "../ai/store.js";

export const QUEUE_NAME = /^[a-z0-9_]{1,48}$/;

export function assertQueueName(queue: string): void {
  if (!QUEUE_NAME.test(queue)) throw new Error(`invalid queue name: ${JSON.stringify(queue)}`);
}

export interface QueueMessage {
  readonly queue: string;
  /** pgmq msg_id (bigint) as a decimal string. */
  readonly msgId: string;
  /** How many times pgmq has handed this message out, including this delivery. */
  readonly readCount: number;
  readonly enqueuedAt: Date;
  /** Raw jsonb — untrusted until parseEnvelope() accepts it. */
  readonly message: unknown;
}

export type LedgerStatus = "running" | "succeeded" | "failed";

export interface LedgerRow {
  readonly id: string;
  readonly status: LedgerStatus;
  readonly msgId: string | null;
  readonly payloadHash: string | null;
  readonly attempts: number;
}

export interface ClaimRequest {
  readonly queue: string;
  readonly idempotencyKey: string;
  readonly msgId: string;
  readonly payloadHash: string;
  readonly workerId: string;
}

export type ClaimOutcome =
  /** Run the handler. `attempt` counts every start of this job, including ones that crashed mid-run. */
  | { readonly kind: "run"; readonly executionId: string; readonly attempt: number }
  /** Replay of a job that already finished: acknowledge without running. */
  | { readonly kind: "duplicate"; readonly status: "succeeded" | "failed" }
  /** Same key, different content: a producer bug. Dead-letter this message; the ledger row is left alone. */
  | { readonly kind: "conflict" }
  /** Another delivery of the same key is in flight: try this message again later. */
  | { readonly kind: "busy"; readonly holderMsgId: string };

export type ExistingDecision =
  | { readonly kind: "conflict" }
  | { readonly kind: "duplicate"; readonly status: "succeeded" | "failed" }
  | { readonly kind: "take_over" }
  | { readonly kind: "check_holder"; readonly holderMsgId: string };

/**
 * What to do when the ledger already has a row for (queue, idempotency_key). Pure; both stores use it.
 *  - different content under the same key → conflict (checked first: a mismatched replay is never silently acked);
 *  - finished (succeeded / failed) → duplicate, acknowledge;
 *  - running and held by this very message → the previous delivery died or failed and its visibility timeout lapsed:
 *    take over (pgmq hands a message to one reader at a time, so nobody else holds it);
 *  - running and held by another message → take over only if that message is gone from the queue, else busy.
 */
export function decideExisting(
  existing: LedgerRow,
  req: Pick<ClaimRequest, "msgId" | "payloadHash">,
): ExistingDecision {
  if (existing.payloadHash !== null && existing.payloadHash !== req.payloadHash) {
    return { kind: "conflict" };
  }
  if (existing.status !== "running") return { kind: "duplicate", status: existing.status };
  if (existing.msgId === null || existing.msgId === req.msgId) return { kind: "take_over" };
  return { kind: "check_holder", holderMsgId: existing.msgId };
}

export interface CompleteRequest {
  readonly queue: string;
  readonly msgId: string;
  readonly executionId: string;
}

export interface RetryRequest extends CompleteRequest {
  readonly attempt: number;
  readonly error: string;
  readonly delaySeconds: number;
}

export interface DeadLetterRequest {
  readonly queue: string;
  readonly msgId: string;
  readonly message: unknown;
  readonly error: string;
  readonly attempts: number;
  readonly idempotencyKey: string | null;
  /** When set, the ledger row is marked `failed` in the same transaction. */
  readonly executionId: string | null;
}

export interface QueueProbe {
  readonly name: string;
  /** listed by pgmq.list_queues() */
  readonly present: boolean;
  /** pgmq.metrics() succeeded as service_role, i.e. the worker can read the queue table. */
  readonly readable: boolean;
}

export interface QueueStore {
  read(queue: string, visibilityTimeoutSeconds: number, limit: number): Promise<QueueMessage[]>;
  claim(req: ClaimRequest): Promise<ClaimOutcome>;
  /**
   * One transaction: `work` (the handler's writes) → ledger `succeeded` → archive the message. Throws whatever `work`
   * throws (after rolling back), or LeaseLostError when the ledger row is no longer `running`.
   */
  complete(req: CompleteRequest, work: (tx: SqlClient) => Promise<void>): Promise<void>;
  /** Record the error on the ledger row and hide the message for `delaySeconds`. */
  scheduleRetry(req: RetryRequest): Promise<void>;
  /** One transaction: ledger `failed` (when executionId is set) → jobs_dead_letter row → archive the message. */
  deadLetter(req: DeadLetterRequest): Promise<void>;
  /** Archive without running (a replay of a finished job). */
  ack(queue: string, msgId: string): Promise<void>;
  /** pgmq.set_vt: hide the message for `seconds` from now (busy deferral, heartbeat). */
  setVisibility(queue: string, msgId: string, seconds: number): Promise<void>;
  probe(queues: readonly string[]): Promise<QueueProbe[]>;
}
