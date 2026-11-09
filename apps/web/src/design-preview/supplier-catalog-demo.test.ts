import { describe, expect, it } from "vitest";
import { SUPPLIER_PRODUCTS } from "./demo-data/supplier";
import {
  CATALOG_TODAY,
  FIXTURE_ERRORS_CSV,
  FIXTURE_VALID_CSV,
  TEMPLATE_COLUMNS,
} from "./demo-data/supplier-import";
import {
  applyImport,
  buildImportPreview,
  catalogSummary,
  importSummary,
  parseCsv,
  readImportTable,
  templateCsv,
  toggleSuspended,
} from "./supplier-catalog-demo";

describe("parseCsv", () => {
  it("handles quotes, doubled quotes, CRLF, a byte-order mark and trailing newlines", () => {
    const rows = parseCsv('﻿a,b,c\r\n"x, y","he said ""hi""",3\n\n');
    expect(rows).toEqual([
      ["a", "b", "c"],
      ["x, y", 'he said "hi"', "3"],
    ]);
  });
  it("round-trips the template", () => {
    const table = readImportTable(templateCsv());
    expect(table.missingColumns).toEqual([]);
    expect(table.unknownColumns).toEqual([]);
    expect(table.rows).toHaveLength(2);
    expect(table.rows[0]?.values.nameZh).toBe(TEMPLATE_COLUMNS[0]?.example);
    expect(table.rows[1]?.values.tierMin).toBe("10000");
  });
  it("reports missing required columns", () => {
    const table = readImportTable("产品名称（中文）,单价\nX,1\n");
    expect(table.missingColumns).toEqual(["规格版本", "单位", "货币", "交易条款", "起订量"]);
  });
});

describe("buildImportPreview with the valid sample", () => {
  const { entries, fileErrors } = buildImportPreview(
    FIXTURE_VALID_CSV,
    SUPPLIER_PRODUCTS,
    CATALOG_TODAY,
  );

  it("groups tier rows into products and classifies them", () => {
    expect(fileErrors).toEqual([]);
    expect(entries.map((e) => e.status)).toEqual(["更新", "未变化", "新增"]);
    expect(entries[0]?.rows).toEqual([2, 3, 4]);
    expect(entries[0]?.existingId).toBe("sp_labels");
    expect(entries[2]?.draft?.tiers).toHaveLength(2);
  });
  it("diffs an updated product field by field", () => {
    const labels = entries[0]!;
    expect(labels.diffs.map((d) => d.field)).toEqual(["阶梯价格", "有效期至"]);
    expect(labels.diffs[1]).toEqual({
      field: "有效期至",
      before: "2026-12-15",
      after: "2027-01-31",
    });
    expect(labels.warnings.some((w) => w.includes("指定买家"))).toBe(true);
    expect(entries[1]?.diffs).toEqual([]);
  });
  it("summarises and applies, landing every imported price as 待确认", () => {
    expect(importSummary(entries)).toEqual({ 新增: 1, 更新: 1, 未变化: 1, 错误: 0, importable: 2 });
    const { products, imported } = applyImport(SUPPLIER_PRODUCTS, entries);
    expect(products).toHaveLength(SUPPLIER_PRODUCTS.length + 1);
    const labels = products.find((p) => p.id === "sp_labels")!;
    expect(labels.status).toBe("待确认");
    expect(labels.confirmedAt).toBeNull();
    expect(labels.tiers).toHaveLength(3);
    expect(labels.namedBuyers).toEqual(["Demo Buyer Co."]);
    expect(products.find((p) => p.id === "sp_sleeves")?.status).toBe("即将过期");
    expect(imported).toEqual([
      { id: "sp_labels", nameZh: labels.nameZh, isNew: false },
      { id: "sp_import_1", nameZh: "PET 透明标签 60 × 40 mm", isNew: true },
    ]);
  });
});

describe("buildImportPreview with the error sample", () => {
  const { entries } = buildImportPreview(FIXTURE_ERRORS_CSV, SUPPLIER_PRODUCTS, CATALOG_TODAY);
  it("flags every product with a row-numbered Chinese message", () => {
    expect(entries.map((e) => e.status)).toEqual(["错误", "错误", "错误", "错误"]);
    const all = entries.flatMap((e) => e.errors).join("\n");
    expect(all).toContain("第 2 行：“出厂价”不是交易条款代码");
    expect(all).toContain("第 3 行：货币须为 CNY 或 USD");
    expect(all).toContain("第 3 行：有效期至已过（2026-10-31）");
    expect(all).toContain("第 4 行：请填写指定地点");
    expect(all).toContain("第 4 行：可见范围无效");
    expect(all).toContain("第 5 行：与第 1 档数量区间重叠");
    expect(all).toContain("第 6 行：单价须为数字");
    expect(importSummary(entries).importable).toBe(0);
    expect(applyImport(SUPPLIER_PRODUCTS, entries).products).toHaveLength(SUPPLIER_PRODUCTS.length);
  });
});

describe("catalog helpers", () => {
  it("counts by status and toggles suspension back to 待确认", () => {
    expect(catalogSummary(SUPPLIER_PRODUCTS)).toEqual({
      total: 4,
      已确认: 1,
      待确认: 1,
      即将过期: 1,
      已过期: 1,
      已暂停: 0,
    });
    const labels = SUPPLIER_PRODUCTS[0]!;
    const suspended = toggleSuspended(labels);
    expect(suspended.status).toBe("已暂停");
    const resumed = toggleSuspended(suspended);
    expect(resumed.status).toBe("待确认");
    expect(resumed.confirmedAt).toBeNull();
  });
});
