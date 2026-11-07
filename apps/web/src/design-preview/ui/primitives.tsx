/**
 * Design-system primitives — Atlas × Obsidian V1.
 *
 * Every component maps to docs/UX_INFORMATION_ARCHITECTURE.md §3 (BadgeWithEvidence, FreshnessChip, StatusLine,
 * Wizard stepper …) and docs/design/atlas-obsidian/COMPONENTS_AND_INTERACTIONS.md. Colors come only from the
 * semantic token layer in ../design-preview.css (legacy utility names such as `text-ink` are mapped onto it),
 * so every component renders correctly in both themes. Nothing here fetches data.
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

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "brand";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant | undefined;
  size?: ButtonSize | undefined;
  icon?: IconName | undefined;
  iconRight?: IconName | undefined;
  loading?: boolean | undefined;
}

const BUTTON_VARIANT: Record<ButtonVariant, string> = {
  primary:
    "bg-(--fbg-action-primary) text-(--fbg-action-on-primary) hover:bg-(--fbg-action-primary-hover) active:bg-(--fbg-action-primary-pressed) disabled:bg-(--fbg-disabled-bg) disabled:text-(--fbg-disabled-fg)",
  secondary:
    "border border-(--fbg-border-strong)/60 bg-(--fbg-bg-surface) text-(--fbg-text-primary) hover:bg-(--fbg-hover) active:bg-(--fbg-pressed) disabled:border-(--fbg-border-subtle) disabled:text-(--fbg-disabled-fg)",
  ghost:
    "text-(--fbg-text-primary) hover:bg-(--fbg-hover) active:bg-(--fbg-pressed) disabled:text-(--fbg-disabled-fg)",
  danger:
    "border border-(--fbg-status-danger)/50 bg-(--fbg-bg-surface) text-(--fbg-status-danger) hover:bg-(--fbg-status-danger-fill) disabled:text-(--fbg-disabled-fg)",
  brand:
    "bg-(--fbg-brand-accent) text-(--fbg-text-inverse) hover:opacity-90 disabled:bg-(--fbg-disabled-bg) disabled:text-(--fbg-disabled-fg)",
};

const BUTTON_SIZE: Record<ButtonSize, string> = {
  sm: "h-(--fbg-control-h-sm) px-3.5 text-sm gap-1.5",
  md: "h-(--fbg-control-h) px-5 text-[15px] gap-2",
  lg: "h-12 px-6 text-base gap-2",
};

export function buttonClasses(variant: ButtonVariant = "secondary", size: ButtonSize = "md") {
  return cx(
    "inline-flex shrink-0 items-center justify-center rounded-(--fbg-radius-control) font-medium whitespace-nowrap disabled:cursor-not-allowed",
    BUTTON_VARIANT[variant],
    BUTTON_SIZE[size],
  );
}

export function Button({
  variant = "secondary",
  size = "md",
  icon,
  iconRight,
  loading,
  className,
  children,
  type = "button",
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cx(buttonClasses(variant, size), className)}
      {...rest}
    >
      {loading ? (
        <span
          aria-hidden
          className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      ) : icon ? (
        <Icon name={icon} size={size === "sm" ? 14 : 16} />
      ) : null}
      {children}
      {iconRight && !loading ? <Icon name={iconRight} size={size === "sm" ? 14 : 16} /> : null}
    </button>
  );
}

/* ------------------------------------------------------------------------------------------------ */
/* Badges, chips, status                                                                               */
/* ------------------------------------------------------------------------------------------------ */

export type Tone = "neutral" | "teal" | "ok" | "warn" | "danger" | "ink" | "brand";

const TONE_SOFT: Record<Tone, string> = {
  neutral: "border-(--fbg-border-subtle) bg-(--fbg-bg-sunken) text-(--fbg-text-secondary)",
  teal: "border-(--fbg-status-info)/35 bg-(--fbg-status-info-fill) text-(--fbg-status-info)",
  ok: "border-(--fbg-status-success)/35 bg-(--fbg-status-success-fill) text-(--fbg-status-success)",
  warn: "border-(--fbg-status-warning)/40 bg-(--fbg-status-warning-fill) text-(--fbg-status-warning)",
  danger:
    "border-(--fbg-status-danger)/35 bg-(--fbg-status-danger-fill) text-(--fbg-status-danger)",
  ink: "border-(--fbg-text-primary)/20 bg-(--fbg-hover) text-(--fbg-text-primary)",
  brand: "border-(--fbg-brand-accent)/40 bg-(--fbg-brand-accent-subtle) text-(--fbg-brand-accent)",
};

const TONE_ICON: Record<Tone, IconName | null> = {
  neutral: null,
  teal: "check",
  ok: "check",
  warn: "alert",
  danger: "alert",
  ink: null,
  brand: null,
};

export interface BadgeProps {
  tone?: Tone | undefined;
  icon?: IconName | null | undefined;
  children: ReactNode;
  className?: string | undefined;
  title?: string | undefined;
}

/** Status is always conveyed by text + icon, never color alone. */
export function Badge({ tone = "neutral", icon, children, className, title }: BadgeProps) {
  const resolvedIcon = icon === undefined ? TONE_ICON[tone] : icon;
  return (
    <span
      title={title}
      className={cx(
        "inline-flex max-w-full items-center gap-1 rounded-(--fbg-radius-chip) border px-2 py-0.5 text-xs leading-4 font-medium",
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

export function FreshnessChip({
  kind,
  date,
  className,
}: {
  kind: Freshness;
  date: string;
  className?: string | undefined;
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

export function StatusChip({
  status,
  className,
}: {
  status: CostLineStatus;
  className?: string | undefined;
}) {
  return (
    <Badge tone={LINE_TONE[status]} icon={LINE_ICON[status]} className={className}>
      {LINE_LABEL[status]}
    </Badge>
  );
}

/** Quote status tags: the fixed terminology from docs/UX_INFORMATION_ARCHITECTURE.md §4. */
export type QuoteTag =
  | "indicative_listing"
  | "supplier_catalog_price"
  | "factory_confirmed_quote"
  | "quote_expired"
  | "validity_unconfirmed"
  | "internal_observation";

const QUOTE_TAG: Record<QuoteTag, { label: string; tone: Tone; icon: IconName | null }> = {
  indicative_listing: { label: "Indicative listing", tone: "neutral", icon: "eye" },
  supplier_catalog_price: { label: "Supplier catalog price", tone: "ink", icon: "list" },
  factory_confirmed_quote: { label: "Factory-confirmed quote", tone: "teal", icon: "check" },
  quote_expired: { label: "Quote expired", tone: "danger", icon: "clock" },
  validity_unconfirmed: { label: "Validity unconfirmed", tone: "warn", icon: "alert" },
  internal_observation: {
    label: "Internal research reference — not a supplier offer",
    tone: "brand",
    icon: "lock",
  },
};

export function QuoteStatusTag({ kind }: { kind: QuoteTag }) {
  const t = QUOTE_TAG[kind];
  return (
    <Badge tone={t.tone} icon={t.icon}>
      {t.label}
    </Badge>
  );
}

export interface EvidenceRecord {
  what: string;
  who: string;
  when: string;
  until?: string | undefined;
  scope?: string | undefined;
  note?: string | undefined;
}

/**
 * BadgeWithEvidence: badge text is derived from check rows; the popover shows what / who / when / until / scope.
 * Rendered with <details> so it works without JavaScript and with the keyboard.
 */
export function EvidenceBadge({
  label,
  tone = "ok",
  evidence,
}: {
  label: string;
  tone?: Tone | undefined;
  evidence: EvidenceRecord;
}) {
  return (
    <details className="group relative inline-block">
      <summary className="list-none cursor-pointer rounded-(--fbg-radius-chip) [&::-webkit-details-marker]:hidden">
        <Badge
          tone={tone}
          icon="shield"
          className="group-open:ring-2 group-open:ring-(--fbg-focus-ring)/40"
        >
          {label}
        </Badge>
      </summary>
      <div
        role="note"
        className="fbg-raised absolute left-0 z-20 mt-1.5 w-80 rounded-(--fbg-radius-card) border border-(--fbg-border-subtle) p-3.5 text-sm"
      >
        <dl className="grid grid-cols-[72px_1fr] gap-x-2 gap-y-1">
          <dt className="text-(--fbg-text-secondary)">Checked</dt>
          <dd className="text-(--fbg-text-primary)">{evidence.what}</dd>
          <dt className="text-(--fbg-text-secondary)">By</dt>
          <dd className="text-(--fbg-text-primary)">{evidence.who}</dd>
          <dt className="text-(--fbg-text-secondary)">On</dt>
          <dd className="fbg-num text-(--fbg-text-primary)">{evidence.when}</dd>
          {evidence.until ? (
            <>
              <dt className="text-(--fbg-text-secondary)">Until</dt>
              <dd className="fbg-num text-(--fbg-text-primary)">{evidence.until}</dd>
            </>
          ) : null}
          {evidence.scope ? (
            <>
              <dt className="text-(--fbg-text-secondary)">Scope</dt>
              <dd className="text-(--fbg-text-primary)">{evidence.scope}</dd>
            </>
          ) : null}
        </dl>
        {evidence.note ? <p className="mt-2 text-(--fbg-text-secondary)">{evidence.note}</p> : null}
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
  raised = false,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string | undefined;
  padded?: boolean;
  raised?: boolean;
}) {
  return (
    <section
      className={cx(
        "min-w-0 rounded-(--fbg-radius-card) border border-(--fbg-border-subtle) bg-(--fbg-bg-surface)",
        raised && "fbg-raised",
        className,
      )}
    >
      {title || actions ? (
        <header className="flex flex-wrap items-start justify-between gap-2 border-b border-(--fbg-border-subtle) px-5 py-3.5">
          <div className="min-w-0">
            {title ? (
              <h2 className="text-lg font-semibold text-(--fbg-text-primary)">{title}</h2>
            ) : null}
            {description ? (
              <p className="mt-0.5 text-sm text-(--fbg-text-secondary)">{description}</p>
            ) : null}
          </div>
          {actions ? (
            <div className="flex min-w-0 max-w-full items-center gap-2">{actions}</div>
          ) : null}
        </header>
      ) : null}
      <div className={padded ? "p-5" : undefined}>{children}</div>
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
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        <h1 className="text-[28px] leading-tight font-semibold tracking-[-0.015em] text-(--fbg-text-primary) md:text-4xl">
          {title}
        </h1>
        {lead ? (
          <p className="mt-2 max-w-2xl text-base text-(--fbg-text-secondary)">{lead}</p>
        ) : null}
        {meta ? <div className="mt-3 flex flex-wrap items-center gap-2">{meta}</div> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function SectionTitle({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <div>
      <h2 className="text-[22px] leading-snug font-semibold tracking-[-0.01em] text-(--fbg-text-primary) md:text-[26px]">
        {children}
      </h2>
      {sub ? <p className="mt-1 max-w-2xl text-base text-(--fbg-text-secondary)">{sub}</p> : null}
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
          <dt className="text-xs text-(--fbg-text-secondary)">{item.label}</dt>
          <dd className="mt-0.5 text-sm text-(--fbg-text-primary)">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function EmptyState({
  title,
  body,
  action,
  icon = "folder",
}: {
  title: string;
  body: string;
  action?: ReactNode;
  icon?: IconName;
}) {
  return (
    <div className="rounded-(--fbg-radius-card) border border-dashed border-(--fbg-border-subtle) bg-(--fbg-bg-canvas) px-6 py-10 text-center">
      <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-(--fbg-accent-subtle) text-(--fbg-action-primary)">
        <Icon name={icon} size={18} />
      </span>
      <p className="mt-3 text-base font-medium text-(--fbg-text-primary)">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-(--fbg-text-secondary)">{body}</p>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div
      role="alert"
      className="rounded-(--fbg-radius-card) border border-(--fbg-status-danger)/40 bg-(--fbg-status-danger-fill) px-6 py-8 text-center"
    >
      <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-(--fbg-bg-surface) text-(--fbg-status-danger)">
        <Icon name="alert" size={18} />
      </span>
      <p className="mt-3 text-base font-medium text-(--fbg-text-primary)">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-(--fbg-text-secondary)">{body}</p>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function Skeleton({ className }: { className?: string | undefined }) {
  return <div aria-hidden className={cx("fbg-skeleton", className)} />;
}

/** Loading placeholder for a list or table region. */
export function SkeletonRows({ rows = 4 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Loading" className="flex flex-col gap-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Skeleton className="h-3.5 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
          </div>
          <Skeleton className="h-6 w-20" />
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------------------------------------ */
/* Tabs                                                                                               */
/* ------------------------------------------------------------------------------------------------ */

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  label,
}: {
  tabs: ReadonlyArray<{ value: T; label: ReactNode; count?: number | undefined }>;
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className="fbg-no-scrollbar flex gap-1 overflow-x-auto border-b border-(--fbg-border-subtle)"
    >
      {tabs.map((t) => {
        const active = t.value === value;
        return (
          <button
            key={t.value}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(t.value)}
            className={cx(
              "-mb-px inline-flex h-11 shrink-0 items-center gap-2 border-b-2 px-3 text-sm font-medium",
              active
                ? "border-(--fbg-action-primary) text-(--fbg-text-primary)"
                : "border-transparent text-(--fbg-text-secondary) hover:text-(--fbg-text-primary)",
            )}
          >
            {t.label}
            {t.count !== undefined ? (
              <span className="fbg-num rounded-full bg-(--fbg-hover) px-1.5 text-xs text-(--fbg-text-secondary)">
                {t.count}
              </span>
            ) : null}
          </button>
        );
      })}
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
    <div className={cx("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-sm font-medium text-(--fbg-text-primary)">
        {label}
        {required ? (
          <span className="text-(--fbg-status-danger)" aria-hidden>
            {" "}
            *
          </span>
        ) : (
          <span className="font-normal text-(--fbg-text-secondary)"> (optional)</span>
        )}
      </label>
      {children}
      {error ? (
        <p
          id={`${htmlFor}-error`}
          className="flex items-center gap-1 text-xs text-(--fbg-status-danger)"
        >
          <Icon name="alert" size={12} /> {error}
        </p>
      ) : hint ? (
        <p id={`${htmlFor}-hint`} className="text-xs text-(--fbg-text-secondary)">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

const CONTROL =
  "w-full rounded-(--fbg-radius-control) border border-(--fbg-border-strong)/60 bg-(--fbg-bg-surface) px-3.5 text-[15px] text-(--fbg-text-primary) placeholder:text-(--fbg-text-muted) hover:border-(--fbg-border-strong) disabled:bg-(--fbg-disabled-bg) disabled:text-(--fbg-disabled-fg) aria-[invalid=true]:border-(--fbg-status-danger)";

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  const { className, ...rest } = props;
  return <input className={cx(CONTROL, "h-(--fbg-control-h)", className)} {...rest} />;
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { className, ...rest } = props;
  return <textarea className={cx(CONTROL, "min-h-28 py-2.5", className)} {...rest} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  const { className, children, ...rest } = props;
  return (
    <div className="relative">
      <select
        className={cx(CONTROL, "h-(--fbg-control-h) appearance-none pr-10", className)}
        {...rest}
      >
        {children}
      </select>
      <Icon
        name="chevron-down"
        size={16}
        className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-(--fbg-text-secondary)"
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
  disabled?: boolean | undefined;
}) {
  return (
    <label
      htmlFor={id}
      className={cx(
        "flex min-h-(--fbg-control-h) cursor-pointer items-start gap-3 rounded-(--fbg-radius-control) border border-(--fbg-border-subtle) bg-(--fbg-bg-surface) p-3 hover:border-(--fbg-border-strong)",
        checked && "border-(--fbg-action-primary)/60 bg-(--fbg-selected)",
        disabled && "cursor-not-allowed opacity-60",
      )}
    >
      <input
        id={id}
        type="checkbox"
        className="mt-0.5 h-4.5 w-4.5 shrink-0 accent-(--fbg-action-primary)"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="min-w-0">
        <span className="block text-[15px] font-medium text-(--fbg-text-primary)">{label}</span>
        {description ? (
          <span className="block text-sm text-(--fbg-text-secondary)">{description}</span>
        ) : null}
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
      className="fbg-no-scrollbar inline-flex max-w-full overflow-x-auto rounded-(--fbg-radius-control) border border-(--fbg-border-subtle) bg-(--fbg-bg-sunken) p-0.5"
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
              "rounded-[7px] px-3 font-medium whitespace-nowrap",
              size === "sm" ? "h-8 text-xs" : "h-9 text-sm",
              active
                ? "bg-(--fbg-bg-inverse) text-(--fbg-text-inverse)"
                : "text-(--fbg-text-secondary) hover:text-(--fbg-text-primary)",
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
      className="fbg-no-scrollbar flex gap-1 overflow-x-auto lg:flex-col lg:gap-0"
      aria-label="Steps"
    >
      {steps.map((step, i) => {
        const isCurrent = i === current;
        const isDone = completed.has(i);
        const reachable = isDone || i <= current || completed.has(i - 1);
        return (
          <li key={step.id} className="min-w-[10rem] shrink-0 lg:min-w-0">
            <button
              type="button"
              onClick={() => reachable && onSelect(i)}
              disabled={!reachable}
              aria-current={isCurrent ? "step" : undefined}
              className={cx(
                "flex w-full items-start gap-3 rounded-(--fbg-radius-control) px-3 py-2.5 text-left disabled:cursor-not-allowed",
                isCurrent
                  ? "border border-(--fbg-border-subtle) bg-(--fbg-bg-surface)"
                  : "hover:bg-(--fbg-hover)",
              )}
            >
              <span
                className={cx(
                  "fbg-num mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                  isDone
                    ? "border-(--fbg-action-primary) bg-(--fbg-action-primary) text-(--fbg-action-on-primary)"
                    : isCurrent
                      ? "border-(--fbg-bg-inverse) bg-(--fbg-bg-inverse) text-(--fbg-text-inverse)"
                      : "border-(--fbg-border-strong)/60 text-(--fbg-text-secondary)",
                )}
              >
                {isDone ? <Icon name="check" size={12} /> : i + 1}
              </span>
              <span className="min-w-0">
                <span
                  className={cx(
                    "block text-sm font-medium",
                    isCurrent ? "text-(--fbg-text-primary)" : "text-(--fbg-text-secondary)",
                  )}
                >
                  {step.title}
                </span>
                {step.summary ? (
                  <span className="hidden text-xs text-(--fbg-text-secondary) lg:block">
                    {step.summary}
                  </span>
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
  action,
}: {
  tone?: Tone | undefined;
  title?: ReactNode;
  children?: ReactNode;
  icon?: IconName | undefined;
  action?: ReactNode;
}) {
  const resolvedIcon = icon ?? (tone === "warn" || tone === "danger" ? "alert" : "info");
  return (
    <div
      role={tone === "danger" ? "alert" : undefined}
      className={cx("flex gap-3 rounded-(--fbg-radius-card) border p-3.5 text-sm", TONE_SOFT[tone])}
    >
      <Icon name={resolvedIcon} size={16} className="mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1 text-(--fbg-text-primary)">
        {title ? <p className="font-medium">{title}</p> : null}
        {children ? (
          <div className={cx(title ? "mt-0.5" : null, "text-(--fbg-text-secondary)")}>
            {children}
          </div>
        ) : null}
        {action ? <div className="mt-2">{action}</div> : null}
      </div>
    </div>
  );
}
