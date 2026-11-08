"use client";

/**
 * Invitation acceptance (B-05 design): names the organization, the inviter and the role with a one-line explanation
 * and the full can/cannot list; accepting requires proving the invited email with a one-time code. Local state only.
 */
import Link from "next/link";
import { useState } from "react";
import { ROLE_EXPLANATION, validateOtp, type Role } from "../auth-demo";
import { AuthFrame } from "../ui/AuthFrame";
import { Icon } from "../ui/icons";
import {
  Badge,
  Button,
  Field,
  Notice,
  SegmentedControl,
  TextInput,
  buttonClasses,
  cx,
} from "../ui/primitives";

const INVITE = {
  org: "Demo Buyer Co.",
  orgType: "Buyer organization",
  inviter: "Demo Buyer (owner)",
  email: "newmember@demo-buyer.example",
  role: "member" as Role,
  sentAt: "2026-11-06",
  expiresAt: "2026-11-13",
};

type Scenario = "valid" | "expired";
type Step = "review" | "code" | "joined";

export function AuthInvite() {
  const [scenario, setScenario] = useState<Scenario>("valid");
  const [step, setStep] = useState<Step>("review");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const role = ROLE_EXPLANATION[INVITE.role];

  return (
    <AuthFrame
      title={
        step === "joined"
          ? `Welcome to ${INVITE.org}`
          : scenario === "expired"
            ? "This invitation has expired"
            : `Join ${INVITE.org}`
      }
      lead={
        step === "joined"
          ? `You are a ${role.label.toLowerCase()}. Your membership is checked live on every request.`
          : scenario === "expired"
            ? `${INVITE.inviter} invited you on ${INVITE.sentAt}; invitations last 7 days. Ask them to send a new one.`
            : `${INVITE.inviter} invited ${INVITE.email} as ${role.label.toLowerCase()}. ${role.summary}`
      }
      footer={
        <span className="flex items-center justify-center gap-2">
          Demo scenario
          <SegmentedControl
            label="Demo scenario"
            size="sm"
            value={scenario}
            onChange={(v) => {
              setScenario(v);
              setStep("review");
              setError(null);
            }}
            options={[
              { value: "valid", label: "Valid" },
              { value: "expired", label: "Expired" },
            ]}
          />
        </span>
      }
    >
      {scenario === "expired" ? (
        <div className="flex flex-col gap-4">
          <Notice tone="warn" title="Nothing was shared">
            Expired invitations grant nothing; the organization owner sees it as expired in Team and
            account.
          </Notice>
          <Link
            href="/design-preview/auth"
            className={cx(buttonClasses("secondary", "lg"), "w-full")}
          >
            Back to sign in
          </Link>
        </div>
      ) : step === "review" ? (
        <form
          className="flex flex-col gap-5"
          onSubmit={(e) => {
            e.preventDefault();
            setStep("code");
          }}
        >
          <dl className="grid grid-cols-[6.5rem_1fr] gap-x-3 gap-y-2 rounded-(--fbg-radius-control) border border-(--fbg-border-subtle) bg-(--fbg-bg-canvas) p-3 text-sm">
            <dt className="text-(--fbg-text-secondary)">Organization</dt>
            <dd className="text-(--fbg-text-primary)">
              {INVITE.org}{" "}
              <Badge tone="neutral" icon={null}>
                {INVITE.orgType}
              </Badge>
            </dd>
            <dt className="text-(--fbg-text-secondary)">Invited by</dt>
            <dd className="text-(--fbg-text-primary)">{INVITE.inviter}</dd>
            <dt className="text-(--fbg-text-secondary)">For</dt>
            <dd className="fbg-num text-(--fbg-text-primary)">{INVITE.email}</dd>
            <dt className="text-(--fbg-text-secondary)">Expires</dt>
            <dd className="fbg-num text-(--fbg-text-primary)">{INVITE.expiresAt}</dd>
          </dl>
          <div className="rounded-(--fbg-radius-control) border border-(--fbg-border-subtle) p-3">
            <p className="flex items-center gap-2 text-sm font-medium text-(--fbg-text-primary)">
              <Icon name="user" size={14} /> Role: {role.label}
            </p>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <ul className="flex flex-col gap-1 text-xs text-(--fbg-text-secondary)">
                {role.can.map((c) => (
                  <li key={c} className="flex gap-1.5">
                    <Icon
                      name="check"
                      size={12}
                      className="mt-0.5 shrink-0 text-(--fbg-status-success)"
                    />{" "}
                    {c}
                  </li>
                ))}
              </ul>
              <ul className="flex flex-col gap-1 text-xs text-(--fbg-text-secondary)">
                {role.cannot.map((c) => (
                  <li key={c} className="flex gap-1.5">
                    <Icon name="x" size={12} className="mt-0.5 shrink-0 text-(--fbg-text-muted)" />{" "}
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <Field label="Your name" htmlFor="name" required optionalText="">
            <TextInput
              id="name"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="w-full"
            disabled={name.trim().length < 2}
          >
            Accept and verify my email
          </Button>
          <p className="text-xs text-(--fbg-text-secondary)">
            We email a one-time code to {INVITE.email} to prove you own that address. No password is
            required.
          </p>
        </form>
      ) : step === "code" ? (
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            const v = validateOtp(code);
            setError(v);
            if (!v) setStep("joined");
          }}
        >
          <Field
            label="6-digit code"
            htmlFor="invite-code"
            required
            optionalText=""
            error={error ?? undefined}
            hint="Prototype: any 6 digits continue."
          >
            <TextInput
              id="invite-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={7}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="fbg-num text-center text-2xl tracking-[0.3em]"
              aria-invalid={Boolean(error)}
              autoFocus
            />
          </Field>
          <Button type="submit" variant="primary" size="lg" className="w-full">
            Join {INVITE.org}
          </Button>
          <button
            type="button"
            className="text-sm text-(--fbg-text-secondary) underline"
            onClick={() => setStep("review")}
          >
            Back
          </button>
        </form>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3 rounded-(--fbg-radius-control) border border-(--fbg-status-success)/35 bg-(--fbg-status-success-fill) p-3 text-sm text-(--fbg-text-primary)">
            <Icon name="check" size={18} className="text-(--fbg-status-success)" />
            Membership recorded: {name} · {role.label} · {INVITE.org}
          </div>
          <Link
            href="/design-preview/buyer/dashboard"
            className={cx(buttonClasses("primary", "lg"), "w-full")}
          >
            Open the buyer workspace
          </Link>
          <p className="text-xs text-(--fbg-text-secondary)">
            The owner can change your role at any time; the change applies on your next request and
            other sessions are signed out.
          </p>
        </div>
      )}
    </AuthFrame>
  );
}
