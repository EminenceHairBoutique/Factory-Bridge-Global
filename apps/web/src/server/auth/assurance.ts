/**
 * Authenticator assurance for the web guard (B-05b, ADR-043 §1). Pure, so it is unit-tested directly.
 *
 * The guard first has Supabase Auth validate the session's access token (`auth.getUser()`), then reads the `aal` claim
 * from that same token. Decoding without verifying is safe only because of that order; never call aalFromAccessToken
 * on a token Supabase Auth has not just accepted. The database reads the same claim from the JWT PostgREST verified
 * (migration 0014 app.session_aal), so a wrong answer here could not widen access, only misroute a page.
 */
import { assuranceLevel, type AssuranceLevel } from "@fbg/domain/workspace";

export interface Assurance {
  /** Current level of this session: aal2 only after a TOTP challenge was verified in it. */
  readonly level: AssuranceLevel;
  /** The user has a verified TOTP factor, so the next step is a challenge rather than enrolment. */
  readonly hasVerifiedFactor: boolean;
}

export const NO_ASSURANCE: Assurance = { level: "aal1", hasVerifiedFactor: false };

/** The `aal` claim of an access token that Supabase Auth has ALREADY validated in this request; aal1 on any doubt. */
export function aalFromAccessToken(token: unknown): AssuranceLevel {
  if (typeof token !== "string" || token.length > 16_384) return "aal1";
  const parts = token.split(".");
  if (parts.length !== 3 || !parts[1]) return "aal1";
  try {
    const payload: unknown = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return "aal1";
    return assuranceLevel((payload as Record<string, unknown>)["aal"]);
  } catch {
    return "aal1";
  }
}

/** Upper bound for the QR SVG Supabase returns (observed ~320 KB). */
export const QR_MAX_CHARS = 2_000_000;

interface FactorLike {
  readonly factor_type?: unknown;
  readonly status?: unknown;
}

/**
 * Supabase Auth returns the enrolment QR code as `data:image/svg+xml;utf-8,<?xml …?><!-- … --><svg …>` with the SVG
 * unescaped (about 320 KB: one <rect> per module), which is not a well-formed URL. Re-encode it as base64 for
 * `<img src>` (an SVG in <img> cannot run script anyway), or return undefined for anything that is not an SVG document;
 * the setup key is still shown either way.
 */
export function totpQrDataUrl(raw: unknown): string | undefined {
  if (typeof raw !== "string" || raw.length > QR_MAX_CHARS) return undefined;
  const svg = raw.replace(/^data:image\/svg\+xml;(utf-8|charset=utf-8),/i, "");
  const prelude = /^\s*(<\?xml[^>]*\?>\s*)?(<!--[\s\S]*?-->\s*)*<svg[\s>]/i;
  if (!prelude.test(svg) || !/<\/svg>\s*$/i.test(svg)) return undefined;
  return `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`;
}

/** TOTP is the only factor type enabled (supabase/config.toml), so only a verified TOTP factor counts. */
export function hasVerifiedTotp(factors: readonly FactorLike[] | null | undefined): boolean {
  return (factors ?? []).some((f) => f.factor_type === "totp" && f.status === "verified");
}
