# Session report — 2026-11-07 (Phase 1, B-06)

**Phase:** 1 | **Slice:** migration 0004 `taxonomy_products` | **Branch:** `b-06-taxonomy` (stacked on `b-04-tenancy-audit`, PR #4)

| | |
|---|---|
| **Implemented** | `product_taxonomy` (6 roots, 16 families: 3 pilot per ADR-013, 6 blocked under `restricted` with compliance notes), `attribute_definitions` for labels / folding cartons / hair bundles (every row EN+ZH, enum values with ZH, hard/required/tolerance flags from QUALITY_ASSURANCE §6), `products`, `product_variants` (`attributes_hash` from canonical jsonb → duplicate attribute sets rejected regardless of key order; `owner_org_id` denormalized by trigger), `product_specifications` (versioned rows, payload immutable, confirmation columns mutable; replaces the planned `spec_versions`), `app.validate_attributes()` deterministic validator (unknown code, type, enum, required; explicit `null` allowed), RLS (reference tables readable by all signed-in users and writable only by migrations; owned rows by org members + platform admin; canonical rows by internal), audit triggers. Reference data is inside the migration with idempotent upserts. |
| **Tested** | `pnpm check` → **174 tests** (domain 50, ai 48, i18n 4, worker 2, eval 12, supabase 58). New: `supabase/tests/taxonomy.test.ts` 14 tests incl. re-running the reference block is a no-op. Engine: PGlite; real Postgres via CI. |
| **Deployed** | Nothing. |
| **Partial** | 0008 will add the assigned-operator read clause to products/variants/specifications and the `brief_item_id` FK. Attribute templates for apparel/bottles/pumps/industrial are deliberately absent (not pilot). |
| **Blocked** | — |
| **Planned** | B-08 suppliers core (0005): supplier_profiles, facilities, **restricted contacts**, disclosure grants, source_systems, source_permissions, research_leads, `app.supplier_org_of`, `app.catalog_grant_active`, `supplier_public_profile_v`. |

**Security review:** blocked categories are rows with `compliance_state='blocked'`, so later code can refuse them by data; buyers cannot write reference data; a buyer cannot create a product owned by another org (write-side RLS tested); ownership columns immutable; all writes audited with the acting user. No secrets, no real data.

**Founder actions:** after PR #4 merges, push `b-06-taxonomy` and open its PR (it will then diff only against main):
```powershell
git push -u origin b-06-taxonomy
gh pr create --fill --base main
```
**Next task:** B-08 (0005 suppliers core).
