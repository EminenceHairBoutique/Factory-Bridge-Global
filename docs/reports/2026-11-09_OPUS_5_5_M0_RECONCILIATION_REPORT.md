# M0 — Baseline reconciliation and B-18 human-review integration

**Directive:** `FACTORY_BRIDGE_GLOBAL_OPUS_5_5_UPDATED_ENGINEERING_MASTER_PROMPT_2026-11-09.md` (audit snapshot `5351cf5`). **Executed:** 2026-11-10 (UTC), primary engineering / integration track. **File name** follows the directive.
**Track ownership honoured:** migration 0010/0010b, B-18 tests, RLS coverage, CI, narrow reconciliation docs. **Not touched:** `apps/web/src/design-preview/**`, `apps/web/src/app/design-preview/**`, `apps/worker/**`.
**Nothing was merged, deployed, purchased or reconfigured by Claude.** Every claim below cites the command, run or API response it rests on; where something could not be verified it says so.

> **Update 2026-11-10 ~09:00 UTC.** `main` moved again while #35/#36 waited: **#37 (B-31 public site, a parallel session)** merged at 09:00 UTC → `8a84688`, CI run [42787025258](https://github.com/EminenceHairBoutique/Factory-Bridge-Global/actions/runs/42787025258) green. It replaced the placeholder homepage with the Atlas × Obsidian public site at `/` (route group `(site)`), a fail-closed sourcing-request form (`INQUIRY_DELIVERY` unset ⇒ `disabled`; proposed ADR-040), a branded site-wide 404, and `noindex` + robots disallow until an opt-in. Both M0 branches took `main` in by merge commit (repo convention for keeping PRs up to date; no rewrite): #35 merged cleanly, and #36's only conflict was `STATUS.md`, resolved to the new facts. The production build gate was adapted: it now checks the new homepage headline, the branded 404 ("Page not found"), `noindex` and `robots.txt` disallow. **This container can no longer run `next build`**: B-31's `next/font/google` downloads fonts from fonts.googleapis.com at build time, and that host is not reachable from this session (B-31's own report records the deviation from `next/font/local`). So the adapted gate is verified by CI only; see #36's checks. Local unit suite on the merged tree: 575 passed (web 289). Sections below keep their original 05:00–06:00 UTC evidence; tables were updated where `main` changed.

---

## 1. Fresh state (verified 2026-11-10 via the GitHub REST API, git and the Vercel API — read-only)

| Item | Value | Evidence |
|---|---|---|
| `main` | **`21c58e6`** — "Merge pull request #34 from …/b-18-ai-review" (2026-11-10 05:25:29 UTC); **since 09:00 UTC `8a84688`** (#37 B-31 public site) | `gh api repos/…/commits/main` |
| Latest `main` CI | run [42762050313](https://github.com/EminenceHairBoutique/Factory-Bridge-Global/actions/runs/42762050313): `typecheck · lint · format · unit tests` ✅, `db: migrations on real Postgres …` ✅ | `gh api …/actions/runs/42762050313/jobs` |
| Changes since the audit snapshot `5351cf5` | #33 (design nav wiring, merged 05:04 UTC) → `58775be`; #34 (B-18 / migration 0010, opened and merged by the founder 05:14–05:25 UTC, **during** this session) → `21c58e6` | merged-PR list |
| Design PRs | The eleven DESIGN-02 PRs the directive names (#17–#20, #22–#25, #27–#29) **are merged**, plus #31, #32 and #33 since then | `gh api …/pulls?state=closed` |
| Open PRs | **#35** `eng/m0-reconcile-b18-foundation` → `main` (0010b security fixes; CI green). **#36** `eng/m0-ci-honesty-docs` → `eng/m0-reconcile-b18-foundation` (this reconciliation; draft, stacked) | `gh api …/pulls` |
| Remote branches | `main`, the two M0 branches, and leftovers `b-20-quotations`, `b-21-landed-cost`, `design/ux03-clarity-pass`, `design/ux04-premium-refinement`, `design/ux-mobile-foundation` (all merged) | `gh api …/branches` |
| Ruleset `main-protection` | active on the default branch: PR required (0 approvals, conversation resolution), required checks = the two CI jobs above, **strict** (branch up to date), no force-push, no deletion | `gh api …/rulesets/26752675` |
| **Visibility** | **public** according to GitHub. `OPEN_QUESTIONS.md` OQ-21 records "private (2026-11-07)" | `gh api repos/… --jq .visibility` |
| Hosting | Vercel project `web` (team `eminence1`, `prj_qQ0Z…`) is Git-connected. Every `main` push becomes a **production** deployment (e.g. `dpl_CRh28vkYkGCQAzrLdXu8gVBTZkQw` for `58775be`, READY). Every branch, including both M0 branches, gets a **preview** deployment. Protection: Vercel Authentication on all deployments except custom domains, and there is no custom domain. **No environment variables** (`envs: []`) | Vercel API `list_deployments`, `get_project`, `filter_project_envs` (names only, nothing decrypted). I deliberately did not use the tool that fetches protected deployment URLs: it would have created a share link |
| Worktrees (container) | `/home/claude/wt-m0` on `eng/m0-reconcile-b18-foundation`; `/home/claude/wt-m0b` on `eng/m0-ci-honesty-docs` | `git worktree list` |

## 2. Verified implementation matrix

Legend: **Tested (env)** names the engine. PGlite = development-time SQL checks. Real Supabase = CI's local Supabase stack (Postgres 17.11, storage-api, gotrue). Local PG16 = this container's Postgres 16.15 with the test shim.

| Area | Implemented | Tested (env) | Merged | Deployed | Partial / blocked |
|---|---|---|---|---|---|
| Migrations 0001–0012 incl. 0003b (tenancy, audit, AI ledger, taxonomy, suppliers, documents/storage, evidence, projects/briefs, quotations, FX/landed cost, jobs/notifications, AI review) | ✅ | ✅ PGlite; ✅ real Supabase (`main` run 42762050313) | ✅ | ❌ no hosted DB exists | — |
| **0010b** `ai_review_hardening` (4 security fixes, §3) | ✅ | ✅ PGlite 11/11 + red-green; ✅ local PG16 (two fresh chains, 3 runs: 159/160, the deliberate pgmq assertion only); ✅ **real Supabase: #35 run [42763294286](https://github.com/EminenceHairBoutique/Factory-Bridge-Global/actions/runs/42763294286) — 160/160, both migrations applied by `db reset` ×2** | ⏳ #35 | ❌ | merge pending founder |
| RLS + grant-layer guard (every `public` table registered, RLS enabled+forced, privilege allow-list, anon reads nothing) | ✅ | ✅ PGlite + real Supabase | ✅ | ❌ | — |
| Domain engine (money/FX, tiers, Incoterms, lifecycle) | ✅ partial | ✅ 50 unit tests | ✅ | n/a | spec matching, landed-cost assembly, ranking: not written (B-14) |
| AI adapter + `quotation_extractor` v1.0.0 + offline eval harness | ✅ | ✅ MockProvider only (48 + 12 tests) | ✅ | ❌ | **live model never called**; needs G2 go-ahead (spends money) |
| Worker (`apps/worker`) | ◐ config, logging, `GuardedAiRunner`, `PgAiRunStore`, `/health` | ✅ 12 unit tests | ✅ | ❌ not hosted | **not operational**: `/health` reports `queue: "not_configured"`; no pgmq consumer (B-11) |
| Web app product surface | ◐ public marketing site at `/` (B-31, #37; form fail-closed, `disabled` by default), `/api/health` | ✅ unit tests (web 289); ✅ production build gate (#36, CI) | ✅ | ◐ public site only, behind Vercel Authentication, `noindex` | no sign-in, no workspace on real data (B-05…) |
| Design-preview prototypes (Atlas × Obsidian) | ✅ synthetic data only | ✅ unit tests (232 web tests total); ✅ production gate: 7 routes 404 in 3 production configurations, served only in the positive control | ✅ | Off on every Vercel build by code (no env vars). HTTP-checked in CI from #36 on, not against the live URL | ⚠️ the production 404 `<title>` still names the design preview (§4) |
| Generated DB types | ✅ `packages/db/src/types.ts` (#36) | ✅ byte-identical to the pinned CLI's generation on the real Supabase stack (run 42765216855) | ⏳ #36 | n/a | — |
| E2E | ❌ none | `test:e2e` now **fails on purpose** (#36) | — | — | Playwright arrives with B-05 |

**Previews vs production.** "Production" on Vercel means the protected build of `main`. It contains only the public marketing site (form switched off, `noindex`): no database, no auth, no AI, no secrets. Previews are the same app built from branches. No customer-facing service is running.

## 3. B-18 review

**Difference from `main` when M0 started.** `main` was at `58775be`. B-18 was one commit (`2b64f3c`) on `b-18-ai-review`, 1 ahead and 95 behind. Its own base was the since-merged `b-25-jobs`.

**Reconciliation method.**
1. `git cherry-pick -x 2b64f3c` onto `58775be` in a fresh worktree. It applied cleanly; the tree was later verified identical to what #34 merged (`git diff --stat 72738ee origin/main` → empty).
2. Independent security review of the migration found four gaps.
3. The fixes were first written into 0010 in place, while 0010 was unmerged, and opened as #35.
4. The founder merged #34 (the unfixed text) at 05:25 UTC, before my warning reached them. Merged migrations are append-only, so I **rebuilt #35 as forward migration 0010b** `20261110000100_ai_review_hardening.sql` on top of `21c58e6`, and force-pushed only my own PR branch.
5. 0010 is untouched. `git diff origin/main -- supabase/migrations/20261109000100_ai_review.sql` is empty.

**Dependency order.** 0010 (`20261109000100`) sorts after 0012 per ADR-037 §6. 0010b (`20261110000100`) depends only on 0010. It uses `CREATE OR REPLACE` for `app.accept_extraction` and `app.review_task_before_write`, which keeps each function's owner and ACL, and restates the `accept_extraction` grants. It runs `DROP` + `CREATE POLICY documents_update`. Dependency-map row 0010b was added.

**The four gaps (risk) and fixes (ADR-039 §9).**

| # | Gap in 0010 | Who could exploit it | Fix in 0010b |
|---|---|---|---|
| 1 | Idempotent replay was checked **before** `review_task_decidable` | A viewer or outsider who obtained an earlier idempotency key learns the resulting quotation id | Decide-check first |
| 2 | The accepted payload's `source_type` / `rights_class` came from the payload | Any decider could re-label a buyer-private operator import as a supplier-portal or catalog price, which feeds visibility and rights rules | Both forced from the document row |
| 3 | `documents_update` let an assigned operator update **any** document on the buyer's project | An assigned operator could discard the buyer's own uploads | The operator clause requires `source_type = 'operator_import'` |
| 4 | Status protected only by the missing UPDATE grant | `service_role` (table grants) or a privileged session could move status, attach an unrelated quotation, spoof `resolved_by`, or edit a resolved task | The trigger requires a signed-in person for any status change, `resolved_by = auth.uid()`, an accepted extraction task citing a quotation of **its own** document and extraction, and freezes resolved tasks |

**Residual risks.**
- With fix 4, **no job can ever change a review status.** A future expiry needs its own ADR and migration.
- With fix 2, the document's rights class constrains which `quote_type` can be accepted (0009 honesty CHECK). The review UI must only offer compatible types.
- `app.review_document_transition` silently returns `false` if the document is not `in_review`, so the worker must move documents to `in_review` (§6).

**RLS / permission-matrix change.** Assigned operators may change only `operator_import` rows on a buyer project (`SECURITY_PERMISSION_MATRIX.md` updated). No other cell changed.

**Tests executed (exact results).**
- `supabase/tests/ai-review.test.ts`: 8 → 11 tests. New: operator reach over buyer files; provenance relabel + extraction swap; viewer replay; worker cannot extract from an unparsed document or move status; extractions immutable; privileged foreign-quotation attach and `resolved_by` spoof refused; resolved task frozen; `anon` reads and RPCs denied.
- Red-green: with 0010 alone, 3/11 tests fail. Under soft assertions, every new hardening assertion fails individually (the foreign-quotation check isolated with the task left pending). With 0010b: 11/11.
- `pnpm format:check`, `pnpm typecheck`, `pnpm lint`: clean. `pnpm test` (PGlite): **518 passed** (domain 50, ai 48, i18n 4, worker 12, eval 12, web 232, supabase 160).
- Local Postgres 16.15: fresh chains `fbg_m0c` (run twice) and `fbg_m0d`, each with shim + 14 migrations + seed: **159/160 each run**. The single failure is `jobs.test.ts` "pgmq must be installed on the CI Supabase stack", which by design only the real Supabase stack satisfies.
- **Real Supabase (CI, #35, run 42763294286): `db` ✅ 160/160, `check` ✅.**

## 4. Generated DB types and CI enhancements (#36)

**Files.**
- `.github/workflows/ci.yml`
- `scripts/verify-production-build.mjs`
- `scripts/test-e2e-not-implemented.mjs`
- `scripts/gen-db-types.mjs`
- `packages/db/src/types.ts` (generated)
- `packages/db/src/index.ts`
- root `package.json`, `.prettierignore`, `eslint.config.mjs`
- docs

**Production build gate** (`pnpm verify:production-build`, in the required `check` job). `next build` runs first, then `next start` under four runtime environments, checked over real HTTP:
- `/` renders the public site's headline, is served `noindex`, `/robots.txt` disallows everything (no scenario opts in to indexing), and `/api/health` returns 200.
- Seven `/design-preview` routes return 404 with the site-wide not-found page ("Page not found", B-31) and **no prototype screen content**. The content markers are the theme-boot script, runtime fonts and synthetic data names. This holds with no `APP_ENV`, with `DESIGN_PREVIEW=enabled` alone, and with `APP_ENV=production` plus `DESIGN_PREVIEW=enabled`.
- Positive control: `APP_ENV=staging` plus `DESIGN_PREVIEW=enabled` serves all seven routes (200), and each marker must be seen there, so a stale marker fails loudly.
- Red check: forcing an exposed configuration into a scenario that expects 404 makes the gate exit 1.
- Results: passed locally (container) and in CI (`check` job of #36 pass 1, run 42763698129).
- **Known gap, reported as WARN and not hidden (re-measured after #37, run [42789256218](https://github.com/EminenceHairBoutique/Factory-Bridge-Global/actions/runs/42789256218)).** In a production build every probed `/design-preview` route is a real 404 with the branded "Page not found" page and no synthetic data, theme script or fonts. But the response's streamed React (RSC) payload still names the prototype: 6 of 7 routes carry the gated page's own `<title>` metadata (e.g. "Projects — buyer design preview (demo data)"), and `/design-preview` itself also carries its heading text ("Track UX-01 · Atlas × Obsidian design preview"). The layout's `notFound()` stops the HTML, but Next.js still resolves the page's metadata and part of its tree. No customer data is involved (prototypes are synthetic and the repository is public), so this is an information-disclosure nit, not a data leak. Fix options (design-preview track, or B-05 when it adds `apps/web/src/proxy.ts` for sessions): return 404 before rendering, at the proxy, for `/design-preview/*` whenever the gate is off; or gate each page's `generateMetadata` and body. The gate's WARN lines will turn into "ok" when it is fixed; M0 does not touch those files.

**`test:e2e`.** It used to `echo … && exit 0`. It now exits 1 with "no end-to-end suite exists yet (Playwright arrives with B-05) … nothing was tested". It is not called by CI.

**Generated types.** `packages/db/src/types.ts` is produced by `scripts/gen-db-types.mjs`: Supabase CLI **3.1.0** (`gen types typescript --remote=<db-url> --schema public`), then the repo's Prettier config, plus a GENERATED header. Hand edits are impossible to keep: CI's `db` job runs `node scripts/gen-db-types.mjs --check` after `db reset` ×2 and `test:db`, and fails on any byte difference. On failure it prints a bounded diff and uploads the regenerated file as the `generated-db-types` artifact. `supabase/setup-cli` is pinned to 3.1.0, which "latest" resolved to in the last run.

How the file was produced here: three passes, all recorded in the commits.
1. Pass 1 showed the artifact route works in CI, but its blob-storage host is **not reachable from this session**, so I could not download it.
2. Pass 2 (postgres-meta 0.100.0 output) did not match, because CLI 3.1.0 has its own unformatted generator.
3. Pass 3 runs the pinned CLI from npm (`supabase@3.1.0`) with no Docker, against a fresh local PG16 chain. Its `--check` passes locally.

**CI on the real stack is the arbiter, and it agrees.** Run [42765216855](https://github.com/EminenceHairBoutique/Factory-Bridge-Global/actions/runs/42765216855) (commit `a2ceb34`): `db` ✅ 160/160, then `node scripts/gen-db-types.mjs --check` → "packages/db/src/types.ts matches a fresh generation from the migrations" on Supabase Postgres 17. `check` ✅, including the production build gate. `@fbg/db` now exports the generated `Database`, `Json`, `Tables`, `TablesInsert`, `TablesUpdate` and `Enums`. Nothing imports the client yet, and workspace typecheck is clean.

**Not weakened:** gitleaks, `pnpm audit`, typecheck, format, lint and the DB suite are unchanged. The ruleset is unchanged; the new build gate is a step inside the already-required `check` job.

## 5. Before / after inventory and decisions

| Path | Before (`58775be` / `21c58e6`) | After (#35 / #36) |
|---|---|---|
| `supabase/migrations/20261109000100_ai_review.sql` | from #34 | **unchanged** (append-only) |
| `supabase/migrations/20261110000100_ai_review_hardening.sql` | — | new (#35) |
| `supabase/tests/ai-review.test.ts` | 8 tests | 11 tests (#35) |
| `docs/DECISIONS.md` ADR-039 | §1–8 | §9 added (#35) |
| `docs/STATUS.md`, `BACKLOG.md`, `MIGRATION_DEPENDENCY_MAP.md`, `SECURITY_PERMISSION_MATRIX.md`, B-18 report | B-18 era text: "#26 open", "private", "nothing is deployed" | reconciled (#35, then #36) |
| `.github/workflows/ci.yml` | no build; CLI `latest` | build gate step; CLI pinned 3.1.0; types drift check + artifact (#36) |
| `package.json` | `test:e2e` echo exit 0 | `test:e2e` fails honestly; `verify:production-build`; `db:gen-types` (#36) |
| `scripts/*.mjs` | — | three scripts (#36) |
| `packages/db/src/index.ts`, `types.ts` | `Database = Record<string, never>` | generated types exported (#36) |
| `README.md`, `CLAUDE.md` §8, 7 spec headers | "Phase 0 — no application code", "nothing implemented" | current reality pointing at STATUS (#36) |

**Decisions and alternatives.**
- **Forward migration instead of editing 0010.** The alternative, rewriting 0010, violates append-only history once merged.
- **Build gate inside `check` rather than a new job.** A new job would need a ruleset change, which is a founder setting.
- **Title leak reported, not fixed.** The fix lives in files owned by the design track.
- **Types generated with the CLI's own generator, formatted with Prettier.** The raw CLI output is unformatted and unreviewable. Formatting is deterministic and is part of the checked recipe.
- **No artifact workaround.** When the artifact host was refused, I did not retry through another route. I regenerated with the same pinned tool and let CI arbitrate.

**Destructive changes skipped.** No branch deletion, no `main` history change, no Vercel or GitHub setting change. One force-push, to my own PR branch #35, with `--force-with-lease`. A local backup branch `backup/m0-pre-rebase-2a53cb4` was kept in the container.

## 6. Contracts the auth (M1) and worker (M2) tracks can consume

**Stable (on `main`, plus 0010b once #35 merges).**
- **Identity:** `auth.uid()` = JWT `sub`. Tables `organizations` (`org_type` buyer / supplier / internal), `user_profiles`, `memberships` (`member_role`: owner, admin, member, viewer, operator, compliance_reviewer, platform_admin), `invites`.
- **Tenancy functions:** `app.create_organization`, `app.create_invite`, `app.accept_invite`, `app.update_membership` (SECURITY DEFINER, `search_path = ''`).
- **Projects and briefs (0008):** projects, assignments (lead/support), shortlist, briefs + items (status machine; blocked categories refused).
- **Documents (0006/0008/0010/0010b):** `document_status` uploaded → scanning → parsed → extracted → in_review → accepted (also rejected, discarded). Member insert, or an assigned operator with `operator_import`. Storage: quarantine bucket upload policy keyed on the document row; served-bucket promotion requires sha256 and a scan. Access log: `app.log_document_access`.
- **Worker writes (as `service_role` via `set local role service_role`):**
  - Document status transitions.
  - `ai_runs` (via `GuardedAiRunner` / `PgAiRunStore`; budget per org).
  - `ai_extractions`: needs document status parsed/extracted/in_review and an `ai_runs` row with `purpose = 'extract'` and status ok/schema_invalid. Immutable.
  - `review_tasks`: insert with status `pending` only.
  - After creating tasks, **the worker must move the document to `in_review`**, otherwise the accept-time completion is a silent no-op.
  - `job_executions` (`unique (queue, idempotency_key)`, status running/succeeded/failed), `jobs_dead_letter`, `notifications` (`dedupe_key` unique).
- **Queues (pgmq, real stack only):** `fbg_documents`, `fbg_extraction`, `fbg_notifications`, `fbg_fx`. pg_cron runs `app.expire_quotations` (06:15) and `app.notify_expiring_quotations(7)` (06:30).
- **Review (people only):** `app.start_review(task)`, `app.reject_review(task, reason ≥ 3 chars)`, `app.accept_extraction(task, payload, p_old, reason, idempotency_key ≥ 8)` → a confirmed quotation through `app.supersede_quotation`.
- **Types:** `@fbg/db` `Database` (generated; public schema only).

**Missing or undecided (blockers to list in the M1/M2 ADRs).**
1. **The Data API exposes `public` and `graphql_public` only** (`supabase/config.toml`). All 95 functions live in `app`, so `supabase-js .rpc()` cannot call `app.create_organization`, `accept_invite`, `accept_extraction` and the rest. M1 must decide, by ADR:
   - (a) thin `public` SECURITY INVOKER wrappers per user action (recommended: smallest surface, RLS still applies); or
   - (b) server-side SQL with the verified JWT claims set per transaction; or
   - (c) exposing `app` (not recommended: exposes 95 helpers).
2. No sign-up hook creating `user_profiles` on `auth.users` insert (B-05 decides trigger vs first-login upsert).
3. No signed-URL issuance endpoint (B-10 ◐ / B-11).
4. No queue consumer, visibility-timeout, retry or backoff code (B-11).
5. No parser/OCR/virus-scan service (B-12/B-13; ⛔ OQ-14 for scanner choice).
6. No live AI run (G2).
7. No hosted Supabase project (OQ-16 / ADR-028).

## 7. Founder actions (only decisions that are yours)

1. **Review and merge #35** (0010b) before any database environment exists. Then I take #36 out of draft; merge it after #35, once it has retargeted to `main`.
2. **Repository visibility.** GitHub says **public**; OQ-21 says you chose private. Pick one. If public is intended, nothing changes, but no customer, supplier or proprietary data may ever be committed.
3. **Vercel vs ADR-028 / OQ-16 ("no production deployment").** Your Vercel Git integration turns every `main` merge into a protected production deployment. Either record that this is acceptable while nothing is connected, or pause it. Also check whether "Vercel Agent Review" on each PR is billed on your plan. Every merge triggers a production build.
4. **Before any paid hosting (OQ-16):** approve a Supabase project and region, plus a worker host, with budgets. Not needed for M1/M2 development, which uses local and CI stacks.
5. **Legal and permission templates** (supplier data-sharing consent, buyer terms) remain open questions (OQ-05/06/07/…). They are needed before any real supplier or buyer data, not before M1/M2 code.

## 8. Next exact task

**M1 — B-05 production auth and role-gated routes**, on branch `eng/b05-auth-production` in its own worktree, from `main` **after #35 merges**. It is the first step of the MVP gate: every customer flow, including the review UI that consumes 0010/0010b, needs a signed-in, membership-checked user. Its first deliverable is the §6-1 ADR on how the web tier calls `app.*`.

M2 (worker, `eng/b11-document-worker`) can run in parallel in a separate session because the queue and table contracts above are stable. It must not edit 0010/0010b.

Scope boundaries for M1:
- Owns `apps/web/src/app/**` production routes (`/app`, `/ops`, `/supplier` foundation), auth handlers, a server-side session, and `packages/db` user-scoped helpers.
- Any new migration (e.g. `public` RPC wrappers, a profile trigger) is its own forward migration with RLS negative tests.
- Must not touch `apps/web/src/design-preview/**`, `apps/web/src/app/design-preview/**` or `apps/worker/**`.
- No paid services. Local Supabase via Docker, or CI.

**Paste-ready prompt:**

> Continue Factory Bridge Global (repo `EminenceHairBoutique/Factory-Bridge-Global`). Read `CLAUDE.md`, `docs/STATUS.md` and `docs/reports/2026-11-09_OPUS_5_5_M0_RECONCILIATION_REPORT.md` §6–§8 first.
>
> Confirm #35 (migration 0010b) is merged and `main` CI is green. If it is not, stop and say so.
>
> Then execute **M1 / B-05** on a new worktree and branch `eng/b05-auth-production` from current `origin/main`:
> 1. Write an ADR choosing how the web tier invokes `app.*` functions. My recommendation is thin `public` SECURITY INVOKER wrappers, one per user action, with execute granted to `authenticated` only.
> 2. Implement Supabase Auth sign-up/sign-in (email OTP + password per the spec), a server-side session, and org creation via `app.create_organization`. Add invite accept, an org switcher and role-gated production routes (`/app` buyer, `/ops` internal, `/supplier` foundation). Check membership on the server on every request, and revoke promptly on role change.
> 3. Add a real Playwright suite that replaces `scripts/test-e2e-not-implemented.mjs`. Cover two buyer orgs, a supplier, and assigned and unassigned operators, including direct-URL and cross-tenant attempts. Run it in CI against the local Supabase stack.
> 4. Exit gate: two local test orgs authenticate; a buyer creates and edits a brief; unauthorized roles are refused.
>
> Constraints:
> - Reuse Atlas × Obsidian components without demo data.
> - Do not touch `apps/web/src/design-preview/**`, `apps/web/src/app/design-preview/**`, `apps/worker/**`, or merged migrations.
> - Every schema change is a forward migration with RLS negative tests.
> - Never claim a test passed that did not run: Docker may be unavailable locally, in which case CI is the arbiter.
> - Open a PR and do not merge, deploy, spend money or change repository settings without my approval.

## 9. PRs and checks

- **#35** <https://github.com/EminenceHairBoutique/Factory-Bridge-Global/pull/35>. Head `d206303`, CI run 42763294286: `check` ✅, `db` ✅. Awaiting founder review.
- **#36** <https://github.com/EminenceHairBoutique/Factory-Bridge-Global/pull/36>. Stacked on #35. At commit `a2ceb34`, run 42765216855: `check` ✅ (incl. the production build gate) and `db` ✅ (incl. the types drift check). The report commit's own run is shown on the PR.
- **No merge, deployment, purchase or repository/Vercel setting change was performed by Claude.** Pushing the two M0 branches triggered your Vercel integration's automatic, protected preview builds. Those are a side effect of the existing Git integration, not a deployment I initiated.
