/**
 * Session refresh (B-05, ADR-042 §3). Server Components cannot write cookies, so this proxy runs Supabase Auth's
 * `getUser()` before render on the auth and workspace paths only: an expired access token is refreshed and the new
 * HttpOnly cookies are written to both the request (for this render) and the response. It makes no authorization
 * decision — every page and action runs the guard (server/auth/guard.ts) — and it never runs on the public site or
 * on /design-preview (see `config.matcher`). Without Supabase configuration it does nothing.
 */
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { resolveSupabaseConfig } from "./server/auth/config";
import { sessionCookieOptions } from "./server/auth/supabase";

export async function proxy(request: NextRequest) {
  const supabaseConfig = resolveSupabaseConfig();
  let response = NextResponse.next({ request });
  if (!supabaseConfig) return response;
  const supabase = createServerClient(supabaseConfig.url, supabaseConfig.anonKey, {
    cookieOptions: sessionCookieOptions(supabaseConfig),
    cookies: {
      getAll: () => request.cookies.getAll().map(({ name, value }) => ({ name, value })),
      setAll: (list, headers) => {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
        for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
      },
    },
  });
  await supabase.auth.getUser();
  return response;
}

export const config = {
  matcher: [
    "/app/:path*",
    "/ops/:path*",
    "/supplier/:path*",
    "/onboarding/:path*",
    "/invite/:path*",
    "/sign-in/:path*",
    "/sign-up/:path*",
  ],
};
