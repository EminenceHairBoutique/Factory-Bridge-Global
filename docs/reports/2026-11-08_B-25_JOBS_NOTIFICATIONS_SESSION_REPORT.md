# Session report — 2026-11-08 (Phase 1, B-25 + B-11 schema half)

**Phase:** 1 | **Slice:** migration 0012 `jobs_notifications` | **Branch:** `b-25-jobs` (stacked on `b-21-landed-cost`)

| | |
|---|---|
| **Implemented** | pgmq queues (`fbg_documents`, `fbg_extraction`, `fbg_notifications`, `fbg_fx`) and pg_cron schedules (`fbg_expire_quotations` 06:15 UTC, `fbg_notify_expiring_quotations` 06:30 UTC), created only where the extensions exist and asserted to exist on the real stack; `pgmq` schema usable by `service_role` only. `job_executions` — worker idempotency ledger, UNIQUE `(queue, idempotency_key)`, `running ⇔ finished_at IS NULL`. `jobs_dead_letter` — poison messages with error/attempts; internal read; platform admins resolve (`requeued | discarded | fixed_manually`) and can change nothing else. `notifications` — own-row RLS, recipient may set `read_at` only, `dedupe_key` unique, kinds as a CHECK list; written only by the worker or `app.notify()` (not executable by signed-in users). `app.expire_quotations()` — expires current confirmed quotations with a past `valid_until` through `app.transition_quotation` as `system` (transaction-local service_role claim; key `expire:<id>:<date>`) and notifies the buyer org's owners/admins once; NULL validity never auto-expires. `app.notify_expiring_quotations(n)` — one reminder per quotation × user within `n` days. |
| **Tested** | `pnpm check` → **275 tests** (6 new). Cases: engine-aware queue/schedule assertion (skipped-and-asserted on PGlite; required on Supabase); duplicate idempotency key rejected per queue, allowed across queues; `succeeded` needs `finished_at`; bad queue name; only platform admins read the ledger, nobody inserts; dead letters invisible to buyers, readable by operators, resolvable by admins only, resolution needs a reason code, `resolved_by` stamped, other columns frozen; notifications: user and `app.notify` both denied to signed-in users, worker writes, dedupe returns NULL, unknown kind rejected, user sees own only, payload/user_id frozen, `read_at` settable, other users' rows untouched, no delete; sweep: past quotation expired as `system` with the dated key, future and NULL left alone, owner notified once and member not, second sweep a no-op with no duplicate notification, signed-in users cannot run the sweep; reminders: 2 (owner + member) then 0, window respected, payload carries `days_left`. **Local Postgres 16** (apt build, no pgmq/pg_cron): all suites pass except the deliberate "extensions must exist on the real stack" assertion — which is exactly the failure that should appear anywhere that isn't Supabase. |
| **Deployed** | Nothing. |
| **Partial** | B-11's code half (worker consumer with visibility timeouts and retries, `/health`, upload client) and email fan-out are not built; the FX job's provider is ADR-010 (proposed). |
| **Blocked** | Worker host (ADR-006 gate G1: Railway/Fly.io = paid account) — founder decision before the worker can run anywhere but locally. |
| **Planned** | 0010 `ai_review` (Claude Code, B-18) is the last planned migration. |

**Also fixed while building:** my new suite's fixture org ids collided with Claude Code's `ai-runs.test.ts` ids (`e1e1e1e1…`), which only shows on a shared database — renamed to a unique prefix. Fixture id prefixes are now: rls `aaaa/bbbb`, suppliers `dddddd0x`, documents `eeeeee0x`, evidence `a7/a8`, projects `b1–b4`, quotations `c1–c4`, landed cost `d1–d4`, jobs `ab1–ab3`, ai-runs `e1e1/e2e2`.

**Changes:** `supabase/migrations/20261107001200_jobs_notifications.sql` (new), `supabase/tests/jobs.test.ts` (new), `supabase/tests/rls-coverage.ts` (3 tables + allow-list), docs: `DECISIONS.md` (ADR-038), `MIGRATION_DEPENDENCY_MAP.md` (row 0012, 3 helpers), `SCHEMA_PLAN.md` (§2.10 as built), `BACKLOG.md` (B-25 ✅◐, B-11 ◐), `STATUS.md`.

**Security review:**
- *Queues are not a tenant surface:* no signed-in role can read or write `pgmq`; the worker is the only client.
- *Idempotency at the database:* a redelivered message cannot run twice (unique violation), and the expiry sweep is idempotent through `quote_status_events` keys and `notifications.dedupe_key` (tested twice-run).
- *System actor is explicit and scoped:* the sweep marks itself `service_role` for its own transaction only; the resulting events read `acting_as = system`; no signed-in user can invoke the sweep or `app.notify`.
- *Least privilege:* recipients can change `read_at` and nothing else; admins can resolve a dead letter and nothing else; the ledger is read-only to admins.
- *CI honesty:* the extension assertion fails on any non-Supabase Postgres by design so the guarded blocks can never be silently skipped in CI.
- No secrets; fixtures invented; nothing deployed.

**Assumptions:** `pgmq` and `pg_cron` are installable by the migration role on the local CI stack (both ship with the Supabase Postgres image; pg_cron is preloaded there). If CI shows otherwise, the fix is in `supabase/config.toml` / the CI stack, not in the schema. Expiry notifications go to owners/admins; reminders also to members.

**Budget implications:** none now; the worker host (G1) is the next paid decision.

**Founder actions required:** (1) open the PR for `b-20-quotations`; then push `b-21-landed-cost` and `b-25-jobs` in order as each merges; (2) decide ADR-006 worker host and ADR-010 FX provider when ready — nothing is spent until you say so.

**Next task:** B-11 code half (worker consumer against these tables) — best owned by the session that owns `apps/worker` (Claude Code), or by me if you prefer; or B-05 (web app auth + supplier zh-CN form) which the UX work now needs.
