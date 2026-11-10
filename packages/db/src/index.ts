/**
 * User-scoped Supabase client factory. RLS applies to every query made through this client.
 * `Database` is GENERATED into ./types.ts from the migration chain (`pnpm db:gen-types`; never edit by hand) and
 * CI's `db` job fails if it drifts from a fresh `supabase gen types typescript --local --schema public`.
 * Only the `public` schema is exposed through the Data API (supabase/config.toml); the review / quotation
 * functions live in schema `app` and are called server-side, not through this client's `.rpc()`.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

export type { Database, Json, Tables, TablesInsert, TablesUpdate, Enums } from "./types";

export interface PublicSupabaseConfig {
  readonly url: string;
  readonly anonKey: string;
}

export function createUserClient(
  config: PublicSupabaseConfig,
  accessToken?: string,
): SupabaseClient<Database> {
  return createClient<Database>(config.url, config.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: accessToken ? { headers: { Authorization: `Bearer ${accessToken}` } } : {},
  });
}
