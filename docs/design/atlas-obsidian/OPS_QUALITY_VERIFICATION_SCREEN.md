# Operations: Quality verification (Atlas × Obsidian)

Preview: `/design-preview/ops/quality` (`?track=<id>` opens a track). Production serves 404. All data is synthetic (`DEMO DATA — NOT REAL SUPPLIER QUOTATIONS`); no inspection partner is contracted, inspector names are placeholders, and the sampling-plan values are illustrative.

Sources: `docs/QUALITY_ASSURANCE.md` §1 (principles), §3 (product-level states and badges), §4 (eight-step workflow and exception rules), §5 (sampling and the exact badge sentence), §7 (evidence), §8 (remediation vocabulary); `docs/SCHEMA_PLAN.md` §2.9 Phase 3 tables; `docs/UX_INFORMATION_ARCHITECTURE.md` §2.4 `/ops/quality`.

## 1. What the screen is for

The operator's view of one quality track per project × supplier × variant: where it stands in the workflow, what evidence exists for each state, what the next action is, and the two gates the software holds — a result is derived from the acceptance numbers and needs a report document, and after a failure the buyer's decision is recorded only against the buyer's own message. Badges use the fixed wording; nothing here is a guarantee, and a lot badge never reaches a supplier record.

## 2. Layout

- **Header**: counts (awaiting buyer decision, inspections scheduled, open cases, samples pending); "Work queue".
- **Tracks** (left, 17 rem at `xl`): buyer decisions pending first, then scheduled inspections, then the rest; chip for the latest current step or "Buyer decision pending", the pre-shipment date when scheduled, project · supplier, variant · assignee.
- **Track header**: variant, buyer org, assignee; the shipment-release badge (not yet assessed / recommended / not recommended); links to the supplier record and the project.
- **Checkpoints**: the eight steps with Done / Now / Later / Blocked / Not needed and a one-line summary each; "Next:" sentence from the first open step.
- **Quality specification record**: id and version, sampling plan, critical dimensions, tests, defect classes; description shows "Spec v3 agreed 2026-10-20" or "Spec v1 awaiting buyer approval".
- **Samples and golden sample**: each sample with kind, result, requested / received / evaluated by, note, evidence, and the badge sentence when passed ("Sample approved for variant … on …", "Golden sample on file"); the golden sample agreement line (sign-off, acknowledgment, document, where retained).
- **Production milestones**: materials ready, production start, progress, packed; each dated and chipped reported / committed / estimated.
- **Inspections**: per job the type, status or result, lot and size, inspector org, date, checklist version; the resolved plan ("code letter K, 125 units; critical AQL 0 accept 0 / reject 1 · major AQL 2.5 accept 7 / reject 8 · minor AQL 4 accept 10 / reject 11 (illustrative)"); the exact badge sentence; found counts, inspector, report; findings by class with counts and photos.
- **Record the result** (when a job is scheduled): found critical / major / minor with the accept and reject numbers as hints, inspector, report document (required), "found units to be reworked"; the result is derived and shown as a chip before recording; recording closes the job, updates the badge and the release recommendation, and logs it.
- **Exceptions: the buyer's decision** (when release is not recommended): the four decisions and a required reference to the buyer's message; a short reference is refused with the sentence that the decision is the buyer's; once recorded, a notice shows the decision, reference and time.
- **Remediation case**: source, status, responsibility and resolution from the fixed vocabulary, opened / closed, notes.
- **Right rail**: what a badge may say, sampling limits, the session log.

## 3. Rules mirrored (display only)

| Rule | Where | Behaviour |
| --- | --- | --- |
| Sampling plan | `samplingPlanFor` | lot size → code letter and sample size (Level II), accept / reject per class for AQL 0 / 2.5 / 4.0; marked illustrative; unknown AQLs resolve to nothing |
| Result | `deriveResult` | fail when any class exceeds its accept number; pass otherwise; pass with rework when majors were found within the accept number and the inspector says the found units are reworked |
| Result input | `validateResult` | whole numbers within the sample size; inspector named; report document required |
| Badge wording | `inspectionBadge`, `sampleBadge`, `specBadge`, `badgeIsAllowed` | the §5 sentence exactly; guard against "guaranteed", "zero defects", "defect-free", "verified factory", "certified supplier" |
| Workflow | `trackView` | spec → sample → golden → production → inspection → exceptions → remediation → closure with blocked states (no sample before the QSR is approved; no production before the golden sample agreement); release not recommended after a failed inspection until the buyer decides |
| Buyer decision | `validateBuyerDecision` | a decision and a reference of at least six characters to the buyer's message |

## 4. Handoff

`INTEGRATION_HANDOFF.md` H-42: Phase 3 tables as in SCHEMA_PLAN §2.9 plus what the screen needs beyond them — a track (project × supplier × variant) to hang the workflow on, production milestones with a date kind, the buyer decision on the remediation case with a message reference, a server-side `derive_result` from the sampling plan, and the exact badge sentences generated server-side from `inspection_results` so no client ever composes them. The ops navigation entry "Quality" belongs to the shell (UX-03).

## 5. Verification (session 20)

See `DESIGN_02_EXECUTION_REPORT.md` §6r.
