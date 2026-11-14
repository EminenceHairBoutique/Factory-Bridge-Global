/**
 * The one authorization gate for every workspace page and server action (B-05, ADR-042 §4).
 *
 * Per request, in order:
 *   1. `auth.getUser()` — Supabase Auth validates the access token *and* that its session still exists, so a session
 *      revoked by a role change (migration 0013 trigger) is refused here on the next request.
 *   2. The user's active memberships joined to their organizations, read with the user's JWT (RLS applies).
 *   3. `@fbg/domain/workspace` decides which workspace / organization the request acts in. The `fbg_org` cookie is only
 *      a preference among memberships the database just returned; no role or org is ever read from the JWT.
 *   4. B-05b (ADR-043 §1): the internal workspace also needs authenticator assurance level 2, a TOTP challenge
 *      verified in this session. The level is the `aal` claim of the token step 1 just validated; the database checks
 *      the same claim again (migration 0014: internal roles count only at aal2).
 * Outcomes: not configured / signed out → sign-in; no usable membership at all → onboarding; signed in but not
 * eligible for this workspace → 404 (the route does not reveal anything about the user's other access); internal
 * staff below aal2 → /ops/mfa/verify (factor enrolled) or /ops/mfa/enroll.
 *
 * Layouts are not re-run on client navigations, so pages and actions call this themselves; a unit test asserts that
 * every workspace page and action module does.
 */
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import {
  landingWorkspace,
  mfaStep,
  resolveWorkspace,
  WORKSPACE_PATH,
  type WorkspaceKind,
  type WorkspaceMembership,
} from "@fbg/domain/workspace";
import { aalFromAccessToken, hasVerifiedTotp, type Assurance } from "./assurance";
import { ONBOARDING_PATH, SIGN_IN_PATH, isUuid, mfaHref, signInHref } from "./paths";
import { createServerSupabase, type UserSupabase } from "./supabase";

export const ACTIVE_ORG_COOKIE = "fbg_org";

export interface SessionUser {
  readonly id: string;
  readonly email: string;
}

export interface LoadedMembership extends WorkspaceMembership {
  readonly membershipId: string;
  readonly orgName: string;
  readonly orgNameZh: string | null;
}

export interface SignedIn {
  readonly supabase: UserSupabase;
  readonly user: SessionUser;
  readonly assurance: Assurance;
  readonly memberships: readonly LoadedMembership[];
}

export interface WorkspaceContext extends SignedIn {
  readonly kind: WorkspaceKind;
  readonly active: LoadedMembership;
}

export type SessionState =
  | { status: "not_configured" }
  | { status: "signed_out"; supabase: UserSupabase }
  | { status: "signed_in"; supabase: UserSupabase; user: SessionUser; assurance: Assurance };

/** Who is signed in, validated by Supabase Auth (never from the cookie alone). */
export async function currentSession(): Promise<SessionState> {
  const supabase = await createServerSupabase();
  if (!supabase) return { status: "not_configured" };
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return { status: "signed_out", supabase };
  // getUser() has just validated this session's access token with Supabase Auth; read its `aal` claim (ADR-043 §1).
  // Only the token is taken from the session, never session.user: getUser's fresh user carries the factors.
  const { data: current } = await supabase.auth.getSession();
  return {
    status: "signed_in",
    supabase,
    user: { id: data.user.id, email: (data.user.email ?? "").toLowerCase() },
    assurance: {
      level: aalFromAccessToken(current.session?.access_token),
      hasVerifiedFactor: hasVerifiedTotp(data.user.factors),
    },
  };
}

const ORG_STATUSES = ["active", "suspended", "archived"] as const;

/** Active memberships of the signed-in user, oldest first, read through RLS. Throws on a database error (fail closed). */
export async function loadMemberships(
  supabase: UserSupabase,
  userId: string,
): Promise<LoadedMembership[]> {
  const { data, error } = await supabase
    .from("memberships")
    .select(
      "id, org_id, role, status, created_at, organizations!inner(id, org_type, display_name, display_name_zh, status)",
    )
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });
  if (error) throw new Error(`membership lookup failed (${error.code ?? "unknown"})`);
  return (data ?? []).map((row) => {
    const org = row.organizations;
    const orgStatus = (ORG_STATUSES as readonly string[]).includes(org.status)
      ? (org.status as LoadedMembership["orgStatus"])
      : "suspended";
    return {
      membershipId: row.id,
      orgId: row.org_id,
      orgType: org.org_type,
      orgStatus,
      orgName: org.display_name,
      orgNameZh: org.display_name_zh,
      role: row.role,
      status: row.status === "active" ? "active" : "suspended",
    };
  });
}

export async function preferredOrgId(): Promise<string | null> {
  const value = (await cookies()).get(ACTIVE_ORG_COOKIE)?.value;
  return isUuid(value) ? value : null;
}

/** Where a signed-in user should land: their preferred org's workspace, the first usable one, or onboarding. */
export function landingPath(
  memberships: readonly LoadedMembership[],
  preferred: string | null,
): string {
  const landing = landingWorkspace(memberships, preferred);
  return landing ? WORKSPACE_PATH[landing.kind] : ONBOARDING_PATH;
}

/** Signed-in user with live memberships, or a redirect to sign-in (carrying `nextPath` when it is allowed). */
export async function requireSignedIn(nextPath?: string): Promise<SignedIn> {
  const session = await currentSession();
  if (session.status === "not_configured") redirect(SIGN_IN_PATH);
  if (session.status === "signed_out") redirect(signInHref(nextPath));
  const memberships = await loadMemberships(session.supabase, session.user.id);
  return {
    supabase: session.supabase,
    user: session.user,
    assurance: session.assurance,
    memberships,
  };
}

/** Gate for `/app` (buyer), `/supplier` (supplier) and `/ops` (internal; aal2 required, ADR-043). */
export async function requireWorkspace(
  kind: WorkspaceKind,
  nextPath: string,
): Promise<WorkspaceContext> {
  const ctx = await resolveContext(kind, nextPath);
  const step = mfaStep(kind, ctx.assurance.level, ctx.assurance.hasVerifiedFactor);
  if (step !== "none") redirect(mfaHref(step, nextPath));
  return ctx;
}

/**
 * Gate for the MFA enrolment and challenge pages ONLY (`/ops/mfa/*`, asserted by workspace-guard.test.ts): internal
 * staff who are signed in but may still be at aal1. Everyone else gets exactly what requireWorkspace("internal")
 * gives them (sign-in, onboarding or 404), so these pages reveal nothing to buyers or suppliers. Never show data here:
 * the database ignores internal roles below aal2 anyway (migration 0014).
 */
export async function requireStaffForMfa(nextPath: string): Promise<WorkspaceContext> {
  return resolveContext("internal", nextPath);
}

/** Signed in with an eligible membership for `kind`, else sign-in / onboarding / 404. Does not check assurance. */
async function resolveContext(kind: WorkspaceKind, nextPath: string): Promise<WorkspaceContext> {
  const signedIn = await requireSignedIn(nextPath);
  const decision = resolveWorkspace(signedIn.memberships, kind, await preferredOrgId());
  if (!decision.allow) {
    if (landingWorkspace(signedIn.memberships, null) === null) redirect(ONBOARDING_PATH);
    notFound();
  }
  const active = signedIn.memberships.find((m) => m.orgId === decision.membership.orgId);
  if (!active) notFound();
  return { ...signedIn, kind, active };
}
