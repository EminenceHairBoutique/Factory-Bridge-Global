/**
 * fbg_documents handler (B-12 / B-13): scans and parses one quarantined document.
 *
 * It is a staged handler (ADR-044):
 *
 *   prepare  validates the message, claims the document as `scanning` in one short transaction, then examines the
 *            file with no transaction open (documents/pipeline.ts): download, hash, content check, malware scan,
 *            sandboxed parse, promotion of the scanned bytes.
 *   commit   writes the outcome inside the consumer's success transaction: `parsed` with its page / cell records,
 *            or `rejected` with a reason code — together with the ledger marker and the archive of the message.
 *
 * What a message can and cannot do. The payload is two ids. The worker reads the document row for both of them
 * together, so a message that names another organization's document finds nothing and is dead-lettered without
 * touching it; the storage path is taken from the row and re-checked, never from the message.
 *
 * What is never done here: no AI call, no extraction job is enqueued (B-19, gate G2), no file is served, and a
 * document is never marked `parsed` on anything but a clean verdict from a scanner that answered.
 */
import { DOCUMENT_PROCESS, documentJobPayload, isDocumentJobKey } from "../documents/job.js";
import {
  QUARANTINE_BUCKET,
  SERVED_BUCKET,
  examineDocument,
  type DocumentOutcome,
  type PipelineDeps,
} from "../documents/pipeline.js";
import { finalizeParsed, finalizeRejected } from "../documents/repo.js";
import type { StagedJobHandler } from "../queue/consumer.js";
import { summarizeIssues } from "../queue/envelope.js";
import { PermanentJobError } from "../queue/errors.js";

export type DocumentsHandlerDeps = PipelineDeps;

export function createDocumentsHandler(
  deps: DocumentsHandlerDeps,
): StagedJobHandler<DocumentOutcome> {
  return {
    async prepare(job, { signal, log }) {
      if (job.type !== DOCUMENT_PROCESS) {
        throw new PermanentJobError(
          "unknown_type",
          `${job.queue} does not handle type ${job.type}`,
        );
      }
      const parsed = documentJobPayload.safeParse(job.payload);
      if (!parsed.success) {
        throw new PermanentJobError("invalid_payload", summarizeIssues(parsed.error));
      }
      const { document_id: documentId, org_id: orgId } = parsed.data;
      if (!isDocumentJobKey(job.idempotencyKey, documentId)) {
        throw new PermanentJobError(
          "invalid_idempotency_key",
          "the key must be document.process:<document_id>:v1",
        );
      }

      const loaded = await deps.repo.load(documentId, orgId);
      if (loaded.kind === "not_found") {
        // One answer for "no such id" and "belongs to another organization": the message learns nothing either way.
        throw new PermanentJobError("document_not_found", "no such document in that organization");
      }
      if (loaded.kind === "noop") {
        log.info(
          { documentId, status: loaded.status },
          "document already past scanning; nothing to do",
        );
        return { outcome: "noop", status: loaded.status };
      }
      return examineDocument(loaded.document, deps, signal, log);
    },

    /**
     * Storage housekeeping once the outcome is durable. Best effort: a failure here is logged by the consumer and
     * changes nothing about the job; whatever it leaves behind is unreadable (ADR-033 §4) and belongs to the
     * retention sweep. It decides from the document's committed state, never from what this job intended.
     */
    async afterCommit(_job, outcome, { signal, log }) {
      if (outcome.outcome !== "parsed") return;
      const status = await deps.repo.status(outcome.documentId, outcome.orgId);
      if (status === "rejected" || status === "discarded" || status === null) {
        // This job promoted a copy, but the document ended somewhere else: the copy must not linger.
        await deps.store.remove(SERVED_BUCKET, outcome.promotedPath, signal);
        log.info({ documentId: outcome.documentId, status }, "unused promoted copy removed");
        return;
      }
      if (status === "scanning" || status === "uploaded") return; // not durable yet; leave everything in place
      // parsed or later: the served copy is the document now. The quarantined upload has done its job — and for
      // an image it is the copy that still carries the metadata the served one was stripped of.
      await deps.store.remove(QUARANTINE_BUCKET, outcome.quarantinePath, signal);
      log.info({ documentId: outcome.documentId }, "quarantined upload removed after promotion");
    },

    async commit(_job, outcome, { tx, log }) {
      switch (outcome.outcome) {
        case "noop":
          return;
        case "rejected": {
          const result = await finalizeRejected(tx, {
            documentId: outcome.documentId,
            orgId: outcome.orgId,
            uploadedBy: outcome.uploadedBy,
            code: outcome.code,
            detail: outcome.detail,
            sha256: outcome.sha256,
            scanResult: outcome.scanResult,
            securityEvent: outcome.securityEvent,
          });
          log.info(
            { documentId: outcome.documentId, reason: outcome.code, result },
            "document rejection recorded",
          );
          return;
        }
        case "parsed": {
          const result = await finalizeParsed(tx, {
            documentId: outcome.documentId,
            orgId: outcome.orgId,
            uploadedBy: outcome.uploadedBy,
            sha256: outcome.sha256,
            promotedBucket: SERVED_BUCKET,
            promotedPath: outcome.promotedPath,
            scanResult: outcome.scanResult,
            pageCount: outcome.pageCount,
            pages: outcome.pages,
            cells: outcome.cells,
          });
          log.info(
            {
              documentId: outcome.documentId,
              kind: outcome.kind,
              pages: outcome.pages.length,
              cells: outcome.cells.length,
              result,
            },
            "document parse recorded",
          );
          return;
        }
      }
    },
  };
}
