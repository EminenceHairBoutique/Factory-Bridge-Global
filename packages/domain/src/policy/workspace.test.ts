import { describe, expect, it } from "vitest";
import type { MemberRole } from "../enums.js";
import {
  canManageTeam,
  canWriteBuyerProjects,
  eligibleMemberships,
  landingWorkspace,
  resolveWorkspace,
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

describe("workspace gating (ADR-041 §4)", () => {
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
