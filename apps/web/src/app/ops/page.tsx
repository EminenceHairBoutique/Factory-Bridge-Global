import Link from "next/link";
import { requireWorkspace } from "@/server/auth/guard";
import { listProjects } from "@/server/buyer/projects";
import { WorkspaceShell } from "@/workspace/WorkspaceShell";
import { OPS_COPY } from "@/workspace/copy";
import { Badge, EmptyState, Notice, PageHeader } from "@/workspace/ui";
import { opsNav } from "@/workspace/ops/navigation";

export const dynamic = "force-dynamic";

export default async function OpsOverviewPage() {
  const ctx = await requireWorkspace("internal", "/ops");
  // No org filter: internal staff work across buyer orgs, and RLS (0008 sourcing_projects_select) returns only the
  // projects this person is assigned to (compliance reviewers: all, for hold review). Unassigned operators see none.
  const projects = await listProjects(ctx.supabase, null);
  return (
    <WorkspaceShell ctx={ctx} nav={opsNav(ctx.active.role, "overview")}>
      <PageHeader title={OPS_COPY.overviewTitle} lead={OPS_COPY.overviewLead} />
      <Notice tone="warn" title={OPS_COPY.dataNotice} />
      {projects.length ? (
        <ul
          aria-label="Projects"
          className="divide-y divide-(--fbg-border-divider) rounded-(--fbg-radius-card) border border-(--fbg-border-subtle) bg-(--fbg-bg-surface)"
        >
          {projects.map((p) => (
            <li key={p.id}>
              <Link
                href={`/ops/projects/${p.id}`}
                className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-(--fbg-hover)"
              >
                <span className="font-medium">{p.name}</span>
                <Badge tone="neutral">{p.status}</Badge>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title={OPS_COPY.noProjectsTitle} body={OPS_COPY.noProjectsBody} />
      )}
    </WorkspaceShell>
  );
}
