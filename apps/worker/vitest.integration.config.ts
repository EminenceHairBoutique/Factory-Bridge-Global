import { defineConfig } from "vitest/config";

/**
 * Worker integration suite: real pgmq on the local Supabase stack (CI `db` job). Invoked only deliberately
 * (`pnpm --filter @fbg/worker test:integration` with DATABASE_URL); a missing database is a failure, never a skip.
 */
export default defineConfig({
  test: {
    include: ["src/**/*.integration.test.ts"],
    passWithNoTests: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
});
