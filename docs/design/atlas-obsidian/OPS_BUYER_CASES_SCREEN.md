# Operations: Buyer cases (Atlas × Obsidian)

Preview: `/design-preview/ops/cases` (`?case=<id>` opens a case). Production serves 404. All data is synthetic (`DEMO DATA — NOT REAL SUPPLIER QUOTATIONS`).

Sources: `docs/UX_INFORMATION_ARCHITECTURE.md` §2.4 `/ops/cases` "Buyer Cases / tickets"; master spec §6.8 (customer-support inbox, source-linked updates, clarification tasks) and the "Speed" row (no response-time promise before pilot data proves it); CLAUDE.md §4 (no claims in UI copy); the work queue's `buyer_case` task kind. No case table exists yet; handoff H-45 proposes one.

## 1. What the screen is for

A buyer's question, data issue, request or complaint, answered with the record it concerns. The operator sees the whole case; the buyer sees their messages, the replies and the resolution note. Priority is derived, not chosen; turnaround targets are the team's pilot targets and never leave the workspace; replies cannot carry claims or response-time promises.

## 2. Layout

- **Header**: counts (past target, open, awaiting buyer, escalated); "Work queue".
- **Cases** (left, 17 rem at `xl`; filters Active / Open / Buyer / Resolved): status chip (Open / Awaiting buyer / Resolved), "High" when derived, the pilot-target chip (from the work queue's SLA helper) while open; subject; buyer org · category · assignee. Order: past target → open high → open → awaiting buyer → resolved, newest first within a rank.
- **Case header**: subject; ref, buyer org and contact, category, source (platform message, email, phone note), opened, assignee; status, "High priority", "Escalated to …"; links to the project and the queue task.
- **State notice**: the resolution (code, note, by, when; "the buyer may reopen within 7 days") or "Awaiting the buyer's confirmation".
- **Linked records**: the document, quotation, report, snapshot, supplier record or thread the case is about, each opening its preview screen.
- **Timeline**: buyer messages, replies, internal notes, status changes and escalations; internal entries carry a lock and a canvas background, buyer-visible ones a "Buyer sees this" chip; a reply names the record it concerns with a link.
- **Act on this case**: Reply to buyer (text; the record it concerns, required for data issues; the claims check shows a notice and disables sending), Internal note, Resolve (code from the fixed set and a buyer-visible note, also claims-checked), Escalate (target and reason). Resolved cases show "Reopen on the buyer's behalf", which needs the buyer's own words.
- **Right rail**: the case rules, the internal pilot targets per category, the session log.

## 3. Rules mirrored (display only)

| Rule | Where | Behaviour |
| --- | --- | --- |
| Targets | `targetDueAt`, `caseSla` | opened + 24 h (question, data issue) / 48 h (request) / 8 h (complaint); shown only while open; labelled pilot targets |
| Priority | `priorityOf` | high for complaints, escalations, data issues and anything past target; never for a resolved case |
| No claims | `claimsCheck`, `validateReply` | blocks “lowest price”, “zero defects”, “defect-free”, “guarantee”, “verified factory”, “certified supplier” and "within n hours/days" promises in replies and resolution notes |
| Source-linked | `validateReply` | a data-issue reply must name the record it corrects or confirms |
| Visibility | `applyReply`, `applyNote`, `applyResolve`, `applyEscalate` | replies and resolutions are buyer-visible; notes and escalations are not; a reply hands the case to the buyer |
| Reopen | `applyReopen` | only with the buyer's own message |

## 4. Handoff

`INTEGRATION_HANDOFF.md` H-45: a `buyer_cases` table (org, project, contact user, subject, category, source, status, assignee, escalation, resolution) with `case_updates` (kind, buyer_visible, linked record by table and id, author, text) under buyer-org RLS for buyer-visible rows and internal-only for the rest; the queue's `buyer_case` work item is a view over open cases; the claims check runs server-side on every buyer-visible write; targets live in configuration, not in the UI; replies to buyers are not outbound supplier messages and do not use the supplier approval chain.

## 5. Verification (session 23)

See `DESIGN_02_EXECUTION_REPORT.md` §6u.
