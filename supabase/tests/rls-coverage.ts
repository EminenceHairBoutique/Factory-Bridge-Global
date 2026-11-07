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
];

export const PUBLIC_READ_TABLES: ReadonlyArray<string> = [];

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
  };
