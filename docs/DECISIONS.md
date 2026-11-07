# DECISIONS — Architecture Decision Records

Living document. Append new ADRs; never edit an accepted ADR's substance — supersede it. Status values: `proposed` (awaiting founder), `accepted`, `superseded by ADR-n`, `rejected`.

---

## ADR-001 — Greenfield build; monorepo with pnpm workspaces
**Status:** accepted (engineering default; no founder impact)
**Context:** Repo contains docs only (2 commits, no code). Specs prefer Next.js/TypeScript/Supabase.
**Decision:** Greenfield. Single repo, `pnpm` workspaces: `apps/web`, `apps/worker`, `packages/{domain,ai,db,i18n}`. No microservices.
**Consequences:** Shared types and domain logic across web and worker; one CI pipeline; simple for a small team.

## ADR-002 — Next.js App Router on Vercel for all UI surfaces
**Status:** accepted
**Context:** Spec §6 default stack; founder's other projects use Vite+React, but this product needs server-side auth, server actions, SSR for a public site, and route handlers.
**Decision:** Next.js (App Router) + React + TypeScript + Tailwind. Public, buyer, supplier and ops surfaces are route groups in one app with separate layouts and middleware-enforced org-type gating.
**Alternatives:** Vite SPA + separate API — rejected: more plumbing for auth/SSR; two deploys.

## ADR-003 — Supabase (Postgres, Auth, Storage) with RLS as the second authorization layer
**Status:** accepted
**Decision:** One Supabase project per environment. RLS enabled and forced on every tenant table; server-side policy module is the first layer. Service-role usage confined to worker and reviewed privileged modules.
**Consequences:** Negative RLS tests are mandatory in CI; generated types in `packages/db`.

## ADR-004 — Unified `organizations` table with `org_type` (buyer | supplier | internal)
**Status:** accepted
**Context:** Spec lists separate supplier and buyer entities; a unified org model with typed extensions (`supplier_profiles`) keeps membership/invite/RLS logic single-path.
**Decision:** One org table; exactly one `internal` org; internal operators access buyer projects only via `project_assignments`.
**Alternatives:** Separate `suppliers` tenancy — rejected: duplicates auth/membership code.

## ADR-005 — Confidential-by-default data classes and restricted contact table
**Status:** accepted
**Decision:** `rights_class` and `visibility_scope` are required columns on quotes/documents/catalog rows. `supplier_contacts` is a separate restricted table; buyer-facing views exclude it; exports redact unless a grant exists.

## ADR-006 — Durable jobs on a Postgres queue processed by a separate always-on worker
**Status:** **proposed** (host choice needs founder approval = paid account)
**Context:** Document parsing + AI extraction can take minutes; Vercel functions are the wrong place. Supabase supports pgmq; pg-boss is a mature Node alternative on plain Postgres.
**Decision (proposed):** pgmq (Supabase-native, visible in dashboard) with a Node worker in `apps/worker`; fallback pg-boss if pgmq ergonomics disappoint in Phase 1 spike. Worker host: **Railway or Fly.io** — choose after a 1-day spike on scan-sidecar memory needs.
**Founder action:** approve one paid worker host (gate G1).

## ADR-007 — Provider-agnostic AI adapter; Anthropic as first provider; no tools in extraction prompts
**Status:** accepted
**Decision:** `packages/ai` adapter with versioned prompt templates and zod/JSON-schema structured outputs. First provider Anthropic (founder already uses the API). Extraction/translation/matching prompts have no tool access. Second provider added only for evaluation comparisons.

## ADR-008 — Money and quantities as `numeric(18,6)` / `decimal.js`; FX applied by rate row id
**Status:** accepted
**Context:** Label prices can be fractions of a cent; CNY/USD precision matters; floats are unacceptable.
**Decision:** Postgres `numeric(18,6)` for unit prices and quantities (`numeric(18,8)` for FX), `decimal.js` in TS, rounding only at presentation. FX rows are stored daily with source; conversions reference `fx_rate_id`.

## ADR-009 — Upload quarantine with malware scanning before promotion
**Status:** **proposed** (scanner choice)
**Decision (proposed):** Quarantine bucket → worker verifies magic bytes/size/page caps → scan → promote. Scanner: ClamAV sidecar in the worker (free, memory-heavy) **or** a hosted scanning API (cost per file). Decide in Phase 1 spike; `blocked` status for real-document intake until chosen.

## ADR-010 — FX rate source
**Status:** proposed
**Decision (proposed):** Start with a free ECB-derived daily feed for USD/CNY reference (e.g., Frankfurter API) stored in `fx_rates` with `source`; buyers can see the rate and date. Move to a commercial provider if intraday or bank-rate alignment is required. **Note:** ECB reference rates are not transaction rates; the report footer says so.

## ADR-011 — Chinese full-text search tokenization
**Status:** proposed (Phase 2)
**Decision (proposed):** Evaluate `pg_jieba`/`zhparser` availability on Supabase; fallback to trigram (`pg_trgm`) + pgvector multilingual embeddings over permissioned rows. Decide with real catalog data.

## ADR-012 — Phase 1 outreach is human-executed and logged; no system-sent supplier messages
**Status:** accepted
**Decision:** In Phase 1 the system drafts; an operator approves and sends via the operator's existing business channel (WeChat/email/phone), then logs channel, time and text. System-dispatched messages (portal/email) arrive in Phase 2 with the same approval gate.

## ADR-013 — Pilot families
**Status:** **proposed** (founder decision OQ-15)
**Decision (proposed):** Pilot A: custom roll labels + printed folding cartons; Pilot B: human-hair bundles (founder's own brand as internal design-partner tenant). See `PILOT_CATEGORY_SELECTION.md`.

## ADR-014 — Repository and product naming
**Status:** **proposed** (founder decision OQ-01)
**Context:** GitHub repo and README say "Great Wall Bridge"; all specs say "Factory Bridge Global".
**Decision (proposed):** Use "Factory Bridge Global" as the product name in all docs/code; optionally rename the GitHub repo to `factory-bridge-global`. Until decided, docs say "Factory Bridge Global (repo: Great-Wall-Bridge)".

## ADR-015 — Master spec file location
**Status:** accepted (path) / proposed (duplicate removal, OQ-01b)
**Context:** Commit `bcb72ec` (2026-11-07) placed the spec at `docs/FACTORY_BRIDGE_MASTER_ENGINEERING_SPEC.md`, matching the kickoff prompt, and left a byte-identical copy at `docs/research/FACTORY_BRIDGE_MASTER_ENGINEERING_SPEC.md`.
**Decision:** `docs/FACTORY_BRIDGE_MASTER_ENGINEERING_SPEC.md` is canonical and is what `CLAUDE.md` references. **Proposed:** delete the `docs/research/` copy (`git rm docs/research/FACTORY_BRIDGE_MASTER_ENGINEERING_SPEC.md`) so two copies cannot drift.

## ADR-016 — No marketplace or messaging automation; connectors gated by the data-rights matrix
**Status:** accepted
**Decision:** S2 and S6 in `INTEGRATIONS_AND_PERMISSIONS.md` are permanently blocked. API connectors (S8–S11) require recorded license/scopes and founder approval before design is turned into code.
