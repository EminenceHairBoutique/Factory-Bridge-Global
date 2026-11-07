/** Plain-text table rendering for eval reports. ASCII only so column widths are stable. */
import type { EvalReport, FixtureRow, MetricRow } from "./metrics.js";

function fmt(row: MetricRow): string {
  if (row.value === null) return "n/a";
  switch (row.kind) {
    case "rate":
      return row.value.toFixed(3);
    case "count":
      return String(row.value);
    case "usd":
      return `$${row.value.toFixed(4)}`;
    case "ms":
      return `${Math.round(row.value)}`;
  }
}

function status(row: MetricRow): string {
  if (row.pass === null) return row.value === null ? "-" : "info";
  return row.pass ? "PASS" : "FAIL";
}

function table(headers: readonly string[], rows: readonly (readonly string[])[]): string {
  const widths = headers.map((h, i) => Math.max(h.length, ...rows.map((r) => (r[i] ?? "").length)));
  const line = (cells: readonly string[]) =>
    cells.map((c, i) => c.padEnd(widths[i] ?? 0)).join(" | ");
  const sep = widths.map((w) => "-".repeat(w)).join("-+-");
  return [line(headers), sep, ...rows.map(line)].join("\n");
}

export function renderMetrics(rows: readonly MetricRow[]): string {
  return table(
    ["Metric", "Value", "n", "Gate", "Status"],
    rows.map((r) => [r.label, fmt(r), String(r.n), r.gate, status(r)]),
  );
}

export function renderFixtures(rows: readonly FixtureRow[]): string {
  const yn = (b: boolean | null) => (b === null ? "-" : b ? "yes" : "NO");
  return table(
    ["Fixture", "Slice", "Status", "Att", "Tiers", "Flags", "InjFlag", "Violations", "Cost", "ms"],
    rows.map((r) => [
      r.id,
      r.slice,
      r.status,
      String(r.attempts),
      yn(r.tiersExact),
      yn(r.flagsExact),
      yn(r.injectionFlagged),
      r.boundaryViolations.length === 0 ? "0" : r.boundaryViolations.join(";"),
      r.costUsd === null ? "-" : `$${r.costUsd.toFixed(4)}`,
      r.latencyMs === null ? "-" : String(r.latencyMs),
    ]),
  );
}

export function renderReport(report: EvalReport): string {
  const out: string[] = [];
  out.push(
    `Factory Bridge eval — ${report.template} — provider=${report.provider} model=${report.model}`,
  );
  out.push(
    `generated ${report.generatedAt}; fixtures=${report.fixtureCount}; promptHash=${report.promptHash ?? "n/a"}`,
  );
  if (report.provider === "mock") {
    out.push(
      "NOTE: provider=mock replays each fixture's expected.json. This verifies the harness, fixtures and pipeline — it says NOTHING about model accuracy.",
    );
  }
  out.push("");
  out.push("== Overall ==");
  out.push(renderMetrics(report.overall));
  for (const [slice, rows] of Object.entries(report.perSlice)) {
    out.push("");
    out.push(`== Slice: ${slice} ==`);
    out.push(renderMetrics(rows.filter((r) => r.pass !== null || r.kind === "count")));
  }
  out.push("");
  out.push("== Fixtures ==");
  out.push(renderFixtures(report.perFixture));
  out.push("");
  if (report.hardGateViolations.length === 0) {
    out.push("HARD GATE (injection boundary): 0 violations");
  } else {
    out.push(`HARD GATE (injection boundary): ${report.hardGateViolations.length} violation(s)`);
    for (const v of report.hardGateViolations) out.push(`  - ${v}`);
  }
  return out.join("\n");
}
