# Phase 0.5 — Foundation Remediation Report (+ B-02 CI fix, B-03)

**Date:** 2026-11-07 | **Branch:** `fix/b-02-ci-and-phase-0-5` (from `main` @ `8ed4c74`) | **Author:** engineering agent (this session), founder decisions as recorded

## 1. Discrepancy matrix (Phase 0 docs vs. themselves vs. the tree)

| # | Severity | Observed defect | Root cause | Correction | Where |
|---|---|---|---|---|---|
| D1 | **High** | Migration `0001` defined `language sql` helpers reading `memberships`/`organizations` that only exist in `0002`; `project_assignments` (0002) referenced `sourcing_projects` (0006). `db reset` would fail at `CREATE FUNCTION`. | Helpers were written before the table order was fixed | Executable DAG; helpers defined after their tables; `project_assignments` → 0008; `source_permissions ↔ documents` cycle closed by a staged column in 0007 | `MIGRATION_DEPENDENCY_MAP.md` §1–2; ADR-019 |
| D2 | **High** | Policies referenced undefined helpers `app.brief_item_project`, `app.current_org_type`, `supplier_org_of`; search_path pinned to `public` (shadowable); `EXECUTE` grants unspecified | Illustrative SQL never reconciled | Full helper catalogue with signatures, defining migration, `SET search_path = ''`, grants, recursion analysis; `current_org_type` replaced by `is_member_of_type` (no "active org" exists in a JWT) | `MIGRATION_DEPENDENCY_MAP.md` §3; `SCHEMA_PLAN.md` §3.1 |
| D3 | **High** | Catalog read policy granted access when `visibility_scope='platform_buyers'` — a label, settable by the supplier, acted as the grant | Conflated declared intent with active rights | Read predicates evaluate active `source_permissions` (supplier, unexpired, unrevoked, viewer in scope, field in scope) via `app.catalog_grant_active`; label never consulted on read; revocation semantics fixed | `SECURITY_PERMISSION_MATRIX.md` §3; ADR-020 |
| D4 | **High** | "Confirmed quotations immutable" vs required `expired/withdrawn/superseded` transitions vs B-18 "UPDATE rejected by trigger" | Payload and lifecycle modelled on one row | `quotations` immutable payload; `quotation_states` 1:1 mutable only via `app.transition_quotation`/`supersede_quotation`; append-only events; `quote_status` enum = 4 lifecycle values; pre-confirmation = `review_status` | `MIGRATION_DEPENDENCY_MAP.md` §6; `SCHEMA_PLAN.md` §2.6; `packages/domain/src/quote/lifecycle.ts` (+ tests); ADR-021 |
| D5 | Medium | Tier exclusion constraint `(quotation_id with =, numrange with &&)` requires `btree_gist`, which was never listed | Omission | `create extension btree_gist` in 0001 (implemented); constraint written out with `[min,max)` semantics | `MIGRATION_DEPENDENCY_MAP.md` §5; migration 0001 |
| D6 | Medium | Ownership columns protected only by a self-referential `WITH CHECK` subselect (fragile) | — | `app.prevent_owner_change` trigger on every ownership column; policies no longer compare a row to itself | matrix §3.5; ADR-020 |
| D7 | Medium | Audit infra scheduled at B-26, after uploads/quotes/exports | Backlog ordering | Audit foundation = migration 0003 / B-04b; trusted writer; `authenticated` cannot INSERT audit rows | ADR-022; `BACKLOG.md` |
| D8 | Medium | `FORCE ROW LEVEL SECURITY` implicitly treated as protection against service role | Imprecise wording | Explicit statement that `BYPASSRLS` ignores FORCE; service role confined to audited SECURITY DEFINER functions; RLS tests never run as service role | `SECURITY.md` §3; matrix §4 |
| D9 | Low | Injection thresholds: SECURITY.md "100 % flagged" vs AI plan "≥ 0.95 flagged" | Two authors, one afternoon | Boundary (0 escapes/actions, structural) vs detection quality (≥ 0.95 flag rate, soft) — same numbers in both docs | `SECURITY.md` §5; `AI_EVALUATION_PLAN.md` §3.2 |
| D10 | Low | Glossary mapped 出厂价→EXW, 离岸价→FOB as facts | Over-confident mapping | Colloquial terms → `priceBasis: null` + `basis_term_colloquial` flag; `basis_confirmed` column; engine groups as unknown until confirmed | `AI_EVALUATION_PLAN.md` §4; `QUOTE_ENGINE_SPEC.md` §2.1; schema flag + test; ADR-025 |
| D11 | Low | "CSV … plus a summary sheet" | Format error | XLSX workbook, or ZIP of five CSVs, both carrying version ids/FX evidence | `QUOTE_ENGINE_SPEC.md` §5; ADR-024 |
| D12 | Low | "Phase 1 ≈ 6–8 weeks" vs backlog sizes summing to ≈ 85 person-days | Optimism | Person-days stated; two staffing scenarios; no calendar until OQ-18 | `ROADMAP.md`; ADR-023 |
| D13 | Low | Duplicate master spec under `docs/research/` | Copy during repo move | Removed (byte-identical, md5 `c3f72b63…`); founder approved OQ-01b | this branch |
| D14 | Low | STATUS referenced old repo/commits | Repo migration | Rewritten against `Factory-Bridge-Global` @ `8ed4c74` | `STATUS.md` |
| D15 | **CI** | Run 42351429991 failed: gitleaks wrote `results.sarif` into the checkout, Prettier then checked it | Step order + no ignore | `*.sarif` in `.prettierignore` and `.gitignore`; `format:check` moved before the scanner; proven locally with a planted file | `.github/workflows/ci.yml` |
| D16 | **CI** | `scripts/rls-placeholder.mjs` could pass without executing any harness | Placeholder design | Script removed; `pnpm test:db` runs the `@fbg/supabase` Vitest suite with `passWithNoTests: false`; CI `db` job runs it on a real Postgres (local Supabase stack) after `supabase db reset` ×2 | `supabase/`, `ci.yml` |

Items the audit prompt raised that were **already resolved** before this session: `.gitignore`, lockfile, CI workflow, PR template, scaffold (B-01 @ `8ed4c74`); repo rename (new repo).

## 2. Files changed on this branch

Docs: `MIGRATION_DEPENDENCY_MAP.md` (new), `SECURITY_PERMISSION_MATRIX.md` (new), `SCHEMA_PLAN.md`, `SECURITY.md`, `AI_EVALUATION_PLAN.md`, `QUOTE_ENGINE_SPEC.md`, `ARCHITECTURE.md`, `ROADMAP.md`, `BACKLOG.md`, `DECISIONS.md` (ADR-013 accepted; ADR-019…028), `OPEN_QUESTIONS.md`, `STATUS.md`, `CLAUDE.md`, this report. Removed: `docs/research/FACTORY_BRIDGE_MASTER_ENGINEERING_SPEC.md`.
Code: `packages/domain/src/enums.ts` (quote_status), `packages/domain/src/quote/lifecycle.ts` (+test), `packages/domain/src/sql/enum-sql.ts` (+test), `packages/ai/src/schemas/quote-extraction-v1.ts` (+test), `supabase/` (config.toml from `supabase init`, `migrations/20261107000100_bootstrap.sql`, `seed.sql`, `package.json`, `tsconfig.json`, `vitest.config.ts`, `scripts/gen-enum-sql.ts`, `tests/db.ts`, `tests/rls-coverage.ts`, `tests/migrations.test.ts`), `pnpm-workspace.yaml`, `package.json` (scripts), `pnpm-lock.yaml`, `.prettierignore`, `.gitignore`, `.github/workflows/ci.yml`; deleted `scripts/rls-placeholder.mjs`.

## 3. Tests executed (engineering container, Node 22.23 / pnpm 10.28)

| Command | Result |
|---|---|
| `pnpm format:check` with a planted `results.sarif` present | ✅ "All matched files use Prettier code style" (D15 fix verified) |
| `pnpm check` (typecheck 7 pkgs · lint 0 warnings · format · tests) | ✅ **66 tests**: domain 41, ai 6, i18n 4, worker 2, supabase 13 |
| `pnpm --filter @fbg/supabase test` (engine **pglite**) | ✅ 13/13: file naming, enum drift, btree_gist present, `pg_enum` == registry (13 enums), reverse drift, `app.current_user_id()` null/uid, anon has no EXECUTE/USAGE, coverage guard (0 tables == registry), seed ×2 |
| Throwaway probe: create unregistered table, re-run guard query | ✅ guard detects it (table listed, `relrowsecurity=false`) — probe not committed |
| `pnpm db:gen-enums` | ✅ "enum block already up to date" (generator ⇄ migration consistent) |
| CI `db` job on real Postgres | ⏳ **not yet run** — executes on push; `DATABASE_URL` path untested locally (no Docker here) |
| RLS isolation suite | ❌ does not exist (B-07); nothing claims it does |

## 4. Security rationale of the migration changes

0001 contains nothing that can leak: no tables, no data, no table-reading helpers. `app` schema usage is denied to `anon`; functions default to non-executable; `current_user_id()` is parameterless and reads only the verified JWT claim. `btree_gist` enables the only correct form of the tier overlap constraint. Everything that touches tenancy (0002), audit (0003), rights (0005+) and lifecycle (0009) is specified with its tests in `MIGRATION_DEPENDENCY_MAP.md` and `SECURITY_PERMISSION_MATRIX.md` and is **not implemented yet**.

## 5. Unsolved risks

- PGlite cannot exercise `SET ROLE authenticated` + RLS exactly like Supabase; B-07 therefore relies on the CI `db` job (Docker). If the Supabase stack is too slow on free runners, fall back to a plain `postgres:17` service container + a hand-maintained shim of `auth.uid()` and roles.
- The `supabase start -x …` exclusion list was taken from current CLI docs; if a service name is rejected on the runner, remove it from the list (the stack still starts).
- Branch ruleset cannot be set by the agent (ADR-027) — until the founder sets it, `main` is unprotected.

## 6. Founder actions

Push branch → open PR → confirm both jobs green → merge → configure ruleset (STATUS.md steps) → decide OQ-21.

## 7. Next task (smallest safe)

**B-04 + B-04b together**: migration 0002 `tenancy_core` (organizations with single-internal index, user_profiles, memberships, invites, trigger fns, membership helpers, RLS) and 0003 `audit_foundation`, plus `supabase/tests/rls.test.ts` seeded with the first personas (buyer A, buyer B, supplier, unassigned operator, platform admin) so B-07's harness is born with the first tenant tables rather than after them. Register the four tables in `tests/rls-coverage.ts` — the guard already fails otherwise.
