/**
 * Request-scoped Supabase client for Server Components, Server Actions and Route Handlers (B-05, ADR-041 §3).
 *
 * The session lives in cookies written and read only on the server — there is no browser Supabase client — so they
 * are HttpOnly, SameSite=Lax and Secure outside local http. Every query made through this client carries the signed-in
 * user's JWT, so RLS applies; no privilege is added here. Returns null when Supabase is not configured (fail closed).
 */
import { createServerClient, type CookieOptionsWithName } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { Database } from "@fbg/db";
import { resolveSupabaseConfig, type SupabasePublicConfig } from "./config";

export type UserSupabase = SupabaseClient<Database>;

export function sessionCookieOptions(config: SupabasePublicConfig): CookieOptionsWithName {
  return { path: "/", sameSite: "lax", httpOnly: true, secure: config.secureCookies };
}

export async function createServerSupabase(): Promise<UserSupabase | null> {
  const config = resolveSupabaseConfig();
  if (!config) return null;
  const store = await cookies();
  return createServerClient<Database>(config.url, config.anonKey, {
    cookieOptions: sessionCookieOptions(config),
    cookies: {
      getAll: () => store.getAll().map(({ name, value }) => ({ name, value })),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          // Server Components cannot write cookies; src/proxy.ts refreshes the session before render instead.
        }
      },
    },
  });
}
