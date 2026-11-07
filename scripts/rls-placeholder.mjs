// Placeholder for the tenant-isolation suite (BACKLOG B-07).
// It exits non-zero on purpose once migrations exist without a harness, so CI cannot pass by accident.
import { existsSync, readdirSync } from "node:fs";

const migrationsDir = new URL("../supabase/migrations/", import.meta.url);
const harness = new URL("../supabase/tests/rls.test.ts", import.meta.url);

const hasMigrations = existsSync(migrationsDir) && readdirSync(migrationsDir).length > 0;
const hasHarness = existsSync(harness);

if (hasMigrations && !hasHarness) {
  console.error(
    "RLS harness missing: supabase/migrations exist but supabase/tests/rls.test.ts does not. See BACKLOG B-07.",
  );
  process.exit(1);
}

if (!hasMigrations) {
  console.warn(
    "test:rls — no migrations yet; nothing to verify (Phase 1 B-03 adds the first migration).",
  );
  process.exit(0);
}

console.warn("test:rls — delegate to the Vitest RLS suite once B-07 lands.");
process.exit(0);
