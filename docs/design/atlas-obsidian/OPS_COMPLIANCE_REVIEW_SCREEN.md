# Operations: Compliance holds (Atlas × Obsidian)

Preview: `/design-preview/ops/compliance` (`?hold=<id>` opens a hold). Production serves 404. All data is synthetic (`DEMO DATA — NOT REAL SUPPLIER QUOTATIONS`).

Sources: master spec "Compliance Holds" operations module and §101 (blocked and high-risk categories) and §289 (trade compliance; no legal advice from the model); PRD US-O5 / AC-O5.1 ("Compliance review required" is the only buyer-facing text); `docs/SECURITY_PERMISSION_MATRIX.md` row "Compliance holds" (I.op R; I.comp R C U; I.admin R C U, audited); CLAUDE.md §4 blocked categories; ADR-030 disclosure grants.

## 1. What the screen is for

Everything the platform stopped for a compliance decision, in one place: blocked categories (gloves, ingestibles), export-sensitive items (HPLC), categories outside the pilot ("Another category"), contact disclosure grant drafts, and supplier provenance gaps. A compliance reviewer reads the trigger, the policy basis and the evidence, sees exactly what the buyer or supplier sees, adds internal notes, and records one of four outcomes with a reason. Operators read and note; they cannot decide.

## 2. Layout

- **Header**: title, lead, counts (overdue / open / under review), "as of" time, and a **View as** switch (Operator / Compliance / Admin) that demonstrates the permission gate.
- **Hold list** (left, 17 rem at `xl`, stacked below `xl`): state chip, SLA chip from the shared work-queue helper, title, kind · organization · assignee. Ordered overdue → open by due date → under review → decided newest first. Filter: Active / Decided / All.
- **Hold detail** (right): title row with state, SLA, "Open record" (supplier or grant subject) and "Claim"; panels **Why it is on hold** (trigger, policy basis, subject), **What the buyer or supplier sees** (the fixed sentence), **Evidence** (key–value facts: matched terms, category chosen, destination, consent, documents on file), **Internal notes** (list + add), and either **Decision** (recorded outcome, actor, role, time, reason, conditions, effect) or **Record a decision**.
- **Right rail** (`xl`+): blocked-by-default list, who may do what, 24 h pilot turnaround, this session's action log.

The paired panels stack below `2xl` because the ops shell keeps a 248 px right rail at 1440; two 165 px columns were unreadable.

## 3. Decision form

| Outcome | Requires | Effect (stated before recording, per hold kind) |
| --- | --- | --- |
| Release | reason ≥ 20 chars | Brief proceeds; the category stays blocked for self-service; release applies to this brief only. Grant: becomes active with its expiry. Supplier: eligible for regulated-destination comparisons. |
| Release with conditions | reason + ≥ 1 condition | Conditions become operator checkpoints (sample request, selection, handoff) or verification checks with due dates. |
| Decline | reason | Brief cannot proceed; buyer sees only the fixed sentence plus an optional plain-language note; grant draft discarded; supplier stays at its stage. |
| Escalate | reason + target (Founder / Outside counsel / Licensed customs broker) | Hold stays in force; target recorded; buyer or supplier sees no change. |

Validation lives in `ops-compliance-demo.ts` (`validateDecision`): role gate, outcome, reason length, conditions, escalation target. `applyDecision` claims the hold if unassigned, records who / role / when / reason / conditions, and appends the audit note. The screen writes a line to the rail log; platform-admin actions are marked audited.

## 4. Rules shown, never computed by AI

- Buyers and suppliers see only "Compliance review required". Reasons, conditions and notes stay internal.
- Operators (view-as) get a disabled form with the reason written out; Claim is hidden for them.
- The release of a category hold never unblocks the category.
- The trigger text and matched terms are data on the hold; the screen does not classify anything itself.

## 5. Handoff

`INTEGRATION_HANDOFF.md` H-39 covers the `compliance_holds` record, the decision record, the audited function, role checks and the buyer-facing contract. Queue task `t7` (compliance hold) links here with "Open hold" without requiring a claim, because operators only read holds.

## 6. Verification (session 17)

See `DESIGN_02_EXECUTION_REPORT.md` §6o for the commands run and the browser checks at 1440 (Atlas) and 375 / 320 / 768 (Obsidian).
