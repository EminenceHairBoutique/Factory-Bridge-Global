/**
 * The worker's database access: a node-postgres pool whose every unit of work is one transaction run as
 * `service_role` (`set local role service_role`), the role migrations 0003b / 0012 / 0012b grant the worker's tables,
 * functions and queues to. The connection string is the worker's own and is never exposed to the web app or logged.
 */
import type { SqlClient } from "./ai/store.js";

export interface ServiceRoleDb {
  /** Runs `fn` in one service_role transaction; commits if it resolves, rolls back and rethrows if it rejects. */
  tx<T>(fn: (tx: SqlClient) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

export interface ServiceRoleDbOptions {
  readonly max: number;
  /** Per-statement ceiling inside every transaction, so a handler cannot hang a connection forever. */
  readonly statementTimeoutMs: number;
  readonly applicationName: string;
  readonly onPoolError?: (err: Error) => void;
}

export async function createServiceRoleDb(
  connectionString: string,
  options: ServiceRoleDbOptions,
): Promise<ServiceRoleDb> {
  const { Pool } = await import("pg");
  const pool = new Pool({
    connectionString,
    max: options.max,
    application_name: options.applicationName,
    connectionTimeoutMillis: 10_000,
  });
  // An idle client losing its connection emits 'error' on the pool; unhandled, it would crash the process.
  pool.on("error", (err) => options.onPoolError?.(err));

  return {
    async tx<T>(fn: (tx: SqlClient) => Promise<T>): Promise<T> {
      const client = await pool.connect();
      let broken = false;
      try {
        await client.query("begin");
        await client.query("set local role service_role");
        await client.query("select set_config('statement_timeout', $1, true)", [
          `${options.statementTimeoutMs}ms`,
        ]);
        const sql: SqlClient = {
          async query<R>(text: string, params: readonly unknown[]): Promise<R[]> {
            const res = await client.query(text, [...params]);
            return res.rows as R[];
          },
        };
        const result = await fn(sql);
        await client.query("commit");
        return result;
      } catch (err) {
        try {
          await client.query("rollback");
        } catch {
          broken = true; // connection is unusable; destroy it instead of returning it to the pool
        }
        throw err;
      } finally {
        client.release(broken);
      }
    },
    close: () => pool.end(),
  };
}
