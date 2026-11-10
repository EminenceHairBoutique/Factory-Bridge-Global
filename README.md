# Factory Bridge Global

Factory Bridge Global is a U.S.-facing, software-enabled sourcing and procurement service for B2B buyers working with Chinese manufacturers. It combines bilingual sourcing expertise with software for structured briefs, authorized quote intake, AI-assisted bilingual extraction with human review, like-for-like quote comparison, transparent landed-cost estimates, and evidence-based quality workflows.

It is **not** a marketplace clone of Temu, 1688, Taobao, Weidian or Alibaba.com, and it does not scrape or automate those platforms.

## Current state

*Checked 2026-11-10 (M0 reconciliation). `docs/STATUS.md` is the authoritative Implemented / Tested / Deployed / Partial / Blocked / Planned table; this section is a summary.*

- **Code exists; the product does not run end to end yet.** Phase 1 (secure internal + buyer quote workspace) is in progress.
- **Database:** every planned migration up to 0012 is on `main`. Together they cover tenancy, audit, taxonomy, suppliers, documents and storage, evidence, projects and briefs, quotations, FX and landed cost, jobs and notifications, and AI review. Row-level security (RLS) is on, with negative tests. CI applies the chain to a real local Supabase stack on every PR. Migration 0010b (security fixes to 0010) is on PR #35. **No hosted database exists.** No Supabase project has been created (OQ-16 / ADR-028).
- **Web app (`apps/web`):** the public homepage is an informational placeholder. Sign-in (B-05) and the workspaces are not built. The `/design-preview` routes are UI prototypes with synthetic data only. They are switched off in production builds, and CI checks this from #36 on.
- **Worker (`apps/worker`):** health endpoint only (`queue: "not_configured"`). No queue consumer runs and nothing is hosted (B-11).
- **AI:** the provider adapter, the quotation-extraction prompt v1.0.0 and the offline evaluation harness exist, tested against a mock provider only. The live model has never been called (needs founder go-ahead G2; costs API money).
- **Hosting:** Vercel project `web` (team `eminence1`) is connected to this repository. Every push to `main` creates a production deployment and every branch a preview. All are behind Vercel Authentication, with no custom domain and no environment variables, so only the placeholder homepage is served. This conflicts with ADR-028 ("no production deployment"); see the founder actions in `docs/STATUS.md`.
- **Repository visibility:** GitHub reports this repository as **public**; `OPEN_QUESTIONS.md` OQ-21 records "private". Founder decision pending. Never commit customer, supplier or proprietary data. Fixtures are synthetic.

## Start here

| Document | Purpose |
|---|---|
| `CLAUDE.md` | How engineering agents must work in this repo (rules, protocol, layout) |
| `docs/FACTORY_BRIDGE_MASTER_ENGINEERING_SPEC.md` | Authoritative intended product design |
| `docs/PRODUCT_REQUIREMENTS.md` | MVP scope, user stories, acceptance criteria |
| `docs/ARCHITECTURE.md` | System design, three workspaces, flows, deployment |
| `docs/SCHEMA_PLAN.md` | Tables, enums, RLS policy patterns, migration order |
| `docs/SECURITY.md` | Threat model and controls |
| `docs/INTEGRATIONS_AND_PERMISSIONS.md` | Data-rights matrix for every source |
| `docs/QUOTE_ENGINE_SPEC.md` | Deterministic comparison and landed-cost rules |
| `docs/QUALITY_ASSURANCE.md` | Verification states, badge semantics, sampling limits |
| `docs/AI_EVALUATION_PLAN.md` | AI modules, golden set, gates |
| `docs/UX_INFORMATION_ARCHITECTURE.md` | Sitemap, templates, zh-CN supplier portal, visual system |
| `docs/PILOT_CATEGORY_SELECTION.md` | Which product families to pilot and why |
| `docs/LAUNCH_ECONOMICS.md` | Fixed vs variable costs, who pays, budget gates |
| `docs/ROADMAP.md` · `docs/BACKLOG.md` | Phases with exit gates; ordered backlog with acceptance criteria |
| `docs/DECISIONS.md` · `docs/OPEN_QUESTIONS.md` · `docs/STATUS.md` | Living governance docs |

## Development

Requirements: Node ≥ 22.12, pnpm 10.28 (via corepack), and Docker Desktop for the local Supabase stack. Docker is only needed for real-Postgres tests and for type generation.

```
pnpm install
pnpm check                    # typecheck + lint + format:check + unit tests (the database suite runs on PGlite)
pnpm test:db                  # the same database suite; set DATABASE_URL to run it on real Postgres
pnpm verify:production-build  # next build + checks that /design-preview is a 404 in production
pnpm db:gen-types             # regenerate packages/db/src/types.ts (after supabase start && supabase db reset)
pnpm test:e2e                 # fails on purpose: no end-to-end suite exists yet (Playwright arrives with B-05)
```

PGlite runs are development-time SQL checks, not Supabase integration tests. The authoritative database run is CI's `db` job.
