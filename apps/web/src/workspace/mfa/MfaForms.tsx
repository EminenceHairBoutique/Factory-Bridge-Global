"use client";

/**
 * TOTP enrolment and challenge forms (B-05b). Plain forms posting to server actions; no Supabase client, token or key
 * reaches the browser. The QR code and setup key are shown once, from the enrolment action's response, and are kept
 * only in this component's state; the confirm form sends back the factor id and the code, never the key.
 */
import { useActionState } from "react";
import {
  confirmTotpEnrollment,
  startTotpEnrollment,
  verifyTotp,
  type EnrollStartState,
  type MfaCodeState,
} from "@/app/ops/mfa/actions";
import { MFA_COPY } from "../copy";
import { Button, Field, Notice, TextInput } from "../ui";

const START: EnrollStartState = {};
const CODE: MfaCodeState = {};

function NextField({ next }: { next: string }) {
  return next === "/ops" ? null : <input type="hidden" name="next" value={next} />;
}

function CodeField({ id, error }: { id: string; error: string | undefined }) {
  return (
    <Field label={MFA_COPY.codeLabel} htmlFor={id} required error={error}>
      <TextInput
        id={id}
        name="code"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]{6}"
        maxLength={6}
        required
        className="fbg-num tracking-[0.3em]"
      />
    </Field>
  );
}

export function TotpEnrollForm({ next }: { next: string }) {
  const [start, startAction, starting] = useActionState(startTotpEnrollment, START);
  const [confirm, confirmAction, confirming] = useActionState(confirmTotpEnrollment, CODE);
  if (!start.factorId || !start.secret) {
    return (
      <form action={startAction} className="flex flex-col gap-4">
        {start.error ? <Notice tone="danger" title={start.error} /> : null}
        <NextField next={next} />
        <Button type="submit" variant="primary" loading={starting}>
          {MFA_COPY.start}
        </Button>
      </form>
    );
  }
  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-(--fbg-text-secondary)">{MFA_COPY.scanStep}</p>
      {start.qrCode ? (
        <img
          src={start.qrCode}
          alt={MFA_COPY.qrAlt}
          width={192}
          height={192}
          className="self-center rounded-(--fbg-radius-chip) bg-white p-2"
        />
      ) : null}
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">{MFA_COPY.secretLabel}</span>
        <code
          className="fbg-num block rounded-(--fbg-radius-chip) border border-(--fbg-border-subtle) px-3 py-2 text-sm break-all select-all"
          data-testid="totp-secret"
        >
          {start.secret}
        </code>
      </div>
      <form action={confirmAction} className="flex flex-col gap-4">
        <p className="text-sm text-(--fbg-text-secondary)">{MFA_COPY.confirmStep}</p>
        {confirm.error ? <Notice tone="danger" title={confirm.error} /> : null}
        <input type="hidden" name="factorId" value={start.factorId} />
        <NextField next={next} />
        <CodeField id="totp-enroll-code" error={confirm.fieldErrors?.["code"]} />
        <Button type="submit" variant="primary" loading={confirming}>
          {MFA_COPY.confirm}
        </Button>
      </form>
    </div>
  );
}

export function TotpVerifyForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(verifyTotp, CODE);
  return (
    <form action={action} className="flex flex-col gap-4">
      {state.error ? <Notice tone="danger" title={state.error} /> : null}
      <NextField next={next} />
      <CodeField id="totp-verify-code" error={state.fieldErrors?.["code"]} />
      <Button type="submit" variant="primary" loading={pending}>
        {MFA_COPY.verify}
      </Button>
    </form>
  );
}
