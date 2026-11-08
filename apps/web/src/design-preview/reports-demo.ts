/**
 * Display-only helpers for the buyer reports previews. They mirror the report content contract in
 * docs/QUOTE_ENGINE_SPEC.md §5 (header, per-quote rows, footer, the five tabular exports of
 * ADR-024) and the presentation rounding rule in §2.5. All arithmetic comes from `compare-demo.ts`,
 * itself a display mirror of the engine; nothing here is the authoritative report generator (B-23).
 */
import {
  compareQuotes,
  exclusionText,
  formatQty,
  forwarderOverrides,
  type EvaluatedQuote,
  type LineStatus,
} from "./compare-demo";
import {
  BRIEF_SOFT_SPEC,
  DEMO_FX,
  DEMO_PROJECTS,
  DEMO_QUOTES,
  LANDED_LINE_LABEL,
  SPEC_LABEL,
  type DemoProject,
  type DemoQuote,
  type LandedLineType,
} from "./demo-data";
import type { ReportFormat, ReportRecord } from "./demo-data/reports";

export const REPORT_ENGINE_VERSION = "compare-demo display mirror (QUOTE_ENGINE_SPEC §2)";

export const FORMAT_EXT: Record<ReportFormat, string> = { pdf: "pdf", xlsx: "xlsx", csv: "zip" };

/** Blueprint pattern `fbg-comparison-<project>-v<brief>-<date>.<ext>`; CSV ships as a ZIP (ADR-024). */
export function reportFileName(
  projectId: string,
  briefVersion: number,
  date: string,
  format: ReportFormat,
): string {
  return `fbg-comparison-${projectId}-v${briefVersion}-${date}.${FORMAT_EXT[format]}`;
}

/** Round half to even at `dp` decimals (QUOTE_ENGINE_SPEC §2.5). Presentation only. */
export function bankersRound(n: number, dp: number): number {
  const f = 10 ** dp;
  const x = n * f;
  const floor = Math.floor(x);
  const diff = x - floor;
  if (Math.abs(diff - 0.5) < 1e-9) return (floor % 2 === 0 ? floor : floor + 1) / f;
  return Math.round(x) / f;
}

export function presentUnit(n: number): string {
  return bankersRound(n, 4).toFixed(4);
}

export function presentTotal(n: number): string {
  return bankersRound(n, 2).toFixed(2);
}

export const ROUNDING_RULE =
  "Full precision is carried through every calculation; unit prices are shown to 4 decimals and totals to 2 decimals, rounded half to even.";

export const DISCLAIMERS = [
  "Estimates are not customs or legal advice.",
  "Supplier-provided data unless marked verified.",
  "Supplier contact details are redacted; no disclosure grant is recorded for this organization.",
];

/* ----------------------------------------------------------------------------------------------- */
/* Status                                                                                             */
/* ----------------------------------------------------------------------------------------------- */

export type ReportState = "current" | "stale" | "superseded";

export interface ReportStatus {
  state: ReportState;
  reasons: string[];
}

export interface ReportContext {
  currentBriefVersion: number;
  currentQuotes: ReadonlyArray<{ id: string; supplier: string; confirmedAt: string }>;
  newestReportId: string | null;
}

export const REPORT_STATE_LABEL: Record<ReportState, string> = {
  current: "Current",
  stale: "Stale",
  superseded: "Superseded",
};

export const REPORT_STATE_TONE: Record<ReportState, "ok" | "warn" | "neutral"> = {
  current: "ok",
  stale: "warn",
  superseded: "neutral",
};

/**
 * A report never changes. It is superseded when the brief moved on or a newer report exists, and
 * stale when a quotation was confirmed (or re-confirmed) after it was generated.
 */
export function reportStatus(report: ReportRecord, ctx: ReportContext): ReportStatus {
  const reasons: string[] = [];
  let state: ReportState = "current";
  if (report.briefVersion < ctx.currentBriefVersion) {
    state = "superseded";
    reasons.push(
      `Brief moved to v${ctx.currentBriefVersion} after this report (it used v${report.briefVersion})`,
    );
  }
  if (ctx.newestReportId !== null && ctx.newestReportId !== report.id) {
    state = "superseded";
    reasons.push("A newer report exists for this project");
  }
  const snapshot = new Map(report.quotations.map((q) => [q.id, q.confirmedAt]));
  const newer = ctx.currentQuotes.filter((q) => {
    const seen = snapshot.get(q.id);
    return seen === undefined || q.confirmedAt > seen;
  });
  if (newer.length > 0) {
    if (state === "current") state = "stale";
    reasons.push(
      `${newer.length} quotation${newer.length === 1 ? "" : "s"} confirmed after generation: ${newer
        .map((q) => q.supplier)
        .join(", ")}`,
    );
  }
  return { state, reasons };
}

/* ----------------------------------------------------------------------------------------------- */
/* Content (QUOTE_ENGINE_SPEC §5)                                                                     */
/* ----------------------------------------------------------------------------------------------- */

export interface ReportInputs {
  project: Pick<DemoProject, "id" | "name" | "unit" | "destination">;
  briefVersion: number;
  quantity: number;
  asOf: string;
  quotes: DemoQuote[];
  includeForwarder: boolean;
  generatedAt: string;
  generatedBy: string;
}

export interface ReportLandedLine {
  type: LandedLineType;
  label: string;
  status: LineStatus;
  amountUsd: number | null;
  source: string | null;
}

export interface ReportQuote {
  quotationId: string;
  version: number;
  supplier: string;
  sourceType: string;
  sourceRef: string;
  confirmedAt: string;
  validUntil: string | null;
  basis: string;
  basisPlace: string | null;
  currency: "CNY" | "USD";
  tierLabel: string | null;
  tierMin: number | null;
  tierMax: number | null;
  unitPriceOriginal: number | null;
  oneTimeFeesOriginal: number;
  goodsOriginal: number | null;
  goodsUsd: number | null;
  comparableGoodsUsd: number | null;
  landed: ReportLandedLine[];
  landedTotalUsd: number | null;
  landedStatus: "complete" | "partial" | "not_ranked";
  missingLines: string[];
  flags: string[];
  specDifferences: string[];
  exclusion: string | null;
  group: string;
  rankInGroup: number | null;
}

export interface ReportTable {
  name: "summary" | "quotes" | "landed_cost_lines" | "assumptions" | "fx_rates";
  columns: string[];
  rows: string[][];
}

export interface ReportContent {
  header: {
    projectId: string;
    projectName: string;
    briefVersion: number;
    quantity: number;
    unit: string;
    destination: string;
    generatedAt: string;
    generatedBy: string;
    engineVersion: string;
    fx: { id: string; label: string };
  };
  groups: Array<{ title: string; kind: "basis" | "excluded"; quotationIds: string[] }>;
  quotes: ReportQuote[];
  landedRanking: { available: boolean; blockedBy: string[]; order: string[] };
  footer: {
    assumptions: string[];
    exclusions: string[];
    roundingRule: string;
    disclaimers: string[];
  };
  tables: ReportTable[];
  counts: { ranked: number; notRanked: number; groups: number };
}

const FLAG_LABEL: Record<string, string> = {
  validity_unconfirmed: "Validity unconfirmed (no valid-until date)",
};

export function fxLabel(): string {
  return `USD @ ${(1 / DEMO_FX.rate).toFixed(2)} CNY/USD (${DEMO_FX.source}, ${DEMO_FX.rateDate})`;
}

function tierLabel(e: EvaluatedQuote): string | null {
  if (!e.tier) return null;
  return e.tier.maxQty === null
    ? `${formatQty(e.tier.minQty)}+`
    : `${formatQty(e.tier.minQty)}–${formatQty(e.tier.maxQty - 1)}`;
}

function toReportQuote(e: EvaluatedQuote, group: string, index: number): ReportQuote {
  const q = e.quote;
  const basis = q.priceBasis === "unknown" ? "unknown" : q.priceBasis;
  return {
    quotationId: q.id,
    version: 1,
    supplier: q.supplier,
    sourceType: q.sourceType,
    sourceRef: q.sourceRef,
    confirmedAt: q.confirmedAt,
    validUntil: q.validUntil,
    basis,
    basisPlace: q.basisPlace,
    currency: q.currency,
    tierLabel: tierLabel(e),
    tierMin: e.tier?.minQty ?? null,
    tierMax: e.tier?.maxQty ?? null,
    unitPriceOriginal: e.tier?.unitPrice ?? null,
    oneTimeFeesOriginal: e.oneTimeFeesOriginal,
    goodsOriginal: e.goodsOriginal,
    goodsUsd: e.goodsUsd,
    comparableGoodsUsd: e.comparableGoodsUsd,
    landed: e.landed.map((l) => ({
      type: l.type,
      label: LANDED_LINE_LABEL[l.type],
      status: l.status,
      amountUsd: l.amountUsd,
      source: l.source,
    })),
    landedTotalUsd: e.landedTotalUsd,
    landedStatus: e.exclusion ? "not_ranked" : e.landedComplete ? "complete" : "partial",
    missingLines: e.missingLines.map((t) => LANDED_LINE_LABEL[t]),
    flags: e.flags.map((f) => FLAG_LABEL[f] ?? f),
    specDifferences: e.softMismatches.map(
      (code) =>
        `${SPEC_LABEL[code] ?? code}: ${q.spec[code] ?? "—"} (brief: ${BRIEF_SOFT_SPEC[code] ?? "—"})`,
    ),
    exclusion: e.exclusion ? exclusionText(e.exclusion) : null,
    group,
    rankInGroup: e.exclusion ? null : index + 1,
  };
}

const num = (n: number | null, present: (x: number) => string) => (n === null ? "" : present(n));

export function buildReport(inputs: ReportInputs): ReportContent {
  const result = compareQuotes(
    inputs.quotes,
    inputs.quantity,
    inputs.asOf,
    inputs.includeForwarder ? forwarderOverrides() : {},
  );

  const quotes: ReportQuote[] = [];
  const groups = result.groups.map((g) => {
    const title = g.kind === "excluded" ? "Not ranked" : g.title;
    g.quotes.forEach((e, i) => quotes.push(toReportQuote(e, title, i)));
    return { title, kind: g.kind, quotationIds: g.quotes.map((e) => e.quote.id) };
  });
  const included = quotes.filter((q) => q.exclusion === null);
  const excluded = quotes.filter((q) => q.exclusion !== null);

  const assumptions: string[] = [];
  assumptions.push(
    `Quantity ${formatQty(inputs.quantity)} ${inputs.project.unit}: the price tier covering this quantity is selected per quotation, and one-time fees are spread over it for ordering.`,
  );
  assumptions.push(
    `FX: ${fxLabel()}; rate row ${DEMO_FX.id}. CNY quotations keep their original amounts; USD figures are converted at this row only.`,
  );
  const bySource = new Map<string, { lines: Set<LandedLineType>; suppliers: Set<string> }>();
  for (const q of included)
    for (const l of q.landed)
      if (l.status === "estimated") {
        const key = l.source ?? "unknown source";
        const entry = bySource.get(key) ?? { lines: new Set(), suppliers: new Set() };
        entry.lines.add(l.type);
        entry.suppliers.add(q.supplier);
        bySource.set(key, entry);
      }
  for (const [source, entry] of bySource)
    assumptions.push(
      `Estimated lines from ${source}: ${[...entry.lines]
        .map((t) => LANDED_LINE_LABEL[t].toLowerCase())
        .join(
          ", ",
        )} (${[...entry.suppliers].join(", ")}). Estimated lines are labelled in every table.`,
    );
  const missingBy = new Map<LandedLineType, string[]>();
  for (const q of included)
    for (const l of q.landed)
      if (l.status === "missing")
        missingBy.set(l.type, [...(missingBy.get(l.type) ?? []), q.supplier]);
  for (const [type, suppliers] of missingBy)
    assumptions.push(
      `${LANDED_LINE_LABEL[type]}: no sourced or estimated figure for ${suppliers.join(", ")}; their landed totals are partial and exclude this line.`,
    );
  for (const q of included)
    if (q.flags.some((f) => f.startsWith("Validity unconfirmed")))
      assumptions.push(
        `${q.supplier}: no valid-until date on the quotation; validity is unconfirmed. Included, not treated as expired.`,
      );
  if (included.length > 1)
    assumptions.push(
      result.landedRanking
        ? "Every ranked quotation has a complete landed total; the order across trade-term groups is by landed total."
        : `Ranking across trade terms by landed total is not available (blocked by ${result.landedRankingBlockedBy.join(", ")}). Quotations are ordered within their trade-term group by goods plus one-time fees in USD; unit price alone is never the order.`,
    );

  const exclusions = excluded.map((q) => `${q.supplier}: ${q.exclusion ?? ""}`);

  const landedRanking = {
    available: result.landedRanking !== null,
    blockedBy: result.landedRankingBlockedBy,
    order: (result.landedRanking ?? []).map((e) => e.quote.id),
  };

  const header: ReportContent["header"] = {
    projectId: inputs.project.id,
    projectName: inputs.project.name,
    briefVersion: inputs.briefVersion,
    quantity: inputs.quantity,
    unit: inputs.project.unit,
    destination: inputs.project.destination,
    generatedAt: inputs.generatedAt,
    generatedBy: inputs.generatedBy,
    engineVersion: REPORT_ENGINE_VERSION,
    fx: { id: DEMO_FX.id, label: fxLabel() },
  };

  const counts = {
    ranked: included.length,
    notRanked: excluded.length,
    groups: groups.filter((g) => g.kind === "basis").length,
  };

  const tables: ReportTable[] = [
    {
      name: "summary",
      columns: [
        "project_id",
        "brief_version",
        "quantity",
        "unit",
        "destination",
        "generated_at",
        "generated_by",
        "engine_version",
        "fx_rate_id",
        "quotes_ranked",
        "quotes_not_ranked",
        "landed_ranking",
      ],
      rows: [
        [
          header.projectId,
          String(header.briefVersion),
          String(header.quantity),
          header.unit,
          header.destination,
          header.generatedAt,
          header.generatedBy,
          header.engineVersion,
          header.fx.id,
          String(counts.ranked),
          String(counts.notRanked),
          landedRanking.available
            ? "available"
            : counts.ranked > 1
              ? `blocked: ${landedRanking.blockedBy.join(", ")}`
              : "not applicable",
        ],
      ],
    },
    {
      name: "quotes",
      columns: [
        "quotation_id",
        "version",
        "supplier",
        "source_type",
        "source_ref",
        "confirmed_at",
        "valid_until",
        "price_basis",
        "basis_place",
        "currency_original",
        "tier_min_qty",
        "tier_max_qty",
        "unit_price_original",
        "one_time_fees_original",
        "goods_original",
        "goods_usd",
        "comparable_goods_usd",
        "landed_total_usd",
        "landed_status",
        "group",
        "rank_in_group",
        "flags",
        "exclusion",
        "fx_rate_id",
      ],
      rows: quotes.map((q) => [
        q.quotationId,
        String(q.version),
        q.supplier,
        q.sourceType,
        q.sourceRef,
        q.confirmedAt,
        q.validUntil ?? "",
        q.basis,
        q.basisPlace ?? "",
        q.currency,
        q.tierMin === null ? "" : String(q.tierMin),
        q.tierMax === null ? "" : String(q.tierMax),
        num(q.unitPriceOriginal, presentUnit),
        presentTotal(q.oneTimeFeesOriginal),
        num(q.goodsOriginal, presentTotal),
        num(q.goodsUsd, presentTotal),
        num(q.comparableGoodsUsd, presentTotal),
        num(q.landedTotalUsd, presentTotal),
        q.landedStatus,
        q.group,
        q.rankInGroup === null ? "" : String(q.rankInGroup),
        q.flags.join("; "),
        q.exclusion ?? "",
        DEMO_FX.id,
      ]),
    },
    {
      name: "landed_cost_lines",
      columns: [
        "quotation_id",
        "confirmed_at",
        "line_type",
        "status",
        "amount_usd",
        "source",
        "currency_original",
        "fx_rate_id",
      ],
      rows: quotes.flatMap((q) =>
        q.landed.map((l) => [
          q.quotationId,
          q.confirmedAt,
          l.type,
          l.status,
          num(l.amountUsd, presentTotal),
          l.source ?? "",
          q.currency,
          DEMO_FX.id,
        ]),
      ),
    },
    {
      name: "assumptions",
      columns: ["id", "kind", "text"],
      rows: [
        ...assumptions.map((t, i) => [`a${i + 1}`, "assumption", t]),
        ...exclusions.map((t, i) => [`x${i + 1}`, "exclusion", t]),
        ["r1", "rounding", ROUNDING_RULE],
        ...DISCLAIMERS.map((t, i) => [`d${i + 1}`, "disclaimer", t]),
      ],
    },
    {
      name: "fx_rates",
      columns: ["fx_rate_id", "pair", "rate_usd_per_cny", "rate_date", "source"],
      rows: [[DEMO_FX.id, DEMO_FX.pair, DEMO_FX.rate.toFixed(8), DEMO_FX.rateDate, DEMO_FX.source]],
    },
  ];

  return {
    header,
    groups,
    quotes,
    landedRanking,
    footer: { assumptions, exclusions, roundingRule: ROUNDING_RULE, disclaimers: DISCLAIMERS },
    tables,
    counts,
  };
}

/** RFC 4180 quoting for the CSV preview. Files carry a UTF-8 byte-order mark; the preview does not. */
export function toCsv(table: ReportTable): string {
  const cell = (v: string) => (/[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  return [table.columns, ...table.rows].map((r) => r.map(cell).join(",")).join("\n");
}

/* ----------------------------------------------------------------------------------------------- */
/* Records → content                                                                                  */
/* ----------------------------------------------------------------------------------------------- */

/** Only the labels project has quotations in the demo data. */
export function quotesForProject(projectId: string): DemoQuote[] {
  return projectId === "prj_demo_labels" ? DEMO_QUOTES : [];
}

/** The exact quotation versions the report recorded, in their current demo form. */
export function quotesForReport(report: ReportRecord): DemoQuote[] {
  const ids = new Set(report.quotations.map((q) => q.id));
  return quotesForProject(report.projectId).filter((q) => ids.has(q.id));
}

/** Re-renders a stored report from its recorded inputs: same versions, quantity, FX row and engine. */
export function contentForReport(report: ReportRecord): ReportContent | null {
  const project = DEMO_PROJECTS.find((p) => p.id === report.projectId);
  if (!project) return null;
  return buildReport({
    project,
    briefVersion: report.briefVersion,
    quantity: report.quantity,
    asOf: report.asOf,
    quotes: quotesForReport(report),
    includeForwarder: report.includeForwarder,
    generatedAt: report.generatedAt,
    generatedBy: report.generatedBy,
  });
}
