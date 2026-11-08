/**
 * Display-only helpers for the document library and extraction review previews. They mirror the
 * upload safety pipeline in docs/SECURITY.md §4 and the `document_status` machine in
 * docs/SCHEMA_PLAN.md so the UI never invents a state, a transition or a file rule. The real
 * checks (magic bytes, malware scan, page caps) run in the worker; these functions only decide
 * what the client may say before the server answers.
 */
import type { DocumentStatus } from "@fbg/domain";
import type { DemoDocument, DocEvent, DocumentKind } from "./demo-data/documents";

/** SECURITY.md §4.1: MIME allow-list for Phase 1 uploads. No SVG, HTML, archives or legacy Office. */
export const ALLOWED_UPLOAD_TYPES: ReadonlySet<string> = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
]);

const EXTENSION_FOR_TYPE: Record<string, readonly string[]> = {
  "application/pdf": ["pdf"],
  "image/jpeg": ["jpg", "jpeg"],
  "image/png": ["png"],
  "image/webp": ["webp"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ["xlsx"],
  "text/csv": ["csv"],
};

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

export interface UploadCandidate {
  name: string;
  type: string;
  size: number;
}

export interface UploadValidation {
  accepted: UploadCandidate[];
  rejected: Array<{ name: string; reason: string }>;
}

function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot + 1).toLowerCase();
}

/**
 * Client-side pre-check only. The worker re-verifies the signature (magic bytes), size and page
 * caps and runs the malware scan; a file that passes here can still be rejected there.
 */
export function validateUploads(files: readonly UploadCandidate[]): UploadValidation {
  const accepted: UploadCandidate[] = [];
  const rejected: Array<{ name: string; reason: string }> = [];
  for (const f of files) {
    if (f.size <= 0) {
      rejected.push({ name: f.name, reason: "empty file" });
      continue;
    }
    if (!ALLOWED_UPLOAD_TYPES.has(f.type)) {
      rejected.push({
        name: f.name,
        reason: "file type not accepted (PDF, XLSX, CSV, PNG, JPG or WebP only)",
      });
      continue;
    }
    if (f.size > MAX_UPLOAD_BYTES) {
      rejected.push({ name: f.name, reason: "larger than 25 MB" });
      continue;
    }
    const allowedExt = EXTENSION_FOR_TYPE[f.type] ?? [];
    if (!allowedExt.includes(extensionOf(f.name))) {
      rejected.push({ name: f.name, reason: "file extension does not match its type" });
      continue;
    }
    accepted.push(f);
  }
  return { accepted, rejected };
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/** Which kinds go through extraction. Artwork, specs and certificates stop at `parsed`. */
export const EXTRACTED_KINDS: ReadonlySet<DocumentKind> = new Set(["quote", "logistics"]);

/**
 * Next pipeline status after a successful step, or null when the pipeline stops or a human must
 * act. `scanning` may also end in `rejected`; that branch is a scan outcome, not a transition here.
 */
export function nextStatus(status: DocumentStatus, kind: DocumentKind): DocumentStatus | null {
  switch (status) {
    case "uploaded":
      return "scanning";
    case "scanning":
      return "parsed";
    case "parsed":
      return EXTRACTED_KINDS.has(kind) ? "extracted" : null;
    case "extracted":
      return kind === "quote" ? "in_review" : null;
    case "in_review":
    case "accepted":
    case "rejected":
    case "discarded":
      return null;
  }
}

export interface StatusExplanation {
  label: string;
  what: string;
  who: string;
  next: string | null;
  tone: "neutral" | "teal" | "ok" | "warn" | "danger";
}

export const STATUS_EXPLANATION: Record<DocumentStatus, StatusExplanation> = {
  uploaded: {
    label: "Uploaded",
    what: "Received into quarantine storage. Nothing has read it yet.",
    who: "You, your operator or the supplier",
    next: "Scanning",
    tone: "neutral",
  },
  scanning: {
    label: "Scanning",
    what: "Type check against the file signature, size and page caps, and a malware scan. No text is read and no AI runs.",
    who: "Worker",
    next: "Parsed, or Rejected",
    tone: "teal",
  },
  rejected: {
    label: "Rejected",
    what: "Failed the scan. Kept in quarantine for 7 days for forensics, then deleted. Nothing was read from it.",
    who: "Worker",
    next: null,
    tone: "danger",
  },
  parsed: {
    label: "Parsed",
    what: "Text and layout captured per page (or cells per sheet) and moved out of quarantine.",
    who: "Worker",
    next: "Extracted for quotations and logistics; artwork, specifications and certificates stop here",
    tone: "neutral",
  },
  extracted: {
    label: "Extracted",
    what: "AI proposed values with an anchor for each and recorded flags. The output is schema-checked; no price is stored yet.",
    who: "Worker (AI run logged with model, prompt version and cost)",
    next: "In review",
    tone: "teal",
  },
  in_review: {
    label: "In review",
    what: "An operator checks each value against its anchor. Corrections are recorded with before, after, who and when.",
    who: "Operator",
    next: "Accepted as a quotation version, or discarded",
    tone: "warn",
  },
  accepted: {
    label: "Accepted",
    what: "An immutable quotation version exists with this document as its evidence. Later changes create a new version.",
    who: "Operator",
    next: null,
    tone: "ok",
  },
  discarded: {
    label: "Discarded",
    what: "Removed from active use. The file and its audit trail are retained per the retention class.",
    who: "You or an operator",
    next: null,
    tone: "neutral",
  },
};

export interface DiscardDecision {
  ok: boolean;
  reason: string | null;
}

/** Documents that back an immutable quotation cannot be discarded; supersede them instead. */
export function canDiscard(doc: Pick<DemoDocument, "status" | "linked">): DiscardDecision {
  switch (doc.status) {
    case "accepted":
      return {
        ok: false,
        reason:
          "This document is the evidence behind an immutable quotation version. Upload a newer document to supersede it; the version keeps its evidence.",
      };
    case "rejected":
      return { ok: false, reason: "Rejected files are purged from quarantine automatically." };
    case "discarded":
      return { ok: false, reason: "Already discarded." };
    case "in_review":
      return {
        ok: true,
        reason: "The operator's review task is closed and the operator is notified.",
      };
    case "uploaded":
    case "scanning":
    case "parsed":
    case "extracted":
      return { ok: true, reason: null };
  }
}

/** A signed link is only issued for files that left quarantine and are still in use. */
export function canIssueLink(status: DocumentStatus): boolean {
  return (
    status === "parsed" || status === "extracted" || status === "in_review" || status === "accepted"
  );
}

export interface DocumentSummary {
  inPipeline: number;
  inReview: number;
  accepted: number;
  rejected: number;
  discarded: number;
}

export function documentSummary(docs: readonly Pick<DemoDocument, "status">[]): DocumentSummary {
  const s: DocumentSummary = { inPipeline: 0, inReview: 0, accepted: 0, rejected: 0, discarded: 0 };
  for (const d of docs) {
    switch (d.status) {
      case "uploaded":
      case "scanning":
      case "parsed":
      case "extracted":
        s.inPipeline += 1;
        break;
      case "in_review":
        s.inReview += 1;
        break;
      case "accepted":
        s.accepted += 1;
        break;
      case "rejected":
        s.rejected += 1;
        break;
      case "discarded":
        s.discarded += 1;
        break;
    }
  }
  return s;
}

export type StatusFilter = "all" | "pipeline" | "attention" | "accepted" | "discarded";

/** "Attention" = rejected or waiting on a review. */
export function matchesStatusFilter(status: DocumentStatus, filter: StatusFilter): boolean {
  switch (filter) {
    case "all":
      return true;
    case "pipeline":
      return (
        status === "uploaded" ||
        status === "scanning" ||
        status === "parsed" ||
        status === "extracted"
      );
    case "attention":
      return status === "rejected" || status === "in_review";
    case "accepted":
      return status === "accepted";
    case "discarded":
      return status === "discarded";
  }
}

/**
 * One simulated pipeline step for a demo upload (preview only; the worker owns the real pipeline).
 * Returns the same object when no automatic step remains.
 */
export function advanceDocument(doc: DemoDocument, at: string): DemoDocument {
  const next = nextStatus(doc.status, doc.kind);
  if (!next) return doc;
  const ex = STATUS_EXPLANATION[next];
  const event: DocEvent = {
    status: next,
    at,
    by: next === "in_review" ? "System (simulated)" : "Worker (simulated)",
    detail: `Simulated: ${ex.what}`,
  };
  const updated: DemoDocument = { ...doc, status: next, events: [...doc.events, event] };
  if (next === "parsed") {
    updated.scan = { result: "passed", at, reason: null };
    updated.sha256Prefix = "simulated";
  }
  if (next === "extracted") {
    updated.extraction = {
      fields: doc.kind === "quote" ? 9 : 4,
      flags: [],
      promptVersion: "simulated — no AI run",
      at,
      reviewTaskId: null,
    };
  }
  if (next === "in_review") {
    updated.linked = { label: "Extraction review — waiting for an operator", href: null };
  }
  return updated;
}

/** Short ISO → "2026-11-07 10:00" for display. Never used for arithmetic. */
export function shortTime(iso: string): string {
  return iso.slice(0, 16).replace("T", " ");
}
