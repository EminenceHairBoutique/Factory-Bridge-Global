"use client";

/**
 * Internal operations: Research inbox (IA §2.4 `/ops/research`; PRD US-O1; BACKLOG B-09;
 * INTEGRATIONS row S1). Typed observations from manual research, never scraped and never shown
 * to buyers. A lead list ordered fresh-first, the lead's observation facts with their freshness,
 * "Record a lead" with the 0005 rules, and the handoff into supplier creation. Local state only.
 */
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  RESEARCH_LEADS,
  RESEARCH_TODAY,
  SOURCE_SYSTEMS,
  TAXONOMIES,
  type ResearchLead,
} from "../demo-data/research-leads";
import {
  EMPTY_LEAD_INPUT,
  INTERNAL_ONLY_TEXT,
  leadFreshness,
  leadFromInput,
  leadSummary,
  priceRangeText,
  sortLeads,
  sourceSystem,
  validateLead,
  type LeadInput,
} from "../ops-crm-demo";
import { AppShell } from "../ui/AppShell";
import {
  Badge,
  Button,
  buttonClasses,
  EmptyState,
  Field,
  KeyValue,
  Notice,
  PageHeader,
  Panel,
  SegmentedControl,
  Select,
  TextArea,
  TextInput,
  cx,
} from "../ui/primitives";

type Filter = "open" | "linked" | "dismissed" | "all";

const STATUS_LABEL = { new: "New", linked: "Supplier created", dismissed: "Dismissed" } as const;
const STATUS_TONE = { new: "warn", linked: "ok", dismissed: "neutral" } as const;

export function OpsResearchInbox({ initialLeadId }: { initialLeadId?: string | undefined }) {
  const [leads, setLeads] = useState<ResearchLead[]>(RESEARCH_LEADS);
  const [filter, setFilter] = useState<Filter>("open");
  const [selectedId, setSelectedId] = useState<string | null>(
    initialLeadId && RESEARCH_LEADS.some((l) => l.id === initialLeadId)
      ? initialLeadId
      : (sortLeads(RESEARCH_LEADS, RESEARCH_TODAY)[0]?.id ?? null),
  );
  const [recording, setRecording] = useState(false);
  const [input, setInput] = useState<LeadInput>(EMPTY_LEAD_INPUT);
  const [touched, setTouched] = useState(false);
  const [dismissReason, setDismissReason] = useState("");
  const [log, setLog] = useState<string[]>([]);

  const summary = useMemo(() => leadSummary(leads, RESEARCH_TODAY), [leads]);
  const rows = useMemo(
    () =>
      sortLeads(leads, RESEARCH_TODAY).filter((l) =>
        filter === "all" ? true : filter === "open" ? l.status === "new" : l.status === filter,
      ),
    [leads, filter],
  );
  const lead = leads.find((l) => l.id === selectedId) ?? null;
  const errors = validateLead(input, RESEARCH_TODAY);
  const note = (line: string) =>
    setLog((l) => [`${new Date().toISOString().slice(11, 16)} · ${line}`, ...l]);

  const saveLead = () => {
    setTouched(true);
    if (Object.keys(errors).length > 0) return;
    const id = `rl_new_${leads.length + 1}`;
    const created = leadFromInput(input, id, "Operator (demo)");
    setLeads((prev) => [created, ...prev]);
    setSelectedId(id);
    setInput(EMPTY_LEAD_INPUT);
    setTouched(false);
    setRecording(false);
    setFilter("open");
    note(
      `Recorded lead ${id} (${sourceSystem(created.sourceSystem)?.provider ?? created.sourceSystem}; internal only)`,
    );
  };

  const dismiss = (l: ResearchLead) => {
    if (!dismissReason.trim()) return;
    setLeads((prev) =>
      prev.map((x) =>
        x.id === l.id ? { ...x, status: "dismissed", dismissedReason: dismissReason.trim() } : x,
      ),
    );
    setDismissReason("");
    setFilter((f) => (f === "open" ? "all" : f));
    note(`Dismissed ${l.id}: ${dismissReason.trim()}`);
  };

  const set = (patch: Partial<LeadInput>) => setInput((i) => ({ ...i, ...patch }));

  const rightRail = (
    <div className="flex flex-col gap-5 text-sm">
      <div>
        <p className="text-xs text-(--fbg-text-secondary)">Evidence drawer</p>
        <p className="text-[15px] font-semibold text-(--fbg-text-primary)">
          What a lead is, and is not
        </p>
      </div>
      <ul className="flex flex-col gap-1.5 text-xs text-(--fbg-text-secondary)">
        <li>
          A human read a listing and typed what they saw. No page copies, no images, no bulk
          capture.
        </li>
        <li>
          Prices are indicative listings, never offers. They go stale after 30 days and never reach
          a buyer.
        </li>
        <li>
          Rights class is always internal market observation. A lead may inform an RFQ; it is never
          used as-is.
        </li>
        <li>
          Creating a supplier from a lead starts the record at Lead identified with claimed fields
          only.
        </li>
      </ul>
      <div>
        <p className="text-xs font-semibold text-(--fbg-text-primary)">Source register</p>
        <ul className="mt-1 flex flex-col gap-1 text-xs text-(--fbg-text-secondary)">
          {SOURCE_SYSTEMS.map((s) => (
            <li key={s.code} className="flex items-start gap-2">
              <Badge tone={s.status === "blocked" ? "danger" : "neutral"} icon={null}>
                {s.status === "blocked" ? "Blocked" : "Manual"}
              </Badge>
              <span>
                <span className="text-(--fbg-text-primary)">{s.provider}</span> — {s.note}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <p className="text-xs font-semibold text-(--fbg-text-primary)">Actions this session</p>
        {log.length === 0 ? (
          <p className="mt-1 text-xs text-(--fbg-text-secondary)">Nothing yet.</p>
        ) : (
          <ul className="mt-1 flex flex-col gap-1 text-xs text-(--fbg-text-secondary)">
            {log.map((l, i) => (
              <li key={`${l}-${i}`} className="fbg-num">
                {l}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );

  return (
    <AppShell workspace="ops" title="Research inbox" rightRail={rightRail}>
      <div className="flex flex-col gap-5">
        <Notice tone="ink" icon="lock" title={INTERNAL_ONLY_TEXT}>
          Research leads are typed observations from manual reading of 1688, Taobao and Weidian
          listings or from referrals. They are never offers, never buyer-visible, and never copied
          from the page.
        </Notice>

        <PageHeader
          title="Research inbox"
          lead="Record what you read, decide whether it becomes a supplier record, and keep the indicative prices internal."
          meta={
            <>
              <Badge tone="warn" icon={null} className="fbg-num">
                {summary.open} open
              </Badge>
              <Badge
                tone={summary.stale > 0 ? "danger" : "neutral"}
                icon="clock"
                className="fbg-num"
              >
                {summary.stale} stale
              </Badge>
              <Badge tone="ok" icon="check" className="fbg-num">
                {summary.linked} became suppliers
              </Badge>
              <Badge tone="neutral" icon={null} className="fbg-num">
                As of {RESEARCH_TODAY}
              </Badge>
            </>
          }
          actions={
            <>
              <Link href="/design-preview/ops/suppliers" className={buttonClasses("secondary")}>
                Suppliers
              </Link>
              <Button
                variant="primary"
                icon="plus"
                onClick={() => setRecording((v) => !v)}
                aria-expanded={recording}
              >
                Record a lead
              </Button>
            </>
          }
        />

        {recording ? (
          <Panel
            title="Record a lead"
            description="Required: where you read it, the reference, the Chinese search term and the date. Prices and MOQ are what the listing showed, not a quote."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <Field
                label="Product family"
                required
                htmlFor="lead-taxonomy"
                error={touched ? errors.taxonomy : undefined}
              >
                <Select
                  id="lead-taxonomy"
                  value={input.taxonomy}
                  onChange={(e) => set({ taxonomy: e.target.value })}
                >
                  <option value="">Choose</option>
                  {TAXONOMIES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field
                label="Read on"
                required
                htmlFor="lead-source"
                error={touched ? errors.sourceSystem : undefined}
                hint={sourceSystem(input.sourceSystem)?.note}
              >
                <Select
                  id="lead-source"
                  value={input.sourceSystem}
                  onChange={(e) => set({ sourceSystem: e.target.value })}
                >
                  <option value="">Choose</option>
                  {SOURCE_SYSTEMS.map((s) => (
                    <option key={s.code} value={s.code}>
                      {s.provider}
                      {s.status === "blocked" ? " (blocked)" : ""}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field
                label="Listing URL or reference"
                required
                htmlFor="lead-ref"
                error={touched ? errors.referenceUrl : undefined}
                className="md:col-span-2"
              >
                <TextInput
                  id="lead-ref"
                  value={input.referenceUrl}
                  onChange={(e) => set({ referenceUrl: e.target.value })}
                  placeholder="https://… or the seller's reference"
                />
              </Field>
              <Field
                label="Search term (Chinese)"
                required
                htmlFor="lead-term"
                error={touched ? errors.searchTermZh : undefined}
              >
                <TextInput
                  id="lead-term"
                  lang="zh-CN"
                  value={input.searchTermZh}
                  onChange={(e) => set({ searchTermZh: e.target.value })}
                  placeholder="不干胶标签 定制"
                />
              </Field>
              <Field label="Listing title (Chinese)" htmlFor="lead-title">
                <TextInput
                  id="lead-title"
                  lang="zh-CN"
                  value={input.titleZh}
                  onChange={(e) => set({ titleZh: e.target.value })}
                />
              </Field>
              <Field
                label="Observed price from (CNY)"
                htmlFor="lead-min"
                error={touched ? errors.observedMinPrice : undefined}
              >
                <TextInput
                  id="lead-min"
                  inputMode="decimal"
                  value={input.observedMinPrice}
                  onChange={(e) => set({ observedMinPrice: e.target.value })}
                  placeholder="0.03"
                />
              </Field>
              <Field
                label="Observed price to (CNY)"
                htmlFor="lead-max"
                error={touched ? errors.observedMaxPrice : undefined}
              >
                <TextInput
                  id="lead-max"
                  inputMode="decimal"
                  value={input.observedMaxPrice}
                  onChange={(e) => set({ observedMaxPrice: e.target.value })}
                  placeholder="0.08"
                />
              </Field>
              <Field
                label="Observed MOQ"
                htmlFor="lead-moq"
                error={touched ? errors.observedMoq : undefined}
              >
                <TextInput
                  id="lead-moq"
                  inputMode="numeric"
                  value={input.observedMoq}
                  onChange={(e) => set({ observedMoq: e.target.value })}
                  placeholder="10000"
                />
              </Field>
              <Field label="Unit" htmlFor="lead-unit">
                <TextInput
                  id="lead-unit"
                  value={input.observedUnit}
                  onChange={(e) => set({ observedUnit: e.target.value })}
                />
              </Field>
              <Field
                label="Observed on"
                required
                htmlFor="lead-date"
                error={touched ? errors.observedAt : undefined}
              >
                <TextInput
                  id="lead-date"
                  type="date"
                  max={RESEARCH_TODAY}
                  value={input.observedAt}
                  onChange={(e) => set({ observedAt: e.target.value })}
                />
              </Field>
              <Field
                label="Rights class"
                htmlFor="lead-rights"
                hint="Fixed by the table constraint."
              >
                <TextInput
                  id="lead-rights"
                  value="internal_market_observation — internal only, not buyer-visible"
                  readOnly
                />
              </Field>
              <Field
                label="Notes"
                htmlFor="lead-notes"
                className="md:col-span-2"
                hint="Your own words only. Do not paste the listing text."
              >
                <TextArea
                  id="lead-notes"
                  rows={2}
                  value={input.notes}
                  onChange={(e) => set({ notes: e.target.value })}
                />
              </Field>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button variant="primary" icon="check" onClick={saveLead}>
                Save lead
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setRecording(false);
                  setTouched(false);
                }}
              >
                Cancel
              </Button>
              {touched && Object.keys(errors).length > 0 ? (
                <span className="text-xs text-(--fbg-status-danger)">
                  Fix the fields marked above.
                </span>
              ) : null}
            </div>
          </Panel>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-[17rem_minmax(0,1fr)]">
          <div className="flex min-w-0 flex-col gap-2">
            <SegmentedControl
              label="Lead filter"
              size="sm"
              value={filter}
              onChange={setFilter}
              options={[
                { value: "open", label: "Open" },
                { value: "linked", label: "Suppliers" },
                { value: "dismissed", label: "Dismissed" },
                { value: "all", label: "All" },
              ]}
            />
            <Panel padded={false}>
              {rows.length === 0 ? (
                <div className="p-5">
                  <EmptyState
                    title="No leads here"
                    body="Record a lead or change the filter."
                    icon="search"
                  />
                </div>
              ) : (
                <ul className="divide-y divide-(--fbg-border-subtle)">
                  {rows.map((l) => {
                    const fresh = leadFreshness(l.observedAt, RESEARCH_TODAY);
                    const active = l.id === selectedId;
                    return (
                      <li key={l.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedId(l.id)}
                          aria-pressed={active}
                          className={cx(
                            "flex w-full min-w-0 flex-col gap-1 px-3 py-2.5 text-left hover:bg-(--fbg-bg-canvas)",
                            active && "bg-(--fbg-selected)",
                          )}
                        >
                          <span className="flex min-w-0 flex-wrap items-center gap-1.5">
                            <Badge tone={STATUS_TONE[l.status]} icon={null}>
                              {STATUS_LABEL[l.status]}
                            </Badge>
                            {l.status === "new" ? (
                              <Badge
                                tone={fresh.state === "stale" ? "danger" : "neutral"}
                                icon="clock"
                                className="fbg-num"
                              >
                                {fresh.label}
                              </Badge>
                            ) : null}
                          </span>
                          <span
                            className="fbg-zh text-[13px] font-medium text-(--fbg-text-primary)"
                            lang="zh-CN"
                          >
                            {l.titleZh || l.searchTermZh}
                          </span>
                          <span className="truncate text-[11px] text-(--fbg-text-secondary)">
                            {l.taxonomy} ·{" "}
                            {sourceSystem(l.sourceSystem)?.provider ?? l.sourceSystem} ·{" "}
                            {priceRangeText(l)}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Panel>
          </div>

          <div className="flex min-w-0 flex-col gap-4">
            {lead ? (
              <LeadDetail
                lead={lead}
                dismissReason={dismissReason}
                onDismissReason={setDismissReason}
                onDismiss={() => dismiss(lead)}
              />
            ) : (
              <EmptyState
                title="Select a lead"
                body="Fresh leads are listed first."
                icon="search"
              />
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function LeadDetail({
  lead,
  dismissReason,
  onDismissReason,
  onDismiss,
}: {
  lead: ResearchLead;
  dismissReason: string;
  onDismissReason: (v: string) => void;
  onDismiss: () => void;
}) {
  const fresh = leadFreshness(lead.observedAt, RESEARCH_TODAY);
  const sys = sourceSystem(lead.sourceSystem);
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="fbg-zh text-[17px] font-semibold text-(--fbg-text-primary)" lang="zh-CN">
            {lead.titleZh || lead.searchTermZh}
          </h2>
          <p className="fbg-num text-xs text-(--fbg-text-secondary)">
            {lead.taxonomy} · {sys?.provider ?? lead.sourceSystem} · recorded by {lead.recordedBy} ·{" "}
            {lead.id}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={STATUS_TONE[lead.status]} icon={null}>
            {STATUS_LABEL[lead.status]}
          </Badge>
          {lead.status === "new" ? (
            <Link
              href={`/design-preview/ops/suppliers?new=1&lead=${lead.id}`}
              className={buttonClasses("primary", "sm")}
            >
              Create supplier from lead
            </Link>
          ) : null}
          {lead.status === "linked" && lead.linkedSupplierId ? (
            <Link
              href={`/design-preview/ops/supplier?id=${lead.linkedSupplierId}`}
              className={buttonClasses("secondary", "sm")}
            >
              Open supplier
            </Link>
          ) : null}
        </div>
      </div>

      <Panel
        title="Observation"
        description="Typed by the operator from the listing. Reference only; nothing was copied."
      >
        <KeyValue
          columns={2}
          items={[
            {
              label: "Read on",
              value: `${sys?.provider ?? lead.sourceSystem} (${sys?.status ?? "unknown"})`,
            },
            { label: "Reference", value: <span className="break-all">{lead.referenceUrl}</span> },
            { label: "Search term", value: lead.searchTermZh },
            { label: "Listing title", value: lead.titleZh || "—" },
            {
              label: "Indicative price",
              value: `${priceRangeText(lead)} · ${fresh.label}${fresh.state === "stale" ? " · do not use for estimates" : ""}`,
            },
            {
              label: "Observed MOQ",
              value: lead.observedMoq
                ? `${lead.observedMoq.toLocaleString("en-US")} ${lead.observedUnit}`
                : "—",
            },
            { label: "Observed on", value: lead.observedAt },
            { label: "Rights class", value: "internal_market_observation (internal only)" },
          ]}
        />
        {lead.notes ? <p className="mt-3 text-sm text-(--fbg-text-primary)">{lead.notes}</p> : null}
      </Panel>

      <Panel title="What happens next">
        {lead.status === "new" ? (
          <div className="flex flex-col gap-3 text-sm text-(--fbg-text-primary)">
            <p>
              Creating a supplier from this lead opens the supplier form with the family and origin
              filled in. The legal name comes from the licence, not from the listing title. The
              lead's prices stay here as an internal reference.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
              <TextInput
                aria-label="Dismiss reason"
                value={dismissReason}
                onChange={(e) => onDismissReason(e.target.value)}
                placeholder="Dismiss with a reason (for example: not a manufacturer)"
                className="sm:flex-1"
              />
              <Button
                size="sm"
                variant="secondary"
                disabled={dismissReason.trim().length === 0}
                onClick={onDismiss}
              >
                Dismiss lead
              </Button>
            </div>
          </div>
        ) : lead.status === "linked" ? (
          <p className="text-sm text-(--fbg-text-primary)">
            A supplier record was created from this lead; the lead document sits on that record as
            internal-only manual research.
          </p>
        ) : (
          <p className="text-sm text-(--fbg-text-primary)">Dismissed: {lead.dismissedReason}</p>
        )}
      </Panel>
    </>
  );
}
