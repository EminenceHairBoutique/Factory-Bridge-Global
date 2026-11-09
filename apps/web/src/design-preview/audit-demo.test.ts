import { describe, expect, it } from "vitest";
import { AUDIT_EVENTS, AUDIT_NOW } from "./demo-data/audit";
import {
  EMPTY_FILTER,
  REDACTED,
  entityChain,
  exportEvent,
  exportFileName,
  filterEvents,
  privilegedAccess,
  readEvent,
  redactDiff,
  requestGroup,
  scopedAccess,
  scopedEvents,
  scopedSecurity,
  toAuditCsv,
  validateDateRange,
} from "./audit-demo";

const ev = (id: string) => AUDIT_EVENTS.find((e) => e.id === id)!;

describe("scope by role (permission matrix row audit_events)", () => {
  it("limits an assigned operator to events of assigned projects and hides security events", () => {
    const op = scopedEvents("operator");
    expect(
      op.every(
        (e) =>
          e.projectId === "prj_demo_labels" ||
          e.projectId === "prj_demo_cartons" ||
          e.projectId === "prj_demo_mailers",
      ),
    ).toBe(true);
    expect(op.some((e) => e.entityTable === "supplier_contacts")).toBe(false);
    expect(op.some((e) => e.id === "e21")).toBe(false);
    expect(scopedEvents("compliance")).toHaveLength(AUDIT_EVENTS.length);
    expect(scopedSecurity("operator")).toEqual([]);
    expect(scopedSecurity("admin")).toHaveLength(5);
    expect(scopedAccess("operator").map((a) => a.id)).toEqual(["a1", "a2", "a3", "a4"]);
  });
});

describe("filters (AC-A1.1: org, entity, date)", () => {
  it("filters by entity table, org, acting-as, date range, request and text, newest first", () => {
    const all = scopedEvents("compliance");
    expect(
      filterEvents(all, { ...EMPTY_FILTER, entityTable: "quotations" }).map((e) => e.id),
    ).toEqual(["e03", "e02", "e04", "e01"]);
    expect(
      filterEvents(all, { ...EMPTY_FILTER, org: "Second Demo Buyer LLC" }).map((e) => e.id),
    ).toEqual(["e08", "e21", "e04"]);
    expect(filterEvents(all, { ...EMPTY_FILTER, actingAs: "system" }).map((e) => e.id)).toEqual([
      "e16",
      "e11",
      "e23",
    ]);
    expect(
      filterEvents(all, { ...EMPTY_FILTER, from: "2026-11-07", to: "2026-11-07" }).map((e) => e.id),
    ).toEqual(["e20", "e13"]);
    expect(filterEvents(all, { ...EMPTY_FILTER, requestId: "r-1106-m2" }).map((e) => e.id)).toEqual(
      ["e16", "e15"],
    );
    expect(filterEvents(all, { ...EMPTY_FILTER, text: "withdraw" }).map((e) => e.id)).toEqual([
      "e04",
    ]);
    expect(validateDateRange("2026-11-07", "2026-11-01")).toBe(
      "The start date is after the end date.",
    );
    expect(requestGroup(all, "r-1015-b").map((e) => e.id)).toEqual(["e02", "e03"]);
  });
});

describe("hash chain per entity", () => {
  it("links consistent chains, flags a backfill as unverifiable, and detects a mismatch", () => {
    expect(entityChain(AUDIT_EVENTS, "supplier_messages", "m_tooling").state).toBe("consistent");
    expect(
      entityChain(AUDIT_EVENTS, "quotations", "q_labels_v1").links.map((l) => l.state),
    ).toEqual(["first", "linked"]);
    expect(entityChain(AUDIT_EVENTS, "sourcing_projects", "prj_demo_labels").state).toBe(
      "unverifiable",
    );
    const tampered = AUDIT_EVENTS.map((e) =>
      e.id === "e10" ? { ...e, beforeHash: "000000000000" } : e,
    );
    expect(entityChain(tampered, "documents", "d_quote_d").state).toBe("mismatch");
    expect(entityChain(AUDIT_EVENTS, "supplier_contacts", "c_supb_export").links).toHaveLength(1);
  });
});

describe("redaction, audited reads and exports", () => {
  it("redacts supplier contact handles for operators only", () => {
    expect(redactDiff(ev("e05"), "operator")?.handle).toEqual([null, REDACTED]);
    expect(redactDiff(ev("e05"), "operator")?.contact_basis).toEqual([
      null,
      "introduced_by_partner",
    ]);
    expect(redactDiff(ev("e05"), "compliance")?.handle).toEqual([null, "wx_demo_zhou"]);
    expect(redactDiff(ev("e20"), "admin")).toBeNull();
  });
  it("audits platform-admin reads and every export", () => {
    expect(readEvent("compliance", ev("e05"), AUDIT_NOW, 1)).toBeNull();
    expect(readEvent("admin", ev("e05"), AUDIT_NOW, 1)).toMatchObject({
      actingAs: "platform_admin",
      action: "read",
      entityTable: "audit_events",
    });
    expect(exportEvent("operator", 3, AUDIT_NOW, 2)).toMatchObject({
      actingAs: "internal",
      action: "export",
      entityLabel: "Exported 3 audit rows (Operator (demo) scope)",
    });
    expect(exportFileName("operator", "2026-11-07")).toBe("audit-export-operator-2026-11-07.csv");
  });
  it("writes a CSV with hashes, redacted diffs and hashed IPs only", () => {
    const csv = toAuditCsv([ev("e05"), ev("e04")], "operator").split("\n");
    expect(csv[0]).toBe(
      "at,actor,actor_org,acting_as,entity_table,entity_id,entity_label,action,entity_org,request_id,before_hash,after_hash,diff,ip_hash",
    );
    expect(csv[1]).toContain("[restricted]");
    expect(csv[1]).not.toContain("wx_demo_zhou");
    expect(csv[2]).toContain('"{""status"":[""confirmed"",""withdrawn""]');
    expect(csv.join("\n")).not.toMatch(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/);
  });
  it("lists the last 7 days of privileged access", () => {
    expect(privilegedAccess(AUDIT_NOW)).toEqual([
      {
        at: "2026-11-07T09:55:00Z",
        who: "Platform admin (demo)",
        what: "read supplier_contacts c_supb_export",
        source: "audit",
      },
      {
        at: "2026-11-07T09:55:00Z",
        who: "Platform admin (demo)",
        what: "privileged access supplier_contacts c_supb_export",
        source: "security",
      },
    ]);
  });
});
