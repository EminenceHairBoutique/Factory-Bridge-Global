# B-05b — MFA for internal roles and staff provisioning (session report)

## Session report — 2026-11-14
Phase: 1  |  Slice: B-05b — TOTP (`aal2`) before `/ops`, enforced in the web guard and in RLS; platform-admin staff provisioning without SQL
Branch `eng/b05b-mfa-staff` from `origin/eng/b05-auth-production` `fc6bd78` (PR #40 was still open at the start); draft PR [#41](https://github.com/EminenceHairBoutique/Factory-Bridge-Global/pull/41) to `main`. #40 merged into `main` (`ef87ad6`) while this PR was open; `main` is merged into the branch (`d531d32`, no content change), so the PR diff is B-05b only.

**Implemented**
- **ADR-043** (`docs/DECISIONS.md`):
  - The guard requires `aal2` for the internal workspace; staff below it go to `/ops/mfa/verify` (factor enrolled) or `/ops/mfa/enroll`.
  - **RLS enforces it too, now.** Without it, an operator's password used against the Data API directly would bypass MFA.
  - TOTP only; recovery is a founder reset with the service role.
  - Staff provisioning is a platform-admin invite (operator / compliance reviewer, 72 h, email-bound, single use); `platform_admin` stays with the bootstrap path.
- **Migration 0014** `20261114000100_internal_mfa_staff.sql` (forward only, no tables):
  - `app.session_aal()` reads the JWT `aal` claim the way `auth.uid()` reads `sub`.
  - `app.is_member`, `app.has_role`, `app.is_member_of_type` ignore internal-role memberships below `aal2`. Every internal privilege in 0002–0013 derives from them, so `is_internal()` / `is_platform_admin()` follow.
  - `app.is_assigned_to_project` now also requires `app.is_internal()`. This closes a gap found while reading the helpers: an active assignment used to outlive a suspended internal membership.
  - `app.holds_membership()` + a replaced `organizations_select`, so the guard still sees an `aal1` operator's internal org (and nothing else).
  - `app.create_staff_invite()` + `public.create_staff_invite` wrapper (registered in `PUBLIC_FUNCTIONS`); records `security_events` `privileged_access`.
- **Config:** `[auth.mfa.totp] enroll_enabled = true, verify_enabled = true` in `supabase/config.toml`.
- **Web (`apps/web`):**
  - `server/auth/assurance.ts`: the `aal` claim of the token `getUser()` just validated; verified-TOTP check; QR re-encoding (Supabase's SVG is ~320 KB with an XML prelude).
  - `guard.ts`: `requireWorkspace("internal")` redirects below `aal2`; `requireStaffForMfa` for the two MFA pages only.
  - `paths.ts`: `afterMfaPath` / `mfaHref` (an `/ops` `next`, never back into `/ops/mfa`).
  - `/ops/mfa/enroll`, `/ops/mfa/verify` and their server actions; `/ops/admin/staff` (platform admins only) with invite, list, role/status change.
  - Ops nav shows "Staff" to platform admins; the old "MFA not required yet" notice is replaced by a real-data notice.
  - `server/auth/origin.ts` shared by the buyer team page and the staff page.
- **Domain:** `@fbg/domain/workspace` `mfaStep`, `assuranceLevel`, `canProvisionStaff`, `STAFF_INVITABLE_ROLES`.
- **DB test harness:** `asUser(…, aal = "aal2")`, so existing suites test a fully signed-in user; new tests pass `aal1` explicitly.
- **Playwright:** `support/totp.ts` (RFC 6238, never reuses a code), enrolled staff fixtures (TOTP through Supabase Auth's public MFA API), `signInStaff`, and `tests/06-mfa-and-staff.spec.ts` (6 tests); `03` now passes the TOTP challenge.

**Tested** (commands + results, local Windows machine)
- `pnpm typecheck && pnpm lint && pnpm format:check && pnpm test`: exit 0. `pnpm test` = 727: domain 60 (was 57), ai 48, i18n 4, worker 84, eval 12, web 322 (was 313), supabase 197 (was 183) on PGlite.
- Real local Supabase stack (CLI 3.1.0 in a scratch workdir on ports 5532x, TOTP on; `supabase start` and `supabase db reset` applied 0001–0014 and the seed):
  - `pnpm test:db` 197/197.
  - Before the registry line was added, the public-function guard failed on the unregistered `create_staff_invite` (2 failures), as designed.
  - `pnpm --filter @fbg/worker test:integration` 10/10.
  - `node scripts/gen-db-types.mjs --check`: types match (the regenerated diff is the 4-line `create_staff_invite` entry).
- Playwright on a production build against that stack: **21/21** (`pnpm test:e2e`, run 3).
  - Run 1 failed 3 tests. (a) The Data-API test's own challenge signed the parked browser out: Supabase Auth ends a user's other `aal1` sessions when one of their sessions verifies a factor. The test now completes the browser first, and a separate test asserts that behaviour. (b) The QR image never rendered: the real SVG is ~320 KB, over the first cap.
  - Run 2 still failed the QR checks (cap). Run 3 passed after the base64 re-encoding with a 2 MB cap and unit tests on the real shape.
- CI: ⏳ on the PR (see the PR for run ids).

**Deployed:** nothing.
**Partial:** recovery codes / in-app factor reset, staff-invite revocation, MFA for buyer/supplier admins, step-up re-authentication.
**Blocked:** none.
**Planned:** see BACKLOG B-05b "Not done".

**Changes**
- `supabase/migrations/20261114000100_internal_mfa_staff.sql`, `supabase/config.toml`, `supabase/tests/{db.ts,rls-coverage.ts,internal-mfa.test.ts}`, `packages/db/src/types.ts` (generated).
- `packages/domain/src/policy/workspace{,.test}.ts`.
- `apps/web/src/server/auth/{assurance,assurance.test,guard,paths,paths.test,schemas,origin}.ts`; `apps/web/src/app/ops/{page.tsx,projects/[id]/page.tsx,mfa/**,admin/staff/**}`; `apps/web/src/app/app/settings/team/actions.ts`; `apps/web/src/workspace/{copy.ts,mfa/*,ops/*,workspace-guard.test.ts,workspace-isolation.test.ts}`.
- `e2e/support/{totp,world,global-setup,helpers}.ts`, `e2e/tests/{03-supplier-and-ops,06-mfa-and-staff}.spec.ts`, `e2e/README.md`.
- Docs: DECISIONS (ADR-043), SECURITY (T8, §3), SECURITY_PERMISSION_MATRIX, MIGRATION_DEPENDENCY_MAP (row 0014, helpers), STATUS, BACKLOG, this report.
- Not touched: `apps/web/src/design-preview/**`, `apps/worker/**`, merged migrations.

**Security review**
- *Tenant isolation:* internal privileges now need `aal2` in both layers. The guard decides eligibility before MFA, so buyers and suppliers still get a 404 on every `/ops` URL, MFA pages included. At `aal1` an internal member reads only their own membership rows and the internal org's name row. Buyer and supplier semantics are unchanged (all previous DB tests pass).
- *Secrets:* no keys in code. The local stack's keys went to a scratch env file outside the repo. TOTP setup keys and the run password live only in the git-ignored `e2e/.auth/world.json`. The service role is not used by the web tier.
- *Untrusted input:* `next`, factor id, codes, emails and roles go through zod and `afterMfaPath`. The factor id is checked by Supabase Auth (it must belong to the user). The QR SVG is validated and served only as an `<img>` data URL. Codes and tokens are never logged (the isolation test asserts this).
- *Idempotency / replay:* invites are single use (hash stored), 72 h, bound to the email. TOTP challenges are per attempt; the tests never reuse a code.
- *Rate limits:* Supabase Auth's MFA challenge/verify limits apply; the actions map 429 to a "wait a minute" message.

**Assumptions**
- Started from the B-05 branch because #40 had not merged; it has since merged.
- Staff provisioning is an invite, not a direct add. The backlog row says "invite / provisioning flow".
- Founder-only factor reset is acceptable for a handful of staff until recovery codes exist.

**Budget implications:** none. Supabase MFA (TOTP) is available on the free plan; no paid service was used.

**Founder actions required**
- Review draft PR #41.
- Before any hosted project: enable TOTP in Authentication → Multi-Factor.
- Keep the lost-device reset procedure (SECURITY.md §3).

**Next task:** CI evidence on the PR, then the follow-ups above (recovery codes or an audited admin factor reset; staff-invite revocation).
