# Session report — 2026-11-07 (Phase 1, B-20)

**Phase:** 1 | **Slice:** migration 0009 `quotations` | **Branch:** `b-20-quotations` (stacked on `b-15-projects`)

| | |
|---|---|
| **Implemented** | `quote_groups` (one thread per supplier × buyer × brief item × type), `quotations` (immutable payload; raises on UPDATE/DELETE for everyone; CHECKs pin `price_basis unknown ⇒ not confirmed`, `valid_until ≥ quote_date` with NULL = unconfirmed, type ↔ buyer, type ↔ rights class, declared `visibility_scope` consistent and never read), `quote_tiers` (`[min,max)` bands, overlap impossible by EXCLUDE), `quote_fees`, `quotation_states` (one current version per thread by partial unique index; no write grant), `quote_status_events` (append-only, idempotency keys), `quote_visibility_grants` (version-exact, immutable except revocation). Functions: `app.supersede_quotation` (v1 or next version; locks the thread; reuses an existing thread; requires a signed-in person; validates evidence document ownership; inserts tiers/fees; flips `is_current`; writes both events; audits) and `app.transition_quotation` (`expired`/`withdrawn`; derived actor; idempotent replay is a no-op). `app.quote_actor_for` derives `system / platform_admin / assigned_operator / supplier_owner / reviewer`; `app.quote_transition_allowed` is the SQL twin of `packages/domain` `lifecycle.ts`; `app.quotation_visible` is the Pattern-C predicate (buyer org, assigned operator via brief item or shortlist, owning supplier, live grant, catalog permission, internal for catalog/listing, platform admin). |
| **Tested** | `pnpm check` → **261 tests** (11 new). The parity test enumerates all 4×4×5×2 `(from, to, actor, via)` combinations against the TS table — zero mismatches. Negative cases: viewer/foreign buyer cannot confirm; empty tiers, overlapping tiers, unknown-basis-confirmed, wrong rights class, backwards validity, wrong buyer org, short key, empty reason all rejected; replayed key returns the same id with no new rows; second v1 for a live thread refused; superuser UPDATE/DELETE raise; admin INSERT on payload/state/events → permission denied; visibility across 8 personas incl. tiers/states/events/groups; supersede by supplier → `actor_not_permitted`, by B → not permitted; withdrawn terminal; expired by buyer refused, by system allowed and recorded as `system`; expired → superseded on revalidation; direct `quotation_states` insert for a second current row → unique violation; grants: B/unassigned cannot create, short reason rejected, B sees exactly the granted version, cannot widen, revocation hides; catalog quote visible to buyers only while a `price_tiers` permission is active, always to internal; no DELETE. **Local Postgres 16:** all 9 suites, 135 tests, three runs on one database. |
| **Deployed** | Nothing. |
| **Partial** | `extraction_id` has no FK until 0010; `app.expire_quotations()` + schedule are 0012; landed-cost comparison snapshots are 0011. |
| **Blocked** | — |
| **Planned** | 0010 `ai_review` (review tasks accept → `supersede_quotation(null, …)`), 0011 `fx_landed_cost`, 0012 `jobs_notifications`. The schema half of the first vertical slice (brief → quote → compare) is now complete except snapshots. |

**Changes:** `supabase/migrations/20261107000900_quotations.sql` (new), `supabase/tests/quotations.test.ts` (new), `supabase/tests/rls-coverage.ts` (7 tables + allow-list), docs: `DECISIONS.md` (ADR-036), `MIGRATION_DEPENDENCY_MAP.md` (row 0009, helpers), `SCHEMA_PLAN.md` (§2.6 + Pattern C as built), `BACKLOG.md` (B-20 ✅), `STATUS.md`.

**Security review:**
- *No path writes a price except the two functions.* `authenticated` has no INSERT/UPDATE/DELETE on any quote table but grants; the immutability trigger binds even the superuser; a forged state or event row is a permission error.
- *Actors are derived from the session and rows, never trusted from input*; buyer viewers get nothing; buyer members can confirm and supersede but not withdraw; suppliers can withdraw their own quote but not edit a buyer's record; operators act only when assigned (brief-item project or shortlist link); jobs can expire but never confirm.
- *Honest records by construction:* unknown Incoterm cannot be "confirmed"; validity cannot predate the quote; listing observations cannot carry buyer rights; a catalog quote cannot be declared private and a negotiated one cannot be declared platform-wide.
- *Cross-tenant reads only through evaluated grants* (version-exact, reasoned, revocable) or live catalog permissions; `visibility_scope` is decoration.
- *Idempotency and locking* prevent double versions under retry or concurrency (replays tested; concurrent insert blocked by the partial unique index, tested directly).
- *Evidence documents* must belong to the buyer, the supplier or Factory Bridge and must not be rejected/discarded.
- No secrets; fixtures invented; nothing deployed.

**Assumptions:** internal operators may record a supplier-catalog quote on a supplier's behalf (portal-less onboarding); buyer `member` may confirm a reviewed quote (matrix B.member R C U). Fee types are a fixed CHECK list (`tooling, plate, sample, setup, packaging, inspection, other`).

**Budget implications:** none.

**Founder actions required:** push the stack as the lower PRs merge: `b-10-documents` → `b-08b-evidence` → `b-15-projects` → `b-20-quotations`.

**Next task:** B-18 (0010 `ai_review`) if Claude Code is not taking it; otherwise B-21 (0011 `fx_landed_cost`).
