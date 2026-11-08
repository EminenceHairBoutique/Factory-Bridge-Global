# Buyer Reports — Prototyped Screens

**Status:** prototyped 2026-11-07 in the UX-01 / DESIGN-02 design preview (same branch, PR #10). Routes `/design-preview/buyer/reports` and `/design-preview/buyer/report?id=`; dev only, 404 in production builds. Implements IA §2.2 `/app/projects/[id]/reports` ("Generated PDF/CSV with assumptions", R-09) and the report content contract in `docs/QUOTE_ENGINE_SPEC.md` §5 with the tabular export of ADR-024. Synthetic data only; no file is produced.

## 1. Jobs

- **Reports list:** show every version for a project with whether its inputs still hold (current, stale, superseded) and why; let the buyer generate a new version knowing exactly what it will contain before it exists; keep the reproducibility facts one glance away.
- **Report viewer:** show one report as the file reads, so the buyer can check what will be shared internally before downloading, and show the five tables the XLSX workbook and the CSV ZIP contain.

## 2. Reuse and refinement

| Existing | Decision |
|---|---|
| `compare-demo.ts` (display mirror of QUOTE_ENGINE_SPEC §2) | All report arithmetic comes from `compareQuotes`; the report helper only arranges its output. `exclusionText` and `forwarderOverrides` moved from the comparison screen into the helper so the comparison and the report footer use identical wording and the same freight inputs. |
| Project overview Reports tab (`PROJECT_REPORTS` in `project.ts`) | Replaced by `demo-data/reports.ts` as the single source; the tab now shows the shared records with derived status and links to the viewer and the list. |
| Comparison export dialog | The disabled "Generate" became "Continue in Reports", carrying the quantity and format into the generate panel. |
| Documents library | The stored report document links to the viewer. |

## 3. What a report records (`demo-data/reports.ts`)

Brief version, quantity, as-of date, FX rate row, engine version, whether the forwarder estimate was included, and the exact quotation versions with their confirmation dates. The viewer re-renders the content from these inputs: same versions, quantity, FX row and engine give the same report. Reports generated in the preview are not stored; their viewer link carries the inputs instead (`id=live&v=&qty=&fwd=&format=`).

## 4. Rules in the helper (`reports-demo.ts`, 9 tests)

- `reportFileName`: `fbg-comparison-<project>-v<brief>-<date>.<ext>`; CSV ships as `.zip` (ADR-024).
- `bankersRound`, `presentUnit` (4 dp), `presentTotal` (2 dp): round half to even at presentation only (§2.5); the rule is printed in the footer.
- `reportStatus`: superseded when the brief moved on or a newer report exists; stale when a quotation was confirmed after generation; every reason is listed, superseded wins.
- `buildReport`: header (project, brief, quantity, destination, generated at and by, engine, FX row); per quotation the source reference and type, confirmation and validity dates, basis and place, original currency, selected tier and unit price, one-time fees, goods in original currency and USD, the ordering key, every landed line with its status and source, the landed total or the lines it excludes, flags, soft specification differences, exclusion reason, group and rank; the footer with assumptions derived from the evaluation (quantity and tier rule, FX row, estimated lines by source, missing lines by type, validity unconfirmed, cross-group ranking availability), exclusions from the excluded group, the rounding rule and the three disclaimers; and the five tables `summary`, `quotes`, `landed_cost_lines`, `assumptions`, `fx_rates`, one row per entity, every quote and line row carrying the quotation id, confirmation date, original currency and FX row id.
- `toCsv`: RFC 4180 quoting for the preview; files carry a byte-order mark, the preview does not.

## 5. Reports list

Header with version count and the as-of date; project select. **Generate a new version:** quantity (5,000 / 10,000 / 25,000), forwarder estimate checkbox, format cards (PDF, XLSX workbook, CSV ZIP) with the ADR-024 hints, and a derived panel "What this version will contain": ranked count and trade-term groups, not-ranked count, whether cross-group landed ranking is available or what blocks it, assumption and exclusion counts, the FX row and brief version, and the file name. Generate adds a version in a generating state and marks it ready after a moment; earlier versions flip to superseded. Projects with no quotations show why a report cannot be generated. **Versions:** newest first; file name, status chip (Current, Stale, Superseded, Generating) with reasons, format, generated at, brief, quantity, FX row and quotation count; View, Get download link (stored files only; logs issuance), Regenerate with current data (pre-fills the panel and focuses Generate). The evidence drawer shows the selected report's facts and the session log; on narrow screens the facts sit below the list.

## 6. Report viewer

Status chip and, when not current, a notice with the reasons and "Generate a new version", stating that the file itself has not changed. **Report** tab: a document-like sheet with the running header, title, facts grid, ranked quotations by trade-term group (rank, supplier, quotation id and version, confirmation and validity, source, basis, selected tier and unit price, goods in both currencies, fees, ordering key, landed total or what it excludes, flags, soft differences, landed lines with status chips), the not-ranked list with reasons and references, and the footer. **Export tables** tab: sheet selector with row counts, the table, and a CSV preview with the byte-order-mark and ZIP notes. Actions: All reports, Open comparison, Get download link for stored files. An unknown id shows an empty state.

## 7. Verified in the browser

Reports at 1440 Atlas: the seeded report shows Stale with "2 quotations confirmed after generation: Supplier E, Supplier F"; the derived panel reads 2 ranked in 2 groups (EXW Dongguan, FOB Shenzhen), 4 not ranked, cross-group ranking blocked by Supplier A and B; 25,000 changes the counts; choosing XLSX changes the file name; Generate adds v2 as Generating then Current, and v1 flips to Superseded with "A newer report exists"; Get download link logs; Regenerate pre-fills and focuses Generate; the cartons project shows the empty and no-quotations states. Viewer: stale notice, running header, both groups, not-ranked reasons, partial landed totals, footer rules, FX row, signed-link notice; export tables show summary 1 · quotes 4 · landed_cost_lines 36 · assumptions 17 · fx_rates 1 with the CSV preview; the live v2 link renders Current with the forwarder assumption and four exclusions; unknown id shows the empty state. Comparison export dialog links to Reports with quantity and format; the overview Reports tab shows the shared record with status and links. No console errors; no horizontal page overflow at 320, 375, 768 and 1440 in both themes (the export table scrolls inside its own container).

## 8. Contract the UI assumes (handoff H-34)

A `reports` table (or view) per project with version, format, file name, generated at and by, brief version, quantity, as-of date, FX rate id, engine version, included quotation ids with their confirmation timestamps, the forwarder-estimate flag and the document id of the stored file; status derived server-side from the same inputs (brief version, newer report, later confirmations) so every surface agrees; a generation job (B-23) that writes the five tables and the PDF from the deterministic engine with the footer rules; signed links through the documents endpoint; contact redaction unless a disclosure grant exists.

## 9. Not built

Real file generation and download, report sharing or recipients, per-column selection, comparison of two report versions, operator-side report review.
