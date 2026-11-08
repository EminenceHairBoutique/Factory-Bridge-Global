# Session report — 2026-11-07 (Phase 1, B-08)

**Phase:** 1 | **Slice:** migration 0005 `suppliers_core` | **Branch:** `b-08-suppliers` (stacked on `b-06-taxonomy`)

| | |
|---|---|
| **Implemented** | `supplier_profiles` (one per supplier org; org must be `org_type='supplier'`; claimed columns editable by the supplier's owner/admin, `stage` + `entity_kind_verified` writable only by internal staff — trigger, not RLS; changing the claimed `entity_kind` clears verification; USCC format check; buyers see a supplier only past `lead_identified`, ADR-030), `supplier_facilities` (org_id denormalized by trigger, one primary), **`supplier_contacts` (restricted; ≥1 channel; `contact_basis`; audit redacted)**, `contact_disclosure_grants` (reason ≥10 chars, one live grant per contact×buyer, immutable except revocation, revocation stamps `revoked_by`), `source_systems` (register as rows: `marketplace.1688/taobao/weidian`, `messaging.wechat` = `blocked`; platform-admin-only status changes that survive migration re-runs), `source_permissions` (validated `scope` via `app.validate_permission_scope`; immutable except revocation; supplier owner/admin can self-grant catalog rights; buyers read grants naming them or open to platform buyers), `research_leads` (internal only; `rights_class` CHECK-pinned; min ≤ max), helpers `app.supplier_org_of`, `app.supplier_visible`, `app.catalog_grant_active`, `app.contact_disclosed_to_me`, `app.contact_org_of`, `app.is_trusted_writer`, view `supplier_public_profile_v` (`security_invoker`, no contact/USCC/created_by columns). No DELETE granted to `authenticated` on any 0005 table. |
| **Tested** | `pnpm check` → **218 tests** (domain 50, ai 48, i18n 4, worker 12, eval 12, supabase 92). New `supabase/tests/suppliers.test.ts`: **19 tests** — buyer org, foreign supplier and unassigned operator read **0** contact rows; grant → 1; expired grant → 0; revoked grant → 0; buyer cannot create or widen a grant; grant immutability (`reason`, `buyer_org_id`, un-revoke rejected); second live grant rejected; 8 invalid scopes rejected with specific messages; `catalog_grant_active` is field- and org-scoped and flips on revocation/expiry; register rows blocked, operator cannot change status, admin status survives re-running the reference block; research leads invisible to buyers/suppliers; supplier cannot promote itself; profile hidden from buyers at lead stage; audit diff for a contact update contains column names only, never the phone or WeChat handle; DELETE denied on all 7 tables. Engine: PGlite locally; real Postgres via the PR's `db` job. |
| **Deployed** | Nothing. |
| **Partial** | Operators have no contact access until 0008 adds `project_assignments` and replaces the contact/grant policies (ADR-031). `evidence_document_id` on `source_permissions` and `supplier_facilities` arrives in 0007 (B-08b) after `documents` (0006). Verification checks and supplier documents are B-08b. |
| **Blocked** | — |
| **Planned** | B-10 (0006 documents + storage policies) is the next migration on the DAG; B-08b (0007) follows it. |

**Changes:** `supabase/migrations/20261107000500_suppliers_core.sql` (new), `supabase/tests/suppliers.test.ts` (new), `supabase/tests/rls-coverage.ts` (7 tables registered + allow-list), docs: `DECISIONS.md` (ADR-030/031/032), `MIGRATION_DEPENDENCY_MAP.md` (row 0005 implemented, 6 helpers, 0007 facilities FK), `SCHEMA_PLAN.md` (§2.2/§2.4 as built, Pattern D note), `SECURITY_PERMISSION_MATRIX.md` (§4 note), `BACKLOG.md` (B-08 ✅◐, B-08b), `STATUS.md`.

**Security review:**
- *Tenant isolation:* contacts are reachable by a buyer only through a live grant evaluated at read time; the policy cycle contacts↔grants is broken with SECURITY DEFINER helpers (verified: Postgres raised "infinite recursion" before the fix and the suite caught it). Ownership columns (`org_id`, `supplier_id`, `supplier_contact_id`, `buyer_org_id`) are trigger-immutable. Research-lead prices never leave the internal org.
- *Privilege layer:* every table revokes Supabase's default grants and re-grants only SELECT/INSERT/UPDATE (SELECT/UPDATE for `source_systems`); the allow-list guard enforces it; `anon` reads nothing.
- *Verification honesty:* `entity_kind_verified` and `stage` cannot be set by the party being verified; a USCC is format-checked only and the column comment says so — a registry match is a 0007 check record.
- *Untrusted input:* `scope` JSON is validated key-by-key; `named_org_ids` must parse as uuids; unknown keys are rejected rather than ignored.
- *Trusted-writer test* (`app.is_trusted_writer`) reuses 0003's session-role/JWT-claim check; it is safe under PostgREST (users cannot run `set_config`) and is the same assumption 0003 already makes.
- No secrets, no real supplier data (fixtures are invented names).

**Assumptions:** a platform-wide (`platform_buyers`) catalog grant row is visible to every signed-in org including other suppliers — it carries no prices, only the fact and scope of a permission. Supplier `member` role cannot edit the profile (owner/admin only); members can add facilities.

**Budget implications:** none.

**Founder actions required:**
1. Add the `check` job (`typecheck · lint · format · unit tests`) to the ruleset's required checks and tick "Require branches to be up to date".
2. After the B-06 PR merges: `git push -u origin b-08-suppliers` and open its PR against `main`.

**Next task:** B-10 (0006 `documents_storage`) — or, if Claude Code takes B-10, B-08b depends on it; B-14 domain engine is independent of both.
