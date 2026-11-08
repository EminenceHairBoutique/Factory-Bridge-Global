import { describe, expect, it } from "vitest";
import { DEMO_DOCUMENTS, type DemoDocument } from "./demo-data/documents";
import {
  advanceDocument,
  canDiscard,
  canIssueLink,
  documentSummary,
  formatBytes,
  matchesStatusFilter,
  nextStatus,
  validateUploads,
} from "./documents-demo";

describe("validateUploads", () => {
  it("accepts the Phase 1 allow-list and rejects everything else", () => {
    const r = validateUploads([
      { name: "quote.pdf", type: "application/pdf", size: 1000 },
      {
        name: "sheet.xlsx",
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        size: 1000,
      },
      { name: "photo.JPG", type: "image/jpeg", size: 1000 },
      { name: "logo.svg", type: "image/svg+xml", size: 1000 },
      { name: "page.html", type: "text/html", size: 1000 },
      { name: "bundle.zip", type: "application/zip", size: 1000 },
      { name: "old.xls", type: "application/vnd.ms-excel", size: 1000 },
    ]);
    expect(r.accepted.map((f) => f.name)).toEqual(["quote.pdf", "sheet.xlsx", "photo.JPG"]);
    expect(r.rejected.map((f) => f.name)).toEqual([
      "logo.svg",
      "page.html",
      "bundle.zip",
      "old.xls",
    ]);
  });
  it("rejects oversize, empty and mismatched-extension files with a reason", () => {
    const r = validateUploads([
      { name: "big.pdf", type: "application/pdf", size: 25 * 1024 * 1024 + 1 },
      { name: "empty.pdf", type: "application/pdf", size: 0 },
      { name: "renamed.exe", type: "application/pdf", size: 10 },
    ]);
    expect(r.accepted).toHaveLength(0);
    expect(r.rejected.map((f) => f.reason)).toEqual([
      "larger than 25 MB",
      "empty file",
      "file extension does not match its type",
    ]);
  });
});

describe("nextStatus", () => {
  it("walks a quotation to review and stops artwork at parsed", () => {
    const walk = (kind: "quote" | "artwork") => {
      const out: string[] = [];
      let s: ReturnType<typeof nextStatus> = "uploaded";
      while (s) {
        out.push(s);
        s = nextStatus(s, kind);
      }
      return out;
    };
    expect(walk("quote")).toEqual(["uploaded", "scanning", "parsed", "extracted", "in_review"]);
    expect(walk("artwork")).toEqual(["uploaded", "scanning", "parsed"]);
    expect(nextStatus("rejected", "quote")).toBeNull();
    expect(nextStatus("accepted", "quote")).toBeNull();
  });
});

describe("advanceDocument", () => {
  it("walks a simulated quotation upload to review and then stops", () => {
    const base = DEMO_DOCUMENTS.find((d) => d.id === "d_photo_j")!;
    let doc: DemoDocument = { ...base, status: "uploaded", events: [base.events[0]!] };
    const seen: string[] = [];
    for (let i = 0; i < 6; i += 1) {
      doc = advanceDocument(doc, `2026-11-07T10:0${i}:00Z`);
      seen.push(doc.status);
    }
    expect(seen).toEqual([
      "scanning",
      "parsed",
      "extracted",
      "in_review",
      "in_review",
      "in_review",
    ]);
    expect(doc.events).toHaveLength(5);
    expect(doc.scan.result).toBe("passed");
    expect(doc.extraction?.promptVersion).toContain("simulated");
  });
});

describe("canDiscard and canIssueLink", () => {
  it("protects quotation evidence and quarantined files", () => {
    expect(canDiscard({ status: "accepted", linked: null }).ok).toBe(false);
    expect(canDiscard({ status: "rejected", linked: null }).ok).toBe(false);
    expect(canDiscard({ status: "discarded", linked: null }).ok).toBe(false);
    expect(canDiscard({ status: "parsed", linked: null })).toEqual({ ok: true, reason: null });
    expect(canDiscard({ status: "in_review", linked: null }).ok).toBe(true);
    expect(canIssueLink("scanning")).toBe(false);
    expect(canIssueLink("rejected")).toBe(false);
    expect(canIssueLink("accepted")).toBe(true);
  });
});

describe("documentSummary and filters", () => {
  it("counts the demo library by pipeline stage", () => {
    expect(documentSummary(DEMO_DOCUMENTS)).toEqual({
      inPipeline: 3,
      inReview: 3,
      accepted: 3,
      rejected: 1,
      discarded: 1,
    });
  });
  it("treats rejected and in-review documents as needing attention", () => {
    expect(matchesStatusFilter("rejected", "attention")).toBe(true);
    expect(matchesStatusFilter("in_review", "attention")).toBe(true);
    expect(matchesStatusFilter("accepted", "attention")).toBe(false);
    expect(matchesStatusFilter("scanning", "pipeline")).toBe(true);
  });
  it("formats sizes for display", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(96_500)).toBe("94 KB");
    expect(formatBytes(3_902_400)).toBe("3.7 MB");
  });
});
