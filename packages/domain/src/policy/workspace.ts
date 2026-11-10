/**
 * Workspace gating (B-05, ADR-041 §4). Pure: the web guard loads the actor's live memberships from the database on
 * every request and asks these functions which workspace and organization the request may act in. A preferred org
 * (the `fbg_org` cookie) is only a hint among memberships the database just returned — never a grant.
 */
import type { MemberRole, OrgType } from "../enums.js";

export type WorkspaceKind = "buyer" | "supplier" | "internal";

/** Workspace ↔ the only org_type allowed into it. */
export const WORKSPACE_ORG_TYPE: Readonly<Record<WorkspaceKind, OrgType>> = {
  buyer: "buyer",
  supplier: "supplier",
  internal: "internal",
};

/** Route root of each workspace (docs/UX_INFORMATION_ARCHITECTURE.md §2). */
export const WORKSPACE_PATH: Readonly<Record<WorkspaceKind, "/app" | "/supplier" | "/ops">> = {
  buyer: "/app",
  supplier: "/supplier",
  internal: "/ops",
};

/** Roles that may enter each workspace. Internal roles never fit a buyer/supplier org and vice versa. */
export const WORKSPACE_ROLES: Readonly<Record<WorkspaceKind, readonly MemberRole[]>> = {
  buyer: ["owner", "admin", "member", "viewer"],
  supplier: ["owner", "admin", "member", "viewer"],
  internal: ["operator", "compliance_reviewer", "platform_admin"],
};

export interface WorkspaceMembership {
  readonly orgId: string;
  readonly orgType: OrgType;
  readonly orgStatus: "active" | "suspended" | "archived";
  readonly role: MemberRole;
  readonly status: "active" | "suspended";
}

export type WorkspaceDecision =
  | { allow: true; membership: WorkspaceMembership }
  | { allow: false; reason: "no_eligible_membership" };

export function workspaceForOrgType(orgType: OrgType): WorkspaceKind {
  switch (orgType) {
    case "internal":
      return "internal";
    case "supplier":
      return "supplier";
    case "buyer":
      return "buyer";
  }
}

function usable(m: WorkspaceMembership): boolean {
  return (
    m.status === "active" &&
    m.orgStatus === "active" &&
    WORKSPACE_ROLES[workspaceForOrgType(m.orgType)].includes(m.role)
  );
}

/** Active memberships in active organizations of the workspace's org type, with a role that fits it. */
export function eligibleMemberships(
  memberships: readonly WorkspaceMembership[],
  kind: WorkspaceKind,
): WorkspaceMembership[] {
  return memberships.filter((m) => m.orgType === WORKSPACE_ORG_TYPE[kind] && usable(m));
}

/**
 * Which membership a request into `kind` acts under: the preferred org when it is eligible, otherwise the first
 * eligible one (stable order from the caller). No eligible membership ⇒ deny.
 */
export function resolveWorkspace(
  memberships: readonly WorkspaceMembership[],
  kind: WorkspaceKind,
  preferredOrgId: string | null | undefined,
): WorkspaceDecision {
  const eligible = eligibleMemberships(memberships, kind);
  const chosen = eligible.find((m) => m.orgId === preferredOrgId) ?? eligible[0];
  return chosen
    ? { allow: true, membership: chosen }
    : { allow: false, reason: "no_eligible_membership" };
}

/** Where a signed-in user lands: the preferred org's workspace if usable, else the first usable one, else null. */
export function landingWorkspace(
  memberships: readonly WorkspaceMembership[],
  preferredOrgId: string | null | undefined,
): { kind: WorkspaceKind; orgId: string } | null {
  const all = memberships.filter(usable);
  const chosen = all.find((m) => m.orgId === preferredOrgId) ?? all[0];
  return chosen ? { kind: workspaceForOrgType(chosen.orgType), orgId: chosen.orgId } : null;
}

/** Buyer project / brief writes (mirrors 0008 sourcing_projects_insert and buyer_briefs_insert/update). */
export function canWriteBuyerProjects(role: MemberRole): boolean {
  return role === "owner" || role === "admin" || role === "member";
}

/** Team management: invites and role changes (mirrors app.create_invite / app.update_membership / list_org_members). */
export function canManageTeam(role: MemberRole): boolean {
  return role === "owner" || role === "admin";
}

/** Roles an owner/admin may grant through an invite or a role change (mirrors app.create_invite). */
export const INVITABLE_ROLES: readonly MemberRole[] = ["owner", "admin", "member", "viewer"];
