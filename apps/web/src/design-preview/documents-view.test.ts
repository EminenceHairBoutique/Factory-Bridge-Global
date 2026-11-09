import { describe, expect, it } from "vitest";
import { BUYER_REVIEWS, DEMO_DOCUMENTS } from "./demo-data/documents";
import { filterDocuments, nextActionFor } from "./documents-view";

const doc = (id: string) => {
  const d = DEMO_DOCUMENTS.find((x) => x.id === id);
  if (!d) throw new Error(`missing ${id}`);
  return d;
};
const reviewable = (id: string) => id in BUYER_REVIEWS;

describe("next action per document (UX-04 §2 list column)", () => {
  it("links a reviewable in-review document to its extraction review", () => {
    expect(nextActionFor(doc("d_quote_h"), reviewable("d_quote_h"))).toEqual({
      label: "Open extraction review",
      href: "/design-preview/buyer/review?doc=d_quote_h",
      tone: "warn",
    });
  });

  it("says the operator is reviewing when the buyer has no review to open", () => {
    const a = nextActionFor(doc("d_quote_f"), reviewable("d_quote_f"));
    expect(a.href).toBeUndefined();
    expect(a.label).toBe("Operator review in progress");
    expect(a.tone).toBe("warn");
  });

  it("asks for a clean copy after a scan rejection", () => {
    expect(nextActionFor(doc("d_spec_rejected"), false)).toEqual({
      label: "Upload a clean copy",
      tone: "danger",
    });
  });

  it("points an accepted, reviewable quotation at its reviewed values", () => {
    const a = nextActionFor(doc("d_quote_a"), reviewable("d_quote_a"));
    expect(a.href).toBe("/design-preview/buyer/review?doc=d_quote_a");
    expect(a.tone).toBe("ok");
  });

  it("describes the pipeline step for documents still in flight", () => {
    const a = nextActionFor(doc("d_forwarder"), false);
    expect(a.label.startsWith("Next: ")).toBe(true);
    expect(a.tone).toBe("neutral");
  });
});

describe("document list filters", () => {
  it("matches the file name case-insensitively and combines with the other filters", () => {
    expect(filterDocuments(DEMO_DOCUMENTS, { query: "QUOTE-A" }).map((d) => d.id)).toEqual([
      "d_quote_a",
    ]);
    expect(
      filterDocuments(DEMO_DOCUMENTS, { query: "quote", kind: "quote", project: "prj_demo_labels" })
        .length,
    ).toBeGreaterThan(0);
    expect(filterDocuments(DEMO_DOCUMENTS, { status: "attention" })).toHaveLength(4);
    expect(filterDocuments(DEMO_DOCUMENTS, {})).toHaveLength(DEMO_DOCUMENTS.length);
  });
});
