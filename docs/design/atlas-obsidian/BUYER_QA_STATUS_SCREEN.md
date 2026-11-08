# Buyer: Samples and inspections (Atlas × Obsidian)

Preview: `/design-preview/buyer/qa` (`?track=<id>` opens a supplier track). Production serves 404. All data is synthetic (`DEMO DATA — NOT REAL SUPPLIER QUOTATIONS`); no inspection partner is contracted and the sampling-plan values are illustrative.

Sources: `docs/UX_INFORMATION_ARCHITECTURE.md` §2.2 `/app/projects/[id]/qa` "Samples & Inspections"; master spec §6.7 ("Users should see exactly what was checked, by whom and when"); `docs/QUALITY_ASSURANCE.md` §1 (principles), §3 (product-level badges), §4 (the decision after a failure is the buyer's), §5 (limits of sampling), §7 (buyer-visible evidence excludes supplier contact data). Reuses `demo-data/quality.ts` and `quality-demo.ts` from the operations screen (session 20).

## 1. What the screen is for

The buyer's view of the quality work on their project, per supplier: every badge in the fixed wording, each opening to what was checked, by whom, when, against which checklist version and for which scope; where each supplier stands in the eight steps, in the buyer's words; samples, the golden sample agreement, production milestones with estimated versus committed dates; inspections with findings, the report reference and the limits of sampling stated with the plan's numbers; and, after a failed inspection, the decision that is the buyer's.

## 2. Layout

- **Header**: counts (decisions waiting for you, inspections scheduled), as-of date; "Project", "Sample thread" (the golden sample thread in Messages).
- **Suppliers on this project** (left, 17 rem at `xl`): one row per supplier track with "Your decision needed" or the latest current step, name and variant; tracks needing a decision are selected first.
- **Track header**: supplier, variant, and one chip: "Inspection failed: your decision is needed", "Your decision: …", "Release recommended by Factory Bridge", or "No release recommendation yet".
- **What has been checked**: `EvidenceBadge` per badge (spec agreed, sample approved for the variant, golden sample on file, each inspection sentence), opening to Checked / By / On / Scope / note (report in Documents). Long sentences wrap.
- **Where this supplier stands**: the eight steps with Done / In progress / Later / Waiting / Not needed and a buyer-facing sentence each (`buyerStepText`), two columns up to `2xl`.
- **Your decision on lot …** (only when Factory Bridge does not recommend release and no decision exists): the sampling-limits sentences with the plan's numbers; the four decisions (accept, rework and re-inspect, reject, partial acceptance) each with its consequence; a note to the supplier (required for partial acceptance); the acknowledgement checkbox; "Record my decision" disabled until valid. Recording shows a notice with the decision, time and note, and that Factory Bridge relays it; the list chip and header count update.
- **Samples**, **Production** (estimated / reported / committed chips), **Inspections** (status, the badge sentence, inspector and report, findings by class, and a "What this inspection can and cannot tell you" disclosure), **Remediation** (plain words; the OQ-12 caveat).
- **Right rail**: what a badge means, that a lot result never carries over, that the decision is the buyer's, that contact details are not shown; the session log.

## 3. Rules mirrored (display only)

| Rule | Where | Behaviour |
| --- | --- | --- |
| Buyer scope | `buyerTracks` | only tracks of the buyer's project |
| Evidence | `evidenceFor` | one record per badge with what / who / when / scope; no supplier contact fields exist in the data and a test asserts none appear |
| Sampling limits | `samplingLimits` | "125 of 3,000 units were inspected (… code letter K). At AQL 2.5 the lot is accepted with up to 7 major findings and rejected at 8; 9 were found." plus the two §5 caveats; never "defect-free" |
| Decision | `decisionNeeded`, `validateDecision`, `decisionConsequence` | needed only when release is not recommended and no decision exists; a decision and the acknowledgement are required; partial acceptance needs a scope note of at least 10 characters |
| Step copy | `buyerStepText` | buyer-facing sentences derived from the operations `trackView` |

## 4. Handoff

`INTEGRATION_HANDOFF.md` H-44: the buyer reads the Phase 3 quality tables through a buyer-scoped view that strips supplier contact data; the buyer's decision is written as a `remediation_cases.buyer_decision` with the buyer's user id and time (the message reference the operator screen expects is then the decision record itself) and relayed as an outbound message through the approval chain; badge sentences come from the server; the decision count and the "awaiting you" items are derived server-side.

## 5. Verification (session 22)

See `DESIGN_02_EXECUTION_REPORT.md` §6t.
