/**
 * User-scoped Supabase client factory. RLS applies to every query made through this client.
 * Types are generated into ./types.ts by `supabase gen types typescript --local` once migrations exist (B-03).
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type Database = Record<string, never>; // replaced by generated types in B-03

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
