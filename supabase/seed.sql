-- Development/test seed. Applied by `supabase db reset` (config.toml [db.seed]).
-- Must be idempotent: `db reset` twice in a row succeeds (MIGRATION_DEPENDENCY_MAP.md §4).
-- 0001 creates no tables, so there is nothing to seed yet. 0002 (B-04) adds the single internal
-- organization with fixed id 00000000-0000-4000-8000-000000000001 via `on conflict (id) do nothing`.
select 1;
