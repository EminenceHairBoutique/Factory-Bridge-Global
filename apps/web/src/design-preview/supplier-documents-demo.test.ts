import { describe, expect, it } from "vitest";
import {
  SUPPLIER_DOCS_TODAY,
  SUPPLIER_DOCUMENTS,
  type SupplierDocument,
} from "./demo-data/supplier-documents";
import {
  advanceSupplierDocument,
  canDelete,
  canReplace,
  certificateChecklist,
  documentsSummary,
  expiryState,
  replaceDocument,
  reviewLabel,
  sortDocuments,
  statusLabel,
} from "./supplier-documents-demo";

const byId = (id: string) => SUPPLIER_DOCUMENTS.find((d) => d.id === id)!;

describe("labels", () => {
  it("keeps every upload 供应商提供，未核验 until a platform check references it", () => {
    expect(reviewLabel(byId("sd_export"))).toBe("供应商提供，未核验");
    expect(reviewLabel(byId("sd_licence"))).toBe("已核验（平台 · 2026-10-20）");
    expect(reviewLabel(byId("sd_premises_rejected"))).toBe("已拒绝");
    expect(statusLabel(byId("sd_quote_022"))).toBe("已转达");
    expect(statusLabel(byId("sd_licence"))).toBe("已核验");
  });
});

describe("expiryState", () => {
  it("flags certificates within 30 days and after their date", () => {
    expect(expiryState("2026-11-30", SUPPLIER_DOCS_TODAY)).toEqual({ state: "即将到期", days: 23 });
    expect(expiryState("2026-10-31", SUPPLIER_DOCS_TODAY)).toEqual({ state: "已到期", days: -7 });
    expect(expiryState("2027-06-30", SUPPLIER_DOCS_TODAY).state).toBe("有效");
    expect(expiryState(null, SUPPLIER_DOCS_TODAY)).toEqual({ state: "未注明", days: null });
  });
});

describe("certificateChecklist and summary", () => {
  it("resolves each certification item to its newest live document", () => {
    const list = certificateChecklist(SUPPLIER_DOCUMENTS);
    const state = Object.fromEntries(list.map((c) => [c.key, c.state]));
    expect(state).toEqual({
      licence: "已核验",
      rep_id: "已核验",
      premises: "已拒绝",
      export: "待平台审核",
      certs: "已核验",
      samples: "待上传",
    });
    expect(list.find((c) => c.key === "premises")?.document?.id).toBe("sd_premises_rejected");
  });
  it("counts what needs the supplier, what is with the platform and what expires", () => {
    expect(documentsSummary(SUPPLIER_DOCUMENTS, SUPPLIER_DOCS_TODAY)).toEqual({
      total: 9,
      needsAction: 1,
      inReview: 1,
      expiring: 1,
      verified: 5,
    });
  });
});

describe("delete, replace and versions", () => {
  it("protects reviewed evidence and allows withdrawing a file under review", () => {
    expect(canDelete(byId("sd_licence")).ok).toBe(false);
    expect(canDelete(byId("sd_quote_022")).ok).toBe(false);
    expect(canDelete(byId("sd_export"))).toEqual({ ok: true, reason: "删除后将撤回平台审核。" });
    expect(canDelete(byId("sd_premises_rejected")).ok).toBe(true);
    expect(canReplace(byId("sd_licence"))).toBe(true);
    expect(canReplace({ status: "scanning" })).toBe(false);
  });
  it("replaces a file as a new version and marks the old one 已作废", () => {
    const { docs, created } = replaceDocument(
      SUPPLIER_DOCUMENTS,
      "sd_iso",
      { name: "ISO9001-证书-2027.pdf", type: "application/pdf", size: 900_000 },
      "2026-11-07 10:30",
    );
    expect(created?.version).toBe(2);
    expect(created?.status).toBe("uploaded");
    expect(created?.review.state).toBe("未核验");
    expect(created?.supersedes).toBe("sd_iso");
    expect(docs.find((d) => d.id === "sd_iso")?.status).toBe("discarded");
    expect(docs).toHaveLength(SUPPLIER_DOCUMENTS.length + 1);
    expect(certificateChecklist(docs).find((c) => c.key === "certs")?.state).toBe("扫描中");
  });
  it("walks a certification upload to platform review and stops product files at parsed", () => {
    const walk = (start: ReturnType<typeof byId>) => {
      const seen: string[] = [];
      let d: SupplierDocument = { ...start, status: "uploaded" };
      for (let i = 0; i < 5; i += 1) {
        d = advanceSupplierDocument(d);
        seen.push(d.status);
      }
      return seen;
    };
    expect(walk(byId("sd_export"))).toEqual([
      "scanning",
      "parsed",
      "in_review",
      "in_review",
      "in_review",
    ]);
    expect(walk(byId("sd_spec_labels"))).toEqual([
      "scanning",
      "parsed",
      "parsed",
      "parsed",
      "parsed",
    ]);
  });
  it("lists rejected and in-review files first, then newest", () => {
    const ids = sortDocuments(SUPPLIER_DOCUMENTS).map((d) => d.id);
    expect(ids[0]).toBe("sd_premises_rejected");
    expect(ids[1]).toBe("sd_export");
    expect(ids[2]).toBe("sd_catalog_import");
  });
});
