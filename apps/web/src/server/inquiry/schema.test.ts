import { describe, expect, it } from "vitest";
import { hasControlChars, parseInquiry, readInquiryFields } from "./schema";

const valid = {
  name: "Jordan Lee",
  email: "jordan@acme-brands.com",
  company: "Acme Brands LLC",
  productFamily: "roll_labels",
  quantity: "10,000 labels per order",
  message: "Need 2x3 in BOPP roll labels, matte lamination, shipped to Newark.",
  consent: "yes",
};

describe("inquiry schema (B-31 public sourcing request)", () => {
  it("accepts a complete request and trims every field", () => {
    const r = parseInquiry({ ...valid, name: "  Jordan Lee  ", email: " jordan@acme-brands.com " });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.inquiry.name).toBe("Jordan Lee");
      expect(r.inquiry.email).toBe("jordan@acme-brands.com");
    }
  });

  it("treats an empty optional quantity as not provided", () => {
    const r = parseInquiry({ ...valid, quantity: "   " });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.inquiry.quantity).toBeUndefined();
  });

  it("reports one message per missing required field and echoes what was typed", () => {
    const r = parseInquiry({ name: "Jordan", message: "short" });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(Object.keys(r.fieldErrors).sort()).toEqual(
        ["company", "consent", "email", "message", "productFamily"].sort(),
      );
      expect(r.values).toEqual({ name: "Jordan", message: "short" });
    }
  });

  it("rejects malformed emails, unknown product families and missing consent", () => {
    for (const patch of [
      { email: "not-an-email" },
      { email: "a@b" },
      { productFamily: "medical_gloves" },
      { consent: "on" },
    ]) {
      const r = parseInquiry({ ...valid, ...patch });
      expect(r.ok, JSON.stringify(patch)).toBe(false);
    }
  });

  it("caps lengths", () => {
    expect(parseInquiry({ ...valid, name: "x".repeat(121) }).ok).toBe(false);
    expect(parseInquiry({ ...valid, message: "x".repeat(1501) }).ok).toBe(false);
    expect(parseInquiry({ ...valid, message: "x".repeat(1500) }).ok).toBe(true);
  });

  it("blocks CR/LF and other control characters in single-line fields (header smuggling)", () => {
    expect(parseInquiry({ ...valid, name: "Jordan\r\nBcc: x@evil.test" }).ok).toBe(false);
    expect(parseInquiry({ ...valid, company: "Acme\u0000" }).ok).toBe(false);
    expect(parseInquiry({ ...valid, email: "jordan@acme.com\nBcc: x@evil.test" }).ok).toBe(false);
  });

  it("allows line breaks in the message but no other control characters", () => {
    expect(
      parseInquiry({ ...valid, message: "Line one of the brief\nLine two\r\n\tdone" }).ok,
    ).toBe(true);
    expect(parseInquiry({ ...valid, message: "Twenty characters plus\u0007bell" }).ok).toBe(false);
    expect(hasControlChars("a\nb", true)).toBe(false);
    expect(hasControlChars("a\nb", false)).toBe(true);
    expect(hasControlChars("a\u007fb", true)).toBe(true);
  });

  it("reads only the known fields from the submitted form", () => {
    const form = new Map<string, unknown>([
      ...Object.entries(valid),
      ["role", "admin"],
      ["organization_id", "00000000-0000-0000-0000-000000000000"],
      ["name", "Jordan"],
    ]);
    const raw = readInquiryFields((k) => form.get(k));
    expect(Object.keys(raw)).not.toContain("role");
    expect(Object.keys(raw)).not.toContain("organization_id");
    // A File (or any non-string) is ignored, not coerced.
    expect(readInquiryFields((k) => (k === "message" ? new Blob(["x"]) : undefined))).toEqual({});
  });
});
