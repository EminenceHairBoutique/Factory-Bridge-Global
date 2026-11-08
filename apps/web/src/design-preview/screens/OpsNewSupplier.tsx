"use client";

/**
 * "New supplier" panel used by the supplier list (PRD US-O2; BACKLOG B-09). Creates a record at
 * `lead_identified` with claimed fields only; an optional first contact that needs a recorded
 * basis (WeChat always); origin from a research lead or direct contact. Local state only.
 */
import { useState } from "react";
import {
  CONTACT_BASIS_LABEL,
  type ContactBasis,
  type OpsSupplier,
} from "../demo-data/ops-suppliers";
import { RESEARCH_TODAY, TAXONOMIES, type ResearchLead } from "../demo-data/research-leads";
import {
  EMPTY_SUPPLIER_DRAFT,
  createSupplier,
  priceRangeText,
  sourceSystem,
  supplierDraftFromLead,
  validateSupplierDraft,
  type SupplierDraft,
} from "../ops-crm-demo";
import {
  Button,
  Checkbox,
  Field,
  Notice,
  Panel,
  Select,
  TextArea,
  TextInput,
} from "../ui/primitives";

export function NewSupplierPanel({
  lead,
  nextId,
  onCreate,
  onCancel,
}: {
  lead: ResearchLead | null;
  nextId: string;
  onCreate: (s: OpsSupplier) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<SupplierDraft>(
    lead ? supplierDraftFromLead(lead) : EMPTY_SUPPLIER_DRAFT,
  );
  const [touched, setTouched] = useState(false);
  const errors = validateSupplierDraft(draft);
  const set = (patch: Partial<SupplierDraft>) => setDraft((d) => ({ ...d, ...patch }));
  const toggleFamily = (f: string, on: boolean) =>
    set({ families: on ? [...draft.families, f] : draft.families.filter((x) => x !== f) });

  const submit = () => {
    setTouched(true);
    if (Object.keys(errors).length > 0) return;
    onCreate(createSupplier(draft, nextId, "Operator (demo)", RESEARCH_TODAY));
  };

  return (
    <Panel
      title="New supplier"
      description="Starts at Lead identified with claimed fields only. Every later stage is earned by a recorded check."
    >
      {lead ? (
        <Notice tone="neutral" icon="search" title={`From research lead ${lead.id}`}>
          {sourceSystem(lead.sourceSystem)?.provider ?? lead.sourceSystem} · {lead.taxonomy} ·{" "}
          {priceRangeText(lead)} observed {lead.observedAt}. The listing title is not a legal name;
          type the name from the licence or the seller's business page.
        </Notice>
      ) : null}
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Field
          label="Legal name (Chinese)"
          required
          htmlFor="ns-legal"
          error={touched ? errors.legalNameZh : undefined}
        >
          <TextInput
            id="ns-legal"
            lang="zh-CN"
            value={draft.legalNameZh}
            onChange={(e) => set({ legalNameZh: e.target.value })}
            placeholder="东莞市…有限公司"
          />
        </Field>
        <Field
          label="Working name (English)"
          htmlFor="ns-en"
          hint="Defaults to “Lead: <legal name>”."
        >
          <TextInput
            id="ns-en"
            value={draft.nameEn}
            onChange={(e) => set({ nameEn: e.target.value })}
          />
        </Field>
        <Field label="City" required htmlFor="ns-city" error={touched ? errors.city : undefined}>
          <TextInput
            id="ns-city"
            value={draft.city}
            onChange={(e) => set({ city: e.target.value })}
            placeholder="Dongguan"
          />
        </Field>
        <Field label="Province" htmlFor="ns-province">
          <TextInput
            id="ns-province"
            value={draft.province}
            onChange={(e) => set({ province: e.target.value })}
            placeholder="Guangdong"
          />
        </Field>
        <div className="md:col-span-2">
          <p className="text-xs font-semibold text-(--fbg-text-primary)">
            Product families <span className="text-(--fbg-status-danger)">*</span>
          </p>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {TAXONOMIES.map((f) => (
              <Checkbox
                key={f}
                id={`ns-fam-${f}`}
                label={f}
                checked={draft.families.includes(f)}
                onChange={(on) => toggleFamily(f, on)}
              />
            ))}
          </div>
          {touched && errors.families ? (
            <p className="mt-1 text-xs text-(--fbg-status-danger)">{errors.families}</p>
          ) : null}
        </div>
        <Field
          label="Origin"
          htmlFor="ns-origin"
          hint={lead ? "Fixed: created from the lead." : undefined}
        >
          <Select
            id="ns-origin"
            value={draft.origin}
            disabled={!!lead}
            onChange={(e) => set({ origin: e.target.value === "lead" ? "lead" : "direct" })}
          >
            <option value="direct">Direct contact, referral or trade show</option>
            <option value="lead">Research lead</option>
          </Select>
        </Field>
        <Field label="Notes" htmlFor="ns-notes">
          <TextArea
            id="ns-notes"
            rows={2}
            value={draft.notes}
            onChange={(e) => set({ notes: e.target.value })}
          />
        </Field>
      </div>

      <div className="mt-5 rounded-(--fbg-radius-control) border border-(--fbg-border-subtle) p-4">
        <p className="text-sm font-semibold text-(--fbg-text-primary)">
          First contact (optional, restricted)
        </p>
        <p className="mt-0.5 text-xs text-(--fbg-text-secondary)">
          Stored in the restricted contacts panel; visible only to assigned operators. A WeChat
          handle cannot be saved without a recorded contact basis.
        </p>
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          <Field label="Name" htmlFor="ns-cname">
            <TextInput
              id="ns-cname"
              value={draft.contactName}
              onChange={(e) => set({ contactName: e.target.value })}
            />
          </Field>
          <Field label="Role" htmlFor="ns-crole">
            <TextInput
              id="ns-crole"
              value={draft.contactRole}
              onChange={(e) => set({ contactRole: e.target.value })}
              placeholder="Export manager"
            />
          </Field>
          <Field label="Channel" htmlFor="ns-cchan">
            <Select
              id="ns-cchan"
              value={draft.contactChannel}
              onChange={(e) =>
                set({ contactChannel: e.target.value as SupplierDraft["contactChannel"] })
              }
            >
              <option value="wechat">WeChat</option>
              <option value="email">Email</option>
              <option value="phone">Phone</option>
            </Select>
          </Field>
          <Field label="Handle, email or number" htmlFor="ns-chandle">
            <TextInput
              id="ns-chandle"
              value={draft.contactHandle}
              onChange={(e) => set({ contactHandle: e.target.value })}
            />
          </Field>
          <Field
            label="Contact basis"
            htmlFor="ns-cbasis"
            hint="How this contact was obtained; written to the audit trail."
            className="md:col-span-2"
          >
            <Select
              id="ns-cbasis"
              value={draft.contactBasis}
              onChange={(e) => set({ contactBasis: e.target.value as ContactBasis | "" })}
            >
              <option value="">Not recorded</option>
              {(Object.keys(CONTACT_BASIS_LABEL) as ContactBasis[]).map((b) => (
                <option key={b} value={b}>
                  {CONTACT_BASIS_LABEL[b]}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        {touched && errors.contact ? (
          <p className="mt-2 text-xs text-(--fbg-status-danger)">{errors.contact}</p>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button variant="primary" icon="check" onClick={submit}>
          Create supplier
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        {touched && Object.keys(errors).length > 0 ? (
          <span className="text-xs text-(--fbg-status-danger)">Fix the fields marked above.</span>
        ) : null}
      </div>
    </Panel>
  );
}
