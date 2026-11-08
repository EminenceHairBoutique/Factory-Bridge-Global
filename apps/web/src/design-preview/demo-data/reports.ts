/**
 * DEMO DATA — NOT REAL SUPPLIER QUOTATIONS. Synthetic comparison-report records for the buyer
 * reports screens. A report is a snapshot: it records the brief version, quantity, as-of date, FX
 * rate row, engine version and the exact quotation versions it used (QUOTE_ENGINE_SPEC §5), so the
 * viewer can re-render the same content from the same inputs. No file exists behind these rows.
 */

export type ReportFormat = "pdf" | "xlsx" | "csv";

export const FORMAT_LABEL: Record<ReportFormat, string> = {
  pdf: "PDF",
  xlsx: "XLSX workbook",
  csv: "CSV (ZIP of five tables)",
};

export const FORMAT_HINT: Record<ReportFormat, string> = {
  pdf: "Read-only, for sharing internally",
  xlsx: "Sheets summary, quotes, landed_cost_lines, assumptions, fx_rates; no merged cells",
  csv: "The same five tables as separate UTF-8 files with a byte-order mark",
};

export interface ReportQuotationRef {
  id: string;
  version: number;
  supplier: string;
  confirmedAt: string;
}

export interface ReportRecord {
  id: string;
  projectId: string;
  version: number;
  format: ReportFormat;
  fileName: string;
  /** "2026-11-06 11:32" */
  generatedAt: string;
  generatedBy: string;
  briefVersion: number;
  quantity: number;
  /** Engine as-of date used for validity checks. */
  asOf: string;
  includeForwarder: boolean;
  fxRateId: string;
  engineVersion: string;
  quotations: ReportQuotationRef[];
  /** Document record of the generated file, when stored. */
  documentId: string | null;
  state: "ready" | "generating";
}

export const DEMO_REPORTS: ReportRecord[] = [
  {
    id: "rep_1",
    projectId: "prj_demo_labels",
    version: 1,
    format: "pdf",
    fileName: "fbg-comparison-prj_demo_labels-v3-2026-11-06.pdf",
    generatedAt: "2026-11-06 11:32",
    generatedBy: "System (requested by Demo Buyer)",
    briefVersion: 3,
    quantity: 10_000,
    asOf: "2026-11-06",
    includeForwarder: false,
    fxRateId: "fx_demo_0001",
    engineVersion: "compare-demo display mirror (QUOTE_ENGINE_SPEC §2)",
    quotations: [
      { id: "q_demo_a", version: 1, supplier: "Supplier A (demo)", confirmedAt: "2026-11-04" },
      { id: "q_demo_b", version: 1, supplier: "Supplier B (demo)", confirmedAt: "2026-11-05" },
      { id: "q_demo_c", version: 1, supplier: "Supplier C (demo)", confirmedAt: "2026-11-02" },
      { id: "q_demo_d", version: 1, supplier: "Supplier D (demo)", confirmedAt: "2026-10-10" },
    ],
    documentId: "d_report",
    state: "ready",
  },
];
