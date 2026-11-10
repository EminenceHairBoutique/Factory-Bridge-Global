import { configDefaults, defineConfig } from "vitest/config";

// Unit tests only: no database. The pgmq integration suite has its own config (vitest.integration.config.ts).
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    exclude: [...configDefaults.exclude, "src/**/*.integration.test.ts"],
  },
});
