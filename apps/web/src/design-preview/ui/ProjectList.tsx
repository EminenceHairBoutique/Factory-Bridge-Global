"use client";

/**
 * Project rows shared by the Overview (three most recent) and the Projects page (all, filtered).
 * A row is scannable in one line — Project · Stage · Next action · Updated — and expands in place to show
 * quantity, quote counts, operator, destination, brief version and the links that exist for it. Only
 * screens that exist in the prototype are linked (projects-demo.ts `projectRoutes`).
 */
import Link from "next/link";
import { useState } from "react";
import { STAGE_LABEL, STAGE_ORDER, type DemoProject, type ProjectStage } from "../demo-data";
import { formatQty } from "../compare-demo";
import { projectRoutes } from "../projects-demo";
import { Icon } from "./icons";
import { cx } from "./primitives";

export function StageMeter({ stage }: { stage: ProjectStage }) {
  const index = STAGE_ORDER.indexOf(stage);
  return (
    <div className="min-w-0">
      <div
        className="flex w-24 gap-px"
        role="img"
        aria-label={`Stage ${index + 1} of ${STAGE_ORDER.length}`}
      >
        {STAGE_ORDER.map((s, i) => (
          <span
            key={s}
            className={cx(
              "h-1 flex-1 rounded-[1px]",
              i < index
                ? "bg-(--fbg-action-primary)"
                : i === index
                  ? "bg-(--fbg-text-primary)"
                  : "bg-(--fbg-border-subtle)",
            )}
          />
        ))}
      </div>
      <p className="mt-1 truncate text-[13px] text-(--fbg-text-primary)">{STAGE_LABEL[stage]}</p>
    </div>
  );
}

const GRID =
  "grid grid-cols-[minmax(0,1fr)_2rem] gap-x-3 gap-y-1.5 px-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,0.9fr)_minmax(0,1.1fr)_5.5rem_2rem] lg:items-center lg:gap-x-4";

function QuoteCounts({ quotes }: { quotes: DemoProject["quotes"] }) {
  if (quotes.confirmed + quotes.inReview + quotes.expiringSoon === 0) return <>No quotes yet</>;
  return (
    <span className="fbg-num">
      {quotes.confirmed} confirmed
      {quotes.inReview > 0 ? <>, {quotes.inReview} in review</> : null}
      {quotes.expiringSoon > 0 ? (
        <span className="text-(--fbg-status-warning)">, {quotes.expiringSoon} expiring soon</span>
      ) : null}
    </span>
  );
}

function ProjectRow({
  project,
  expanded,
  onToggle,
}: {
  project: DemoProject;
  expanded: boolean;
  onToggle: () => void;
}) {
  const routes = projectRoutes(project.id);
  const detailsId = `project-details-${project.id}`;
  const links: Array<{ label: string; href: string }> = [];
  if (routes.record) links.push({ label: "Open project", href: routes.record });
  if (routes.compare) links.push({ label: "Comparison", href: routes.compare });
  if (routes.options) links.push({ label: "Supplier options", href: routes.options });
  if (routes.activity) links.push({ label: "Activity", href: routes.activity });
  if (!routes.record && routes.nextAction) {
    links.push({ label: project.nextAction, href: routes.nextAction });
  }

  return (
    <li>
      <div className={cx(GRID, "py-3 hover:bg-(--fbg-hover)")}>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-(--fbg-text-primary)">
            {routes.record ? (
              <Link href={routes.record} className="hover:text-(--fbg-link) hover:underline">
                {project.name}
              </Link>
            ) : (
              project.name
            )}
          </p>
          <p className="truncate text-[12px] text-(--fbg-text-secondary)">{project.family}</p>
        </div>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-controls={detailsId}
          aria-label={`${expanded ? "Hide" : "Show"} details for ${project.name}`}
          className="flex h-8 w-8 items-center justify-center justify-self-end rounded-(--fbg-radius-control) text-(--fbg-text-secondary) hover:bg-(--fbg-pressed) hover:text-(--fbg-text-primary) lg:order-last"
        >
          <Icon
            name="chevron-down"
            size={16}
            className={cx("transition-transform", expanded && "rotate-180")}
          />
        </button>
        <div className="col-span-2 lg:col-span-1">
          <StageMeter stage={project.stage} />
        </div>
        <p className="col-span-2 min-w-0 truncate text-[13px] lg:col-span-1">
          {routes.nextAction ? (
            <Link
              href={routes.nextAction}
              className="font-medium text-(--fbg-link) hover:underline"
            >
              {project.nextAction}
            </Link>
          ) : (
            <span className="text-(--fbg-text-primary)">{project.nextAction}</span>
          )}
        </p>
        <p className="fbg-num col-span-2 text-[12px] text-(--fbg-text-secondary) lg:col-span-1 lg:text-right">
          <span className="lg:hidden">Updated </span>
          {project.updatedAt}
        </p>
      </div>
      {expanded ? (
        <div
          id={detailsId}
          className="border-t border-(--fbg-border-divider) bg-(--fbg-bg-canvas)/70 px-4 py-3"
        >
          <dl className="grid gap-x-6 gap-y-2 text-[13px] sm:grid-cols-2 lg:grid-cols-5">
            <div>
              <dt className="text-[12px] text-(--fbg-text-secondary)">Quantity</dt>
              <dd className="fbg-num text-(--fbg-text-primary)">
                {project.quantity > 0
                  ? `${formatQty(project.quantity)} ${project.unit}`
                  : "Not set"}
              </dd>
            </div>
            <div className="sm:col-span-2 lg:col-span-1">
              <dt className="text-[12px] text-(--fbg-text-secondary)">Quotes</dt>
              <dd className="text-(--fbg-text-primary)">
                <QuoteCounts quotes={project.quotes} />
              </dd>
            </div>
            <div>
              <dt className="text-[12px] text-(--fbg-text-secondary)">Operator</dt>
              <dd className="text-(--fbg-text-primary)">{project.operator}</dd>
            </div>
            <div>
              <dt className="text-[12px] text-(--fbg-text-secondary)">Destination</dt>
              <dd className="text-(--fbg-text-primary)">{project.destination}</dd>
            </div>
            <div>
              <dt className="text-[12px] text-(--fbg-text-secondary)">Brief</dt>
              <dd className="fbg-num text-(--fbg-text-primary)">v{project.briefVersion}</dd>
            </div>
          </dl>
          <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
            {links.length > 0 ? (
              links.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="inline-flex items-center gap-0.5 font-medium text-(--fbg-link) hover:underline"
                >
                  {l.label}
                  <Icon name="chevron-right" size={14} />
                </Link>
              ))
            ) : (
              <span className="text-(--fbg-text-muted)">
                The project record for this project is not in the prototype yet.
              </span>
            )}
          </p>
        </div>
      ) : null}
    </li>
  );
}

export function ProjectList({
  projects,
  header = false,
}: {
  projects: readonly DemoProject[];
  /** Column labels on tablet and up (Projects page). */
  header?: boolean;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  return (
    <div>
      {header ? (
        <div
          className={cx(
            GRID,
            "hidden border-b border-(--fbg-border-divider) py-2 text-[12px] font-medium text-(--fbg-text-secondary) lg:grid",
          )}
          aria-hidden
        >
          <span>Project</span>
          <span>Stage</span>
          <span>Next action</span>
          <span className="text-right">Updated</span>
          <span />
        </div>
      ) : null}
      <ul className="divide-y divide-(--fbg-border-divider)">
        {projects.map((p) => (
          <ProjectRow
            key={p.id}
            project={p}
            expanded={expanded === p.id}
            onToggle={() => setExpanded((cur) => (cur === p.id ? null : p.id))}
          />
        ))}
      </ul>
    </div>
  );
}
