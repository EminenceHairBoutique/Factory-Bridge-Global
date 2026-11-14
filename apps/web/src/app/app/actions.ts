"use server";

/**
 * Buyer project and brief writes (B-05 exit gate: a buyer creates and edits a brief). Each action re-runs the guard,
 * checks the role with @fbg/domain/workspace, validates with zod, and writes with the user's JWT so 0008's RLS and
 * triggers (buyer-org only, draft-only edits, status machine) apply as the second layer.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { canWriteBuyerProjects } from "@fbg/domain/workspace";
import { requireWorkspace } from "@/server/auth/guard";
import { briefSchema, fieldErrors, formObject, projectSchema } from "@/server/auth/schemas";
import { getProject } from "@/server/buyer/projects";
import { BUYER_COPY } from "@/workspace/copy";

export interface BuyerFormState {
  readonly error?: string;
  readonly notice?: string;
  readonly fieldErrors?: Readonly<Record<string, string>>;
  readonly values?: Readonly<Record<string, string>>;
}

export async function createProject(
  _prev: BuyerFormState,
  form: FormData,
): Promise<BuyerFormState> {
  const ctx = await requireWorkspace("buyer", "/app/projects/new");
  if (!canWriteBuyerProjects(ctx.active.role)) return { error: BUYER_COPY.readOnly };
  const values = formObject(form);
  const parsed = projectSchema.safeParse(values);
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values };
  const { data: project, error } = await ctx.supabase
    .from("sourcing_projects")
    .insert({ org_id: ctx.active.orgId, name: parsed.data.name })
    .select("id")
    .single();
  if (error || !project) return { error: BUYER_COPY.createFailed, values };
  if (parsed.data.brief) {
    const { error: briefError } = await ctx.supabase.from("buyer_briefs").insert({
      project_id: project.id,
      org_id: ctx.active.orgId,
      raw_input_en: parsed.data.brief,
    });
    if (briefError) console.error(`brief insert failed (${briefError.code ?? "unknown"})`);
  }
  revalidatePath("/app");
  redirect(`/app/projects/${project.id}`);
}

export async function saveBrief(_prev: BuyerFormState, form: FormData): Promise<BuyerFormState> {
  const values = formObject(form);
  const parsed = briefSchema.safeParse(values);
  const path = parsed.success ? `/app/projects/${parsed.data.projectId}` : "/app";
  const ctx = await requireWorkspace("buyer", path);
  if (!canWriteBuyerProjects(ctx.active.role)) return { error: BUYER_COPY.readOnly };
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values };
  const project = await getProject(ctx.supabase, parsed.data.projectId, ctx.active.orgId);
  if (!project) return { error: BUYER_COPY.changeFailed };
  if (parsed.data.briefId) {
    const { data, error } = await ctx.supabase
      .from("buyer_briefs")
      .update({ raw_input_en: parsed.data.brief })
      .eq("id", parsed.data.briefId)
      .eq("project_id", project.id)
      .eq("org_id", ctx.active.orgId)
      .eq("status", "draft")
      .select("id");
    if (error) return { error: BUYER_COPY.changeFailed, values };
    if (!data?.length) return { error: BUYER_COPY.briefLocked, values };
  } else {
    const { error } = await ctx.supabase.from("buyer_briefs").insert({
      project_id: project.id,
      org_id: ctx.active.orgId,
      raw_input_en: parsed.data.brief,
    });
    if (error) return { error: BUYER_COPY.changeFailed, values };
  }
  revalidatePath(path);
  return { notice: BUYER_COPY.briefSaved, values };
}
