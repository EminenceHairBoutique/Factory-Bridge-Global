import { notFound } from "next/navigation";
import { canWriteBuyerProjects } from "@fbg/domain/workspace";
import { requireWorkspace } from "@/server/auth/guard";
import { isUuid } from "@/server/auth/paths";
import { getProject, latestBrief } from "@/server/buyer/projects";
import { WorkspaceShell } from "@/workspace/WorkspaceShell";
import { BriefEditor } from "@/workspace/buyer/ProjectForms";
import { buyerNav } from "@/workspace/buyer/navigation";
import { BUYER_COPY } from "@/workspace/copy";
import { Badge, KeyValue, Notice, PageHeader, Panel } from "@/workspace/ui";

export const dynamic = "force-dynamic";

export default async function BuyerProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireWorkspace("buyer", `/app/projects/${isUuid(id) ? id : ""}`);
  if (!isUuid(id)) notFound();
  // Scoped to the active org AND filtered by RLS: another tenant's id (or one of the user's other orgs) is a 404.
  const project = await getProject(ctx.supabase, id, ctx.active.orgId);
  if (!project) notFound();
  const brief = await latestBrief(ctx.supabase, project.id);
  const canWrite = canWriteBuyerProjects(ctx.active.role);
  const editable = canWrite && (brief === null || brief.status === "draft");
  return (
    <WorkspaceShell ctx={ctx} nav={buyerNav(ctx.active.role, null)}>
      <PageHeader title={project.name} meta={<Badge tone="neutral">{project.status}</Badge>} />
      <Panel
        title={BUYER_COPY.briefLabel}
        description={brief ? `Version ${brief.version} · ${brief.status}` : undefined}
      >
        {editable ? (
          <BriefEditor
            projectId={project.id}
            briefId={brief?.id ?? null}
            initial={brief?.rawInputEn ?? ""}
          />
        ) : brief ? (
          <div className="flex flex-col gap-4">
            {canWrite ? <Notice tone="neutral" title={BUYER_COPY.briefLocked} /> : null}
            <KeyValue
              columns={1}
              items={[
                {
                  label: BUYER_COPY.briefLabel,
                  value: (
                    <p className="whitespace-pre-wrap" data-testid="brief-text">
                      {brief.rawInputEn ?? ""}
                    </p>
                  ),
                },
              ]}
            />
          </div>
        ) : (
          <p className="text-sm text-(--fbg-text-secondary)">No brief yet.</p>
        )}
      </Panel>
    </WorkspaceShell>
  );
}
