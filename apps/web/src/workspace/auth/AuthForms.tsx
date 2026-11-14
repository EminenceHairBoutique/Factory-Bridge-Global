"use client";

/**
 * Sign-in, email-code and sign-up forms (B-05). Plain forms posting to server actions, so they work before hydration;
 * with JavaScript the page stays in place and errors appear inline. Native constraints are a convenience — the server
 * validates everything again (server/auth/schemas.ts). No token, key or Supabase client ever reaches the browser.
 */
import { useActionState } from "react";
import {
  requestEmailCode,
  signInWithPassword,
  signUp,
  verifyEmailCode,
  type AuthFormState,
} from "@/app/(auth)/actions";
import { PASSWORD_MAX, PASSWORD_MIN } from "@/server/auth/schemas";
import { Button, Field, Notice, TextInput } from "../ui";

const INITIAL: AuthFormState = {};

function FormError({ state }: { state: AuthFormState }) {
  return state.error ? <Notice tone="danger" title={state.error} /> : null;
}

function NextField({ next }: { next: string | null }) {
  return next ? <input type="hidden" name="next" value={next} /> : null;
}

export function PasswordSignInForm({ next }: { next: string | null }) {
  const [state, action, pending] = useActionState(signInWithPassword, INITIAL);
  return (
    <form action={action} className="flex flex-col gap-4" noValidate={false}>
      <FormError state={state} />
      <NextField next={next} />
      <Field label="Email" htmlFor="signin-email" required error={state.fieldErrors?.["email"]}>
        <TextInput
          id="signin-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          maxLength={254}
          defaultValue={state.email ?? ""}
          aria-invalid={state.fieldErrors?.["email"] ? true : undefined}
        />
      </Field>
      <Field
        label="Password"
        htmlFor="signin-password"
        required
        error={state.fieldErrors?.["password"]}
      >
        <TextInput
          id="signin-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          maxLength={PASSWORD_MAX}
        />
      </Field>
      <Button type="submit" variant="primary" loading={pending}>
        Sign in
      </Button>
    </form>
  );
}

export function CodeRequestForm({ next }: { next: string | null }) {
  const [state, action, pending] = useActionState(requestEmailCode, INITIAL);
  return (
    <form action={action} className="flex flex-col gap-4">
      <FormError state={state} />
      <NextField next={next} />
      <Field
        label="Email for a sign-in code"
        htmlFor="code-email"
        required
        error={state.fieldErrors?.["email"]}
      >
        <TextInput
          id="code-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          maxLength={254}
          defaultValue={state.email ?? ""}
        />
      </Field>
      <Button type="submit" variant="secondary" loading={pending}>
        Email me a code
      </Button>
    </form>
  );
}

export function CodeVerifyForm({ next }: { next: string | null }) {
  const [state, action, pending] = useActionState(verifyEmailCode, INITIAL);
  return (
    <form action={action} className="flex flex-col gap-4">
      <FormError state={state} />
      <NextField next={next} />
      <Field label="6-digit code" htmlFor="otp-code" required error={state.fieldErrors?.["code"]}>
        <TextInput
          id="otp-code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={6}
          required
          className="fbg-num tracking-[0.3em]"
        />
      </Field>
      <Button type="submit" variant="primary" loading={pending}>
        Verify and sign in
      </Button>
    </form>
  );
}

export function SignUpForm({ next }: { next: string | null }) {
  const [state, action, pending] = useActionState(signUp, INITIAL);
  return (
    <form action={action} className="flex flex-col gap-4">
      <FormError state={state} />
      <NextField next={next} />
      <Field label="Full name" htmlFor="signup-name" error={state.fieldErrors?.["fullName"]}>
        <TextInput id="signup-name" name="fullName" autoComplete="name" maxLength={120} />
      </Field>
      <Field
        label="Work email"
        htmlFor="signup-email"
        required
        error={state.fieldErrors?.["email"]}
      >
        <TextInput
          id="signup-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          maxLength={254}
          defaultValue={state.email ?? ""}
        />
      </Field>
      <Field
        label="Password"
        htmlFor="signup-password"
        required
        hint={`At least ${PASSWORD_MIN} characters.`}
        error={state.fieldErrors?.["password"]}
      >
        <TextInput
          id="signup-password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={PASSWORD_MIN}
          maxLength={PASSWORD_MAX}
        />
      </Field>
      <Button type="submit" variant="primary" loading={pending}>
        Create account
      </Button>
    </form>
  );
}
