/**
 * AI run ledger + budget store (B-16b). Thin typed wrapper over the two SECURITY DEFINER functions of
 * migration 0003b: app.ai_budget_status() and app.record_ai_run(). The worker is the only writer; the
 * functions require service_role, which the Postgres client below assumes per statement.
 */
import type { AiErrorCode, AiPurpose } from "@fbg/ai";

export type AiRunStatus = "ok" | AiErrorCode | "budget_refused";

export interface AiBudgetStatus {
  readonly capNanoUsd: number;
  readonly spentNanoUsd: number;
  readonly remainingNanoUsd: number;
  readonly monthStart: string;
  readonly exceeded: boolean;
  readonly alert: boolean;
}

export interface AiRunRecord {
  readonly orgId: string;
  readonly purpose: AiPurpose;
  readonly provider: string;
  readonly model: string;
  readonly promptTemplateId: string;
  /** AiResult.promptHash (sha256 of the template file). */
  readonly promptVersion: string;
  readonly status: AiRunStatus;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly cacheReadInputTokens: number;
  readonly cacheCreationInputTokens: number;
  readonly costNanoUsd: number;
  readonly latencyMs: number;
  readonly attempts: number;
  readonly flags: readonly string[];
  readonly error?: string;
  /** sha256 hex of the untrusted input. */
  readonly inputHash?: string;
  readonly triggeredBy?: string;
  /** Queue idempotency key; (orgId, jobId) is unique in the ledger. */
  readonly jobId?: string;
  readonly requestId?: string;
}

export interface AiRunStore {
  budgetStatus(orgId: string, defaultCapNanoUsd: number): Promise<AiBudgetStatus>;
  /** Returns the ai_runs.id (existing id when the jobId was already recorded). */
  recordRun(run: AiRunRecord): Promise<string>;
}

/** Minimal SQL executor so the store can be unit-tested without a database. */
export interface SqlClient {
  query<T>(text: string, params: readonly unknown[]): Promise<T[]>;
}

interface BudgetRow {
  cap_nano_usd: string | number;
  spent_nano_usd: string | number;
  remaining_nano_usd: string | number;
  month_start: string | Date;
  exceeded: boolean;
  alert: boolean;
}

/** bigint columns arrive as strings from node-postgres; values stay far below 2^53. */
function int(v: string | number): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isSafeInteger(n)) throw new Error(`ledger value is not a safe integer: ${String(v)}`);
  return n;
}

export class PgAiRunStore implements AiRunStore {
  constructor(private readonly sql: SqlClient) {}

  async budgetStatus(orgId: string, defaultCapNanoUsd: number): Promise<AiBudgetStatus> {
    if (!Number.isSafeInteger(defaultCapNanoUsd) || defaultCapNanoUsd < 0) {
      throw new Error("defaultCapNanoUsd must be a non-negative integer");
    }
    const rows = await this.sql.query<BudgetRow>(
      "select cap_nano_usd, spent_nano_usd, remaining_nano_usd, month_start, exceeded, alert from app.ai_budget_status($1::uuid, $2::bigint)",
      [orgId, String(defaultCapNanoUsd)],
    );
    const r = rows[0];
    if (r === undefined) throw new Error("ai_budget_status returned no row");
    return {
      capNanoUsd: int(r.cap_nano_usd),
      spentNanoUsd: int(r.spent_nano_usd),
      remainingNanoUsd: int(r.remaining_nano_usd),
      monthStart:
        r.month_start instanceof Date ? r.month_start.toISOString() : String(r.month_start),
      exceeded: r.exceeded,
      alert: r.alert,
    };
  }

  async recordRun(run: AiRunRecord): Promise<string> {
    const rows = await this.sql.query<{ id: string }>(
      `select app.record_ai_run(
         $1::uuid, $2::text, $3::text, $4::text, $5::text, $6::text, $7::text,
         $8::integer, $9::integer, $10::integer, $11::integer, $12::bigint, $13::integer, $14::smallint, $15::text[],
         $16::text, $17::text, $18::uuid, $19::text, $20::text) as id`,
      [
        run.orgId,
        run.purpose,
        run.provider,
        run.model,
        run.promptTemplateId,
        run.promptVersion,
        run.status,
        run.inputTokens,
        run.outputTokens,
        run.cacheReadInputTokens,
        run.cacheCreationInputTokens,
        String(run.costNanoUsd),
        run.latencyMs,
        run.attempts,
        [...run.flags],
        run.error ?? null,
        run.inputHash ?? null,
        run.triggeredBy ?? null,
        run.jobId ?? null,
        run.requestId ?? null,
      ],
    );
    const id = rows[0]?.id;
    if (id === undefined) throw new Error("record_ai_run returned no id");
    return id;
  }
}

/**
 * node-postgres client that runs every statement inside a transaction as service_role, which is what
 * app.record_ai_run() requires. Connect with the worker's database URL (never exposed to the web app).
 */
export async function createPgSqlClient(
  connectionString: string,
): Promise<SqlClient & { close(): Promise<void> }> {
  const { Pool } = await import("pg");
  const pool = new Pool({ connectionString, max: 4 });
  return {
    async query<T>(text: string, params: readonly unknown[]): Promise<T[]> {
      const client = await pool.connect();
      try {
        await client.query("begin");
        await client.query("set local role service_role");
        const res = await client.query(text, [...params]);
        await client.query("commit");
        return res.rows as T[];
      } catch (err) {
        await client.query("rollback").catch(() => undefined);
        throw err;
      } finally {
        client.release();
      }
    },
    close: () => pool.end(),
  };
}
