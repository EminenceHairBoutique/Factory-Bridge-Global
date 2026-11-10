# Session report — 2026-11-09 (Phase 1, B-18)

**Phase:** 1 | **Slice:** migration 0010 `ai_review` — the human gate of the first vertical slice | **Branch:** `b-18-ai-review` (stacked on `b-25-jobs`)

| | |
|---|---|
| **Implemented** | `prompt_templates` (registry mirror: template id + sha256 version, one active per template, immutable except `active`, internal read). `ai_extractions` (immutable, worker-only; require a parsed document and an `extract` ai_run with output; `validated_output` null ⇒ validation errors present). `review_tasks` (one per extraction; created `pending` by the worker; ownership from the document; supplier-owned documents refused; status only through `app.start_review` / `app.reject_review` / `app.accept_extraction`; resolved tasks never reopen). `human_corrections` (append-only, before ≠ after, reason, `corrected_by = auth.uid()`, only while open). `app.accept_extraction` (signed-in person only; forces `document_id` + `extraction_id` from the task; fills supplier / brief item / buyer org; rejects a mismatched supplier; delegates to `app.supersede_quotation`; idempotent). Document completion `in_review → accepted` via `app.review_document_transition` (trusted-writer claim for one statement, then restored; not callable by `authenticated`). **Operator intake:** assigned operators register buyer-owned `operator_import` documents on the buyer's project and upload to quarantine (0006 policies replaced). FK `quotations.extraction_id`; `quote_fees.fee_type` adds `inland_freight`, `export_doc` (the extractor's fee types). |
| **Tested** | `pnpm check` → **342 tests** (8 new; includes 59 web tests from Claude Code's design work). The suite walks the whole slice: operator intake (other operator / wrong source type refused; buyer viewer, assigned operator see it; B, other operator, supplier don't) → worker scan/parse → template (one active, immutable) → ai_run → extraction (draft run refused; output-less row refused; immutable; injected `approved: true` stored as inert data) → review task (non-pending insert refused; duplicate refused; unknown subject refused; org/project derived) → visibility across 8 personas → viewers cannot decide; compliance / B / other operator / supplier get "not found" → member starts + corrects (no-op correction refused; corrections immutable) → a job cannot accept → member accepts: quotation cites the task's document and extraction even when the payload names another document; `export_doc` fee stored; replay returns the same id; resolved task cannot restart/reject/re-accept/correct → confirmed quotation visible per 0009 → second extraction rejected by the assigned operator → document `accepted` → bogus `extraction_id` hits the FK → no direct DELETE/UPDATE on any review table; `review_document_transition` not executable. **Local Postgres 16:** all 12 DB suites twice on one database; only the deliberate "pgmq/pg_cron must exist on Supabase" assertion fails there, as designed. |
| **Deployed** | Nothing. |
| **Partial** | The worker that produces extractions and tasks (B-11 consumer + B-19 live provider) and the review UI (Claude Code's DESIGN-02 previews) are not wired to this schema yet. |
| **Blocked** | Live AI calls need an Anthropic key in a worker environment (gate G1 worker host + OQ-16 accounts). |
| **Planned** | B-11 worker consumer: `fbg_documents` → scan/parse; `fbg_extraction` → `GuardedAiRunner` → `ai_extractions` + `review_tasks` + `app.notify(..., 'review_ready')`. |

**Ownership note:** B-18 had been earmarked for the Claude Code session, which has spent the last two days on DESIGN-02 previews (PRs #18–#29) and opened no branch touching 0010. To keep the slice moving I took it; BACKLOG now marks it done so nobody duplicates it.

**Changes:** `supabase/migrations/20261109000100_ai_review.sql` (new), `supabase/tests/ai-review.test.ts` (new), `supabase/tests/rls-coverage.ts` (4 tables + allow-list), docs: `DECISIONS.md` (ADR-039), `MIGRATION_DEPENDENCY_MAP.md` (row 0010), `SCHEMA_PLAN.md` (§2.8 as built), `SECURITY_PERMISSION_MATRIX.md` (review + operator-import rows), `BACKLOG.md` (B-18 ✅), `STATUS.md`.

**Security review:**
- *Human approval gate (CLAUDE.md §4):* no path turns AI output into a confirmed price without `auth.uid()`; the worker is refused; status columns have no write grant.
- *Prompt injection:* extraction content is stored, displayed and corrected, never interpreted; an injected `approved: true` changes nothing (tested); provenance on the resulting quotation comes from the task, not the payload.
- *Tenant isolation:* operator intake documents are owned by the buyer org (confidential by construction); tasks inherit the document's org and project; outsiders get "not found" rather than "not permitted" (no existence oracle).
- *Least privilege:* the document-completion helper raises the trusted-writer claim for one statement and restores it, and is not executable by `authenticated`; corrections and extractions are immutable.
- *Idempotency:* accept replays return the original quotation; 0009's thread lock and one-current index still apply.
- No secrets; fixtures invented; nothing deployed.

**Assumptions:** buyer `member` may accept a review (matrix B.member AC); an all-rejected document stays `in_review` for an operator to re-run or discard; supplier-portal submissions will get their own review path when the supplier workspace is wired (Phase 2).

**Budget implications:** none now. Live extraction will incur Anthropic usage, capped per org by the B-16b budget guard.

**Founder actions required:** merge PR #26 (`b-25-jobs`, green); then `git push -u origin b-18-ai-review` and open its PR.

**Next task:** B-11 worker consumer against 0006/0010/0012 (pgmq → scan/parse → extraction → review task → notification), runnable locally against the Supabase stack without any paid host.
