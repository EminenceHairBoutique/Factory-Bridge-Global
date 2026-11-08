"use client";

/**
 * Buyer workspace: Extraction review (IA §2.2 `/app/projects/[id]/review/[taskId]`). The same
 * ReviewSplit as the operator concept with fewer controls: values are read-only with their
 * confidence and anchors; the buyer can flag a value or add context for the operator. Nothing here
 * accepts a price, and nothing goes to the supplier.
 */
import Link from "next/link";
import { useState } from "react";
import {
  BUYER_REVIEWS,
  DEMO_DOCUMENTS,
  FLAG_LABEL,
  RIGHTS_LABEL,
  SOURCE_LABEL,
} from "../demo-data/documents";
import { STATUS_EXPLANATION, shortTime } from "../documents-demo";
import { AppShell } from "../ui/AppShell";
import {
  Badge,
  Button,
  buttonClasses,
  EmptyState,
  KeyValue,
  Notice,
  PageHeader,
  Panel,
  TextArea,
  cx,
} from "../ui/primitives";
import { ConfidenceBand, PaneToggle, ReviewSplit, type ReviewPane } from "../ui/ReviewSplit";

export const DEFAULT_REVIEW_DOC = "d_quote_h";

/** `docId` comes from the route's `searchParams` on the server, so no Suspense boundary is needed. */
export function BuyerExtractionReview({ docId }: { docId: string }) {
  const doc = DEMO_DOCUMENTS.find((d) => d.id === docId);
  const review = BUYER_REVIEWS[docId];

  const [pane, setPane] = useState<ReviewPane>("fields");
  const [activeAnchor, setActiveAnchor] = useState<string | null>(null);
  const [flagged, setFlagged] = useState<Set<string>>(new Set());
  const [note, setNote] = useState("");
  const [sent, setSent] = useState(false);

  if (!doc || !review) {
    return (
      <AppShell workspace="buyer" title="Extraction review">
        <EmptyState
          title="No review for this document"
          body="Only quotations that reached extraction have a review. Open the documents library to pick one."
          icon="document"
          action={
            <Link href="/design-preview/buyer/documents" className={buttonClasses("secondary")}>
              Open documents
            </Link>
          }
        />
      </AppShell>
    );
  }

  const inReview = doc.status === "in_review";
  const accepted = doc.status === "accepted";
  const ex = STATUS_EXPLANATION[doc.status];
  const flags = doc.extraction?.flags ?? [];
  const acceptedEvent = doc.events.find((e) => e.status === "accepted");

  const toggleFlag = (key: string) =>
    setFlagged((s) => {
      const next = new Set(s);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const flaggedLabels = review.fields.filter((f) => flagged.has(f.key)).map((f) => f.label);
  const canSend = !sent && (flaggedLabels.length > 0 || note.trim().length > 0);

  const rightRail = (
    <div className="flex flex-col gap-5 text-sm">
      <div>
        <p className="text-xs text-(--fbg-text-secondary)">Evidence drawer</p>
        <p className="text-[15px] font-semibold text-(--fbg-text-primary)">Source document</p>
      </div>
      <KeyValue
        columns={1}
        items={[
          { label: "File", value: <span className="fbg-num break-all">{doc.name}</span> },
          { label: "Source", value: SOURCE_LABEL[doc.sourceType] },
          { label: "Who can see it", value: RIGHTS_LABEL[doc.rightsClass] },
          {
            label: "Scan",
            value: doc.scan.at ? (
              <span className="fbg-num">passed · {shortTime(doc.scan.at)}</span>
            ) : (
              "pending"
            ),
          },
          {
            label: "Fingerprint",
            value: <span className="fbg-num">sha256 {doc.sha256Prefix}…</span>,
          },
          doc.extraction
            ? {
                label: "Extraction",
                value: (
                  <span className="fbg-num">
                    {doc.extraction.promptVersion} · {shortTime(doc.extraction.at)}
                  </span>
                ),
              }
            : { label: "Extraction", value: "not run" },
        ]}
      />
      <div>
        <p className="text-xs font-semibold text-(--fbg-text-primary)">How to read this</p>
        <ul className="mt-1 flex flex-col gap-1.5 text-xs text-(--fbg-text-secondary)">
          <li className="flex items-center gap-2">
            <ConfidenceBand level="high" /> read directly from a clear line
          </li>
          <li className="flex items-center gap-2">
            <ConfidenceBand level="medium" /> read, but wording or layout was ambiguous
          </li>
          <li className="flex items-center gap-2">
            <ConfidenceBand level="low" /> uncertain; the operator checks it first
          </li>
          <li>
            An anchor names the line a value came from. Click it to see the line. A value with no
            anchor was not in the document and stays empty; nothing is assumed.
          </li>
        </ul>
      </div>
    </div>
  );

  return (
    <AppShell workspace="buyer" title="Extraction review" rightRail={rightRail}>
      <div className="flex flex-col gap-5">
        <PageHeader
          title={
            <span className="flex min-w-0 flex-wrap items-center gap-2">
              <span>Extraction review</span>
              <span className="fbg-num text-base font-normal break-all text-(--fbg-text-secondary)">
                {doc.name}
              </span>
            </span>
          }
          lead={
            inReview
              ? "What the extractor read from the supplier's document, with the line each value came from. An operator is checking it; nothing below is a confirmed price yet."
              : accepted
                ? "The values an operator accepted from this document, with the line each one came from and the corrections made before accepting."
                : ex.what
          }
          meta={
            <>
              <Badge tone={ex.tone} icon={null}>
                {ex.label}
              </Badge>
              <Badge tone="neutral" icon={null}>
                {doc.project.name}
              </Badge>
            </>
          }
          actions={
            <div className="flex flex-wrap gap-2">
              <Link href="/design-preview/buyer/documents" className={buttonClasses("secondary")}>
                All documents
              </Link>
              {accepted && doc.linked?.href ? (
                <Link href={doc.linked.href} className={buttonClasses("primary")}>
                  Open comparison
                </Link>
              ) : null}
            </div>
          }
        />

        {inReview ? (
          <Notice tone="warn" title="Operator review in progress">
            {ex.who} checks each value against its anchor and records any correction with before,
            after, who and when. You can flag a value or add context below; the operator sees it
            before accepting. Nothing is sent to the supplier from this page.
          </Notice>
        ) : accepted && acceptedEvent ? (
          <Notice
            tone="ok"
            title={`Accepted ${shortTime(acceptedEvent.at)} by ${acceptedEvent.by}`}
          >
            {acceptedEvent.detail} The resulting quotation version is immutable; a newer document
            creates a new version rather than changing this one.
          </Notice>
        ) : null}

        {flags.length > 0 ? (
          <div className="flex flex-col gap-2">
            {flags.map((flag) => (
              <Notice
                key={flag}
                tone={flag === "embedded_instruction_detected" ? "danger" : "warn"}
                title={FLAG_LABEL[flag].label}
              >
                {FLAG_LABEL[flag].body}
              </Notice>
            ))}
          </div>
        ) : null}

        <div className="flex justify-end">
          <PaneToggle pane={pane} onChange={setPane} />
        </div>

        <ReviewSplit
          lines={review.lines}
          pages={review.pages}
          fields={review.fields}
          activeAnchor={activeAnchor}
          onAnchor={(a) => {
            setActiveAnchor(a);
            setPane("document");
          }}
          pane={pane}
          readOnly
          fieldsDescription={
            inReview
              ? "Proposed values. Flag anything that does not match what the supplier told you."
              : "Values as accepted by the operator."
          }
          renderFieldExtra={
            inReview
              ? (f) => {
                  const on = flagged.has(f.key);
                  return (
                    <button
                      type="button"
                      aria-pressed={on}
                      disabled={sent}
                      onClick={() => toggleFlag(f.key)}
                      className={cx(
                        "mt-1 inline-flex h-7 items-center gap-1 self-start rounded-(--fbg-radius-chip) border px-2 text-xs font-medium disabled:opacity-60",
                        on
                          ? "border-(--fbg-status-warning)/50 bg-(--fbg-status-warning-fill) text-(--fbg-status-warning)"
                          : "border-(--fbg-border-subtle) text-(--fbg-text-secondary) hover:text-(--fbg-text-primary)",
                      )}
                    >
                      {on ? "Flagged for the operator" : "Flag for the operator"}
                    </button>
                  );
                }
              : undefined
          }
        />

        {inReview ? (
          <Panel
            title="Your notes to the operator"
            description="Attached to the review task. The operator reads them before accepting; no message goes to the supplier."
          >
            {sent ? (
              <Notice tone="ok" title="Attached to the review task">
                {flaggedLabels.length > 0
                  ? `Flagged: ${flaggedLabels.join(", ")}. `
                  : "No values flagged. "}
                {note.trim() ? "Your note was included. " : ""}
                The operator sees this before accepting any value.
              </Notice>
            ) : (
              <div className="flex flex-col gap-3">
                <p className="text-sm text-(--fbg-text-secondary)">
                  {flaggedLabels.length > 0
                    ? `Flagged: ${flaggedLabels.join(", ")}.`
                    : "No values flagged yet. Use “Flag for the operator” under a value."}
                </p>
                <TextArea
                  aria-label="Note to the operator"
                  rows={3}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Anything the operator should know, for example what the supplier told you about tooling or validity."
                />
                <div className="flex flex-wrap gap-2">
                  <Button variant="primary" disabled={!canSend} onClick={() => setSent(true)}>
                    Attach to the review
                  </Button>
                </div>
              </div>
            )}
          </Panel>
        ) : null}

        {accepted ? (
          <Panel
            title="Operator corrections"
            description="Each correction stores before, after, who and when. The original proposal stays viewable."
            padded={false}
          >
            {review.corrections.length === 0 ? (
              <p className="px-4 py-3 text-sm text-(--fbg-text-secondary)">
                Accepted without corrections.
              </p>
            ) : (
              <ul className="divide-y divide-(--fbg-border-subtle)">
                {review.corrections.map((c) => (
                  <li key={`${c.field}-${c.when}`} className="px-4 py-2 text-sm">
                    <p className="font-medium text-(--fbg-text-primary)">{c.field}</p>
                    <p className="text-(--fbg-text-secondary)">
                      <span className="line-through">{c.before ?? "null"}</span> →{" "}
                      <span className="text-(--fbg-text-primary)">{c.after}</span>
                    </p>
                    <p className="fbg-num text-xs text-(--fbg-text-secondary)">
                      {c.who} · {c.when}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        ) : null}
      </div>
    </AppShell>
  );
}
