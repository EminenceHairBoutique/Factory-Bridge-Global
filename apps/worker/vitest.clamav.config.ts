import { defineConfig } from "vitest/config";

/**
 * Real-ClamAV suite (B-13): invoked only deliberately (`pnpm --filter @fbg/worker test:clamav` with CLAMAV_HOST and
 * CLAMAV_PORT pointing at a running clamd). A missing daemon is a failure, never a skip.
 */
export default defineConfig({
  test: {
    include: ["src/**/*.clamav.integration.test.ts"],
    passWithNoTests: false,
    testTimeout: 120_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
});
