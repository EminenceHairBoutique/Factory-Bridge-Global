"use client";

/**
 * Buyer: Landed cost scenarios (IA §2.2 `/app/projects/[id]/landed-cost`; QUOTE_ENGINE_SPEC
 * §2.5–§2.7; migration 0011). Saved snapshots are immutable: they carry the exact FX rows and
 * inputs. A new scenario picks quantity, as-of date, a freight estimate and a duty assumption,
 * shows the resolved FX rate, every landed-cost line per eligible quotation with its status and
 * source, "Estimated landed total" only when complete, "Partial — excludes: …" otherwise, and a
 * cross-term ranking only when every eligible total is complete. Local state only.
 */
import Link from "next/link";
import { useMemo, useState } from "react";
import { LANDED_LINE_LABEL, type LandedLineType } from "../demo-data";
import {
  DUTY_ASSUMPTIONS,
  FREIGHT_ESTIMATES,
  LANDED_PROJECT,
  LANDED_TODAY,
  SAVED_SNAPSHOTS,
  type SavedSnapshot,
  type ScenarioInputs,
} from "../demo-data/landed-cost";
import { formatMoney, formatQty } from "../compare-demo";
import {
  buildScenario,
  dutyAssumptionLabel,
  freightEstimateLabel,
  fxLabel,
  partialText,
  presentUsd,
  snapshotFrom,
  validateInputs,
  type ScenarioQuote,
} from "../landed-cost-demo";
import { AppShell } from "../ui/AppShell";
import {
  Badge,
  Button,
  buttonClasses,
  Field,
  KeyValue,
  Notice,
  PageHeader,
  Panel,
  SegmentedControl,
  Select,
  StatusChip,
  TextInput,
  cx,
} from "../ui/primitives";

const QTY_OPTIONS = [5_000, 10_000, 25_000] as const;

const DEFAULT_INPUTS: ScenarioInputs = {
  quantity: LANDED_PROJECT.briefQty,
  asOf: LANDED_TODAY,
  freightEstimateId: null,
  dutyAssumptionId: null,
};

export function BuyerLandedCost({ initialSnapshotId }: { initialSnapshotId?: string | undefined }) {
  const [snapshots, setSnapshots] = useState<SavedSnapshot[]>(SAVED_SNAPSHOTS);
  const [selected, setSelected] = useState<string>(
    initialSnapshotId && SAVED_SNAPSHOTS.some((s) => s.id === initialSnapshotId)
      ? initialSnapshotId
      : initialSnapshotId === "new"
        ? "new"
        : (SAVED_SNAPSHOTS[SAVED_SNAPSHOTS.length - 1]?.id ?? "new"),
  );
  const [inputs, setInputs] = useState<ScenarioInputs>(DEFAULT_INPUTS);
  const [log, setLog] = useState<string[]>([]);

  const snapshot = snapshots.find((s) => s.id === selected) ?? null;
  const activeInputs = snapshot ? snapshot.inputs : inputs;
  const check = useMemo(() => validateInputs(activeInputs, LANDED_TODAY), [activeInputs]);
  const result = useMemo(() => buildScenario(activeInputs), [activeInputs]);
  const eligible = result.quotes.filter((q) => q.totalStatus !== "not_ranked");
  const excluded = result.quotes.filter((q) => q.totalStatus === "not_ranked");
  const lineTypes: LandedLineType[] =
    (eligible[0] ?? result.quotes[0])?.evaluated.landed.map((l) => l.type) ?? [];
  const note = (line: string) =>
    setLog((l) => [`${new Date().toISOString().slice(11, 16)} · ${line}`, ...l]);

  const save = () => {
    if (Object.keys(check.errors).length > 0) return;
    const id = `sn_new_${snapshots.length + 1}`;
    const at = `${LANDED_TODAY} ${new Date().toISOString().slice(11, 16)}`;
    const s = snapshotFrom(inputs, result, id, "You (demo buyer)", at);
    setSnapshots((prev) => [...prev, s]);
    setSelected(id);
    note(
      `Saved snapshot ${id} (fx rows: ${s.fxRateIds.join(", ") || "none"}; inputs ${s.inputsHash})`,
    );
  };

  const duplicate = (s: SavedSnapshot) => {
    setInputs({ ...s.inputs, asOf: LANDED_TODAY });
    setSelected("new");
    note(`Started a new scenario from ${s.id} with today's as-of date`);
  };

  const rightRail = (
    <div className="flex flex-col gap-5 text-sm">
      <div>
        <p className="text-xs text-(--fbg-text-secondary)">Evidence drawer</p>
        <p className="text-[15px] font-semibold text-(--fbg-text-primary)">
          How a line gets its status
        </p>
      </div>
      <ul className="flex flex-col gap-1.5 text-xs text-(--fbg-text-secondary)">
        <li>
          <span className="text-(--fbg-text-primary)">Sourced</span>: a quotation or a written
          freight quote with its document attached.
        </li>
        <li>
          <span className="text-(--fbg-text-primary)">Estimated</span>: a forwarder email, a manual
          entry or a duty assumption. Shown, summed, labelled.
        </li>
        <li>
          <span className="text-(--fbg-text-primary)">Missing</span>: nothing on file for a line the
          trade term requires. The total stays partial and is never ranked.
        </li>
        <li>
          <span className="text-(--fbg-text-primary)">n/a</span>: the trade term already includes it
          (for example CIF includes freight), so an estimate is kept but never summed.
        </li>
      </ul>
      <div>
        <p className="text-xs font-semibold text-(--fbg-text-primary)">FX</p>
        <p className="mt-1 text-xs text-(--fbg-text-secondary)">
          The reference rate dated as-of, else the latest earlier rate within 3 days, else no USD
          conversion. Originals are never overwritten; the rate row is cited on every snapshot.
        </p>
      </div>
      <div>
        <p className="text-xs font-semibold text-(--fbg-text-primary)">Duties</p>
        <p className="mt-1 text-xs text-(--fbg-text-secondary)">
          Computed only from an assumption a person recorded with a rate and a basis. Nothing fills
          it for you; classification advice comes from a licensed customs broker.
        </p>
      </div>
      <div>
        <p className="text-xs font-semibold text-(--fbg-text-primary)">Snapshots</p>
        <p className="mt-1 text-xs text-(--fbg-text-secondary)">
          Immutable. A later rate, estimate or quotation version never changes a saved snapshot;
          change the inputs and save a new one.
        </p>
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
    <AppShell workspace="buyer" title="Landed cost" rightRail={rightRail}>
      <div className="flex flex-col gap-5">
        <PageHeader
          title="Landed cost scenarios"
          lead="What each eligible quotation would cost delivered, line by line, with every line's status and source. A total appears only when nothing required is missing; quotations on different trade terms are ranked against each other only then."
          meta={
            <>
              <Badge tone="neutral" icon={null}>
                {LANDED_PROJECT.name}
              </Badge>
              <Badge tone="neutral" icon={null} className="fbg-num">
                Brief quantity {formatQty(LANDED_PROJECT.briefQty)} {LANDED_PROJECT.unit}
              </Badge>
              <Badge tone="neutral" icon="clock" className="fbg-num">
                Today {LANDED_TODAY}
              </Badge>
            </>
          }
          actions={
            <>
              <Link href="/design-preview/buyer/compare" className={buttonClasses("secondary")}>
                Open comparison
              </Link>
              <Button
                variant="primary"
                icon="plus"
                onClick={() => setSelected("new")}
                aria-pressed={selected === "new"}
              >
                New scenario
              </Button>
            </>
          }
        />

        <div className="grid gap-4 xl:grid-cols-[17rem_minmax(0,1fr)]">
          <div className="flex min-w-0 flex-col gap-2">
            <p className="text-xs font-semibold text-(--fbg-text-primary)">Snapshots</p>
            <Panel padded={false}>
              <ul className="divide-y divide-(--fbg-border-subtle)">
                <li>
                  <button
                    type="button"
                    onClick={() => setSelected("new")}
                    aria-pressed={selected === "new"}
                    className={cx(
                      "flex w-full min-w-0 flex-col gap-1 px-3 py-2.5 text-left hover:bg-(--fbg-bg-canvas)",
                      selected === "new" && "bg-(--fbg-selected)",
                    )}
                  >
                    <span className="text-[13px] font-medium text-(--fbg-text-primary)">
                      New scenario
                    </span>
                    <span className="text-[11px] text-(--fbg-text-secondary)">
                      Not saved; edit the inputs below.
                    </span>
                  </button>
                </li>
                {[...snapshots].reverse().map((s) => {
                  const r = buildScenario(s.inputs);
                  const complete = r.quotes.filter((q) => q.totalStatus === "complete").length;
                  const partial = r.quotes.filter((q) => q.totalStatus === "partial").length;
                  return (
                    <li key={s.id}>
                      <button
                        type="button"
                        onClick={() => setSelected(s.id)}
                        aria-pressed={selected === s.id}
                        className={cx(
                          "flex w-full min-w-0 flex-col gap-1 px-3 py-2.5 text-left hover:bg-(--fbg-bg-canvas)",
                          selected === s.id && "bg-(--fbg-selected)",
                        )}
                      >
                        <span className="flex flex-wrap items-center gap-1.5">
                          <Badge tone={r.ranking ? "ok" : "warn"} icon={null} className="fbg-num">
                            {complete} complete · {partial} partial
                          </Badge>
                          {r.ranking ? (
                            <Badge tone="teal" icon="check">
                              Ranked
                            </Badge>
                          ) : null}
                        </span>
                        <span className="text-[13px] font-medium text-(--fbg-text-primary)">
                          {s.name}
                        </span>
                        <span className="fbg-num text-[11px] text-(--fbg-text-secondary)">
                          as of {s.inputs.asOf} · saved {s.generatedAt}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </Panel>
          </div>

          <div className="flex min-w-0 flex-col gap-4">
            {snapshot ? (
              <Panel
                title={snapshot.name}
                description="Saved snapshot. Immutable: the exact FX rows and inputs it was generated with."
              >
                <KeyValue
                  columns={2}
                  items={[
                    {
                      label: "Quantity",
                      value: `${formatQty(snapshot.inputs.quantity)} ${LANDED_PROJECT.unit}`,
                    },
                    { label: "As of", value: snapshot.inputs.asOf },
                    { label: "FX", value: fxLabel(result.fx, snapshot.inputs.asOf) },
                    {
                      label: "FX rows cited",
                      value: snapshot.fxRateIds.join(", ") || "none (missing_fx)",
                    },
                    {
                      label: "Freight estimate",
                      value: result.freight
                        ? `${freightEstimateLabel(result.freight)} — ${result.freight.id}`
                        : "None",
                    },
                    {
                      label: "Duty assumption",
                      value: result.duty
                        ? `${dutyAssumptionLabel(result.duty)} — ${result.duty.id}`
                        : "None",
                    },
                    {
                      label: "Generated",
                      value: `${snapshot.generatedAt} by ${snapshot.generatedBy}`,
                    },
                    {
                      label: "Engine and inputs",
                      value: `${snapshot.engineVersion} · inputs ${snapshot.inputsHash}`,
                    },
                  ]}
                />
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button size="sm" icon="plus" onClick={() => duplicate(snapshot)}>
                    New scenario from these inputs
                  </Button>
                  <Link
                    href={`/design-preview/buyer/reports?qty=${snapshot.inputs.quantity}`}
                    className={buttonClasses("ghost", "sm")}
                  >
                    Reports
                  </Link>
                </div>
              </Panel>
            ) : (
              <Panel
                title="New scenario"
                description="Pick the inputs; every line below updates. Save to record an immutable snapshot with the FX rows it used."
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="flex flex-col gap-1 md:col-span-2">
                    <span className="text-xs font-semibold text-(--fbg-text-primary)">
                      Quantity
                    </span>
                    <SegmentedControl
                      label="Quantity"
                      size="sm"
                      value={String(inputs.quantity)}
                      onChange={(v) => setInputs({ ...inputs, quantity: Number(v) })}
                      options={QTY_OPTIONS.map((q) => ({
                        value: String(q),
                        label: `${formatQty(q)} ${LANDED_PROJECT.unit}`,
                      }))}
                    />
                  </div>
                  <Field
                    label="As of"
                    required
                    htmlFor="lc-asof"
                    error={check.errors.asOf}
                    hint={fxLabel(result.fx, inputs.asOf)}
                  >
                    <TextInput
                      id="lc-asof"
                      type="date"
                      value={inputs.asOf}
                      onChange={(e) => setInputs({ ...inputs, asOf: e.target.value })}
                    />
                  </Field>
                  <Field
                    label="Freight estimate"
                    htmlFor="lc-freight"
                    error={check.errors.freightEstimateId}
                    hint={result.freight?.notes}
                  >
                    <Select
                      id="lc-freight"
                      value={inputs.freightEstimateId ?? ""}
                      onChange={(e) =>
                        setInputs({ ...inputs, freightEstimateId: e.target.value || null })
                      }
                    >
                      <option value="">None — freight lines stay missing</option>
                      {FREIGHT_ESTIMATES.map((f) => (
                        <option key={f.id} value={f.id}>
                          {freightEstimateLabel(f)}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field
                    label="Duty assumption"
                    htmlFor="lc-duty"
                    error={check.errors.dutyAssumptionId}
                    hint={
                      result.duty
                        ? `${result.duty.notes} Recorded by ${result.duty.createdBy}, ${result.duty.createdAt}.`
                        : "Recorded by a person with a basis; nothing fills it for you."
                    }
                    className="md:col-span-2"
                  >
                    <Select
                      id="lc-duty"
                      value={inputs.dutyAssumptionId ?? ""}
                      onChange={(e) =>
                        setInputs({ ...inputs, dutyAssumptionId: e.target.value || null })
                      }
                    >
                      <option value="">None — duties line stays missing</option>
                      {DUTY_ASSUMPTIONS.map((d) => (
                        <option key={d.id} value={d.id}>
                          {dutyAssumptionLabel(d)}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>
                {check.warnings.length > 0 ? (
                  <ul className="mt-3 flex flex-col gap-1 text-xs text-(--fbg-status-warn)">
                    {check.warnings.map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                ) : null}
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Button
                    variant="primary"
                    icon="check"
                    disabled={Object.keys(check.errors).length > 0}
                    onClick={save}
                  >
                    Save snapshot
                  </Button>
                  <span className="text-xs text-(--fbg-text-secondary)">
                    Records the inputs and the FX rows used; cannot be edited afterwards.
                  </span>
                </div>
              </Panel>
            )}

            {result.ranking ? (
              <Notice
                tone="ok"
                icon="check"
                title="Lowest estimated landed cost (all inputs present)"
              >
                {result.ranking
                  .map((id) => result.quotes.find((q) => q.evaluated.quote.id === id)!)
                  .map(
                    (q, i) =>
                      `${i + 1}. ${q.evaluated.quote.supplier} ${presentUsd(q.landedTotalUsd ?? 0)}`,
                  )
                  .join(" · ")}
                . Estimated lines are included and labelled; this is not a quotation.
              </Notice>
            ) : (
              <Notice tone="warn" icon="alert" title="Cross-term ranking unavailable">
                {eligible.length < 2
                  ? "Fewer than two eligible quotations."
                  : `Required lines are still missing for ${result.blockedBy.join(", ")}. Totals stay partial and are never ranked.`}
              </Notice>
            )}

            <Panel
              title="Landed-cost lines"
              description="Per eligible quotation, for the scenario quantity. Amounts in USD at the cited rate; hover a line for its source."
              padded={false}
            >
              {eligible.length === 0 ? (
                <p className="px-5 py-4 text-sm text-(--fbg-text-secondary)">
                  No eligible quotations for this quantity and date.
                </p>
              ) : (
                <>
                  <div className="hidden overflow-x-auto md:block">
                    <table className="w-full min-w-[40rem] text-sm">
                      <thead className="bg-(--fbg-bg-canvas) text-xs text-(--fbg-text-secondary)">
                        <tr>
                          <th scope="col" className="px-4 py-2 text-left font-medium">
                            Line
                          </th>
                          {eligible.map((q) => (
                            <th
                              key={q.evaluated.quote.id}
                              scope="col"
                              className="px-4 py-2 text-right font-medium"
                            >
                              <span className="block text-(--fbg-text-primary)">
                                {q.evaluated.quote.supplier}
                              </span>
                              <span className="fbg-num block">
                                {q.evaluated.quote.priceBasis} {q.evaluated.quote.basisPlace ?? ""}{" "}
                                · {q.evaluated.quote.currency}
                              </span>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-(--fbg-border-subtle)">
                        {lineTypes.map((type) => (
                          <tr key={type} className="[&>td]:px-4 [&>td]:py-2 [&>td]:align-top">
                            <td className="text-(--fbg-text-primary)">{LANDED_LINE_LABEL[type]}</td>
                            {eligible.map((q) => {
                              const line = q.evaluated.landed.find((l) => l.type === type)!;
                              return (
                                <td
                                  key={q.evaluated.quote.id}
                                  className="text-right"
                                  title={line.source ?? undefined}
                                >
                                  <LineCell
                                    line={line}
                                    original={type === "goods" ? q.evaluated : null}
                                  />
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="border-t border-(--fbg-border-strong) text-sm">
                        <tr className="[&>td]:px-4 [&>td]:py-3 [&>td]:align-top">
                          <td className="font-medium text-(--fbg-text-primary)">
                            Estimated landed total
                          </td>
                          {eligible.map((q) => (
                            <td key={q.evaluated.quote.id} className="text-right">
                              <TotalCell q={q} />
                            </td>
                          ))}
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                  <ul className="divide-y divide-(--fbg-border-subtle) md:hidden">
                    {eligible.map((q) => (
                      <li key={q.evaluated.quote.id} className="flex flex-col gap-2 px-4 py-3">
                        <p className="text-[15px] font-medium text-(--fbg-text-primary)">
                          {q.evaluated.quote.supplier}
                        </p>
                        <p className="fbg-num text-xs text-(--fbg-text-secondary)">
                          {q.evaluated.quote.priceBasis} {q.evaluated.quote.basisPlace ?? ""} ·{" "}
                          {q.evaluated.quote.currency}
                        </p>
                        <dl className="flex flex-col gap-1.5">
                          {q.evaluated.landed.map((line) => (
                            <div
                              key={line.type}
                              className="flex items-start justify-between gap-3 text-sm"
                            >
                              <dt className="text-(--fbg-text-secondary)">
                                {LANDED_LINE_LABEL[line.type]}
                              </dt>
                              <dd className="text-right">
                                <LineCell
                                  line={line}
                                  original={line.type === "goods" ? q.evaluated : null}
                                />
                              </dd>
                            </div>
                          ))}
                        </dl>
                        <div className="flex items-start justify-between gap-3 border-t border-(--fbg-border-subtle) pt-2 text-sm">
                          <span className="font-medium text-(--fbg-text-primary)">
                            Estimated landed total
                          </span>
                          <span className="text-right">
                            <TotalCell q={q} />
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </Panel>

            <Panel title="Why each quotation stands where it does" padded={false}>
              <ul className="divide-y divide-(--fbg-border-subtle)">
                {result.quotes.map((q) => (
                  <li key={q.evaluated.quote.id} className="px-5 py-3 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-(--fbg-text-primary)">
                        {q.evaluated.quote.supplier}
                      </span>
                      <Badge
                        tone={
                          q.totalStatus === "complete"
                            ? "ok"
                            : q.totalStatus === "partial"
                              ? "warn"
                              : "neutral"
                        }
                        icon={null}
                      >
                        {q.totalStatus === "complete"
                          ? "Complete"
                          : q.totalStatus === "partial"
                            ? "Partial"
                            : "Not ranked"}
                      </Badge>
                      {q.eligibleForRanking ? (
                        <Badge tone="teal" icon={null}>
                          Eligible for ranking
                        </Badge>
                      ) : null}
                    </div>
                    {q.explanations.length > 0 ? (
                      <ul className="mt-1 list-disc pl-5 text-xs text-(--fbg-text-secondary)">
                        {q.explanations.map((e) => (
                          <li key={e}>{e}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-1 text-xs text-(--fbg-text-secondary)">
                        Every required line is sourced.
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </Panel>

            {excluded.length > 0 ? (
              <p className="text-xs text-(--fbg-text-secondary)">
                Not ranked here: {excluded.map((q) => q.evaluated.quote.supplier).join(", ")}. Their
                reasons are listed above and on the comparison.
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function LineCell({
  line,
  original,
}: {
  line: ScenarioQuote["evaluated"]["landed"][number];
  original: ScenarioQuote["evaluated"] | null;
}) {
  return (
    <span className="inline-flex flex-col items-end gap-0.5">
      <span className="fbg-num text-(--fbg-text-primary)">
        {line.status === "missing"
          ? "—"
          : line.status === "not_applicable"
            ? "n/a"
            : presentUsd(line.amountUsd ?? 0)}
      </span>
      {original && original.goodsOriginal !== null && original.quote.currency === "CNY" ? (
        <span className="fbg-num text-[11px] text-(--fbg-text-secondary)">
          {formatMoney(original.goodsOriginal, "CNY")} original
        </span>
      ) : null}
      {line.status !== "not_applicable" ? <StatusChip status={line.status} /> : null}
    </span>
  );
}

function TotalCell({ q }: { q: ScenarioQuote }) {
  if (q.totalStatus === "complete" && q.landedTotalUsd !== null)
    return (
      <span className="inline-flex flex-col items-end gap-0.5">
        <span className="fbg-num font-semibold text-(--fbg-text-primary)">
          {presentUsd(q.landedTotalUsd)}
        </span>
        <Badge tone={q.evaluated.estimatedLines.length > 0 ? "warn" : "ok"} icon={null}>
          {q.evaluated.estimatedLines.length > 0
            ? `${q.evaluated.estimatedLines.length} estimated`
            : "All sourced"}
        </Badge>
      </span>
    );
  return (
    <span className="text-xs text-(--fbg-status-danger)">
      {partialText(q.evaluated.missingLines)}
    </span>
  );
}
