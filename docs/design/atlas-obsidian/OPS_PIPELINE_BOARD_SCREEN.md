# Operations: Pipeline board (Atlas × Obsidian)

Preview: `/design-preview/ops/pipeline` (`?project=<id>` opens a project's drawer). Production serves 404. All data is synthetic (`DEMO DATA — NOT REAL SUPPLIER QUOTATIONS`).

Sources: `docs/UX_INFORMATION_ARCHITECTURE.md` §2.4 `/ops` "Pipeline board: projects by stage; SLA timers"; master spec "Sourcing Pipeline" (operations app list); CLAUDE.md §4 (deterministic state transitions; human approval before supplier selection and purchase handoff); migration 0008 `sourcing_projects` (status draft / active / on_hold / closed, `lead_operator_id`, `compliance_hold`) and `project_assignments`. Builds on the work queue's Pipeline tab (`OPS_WORK_QUEUE_SCREEN.md`), which stays as the quick view and now links here.

## 1. What the screen adds to the queue's Pipeline tab

The tab shows columns, targets and days in stage. The board answers the next questions: why a card needs attention, who owes the next move, what the next stage needs, who leads the project and how loaded each operator is. Stages are derived from records and never dragged: there is no drag handle, and the only stage action is recording an operator-owned move once every requirement is met.

## 2. Layout

- **Notice**: "Stages move from records, not by dragging".
- **Header**: counts (need attention, past target, without a lead, on compliance hold) and the as-of time; "Work queue".
- **Toolbar**: Board / List; lead operator (all, each operator, without a lead); buyer organization; "Needs attention only".
- **Board**: the seven stage columns with count and target (or the buyer's-clock note), in a bounded horizontal scroll. Cards are buttons: name, buyer, days in stage against the target ("2 d / 1 d · past target", "1 d · buyer's clock"), open work items, attention chips, and "Waiting on operator / buyer / supplier / compliance", "Ready to record the next stage" or "Moves on the buyer's action", with the lead.
- **List**: the same projects ordered by number of attention reasons, then days in stage, one row each (project, stage and clock, waiting-on and attention chips).
- **Operator load**: per operator, projects led, past target, open work items on those projects. **This session**: the audit lines written.
- **Project drawer** (right, dialog, Escape closes, focus moves into it): name, buyer, family; stage, clock and attention chips; compliance-hold notice with a link to the hold; **To move to …**: each requirement with met or waiting and its owner chip, the explanation sentence, and "Record move to …" only when the operator owns the move and everything is met; **Lead operator**: assign, or reassign with a reason; **Open work items** from the queue with their SLA and a link; **Stage history** with who moved it and when; "Open project" where a project page exists.

## 3. Rules mirrored (display only)

| Rule | Where | Behaviour |
| --- | --- | --- |
| Gate per stage | `gateFor` | brief draft → confirmed (buyer: complete brief, confirms; compliance: no hold); confirmed → finding options (operator: lead, shortlist; compliance); finding options → quotes in review (operator: approved RFQ sent; supplier: a quotation received); quotes in review → comparison ready (operator: every extraction reviewed, a confirmed quotation); comparison ready → sample requested (buyer: shortlist, approved sample request); sample requested → awaiting approval (operator: sample evaluated; buyer: golden sample agreement signed); awaiting approval → handed off (buyer's written approval) |
| Who records | `gateFor` | operator records operator-owned moves when every requirement is met; buyer-owned moves happen only on the buyer's action, even when the records are complete |
| Waiting on | `gateFor` | owner of the first unmet requirement |
| Attention | `attentionFor` | compliance hold; past the stage target; buyer's clock at 7 days or more (reminder due); no lead in an operator stage; an overdue work item from the queue |
| Open work | `openTasksFor` | the queue's open tasks for the project (matches the counts on the queue's Pipeline tab) |
| Ordering and filters | `sortForList`, `filterProjects` | attention count, then days in stage; operator, buyer, attention |
| Load | `operatorLoad` | projects, past target and open work per operator |
| Assignment | `validateAssignment`, `assignLead` | choose an operator; reassigning needs a reason of at least 3 characters |
| Recording | `recordStageChange` | only when `canRecord`; the new stage's clock starts today |

## 4. Handoff

`INTEGRATION_HANDOFF.md` H-47: a `project_pipeline_v` view deriving the stage from records (brief confirmation, shortlist, RFQ dispatch with approvals, quotations and open review tasks, samples and golden sample agreements, the buyer's handoff approval), with `entered_stage_at` from the audit trail; the requirement list and owners computed server-side from the same records; the operator's "record move" is an audited function that re-checks the gate; `lead_operator_id` writes stay internal-only with a reason on reassignment; stage targets in configuration, never shown to buyers; the ops navigation entry "Projects" or "Pipeline" belongs to the shell (UX-03).

## 5. Verification (session 25)

See `DESIGN_02_EXECUTION_REPORT.md` §6w.
