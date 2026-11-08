"use client";

/**
 * Buyer workspace: Reports (IA §2.2 `/app/projects/[id]/reports`, rendered as the organization
 * reports list with a project filter). Versioned list with current / stale / superseded derived
 * from the recorded inputs, a generate panel that shows exactly what the next version will
 * contain, and the reproducibility facts in the evidence drawer. Generation is simulated in the
 * browser: no file is produced (B-23) and reports generated here exist only on this screen.
 */
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { DEMO_AS_OF, DEMO_FX, DEMO_PROJECTS } from "../demo-data";
import {
  DEMO_REPORTS,
  FORMAT_HINT,
  FORMAT_LABEL,
  type ReportFormat,
  type ReportRecord,
} from "../demo-data/reports";
import { formatQty } from "../compare-demo";
import {
  REPORT_ENGINE_VERSION,
  REPORT_STATE_LABEL,
  REPORT_STATE_TONE,
  buildReport,
  quotesForProject,
  reportFileName,
  reportStatus,
  type ReportContext,
} from "../reports-demo";
import { AppShell } from "../ui/AppShell";
import {
  Badge,
  Button,
  buttonClasses,
  Checkbox,
  EmptyState,
  Notice,
  PageHeader,
  Panel,
  SegmentedControl,
  Select,
  cx,
} from "../ui/primitives";
import { ReportFacts } from "../ui/ReportFacts";

const QTY_OPTIONS = ["5000", "10000", "25000"] as const;
type QtyOption = (typeof QTY_OPTIONS)[number];
const FORMATS: ReportFormat[] = ["pdf", "xlsx", "csv"];
const SIMULATED_GENERATION_MS = 1500;

function qtyOption(n: number | undefined): QtyOption {
  const s = String(n ?? 10_000);
  return (QTY_OPTIONS as readonly string[]).includes(s) ? (s as QtyOption) : "10000";
}

export function BuyerReports({
  initialQty,
  initialFormat,
}: {
  initialQty?: number | undefined;
  initialFormat?: ReportFormat | undefined;
}) {
  const [reports, setReports] = useState<ReportRecord[]>(DEMO_REPORTS);
  const [projectId, setProjectId] = useState("prj_demo_labels");
  const [qty, setQty] = useState<QtyOption>(qtyOption(initialQty));
  const [includeForwarder, setIncludeForwarder] = useState(true);
  const [format, setFormat] = useState<ReportFormat>(initialFormat ?? "pdf");
  const [selectedId, setSelectedId] = useState<string | null>("rep_1");
  const [log, setLog] = useState<string[]>([]);
  const timers = useRef<Set<number>>(new Set());
  const generateRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach((t) => window.clearTimeout(t));
      pending.clear();
    };
  }, []);

  const project = DEMO_PROJECTS.find((p) => p.id === projectId) ?? DEMO_PROJECTS[0];
  const liveQuotes = useMemo(() => quotesForProject(projectId), [projectId]);
  const projectReports = useMemo(
    () => reports.filter((r) => r.projectId === projectId).sort((a, b) => b.version - a.version),
    [reports, projectId],
  );
  const ctx = useMemo<ReportContext>(
    () => ({
      currentBriefVersion: project?.briefVersion ?? 0,
      currentQuotes: liveQuotes.map((q) => ({
        id: q.id,
        supplier: q.supplier,
        confirmedAt: q.confirmedAt,
      })),
      newestReportId: projectReports.find((r) => r.state === "ready")?.id ?? null,
    }),
    [project, liveQuotes, projectReports],
  );

  const preview = useMemo(
    () =>
      project
        ? buildReport({
            project,
            briefVersion: project.briefVersion,
            quantity: Number(qty),
            asOf: DEMO_AS_OF,
            quotes: liveQuotes,
            includeForwarder,
            generatedAt: "preview",
            generatedBy: "preview",
          })
        : null,
    [project, qty, liveQuotes, includeForwarder],
  );

  const selected = reports.find((r) => r.id === selectedId) ?? projectReports[0] ?? null;
  const note = (line: string) =>
    setLog((l) => [`${new Date().toISOString().slice(11, 16)} · ${line}`, ...l]);

  const generate = () => {
    if (!project || liveQuotes.length === 0) return;
    const version = (projectReports[0]?.version ?? 0) + 1;
    const now = new Date();
    const rec: ReportRecord = {
      id: `rep_${now.getTime()}`,
      projectId: project.id,
      version,
      format,
      fileName: reportFileName(project.id, project.briefVersion, DEMO_AS_OF, format),
      generatedAt: `${DEMO_AS_OF} ${now.toISOString().slice(11, 16)}`,
      generatedBy: "System (requested by Demo Buyer) — simulated",
      briefVersion: project.briefVersion,
      quantity: Number(qty),
      asOf: DEMO_AS_OF,
      includeForwarder,
      fxRateId: DEMO_FX.id,
      engineVersion: REPORT_ENGINE_VERSION,
      quotations: liveQuotes.map((q) => ({
        id: q.id,
        version: 1,
        supplier: q.supplier,
        confirmedAt: q.confirmedAt,
      })),
      documentId: null,
      state: "generating",
    };
    setReports((prev) => [rec, ...prev]);
    setSelectedId(rec.id);
    note(`Generation requested: ${rec.fileName} (${FORMAT_LABEL[format]}) — simulated`);
    const t = window.setTimeout(() => {
      timers.current.delete(t);
      setReports((prev) => prev.map((r) => (r.id === rec.id ? { ...r, state: "ready" } : r)));
      note(`Ready: report v${version}; earlier versions are now superseded`);
    }, SIMULATED_GENERATION_MS);
    timers.current.add(t);
  };

  const issueLink = (r: ReportRecord) => {
    note(`Signed link issued for ${r.fileName}; expires in 15 minutes; logged`);
  };

  const regenerateFrom = (r: ReportRecord) => {
    setQty(qtyOption(r.quantity));
    setIncludeForwarder(r.includeForwarder);
    setFormat(r.format);
    generateRef.current?.scrollIntoView({ block: "center" });
    generateRef.current?.querySelector("button")?.focus();
  };

  const viewHref = (r: ReportRecord) =>
    r.documentId
      ? `/design-preview/buyer/report?id=${r.id}`
      : `/design-preview/buyer/report?id=live&v=${r.version}&qty=${r.quantity}&fwd=${r.includeForwarder ? 1 : 0}&format=${r.format}`;

  const rightRail = (
    <div className="flex flex-col gap-5 text-sm">
      <div>
        <p className="text-xs text-(--fbg-text-secondary)">Evidence drawer</p>
        <p className="text-[15px] font-semibold text-(--fbg-text-primary)">
          Why this report says what it says
        </p>
      </div>
      {selected && project ? (
        <ReportFacts report={selected} status={reportStatus(selected, ctx)} unit={project.unit} />
      ) : (
        <p className="text-(--fbg-text-secondary)">
          Select a report to see the inputs it recorded.
        </p>
      )}
      <div>
        <p className="text-xs font-semibold text-(--fbg-text-primary)">Actions this session</p>
        {log.length === 0 ? (
          <p className="mt-1 text-xs text-(--fbg-text-secondary)">
            Nothing yet. Generation requests and signed links are written to the audit trail.
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

  const liveCounts = preview?.counts ?? { ranked: 0, notRanked: 0, groups: 0 };

  return (
    <AppShell workspace="buyer" title="Reports" rightRail={rightRail}>
      <div className="flex flex-col gap-5">
        <PageHeader
          title="Reports"
          lead="A report is a snapshot. It records the brief version, quantity, FX row and the exact quotation versions it used, so it can be reproduced later. A report never changes; when the inputs change, generate a new version."
          meta={
            <>
              <Badge tone="neutral" icon={null} className="fbg-num">
                {projectReports.length} version{projectReports.length === 1 ? "" : "s"}
              </Badge>
              <Badge tone="neutral" icon="clock" className="fbg-num">
                As of {DEMO_AS_OF}
              </Badge>
            </>
          }
          actions={
            <Select
              aria-label="Project"
              value={projectId}
              onChange={(e) => {
                setProjectId(e.target.value);
                setSelectedId(null);
              }}
              className="sm:w-80"
            >
              {DEMO_PROJECTS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          }
        />

        {/* Generate */}
        <Panel
          title="Generate a new version"
          description="The report is built from the comparison as it stands now. Everything below is derived from the quotations; nothing is typed in."
        >
          {liveQuotes.length === 0 ? (
            <Notice tone="neutral" title="No quotations to report on yet">
              A report needs at least one confirmed quotation in the comparison. This project has
              none; the next step is on the project overview.
            </Notice>
          ) : (
            <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
              <div className="flex flex-col gap-4">
                <div>
                  <p className="mb-1.5 text-xs font-medium text-(--fbg-text-primary)">Quantity</p>
                  <SegmentedControl
                    label="Quantity"
                    value={qty}
                    onChange={setQty}
                    options={QTY_OPTIONS.map((q) => ({
                      value: q,
                      label: <span className="fbg-num">{formatQty(Number(q))}</span>,
                    }))}
                  />
                </div>
                <Checkbox
                  id="rep-forwarder"
                  label="Include the forwarder's freight estimate"
                  description="Lines marked estimated with their source recorded in the assumptions. Without it, freight lines are missing and landed totals stay partial."
                  checked={includeForwarder}
                  onChange={setIncludeForwarder}
                />
                <div role="radiogroup" aria-label="Format" className="grid gap-2">
                  {FORMATS.map((f) => (
                    <label
                      key={f}
                      className={cx(
                        "flex cursor-pointer items-start gap-2 rounded-(--fbg-radius-control) border p-3",
                        format === f
                          ? "border-(--fbg-action-primary)/60 bg-(--fbg-selected)"
                          : "border-(--fbg-border-subtle) hover:border-(--fbg-border-strong)",
                      )}
                    >
                      <input
                        type="radio"
                        name="reportFormat"
                        className="mt-0.5 accent-(--fbg-action-primary)"
                        checked={format === f}
                        onChange={() => setFormat(f)}
                      />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-(--fbg-text-primary)">
                          {FORMAT_LABEL[f]}
                        </span>
                        <span className="block text-xs text-(--fbg-text-secondary)">
                          {FORMAT_HINT[f]}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-3 rounded-(--fbg-radius-control) border border-(--fbg-border-subtle) bg-(--fbg-bg-canvas) p-4">
                <p className="text-xs font-semibold text-(--fbg-text-primary)">
                  What this version will contain
                </p>
                <ul className="flex flex-col gap-1.5 text-sm text-(--fbg-text-secondary)">
                  <li className="fbg-num">
                    {liveCounts.ranked} quotation{liveCounts.ranked === 1 ? "" : "s"} ranked in{" "}
                    {liveCounts.groups} trade-term group{liveCounts.groups === 1 ? "" : "s"}
                    {preview && preview.groups.some((g) => g.kind === "basis")
                      ? ` (${preview.groups
                          .filter((g) => g.kind === "basis")
                          .map((g) => g.title)
                          .join(", ")})`
                      : ""}
                  </li>
                  <li className="fbg-num">
                    {liveCounts.notRanked} not ranked, each with its reason in the exclusions
                  </li>
                  <li>
                    Ranking across trade terms by landed total:{" "}
                    {preview?.landedRanking.available
                      ? "available"
                      : liveCounts.ranked > 1
                        ? `blocked (${preview?.landedRanking.blockedBy.join(", ")} have missing lines)`
                        : "not applicable"}
                  </li>
                  <li className="fbg-num">
                    {preview?.footer.assumptions.length ?? 0} assumptions ·{" "}
                    {preview?.footer.exclusions.length ?? 0} exclusions · rounding rule · 3
                    disclaimers
                  </li>
                  <li>
                    FX row {DEMO_FX.id} ({(1 / DEMO_FX.rate).toFixed(2)} CNY/USD, {DEMO_FX.rateDate}
                    ) and brief v{project?.briefVersion}
                  </li>
                </ul>
                <p className="fbg-num text-xs break-all text-(--fbg-text-secondary)">
                  File:{" "}
                  {project
                    ? reportFileName(project.id, project.briefVersion, DEMO_AS_OF, format)
                    : ""}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <span ref={generateRef} className="inline-flex">
                    <Button
                      variant="primary"
                      icon="download"
                      onClick={generate}
                      disabled={projectReports.some((r) => r.state === "generating")}
                    >
                      Generate {FORMAT_LABEL[format].split(" ")[0]}
                    </Button>
                  </span>
                  <Link
                    href="/design-preview/buyer/compare"
                    className={buttonClasses("ghost", "md")}
                  >
                    Open the comparison
                  </Link>
                </div>
                <p className="text-xs text-(--fbg-text-secondary)">
                  Simulated in this preview: a version is added here and marked ready after a
                  moment. Real generation runs server-side and produces a stored file.
                </p>
              </div>
            </div>
          )}
        </Panel>

        {/* Versions */}
        <Panel
          title="Versions"
          description="Newest first. A report never changes; its status tells you whether its inputs still hold."
          padded={false}
        >
          {projectReports.length === 0 ? (
            <div className="p-6">
              <EmptyState
                title="No reports for this project"
                body="Generate the first version above once the comparison has the inputs you need."
                icon="document"
              />
            </div>
          ) : (
            <ul className="divide-y divide-(--fbg-border-subtle)">
              {projectReports.map((r) => {
                const status = reportStatus(r, ctx);
                const active = r.id === selected?.id;
                return (
                  <li
                    key={r.id}
                    className={cx(
                      "flex flex-col gap-3 px-4 py-4 lg:flex-row lg:items-start lg:justify-between",
                      active && "bg-(--fbg-selected)",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedId(r.id)}
                      aria-pressed={active}
                      className="flex min-w-0 flex-1 flex-col gap-1 text-left"
                    >
                      <span className="flex min-w-0 flex-wrap items-center gap-2">
                        <span className="fbg-num text-sm font-medium break-all text-(--fbg-text-primary)">
                          {r.fileName}
                        </span>
                        <Badge
                          tone={r.state === "generating" ? "teal" : REPORT_STATE_TONE[status.state]}
                          icon={
                            r.state === "generating"
                              ? "clock"
                              : status.state === "stale"
                                ? "alert"
                                : null
                          }
                        >
                          {r.state === "generating"
                            ? "Generating"
                            : REPORT_STATE_LABEL[status.state]}
                        </Badge>
                      </span>
                      <span className="fbg-num text-xs text-(--fbg-text-secondary)">
                        Report v{r.version} · {FORMAT_LABEL[r.format]} · generated {r.generatedAt} ·
                        brief v{r.briefVersion} · {formatQty(r.quantity)} {project?.unit} · FX{" "}
                        {r.fxRateId} · {r.quotations.length} quotation
                        {r.quotations.length === 1 ? "" : "s"}
                      </span>
                      {status.reasons.length > 0 ? (
                        <span className="text-xs text-(--fbg-text-secondary)">
                          {status.reasons.join(" · ")}
                        </span>
                      ) : null}
                    </button>
                    <div className="flex min-w-0 flex-wrap gap-2 lg:shrink-0">
                      <Link href={viewHref(r)} className={buttonClasses("secondary", "sm")}>
                        View
                      </Link>
                      {r.state === "ready" && r.documentId ? (
                        <Button size="sm" icon="download" onClick={() => issueLink(r)}>
                          Get download link
                        </Button>
                      ) : null}
                      {status.state !== "current" && r.state === "ready" ? (
                        <Button size="sm" variant="ghost" onClick={() => regenerateFrom(r)}>
                          Regenerate with current data
                        </Button>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <div className="xl:hidden">
          {selected && project ? (
            <Panel title="Report facts">
              <ReportFacts
                report={selected}
                status={reportStatus(selected, ctx)}
                unit={project.unit}
              />
            </Panel>
          ) : null}
        </div>
      </div>
    </AppShell>
  );
}
