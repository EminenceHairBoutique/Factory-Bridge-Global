"use client";

/**
 * Buyer workspace: Documents (IA §2.2 `/app/projects/[id]/uploads`, rendered here as the
 * organization-wide library with a project filter). Upload intake with the client-side pre-check,
 * the pipeline status of every document with what happens next and who acts, a detail drawer with
 * the scan result, extraction flags, the linked record and the access log, and discard with
 * confirmation. Uploads are simulated locally: no bytes leave the browser, no scan runs.
 */
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import {
  BUYER_REVIEWS,
  DEMO_DOCUMENTS,
  DOCS_NOW,
  FLAG_LABEL,
  KIND_LABEL,
  RIGHTS_LABEL,
  SOURCE_LABEL,
  type AccessAction,
  type DemoDocument,
  type DocumentKind,
} from "../demo-data/documents";
import {
  advanceDocument,
  canDiscard,
  canIssueLink,
  documentSummary,
  formatBytes,
  matchesStatusFilter,
  nextStatus,
  shortTime,
  STATUS_EXPLANATION,
  validateUploads,
  type StatusFilter,
  type UploadCandidate,
} from "../documents-demo";
import { AppShell } from "../ui/AppShell";
import { Icon, type IconName } from "../ui/icons";
import {
  Badge,
  Button,
  buttonClasses,
  EmptyState,
  KeyValue,
  Notice,
  PageHeader,
  Panel,
  Select,
  Tabs,
  cx,
} from "../ui/primitives";
import { useEscapeKey } from "../ui/useEscapeKey";

const KIND_ICON: Record<DocumentKind, IconName> = {
  quote: "document",
  artwork: "camera",
  spec: "list",
  logistics: "truck",
  certificate: "shield",
  report: "download",
};

const ACCESS_LABEL: Record<AccessAction, string> = {
  view: "Viewed",
  download: "Downloaded",
  signed_url: "Signed link issued",
};

const RETENTION_LABEL: Record<DemoDocument["retentionClass"], string> = {
  project: "Kept for the life of the project plus the retention period",
  evidence: "Kept as evidence for the quotation version it backs",
  quarantine: "Quarantined; purged 7 days after rejection",
};

const STATUS_FILTERS: ReadonlyArray<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "pipeline", label: "In pipeline" },
  { value: "attention", label: "Needs attention" },
  { value: "accepted", label: "Accepted" },
  { value: "discarded", label: "Discarded" },
];

const UPLOAD_KINDS: DocumentKind[] = ["quote", "artwork", "spec", "logistics", "certificate"];

const SIMULATED_STEP_MS = 1400;

function makeUpload(
  f: UploadCandidate,
  index: number,
  kind: DocumentKind,
  project: DemoDocument["project"],
  at: string,
): DemoDocument {
  return {
    id: `d_new_${at}_${index}`,
    name: f.name,
    kind,
    mime: f.type,
    bytes: f.size,
    pages: null,
    sha256Prefix: "pending",
    sourceType: "buyer_upload",
    rightsClass: "buyer_uploaded_private",
    project,
    uploadedBy: "Demo Buyer",
    uploadedAt: at,
    status: "uploaded",
    retentionClass: "project",
    scan: { result: "pending", at: null, reason: null },
    extraction: null,
    linked: null,
    events: [
      {
        status: "uploaded",
        at,
        by: "Demo Buyer",
        detail: "Simulated: received into quarantine storage. No bytes were sent anywhere.",
      },
    ],
    accessLog: [],
  };
}

export function BuyerDocuments() {
  const [docs, setDocs] = useState<DemoDocument[]>(DEMO_DOCUMENTS);
  const [selectedId, setSelectedId] = useState<string | null>("d_quote_h");
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [kindFilter, setKindFilter] = useState<DocumentKind | "all">("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [uploadKind, setUploadKind] = useState<DocumentKind>("quote");
  const [uploadProject, setUploadProject] = useState<string>("prj_demo_labels");
  const [fileError, setFileError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [discarding, setDiscarding] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);
  const timers = useRef<Set<number>>(new Set());

  useEscapeKey(discarding !== null, () => setDiscarding(null));

  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach((t) => window.clearTimeout(t));
      pending.clear();
    };
  }, []);

  const projects = useMemo(() => {
    const seen = new Map<string, string>();
    for (const d of DEMO_DOCUMENTS) seen.set(d.project.id, d.project.name);
    return [...seen.entries()];
  }, []);

  const summary = useMemo(() => documentSummary(docs), [docs]);

  const rows = useMemo(
    () =>
      docs.filter(
        (d) =>
          (projectFilter === "all" || d.project.id === projectFilter) &&
          (kindFilter === "all" || d.kind === kindFilter) &&
          matchesStatusFilter(d.status, statusFilter),
      ),
    [docs, projectFilter, kindFilter, statusFilter],
  );

  const countFor = (f: StatusFilter) => docs.filter((d) => matchesStatusFilter(d.status, f)).length;

  const selected = docs.find((d) => d.id === selectedId) ?? null;

  const note = (line: string) =>
    setLog((l) => [`${new Date().toISOString().slice(11, 16)} · ${line}`, ...l]);

  /** Advances one simulated document through the pipeline until a human must act. */
  const schedule = (id: string, kind: DocumentKind, current: DemoDocument["status"]) => {
    const next = nextStatus(current, kind);
    if (!next) return;
    const t = window.setTimeout(() => {
      timers.current.delete(t);
      setDocs((prev) =>
        prev.map((d) => (d.id === id ? advanceDocument(d, new Date().toISOString()) : d)),
      );
      schedule(id, kind, next);
    }, SIMULATED_STEP_MS);
    timers.current.add(t);
  };

  const addFiles = (candidates: UploadCandidate[]) => {
    const result = validateUploads(candidates);
    setFileError(
      result.rejected.length
        ? result.rejected.map((r) => `${r.name}: ${r.reason}`).join(" · ")
        : null,
    );
    if (result.accepted.length === 0) return;
    const at = new Date().toISOString();
    const project = projects.find(([id]) => id === uploadProject);
    const projectRef = project
      ? { id: project[0], name: project[1] }
      : { id: uploadProject, name: uploadProject };
    const created = result.accepted.map((f, i) => makeUpload(f, i, uploadKind, projectRef, at));
    setDocs((prev) => [...created, ...prev]);
    setSelectedId(created[0]?.id ?? null);
    setStatusFilter("all");
    created.forEach((d) => {
      note(`Added ${d.name} (${KIND_LABEL[d.kind]}) — simulated pipeline started`);
      schedule(d.id, d.kind, d.status);
    });
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    addFiles(Array.from(e.dataTransfer.files));
  };

  const issueLink = (d: DemoDocument) => {
    const at = new Date().toISOString();
    setDocs((prev) =>
      prev.map((x) =>
        x.id === d.id
          ? {
              ...x,
              accessLog: [
                ...x.accessLog,
                { action: "signed_url", at, user: "Demo Buyer", role: "owner" },
              ],
            }
          : x,
      ),
    );
    note(`Signed link issued for ${d.name}; expires in 15 minutes; logged`);
  };

  const confirmDiscard = () => {
    const d = docs.find((x) => x.id === discarding);
    if (!d) return;
    const at = new Date().toISOString();
    setDocs((prev) =>
      prev.map((x) =>
        x.id === d.id
          ? {
              ...x,
              status: "discarded",
              linked: x.linked ?? null,
              events: [
                ...x.events,
                {
                  status: "discarded",
                  at,
                  by: "Demo Buyer",
                  detail:
                    x.status === "in_review"
                      ? "Discarded by the buyer; the operator's review task was closed and the operator notified."
                      : "Discarded by the buyer. File and audit trail retained.",
                },
              ],
            }
          : x,
      ),
    );
    note(`Discarded ${d.name}`);
    setDiscarding(null);
  };

  const rightRail = (
    <div className="flex flex-col gap-5 text-sm">
      {selected ? (
        <DocumentDetail
          doc={selected}
          onIssueLink={() => issueLink(selected)}
          onDiscard={() => setDiscarding(selected.id)}
          onReplace={() => {
            fileInput.current?.focus();
            fileInput.current?.scrollIntoView({ block: "center" });
          }}
        />
      ) : (
        <p className="text-(--fbg-text-secondary)">Select a document to see its record.</p>
      )}
      <div>
        <p className="text-xs font-semibold text-(--fbg-text-primary)">Actions this session</p>
        {log.length === 0 ? (
          <p className="mt-1 text-xs text-(--fbg-text-secondary)">
            Nothing yet. Views, downloads and signed links are written to the access log.
          </p>
        ) : (
          <ul className="mt-1 flex flex-col gap-1 text-xs text-(--fbg-text-secondary)">
            {log.map((l, i) => (
              <li key={`${l}-${i}`} className="fbg-num">
                {l}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );

  return (
    <AppShell workspace="buyer" title="Documents" rightRail={rightRail}>
      <div className="flex flex-col gap-5">
        <PageHeader
          title="Documents"
          lead="Every quotation, artwork and specification your organization uploads or receives, with where it is in the pipeline and who acts next. Files are private to your organization and the operators assigned to the project."
          meta={
            <>
              <Badge tone="neutral" icon={null} className="fbg-num">
                {summary.inPipeline} in pipeline
              </Badge>
              <Badge
                tone={summary.inReview + summary.rejected > 0 ? "warn" : "ok"}
                icon={summary.inReview + summary.rejected > 0 ? "alert" : "check"}
                className="fbg-num"
              >
                {summary.inReview + summary.rejected} need attention
              </Badge>
              <Badge tone="ok" icon="check" className="fbg-num">
                {summary.accepted} accepted
              </Badge>
              <Badge tone="neutral" icon="clock" className="fbg-num">
                As of {shortTime(DOCS_NOW)} UTC
              </Badge>
            </>
          }
        />

        {/* Upload */}
        <Panel
          title="Add documents"
          description="PDF, XLSX, CSV, PNG, JPG or WebP, up to 25 MB each. The server re-checks the file signature, scans for malware and enforces page caps before anything is read."
        >
          <div className="grid gap-3 md:grid-cols-[1fr_1fr_2fr]">
            <Select
              aria-label="Document kind"
              value={uploadKind}
              onChange={(e) => setUploadKind(e.target.value as DocumentKind)}
            >
              {UPLOAD_KINDS.map((k) => (
                <option key={k} value={k}>
                  {KIND_LABEL[k]}
                </option>
              ))}
            </Select>
            <Select
              aria-label="Project"
              value={uploadProject}
              onChange={(e) => setUploadProject(e.target.value)}
            >
              {projects.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </Select>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              className={cx(
                "flex min-w-0 flex-col items-start gap-2 rounded-(--fbg-radius-control) border border-dashed p-3 sm:flex-row sm:items-center sm:justify-between",
                dragOver
                  ? "border-(--fbg-action-primary) bg-(--fbg-selected)"
                  : "border-(--fbg-border-strong)/60",
              )}
            >
              <p className="text-sm text-(--fbg-text-secondary)">
                Drop files here, or{" "}
                <label
                  htmlFor="doc-upload"
                  className="cursor-pointer font-medium text-(--fbg-text-link) underline-offset-2 hover:underline"
                >
                  choose files
                </label>
                .
              </p>
              <input
                ref={fileInput}
                id="doc-upload"
                type="file"
                multiple
                accept=".pdf,.xlsx,.csv,.png,.jpg,.jpeg,.webp"
                className="sr-only"
                onChange={(e) => {
                  addFiles(Array.from(e.target.files ?? []));
                  e.target.value = "";
                }}
              />
              <Button
                size="sm"
                icon="upload"
                onClick={() =>
                  addFiles([{ name: "sample-quote.pdf", type: "application/pdf", size: 318_000 }])
                }
              >
                Try a sample file
              </Button>
            </div>
          </div>
          <p className="mt-2 text-xs text-(--fbg-text-secondary)">
            Simulated in this preview: a new file walks the pipeline here in the browser; nothing is
            uploaded, scanned or read.
          </p>
          {fileError ? (
            <div className="mt-3">
              <Notice tone="danger" title="Not added">
                {fileError}
              </Notice>
            </div>
          ) : null}
        </Panel>

        <Tabs
          label="Document status"
          value={statusFilter}
          onChange={setStatusFilter}
          tabs={STATUS_FILTERS.map((f) => ({
            value: f.value,
            label: f.label,
            count: countFor(f.value),
          }))}
        />

        <Panel padded={false}>
          <div className="flex flex-col gap-2 border-b border-(--fbg-border-subtle) p-4 sm:flex-row sm:flex-wrap sm:items-center">
            <Select
              aria-label="Filter by project"
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              className="min-w-0 sm:max-w-80 sm:flex-1 sm:basis-64"
            >
              <option value="all">All projects</option>
              {projects.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </Select>
            <Select
              aria-label="Filter by kind"
              value={kindFilter}
              onChange={(e) => setKindFilter(e.target.value as DocumentKind | "all")}
              className="min-w-0 sm:max-w-56 sm:flex-1 sm:basis-44"
            >
              <option value="all">All kinds</option>
              {(Object.keys(KIND_LABEL) as DocumentKind[]).map((k) => (
                <option key={k} value={k}>
                  {KIND_LABEL[k]}
                </option>
              ))}
            </Select>
            <span className="fbg-num text-xs whitespace-nowrap text-(--fbg-text-secondary) sm:ml-auto">
              {rows.length} shown · newest first
            </span>
          </div>

          {rows.length === 0 ? (
            <div className="p-6">
              <EmptyState
                title="No documents match"
                body="Change the filters, or add a document above. Nothing is read until it has passed the scan."
                icon="document"
              />
            </div>
          ) : (
            <ul className="divide-y divide-(--fbg-border-subtle)">
              {rows.map((d) => {
                const ex = STATUS_EXPLANATION[d.status];
                const active = d.id === selectedId;
                return (
                  <li key={d.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(d.id)}
                      aria-pressed={active}
                      className={cx(
                        "flex w-full min-w-0 flex-col gap-2 px-4 py-3 text-left hover:bg-(--fbg-bg-canvas) sm:flex-row sm:items-start sm:gap-3",
                        active && "bg-(--fbg-selected)",
                      )}
                    >
                      <Icon
                        name={KIND_ICON[d.kind]}
                        size={18}
                        className="mt-0.5 hidden shrink-0 text-(--fbg-text-secondary) sm:block"
                      />
                      <span className="flex min-w-0 flex-1 flex-col gap-1">
                        <span className="flex min-w-0 flex-wrap items-center gap-2">
                          <span className="fbg-num min-w-0 text-sm font-medium break-all text-(--fbg-text-primary)">
                            {d.name}
                          </span>
                          <Badge tone={ex.tone} icon={null}>
                            {ex.label}
                          </Badge>
                        </span>
                        <span className="fbg-num text-xs text-(--fbg-text-secondary)">
                          {KIND_LABEL[d.kind]} · {d.project.name} · {d.uploadedBy} ·{" "}
                          {shortTime(d.uploadedAt)} · {formatBytes(d.bytes)}
                          {d.pages !== null ? ` · ${d.pages} page${d.pages === 1 ? "" : "s"}` : ""}
                        </span>
                        <span
                          className={cx(
                            "text-xs",
                            d.status === "rejected"
                              ? "text-(--fbg-status-danger)"
                              : "text-(--fbg-text-secondary)",
                          )}
                        >
                          {d.status === "rejected" && d.scan.reason
                            ? d.scan.reason
                            : d.linked
                              ? d.linked.label
                              : ex.next
                                ? `Next: ${ex.next.toLowerCase()} (${ex.who.toLowerCase()})`
                                : ex.what}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        {/* Detail below the list where the rail is hidden */}
        <div className="xl:hidden">
          {selected ? (
            <Panel title="Document record" padded>
              <DocumentDetail
                doc={selected}
                onIssueLink={() => issueLink(selected)}
                onDiscard={() => setDiscarding(selected.id)}
                onReplace={() => {
                  fileInput.current?.focus();
                  fileInput.current?.scrollIntoView({ block: "center" });
                }}
              />
            </Panel>
          ) : null}
        </div>

        {discarding ? (
          <DiscardDialog
            doc={docs.find((d) => d.id === discarding) ?? null}
            onCancel={() => setDiscarding(null)}
            onConfirm={confirmDiscard}
          />
        ) : null}
      </div>
    </AppShell>
  );
}

function DocumentDetail({
  doc,
  onIssueLink,
  onDiscard,
  onReplace,
}: {
  doc: DemoDocument;
  onIssueLink: () => void;
  onDiscard: () => void;
  onReplace: () => void;
}) {
  const ex = STATUS_EXPLANATION[doc.status];
  const discard = canDiscard(doc);
  const reviewHref = BUYER_REVIEWS[doc.id] ? `/design-preview/buyer/review?doc=${doc.id}` : null;
  const flags = doc.extraction?.flags ?? [];

  return (
    <div className="flex flex-col gap-5 text-sm">
      <div className="min-w-0">
        <p className="text-xs text-(--fbg-text-secondary)">Document record</p>
        <p className="fbg-num text-[15px] font-semibold break-all text-(--fbg-text-primary)">
          {doc.name}
        </p>
        <p className="text-xs text-(--fbg-text-secondary)">
          {KIND_LABEL[doc.kind]} · {doc.project.name}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Badge tone={ex.tone} icon={null}>
            {ex.label}
          </Badge>
          <span className="text-xs text-(--fbg-text-secondary)">{ex.who} acts</span>
        </div>
        <p className="mt-1 text-xs text-(--fbg-text-secondary)">{ex.what}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {canIssueLink(doc.status) ? (
          <Button size="sm" icon="download" onClick={onIssueLink}>
            Get download link
          </Button>
        ) : null}
        {reviewHref ? (
          <Link href={reviewHref} className={buttonClasses("secondary", "sm")}>
            {doc.status === "accepted" ? "See reviewed values" : "Open extraction review"}
          </Link>
        ) : null}
        {doc.status === "rejected" ? (
          <Button size="sm" variant="primary" icon="upload" onClick={onReplace}>
            Upload a clean copy
          </Button>
        ) : null}
        {discard.ok ? (
          <Button size="sm" variant="ghost" onClick={onDiscard}>
            Discard
          </Button>
        ) : null}
      </div>
      {!discard.ok && doc.status === "accepted" ? (
        <p className="text-xs text-(--fbg-text-secondary)">{discard.reason}</p>
      ) : null}

      {doc.status === "rejected" && doc.scan.reason ? (
        <Notice tone="danger" title="Rejected by the scan">
          {doc.scan.reason}
        </Notice>
      ) : null}
      {flags.map((flag) => (
        <Notice
          key={flag}
          tone={flag === "embedded_instruction_detected" ? "danger" : "warn"}
          title={FLAG_LABEL[flag].label}
        >
          {FLAG_LABEL[flag].body}
        </Notice>
      ))}

      <KeyValue
        columns={1}
        items={[
          { label: "Source", value: SOURCE_LABEL[doc.sourceType] },
          { label: "Who can see it", value: RIGHTS_LABEL[doc.rightsClass] },
          {
            label: "File",
            value: (
              <span className="fbg-num">
                {doc.mime
                  .split("/")
                  .pop()
                  ?.replace("vnd.openxmlformats-officedocument.spreadsheetml.", "")}{" "}
                · {formatBytes(doc.bytes)}
                {doc.pages !== null ? ` · ${doc.pages} page${doc.pages === 1 ? "" : "s"}` : ""}
              </span>
            ),
          },
          {
            label: "Fingerprint",
            value: <span className="fbg-num">sha256 {doc.sha256Prefix}…</span>,
          },
          { label: "Retention", value: RETENTION_LABEL[doc.retentionClass] },
          {
            label: "Added",
            value: (
              <span className="fbg-num">
                {doc.uploadedBy} · {shortTime(doc.uploadedAt)}
              </span>
            ),
          },
        ]}
      />

      <div>
        <p className="text-xs font-semibold text-(--fbg-text-primary)">Pipeline</p>
        <ol className="mt-2 flex flex-col gap-2 border-l border-(--fbg-border-subtle) pl-3">
          {doc.events.map((e, i) => {
            const current = i === doc.events.length - 1;
            return (
              <li key={`${e.status}-${e.at}`} className="relative">
                <span
                  aria-hidden
                  className={cx(
                    "absolute top-1.5 -left-[17px] h-2 w-2 rounded-full",
                    current ? "bg-(--fbg-action-primary)" : "bg-(--fbg-border-strong)",
                  )}
                />
                <p className="text-xs">
                  <span className="font-medium text-(--fbg-text-primary)">
                    {STATUS_EXPLANATION[e.status].label}
                  </span>{" "}
                  <span className="fbg-num text-(--fbg-text-secondary)">
                    · {shortTime(e.at)} · {e.by}
                  </span>
                </p>
                <p className="text-xs text-(--fbg-text-secondary)">{e.detail}</p>
              </li>
            );
          })}
          {ex.next ? (
            <li className="relative">
              <span
                aria-hidden
                className="absolute top-1.5 -left-[17px] h-2 w-2 rounded-full border border-dashed border-(--fbg-border-strong)"
              />
              <p className="text-xs text-(--fbg-text-secondary)">Next: {ex.next}</p>
            </li>
          ) : null}
        </ol>
      </div>

      {doc.extraction ? (
        <div>
          <p className="text-xs font-semibold text-(--fbg-text-primary)">Extraction</p>
          <p className="fbg-num mt-1 text-xs text-(--fbg-text-secondary)">
            {doc.extraction.fields} values proposed · {doc.extraction.promptVersion} ·{" "}
            {shortTime(doc.extraction.at)}
          </p>
          <p className="mt-1 text-xs text-(--fbg-text-secondary)">
            Each value carries an anchor to the line it came from. Nothing becomes a price until an
            operator accepts it.
          </p>
        </div>
      ) : null}

      {doc.linked ? (
        <div>
          <p className="text-xs font-semibold text-(--fbg-text-primary)">Linked record</p>
          {doc.linked.href ? (
            <Link
              href={doc.linked.href}
              className="mt-1 inline-block text-xs font-medium text-(--fbg-text-link) underline-offset-2 hover:underline"
            >
              {doc.linked.label}
            </Link>
          ) : (
            <p className="mt-1 text-xs text-(--fbg-text-secondary)">{doc.linked.label}</p>
          )}
        </div>
      ) : null}

      <div>
        <p className="text-xs font-semibold text-(--fbg-text-primary)">Access log</p>
        {doc.accessLog.length === 0 ? (
          <p className="mt-1 text-xs text-(--fbg-text-secondary)">No access recorded yet.</p>
        ) : (
          <ul className="mt-1 flex flex-col gap-1">
            {doc.accessLog.map((a, i) => (
              <li key={`${a.at}-${i}`} className="fbg-num text-xs text-(--fbg-text-secondary)">
                {ACCESS_LABEL[a.action]} · {a.user} ({a.role}) · {shortTime(a.at)}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-1 text-xs text-(--fbg-text-secondary)">
          Every view, download and signed link is logged. Links expire 15 minutes after they are
          issued.
        </p>
      </div>
    </div>
  );
}

function DiscardDialog({
  doc,
  onCancel,
  onConfirm,
}: {
  doc: DemoDocument | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!doc) return null;
  const decision = canDiscard(doc);
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Discard ${doc.name}`}
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
    >
      <button
        type="button"
        className="absolute inset-0 bg-(--fbg-overlay)"
        aria-label="Close"
        onClick={onCancel}
      />
      <div className="fbg-raised relative w-full max-w-lg rounded-t-(--fbg-radius-dialog) p-5 sm:rounded-(--fbg-radius-dialog)">
        <h2 className="fbg-num text-[15px] font-semibold break-all text-(--fbg-text-primary)">
          Discard {doc.name}?
        </h2>
        <p className="mt-1 text-sm text-(--fbg-text-secondary)">
          It leaves active use and no longer appears in reviews or comparisons. The file and its
          audit trail are retained per the retention class; nothing is deleted now.
        </p>
        {decision.reason ? (
          <p className="mt-2 text-sm text-(--fbg-text-secondary)">{decision.reason}</p>
        ) : null}
        <div className="mt-4 flex justify-end gap-2">
          <Button onClick={onCancel}>Cancel</Button>
          <Button variant="danger" onClick={onConfirm}>
            Discard
          </Button>
        </div>
      </div>
    </div>
  );
}
