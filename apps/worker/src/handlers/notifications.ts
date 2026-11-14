/**
 * fbg_notifications handler — the one real handler in B-11's slice. Writes one in-app `notifications` row through
 * `app.notify()` (0012), deduped by `dedupe_key`. No e-mail is sent: delivery stays `{in_app}` until an e-mail
 * provider is approved (paid service, founder gate). Tenant guard: the recipient must be an active member of the
 * organization the notification belongs to, checked in the same transaction as the write — a producer bug can
 * never surface org A's notification to a user outside org A.
 *
 * Message: { v: 1, type: "notification.create", idempotency_key, payload: {
 *   user_id: uuid, org_id: uuid, kind: <notifications.kind>, data?: object (≤ 4 KB), dedupe_key?: string } }
 */
import { z } from "zod";
import { IDEMPOTENCY_KEY, summarizeIssues } from "../queue/envelope.js";
import { PermanentJobError } from "../queue/errors.js";
import type { JobHandler } from "../queue/consumer.js";

export const NOTIFICATION_CREATE = "notification.create";

/** Mirrors the CHECK on public.notifications.kind (migration 0012); the database stays the final arbiter. */
export const NOTIFICATION_KINDS = [
  "quote_expiring",
  "quote_expired",
  "review_ready",
  "document_rejected",
  "document_parsed",
  "assignment_added",
  "compliance_hold",
  "grant_received",
  "generic",
] as const;

export const MAX_NOTIFICATION_DATA_CHARS = 4 * 1024;

const payloadSchema = z.strictObject({
  user_id: z.uuid(),
  org_id: z.uuid(),
  kind: z.enum(NOTIFICATION_KINDS),
  data: z
    .record(z.string(), z.unknown())
    .refine((d) => JSON.stringify(d).length <= MAX_NOTIFICATION_DATA_CHARS, {
      message: "data too large",
    })
    .optional(),
  dedupe_key: z.string().regex(IDEMPOTENCY_KEY).optional(),
});

export type NotificationPayload = z.infer<typeof payloadSchema>;

export const notificationsHandler: JobHandler = async (job, { tx, log }) => {
  if (job.type !== NOTIFICATION_CREATE) {
    throw new PermanentJobError("unknown_type", `${job.queue} does not handle type ${job.type}`);
  }
  const parsed = payloadSchema.safeParse(job.payload);
  if (!parsed.success) {
    throw new PermanentJobError("invalid_payload", summarizeIssues(parsed.error));
  }
  const p = parsed.data;

  const member = await tx.query<{ ok: boolean }>(
    `select exists (
       select 1 from public.memberships where org_id = $1::uuid and user_id = $2::uuid and status = 'active'
     ) as ok`,
    [p.org_id, p.user_id],
  );
  if (member[0]?.ok !== true) {
    throw new PermanentJobError(
      "recipient_not_member",
      "the recipient is not an active member of the notification's organization",
    );
  }

  // Without a producer-supplied key the job itself is the dedupe unit, so a replay can never add a second row.
  const dedupeKey = p.dedupe_key ?? `job:${job.queue}:${job.idempotencyKey}`;
  const rows = await tx.query<{ id: string | null }>(
    "select app.notify($1::uuid, $2::uuid, $3::text, $4::jsonb, $5::text) as id",
    [p.user_id, p.org_id, p.kind, JSON.stringify(p.data ?? {}), dedupeKey],
  );
  log.info(
    { kind: p.kind, outcome: rows[0]?.id ? "created" : "deduped" },
    "in-app notification written",
  );
};
