# Documents and Extraction Review — Prototyped Screens

**Status:** prototyped 2026-11-07 in the UX-01 / DESIGN-02 design preview (same branch, PR #10). Routes `/design-preview/buyer/documents` and `/design-preview/buyer/review?doc=`; the operator concept at `/design-preview/ops/quote-review` was refined onto the same shared split. Dev only, 404 in production builds. Synthetic data only; no bytes exist behind any document row and no file leaves the browser.

## 1. Jobs

- **Buyer documents (IA §2.2 `/app/projects/[id]/uploads`, rendered as the organization library with a project filter):** show every uploaded or received document, where it is in the pipeline, who acts next, and what the system did with it (scan, extraction, linked record, access). Make the two client-side rules visible: what the upload pre-check accepts, and that nothing is read until the scan passes.
- **Buyer extraction review (IA §2.2 `/app/projects/[id]/review/[taskId]`):** the same split as operations with fewer controls. The buyer sees proposed values with confidence and anchors, flags a value or adds context for the operator, and never accepts a price.
- **Operator review (refined):** the split moved into a shared component; the task header now shows the document's source, rights class, scan time and fingerprint; extraction flags appear as notices above the split, including the security notice for text addressed to the system; a pending (unassigned) task is read-only until "Assign to me".

## 2. Reuse and refinement

| Existing | Decision |
|---|---|
| `OpsQuoteReview` document pane, field pane, confidence band, pane toggle | Extracted to `ui/ReviewSplit.tsx` (`ReviewSplit`, `ConfidenceBand`, `PaneToggle`) with a `readOnly` mode and a per-field extra slot. The operator screen renders it editable; the buyer screen renders it read-only. |
| Source lines hard-coded in the operator screen | Moved to `demo-data/documents.ts` as `SOURCE_LINES` keyed by document id; review tasks reference a `documentId`. |
| Wizard upload type and size check | Moved to `documents-demo.ts` (`validateUploads`, `formatBytes`); the wizard imports it, so both entry points apply the same allow-list and limit. |
| Project overview Documents tab | "Open review" now points at the buyer review; "Upload a document" and "All documents" point at the library. Buyer sidebar "Documents" is now a destination. |
| Query-parameter routes (`?id=`, `?product=`, `?rfq=`) | Switched from `useSearchParams` under a Suspense boundary to reading `searchParams` in the route file and passing a prop. The boundary made the whole page stream as a hidden segment whose reveal sometimes never fired in the dev server, leaving a blank page; the server-side read has no boundary. |

## 3. Pipeline vocabulary (`documents-demo.ts`)

| Status | What happened | Who acts | Next |
|---|---|---|---|
| Uploaded | received into quarantine storage | you, operator or supplier | Scanning |
| Scanning | signature, size and page caps, malware scan; no text read, no AI | worker | Parsed or Rejected |
| Rejected | failed the scan; kept 7 days in quarantine for forensics, then deleted | worker | — |
| Parsed | text and layout captured per page or sheet; moved out of quarantine | worker | Extracted for quotations and logistics; artwork, specs and certificates stop here |
| Extracted | AI proposed values with an anchor each and recorded flags; schema-checked; no price stored | worker (AI run logged) | In review |
| In review | operator checks each value against its anchor; corrections record before, after, who, when | operator | Accepted or discarded |
| Accepted | immutable quotation version exists with this document as evidence | operator | — |
| Discarded | removed from active use; file and audit trail retained per retention class | buyer or operator | — |

Rules in the helper, with 8 tests: the Phase 1 upload allow-list (PDF, XLSX, CSV, PNG, JPG, WebP; 25 MB; extension must match type; nothing empty), `nextStatus` (quotations walk to review, artwork stops at parsed), `canDiscard` (evidence behind an accepted version cannot be discarded, only superseded), `canIssueLink` (only files that left quarantine and are still in use), `documentSummary`, status filters, and `advanceDocument` for the preview's simulated pipeline.

## 4. Documents screen

Header with counts (in pipeline, need attention, accepted) and the as-of time. **Add documents**: kind and project selects, drop zone and file picker with the pre-check, "Try a sample file" for reviewers without files, a rejection notice listing each refused file with its reason, and the sentence that the preview simulates the pipeline in the browser. Status tabs All · In pipeline · Needs attention · Accepted · Discarded with counts; project and kind filters. Each row: kind icon, file name, status chip, kind · project · who · when · size · pages, and one line of what happens next or the linked record, or the scan rejection reason in the danger colour.

**Document record** (evidence drawer on wide screens, panel below the list otherwise): status with who acts and what it means; actions Get download link (logs a `signed_url` entry, 15-minute expiry stated), Open extraction review or See reviewed values, Upload a clean copy (rejected), Discard (only when the rule allows; a sentence explains why an accepted document cannot be discarded); scan rejection and extraction flags as notices; source, who can see it (rights class in plain words), file, fingerprint, retention, added by; the pipeline timeline with every event's time, actor and detail and a dashed "Next" marker; extraction summary (count, prompt version, time); linked record; access log with the logging rule. Discard opens a dialog (Escape closes) and appends a discarded event; a discarded in-review document says the operator's task was closed.

## 5. Buyer extraction review

Status notice (operator review in progress, or accepted on a date by an operator with the resulting immutable version), extraction flags in buyer language, the read-only split with per-field "Flag for the operator" toggles while in review, a notes panel whose "Attach to the review" is enabled once something is flagged or written and whose confirmation names what was attached and that no message goes to the supplier; the accepted variant lists the operator's corrections (before, after, who, when) and links to the comparison. The evidence drawer shows the source facts and how to read confidence and anchors. An unknown document id shows an empty state with a link back to the library.

## 6. Verified in the browser

Documents at 1440 Atlas: sample upload walks Uploaded → Scanning → Parsed → Extracted → In review in the browser with simulated events; Get download link writes the access entry; an SVG is refused with its reason while a PNG beside it is added; Escape closes the discard dialog; discarding artwork marks it Discarded; the rejected spreadsheet offers only Upload a clean copy; the accepted quotation offers no Discard and links to the reviewed values; Needs attention lists 5 after the additions. Buyer review: 10 read-only values and no inputs, flag toggles, anchor click highlights the line, note plus flags attach with the confirmation, flags disabled afterwards; accepted variant shows the two corrections; unknown id shows the empty state. Operator review: flags and the fingerprint line for Supplier F; Supplier H opens read-only with Accept disabled until Assign to me, then editable; anchors highlight the Chinese lines. No console errors; no horizontal page overflow at 320, 375, 768 and 1440 in Obsidian and Atlas, including the discard dialog and the Document pane on phones. Query-parameter routes render and hydrate within 3 seconds on repeated loads after the server-side change.

## 7. Contract the UI assumes (handoff H-33)

`documents` rows with `status`, `source_type`, `rights_class`, `mime`, `bytes`, `page_count`, `sha256`, `retention_class`, `scan_result` (with a reason on rejection) and a status-event history with actor and detail; `document_access_log` readable by the owning organization for its own documents; a signed-link endpoint that logs issuance and returns a 15-minute URL; a client-side pre-check mirrored server-side (allow-list, size, signature); an extraction summary per document (field count, prompt version, run time, flags including `embedded_instruction_detected` as a recorded security event); a buyer-notes endpoint on the review task; and a discard endpoint that refuses documents backing an accepted quotation.

## 8. Not built

A real PDF or spreadsheet viewer with page and bounding-box anchors (B-12), bulk upload, drag-reorder, document versions and supersede links, retention editing, operator-side document search.
