"use client";

/**
 * Supplier Quotation Comparison (IA §2.2 `/app/projects/[id]/compare`, §3 ComparisonMatrix; PRD US-B4).
 * All arithmetic comes from `compare-demo.ts`, a display-only mirror of QUOTE_ENGINE_SPEC §2. Local state only.
 */
import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  BRIEF_HARD_SPEC,
  BRIEF_SOFT_SPEC,
  DEMO_AS_OF,
  DEMO_FREIGHT_ESTIMATE,
  DEMO_FX,
  DEMO_PROJECTS,
  DEMO_QUOTES,
  LANDED_LINE_LABEL,
  SPEC_LABEL,
  type LandedLineType,
} from "../demo-data";
import {
  compareQuotes,
  type EvaluatedQuote,
  exclusionText,
  formatMoney,
  formatQty,
  forwarderOverrides,
  type LandedOverrides,
} from "../compare-demo";
import { COMPARE_MODES, rowVisible, summaryFacts, type CompareMode } from "../compare-modes";
import { AppShell } from "../ui/AppShell";
import { Icon } from "../ui/icons";
import { useEscapeKey } from "../ui/useEscapeKey";
import {
  Badge,
  Button,
  buttonClasses,
  cx,
  EvidenceBadge,
  FreshnessChip,
  Notice,
  PageHeader,
  Panel,
  SegmentedControl,
  StatusChip,
  TextInput,
} from "../ui/primitives";

const QUANTITIES = [5_000, 10_000, 25_000] as const;
type Qty = (typeof QUANTITIES)[number];

type View = "all" | "eligible" | "excluded";
const VIEWS: ReadonlyArray<{ value: View; label: string }> = [
  { value: "all", label: "All quotes" },
  { value: "eligible", label: "Eligible only" },
  { value: "excluded", label: "Not ranked" },
];

const QUOTE_TYPE_LABEL: Record<string, string> = {
  listing: "Indicative listing",
  supplier_catalog: "Supplier catalog price",
  negotiated_private: "Factory-confirmed quote",
  final_offer: "Factory-confirmed quote",
  estimate: "Estimate",
};

function usdRateLabel(): string {
  return `USD @ ${(1 / DEMO_FX.rate).toFixed(2)} CNY/USD (${DEMO_FX.source}, ${DEMO_FX.rateDate})`;
}

export function QuoteComparison() {
  const project = DEMO_PROJECTS[0] ?? { name: "Sourcing project", briefVersion: 1 };
  const [qty, setQty] = useState<Qty>(10_000);
  const [applyForwarder, setApplyForwarder] = useState(false);
  const [dutyRate, setDutyRate] = useState("");
  const [dutySource, setDutySource] = useState("");
  const [selectedId, setSelectedId] = useState<string>("q_demo_a");
  const [clarification, setClarification] = useState<string | null>(null);
  const [view, setView] = useState<View>("all");
  const [compareSet, setCompareSet] = useState<Set<string>>(new Set());
  const [compareMode, setCompareMode] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<"pdf" | "xlsx">("pdf");
  const [mode, setMode] = useState<CompareMode>("summary");
  // `?mode=summary|compare|details` opens the page in that presentation (review links, screenshots).
  useEffect(() => {
    const m = new URLSearchParams(window.location.search).get("mode");
    if (m === "summary" || m === "compare" || m === "details") setMode(m);
  }, []);

  useEscapeKey(exportOpen || clarification !== null, () => {
    setExportOpen(false);
    setClarification(null);
  });

  const toggleCompare = (id: string) =>
    setCompareSet((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const dutyRateNumber = Number(dutyRate);
  const dutyValid =
    dutyRate !== "" &&
    Number.isFinite(dutyRateNumber) &&
    dutyRateNumber >= 0 &&
    dutySource.trim().length > 2;

  const overrides = useMemo<LandedOverrides>(
    () => (applyForwarder ? forwarderOverrides() : {}),
    [applyForwarder],
  );

  // Duty assumption is applied as goods × rate per quote; the rate is a buyer-recorded assumption, never AI-filled.
  const result = useMemo(() => {
    const base = compareQuotes(DEMO_QUOTES, qty, DEMO_AS_OF, overrides);
    if (!dutyValid) return base;
    const withDuty: LandedOverrides = { ...overrides };
    for (const g of base.groups)
      for (const e of g.quotes)
        if (e.goodsUsd !== null)
          withDuty[e.quote.id] = {
            ...(withDuty[e.quote.id] ?? {}),
            duties_taxes: {
              amountUsd: (e.goodsUsd * dutyRateNumber) / 100,
              status: "estimated",
              source: `Buyer assumption ${dutyRateNumber}% — ${dutySource.trim()}`,
            },
          };
    return compareQuotes(DEMO_QUOTES, qty, DEMO_AS_OF, withDuty);
  }, [qty, overrides, dutyValid, dutyRateNumber, dutySource]);

  const all = result.groups.flatMap((g) => g.quotes);
  const selected = all.find((e) => e.quote.id === selectedId) ?? all[0];
  const visibleGroups = result.groups
    .filter((g) =>
      view === "all" ? true : view === "eligible" ? g.kind === "basis" : g.kind === "excluded",
    )
    .map((g) =>
      compareMode && compareSet.size > 0
        ? { ...g, quotes: g.quotes.filter((e) => compareSet.has(e.quote.id)) }
        : g,
    )
    .filter((g) => g.quotes.length > 0);
  const includedCount = result.groups
    .filter((g) => g.kind === "basis")
    .reduce((n, g) => n + g.quotes.length, 0);

  const rightRail = selected ? (
    <EvidenceDrawer
      evaluated={selected}
      onClarify={() => setClarification(selected.quote.supplier)}
    />
  ) : null;

  return (
    <AppShell workspace="buyer" title="Quote comparison" rightRail={rightRail}>
      <div className="flex flex-col gap-5">
        <Link
          href="/design-preview/buyer/quotes"
          className="inline-flex w-fit items-center gap-1 text-[13px] font-medium text-(--fbg-text-secondary) hover:text-(--fbg-link)"
        >
          <Icon name="chevron-left" size={14} />
          All quotes
        </Link>
        <PageHeader
          title={project.name}
          lead="Like for like: same specification, same trade term, the tier for your quantity. Nothing is ranked on unit price alone."
          meta={
            <>
              <span className="fbg-num inline-flex items-center gap-1">
                <Icon name="check" size={12} className="text-(--fbg-status-success)" />
                Brief v{project.briefVersion} confirmed 2026-11-04
              </span>
              <span className="fbg-num">As of {DEMO_AS_OF}</span>
              <span className="fbg-num" title={`${usdRateLabel()} · FX row id fx_demo_0001`}>
                FX {(1 / DEMO_FX.rate).toFixed(2)} CNY/USD · {DEMO_FX.rateDate}
              </span>
            </>
          }
          actions={
            <Button variant="primary" icon="download" onClick={() => setExportOpen(true)}>
              Export report
            </Button>
          }
        />

        {/* Presentation mode, view filter and the compare selection */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <SegmentedControl
              label="Presentation"
              options={COMPARE_MODES}
              value={mode}
              onChange={setMode}
            />
            <p className="text-[13px] text-(--fbg-text-secondary)">
              {COMPARE_MODES.find((m) => m.value === mode)?.hint}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <SegmentedControl
              label="Show"
              size="sm"
              options={VIEWS}
              value={view}
              onChange={setView}
            />
            {compareSet.size > 0 ? (
              <>
                <Button
                  size="sm"
                  variant={compareMode ? "primary" : "secondary"}
                  icon="compare"
                  onClick={() => setCompareMode((v) => !v)}
                  aria-pressed={compareMode}
                >
                  {compareMode
                    ? `Comparing ${compareSet.size} selected`
                    : `Compare ${compareSet.size} selected`}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setCompareSet(new Set());
                    setCompareMode(false);
                  }}
                >
                  Clear
                </Button>
              </>
            ) : null}
          </div>
        </div>

        {/* Quantity, landed-cost inputs, the ranking status, and the grouping rationale on demand */}
        <Panel padded={false}>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-(--fbg-border-divider) px-4 py-3">
            <span className="text-sm font-medium text-(--fbg-text-primary)">Quantity to price</span>
            <SegmentedControl
              label="Quantity to price"
              size="sm"
              value={String(qty)}
              onChange={(v) => setQty(Number(v) as Qty)}
              options={QUANTITIES.map((q) => ({
                value: String(q),
                label: `${formatQty(q)} pcs`,
              }))}
            />
            <span className="text-[13px] text-(--fbg-text-secondary)">
              Tiers, goods cost and landed lines below follow this quantity.
            </span>
          </div>
          <div className="flex flex-col gap-4 p-4 lg:flex-row lg:gap-8">
            <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 accent-(--fbg-action-primary)"
                checked={applyForwarder}
                onChange={(e) => setApplyForwarder(e.target.checked)}
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-(--fbg-text-primary)">
                  Apply the forwarder estimate as estimated lines
                </span>
                <span className="block text-[13px] text-(--fbg-text-secondary)">
                  {DEMO_FREIGHT_ESTIMATE.source}: freight, insurance, brokerage and delivery to NJ
                  07102 per trade term. Lines stay marked <em>estimated</em>.
                </span>
              </span>
            </label>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-(--fbg-text-primary)">
                Duty and tax assumption
              </p>
              <p className="text-[13px] text-(--fbg-text-secondary)">
                Your rate and its source. Classification advice comes from a licensed customs
                broker; nothing fills this in for you.
              </p>
              <div className="mt-2 grid grid-cols-[6rem_1fr] gap-2">
                <label className="sr-only" htmlFor="dutyRate">
                  Duty rate percent
                </label>
                <div className="relative">
                  <TextInput
                    id="dutyRate"
                    inputMode="decimal"
                    value={dutyRate}
                    onChange={(e) => setDutyRate(e.target.value)}
                    placeholder="0"
                    className="fbg-num pr-7"
                  />
                  <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-slate">
                    %
                  </span>
                </div>
                <label className="sr-only" htmlFor="dutySource">
                  Source of the duty assumption
                </label>
                <TextInput
                  id="dutySource"
                  value={dutySource}
                  onChange={(e) => setDutySource(e.target.value)}
                  placeholder="Source, e.g. broker email 2026-11-06"
                />
              </div>
            </div>
          </div>
          <p
            className={cx(
              "flex items-start gap-2 border-t border-(--fbg-border-divider) px-4 py-2.5 text-[13px]",
              result.landedRanking ? "text-(--fbg-status-success)" : "text-(--fbg-status-warning)",
            )}
          >
            <Icon
              name={result.landedRanking ? "check" : "alert"}
              size={14}
              className="mt-0.5 shrink-0"
            />
            {result.landedRanking ? (
              <span>
                Lowest estimated landed cost with every input present:{" "}
                {result.landedRanking[0]?.quote.supplier} at{" "}
                <span className="fbg-num">
                  {formatMoney(result.landedRanking[0]?.landedTotalUsd ?? 0, "USD")}
                </span>{" "}
                for {formatQty(qty)} pcs. Estimated lines are labelled; the report lists each
                assumption.
              </span>
            ) : (
              <span>
                Cross-group ranking unavailable:{" "}
                {includedCount < 2
                  ? "only one quote is eligible at this quantity."
                  : `required landed-cost lines are still missing for ${result.landedRankingBlockedBy.join(", ")}.`}
              </span>
            )}
          </p>
          <details className="border-t border-(--fbg-border-divider)">
            <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 px-4 text-[13px] font-medium text-(--fbg-text-secondary) hover:text-(--fbg-text-primary) [&::-webkit-details-marker]:hidden">
              <Icon name="info" size={14} />
              Why quotes are grouped by trade term, and what sourced, estimated and missing mean
            </summary>
            <div className="px-4 pb-4 text-sm text-(--fbg-text-secondary)">
              <p>
                A trade term says how much of the journey the price includes. An EXW price stops at
                the factory door; an FOB price already covers inland transport and export clearance
                to the port. Comparing them on goods price would reward the quote that leaves more
                cost to you. Goods prices are ranked only inside a group with the same term and
                place. Groups are ranked against each other only when every landed-cost line needed
                to normalise them is present, as sourced or estimated.
              </p>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs">
                <span className="fbg-line-sourced pl-2">
                  <span className="text-(--fbg-text-primary)">Sourced</span> · from a quote or a
                  confirmed logistics quote
                </span>
                <span className="fbg-line-estimated pl-2">
                  <span className="text-(--fbg-text-primary)">Estimated</span> · a recorded
                  assumption with its source
                </span>
                <span className="fbg-line-missing pl-2">
                  <span className="text-(--fbg-text-primary)">Missing</span> · nothing on file, the
                  total stays partial
                </span>
              </div>
            </div>
          </details>
        </Panel>

        {/* Groups */}
        {visibleGroups.length === 0 ? (
          <Notice tone="neutral" title="Nothing to show for this view">
            Change the view or the quantity, or clear the compare selection.
          </Notice>
        ) : null}
        {visibleGroups.map((group) => (
          <section
            key={group.key}
            aria-labelledby={`group-${group.key}`}
            className="flex flex-col gap-2"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2
                id={`group-${group.key}`}
                className="flex items-center gap-2 text-[15px] font-semibold text-ink"
              >
                {group.kind === "excluded" ? (
                  <>
                    <Icon name="info" size={16} className="text-slate" /> Not ranked
                  </>
                ) : (
                  <>
                    <Icon name="truck" size={16} className="text-teal" /> {group.title}
                    <span className="fbg-num text-sm font-normal text-slate">
                      · {group.quotes.length} {group.quotes.length === 1 ? "quote" : "quotes"}
                    </span>
                  </>
                )}
              </h2>
              {group.kind === "basis" && group.lowestComparableId ? (
                <Badge tone="teal" icon="check">
                  Lowest comparable goods cost:{" "}
                  {
                    group.quotes.find((q) => q.quote.id === group.lowestComparableId)?.quote
                      .supplier
                  }
                </Badge>
              ) : group.kind === "basis" ? (
                <span className="text-xs text-slate">
                  Single quote in this group — nothing to rank against.
                </span>
              ) : (
                <span className="text-xs text-slate">
                  Shown for completeness; excluded from every ranking.
                </span>
              )}
            </div>

            {mode === "summary" ? (
              <ul className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
                {group.quotes.map((e) => (
                  <SummaryCard
                    key={e.quote.id}
                    evaluated={e}
                    qty={qty}
                    excluded={group.kind === "excluded"}
                    lowest={group.lowestComparableId === e.quote.id}
                    selected={selected?.quote.id === e.quote.id}
                    onSelect={() => setSelectedId(e.quote.id)}
                    compared={compareSet.has(e.quote.id)}
                    onToggleCompare={() => toggleCompare(e.quote.id)}
                    onDetails={() => {
                      setSelectedId(e.quote.id);
                      setMode("details");
                    }}
                  />
                ))}
              </ul>
            ) : (
              <>
                {/* Desktop matrix */}
                <div className="hidden overflow-x-auto rounded-(--fbg-radius-card) border border-line bg-surface lg:block">
                  <Matrix
                    quotes={group.quotes}
                    qty={qty}
                    mode={mode}
                    compareSet={compareSet}
                    onToggleCompare={toggleCompare}
                    excluded={group.kind === "excluded"}
                    selectedId={selected?.quote.id}
                    onSelect={setSelectedId}
                  />
                </div>
                {/* Mobile / tablet carousel */}
                <div className="fbg-snap-x fbg-scrollbar-thin -mx-4 flex gap-3 overflow-x-auto px-4 pb-2 lg:hidden">
                  {group.quotes.map((e) => (
                    <QuoteCard
                      key={e.quote.id}
                      evaluated={e}
                      qty={qty}
                      excluded={group.kind === "excluded"}
                      selected={selected?.quote.id === e.quote.id}
                      onSelect={() => setSelectedId(e.quote.id)}
                      mode={mode}
                      compared={compareSet.has(e.quote.id)}
                      onToggleCompare={() => toggleCompare(e.quote.id)}
                    />
                  ))}
                </div>
              </>
            )}
          </section>
        ))}

        {/* Evidence drawer below the matrix on narrower screens */}
        {selected ? (
          <div className="xl:hidden">
            <Panel title={`Evidence · ${selected.quote.supplier}`}>
              <EvidenceDrawer
                evaluated={selected}
                onClarify={() => setClarification(selected.quote.supplier)}
                embedded
              />
            </Panel>
          </div>
        ) : null}

        {exportOpen ? (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Export comparison report"
            className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
          >
            <button
              type="button"
              className="absolute inset-0 bg-(--fbg-overlay)"
              aria-label="Close"
              onClick={() => setExportOpen(false)}
            />
            <div className="fbg-raised relative w-full max-w-lg rounded-t-(--fbg-radius-dialog) p-5 sm:rounded-(--fbg-radius-dialog)">
              <h2 className="text-lg font-semibold text-ink">Export comparison report</h2>
              <p className="mt-1 text-sm text-slate">
                The report contains brief v{project.briefVersion}, each quote source reference,
                confirmed and valid-until dates, price basis, the FX rate row, every landed-cost
                line with its status, the assumptions list, the exclusions list and the generation
                time. Supplier contact details are never included unless your organization holds a
                disclosure grant.
              </p>
              <div role="radiogroup" aria-label="Format" className="mt-4 grid grid-cols-2 gap-2">
                {(
                  [
                    { value: "pdf", label: "PDF", hint: "Read-only, for sharing internally" },
                    {
                      value: "xlsx",
                      label: "XLSX",
                      hint: "Cells with original and converted values",
                    },
                  ] as const
                ).map((f) => (
                  <label
                    key={f.value}
                    className={cx(
                      "flex cursor-pointer items-start gap-3 rounded-(--fbg-radius-control) border p-3",
                      exportFormat === f.value
                        ? "border-(--fbg-action-primary)/60 bg-(--fbg-selected)"
                        : "border-line hover:border-(--fbg-border-strong)",
                    )}
                  >
                    <input
                      type="radio"
                      name="exportFormat"
                      className="mt-0.5 accent-(--fbg-action-primary)"
                      checked={exportFormat === f.value}
                      onChange={() => setExportFormat(f.value)}
                    />
                    <span>
                      <span className="block text-sm font-medium text-ink">{f.label}</span>
                      <span className="block text-xs text-slate">{f.hint}</span>
                    </span>
                  </label>
                ))}
              </div>
              <div className="mt-3">
                <Notice tone="neutral" title="Report generation is not connected in this preview">
                  File name would be{" "}
                  <span className="fbg-num">
                    fbg-comparison-prj_demo_labels-v{project.briefVersion}-{DEMO_AS_OF}.
                    {exportFormat}
                  </span>
                  . Generation runs server-side (B-23). The Reports screen shows exactly what the
                  file will contain and simulates the generation in this preview.
                </Notice>
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <Button onClick={() => setExportOpen(false)}>Close</Button>
                <Link
                  href={`/design-preview/buyer/reports?qty=${qty}&format=${exportFormat}`}
                  className={buttonClasses("primary")}
                >
                  Continue in Reports
                </Link>
              </div>
            </div>
          </div>
        ) : null}

        {clarification ? (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Request clarification"
            className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
          >
            <button
              type="button"
              className="absolute inset-0 bg-(--fbg-overlay)"
              aria-label="Close"
              onClick={() => setClarification(null)}
            />
            <div className="fbg-raised relative w-full max-w-lg rounded-t-(--fbg-radius-dialog) p-5 sm:rounded-(--fbg-radius-dialog)">
              <h2 className="text-[15px] font-semibold text-ink">
                Request clarification from {clarification}
              </h2>
              <p className="mt-1 text-sm text-slate">
                A bilingual draft is prepared for you. It is sent only after you approve the wording
                and an operator approves the outbound message. The send record logs channel,
                approver and time.
              </p>
              <div className="mt-3 rounded-(--fbg-radius-control) border border-line bg-paper p-3 text-sm">
                <p className="text-ink">
                  Is tooling included in the quoted EXW unit price, and does the price hold for
                  10,000 pcs?
                </p>
                <p className="fbg-zh mt-2 text-slate" lang="zh-CN">
                  请确认：EXW 单价是否已包含模具费？该价格是否适用于 10,000 件？
                </p>
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <Button onClick={() => setClarification(null)}>Cancel</Button>
                <Link
                  href="/design-preview/buyer/messages?thread=th_tooling"
                  className={buttonClasses("primary")}
                >
                  Review in Messages
                </Link>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}

/* ----------------------------------------------------------------------------------------------- */
/* Rows                                                                                               */
/* ----------------------------------------------------------------------------------------------- */

interface RowDef {
  key: string;
  label: string;
  render: (e: EvaluatedQuote, qty: number) => ReactNode;
  section?: "quote" | "spec" | "price" | "terms" | "landed";
}

function tierLabel(
  t: { minQty: number; maxQty: number | null; unitPrice: number },
  currency: "CNY" | "USD",
) {
  const range =
    t.maxQty === null
      ? `${formatQty(t.minQty)}+`
      : `${formatQty(t.minQty)}–${formatQty(t.maxQty - 1)}`;
  return `${range} @ ${formatMoney(t.unitPrice, currency, 4)}`;
}

const ROWS: RowDef[] = [
  {
    key: "type",
    label: "Quote type",
    section: "quote",
    render: (e) => (
      <div className="flex flex-col items-start gap-1">
        <Badge tone="teal" icon="check">
          {QUOTE_TYPE_LABEL[e.quote.quoteType] ?? e.quote.quoteType}
        </Badge>
        {e.quote.validUntil === null ? (
          <Badge tone="warn">Validity unconfirmed</Badge>
        ) : e.exclusion?.code === "expired" ? (
          <Badge tone="danger">Quote expired</Badge>
        ) : null}
      </div>
    ),
  },
  {
    key: "validity",
    label: "Validity",
    section: "quote",
    render: (e) =>
      e.quote.validUntil === null ? (
        <span className="text-xs text-warn">
          Not stated. Treated as unconfirmed, never as perpetual.
        </span>
      ) : (
        <FreshnessChip
          kind={e.quote.validUntil < DEMO_AS_OF ? "expired" : "valid_until"}
          date={e.quote.validUntil}
        />
      ),
  },
  {
    key: "confirmed",
    label: "Confirmed",
    section: "quote",
    render: (e) => <FreshnessChip kind="confirmed" date={e.quote.confirmedAt} />,
  },
  {
    key: "source",
    label: "Source",
    section: "quote",
    render: (e) => (
      <span className="flex items-start gap-1 text-xs text-slate">
        <Icon name="document" size={12} className="mt-0.5 shrink-0" />
        <span>
          {e.quote.sourceRef}
          <span className="block">{e.quote.sourceType.replace(/_/g, " ")}</span>
        </span>
      </span>
    ),
  },
  ...Object.keys(BRIEF_HARD_SPEC).map<RowDef>((code) => ({
    key: `spec_${code}`,
    label: `${SPEC_LABEL[code] ?? code} (required)`,
    section: "spec",
    render: (e) => {
      const value = e.quote.spec[code];
      const expected = BRIEF_HARD_SPEC[code];
      const mismatch = value !== expected;
      return (
        <span
          className={cx("inline-flex items-center gap-1", mismatch ? "text-danger" : "text-ink")}
        >
          {mismatch ? <Icon name="alert" size={12} /> : null}
          {value ?? "Unknown"}
          {mismatch ? <span className="text-[11px] text-slate"> ≠ {expected}</span> : null}
        </span>
      );
    },
  })),
  ...Object.keys(BRIEF_SOFT_SPEC).map<RowDef>((code) => ({
    key: `soft_${code}`,
    label: SPEC_LABEL[code] ?? code,
    section: "spec",
    render: (e) => {
      const value = e.quote.spec[code];
      const differs = value !== undefined && value !== BRIEF_SOFT_SPEC[code];
      return (
        <span className={cx("inline-flex items-center gap-1", differs ? "text-warn" : "text-ink")}>
          {differs ? <Icon name="info" size={12} /> : null}
          {value ?? "Unknown"}
          {differs ? (
            <span className="text-[11px] text-slate"> differs, still comparable</span>
          ) : null}
        </span>
      );
    },
  })),
  {
    key: "tier",
    label: "Tier for this quantity",
    section: "price",
    render: (e) => (
      <div className="flex flex-col gap-0.5">
        {e.quote.tiers.map((t) => {
          const active = e.tier === t;
          return (
            <span
              key={t.minQty}
              className={cx("fbg-num text-sm", active ? "font-semibold text-ink" : "text-slate")}
            >
              {active ? <Icon name="check" size={12} className="mr-1 inline text-teal" /> : null}
              {tierLabel(t, e.quote.currency)}
            </span>
          );
        })}
        {e.quote.moq !== null ? (
          <span className="fbg-num text-xs text-slate">MOQ {formatQty(e.quote.moq)}</span>
        ) : null}
      </div>
    ),
  },
  {
    key: "unit",
    label: "Unit price",
    section: "price",
    render: (e) =>
      e.tier ? (
        <div className="fbg-num">
          <span className="text-ink">{formatMoney(e.tier.unitPrice, e.quote.currency, 4)}</span>
          {e.quote.currency === "CNY" ? (
            <span className="block text-xs text-slate">
              {formatMoney(e.tier.unitPrice * DEMO_FX.rate, "USD", 4)} converted
            </span>
          ) : null}
        </div>
      ) : (
        <span className="text-slate">—</span>
      ),
  },
  {
    key: "goods",
    label: "Goods for quantity",
    section: "price",
    render: (e) =>
      e.goodsOriginal !== null && e.goodsUsd !== null ? (
        <div className="fbg-num">
          <span className="text-ink">{formatMoney(e.goodsOriginal, e.quote.currency)}</span>
          {e.quote.currency === "CNY" ? (
            <span className="block text-xs text-slate">{formatMoney(e.goodsUsd, "USD")}</span>
          ) : null}
        </div>
      ) : (
        <span className="text-slate">—</span>
      ),
  },
  {
    key: "fees",
    label: "One-time fees",
    section: "price",
    render: (e) =>
      e.oneTimeFeesOriginal > 0 ? (
        <div className="fbg-num">
          <span className="text-ink">
            {formatMoney(e.oneTimeFeesOriginal, e.quote.currency)} tooling
          </span>
          {e.quote.currency === "CNY" ? (
            <span className="block text-xs text-slate">{formatMoney(e.oneTimeFeesUsd, "USD")}</span>
          ) : null}
        </div>
      ) : e.quote.fees.some((f) => f.includedInUnitPrice) ? (
        <span className="text-xs text-slate">Tooling included in unit price (per supplier)</span>
      ) : (
        <span className="text-xs text-slate">None stated</span>
      ),
  },
  {
    key: "comparable",
    label: "Comparable goods cost (goods + one-time fees)",
    section: "price",
    render: (e) =>
      e.comparableGoodsUsd !== null ? (
        <span className="fbg-num text-[15px] font-semibold text-ink">
          {formatMoney(e.comparableGoodsUsd, "USD")}
        </span>
      ) : (
        <span className="text-slate">—</span>
      ),
  },
  {
    key: "lead",
    label: "Production lead time",
    section: "terms",
    render: (e) => (
      <span className="fbg-num text-ink">
        {e.quote.leadTimeDays !== null ? `${e.quote.leadTimeDays} days` : "Not stated"}
      </span>
    ),
  },
  {
    key: "payment",
    label: "Payment terms",
    section: "terms",
    render: (e) => <span className="text-ink">{e.quote.paymentTerms ?? "Not stated"}</span>,
  },
  {
    key: "evidence",
    label: "Verification evidence",
    section: "terms",
    render: (e) =>
      e.quote.evidence.length === 0 ? (
        <Badge tone="neutral" icon="info">
          No verification record yet
        </Badge>
      ) : (
        <div className="flex flex-col items-start gap-1">
          {e.quote.evidence.map((ev) => (
            <EvidenceBadge
              key={ev.label}
              label={ev.label}
              tone={ev.label.startsWith("Sample") ? "teal" : "ok"}
              evidence={ev}
            />
          ))}
        </div>
      ),
  },
];

const LANDED_ROWS: LandedLineType[] = [
  "inland_origin",
  "export_clearance_origin_handling",
  "international_freight",
  "insurance",
  "duties_taxes",
  "brokerage",
  "destination_handling_delivery",
];

function LandedCell({ e, type }: { e: EvaluatedQuote; type: LandedLineType }) {
  const line = e.landed.find((l) => l.type === type);
  if (!line) return null;
  const cls = {
    sourced: "fbg-line-sourced",
    estimated: "fbg-line-estimated",
    missing: "fbg-line-missing",
    not_applicable: "fbg-line-na",
  }[line.status];
  return (
    <div className={cx("pl-2", cls)}>
      {line.status === "not_applicable" ? (
        <span className="text-xs text-slate">Included in trade term</span>
      ) : line.status === "missing" ? (
        <StatusChip status="missing" />
      ) : (
        <div className="fbg-num">
          <span className="text-ink">{formatMoney(line.amountUsd ?? 0, "USD")}</span>
          <span className="block text-[11px] text-slate" title={line.source ?? undefined}>
            {line.status === "estimated" ? "Estimated" : "Sourced"} · {line.source}
          </span>
        </div>
      )}
    </div>
  );
}

function LandedTotal({ e }: { e: EvaluatedQuote }) {
  if (e.exclusion) return <span className="text-slate">Not ranked</span>;
  if (e.landedComplete && e.landedTotalUsd !== null)
    return (
      <div>
        <span className="fbg-num text-[15px] font-semibold text-ink">
          {formatMoney(e.landedTotalUsd, "USD")}
        </span>
        <div className="mt-1 flex flex-wrap gap-1">
          <Badge tone="teal" icon="check">
            Estimated landed cost
          </Badge>
          {e.estimatedLines.length > 0 ? (
            <Badge tone="warn" icon="info">
              {e.estimatedLines.length} estimated {e.estimatedLines.length === 1 ? "line" : "lines"}
            </Badge>
          ) : null}
        </div>
      </div>
    );
  return (
    <div>
      <span className="text-sm font-medium text-ink">Partial</span>
      <span className="block text-xs text-danger">
        Excludes: {e.missingLines.map((m) => LANDED_LINE_LABEL[m].toLowerCase()).join(", ")}
      </span>
    </div>
  );
}

const SECTION_LABEL: Record<NonNullable<RowDef["section"]>, string> = {
  quote: "Quote",
  spec: "Specification vs. brief v3",
  price: "Price at this quantity",
  terms: "Terms and evidence",
  landed: "Landed cost to NJ 07102",
};

/** Rows a mode shows; not-ranked groups only ever show the quote, specification and tier rows. */
function rowsForMode(mode: CompareMode, excluded: boolean): RowDef[] {
  return (
    excluded
      ? ROWS.filter((r) => r.section === "quote" || r.section === "spec" || r.key === "tier")
      : ROWS
  ).filter((r) => r.section !== undefined && rowVisible(mode, r.key, r.section));
}

function Matrix({
  quotes,
  qty,
  excluded,
  selectedId,
  onSelect,
  mode,
  compareSet,
  onToggleCompare,
}: {
  quotes: EvaluatedQuote[];
  qty: number;
  excluded: boolean;
  selectedId: string | undefined;
  onSelect: (id: string) => void;
  mode: CompareMode;
  compareSet: ReadonlySet<string>;
  onToggleCompare: (id: string) => void;
}) {
  const rows = rowsForMode(mode, excluded);
  const sections = Array.from(new Set(rows.map((r) => r.section)));
  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr>
          <th
            scope="col"
            className="sticky left-0 z-10 w-56 border-b border-line bg-surface px-4 py-3 text-left text-xs font-medium text-slate"
          >
            {excluded ? "Reason" : "Supplier"}
          </th>
          {quotes.map((e) => {
            const active = e.quote.id === selectedId;
            return (
              <th
                key={e.quote.id}
                scope="col"
                className={cx(
                  "min-w-56 border-b border-l border-line px-4 py-3 text-left align-top",
                  active && "bg-teal/5",
                )}
              >
                <button
                  type="button"
                  onClick={() => onSelect(e.quote.id)}
                  className="group text-left"
                  aria-pressed={active}
                >
                  <span
                    className={cx(
                      "block text-sm font-semibold",
                      excluded ? "text-slate" : "text-ink",
                      "group-hover:underline",
                    )}
                  >
                    {e.quote.supplier}
                  </span>
                  <span className="block text-xs text-slate">
                    {e.quote.city} · {e.quote.priceBasis} {e.quote.basisPlace} · {e.quote.currency}
                  </span>
                </button>
                {e.exclusion ? (
                  <span className="mt-1 block text-xs text-danger">
                    {exclusionText(e.exclusion)}
                  </span>
                ) : (
                  <span className="mt-1 block text-[11px] text-slate">Click to show evidence</span>
                )}
                <label className="mt-2 flex items-center gap-2 text-xs font-normal text-slate">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-(--fbg-action-primary)"
                    checked={compareSet.has(e.quote.id)}
                    onChange={() => onToggleCompare(e.quote.id)}
                  />
                  Compare
                </label>
              </th>
            );
          })}
        </tr>
      </thead>
      <tbody>
        {sections.map((section) => (
          <SectionRows
            key={section ?? "x"}
            label={section ? SECTION_LABEL[section] : ""}
            rows={rows.filter((r) => r.section === section)}
            quotes={quotes}
            qty={qty}
            excluded={excluded}
            selectedId={selectedId}
          />
        ))}
        {!excluded ? (
          <>
            <tr>
              <th
                scope="rowgroup"
                colSpan={quotes.length + 1}
                className="border-t border-line bg-paper px-4 py-1.5 text-left text-xs font-medium text-slate"
              >
                {SECTION_LABEL.landed}
                {mode === "compare" ? (
                  <span className="font-normal"> · totals only; Full details lists every line</span>
                ) : null}
              </th>
            </tr>
            {(mode === "details" ? LANDED_ROWS : []).map((type) => (
              <tr key={type} className="border-t border-line/70">
                <th
                  scope="row"
                  className="sticky left-0 z-10 bg-surface px-4 py-2 text-left font-normal text-slate"
                >
                  {LANDED_LINE_LABEL[type]}
                </th>
                {quotes.map((e) => (
                  <td
                    key={e.quote.id}
                    className={cx(
                      "border-l border-line px-4 py-2 align-top",
                      e.quote.id === selectedId && "bg-teal/5",
                    )}
                  >
                    <LandedCell e={e} type={type} />
                  </td>
                ))}
              </tr>
            ))}
            <tr className="border-t-2 border-ink/20">
              <th
                scope="row"
                className="sticky left-0 z-10 bg-surface px-4 py-3 text-left font-medium text-ink"
              >
                Estimated landed total
              </th>
              {quotes.map((e) => (
                <td
                  key={e.quote.id}
                  className={cx(
                    "border-l border-line px-4 py-3 align-top",
                    e.quote.id === selectedId && "bg-teal/5",
                  )}
                >
                  <LandedTotal e={e} />
                </td>
              ))}
            </tr>
          </>
        ) : null}
      </tbody>
    </table>
  );
}

function SectionRows({
  label,
  rows,
  quotes,
  qty,
  excluded,
  selectedId,
}: {
  label: string;
  rows: RowDef[];
  quotes: EvaluatedQuote[];
  qty: number;
  excluded: boolean;
  selectedId: string | undefined;
}) {
  return (
    <>
      <tr>
        <th
          scope="rowgroup"
          colSpan={quotes.length + 1}
          className="border-t border-line bg-paper px-4 py-1.5 text-left text-xs font-medium text-slate"
        >
          {label}
        </th>
      </tr>
      {rows.map((row) => (
        <tr key={row.key} className={cx("border-t border-line/70", excluded && "opacity-80")}>
          <th
            scope="row"
            className="sticky left-0 z-10 bg-surface px-4 py-2 text-left font-normal text-slate"
          >
            {row.label}
          </th>
          {quotes.map((e) => (
            <td
              key={e.quote.id}
              className={cx(
                "border-l border-line px-4 py-2 align-top",
                e.quote.id === selectedId && "bg-teal/5",
              )}
            >
              {row.render(e, qty)}
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

function QuoteCard({
  evaluated: e,
  qty,
  excluded,
  selected,
  onSelect,
  mode,
  compared,
  onToggleCompare,
}: {
  evaluated: EvaluatedQuote;
  qty: number;
  excluded: boolean;
  selected: boolean;
  onSelect: () => void;
  mode: CompareMode;
  compared: boolean;
  onToggleCompare: () => void;
}) {
  const rows = rowsForMode(mode, excluded);
  const missing = e.exclusion
    ? [exclusionText(e.exclusion)]
    : e.missingLines.map((m) => LANDED_LINE_LABEL[m]);
  return (
    <article
      className={cx(
        "w-[min(86vw,22rem)] shrink-0 rounded-(--fbg-radius-card) border bg-surface",
        selected ? "border-teal" : "border-line",
      )}
    >
      <header className="border-b border-line p-3">
        <button
          type="button"
          onClick={onSelect}
          className="w-full text-left"
          aria-pressed={selected}
        >
          <span className={cx("block text-sm font-semibold", excluded ? "text-slate" : "text-ink")}>
            {e.quote.supplier}
          </span>
          <span className="block text-xs text-slate">
            {e.quote.city} · {e.quote.priceBasis} {e.quote.basisPlace} · {e.quote.currency}
          </span>
        </button>
        {e.exclusion ? (
          <p className="mt-1 text-xs text-danger">{exclusionText(e.exclusion)}</p>
        ) : null}
        {!excluded && e.comparableGoodsUsd !== null ? (
          <p className="fbg-num mt-2 text-[15px] font-semibold text-ink">
            {formatMoney(e.comparableGoodsUsd, "USD")}{" "}
            <span className="text-xs font-normal text-slate">comparable goods cost</span>
          </p>
        ) : null}
        <div className="mt-2 flex items-start justify-between gap-2">
          <p className="text-xs">
            <span className="font-medium text-ink">What is missing: </span>
            {missing.length === 0 ? (
              <span className="text-(--fbg-status-success)">nothing, all inputs present</span>
            ) : (
              <span className="text-danger">{missing.join(", ")}</span>
            )}
          </p>
          <label className="flex shrink-0 items-center gap-1.5 text-xs text-slate">
            <input
              type="checkbox"
              className="h-4 w-4 accent-(--fbg-action-primary)"
              checked={compared}
              onChange={onToggleCompare}
            />
            Compare
          </label>
        </div>
      </header>
      <details className="group" open={selected || mode === "details"}>
        <summary className="flex min-h-11 cursor-pointer items-center justify-between px-3 text-sm font-medium text-(--fbg-link) [&::-webkit-details-marker]:hidden">
          <span className="group-open:hidden">Show details</span>
          <span className="hidden group-open:inline">Hide details</span>
          <Icon
            name="chevron-down"
            size={16}
            className="transition-transform group-open:rotate-180"
          />
        </summary>
        <dl className="divide-y divide-line/70 border-t border-line/70">
          {rows
            .filter((r) => r.key !== "comparable")
            .map((row) => (
              <div key={row.key} className="grid grid-cols-[7.5rem_1fr] gap-2 px-3 py-2">
                <dt className="text-xs text-slate">{row.label}</dt>
                <dd className="min-w-0 text-sm">{row.render(e, qty)}</dd>
              </div>
            ))}
          {!excluded && mode === "details"
            ? LANDED_ROWS.map((type) => (
                <div key={type} className="grid grid-cols-[7.5rem_1fr] gap-2 px-3 py-2">
                  <dt className="text-xs text-slate">{LANDED_LINE_LABEL[type]}</dt>
                  <dd className="min-w-0 text-sm">
                    <LandedCell e={e} type={type} />
                  </dd>
                </div>
              ))
            : null}
        </dl>
      </details>
      {!excluded ? (
        <footer className="border-t-2 border-ink/20 p-3">
          <p className="text-xs text-slate">Estimated landed total</p>
          <LandedTotal e={e} />
        </footer>
      ) : null}
    </article>
  );
}

/**
 * Summary mode: one card per quote with the decision facts and, always, what is missing or why the quote is
 * not ranked. Facts come from compare-modes.ts (tested); money from compare-demo.ts.
 */
function SummaryCard({
  evaluated: e,
  qty,
  excluded,
  lowest,
  selected,
  onSelect,
  compared,
  onToggleCompare,
  onDetails,
}: {
  evaluated: EvaluatedQuote;
  qty: number;
  excluded: boolean;
  lowest: boolean;
  selected: boolean;
  onSelect: () => void;
  compared: boolean;
  onToggleCompare: () => void;
  onDetails: () => void;
}) {
  const f = summaryFacts(e);
  return (
    <li className="min-w-0">
      <article
        className={cx(
          "flex h-full flex-col rounded-(--fbg-radius-card) border bg-(--fbg-bg-surface) p-4",
          selected ? "border-(--fbg-action-primary)" : "border-(--fbg-border-subtle)",
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <button
            type="button"
            onClick={onSelect}
            aria-pressed={selected}
            className="min-w-0 text-left"
            title="Show this supplier's evidence"
          >
            <span
              className={cx(
                "block truncate text-[15px] font-semibold",
                excluded ? "text-(--fbg-text-secondary)" : "text-(--fbg-text-primary)",
              )}
            >
              {e.quote.supplier}
            </span>
            <span className="block text-[13px] text-(--fbg-text-secondary)">
              {e.quote.city} ·{" "}
              {e.quote.priceBasis === "unknown"
                ? "basis not stated"
                : `${e.quote.priceBasis} ${e.quote.basisPlace}`}{" "}
              · {e.quote.currency}
            </span>
          </button>
          {lowest ? (
            <Badge tone="teal" icon="check">
              Lowest in group
            </Badge>
          ) : null}
        </div>

        <div className="mt-3">
          {f.headline ? (
            <>
              <p className="fbg-num text-[22px] leading-7 font-semibold text-(--fbg-text-primary)">
                {f.headline}
              </p>
              <p className="fbg-num text-[12px] text-(--fbg-text-secondary)">
                comparable goods cost for {formatQty(qty)} pcs
                {f.unit ? ` · ${f.unit} per unit, ${f.tier}` : ""}
              </p>
            </>
          ) : (
            <p className="text-sm font-semibold text-(--fbg-status-danger)">Not ranked</p>
          )}
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          <Badge tone="teal" icon="check">
            {QUOTE_TYPE_LABEL[e.quote.quoteType] ?? e.quote.quoteType}
          </Badge>
          <Badge
            tone={f.validity.tone}
            icon={f.validity.tone === "neutral" ? "clock" : "alert"}
            className="fbg-num"
          >
            {f.validity.label}
          </Badge>
          {f.evidenceCount === 0 ? (
            <Badge tone="neutral" icon="info">
              No verification record
            </Badge>
          ) : (
            <Badge tone="ok" icon="shield">
              {f.evidenceCount} {f.evidenceCount === 1 ? "check" : "checks"} on file
            </Badge>
          )}
        </div>

        <dl className="mt-3 grid grid-cols-[6.5rem_1fr] gap-x-3 gap-y-1 text-[13px]">
          <dt className="text-(--fbg-text-secondary)">Lead time</dt>
          <dd className="fbg-num text-(--fbg-text-primary)">
            {e.quote.leadTimeDays !== null ? `${e.quote.leadTimeDays} days` : "Not stated"}
          </dd>
          <dt className="text-(--fbg-text-secondary)">Payment</dt>
          <dd className="truncate text-(--fbg-text-primary)">
            {e.quote.paymentTerms ?? "Not stated"}
          </dd>
          {!excluded ? (
            <>
              <dt className="text-(--fbg-text-secondary)">Landed total</dt>
              <dd className="fbg-num text-(--fbg-text-primary)">
                {f.landed.total ??
                  `Partial · ${f.landed.missingCount} ${f.landed.missingCount === 1 ? "line" : "lines"} missing`}
                {f.landed.estimatedCount > 0 ? (
                  <span className="text-(--fbg-text-secondary)">
                    {" "}
                    · {f.landed.estimatedCount} estimated
                  </span>
                ) : null}
              </dd>
            </>
          ) : null}
        </dl>

        <p className="mt-3 text-[13px] leading-5">
          <span className="font-medium text-(--fbg-text-primary)">
            {excluded ? "Why not ranked: " : "Missing: "}
          </span>
          {f.missing.length === 0 ? (
            <span className="text-(--fbg-status-success)">nothing, all inputs present</span>
          ) : (
            <span
              className={excluded ? "text-(--fbg-status-danger)" : "text-(--fbg-status-warning)"}
            >
              {f.missing.join(", ")}
            </span>
          )}
        </p>

        <div className="mt-4 flex items-center justify-between gap-2 border-t border-(--fbg-border-divider) pt-3">
          <label className="flex items-center gap-2 text-[13px] text-(--fbg-text-secondary)">
            <input
              type="checkbox"
              className="h-4 w-4 accent-(--fbg-action-primary)"
              checked={compared}
              onChange={onToggleCompare}
            />
            Compare
          </label>
          <button
            type="button"
            onClick={onDetails}
            className="inline-flex items-center gap-0.5 text-[13px] font-medium text-(--fbg-link) hover:underline"
          >
            Full details
            <Icon name="chevron-right" size={14} />
          </button>
        </div>
      </article>
    </li>
  );
}

function EvidenceDrawer({
  evaluated: e,
  onClarify,
  embedded,
}: {
  evaluated: EvaluatedQuote;
  onClarify: () => void;
  embedded?: boolean;
}) {
  return (
    <div className="flex flex-col gap-4">
      {!embedded ? (
        <div>
          <p className="text-xs text-slate">Evidence drawer</p>
          <h2 className="text-[15px] font-semibold text-ink">{e.quote.supplier}</h2>
          <p className="text-xs text-slate">
            {e.quote.city} · {e.quote.priceBasis} {e.quote.basisPlace}
          </p>
        </div>
      ) : null}
      <div>
        <p className="text-xs font-medium text-ink">Verification checks</p>
        {e.quote.evidence.length === 0 ? (
          <p className="mt-1 text-sm text-slate">
            No check record exists for this supplier. No badge is shown until one does.
          </p>
        ) : (
          <ul className="mt-1 flex flex-col gap-2">
            {e.quote.evidence.map((ev) => (
              <li
                key={ev.label}
                className="rounded-(--fbg-radius-control) border border-line p-2.5 text-sm"
              >
                <p className="font-medium text-ink">{ev.label}</p>
                <p className="mt-0.5 text-slate">{ev.what}</p>
                <p className="fbg-num mt-1 text-xs text-slate">
                  {ev.who} · {ev.when}
                  {ev.until ? ` · valid until ${ev.until}` : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div>
        <p className="text-xs font-medium text-ink">Not verified</p>
        <p className="mt-1 text-sm text-slate">
          Product tested: no record. Batch inspected: no record. Contacted ≠ identity reviewed ≠
          product tested ≠ batch inspected.
        </p>
      </div>
      <div>
        <p className="text-xs font-medium text-ink">Source document</p>
        <p className="mt-1 flex items-center gap-1 text-sm text-ink">
          <Icon name="document" size={14} className="text-slate" /> {e.quote.sourceRef}
        </p>
        <p className="fbg-num text-xs text-slate">
          Observed {e.quote.observedAt} · confirmed {e.quote.confirmedAt}
        </p>
      </div>
      <div>
        <p className="text-xs font-medium text-ink">Contact details</p>
        <p className="mt-1 flex items-start gap-1 text-sm text-slate">
          <Icon name="lock" size={14} className="mt-0.5 shrink-0" /> Hidden. Your organization holds
          no disclosure grant for this supplier; operators handle outreach.
        </p>
      </div>
      <Button icon="message" onClick={onClarify}>
        Request clarification
      </Button>
    </div>
  );
}
