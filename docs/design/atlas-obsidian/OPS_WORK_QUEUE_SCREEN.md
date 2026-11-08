# Operations Work Queue and Pipeline — Prototyped Screen

**Status:** prototyped 2026-11-07 in the UX-01 / DESIGN-02 design preview (same branch, PR #10). Route `/design-preview/ops/queue`; dev only, 404 in production builds. Implements the `/ops` landing (IA §2.4 "Pipeline board: projects by stage; SLA timers") and the brief's "Work queue" as the first ops destination. Synthetic data only.

## 1. Job

Give an operator one ordered list of everything waiting on them, across projects and suppliers, with the time left on each item, and make the two most common side effects (approving an outbound message, relaying a supplier reply) safe to do in place with a visible approval chain and an audit entry.

## 2. Task kinds and targets

| Kind | Source | Target (pilot proposal, hours from creation) | Action in the queue |
|---|---|---|---|
| Extraction review | document pipeline | 24 | Open the review split |
| Outreach approval | buyer-approved clarification or RFQ draft | 8 | Review draft → Approve and send via platform / Return to buyer with a note |
| Supplier reply to relay | portal or intake reply | 8 | Relay to buyer (creates a quotation version) |
| Verification check due | check expiry or scheduled pending check | 72 | Open supplier record |
| Intake needs permission | import without a source permission | 48 | Open supplier record |
| Compliance hold | blocked category in a brief | 24 | Compliance reviewer; not in this prototype |
| Buyer case | support question | 24 | Not in this prototype |
| Quote expiring | validity within 30 days | 120 | Open comparison |

Targets order the queue and colour the SLA chip (overdue · due within 24 h · on track). They are shown in the evidence drawer with the sentence "not shown to buyers as promises".

## 3. Layout

Header with open, overdue, due-within-24 h counts and the as-of time; tabs **My queue · Unassigned · All open · Pipeline** with counts; filters by kind and project; rows sorted overdue first by `sortByUrgency`. Each row: SLA chip and status, kind icon and title, kind badge, project and buyer organization, supplier, assignee, note, and one action: **Claim** (unassigned), **Review draft** (outreach approval assigned to you), **Relay to buyer** (supplier reply assigned to you), or **Open** (link to the relevant screen). The evidence drawer lists the turnaround targets and the actions taken this session.

**Inline outbound approval:** expanding a draft shows the chain Buyer approved (with time) → Operator: you → Sent via platform, the buyer's English wording and the Chinese message that would go to the supplier, the channel rule (platform message; WeChat relay only with recorded consent), and the two actions. Approving marks the task done and writes a log entry naming the buyer approval, the operator and the channel.

**Pipeline tab:** seven stage columns in a bounded horizontal scroll, each with its target and note; project cards show buyer organization, days in stage with "past target" or "buyer" (buyer-clock stages), open tasks and operator, or "Unassigned — claim from the queue".

## 4. Display-only rules (`queue-demo.ts`, 6 tests)

`slaFor` (overdue / due soon / on track with hour and day labels), `sortByUrgency` (overdue first, done last), `queueSummary`, `stageSla` (per-stage targets; buyer-clock stages carry no target).

## 5. Verified in the browser

My queue opens with the overdue extraction review first; Review draft shows the three-step chain; Approve and send marks the task done with the audit line; Relay to buyer logs the relay; Unassigned lists three items and Claim moves one into My queue; the Pipeline tab shows all seven stage columns with two projects past target; no console errors; no horizontal page overflow at 320, 375 and 768 px (the board scrolls inside its own container).

## 6. Contract the UI assumes (handoff H-32)

A `work_items` view or table unioning review tasks, outbound drafts awaiting operator approval, supplier replies to relay, check expiries, permission-less intakes, compliance holds, cases and expiring quotes, each with kind, references, assignee, created_at and a server-computed due_at from agreed targets; claim and complete endpoints writing audit events; outbound approval endpoint that records approver, channel, time and text and performs the send server-side; pipeline stage entry timestamps per project.

## 7. Not built

Compliance review and case screens, bulk actions, notifications, operator capacity view, editing targets.
