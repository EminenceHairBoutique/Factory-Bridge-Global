# B-05 / M1 — production auth and role-gated routes (session report)

## Session report — 2026-11-10
Phase: 1  |  Slice: B-05 / M1 — sign-in, org creation, invites, org switcher, role-gated `/app`, `/ops`, `/supplier`
Branch `eng/b05-auth-production` from `origin/main` `a861da3` (main CI run 42797946503 green on `check` + `db`), draft PR
[#40](https://github.com/EminenceHairBoutique/Factory-Bridge-Global/pull/40).

**Implemented**
- **ADR-041** (`docs/DECISIONS.md`), covering six decisions:
  - The web tier calls `app.*` through thin `public` wrappers: SECURITY INVOKER, `search_path = ''`, EXECUTE for `authenticated` only.
  - `user_profiles` rows come from a first-sign-in upsert, not an `auth.users` trigger. A trigger would have broken the 0002 contract and an existing RLS test.
  - Sessions live in server-only HttpOnly cookies.
  - Authorization is re-read from the database on every request.
  - A role or status change revokes the member's sessions.
  - Internal staff have no self-service path in, and MFA is deferred to B-05b.
- **Migration 0013** `20261110000200_web_auth_rpc.sql` (forward only, no tables):
  - wrappers `create_organization`, `create_invite`, `accept_invite`, `update_membership`, `list_org_members`;
  - `app.list_org_members`, open to owners/admins and platform admins only;
  - trigger `memberships_revoke_sessions`, which deletes `auth.sessions` when someone else changes a member's role or status.
- **Web (`apps/web`)**:
  - `src/proxy.ts` refreshes sessions on the auth and workspace paths only.
  - `server/auth/*`: config that fails closed, a server Supabase client, one guard, a redirect allow-list, zod schemas, app cookies `fbg_org` and `fbg_otp`, the org switcher.
  - Auth pages: `/sign-in` (password, plus an email code request), `/sign-in/code`, `/sign-up`.
  - `/onboarding` (create a buyer or supplier org), `/invite/[token]` (Referrer-Policy `no-referrer`).
  - `/app`: projects, new project + brief, draft brief editing, team page with invites (shown once) and role/status changes.
  - `/ops`: project list and detail, scoped by RLS.
  - `/supplier`: zh-CN foundation dashboard.
  - `SITE_LINKS.signIn = "/sign-in"`.
- **Domain**: `@fbg/domain/workspace` (`resolveWorkspace`, `landingWorkspace`, `canWriteBuyerProjects`, `canManageTeam`) with tests.
- **i18n**: supplier, nav and role strings in en-US and zh-CN.
- **Email templates** (`supabase/templates/*.html`, wired in `config.toml`): sign-in code and sign-up confirmation, both code-only.
- **Playwright** `e2e/`, 15 tests, plus CI job `e2e`. It replaces `scripts/test-e2e-not-implemented.mjs`.

**Tested** (commands + results)
- Local, Windows, PGlite, no Docker: `pnpm typecheck && pnpm lint && pnpm format:check && pnpm test` exit 0.
  - Results: web 313 (was 289), supabase 179 (was 160), domain 57 (was 50), ai 48, worker 12, eval 12, i18n 4.
- `pnpm verify:production-build`: exit 0. `/` renders `<h1 id="hero-heading">` with "Know your true cost". Every `/design-preview/*` route returns 404 "Page not found". The same 6 known RSC-name WARNs as on `main`.
- Red check: making `public.accept_invite` SECURITY DEFINER, or granting `list_org_members` to anon, fails the new public-function guard (2 failures). It passes again once the migration is restored.
- CI run [42813415922](https://github.com/EminenceHairBoutique/Factory-Bridge-Global/actions/runs/42813415922) (`aa97a6b`):
  - `check` ✅. `db` ✅: the real Supabase stack applied 0013, the suite passed, and the generated-types drift check passed, so the hand-written `Functions` block matched CLI 3.1.0.
  - `e2e` failed on a selector bug: the required marker makes the label read "Email *".
- CI run [42818235020](https://github.com/EminenceHairBoutique/Factory-Bridge-Global/actions/runs/42818235020) (`ccc5e35`): `check` ✅, `db` ✅, `e2e` **14/15**.
  - Green: cross-tenant and cross-workspace direct URLs (404), viewer read-only, assigned and unassigned operators, supplier zh-CN, sign-up → org → brief → switcher, invite once and wrong-email refusal.
  - Also green: **demotion and suspension end the member's session on the next request**.
  - The email-code test failed because Supabase's default template is link-only. Fixed in `a3176c8` (code templates).
- CI run [42818786653](https://github.com/EminenceHairBoutique/Factory-Bridge-Global/actions/runs/42818786653) (`a3176c8`): **`check` ✅, `db` ✅, `e2e` ✅ 15 passed (20.9 s)**.

**Deployed:** nothing. No hosted database exists, and the Vercel build has no Supabase variables, so `/sign-in` there says sign-in is not configured.
**Partial:** the supplier workspace is a foundation only.
**Blocked:** none in code. A hosted environment waits on OQ-16.
**Planned:**
- **B-05b**: MFA/AAL2 for internal roles, plus a staff provisioning flow.
- A supplier team page.
- CSP (SECURITY T15).

**Changes**
- `supabase/migrations/20261110000200_web_auth_rpc.sql`
- `supabase/tests/{web-auth-rpc.test.ts, migrations.test.ts, rls-coverage.ts, db.ts}`
- `supabase/config.toml` (email templates) and `supabase/templates/`
- `packages/db/src/types.ts` (Functions)
- `packages/domain/src/policy/workspace{,.test}.ts` and `package.json` export `./workspace`
- `packages/i18n` catalogs
- `apps/web/src/{proxy.ts, server/auth/**, server/buyer/**, workspace/**}`
- `apps/web/src/app/{(auth),onboarding,invite,app,ops,supplier}/**`
- `apps/web/next.config.ts` (invite Referrer-Policy) and `site/links.ts`, plus `SiteHome.test.tsx`
- `e2e/**`
- `.github/workflows/ci.yml` (new `e2e` job only)
- Docs: DECISIONS (ADR-041), MIGRATION_DEPENDENCY_MAP (0013 row + helpers), SECURITY §3, BACKLOG (B-05, B-05b), STATUS, CLAUDE.md §8, README, `.env.example`

**Security review**
- **Tenant isolation**: RLS is unchanged and still the second layer. The new server guard is the first.
  - The wrappers are SECURITY INVOKER, so they add no privilege (proven by anon and other-tenant negative tests).
  - Teammates' emails are readable only by owners/admins.
  - Every workspace page and action calls the guard; a static test fails otherwise.
  - Another tenant's object returns 404.
- **Secrets**:
  - The web app reads only the URL and anon key.
  - The service role appears only in e2e fixtures, against loopback URLs (`e2e/support/env.ts` refuses others).
  - The per-run e2e password is random and kept in a git-ignored file. GitGuardian flagged it as a false positive (see Founder actions).
- **Untrusted input**:
  - zod validates every form.
  - `next` passes an allow-list, with an open-redirect test.
  - Invite tokens are format-checked before the database call.
  - Errors don't reveal whether an account exists.
  - Logs carry error codes only, enforced by a test.
- **Sessions**:
  - HttpOnly, SameSite=Lax cookies, Secure off-localhost.
  - Revoked on a role or status change made by someone else.
  - Authorization is never cached.
- **Idempotency**: invite acceptance is single-use in SQL. Org creation is not idempotent: a double submit creates two orgs. That is acceptable for now.
- **Rate limits**: Supabase Auth's limits only. There is no app-level limiter (B-28).

**Assumptions**
- Sign-up is open in the app. Whether it is open on a hosted project is the `enable_signup` setting and the founder's decision.
- Any signed-in user may create a supplier org (matches `app.create_organization` and the domain policy).
- Magic links are not used.

**Budget implications:** none. No paid service, the local stack only, and CI minutes for one more job (~5 min).

**Founder actions required**
1. Review #40 (draft).
2. Decide whether `e2e` becomes a required check (repository setting).
3. Mark GitGuardian incident 39900157 as a false positive.
4. Before any hosted project:
   - copy the email templates;
   - set the password minimum to 10;
   - decide on `enable_signup`;
   - keep real data out of `/ops` until B-05b ships.

**Next task:** B-05b (MFA for internal roles + staff provisioning), or the web half of B-11 (buyer upload flow) together with the B-10 signed-URL endpoint, both of which needed the signed-in, membership-checked path this slice adds.
