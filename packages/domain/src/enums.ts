/**
 * Single source of truth for enumerations (docs/SCHEMA_PLAN.md §1.1).
 * A generator (BACKLOG B-03) will emit the Postgres `create type ... as enum` DDL from this file
 * and a test will assert the DB and TS enums never drift.
 */

export const ORG_TYPES = ["buyer", "supplier", "internal"] as const;
export type OrgType = (typeof ORG_TYPES)[number];

export const MEMBER_ROLES = [
  "owner",
  "admin",
  "member",
  "viewer",
  "operator",
  "compliance_reviewer",
  "platform_admin",
] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];

export const RIGHTS_CLASSES = [
  "internal_market_observation",
  "catalog_public_with_permission",
  "customer_private_quote",
  "buyer_uploaded_private",
  "supplier_submitted_private",
] as const;
export type RightsClass = (typeof RIGHTS_CLASSES)[number];

export const SOURCE_TYPES = [
  "manual_research",
  "operator_import",
  "buyer_upload",
  "supplier_portal",
  "supplier_csv_feed",
  "inbound_email",
  "supplier_api",
  "marketplace_api",
] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

export const VISIBILITY_SCOPES = [
  "internal_only",
  "owning_org",
  "named_orgs",
  "platform_buyers",
] as const;
export type VisibilityScope = (typeof VISIBILITY_SCOPES)[number];

export const QUOTE_TYPES = [
  "listing",
  "supplier_catalog",
  "negotiated_private",
  "final_offer",
  "estimate",
] as const;
export type QuoteType = (typeof QUOTE_TYPES)[number];

/** Incoterms 2020 subset plus `unknown`. A missing basis is `unknown`, never defaulted to EXW. */
export const PRICE_BASES = [
  "EXW",
  "FCA",
  "FOB",
  "CFR",
  "CIF",
  "DAP",
  "DPU",
  "DDP",
  "unknown",
] as const;
export type PriceBasis = (typeof PRICE_BASES)[number];

/**
 * Lifecycle of a CONFIRMED quotation only (ADR-021). Pre-confirmation state is `review_status`.
 * `superseded` and `withdrawn` are terminal; `expired → superseded` is allowed (revalidation = new version).
 */
export const QUOTE_STATUSES = ["confirmed", "superseded", "expired", "withdrawn"] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

export const REVIEW_STATUSES = ["pending", "in_review", "accepted", "rejected"] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export const DOCUMENT_STATUSES = [
  "uploaded",
  "scanning",
  "rejected",
  "parsed",
  "extracted",
  "in_review",
  "accepted",
  "discarded",
] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

export const SUPPLIER_STAGES = [
  "lead_identified",
  "contact_confirmed",
  "legal_identity_reviewed",
  "capabilities_documented",
] as const;
export type SupplierStage = (typeof SUPPLIER_STAGES)[number];

/** Supplier verification check types (QUALITY_ASSURANCE §2; SCHEMA_PLAN §1.1). Badges name these exactly. */
export const CHECK_TYPES = [
  "business_license_reviewed",
  "uscc_matched",
  "address_corroborated",
  "video_call_held",
  "factory_visit",
  "export_license_seen",
  "bank_name_matches_entity",
  "reference_checked",
] as const;
export type CheckType = (typeof CHECK_TYPES)[number];

export const COST_LINE_STATUSES = ["sourced", "estimated", "missing", "not_applicable"] as const;
export type CostLineStatus = (typeof COST_LINE_STATUSES)[number];

export const COMPLIANCE_STATES = ["clear", "review_required", "blocked"] as const;
export type ComplianceState = (typeof COMPLIANCE_STATES)[number];

/** Registry used by the SQL generator and drift test. */
export const ENUM_REGISTRY = {
  org_type: ORG_TYPES,
  member_role: MEMBER_ROLES,
  rights_class: RIGHTS_CLASSES,
  source_type: SOURCE_TYPES,
  visibility_scope: VISIBILITY_SCOPES,
  quote_type: QUOTE_TYPES,
  price_basis: PRICE_BASES,
  quote_status: QUOTE_STATUSES,
  review_status: REVIEW_STATUSES,
  document_status: DOCUMENT_STATUSES,
  supplier_stage: SUPPLIER_STAGES,
  check_type: CHECK_TYPES,
  cost_line_status: COST_LINE_STATUSES,
  compliance_state: COMPLIANCE_STATES,
} as const satisfies Record<string, readonly string[]>;
