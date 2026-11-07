# ENGINEERING BACKLOG — Prioritized, with Acceptance Criteria

**Status:** Phase 0 output. Ordered. Each item is sized (S ≤ 1 day, M 2–3 days, L 4–7 days) and lists acceptance criteria (AC) the agent must demonstrate with commands/output. Items marked ⛔ need a founder decision first.

## Phase 0 close-out (no code)

| ID | Item | Size | AC |
|---|---|---|---|
| B-00 | Founder reviews docs; records decisions OQ-01, 03, 04, 15, 16 as ADRs | — | `docs/DECISIONS.md` has statuses updated; `docs/OPEN_QUESTIONS.md` rows marked resolved |
| B-00b | Create `docs/templates/SUPPLIER_DATA_AUTHORIZATION_zh-en.md` and `docs/templates/BUYER_INTERVIEW.md` drafts for counsel | S | files exist; marked DRAFT — NOT FOR USE |

## Phase 0.5 — remediation (2026-11-07)

| ID | Item | Size | Status |
|---|---|---|---|
| P05-A | Discrepancy audit; `MIGRATION_DEPENDENCY_MAP.md`; `SECURITY_PERMISSION_MATRIX.md`; corrected `SCHEMA_PLAN.md` §2.6/§3/§5; harmonized injection gates; colloquial-Incoterm rule; XLSX/ZIP exports; honest effort estimate; ADR-019…025; enum + schema code changes with tests | M | ✅ done (docs + code in tree, see report) |
| P05-B | Remove duplicate `docs/research/FACTORY_BRIDGE_MASTER_ENGINEERING_SPEC.md` (byte-identical to canonical) | S | ⏳ founder: `git rm` (agent shell cannot delete) |
| P05-C | Founder decision: repo visibility (currently public; contains operating docs) | — | ⛔ OQ-21 |

## Phase 1 — ordered

| ID | Item | Size | Depends | Acceptance criteria |
|---|---|---|---|---|
| B-01 ✅ | Scaffold monorepo: `pnpm` workspaces, Next.js app, worker app, `packages/{domain,ai,db,i18n}`, TS strict, ESLint, Prettier, Vitest, `.env.example`, `.gitignore`, PR template with security checklist. **Done 2026-11-07** in an engineering container; Playwright deferred to B-05 (nothing to drive yet). | M | — | ✅ `pnpm install && pnpm typecheck && pnpm lint && pnpm format:check && pnpm test` exit 0 (41 tests); grep-based secret scan clean (gitleaks runs in CI) |
| B-02 ◐ | CI: `check` job (format → typecheck → lint → unit → gitleaks → audit) and `db` job (local Supabase stack, `db reset` ×2, DB suite on real Postgres). **Run 42351429991 failed on Prettier vs gitleaks `results.sarif`; fixed 2026-11-07, re-run pending.** Branch ruleset = founder action (STATUS.md). | S | B-01, OQ-20 ✅ | Both jobs green on the PR; ruleset requires them |
| B-03 ✅◐ | **(redefined, ADR-019)** Migration 0001 `bootstrap` + `@fbg/supabase` package (generator, drift test, privilege tests, RLS coverage guard, seed idempotency). **Done on PGlite 2026-11-07 (13 tests); real-Postgres run happens in the CI `db` job — pending.** | S | B-01 | ✅ generated SQL == committed; ✅ applies on empty DB (PGlite); ✅ `pg_enum` == registry; ⏳ `supabase db reset` ×2 in CI |
| B-04 | Migration 0002 `tenancy_core` (organizations w/ single-internal index, user_profiles, memberships, invites — **not** project_assignments, which moves to 0008) + membership helpers defined after the tables + `prevent_owner_change`/`set_updated_at` trigger fns + RLS; policy module `packages/domain/policy` implementing `SECURITY_PERMISSION_MATRIX.md` | M | B-03 | Policy matrix unit tests enumerate every row of the matrix; invite token single-use + expiry; `org_type`/`org_id` UPDATE raises; `db reset` twice OK |
| B-04b | **Migration 0003 `audit_foundation`** (moved up from B-26, ADR-022): `audit_events`, `security_events`, `document_access_log`, `app.record_audit_event`, `app.audit_row_change`; attach to 0002 tables | S | B-04 | `authenticated` cannot INSERT/UPDATE/DELETE `audit_events`; a membership change produces exactly one audit row with actor = `auth.uid()`; `actor_override` rejected unless session role is `service_role` |
| B-05 | Auth flows: sign-up/sign-in (email OTP + password), org creation, invite accept, org switcher, role-based nav gating by `org_type` | M | B-04 | Playwright: buyer cannot open `/ops`; supplier cannot open `/app`; role change revokes session |
| B-06 | Migration 0003 taxonomy + attribute definitions + seed for pilot specs (labels, cartons, hair bundles) | S | B-03, ⛔ OQ-15 | Seed idempotent; `attribute_definitions` has `label_zh` for every row |
| B-07 | **RLS negative test harness** (`supabase/tests/rls.test.ts`): personas from `SECURITY_PERMISSION_MATRIX.md` §1 as `authenticated` sessions with `request.jwt.claim.sub` (never `service_role`); table-driven | M | B-04b | For each table: A reads 0 rows of B by pk/join/RPC/path; unassigned operator denied; expired/revoked grants denied; ownership UPDATE raises; role removal effective next statement; coverage guard fails on any `public` table absent from the list |
| B-08 | Migration 0004 suppliers, facilities, **restricted contacts**, disclosure grants, verification checks, supplier documents + RLS + `supplier_public_profile_v` | M | B-07 | Buyer JWT selecting `supplier_contacts` → 0 rows/denied; grant → 1 row; expired grant → 0 |
| B-09 | Ops: Supplier CRM UI (create/edit profile, contacts panel with `contact_basis`, checks with evidence upload placeholder), Research Inbox (`research_leads`, internal-only banner) | L | B-08 | US-O1, US-O2 ACs; `research_leads.rights_class` CHECK enforced |
| B-10 | Migration 0005 sources/documents/pages/cells/access_log + storage buckets + policies; signed-URL issuance endpoint with policy check + access log | M | B-07 | Storage policy test: A cannot download B's path; every signed URL issuance writes `document_access_log` |
| B-11 | Upload client flow + MIME/size validation + quarantine; worker skeleton with pgmq consumer, idempotency keys, retries, dead-letter table; `/health` | M | B-10, ADR-006 | Duplicate job id processes once (test); poison message lands in dead letter after N attempts |
| B-12 | Parsing in isolated child process: PDF text+layout, XLSX cells (cached values only), image re-encode + OCR (Tesseract chi_sim+eng); page/row caps | L | B-11, OQ-14 | Fixtures parse; 600-page PDF rejected with reason; XLSX with formula shows cached value; polyglot image re-encoded |
| B-13 | Malware scan step (ADR-009 spike → choose) | M | B-11 | EICAR test file rejected and logged in `security_events`; clean file promoted |
| B-14 | `packages/domain`: Money/Decimal, units + conversions, tier selection, Incoterm comparability table, FX application, landed-cost lines, explanations — **QE-01…QE-15 + property tests** | L | B-01 | 100 % statement coverage on `packages/domain/quote`; all QE cases pass |
| B-15 | Migration 0006 projects/briefs/brief_items + Buyer: New Sourcing Request wizard, brief versions | M | B-06 | AC-B1.1, AC-B1.3 |
| B-16 | `packages/ai` adapter (Anthropic), prompt template registry with versions, `ai_runs` logging, cost accounting, per-org budget guard | M | B-01 | Unit tests with mocked provider; budget exceeded → job refused with `security_events` row |
| B-17 | `brief_normalizer` (schema `brief_spec_v1`, from_input/inferred/missing tags, ZH/EN) + confirm UI | M | B-15, B-16 | AC-B1.2; inferred attrs excluded from hard matching until confirmed (test) |
| B-18 | Migrations 0009 `quotations` (groups, immutable quotations, tiers w/ `btree_gist` exclusion, fees, `quotation_states`, `quote_status_events`, `quote_visibility_grants`, `app.quotation_visible/transition_quotation/supersede_quotation`) and 0010 `ai_review` | L | B-07, B-15 | Overlapping tiers rejected; **any** UPDATE/DELETE on `quotations` raises; direct UPDATE on `quotation_states` by `authenticated` denied; allowed transitions succeed and disallowed ones fail per `MIGRATION_DEPENDENCY_MAP.md` §6; two concurrent `supersede` calls → exactly one current version; idempotency key replay is a no-op; catalog row visible to buyer **only** with an active `source_permissions` grant (label alone grants nothing) |
| B-19 | `quotation_extractor` prompt + `quote_extraction_v1` zod schema + validator + repair-once + flags; eval harness `eval/run.ts` with synthetic fixtures (≥ 15) incl. injection cases | L | B-12, B-16, B-18 | Smoke eval meets gates on synthetic set; injection fixtures: 0 schema escapes, canary never leaks |
| B-20 | Review UI (`ReviewSplit`): anchors, confidence bands, "not in document", corrections, accept → immutable v1 | L | B-19 | AC-B3.1–B3.4; Playwright flow |
| B-21 | Migration 0009 fx/freight/duty/snapshots/scenarios; FX daily job (ADR-010) | S | B-14 | `fx_rates` unique constraint; missing date → `missing_fx` surfaced |
| B-22 | Comparison UI (`ComparisonMatrix`) wired to domain engine; landed-cost lines with status chips; manual freight/duty assumption entry | L | B-14, B-20, B-21 | AC-B4.1–B4.5 via Playwright with seeded quotes |
| B-23 | Report generation job (PDF via React-PDF, CSV UTF-8 BOM) with contract in `QUOTE_ENGINE_SPEC.md` §5; redaction pass for contacts | M | B-22 | AC-B5.1–B5.2; PDF text extracted in test contains assumptions/exclusions; no contact strings |
| B-24 | Follow-up: clarification requests, `message_drafter`, approval card, outbound log (channel, approver), supplier reply → new quote version | M | B-20 | AC-B6.1–B6.2 |
| B-25 | Expiry sweep (pg_cron) marks `expired`, creates notifications; expiring-soon reminders | S | B-18 | Quote with past `valid_until` becomes `expired` within sweep interval; UI label |
| B-26 | Audit explorer UI `/ops/audit` + weekly privileged-access report query (tables and writer moved to **B-04b**) | S | B-04b | AC-A1.1; filters by org/entity/date; admin reads appear with `acting_as='platform_admin'` |
| B-27 | Compliance holds: taxonomy `compliance_state`, blocked categories seed, enforcement in brief/comparison | S | B-06 | US-O5 AC |
| B-28 | Rate limits (uploads/hour, AI runs/day per org), Sentry web+worker, structured logging with redaction | S | B-11 | Exceeding limit → 429 + `security_events`; logs contain no price/document text (grep test) |
| B-29 | Staging deployment (Vercel preview + worker host + Supabase dev project), `.env` wiring, restore drill documented in `docs/runbooks/RESTORE.md` | M | ⛔ OQ-16 | Deployed URL recorded in `STATUS.md` with date; restore drill log |
| B-30 | Load authorized real fixtures (redacted) from validation sprint into `eval/`; full eval run; record results in `STATUS.md` | M | B-19, OQ-03 | ≥ 50 fixtures; gate table filled with measured values, not targets |
| B-31 | Public site (informational, no claims) + request-a-call form (Resend) | M | ⛔ OQ-02 | Copy audit: none of the prohibited claims present (checklist in PRD §7) |

## Phase 2 (ordered headline items; detail when Phase 1 exits)

B-40 supplier onboarding zh-CN · B-41 catalog XLSX import with diff · B-42 price-tier editor + 确认有效 · B-43 RFQ draft/approve/dispatch · B-44 Resend inbound webhook + attachment pipeline · B-45 supplier quote submission form · B-46 data-sharing settings → `source_permissions` · B-47 translation review queue · B-48 ZH search spike (OQ-11).

## Phase 3 (headline)

B-60 QSR templates · B-61 samples/golden sample · B-62 inspection jobs/results/defects · B-63 remediation cases · B-64 milestones estimated vs committed · B-65 SLA telemetry · B-66 inspector scoped access.

## Definition of done (every item)

1. Code + migration + tests merged via PR with green CI.
2. RLS negative tests extended if a tenant table was added.
3. `docs/STATUS.md` updated with Implemented / Tested (commands + results) / Deployed / Partial / Blocked.
4. Security checklist in PR template completed.
5. No claim in UI copy that lacks an evidence record.
