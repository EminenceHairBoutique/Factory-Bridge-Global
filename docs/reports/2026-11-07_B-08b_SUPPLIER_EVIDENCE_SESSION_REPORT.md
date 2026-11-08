# Session report — 2026-11-07 (Phase 1, B-08b)

**Phase:** 1 | **Slice:** migration 0007 `supplier_evidence` | **Branch:** `b-08b-evidence` (stacked on `b-10-documents`)

| | |
|---|---|
| **Implemented** | `supplier_verification_checks` — a `pass` requires an evidence document that belongs to the supplier (or is an internal upload) and has passed the scan; rows are immutable except `notes`; the latest check per type wins; `uscc_matched` cannot pass without a USCC on the profile. `supplier_documents` — the supplier's own claim about a file (license, certificate, …), `claimed_by_supplier` until staff verify (trigger-enforced). `supplier_stage_requirements` — QUALITY_ASSURANCE §2's entry evidence as rows. `app.supplier_stage_evidenced()` — cumulative, read-time evaluation, so an expired or superseded check un-evidences the stage without rewriting it. Stage gate on `supplier_profiles`: born at `lead_identified` (staff included), advance only with evidence for the target and all lower stages, demote freely. `supplier_verification_summary_v` — the only buyer-facing read: check types passed / expired, dates, document counts, `stage_evidenced`; no notes, reviewers or evidence ids. Deferred evidence FKs on `source_permissions` and `supplier_facilities` with a fit guard. `check_type` added to the enum registry and 0001's generated block. |
| **Tested** | `pnpm check` → **240 tests** (9 new). **Real Postgres 16, locally:** all 7 DB suites, 114 tests, **twice on one database** — this caught two shared-database issues before CI (an unscoped count in `documents.test.ts`; evidence FKs blocking fixture cleanup, fixed by deleting in dependency order). |
| **Deployed** | Nothing. |
| **Partial** | — |
| **Blocked** | — |
| **Planned** | Badge rendering (EN/ZH text from the summary view) belongs to the supplier/buyer UI slices; nothing in the schema is pending. |

**Also in this session (on `b-10-documents`, commit before the 0007 one):** migration 0006's `documents_insert/update` policies only allowed owner/admin/member, which no internal-org user has — operators could not register an operator import (matrix row "Operator-imported documents"). Fixed to admit operators, compliance and platform admins for internal-org documents; found by the 0007 suite's internal-evidence fixture.

**Changes:** `supabase/migrations/20261107000700_supplier_evidence.sql` (new), `supabase/migrations/20261107000100_bootstrap.sql` (regenerated enum block: `check_type`), `packages/domain/src/enums.ts` (`CHECK_TYPES`), `supabase/tests/supplier-evidence.test.ts` (new), `supabase/tests/suppliers.test.ts` (fixtures now earn `contact_confirmed` through a contact; asserts the born-at-lead rule), `supabase/tests/documents.test.ts` (scoped count, 0006 policy), `supabase/tests/rls-coverage.ts`, docs: `DECISIONS.md` (ADR-034), `MIGRATION_DEPENDENCY_MAP.md`, `SCHEMA_PLAN.md`, `SECURITY_PERMISSION_MATRIX.md`, `QUALITY_ASSURANCE.md`, `BACKLOG.md`, `STATUS.md`.

**Security review:**
- *Verification honesty (CLAUDE.md §4 "verified supplier"):* a pass cannot exist without linked, scanned evidence of that supplier; stages cannot be declared, only earned; the buyer-facing view names exactly which checks passed and flags expiry. "Verified factory" has nothing to render from.
- *Separation of duties:* the party being verified cannot record checks, verify its own documents, or set its stage; buyers cannot read the checks table at all.
- *Owner-run view:* `supplier_verification_summary_v` intentionally bypasses RLS (buyers hold no policy on the base tables) and applies `app.supplier_visible()` itself; it is `security_barrier` and exposes aggregates only. Documented as the one deliberate exception (ADR-034 §5) — the Supabase linter will flag it; that is expected.
- *Integrity:* evidence FKs are `restrict`; `supplier_documents.document_id` is unique and must match `documents.supplier_id`; `verification_check_id` must belong to the same supplier.

**Assumptions:** `capabilities_documented` requires only the facility group (video call or visit) on top of the identity set; export-license and reference checks are recorded but not required for any stage. Internal-org uploads (e.g. a video-call screenshot) are acceptable evidence for any supplier.

**Budget implications:** none.

**Founder actions required:** push the stack in order as each PR merges: `b-08-suppliers` → `b-10-documents` → `b-08b-evidence` (`git push -u origin b-08b-evidence`).

**Next task:** B-15 (0008 `projects_briefs`) — unblocks the assigned-operator clauses deferred from 0004/0005/0006 — or B-11 (worker queue consumer) if Claude Code is not taking it.
