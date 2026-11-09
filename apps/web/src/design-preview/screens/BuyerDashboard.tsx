"use client";

/**
 * Buyer Overview — UX-03 clarity pass.
 *
 * The screen answers three questions and nothing else: what needs my attention, where are my projects,
 * what should I do next. Two content regions sit under a compact header with one primary action.
 * Supplier options and the audit trail live inside each project; quote statistics live on the Quotes page.
 * All counts are derived from the fixtures (projects-demo.ts); nothing is typed in as a headline.
 */
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  DEMO_ACTIONS,
  DEMO_AS_OF,
  DEMO_PROJECTS,
  DEMO_QUOTES,
  type ActionKind,
  type DemoAction,
} from "../demo-data";
import { projectRoutes, quoteStatusSummary, recentProjects, splitActions } from "../projects-demo";
import { AppShell } from "../ui/AppShell";
import { Icon, type IconName } from "../ui/icons";
import { ProjectList } from "../ui/ProjectList";
import {
  Button,
  EmptyState,
  PageHeader,
  Panel,
  Section,
  buttonClasses,
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

function projectName(id: string): string {
  return DEMO_PROJECTS.find((p) => p.id === id)?.name ?? "";
}

function ActionRow({ action, onSetAside }: { action: DemoAction; onSetAside: () => void }) {
  const verb = ACTION_VERB[action.kind];
  return (
    <li className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-3">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-(--fbg-radius-control) bg-(--fbg-bg-sunken) text-(--fbg-text-secondary)">
          <Icon name={ACTION_ICON[action.kind]} size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <p
            className="truncate text-sm font-medium text-(--fbg-text-primary)"
            title={action.detail}
          >
            {action.title}
          </p>
          <p className="line-clamp-2 text-[13px] text-(--fbg-text-secondary) sm:line-clamp-none sm:truncate">
            {projectName(action.projectId)}
            {action.due ? (
              <>
                {" · "}
                <span className="fbg-num">{action.due}</span>
              </>
            ) : null}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1 pl-11 sm:pl-0">
        {action.href ? (
          <Link href={action.href} className={buttonClasses("secondary", "sm")}>
            {verb}
          </Link>
        ) : (
          <span
            className={cx(buttonClasses("secondary", "sm"), "cursor-not-allowed opacity-60")}
            aria-disabled
            title="Not in this prototype"
          >
            {verb}
          </span>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="text-(--fbg-text-secondary)"
          onClick={onSetAside}
          aria-label={`Set aside "${action.title}" for now`}
          title="Moves this item to a set-aside group in this browser only. Nothing is resolved."
        >
          Set aside
        </Button>
      </div>
    </li>
  );
}

export function BuyerDashboard() {
  const [showAll, setShowAll] = useState(false);
  const [asideIds, setAsideIds] = useState<ReadonlySet<string>>(new Set());

  const live = useMemo(() => DEMO_ACTIONS.filter((a) => !asideIds.has(a.id)), [asideIds]);
  const setAside = useMemo(() => DEMO_ACTIONS.filter((a) => asideIds.has(a.id)), [asideIds]);
  const { primary, rest } = useMemo(() => splitActions(live), [live]);
  const visible = showAll ? [...primary, ...rest] : primary;
  const projects = useMemo(() => recentProjects(DEMO_PROJECTS), []);
  const status = useMemo(() => quoteStatusSummary(DEMO_PROJECTS, DEMO_QUOTES, DEMO_AS_OF), []);
  const atRisk = status.expiring + status.unconfirmed + status.expired;
  const labels = projectRoutes("prj_demo_labels");

  const moveAside = (id: string) => setAsideIds((s) => new Set(s).add(id));
  const restore = (id: string) =>
    setAsideIds((s) => {
      const next = new Set(s);
      next.delete(id);
      return next;
    });

  return (
    <AppShell workspace="buyer" title="Overview">
      <div className="mx-auto flex max-w-[1120px] flex-col gap-8">
        <PageHeader
          title="Overview"
          lead={`Welcome back. ${DEMO_ACTIONS.length} items need your attention across ${DEMO_PROJECTS.length} sourcing projects.`}
          meta={
            <>
              <span className="fbg-num hidden sm:inline">As of {DEMO_AS_OF}</span>
              <Link
                href="/design-preview/buyer/quotes"
                className="fbg-num font-medium text-(--fbg-link) hover:underline"
              >
                {status.confirmed} factory-confirmed quotes
              </Link>
              {status.inReview > 0 ? (
                <span className="fbg-num">{status.inReview} awaiting your review</span>
              ) : null}
              {atRisk > 0 ? (
                <Link
                  href="/design-preview/buyer/quotes"
                  className="fbg-num inline-flex items-center gap-1 font-medium text-(--fbg-status-warning) hover:underline"
                >
                  <Icon name="alert" size={12} />
                  {atRisk} expiring, unconfirmed or expired
                </Link>
              ) : null}
            </>
          }
          actions={
            <>
              <Link
                href="/design-preview/buyer/documents#upload"
                className={cx(buttonClasses("ghost"), "text-(--fbg-text-secondary)")}
              >
                Upload a quote
              </Link>
              <Link href="/design-preview/buyer/new-request" className={buttonClasses("primary")}>
                <Icon name="plus" size={16} />
                New sourcing request
              </Link>
            </>
          }
        />

        <Section
          id="attention"
          title="Needs your attention"
          description="Nothing is sent to a supplier, confirmed or ordered without one of these approvals."
          action={
            rest.length > 0 || setAside.length > 0 ? (
              <button
                type="button"
                onClick={() => setShowAll((v) => !v)}
                aria-expanded={showAll}
                aria-controls="attention-list"
                className="font-medium text-(--fbg-link) hover:underline"
              >
                {showAll ? "Show fewer" : `Show all ${DEMO_ACTIONS.length}`}
              </button>
            ) : null
          }
        >
          <Panel padded={false}>
            {visible.length === 0 ? (
              <div className="p-4">
                <EmptyState
                  title="You're caught up"
                  body="New review tasks, expiring quotes and message drafts appear here as they arrive."
                />
              </div>
            ) : (
              <ul id="attention-list" className="divide-y divide-(--fbg-border-divider)">
                {visible.map((a) => (
                  <ActionRow key={a.id} action={a} onSetAside={() => moveAside(a.id)} />
                ))}
              </ul>
            )}
            {showAll && setAside.length > 0 ? (
              <div className="border-t border-(--fbg-border-divider) bg-(--fbg-bg-canvas)/70 px-4 py-3">
                <p className="text-[12px] text-(--fbg-text-secondary)">
                  Set aside in this browser only. Nothing here is resolved, and it stays visible to
                  everyone else on the project.
                </p>
                <ul className="mt-1 divide-y divide-(--fbg-border-divider)">
                  {setAside.map((a) => (
                    <li
                      key={a.id}
                      className="flex items-center justify-between gap-3 py-1.5 text-[13px]"
                    >
                      <span className="min-w-0 truncate text-(--fbg-text-secondary)">
                        {a.title}
                      </span>
                      <button
                        type="button"
                        onClick={() => restore(a.id)}
                        className="shrink-0 font-medium text-(--fbg-link) hover:underline"
                      >
                        Restore
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </Panel>
        </Section>

        <Section
          id="projects"
          title="Your projects"
          description="The three most recently updated. Expand a row for quantities, quote counts and links."
          action={
            <Link
              href="/design-preview/buyer/projects"
              className="inline-flex items-center gap-0.5 font-medium text-(--fbg-link) hover:underline"
            >
              View all {DEMO_PROJECTS.length} projects
              <Icon name="chevron-right" size={14} />
            </Link>
          }
        >
          <Panel padded={false}>
            <ProjectList projects={projects} />
          </Panel>
          <p className="mt-2 text-[12px] text-(--fbg-text-muted)">
            Supplier options and the activity log live inside each project. Labels project:{" "}
            {labels.options ? (
              <Link href={labels.options} className="font-medium text-(--fbg-link) hover:underline">
                Supplier options
              </Link>
            ) : null}
            {" · "}
            {labels.activity ? (
              <Link
                href={labels.activity}
                className="font-medium text-(--fbg-link) hover:underline"
              >
                Activity
              </Link>
            ) : null}
          </p>
        </Section>
      </div>
    </AppShell>
  );
}
