"use client";

/**
 * Buyer workspace: Documents — UX-04 §2 (IA §2.2 `/app/projects/[id]/uploads`, rendered as the
 * organization-wide library with a project filter).
 *
 * List first: one scannable row per document — file, project, type, status, date, next action. The
 * record inspector (scan result, flags, provenance, pipeline, linked record, access log) opens on demand:
 * as the right rail on wide screens, as a drawer below. The upload intake is collapsed until asked for
 * (the Overview's "Upload a quote" link opens it via `#upload`). Uploads are simulated locally: no bytes
 * leave the browser, no scan runs. Provenance, security and audit content is unchanged.
 */
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from "react";
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
import { filterDocuments, nextActionFor, type ActionTone } from "../documents-view";
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
  TextInput,
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

const ACTION_TONE: Record<ActionTone, string> = {
  neutral: "text-(--fbg-text-secondary)",
  warn: "text-(--fbg-status-warning)",
  danger: "text-(--fbg-status-danger)",
  ok: "text-(--fbg-status-success)",
};

const UPLOAD_KINDS: DocumentKind[] = ["quote", "artwork", "spec", "logistics", "certificate"];

const SIMULATED_STEP_MS = 1400;

const ROW_GRID =
  "grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 px-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_6.5rem_8.5rem_6rem_minmax(0,1.1fr)] lg:items-center lg:gap-x-4";

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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [kindFilter, setKindFilter] = useState<DocumentKind | "all">("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadKind, setUploadKind] = useState<DocumentKind>("quote");
  const [uploadProject, setUploadProject] = useState<string>("prj_demo_labels");
  const [fileError, setFileError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [discarding, setDiscarding] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);
  const uploadPanel = useRef<HTMLDivElement>(null);
  const timers = useRef<Set<number>>(new Set());

  useEscapeKey(discarding !== null, () => setDiscarding(null));
  useEscapeKey(discarding === null && selectedId !== null, () => setSelectedId(null));

  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach((t) => window.clearTimeout(t));
      pending.clear();
    };
  }, []);

  // The Overview's "Upload a quote" link lands on #upload: open the intake and bring it into view.
  useEffect(() => {
    if (window.location.hash !== "#upload") return;
    setUploadOpen(true);
    const t = window.setTimeout(
      () => uploadPanel.current?.scrollIntoView({ block: "start", behavior: "smooth" }),
      50,
    );
    return () => window.clearTimeout(t);
  }, []);

  const projects = useMemo(() => {
    const seen = new Map<string, string>();
    for (const d of DEMO_DOCUMENTS) seen.set(d.project.id, d.project.name);
    return [...seen.entries()];
  }, []);

  const summary = useMemo(() => documentSummary(docs), [docs]);
  const needAttention = summary.inReview + summary.rejected;

  const rows = useMemo(
    () =>
      filterDocuments(docs, {
        query,
        project: projectFilter,
        kind: kindFilter,
        status: statusFilter,
      }),
    [docs, query, projectFilter, kindFilter, statusFilter],
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
    setQuery("");
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

  const openUpload = () => {
    setUploadOpen(true);
    window.setTimeout(() => {
      uploadPanel.current?.scrollIntoView({ block: "start", behavior: "smooth" });
      fileInput.current?.focus();
    }, 50);
  };

  const detail = selected ? (
    <DocumentDetail
      doc={selected}
      onIssueLink={() => issueLink(selected)}
      onDiscard={() => setDiscarding(selected.id)}
      onReplace={openUpload}
    />
  ) : null;

  const rightRail = selected ? (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[12px] text-(--fbg-text-secondary)">Document record</p>
        <button
          type="button"
          onClick={() => setSelectedId(null)}
          aria-label="Close document record"
          className="-mt-1.5 -mr-1.5 rounded-(--fbg-radius-control) p-1.5 text-(--fbg-text-secondary) hover:bg-(--fbg-hover) hover:text-(--fbg-text-primary)"
        >
          <Icon name="x" size={16} />
        </button>
      </div>
      {detail}
    </div>
  ) : undefined;

  return (
    <AppShell workspace="buyer" title="Documents" rightRail={rightRail}>
      <div className="mx-auto flex max-w-[1120px] flex-col gap-6">
        <PageHeader
          title="Documents"
          lead="Every file your organization uploads or receives, where it is in the pipeline and who acts next."
          meta={
            <>
              <span className="fbg-num">{summary.inPipeline} in pipeline</span>
              <span
                className={cx(
                  "fbg-num inline-flex items-center gap-1",
                  needAttention > 0 && "font-medium text-(--fbg-status-warning)",
                )}
              >
                {needAttention > 0 ? <Icon name="alert" size={12} /> : null}
                {needAttention} need attention
              </span>
              <span className="fbg-num">{summary.accepted} accepted</span>
              <span className="fbg-num hidden sm:inline">As of {shortTime(DOCS_NOW)} UTC</span>
            </>
          }
          actions={
            <Button
              variant="primary"
              icon="upload"
              onClick={() => (uploadOpen ? setUploadOpen(false) : openUpload())}
              aria-expanded={uploadOpen}
              aria-controls="upload"
            >
              Add documents
            </Button>
          }
        />

        {uploadOpen ? (
          <div ref={uploadPanel} id="upload" className="scroll-mt-20">
            <Panel
              title="Add documents"
              description="PDF, XLSX, CSV, PNG, JPG or WebP, up to 25 MB each. The server re-checks the file signature, scans for malware and enforces page caps before anything is read."
              actions={
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setUploadOpen(false)}
                  aria-label="Close add documents"
                >
                  Close
                </Button>
              }
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
                      className="cursor-pointer font-medium text-(--fbg-link) underline-offset-2 hover:underline"
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
                      addFiles([
                        { name: "sample-quote.pdf", type: "application/pdf", size: 318_000 },
                      ])
                    }
                  >
                    Try a sample file
                  </Button>
                </div>
              </div>
              <p className="mt-2 text-[12px] text-(--fbg-text-secondary)">
                Simulated in this preview: a new file walks the pipeline here in the browser;
                nothing is uploaded, scanned or read.
              </p>
              {fileError ? (
                <div className="mt-3">
                  <Notice tone="danger" title="Not added">
                    {fileError}
                  </Notice>
                </div>
              ) : null}
            </Panel>
          </div>
        ) : (
          <div id="upload" ref={uploadPanel} className="scroll-mt-20" />
        )}

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
          <div className="flex flex-col gap-2 border-b border-(--fbg-border-divider) p-3 sm:flex-row sm:items-center">
            <div className="relative min-w-0 flex-1 sm:max-w-xs">
              <Icon
                name="search"
                size={16}
                className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-(--fbg-text-muted)"
              />
              <TextInput
                type="search"
                aria-label="Search documents"
                placeholder="Search by file name"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select
              aria-label="Filter by project"
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              className="min-w-0 sm:w-64"
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
              className="min-w-0 sm:w-44"
            >
              <option value="all">All kinds</option>
              {(Object.keys(KIND_LABEL) as DocumentKind[]).map((k) => (
                <option key={k} value={k}>
                  {KIND_LABEL[k]}
                </option>
              ))}
            </Select>
            <span className="fbg-num text-[12px] whitespace-nowrap text-(--fbg-text-secondary) sm:ml-auto">
              {rows.length} shown · newest first
            </span>
          </div>

          {rows.length === 0 ? (
            <div className="p-6">
              <EmptyState
                title="No documents match"
                body="Change the filters or the search, or add a document. Nothing is read until it has passed the scan."
                icon="document"
                action={
                  <Button size="sm" icon="upload" onClick={openUpload}>
                    Add documents
                  </Button>
                }
              />
            </div>
          ) : (
            <>
              <div
                className={cx(
                  ROW_GRID,
                  "hidden border-b border-(--fbg-border-divider) py-2 text-[12px] font-medium text-(--fbg-text-secondary) lg:grid",
                )}
                aria-hidden
              >
                <span>File</span>
                <span>Project</span>
                <span>Type</span>
                <span>Status</span>
                <span>Added</span>
                <span>Next</span>
              </div>
              <ul className="divide-y divide-(--fbg-border-divider)">
                {rows.map((d) => (
                  <DocumentRow
                    key={d.id}
                    doc={d}
                    selected={d.id === selectedId}
                    onSelect={() => setSelectedId(d.id === selectedId ? null : d.id)}
                  />
                ))}
              </ul>
            </>
          )}
        </Panel>

        <p className="text-[12px] text-(--fbg-text-muted)">
          Files are private to your organization and the operators assigned to the project. Every
          view, download and signed link is written to the document's access log.
        </p>

        {log.length > 0 ? (
          <details className="text-[12px] text-(--fbg-text-secondary)">
            <summary className="cursor-pointer list-none font-medium [&::-webkit-details-marker]:hidden">
              Actions this session ({log.length})
            </summary>
            <ul className="mt-1 flex flex-col gap-1">
              {log.map((l, i) => (
                <li key={`${l}-${i}`} className="fbg-num">
                  {l}
                </li>
              ))}
            </ul>
          </details>
        ) : null}

        {/* Inspector as a drawer where the right rail is hidden */}
        {selected ? (
          <InspectorDrawer title={selected.name} onClose={() => setSelectedId(null)}>
            {detail}
          </InspectorDrawer>
        ) : null}

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

function DocumentRow({
  doc,
  selected,
  onSelect,
}: {
  doc: DemoDocument;
  selected: boolean;
  onSelect: () => void;
}) {
  const ex = STATUS_EXPLANATION[doc.status];
  const next = nextActionFor(doc, doc.id in BUYER_REVIEWS);
  return (
    <li>
      <div
        className={cx(
          ROW_GRID,
          "py-3",
          selected ? "bg-(--fbg-selected)" : "hover:bg-(--fbg-hover)",
        )}
      >
        <button
          type="button"
          onClick={onSelect}
          aria-pressed={selected}
          aria-label={`${selected ? "Close" : "Open"} the record for ${doc.name}`}
          className="flex min-w-0 items-center gap-3 text-left"
        >
          <Icon
            name={KIND_ICON[doc.kind]}
            size={18}
            className="shrink-0 text-(--fbg-text-secondary)"
          />
          <span className="min-w-0">
            <span className="fbg-num block truncate text-sm font-medium text-(--fbg-text-primary)">
              {doc.name}
            </span>
            <span className="block truncate text-[12px] text-(--fbg-text-secondary) lg:hidden">
              {KIND_LABEL[doc.kind]} · {doc.project.name}
            </span>
          </span>
        </button>
        <span className="hidden min-w-0 truncate text-[13px] text-(--fbg-text-secondary) lg:order-2 lg:block">
          {doc.project.name}
        </span>
        <span className="hidden text-[13px] text-(--fbg-text-secondary) lg:order-3 lg:block">
          {KIND_LABEL[doc.kind]}
        </span>
        <div className="lg:order-4">
          <Badge tone={ex.tone} icon={null}>
            {ex.label}
          </Badge>
        </div>
        <span className="fbg-num col-span-2 text-[12px] text-(--fbg-text-secondary) lg:order-5 lg:col-span-1">
          <span className="lg:hidden">Added </span>
          {shortTime(doc.uploadedAt).slice(0, 10)}
        </span>
        <div className="col-span-2 min-w-0 truncate text-[13px] lg:order-6 lg:col-span-1">
          {next.href ? (
            <Link href={next.href} className="font-medium text-(--fbg-link) hover:underline">
              {next.label}
            </Link>
          ) : (
            <span className={ACTION_TONE[next.tone]} title={ex.what}>
              {next.label}
            </span>
          )}
        </div>
      </div>
    </li>
  );
}

/** Drawer for the record below the xl right rail: a side sheet on tablet, a bottom sheet on phones. */
function InspectorDrawer({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Document record: ${title}`}
      className="fixed inset-0 z-50 xl:hidden"
    >
      <button
        type="button"
        className="absolute inset-0 bg-(--fbg-overlay)"
        aria-label="Close document record"
        onClick={onClose}
      />
      <div className="fbg-raised absolute inset-x-0 bottom-0 max-h-[88dvh] overflow-y-auto rounded-t-(--fbg-radius-dialog) p-4 pb-[max(env(safe-area-inset-bottom),16px)] md:inset-y-0 md:right-0 md:left-auto md:w-[420px] md:max-h-none md:rounded-none md:border-l md:border-(--fbg-border-subtle) md:p-5">
        <div className="mb-3 flex items-start justify-between gap-2">
          <p className="text-[12px] text-(--fbg-text-secondary)">Document record</p>
          <button
            type="button"
            autoFocus
            onClick={onClose}
            aria-label="Close document record"
            className="-mt-1.5 -mr-1.5 rounded-(--fbg-radius-control) p-2 text-(--fbg-text-secondary) hover:bg-(--fbg-hover) hover:text-(--fbg-text-primary)"
          >
            <Icon name="x" size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function InspectorSection({
  title,
  count,
  open,
  children,
}: {
  title: string;
  count?: number | undefined;
  open?: boolean | undefined;
  children: ReactNode;
}) {
  return (
    <details className="group border-t border-(--fbg-border-divider) pt-3" open={open}>
      <summary className="flex cursor-pointer list-none items-center justify-between text-[12px] font-semibold text-(--fbg-text-primary) [&::-webkit-details-marker]:hidden">
        <span>
          {title}
          {count !== undefined ? (
            <span className="fbg-num ml-1 font-normal text-(--fbg-text-secondary)">({count})</span>
          ) : null}
        </span>
        <Icon
          name="chevron-down"
          size={14}
          className="text-(--fbg-text-muted) transition-transform group-open:rotate-180"
        />
      </summary>
      <div className="mt-2">{children}</div>
    </details>
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
    <div className="flex flex-col gap-4 text-sm">
      <div className="min-w-0">
        <p className="fbg-num text-[15px] font-semibold break-all text-(--fbg-text-primary)">
          {doc.name}
        </p>
        <p className="text-[12px] text-(--fbg-text-secondary)">
          {KIND_LABEL[doc.kind]} · {doc.project.name}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Badge tone={ex.tone} icon={null}>
            {ex.label}
          </Badge>
          <span className="text-[12px] text-(--fbg-text-secondary)">{ex.who} acts</span>
        </div>
        <p className="mt-1 text-[13px] text-(--fbg-text-secondary)">{ex.what}</p>
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
        <p className="text-[12px] text-(--fbg-text-secondary)">{discard.reason}</p>
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

      {doc.extraction ? (
        <p className="fbg-num text-[12px] text-(--fbg-text-secondary)">
          Extraction: {doc.extraction.fields} values proposed · {doc.extraction.promptVersion} ·{" "}
          {shortTime(doc.extraction.at)}. Each value carries an anchor to its source line; nothing
          becomes a price until an operator accepts it.
        </p>
      ) : null}

      {doc.linked ? (
        <p className="text-[13px]">
          <span className="text-(--fbg-text-secondary)">Linked record: </span>
          {doc.linked.href ? (
            <Link
              href={doc.linked.href}
              className="font-medium text-(--fbg-link) underline-offset-2 hover:underline"
            >
              {doc.linked.label}
            </Link>
          ) : (
            <span className="text-(--fbg-text-primary)">{doc.linked.label}</span>
          )}
        </p>
      ) : null}

      <InspectorSection title="Provenance and security" open>
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
            {
              label: "Scan",
              value:
                doc.scan.result === "pending"
                  ? "Pending"
                  : `${doc.scan.result === "passed" ? "Passed" : "Rejected"}${doc.scan.at ? ` · ${shortTime(doc.scan.at)}` : ""}`,
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
      </InspectorSection>

      <InspectorSection title="Pipeline" count={doc.events.length} open>
        <ol className="flex flex-col gap-2 border-l border-(--fbg-border-subtle) pl-3">
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
                <p className="text-[12px]">
                  <span className="font-medium text-(--fbg-text-primary)">
                    {STATUS_EXPLANATION[e.status].label}
                  </span>{" "}
                  <span className="fbg-num text-(--fbg-text-secondary)">
                    · {shortTime(e.at)} · {e.by}
                  </span>
                </p>
                <p className="text-[12px] text-(--fbg-text-secondary)">{e.detail}</p>
              </li>
            );
          })}
          {ex.next ? (
            <li className="relative">
              <span
                aria-hidden
                className="absolute top-1.5 -left-[17px] h-2 w-2 rounded-full border border-dashed border-(--fbg-border-strong)"
              />
              <p className="text-[12px] text-(--fbg-text-secondary)">Next: {ex.next}</p>
            </li>
          ) : null}
        </ol>
      </InspectorSection>

      <InspectorSection title="Access log" count={doc.accessLog.length}>
        {doc.accessLog.length === 0 ? (
          <p className="text-[12px] text-(--fbg-text-secondary)">No access recorded yet.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {doc.accessLog.map((a, i) => (
              <li key={`${a.at}-${i}`} className="fbg-num text-[12px] text-(--fbg-text-secondary)">
                {ACCESS_LABEL[a.action]} · {a.user} ({a.role}) · {shortTime(a.at)}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-1 text-[12px] text-(--fbg-text-secondary)">
          Every view, download and signed link is logged. Links expire 15 minutes after they are
          issued.
        </p>
      </InspectorSection>
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
