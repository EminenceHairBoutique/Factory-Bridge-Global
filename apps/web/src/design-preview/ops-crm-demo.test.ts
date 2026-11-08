import { describe, expect, it } from "vitest";
import { RESEARCH_LEADS, RESEARCH_TODAY } from "./demo-data/research-leads";
import {
  EMPTY_LEAD_INPUT,
  EMPTY_SUPPLIER_DRAFT,
  createSupplier,
  leadFreshness,
  leadFromInput,
  leadSummary,
  priceRangeText,
  sortLeads,
  supplierDraftFromLead,
  validateLead,
  validateSupplierDraft,
} from "./ops-crm-demo";

const lead = (id: string) => RESEARCH_LEADS.find((l) => l.id === id)!;

describe("lead freshness and presentation", () => {
  it("marks observations older than 30 days stale", () => {
    expect(leadFreshness("2026-11-05", RESEARCH_TODAY)).toMatchObject({
      state: "fresh",
      daysOld: 2,
    });
    expect(leadFreshness("2026-09-28", RESEARCH_TODAY)).toMatchObject({
      state: "stale",
      daysOld: 40,
    });
    expect(leadFreshness(RESEARCH_TODAY, RESEARCH_TODAY).label).toBe("Observed today");
  });
  it("prints the observed range as an indicative CNY range per unit", () => {
    expect(priceRangeText(lead("rl_labels_1"))).toBe("CNY 0.03–0.08 / pc");
    expect(
      priceRangeText({
        observedMinPrice: 2,
        observedMaxPrice: 2,
        currency: "CNY",
        observedUnit: "",
      }),
    ).toBe("CNY 2.00");
    expect(
      priceRangeText({
        observedMinPrice: null,
        observedMaxPrice: null,
        currency: "CNY",
        observedUnit: "pc",
      }),
    ).toBe("No price observed");
  });
});

describe("validateLead (AC-O1.1 and migration 0005)", () => {
  it("requires family, a non-blocked source, reference, Chinese term and a past date", () => {
    const e = validateLead({ ...EMPTY_LEAD_INPUT, observedAt: "2026-12-01" }, RESEARCH_TODAY);
    expect(Object.keys(e).sort()).toEqual([
      "observedAt",
      "referenceUrl",
      "searchTermZh",
      "sourceSystem",
      "taxonomy",
    ]);
    expect(e.observedAt).toContain("future");
    const blocked = validateLead(
      { ...EMPTY_LEAD_INPUT, sourceSystem: "com.alibaba" },
      RESEARCH_TODAY,
    );
    expect(blocked.sourceSystem).toContain("blocked in the integrations register");
  });
  it("checks the price range and MOQ like the table constraints", () => {
    const base = {
      ...EMPTY_LEAD_INPUT,
      taxonomy: "Labels",
      sourceSystem: "cn.1688",
      referenceUrl: "ref",
      searchTermZh: "标签",
      observedAt: "2026-11-06",
    };
    expect(validateLead(base, RESEARCH_TODAY)).toEqual({});
    expect(
      validateLead({ ...base, observedMinPrice: "0.5", observedMaxPrice: "0.2" }, RESEARCH_TODAY)
        .observedMaxPrice,
    ).toContain("at least the minimum");
    expect(
      validateLead({ ...base, observedMinPrice: "-1" }, RESEARCH_TODAY).observedMinPrice,
    ).toBeDefined();
    expect(validateLead({ ...base, observedMoq: "0" }, RESEARCH_TODAY).observedMoq).toBeDefined();
    const l = leadFromInput(
      { ...base, observedMinPrice: "0.5", observedMaxPrice: "", observedMoq: "500" },
      "rl_x",
      "Operator (demo)",
    );
    expect(l).toMatchObject({
      rightsClass: "internal_market_observation",
      status: "new",
      currency: "CNY",
      observedMinPrice: 0.5,
      observedMaxPrice: null,
      observedMoq: 500,
    });
  });
});

describe("inbox ordering and counts", () => {
  it("lists fresh new leads first, then stale, linked and dismissed", () => {
    expect(sortLeads(RESEARCH_LEADS, RESEARCH_TODAY).map((l) => l.id)).toEqual([
      "rl_labels_1",
      "rl_cartons_1",
      "rl_hair_1",
      "rl_cartons_foshan",
      "rl_labels_taobao",
    ]);
    expect(leadSummary(RESEARCH_LEADS, RESEARCH_TODAY)).toEqual({
      open: 3,
      stale: 1,
      linked: 1,
      dismissed: 1,
    });
  });
});

describe("supplier creation (US-O2)", () => {
  it("prefills family and origin from a lead but never the legal name", () => {
    const d = supplierDraftFromLead(lead("rl_labels_1"));
    expect(d).toMatchObject({
      origin: "lead",
      leadId: "rl_labels_1",
      families: ["Labels"],
      legalNameZh: "",
    });
    expect(d.notes).toContain("1688.com");
  });
  it("requires legal name, city and a family, and a basis for any WeChat contact", () => {
    expect(Object.keys(validateSupplierDraft(EMPTY_SUPPLIER_DRAFT)).sort()).toEqual([
      "city",
      "families",
      "legalNameZh",
    ]);
    const d = {
      ...EMPTY_SUPPLIER_DRAFT,
      legalNameZh: "东莞市演示标签厂",
      city: "Dongguan",
      families: ["Labels"],
      contactHandle: "wx_demo",
    };
    expect(validateSupplierDraft(d).contact).toContain(
      "WeChat handle needs a recorded contact basis",
    );
    expect(
      validateSupplierDraft({ ...d, contactBasis: "supplier_provided_for_business" }).contact,
    ).toContain("name");
    expect(
      validateSupplierDraft({
        ...d,
        contactBasis: "supplier_provided_for_business",
        contactName: "Ms. Li",
      }),
    ).toEqual({});
  });
  it("creates a lead_identified supplier with claimed fields, the lead document and audit lines", () => {
    const d = {
      ...supplierDraftFromLead(lead("rl_labels_1")),
      legalNameZh: "东莞市演示标签厂",
      city: "Dongguan",
      contactName: "Ms. Li",
      contactChannel: "wechat" as const,
      contactHandle: "wx_demo",
      contactBasis: "supplier_provided_for_business" as const,
    };
    const s = createSupplier(d, "sup_new_1", "Operator (demo)", RESEARCH_TODAY);
    expect(s.stage).toBe("lead_identified");
    expect(s.nameEn).toBe("Lead: 东莞市演示标签厂");
    expect(s.claimed.legal_name).toBe("东莞市演示标签厂");
    expect(s.verified.legal_name).toBeNull();
    expect(s.documents[0]).toMatchObject({
      sourceType: "manual_research",
      rightsClass: "internal_market_observation",
      visibility: "internal_only",
    });
    expect(s.contacts[0]).toMatchObject({
      basis: "supplier_provided_for_business",
      basisRecordedAt: RESEARCH_TODAY,
    });
    expect(s.audit.map((a) => a.action)).toEqual([
      "Created supplier from research lead rl_labels_1 (internal only)",
      'Recorded contact with basis "supplier_provided_for_business"',
    ]);
  });
});
