# Session report — 2026-11-07 (Phase 1, B-01)

**Phase:** 1 | **Slice:** B-01 scaffold monorepo (+ B-02 CI workflow file, + first slice of B-14 domain engine, + schema contract for B-19)

## Status

| | |
|---|---|
| **Implemented** | pnpm workspace; `apps/web` (Next.js 16.4, React 19.3, Tailwind 4.3; landing page with approved copy only; `/api/health`; security headers); `apps/worker` (Node 22, pino, `/health`, graceful shutdown, env validation); `packages/domain` (enum registry, Decimal money + FX provenance, tier validation/selection, Incoterm comparability + required landed lines); `packages/ai` (provider contract, `quote_extraction_v1` zod schema); `packages/db` (user client; lint-restricted service-role client); `packages/i18n` (en-US/zh-CN badge terminology, parity test); `eslint.config.mjs` with purity + service-role import restrictions; Prettier; Vitest; `.github/workflows/ci.yml`; PR template; `scripts/rls-placeholder.mjs`; `.gitignore`; `pnpm-lock.yaml`. |
| **Tested** | In an engineering container (Node 22.23, pnpm 10.28): `pnpm install` ✓ · `pnpm typecheck` ✓ (6 packages) · `pnpm lint` ✓ (0 warnings) · `pnpm format:check` ✓ · `pnpm test` ✓ **41 tests / 6 files** (domain 30, ai 5, i18n 4, worker 2) · `pnpm test:rls` ✓ (placeholder, no migrations yet) · `pnpm --filter @fbg/worker build` ✓ and `/health` returned `{"ok":true,...}` · `pnpm --filter @fbg/web build` ✓ (3 routes). One real bug was caught by tests and fixed (worker config read `process.env` instead of injected env). |
| **Deployed** | Nothing. |
| **Partial** | B-02 (workflow file exists; has not run on GitHub; branch protection not set). B-14 (spec matching, landed-cost assembly, ranking, state machines, policy not written). B-16/B-19 (no provider implementation, no prompts, no fixtures). |
| **Blocked** | Deployments (OQ-16). Seeds for taxonomy (OQ-15). |
| **Planned** | B-03 enum→SQL generator + migration 0001; B-04 tenancy + RLS; B-07 RLS harness. |

## Changes

New: `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `tsconfig.base.json`, `eslint.config.mjs`, `.prettierrc`, `.prettierignore`, `.npmrc`, `.nvmrc`, `.gitignore`, `.vscode/extensions.json`, `.github/workflows/ci.yml`, `.github/pull_request_template.md`, `scripts/rls-placeholder.mjs`, `apps/web/**`, `apps/worker/**`, `packages/domain/**`, `packages/ai/**`, `packages/db/**`, `packages/i18n/**`, this report.
Updated: `docs/STATUS.md`, `docs/BACKLOG.md`, `docs/DECISIONS.md` (ADR-017, ADR-018).

## Security review

- No secrets anywhere; `.env.example` placeholders only; grep-based scan clean; gitleaks runs in CI on first push.
- Service-role client import is lint-restricted to `apps/worker` and `apps/web/src/server/privileged/**`; module throws if a `window` global exists.
- `packages/domain` lint rule forbids importing Supabase, AI SDKs or Node I/O (keeps money/eligibility code pure and testable).
- `quote_extraction_v1` uses enums for flags and decimal strings for numbers; unknowns are explicit `null`; free text capped — no AI free text can reach a programmatic path.
- Web: `poweredByHeader: false`, nosniff/DENY/referrer/permissions headers. Worker: pino redaction for auth/API-key paths; health endpoint exposes no versions or tenant data.
- Landing copy limited to the approved headline set; no "U.S.-based", counts, savings, testimonials.

## Assumptions

- Pilot families per `PILOT_CATEGORY_SELECTION.md` (affects B-06 seeds only).
- TypeScript stays on 5.9 until typescript-eslint supports TS 7 (ADR-017).
- Founder or Claude Code performs git commits (ADR-018).

## Budget implications

$0. No accounts created. CI will consume GitHub Actions free minutes on push.

## Founder actions

1. Repo moved to `C:\dev\Factory Bridge Global` (new GitHub repo `Factory-Bridge-Global`, fresh history) — done 2026-11-07. Archive the old `Great-Wall-Bridge` repo on GitHub.
2. Commit and push the scaffold (commands below), then watch the first CI run in the GitHub "Actions" tab.
3. Answer OQ-15 (pilot families) and OQ-20 (branch protection) so B-03/B-06 can proceed.

## Commands to run and how to validate (PowerShell, from `C:\dev\Factory Bridge Global`)

```powershell
git rm -r --cached node_modules        # un-track the two node_modules files committed by accident in be1a963
Remove-Item -Recurse -Force node_modules  # stale stub install; pnpm recreates it
pnpm -v                                # corepack shim should now report 10.28.0 (answer Y if asked to download)
pnpm install                           # ~280 packages
pnpm check                             # typecheck + lint + format:check + test → all must pass, 41 tests
pnpm --filter @fbg/web dev             # http://localhost:3000 landing page, /api/health → {"ok":true}
pnpm --filter @fbg/worker dev          # http://localhost:8080/health → {"ok":true,...}
git add -A
git status --short                     # expect NO node_modules entries; apps/, packages/, .github/ etc. staged
git commit -m "B-01: scaffold monorepo (web, worker, domain/ai/db/i18n packages, CI, lint/test); un-track node_modules"
git push origin main                   # then GitHub → Actions → both jobs green
```

If `pnpm -v` still prints 12.x inside the repo: run `corepack use pnpm@10.28.0` once (no admin needed for this; it only reads the project file), or simply proceed — pnpm 12 can run the project, but CI uses 10.28.0 from `packageManager`, so commit the lockfile only if `git diff pnpm-lock.yaml` is empty.

## Next task

B-03: enum→SQL generator and migration 0001 with `app` helper functions, validated by `supabase start && supabase db reset` (requires Docker locally or in CI). Handoff candidate for Claude Code once B-00b templates are done.
