# Session report — 2026-11-07 (Phase 1, B-04 + B-04b + B-07 start)

**Phase:** 1 | **Slice:** tenancy core (0002), audit foundation (0003), RLS isolation harness, server policy module | **Branch:** `b-04-tenancy-audit` (from `main` @ `081e096`)

## Status

| | |
|---|---|
| **Implemented** | `supabase/migrations/20261107000200_tenancy_core.sql`: `organizations` (single-internal unique index), `user_profiles`, `memberships`, `invites`; trigger fns `set_updated_at`, `prevent_owner_change` (TG_ARGV columns), `enforce_membership_role`; helpers `internal_org_id`, `is_member`, `has_role`, `is_internal`, `is_platform_admin`, `is_member_of_type` (all SECURITY DEFINER, `search_path=''`, EXECUTE restricted) defined **after** their tables; RLS + policies; `authenticated` has no INSERT/DELETE on tenancy tables; mutation functions `create_organization`, `create_invite` (sha256-hashed, 7-day, email-bound), `accept_invite`, `update_membership` (last-owner guard). `20261107000300_audit_foundation.sql`: `audit_events` (append-only, no FKs), `security_events`, `document_access_log`; `current_acting_as`, `record_audit_event` (actor from `auth.uid()`; override only for `service_role`), `record_security_event`, `audit_row_change` trigger with redaction; triggers attached to 0002 tables. `supabase/seed.sql` seeds the internal org idempotently. `supabase/tests/rls.test.ts` (31 tests) + `rls-coverage.ts` registry (7 tables). `packages/domain/src/policy` (server-side matrix for these resources, 9 tests). PGlite shim gained `auth.users` and `auth` schema grants (test-only). |
| **Tested** | `pnpm check` → **106 tests**: domain 50, ai 6, i18n 4, worker 2, supabase 44 (13 migration + 31 isolation). Engine for DB tests: **PGlite** (dev-time SQL check). Real-Postgres evidence arrives from the PR's CI `db` job (`supabase db reset` ×2 + suite). |
| **Deployed** | Nothing. |
| **Partial** | B-07: harness covers 0002/0003 only; grant expiry/revocation cases arrive with 0005/0009. |
| **Blocked** | Branch ruleset (founder, OQ-20 steps in STATUS.md); OQ-21 visibility. |
| **Planned** | B-06 taxonomy seed (0004) → B-08 suppliers core (0005) → B-10 documents (0006). |

## Defect found by tests (and fixed before delivery)

`audit_events.entity_org_id` / `actor_org_id` were foreign keys to `organizations`; deleting an org fired the AFTER DELETE audit trigger, whose new row then violated the FK. An audit log must outlive what it records — the FKs were removed and the reason is documented in the migration and in `SCHEMA_PLAN.md` §2.11 / `MIGRATION_DEPENDENCY_MAP.md` §2.

## What the isolation suite proves (as `authenticated` + JWT sub, never service_role)

Buyer A sees only org A (by list and by pk); B's owner cannot read/update A; viewer cannot update; anonymous and membership-less users see nothing; `org_type`, `org_id`, `user_id` are immutable (trigger); direct INSERT into organizations/memberships denied (no grant); second internal org rejected; unassigned internal operator cannot enumerate buyer teams; supplier cannot see buyer memberships; internal role on a buyer org rejected; `create_organization` makes the caller owner and audits both rows with actor = caller; invite: viewer cannot create, raw token never stored, wrong email denied, single use, garbage denied, expired denied; suspension removes access on the next statement; last owner cannot be demoted; cross-org management via function denied; audit tables: no INSERT/UPDATE/DELETE for `authenticated`, no UPDATE/DELETE for `service_role`, `actor_override` rejected for users and accepted for `service_role`, one audit row per change with correct actor and `acting_as` (`member` / `platform_admin`), invite diffs redacted (no hash value, no email), security events visible to compliance/admin only, access log to internal only; user profiles own-row only.

## Security review

Two layers implemented for these resources: RLS (0002/0003) and `packages/domain/policy` — both enumerate `SECURITY_PERMISSION_MATRIX.md` §2 rows for organizations/memberships/invites/audit. Writes to tenancy go through SECURITY DEFINER functions that re-check authorization; nothing trusts a JWT role claim for authorization (live `memberships` rows only). Audit is unspoofable from user sessions. No secrets; no real data; `auth.users` rows in tests are synthetic.

## Assumptions

- Supabase local/CI `auth.users` accepts `insert (id, email)` for fixtures (common practice; if CI objects, the fixture will add the few NOT NULL columns).
- `current_setting('role')` reflects `SET ROLE service_role` inside SECURITY DEFINER functions (verified on PGlite; the CI run verifies on real Postgres; a JWT-claim fallback is also checked).

## Budget implications

$0.

## Founder actions

```powershell
cd "C:\dev\Factory Bridge Global"
git push -u origin b-04-tenancy-audit
gh pr create --fill --base main
```
Then: both CI jobs green → merge → configure the branch ruleset (STATUS.md → Founder actions) → decide OQ-21.

## Next task (smallest safe)

**B-06**: migration 0004 `taxonomy_products` with the pilot families (labels, cartons, hair bundles) and attribute definitions incl. `label_zh`, idempotent seed, RLS (public-read reference tables registered in `PUBLIC_READ_TABLES`), tests. No founder gate (OQ-15 approved).
