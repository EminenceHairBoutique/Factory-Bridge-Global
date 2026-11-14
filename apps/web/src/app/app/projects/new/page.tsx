import { notFound } from "next/navigation";
import { canWriteBuyerProjects } from "@fbg/domain/workspace";
import { requireWorkspace } from "@/server/auth/guard";
import { WorkspaceShell } from "@/workspace/WorkspaceShell";
import { NewProjectForm } from "@/workspace/buyer/ProjectForms";
import { buyerNav } from "@/workspace/buyer/navigation";
import { BUYER_COPY } from "@/workspace/copy";
import { PageHeader } from "@/workspace/ui";

export const dynamic = "force-dynamic";

export default async function NewProjectPage() {
  const ctx = await requireWorkspace("buyer", "/app/projects/new");
  if (!canWriteBuyerProjects(ctx.active.role)) notFound();
  return (
    <WorkspaceShell ctx={ctx} nav={buyerNav(ctx.active.role, "new")}>
      <PageHeader title={BUYER_COPY.newProject} lead={BUYER_COPY.newProjectLead} />
      <NewProjectForm />
    </WorkspaceShell>
  );
}
