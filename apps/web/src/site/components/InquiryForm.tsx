"use client";

/**
 * Public sourcing-request form (B-31). Posts to the `submitInquiry` server action; works without JavaScript
 * (plain form POST) and, with it, keeps the page in place and moves focus to the outcome.
 *
 * Honesty rules: the form is switched off (and says so) when no delivery mechanism is configured; test mode is
 * announced before anyone types; "sent" appears only when the server reports a delivery. Native constraints
 * (required, type=email, maxLength) help in the browser, but the server validates everything again.
 * Nothing typed is lost: every unsuccessful response echoes the input back, and the draft is handed to the
 * surrounding error boundary (InquirySection) before each submission.
 */
import { useActionState, useEffect, useId, useRef, useState, type FormEvent } from "react";
import { submitInquiry } from "@/app/(site)/actions";
import type { InquiryMode } from "@/server/inquiry/config";
import { FORM } from "../content";
import {
  Button,
  Field,
  Icon,
  Notice,
  Select,
  TextArea,
  TextInput,
  buttonClasses,
  cx,
} from "../design-system";
import {
  INQUIRY_FIELDS,
  INQUIRY_LIMITS,
  PRODUCT_FAMILIES,
  PRODUCT_FAMILY_LABEL,
  type InquiryField,
  type InquiryValues,
} from "../inquiry-fields";
import { INITIAL_INQUIRY_STATE, type InquiryFormState } from "../inquiry-state";

/**
 * The shared control style draws a 60 %-opacity border, about 2.1:1 on the Obsidian panel this form sits on;
 * WCAG 1.4.11 needs 3:1 for a field's boundary. Use the opaque token here (3.5:1). Design-track follow-up.
 */
const CONTROL_BORDER =
  "border-(--fbg-border-strong)! aria-[invalid=true]:border-(--fbg-status-danger)!";

function newSubmissionId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : "";
}

function readDraft(form: HTMLFormElement): InquiryValues {
  const data = new FormData(form);
  const draft: InquiryValues = {};
  for (const f of INQUIRY_FIELDS) {
    const v = data.get(f);
    if (typeof v === "string") draft[f] = v;
  }
  return draft;
}

export function InquiryForm({
  mode,
  draft,
  onDraft,
}: {
  mode: InquiryMode;
  /** Values to restore after the error boundary reset the form (see InquirySection). */
  draft?: InquiryValues | undefined;
  onDraft?: ((draft: InquiryValues | undefined) => void) | undefined;
}) {
  const [state, formAction, pending] = useActionState<InquiryFormState, FormData>(
    submitInquiry,
    INITIAL_INQUIRY_STATE,
  );
  const uid = useId();
  const id = (f: string) => `${uid}-${f}`;
  const statusRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<HTMLInputElement>(null);
  // When the current form was shown, on the browser's monotonic clock. 0 = page load, so typing done before
  // the page finished hydrating still counts towards the fill time.
  const shownAt = useRef(0);
  const focusNameNext = useRef(false);
  const [submissionId, setSubmissionId] = useState("");
  const [dismissedSeq, setDismissedSeq] = useState(-1);

  const closed = mode === "not_configured";
  const succeeded =
    (state.status === "sent" || state.status === "test_sent") && state.seq !== dismissedSeq;
  const errors = state.fieldErrors ?? {};
  const values: InquiryValues = state.values ?? (state.seq === 0 ? draft : undefined) ?? {};
  const [messageLength, setMessageLength] = useState(values.message?.length ?? 0);

  // A fresh idempotency id for every new request (after an accepted one); the browser makes it.
  useEffect(() => {
    if (closed) return;
    setSubmissionId(newSubmissionId());
  }, [closed, succeeded]);

  // An accepted request clears the saved draft.
  useEffect(() => {
    if (succeeded) onDraft?.(undefined);
  }, [succeeded, onDraft]);

  // After each server response: keep the counter true to the restored text; invalid → focus the first field
  // in error; otherwise → the outcome message.
  useEffect(() => {
    setMessageLength(state.values?.message?.length ?? 0);
    if (state.seq === 0) return;
    if (state.status === "invalid") {
      const first = INQUIRY_FIELDS.find((f) => errors[f]);
      if (first) {
        document.getElementById(id(first))?.focus();
        return;
      }
    }
    statusRef.current?.focus();
    // Runs once per server response; `errors` and `id` derive from that response and `uid`.
  }, [state.seq]);

  // "Send another request": the confirmation (and its focused button) is replaced by a fresh form; put focus
  // on its first field so keyboard and screen-reader users land in the new form, not at the top of the page.
  useEffect(() => {
    if (!focusNameNext.current) return;
    focusNameNext.current = false;
    document.getElementById(id("name"))?.focus();
  }, [dismissedSeq]);

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    // Runs before React collects the action's FormData: record how long the form was on screen (browser clock
    // only) and keep a copy of the draft in case the request never reaches the server.
    if (fillRef.current) {
      fillRef.current.value = String(Math.round(performance.now() - shownAt.current));
    }
    onDraft?.(readDraft(e.currentTarget));
  };

  const describedBy = (f: InquiryField, hint?: boolean) =>
    errors[f] ? `${id(f)}-error` : hint ? `${id(f)}-hint` : undefined;

  // Accepted requests render the confirmation panel below; once it is dismissed nothing lingers.
  const outcome =
    state.status === "idle" || state.status === "sent" || state.status === "test_sent"
      ? null
      : FORM.status[state.status];

  if (succeeded) {
    const s = FORM.status[state.status as "sent" | "test_sent"];
    return (
      <div className="rounded-(--fbg-radius-dialog) border border-(--fbg-border-subtle) bg-(--fbg-bg-surface) p-6 sm:p-8">
        <div
          ref={statusRef}
          tabIndex={-1}
          role="status"
          className="flex flex-col items-start gap-4 outline-none"
        >
          <span
            className={cx(
              "flex h-11 w-11 items-center justify-center rounded-full",
              state.status === "sent"
                ? "bg-(--fbg-status-success-fill) text-(--fbg-status-success)"
                : "bg-(--fbg-status-warning-fill) text-(--fbg-status-warning)",
            )}
          >
            <Icon name={state.status === "sent" ? "check" : "info"} size={20} />
          </span>
          <div>
            <p className="text-[19px] font-semibold text-(--fbg-text-primary)">{s.title}</p>
            <p className="mt-1 text-[15px] text-(--fbg-text-secondary)">{s.body}</p>
          </div>
          <button
            type="button"
            className={buttonClasses("secondary", "md")}
            onClick={() => {
              shownAt.current = performance.now();
              focusNameNext.current = true;
              setMessageLength(0);
              setDismissedSeq(state.seq);
            }}
          >
            Send another request
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      // Remount per server response: React resets a form after its action, and a <select> does not pick up
      // a changed defaultValue, so a fresh mount is the reliable way to restore every echoed value.
      key={`${state.seq}:${dismissedSeq}`}
      action={formAction}
      onSubmit={onSubmit}
      aria-labelledby={id("title")}
      className="rounded-(--fbg-radius-dialog) border border-(--fbg-border-subtle) bg-(--fbg-bg-surface) p-5 shadow-(--fbg-shadow-raised) sm:p-8"
    >
      <h3 id={id("title")} className="text-[19px] font-semibold text-(--fbg-text-primary)">
        {FORM.title}
      </h3>

      <div className="mt-4 flex flex-col gap-3">
        {closed ? (
          <Notice tone="neutral" icon="lock" title={FORM.closedTitle}>
            {FORM.closedBody}
          </Notice>
        ) : null}
        {mode === "dry_run" ? (
          <Notice tone="warn" title={FORM.testModeTitle}>
            {FORM.testModeBody}
          </Notice>
        ) : null}
        <div ref={statusRef} tabIndex={-1} className="outline-none">
          {outcome ? (
            <Notice tone={state.status === "invalid" ? "warn" : "danger"} title={outcome.title}>
              {outcome.body}
            </Notice>
          ) : null}
        </div>
      </div>

      <fieldset disabled={closed || pending} className="mt-5 grid min-w-0 gap-5 sm:grid-cols-2">
        <legend className="fbg-sr-only">{FORM.title}</legend>

        <Field label={FORM.name} htmlFor={id("name")} required error={errors.name}>
          <TextInput
            id={id("name")}
            name="name"
            autoComplete="name"
            required
            maxLength={INQUIRY_LIMITS.name}
            defaultValue={values.name}
            className={CONTROL_BORDER}
            aria-invalid={errors.name ? true : undefined}
            aria-describedby={describedBy("name")}
          />
        </Field>

        <Field label={FORM.email} htmlFor={id("email")} required error={errors.email}>
          <TextInput
            id={id("email")}
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            maxLength={INQUIRY_LIMITS.email}
            defaultValue={values.email}
            className={CONTROL_BORDER}
            aria-invalid={errors.email ? true : undefined}
            aria-describedby={describedBy("email")}
          />
        </Field>

        <Field label={FORM.company} htmlFor={id("company")} required error={errors.company}>
          <TextInput
            id={id("company")}
            name="company"
            autoComplete="organization"
            required
            maxLength={INQUIRY_LIMITS.company}
            defaultValue={values.company}
            className={CONTROL_BORDER}
            aria-invalid={errors.company ? true : undefined}
            aria-describedby={describedBy("company")}
          />
        </Field>

        <Field
          label={FORM.productFamily}
          htmlFor={id("productFamily")}
          required
          error={errors.productFamily}
        >
          <Select
            id={id("productFamily")}
            name="productFamily"
            required
            defaultValue={values.productFamily ?? ""}
            className={CONTROL_BORDER}
            aria-invalid={errors.productFamily ? true : undefined}
            aria-describedby={describedBy("productFamily")}
          >
            <option value="" disabled>
              {FORM.productFamilyPlaceholder}
            </option>
            {PRODUCT_FAMILIES.map((f) => (
              <option key={f} value={f}>
                {PRODUCT_FAMILY_LABEL[f]}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label={FORM.quantity}
          htmlFor={id("quantity")}
          hint={FORM.quantityHint}
          error={errors.quantity}
          className="sm:col-span-2"
        >
          <TextInput
            id={id("quantity")}
            name="quantity"
            maxLength={INQUIRY_LIMITS.quantity}
            defaultValue={values.quantity}
            className={CONTROL_BORDER}
            aria-invalid={errors.quantity ? true : undefined}
            aria-describedby={describedBy("quantity", true)}
          />
        </Field>

        <Field
          label={FORM.message}
          htmlFor={id("message")}
          required
          hint={FORM.messageHint}
          error={errors.message}
          className="sm:col-span-2"
        >
          <TextArea
            id={id("message")}
            name="message"
            required
            rows={5}
            minLength={INQUIRY_LIMITS.messageMin}
            maxLength={INQUIRY_LIMITS.messageMax}
            defaultValue={values.message}
            className={CONTROL_BORDER}
            onInput={(e) => setMessageLength(e.currentTarget.value.length)}
            aria-invalid={errors.message ? true : undefined}
            aria-describedby={cx(describedBy("message", true), `${id("message")}-count`)}
          />
          <p
            id={`${id("message")}-count`}
            className="fbg-num -mt-0.5 text-right text-xs text-(--fbg-text-muted)"
          >
            {messageLength.toLocaleString("en-US")} /{" "}
            {INQUIRY_LIMITS.messageMax.toLocaleString("en-US")}
            <span className="fbg-sr-only"> characters</span>
          </p>
        </Field>

        <div className="sm:col-span-2">
          <label
            htmlFor={id("consent")}
            className="flex cursor-pointer items-start gap-3 rounded-(--fbg-radius-control) border border-(--fbg-border-strong) bg-(--fbg-bg-canvas) p-3.5"
          >
            <input
              id={id("consent")}
              name="consent"
              type="checkbox"
              value="yes"
              required
              defaultChecked={values.consent === "yes"}
              aria-invalid={errors.consent ? true : undefined}
              aria-describedby={errors.consent ? `${id("consent")}-error` : undefined}
              className="mt-0.5 h-4.5 w-4.5 shrink-0 accent-(--fbg-action-primary)"
            />
            <span className="text-[15px] text-(--fbg-text-primary)">
              {FORM.consent}
              <span className="text-(--fbg-status-danger)" aria-hidden>
                {" "}
                *
              </span>
            </span>
          </label>
          {errors.consent ? (
            <p
              id={`${id("consent")}-error`}
              className="mt-1.5 flex items-center gap-1 text-xs text-(--fbg-status-danger)"
            >
              <Icon name="alert" size={12} /> {errors.consent}
            </p>
          ) : null}
        </div>

        {/* Bot heuristics. The honeypot is invisible and unreachable for people; bots fill it. */}
        <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
          <label htmlFor={id("gotcha")}>Leave this field empty</label>
          <input id={id("gotcha")} name="_gotcha" type="text" tabIndex={-1} autoComplete="off" />
        </div>
        <input ref={fillRef} type="hidden" name="fillMs" defaultValue="" />
        <input type="hidden" name="submissionId" value={submissionId} />

        <div className="flex flex-col gap-3 sm:col-span-2">
          <p className="flex gap-2 text-[13px] text-(--fbg-text-secondary)">
            <Icon name="lock" size={14} className="mt-0.5 shrink-0" />
            <span>
              {FORM.confidentiality} {FORM.privacy}
            </span>
          </p>
          <Button
            type="submit"
            variant="primary"
            size="lg"
            loading={pending}
            className="w-full sm:w-auto sm:self-start"
          >
            {pending ? FORM.submitting : FORM.submit}
          </Button>
        </div>
      </fieldset>
    </form>
  );
}
