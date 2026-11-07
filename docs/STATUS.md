# STATUS

**Last updated:** 2026-11-07 (B-06 taxonomy; stacked on B-04)
**Phase:** 1 — Secure internal + buyer quote workspace
**Repository:** `EminenceHairBoutique/Factory-Bridge-Global`, `main` at `cc99a1c` (PR #1 B-00b, PR #2 Phase 0.5 + B-02 fix + B-03, PR #3 B-16/B-19 AI adapter merged; CI green on both jobs incl. real Postgres). Branches pending PR: `b-04-tenancy-audit` (PR #4) and `b-06-taxonomy` (stacked on it). Earlier `Great-Wall-Bridge` repo superseded (archive it).

## Implementation status

| Area | Implemented | Tested | Deployed | Partial / Blocked | Planned |
|---|---|---|---|---|---|
| Documentation set (Phase 0 + Phase 0.5 remediation) | ✅ | n/a | n/a | | |
| B-01 scaffold (pnpm workspaces, Next.js 16 web, worker, `@fbg/{domain,ai,db,i18n}`, lint/format/test) | ✅ | ✅ founder machine + CI job `check` (typecheck, lint, unit tests passed on run 42351429991) | ❌ | | |
| B-02 CI | ✅ | ✅ run 42357309399 on `main`: `check` ✅ and `db` ✅ (local Supabase stack, `db reset` ×2, suite on real Postgres) | | ✅ branch ruleset configured by founder 2026-11-07; repo set to **private** (OQ-21 resolved) | |
| B-03 migration 0001 `bootstrap` + generator + drift test + coverage guard | ✅ | ✅ PGlite and ✅ **real Postgres in CI** (run 42357309399) | ❌ | | |
| B-04 migration 0002 `tenancy_core` (orgs, profiles, memberships, invites; helpers after tables; owner-guard + role-fit triggers; RLS; `create_organization`/`create_invite`/`accept_invite`/`update_membership`) + `packages/domain/policy` | ✅ | ✅ PGlite: 31 isolation/authorization tests + 9 policy unit tests; ⏳ real Postgres on the PR's CI run | ❌ | | |
| B-04b migration 0003 `audit_foundation` (append-only audit, security events, access log, trusted writers, row-change trigger with redaction) | ✅ | ✅ PGlite (part of the 31); ⏳ CI | ❌ | | |
| B-06 migration 0004 `taxonomy_products` (taxonomy incl. blocked categories, EN+ZH attribute definitions for labels/cartons/hair bundles, products/variants/specifications, deterministic attribute validation) | ✅ | ✅ PGlite: 14 tests (reference-data integrity + idempotent re-run, validation, isolation, immutability, audit); ⏳ CI | ❌ | | |
| B-07 RLS isolation harness | ◐ (0002/0003/0004 tables) | ✅ 45 tests as `authenticated` with JWT sub; service_role only where testing its limits | | remaining tables arrive with their migrations | |
| Domain engine | ✅ enums (ADR-021 lifecycle), money/FX, tiers, Incoterm comparability, **lifecycle transition table**, enum SQL generator | ✅ 41 unit tests | | spec matching, landed-cost assembly, ranking, policy module — not written | B-14 |
| AI contracts | ✅ adapter contract, `quote_extraction_v1` (+ `basis_term_colloquial`, `incoterm_place_missing` flags, ADR-025); schema is now `strictObject` (injected extra keys fail validation instead of being stripped) | ✅ 6 schema tests | | | |
| B-16 `packages/ai` adapter (branch `b-16-ai-adapter`) | ✅ `AnthropicProvider` (structured JSON via `output_config.format` from the zod schema, **no tools / no prefill**, one repair attempt on schema failure, per-call input-token cap + output cap, untrusted content wrapped in per-call boundary tokens, canary token check, usage + cost accounting returned to the caller as integer nano-USD, cacheable stable system block); `MockProvider` running the identical pipeline; versioned template registry `packages/ai/prompts/<id>/<version>.md` (sha256 → `promptHash` for `ai_runs.prompt_version`) | ✅ 48 unit tests, all through `MockProvider` (happy path, repair, schema_invalid after 2 attempts, canary/boundary leak → discard, budget_exceeded pre-call, max_tokens, refusal, provider error, prompt placement). **Live provider never exercised** — `AnthropicProvider.fromEnv()` returns null without `ANTHROPIC_API_KEY`; CI has no key | ❌ | `ai_runs` logging + per-org budget guard + `security_events` row → **B-16b** (needs B-04 tables); live smoke run ⛔ budget gate G2 (founder go-ahead) | B-16b |
| B-19 (offline half) `quotation_extractor` v1.0.0 + eval harness | ✅ prompt template with ADR-025 rule (出厂价/离岸价/到岸价 → `priceBasis` null + `basis_term_colloquial`; 到岸价 also `includes_ambiguous`; code without place → `incoterm_place_missing`), tier/no-inference rules, embedded-instruction rule; `eval/run.ts` (`pnpm eval`) computing the §3.2 metrics per slice with gate PASS/FAIL table; **17 synthetic fixtures** (6 prompt-injection: price override, cross-tenant reveal, tool-call/payment redirect, format escape, hidden HTML comment, canary exfil) | ✅ 12 harness tests (fixture validity, anchors literal in source, metric arithmetic on hand-built wrong outputs, mock self-test: 0 hard-gate violations). ⚠️ **Mock run replays `expected.json` — it proves the harness, not model accuracy. No measured extraction accuracy exists yet.** | ❌ | live eval on the 17 fixtures ⛔ G2; real documents ⛔ B-12 parsing + B-30 authorized fixtures; `temperature 0` from SECURITY.md §5 is not sent (sampling params are rejected by current models) — determinism relies on strict schema + eval instead | B-19 (live), B-30 |
| Everything else (uploads, extraction, review UI, comparison, reports, supplier portal, QA, integrations, environments, public site) | ❌ | ❌ | ❌ | integrations ⛔ rights; environments ⛔ OQ-16 (deferred by founder); public site ⛔ OQ-02 | per BACKLOG |

**Honest summary:** scaffold + migrations 0001–0004 exist; 174 tests pass locally (PGlite for DB); main's CI is green on real Postgres for 0001; 0002–0004 await their CI runs (PR #4 and the stacked B-06 PR); nothing is deployed; no paid account; no supplier contacted; no real data.

## Founder decisions recorded 2026-11-07

OQ-15 ✅ (ADR-013) · OQ-20 ✅ (ADR-027) · OQ-01b ✅ (duplicate removed) · OQ-04 engineering default ✅ (ADR-026; commercial terms still pending) · OQ-16 deferred ✅ (ADR-028) · OQ-03 draft-only ✅ (ADR-028). Still open: OQ-02, 05, 06, 07, 08, 09, 10, 11, 12, 13, 14, 17, 18, 19, 21.

## Founder actions

1. **Push `b-04-tenancy-audit` and open the PR**, then confirm both CI jobs are green: `check` and `db: migrations on real Postgres (local Supabase stack) + RLS coverage guard`.
2. **Branch ruleset (OQ-20, ADR-027)** — GitHub → repo → Settings → Rules → Rulesets → *New ruleset* → *New branch ruleset*: name `main-protection`; Enforcement **Active**; Target branches → *Add target* → *Include default branch*; enable **Require a pull request before merging** (1 approval may be 0 while solo — keep "Require conversation resolution"), **Require status checks to pass** → add both job names above, tick *Require branches to be up to date*; enable **Block force pushes** and **Restrict deletions**. Save. (Rulesets are available on free plans for public repos; if the repo becomes private on a free plan, use the legacy *Branches → Branch protection rule* with the same settings.)
3. Decide OQ-21 (repo visibility).
4. Archive `EminenceHairBoutique/Great-Wall-Bridge`.

## Known discrepancies

1. `docs/reports/2026-11-07_PHASE_0_SESSION_REPORT.md` describes the superseded `Great-Wall-Bridge` repo (4 commits) — retained as provenance; the current repo has fresh history.
2. `ROADMAP.md` week table is a sequence, not a calendar (ADR-023).

## Local development note (founder)

Local checkout: `C:\dev\Factory Bridge Global`. `pnpm` resolves to 10.28.0 via the corepack shim once inside the repo. `node_modules/` is git-ignored. Docker Desktop is required only for `supabase start` (real-Postgres tests); without it `pnpm test` still runs the database suite on PGlite.
