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
];

export const PUBLIC_READ_TABLES: ReadonlyArray<string> = [];
