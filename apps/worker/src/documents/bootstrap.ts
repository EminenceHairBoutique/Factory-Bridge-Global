/**
 * Builds the fbg_documents handler for the worker entrypoint — or refuses to (B-12 / B-13).
 *
 * Three outcomes, and no fourth:
 *   - not configured (config.ts → documents === null): `{ enabled: false }`; the caller registers the fail-closed
 *     handler and documents stay in quarantine;
 *   - configured, and the parser sandbox passes its containment probe on this machine: `{ enabled: true, handler }`;
 *   - configured, but the sandbox is NOT contained or the probe cannot run: this THROWS and the worker does not
 *     start. Starting anyway would mean either parsing hostile files without containment or dead-lettering every
 *     queued document on its first attempt; an operator who asked for document processing gets neither silently.
 *
 * The scanner is different: a daemon that is down at start is reported and left to come back. Every scan fails
 * closed while it is away — the job is retried and finally dead-lettered, and the document never leaves `scanning`.
 */
import type { Logger } from "pino";
import type { DocumentProcessingConfig } from "../config.js";
import type { ServiceRoleDb } from "../db.js";
import { createDocumentsHandler } from "../handlers/documents.js";
import type { QueueHandler } from "../queue/consumer.js";
import { describeError } from "../queue/errors.js";
import { DEFAULT_SANDBOX_LIMITS } from "./limits.js";
import { PgDocumentRepo } from "./repo.js";
import { ProcessSandbox, verifyContainment, type ParserSandbox } from "./runner.js";
import { ClamdScanner } from "./scanner.js";
import { SupabaseObjectStore } from "./storage.js";

export type DocumentsBootstrap =
  | { readonly enabled: true; readonly handler: QueueHandler }
  | { readonly enabled: false; readonly reason: "disabled" };

/** Throws unless every containment check is denied on this machine. */
export async function requireContainment(sandbox: ParserSandbox, log: Logger): Promise<void> {
  let report;
  try {
    report = await verifyContainment(sandbox);
  } catch (err) {
    throw new Error(
      `parser sandbox probe failed (${describeError(err)}): refusing to start with DOCUMENT_PROCESSING=enabled`,
      { cause: err },
    );
  }
  if (!report.contained) {
    throw new Error(
      `parser sandbox is not contained on this machine (${report.breaches.join(", ")}): refusing to start with DOCUMENT_PROCESSING=enabled`,
    );
  }
  log.info(
    {
      isolation: sandbox.isolation,
      node: report.probe.nodeVersion,
      platform: report.probe.platform,
    },
    "parser sandbox containment verified",
  );
}

export async function bootstrapDocuments(
  config: DocumentProcessingConfig | null,
  db: ServiceRoleDb,
  log: Logger,
): Promise<DocumentsBootstrap> {
  if (config === null) return { enabled: false, reason: "disabled" };

  const sandbox = new ProcessSandbox({
    limits: DEFAULT_SANDBOX_LIMITS,
    timeoutMs: config.parseTimeoutSeconds * 1_000,
    heapMb: config.parserHeapMb,
  });
  await requireContainment(sandbox, log);

  const scanner = new ClamdScanner({
    host: config.clamavHost,
    port: config.clamavPort,
    timeoutMs: config.scanTimeoutSeconds * 1_000,
  });
  try {
    log.info({ engine: await scanner.version() }, "malware scanner reachable");
  } catch (err) {
    // Not fatal: every scan fails closed until the daemon is back, and /health is unaffected.
    log.warn(
      { error: describeError(err) },
      "malware scanner not reachable at start; scans will fail closed",
    );
  }

  const store = new SupabaseObjectStore({
    url: config.supabaseUrl,
    serviceKey: config.serviceRoleKey,
  });
  return {
    enabled: true,
    handler: createDocumentsHandler({ repo: new PgDocumentRepo(db), store, scanner, sandbox }),
  };
}
