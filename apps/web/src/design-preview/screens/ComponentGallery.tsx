"use client";

/**
 * Component gallery — Atlas × Obsidian V1 (Preview 5).
 * Renders every primitive in both themes side by side, plus empty / loading / error states. Local state only.
 */
import Link from "next/link";
import { useState } from "react";
import { ThemeScope, type ThemeChoice } from "../theme";
import { AppearanceSwitch, BrandMark, DemoStripe } from "../ui/AppShell";
import { Icon } from "../ui/icons";
import {
  Badge,
  Button,
  Checkbox,
  EmptyState,
  ErrorState,
  EvidenceBadge,
  Field,
  FreshnessChip,
  Notice,
  Panel,
  QuoteStatusTag,
  SegmentedControl,
  Select,
  SkeletonRows,
  StatusChip,
  Stepper,
  Tabs,
  TextArea,
  TextInput,
  buttonClasses,
  cx,
} from "../ui/primitives";

const SWATCHES: Array<{ token: string; label: string }> = [
  { token: "--fbg-bg-canvas", label: "Canvas" },
  { token: "--fbg-bg-surface", label: "Surface" },
  { token: "--fbg-bg-raised", label: "Raised" },
  { token: "--fbg-text-primary", label: "Text primary" },
  { token: "--fbg-text-secondary", label: "Text secondary" },
  { token: "--fbg-border-subtle", label: "Border subtle" },
  { token: "--fbg-action-primary", label: "Action" },
  { token: "--fbg-brand-accent", label: "Brand accent" },
  { token: "--fbg-status-success", label: "Success" },
  { token: "--fbg-status-warning", label: "Warning" },
  { token: "--fbg-status-danger", label: "Danger" },
  { token: "--fbg-status-info", label: "Info" },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold text-(--fbg-text-primary)">{title}</h2>
      {children}
    </section>
  );
}

function GalleryBody({ label }: { label: string }) {
  const [tab, setTab] = useState<"overview" | "quotes" | "documents">("quotes");
  const [seg, setSeg] = useState<"all" | "eligible">("all");
  const [checked, setChecked] = useState(true);
  const [state, setState] = useState<"empty" | "loading" | "error">("loading");

  return (
    <div className="flex flex-col gap-8 rounded-(--fbg-radius-card) border border-(--fbg-border-subtle) bg-(--fbg-bg-canvas) p-4 text-(--fbg-text-primary) sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold">{label}</p>
        <span className="flex items-center gap-2 text-xs text-(--fbg-text-secondary)">
          <BrandMark size={18} className="text-(--fbg-action-primary)" /> brand mark
        </span>
      </div>

      <Section title="Tokens">
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
          {SWATCHES.map((s) => (
            <li key={s.token} className="flex flex-col gap-1">
              <span
                className="h-10 rounded-(--fbg-radius-chip) border border-(--fbg-border-subtle)"
                style={{ background: `var(${s.token})` }}
                aria-hidden
              />
              <span className="text-xs text-(--fbg-text-secondary)">{s.label}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Buttons">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="primary">Start a sourcing request</Button>
          <Button>Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Reject document</Button>
          <Button variant="brand">Brand accent</Button>
          <Button variant="primary" disabled title="Disabled: operator approval missing">
            Send (needs approval)
          </Button>
          <Button variant="primary" loading>
            Saving
          </Button>
          <Button size="sm" icon="plus">
            Small
          </Button>
          <Link href="#" className={buttonClasses("secondary", "sm")}>
            Link as button
          </Link>
        </div>
      </Section>

      <Section title="Quote status tags and freshness">
        <div className="flex flex-wrap gap-2">
          <QuoteStatusTag kind="factory_confirmed_quote" />
          <QuoteStatusTag kind="supplier_catalog_price" />
          <QuoteStatusTag kind="indicative_listing" />
          <QuoteStatusTag kind="validity_unconfirmed" />
          <QuoteStatusTag kind="quote_expired" />
          <QuoteStatusTag kind="internal_observation" />
        </div>
        <div className="flex flex-wrap gap-2">
          <FreshnessChip kind="observed" date="2026-11-03" />
          <FreshnessChip kind="updated" date="2026-11-05" />
          <FreshnessChip kind="confirmed" date="2026-11-06" />
          <FreshnessChip kind="valid_until" date="2026-12-15" />
          <FreshnessChip kind="expired" date="2026-10-31" />
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusChip status="sourced" />
          <StatusChip status="estimated" />
          <StatusChip status="missing" />
          <StatusChip status="not_applicable" />
          <Badge tone="ink" icon={null}>
            3
          </Badge>
        </div>
      </Section>

      <Section title="Evidence badge (what, who, when, until, scope)">
        <div className="flex flex-wrap gap-2">
          <EvidenceBadge
            label="Identity reviewed (2026-10-20)"
            evidence={{
              what: "Business licence matched to legal name; representative confirmed by video call",
              who: "Operator (demo)",
              when: "2026-10-20",
              until: "2027-10-20",
              scope: "Legal identity only. Not a product test or batch inspection.",
            }}
          />
          <EvidenceBadge
            label="Sample approved for variant"
            tone="teal"
            evidence={{
              what: "Golden sample for 50 × 76 mm matte BOPP",
              who: "Demo Buyer Co.",
              when: "2026-10-28",
              scope: "This variant only.",
            }}
          />
          <Badge tone="neutral" icon="info">
            No verification record yet
          </Badge>
        </div>
      </Section>

      <Section title="Tabs and segmented control">
        <Tabs
          label="Project sections"
          value={tab}
          onChange={setTab}
          tabs={[
            { value: "overview", label: "Overview" },
            { value: "quotes", label: "Quotes", count: 3 },
            { value: "documents", label: "Documents", count: 2 },
          ]}
        />
        <SegmentedControl
          label="View"
          value={seg}
          onChange={setSeg}
          options={[
            { value: "all", label: "All quotes" },
            { value: "eligible", label: "Eligible only" },
          ]}
        />
      </Section>

      <Section title="Form controls">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Quantity" htmlFor={`${label}-qty`} required hint="Priced quantity.">
            <TextInput
              id={`${label}-qty`}
              inputMode="numeric"
              placeholder="10,000"
              className="fbg-num"
            />
          </Field>
          <Field
            label="Destination ZIP"
            htmlFor={`${label}-zip`}
            required
            error="Enter a 5-digit U.S. ZIP code."
          >
            <TextInput id={`${label}-zip`} defaultValue="0710" aria-invalid className="fbg-num" />
          </Field>
          <Field label="Trade term" htmlFor={`${label}-term`}>
            <Select id={`${label}-term`} defaultValue="unknown">
              <option value="unknown">Not sure — advise me</option>
              <option value="FOB">FOB — loaded at a Chinese port</option>
            </Select>
          </Field>
          <Field label="Notes (中文)" htmlFor={`${label}-zh`}>
            <TextArea
              id={`${label}-zh`}
              lang="zh-CN"
              className="fbg-zh"
              defaultValue="白色BOPP卷筒不干胶标签，永久胶，四色印刷，哑膜。"
            />
          </Field>
          <Checkbox
            id={`${label}-chk`}
            label="Approve a sample before production"
            description="Recommended for new suppliers and new artwork."
            checked={checked}
            onChange={setChecked}
          />
        </div>
      </Section>

      <Section title="Stepper">
        <Stepper
          steps={[
            { id: "a", title: "Product" },
            { id: "b", title: "Specifications" },
            { id: "c", title: "Quantity" },
            { id: "d", title: "References" },
            { id: "e", title: "Review" },
          ]}
          current={2}
          completed={new Set([0, 1])}
          onSelect={() => undefined}
        />
      </Section>

      <Section title="Notices">
        <div className="flex flex-col gap-2">
          <Notice tone="ok" title="Lowest estimated landed cost (all inputs present)">
            Every estimated line is labelled; the report lists each assumption.
          </Notice>
          <Notice tone="warn" title="Cross-group ranking unavailable">
            Required lines are still missing for Supplier A, Supplier B.
          </Notice>
          <Notice tone="danger" title="Some files were not added">
            quote.exe: file type not accepted.
          </Notice>
          <Notice tone="ink" icon="lock" title="Internal workspace">
            Supplier contact details are visible only to operators assigned to the project.
          </Notice>
        </div>
      </Section>

      <Section title="Empty, loading and error states">
        <SegmentedControl
          label="State"
          size="sm"
          value={state}
          onChange={setState}
          options={[
            { value: "loading", label: "Loading" },
            { value: "empty", label: "Empty" },
            { value: "error", label: "Error" },
          ]}
        />
        <Panel padded>
          {state === "loading" ? (
            <SkeletonRows rows={3} />
          ) : state === "empty" ? (
            <EmptyState
              title="No quotes yet"
              body="Quotes appear here once a supplier responds or you upload one you already hold."
              action={
                <Button variant="primary" icon="upload">
                  Upload a quote
                </Button>
              }
            />
          ) : (
            <ErrorState
              title="The comparison could not be loaded"
              body="The FX rate for 2026-11-07 is missing, so USD values cannot be shown. Original currencies are still available."
              action={<Button icon="chevron-left">Show original currencies</Button>}
            />
          )}
        </Panel>
      </Section>

      <Section title="Cards and raised surface">
        <div className="grid gap-3 sm:grid-cols-2">
          <Panel title="Ruled panel" description="Default surface, border only.">
            <p className="text-sm text-(--fbg-text-secondary)">Used for lists, tables and forms.</p>
          </Panel>
          <Panel raised title="Raised panel" description="Popovers, drawers, marketing cards.">
            <p className="text-sm text-(--fbg-text-secondary)">Shadow token differs per theme.</p>
          </Panel>
        </div>
      </Section>
    </div>
  );
}

export function ComponentGallery() {
  return (
    <ThemeScope>
      <GalleryShell />
    </ThemeScope>
  );
}

function GalleryShell() {
  const [mode, setMode] = useState<"side-by-side" | "single">("side-by-side");
  const forced: Array<{ theme: ThemeChoice; label: string }> = [
    { theme: "atlas", label: "Atlas (light)" },
    { theme: "obsidian", label: "Obsidian (dark)" },
  ];
  return (
    <div className="min-h-dvh bg-(--fbg-bg-canvas) text-(--fbg-text-primary)">
      <DemoStripe />
      <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-(--fbg-border-subtle) bg-(--fbg-bg-canvas)/92 px-4 backdrop-blur sm:px-6">
        <Link
          href="/design-preview"
          className="flex items-center gap-2 text-sm text-(--fbg-text-secondary) hover:text-(--fbg-text-primary)"
        >
          <Icon name="chevron-left" size={16} /> Design preview
        </Link>
        <h1 className="min-w-0 flex-1 truncate text-base font-semibold">Component gallery</h1>
        <SegmentedControl
          label="Gallery mode"
          size="sm"
          value={mode}
          onChange={setMode}
          options={[
            { value: "side-by-side", label: "Both themes" },
            { value: "single", label: "Current theme" },
          ]}
        />
        {mode === "single" ? <AppearanceSwitch /> : null}
      </header>
      <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6">
        <div className={cx("grid gap-6", mode === "side-by-side" && "xl:grid-cols-2")}>
          {mode === "side-by-side" ? (
            forced.map((f) => (
              <ThemeScope key={f.theme} initial={f.theme}>
                <GalleryBody label={f.label} />
              </ThemeScope>
            ))
          ) : (
            <GalleryBody label="Current appearance" />
          )}
        </div>
      </main>
    </div>
  );
}
