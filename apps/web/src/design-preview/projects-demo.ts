/**
 * Display-only helpers for the buyer Overview, Projects and Quotes screens (UX-03).
 *
 * Everything here is deterministic and derived from the synthetic fixtures in ./demo-data: nothing is
 * typed in as a headline number. No React, no I/O; tested in projects-demo.test.ts.
 */
import type { ActionKind, DemoAction, DemoProject, DemoQuote } from "./demo-data";

/* ------------------------------------------------------------------------------------------------ */
/* Needs your attention                                                                               */
/* ------------------------------------------------------------------------------------------------ */

/**
 * Ranking rule, by who is blocked:
 *   0 approve_message   — an operator and a supplier wait for your approval; nothing is sent until then.
 *   1 review_extraction — received quotes cannot be compared until you accept the extracted values.
 *   2 confirm_spec      — matching cannot start until inferred values are confirmed.
 *   3 quote_expiring    — time-bound; the item names its date.
 *   4 complete_brief    — a draft that only blocks your own next step.
 * Ties keep fixture order (Array.prototype.sort is stable).
 */
const ACTION_PRIORITY: Record<ActionKind, number> = {
  approve_message: 0,
  review_extraction: 1,
  confirm_spec: 2,
  quote_expiring: 3,
  complete_brief: 4,
};

export function rankActions(actions: readonly DemoAction[]): DemoAction[] {
  return [...actions].sort((a, b) => ACTION_PRIORITY[a.kind] - ACTION_PRIORITY[b.kind]);
}

/** The items shown by default and the ones kept behind "Show all". Nothing is dropped. */
export function splitActions(
  actions: readonly DemoAction[],
  limit = 3,
): { primary: DemoAction[]; rest: DemoAction[] } {
  const ranked = rankActions(actions);
  return { primary: ranked.slice(0, limit), rest: ranked.slice(limit) };
}

/* ------------------------------------------------------------------------------------------------ */
/* Projects                                                                                           */
/* ------------------------------------------------------------------------------------------------ */

export function recentProjects(projects: readonly DemoProject[], limit = 3): DemoProject[] {
  return [...projects].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, limit);
}

export type ProjectFilter = "all" | "action" | "review" | "ready";

export const PROJECT_FILTERS: ReadonlyArray<{ value: ProjectFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "action", label: "Needs my action" },
  { value: "review", label: "Quotes in review" },
  { value: "ready", label: "Comparison ready" },
];

export function matchesProjectFilter(
  project: DemoProject,
  actions: readonly DemoAction[],
  filter: ProjectFilter,
): boolean {
  switch (filter) {
    case "all":
      return true;
    case "action":
      return actions.some((a) => a.projectId === project.id);
    case "review":
      return project.quotes.inReview > 0;
    case "ready":
      return project.stage === "comparison_ready" || project.stage === "handoff_pending";
  }
}

export function filterProjects(
  projects: readonly DemoProject[],
  actions: readonly DemoAction[],
  filter: ProjectFilter,
  query = "",
): DemoProject[] {
  const q = query.trim().toLowerCase();
  return projects.filter(
    (p) =>
      matchesProjectFilter(p, actions, filter) &&
      (q === "" || p.name.toLowerCase().includes(q) || p.family.toLowerCase().includes(q)),
  );
}

export interface ProjectRoutes {
  /** The project record (only the labels project has one in this prototype). */
  record?: string;
  /** Where the project's "next action" text leads, when a screen for it exists. */
  nextAction?: string;
  compare?: string;
  options?: string;
  activity?: string;
}

const PROJECT = "/design-preview/buyer/project";

/**
 * Only screens that exist in the prototype are linked; everything else renders as plain text so the
 * list never shows a dead affordance (UX-03 criterion F).
 */
export function projectRoutes(projectId: string): ProjectRoutes {
  switch (projectId) {
    case "prj_demo_labels":
      return {
        record: PROJECT,
        nextAction: "/design-preview/buyer/compare",
        compare: "/design-preview/buyer/compare",
        options: `${PROJECT}?tab=options`,
        activity: `${PROJECT}?tab=activity`,
      };
    case "prj_demo_hair":
      return { nextAction: "/design-preview/buyer/brief" };
    case "prj_demo_sleeves":
      return { nextAction: "/design-preview/buyer/new-request" };
    default:
      return {};
  }
}

/* ------------------------------------------------------------------------------------------------ */
/* Quote status                                                                                       */
/* ------------------------------------------------------------------------------------------------ */

/** ISO calendar date plus `days`, computed in UTC so no time zone can shift the day. */
export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (y === undefined || m === undefined || d === undefined) throw new Error(`bad date ${iso}`);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export interface QuoteStatusSummary {
  confirmed: number;
  inReview: number;
  /** Valid today but expiring within the horizon (60 days by default). */
  expiring: number;
  expired: number;
  /** No valid_until on record: shown as "Validity unconfirmed", never silently treated as valid. */
  unconfirmed: number;
}

export function quoteStatusSummary(
  projects: readonly DemoProject[],
  quotes: readonly DemoQuote[],
  asOf: string,
  horizonDays = 60,
): QuoteStatusSummary {
  const horizon = addDays(asOf, horizonDays);
  return {
    confirmed: projects.reduce((n, p) => n + p.quotes.confirmed, 0),
    inReview: projects.reduce((n, p) => n + p.quotes.inReview, 0),
    expiring: quotes.filter(
      (q) => q.validUntil !== null && q.validUntil >= asOf && q.validUntil <= horizon,
    ).length,
    expired: quotes.filter((q) => q.validUntil !== null && q.validUntil < asOf).length,
    unconfirmed: quotes.filter((q) => q.validUntil === null).length,
  };
}

/* ------------------------------------------------------------------------------------------------ */
/* Project record tabs (deep links such as /buyer/project?tab=options)                                 */
/* ------------------------------------------------------------------------------------------------ */

export const PROJECT_TABS = [
  "overview",
  "brief",
  "options",
  "compare",
  "documents",
  "messages",
  "reports",
  "quality",
  "activity",
] as const;

export type ProjectTab = (typeof PROJECT_TABS)[number];

export function parseProjectTab(value: string | string[] | undefined): ProjectTab {
  const v = Array.isArray(value) ? value[0] : value;
  return v !== undefined && (PROJECT_TABS as readonly string[]).includes(v)
    ? (v as ProjectTab)
    : "overview";
}
