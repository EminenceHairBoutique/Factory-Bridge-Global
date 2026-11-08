"use client";

/**
 * Buyer workspace: one comparison report, rendered as the file would read (QUOTE_ENGINE_SPEC §5:
 * header, per-quotation rows grouped by trade term, footer) plus the five tabular exports of
 * ADR-024 with a CSV preview. Content is re-rendered from the report's recorded inputs; `id=live`
 * renders a version generated in the preview from the current comparison.
 */
import Link from "next/link";
import { useMemo, useState } from "react";
import { DEMO_AS_OF, DEMO_FX, DEMO_PROJECTS } from "../demo-data";
import {
  DEMO_REPORTS,
  FORMAT_LABEL,
  type ReportFormat,
  type ReportRecord,
} from "../demo-data/reports";
import { formatMoney, formatQty } from "../compare-demo";
import {
  REPORT_ENGINE_VERSION,
  REPORT_STATE_LABEL,
  REPORT_STATE_TONE,
  contentForReport,
  presentTotal,
  presentUnit,
  quotesForProject,
  reportFileName,
  reportStatus,
  toCsv,
  type ReportContext,
  type ReportQuote,
  type ReportTable,
} from "../reports-demo";
import { AppShell } from "../ui/AppShell";
import {
  Badge,
  Button,
  buttonClasses,
  EmptyState,
  Notice,
  PageHeader,
  Panel,
  Tabs,
  cx,
  type Tone,
} from "../ui/primitives";
import { ReportFacts } from "../ui/ReportFacts";

export const DEFAULT_REPORT_ID = "rep_1";

const LINE_TONE: Record<ReportQuote["landed"][number]["status"], Tone> = {
  sourced: "ok",
  estimated: "warn",
  missing: "danger",
  not_applicable: "neutral",
};

const LINE_LABEL: Record<ReportQuote["landed"][number]["status"], string> = {
  sourced: "Sourced",
  estimated: "Estimated",
  missing: "Missing",
  not_applicable: "n/a",
};

export interface LiveReportParams {
  version?: number | undefined;
  qty?: number | undefined;
  forwarder?: boolean | undefined;
  format?: ReportFormat | undefined;
}

/** A report generated in the preview is not stored; its content is rebuilt from the same inputs. */
function liveReport(params: LiveReportParams): ReportRecord | null {
  const project = DEMO_PROJECTS.find((p) => p.id === "prj_demo_labels");
  if (!project) return null;
  const format = params.format ?? "pdf";
  return {
    id: "live",
    projectId: project.id,
    version: params.version ?? 2,
    format,
    fileName: reportFileName(project.id, project.briefVersion, DEMO_AS_OF, format),
    generatedAt: `${DEMO_AS_OF} (preview)`,
    generatedBy: "System (requested by Demo Buyer) — simulated",
    briefVersion: project.briefVersion,
    quantity: params.qty ?? 10_000,
    asOf: DEMO_AS_OF,
    includeForwarder: params.forwarder ?? true,
    fxRateId: DEMO_FX.id,
    engineVersion: REPORT_ENGINE_VERSION,
    quotations: quotesForProject(project.id).map((q) => ({
      id: q.id,
      version: 1,
      supplier: q.supplier,
      confirmedAt: q.confirmedAt,
    })),
    documentId: null,
    state: "ready",
  };
}

export function BuyerReportView({ id, live }: { id: string; live: LiveReportParams }) {
  const report = useMemo(
    () => (id === "live" ? liveReport(live) : (DEMO_REPORTS.find((r) => r.id === id) ?? null)),
    [id, live],
  );
  const project = report ? DEMO_PROJECTS.find((p) => p.id === report.projectId) : undefined;
  const content = useMemo(() => (report ? contentForReport(report) : null), [report]);
  const [tab, setTab] = useState<"report" | "tables">("report");
  const [sheet, setSheet] = useState<ReportTable["name"]>("summary");
  const [linkIssued, setLinkIssued] = useState(false);

  if (!report || !project || !content) {
    return (
      <AppShell workspace="buyer" title="Report">
        <EmptyState
          title="No report with this id"
          body="Reports generated in this preview are not stored. Open the reports list to pick a version."
          icon="document"
          action={
            <Link href="/design-preview/buyer/reports" className={buttonClasses("secondary")}>
              Open reports
            </Link>
          }
        />
      </AppShell>
    );
  }

  const ctx: ReportContext = {
    currentBriefVersion: project.briefVersion,
    currentQuotes: quotesForProject(project.id).map((q) => ({
      id: q.id,
      supplier: q.supplier,
      confirmedAt: q.confirmedAt,
    })),
    newestReportId:
      id === "live" ? "live" : (DEMO_REPORTS.find((r) => r.projectId === project.id)?.id ?? null),
  };
  const status = reportStatus(report, ctx);
  const table = content.tables.find((t) => t.name === sheet) ?? content.tables[0];

  const rightRail = (
    <div className="flex flex-col gap-5 text-sm">
      <div>
        <p className="text-xs text-(--fbg-text-secondary)">Evidence drawer</p>
        <p className="text-[15px] font-semibold text-(--fbg-text-primary)">Reproducibility</p>
      </div>
      <ReportFacts report={report} status={status} unit={project.unit} />
    </div>
  );

  return (
    <AppShell workspace="buyer" title="Report" rightRail={rightRail}>
      <div className="flex flex-col gap-5">
        <PageHeader
          title={
            <span className="flex min-w-0 flex-wrap items-center gap-2">
              <span>Comparison report</span>
              <span className="fbg-num text-base font-normal text-(--fbg-text-secondary)">
                v{report.version}
              </span>
            </span>
          }
          lead={<span className="fbg-num break-all">{report.fileName}</span>}
          meta={
            <>
              <Badge
                tone={REPORT_STATE_TONE[status.state]}
                icon={status.state === "stale" ? "alert" : null}
              >
                {REPORT_STATE_LABEL[status.state]}
              </Badge>
              <Badge tone="neutral" icon={null}>
                {project.name}
              </Badge>
              <Badge tone="neutral" icon={null}>
                {FORMAT_LABEL[report.format]}
              </Badge>
            </>
          }
          actions={
            <div className="flex flex-wrap gap-2">
              <Link href="/design-preview/buyer/reports" className={buttonClasses("secondary")}>
                All reports
              </Link>
              <Link href="/design-preview/buyer/compare" className={buttonClasses("secondary")}>
                Open comparison
              </Link>
              {report.documentId ? (
                <Button variant="primary" icon="download" onClick={() => setLinkIssued(true)}>
                  Get download link
                </Button>
              ) : null}
            </div>
          }
        />

        {linkIssued ? (
          <Notice tone="ok" title="Signed link issued">
            It expires in 15 minutes and the issuance is written to the access log. The file is the
            stored report; it is not regenerated.
          </Notice>
        ) : null}

        {status.state !== "current" ? (
          <Notice
            tone={status.state === "stale" ? "warn" : "neutral"}
            title={
              status.state === "stale" ? "This report is stale" : "This report has been superseded"
            }
            action={
              <Link
                href="/design-preview/buyer/reports"
                className={buttonClasses("secondary", "sm")}
              >
                Generate a new version
              </Link>
            }
          >
            {status.reasons.join(". ")}. The file itself has not changed; what you see is what was
            generated.
          </Notice>
        ) : null}

        <Tabs
          label="Report views"
          value={tab}
          onChange={setTab}
          tabs={[
            { value: "report", label: "Report" },
            { value: "tables", label: "Export tables", count: content.tables.length },
          ]}
        />

        {tab === "report" ? <ReportSheet content={content} /> : null}

        {tab === "tables" ? (
          <Panel
            title="Tables in the XLSX workbook and the CSV ZIP"
            description="One sheet per table, one row per entity, no merged cells. Every row carries the quotation id, its confirmation date, the original currency and the FX row."
            padded={false}
          >
            <div className="flex flex-wrap gap-1 border-b border-(--fbg-border-subtle) p-3">
              {content.tables.map((t) => (
                <button
                  key={t.name}
                  type="button"
                  onClick={() => setSheet(t.name)}
                  aria-pressed={sheet === t.name}
                  className={cx(
                    "fbg-num h-8 rounded-(--fbg-radius-chip) border px-2.5 text-xs font-medium",
                    sheet === t.name
                      ? "border-(--fbg-action-primary) bg-(--fbg-selected) text-(--fbg-text-primary)"
                      : "border-(--fbg-border-subtle) text-(--fbg-text-secondary)",
                  )}
                >
                  {t.name} · {t.rows.length}
                </button>
              ))}
            </div>
            {table ? (
              <>
                <div className="fbg-scrollbar-thin overflow-x-auto">
                  <table className="fbg-num w-full min-w-[48rem] text-left text-xs">
                    <thead>
                      <tr className="border-b border-(--fbg-border-subtle) text-(--fbg-text-secondary)">
                        {table.columns.map((c) => (
                          <th
                            key={c}
                            scope="col"
                            className="px-3 py-2 font-medium whitespace-nowrap"
                          >
                            {c}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {table.rows.map((row, i) => (
                        <tr
                          key={i}
                          className="border-b border-(--fbg-border-subtle) align-top last:border-0"
                        >
                          {row.map((cell, j) => (
                            <td
                              key={j}
                              className="max-w-[24rem] px-3 py-2 text-(--fbg-text-primary)"
                            >
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="border-t border-(--fbg-border-subtle) p-3">
                  <p className="mb-2 text-xs font-semibold text-(--fbg-text-primary)">
                    CSV preview of {table.name}.csv
                  </p>
                  <pre className="fbg-scrollbar-thin max-h-64 overflow-auto rounded-(--fbg-radius-control) border border-(--fbg-border-subtle) bg-(--fbg-bg-canvas) p-3 font-mono text-[11px] leading-5 text-(--fbg-text-primary)">
                    {toCsv(table)}
                  </pre>
                  <p className="mt-2 text-xs text-(--fbg-text-secondary)">
                    Files are UTF-8 with a byte-order mark so Excel opens Chinese text correctly.
                    The CSV export is a ZIP of these five files; a single CSV cannot hold five
                    tables.
                  </p>
                </div>
              </>
            ) : null}
          </Panel>
        ) : null}
      </div>
    </AppShell>
  );
}

function ReportSheet({ content }: { content: ReturnType<typeof contentForReport> }) {
  if (!content) return null;
  const h = content.header;
  const ranked = content.groups.filter((g) => g.kind === "basis");
  const excluded = content.groups.find((g) => g.kind === "excluded");
  const byId = new Map(content.quotes.map((q) => [q.quotationId, q]));

  return (
    <article
      className="rounded-(--fbg-radius-card) border border-(--fbg-border-subtle) bg-(--fbg-bg-surface)"
      aria-label="Report as rendered"
    >
      <header className="border-b border-(--fbg-border-subtle) px-5 py-4 sm:px-8 sm:py-6">
        <p className="fbg-num text-[11px] text-(--fbg-text-secondary)">
          Factory Bridge Global · Comparison report · generated {h.generatedAt} · {h.engineVersion}
        </p>
        <h2 className="fbg-display mt-2 text-xl font-semibold text-(--fbg-text-primary) sm:text-2xl">
          {h.projectName}
        </h2>
        <dl className="fbg-num mt-3 grid gap-x-6 gap-y-2 text-xs sm:grid-cols-2 lg:grid-cols-3">
          <Fact label="Brief" value={`${h.projectId} · v${h.briefVersion}`} />
          <Fact label="Quantity" value={`${formatQty(h.quantity)} ${h.unit}`} />
          <Fact label="Destination" value={h.destination} />
          <Fact label="Generated" value={`${h.generatedAt} · ${h.generatedBy}`} />
          <Fact label="FX" value={`${h.fx.label} · ${h.fx.id}`} />
          <Fact
            label="Landed ranking"
            value={
              content.landedRanking.available
                ? "By landed total across trade terms"
                : content.counts.ranked > 1
                  ? `Not available: blocked by ${content.landedRanking.blockedBy.join(", ")}`
                  : "Not applicable"
            }
          />
        </dl>
      </header>

      <section className="px-5 py-4 sm:px-8 sm:py-6" aria-label="Ranked quotations">
        <h3 className="text-sm font-semibold text-(--fbg-text-primary)">
          Ranked quotations{" "}
          <span className="fbg-num font-normal text-(--fbg-text-secondary)">
            · {content.counts.ranked} in {content.counts.groups} trade-term group
            {content.counts.groups === 1 ? "" : "s"}
          </span>
        </h3>
        <p className="mt-1 text-xs text-(--fbg-text-secondary)">
          Within a group the order is goods plus one-time fees in USD for the quantity. Groups are
          not compared with each other unless every landed total is complete.
        </p>
        {ranked.length === 0 ? (
          <p className="mt-3 text-sm text-(--fbg-text-secondary)">No quotation is ranked.</p>
        ) : (
          ranked.map((g) => (
            <div key={g.title} className="mt-4">
              <p className="fbg-num text-xs font-semibold tracking-wide text-(--fbg-text-primary)">
                {g.title} · {g.quotationIds.length}
              </p>
              <div className="mt-2 flex flex-col gap-3">
                {g.quotationIds.map((qid) => {
                  const q = byId.get(qid);
                  return q ? <QuoteBlock key={qid} q={q} quantity={h.quantity} /> : null;
                })}
              </div>
            </div>
          ))
        )}
      </section>

      {excluded && excluded.quotationIds.length > 0 ? (
        <section
          className="border-t border-(--fbg-border-subtle) px-5 py-4 sm:px-8 sm:py-6"
          aria-label="Not ranked"
        >
          <h3 className="text-sm font-semibold text-(--fbg-text-primary)">
            Not ranked{" "}
            <span className="fbg-num font-normal text-(--fbg-text-secondary)">
              · {excluded.quotationIds.length}
            </span>
          </h3>
          <ul className="mt-2 flex flex-col gap-2">
            {excluded.quotationIds.map((qid) => {
              const q = byId.get(qid);
              return q ? (
                <li
                  key={qid}
                  className="flex flex-col gap-0.5 text-sm sm:flex-row sm:items-baseline sm:gap-3"
                >
                  <span className="font-medium text-(--fbg-text-primary)">{q.supplier}</span>
                  <span className="text-(--fbg-text-secondary)">{q.exclusion}</span>
                  <span className="fbg-num text-xs text-(--fbg-text-secondary)">
                    {q.quotationId} v{q.version} · {q.sourceRef} · confirmed {q.confirmedAt}
                  </span>
                </li>
              ) : null;
            })}
          </ul>
        </section>
      ) : null}

      <footer className="border-t border-(--fbg-border-subtle) px-5 py-4 sm:px-8 sm:py-6">
        <div className="grid gap-5 lg:grid-cols-2">
          <div>
            <h3 className="text-sm font-semibold text-(--fbg-text-primary)">Assumptions</h3>
            <ul className="mt-2 list-disc pl-4 text-xs text-(--fbg-text-secondary)">
              {content.footer.assumptions.map((a) => (
                <li key={a} className="mb-1">
                  {a}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-(--fbg-text-primary)">Exclusions</h3>
            {content.footer.exclusions.length === 0 ? (
              <p className="mt-2 text-xs text-(--fbg-text-secondary)">None.</p>
            ) : (
              <ul className="mt-2 list-disc pl-4 text-xs text-(--fbg-text-secondary)">
                {content.footer.exclusions.map((x) => (
                  <li key={x} className="mb-1">
                    {x}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <p className="mt-4 text-xs text-(--fbg-text-secondary)">{content.footer.roundingRule}</p>
        <ul className="mt-2 flex flex-col gap-0.5 text-xs text-(--fbg-text-secondary)">
          {content.footer.disclaimers.map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ul>
      </footer>
    </article>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-(--fbg-text-secondary)">{label}</dt>
      <dd className="break-words text-(--fbg-text-primary)">{value}</dd>
    </div>
  );
}

function QuoteBlock({ q, quantity }: { q: ReportQuote; quantity: number }) {
  return (
    <div className="rounded-(--fbg-radius-control) border border-(--fbg-border-subtle) p-3 sm:p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-semibold text-(--fbg-text-primary)">
          {q.rankInGroup !== null ? (
            <span className="fbg-num mr-2 text-(--fbg-text-secondary)">{q.rankInGroup}.</span>
          ) : null}
          {q.supplier}
        </p>
        <p className="fbg-num text-xs text-(--fbg-text-secondary)">
          {q.quotationId} v{q.version} · confirmed {q.confirmedAt} ·{" "}
          {q.validUntil ? `valid until ${q.validUntil}` : "validity unconfirmed"}
        </p>
      </div>
      <dl className="fbg-num mt-2 grid gap-x-6 gap-y-2 text-xs sm:grid-cols-2 lg:grid-cols-4">
        <Fact label="Source" value={`${q.sourceRef} (${q.sourceType.replace(/_/g, " ")})`} />
        <Fact label="Basis" value={q.basisPlace ? `${q.basis} ${q.basisPlace}` : q.basis} />
        <Fact
          label="Selected tier"
          value={
            q.tierLabel && q.unitPriceOriginal !== null
              ? `${q.tierLabel} @ ${q.currency} ${presentUnit(q.unitPriceOriginal)} per ${q.currency === "CNY" ? "pc" : "pc"}`
              : "No tier covers the quantity"
          }
        />
        <Fact
          label={`Goods for ${formatQty(quantity)}`}
          value={
            q.goodsOriginal !== null && q.goodsUsd !== null
              ? `${formatMoney(q.goodsOriginal, q.currency)} · USD ${presentTotal(q.goodsUsd)}`
              : "—"
          }
        />
        <Fact
          label="One-time fees"
          value={
            q.oneTimeFeesOriginal > 0 ? formatMoney(q.oneTimeFeesOriginal, q.currency) : "None"
          }
        />
        <Fact
          label="Goods + fees (USD, ordering key)"
          value={q.comparableGoodsUsd !== null ? presentTotal(q.comparableGoodsUsd) : "—"}
        />
        <Fact
          label="Landed total (USD)"
          value={
            q.landedStatus === "complete" && q.landedTotalUsd !== null
              ? presentTotal(q.landedTotalUsd)
              : `Partial — excludes ${q.missingLines.join(", ").toLowerCase()}`
          }
        />
        <Fact label="Flags" value={q.flags.length > 0 ? q.flags.join("; ") : "None"} />
      </dl>
      {q.specDifferences.length > 0 ? (
        <p className="mt-2 text-xs text-(--fbg-text-secondary)">
          Differs from the brief (still comparable): {q.specDifferences.join("; ")}
        </p>
      ) : null}
      <ul className="mt-3 grid gap-1 text-xs sm:grid-cols-2 lg:grid-cols-3">
        {q.landed
          .filter((l) => l.status !== "not_applicable")
          .map((l) => (
            <li
              key={l.type}
              className="flex min-w-0 items-center justify-between gap-2 rounded border border-(--fbg-border-subtle) px-2 py-1"
            >
              <span
                className="min-w-0 truncate text-(--fbg-text-primary)"
                title={l.source ?? undefined}
              >
                {l.label}
              </span>
              <span className="flex shrink-0 items-center gap-1.5">
                <span className="fbg-num text-(--fbg-text-primary)">
                  {l.amountUsd === null ? "—" : presentTotal(l.amountUsd)}
                </span>
                <Badge tone={LINE_TONE[l.status]} icon={null}>
                  {LINE_LABEL[l.status]}
                </Badge>
              </span>
            </li>
          ))}
      </ul>
    </div>
  );
}
