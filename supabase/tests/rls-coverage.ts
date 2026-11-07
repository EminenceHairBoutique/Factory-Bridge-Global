/**
 * Registry of every tenant-scoped table in schema `public` and the harness file that covers it.
 * The coverage guard in migrations.test.ts fails CI when a public table exists that is not listed
 * here (or is listed but has no RLS / no policy). Public-read reference tables are allow-listed
 * explicitly and must still have RLS enabled with a permissive select policy.
 *
 * 0001 creates no tables. B-04 adds organizations/user_profiles/memberships/invites here together
 * with their rls.test.ts cases.
 */
export const TENANT_TABLES: ReadonlyArray<{ table: string; coveredBy: string }> = [];

export const PUBLIC_READ_TABLES: ReadonlyArray<string> = [];
