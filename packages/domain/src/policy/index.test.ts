import { describe, expect, it } from "vitest";
import { can, roleFitsOrgType, type Actor } from "./index.js";

const INTERNAL = "internal-org";
const A = "org-a";
const B = "org-b";

const actor = (overrides: Partial<Actor> & { userId: string | null }): Actor => ({
  memberships: [],
  assignedProjectIds: [],
  ...overrides,
});

const aOwner = actor({
  userId: "u-a-owner",
  memberships: [{ orgId: A, orgType: "buyer", role: "owner", status: "active" }],
});
const aViewer = actor({
  userId: "u-a-viewer",
  memberships: [{ orgId: A, orgType: "buyer", role: "viewer", status: "active" }],
});
const bOwner = actor({
  userId: "u-b-owner",
  memberships: [{ orgId: B, orgType: "buyer", role: "owner", status: "active" }],
});
const opUnassigned = actor({
  userId: "u-op",
  memberships: [{ orgId: INTERNAL, orgType: "internal", role: "operator", status: "active" }],
});
const compliance = actor({
  userId: "u-comp",
  memberships: [
    { orgId: INTERNAL, orgType: "internal", role: "compliance_reviewer", status: "active" },
  ],
});
const admin = actor({
  userId: "u-admin",
  memberships: [{ orgId: INTERNAL, orgType: "internal", role: "platform_admin", status: "active" }],
});
const suspended = actor({
  userId: "u-susp",
  memberships: [{ orgId: A, orgType: "buyer", role: "owner", status: "suspended" }],
});
const anon = actor({ userId: null });

describe("policy: organizations (mirrors RLS in 0002)", () => {
  it("members read their org; other buyers do not; internal staff read profiles; anonymous denied", () => {
    expect(can(aOwner, "read", { kind: "organization", orgId: A }).allow).toBe(true);
    expect(can(aOwner, "read", { kind: "organization", orgId: B }).allow).toBe(false);
    expect(can(bOwner, "read", { kind: "organization", orgId: A }).allow).toBe(false);
    expect(can(opUnassigned, "read", { kind: "organization", orgId: A }).allow).toBe(true);
    expect(can(anon, "read", { kind: "organization", orgId: A })).toEqual({
      allow: false,
      reason: "authentication required",
    });
  });

  it("update: owner yes, viewer no, other org no, platform admin yes, unassigned operator no", () => {
    expect(can(aOwner, "update", { kind: "organization", orgId: A }).allow).toBe(true);
    expect(can(aViewer, "update", { kind: "organization", orgId: A }).allow).toBe(false);
    expect(can(bOwner, "update", { kind: "organization", orgId: A }).allow).toBe(false);
    expect(can(admin, "update", { kind: "organization", orgId: A }).allow).toBe(true);
    expect(can(opUnassigned, "update", { kind: "organization", orgId: A }).allow).toBe(false);
  });

  it("suspended membership grants nothing", () => {
    expect(can(suspended, "read", { kind: "organization", orgId: A }).allow).toBe(false);
    expect(can(suspended, "update", { kind: "organization", orgId: A }).allow).toBe(false);
  });
});

describe("policy: memberships and invites", () => {
  it("team visibility: own org yes, other org no, unassigned operator no, admin yes", () => {
    const m = { kind: "membership", orgId: A, userId: "u-a-viewer" } as const;
    expect(can(aOwner, "read", m).allow).toBe(true);
    expect(can(bOwner, "read", m).allow).toBe(false);
    expect(can(opUnassigned, "read", m).allow).toBe(false);
    expect(can(admin, "read", m).allow).toBe(true);
  });

  it("members are never created directly", () => {
    expect(can(aOwner, "create", { kind: "membership", orgId: A, userId: "x" }).allow).toBe(false);
  });

  it("invites: owner/admin only; viewer and other-org owners denied", () => {
    expect(can(aOwner, "create", { kind: "invite", orgId: A }).allow).toBe(true);
    expect(can(aViewer, "create", { kind: "invite", orgId: A }).allow).toBe(false);
    expect(can(bOwner, "read", { kind: "invite", orgId: A }).allow).toBe(false);
  });
});

describe("policy: audit and security events", () => {
  it("audit: entity-org owner, compliance and admin may read; viewer, other org and operator may not; never write", () => {
    const e = { kind: "audit_event", entityOrgId: A } as const;
    expect(can(aOwner, "read", e).allow).toBe(true);
    expect(can(aViewer, "read", e).allow).toBe(false);
    expect(can(bOwner, "read", e).allow).toBe(false);
    expect(can(opUnassigned, "read", e).allow).toBe(false);
    expect(can(compliance, "read", e).allow).toBe(true);
    expect(can(admin, "read", e).allow).toBe(true);
    expect(can(admin, "create", e).allow).toBe(false);
    expect(can(admin, "update", e).allow).toBe(false);
  });

  it("security events: compliance/admin only; access log: internal only", () => {
    expect(can(aOwner, "read", { kind: "security_event" }).allow).toBe(false);
    expect(can(compliance, "read", { kind: "security_event" }).allow).toBe(true);
    expect(can(opUnassigned, "read", { kind: "document_access_log" }).allow).toBe(true);
    expect(can(aOwner, "read", { kind: "document_access_log" }).allow).toBe(false);
  });
});

describe("roleFitsOrgType (mirrors trigger app.enforce_membership_role)", () => {
  it("internal roles only on internal org; buyer/supplier roles only elsewhere", () => {
    expect(roleFitsOrgType("operator", "internal")).toBe(true);
    expect(roleFitsOrgType("operator", "buyer")).toBe(false);
    expect(roleFitsOrgType("owner", "supplier")).toBe(true);
    expect(roleFitsOrgType("owner", "internal")).toBe(false);
  });
});
