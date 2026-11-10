import { describe, expect, it } from "vitest";
import { BUYER_CASES, CASES_NOW } from "./demo-data/ops-cases";
import {
  applyEscalate,
  applyReopen,
  applyReply,
  applyResolve,
  buyerVisibleUpdates,
  caseSla,
  casesSummary,
  claimsCheck,
  priorityOf,
  sortCases,
  targetDueAt,
  validateReply,
  validateResolution,
} from "./cases-demo";

const byId = (id: string) => BUYER_CASES.find((c) => c.id === id)!;

describe("targets and priority (internal only)", () => {
  it("derives the target from the category and shows it only while the case is open", () => {
    expect(targetDueAt(byId("c_duty"))).toBe("2026-11-07T16:00:00.000Z");
    expect(caseSla(byId("c_duty"), CASES_NOW)?.state).toBe("due_soon");
    expect(caseSla(byId("c_slow"), CASES_NOW)?.state).toBe("overdue");
    expect(caseSla(byId("c_price"), CASES_NOW)).toBeNull();
    expect(caseSla(byId("c_xlsx"), CASES_NOW)).toBeNull();
  });
  it("marks complaints, escalations, data issues and overdue cases high; never a resolved one", () => {
    expect(priorityOf(byId("c_slow"), CASES_NOW)).toBe("high");
    expect(priorityOf(byId("c_price"), CASES_NOW)).toBe("high");
    expect(priorityOf(byId("c_duty"), CASES_NOW)).toBe("normal");
    expect(priorityOf(byId("c_verified"), CASES_NOW)).toBe("normal");
  });
});

describe("replies to buyers", () => {
  it("blocks claims and response-time promises (CLAUDE.md §4)", () => {
    expect(
      claimsCheck("We guarantee delivery and the lowest price from a verified factory."),
    ).toEqual(["“lowest price”", "“guarantee”", "“verified factory”"]);
    expect(claimsCheck("You will hear back within 24 business hours.")).toEqual([
      "a response-time promise",
    ]);
    expect(
      claimsCheck("The rate was recorded by your user with the broker's advice as its basis."),
    ).toEqual([]);
  });
  it("requires text and, for data issues, the record it concerns", () => {
    expect(validateReply({ text: "short", linkedIndex: null }, byId("c_price"))).toEqual([
      "Write the reply (at least 10 characters).",
      "A data-issue reply must name the record it corrects or confirms.",
    ]);
    expect(
      validateReply(
        { text: "Both tiers are on the quotation; the comparison runs at 10,000.", linkedIndex: 0 },
        byId("c_price"),
      ),
    ).toEqual([]);
    expect(
      validateReply(
        { text: "Guaranteed answer within 2 days.", linkedIndex: null },
        byId("c_duty"),
      )[0],
    ).toContain("Remove");
  });
  it("makes the reply buyer-visible with its record and hands the case to the buyer", () => {
    const c = applyReply(
      byId("c_duty"),
      {
        text: "A person recorded the duty rate with broker advice as its basis; nothing fills it automatically.",
        linkedIndex: 0,
      },
      "Operator 2 (demo)",
      "2026-11-07 10:30",
    );
    expect(c.status).toBe("awaiting_buyer");
    const visible = buyerVisibleUpdates(c);
    expect(visible[visible.length - 1]).toMatchObject({
      kind: "reply",
      linked: { kind: "snapshot" },
      buyerVisible: true,
    });
    expect(c.updates.filter((u) => u.kind === "internal_note").every((u) => !u.buyerVisible)).toBe(
      true,
    );
  });
});

describe("resolve, escalate, reopen", () => {
  it("needs a code and a note, then records a buyer-visible resolution", () => {
    expect(validateResolution(null, "")).toEqual([
      "Choose a resolution.",
      "Write what resolved it (at least 10 characters); the buyer sees this.",
    ]);
    const c = applyResolve(
      byId("c_price"),
      "no_action",
      "Both tiers were on the quotation; the comparison was right.",
      "Operator (demo)",
      "2026-11-07 10:40",
    );
    expect(c.status).toBe("resolved");
    expect(c.resolution?.code).toBe("no_action");
    expect(c.updates[c.updates.length - 1]).toMatchObject({ kind: "status", buyerVisible: true });
    const re = applyReopen(c, "Thanks, but the PDF header says 5,000 minimum.", "2026-11-08 09:00");
    expect(re.status).toBe("open");
    expect(re.resolution).toBeNull();
  });
  it("records an escalation as internal", () => {
    const c = applyEscalate(
      byId("c_duty"),
      "Founder",
      "Buyer asks for a written policy on duty sourcing.",
      "Operator 2 (demo)",
      "t",
    );
    expect(c.escalation?.to).toBe("Founder");
    expect(c.updates[c.updates.length - 1]?.buyerVisible).toBe(false);
  });
});

describe("list", () => {
  it("summarises and orders: overdue, open high, open, awaiting buyer, resolved", () => {
    expect(casesSummary(BUYER_CASES, CASES_NOW)).toEqual({
      open: 2,
      overdue: 1,
      awaitingBuyer: 1,
      escalated: 1,
    });
    expect(sortCases(BUYER_CASES, CASES_NOW).map((c) => c.id)).toEqual([
      "c_slow",
      "c_duty",
      "c_price",
      "c_xlsx",
      "c_verified",
    ]);
  });
});
