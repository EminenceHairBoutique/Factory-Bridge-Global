/**
 * The job envelope every queue message must carry. Messages are untrusted input until this schema accepts them: a
 * message that fails it is dead-lettered without running anything (the idempotency key is unknown, so the ledger is
 * not touched).
 *
 *   { "v": 1, "type": "notification.create", "idempotency_key": "notify:quote_expired:<id>:<user>", "payload": { … } }
 */
import { createHash } from "node:crypto";
import { z } from "zod";

export const ENVELOPE_VERSION = 1;

/** Upper bound on a serialized message; larger messages are refused (documents travel by id, never inline). */
export const MAX_MESSAGE_CHARS = 64 * 1024;

/** Printable ASCII without spaces: keys are logged and stored, so no control characters or whitespace. */
export const IDEMPOTENCY_KEY = /^[\x21-\x7e]{8,200}$/;

const envelopeSchema = z.strictObject({
  v: z.literal(ENVELOPE_VERSION),
  type: z.string().regex(/^[a-z][a-z0-9_.]{2,63}$/),
  idempotency_key: z.string().regex(IDEMPOTENCY_KEY),
  payload: z.record(z.string(), z.unknown()),
});

export type JobEnvelope = z.infer<typeof envelopeSchema>;

export type EnvelopeParse =
  | { readonly ok: true; readonly envelope: JobEnvelope; readonly hash: string }
  | { readonly ok: false; readonly error: string };

/** Paths and issue codes only — never the offending values, which are untrusted and may be confidential. */
export function summarizeIssues(error: z.ZodError): string {
  return error.issues
    .slice(0, 10)
    .map((i) => `${i.path.length > 0 ? i.path.join(".") : "(root)"}:${i.code}`)
    .join(", ");
}

export function parseEnvelope(raw: unknown): EnvelopeParse {
  let serialized: string;
  try {
    serialized = JSON.stringify(raw) ?? "";
  } catch {
    return { ok: false, error: "invalid_envelope: message is not serializable" };
  }
  if (serialized.length > MAX_MESSAGE_CHARS) {
    return {
      ok: false,
      error: `invalid_envelope: message exceeds ${MAX_MESSAGE_CHARS} characters`,
    };
  }
  const parsed = envelopeSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: `invalid_envelope: ${summarizeIssues(parsed.error)}` };
  }
  return { ok: true, envelope: parsed.data, hash: messageHash(parsed.data) };
}

export function buildEnvelope(
  type: string,
  idempotencyKey: string,
  payload: Record<string, unknown>,
): JobEnvelope {
  const parsed = envelopeSchema.safeParse({
    v: ENVELOPE_VERSION,
    type,
    idempotency_key: idempotencyKey,
    payload,
  });
  if (!parsed.success) throw new Error(`invalid envelope: ${summarizeIssues(parsed.error)}`);
  return parsed.data;
}

/** JSON with object keys sorted at every level, so equal content always hashes equally (jsonb reorders keys). */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((v) => canonicalJson(v)).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

/** sha256 hex of the canonical envelope; stored in job_executions.payload_hash. */
export function messageHash(envelope: JobEnvelope): string {
  return createHash("sha256").update(canonicalJson(envelope), "utf8").digest("hex");
}
