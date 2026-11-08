"use client";

/**
 * Buyer Projects — the dedicated list the Overview links to (UX-03 §6).
 * Searchable and filterable; one scannable line per project (Project · Stage · Next action · Updated) with
 * quantity, quote counts, operator and links behind an in-row disclosure. Phone: stacked rows, same data.
 */
import Link from "next/link";
import { useMemo, useState } from "react";
import { DEMO_ACTIONS, DEMO_AS_OF, DEMO_PROJECTS } from "../demo-data";
import { PROJECT_FILTERS, filterProjects, type ProjectFilter } from "../projects-demo";
import { AppShell } from "../ui/AppShell";
import { Icon } from "../ui/icons";
import { ProjectList } from "../ui/ProjectList";
import {
  EmptyState,
  PageHeader,
  Panel,
  SegmentedControl,
  TextInput,
  buttonClasses,
} from "../ui/primitives";

export function BuyerProjects() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ProjectFilter>("all");

  const projects = useMemo(
    () =>
      filterProjects(DEMO_PROJECTS, DEMO_ACTIONS, filter, query).sort((a, b) =>
        b.updatedAt.localeCompare(a.updatedAt),
      ),
    [filter, query],
  );

  return (
    <AppShell workspace="buyer" title="Projects">
      <div className="mx-auto flex max-w-[1120px] flex-col gap-6">
        <PageHeader
          title="Projects"
          lead="Every sourcing project your organization has opened, with its stage and the next action."
          actions={
            <Link href="/design-preview/buyer/new-request" className={buttonClasses("primary")}>
              <Icon name="plus" size={16} />
              New sourcing request
            </Link>
          }
        />

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-xs">
            <Icon
              name="search"
              size={16}
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-(--fbg-text-muted)"
            />
            <TextInput
              type="search"
              aria-label="Search projects"
              placeholder="Search by name or category"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <SegmentedControl
            label="Filter projects"
            size="sm"
            options={PROJECT_FILTERS}
            value={filter}
            onChange={setFilter}
          />
        </div>

        <Panel padded={false}>
          {projects.length === 0 ? (
            <div className="p-4">
              <EmptyState
                title="No projects match"
                body="Try another filter or search term, or start a new sourcing request."
                action={
                  <Link
                    href="/design-preview/buyer/new-request"
                    className={buttonClasses("secondary", "sm")}
                  >
                    New sourcing request
                  </Link>
                }
              />
            </div>
          ) : (
            <ProjectList projects={projects} header />
          )}
        </Panel>

        <p className="fbg-num text-[12px] text-(--fbg-text-muted)">
          {projects.length} of {DEMO_PROJECTS.length} projects · as of {DEMO_AS_OF}
        </p>
      </div>
    </AppShell>
  );
}
