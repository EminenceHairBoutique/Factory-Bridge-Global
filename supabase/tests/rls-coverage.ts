/**
 * Registry of every table in schema `public` and the harness file that covers it.
 * The coverage guard in migrations.test.ts fails CI when a public table exists that is not listed
 * here (or is listed but has no RLS / no policy). Public-read reference tables are allow-listed
 * explicitly and must still have RLS enabled with a permissive select policy.
 */
export const TENANT_TABLES: ReadonlyArray<{ table: string; coveredBy: string }> = [
  // 0002 tenancy_core
  { table: "organizations", coveredBy: "rls.test.ts" },
  { table: "user_profiles", coveredBy: "rls.test.ts" },
  { table: "memberships", coveredBy: "rls.test.ts" },
  { table: "invites", coveredBy: "rls.test.ts" },
  // 0003 audit_foundation
  { table: "audit_events", coveredBy: "rls.test.ts" },
  { table: "security_events", coveredBy: "rls.test.ts" },
  { table: "document_access_log", coveredBy: "rls.test.ts" },
  // 0003b ai_runs_budget
  { table: "ai_runs", coveredBy: "ai-runs.test.ts" },
  { table: "ai_budgets", coveredBy: "ai-runs.test.ts" },
  // 0004 taxonomy_products
  { table: "products", coveredBy: "taxonomy.test.ts" },
  { table: "product_variants", coveredBy: "taxonomy.test.ts" },
  { table: "product_specifications", coveredBy: "taxonomy.test.ts" },
  // 0005 suppliers_core
  { table: "supplier_profiles", coveredBy: "suppliers.test.ts" },
  { table: "supplier_facilities", coveredBy: "suppliers.test.ts" },
  { table: "supplier_contacts", coveredBy: "suppliers.test.ts" },
  { table: "contact_disclosure_grants", coveredBy: "suppliers.test.ts" },
  { table: "source_systems", coveredBy: "suppliers.test.ts" },
  { table: "source_permissions", coveredBy: "suppliers.test.ts" },
  { table: "research_leads", coveredBy: "suppliers.test.ts" },
  // 0006 documents_storage
  { table: "documents", coveredBy: "documents.test.ts" },
  { table: "document_pages", coveredBy: "documents.test.ts" },
  { table: "document_cells", coveredBy: "documents.test.ts" },
  // 0007 supplier_evidence
  { table: "supplier_verification_checks", coveredBy: "supplier-evidence.test.ts" },
  { table: "supplier_documents", coveredBy: "supplier-evidence.test.ts" },
  // 0008 projects_briefs
  { table: "sourcing_projects", coveredBy: "projects.test.ts" },
  { table: "project_assignments", coveredBy: "projects.test.ts" },
  { table: "project_suppliers", coveredBy: "projects.test.ts" },
  { table: "buyer_briefs", coveredBy: "projects.test.ts" },
  { table: "brief_items", coveredBy: "projects.test.ts" },
  // 0009 quotations
  { table: "quote_groups", coveredBy: "quotations.test.ts" },
  { table: "quotations", coveredBy: "quotations.test.ts" },
  { table: "quote_tiers", coveredBy: "quotations.test.ts" },
  { table: "quote_fees", coveredBy: "quotations.test.ts" },
  { table: "quotation_states", coveredBy: "quotations.test.ts" },
  { table: "quote_status_events", coveredBy: "quotations.test.ts" },
  { table: "quote_visibility_grants", coveredBy: "quotations.test.ts" },
];

/** Reference tables readable by every signed-in user; still RLS-enabled with an explicit select policy. */
export const PUBLIC_READ_TABLES: ReadonlyArray<string> = [
  "product_taxonomy",
  "attribute_definitions",
  "supplier_stage_requirements",
];

export type TablePrivilege = "SELECT" | "INSERT" | "UPDATE" | "DELETE";

/**
 * The maximum table privileges `authenticated` may hold on each public table — the grant layer that
 * sits underneath RLS. Supabase default privileges grant ALL on every new table to anon, authenticated
 * and service_role, so a migration must revoke first and grant back only what a policy can allow.
 * migrations.test.ts asserts has_table_privilege() against this list for every registered table and
 * that anon can read nothing. Anything a table needs beyond this list is a matrix change
 * (docs/SECURITY_PERMISSION_MATRIX.md), not a test edit.
 */
export const AUTHENTICATED_MAX_PRIVILEGES: Readonly<Record<string, ReadonlyArray<TablePrivilege>>> =
  {
    // 0002 tenancy_core — create/join only through app.create_organization / app.accept_invite
    organizations: ["SELECT", "UPDATE"],
    user_profiles: ["SELECT", "INSERT", "UPDATE"],
    memberships: ["SELECT", "UPDATE"],
    invites: ["SELECT"],
    // 0003 audit_foundation — written only by trusted writers (service_role / SECURITY DEFINER fns)
    audit_events: ["SELECT"],
    security_events: ["SELECT"],
    document_access_log: ["SELECT"],
    // 0003b ai_runs_budget — written only via app.record_ai_run / app.set_ai_budget
    ai_runs: ["SELECT"],
    ai_budgets: ["SELECT"],
    // 0004 taxonomy_products — reference tables are read-only for every signed-in user (platform admins
    // curate them via service_role); org-owned product rows are created/edited by members under RLS
    product_taxonomy: ["SELECT"],
    attribute_definitions: ["SELECT"],
    products: ["SELECT", "INSERT", "UPDATE"],
    product_variants: ["SELECT", "INSERT", "UPDATE"],
    product_specifications: ["SELECT", "INSERT", "UPDATE"],
    // 0005 suppliers_core — no DELETE anywhere (deactivate / revoke instead); source_systems rows come from
    // migrations and only their status/notes change (platform_admin)
    supplier_profiles: ["SELECT", "INSERT", "UPDATE"],
    supplier_facilities: ["SELECT", "INSERT", "UPDATE"],
    supplier_contacts: ["SELECT", "INSERT", "UPDATE"],
    contact_disclosure_grants: ["SELECT", "INSERT", "UPDATE"],
    source_systems: ["SELECT", "UPDATE"],
    source_permissions: ["SELECT", "INSERT", "UPDATE"],
    research_leads: ["SELECT", "INSERT", "UPDATE"],
    // 0006 documents_storage — members register an upload and may discard; the worker (service_role) owns scanning,
    // promotion and parse output; document_access_log stays SELECT-only (written via app.log_document_access)
    documents: ["SELECT", "INSERT", "UPDATE"],
    document_pages: ["SELECT"],
    document_cells: ["SELECT"],
    // 0007 supplier_evidence — checks are immutable except notes (trigger); requirements are migration-owned data
    supplier_verification_checks: ["SELECT", "INSERT", "UPDATE"],
    supplier_documents: ["SELECT", "INSERT", "UPDATE"],
    supplier_stage_requirements: ["SELECT"],
    // 0008 projects_briefs — no DELETE: projects close, assignments deactivate, shortlist rows are dropped by status
    sourcing_projects: ["SELECT", "INSERT", "UPDATE"],
    project_assignments: ["SELECT", "INSERT", "UPDATE"],
    project_suppliers: ["SELECT", "INSERT", "UPDATE"],
    buyer_briefs: ["SELECT", "INSERT", "UPDATE"],
    brief_items: ["SELECT", "INSERT", "UPDATE"],
    // 0009 quotations — payload and lifecycle are written only inside app.supersede_quotation / app.transition_quotation
    quote_groups: ["SELECT"],
    quotations: ["SELECT"],
    quote_tiers: ["SELECT"],
    quote_fees: ["SELECT"],
    quotation_states: ["SELECT"],
    quote_status_events: ["SELECT"],
    quote_visibility_grants: ["SELECT", "INSERT", "UPDATE"],
  };
