# Session report — 2026-11-10 (M2, B-11 code half: the queue worker)

**Phase:** 1 (M2) | **Slice:** pgmq consumer + one real handler + `/health` | **Branch:** `claude/jovial-heisenberg-989547` from `origin/main` `a861da3` | **PR:** draft to `main`

| | |
|---|---|
| **Implemented** | `apps/worker` consumer over the four 0012 queues: <ul><li>read with a visibility timeout (default 120 s), extended by a heartbeat while a handler runs</li><li>strict job envelope; idempotency through `job_executions`: a replay is a no-op ack, the same key with different content is dead-lettered, a crashed delivery is taken over, and attempts beyond the cap are dead-lettered without running</li><li>handler writes, the `succeeded` marker and the archive commit in **one** `service_role` transaction</li><li>bounded retries with exponential backoff (10 s → 900 s, jitter), then `jobs_dead_letter` after `JOB_MAX_ATTEMPTS`</li><li>graceful shutdown: grace period, then abort</li></ul> **Handler:** `fbg_notifications` `notification.create` checks the recipient's active membership, then calls `app.notify` with a `dedupe_key`; in-app only. `fbg_documents` / `fbg_extraction` / `fbg_fx` fail closed (`not_implemented` → dead letter on attempt 1). **`/health`:** real `pgmq.list_queues()` + `pgmq.metrics()` as `service_role`; 200 only when all four queues are readable and the loop runs. **Migration 0012b** `worker_queue_grants`: without it `service_role` cannot use pgmq at all. **ADR-041.** |
| **Tested** | **Locally on Windows, real Supabase stack:** Docker plus the CI-pinned Supabase CLI 3.1.0 (image `supabase/postgres` 17.11.0.018, pgmq 1.5.1), from a scratch copy of `supabase/` on ports 5532x; `db reset` ×2.<ul><li>`pnpm test:db` with `DATABASE_URL`: **164/164** (incl. 4 new `queue-grants.test.ts`)</li><li>`pnpm --filter @fbg/worker test:integration`: **10/10**. **Red without 0012b:** 8/10 fail with `permission denied for table q_fbg_*`; the 2 that pass use a scratch queue the test grants itself.</li></ul> **PGlite / unit:** `pnpm typecheck` ✅, `pnpm lint` ✅, `pnpm format:check` ✅, `pnpm test` ✅ — worker **84** (was 12), supabase **164** (was 160), web 289, domain 50, ai 48, eval 12, i18n 4. **Mutation check:** 4 injected consumer bugs (off-by-one on max attempts, permanent errors treated as retryable, replay not acked, crash-loop guard removed) each fail ≥ 1 test. **Smoke:** built `dist/index.js` against the local stack: `/health` 200 `connected`; an `fbg_fx` message is dead-lettered live (ledger `failed`, worker id recorded); the connection string never appears in logs. Without `WORKER_DATABASE_URL`: 503 `not_configured`. With `APP_ENV=production` and no URL: refuses to start. **CI** on PR #39: run 42812493547 (`dee4b70`): `db` ✅, `check` ❌ on one gitleaks `generic-api-key` false positive (a synthetic test string in a variable named `secret`); it was fixed by a rename (`db1da62`) plus a single-fingerprint `.gitleaksignore` (`531e7f5`), because PR scans cover every branch commit. Run 42818834873 (`531e7f5`): `check` ✅ and `db` ✅, including the worker integration step. |
| **Deployed** | Nothing. The worker is not hosted anywhere (gate G1). |
| **Partial** | B-11's upload client flow + MIME/size validation (needs B-05 auth and signed URLs). Dead-letter requeue tooling (ADR-041 §7: `failed` is terminal for its key). |
| **Blocked** | Handlers for parsing/OCR (B-12), malware scan (B-13, ⛔ OQ-14), live extraction (B-19, gate G2), FX fetch (ADR-010, proposed) and e-mail delivery (no approved provider). Until then their messages dead-letter by design. |
| **Planned** | Move ADR-040's request-form delivery behind `fbg_notifications` (an `apps/web` follow-up, not touched here). Archive retention and dead-letter alerting (B-28). |

**Changes:**
- `apps/worker/src/`:
  - `queue/{envelope,errors,backoff,store,pg-store,consumer}.ts`, `queue/testing/fake-store.ts`
  - `handlers/{index,notifications}.ts`, `db.ts`, `health.ts`; rewired `index.ts`; `config.ts` (new env, validated)
  - tests: `queue/consumer.test.ts`, `queue/primitives.test.ts`, `handlers/notifications.test.ts`, `health.test.ts`, `config.test.ts`, `queue/pg-store.integration.test.ts`
- `apps/worker`: `vitest.config.ts` (excludes integration), `vitest.integration.config.ts`, `package.json` (`test:integration`), tsconfigs.
- `supabase/migrations/20261110000200_worker_queue_grants.sql` (0012b) and `supabase/tests/queue-grants.test.ts`.
- `.github/workflows/ci.yml`: one new step at the end of the `db` job ("Worker queue integration"). No other job or step changed.
- `.env.example` (placeholders only), `CLAUDE.md` §8 (one command line).
- Docs: `DECISIONS.md` (ADR-041), `MIGRATION_DEPENDENCY_MAP.md` (0012b), `STATUS.md` (Worker / 0012 / B-16b rows, summary counts), `BACKLOG.md` (B-11, B-16b).
- Not touched: `apps/web/**`, `packages/db/**`, and every merged migration (0010/0010b included).

**Security review:**
- *Tenant isolation:* the only real handler refuses a recipient who is not an active member of the notification's org, in the same transaction as the write. Queues remain unreachable for `anon` / `authenticated`, and 0012b re-asserts it with negative tests (no schema USAGE, no table privileges, `send` / `read` / select denied).
- *Least privilege:* 0012b grants only what pgmq's six functions need, on four named queues. It grants no TRUNCATE / purge, no CREATE (no new queues), and no archive/meta writes; each is tested as denied.
- *Secrets:* `WORKER_DATABASE_URL` is required outside development, validated without being echoed, and redacted in logs. `/health` exposes states only: no error text, host names, queue lengths or worker id. No key exists or is needed.
- *Untrusted input:* every message passes a strict schema (size cap; idempotency keys restricted to printable non-space ASCII, so no log injection). Handler payloads are validated again. Error texts name paths and codes, never values, and are bounded and single-line. The dynamic queue-table name in the busy check is used only after the name matches `[a-z0-9_]`.
- *Idempotency:* the `UNIQUE (queue, key)` claim, the payload hash compared on every replay, and handler writes, success marker and archive in one transaction. Under a concurrent take-over, the second commit finds the row no longer `running` and rolls back. A message that crashes the worker is dead-lettered once its attempts are used up.
- *AI:* no handler calls a provider; `GuardedAiRunner` stays unwired (G2). *Rate limits:* none added (B-28).

**Assumptions:**
- Numbered **0012b**, not 0013, because the dependency map reserves 0013+ for the Phase 3 quality tables; this follows the 0003b/0010b convention.
- A notification job must name an `org_id`; user-level notifications without an org are refused, which is the fail-closed choice.
- A `failed` ledger row is terminal for its key.
- The handler runs inside the success transaction. Fine for database-only work, but long external calls will need a split pattern (ADR-041, consequences).

**Side effects on this machine:**
- I started Docker Desktop, which auto-restarted the founder's other project's containers (`supabase_*_sagespan-local`). I did not touch them.
- My stack (`fbg-b11`, ports 5532x) is stopped at the end of the session.
- I installed Supabase CLI 3.1.0 (the CI pin) into the session scratch directory only.

**Budget implications:** none. No paid service, account or hosting.

**Founder actions required:**
1. Review the draft PR; merge only after `check` + `db` are green.
2. Gate G1 (worker host) before the worker runs anywhere but locally and in CI.
3. Gate G2 before any handler calls AI.
4. An e-mail provider decision before notifications leave the app.

**Next task:**
- B-12 parsing handler for `fbg_documents` (isolated child process, page/row caps), with a claim → external work → finalize split per ADR-041. Needs the OQ-14 scanner decision for B-13 first, or parse-after-scan stubbed fail-closed.
- Once B-05 merges: the upload client + signed URLs (B-11's remaining half), and moving ADR-040's form delivery behind `fbg_notifications`.
