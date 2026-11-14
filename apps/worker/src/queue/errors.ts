/**
 * Job error taxonomy. Anything thrown by a handler is RETRYABLE unless it is a PermanentJobError: bad input,
 * an unknown message type, a missing handler or an authorization failure will never succeed on a later attempt, so
 * those go straight to the dead letter instead of burning the retry budget.
 */

export class PermanentJobError extends Error {
  readonly code: string;
  constructor(code: string, detail: string) {
    super(`${code}: ${detail}`);
    this.name = "PermanentJobError";
    this.code = code;
  }
}

/** A queue whose handler is not built yet fails closed: dead letter on the first attempt, never a silent ack. */
export class NotImplementedJobError extends PermanentJobError {
  constructor(queue: string, arrivesWith: string) {
    super("not_implemented", `no handler for ${queue} yet (arrives with ${arrivesWith})`);
    this.name = "NotImplementedJobError";
  }
}

/**
 * A queue whose handler exists but is switched off or not fully configured on this worker. Same fail-closed
 * treatment as "not implemented": dead letter on the first attempt, never a silent ack and never a partial run.
 */
export class NotConfiguredJobError extends PermanentJobError {
  constructor(queue: string, why: string) {
    super("not_configured", `${queue} is not enabled on this worker (${why})`);
    this.name = "NotConfiguredJobError";
  }
}

/**
 * The success marker found no `running` ledger row for this execution: another delivery already finished or failed
 * the job. The transaction (including the handler's writes) was rolled back; the consumer does nothing further.
 */
export class LeaseLostError extends Error {
  constructor(executionId: string) {
    super(`lease_lost: job execution ${executionId} is no longer running`);
    this.name = "LeaseLostError";
  }
}

export const MAX_ERROR_LENGTH = 1000;

/**
 * A bounded, single-line description for the ledger and the dead letter. Never includes a stack trace; handlers must
 * not put message payload values into error messages (they would land in an internal-readable table).
 */
export function describeError(err: unknown): string {
  const raw =
    err instanceof Error
      ? `${err.name === "Error" ? "" : `${err.name}: `}${err.message}`
      : `non-error thrown: ${typeof err}`;
  // eslint-disable-next-line no-control-regex -- strip control characters (log/ledger injection)
  const oneLine = raw.replace(/[\u0000-\u001f\u007f]+/g, " ").trim();
  return oneLine.length > MAX_ERROR_LENGTH ? `${oneLine.slice(0, MAX_ERROR_LENGTH - 1)}…` : oneLine;
}
