import { describe, expect, it } from "vitest";
import type { MemberRole } from "../enums.js";
import {
  assuranceLevel,
  canManageTeam,
  canProvisionStaff,
  canWriteBuyerProjects,
  eligibleMemberships,
  landingWorkspace,
  mfaStep,
  resolveWorkspace,
  STAFF_INVITABLE_ROLES,
  workspaceForOrgType,
  type WorkspaceMembership,
} from "./workspace.js";

const m = (
  over: Partial<WorkspaceMembership> & Pick<WorkspaceMembership, "orgId">,
): WorkspaceMembership => ({
  orgType: "buyer",
  orgStatus: "active",
  role: "member",
  status: "active",
  ...over,
});

const buyerA = m({ orgId: "a", role: "owner" });
const buyerB = m({ orgId: "b", role: "viewer" });
const supplierS = m({ orgId: "s", orgType: "supplier", role: "admin" });
const internal = m({ orgId: "i", orgType: "internal", role: "operator" });

describe("workspace gating (ADR-042 §4)", () => {
  it("maps org types to workspaces", () => {
    expect(workspaceForOrgType("buyer")).toBe("buyer");
    expect(workspaceForOrgType("supplier")).toBe("supplier");
    expect(workspaceForOrgType("internal")).toBe("internal");
  });

  it("a buyer cannot enter /ops or /supplier; a supplier cannot enter /app or /ops; staff cannot enter /app", () => {
    expect(resolveWorkspace([buyerA], "internal", null)).toEqual({
      allow: false,
      reason: "no_eligible_membership",
    });
    expect(resolveWorkspace([buyerA], "supplier", null).allow).toBe(false);
    expect(resolveWorkspace([supplierS], "buyer", null).allow).toBe(false);
    expect(resolveWorkspace([supplierS], "internal", null).allow).toBe(false);
    expect(resolveWorkspace([internal], "buyer", null).allow).toBe(false);
    expect(resolveWorkspace([], "buyer", null).allow).toBe(false);
  });

  it("uses the preferred org only when it is eligible for that workspace", () => {
    const all = [buyerA, buyerB, supplierS, internal];
    expect(resolveWorkspace(all, "buyer", "b")).toEqual({ allow: true, membership: buyerB });
    // a supplier org id as the buyer preference falls back to the first eligible buyer org
    expect(resolveWorkspace(all, "buyer", "s")).toEqual({ allow: true, membership: buyerA });
    // an unknown / forged id falls back too — it never grants anything
    expect(resolveWorkspace(all, "buyer", "zzz")).toEqual({ allow: true, membership: buyerA });
    expect(resolveWorkspace(all, "supplier", "a")).toEqual({ allow: true, membership: supplierS });
  });

  it("suspended memberships and suspended or archived orgs are not eligible", () => {
    expect(resolveWorkspace([m({ orgId: "a", status: "suspended" })], "buyer", "a").allow).toBe(
      false,
    );
    expect(resolveWorkspace([m({ orgId: "a", orgStatus: "suspended" })], "buyer", "a").allow).toBe(
      false,
    );
    expect(resolveWorkspace([m({ orgId: "a", orgStatus: "archived" })], "buyer", "a").allow).toBe(
      false,
    );
  });

  it("a role that does not fit the org type is never eligible (defence against bad rows)", () => {
    expect(eligibleMemberships([m({ orgId: "a", role: "operator" })], "buyer")).toEqual([]);
    expect(
      eligibleMemberships([m({ orgId: "i", orgType: "internal", role: "owner" })], "internal"),
    ).toEqual([]);
  });

  it("landing: preferred usable org, else the first usable one, else none", () => {
    expect(landingWorkspace([buyerA, supplierS], "s")).toEqual({ kind: "supplier", orgId: "s" });
    expect(landingWorkspace([buyerA, supplierS], null)).toEqual({ kind: "buyer", orgId: "a" });
    expect(landingWorkspace([internal], null)).toEqual({ kind: "internal", orgId: "i" });
    expect(landingWorkspace([m({ orgId: "a", status: "suspended" })], "a")).toBeNull();
    expect(landingWorkspace([], null)).toBeNull();
  });

  it("write and team-management rights per role", () => {
    const writers: MemberRole[] = ["owner", "admin", "member"];
    expect(writers.every(canWriteBuyerProjects)).toBe(true);
    expect(canWriteBuyerProjects("viewer")).toBe(false);
    expect(canManageTeam("owner")).toBe(true);
    expect(canManageTeam("admin")).toBe(true);
    expect(canManageTeam("member")).toBe(false);
    expect(canManageTeam("viewer")).toBe(false);
  });
});

describe("MFA gating (ADR-043)", () => {
  it("only the internal workspace needs aal2; verify when a factor exists, else enrol", () => {
    for (const kind of ["buyer", "supplier"] as const) {
      expect(mfaStep(kind, "aal1", false)).toBe("none");
      expect(mfaStep(kind, "aal1", true)).toBe("none");
    }
    expect(mfaStep("internal", "aal1", false)).toBe("enroll");
    expect(mfaStep("internal", "aal1", true)).toBe("verify");
    expect(mfaStep("internal", "aal2", true)).toBe("none");
    // aal2 without a listed factor (factor removed by an admin mid-session) still passes this request; RLS reads the
    // same claim. The next sign-in starts at aal1 and must enrol again.
    expect(mfaStep("internal", "aal2", false)).toBe("none");
  });

  it("reads the aal claim strictly: anything but 'aal2' is aal1", () => {
    expect(assuranceLevel("aal2")).toBe("aal2");
    for (const v of ["aal1", "AAL2", "aal3", "", null, undefined, 2, { aal: "aal2" }]) {
      expect(assuranceLevel(v)).toBe("aal1");
    }
  });

  it("only platform admins provision staff, and only as operator or compliance reviewer", () => {
    const all: MemberRole[] = [
      "owner",
      "admin",
      "member",
      "viewer",
      "operator",
      "compliance_reviewer",
      "platform_admin",
    ];
    expect(all.filter(canProvisionStaff)).toEqual(["platform_admin"]);
    expect([...STAFF_INVITABLE_ROLES]).toEqual(["operator", "compliance_reviewer"]);
    expect(STAFF_INVITABLE_ROLES).not.toContain("platform_admin");
  });
});
