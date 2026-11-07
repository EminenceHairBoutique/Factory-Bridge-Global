import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getTemplate, listTemplates, parseTemplateFile, TemplateError } from "./registry.js";

const ref = { id: "quotation_extractor", version: "1.0.0" };

describe("prompt template registry", () => {
  it("loads quotation_extractor 1.0.0 with the sha256 of the file bytes as its hash", () => {
    const t = getTemplate(ref);
    expect(t.schema).toBe("quote_extraction_v1");
    expect(t.purpose).toBe("extract");
    expect(t.user).toContain("{{DOCUMENTS}}");
    expect(t.user).toContain("{{CONTEXT}}");
    expect(t.hash).toBe(createHash("sha256").update(readFileSync(t.path)).digest("hex"));
    expect(getTemplate(ref)).toBe(t); // cached
  });

  it("encodes the ADR-025 colloquial price-term rule", () => {
    const { system } = getTemplate(ref);
    for (const term of [
      "出厂价",
      "离岸价",
      "到岸价",
      "basis_term_colloquial",
      "includes_ambiguous",
    ]) {
      expect(system).toContain(term);
    }
    expect(system).toMatch(/[Nn]ever default to EXW/);
  });

  it("lists templates on disk", () => {
    expect(listTemplates()).toEqual(expect.arrayContaining([ref]));
  });

  it("rejects unsafe ids and versions (no path traversal)", () => {
    expect(() => getTemplate({ id: "../etc", version: "1.0.0" })).toThrow(TemplateError);
    expect(() => getTemplate({ id: "quotation_extractor", version: "../1.0.0" })).toThrow(
      TemplateError,
    );
    expect(() => getTemplate({ id: "quotation_extractor", version: "9.9.9" })).toThrow(/not found/);
  });

  it("validates front matter and sections", () => {
    const good =
      "---\nid: x\nversion: 1.0.0\nschema: s\npurpose: extract\n---\nSYS\n=== USER ===\n{{DOCUMENTS}}\n";
    const t = parseTemplateFile(good, { id: "x", version: "1.0.0" }, "mem");
    expect(t.system).toBe("SYS");
    expect(() => parseTemplateFile(good, { id: "y", version: "1.0.0" }, "mem")).toThrow(/id/);
    expect(() =>
      parseTemplateFile(good.replace("extract", "cook"), { id: "x", version: "1.0.0" }, "mem"),
    ).toThrow(/purpose/);
    expect(() =>
      parseTemplateFile(
        good.replace("{{DOCUMENTS}}", "none"),
        { id: "x", version: "1.0.0" },
        "mem",
      ),
    ).toThrow(/DOCUMENTS/);
    expect(() =>
      parseTemplateFile("no front matter", { id: "x", version: "1.0.0" }, "mem"),
    ).toThrow(/front matter/);
  });
});
