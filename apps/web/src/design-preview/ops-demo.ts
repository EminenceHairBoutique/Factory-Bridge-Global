/**
 * Display-only rules for the operations supplier CRM prototypes.
 *
 * Badge text is GENERATED from completed check rows (PRD US-O4, AC-O4.1): no record, no badge. Stage advancement
 * is gated on records, mirroring "contacted ≠ factory-verified ≠ product-tested ≠ batch-inspected" (master spec §7).
 * The authoritative rules belong to the database and `packages/domain`; this mirror only explains the UI.
 */
import type { SupplierStage } from "@fbg/domain";
import {
  STAGE_ORDER,
  type ContactBasis,
  type SupplierContact,
  type VerificationCheck,
} from "./demo-data/ops-suppliers";

export interface GeneratedBadge {
  label: string;
  fromCheckId: string;
  until: string | null;
}

function isCurrent(c: VerificationCheck, today: string): boolean {
  return c.status === "passed" && (c.expiresAt === null || c.expiresAt >= today);
}

/** Buyer-facing badges derived only from passed, unexpired checks. Terminology from IA §4. */
export function badgesFromChecks(
  checks: readonly VerificationCheck[],
  today: string,
): GeneratedBadge[] {
  const out: GeneratedBadge[] = [];
  const identity = checks.find(
    (c) => c.type === "identity_document_reviewed" && isCurrent(c, today),
  );
  if (identity)
    out.push({
      label: `Identity reviewed (${identity.date})`,
      fromCheckId: identity.id,
      until: identity.expiresAt,
    });
  const address = checks.find((c) => c.type === "address_corroborated" && isCurrent(c, today));
  if (address)
    out.push({
      label: `Address corroborated (${address.date})`,
      fromCheckId: address.id,
      until: address.expiresAt,
    });
  const visit = checks.find((c) => c.type === "factory_visit" && isCurrent(c, today));
  if (visit)
    out.push({
      label: `Factory visited (${visit.date})`,
      fromCheckId: visit.id,
      until: visit.expiresAt,
    });
  // "Sample approved for variant" and "Passed inspection per checklist" come from buyer approval and inspection
  // records, not from supplier checks, so they are never generated here.
  return out;
}

export interface CheckDue {
  check: VerificationCheck;
  daysLeft: number;
  state: "overdue" | "due_soon";
}

/** Passed checks expiring within `withinDays` (or already expired), plus pending checks whose date has passed. */
export function checksDue(
  checks: readonly VerificationCheck[],
  today: string,
  withinDays = 30,
): CheckDue[] {
  const t = new Date(`${today}T00:00:00Z`).getTime();
  const out: CheckDue[] = [];
  for (const c of checks) {
    if (c.status === "passed" && c.expiresAt) {
      const d = Math.round((new Date(`${c.expiresAt}T00:00:00Z`).getTime() - t) / 86_400_000);
      if (d < 0) out.push({ check: c, daysLeft: d, state: "overdue" });
      else if (d <= withinDays) out.push({ check: c, daysLeft: d, state: "due_soon" });
    }
    if (c.status === "pending") {
      const d = Math.round((new Date(`${c.date}T00:00:00Z`).getTime() - t) / 86_400_000);
      if (d < 0) out.push({ check: c, daysLeft: d, state: "overdue" });
    }
  }
  return out.sort((a, b) => a.daysLeft - b.daysLeft);
}

export interface StageGate {
  next: SupplierStage | null;
  allowed: boolean;
  requirements: Array<{ label: string; met: boolean }>;
}

/** What the next stage requires. Advancing never happens automatically; the operator records it. */
export function stageGate(
  stage: SupplierStage,
  input: {
    contacts: readonly SupplierContact[];
    checks: readonly VerificationCheck[];
    facilities: number;
    capacityDoc: boolean;
  },
  today: string,
): StageGate {
  const idx = STAGE_ORDER.indexOf(stage);
  const next = STAGE_ORDER[idx + 1] ?? null;
  if (!next) return { next: null, allowed: false, requirements: [] };
  const hasContactWithBasis = input.contacts.some((c) => Boolean(c.basis));
  const identity = input.checks.some(
    (c) => c.type === "identity_document_reviewed" && isCurrent(c, today),
  );
  const address = input.checks.some(
    (c) => c.type === "address_corroborated" && isCurrent(c, today),
  );
  const requirements: Array<{ label: string; met: boolean }> =
    next === "contact_confirmed"
      ? [
          {
            label: "At least one contact with a recorded contact basis and a reply",
            met: hasContactWithBasis && input.contacts.some((c) => c.lastResponse !== null),
          },
        ]
      : next === "legal_identity_reviewed"
        ? [
            { label: "Identity document reviewed (passed, unexpired)", met: identity },
            { label: "Address corroborated (passed, unexpired)", met: address },
          ]
        : [
            { label: "At least one facility corroborated by a check", met: input.facilities > 0 },
            { label: "Capacity or capability document on file", met: input.capacityDoc },
            {
              label: "Video call or factory visit recorded",
              met: input.checks.some(
                (c) =>
                  (c.type === "video_call_held" || c.type === "factory_visit") &&
                  isCurrent(c, today),
              ),
            },
          ];
  return { next, allowed: requirements.every((r) => r.met), requirements };
}

/** A WeChat handle without a recorded basis cannot be stored (PRD AC-O2.1). */
export function contactCanBeSaved(
  channel: SupplierContact["channel"],
  handle: string,
  basis: ContactBasis | "",
): string | null {
  if (!handle.trim()) return "Enter the handle, email or number.";
  if (channel === "wechat" && !basis)
    return "A WeChat handle needs a recorded contact basis before it can be stored.";
  if (!basis) return "Record how this contact was obtained.";
  return null;
}
