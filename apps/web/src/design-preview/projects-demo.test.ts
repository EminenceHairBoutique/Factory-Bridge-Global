import { describe, expect, it } from "vitest";
import { DEMO_ACTIONS, DEMO_AS_OF, DEMO_PROJECTS, DEMO_QUOTES } from "./demo-data";
import {
  PROJECT_TABS,
  addDays,
  filterProjects,
  parseProjectTab,
  projectRoutes,
  quoteStatusSummary,
  rankActions,
  recentProjects,
  splitActions,
} from "./projects-demo";

describe("needs-your-attention ranking (UX-03 Overview)", () => {
  it("puts approvals that block other people first, then unconfirmed data, then time-bound items", () => {
    const kinds = rankActions(DEMO_ACTIONS).map((a) => a.kind);
    expect(kinds).toEqual([
      "approve_message",
      "review_extraction",
      "confirm_spec",
      "quote_expiring",
      "complete_brief",
    ]);
  });

  it("is stable within a kind and does not mutate the input", () => {
    const base = DEMO_ACTIONS[0];
    if (!base) throw new Error("fixtures missing");
    const x1 = { ...base, id: "x1", kind: "complete_brief" as const };
    const x2 = { ...base, id: "x2", kind: "complete_brief" as const };
    const input = [x2, x1];
    const copy = [...input];
    expect(rankActions(input).map((a) => a.id)).toEqual(["x2", "x1"]);
    expect(input).toEqual(copy);
  });

  it("shows three items by default and keeps the rest reachable, losing none", () => {
    const { primary, rest } = splitActions(DEMO_ACTIONS);
    expect(primary).toHaveLength(3);
    expect(rest).toHaveLength(DEMO_ACTIONS.length - 3);
    expect(new Set([...primary, ...rest].map((a) => a.id)).size).toBe(DEMO_ACTIONS.length);
  });
});

describe("recent projects", () => {
  it("returns the three most recently updated projects, newest first", () => {
    expect(recentProjects(DEMO_PROJECTS).map((p) => p.id)).toEqual([
      "prj_demo_labels",
      "prj_demo_cartons",
      "prj_demo_hair",
    ]);
  });
});

describe("project list filters (Projects page)", () => {
  it("matches the search query against the project name and family, case-insensitively", () => {
    expect(filterProjects(DEMO_PROJECTS, DEMO_ACTIONS, "all", "CARTON").map((p) => p.id)).toEqual([
      "prj_demo_cartons",
      "prj_demo_sleeves",
    ]);
    expect(filterProjects(DEMO_PROJECTS, DEMO_ACTIONS, "all", "  ")).toHaveLength(
      DEMO_PROJECTS.length,
    );
  });

  it("keeps the stage distinctions: comparison ready, quotes in review, needs my action", () => {
    expect(filterProjects(DEMO_PROJECTS, DEMO_ACTIONS, "ready").map((p) => p.id)).toEqual([
      "prj_demo_labels",
    ]);
    expect(filterProjects(DEMO_PROJECTS, DEMO_ACTIONS, "review").map((p) => p.id)).toEqual([
      "prj_demo_labels",
      "prj_demo_cartons",
    ]);
    expect(filterProjects(DEMO_PROJECTS, DEMO_ACTIONS, "action")).toHaveLength(4);
  });
});

describe("quote status summary (moved from the Overview to the Quotes page)", () => {
  it("adds calendar days to an ISO date", () => {
    expect(addDays("2026-11-07", 60)).toBe("2027-01-06");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("derives every count from the records and never from a typed headline", () => {
    const s = quoteStatusSummary(DEMO_PROJECTS, DEMO_QUOTES, DEMO_AS_OF);
    expect(s.confirmed).toBe(4);
    expect(s.inReview).toBe(3);
    // Suppliers A (2026-12-15), F (2026-12-20) and C (2026-12-31) fall within 60 days of 2026-11-07.
    expect(s.expiring).toBe(3);
    expect(s.expired).toBe(1); // Supplier D, 2026-10-31
    expect(s.unconfirmed).toBe(1); // Supplier B, no valid_until
  });

  it("does not count an already expired quote as expiring", () => {
    const s = quoteStatusSummary(DEMO_PROJECTS, DEMO_QUOTES, "2027-02-01");
    expect(s.expiring).toBe(0);
    expect(s.expired).toBe(DEMO_QUOTES.filter((q) => q.validUntil !== null).length);
  });
});

describe("project routes (no dead links on the Overview or Projects list)", () => {
  it("links only to screens that exist in the prototype", () => {
    const labels = projectRoutes("prj_demo_labels");
    expect(labels.record).toBe("/design-preview/buyer/project");
    expect(labels.nextAction).toBe("/design-preview/buyer/compare");
    expect(labels.options).toBe("/design-preview/buyer/project?tab=options");
    expect(labels.activity).toBe("/design-preview/buyer/project?tab=activity");

    const hair = projectRoutes("prj_demo_hair");
    expect(hair.record).toBeUndefined();
    expect(hair.nextAction).toBe("/design-preview/buyer/brief");

    expect(projectRoutes("prj_demo_sleeves").nextAction).toBe("/design-preview/buyer/new-request");
    expect(projectRoutes("prj_demo_cartons")).toEqual({});
  });
});

describe("project tab deep links", () => {
  it("accepts a known tab from the query string and falls back to overview", () => {
    expect(PROJECT_TABS).toContain("options");
    expect(parseProjectTab("messages")).toBe("messages");
    expect(parseProjectTab(["activity"])).toBe("activity");
    expect(parseProjectTab("quality")).toBe("quality");
    expect(parseProjectTab("nope")).toBe("overview");
    expect(parseProjectTab(undefined)).toBe("overview");
  });
});
