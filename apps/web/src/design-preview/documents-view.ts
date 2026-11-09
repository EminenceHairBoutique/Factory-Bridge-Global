/**
 * List-level helpers for the buyer Documents screen (UX-04 §2): the one "next action" a row shows, and the
 * combined filter. Pure; tested in documents-view.test.ts. Pipeline semantics stay in documents-demo.ts.
 */
import type { DemoDocument, DocumentKind } from "./demo-data/documents";
import { STATUS_EXPLANATION, matchesStatusFilter, type StatusFilter } from "./documents-demo";

export type ActionTone = "neutral" | "warn" | "danger" | "ok";

export interface NextAction {
  label: string;
  href?: string;
  tone: ActionTone;
}

/** `reviewable` is whether a buyer-facing extraction review exists for the document. */
export function nextActionFor(
  doc: Pick<DemoDocument, "id" | "status" | "linked">,
  reviewable: boolean,
): NextAction {
  const reviewHref = `/design-preview/buyer/review?doc=${doc.id}`;
  switch (doc.status) {
    case "rejected":
      return { label: "Upload a clean copy", tone: "danger" };
    case "in_review":
      return reviewable
        ? { label: "Open extraction review", href: reviewHref, tone: "warn" }
        : { label: "Operator review in progress", tone: "warn" };
    case "accepted":
      return reviewable
        ? { label: "See reviewed values", href: reviewHref, tone: "ok" }
        : { label: doc.linked?.label ?? "Accepted", tone: "ok" };
    case "discarded":
      return { label: "Discarded", tone: "neutral" };
    case "uploaded":
    case "scanning":
    case "parsed":
    case "extracted": {
      const ex = STATUS_EXPLANATION[doc.status];
      return { label: ex.next ? `Next: ${ex.next}` : ex.label, tone: "neutral" };
    }
  }
}

export interface DocumentFilters {
  query?: string;
  /** A project id, or "all". */
  project?: string;
  kind?: DocumentKind | "all";
  status?: StatusFilter;
}

export function filterDocuments(docs: readonly DemoDocument[], f: DocumentFilters): DemoDocument[] {
  const q = (f.query ?? "").trim().toLowerCase();
  return docs.filter(
    (d) =>
      (q === "" || d.name.toLowerCase().includes(q)) &&
      (!f.project || f.project === "all" || d.project.id === f.project) &&
      (!f.kind || f.kind === "all" || d.kind === f.kind) &&
      matchesStatusFilter(d.status, f.status ?? "all"),
  );
}
