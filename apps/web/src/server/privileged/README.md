# Privileged server modules

The only place in `apps/web` allowed to import `@fbg/db/service-role` (enforced by `eslint.config.mjs`).

Rules for every function here (docs/SECURITY.md §3):
1. Re-check the caller's authorization explicitly — do not rely on RLS, because the service role bypasses it.
2. Write an `audit_events` row with `acting_as = 'system'`.
3. Keep the function narrow (one purpose), and add a negative test.

Empty in B-01. First expected module: invite acceptance (B-05).
