import Link from "next/link";
import { canWriteBuyerProjects } from "@fbg/domain/workspace";
import { requireWorkspace } from "@/server/auth/guard";
import { listProjects } from "@/server/buyer/projects";
import { WorkspaceShell } from "@/workspace/WorkspaceShell";
import { buyerNav } from "@/workspace/buyer/navigation";
import { BUYER_COPY } from "@/workspace/copy";
import { Badge, EmptyState, Notice, PageHeader, buttonClasses } from "@/workspace/ui";

export const dynamic = "force-dynamic";

export default async function BuyerOverviewPage() {
  const ctx = await requireWorkspace("buyer", "/app");
  const projects = await listProjects(ctx.supabase, ctx.active.orgId);
  const canWrite = canWriteBuyerProjects(ctx.active.role);
  return (
    <WorkspaceShell ctx={ctx} nav={buyerNav(ctx.active.role, "overview")}>
      <PageHeader
        title={BUYER_COPY.overviewTitle}
        lead={BUYER_COPY.overviewLead}
        actions={
          canWrite ? (
            <Link href="/app/projects/new" className={buttonClasses("primary", "md")}>
              {BUYER_COPY.newProject}
            </Link>
          ) : null
        }
      />
      {canWrite ? null : <Notice tone="neutral" title={BUYER_COPY.readOnly} />}
      {projects.length ? (
        <ul
          aria-label="Projects"
          className="divide-y divide-(--fbg-border-divider) rounded-(--fbg-radius-card) border border-(--fbg-border-subtle) bg-(--fbg-bg-surface)"
        >
          {projects.map((p) => (
            <li key={p.id}>
              <Link
                href={`/app/projects/${p.id}`}
                className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-(--fbg-hover)"
              >
                <span className="font-medium">{p.name}</span>
                <Badge tone="neutral">{p.status}</Badge>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title={BUYER_COPY.noProjectsTitle} body={BUYER_COPY.noProjectsBody} />
      )}
    </WorkspaceShell>
  );
}
