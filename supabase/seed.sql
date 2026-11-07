-- Development/test seed. Applied by `supabase db reset` (config.toml [db.seed]).
-- Must be idempotent: `db reset` twice in a row succeeds (MIGRATION_DEPENDENCY_MAP.md §4).

-- The single internal organization (ADR-004). Fixed id so code and tests can reference it.
insert into public.organizations (id, org_type, legal_name, display_name, display_name_zh, country, status)
values ('00000000-0000-4000-8000-000000000001', 'internal', 'Factory Bridge Global Operations', 'Factory Bridge Global', 'Factory Bridge Global 运营', 'US', 'active')
on conflict (id) do nothing;

-- No users are seeded. The first platform_admin membership is created by the bootstrap runbook (B-05)
-- after the founder signs up; never by seed, never with a hard-coded password.
