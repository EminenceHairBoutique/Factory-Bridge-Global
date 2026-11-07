# STATUS

**Last updated:** 2026-11-07 (Phase 0.5 remediation + B-02 CI fix + B-03)
**Phase:** 1 — Secure internal + buyer quote workspace
**Repository:** `EminenceHairBoutique/Factory-Bridge-Global`, `main` at `8ed4c74` (B-01 scaffold). This session's work is on branch `fix/b-02-ci-and-phase-0-5` pending PR (ADR-027). Earlier `Great-Wall-Bridge` repo superseded (archive it).

## Implementation status

| Area | Implemented | Tested | Deployed | Partial / Blocked | Planned |
|---|---|---|---|---|---|
| Documentation set (Phase 0 + Phase 0.5 remediation) | ✅ | n/a | n/a | | |
| B-01 scaffold (pnpm workspaces, Next.js 16 web, worker, `@fbg/{domain,ai,db,i18n}`, lint/format/test) | ✅ | ✅ founder machine + CI job `check` (typecheck, lint, unit tests passed on run 42351429991) | ❌ | | |
| B-02 CI | ✅ workflow file; **fixed** 2026-11-07: Prettier ran after gitleaks wrote `results.sarif` → `*.sarif` ignored by Prettier/git, format check moved before the scanner | ⏳ fix verified locally (planted `results.sarif` → Prettier passes); **CI re-run pending push** | | ⛔ branch ruleset: founder action (steps below) | |
| B-03 migration 0001 `bootstrap` (btree_gist, schema `app`, generated enums, `app.current_user_id()`, privilege defaults) + enum→SQL generator + drift test + RLS coverage guard | ✅ | ✅ **PGlite** (engine: pglite, 13 tests: drift, apply, enum labels, reverse drift, privileges, coverage guard, seed idempotency) — dev-time SQL check, **not** Supabase integration. ⏳ **Real Postgres run pending**: CI job `db` starts the local Supabase stack and runs `supabase db reset` ×2 + the suite with `DATABASE_URL` | ❌ | | |
| Domain engine | ✅ enums (ADR-021 lifecycle), money/FX, tiers, Incoterm comparability, **lifecycle transition table**, enum SQL generator | ✅ 41 unit tests | | spec matching, landed-cost assembly, ranking, policy module — not written | B-14 |
| AI contracts | ✅ adapter contract, `quote_extraction_v1` (+ `basis_term_colloquial`, `incoterm_place_missing` flags, ADR-025) | ✅ 6 schema tests | | no provider, prompts, fixtures | B-16, B-19 |
| B-04 tenancy (0002) + B-04b audit (0003) | ❌ | ❌ | ❌ | | next |
| B-07 RLS isolation suite (`tests/rls.test.ts`, `authenticated` sessions on real Postgres) | ❌ — coverage guard exists and will **fail** the moment a tenant table is added without it | | | | after B-04b |
| Everything else (uploads, extraction, review UI, comparison, reports, supplier portal, QA, integrations, environments, public site) | ❌ | ❌ | ❌ | integrations ⛔ rights; environments ⛔ OQ-16 (deferred by founder); public site ⛔ OQ-02 | per BACKLOG |

**Honest summary:** scaffold + first migration exist and pass local checks; CI has not yet run on the fixed workflow; no RLS isolation test exists yet; nothing is deployed; no paid account exists; no supplier contacted; no real data.

## Founder decisions recorded 2026-11-07

OQ-15 ✅ (ADR-013) · OQ-20 ✅ (ADR-027) · OQ-01b ✅ (duplicate removed) · OQ-04 engineering default ✅ (ADR-026; commercial terms still pending) · OQ-16 deferred ✅ (ADR-028) · OQ-03 draft-only ✅ (ADR-028). Still open: OQ-02, 05, 06, 07, 08, 09, 10, 11, 12, 13, 14, 17, 18, 19, 21.

## Founder actions

1. **Push the branch and open the PR**, then confirm both CI jobs are green: `check` and `db: migrations on real Postgres (local Supabase stack) + RLS coverage guard`.
2. **Branch ruleset (OQ-20, ADR-027)** — GitHub → repo → Settings → Rules → Rulesets → *New ruleset* → *New branch ruleset*: name `main-protection`; Enforcement **Active**; Target branches → *Add target* → *Include default branch*; enable **Require a pull request before merging** (1 approval may be 0 while solo — keep "Require conversation resolution"), **Require status checks to pass** → add both job names above, tick *Require branches to be up to date*; enable **Block force pushes** and **Restrict deletions**. Save. (Rulesets are available on free plans for public repos; if the repo becomes private on a free plan, use the legacy *Branches → Branch protection rule* with the same settings.)
3. Decide OQ-21 (repo visibility).
4. Archive `EminenceHairBoutique/Great-Wall-Bridge`.

## Known discrepancies

1. `docs/reports/2026-11-07_PHASE_0_SESSION_REPORT.md` describes the superseded `Great-Wall-Bridge` repo (4 commits) — retained as provenance; the current repo has fresh history.
2. `ROADMAP.md` week table is a sequence, not a calendar (ADR-023).

## Local development note (founder)

Local checkout: `C:\dev\Factory Bridge Global`. `pnpm` resolves to 10.28.0 via the corepack shim once inside the repo. `node_modules/` is git-ignored. Docker Desktop is required only for `supabase start` (real-Postgres tests); without it `pnpm test` still runs the database suite on PGlite.
