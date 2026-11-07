# STATUS

**Last updated:** 2026-11-07 (Phase 1 started — B-01 scaffold)
**Phase:** 1 — Secure internal + buyer quote workspace (B-01 complete locally; Phase 0 founder decisions still open)
**Repository:** `EminenceHairBoutique/Factory-Bridge-Global` (fresh history created 2026-11-07; `5212fd7` Initial commit = Phase 0 docs; `be1a963` stub package.json + tracked node_modules, to be corrected by the B-01 commit). The earlier `Great-Wall-Bridge` repo is superseded and may be archived.

## Implementation status

| Area | Implemented | Tested | Deployed | Partial | Blocked | Planned |
|---|---|---|---|---|---|---|
| Documentation set (Phase 0) | ✅ | n/a | n/a | | | |
| Repository scaffold (pnpm workspaces, Next.js 16 web, Node worker, `@fbg/{domain,ai,db,i18n}`, ESLint/Prettier/Vitest, `.env.example`) | ✅ B-01 | ✅ locally in an engineering container: `pnpm typecheck` ✓ · `pnpm lint` ✓ · `pnpm format:check` ✓ · `pnpm test` 41/41 ✓ · `pnpm --filter @fbg/web build` ✓ · worker `/health` responds | ❌ | | | |
| CI workflow (`.github/workflows/ci.yml`) | ✅ file written (B-02 partial) | ❌ **not yet executed on GitHub** — runs on first push/PR | | ⚠️ branch protection not configured (OQ-20) | | |
| Domain engine: enums, Decimal money/FX provenance, tier selection/validation, Incoterm comparability + required-lines table | ✅ partial B-14 | ✅ 30 unit tests incl. QE-01/02/03/04/05/06/10/12/14/15 | | ⚠️ spec matching, landed-cost assembly, ranking, state machines, policy not yet written | | |
| AI: provider adapter contract + `quote_extraction_v1` zod schema | ✅ contract/schema only (B-16/B-19 partial) | ✅ 5 schema tests | | ⚠️ no provider implementation; no prompts; no eval fixtures | | |
| Database migrations / RLS | | | | | | ✅ B-03…B-26 |
| Auth / organizations / roles | | | | | | ✅ B-04, B-05 |
| Upload pipeline / scanning / parsing | | | | | ⛔ scanner choice (ADR-009) | ✅ B-10…B-13 |
| Quote engine (`packages/domain`) | | | | | | ✅ B-14 |
| AI adapter / extraction / eval harness | | | | | | ✅ B-16…B-19 |
| Review UI / comparison UI / reports | | | | | | ✅ B-20…B-23 |
| Supplier portal (zh-CN) | | | | | | Phase 2 |
| Outbound RFQ / inbound email | | | | | | Phase 2 |
| Quality operations | | | | | | Phase 3 |
| Any external integration (1688, Alibaba.com, Weidian, WeChat, ERP) | | | | | ⛔ blocked by rights (see INTEGRATIONS) | Phase 4 at earliest |
| Staging / production environments | | | | | ⛔ OQ-16 paid accounts | ✅ B-29 |
| Public website | | | | | ⛔ OQ-02 claims | ✅ B-31 |

**Only the scaffold is implemented and locally tested. Nothing is deployed.** CI has not run on GitHub yet. No paid account has been created. No supplier has been contacted by this process. No integration permission has been obtained. No database, auth, upload, extraction or UI feature exists beyond a static landing page and health endpoints.

## What exists in the repo after this session

- Code: `package.json` (pnpm workspaces), `apps/web` (Next.js 16, Tailwind v4, landing page, `/api/health`), `apps/worker` (health server, config, graceful shutdown), `packages/domain` (enums, money, tiers, incoterms + tests), `packages/ai` (adapter contract, `quote_extraction_v1` schema + tests), `packages/db` (user client, lint-restricted service-role client), `packages/i18n` (en-US/zh-CN badge terminology + parity test), `eslint.config.mjs` (incl. purity and service-role import restrictions), `.github/workflows/ci.yml`, PR template, `scripts/rls-placeholder.mjs`, `pnpm-lock.yaml`.

- `CLAUDE.md`, `README.md` (updated), `.env.example` (placeholders only)
- `docs/`: ARCHITECTURE, PRODUCT_REQUIREMENTS, SCHEMA_PLAN, SECURITY, INTEGRATIONS_AND_PERMISSIONS, QUOTE_ENGINE_SPEC, QUALITY_ASSURANCE, AI_EVALUATION_PLAN, UX_INFORMATION_ARCHITECTURE, PILOT_CATEGORY_SELECTION, LAUNCH_ECONOMICS, ROADMAP, DECISIONS, STATUS, OPEN_QUESTIONS, BACKLOG, `reports/2026-11-07_PHASE_0_SESSION_REPORT.md`
- Pre-existing: `docs/03_FIRST_CLAUDE_CODE_KICKOFF_PROMPT.md`, `docs/FACTORY_BRIDGE_CLAUDE_PROJECT_INSTRUCTIONS.md`, `docs/Factory_Bridge_Supplier_Quote_Intelligence_Blueprint.md`, `docs/FACTORY_BRIDGE_MASTER_ENGINEERING_SPEC.md`, `docs/research/FACTORY_BRIDGE_MASTER_ENGINEERING_SPEC.md` (duplicate), `docs/research/FACTORY_BRIDGE_INITIAL_CATEGORY_RESEARCH_AND_DATA_PLAN.md`

## Known discrepancies

1. ~~Repo named "Great Wall Bridge"~~ Resolved 2026-11-07: new repo `Factory-Bridge-Global` (OQ-01 closed, ADR-014 accepted).
2. Master spec exists twice (`docs/` and `docs/research/`, identical md5 `c3f72b63…`); canonical is `docs/FACTORY_BRIDGE_MASTER_ENGINEERING_SPEC.md`; remove the duplicate (OQ-01b).
3. Earlier concept docs propose different doc filenames (`DATA_MODEL.md`, `SECURITY_THREAT_MODEL.md`, `INTEGRATION_FEASIBILITY.md`); this session follows the V2 kickoff list (`SCHEMA_PLAN.md`, `SECURITY.md`, `INTEGRATIONS_AND_PERMISSIONS.md`).

## Next task

B-00 (founder decisions, esp. OQ-15 pilot families and OQ-20 branch protection) → B-02 close-out (push, confirm CI green on GitHub, enable branch protection) → B-03 (enum→SQL generator + migration 0001, needs local Supabase/Docker) → B-04 (tenancy + RLS) → B-07 (RLS harness). Do not start B-29 (deployments) until OQ-16 is approved.

## Local development note (founder)

Local checkout: `C:\dev\Factory Bridge Global` (outside OneDrive — good). `pnpm` is provided by the corepack shim in `C:\Program Files\nodejs`; with `package.json#packageManager` set, running `pnpm` inside the repo uses 10.28.0 automatically (answer **Y** if it asks to download). `node_modules/` must never be tracked; commit `be1a963` tracked two files from it by accident — the B-01 commit removes them (`git rm -r --cached node_modules`).
