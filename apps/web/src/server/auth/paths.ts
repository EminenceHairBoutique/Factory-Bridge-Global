/**
 * Route constants and the post-sign-in redirect allow-list (B-05). Pure, so it is unit-tested directly.
 * A `next` value comes from the query string or a form field — untrusted input — and is honoured only when it is a
 * same-origin path into a workspace, onboarding or an invite. Anything else (absolute URLs, protocol-relative `//`,
 * backslashes, control characters, other paths) is dropped, so sign-in can never become an open redirect.
 */

export const SIGN_IN_PATH = "/sign-in";
export const SIGN_IN_CODE_PATH = "/sign-in/code";
export const SIGN_UP_PATH = "/sign-up";
export const ONBOARDING_PATH = "/onboarding";

const ALLOWED_PREFIXES = ["/app", "/ops", "/supplier", "/onboarding", "/invite/"] as const;
const BASE = "http://next.invalid";

export function safeNextPath(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  if (value.length === 0 || value.length > 512) return null;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return null;
  for (let i = 0; i < value.length; i++) {
    const c = value.charCodeAt(i);
    if (c < 0x20 || c === 0x7f) return null;
  }
  let url: URL;
  try {
    url = new URL(value, BASE);
  } catch {
    return null;
  }
  if (url.origin !== BASE) return null;
  const path = url.pathname;
  const allowed = ALLOWED_PREFIXES.some((p) =>
    p.endsWith("/")
      ? path.startsWith(p) && path.length > p.length
      : path === p || path.startsWith(`${p}/`),
  );
  return allowed ? `${path}${url.search}` : null;
}

/** `/sign-in?next=…` for a workspace path the visitor asked for (dropped when it is not allowed). */
export function signInHref(next?: string | null): string {
  const safe = safeNextPath(next);
  return safe ? `${SIGN_IN_PATH}?next=${encodeURIComponent(safe)}` : SIGN_IN_PATH;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

/** Raw invite tokens are 64 lowercase hex characters (app.create_invite). */
export function isInviteToken(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{64}$/.test(value);
}
