/**
 * Playwright (B-05). One serial worker: the specs share one synthetic world on one local Supabase stack, and a few of
 * them change it on purpose (an invite is consumed, a role is changed). No retries: a flaky pass is not evidence.
 * The web server is the PRODUCTION build (`next build` must have run) started with the local stack's public values.
 */
import { defineConfig, devices } from "@playwright/test";
import { e2eEnv } from "./support/env";

const env = e2eEnv();

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: !!process.env["CI"],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env["CI"] ? [["list"], ["html", { open: "never" }]] : [["list"]],
  globalSetup: "./support/global-setup.ts",
  use: {
    baseURL: env.appUrl,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `pnpm --dir ../apps/web exec next start --port ${new URL(env.appUrl).port || "3000"} --hostname 127.0.0.1`,
    url: `${env.appUrl}/api/health`,
    reuseExistingServer: false,
    timeout: 120_000,
    stdout: "pipe",
    stderr: "pipe",
    env: {
      NEXT_PUBLIC_SUPABASE_URL: env.supabaseUrl,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: env.anonKey,
      NEXT_PUBLIC_APP_URL: env.appUrl,
      NEXT_TELEMETRY_DISABLED: "1",
    },
  },
});
