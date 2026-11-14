/**
 * Boundary validation for every auth and workspace form (CLAUDE.md §5: zod at every boundary). Server-side only;
 * the browser's `required` / `minLength` attributes are a convenience, never the control.
 */
import { z } from "zod";

export const PASSWORD_MIN = 10; // ADR-042 §3 (hosted projects must set the same minimum)
export const PASSWORD_MAX = 72; // bcrypt input limit used by Supabase Auth

const email = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Enter a valid email address.");

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : null));

/** Roles an owner/admin may grant (mirrors app.create_invite; equal to INVITABLE_ROLES, asserted in the tests). */
export const GRANTABLE_ROLES = ["owner", "admin", "member", "viewer"] as const;

export const passwordSignInSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password.").max(PASSWORD_MAX),
  next: z.string().max(512).optional(),
});

export const codeRequestSchema = z.object({ email, next: z.string().max(512).optional() });

export const codeVerifySchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Enter the 6-digit code from the email."),
  next: z.string().max(512).optional(),
});

export const signUpSchema = z.object({
  email,
  password: z
    .string()
    .min(PASSWORD_MIN, `Use at least ${PASSWORD_MIN} characters.`)
    .max(PASSWORD_MAX, `Use at most ${PASSWORD_MAX} characters.`),
  fullName: optionalText(120),
  next: z.string().max(512).optional(),
});

export const createOrganizationSchema = z.object({
  orgType: z.enum(["buyer", "supplier"]),
  legalName: z.string().trim().min(1, "Enter the legal name.").max(200),
  displayName: z.string().trim().min(1, "Enter a display name.").max(120),
  displayNameZh: optionalText(120),
  country: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/, "Use a two-letter country code."),
});

export const inviteSchema = z.object({
  email,
  role: z.enum(GRANTABLE_ROLES),
});

export const membershipChangeSchema = z.object({
  membershipId: z.uuid(),
  role: z.enum(GRANTABLE_ROLES),
  status: z.enum(["active", "suspended"]),
});

export const projectSchema = z.object({
  name: z.string().trim().min(2, "Use at least 2 characters.").max(160),
  brief: z
    .string()
    .trim()
    .max(20_000)
    .transform((v) => (v.length ? v : null)),
});

export const briefSchema = z.object({
  projectId: z.uuid(),
  briefId: z.uuid().optional(),
  brief: z.string().trim().min(1, "Describe what you need.").max(20_000),
});

/** First message per field, for inline errors. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}

export function formObject(form: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of form.entries()) if (typeof v === "string") out[k] = v;
  return out;
}
