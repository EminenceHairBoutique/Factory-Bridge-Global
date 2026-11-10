"use client";

/**
 * Project overview — RecordPage (IA §2.2 `/app/projects/[id]`, §3; SCREEN_INVENTORY §3.1).
 * Header with stage strip, operator and next action; tabs Overview · Brief · Supplier options · Compare ·
 * Documents · Messages · Reports · Activity; evidence drawer with brief versions and record facts.
 * Local state only; synthetic data.
 */
import Link from "next/link";
import { useMemo, useState } from "react";
import { DEMO_AS_OF, DEMO_PROJECTS, DEMO_QUOTES, STAGE_LABEL, STAGE_ORDER } from "../demo-data";
import {
  DOCUMENT_STATUS_LABEL,
  PROJECT_ACTIVITY,
  PROJECT_BRIEF_SUMMARY,
  PROJECT_DOCUMENTS,
  PROJECT_ID,
  PROJECT_TIMELINE,
  type ProjectDocument,
} from "../demo-data/project";
import { compareQuotes, formatQty } from "../compare-demo";
import type { ProjectTab } from "../projects-demo";
import { DEMO_REPORTS } from "../demo-data/reports";
import { DEMO_THREADS, THREAD_KIND_LABEL } from "../demo-data/messages";
import {
  THREAD_STATUS_LABEL,
  THREAD_STATUS_TONE,
  approvalChain,
  lastActivity,
  needsYou,
  sortThreads,
  threadStatus,
} from "../messages-demo";
import { ApprovalChainChips } from "../ui/ApprovalChain";
import {
  REPORT_STATE_LABEL,
  REPORT_STATE_TONE,
  contentForReport,
  reportStatus,
  type ReportContext,
} from "../reports-demo";
import { AppShell } from "../ui/AppShell";
import { Icon, type IconName } from "../ui/icons";
import {
  Badge,
  Button,
  EmptyState,
  EvidenceBadge,
  FreshnessChip,
  Notice,
  PageHeader,
  Panel,
  Tabs,
  buttonClasses,
  cx,
  type Tone,
} from "../ui/primitives";

/** Tab ids are shared with the route's `?tab=` deep link (projects-demo.ts). */
type Tab = ProjectTab;

const DOC_TONE: Record<ProjectDocument["status"], Tone> = {
  uploaded: "neutral",
  scanning: "neutral",
  rejected: "danger",
  parsed: "neutral",
  extracted: "teal",
  in_review: "warn",
  accepted: "ok",
  discarded: "neutral",
};

const DOC_ICON: Record<ProjectDocument["kind"], IconName> = {
  quote: "document",
  artwork: "camera",
  logistics: "truck",
  report: "download",
};

const PROJECT_REPORT_ROWS = DEMO_REPORTS.filter((r) => r.projectId === PROJECT_ID).sort(
  (a, b) => b.version - a.version,
);
const PROJECT_UNIT = DEMO_PROJECTS.find((p) => p.id === PROJECT_ID)?.unit ?? "pcs";
const REPORT_CTX: ReportContext = {
  currentBriefVersion: DEMO_PROJECTS.find((p) => p.id === PROJECT_ID)?.briefVersion ?? 0,
  currentQuotes: DEMO_QUOTES.map((q) => ({
    id: q.id,
    supplier: q.supplier,
    confirmedAt: q.confirmedAt,
  })),
  newestReportId: PROJECT_REPORT_ROWS[0]?.id ?? null,
};

const PROJECT_THREADS = DEMO_THREADS.filter((t) => t.projectId === PROJECT_ID);

const ACTING_TONE: Record<string, Tone> = {
  user: "teal",
  operator: "ink",
  system: "neutral",
  platform_admin: "brand",
};

export function ProjectOverview({ initialTab = "overview" }: { initialTab?: ProjectTab }) {
  const project = DEMO_PROJECTS[0] ?? {
    name: "Sourcing project",
    family: "Labels",
    stage: "comparison_ready" as const,
    quantity: 10_000,
    unit: "pcs",
    destination: "—",
    operator: "Unassigned",
    briefVersion: 3,
    updatedAt: DEMO_AS_OF,
    quotes: { confirmed: 0, inReview: 0, expiringSoon: 0 },
    nextAction: "",
    id: "prj_demo_labels",
  };
  const [tab, setTab] = useState<Tab>(initialTab);
  const [docFilter, setDocFilter] = useState<"all" | "quote" | "artwork" | "logistics" | "report">(
    "all",
  );

  const comparison = useMemo(
    () => compareQuotes(DEMO_QUOTES, project.quantity, DEMO_AS_OF, {}),
    [project.quantity],
  );
  const included = comparison.groups.filter((g) => g.kind === "basis").flatMap((g) => g.quotes);
  const excluded = comparison.groups.find((g) => g.kind === "excluded")?.quotes ?? [];
  const stageIndex = STAGE_ORDER.indexOf(project.stage);
  const awaitingYou = PROJECT_THREADS.filter((t) => needsYou(t)).length;
  const inReviewDocs = PROJECT_DOCUMENTS.filter((d) => d.status === "in_review").length;

  const rightRail = (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-xs text-(--fbg-text-secondary)">Evidence drawer</p>
        <h2 className="text-[15px] font-semibold text-(--fbg-text-primary)">Project record</h2>
      </div>
      <dl className="grid grid-cols-[6.5rem_1fr] gap-x-2 gap-y-1.5 text-sm">
        <dt className="text-(--fbg-text-secondary)">Project id</dt>
        <dd className="fbg-num text-(--fbg-text-primary)">{project.id}</dd>
        <dt className="text-(--fbg-text-secondary)">Organization</dt>
        <dd className="text-(--fbg-text-primary)">Demo Buyer Co.</dd>
        <dt className="text-(--fbg-text-secondary)">Operator</dt>
        <dd className="text-(--fbg-text-primary)">{project.operator}</dd>
        <dt className="text-(--fbg-text-secondary)">Assigned</dt>
        <dd className="fbg-num text-(--fbg-text-primary)">2026-11-04</dd>
        <dt className="text-(--fbg-text-secondary)">Updated</dt>
        <dd className="fbg-num text-(--fbg-text-primary)">{project.updatedAt}</dd>
      </dl>
      <div>
        <p className="text-xs font-medium text-(--fbg-text-primary)">Brief versions</p>
        <ol className="mt-1.5 flex flex-col gap-1.5 text-sm">
          {[
            ["1", "Raw input", "2026-11-03 10:15", "Demo Buyer"],
            ["2", "AI proposal", "2026-11-03 10:16", "brief_normalizer v1.0.0"],
            ["3", "Confirmed (current)", "2026-11-04 09:40", "Demo Buyer"],
          ].map(([v, label, at, by]) => (
            <li key={v} className="flex gap-2">
              <span className="fbg-num flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-(--fbg-hover) text-[11px] font-semibold">
                {v}
              </span>
              <span className="min-w-0">
                <span className="block text-(--fbg-text-primary)">{label}</span>
                <span className="fbg-num block text-xs text-(--fbg-text-secondary)">
                  {at} · {by}
                </span>
              </span>
            </li>
          ))}
        </ol>
        <Link
          href="/design-preview/buyer/brief"
          className="mt-2 inline-block text-sm font-medium text-(--fbg-link) hover:underline"
        >
          See how brief confirmation works
        </Link>
      </div>
      <div>
        <p className="text-xs font-medium text-(--fbg-text-primary)">
          Approval gates on this project
        </p>
        <ul className="mt-1.5 flex flex-col gap-1 text-sm text-(--fbg-text-secondary)">
          <li className="flex gap-2">
            <Icon name="check" size={14} className="mt-0.5 text-(--fbg-status-success)" /> Outbound
            RFQ approved 2026-11-04
          </li>
          <li className="flex gap-2">
            <Icon name="check" size={14} className="mt-0.5 text-(--fbg-status-success)" /> Sample
            approved 2026-10-28
          </li>
          <li className="flex gap-2">
            <Icon name="clock" size={14} className="mt-0.5 text-(--fbg-status-warning)" />{" "}
            Clarification draft: your approval
          </li>
          <li className="flex gap-2">
            <Icon name="lock" size={14} className="mt-0.5" /> Supplier selection and handoff: not
            started
          </li>
        </ul>
      </div>
    </div>
  );

  return (
    <AppShell workspace="buyer" title="Project" rightRail={rightRail}>
      <div className="flex flex-col gap-5">
        <PageHeader
          title={project.name}
          lead={`${project.family} · ${formatQty(project.quantity)} ${project.unit} to ${project.destination}. Every step below was taken by a person or recorded by the system with a timestamp.`}
          meta={
            <>
              <Badge tone="teal" icon="check" className="fbg-num">
                Brief v{project.briefVersion} confirmed 2026-11-04
              </Badge>
              <Badge tone="ink" icon="user">
                Operator: {project.operator}
              </Badge>
              <Badge tone="neutral" icon="clock" className="fbg-num">
                As of {DEMO_AS_OF}
              </Badge>
            </>
          }
          actions={
            <>
              <Link
                href="/design-preview/buyer/documents#upload"
                className={buttonClasses("secondary")}
              >
                <Icon name="upload" size={16} />
                Upload a quote
              </Link>
              <Link href="/design-preview/buyer/compare" className={buttonClasses("primary")}>
                <Icon name="compare" size={16} />
                Open comparison
              </Link>
            </>
          }
        />

        {/* Stage strip */}
        <div>
          <div className="flex gap-1" aria-hidden>
            {STAGE_ORDER.map((s, i) => (
              <span
                key={s}
                className={cx(
                  "h-2 flex-1 rounded-sm",
                  i < stageIndex
                    ? "bg-(--fbg-action-primary)"
                    : i === stageIndex
                      ? "bg-(--fbg-bg-inverse)"
                      : "bg-(--fbg-border-subtle)",
                )}
              />
            ))}
          </div>
          <p className="fbg-num mt-1.5 text-sm text-(--fbg-text-secondary)">
            <span className="text-(--fbg-text-primary)">{STAGE_LABEL[project.stage]}</span> · stage{" "}
            {stageIndex + 1} of {STAGE_ORDER.length}
          </p>
        </div>

        <Tabs
          label="Project sections"
          value={tab}
          onChange={setTab}
          tabs={[
            { value: "overview", label: "Overview" },
            { value: "brief", label: "Brief" },
            { value: "options", label: "Supplier options", count: DEMO_QUOTES.length },
            { value: "compare", label: "Compare" },
            { value: "documents", label: "Documents", count: PROJECT_DOCUMENTS.length },
            { value: "messages", label: "Messages", count: awaitingYou || undefined },
            { value: "reports", label: "Reports", count: PROJECT_REPORT_ROWS.length },
            { value: "quality", label: "Quality", count: 1 },
            { value: "activity", label: "Activity" },
          ]}
        />

        {tab === "overview" ? (
          <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
            <div className="flex flex-col gap-4">
              <Panel title="Next action" raised>
                <p className="text-[15px] font-medium text-(--fbg-text-primary)">
                  {project.nextAction}
                </p>
                <p className="mt-1 text-sm text-(--fbg-text-secondary)">
                  {included.length} quotes are eligible at {formatQty(project.quantity)}{" "}
                  {project.unit}; {excluded.length} are shown but not ranked. Supplier A's quote
                  expires 2026-12-15. Cross-group ranking needs freight and duty inputs.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link
                    href="/design-preview/buyer/compare"
                    className={buttonClasses("primary", "sm")}
                  >
                    Open comparison
                  </Link>
                  {awaitingYou > 0 ? (
                    <Button size="sm" icon="message" onClick={() => setTab("messages")}>
                      Approve {awaitingYou} draft{awaitingYou === 1 ? "" : "s"}
                    </Button>
                  ) : null}
                  {inReviewDocs > 0 ? (
                    <Button size="sm" icon="eye" onClick={() => setTab("documents")}>
                      {inReviewDocs} document in review
                    </Button>
                  ) : null}
                </div>
              </Panel>

              <Panel
                title="Status timeline"
                description="Who did what, and when. Pending steps say what unlocks them."
                padded={false}
              >
                <ol className="divide-y divide-(--fbg-border-subtle)">
                  {PROJECT_TIMELINE.map((s) => (
                    <li key={s.key} className="flex gap-3 px-5 py-3">
                      <span
                        className={cx(
                          "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border",
                          s.state === "done"
                            ? "border-(--fbg-action-primary) bg-(--fbg-action-primary) text-(--fbg-action-on-primary)"
                            : s.state === "current"
                              ? "border-(--fbg-bg-inverse) bg-(--fbg-bg-inverse) text-(--fbg-text-inverse)"
                              : "border-(--fbg-border-strong)/60 text-(--fbg-text-secondary)",
                        )}
                        aria-hidden
                      >
                        {s.state === "done" ? (
                          <Icon name="check" size={12} />
                        ) : s.state === "current" ? (
                          <Icon name="clock" size={12} />
                        ) : null}
                      </span>
                      <div className="min-w-0">
                        <p
                          className={cx(
                            "text-sm font-medium",
                            s.state === "pending"
                              ? "text-(--fbg-text-secondary)"
                              : "text-(--fbg-text-primary)",
                          )}
                        >
                          {s.label}
                          {s.state === "current" ? (
                            <Badge tone="ink" icon={null} className="ml-2">
                              current
                            </Badge>
                          ) : null}
                        </p>
                        {s.at ? (
                          <p className="fbg-num text-xs text-(--fbg-text-secondary)">
                            {s.at} · {s.by}
                          </p>
                        ) : null}
                        <p className="mt-0.5 text-xs text-(--fbg-text-secondary)">{s.detail}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </Panel>
            </div>

            <div className="flex flex-col gap-4">
              <Panel
                title="Quotes at a glance"
                description="Statuses come from the quote records; nothing is ranked on unit price alone."
                padded={false}
              >
                <ul className="divide-y divide-(--fbg-border-subtle)">
                  {[...included, ...excluded].map((e) => (
                    <li
                      key={e.quote.id}
                      className="flex items-start justify-between gap-3 px-5 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-(--fbg-text-primary)">
                          {e.quote.supplier}
                        </p>
                        <p className="text-xs text-(--fbg-text-secondary)">
                          {e.quote.priceBasis} {e.quote.basisPlace} · {e.quote.currency}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        {e.exclusion ? (
                          <Badge tone={e.exclusion.code === "expired" ? "danger" : "warn"}>
                            {e.exclusion.code === "expired"
                              ? `Expired ${e.exclusion.date}`
                              : e.exclusion.code === "below_moq"
                                ? `Below MOQ (${formatQty(e.exclusion.moq)})`
                                : e.exclusion.code === "hard_mismatch"
                                  ? "Specification differs"
                                  : e.exclusion.code === "basis_unknown"
                                    ? "Basis not stated"
                                    : "No tier covers quantity"}
                          </Badge>
                        ) : e.quote.validUntil ? (
                          <FreshnessChip kind="valid_until" date={e.quote.validUntil} />
                        ) : (
                          <Badge tone="warn">Validity unconfirmed</Badge>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </Panel>

              <Panel title="Open items">
                <ul className="flex flex-col gap-2 text-sm">
                  <li className="flex items-start gap-2">
                    <Icon
                      name="message"
                      size={14}
                      className="mt-0.5 shrink-0 text-(--fbg-status-warning)"
                    />
                    <span className="text-(--fbg-text-primary)">
                      Clarification to Supplier B waits for your approval before an operator sends
                      it.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Icon
                      name="eye"
                      size={14}
                      className="mt-0.5 shrink-0 text-(--fbg-status-warning)"
                    />
                    <span className="text-(--fbg-text-primary)">
                      Supplier H's quote is in extraction review; it joins the comparison once
                      accepted.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Icon
                      name="clock"
                      size={14}
                      className="mt-0.5 shrink-0 text-(--fbg-text-secondary)"
                    />
                    <span className="text-(--fbg-text-primary)">
                      Supplier A quote valid until 2026-12-15; ask for revalidation if ordering
                      later.
                    </span>
                  </li>
                </ul>
              </Panel>
            </div>
          </div>
        ) : null}

        {tab === "brief" ? (
          <Panel
            title={`Confirmed brief v${PROJECT_BRIEF_SUMMARY.version}`}
            description={`Confirmed ${PROJECT_BRIEF_SUMMARY.confirmedAt} by Demo Buyer. Hard attributes are used for exact matching; editing creates a new version.`}
            actions={
              <Link href="/design-preview/buyer/brief" className={buttonClasses("secondary", "sm")}>
                Open brief confirmation
              </Link>
            }
          >
            <div className="grid gap-6 md:grid-cols-3">
              <div>
                <p className="text-xs font-medium text-(--fbg-text-primary)">Hard attributes</p>
                <dl className="mt-2 flex flex-col gap-2">
                  {PROJECT_BRIEF_SUMMARY.hard.map(([k, v, zh]) => (
                    <div key={k}>
                      <dt className="text-xs text-(--fbg-text-secondary)">{k}</dt>
                      <dd className="fbg-num text-sm text-(--fbg-text-primary)">{v}</dd>
                      <dd className="fbg-zh text-xs text-(--fbg-text-secondary)" lang="zh-CN">
                        {zh}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
              <div>
                <p className="text-xs font-medium text-(--fbg-text-primary)">Soft attributes</p>
                <dl className="mt-2 flex flex-col gap-2">
                  {PROJECT_BRIEF_SUMMARY.soft.map(([k, v, zh]) => (
                    <div key={k}>
                      <dt className="text-xs text-(--fbg-text-secondary)">{k}</dt>
                      <dd className="fbg-num text-sm text-(--fbg-text-primary)">{v}</dd>
                      <dd className="fbg-zh text-xs text-(--fbg-text-secondary)" lang="zh-CN">
                        {zh}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
              <div>
                <p className="text-xs font-medium text-(--fbg-text-primary)">Quantity and terms</p>
                <dl className="mt-2 flex flex-col gap-2">
                  {PROJECT_BRIEF_SUMMARY.terms.map(([k, v]) => (
                    <div key={k}>
                      <dt className="text-xs text-(--fbg-text-secondary)">{k}</dt>
                      <dd className="fbg-num text-sm text-(--fbg-text-primary)">{v}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
          </Panel>
        ) : null}

        {tab === "options" ? (
          <Panel
            title="Supplier options"
            description="From the authorized catalog and direct contact. Badges come from check records; contacts stay hidden without a disclosure grant."
            padded={false}
          >
            <ul className="divide-y divide-(--fbg-border-subtle)">
              {DEMO_QUOTES.map((q) => (
                <li
                  key={q.id}
                  className="flex flex-col gap-2 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="text-[15px] font-medium text-(--fbg-text-primary)">
                      {q.supplier}{" "}
                      <span className="font-normal text-(--fbg-text-secondary)">· {q.city}</span>
                    </p>
                    <p className="fbg-num text-sm text-(--fbg-text-secondary)">
                      {q.priceBasis === "unknown"
                        ? "Price basis not stated"
                        : `${q.priceBasis} ${q.basisPlace}`}{" "}
                      · {q.currency} · MOQ {q.moq !== null ? formatQty(q.moq) : "—"} ·{" "}
                      {q.sourceType.replace(/_/g, " ")}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {q.evidence.length === 0 ? (
                      <Badge tone="neutral" icon="info">
                        No verification record yet
                      </Badge>
                    ) : (
                      q.evidence.map((e) => (
                        <EvidenceBadge
                          key={e.label}
                          label={e.label}
                          tone={e.label.startsWith("Sample") ? "teal" : "ok"}
                          evidence={e}
                        />
                      ))
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </Panel>
        ) : null}

        {tab === "compare" ? (
          <Panel
            title="Comparison"
            description="The full matrix with landed-cost inputs lives on its own screen."
          >
            <div className="grid gap-4 md:grid-cols-3">
              {comparison.groups.map((g) => (
                <div
                  key={g.key}
                  className="rounded-(--fbg-radius-card) border border-(--fbg-border-subtle) p-4"
                >
                  <p className="text-sm font-medium text-(--fbg-text-primary)">
                    {g.kind === "excluded" ? "Not ranked" : g.title}
                  </p>
                  <p className="fbg-num mt-1 text-sm text-(--fbg-text-secondary)">
                    {g.quotes.length} {g.quotes.length === 1 ? "quote" : "quotes"}
                  </p>
                  <ul className="mt-2 text-xs text-(--fbg-text-secondary)">
                    {g.quotes.map((e) => (
                      <li key={e.quote.id}>{e.quote.supplier}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <div className="mt-4">
              <Notice tone="warn" title="Cross-group ranking unavailable">
                Required landed-cost lines are missing for{" "}
                {comparison.landedRankingBlockedBy.join(", ")}. Add a freight estimate and a duty
                assumption in a landed-cost scenario.
              </Notice>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href="/design-preview/buyer/compare" className={buttonClasses("primary")}>
                Open comparison
              </Link>
              <Link href="/design-preview/buyer/landed-cost" className={buttonClasses("secondary")}>
                Landed cost scenarios
              </Link>
            </div>
          </Panel>
        ) : null}

        {tab === "documents" ? (
          <Panel
            title="Documents"
            description="Status follows the pipeline: uploaded → scanning → parsed → extracted → in review → accepted. Signed links expire within 15 minutes."
            padded={false}
            actions={
              <div className="flex flex-wrap gap-1">
                {(["all", "quote", "artwork", "logistics", "report"] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setDocFilter(k)}
                    aria-pressed={docFilter === k}
                    className={cx(
                      "h-8 rounded-(--fbg-radius-chip) border px-2.5 text-xs font-medium",
                      docFilter === k
                        ? "border-(--fbg-action-primary) bg-(--fbg-selected) text-(--fbg-text-primary)"
                        : "border-(--fbg-border-subtle) text-(--fbg-text-secondary)",
                    )}
                  >
                    {k === "all" ? "All" : k[0]?.toUpperCase() + k.slice(1)}
                  </button>
                ))}
              </div>
            }
          >
            <ul className="divide-y divide-(--fbg-border-subtle)">
              {PROJECT_DOCUMENTS.filter((d) => docFilter === "all" || d.kind === docFilter).map(
                (d) => (
                  <li
                    key={d.id}
                    className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <Icon
                        name={DOC_ICON[d.kind]}
                        size={18}
                        className="mt-0.5 shrink-0 text-(--fbg-text-secondary)"
                      />
                      <div className="min-w-0">
                        <p className="fbg-num text-sm font-medium text-(--fbg-text-primary)">
                          {d.name}
                        </p>
                        <p className="fbg-num text-xs text-(--fbg-text-secondary)">
                          {d.source.replace(/_/g, " ")} · {d.owner} · {d.uploadedAt} · {d.version}
                        </p>
                        {d.linked ? (
                          <p className="text-xs text-(--fbg-text-secondary)">{d.linked}</p>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      <Badge tone={DOC_TONE[d.status]}>{DOCUMENT_STATUS_LABEL[d.status]}</Badge>
                      {d.status === "in_review" ? (
                        <Link
                          href="/design-preview/buyer/review?doc=d_quote_h"
                          className={buttonClasses("secondary", "sm")}
                        >
                          Open review
                        </Link>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          icon="download"
                          title="Signed link issued server-side and logged (B-10)"
                        >
                          Download
                        </Button>
                      )}
                    </div>
                  </li>
                ),
              )}
            </ul>
            <div className="flex flex-wrap gap-2 border-t border-(--fbg-border-subtle) px-5 py-3">
              <Link
                href="/design-preview/buyer/documents"
                className={buttonClasses("secondary", "sm")}
              >
                Upload a document
              </Link>
              <Link href="/design-preview/buyer/documents" className={buttonClasses("ghost", "sm")}>
                All documents
              </Link>
            </div>
          </Panel>
        ) : null}

        {tab === "messages" ? (
          <Panel
            title="Messages and approvals"
            description="Every outbound message shows its approval chain. Nothing is sent to a supplier until the chain is complete."
            padded={false}
            actions={
              <Link
                href="/design-preview/buyer/messages"
                className={buttonClasses("secondary", "sm")}
              >
                Open inbox
              </Link>
            }
          >
            <ul className="divide-y divide-(--fbg-border-subtle)">
              {sortThreads(PROJECT_THREADS).map((t) => {
                const status = threadStatus(t);
                const last = t.messages[t.messages.length - 1];
                const lastOutbound = [...t.messages]
                  .reverse()
                  .find((m) => m.direction === "outbound");
                const chain = lastOutbound?.approval
                  ? approvalChain(lastOutbound.approval, lastOutbound.channel)
                  : [];
                return (
                  <li key={t.id} className="flex flex-col gap-3 px-5 py-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[15px] font-medium text-(--fbg-text-primary)">
                          {t.subject}
                        </p>
                        <p className="fbg-num text-xs text-(--fbg-text-secondary)">
                          {t.supplier?.name ?? "System"} · {THREAD_KIND_LABEL[t.kind]} ·{" "}
                          {lastActivity(t)}
                        </p>
                      </div>
                      <Badge tone={THREAD_STATUS_TONE[status]}>{THREAD_STATUS_LABEL[status]}</Badge>
                    </div>
                    {last ? (
                      <div className="rounded-(--fbg-radius-control) border border-(--fbg-border-subtle) bg-(--fbg-bg-canvas) p-3 text-sm">
                        <p className="text-(--fbg-text-primary)">{last.en}</p>
                        {last.zh ? (
                          <p className="fbg-zh mt-1 text-(--fbg-text-secondary)" lang="zh-CN">
                            {last.zh}
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                    {chain.length > 0 ? <ApprovalChainChips steps={chain} /> : null}
                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={`/design-preview/buyer/messages?thread=${t.id}`}
                        className={buttonClasses(
                          status === "awaiting_your_approval" ? "primary" : "secondary",
                          "sm",
                        )}
                      >
                        {status === "awaiting_your_approval" ? "Review and approve" : "Open thread"}
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Panel>
        ) : null}

        {tab === "reports" ? (
          <Panel
            title="Reports"
            description="Each report is a snapshot of the brief version, quantity, FX row and exact quotation versions it used. Reports never change; new inputs mean a new version."
            padded={false}
            actions={
              <Link
                href="/design-preview/buyer/reports"
                className={buttonClasses("secondary", "sm")}
              >
                All reports
              </Link>
            }
          >
            {PROJECT_REPORT_ROWS.length === 0 ? (
              <div className="p-5">
                <EmptyState
                  title="No reports yet"
                  body="Generate one from the Reports screen once the comparison has the inputs you need."
                />
              </div>
            ) : (
              <ul className="divide-y divide-(--fbg-border-subtle)">
                {PROJECT_REPORT_ROWS.map((r) => {
                  const status = reportStatus(r, REPORT_CTX);
                  const content = contentForReport(r);
                  return (
                    <li key={r.id} className="flex flex-col gap-3 px-5 py-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="fbg-num text-sm font-medium break-all text-(--fbg-text-primary)">
                            {r.fileName}
                          </p>
                          <p className="fbg-num text-xs text-(--fbg-text-secondary)">
                            Report v{r.version} · generated {r.generatedAt} · brief v
                            {r.briefVersion} · {formatQty(r.quantity)} {PROJECT_UNIT} · FX{" "}
                            {r.fxRateId}
                            {content
                              ? ` · ${content.counts.ranked} ranked, ${content.counts.notRanked} not ranked`
                              : ""}
                          </p>
                        </div>
                        <Badge
                          tone={REPORT_STATE_TONE[status.state]}
                          icon={status.state === "stale" ? "alert" : null}
                        >
                          {REPORT_STATE_LABEL[status.state]}
                        </Badge>
                      </div>
                      {status.reasons.length > 0 ? (
                        <p className="text-xs text-(--fbg-text-secondary)">
                          {status.reasons.join(" · ")}
                        </p>
                      ) : null}
                      {content ? (
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <p className="text-xs font-medium text-(--fbg-text-primary)">
                              Assumptions
                            </p>
                            <ul className="mt-1 list-disc pl-4 text-xs text-(--fbg-text-secondary)">
                              {content.footer.assumptions.slice(0, 3).map((a) => (
                                <li key={a}>{a}</li>
                              ))}
                            </ul>
                          </div>
                          <div>
                            <p className="text-xs font-medium text-(--fbg-text-primary)">
                              Exclusions
                            </p>
                            <ul className="mt-1 list-disc pl-4 text-xs text-(--fbg-text-secondary)">
                              {content.footer.exclusions.map((x) => (
                                <li key={x}>{x}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      ) : null}
                      <div className="flex flex-wrap gap-2">
                        <Link
                          href={`/design-preview/buyer/report?id=${r.id}`}
                          className={buttonClasses("primary", "sm")}
                        >
                          View report
                        </Link>
                        <Link
                          href="/design-preview/buyer/reports"
                          className={buttonClasses("secondary", "sm")}
                        >
                          Generate a new version
                        </Link>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        ) : null}

        {tab === "quality" ? (
          <Panel
            title="Samples and inspections"
            description="Exactly what was checked for each supplier, by whom and when. Decisions after a failed inspection are yours."
          >
            <ul className="flex flex-col gap-2 text-sm">
              <li className="flex flex-wrap items-center gap-2">
                <Badge tone="danger" icon="alert">
                  Your decision needed
                </Badge>
                <span className="text-(--fbg-text-primary)">
                  Supplier B (demo): lot L-0003 did not pass pre-shipment inspection on 2026-11-03.
                </span>
              </li>
              <li className="flex flex-wrap items-center gap-2">
                <Badge tone="teal" icon="clock">
                  Inspection scheduled
                </Badge>
                <span className="text-(--fbg-text-primary)">
                  Supplier A (demo): pre-shipment inspection of lot L-0007 on 2026-11-12; golden
                  sample on file.
                </span>
              </li>
            </ul>
            <div className="mt-4">
              <Link href="/design-preview/buyer/qa" className={buttonClasses("primary")}>
                Open samples and inspections
              </Link>
            </div>
          </Panel>
        ) : null}

        {tab === "activity" ? (
          <Panel
            title="Activity"
            description="Audit-derived. Platform-admin reads are labelled; system actions name the job."
            padded={false}
          >
            <ol className="divide-y divide-(--fbg-border-subtle)">
              {PROJECT_ACTIVITY.map((e) => (
                <li
                  key={e.id}
                  className="flex flex-col gap-1 px-5 py-2.5 sm:flex-row sm:items-center sm:gap-4"
                >
                  <span className="fbg-num w-36 shrink-0 text-xs text-(--fbg-text-secondary)">
                    {e.at}
                  </span>
                  <span className="flex items-center gap-2">
                    <Badge tone={ACTING_TONE[e.actingAs] ?? "neutral"} icon={null}>
                      {e.actingAs.replace("_", " ")}
                    </Badge>
                    <span className="text-sm text-(--fbg-text-primary)">{e.actor}</span>
                  </span>
                  <span className="min-w-0 flex-1 text-sm text-(--fbg-text-primary)">
                    {e.action}
                  </span>
                  <span className="fbg-num text-xs text-(--fbg-text-secondary)">{e.entity}</span>
                </li>
              ))}
            </ol>
          </Panel>
        ) : null}
      </div>
    </AppShell>
  );
}
