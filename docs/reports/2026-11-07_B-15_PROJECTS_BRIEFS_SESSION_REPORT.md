# Session report — 2026-11-07 (Phase 1, B-15)

**Phase:** 1 | **Slice:** migration 0008 `projects_briefs` | **Branch:** `b-15-projects` (stacked on `b-08b-evidence`)

| | |
|---|---|
| **Implemented** | `sourcing_projects` (buyer org only; `target_incoterm` defaults to `unknown`, never EXW; `lead_operator_id` staff-only; `compliance_hold`/`compliance_note` compliance-only; closed projects reopened by staff only). `project_assignments` (lead/support; platform admin assigns, an active lead adds/deactivates support on their own project; operator must be an active internal member; one active lead per project). `project_suppliers` — the shortlist, which is now the **access link**: while a supplier is not dropped, the project's assigned operators read/create/update its restricted contacts, read its submitted documents, and may grant a contact to *that project's buyer org only*. `buyer_briefs` (born `draft`; `draft→ready` buyer, `ready→in_sourcing` assigned operator only, `in_sourcing→closed`, `ready→draft`; `ai_proposal` is data; `confirmed_spec_id` must be a platform/own-org spec). `brief_items` (blocked taxonomy refused at insert; `review_required` creates the row with `compliance_hold = true`; only compliance/platform admin clears; spec must match taxonomy and ownership). `documents.project_id` (own-org project, trigger). `product_specifications.brief_item_id` FK. Generic `app.assert_same_org(parent, fk)` trigger. Helpers `app.project_org`, `app.is_assigned_to_project`, `app.brief_project`, `app.brief_item_project`, `app.supplier_in_my_project`. **Policy replacements** closing the ADR-031/ADR-033 deferrals: `supplier_contacts_*`, `contact_disclosure_grants_insert/update`, `app.document_readable()`. |
| **Tested** | `pnpm check` → **250 tests** (10 new). **Local Postgres 16:** all 8 DB suites, 124 tests, **four runs on one database** — the first of those runs exposed that the suite's temporary `review_required` taxonomy node leaked into `taxonomy.test.ts`'s root count; fixed with an `afterAll` that restores the shared database. |
| **Deployed** | Nothing. |
| **Partial** | Audit-trail reads scoped to assigned projects (`I.op+` AU in the matrix) are not implemented; `audit_events` policies are unchanged (ADR-035 §7). |
| **Blocked** | — |
| **Planned** | 0009 `quotations` (B-20) hangs `quote_groups` off `project_suppliers`/`brief_items`; 0010 `ai_review` (B-18/B-19) off documents + projects. |

**Changes:** `supabase/migrations/20261107000800_projects_briefs.sql` (new), `supabase/tests/projects.test.ts` (new), `supabase/tests/rls-coverage.ts` (5 tables + allow-list), docs: `DECISIONS.md` (ADR-035), `MIGRATION_DEPENDENCY_MAP.md` (row 0008, helpers), `SCHEMA_PLAN.md` (§2.1/§2.4/§2.5 as built), `SECURITY_PERMISSION_MATRIX.md` (§4 note), `BACKLOG.md` (B-15 ✅), `STATUS.md`.

**Security review:**
- *The I.op− → I.op+ boundary is one predicate* (`app.is_assigned_to_project`) backed by a row only platform admins or a project's lead can create; operators cannot self-assign (tested). Deactivating the row removes access on the next read (tested).
- *Contacts stay scoped:* an operator sees a supplier's contacts only through a non-dropped shortlist row on an assigned project — dropping the supplier closes it (tested); other operators and the buyer org never see contacts without a grant (tested); grants can only target the project's own buyer org (tested).
- *Documents:* buyer uploads attach only to the buyer's own projects (trigger, tested); assigned operators read attached uploads and shortlisted suppliers' submissions; compliance reviewers and other operators do not (tested).
- *Compliance separation:* compliance may read projects/briefs/items and change only hold columns (trigger, tested); buyers cannot set holds or lead operators (tested).
- *Deterministic gates:* blocked categories refused in SQL, not UI; review-required holds set by trigger from taxonomy data; brief entering sourcing requires an assigned operator (a human gate before any outreach).
- *Ownership:* `org_id`, `project_id`, `brief_id`, `supplier_id`, `operator_user_id` immutable; Pattern-B `org_id` derived server-side, supplied mismatches raise (tested).
- No DELETE grants; `anon` nothing; no secrets; fixtures are invented.

**Assumptions:** the shortlist (not quotes) is the right scoping link for operator access — it exists as soon as an operator starts working a supplier for a project, before any quote. Buyer `member` role may create projects/briefs (matrix: B.member R C U X).

**Budget implications:** none.

**Founder actions required:** push the stack as the lower PRs merge: `b-10-documents` → `b-08b-evidence` → `b-15-projects`.

**Next task:** B-20 (0009 `quotations`: immutable quotations, tiers with EXCLUDE, lifecycle states via functions, visibility grants) — the core of the first vertical slice — or B-18 (0010 `ai_review`) if Claude Code is not taking it.
