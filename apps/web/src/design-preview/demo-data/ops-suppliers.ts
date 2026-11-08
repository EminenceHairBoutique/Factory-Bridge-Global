/**
 * DEMO DATA — NOT REAL SUPPLIERS. Synthetic supplier CRM records for the internal operations prototypes.
 *
 * Vocabulary mirrors migration 0005 `suppliers_core` (claimed-vs-verified columns, facilities, restricted
 * contacts with `contact_basis`, verification checks, `source_permissions` grants) and docs/SECURITY_PERMISSION_MATRIX.md
 * §2–§3. Contact handles are placeholders and never real.
 */
import type { RightsClass, SourceType, SupplierStage } from "@fbg/domain";

export const OPS_TODAY = "2026-11-07";

export const STAGE_LABEL: Record<SupplierStage, string> = {
  lead_identified: "Lead identified",
  contact_confirmed: "Contact confirmed",
  legal_identity_reviewed: "Legal identity reviewed",
  capabilities_documented: "Capabilities documented",
};

export const STAGE_ORDER: SupplierStage[] = [
  "lead_identified",
  "contact_confirmed",
  "legal_identity_reviewed",
  "capabilities_documented",
];

export type CheckType =
  | "identity_document_reviewed"
  | "address_corroborated"
  | "video_call_held"
  | "factory_visit"
  | "sample_received"
  | "export_licence_reviewed";

export const CHECK_LABEL: Record<CheckType, string> = {
  identity_document_reviewed: "Identity document reviewed",
  address_corroborated: "Address corroborated",
  video_call_held: "Video call held",
  factory_visit: "Factory visit",
  sample_received: "Sample received",
  export_licence_reviewed: "Export licence reviewed",
};

export type CheckStatus = "passed" | "failed" | "pending";

export interface VerificationCheck {
  id: string;
  type: CheckType;
  status: CheckStatus;
  evidence: string | null;
  reviewer: string;
  date: string;
  expiresAt: string | null;
  note?: string | undefined;
}

export type ContactBasis =
  "supplier_provided_for_business" | "public_business_listing" | "introduced_by_partner";

export const CONTACT_BASIS_LABEL: Record<ContactBasis, string> = {
  supplier_provided_for_business: "Supplier provided for business",
  public_business_listing: "Public business listing",
  introduced_by_partner: "Introduced by partner",
};

export interface SupplierContact {
  id: string;
  name: string;
  role: string;
  channel: "wechat" | "email" | "phone";
  handle: string;
  basis: ContactBasis;
  basisRecordedAt: string;
  lastResponse: string | null;
}

export interface Facility {
  id: string;
  kind: "factory" | "warehouse" | "office";
  address: string;
  corroboratedBy: string | null;
  note?: string | undefined;
}

export interface SupplierDocument {
  id: string;
  name: string;
  sourceType: SourceType;
  rightsClass: RightsClass;
  permissionRef: string | null;
  importedAt: string;
  importedBy: string;
  visibility: "internal_only" | "owning_org" | "named_orgs" | "platform_buyers";
}

export interface SourcePermission {
  id: string;
  buyerVisibility: "internal_only" | "platform_buyers" | "named_orgs";
  namedOrgs: string[];
  fields: Array<"catalog" | "price_tiers" | "images" | "benchmark">;
  evidence: string;
  recordedBy: string;
  recordedAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
  revokeReason?: string | undefined;
}

export interface DisclosureGrant {
  id: string;
  contactId: string;
  granteeOrg: string;
  reason: string;
  since: string;
  until: string;
  status: "active" | "revoked" | "draft";
}

export interface OpsSupplier {
  id: string;
  legalNameZh: string;
  nameEn: string;
  city: string;
  province: string;
  stage: SupplierStage;
  families: string[];
  claimed: Record<string, string>;
  verified: Record<string, { value: string; checkId: string } | null>;
  facilities: Facility[];
  contacts: SupplierContact[];
  checks: VerificationCheck[];
  documents: SupplierDocument[];
  permissions: SourcePermission[];
  disclosureGrants: DisclosureGrant[];
  assignedProjects: Array<{ id: string; name: string; buyerOrg: string }>;
  lastActivity: string;
  audit: Array<{ at: string; actor: string; actingAs: string; action: string }>;
}

const PROFILE_FIELDS = [
  "legal_name",
  "registered_address",
  "company_type",
  "founded_year",
  "monthly_capacity",
] as const;
export type ProfileField = (typeof PROFILE_FIELDS)[number];
export const PROFILE_FIELD_LABEL: Record<ProfileField, string> = {
  legal_name: "Legal name",
  registered_address: "Registered address",
  company_type: "Company type",
  founded_year: "Founded",
  monthly_capacity: "Monthly capacity",
};
export { PROFILE_FIELDS };

export const OPS_SUPPLIERS: OpsSupplier[] = [
  {
    id: "sup_a",
    legalNameZh: "深圳市演示标签印刷有限公司",
    nameEn: "Supplier A (demo)",
    city: "Shenzhen",
    province: "Guangdong",
    stage: "capabilities_documented",
    families: ["Labels", "Folding cartons"],
    claimed: {
      legal_name: "深圳市演示标签印刷有限公司",
      registered_address: "宝安区演示路 88 号 3 栋",
      company_type: "Manufacturer",
      founded_year: "2014",
      monthly_capacity: "≈20M labels / 500k cartons",
    },
    verified: {
      legal_name: { value: "深圳市演示标签印刷有限公司", checkId: "chk_a1" },
      registered_address: { value: "宝安区演示路 88 号 3 栋", checkId: "chk_a2" },
      company_type: { value: "Manufacturer (own press line seen on video)", checkId: "chk_a3" },
      founded_year: null,
      monthly_capacity: null,
    },
    facilities: [
      {
        id: "fac_a1",
        kind: "factory",
        address: "宝安区演示路 88 号 3 栋, Shenzhen",
        corroboratedBy: "chk_a2",
      },
      {
        id: "fac_a2",
        kind: "warehouse",
        address: "宝安区演示路 90 号, Shenzhen",
        corroboratedBy: null,
        note: "Claimed; not yet seen",
      },
    ],
    contacts: [
      {
        id: "con_a1",
        name: "Li (demo)",
        role: "Export manager",
        channel: "wechat",
        handle: "demo_wechat_a1",
        basis: "supplier_provided_for_business",
        basisRecordedAt: "2026-10-18",
        lastResponse: "2026-11-05",
      },
      {
        id: "con_a2",
        name: "Chen (demo)",
        role: "Sales assistant",
        channel: "email",
        handle: "sales@demo-supplier.example",
        basis: "supplier_provided_for_business",
        basisRecordedAt: "2026-10-18",
        lastResponse: "2026-11-04",
      },
    ],
    checks: [
      {
        id: "chk_a1",
        type: "identity_document_reviewed",
        status: "passed",
        evidence: "licence-A-2026.pdf",
        reviewer: "Operator (demo)",
        date: "2026-10-20",
        expiresAt: "2027-10-20",
      },
      {
        id: "chk_a2",
        type: "address_corroborated",
        status: "passed",
        evidence: "lease-A-2026.pdf + photo set",
        reviewer: "Operator (demo)",
        date: "2026-10-20",
        expiresAt: "2027-10-20",
      },
      {
        id: "chk_a3",
        type: "video_call_held",
        status: "passed",
        evidence: "call-notes-2026-10-21.md",
        reviewer: "Operator (demo)",
        date: "2026-10-21",
        expiresAt: null,
      },
      {
        id: "chk_a4",
        type: "sample_received",
        status: "passed",
        evidence: "sample-photos-2026-10-27/",
        reviewer: "Operator (demo)",
        date: "2026-10-27",
        expiresAt: null,
        note: "Golden sample approved by Demo Buyer Co. on 2026-10-28 (buyer record).",
      },
    ],
    documents: [
      {
        id: "sdoc_a1",
        name: "catalog-A-2026Q4.xlsx",
        sourceType: "operator_import",
        rightsClass: "catalog_public_with_permission",
        permissionRef: "perm_a1",
        importedAt: "2026-10-22",
        importedBy: "Operator (demo)",
        visibility: "named_orgs",
      },
      {
        id: "sdoc_a2",
        name: "licence-A-2026.pdf",
        sourceType: "supplier_portal",
        rightsClass: "supplier_submitted_private",
        permissionRef: null,
        importedAt: "2026-10-18",
        importedBy: "Supplier A (demo)",
        visibility: "internal_only",
      },
    ],
    permissions: [
      {
        id: "perm_a1",
        buyerVisibility: "named_orgs",
        namedOrgs: ["Demo Buyer Co."],
        fields: ["catalog", "price_tiers"],
        evidence: "Signed catalog authorization 2026-10-20 (auth-A-2026-10-20.pdf)",
        recordedBy: "Operator (demo)",
        recordedAt: "2026-10-20",
        expiresAt: "2027-04-20",
        revokedAt: null,
      },
    ],
    disclosureGrants: [],
    assignedProjects: [
      {
        id: "prj_demo_labels",
        name: "Custom BOPP roll labels, 50 × 76 mm",
        buyerOrg: "Demo Buyer Co.",
      },
    ],
    lastActivity: "2026-11-05",
    audit: [
      {
        at: "2026-11-05 15:10",
        actor: "Operator (demo)",
        actingAs: "operator",
        action: "Confirmed quotation A v1 (project prj_demo_labels)",
      },
      {
        at: "2026-10-27 17:40",
        actor: "Operator (demo)",
        actingAs: "operator",
        action: "Recorded check: sample received",
      },
      {
        at: "2026-10-20 10:05",
        actor: "Operator (demo)",
        actingAs: "operator",
        action: "Recorded source permission perm_a1 (catalog, price tiers → Demo Buyer Co.)",
      },
      {
        at: "2026-10-20 09:50",
        actor: "Operator (demo)",
        actingAs: "operator",
        action: "Recorded checks: identity document reviewed, address corroborated",
      },
      {
        at: "2026-10-18 14:00",
        actor: "Supplier A (demo)",
        actingAs: "user",
        action: "Submitted onboarding (licence, representative)",
      },
    ],
  },
  {
    id: "sup_b",
    legalNameZh: "东莞市演示包装材料有限公司",
    nameEn: "Supplier B (demo)",
    city: "Dongguan",
    province: "Guangdong",
    stage: "legal_identity_reviewed",
    families: ["Labels"],
    claimed: {
      legal_name: "东莞市演示包装材料有限公司",
      registered_address: "东莞市演示工业区 12 号",
      company_type: "Manufacturer",
      founded_year: "2011",
      monthly_capacity: "≈12M labels",
    },
    verified: {
      legal_name: { value: "东莞市演示包装材料有限公司", checkId: "chk_b1" },
      registered_address: { value: "东莞市演示工业区 12 号", checkId: "chk_b2" },
      company_type: null,
      founded_year: null,
      monthly_capacity: null,
    },
    facilities: [
      {
        id: "fac_b1",
        kind: "factory",
        address: "东莞市演示工业区 12 号, Dongguan",
        corroboratedBy: "chk_b2",
      },
    ],
    contacts: [
      {
        id: "con_b1",
        name: "Wang (demo)",
        role: "Owner",
        channel: "wechat",
        handle: "demo_wechat_b1",
        basis: "introduced_by_partner",
        basisRecordedAt: "2026-09-28",
        lastResponse: "2026-11-05",
      },
    ],
    checks: [
      {
        id: "chk_b1",
        type: "identity_document_reviewed",
        status: "passed",
        evidence: "licence-B-2026.pdf",
        reviewer: "Operator (demo)",
        date: "2026-09-30",
        expiresAt: "2027-09-30",
      },
      {
        id: "chk_b2",
        type: "address_corroborated",
        status: "passed",
        evidence: "utility-bill-B.pdf",
        reviewer: "Operator (demo)",
        date: "2026-09-30",
        expiresAt: "2026-11-15",
        note: "Short expiry: bill dated 2026-05; request a current one.",
      },
      {
        id: "chk_b3",
        type: "video_call_held",
        status: "pending",
        evidence: null,
        reviewer: "Operator (demo)",
        date: "2026-11-12",
        expiresAt: null,
        note: "Scheduled",
      },
    ],
    documents: [
      {
        id: "sdoc_b1",
        name: "email-quote-B-2026-11-05.eml",
        sourceType: "inbound_email",
        rightsClass: "customer_private_quote",
        permissionRef: null,
        importedAt: "2026-11-05",
        importedBy: "Operator (demo)",
        visibility: "owning_org",
      },
    ],
    permissions: [],
    disclosureGrants: [],
    assignedProjects: [
      {
        id: "prj_demo_labels",
        name: "Custom BOPP roll labels, 50 × 76 mm",
        buyerOrg: "Demo Buyer Co.",
      },
    ],
    lastActivity: "2026-11-05",
    audit: [
      {
        at: "2026-11-05 15:12",
        actor: "Operator (demo)",
        actingAs: "operator",
        action: "Drafted clarification (tooling in EXW price) — awaiting buyer approval",
      },
      {
        at: "2026-09-30 11:20",
        actor: "Operator (demo)",
        actingAs: "operator",
        action: "Recorded checks: identity document reviewed, address corroborated",
      },
    ],
  },
  {
    id: "sup_c",
    legalNameZh: "宁波演示印务有限公司",
    nameEn: "Supplier C (demo)",
    city: "Ningbo",
    province: "Zhejiang",
    stage: "legal_identity_reviewed",
    families: ["Labels"],
    claimed: {
      legal_name: "宁波演示印务有限公司",
      registered_address: "宁波市演示路 5 号",
      company_type: "Manufacturer",
      founded_year: "2016",
      monthly_capacity: "≈8M labels",
    },
    verified: {
      legal_name: { value: "宁波演示印务有限公司", checkId: "chk_c1" },
      registered_address: null,
      company_type: null,
      founded_year: null,
      monthly_capacity: null,
    },
    facilities: [
      {
        id: "fac_c1",
        kind: "factory",
        address: "宁波市演示路 5 号, Ningbo",
        corroboratedBy: null,
        note: "Claimed",
      },
    ],
    contacts: [
      {
        id: "con_c1",
        name: "Zhou (demo)",
        role: "Sales",
        channel: "email",
        handle: "zhou@demo-c.example",
        basis: "supplier_provided_for_business",
        basisRecordedAt: "2026-10-02",
        lastResponse: "2026-11-02",
      },
    ],
    checks: [
      {
        id: "chk_c1",
        type: "identity_document_reviewed",
        status: "passed",
        evidence: "licence-C-2026.pdf",
        reviewer: "Operator (demo)",
        date: "2026-10-02",
        expiresAt: "2027-10-02",
      },
    ],
    documents: [],
    permissions: [
      {
        id: "perm_c1",
        buyerVisibility: "platform_buyers",
        namedOrgs: [],
        fields: ["catalog"],
        evidence: "Portal consent 2026-10-02 (catalog names and specs only)",
        recordedBy: "Supplier C (demo)",
        recordedAt: "2026-10-02",
        expiresAt: null,
        revokedAt: null,
      },
    ],
    disclosureGrants: [],
    assignedProjects: [],
    lastActivity: "2026-11-02",
    audit: [
      {
        at: "2026-11-02 09:00",
        actor: "Supplier C (demo)",
        actingAs: "user",
        action: "Submitted quotation via portal (#demo-77)",
      },
    ],
  },
  {
    id: "sup_e",
    legalNameZh: "温州演示标签有限公司",
    nameEn: "Supplier E (demo)",
    city: "Wenzhou",
    province: "Zhejiang",
    stage: "contact_confirmed",
    families: ["Labels"],
    claimed: {
      legal_name: "温州演示标签有限公司",
      registered_address: "温州市演示大道 300 号",
      company_type: "Manufacturer",
      founded_year: "2019",
      monthly_capacity: "≈30M labels",
    },
    verified: {
      legal_name: null,
      registered_address: null,
      company_type: null,
      founded_year: null,
      monthly_capacity: null,
    },
    facilities: [],
    contacts: [
      {
        id: "con_e1",
        name: "Lin (demo)",
        role: "Sales",
        channel: "wechat",
        handle: "demo_wechat_e1",
        basis: "public_business_listing",
        basisRecordedAt: "2026-10-30",
        lastResponse: "2026-11-06",
      },
    ],
    checks: [
      {
        id: "chk_e1",
        type: "identity_document_reviewed",
        status: "pending",
        evidence: null,
        reviewer: "Operator (demo)",
        date: "2026-11-08",
        expiresAt: null,
        note: "Licence requested 2026-11-01",
      },
    ],
    documents: [],
    permissions: [],
    disclosureGrants: [],
    assignedProjects: [
      {
        id: "prj_demo_labels",
        name: "Custom BOPP roll labels, 50 × 76 mm",
        buyerOrg: "Demo Buyer Co.",
      },
    ],
    lastActivity: "2026-11-06",
    audit: [
      {
        at: "2026-11-06 10:30",
        actor: "Operator (demo)",
        actingAs: "operator",
        action: "Confirmed quotation E v1 (portal submission #demo-81)",
      },
    ],
  },
  {
    id: "sup_lead1",
    legalNameZh: "佛山市演示纸品厂",
    nameEn: "Lead: Foshan carton factory (demo)",
    city: "Foshan",
    province: "Guangdong",
    stage: "lead_identified",
    families: ["Folding cartons"],
    claimed: {
      legal_name: "佛山市演示纸品厂",
      registered_address: "—",
      company_type: "Unknown",
      founded_year: "—",
      monthly_capacity: "—",
    },
    verified: {
      legal_name: null,
      registered_address: null,
      company_type: null,
      founded_year: null,
      monthly_capacity: null,
    },
    facilities: [],
    contacts: [],
    checks: [],
    documents: [
      {
        id: "sdoc_l1",
        name: "research-lead-2026-11-03.md",
        sourceType: "manual_research",
        rightsClass: "internal_market_observation",
        permissionRef: null,
        importedAt: "2026-11-03",
        importedBy: "Operator (demo)",
        visibility: "internal_only",
      },
    ],
    permissions: [],
    disclosureGrants: [],
    assignedProjects: [],
    lastActivity: "2026-11-03",
    audit: [
      {
        at: "2026-11-03 16:20",
        actor: "Operator (demo)",
        actingAs: "operator",
        action: "Created research lead from manual research (internal only)",
      },
    ],
  },
];
