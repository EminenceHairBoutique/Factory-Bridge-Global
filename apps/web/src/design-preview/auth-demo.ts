/**
 * Display-only validation for the sign-in, invitation and organization-setup prototypes. No credential is ever
 * submitted; the real flows arrive with BACKLOG B-05 (Supabase Auth, email OTP + password, invites, org switcher).
 */

export const ROLE_EXPLANATION: Record<
  "owner" | "admin" | "member" | "viewer",
  { label: string; summary: string; can: string[]; cannot: string[] }
> = {
  owner: {
    label: "Owner",
    summary: "Runs the organization and is accountable for approvals.",
    can: [
      "Everything an admin can",
      "Transfer ownership",
      "Manage billing and pilot terms",
      "Approve supplier selection and order handoff",
    ],
    cannot: ["Be removed while sole owner"],
  },
  admin: {
    label: "Admin",
    summary: "Manages people and settings; approves outbound messages.",
    can: [
      "Invite and remove members",
      "Change roles below owner",
      "Approve clarifications and RFQs",
      "Create and edit projects",
      "Export reports",
    ],
    cannot: ["Transfer ownership", "Change billing"],
  },
  member: {
    label: "Member",
    summary: "Does the sourcing work.",
    can: [
      "Create and edit projects and briefs",
      "Upload quotes and documents",
      "Review extractions",
      "Approve clarifications",
    ],
    cannot: ["Invite people", "Approve supplier selection or handoff", "Change settings"],
  },
  viewer: {
    label: "Viewer",
    summary: "Reads everything in the organization; changes nothing.",
    can: ["Open projects, comparisons and reports", "Download exports"],
    cannot: ["Create or edit", "Approve anything", "See audit trails"],
  },
};

export type Role = keyof typeof ROLE_EXPLANATION;

export function validateEmailAddress(value: string): string | null {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
    ? null
    : "Enter a valid work email address.";
}

/** Six digits; whitespace tolerated. */
export function validateOtp(value: string): string | null {
  const v = value.replace(/\s/g, "");
  if (!/^\d{6}$/.test(v)) return "Enter the 6-digit code from the email.";
  return null;
}

/** Length-first policy; no composition rules. Matches NIST-style guidance the real flow should adopt. */
export function validatePassword(value: string): string | null {
  if (value.length < 12) return "Use at least 12 characters. A sentence works well.";
  if (/^(.)\1+$/.test(value)) return "Choose something less repetitive.";
  return null;
}

export interface InviteRow {
  id: number;
  email: string;
  role: Role;
}

/** Duplicate and invalid addresses block sending; empty rows are ignored. */
export function validateInvites(
  rows: readonly InviteRow[],
  ownerEmail: string,
): Record<number, string> {
  const errors: Record<number, string> = {};
  const seen = new Set<string>([ownerEmail.trim().toLowerCase()]);
  for (const r of rows) {
    const e = r.email.trim().toLowerCase();
    if (!e) continue;
    const invalid = validateEmailAddress(e);
    if (invalid) errors[r.id] = invalid;
    else if (seen.has(e))
      errors[r.id] =
        e === ownerEmail.trim().toLowerCase()
          ? "That is your own address."
          : "Already in the list.";
    seen.add(e);
  }
  return errors;
}

export function validateZip(value: string): string | null {
  return /^\d{5}(-\d{4})?$/.test(value.trim()) ? null : "Enter a 5-digit U.S. ZIP code.";
}
