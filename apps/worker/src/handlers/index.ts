/**
 * Queue → handler registry. Every queue migration 0012 created is consumed; the ones whose handler does not exist yet
 * fail closed (dead letter on the first attempt) instead of being silently acknowledged or left to pile up unseen.
 * None of these handlers calls an AI provider: live AI calls are gate G2 and GuardedAiRunner stays unwired.
 */
import type { JobHandler } from "../queue/consumer.js";
import { NotImplementedJobError } from "../queue/errors.js";
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

export function defaultHandlers(): ReadonlyMap<WorkerQueue, JobHandler> {
  return new Map<WorkerQueue, JobHandler>([
    ["fbg_notifications", notificationsHandler],
    ["fbg_documents", notImplementedHandler("fbg_documents", "B-12 parsing and B-13 scanning")],
    ["fbg_extraction", notImplementedHandler("fbg_extraction", "B-19 live extraction, gate G2")],
    ["fbg_fx", notImplementedHandler("fbg_fx", "the FX provider decision, ADR-010")],
  ]);
}
