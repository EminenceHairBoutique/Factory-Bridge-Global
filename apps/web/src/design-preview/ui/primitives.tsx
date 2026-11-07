/**
 * Design-system primitives for the UX-01 prototypes.
 *
 * Every component maps to a row of docs/UX_INFORMATION_ARCHITECTURE.md §3 (BadgeWithEvidence, FreshnessChip,
 * StatusLine, Wizard stepper …) and uses only the shared theme tokens. Nothing here fetches data.
 */
import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { Icon, type IconName } from "./icons";

export function cx(...parts: Array<string | number | boolean | null | undefined>): string {
  return parts.filter((p): p is string => typeof p === "string" && p.length > 0).join(" ");
}

/* ------------------------------------------------------------------------------------------------ */
/* Buttons                                                                                            */
/* ------------------------------------------------------------------------------------------------ */

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  iconRight?: IconName;
}

const BUTTON_VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-accent text-white hover:bg-accent/90 disabled:bg-accent/40",
  secondary:
    "border border-line bg-surface text-ink hover:border-ink/30 hover:bg-paper disabled:text-slate/50",
  ghost: "text-ink hover:bg-ink/5 disabled:text-slate/50",
  danger: "border border-danger/40 bg-surface text-danger hover:bg-danger/5",
};

const BUTTON_SIZE: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-[13px] gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
};

export function Button({
  variant = "secondary",
  size = "md",
  icon,
  iconRight,
  className,
  children,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cx(
        "inline-flex shrink-0 items-center justify-center rounded-md font-medium whitespace-nowrap disabled:cursor-not-allowed",
        BUTTON_VARIANT[variant],
        BUTTON_SIZE[size],
        className,
      )}
      {...rest}
    >
      {icon ? <Icon name={icon} size={size === "sm" ? 14 : 16} /> : null}
      {children}
      {iconRight ? <Icon name={iconRight} size={size === "sm" ? 14 : 16} /> : null}
    </button>
  );
}

/* ------------------------------------------------------------------------------------------------ */
/* Badges, chips, status                                                                               */
/* ------------------------------------------------------------------------------------------------ */

export type Tone = "neutral" | "teal" | "ok" | "warn" | "danger" | "ink";

const TONE_SOFT: Record<Tone, string> = {
  neutral: "border-line bg-paper text-slate",
  teal: "border-teal/30 bg-teal/10 text-teal",
  ok: "border-ok/30 bg-ok/10 text-ok",
  warn: "border-warn/40 bg-warn/10 text-warn",
  danger: "border-danger/30 bg-danger/10 text-danger",
  ink: "border-ink/20 bg-ink/5 text-ink",
};

const TONE_ICON: Record<Tone, IconName | null> = {
  neutral: null,
  teal: "check",
  ok: "check",
  warn: "alert",
  danger: "alert",
  ink: null,
};

export interface BadgeProps {
  tone?: Tone | undefined;
  icon?: IconName | null | undefined;
  children: ReactNode;
  className?: string | undefined;
  title?: string | undefined;
}

/** Status is always conveyed by text + icon, never color alone (IA §4). */
export function Badge({ tone = "neutral", icon, children, className, title }: BadgeProps) {
  const resolvedIcon = icon === undefined ? TONE_ICON[tone] : icon;
  return (
    <span
      title={title}
      className={cx(
        "inline-flex max-w-full items-center gap-1 rounded border px-1.5 py-0.5 text-[12px] leading-4 font-medium",
        TONE_SOFT[tone],
        className,
      )}
    >
      {resolvedIcon ? <Icon name={resolvedIcon} size={12} /> : null}
      <span className="truncate">{children}</span>
    </span>
  );
}

export type Freshness = "observed" | "updated" | "confirmed" | "valid_until" | "expired";

const FRESHNESS_LABEL: Record<Freshness, string> = {
  observed: "Observed",
  updated: "Updated",
  confirmed: "Confirmed",
  valid_until: "Valid until",
  expired: "Expired",
};

const FRESHNESS_TONE: Record<Freshness, Tone> = {
  observed: "neutral",
  updated: "neutral",
  confirmed: "teal",
  valid_until: "neutral",
  expired: "danger",
};

/** `observed` / `updated` / `confirmed` / `valid until` / `expired` with a date (IA §3 FreshnessChip). */
export function FreshnessChip({
  kind,
  date,
  className,
}: {
  kind: Freshness;
  date: string;
  className?: string;
}) {
  return (
    <Badge tone={FRESHNESS_TONE[kind]} icon="clock" className={cx("fbg-num", className)}>
      {FRESHNESS_LABEL[kind]} {date}
    </Badge>
  );
}

export type CostLineStatus = "sourced" | "estimated" | "missing" | "not_applicable";

const LINE_LABEL: Record<CostLineStatus, string> = {
  sourced: "Sourced",
  estimated: "Estimated",
  missing: "Missing — request",
  not_applicable: "Included in trade term",
};

const LINE_TONE: Record<CostLineStatus, Tone> = {
  sourced: "teal",
  estimated: "warn",
  missing: "danger",
  not_applicable: "neutral",
};

const LINE_ICON: Record<CostLineStatus, IconName> = {
  sourced: "check",
  estimated: "info",
  missing: "alert",
  not_applicable: "check",
};

/** Cost-line status chip. Labels are the fixed strings from `@fbg/i18n` (`status.*`). */
export function StatusChip({ status, className }: { status: CostLineStatus; className?: string }) {
  return (
    <Badge tone={LINE_TONE[status]} icon={LINE_ICON[status]} className={className}>
      {LINE_LABEL[status]}
    </Badge>
  );
}

export interface EvidenceRecord {
  what: string;
  who: string;
  when: string;
  until?: string;
  note?: string;
}

/**
 * BadgeWithEvidence: the badge text is derived from check rows; the popover shows what / who / when / until.
 * Rendered with <details> so it works without JavaScript and with the keyboard.
 */
export function EvidenceBadge({
  label,
  tone = "ok",
  evidence,
}: {
  label: string;
  tone?: Tone;
  evidence: EvidenceRecord;
}) {
  return (
    <details className="group relative inline-block">
      <summary className="list-none cursor-pointer rounded [&::-webkit-details-marker]:hidden">
        <Badge tone={tone} icon="shield" className="group-open:ring-2 group-open:ring-accent/40">
          {label}
        </Badge>
      </summary>
      <div
        role="note"
        className="absolute left-0 z-20 mt-1 w-72 rounded-md border border-line bg-surface p-3 text-[13px] shadow-sm"
      >
        <dl className="grid grid-cols-[64px_1fr] gap-x-2 gap-y-1">
          <dt className="text-slate">Checked</dt>
          <dd className="text-ink">{evidence.what}</dd>
          <dt className="text-slate">By</dt>
          <dd className="text-ink">{evidence.who}</dd>
          <dt className="text-slate">On</dt>
          <dd className="fbg-num text-ink">{evidence.when}</dd>
          {evidence.until ? (
            <>
              <dt className="text-slate">Until</dt>
              <dd className="fbg-num text-ink">{evidence.until}</dd>
            </>
          ) : null}
        </dl>
        {evidence.note ? <p className="mt-2 text-slate">{evidence.note}</p> : null}
      </div>
    </details>
  );
}

/* ------------------------------------------------------------------------------------------------ */
/* Layout                                                                                             */
/* ------------------------------------------------------------------------------------------------ */

export function Panel({
  title,
  description,
  actions,
  children,
  className,
  padded = true,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <section className={cx("min-w-0 rounded-md border border-line bg-surface", className)}>
      {title || actions ? (
        <header className="flex flex-wrap items-start justify-between gap-2 border-b border-line px-4 py-3">
          <div className="min-w-0">
            {title ? <h2 className="text-[15px] font-semibold text-ink">{title}</h2> : null}
            {description ? <p className="mt-0.5 text-[13px] text-slate">{description}</p> : null}
          </div>
          {actions ? (
            <div className="flex min-w-0 max-w-full items-center gap-2">{actions}</div>
          ) : null}
        </header>
      ) : null}
      <div className={padded ? "p-4" : undefined}>{children}</div>
    </section>
  );
}

export function PageHeader({
  title,
  lead,
  meta,
  actions,
}: {
  title: ReactNode;
  lead?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-[-0.01em] text-ink">{title}</h1>
        {lead ? <p className="mt-1 max-w-2xl text-[15px] text-slate">{lead}</p> : null}
        {meta ? <div className="mt-2 flex flex-wrap items-center gap-2">{meta}</div> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function KeyValue({
  items,
  columns = 2,
}: {
  items: Array<{ label: string; value: ReactNode }>;
  columns?: 1 | 2 | 3;
}) {
  return (
    <dl
      className={cx(
        "grid gap-x-6 gap-y-3",
        columns === 1 && "grid-cols-1",
        columns === 2 && "grid-cols-1 sm:grid-cols-2",
        columns === 3 && "grid-cols-1 sm:grid-cols-3",
      )}
    >
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <dt className="text-[12px] text-slate">{item.label}</dt>
          <dd className="mt-0.5 text-sm text-ink">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-md border border-dashed border-line bg-paper px-6 py-10 text-center">
      <p className="text-sm font-medium text-ink">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-[13px] text-slate">{body}</p>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

/* ------------------------------------------------------------------------------------------------ */
/* Forms                                                                                              */
/* ------------------------------------------------------------------------------------------------ */

export function Field({
  label,
  hint,
  error,
  required,
  htmlFor,
  children,
  className,
}: {
  label: string;
  hint?: ReactNode;
  error?: string | undefined;
  required?: boolean | undefined;
  htmlFor: string;
  children: ReactNode;
  className?: string | undefined;
}) {
  return (
    <div className={cx("flex flex-col gap-1", className)}>
      <label htmlFor={htmlFor} className="text-[13px] font-medium text-ink">
        {label}
        {required ? (
          <span className="text-danger" aria-hidden>
            {" "}
            *
          </span>
        ) : (
          <span className="text-slate"> (optional)</span>
        )}
      </label>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} className="flex items-center gap-1 text-[12px] text-danger">
          <Icon name="alert" size={12} /> {error}
        </p>
      ) : hint ? (
        <p id={`${htmlFor}-hint`} className="text-[12px] text-slate">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

const CONTROL =
  "w-full rounded-md border border-line bg-surface px-3 text-sm text-ink placeholder:text-slate/60 hover:border-ink/30 disabled:bg-paper disabled:text-slate aria-[invalid=true]:border-danger";

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  const { className, ...rest } = props;
  return <input className={cx(CONTROL, "h-10", className)} {...rest} />;
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { className, ...rest } = props;
  return <textarea className={cx(CONTROL, "min-h-24 py-2", className)} {...rest} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  const { className, children, ...rest } = props;
  return (
    <div className="relative">
      <select className={cx(CONTROL, "h-10 appearance-none pr-9", className)} {...rest}>
        {children}
      </select>
      <Icon
        name="chevron-down"
        size={16}
        className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-slate"
      />
    </div>
  );
}

export function Checkbox({
  id,
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  id: string;
  label: ReactNode;
  description?: ReactNode;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label
      htmlFor={id}
      className={cx(
        "flex cursor-pointer items-start gap-3 rounded-md border border-line bg-surface p-3 hover:border-ink/30",
        checked && "border-teal/50 bg-teal/5",
        disabled && "cursor-not-allowed opacity-60",
      )}
    >
      <input
        id={id}
        type="checkbox"
        className="mt-0.5 h-4 w-4 shrink-0 accent-teal"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="min-w-0">
        <span className="block text-sm font-medium text-ink">{label}</span>
        {description ? <span className="block text-[12px] text-slate">{description}</span> : null}
      </span>
    </label>
  );
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
  size = "md",
}: {
  options: ReadonlyArray<{ value: T; label: ReactNode }>;
  value: T;
  onChange: (value: T) => void;
  label: string;
  size?: "sm" | "md";
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex max-w-full overflow-x-auto rounded-md border border-line bg-paper p-0.5"
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.value)}
            className={cx(
              "rounded px-3 font-medium whitespace-nowrap",
              size === "sm" ? "h-7 text-[12px]" : "h-8 text-[13px]",
              active ? "bg-ink text-white" : "text-slate hover:text-ink",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------------------------------------ */
/* Wizard stepper                                                                                     */
/* ------------------------------------------------------------------------------------------------ */

export interface StepDef {
  id: string;
  title: string;
  summary?: string;
}

export function Stepper({
  steps,
  current,
  completed,
  onSelect,
}: {
  steps: readonly StepDef[];
  current: number;
  completed: ReadonlySet<number>;
  onSelect: (index: number) => void;
}) {
  return (
    <ol
      className="flex gap-1 overflow-x-auto fbg-no-scrollbar lg:flex-col lg:gap-0"
      aria-label="Steps"
    >
      {steps.map((step, i) => {
        const isCurrent = i === current;
        const isDone = completed.has(i);
        const reachable = isDone || i <= current || completed.has(i - 1);
        return (
          <li key={step.id} className="min-w-[9rem] shrink-0 lg:min-w-0">
            <button
              type="button"
              onClick={() => reachable && onSelect(i)}
              disabled={!reachable}
              aria-current={isCurrent ? "step" : undefined}
              className={cx(
                "flex w-full items-start gap-3 rounded-md px-3 py-2 text-left disabled:cursor-not-allowed",
                isCurrent ? "bg-surface border border-line" : "hover:bg-ink/5",
              )}
            >
              <span
                className={cx(
                  "fbg-num mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[12px] font-semibold",
                  isDone
                    ? "border-teal bg-teal text-white"
                    : isCurrent
                      ? "border-ink bg-ink text-white"
                      : "border-line text-slate",
                )}
              >
                {isDone ? <Icon name="check" size={12} /> : i + 1}
              </span>
              <span className="min-w-0">
                <span
                  className={cx(
                    "block text-[13px] font-medium",
                    isCurrent ? "text-ink" : "text-slate",
                  )}
                >
                  {step.title}
                </span>
                {step.summary ? (
                  <span className="hidden text-[12px] text-slate lg:block">{step.summary}</span>
                ) : null}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

/* ------------------------------------------------------------------------------------------------ */
/* Notices                                                                                            */
/* ------------------------------------------------------------------------------------------------ */

export function Notice({
  tone = "neutral",
  title,
  children,
  icon,
}: {
  tone?: Tone;
  title?: ReactNode;
  children?: ReactNode;
  icon?: IconName;
}) {
  const resolvedIcon = icon ?? (tone === "warn" || tone === "danger" ? "alert" : "info");
  return (
    <div className={cx("flex gap-3 rounded-md border p-3 text-[13px]", TONE_SOFT[tone])}>
      <Icon name={resolvedIcon} size={16} className="mt-0.5 shrink-0" />
      <div className="min-w-0 text-ink">
        {title ? <p className="font-medium">{title}</p> : null}
        {children ? (
          <div className={cx(title ? "mt-0.5" : null, "text-slate")}>{children}</div>
        ) : null}
      </div>
    </div>
  );
}
