/**
 * Supabase Auth configuration for the web tier (B-05, ADR-041 §3). Fails closed: anything missing, malformed or
 * still a `.env.example` placeholder means "not configured", and the auth pages say so instead of guessing.
 *
 * Only the project URL and the anon (publishable) key are read here. Both are public by design; the anon key carries
 * no privilege beyond `anon`, and every query this app makes runs with the signed-in user's JWT under RLS. The
 * service-role key is never read by this module (ESLint confines it to server/privileged/**).
 *
 * `env` is read through a parameter, not `process.env.NEXT_PUBLIC_*` literals, so the values are resolved at request
 * time rather than inlined at build time: one production build serves any environment, and a build without
 * Supabase variables (CI's build gate) still works and fails closed.
 */

export interface SupabasePublicConfig {
  readonly url: string;
  readonly anonKey: string;
  /** Session cookies carry `Secure` unless the app is served over plain http (local development and CI only). */
  readonly secureCookies: boolean;
}

const PLACEHOLDER = /YOUR-PROJECT|replace-me|changeme/i;

function httpUrl(raw: string): string | null {
  const value = raw.trim();
  if (!value || PLACEHOLDER.test(value)) return null;
  try {
    const u = new URL(value);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    if (u.username || u.password || u.search || u.hash) return null;
    return u.origin + u.pathname.replace(/\/+$/, "");
  } catch {
    return null;
  }
}

function publicKey(raw: string): string | null {
  const value = raw.trim();
  if (value.length < 20 || PLACEHOLDER.test(value) || /\s/.test(value)) return null;
  return value;
}

export function resolveSupabaseConfig(
  env: Readonly<Record<string, string | undefined>> = process.env,
): SupabasePublicConfig | null {
  const url = httpUrl(env["NEXT_PUBLIC_SUPABASE_URL"] ?? "");
  const anonKey = publicKey(env["NEXT_PUBLIC_SUPABASE_ANON_KEY"] ?? "");
  if (!url || !anonKey) return null;
  const appUrl = (env["NEXT_PUBLIC_APP_URL"] ?? "").trim();
  return { url, anonKey, secureCookies: !appUrl.startsWith("http://") };
}
