/**
 * App cookies next to the Supabase session cookies (B-05). Both are HttpOnly and SameSite=Lax, and neither grants
 * anything: `fbg_org` is a preference the guard re-checks against live memberships on every request, and
 * `fbg_otp` only remembers which address a sign-in code was sent to, so the email never travels in a URL.
 * Writable from Server Actions and Route Handlers only.
 */
import { cookies } from "next/headers";
import { resolveSupabaseConfig } from "./config";
import { ACTIVE_ORG_COOKIE } from "./guard";
import type { UserSupabase } from "./supabase";

export const OTP_EMAIL_COOKIE = "fbg_otp";

function base() {
  const secure = resolveSupabaseConfig()?.secureCookies ?? true;
  return { httpOnly: true, sameSite: "lax" as const, secure, path: "/" };
}

export async function setActiveOrgCookie(orgId: string): Promise<void> {
  (await cookies()).set(ACTIVE_ORG_COOKIE, orgId, { ...base(), maxAge: 60 * 60 * 24 * 30 });
}

export async function clearActiveOrgCookie(): Promise<void> {
  (await cookies()).delete({ name: ACTIVE_ORG_COOKIE, path: "/" });
}

export async function setPendingOtpEmail(email: string): Promise<void> {
  (await cookies()).set(OTP_EMAIL_COOKIE, email, { ...base(), maxAge: 60 * 15 });
}

export async function readPendingOtpEmail(): Promise<string | null> {
  const value = (await cookies()).get(OTP_EMAIL_COOKIE)?.value ?? "";
  return /^[^\s@]+@[^\s@]+$/.test(value) && value.length <= 254 ? value : null;
}

export async function clearPendingOtpEmail(): Promise<void> {
  (await cookies()).delete({ name: OTP_EMAIL_COOKIE, path: "/" });
}

/**
 * ADR-041 §2: the profile row is created by the user on first sign-in (`insert … on conflict do nothing`, allowed by
 * 0002's user_profiles_insert policy). Failure is not fatal — every reader treats a missing profile as the defaults.
 */
export async function ensureProfile(
  supabase: UserSupabase,
  userId: string,
  fullName?: string | null,
): Promise<void> {
  const row: { user_id: string; full_name?: string } = { user_id: userId };
  if (fullName) row.full_name = fullName;
  const { error } = await supabase
    .from("user_profiles")
    .upsert(row, { onConflict: "user_id", ignoreDuplicates: true });
  if (error) console.error(`user_profiles upsert failed (${error.code ?? "unknown"})`);
}
