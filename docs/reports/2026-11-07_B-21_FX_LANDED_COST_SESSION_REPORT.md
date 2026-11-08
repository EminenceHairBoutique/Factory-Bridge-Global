# Session report — 2026-11-07 (Phase 1, B-21)

**Phase:** 1 | **Slice:** migration 0011 `fx_landed_cost` | **Branch:** `b-21-landed-cost` (stacked on `b-20-quotations`)

| | |
|---|---|
| **Implemented** | `fx_rates` (append-only; unique per base/quote/day/source; worker or platform-admin writes; everyone reads; `is_reference` marks ECB-style reference rates) + `app.fx_rate_for()` (QUOTE_ENGINE_SPEC §2.5: exact day, else latest prior within 3 days, else NULL = `missing_fx`). `freight_estimates` (`sourced` only with a document; provider entries name the provider). `duty_assumptions` (a signed-in person only — jobs/AI cannot insert; explicit basis; a rate needs a basis; HTS format-checked as a *candidate*; broker review needs a name). `comparison_snapshots` (immutable; bind brief item, quantity, as_of, sha256 inputs hash, engine version, every `fx_rate_id` verified to exist, result). `landed_cost_scenarios` (immutable; one per snapshot × exact quotation version via `restrict` FK; lines validated — known types, `cost_line_status` statuses, amounts + currency on sourced/estimated lines, a `goods` line always present; `complete ⇔ no missing line`; `partial ⇒ landed_total NULL` and never rankable; writer must see the quotation). RLS via project (Pattern B). |
| **Tested** | `pnpm check` → **269 tests** (8 new). Cases: worker + admin write rates, buyers/operators/suppliers cannot, duplicate day+source rejected, same-currency and zero rates rejected, rates immutable; lookup rule at 0/2/3/4-day lag, custom lag, nothing-before, unknown pair; freight `sourced` without document rejected, provider without name rejected, viewer read-only, B/other-operator/supplier 0 rows; duty: job insert refused, rate without basis, bad HTS, broker flag without name, item from another project, `created_by` immutable, isolation; snapshot: unknown fx id, bad hash, foreign brief item, immutable; scenario: unknown type, bad status, estimated without amount, no goods line, complete-with-missing, partial-with-total, partial-without-missing, invisible quotation, duplicate per snapshot, immutable, isolation; complete scenario rankable with total and still pins version 1 after a supersede. **Local Postgres 16:** all 10 DB suites, 143 tests, three runs on one database. |
| **Deployed** | Nothing. |
| **Partial** | The FX daily job (fetch → insert as `service_role`) and the provider decision (ADR-010, proposed) are B-11 / founder; the engine that fills snapshots is `packages/domain` (B-14, Claude Code). |
| **Blocked** | — |
| **Planned** | 0012 `jobs_notifications` (pgmq, dead letters, notifications, `app.expire_quotations` + schedule). |

**Found while building:** a NULL-logic gap in the line validator (a missing `amount` slipped past `jsonb_typeof(...) <> 'number'` because `NULL <> 'number'` is NULL) — caught by the suite's "estimated without amount" case before it ever reached CI. Same class of bug as the one fixed in 0005's scope validator; both now use `coalesce(jsonb_typeof(...), 'missing')`.

**Changes:** `supabase/migrations/20261107001100_fx_landed_cost.sql` (new), `supabase/tests/landed-cost.test.ts` (new), `supabase/tests/rls-coverage.ts` (4 tenant tables + `fx_rates` public-read + allow-list), docs: `DECISIONS.md` (ADR-037), `MIGRATION_DEPENDENCY_MAP.md` (row 0011, helpers), `SCHEMA_PLAN.md` (§2.7 as built), `BACKLOG.md` (B-21 ✅◐), `STATUS.md`.

**Security review:**
- *Honest totals by construction:* a partial scenario cannot store a landed total, cannot be marked rankable, and a "complete" scenario cannot hide a missing line; sourced/estimated lines must carry amount and currency.
- *Provenance pinned:* snapshots reference exact fx rows (verified) and exact quotation versions (`restrict`); superseding a quote or adding a rate never alters an earlier snapshot (tested).
- *No AI in duties:* inserts require `auth.uid()`; the worker (service_role, no uid) is refused (tested). Freight "sourced" requires evidence.
- *Tenant isolation:* every row derives `org_id` from its project; A cannot snapshot B's brief item, reference B's quotation, or read B's estimates (tested); unassigned operators see nothing; compliance has no access to cost data.
- *FX writes:* only the worker or a platform admin (audited with `recorded_by`); rows immutable.
- No secrets; fixtures invented; nothing deployed.

**Assumptions:** `compliance_reviewer` does not need cost data (matrix row shows "—"); insurance/brokerage/destination lines are manual or estimated inputs, not tables of their own (they live as lines with `assumption`/`source_ref`).

**Budget implications:** none.

**Founder actions required:** after the B-20 PR merges, `git push -u origin b-21-landed-cost` and open its PR. ADR-010 (FX provider) still needs your decision before the FX job is built.

**Next task:** B-25/B-11 (0012 `jobs_notifications`: pgmq queues, dead letters, notifications, `app.expire_quotations` + schedule) — the last planned migration; or hand off to Claude Code's worker work.
