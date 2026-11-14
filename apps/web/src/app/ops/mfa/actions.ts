"use server";

/**
 * TOTP enrolment and challenge for internal staff (B-05b, ADR-043 §1). Server actions only: the Supabase client lives
 * on the server with the user's HttpOnly session cookies (ADR-042 §3), and a verified challenge rewrites those cookies
 * with the aal2 session. The browser receives the QR code and setup key once, during enrolment, because the person
 * must put them into their authenticator app; neither is stored or logged here. Codes are never logged.
 * `next` is untrusted and passes afterMfaPath() (an /ops path, never /ops/mfa) or becomes /ops.
 * `redirect()` throws by design, so it is never inside a try block.
 */
import { redirect } from "next/navigation";
import type { AuthError } from "@supabase/supabase-js";
import { totpQrDataUrl } from "@/server/auth/assurance";
import { requireStaffForMfa } from "@/server/auth/guard";
import { afterMfaPath, mfaHref } from "@/server/auth/paths";
import {
  fieldErrors,
  formObject,
  mfaCodeSchema,
  mfaEnrollConfirmSchema,
} from "@/server/auth/schemas";
import { MFA_COPY } from "@/workspace/copy";

export interface EnrollStartState {
  readonly error?: string;
  readonly factorId?: string;
  /** data:image/svg+xml URL of the QR code, re-encoded here; absent when Supabase returned something unexpected. */
  readonly qrCode?: string;
  /** Base32 setup key for typing into the app by hand. */
  readonly secret?: string;
}

export interface MfaCodeState {
  readonly error?: string;
  readonly fieldErrors?: Readonly<Record<string, string>>;
}

const ISSUER = "Factory Bridge Global";

function rateLimited(error: AuthError | null): boolean {
  return error?.status === 429 || error?.code === "over_request_rate_limit";
}

export async function startTotpEnrollment(
  _prev: EnrollStartState,
  form: FormData,
): Promise<EnrollStartState> {
  const next = afterMfaPath(form.get("next"));
  const { supabase, assurance } = await requireStaffForMfa(next);
  if (assurance.level === "aal2") redirect(next);
  if (assurance.hasVerifiedFactor) redirect(mfaHref("verify", next));
  // Abandoned set-ups leave unverified factors behind; drop them so the new one is the only pending factor.
  const { data: factors } = await supabase.auth.mfa.listFactors();
  for (const f of factors?.all ?? []) {
    if (f.factor_type === "totp" && f.status === "unverified") {
      await supabase.auth.mfa.unenroll({ factorId: f.id });
    }
  }
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", issuer: ISSUER });
  if (rateLimited(error)) return { error: MFA_COPY.rateLimited };
  if (error || !data || data.type !== "totp" || !/^[A-Z2-7]+=*$/.test(data.totp.secret)) {
    if (error)
      console.warn(
        `authenticator enrolment refused (${error.code ?? "?"}, ${error.status ?? "?"})`,
      );
    return { error: MFA_COPY.startFailed };
  }
  const qrCode = totpQrDataUrl(data.totp.qr_code);
  return { factorId: data.id, secret: data.totp.secret, ...(qrCode ? { qrCode } : {}) };
}

export async function confirmTotpEnrollment(
  _prev: MfaCodeState,
  form: FormData,
): Promise<MfaCodeState> {
  const next = afterMfaPath(form.get("next"));
  const { supabase, assurance } = await requireStaffForMfa(next);
  if (assurance.level === "aal2") redirect(next);
  const parsed = mfaEnrollConfirmSchema.safeParse(formObject(form));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  // Supabase Auth accepts the factor only if it belongs to this user; a verified challenge upgrades the session.
  const { error } = await supabase.auth.mfa.challengeAndVerify({
    factorId: parsed.data.factorId,
    code: parsed.data.code,
  });
  if (rateLimited(error)) return { error: MFA_COPY.rateLimited };
  if (error) return { error: MFA_COPY.badCode };
  redirect(next);
}

export async function verifyTotp(_prev: MfaCodeState, form: FormData): Promise<MfaCodeState> {
  const next = afterMfaPath(form.get("next"));
  const { supabase, assurance } = await requireStaffForMfa(next);
  if (assurance.level === "aal2") redirect(next);
  if (!assurance.hasVerifiedFactor) redirect(mfaHref("enroll", next));
  const parsed = mfaCodeSchema.safeParse(formObject(form));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
  const factor = factors?.totp[0];
  if (listError || !factor) return { error: MFA_COPY.badCode };
  const { error } = await supabase.auth.mfa.challengeAndVerify({
    factorId: factor.id,
    code: parsed.data.code,
  });
  if (rateLimited(error)) return { error: MFA_COPY.rateLimited };
  if (error) return { error: MFA_COPY.badCode };
  redirect(next);
}
