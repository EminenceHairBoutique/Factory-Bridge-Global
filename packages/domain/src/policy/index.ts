/**
 * Server-side authorization layer (SECURITY_PERMISSION_MATRIX.md §2). Pure function of the actor's live
 * memberships/assignments — the caller loads them from the database on every request (never from a cached
 * JWT claim). RLS is the second layer; both must agree, and the DB suite + these tests enumerate the matrix.
 *
 * Scope of this file: tenancy + audit resources (migrations 0002–0003). Later migrations add their resources.
 */
import type { MemberRole, OrgType } from "../enums.js";

export interface ActorMembership {
  readonly orgId: string;
  readonly orgType: OrgType;
  readonly role: MemberRole;
  readonly status: "active" | "suspended";
}

export interface Actor {
  readonly userId: string | null; // null = anonymous
  readonly memberships: readonly ActorMembership[];
  readonly assignedProjectIds: readonly string[];
}

export type Action = "read" | "create" | "update" | "invite" | "manage_members" | "read_audit";

export type Resource =
  | { kind: "organization"; orgId: string }
  | { kind: "membership"; orgId: string; userId: string }
  | { kind: "invite"; orgId: string }
  | { kind: "audit_event"; entityOrgId: string | null }
  | { kind: "security_event" }
  | { kind: "document_access_log" };

export type Decision = { allow: true } | { allow: false; reason: string };

const allow: Decision = { allow: true };
const deny = (reason: string): Decision => ({ allow: false, reason });

const BUYER_SUPPLIER_ROLES: readonly MemberRole[] = ["owner", "admin", "member", "viewer"];
const INTERNAL_ROLES: readonly MemberRole[] = ["operator", "compliance_reviewer", "platform_admin"];

function active(actor: Actor): readonly ActorMembership[] {
  return actor.memberships.filter((m) => m.status === "active");
}

export function isMember(actor: Actor, orgId: string): boolean {
  return active(actor).some((m) => m.orgId === orgId);
}

export function hasRole(actor: Actor, orgId: string, roles: readonly MemberRole[]): boolean {
  return active(actor).some((m) => m.orgId === orgId && roles.includes(m.role));
}

export function isInternal(actor: Actor): boolean {
  return active(actor).some((m) => m.orgType === "internal");
}

export function isPlatformAdmin(actor: Actor): boolean {
  return active(actor).some((m) => m.orgType === "internal" && m.role === "platform_admin");
}

export function isComplianceReviewer(actor: Actor): boolean {
  return active(actor).some((m) => m.orgType === "internal" && m.role === "compliance_reviewer");
}

/** Validates that a role is legal for an org type (mirrors trigger app.enforce_membership_role). */
export function roleFitsOrgType(role: MemberRole, orgType: OrgType): boolean {
  return orgType === "internal"
    ? INTERNAL_ROLES.includes(role)
    : BUYER_SUPPLIER_ROLES.includes(role);
}

export function can(actor: Actor, action: Action, resource: Resource): Decision {
  if (actor.userId === null) return deny("authentication required");

  switch (resource.kind) {
    case "organization": {
      switch (action) {
        case "read":
          return isMember(actor, resource.orgId) || isInternal(actor)
            ? allow
            : deny("not a member");
        case "update":
          return hasRole(actor, resource.orgId, ["owner", "admin"]) || isPlatformAdmin(actor)
            ? allow
            : deny("owner/admin or platform admin required");
        case "create":
          return allow; // any signed-in user may create a buyer/supplier org (becomes owner); internal org is seeded
        case "invite":
        case "manage_members":
          return hasRole(actor, resource.orgId, ["owner", "admin"]) || isPlatformAdmin(actor)
            ? allow
            : deny("owner/admin or platform admin required");
        case "read_audit":
          return hasRole(actor, resource.orgId, ["owner", "admin"]) ||
            isPlatformAdmin(actor) ||
            isComplianceReviewer(actor)
            ? allow
            : deny("owner/admin, compliance or platform admin required");
      }
      break;
    }
    case "membership": {
      switch (action) {
        case "read":
          return resource.userId === actor.userId ||
            isMember(actor, resource.orgId) ||
            isPlatformAdmin(actor)
            ? allow
            : deny("not a member of that organization");
        case "update":
        case "manage_members":
          return hasRole(actor, resource.orgId, ["owner", "admin"]) || isPlatformAdmin(actor)
            ? allow
            : deny("owner/admin or platform admin required");
        case "create":
          return deny("memberships are created only via invites or organization creation");
        case "invite":
        case "read_audit":
          return deny("unsupported action");
      }
      break;
    }
    case "invite": {
      switch (action) {
        case "read":
        case "create":
          return hasRole(actor, resource.orgId, ["owner", "admin"]) || isPlatformAdmin(actor)
            ? allow
            : deny("owner/admin or platform admin required");
        case "update":
        case "invite":
        case "manage_members":
        case "read_audit":
          return deny("unsupported action");
      }
      break;
    }
    case "audit_event": {
      if (action !== "read" && action !== "read_audit") return deny("audit events are append-only");
      if (isPlatformAdmin(actor) || isComplianceReviewer(actor)) return allow;
      if (resource.entityOrgId && hasRole(actor, resource.entityOrgId, ["owner", "admin"]))
        return allow;
      return deny(
        "owner/admin of the entity's organization, compliance or platform admin required",
      );
    }
    case "security_event": {
      if (action !== "read") return deny("security events are written by the system only");
      return isPlatformAdmin(actor) || isComplianceReviewer(actor)
        ? allow
        : deny("compliance or platform admin required");
    }
    case "document_access_log": {
      if (action !== "read") return deny("access logs are written by the system only");
      return isInternal(actor) ? allow : deny("internal staff only");
    }
  }
  return deny("unsupported action");
}
