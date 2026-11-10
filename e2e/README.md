# e2e — Playwright suite (B-05)

Drives a **production build** of `apps/web` against a **local** Supabase stack. Synthetic users only.
`support/env.ts` refuses to run if any URL is not loopback, so the service-role key it needs for fixtures can
never be pointed at a hosted project.

## What it covers

- Signed-out gating: every workspace URL redirects to `/sign-in?next=…`; an off-site `next` is dropped.
- Password sign-in (and a refused wrong password), email one-time code sign-in through Mailpit, sign-up.
- Two buyer orgs, a supplier org, an assigned and an unassigned operator: lists and **direct URLs** across
  tenants and workspaces answer 404.
- Viewer read-only; owner team page; a buyer creates and edits a brief; org creation and the org switcher.
- Invitations: the link is shown once, another account cannot accept it, the invitee accepts once.
- Role change and suspension: the member's session ends on their next request (migration 0013 trigger).

## Run it locally (needs Docker)

```bash
supabase start
pnpm --filter @fbg/e2e exec playwright install chromium
pnpm --filter @fbg/web build
```

Export the values `supabase status` prints (`API_URL`, `ANON_KEY`, `SERVICE_ROLE_KEY`) as
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `E2E_SUPABASE_SERVICE_ROLE_KEY`, then:

```bash
pnpm test:e2e
```

Without those variables the suite exits non-zero before running anything. It never reports a pass it did not run.
Each run creates its own users (emails carry a run id), so it can be re-run on the same stack.
