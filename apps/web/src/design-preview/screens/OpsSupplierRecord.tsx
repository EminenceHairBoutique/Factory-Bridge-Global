"use client";

/**
 * Operations: supplier record (IA §2.4 `/ops/suppliers/[id]`; SCREEN_INVENTORY §5.2; BACKLOG B-09).
 * Tabs Profile · Facilities · Contacts (restricted) · Checks · Documents · Permissions. Badge preview is generated
 * from passed checks; stage advances only when the gate's records exist; contacts show only when assigned.
 * Local state only; synthetic data.
 */
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import type { RightsClass, SourceType } from "@fbg/domain";
import {
  CHECK_LABEL,
  CONTACT_BASIS_LABEL,
  OPS_SUPPLIERS,
  OPS_TODAY,
  PROFILE_FIELDS,
  PROFILE_FIELD_LABEL,
  STAGE_LABEL,
  type CheckType,
  type ContactBasis,
  type DisclosureGrant,
  type OpsSupplier,
  type SourcePermission,
  type SupplierContact,
  type SupplierDocument,
  type VerificationCheck,
} from "../demo-data/ops-suppliers";
import { badgesFromChecks, checksDue, contactCanBeSaved, stageGate } from "../ops-demo";
import { AppShell } from "../ui/AppShell";
import { Icon } from "../ui/icons";
import {
  Badge,
  Button,
  Checkbox,
  EvidenceBadge,
  Field,
  Notice,
  PageHeader,
  Panel,
  SegmentedControl,
  Select,
  Tabs,
  TextInput,
  buttonClasses,
  cx,
  type Tone,
} from "../ui/primitives";

type Tab = "profile" | "facilities" | "contacts" | "checks" | "documents" | "permissions";

const STAGE_TONE: Record<string, Tone> = {
  lead_identified: "neutral",
  contact_confirmed: "ink",
  legal_identity_reviewed: "teal",
  capabilities_documented: "ok",
};

const RIGHTS_LABEL: Record<RightsClass, string> = {
  internal_market_observation: "Internal market observation",
  catalog_public_with_permission: "Catalog, public with permission",
  customer_private_quote: "Customer private quote",
  buyer_uploaded_private: "Buyer uploaded, private",
  supplier_submitted_private: "Supplier submitted, private",
};

const SOURCE_TYPES: SourceType[] = [
  "manual_research",
  "operator_import",
  "buyer_upload",
  "supplier_portal",
  "supplier_csv_feed",
  "inbound_email",
];
const RIGHTS_CLASSES: RightsClass[] = [
  "internal_market_observation",
  "catalog_public_with_permission",
  "customer_private_quote",
  "buyer_uploaded_private",
  "supplier_submitted_private",
];

export function OpsSupplierRecord() {
  return (
    <Suspense fallback={null}>
      <OpsSupplierRecordInner />
    </Suspense>
  );
}

function OpsSupplierRecordInner() {
  const params = useSearchParams();
  const id = params?.get("id") ?? "sup_a";
  const base = OPS_SUPPLIERS.find((s) => s.id === id) ?? OPS_SUPPLIERS[0];
  const [supplier, setSupplier] = useState<OpsSupplier | undefined>(base);
  const [tab, setTab] = useState<Tab>("profile");
  const [viewAs, setViewAs] = useState<"assigned" | "unassigned">("assigned");

  // Reset local state when the id changes (prototype only).
  const [lastId, setLastId] = useState(id);
  if (lastId !== id) {
    setLastId(id);
    setSupplier(base);
    setTab("profile");
  }

  const badges = useMemo(
    () => (supplier ? badgesFromChecks(supplier.checks, OPS_TODAY) : []),
    [supplier],
  );
  const due = useMemo(() => (supplier ? checksDue(supplier.checks, OPS_TODAY) : []), [supplier]);
  const gate = useMemo(
    () =>
      supplier
        ? stageGate(
            supplier.stage,
            {
              contacts: supplier.contacts,
              checks: supplier.checks,
              facilities: supplier.facilities.filter((f) => f.corroboratedBy).length,
              capacityDoc: supplier.documents.some((d) => d.sourceType !== "manual_research"),
            },
            OPS_TODAY,
          )
        : null,
    [supplier],
  );

  if (!supplier) return null;
  const assigned = viewAs === "assigned" && supplier.assignedProjects.length > 0;
  const patch = (p: Partial<OpsSupplier>) => setSupplier((s) => (s ? { ...s, ...p } : s));
  const audit = (action: string) =>
    patch({
      audit: [
        { at: `${OPS_TODAY} 10:00`, actor: "Operator (demo)", actingAs: "operator", action },
        ...supplier.audit,
      ],
    });

  const rightRail = (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-xs text-(--fbg-text-secondary)">Evidence drawer</p>
        <h2 className="text-[15px] font-semibold text-(--fbg-text-primary)">Access and audit</h2>
      </div>
      <div>
        <p className="text-xs font-medium text-(--fbg-text-primary)">Your assignment</p>
        {supplier.assignedProjects.length === 0 ? (
          <p className="mt-1 text-sm text-(--fbg-text-secondary)">
            No project links you to this supplier. Contacts are hidden by policy.
          </p>
        ) : (
          <ul className="mt-1 flex flex-col gap-1 text-sm">
            {supplier.assignedProjects.map((p) => (
              <li key={p.id} className="text-(--fbg-text-primary)">
                {p.name} <span className="text-(--fbg-text-secondary)">· {p.buyerOrg}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div>
        <p className="text-xs font-medium text-(--fbg-text-primary)">Audit trail</p>
        <ol className="mt-1 flex flex-col gap-2 text-sm">
          {supplier.audit.slice(0, 6).map((a, i) => (
            <li key={i} className="min-w-0">
              <p className="text-(--fbg-text-primary)">{a.action}</p>
              <p className="fbg-num text-xs text-(--fbg-text-secondary)">
                {a.at} · {a.actor} · {a.actingAs}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );

  return (
    <AppShell workspace="ops" title="Supplier" rightRail={rightRail}>
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link
            href="/design-preview/ops/suppliers"
            className="inline-flex items-center gap-1 text-sm text-(--fbg-text-secondary) hover:text-(--fbg-text-primary)"
          >
            <Icon name="chevron-left" size={16} /> Suppliers
          </Link>
          <div className="flex items-center gap-2 text-xs text-(--fbg-text-secondary)">
            View as
            <SegmentedControl
              label="View as"
              size="sm"
              value={viewAs}
              onChange={setViewAs}
              options={[
                { value: "assigned", label: "Assigned operator" },
                { value: "unassigned", label: "Unassigned operator" },
              ]}
            />
          </div>
        </div>

        <PageHeader
          title={
            <span>
              {supplier.nameEn}
              <span
                className="fbg-zh block text-lg font-normal text-(--fbg-text-secondary)"
                lang="zh-CN"
              >
                {supplier.legalNameZh}
              </span>
            </span>
          }
          lead={`${supplier.city}, ${supplier.province} · ${supplier.families.join(", ")}`}
          meta={
            <>
              <Badge tone={STAGE_TONE[supplier.stage] ?? "neutral"}>
                {STAGE_LABEL[supplier.stage]}
              </Badge>
              {due.length > 0 ? (
                <Badge
                  tone={due.some((d) => d.state === "overdue") ? "danger" : "warn"}
                  icon="clock"
                  className="fbg-num"
                >
                  {due.length} check{due.length === 1 ? "" : "s"} due or overdue
                </Badge>
              ) : null}
            </>
          }
        />

        {/* Badge preview + stage gate */}
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel
            title="What buyers see"
            description="Badge text is generated from passed, unexpired checks. No record, no badge."
            raised
          >
            {badges.length === 0 ? (
              <p className="text-sm text-(--fbg-text-secondary)">
                No verification badge yet. Buyers see the stage and claimed values marked as
                supplier-provided.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {badges.map((b) => {
                  const check = supplier.checks.find((c) => c.id === b.fromCheckId);
                  return (
                    <EvidenceBadge
                      key={b.fromCheckId}
                      label={b.label}
                      evidence={{
                        what: check ? CHECK_LABEL[check.type] : b.label,
                        who: check?.reviewer ?? "—",
                        when: check?.date ?? "—",
                        until: b.until ?? undefined,
                        scope: "Identity and address only. Not a product test or batch inspection.",
                      }}
                    />
                  );
                })}
              </div>
            )}
            <p className="mt-3 text-xs text-(--fbg-text-secondary)">
              "Sample approved for variant" and "Passed inspection per checklist" come from buyer
              approvals and inspection records, never from this panel.
            </p>
          </Panel>
          <Panel
            title={gate?.next ? `Advance to: ${STAGE_LABEL[gate.next]}` : "Highest stage reached"}
            description="Stages are earned by records; advancing is recorded in the audit trail."
          >
            {gate?.next ? (
              <>
                <ul className="flex flex-col gap-1.5 text-sm">
                  {gate.requirements.map((r) => (
                    <li key={r.label} className="flex items-start gap-2">
                      <Icon
                        name={r.met ? "check" : "x"}
                        size={14}
                        className={cx(
                          "mt-0.5 shrink-0",
                          r.met ? "text-(--fbg-status-success)" : "text-(--fbg-status-danger)",
                        )}
                      />
                      <span
                        className={
                          r.met ? "text-(--fbg-text-primary)" : "text-(--fbg-text-secondary)"
                        }
                      >
                        {r.label}
                      </span>
                    </li>
                  ))}
                </ul>
                <Button
                  className="mt-3"
                  variant="primary"
                  icon="check"
                  disabled={!gate.allowed}
                  title={!gate.allowed ? "Record the missing items first" : undefined}
                  onClick={() => {
                    if (!gate.next) return;
                    patch({ stage: gate.next });
                    audit(`Advanced stage to ${STAGE_LABEL[gate.next]}`);
                  }}
                >
                  Record stage: {STAGE_LABEL[gate.next]}
                </Button>
              </>
            ) : (
              <p className="text-sm text-(--fbg-text-secondary)">
                All four stages recorded. Keep checks current; expired checks remove badges
                automatically.
              </p>
            )}
          </Panel>
        </div>

        <Tabs
          label="Supplier sections"
          value={tab}
          onChange={setTab}
          tabs={[
            { value: "profile", label: "Profile" },
            { value: "facilities", label: "Facilities", count: supplier.facilities.length },
            {
              value: "contacts",
              label: "Contacts",
              count: assigned ? supplier.contacts.length : undefined,
            },
            { value: "checks", label: "Checks", count: supplier.checks.length },
            { value: "documents", label: "Documents", count: supplier.documents.length },
            { value: "permissions", label: "Permissions", count: supplier.permissions.length },
          ]}
        />

        {tab === "profile" ? <ProfileTab supplier={supplier} /> : null}
        {tab === "facilities" ? <FacilitiesTab supplier={supplier} /> : null}
        {tab === "contacts" ? (
          <ContactsTab supplier={supplier} assigned={assigned} onPatch={patch} onAudit={audit} />
        ) : null}
        {tab === "checks" ? (
          <ChecksTab supplier={supplier} onPatch={patch} onAudit={audit} />
        ) : null}
        {tab === "documents" ? (
          <DocumentsTab supplier={supplier} onPatch={patch} onAudit={audit} />
        ) : null}
        {tab === "permissions" ? (
          <PermissionsTab supplier={supplier} onPatch={patch} onAudit={audit} />
        ) : null}
      </div>
    </AppShell>
  );
}

/* ---- Profile ----------------------------------------------------------------------------------- */

function ProfileTab({ supplier }: { supplier: OpsSupplier }) {
  return (
    <Panel
      title="Claimed vs verified"
      description="Buyers read from the public profile view: verified values and stage; claimed values are shown as supplier-provided."
      padded={false}
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[40rem] text-sm">
          <thead className="bg-(--fbg-bg-canvas) text-xs text-(--fbg-text-secondary)">
            <tr className="[&>th]:px-5 [&>th]:py-2 [&>th]:text-left [&>th]:font-medium">
              <th scope="col">Field</th>
              <th scope="col">Claimed (supplier-provided)</th>
              <th scope="col">Verified</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-(--fbg-border-subtle)">
            {PROFILE_FIELDS.map((f) => {
              const v = supplier.verified[f] ?? null;
              const check = v ? supplier.checks.find((c) => c.id === v.checkId) : undefined;
              return (
                <tr key={f} className="[&>td]:px-5 [&>td]:py-2.5 [&>td]:align-top">
                  <td className="text-(--fbg-text-secondary)">{PROFILE_FIELD_LABEL[f]}</td>
                  <td className="fbg-zh text-(--fbg-text-primary)">{supplier.claimed[f] ?? "—"}</td>
                  <td className="fbg-zh text-(--fbg-text-primary)">
                    {v ? (
                      <>
                        {v.value}
                        <span className="fbg-num block text-xs text-(--fbg-text-secondary)">
                          via {check ? CHECK_LABEL[check.type] : v.checkId} · {check?.date}
                        </span>
                      </>
                    ) : (
                      <span className="text-(--fbg-text-secondary)">—</span>
                    )}
                  </td>
                  <td>
                    {v ? (
                      <Badge tone="ok" icon="shield" className="fbg-num">
                        Verified {check?.date}
                      </Badge>
                    ) : (
                      <Badge tone="neutral" icon="info">
                        Claimed only
                      </Badge>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

/* ---- Facilities -------------------------------------------------------------------------------- */

function FacilitiesTab({ supplier }: { supplier: OpsSupplier }) {
  return (
    <Panel
      title="Facilities"
      description="A facility counts toward stage only when a check corroborates it."
      padded={false}
      actions={
        <Button size="sm" icon="plus" title="Arrives with B-09">
          Add facility
        </Button>
      }
    >
      {supplier.facilities.length === 0 ? (
        <p className="px-5 py-6 text-sm text-(--fbg-text-secondary)">No facilities recorded.</p>
      ) : (
        <ul className="divide-y divide-(--fbg-border-subtle)">
          {supplier.facilities.map((f) => {
            const check = f.corroboratedBy
              ? supplier.checks.find((c) => c.id === f.corroboratedBy)
              : undefined;
            return (
              <li
                key={f.id}
                className="flex flex-col gap-1 px-5 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-(--fbg-text-primary)">
                    {f.kind[0]?.toUpperCase() + f.kind.slice(1)}{" "}
                    <span className="fbg-zh font-normal text-(--fbg-text-secondary)">
                      · {f.address}
                    </span>
                  </p>
                  {f.note ? <p className="text-xs text-(--fbg-text-secondary)">{f.note}</p> : null}
                </div>
                {check ? (
                  <Badge tone="ok" icon="shield" className="fbg-num">
                    Corroborated · {CHECK_LABEL[check.type]} {check.date}
                  </Badge>
                ) : (
                  <Badge tone="neutral" icon="info">
                    Claimed; not corroborated
                  </Badge>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

/* ---- Contacts (restricted) --------------------------------------------------------------------- */

function ContactsTab({
  supplier,
  assigned,
  onPatch,
  onAudit,
}: {
  supplier: OpsSupplier;
  assigned: boolean;
  onPatch: (p: Partial<OpsSupplier>) => void;
  onAudit: (a: string) => void;
}) {
  const [form, setForm] = useState<{
    name: string;
    role: string;
    channel: SupplierContact["channel"];
    handle: string;
    basis: ContactBasis | "";
  }>({ name: "", role: "", channel: "wechat", handle: "", basis: "" });
  const [grant, setGrant] = useState<{
    contactId: string;
    granteeOrg: string;
    reason: string;
    until: string;
  }>({
    contactId: supplier.contacts[0]?.id ?? "",
    granteeOrg: "Demo Buyer Co.",
    reason: "",
    until: "",
  });
  const [error, setError] = useState<string | null>(null);

  if (!assigned) {
    return (
      <Panel title="Contacts">
        <div className="flex flex-col items-start gap-3">
          <Badge tone="danger" icon="lock">
            Hidden by policy
          </Badge>
          <p className="text-sm text-(--fbg-text-secondary)">
            You are not assigned to a project with this supplier, so the database returns no contact
            rows (row-level security plus assignment). This panel is a reflection of that rule, not
            the control itself. Ask the project owner for an assignment if you need outreach.
          </p>
          <p className="text-xs text-(--fbg-text-secondary)">
            Buyers never see this table; disclosure to a buyer requires a recorded grant with a
            reason and an expiry.
          </p>
        </div>
      </Panel>
    );
  }

  const save = () => {
    const err = contactCanBeSaved(form.channel, form.handle, form.basis);
    setError(err);
    if (err || !form.basis) return;
    const c: SupplierContact = {
      id: `con_${Date.now()}`,
      name: form.name || "Unnamed",
      role: form.role || "—",
      channel: form.channel,
      handle: form.handle.trim(),
      basis: form.basis,
      basisRecordedAt: OPS_TODAY,
      lastResponse: null,
    };
    onPatch({ contacts: [...supplier.contacts, c] });
    onAudit(`Recorded contact ${c.name} (${c.channel}, basis: ${CONTACT_BASIS_LABEL[c.basis]})`);
    setForm({ name: "", role: "", channel: "wechat", handle: "", basis: "" });
  };

  const draftGrant = () => {
    if (!grant.contactId || !grant.reason.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(grant.until))
      return;
    const g: DisclosureGrant = {
      id: `dg_${Date.now()}`,
      contactId: grant.contactId,
      granteeOrg: grant.granteeOrg,
      reason: grant.reason.trim(),
      since: OPS_TODAY,
      until: grant.until,
      status: "draft",
    };
    onPatch({ disclosureGrants: [...supplier.disclosureGrants, g] });
    onAudit(
      `Drafted contact disclosure grant to ${g.granteeOrg} (reason recorded; compliance approval pending)`,
    );
    setGrant({ ...grant, reason: "", until: "" });
  };

  return (
    <div className="flex flex-col gap-4">
      <Notice tone="ink" icon="lock" title="Restricted panel">
        Visible because you are assigned to{" "}
        {supplier.assignedProjects.map((p) => p.name).join(", ")}. Every read is logged. Nothing
        here reaches a buyer without a disclosure grant.
      </Notice>
      <Panel title="Contacts" padded={false}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[44rem] text-sm">
            <thead className="bg-(--fbg-bg-canvas) text-xs text-(--fbg-text-secondary)">
              <tr className="[&>th]:px-5 [&>th]:py-2 [&>th]:text-left [&>th]:font-medium">
                <th scope="col">Name</th>
                <th scope="col">Role</th>
                <th scope="col">Channel</th>
                <th scope="col">Contact basis</th>
                <th scope="col">Last response</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-(--fbg-border-subtle)">
              {supplier.contacts.map((c) => (
                <tr key={c.id} className="[&>td]:px-5 [&>td]:py-2.5">
                  <td className="text-(--fbg-text-primary)">{c.name}</td>
                  <td className="text-(--fbg-text-secondary)">{c.role}</td>
                  <td className="fbg-num text-(--fbg-text-primary)">
                    <span className="text-xs text-(--fbg-text-secondary)">{c.channel} · </span>
                    {c.handle}
                  </td>
                  <td>
                    <Badge tone="neutral" icon="shield" className="fbg-num">
                      {CONTACT_BASIS_LABEL[c.basis]} · {c.basisRecordedAt}
                    </Badge>
                  </td>
                  <td className="fbg-num text-(--fbg-text-secondary)">{c.lastResponse ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          title="Record a contact"
          description="A WeChat handle cannot be stored without a contact basis (AC-O2.1)."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name" htmlFor="c-name" optionalText=" (optional)">
              <TextInput
                id="c-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </Field>
            <Field label="Role" htmlFor="c-role" optionalText=" (optional)">
              <TextInput
                id="c-role"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
              />
            </Field>
            <Field label="Channel" htmlFor="c-channel" required>
              <Select
                id="c-channel"
                value={form.channel}
                onChange={(e) =>
                  setForm({ ...form, channel: e.target.value as SupplierContact["channel"] })
                }
              >
                <option value="wechat">WeChat</option>
                <option value="email">Email</option>
                <option value="phone">Phone</option>
              </Select>
            </Field>
            <Field
              label="Handle, email or number"
              htmlFor="c-handle"
              required
              error={error?.startsWith("Enter") ? error : undefined}
            >
              <TextInput
                id="c-handle"
                value={form.handle}
                onChange={(e) => setForm({ ...form, handle: e.target.value })}
              />
            </Field>
            <Field
              label="Contact basis"
              htmlFor="c-basis"
              required
              error={error && !error.startsWith("Enter") ? error : undefined}
              className="sm:col-span-2"
            >
              <Select
                id="c-basis"
                value={form.basis}
                onChange={(e) => setForm({ ...form, basis: e.target.value as ContactBasis | "" })}
              >
                <option value="">Select how this contact was obtained</option>
                {(Object.keys(CONTACT_BASIS_LABEL) as ContactBasis[]).map((b) => (
                  <option key={b} value={b}>
                    {CONTACT_BASIS_LABEL[b]}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Button className="mt-3" variant="primary" icon="plus" onClick={save}>
            Save contact
          </Button>
        </Panel>

        <Panel
          title="Disclosure grants"
          description="Lets one buyer see one contact for a period, with a recorded reason. Audited; compliance approves."
        >
          {supplier.disclosureGrants.length === 0 ? (
            <p className="text-sm text-(--fbg-text-secondary)">
              No grants. Buyers see "Contact details hidden".
            </p>
          ) : (
            <ul className="mb-3 flex flex-col gap-1.5 text-sm">
              {supplier.disclosureGrants.map((g) => (
                <li key={g.id} className="flex flex-wrap items-center gap-2">
                  <span className="text-(--fbg-text-primary)">
                    {supplier.contacts.find((c) => c.id === g.contactId)?.name ?? g.contactId} →{" "}
                    {g.granteeOrg}
                  </span>
                  <span className="fbg-num text-xs text-(--fbg-text-secondary)">
                    {g.since} – {g.until}
                  </span>
                  <Badge
                    tone={g.status === "active" ? "ok" : g.status === "draft" ? "warn" : "neutral"}
                  >
                    {g.status === "draft" ? "Draft — compliance approval pending" : g.status}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Contact" htmlFor="g-contact" required>
              <Select
                id="g-contact"
                value={grant.contactId}
                onChange={(e) => setGrant({ ...grant, contactId: e.target.value })}
              >
                {supplier.contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.channel})
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Buyer organization" htmlFor="g-org" required>
              <TextInput
                id="g-org"
                value={grant.granteeOrg}
                onChange={(e) => setGrant({ ...grant, granteeOrg: e.target.value })}
              />
            </Field>
            <Field label="Reason" htmlFor="g-reason" required className="sm:col-span-2">
              <TextInput
                id="g-reason"
                value={grant.reason}
                onChange={(e) => setGrant({ ...grant, reason: e.target.value })}
                placeholder="Buyer approved sample; direct coordination for inspection scheduling"
              />
            </Field>
            <Field label="Until" htmlFor="g-until" required>
              <TextInput
                id="g-until"
                type="date"
                className="fbg-num"
                value={grant.until}
                onChange={(e) => setGrant({ ...grant, until: e.target.value })}
              />
            </Field>
          </div>
          <Button
            className="mt-3"
            icon="shield"
            disabled={
              !grant.contactId || !grant.reason.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(grant.until)
            }
            onClick={draftGrant}
          >
            Draft disclosure grant
          </Button>
        </Panel>
      </div>
    </div>
  );
}

/* ---- Checks ------------------------------------------------------------------------------------ */

function ChecksTab({
  supplier,
  onPatch,
  onAudit,
}: {
  supplier: OpsSupplier;
  onPatch: (p: Partial<OpsSupplier>) => void;
  onAudit: (a: string) => void;
}) {
  const [form, setForm] = useState<{
    type: CheckType;
    status: "passed" | "pending";
    date: string;
    expiresAt: string;
    evidence: string;
  }>({
    type: "identity_document_reviewed",
    status: "passed",
    date: OPS_TODAY,
    expiresAt: "",
    evidence: "",
  });
  const due = checksDue(supplier.checks, OPS_TODAY);
  const dueFor = (id: string) => due.find((d) => d.check.id === id);
  const canSave =
    /^\d{4}-\d{2}-\d{2}$/.test(form.date) &&
    (form.status === "pending" || form.evidence.trim().length > 0);

  const save = () => {
    if (!canSave) return;
    const c: VerificationCheck = {
      id: `chk_${Date.now()}`,
      type: form.type,
      status: form.status,
      evidence: form.evidence.trim() || null,
      reviewer: "Operator (demo)",
      date: form.date,
      expiresAt: form.expiresAt || null,
    };
    onPatch({ checks: [...supplier.checks, c] });
    onAudit(`Recorded check: ${CHECK_LABEL[c.type]} (${c.status})`);
    setForm({ ...form, evidence: "", expiresAt: "" });
  };

  return (
    <div className="flex flex-col gap-4">
      <Panel
        title="Verification checks"
        description="Each row: what was checked, the evidence file, who reviewed it, when, and until when. Passed and unexpired rows generate the buyer-facing badge."
        padded={false}
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[52rem] text-sm">
            <thead className="bg-(--fbg-bg-canvas) text-xs text-(--fbg-text-secondary)">
              <tr className="[&>th]:px-5 [&>th]:py-2 [&>th]:text-left [&>th]:font-medium">
                <th scope="col">Check</th>
                <th scope="col">Status</th>
                <th scope="col">Evidence</th>
                <th scope="col">Reviewer</th>
                <th scope="col">Date</th>
                <th scope="col">Expires</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-(--fbg-border-subtle)">
              {supplier.checks.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-6 text-center text-(--fbg-text-secondary)">
                    No checks recorded. No badge is shown to buyers.
                  </td>
                </tr>
              ) : null}
              {supplier.checks.map((c) => {
                const d = dueFor(c.id);
                return (
                  <tr key={c.id} className="[&>td]:px-5 [&>td]:py-2.5 [&>td]:align-top">
                    <td className="text-(--fbg-text-primary)">
                      {CHECK_LABEL[c.type]}
                      {c.note ? (
                        <span className="block text-xs text-(--fbg-text-secondary)">{c.note}</span>
                      ) : null}
                    </td>
                    <td>
                      <Badge
                        tone={
                          c.status === "passed"
                            ? "ok"
                            : c.status === "failed"
                              ? "danger"
                              : "neutral"
                        }
                      >
                        {c.status}
                      </Badge>
                    </td>
                    <td className="fbg-num text-(--fbg-text-primary)">
                      {c.evidence ?? (
                        <span className="text-(--fbg-text-secondary)">— (upload placeholder)</span>
                      )}
                    </td>
                    <td className="text-(--fbg-text-secondary)">{c.reviewer}</td>
                    <td className="fbg-num text-(--fbg-text-primary)">{c.date}</td>
                    <td className="fbg-num">
                      {c.expiresAt ?? <span className="text-(--fbg-text-secondary)">—</span>}
                      {d ? (
                        <Badge
                          tone={d.state === "overdue" ? "danger" : "warn"}
                          icon="clock"
                          className="ml-2"
                        >
                          {d.state === "overdue"
                            ? `overdue ${Math.abs(d.daysLeft)} d`
                            : `${d.daysLeft} d left`}
                        </Badge>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
      <Panel
        title="Record a check"
        description="Evidence is required for a passed check. Upload is a placeholder in this prototype."
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Field label="Check" htmlFor="k-type" required>
            <Select
              id="k-type"
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as CheckType })}
            >
              {(Object.keys(CHECK_LABEL) as CheckType[]).map((t) => (
                <option key={t} value={t}>
                  {CHECK_LABEL[t]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Status" htmlFor="k-status" required>
            <Select
              id="k-status"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as "passed" | "pending" })}
            >
              <option value="passed">Passed</option>
              <option value="pending">Pending (scheduled)</option>
            </Select>
          </Field>
          <Field label="Date" htmlFor="k-date" required>
            <TextInput
              id="k-date"
              type="date"
              className="fbg-num"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
            />
          </Field>
          <Field label="Expires" htmlFor="k-exp" optionalText=" (optional)">
            <TextInput
              id="k-exp"
              type="date"
              className="fbg-num"
              value={form.expiresAt}
              onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
            />
          </Field>
          <Field
            label="Evidence file"
            htmlFor="k-ev"
            required={form.status === "passed"}
            optionalText=" (optional)"
          >
            <TextInput
              id="k-ev"
              value={form.evidence}
              placeholder="licence-2026.pdf"
              onChange={(e) => setForm({ ...form, evidence: e.target.value })}
            />
          </Field>
        </div>
        <Button className="mt-3" variant="primary" icon="plus" disabled={!canSave} onClick={save}>
          Record check
        </Button>
      </Panel>
    </div>
  );
}

/* ---- Documents --------------------------------------------------------------------------------- */

function DocumentsTab({
  supplier,
  onPatch,
  onAudit,
}: {
  supplier: OpsSupplier;
  onPatch: (p: Partial<OpsSupplier>) => void;
  onAudit: (a: string) => void;
}) {
  const [form, setForm] = useState<{
    name: string;
    sourceType: SourceType;
    rightsClass: RightsClass;
    permissionRef: string;
  }>({
    name: "",
    sourceType: "operator_import",
    rightsClass: "catalog_public_with_permission",
    permissionRef: "",
  });
  const needsPermission = form.rightsClass === "catalog_public_with_permission";
  const permissionOk =
    !needsPermission ||
    supplier.permissions.some((p) => p.id === form.permissionRef && p.revokedAt === null);
  const canSave = form.name.trim().length > 0 && permissionOk;

  const save = () => {
    if (!canSave) return;
    const d: SupplierDocument = {
      id: `sdoc_${Date.now()}`,
      name: form.name.trim(),
      sourceType: form.sourceType,
      rightsClass: form.rightsClass,
      permissionRef: needsPermission ? form.permissionRef : null,
      importedAt: OPS_TODAY,
      importedBy: "Operator (demo)",
      visibility: needsPermission ? "named_orgs" : "internal_only",
    };
    onPatch({ documents: [...supplier.documents, d] });
    onAudit(`Imported ${d.name} (${d.sourceType}, ${d.rightsClass})`);
    setForm({ ...form, name: "", permissionRef: "" });
  };

  return (
    <div className="flex flex-col gap-4">
      <Panel
        title="Documents and intake"
        description="Every file carries source type, rights class and, where required, the permission that allows buyer visibility. Without one it stays internal only."
        padded={false}
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[52rem] text-sm">
            <thead className="bg-(--fbg-bg-canvas) text-xs text-(--fbg-text-secondary)">
              <tr className="[&>th]:px-5 [&>th]:py-2 [&>th]:text-left [&>th]:font-medium">
                <th scope="col">File</th>
                <th scope="col">Source type</th>
                <th scope="col">Rights class</th>
                <th scope="col">Permission</th>
                <th scope="col">Visibility</th>
                <th scope="col">Imported</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-(--fbg-border-subtle)">
              {supplier.documents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-6 text-center text-(--fbg-text-secondary)">
                    No documents.
                  </td>
                </tr>
              ) : null}
              {supplier.documents.map((d) => (
                <tr key={d.id} className="[&>td]:px-5 [&>td]:py-2.5 [&>td]:align-top">
                  <td className="fbg-num text-(--fbg-text-primary)">{d.name}</td>
                  <td className="text-(--fbg-text-secondary)">{d.sourceType.replace(/_/g, " ")}</td>
                  <td>
                    <Badge
                      tone={d.rightsClass === "internal_market_observation" ? "brand" : "neutral"}
                      icon={d.rightsClass === "internal_market_observation" ? "lock" : null}
                    >
                      {RIGHTS_LABEL[d.rightsClass]}
                    </Badge>
                  </td>
                  <td className="fbg-num text-(--fbg-text-secondary)">
                    {d.permissionRef ?? "— (internal only until permission)"}
                  </td>
                  <td>
                    <Badge tone={d.visibility === "internal_only" ? "ink" : "teal"} icon={null}>
                      {d.visibility.replace(/_/g, " ")}
                    </Badge>
                  </td>
                  <td className="fbg-num text-(--fbg-text-secondary)">
                    {d.importedAt} · {d.importedBy}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <Panel
        title="Import an authorized file"
        description="A catalog with buyer visibility needs an active source permission (AC-O3.1); otherwise the record is internal only."
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="File name" htmlFor="d-name" required>
            <TextInput
              id="d-name"
              value={form.name}
              placeholder="catalog-2026Q4.xlsx"
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </Field>
          <Field label="Source type" htmlFor="d-source" required>
            <Select
              id="d-source"
              value={form.sourceType}
              onChange={(e) => setForm({ ...form, sourceType: e.target.value as SourceType })}
            >
              {SOURCE_TYPES.map((s) => (
                <option key={s} value={s}>
                  {s.replace(/_/g, " ")}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Rights class" htmlFor="d-rights" required>
            <Select
              id="d-rights"
              value={form.rightsClass}
              onChange={(e) => setForm({ ...form, rightsClass: e.target.value as RightsClass })}
            >
              {RIGHTS_CLASSES.map((r) => (
                <option key={r} value={r}>
                  {RIGHTS_LABEL[r]}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Source permission"
            htmlFor="d-perm"
            required={needsPermission}
            optionalText=" (not needed)"
            error={
              needsPermission && form.permissionRef && !permissionOk
                ? "Not an active permission for this supplier."
                : undefined
            }
            hint={
              needsPermission && !form.permissionRef
                ? "Required for catalog_public_with_permission."
                : undefined
            }
          >
            <Select
              id="d-perm"
              value={form.permissionRef}
              onChange={(e) => setForm({ ...form, permissionRef: e.target.value })}
              disabled={!needsPermission}
            >
              <option value="">Select</option>
              {supplier.permissions
                .filter((p) => p.revokedAt === null)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.id} · {p.buyerVisibility} · {p.fields.join(", ")}
                  </option>
                ))}
            </Select>
          </Field>
        </div>
        <Button className="mt-3" variant="primary" icon="upload" disabled={!canSave} onClick={save}>
          Import (placeholder)
        </Button>
      </Panel>
    </div>
  );
}

/* ---- Permissions ------------------------------------------------------------------------------- */

function PermissionsTab({
  supplier,
  onPatch,
  onAudit,
}: {
  supplier: OpsSupplier;
  onPatch: (p: Partial<OpsSupplier>) => void;
  onAudit: (a: string) => void;
}) {
  const [form, setForm] = useState<{
    buyerVisibility: SourcePermission["buyerVisibility"];
    namedOrgs: string;
    fields: SourcePermission["fields"];
    evidence: string;
    expiresAt: string;
  }>({
    buyerVisibility: "named_orgs",
    namedOrgs: "Demo Buyer Co.",
    fields: ["catalog"],
    evidence: "",
    expiresAt: "",
  });
  const [revoking, setRevoking] = useState<{ id: string; reason: string } | null>(null);
  const canSave =
    form.evidence.trim().length > 0 &&
    form.fields.length > 0 &&
    (form.buyerVisibility !== "named_orgs" || form.namedOrgs.trim().length > 0);

  const save = () => {
    if (!canSave) return;
    const p: SourcePermission = {
      id: `perm_${Date.now()}`,
      buyerVisibility: form.buyerVisibility,
      namedOrgs:
        form.buyerVisibility === "named_orgs"
          ? form.namedOrgs
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
          : [],
      fields: form.fields,
      evidence: form.evidence.trim(),
      recordedBy: "Operator (demo)",
      recordedAt: OPS_TODAY,
      expiresAt: form.expiresAt || null,
      revokedAt: null,
    };
    onPatch({ permissions: [...supplier.permissions, p] });
    onAudit(`Recorded source permission ${p.id} (${p.buyerVisibility}; ${p.fields.join(", ")})`);
    setForm({ ...form, evidence: "", expiresAt: "" });
  };

  const revoke = () => {
    if (!revoking || revoking.reason.trim().length < 3) return;
    onPatch({
      permissions: supplier.permissions.map((p) =>
        p.id === revoking.id
          ? { ...p, revokedAt: OPS_TODAY, revokeReason: revoking.reason.trim() }
          : p,
      ),
    });
    onAudit(`Revoked source permission ${revoking.id}: ${revoking.reason.trim()}`);
    setRevoking(null);
  };

  return (
    <div className="flex flex-col gap-4">
      <Notice tone="ink" icon="lock" title="Labels never grant access">
        A row's visibility label is a declared intent. Buyers see catalog rows only while an active,
        unexpired, unrevoked permission names them (or platform buyers) and includes the field.
        Revocation takes effect at the next read; search rows are deleted by a job.
      </Notice>
      <Panel title="Source permissions" padded={false}>
        {supplier.permissions.length === 0 ? (
          <p className="px-5 py-6 text-sm text-(--fbg-text-secondary)">
            No permissions recorded. All catalog data stays internal only.
          </p>
        ) : (
          <ul className="divide-y divide-(--fbg-border-subtle)">
            {supplier.permissions.map((p) => {
              const active =
                p.revokedAt === null && (p.expiresAt === null || p.expiresAt >= OPS_TODAY);
              return (
                <li
                  key={p.id}
                  className="flex flex-col gap-2 px-5 py-3.5 lg:flex-row lg:items-start lg:justify-between"
                >
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-(--fbg-text-primary)">
                      <span className="fbg-num">{p.id}</span>
                      <Badge tone={active ? "ok" : "neutral"}>
                        {p.revokedAt ? `Revoked ${p.revokedAt}` : active ? "Active" : "Expired"}
                      </Badge>
                      <Badge tone="teal" icon={null}>
                        {p.buyerVisibility.replace(/_/g, " ")}
                        {p.namedOrgs.length ? `: ${p.namedOrgs.join(", ")}` : ""}
                      </Badge>
                    </p>
                    <p className="mt-1 flex flex-wrap gap-1">
                      {p.fields.map((f) => (
                        <Badge key={f} tone="neutral" icon={null}>
                          {f.replace(/_/g, " ")}
                        </Badge>
                      ))}
                    </p>
                    <p className="fbg-num mt-1 text-xs text-(--fbg-text-secondary)">
                      Evidence: {p.evidence} · recorded {p.recordedAt} by {p.recordedBy} · expires{" "}
                      {p.expiresAt ?? "no expiry"}
                      {p.revokeReason ? ` · revoked: ${p.revokeReason}` : ""}
                    </p>
                  </div>
                  {active ? (
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => setRevoking({ id: p.id, reason: "" })}
                    >
                      Revoke
                    </Button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      {revoking ? (
        <Panel
          title={`Revoke ${revoking.id}`}
          description="Catalog rows under this permission become invisible to the named buyers at their next read; issued quotes remain in the buyer's record."
        >
          <Field label="Reason" htmlFor="r-reason" required>
            <TextInput
              id="r-reason"
              value={revoking.reason}
              onChange={(e) => setRevoking({ ...revoking, reason: e.target.value })}
              placeholder="Supplier withdrew authorization by email 2026-11-07"
            />
          </Field>
          <div className="mt-3 flex gap-2">
            <Button onClick={() => setRevoking(null)}>Cancel</Button>
            <Button variant="danger" disabled={revoking.reason.trim().length < 3} onClick={revoke}>
              Confirm revocation
            </Button>
          </div>
        </Panel>
      ) : null}

      <Panel
        title="Record a permission"
        description="Only with evidence: a signed authorization, portal consent, or an email from the supplier's authorized representative."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Buyer visibility" htmlFor="p-vis" required>
            <Select
              id="p-vis"
              value={form.buyerVisibility}
              onChange={(e) =>
                setForm({
                  ...form,
                  buyerVisibility: e.target.value as SourcePermission["buyerVisibility"],
                })
              }
            >
              <option value="internal_only">Internal only</option>
              <option value="named_orgs">Named buyer organizations</option>
              <option value="platform_buyers">All platform buyers</option>
            </Select>
          </Field>
          <Field
            label="Named organizations (comma-separated)"
            htmlFor="p-orgs"
            required={form.buyerVisibility === "named_orgs"}
            optionalText=" (not needed)"
          >
            <TextInput
              id="p-orgs"
              value={form.namedOrgs}
              disabled={form.buyerVisibility !== "named_orgs"}
              onChange={(e) => setForm({ ...form, namedOrgs: e.target.value })}
            />
          </Field>
          <div className="sm:col-span-2">
            <p className="text-sm font-medium text-(--fbg-text-primary)">
              Fields <span className="text-(--fbg-status-danger)">*</span>
            </p>
            <div className="mt-2 grid gap-2 sm:grid-cols-4">
              {(["catalog", "price_tiers", "images", "benchmark"] as const).map((f) => (
                <Checkbox
                  key={f}
                  id={`p-field-${f}`}
                  label={f.replace(/_/g, " ")}
                  checked={form.fields.includes(f)}
                  onChange={(on) =>
                    setForm({
                      ...form,
                      fields: on ? [...form.fields, f] : form.fields.filter((x) => x !== f),
                    })
                  }
                  disabled={f === "benchmark"}
                  description={f === "benchmark" ? "Phase 5; needs ≥ 5 suppliers" : undefined}
                />
              ))}
            </div>
          </div>
          <Field label="Evidence" htmlFor="p-ev" required className="sm:col-span-2">
            <TextInput
              id="p-ev"
              value={form.evidence}
              placeholder="Signed catalog authorization 2026-11-07 (auth-2026-11-07.pdf)"
              onChange={(e) => setForm({ ...form, evidence: e.target.value })}
            />
          </Field>
          <Field label="Expires" htmlFor="p-exp" optionalText=" (optional)">
            <TextInput
              id="p-exp"
              type="date"
              className="fbg-num"
              value={form.expiresAt}
              onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
            />
          </Field>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button variant="primary" icon="shield" disabled={!canSave} onClick={save}>
            Record permission
          </Button>
          <Link href="/design-preview/supplier/sharing" className={buttonClasses("ghost", "sm")}>
            See the supplier's own sharing settings
          </Link>
        </div>
      </Panel>
    </div>
  );
}
