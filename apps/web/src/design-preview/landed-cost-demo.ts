/**
 * Display-only rules for the buyer's landed-cost scenarios. They mirror migration 0011
 * `fx_landed_cost` and QUOTE_ENGINE_SPEC §2.5–§2.7: the FX lookup (the rate dated as-of, else the
 * latest earlier rate within 3 days, else missing_fx), freight lines whose status mirrors the
 * estimate ("sourced" only with a quote document attached), duties computed only from a
 * person-recorded assumption with a rate and a basis (AI never fills it), partial totals that
 * are never a number and never ranked, and immutable snapshots that carry the exact fx rows and
 * inputs. The authoritative engine lives in `packages/domain`; this module only visualises it.
 */
import { DEMO_QUOTES, LANDED_LINE_LABEL, type DemoQuote, type LandedLineType } from "./demo-data";
import {
  DUTY_ASSUMPTIONS,
  DUTY_BASIS_LABEL,
  FREIGHT_ESTIMATES,
  FREIGHT_MODE_LABEL,
  FX_RATES,
  type DutyAssumption,
  type FreightEstimate,
  type FxRateRow,
  type SavedSnapshot,
  type ScenarioInputs,
} from "./demo-data/landed-cost";
import {
  evaluateQuote,
  exclusionText,
  formatMoney,
  type EvaluatedQuote,
  type LandedOverrides,
} from "./compare-demo";

export const FX_MAX_LAG_DAYS = 3;

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);
}

function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** `app.fx_rate_for`: the rate dated as-of, else the latest earlier rate within the lag, else null. */
export function fxRateFor(
  rates: readonly FxRateRow[],
  base: string,
  quote: string,
  asOf: string,
  maxLag = FX_MAX_LAG_DAYS,
): FxRateRow | null {
  const floor = shiftDate(asOf, -maxLag);
  return (
    [...rates]
      .filter(
        (r) => r.base === base && r.quote === quote && r.rateDate <= asOf && r.rateDate >= floor,
      )
      .sort((a, b) => b.rateDate.localeCompare(a.rateDate))[0] ?? null
  );
}

/** "USD @ 7.2000 CNY per USD (source, date; 1 day before as-of)" — never overwrites originals. */
export function fxLabel(row: FxRateRow | null, asOf: string): string {
  if (!row)
    return `No reference rate within ${FX_MAX_LAG_DAYS} days before ${asOf}; CNY amounts cannot be converted (missing_fx).`;
  const lag = daysBetween(row.rateDate, asOf);
  const when = lag === 0 ? "dated as-of" : `${lag} day${lag === 1 ? "" : "s"} before as-of`;
  return `USD @ ${(1 / row.rate).toFixed(4)} CNY per USD (${row.source}, ${row.rateDate}; ${when})`;
}

export function freightEstimate(id: string | null): FreightEstimate | null {
  return id ? (FREIGHT_ESTIMATES.find((f) => f.id === id) ?? null) : null;
}

export function dutyAssumption(id: string | null): DutyAssumption | null {
  return id ? (DUTY_ASSUMPTIONS.find((d) => d.id === id) ?? null) : null;
}

export function freightEstimateLabel(f: FreightEstimate): string {
  const who = f.providerOrManual === "provider" ? (f.providerName ?? "Provider") : "Manual entry";
  return `${who} · ${FREIGHT_MODE_LABEL[f.mode]} · ${f.status}${f.validUntil ? ` · valid until ${f.validUntil}` : ""}`;
}

export function dutyAssumptionLabel(d: DutyAssumption): string {
  const rate = d.ratePct === null ? "no rate" : `${d.ratePct}%`;
  const review = d.reviewedByBroker && d.brokerName ? `, reviewed by ${d.brokerName}` : "";
  return `${d.htsCandidate ?? "no heading"} · ${rate} · ${DUTY_BASIS_LABEL[d.basis]}${review}`;
}

/** Freight lines per quote; the status mirrors the estimate (`sourced` needs an attached document). */
export function freightLines(estimate: FreightEstimate | null): LandedOverrides {
  if (!estimate) return {};
  const status = estimate.status === "sourced" && estimate.documentId ? "sourced" : "estimated";
  const source = `${freightEstimateLabel(estimate)} — ${estimate.id}`;
  const out: LandedOverrides = {};
  for (const [quoteId, lines] of Object.entries(estimate.perQuoteUsd)) {
    out[quoteId] = Object.fromEntries(
      Object.entries(lines).map(([type, amountUsd]) => [type, { amountUsd, status, source }]),
    );
  }
  return out;
}

/** goods × rate, plus MPF and HMF when the assumption says they apply; null when no rate is recorded. */
export function dutyLine(
  assumption: DutyAssumption | null,
  goodsUsd: number,
): { amountUsd: number; status: "estimated"; source: string } | null {
  if (!assumption || assumption.ratePct === null) return null;
  const parts = [
    `Duty ${assumption.ratePct}% (${DUTY_BASIS_LABEL[assumption.basis].toLowerCase()}`,
  ];
  let amount = (goodsUsd * assumption.ratePct) / 100;
  if (assumption.reviewedByBroker && assumption.brokerName)
    parts[0] += `, reviewed by ${assumption.brokerName}`;
  parts[0] += ")";
  if (assumption.mpfApplies) {
    amount += (goodsUsd * assumption.mpfRatePct) / 100;
    parts.push(`MPF ${assumption.mpfRatePct}%`);
  }
  if (assumption.hmfApplies) {
    amount += (goodsUsd * assumption.hmfRatePct) / 100;
    parts.push(`HMF ${assumption.hmfRatePct}%`);
  }
  return {
    amountUsd: amount,
    status: "estimated",
    source: `${parts.join(" + ")} — ${assumption.id}`,
  };
}

export interface InputCheck {
  errors: Partial<Record<keyof ScenarioInputs, string>>;
  warnings: string[];
}

export function validateInputs(inputs: ScenarioInputs, today: string): InputCheck {
  const errors: InputCheck["errors"] = {};
  const warnings: string[] = [];
  if (!Number.isInteger(inputs.quantity) || inputs.quantity <= 0)
    errors.quantity = "Quantity must be a whole number above zero.";
  if (!inputs.asOf) errors.asOf = "Choose the as-of date.";
  else if (inputs.asOf > today) errors.asOf = "A snapshot cannot be generated for a future date.";
  const f = freightEstimate(inputs.freightEstimateId);
  if (inputs.freightEstimateId && !f) errors.freightEstimateId = "Unknown freight estimate.";
  if (f && f.validUntil && inputs.asOf && f.validUntil < inputs.asOf)
    errors.freightEstimateId = `This estimate expired on ${f.validUntil}; ask the forwarder for a new one.`;
  if (f && f.providerOrManual === "manual")
    warnings.push("Manual freight entry: replace it with a written quote before deciding.");
  const d = dutyAssumption(inputs.dutyAssumptionId);
  if (inputs.dutyAssumptionId && !d) errors.dutyAssumptionId = "Unknown duty assumption.";
  if (d && d.ratePct === null)
    warnings.push("The chosen duty assumption has no rate; the duties line stays missing.");
  if (d && d.ratePct !== null && !d.reviewedByBroker)
    warnings.push("Duty rate not reviewed by a broker; the line is an estimate.");
  if (inputs.asOf && !fxRateFor(FX_RATES, "CNY", "USD", inputs.asOf))
    warnings.push(fxLabel(null, inputs.asOf));
  return { errors, warnings };
}

export interface ScenarioQuote {
  evaluated: EvaluatedQuote;
  totalStatus: "complete" | "partial" | "not_ranked";
  landedTotalUsd: number | null;
  eligibleForRanking: boolean;
  explanations: string[];
}

export interface ScenarioResult {
  fx: FxRateRow | null;
  freight: FreightEstimate | null;
  duty: DutyAssumption | null;
  quotes: ScenarioQuote[];
  ranking: string[] | null;
  blockedBy: string[];
}

/** §2.6 lines per quotation with duties from the assumption; §2.7 ranking only when every eligible total is complete. */
export function buildScenario(
  inputs: ScenarioInputs,
  quotes: readonly DemoQuote[] = DEMO_QUOTES,
): ScenarioResult {
  const fx = fxRateFor(FX_RATES, "CNY", "USD", inputs.asOf);
  const freight = freightEstimate(inputs.freightEstimateId);
  const duty = dutyAssumption(inputs.dutyAssumptionId);
  const base = freightLines(freight);
  const rate = fx?.rate ?? null;

  const result: ScenarioQuote[] = quotes.map((q) => {
    const first = evaluateQuote(q, inputs.quantity, inputs.asOf, base[q.id], rate);
    const dutyOverride = first.goodsUsd !== null ? dutyLine(duty, first.goodsUsd) : null;
    const evaluated = dutyOverride
      ? evaluateQuote(
          q,
          inputs.quantity,
          inputs.asOf,
          { ...(base[q.id] ?? {}), duties_taxes: dutyOverride },
          rate,
        )
      : first;
    const explanations: string[] = [];
    if (evaluated.exclusion) explanations.push(exclusionText(evaluated.exclusion));
    for (const f of evaluated.flags) explanations.push(explainCode(f));
    for (const m of evaluated.missingLines) explanations.push(explainCode(`missing:${m}`));
    for (const e of evaluated.estimatedLines) explanations.push(explainCode(`estimated:${e}`));
    const totalStatus = evaluated.exclusion
      ? "not_ranked"
      : evaluated.landedComplete
        ? "complete"
        : "partial";
    return {
      evaluated,
      totalStatus,
      landedTotalUsd: totalStatus === "complete" ? evaluated.landedTotalUsd : null,
      eligibleForRanking: totalStatus === "complete",
      explanations,
    };
  });

  const eligible = result.filter((r) => r.totalStatus !== "not_ranked");
  const blockedBy = eligible
    .filter((r) => !r.eligibleForRanking)
    .map((r) => r.evaluated.quote.supplier);
  const ranking =
    eligible.length > 1 && blockedBy.length === 0
      ? [...eligible]
          .sort((a, b) => (a.landedTotalUsd ?? 0) - (b.landedTotalUsd ?? 0))
          .map((r) => r.evaluated.quote.id)
      : null;
  return { fx, freight, duty, quotes: result, ranking, blockedBy };
}

/** "Partial — excludes: international freight, duties and taxes". */
export function partialText(missing: readonly LandedLineType[]): string {
  if (missing.includes("goods")) return "No USD total — goods could not be converted (missing_fx)";
  return `Partial — excludes: ${missing.map((m) => LANDED_LINE_LABEL[m].toLowerCase()).join(", ")}`;
}

export function explainCode(code: string): string {
  if (code === "validity_unconfirmed")
    return "Validity not stated by the supplier; confirmation requested.";
  if (code === "missing_fx")
    return `No reference FX rate within ${FX_MAX_LAG_DAYS} days before the as-of date; CNY amounts stay unconverted.`;
  if (code.startsWith("missing:"))
    return `${LANDED_LINE_LABEL[code.slice(8) as LandedLineType] ?? code.slice(8)}: nothing on file, the total stays partial.`;
  if (code.startsWith("estimated:"))
    return `${LANDED_LINE_LABEL[code.slice(10) as LandedLineType] ?? code.slice(10)}: estimated, not a sourced quote.`;
  return code;
}

export function presentUsd(n: number): string {
  return formatMoney(n, "USD");
}

/** Deterministic short hash of the inputs for the snapshot card (display only; the server hashes canonical JSON with SHA-256). */
export function inputsHash(inputs: ScenarioInputs): string {
  const s = JSON.stringify([
    inputs.quantity,
    inputs.asOf,
    inputs.freightEstimateId,
    inputs.dutyAssumptionId,
  ]);
  let h = 5381;
  for (let i = 0; i < s.length; i += 1) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  const hex = h.toString(16).padStart(8, "0");
  return `${hex.slice(0, 4)}…${hex.slice(4, 8)}`;
}

export function snapshotName(inputs: ScenarioInputs): string {
  const f = freightEstimate(inputs.freightEstimateId);
  const d = dutyAssumption(inputs.dutyAssumptionId);
  const mode = f ? FREIGHT_MODE_LABEL[f.mode] : "";
  const freightPart = f
    ? `${f.providerOrManual === "manual" ? "manual" : "forwarder"} ${mode.charAt(0).toLowerCase()}${mode.slice(1)}`
    : "no freight";
  const dutyPart = d
    ? d.ratePct === null
      ? "duty without rate"
      : `${DUTY_BASIS_LABEL[d.basis].toLowerCase()} duty`
    : "no duty";
  return `${inputs.quantity.toLocaleString("en-US")} pcs — ${freightPart}, ${dutyPart}`;
}

/** An immutable record: exact fx rows and inputs; a later rate or quotation version never alters it. */
export function snapshotFrom(
  inputs: ScenarioInputs,
  result: ScenarioResult,
  id: string,
  by: string,
  at: string,
): SavedSnapshot {
  return {
    id,
    name: snapshotName(inputs),
    inputs: { ...inputs },
    fxRateIds: result.fx ? [result.fx.id] : [],
    inputsHash: inputsHash(inputs),
    engineVersion: "preview-0",
    generatedBy: by,
    generatedAt: at,
  };
}
