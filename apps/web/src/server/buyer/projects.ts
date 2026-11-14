/**
 * Buyer project and brief reads (B-05 exit-gate slice). Every query runs with the signed-in user's JWT, so RLS
 * (0008: Pattern A projects, Pattern B briefs) is the second layer; each read is also scoped to the active
 * organization the guard resolved, so a project of another org the user happens to belong to is not shown under
 * this one. A missing row and a forbidden row look the same to the caller: null → 404.
 */
import type { UserSupabase } from "../auth/supabase";

export interface ProjectSummary {
  readonly id: string;
  readonly name: string;
  readonly status: string;
  readonly createdAt: string;
}

export interface BriefRow {
  readonly id: string;
  readonly version: number;
  readonly status: string;
  readonly rawInputEn: string | null;
  readonly updatedAt: string;
}

function fail(what: string, code: string | undefined): never {
  throw new Error(`${what} failed (${code ?? "unknown"})`);
}

export async function listProjects(
  supabase: UserSupabase,
  orgId: string | null,
): Promise<ProjectSummary[]> {
  let query = supabase
    .from("sourcing_projects")
    .select("id, name, status, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (orgId) query = query.eq("org_id", orgId);
  const { data, error } = await query;
  if (error) fail("project list", error.code);
  return (data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    status: p.status,
    createdAt: p.created_at,
  }));
}

export async function getProject(
  supabase: UserSupabase,
  projectId: string,
  orgId: string | null,
): Promise<(ProjectSummary & { orgId: string }) | null> {
  let query = supabase
    .from("sourcing_projects")
    .select("id, org_id, name, status, created_at")
    .eq("id", projectId);
  if (orgId) query = query.eq("org_id", orgId);
  const { data, error } = await query.maybeSingle();
  if (error) fail("project read", error.code);
  return data
    ? {
        id: data.id,
        orgId: data.org_id,
        name: data.name,
        status: data.status,
        createdAt: data.created_at,
      }
    : null;
}

export async function latestBrief(
  supabase: UserSupabase,
  projectId: string,
): Promise<BriefRow | null> {
  const { data, error } = await supabase
    .from("buyer_briefs")
    .select("id, version, status, raw_input_en, updated_at")
    .eq("project_id", projectId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) fail("brief read", error.code);
  return data
    ? {
        id: data.id,
        version: data.version,
        status: data.status,
        rawInputEn: data.raw_input_en,
        updatedAt: data.updated_at,
      }
    : null;
}
