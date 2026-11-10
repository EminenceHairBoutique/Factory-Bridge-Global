/**
 * Which delivery mechanism the public sourcing-request form may use — B-31, proposed ADR-040.
 *
 * Fail closed. No delivery mechanism is approved yet (OQ-16 / ADR-028: no paid accounts; OQ-02: no sending
 * domain; OQ-06: privacy policy pending counsel), so the default everywhere is `not_configured`, which renders
 * the form switched off and makes the server action refuse every submission.
 *
 *   INQUIRY_DELIVERY unset | "disabled"  → not_configured
 *   INQUIRY_DELIVERY = "dry_run"          → validated end to end, nothing sent or stored. Only outside a
 *                                           production deployment: NODE_ENV !== "production", or a production
 *                                           build whose APP_ENV names a non-production environment.
 *   INQUIRY_DELIVERY = "resend"           → one plain-text email to INQUIRY_TO_EMAIL via the Resend REST API.
 *                                           Requires RESEND_API_KEY, EMAIL_FROM and INQUIRY_TO_EMAIL with real
 *                                           values; placeholders from .env.example count as missing.
 *
 * Anything else (typos, partial configuration) resolves to not_configured. Secrets never leave this module's
 * caller (the server action); the page only receives the `mode`.
 */
export type InquiryMode = "not_configured" | "dry_run" | "resend";

export interface InquiryEnv {
  readonly NODE_ENV?: string | undefined;
  readonly APP_ENV?: string | undefined;
  readonly INQUIRY_DELIVERY?: string | undefined;
  readonly RESEND_API_KEY?: string | undefined;
  readonly EMAIL_FROM?: string | undefined;
  readonly INQUIRY_TO_EMAIL?: string | undefined;
}

export type InquiryConfig =
  | { mode: "not_configured"; reason: string }
  | { mode: "dry_run" }
  | { mode: "resend"; apiKey: string; from: string; to: string };

const PLACEHOLDER = /replace-me|your-verified-domain|example\.(com|org|net)$|\.example$/i;
const EMAIL = /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/;

function isProductionDeployment(env: InquiryEnv): boolean {
  if (env.NODE_ENV !== "production") return false;
  const appEnv = env.APP_ENV?.trim().toLowerCase();
  return !appEnv || appEnv === "production" || appEnv === "prod";
}

function usable(value: string | undefined): string | null {
  const v = value?.trim();
  if (!v || PLACEHOLDER.test(v)) return null;
  return v;
}

/** `EMAIL_FROM` may be a bare address or `Name <address>`. */
function senderAddress(from: string): string {
  const m = /<([^>]+)>\s*$/.exec(from);
  return (m?.[1] ?? from).trim();
}

export function resolveInquiryConfig(env: InquiryEnv): InquiryConfig {
  const requested = env.INQUIRY_DELIVERY?.trim().toLowerCase();
  if (!requested || requested === "disabled") {
    return { mode: "not_configured", reason: "delivery_disabled" };
  }
  if (requested === "dry_run") {
    if (isProductionDeployment(env)) {
      return { mode: "not_configured", reason: "dry_run_blocked_in_production" };
    }
    return { mode: "dry_run" };
  }
  if (requested === "resend") {
    const apiKey = usable(env.RESEND_API_KEY);
    const from = usable(env.EMAIL_FROM);
    const to = usable(env.INQUIRY_TO_EMAIL);
    if (!apiKey || !from || !to) return { mode: "not_configured", reason: "resend_incomplete" };
    if (!EMAIL.test(senderAddress(from)) || !EMAIL.test(to) || /[\r\n]/.test(from + to)) {
      return { mode: "not_configured", reason: "resend_invalid_address" };
    }
    return { mode: "resend", apiKey, from, to };
  }
  return { mode: "not_configured", reason: "unknown_delivery" };
}

/** The only part of the configuration the page (and therefore the browser) may see. */
export function inquiryMode(env: InquiryEnv): InquiryMode {
  return resolveInquiryConfig(env).mode;
}
