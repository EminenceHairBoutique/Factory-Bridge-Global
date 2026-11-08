import { describe, expect, it } from "vitest";
import { OPS_SUPPLIERS, OPS_TODAY, type VerificationCheck } from "./demo-data/ops-suppliers";
import { badgesFromChecks, checksDue, contactCanBeSaved, stageGate } from "./ops-demo";

const passed = (
  type: VerificationCheck["type"],
  date: string,
  expiresAt: string | null,
): VerificationCheck => ({
  id: `${type}-${date}`,
  type,
  status: "passed",
  evidence: "file.pdf",
  reviewer: "Operator (demo)",
  date,
  expiresAt,
});

describe("badgesFromChecks (US-O4: badge text generated from completed checks only)", () => {
  it("generates nothing without a passed check", () => {
    expect(badgesFromChecks([], OPS_TODAY)).toEqual([]);
    expect(
      badgesFromChecks(
        [{ ...passed("identity_document_reviewed", "2026-10-01", null), status: "pending" }],
        OPS_TODAY,
      ),
    ).toEqual([]);
  });
  it("names the date and drops expired checks", () => {
    const b = badgesFromChecks(
      [passed("identity_document_reviewed", "2026-10-20", "2027-10-20")],
      OPS_TODAY,
    );
    expect(b.map((x) => x.label)).toEqual(["Identity reviewed (2026-10-20)"]);
    expect(
      badgesFromChecks(
        [passed("identity_document_reviewed", "2025-10-20", "2026-10-20")],
        OPS_TODAY,
      ),
    ).toEqual([]);
  });
  it("never produces sample or inspection badges from supplier checks", () => {
    const b = badgesFromChecks([passed("sample_received", "2026-10-27", null)], OPS_TODAY);
    expect(b).toEqual([]);
  });
});

describe("checksDue", () => {
  it("flags expiring and overdue checks and pending checks past their date", () => {
    const due = checksDue(
      [
        passed("address_corroborated", "2026-09-30", "2026-11-15"),
        passed("identity_document_reviewed", "2025-10-01", "2026-10-01"),
        { ...passed("video_call_held", "2026-11-01", null), status: "pending", evidence: null },
      ],
      OPS_TODAY,
    );
    expect(due.map((d) => [d.check.type, d.state])).toEqual([
      ["identity_document_reviewed", "overdue"],
      ["video_call_held", "overdue"],
      ["address_corroborated", "due_soon"],
    ]);
  });
});

describe("stageGate", () => {
  const a = OPS_SUPPLIERS.find((s) => s.id === "sup_a");
  const e = OPS_SUPPLIERS.find((s) => s.id === "sup_e");
  it("has no next stage at the top", () => {
    expect(
      a &&
        stageGate(
          a.stage,
          { contacts: a.contacts, checks: a.checks, facilities: 1, capacityDoc: true },
          OPS_TODAY,
        ).next,
    ).toBeNull();
  });
  it("requires passed identity and address checks before legal_identity_reviewed", () => {
    const g =
      e &&
      stageGate(
        e.stage,
        { contacts: e.contacts, checks: e.checks, facilities: 0, capacityDoc: false },
        OPS_TODAY,
      );
    expect(g?.next).toBe("legal_identity_reviewed");
    expect(g?.allowed).toBe(false);
    expect(g?.requirements.map((r) => r.met)).toEqual([false, false]);
  });
});

describe("contactCanBeSaved (AC-O2.1)", () => {
  it("refuses a WeChat handle without a contact basis", () => {
    expect(contactCanBeSaved("wechat", "demo_handle", "")).toMatch(/contact basis/);
    expect(contactCanBeSaved("wechat", "demo_handle", "supplier_provided_for_business")).toBeNull();
    expect(contactCanBeSaved("email", "", "public_business_listing")).toMatch(/Enter/);
  });
});
