/**
 * E2E environment (B-05). The suite drives a production build of apps/web against a LOCAL Supabase stack only:
 * every URL must be loopback, so the service-role key it needs for fixtures can never be pointed at a hosted project.
 * Missing configuration fails loudly — the suite never "passes" without running.
 */

export interface E2eEnv {
  readonly appUrl: string;
  readonly supabaseUrl: string;
  readonly anonKey: string;
  readonly serviceRoleKey: string;
  readonly dbUrl: string;
  readonly mailpitUrl: string;
}

const LOOPBACK = new Set(["127.0.0.1", "localhost", "[::1]"]);

function local(name: string, raw: string | undefined, fallback?: string): string {
  const value = (raw ?? fallback ?? "").trim();
  if (!value) {
    throw new Error(
      `e2e: ${name} is not set. Start the local stack (supabase start) and export the values printed by ` +
        "`supabase status` — see e2e/README.md. Nothing was tested.",
    );
  }
  const host = new URL(value).hostname;
  if (!LOOPBACK.has(host)) {
    throw new Error(`e2e: ${name} must point at a loopback host, got ${host}. Refusing to run.`);
  }
  return value.replace(/\/+$/, "");
}

function required(name: string, raw: string | undefined): string {
  const value = (raw ?? "").trim();
  if (!value) throw new Error(`e2e: ${name} is not set. Nothing was tested.`);
  return value;
}

export function e2eEnv(env: NodeJS.ProcessEnv = process.env): E2eEnv {
  return {
    appUrl: local("E2E_APP_URL", env["E2E_APP_URL"], "http://127.0.0.1:3000"),
    supabaseUrl: local("NEXT_PUBLIC_SUPABASE_URL", env["NEXT_PUBLIC_SUPABASE_URL"]),
    anonKey: required("NEXT_PUBLIC_SUPABASE_ANON_KEY", env["NEXT_PUBLIC_SUPABASE_ANON_KEY"]),
    serviceRoleKey: required("E2E_SUPABASE_SERVICE_ROLE_KEY", env["E2E_SUPABASE_SERVICE_ROLE_KEY"]),
    dbUrl: local(
      "E2E_DB_URL",
      env["E2E_DB_URL"],
      "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
    ),
    mailpitUrl: local("E2E_MAILPIT_URL", env["E2E_MAILPIT_URL"], "http://127.0.0.1:54324"),
  };
}
