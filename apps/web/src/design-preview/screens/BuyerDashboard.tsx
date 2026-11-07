"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  DEMO_ACTIONS,
  DEMO_AS_OF,
  DEMO_PROJECTS,
  DEMO_QUOTES,
  STAGE_LABEL,
  STAGE_ORDER,
  type ActionKind,
  type DemoProject,
} from "../demo-data";
import { formatQty } from "../compare-demo";
import { AppShell } from "../ui/AppShell";
import { Icon, type IconName } from "../ui/icons";
import {
  Badge,
  Button,
  EmptyState,
  EvidenceBadge,
  FreshnessChip,
  PageHeader,
  Panel,
  SegmentedControl,
  cx,
} from "../ui/primitives";

const ACTION_ICON: Record<ActionKind, IconName> = {
  review_extraction: "eye",
  confirm_spec: "check",
  approve_message: "message",
  quote_expiring: "clock",
  complete_brief: "document",
};

const ACTION_VERB: Record<ActionKind, string> = {
  review_extraction: "Review",
  confirm_spec: "Confirm",
  approve_message: "Review draft",
  quote_expiring: "Open comparison",
  complete_brief: "Continue brief",
};

type ProjectFilter = "all" | "action" | "review" | "ready";

const FILTERS: ReadonlyArray<{ value: ProjectFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "action", label: "Needs my action" },
  { value: "review", label: "Quotes in review" },
  { value: "ready", label: "Comparison ready" },
];

function matchesFilter(p: DemoProject, f: ProjectFilter): boolean {
  switch (f) {
    case "all":
      return true;
    case "action":
      return DEMO_ACTIONS.some((a) => a.projectId === p.id);
    case "review":
      return p.quotes.inReview > 0;
    case "ready":
      return p.stage === "comparison_ready" || p.stage === "handoff_pending";
  }
}

function StageProgress({ stage }: { stage: DemoProject["stage"] }) {
  const index = STAGE_ORDER.indexOf(stage);
  return (
    <div className="min-w-0">
      <div className="flex gap-0.5" aria-hidden>
        {STAGE_ORDER.map((s, i) => (
          <span
            key={s}
            className={cx(
              "h-1.5 flex-1 rounded-sm",
              i < index ? "bg-teal" : i === index ? "bg-ink" : "bg-line",
            )}
          />
        ))}
      </div>
      <p className="mt-1 truncate text-xs text-slate">
        <span className="text-ink">{STAGE_LABEL[stage]}</span>
        <span className="fbg-num">
          {" "}
          · step {index + 1} of {STAGE_ORDER.length}
        </span>
      </p>
    </div>
  );
}

export function BuyerDashboard() {
  const [filter, setFilter] = useState<ProjectFilter>("all");
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const projects = useMemo(() => DEMO_PROJECTS.filter((p) => matchesFilter(p, filter)), [filter]);
  const actions = DEMO_ACTIONS.filter((a) => !dismissed.has(a.id));

  // Quote status is derived from the demo records, never typed in as a headline number.
  const quoteStatus = useMemo(() => {
    const confirmed = DEMO_PROJECTS.reduce((n, p) => n + p.quotes.confirmed, 0);
    const inReview = DEMO_PROJECTS.reduce((n, p) => n + p.quotes.inReview, 0);
    const expiring = DEMO_QUOTES.filter(
      (q) => q.validUntil !== null && q.validUntil >= DEMO_AS_OF && q.validUntil <= "2027-01-06",
    ).length;
    const expired = DEMO_QUOTES.filter(
      (q) => q.validUntil !== null && q.validUntil < DEMO_AS_OF,
    ).length;
    const unconfirmed = DEMO_QUOTES.filter((q) => q.validUntil === null).length;
    return { confirmed, inReview, expiring, expired, unconfirmed };
  }, []);

  const supplierEvidence = useMemo(() => {
    const withIdentity = DEMO_QUOTES.filter((q) =>
      q.evidence.some((e) => e.label.startsWith("Identity reviewed")),
    );
    const withSample = DEMO_QUOTES.filter((q) =>
      q.evidence.some((e) => e.label.startsWith("Sample approved")),
    );
    const none = DEMO_QUOTES.filter((q) => q.evidence.length === 0);
    return { withIdentity, withSample, none };
  }, []);

  return (
    <AppShell workspace="buyer" title="Overview">
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Overview"
          lead="Where each sourcing project stands, what needs your decision, and how fresh the quotes behind it are."
          meta={
            <>
              <Badge tone="neutral" icon="clock" className="fbg-num">
                As of {DEMO_AS_OF}
              </Badge>
              <Badge tone="neutral" icon="building">
                Demo Buyer Co.
              </Badge>
            </>
          }
          actions={
            <>
              <Button icon="upload">Upload a quote</Button>
              <Link
                href="/design-preview/buyer/new-request"
                className="inline-flex h-(--fbg-control-h) items-center gap-2 rounded-(--fbg-radius-control) bg-(--fbg-action-primary) px-5 text-[15px] font-medium text-(--fbg-action-on-primary) hover:bg-(--fbg-action-primary-hover)"
              >
                <Icon name="plus" size={16} />
                New sourcing request
              </Link>
            </>
          }
        />

        <div className="grid gap-4 xl:grid-cols-3">
          {/* Needs your action */}
          <Panel
            className="xl:col-span-2"
            title="Needs your action"
            description="Nothing is sent to a supplier, confirmed or ordered without one of these approvals."
            padded={false}
          >
            {actions.length === 0 ? (
              <div className="p-4">
                <EmptyState
                  title="You're caught up"
                  body="New review tasks, expiring quotes and message drafts appear here as they arrive."
                />
              </div>
            ) : (
              <ul className="divide-y divide-line">
                {actions.map((a) => {
                  const project = DEMO_PROJECTS.find((p) => p.id === a.projectId);
                  return (
                    <li key={a.id} className="flex gap-3 px-4 py-3">
                      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-(--fbg-radius-control) bg-ink/5 text-ink">
                        <Icon name={ACTION_ICON[a.kind]} size={16} />
                      </span>
                      <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-start">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-ink">{a.title}</p>
                          <p className="mt-0.5 text-sm text-slate">{a.detail}</p>
                          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate">
                            <span className="truncate">{project?.name}</span>
                            {a.due ? <span className="fbg-num text-ink">{a.due}</span> : null}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-1 sm:shrink-0">
                          {a.href ? (
                            <Link
                              href={a.href}
                              className="inline-flex h-(--fbg-control-h-sm) items-center rounded-(--fbg-radius-control) border border-(--fbg-border-strong)/60 bg-(--fbg-bg-surface) px-3.5 text-sm font-medium text-(--fbg-text-primary) hover:bg-(--fbg-hover)"
                            >
                              {ACTION_VERB[a.kind]}
                            </Link>
                          ) : (
                            <Button size="sm">{ACTION_VERB[a.kind]}</Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            aria-label={`Hide "${a.title}" from this list`}
                            onClick={() => setDismissed((s) => new Set(s).add(a.id))}
                          >
                            Hide
                          </Button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          {/* Quote status */}
          <Panel
            title="Quote status"
            description="Across all projects. Counts come from the quote records."
          >
            <dl className="divide-y divide-line">
              {[
                {
                  label: "Factory-confirmed quotes",
                  value: quoteStatus.confirmed,
                  tone: "teal" as const,
                },
                {
                  label: "Extracted, awaiting your review",
                  value: quoteStatus.inReview,
                  tone: "ink" as const,
                },
                {
                  label: "Expiring within 60 days",
                  value: quoteStatus.expiring,
                  tone: "warn" as const,
                },
                {
                  label: "Validity unconfirmed",
                  value: quoteStatus.unconfirmed,
                  tone: "warn" as const,
                },
                { label: "Expired", value: quoteStatus.expired, tone: "danger" as const },
              ].map((row) => (
                <div
                  key={row.label}
                  className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0"
                >
                  <dt className="text-sm text-slate">{row.label}</dt>
                  <dd>
                    <Badge tone={row.tone} icon={null} className="fbg-num min-w-8 justify-center">
                      {row.value}
                    </Badge>
                  </dd>
                </div>
              ))}
            </dl>
            <Link
              href="/design-preview/buyer/compare"
              className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-(--fbg-link) hover:underline"
            >
              Open the labels comparison
              <Icon name="chevron-right" size={14} />
            </Link>
          </Panel>
        </div>

        {/* Projects */}
        <Panel
          title={<span id="projects">Sourcing projects</span>}
          description="Stage, quote counts and the next action for each project."
          actions={
            <SegmentedControl
              label="Filter projects"
              options={FILTERS}
              value={filter}
              onChange={setFilter}
              size="sm"
            />
          }
          padded={false}
        >
          {projects.length === 0 ? (
            <div className="p-4">
              <EmptyState
                title="No projects match this filter"
                body="Try another filter, or start a new sourcing request."
                action={
                  <Link
                    href="/design-preview/buyer/new-request"
                    className="text-sm font-medium text-(--fbg-link) hover:underline"
                  >
                    New sourcing request
                  </Link>
                }
              />
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-left text-sm">
                  <thead className="bg-paper text-xs text-slate">
                    <tr className="[&>th]:px-4 [&>th]:py-2 [&>th]:font-medium">
                      <th scope="col">Project</th>
                      <th scope="col" className="w-56">
                        Stage
                      </th>
                      <th scope="col" className="text-right">
                        Quantity
                      </th>
                      <th scope="col" className="text-right">
                        Quotes
                      </th>
                      <th scope="col">Next action</th>
                      <th scope="col" className="text-right">
                        Updated
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {projects.map((p) => (
                      <tr
                        key={p.id}
                        className="hover:bg-paper [&>td]:px-4 [&>td]:py-3 [&>td]:align-top"
                      >
                        <td>
                          <p className="font-medium text-ink">{p.name}</p>
                          <p className="mt-0.5 text-xs text-slate">
                            {p.family} · brief v{p.briefVersion} · {p.destination}
                          </p>
                        </td>
                        <td>
                          <StageProgress stage={p.stage} />
                        </td>
                        <td className="fbg-num text-right whitespace-nowrap text-ink">
                          {p.quantity > 0 ? (
                            `${formatQty(p.quantity)} ${p.unit}`
                          ) : (
                            <span className="text-slate">—</span>
                          )}
                        </td>
                        <td className="fbg-num text-right whitespace-nowrap">
                          <span className="text-ink">{p.quotes.confirmed} confirmed</span>
                          {p.quotes.inReview > 0 ? (
                            <span className="block text-xs text-slate">
                              {p.quotes.inReview} in review
                            </span>
                          ) : null}
                          {p.quotes.expiringSoon > 0 ? (
                            <span className="block text-xs text-warn">
                              {p.quotes.expiringSoon} expiring
                            </span>
                          ) : null}
                        </td>
                        <td>
                          {p.id === "prj_demo_labels" || p.id === "prj_demo_hair" ? (
                            <Link
                              href={
                                p.id === "prj_demo_labels"
                                  ? "/design-preview/buyer/compare"
                                  : "/design-preview/buyer/brief"
                              }
                              className="font-medium text-(--fbg-link) hover:underline"
                            >
                              {p.nextAction}
                            </Link>
                          ) : (
                            <span className="text-ink">{p.nextAction}</span>
                          )}
                          <span className="mt-0.5 block text-xs text-slate">
                            Operator: {p.operator}
                          </span>
                        </td>
                        <td className="fbg-num text-right whitespace-nowrap text-slate">
                          {p.updatedAt}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Mobile cards */}
              <ul className="divide-y divide-line md:hidden">
                {projects.map((p) => (
                  <li key={p.id} className="flex flex-col gap-2 px-4 py-3">
                    <p className="text-sm font-medium text-ink">{p.name}</p>
                    <StageProgress stage={p.stage} />
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                      <dt className="text-slate">Quantity</dt>
                      <dd className="fbg-num text-right text-ink">
                        {p.quantity > 0 ? `${formatQty(p.quantity)} ${p.unit}` : "—"}
                      </dd>
                      <dt className="text-slate">Quotes</dt>
                      <dd className="fbg-num text-right text-ink">
                        {p.quotes.confirmed} confirmed
                        {p.quotes.inReview > 0 ? `, ${p.quotes.inReview} in review` : ""}
                      </dd>
                      <dt className="text-slate">Next</dt>
                      <dd className="text-right text-ink">{p.nextAction}</dd>
                    </dl>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Panel>

        <div className="grid gap-4 xl:grid-cols-3">
          {/* Supplier options and evidence */}
          <Panel
            className="xl:col-span-2"
            title="Supplier options on the labels project"
            description="Badges are generated from completed check records. A supplier without a record shows no badge."
            padded={false}
          >
            <ul className="divide-y divide-line">
              {DEMO_QUOTES.map((q) => (
                <li
                  key={q.id}
                  className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink">
                      {q.supplier} <span className="font-normal text-slate">· {q.city}</span>
                    </p>
                    <p className="mt-0.5 text-xs text-slate">
                      {q.priceBasis} {q.basisPlace} · {q.currency} ·{" "}
                      {q.validUntil === null ? (
                        <span className="text-warn">Validity unconfirmed</span>
                      ) : q.validUntil < DEMO_AS_OF ? (
                        <span className="text-danger">Quote expired {q.validUntil}</span>
                      ) : (
                        <span className="fbg-num">Valid until {q.validUntil}</span>
                      )}
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
            <p className="border-t border-line px-4 py-2 text-xs text-slate">
              {supplierEvidence.withIdentity.length} of {DEMO_QUOTES.length} suppliers have an
              identity review on file; {supplierEvidence.withSample.length} has an approved sample
              for this variant; {supplierEvidence.none.length} has no check record. Contact details
              are shown only when a disclosure grant exists.
            </p>
          </Panel>

          {/* Recent activity */}
          <Panel title="Recent activity" description="From the audit trail.">
            <ol className="space-y-3">
              {[
                {
                  when: "2026-11-06",
                  what: "Supplier E quote confirmed by operator",
                  chip: "confirmed" as const,
                },
                {
                  when: "2026-11-05",
                  what: "Supplier B quote confirmed from email intake",
                  chip: "confirmed" as const,
                },
                {
                  when: "2026-11-05",
                  what: "2 carton quotes extracted, awaiting review",
                  chip: "updated" as const,
                },
                {
                  when: "2026-11-04",
                  what: "Brief v3 confirmed for labels project",
                  chip: "confirmed" as const,
                },
                { when: "2026-10-31", what: "Supplier D quote expired", chip: "expired" as const },
              ].map((e) => (
                <li key={e.what} className="flex items-start justify-between gap-3">
                  <p className="text-sm text-ink">{e.what}</p>
                  <FreshnessChip kind={e.chip} date={e.when} className="shrink-0" />
                </li>
              ))}
            </ol>
          </Panel>
        </div>
      </div>
    </AppShell>
  );
}
