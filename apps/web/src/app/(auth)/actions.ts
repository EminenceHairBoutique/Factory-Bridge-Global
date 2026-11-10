"use server";

/**
 * Sign-in, email-code and sign-up actions (B-05, ADR-041 §3). Server-only: the browser never holds a Supabase client
 * or token. Messages never say whether an account exists. `next` is untrusted and passes safeNextPath() or is dropped.
 * `redirect()` throws by design, so it is never inside a try block.
 */
import { redirect } from "next/navigation";
import type { AuthError } from "@supabase/supabase-js";
import {
  clearActiveOrgCookie,
  clearPendingOtpEmail,
  ensureProfile,
  readPendingOtpEmail,
  setPendingOtpEmail,
} from "@/server/auth/cookies";
import { landingPath, loadMemberships, preferredOrgId } from "@/server/auth/guard";
import {
  ONBOARDING_PATH,
  SIGN_IN_CODE_PATH,
  SIGN_IN_PATH,
  safeNextPath,
} from "@/server/auth/paths";
import {
  codeRequestSchema,
  codeVerifySchema,
  fieldErrors,
  formObject,
  passwordSignInSchema,
  signUpSchema,
} from "@/server/auth/schemas";
import { createServerSupabase, type UserSupabase } from "@/server/auth/supabase";
import { AUTH_COPY } from "@/workspace/copy";

export interface AuthFormState {
  readonly error?: string;
  readonly fieldErrors?: Readonly<Record<string, string>>;
  readonly email?: string;
}

function emailOf(form: FormData): string {
  const v = form.get("email");
  return typeof v === "string" ? v.slice(0, 254) : "";
}

function withNext(path: string, next: string | null): string {
  return next ? `${path}?next=${encodeURIComponent(next)}` : path;
}

function rateLimited(error: AuthError | null): boolean {
  return error?.status === 429 || error?.code === "over_request_rate_limit";
}

async function destinationAfterSignIn(
  supabase: UserSupabase,
  userId: string,
  next: string | undefined,
): Promise<string> {
  const safe = safeNextPath(next);
  if (safe) return safe;
  return landingPath(await loadMemberships(supabase, userId), await preferredOrgId());
}

export async function signInWithPassword(
  _prev: AuthFormState,
  form: FormData,
): Promise<AuthFormState> {
  const parsed = passwordSignInSchema.safeParse(formObject(form));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), email: emailOf(form) };
  const supabase = await createServerSupabase();
  if (!supabase) return { error: AUTH_COPY.notConfigured, email: parsed.data.email };
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (rateLimited(error)) return { error: AUTH_COPY.rateLimited, email: parsed.data.email };
  if (error || !data.user) return { error: AUTH_COPY.badCredentials, email: parsed.data.email };
  await ensureProfile(supabase, data.user.id);
  redirect(await destinationAfterSignIn(supabase, data.user.id, parsed.data.next));
}

export async function requestEmailCode(
  _prev: AuthFormState,
  form: FormData,
): Promise<AuthFormState> {
  const parsed = codeRequestSchema.safeParse(formObject(form));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), email: emailOf(form) };
  const supabase = await createServerSupabase();
  if (!supabase) return { error: AUTH_COPY.notConfigured, email: parsed.data.email };
  // shouldCreateUser: false — a code never creates an account. Any other refusal (unknown address, signups closed)
  // is deliberately indistinguishable from success, so the form cannot be used to discover accounts.
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: { shouldCreateUser: false },
  });
  if (rateLimited(error)) return { error: AUTH_COPY.rateLimited, email: parsed.data.email };
  await setPendingOtpEmail(parsed.data.email);
  redirect(withNext(SIGN_IN_CODE_PATH, safeNextPath(parsed.data.next)));
}

export async function verifyEmailCode(
  _prev: AuthFormState,
  form: FormData,
): Promise<AuthFormState> {
  const parsed = codeVerifySchema.safeParse(formObject(form));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  const email = await readPendingOtpEmail();
  if (!email) return { error: AUTH_COPY.codeSessionExpired };
  const supabase = await createServerSupabase();
  if (!supabase) return { error: AUTH_COPY.notConfigured };
  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token: parsed.data.code,
    type: "email",
  });
  if (rateLimited(error)) return { error: AUTH_COPY.rateLimited };
  if (error || !data.user || !data.session) return { error: AUTH_COPY.badCode };
  await clearPendingOtpEmail();
  await ensureProfile(supabase, data.user.id);
  redirect(await destinationAfterSignIn(supabase, data.user.id, parsed.data.next));
}

export async function signUp(_prev: AuthFormState, form: FormData): Promise<AuthFormState> {
  const parsed = signUpSchema.safeParse(formObject(form));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), email: emailOf(form) };
  const supabase = await createServerSupabase();
  if (!supabase) return { error: AUTH_COPY.notConfigured, email: parsed.data.email };
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { data: parsed.data.fullName ? { full_name: parsed.data.fullName } : {} },
  });
  if (rateLimited(error)) return { error: AUTH_COPY.rateLimited, email: parsed.data.email };
  if (error?.code === "weak_password") {
    return { fieldErrors: { password: AUTH_COPY.weakPassword }, email: parsed.data.email };
  }
  if (error) return { error: AUTH_COPY.signUpRefused, email: parsed.data.email };
  const next = safeNextPath(parsed.data.next);
  if (data.session && data.user) {
    await ensureProfile(supabase, data.user.id, parsed.data.fullName);
    redirect(next ?? ONBOARDING_PATH);
  }
  // The project requires email confirmation: the same 6-digit code step confirms the address and signs in.
  await setPendingOtpEmail(parsed.data.email);
  redirect(withNext(SIGN_IN_CODE_PATH, next));
}

export async function signOut(): Promise<void> {
  const supabase = await createServerSupabase();
  if (supabase) await supabase.auth.signOut({ scope: "local" });
  await clearActiveOrgCookie();
  await clearPendingOtpEmail();
  redirect(SIGN_IN_PATH);
}
