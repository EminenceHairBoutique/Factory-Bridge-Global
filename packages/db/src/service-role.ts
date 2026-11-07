/**
 * SERVICE-ROLE CLIENT — bypasses RLS.
 * Importing this module is lint-restricted to apps/worker and apps/web/src/server/privileged/** (eslint.config.mjs).
 * Every caller must re-check authorization explicitly and write an audit event with acting_as = 'system'.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./index.js";

export function createServiceRoleClient(
  url: string,
  serviceRoleKey: string,
): SupabaseClient<Database> {
  // `globalThis.window` exists only in browsers; this module has no DOM lib on purpose.
  if ("window" in globalThis) {
    throw new Error("Service-role client must never be constructed in a browser context.");
  }
  return createClient<Database>(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
