/**
 * Display-only rules for the research inbox and supplier creation (BACKLOG B-09; PRD US-O1 and
 * US-O2). They mirror migration 0005: a lead needs a source system that is not blocked, a
 * reference, a Chinese search term and an observed date; its rights class is fixed; prices are
 * indicative observations that go stale after 30 days. A supplier created from a lead starts at
 * `lead_identified` with claimed fields only; a WeChat contact needs a recorded basis
 * (`contactCanBeSaved`). Nothing here writes anywhere; the real inserts are server-side.
 */
import type { SupplierStage } from "@fbg/domain";
import type { ContactBasis, OpsSupplier, SupplierContact } from "./demo-data/ops-suppliers";
import {
  LEAD_STALE_DAYS,
  SOURCE_SYSTEMS,
  type ResearchLead,
  type SourceSystem,
} from "./demo-data/research-leads";
import { contactCanBeSaved } from "./ops-demo";

export const INTERNAL_ONLY_TEXT = "Internal only — not buyer-visible";

export function sourceSystem(code: string): SourceSystem | undefined {
  return SOURCE_SYSTEMS.find((s) => s.code === code);
}

export interface LeadFreshness {
  state: "fresh" | "stale";
  daysOld: number;
  label: string;
}

/** Observed prices are indicative and stale after LEAD_STALE_DAYS. */
export function leadFreshness(observedAt: string, today: string): LeadFreshness {
  const days = Math.floor((Date.parse(today) - Date.parse(observedAt)) / 86_400_000);
  if (days > LEAD_STALE_DAYS)
    return { state: "stale", daysOld: days, label: `Stale (${days} days old)` };
  return {
    state: "fresh",
    daysOld: days,
    label: `Observed ${days === 0 ? "today" : `${days} day${days === 1 ? "" : "s"} ago`}`,
  };
}

export function priceRangeText(
  lead: Pick<ResearchLead, "observedMinPrice" | "observedMaxPrice" | "currency" | "observedUnit">,
): string {
  const { observedMinPrice: min, observedMaxPrice: max, currency, observedUnit } = lead;
  const fmt = (n: number) =>
    n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const unit = observedUnit ? ` / ${observedUnit}` : "";
  if (min === null && max === null) return "No price observed";
  if (min !== null && max !== null)
    return min === max
      ? `${currency} ${fmt(min)}${unit}`
      : `${currency} ${fmt(min)}–${fmt(max)}${unit}`;
  return `${currency} ${fmt((min ?? max) as number)}${unit}`;
}

export interface LeadInput {
  taxonomy: string;
  sourceSystem: string;
  referenceUrl: string;
  searchTermZh: string;
  titleZh: string;
  observedMinPrice: string;
  observedMaxPrice: string;
  observedMoq: string;
  observedUnit: string;
  observedAt: string;
  notes: string;
}

export const EMPTY_LEAD_INPUT: LeadInput = {
  taxonomy: "",
  sourceSystem: "",
  referenceUrl: "",
  searchTermZh: "",
  titleZh: "",
  observedMinPrice: "",
  observedMaxPrice: "",
  observedMoq: "",
  observedUnit: "pc",
  observedAt: "",
  notes: "",
};

export type LeadErrors = Partial<Record<keyof LeadInput, string>>;

/** PRD AC-O1.1: platform, reference, ZH search term and observed date are required; the register and the numeric checks follow 0005. */
export function validateLead(input: LeadInput, today: string): LeadErrors {
  const e: LeadErrors = {};
  if (!input.taxonomy) e.taxonomy = "Choose the product family.";
  const sys = sourceSystem(input.sourceSystem);
  if (!sys) e.sourceSystem = "Choose where the listing was read.";
  else if (sys.status === "blocked")
    e.sourceSystem = `${sys.provider} is blocked in the integrations register; no leads can be recorded from it.`;
  if (!input.referenceUrl.trim()) e.referenceUrl = "Enter the listing URL or reference.";
  if (!input.searchTermZh.trim()) e.searchTermZh = "Enter the Chinese search term you used.";
  if (!input.observedAt) e.observedAt = "Enter the date you read the listing.";
  else if (input.observedAt > today) e.observedAt = "The observed date cannot be in the future.";
  const min = parseMoney(input.observedMinPrice);
  const max = parseMoney(input.observedMaxPrice);
  if (min === "invalid") e.observedMinPrice = "Enter a price of zero or more.";
  if (max === "invalid") e.observedMaxPrice = "Enter a price of zero or more.";
  if (typeof min === "number" && typeof max === "number" && min > max)
    e.observedMaxPrice = "The maximum must be at least the minimum.";
  if (input.observedMoq.trim()) {
    const moq = Number(input.observedMoq);
    if (!Number.isInteger(moq) || moq <= 0)
      e.observedMoq = "MOQ must be a whole number above zero.";
  }
  return e;
}

function parseMoney(raw: string): number | null | "invalid" {
  if (!raw.trim()) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : "invalid";
}

export function leadFromInput(input: LeadInput, id: string, recordedBy: string): ResearchLead {
  const min = parseMoney(input.observedMinPrice);
  const max = parseMoney(input.observedMaxPrice);
  return {
    id,
    taxonomy: input.taxonomy,
    sourceSystem: input.sourceSystem,
    referenceUrl: input.referenceUrl.trim(),
    searchTermZh: input.searchTermZh.trim(),
    titleZh: input.titleZh.trim(),
    observedMinPrice: typeof min === "number" ? min : null,
    observedMaxPrice: typeof max === "number" ? max : null,
    currency: "CNY",
    observedMoq: input.observedMoq.trim() ? Number(input.observedMoq) : null,
    observedUnit: input.observedUnit.trim(),
    observedAt: input.observedAt,
    notes: input.notes.trim(),
    recordedBy,
    rightsClass: "internal_market_observation",
    status: "new",
    linkedSupplierId: null,
    dismissedReason: null,
  };
}

/** New and fresh first (newest observed), then new and stale, then linked, then dismissed. */
export function sortLeads(leads: readonly ResearchLead[], today: string): ResearchLead[] {
  const rank = (l: ResearchLead) => {
    if (l.status === "new") return leadFreshness(l.observedAt, today).state === "fresh" ? 0 : 1;
    return l.status === "linked" ? 2 : 3;
  };
  return [...leads].sort((a, b) => rank(a) - rank(b) || b.observedAt.localeCompare(a.observedAt));
}

export interface LeadSummary {
  open: number;
  stale: number;
  linked: number;
  dismissed: number;
}

export function leadSummary(leads: readonly ResearchLead[], today: string): LeadSummary {
  const s: LeadSummary = { open: 0, stale: 0, linked: 0, dismissed: 0 };
  for (const l of leads) {
    if (l.status === "new") {
      s.open += 1;
      if (leadFreshness(l.observedAt, today).state === "stale") s.stale += 1;
    } else if (l.status === "linked") s.linked += 1;
    else s.dismissed += 1;
  }
  return s;
}

/* ---------- Supplier creation (US-O2) ---------- */

export interface SupplierDraft {
  legalNameZh: string;
  nameEn: string;
  city: string;
  province: string;
  families: string[];
  origin: "lead" | "direct";
  leadId: string | null;
  contactName: string;
  contactRole: string;
  contactChannel: SupplierContact["channel"];
  contactHandle: string;
  contactBasis: ContactBasis | "";
  notes: string;
}

export const EMPTY_SUPPLIER_DRAFT: SupplierDraft = {
  legalNameZh: "",
  nameEn: "",
  city: "",
  province: "",
  families: [],
  origin: "direct",
  leadId: null,
  contactName: "",
  contactRole: "",
  contactChannel: "wechat",
  contactHandle: "",
  contactBasis: "",
  notes: "",
};

/** Prefill from a lead: family and origin only. A listing title is not a legal name, so the name stays empty. */
export function supplierDraftFromLead(lead: ResearchLead): SupplierDraft {
  return {
    ...EMPTY_SUPPLIER_DRAFT,
    families: [lead.taxonomy],
    origin: "lead",
    leadId: lead.id,
    notes: `From research lead ${lead.id} (${sourceSystem(lead.sourceSystem)?.provider ?? lead.sourceSystem}, observed ${lead.observedAt}).`,
  };
}

export type SupplierDraftErrors = Partial<
  Record<"legalNameZh" | "city" | "families" | "contact", string>
>;

export function validateSupplierDraft(draft: SupplierDraft): SupplierDraftErrors {
  const e: SupplierDraftErrors = {};
  if (!draft.legalNameZh.trim())
    e.legalNameZh = "Enter the legal name as written on the licence (Chinese).";
  if (!draft.city.trim()) e.city = "Enter the city.";
  if (draft.families.length === 0) e.families = "Choose at least one product family.";
  const anyContact = draft.contactName.trim() || draft.contactHandle.trim() || draft.contactBasis;
  if (anyContact) {
    const c = contactCanBeSaved(draft.contactChannel, draft.contactHandle, draft.contactBasis);
    if (c) e.contact = c;
    else if (!draft.contactName.trim()) e.contact = "Enter the contact's name.";
  }
  return e;
}

/** A created supplier starts at lead_identified with claimed fields only and an audit line naming its origin. */
export function createSupplier(
  draft: SupplierDraft,
  id: string,
  actor: string,
  today: string,
): OpsSupplier {
  const stage: SupplierStage = "lead_identified";
  const legal = draft.legalNameZh.trim();
  const contacts: SupplierContact[] =
    draft.contactHandle.trim() && draft.contactBasis
      ? [
          {
            id: `${id}_c1`,
            name: draft.contactName.trim(),
            role: draft.contactRole.trim() || "Unknown",
            channel: draft.contactChannel,
            handle: draft.contactHandle.trim(),
            basis: draft.contactBasis,
            basisRecordedAt: today,
            lastResponse: null,
          },
        ]
      : [];
  return {
    id,
    legalNameZh: legal,
    nameEn: draft.nameEn.trim() || `Lead: ${legal}`,
    city: draft.city.trim(),
    province: draft.province.trim(),
    stage,
    families: [...draft.families],
    claimed: {
      legal_name: legal,
      registered_address: "—",
      company_type: "Unknown",
      founded_year: "—",
      monthly_capacity: "—",
    },
    verified: {
      legal_name: null,
      registered_address: null,
      company_type: null,
      founded_year: null,
      monthly_capacity: null,
    },
    facilities: [],
    contacts,
    checks: [],
    documents:
      draft.origin === "lead" && draft.leadId
        ? [
            {
              id: `${id}_doc1`,
              name: `research-lead-${draft.leadId}.md`,
              sourceType: "manual_research",
              rightsClass: "internal_market_observation",
              permissionRef: null,
              importedAt: today,
              importedBy: actor,
              visibility: "internal_only",
            },
          ]
        : [],
    permissions: [],
    disclosureGrants: [],
    assignedProjects: [],
    lastActivity: today,
    audit: [
      {
        at: `${today} —`,
        actor,
        actingAs: "operator",
        action:
          draft.origin === "lead"
            ? `Created supplier from research lead ${draft.leadId} (internal only)`
            : "Created supplier from direct contact",
      },
      ...(contacts.length > 0
        ? [
            {
              at: `${today} —`,
              actor,
              actingAs: "operator",
              action: `Recorded contact with basis "${draft.contactBasis}"`,
            },
          ]
        : []),
    ],
  };
}
