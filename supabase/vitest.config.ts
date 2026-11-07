import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    // A database suite that finds no tests is a failure, never a pass (directive: no placeholder greens).
    passWithNoTests: false,
    testTimeout: 60_000,
    hookTimeout: 120_000,
    fileParallelism: false,
  },
});
