import { notFound } from "next/navigation";
import { requireWorkspace } from "@/server/auth/guard";
import { isUuid } from "@/server/auth/paths";
import { getProject, latestBrief } from "@/server/buyer/projects";
import { WorkspaceShell } from "@/workspace/WorkspaceShell";
import { BUYER_COPY } from "@/workspace/copy";
import { opsNav } from "@/workspace/ops/navigation";
import { Badge, PageHeader, Panel } from "@/workspace/ui";

export const dynamic = "force-dynamic";

export default async function OpsProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireWorkspace("internal", `/ops/projects/${isUuid(id) ? id : ""}`);
  if (!isUuid(id)) notFound();
  // RLS decides: an operator reads a buyer project only through an active assignment (ADR-035). Direct URL → 404.
  const project = await getProject(ctx.supabase, id, null);
  if (!project) notFound();
  const brief = await latestBrief(ctx.supabase, project.id);
  return (
    <WorkspaceShell ctx={ctx} nav={opsNav(ctx.active.role, null)}>
      <PageHeader title={project.name} meta={<Badge tone="neutral">{project.status}</Badge>} />
      <Panel
        title={BUYER_COPY.briefLabel}
        description={brief ? `Version ${brief.version} · ${brief.status}` : undefined}
      >
        {brief ? (
          <p className="text-sm whitespace-pre-wrap" data-testid="brief-text">
            {brief.rawInputEn ?? ""}
          </p>
        ) : (
          <p className="text-sm text-(--fbg-text-secondary)">No brief yet.</p>
        )}
      </Panel>
    </WorkspaceShell>
  );
}
