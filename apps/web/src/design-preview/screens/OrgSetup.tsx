"use client";

/**
 * Buyer organization setup (B-05 design; master spec §6.1): company → destination and categories → invite team →
 * created. Roles explained inline. Suppliers do not use this flow (供应商申请). Local state only.
 */
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ROLE_EXPLANATION,
  validateInvites,
  validateZip,
  type InviteRow,
  type Role,
} from "../auth-demo";
import { AuthFrame } from "../ui/AuthFrame";
import { Icon } from "../ui/icons";
import {
  Badge,
  Button,
  Checkbox,
  Field,
  Notice,
  Select,
  Stepper,
  TextInput,
  buttonClasses,
  cx,
  type StepDef,
} from "../ui/primitives";

const STEPS: StepDef[] = [
  { id: "company", title: "Company" },
  { id: "needs", title: "Destination and categories" },
  { id: "team", title: "Invite your team" },
];

const OWNER_EMAIL = "owner@demo-buyer.example";
const FAMILIES = [
  "Custom roll labels",
  "Folding cartons",
  "Human-hair bundles",
  "Another category (needs review)",
];
const VOLUME = [
  "Under $25k / year",
  "$25k – $100k / year",
  "$100k – $500k / year",
  "Over $500k / year",
  "Not sure yet",
];

export function OrgSetup() {
  const [step, setStep] = useState(0);
  const [completed, setCompleted] = useState<Set<number>>(new Set());
  const [company, setCompany] = useState({
    legalName: "",
    dba: "",
    state: "",
    website: "",
    kind: "",
  });
  const [needs, setNeeds] = useState({
    zip: "",
    volume: "",
    families: [] as string[],
    pilotAck: false,
  });
  const [invites, setInvites] = useState<InviteRow[]>([{ id: 1, email: "", role: "member" }]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [created, setCreated] = useState(false);

  const inviteErrors = useMemo(() => validateInvites(invites, OWNER_EMAIL), [invites]);

  const validate = (i: number) => {
    const e: Record<string, string> = {};
    if (i === 0) {
      if (company.legalName.trim().length < 2) e.legalName = "Enter the legal company name.";
      if (!company.state) e.state = "Choose a state.";
      if (!company.kind) e.kind = "Choose what best describes you.";
    }
    if (i === 1) {
      const z = validateZip(needs.zip);
      if (z) e.zip = z;
      if (!needs.volume) e.volume = "Choose a band; it only guides which operator is assigned.";
      if (needs.families.length === 0) e.families = "Choose at least one category.";
      if (!needs.pilotAck) e.pilotAck = "Please acknowledge the pilot terms.";
    }
    if (i === 2 && Object.keys(inviteErrors).length > 0)
      e.invites = "Fix the highlighted addresses.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const next = () => {
    if (!validate(step)) return;
    setCompleted((s) => new Set(s).add(step));
    if (step < 2) setStep(step + 1);
    else setCreated(true);
  };

  if (created) {
    const sent = invites.filter((r) => r.email.trim());
    return (
      <AuthFrame
        title={`${company.dba || company.legalName} is ready`}
        lead="You are the owner. Your workspace starts empty and private; no supplier sees anything until you start a request."
      >
        <div className="flex flex-col gap-4">
          <div className="rounded-(--fbg-radius-control) border border-(--fbg-border-subtle) bg-(--fbg-bg-canvas) p-3 text-sm">
            <p className="text-(--fbg-text-primary)">
              {sent.length === 0
                ? "No invitations sent yet."
                : `${sent.length} invitation${sent.length === 1 ? "" : "s"} sent, valid for 7 days:`}
            </p>
            {sent.length > 0 ? (
              <ul className="mt-1 flex flex-col gap-0.5 text-xs text-(--fbg-text-secondary)">
                {sent.map((r) => (
                  <li key={r.id} className="fbg-num">
                    {r.email.trim()} · {ROLE_EXPLANATION[r.role].label}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          <Link
            href="/design-preview/buyer/new-request"
            className={cx(buttonClasses("primary", "lg"), "w-full")}
          >
            Start a sourcing request
          </Link>
          <Link
            href="/design-preview/buyer/dashboard"
            className={cx(buttonClasses("secondary", "lg"), "w-full")}
          >
            Go to the overview
          </Link>
        </div>
      </AuthFrame>
    );
  }

  return (
    <AuthFrame
      wide
      title="Set up your organization"
      lead="Three short steps. Suppliers do not sign up here; they apply through 供应商申请 and are verified by our operators."
    >
      <div className="grid gap-6 md:grid-cols-[14rem_1fr]">
        <div className="min-w-0 md:border-r md:border-(--fbg-border-subtle) md:pr-4">
          <Stepper
            steps={STEPS}
            current={step}
            completed={completed}
            onSelect={(i) => i <= step && setStep(i)}
          />
        </div>
        <div className="min-w-0">
          {step === 0 ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Legal company name"
                htmlFor="legalName"
                required
                optionalText=""
                error={errors.legalName}
                className="sm:col-span-2"
              >
                <TextInput
                  id="legalName"
                  autoComplete="organization"
                  value={company.legalName}
                  onChange={(e) => setCompany({ ...company, legalName: e.target.value })}
                  aria-invalid={Boolean(errors.legalName)}
                />
              </Field>
              <Field label="Doing business as" htmlFor="dba" optionalText=" (optional)">
                <TextInput
                  id="dba"
                  value={company.dba}
                  onChange={(e) => setCompany({ ...company, dba: e.target.value })}
                />
              </Field>
              <Field label="State" htmlFor="state" required optionalText="" error={errors.state}>
                <Select
                  id="state"
                  value={company.state}
                  onChange={(e) => setCompany({ ...company, state: e.target.value })}
                  aria-invalid={Boolean(errors.state)}
                >
                  <option value="">Choose</option>
                  {["CA", "GA", "NJ", "NY", "TX", "Other"].map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Website" htmlFor="website" optionalText=" (optional)">
                <TextInput
                  id="website"
                  inputMode="url"
                  placeholder="https://"
                  value={company.website}
                  onChange={(e) => setCompany({ ...company, website: e.target.value })}
                />
              </Field>
              <Field
                label="What best describes you"
                htmlFor="kind"
                required
                optionalText=""
                error={errors.kind}
              >
                <Select
                  id="kind"
                  value={company.kind}
                  onChange={(e) => setCompany({ ...company, kind: e.target.value })}
                  aria-invalid={Boolean(errors.kind)}
                >
                  <option value="">Choose</option>
                  {[
                    "Brand or e-commerce seller",
                    "Agency sourcing for clients",
                    "Distributor or importer",
                    "Procurement team",
                    "Contract manufacturer",
                  ].map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          ) : null}

          {step === 1 ? (
            <div className="flex flex-col gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Default delivery ZIP code"
                  htmlFor="zip"
                  required
                  optionalText=""
                  error={errors.zip}
                  hint="Used for freight and duty estimates; you can change it per project."
                >
                  <TextInput
                    id="zip"
                    inputMode="numeric"
                    className="fbg-num"
                    value={needs.zip}
                    onChange={(e) => setNeeds({ ...needs, zip: e.target.value })}
                    aria-invalid={Boolean(errors.zip)}
                  />
                </Field>
                <Field
                  label="Expected annual order volume"
                  htmlFor="volume"
                  required
                  optionalText=""
                  error={errors.volume}
                >
                  <Select
                    id="volume"
                    value={needs.volume}
                    onChange={(e) => setNeeds({ ...needs, volume: e.target.value })}
                    aria-invalid={Boolean(errors.volume)}
                  >
                    <option value="">Choose a band</option>
                    {VOLUME.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <fieldset>
                <legend className="text-sm font-medium text-(--fbg-text-primary)">
                  Categories you source <span className="text-(--fbg-status-danger)">*</span>
                </legend>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {FAMILIES.map((f) => (
                    <Checkbox
                      key={f}
                      id={`fam-${f}`}
                      label={f}
                      checked={needs.families.includes(f)}
                      onChange={(on) =>
                        setNeeds({
                          ...needs,
                          families: on
                            ? [...needs.families, f]
                            : needs.families.filter((x) => x !== f),
                        })
                      }
                    />
                  ))}
                </div>
                {errors.families ? (
                  <p className="mt-1 text-xs text-(--fbg-status-danger)">{errors.families}</p>
                ) : null}
                <p className="mt-2 text-xs text-(--fbg-text-secondary)">
                  Medical devices, sterile vials, ingestibles, finished cosmetics and
                  export-sensitive machinery are not available for self-service quoting.
                </p>
              </fieldset>
              <Checkbox
                id="pilotAck"
                label="I understand this is a pilot program with pricing agreed by conversation"
                description="A written pilot agreement arrives before any supplier is contacted on your behalf."
                checked={needs.pilotAck}
                onChange={(on) => setNeeds({ ...needs, pilotAck: on })}
              />
              {errors.pilotAck ? (
                <p className="text-xs text-(--fbg-status-danger)">{errors.pilotAck}</p>
              ) : null}
            </div>
          ) : null}

          {step === 2 ? (
            <div className="flex flex-col gap-4">
              <Notice tone="neutral" icon="user" title={`You are the owner (${OWNER_EMAIL})`}>
                Owners approve supplier selection and order handoff. Invite at least one admin so
                approvals never depend on one person.
              </Notice>
              <ul className="flex flex-col gap-2">
                {invites.map((r, i) => (
                  <li
                    key={r.id}
                    className="grid grid-cols-[1fr_auto] gap-2 sm:grid-cols-[1fr_11rem_auto]"
                  >
                    <div className="col-span-2 sm:col-span-1">
                      <label className="sr-only" htmlFor={`inv-${r.id}`}>
                        Invite {i + 1} email
                      </label>
                      <TextInput
                        id={`inv-${r.id}`}
                        type="email"
                        placeholder="colleague@company.com"
                        value={r.email}
                        onChange={(e) =>
                          setInvites(
                            invites.map((x) =>
                              x.id === r.id ? { ...x, email: e.target.value } : x,
                            ),
                          )
                        }
                        aria-invalid={Boolean(inviteErrors[r.id])}
                      />
                      {inviteErrors[r.id] ? (
                        <p className="mt-1 text-xs text-(--fbg-status-danger)">
                          {inviteErrors[r.id]}
                        </p>
                      ) : null}
                    </div>
                    <div>
                      <label className="sr-only" htmlFor={`role-${r.id}`}>
                        Invite {i + 1} role
                      </label>
                      <Select
                        id={`role-${r.id}`}
                        value={r.role}
                        onChange={(e) =>
                          setInvites(
                            invites.map((x) =>
                              x.id === r.id ? { ...x, role: e.target.value as Role } : x,
                            ),
                          )
                        }
                      >
                        {(Object.keys(ROLE_EXPLANATION) as Role[])
                          .filter((k) => k !== "owner")
                          .map((k) => (
                            <option key={k} value={k}>
                              {ROLE_EXPLANATION[k].label}
                            </option>
                          ))}
                      </Select>
                    </div>
                    <Button
                      variant="ghost"
                      icon="x"
                      aria-label={`Remove invite ${i + 1}`}
                      disabled={invites.length === 1}
                      onClick={() => setInvites(invites.filter((x) => x.id !== r.id))}
                    />
                  </li>
                ))}
              </ul>
              <div>
                <Button
                  size="sm"
                  icon="plus"
                  onClick={() =>
                    setInvites([...invites, { id: Date.now(), email: "", role: "member" }])
                  }
                >
                  Add another
                </Button>
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                {(["admin", "member", "viewer"] as Role[]).map((k) => (
                  <div
                    key={k}
                    className="rounded-(--fbg-radius-control) border border-(--fbg-border-subtle) p-3"
                  >
                    <p className="flex items-center gap-2 text-sm font-medium text-(--fbg-text-primary)">
                      {ROLE_EXPLANATION[k].label}
                      <Badge tone="neutral" icon={null}>
                        {ROLE_EXPLANATION[k].summary}
                      </Badge>
                    </p>
                    <ul className="mt-1.5 flex flex-col gap-0.5 text-xs text-(--fbg-text-secondary)">
                      {ROLE_EXPLANATION[k].can.slice(0, 3).map((c) => (
                        <li key={c} className="flex gap-1">
                          <Icon
                            name="check"
                            size={12}
                            className="mt-0.5 shrink-0 text-(--fbg-status-success)"
                          />{" "}
                          {c}
                        </li>
                      ))}
                      {ROLE_EXPLANATION[k].cannot.slice(0, 1).map((c) => (
                        <li key={c} className="flex gap-1">
                          <Icon
                            name="x"
                            size={12}
                            className="mt-0.5 shrink-0 text-(--fbg-text-muted)"
                          />{" "}
                          {c}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
              {errors.invites ? (
                <p className="text-xs text-(--fbg-status-danger)">{errors.invites}</p>
              ) : null}
            </div>
          ) : null}

          <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-(--fbg-border-subtle) pt-4">
            <Button
              variant="ghost"
              icon="chevron-left"
              disabled={step === 0}
              onClick={() => setStep(step - 1)}
            >
              Back
            </Button>
            <Button
              variant="primary"
              iconRight={step < 2 ? "chevron-right" : undefined}
              onClick={next}
            >
              {step < 2 ? "Continue" : "Create organization"}
            </Button>
          </div>
        </div>
      </div>
    </AuthFrame>
  );
}
