/**
 * Queue → handler registry. Every queue migration 0012 created is consumed; the ones whose handler does not exist yet
 * — or exists but is not enabled on this worker — fail closed (dead letter on the first attempt) instead of being
 * silently acknowledged or left to pile up unseen.
 * None of these handlers calls an AI provider: live AI calls are gate G2 and GuardedAiRunner stays unwired.
 */
import type { JobHandler, QueueHandler } from "../queue/consumer.js";
import { NotConfiguredJobError, NotImplementedJobError } from "../queue/errors.js";
import { notificationsHandler } from "./notifications.js";

export const WORKER_QUEUES = [
  "fbg_documents",
  "fbg_extraction",
  "fbg_notifications",
  "fbg_fx",
] as const;

export type WorkerQueue = (typeof WORKER_QUEUES)[number];

export function notImplementedHandler(queue: string, arrivesWith: string): JobHandler {
  return () => Promise.reject(new NotImplementedJobError(queue, arrivesWith));
}

export function notConfiguredHandler(queue: string, why: string): JobHandler {
  return () => Promise.reject(new NotConfiguredJobError(queue, why));
}

export interface HandlerOverrides {
  /**
   * The scan + parse handler (handlers/documents.ts), built by the entrypoint only when document processing is
   * enabled, fully configured and its parser sandbox passed the containment probe. Absent → the queue fails closed.
   */
  readonly documents?: QueueHandler;
}

export function defaultHandlers(
  overrides: HandlerOverrides = {},
): ReadonlyMap<WorkerQueue, QueueHandler> {
  return new Map<WorkerQueue, QueueHandler>([
    ["fbg_notifications", notificationsHandler],
    [
      "fbg_documents",
      overrides.documents ??
        notConfiguredHandler("fbg_documents", "DOCUMENT_PROCESSING is disabled or incomplete"),
    ],
    ["fbg_extraction", notImplementedHandler("fbg_extraction", "B-19 live extraction, gate G2")],
    ["fbg_fx", notImplementedHandler("fbg_fx", "the FX provider decision, ADR-010")],
  ]);
}
