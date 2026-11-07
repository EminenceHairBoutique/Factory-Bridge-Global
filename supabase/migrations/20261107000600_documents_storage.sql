-- 0006 documents_storage — Factory Bridge Global (MIGRATION_DEPENDENCY_MAP §2 row 0006; SCHEMA_PLAN §2.4; SECURITY.md §4;
-- SECURITY_PERMISSION_MATRIX §5)
--
-- What this migration establishes:
--   * documents             the tenant-owned record of every uploaded/imported file: bucket + path (convention
--                           <org_id>/<document_id>/<sha-prefix>-<name>, trigger-enforced), MIME allow-list, 25 MB cap, sha256,
--                           rights_class + optional source_permission, and a deterministic status machine (ADR-033):
--                           uploaded → scanning → parsed|rejected → extracted → in_review → accepted, with `discarded` reachable
--                           from every non-terminal state. Only the worker (service_role) scans, promotes and parses; a signed-in
--                           member can only create a quarantine row and discard. Promotion out of `quarantine` is a status
--                           transition, so a file can never be served before it passed the scan.
--   * document_pages        parsed text + layout per page (≤ 500 pages); worker-only writes.
--   * document_cells        spreadsheet cells as cached values (never formulas evaluated); worker-only writes.
--   * document_access_log   gains its FK; rows are written ONLY through app.log_document_access() after the same read
--                           check the policy applies, so every signed-URL issuance / view is recorded with the actor.
--   * storage               the four private buckets as rows (quarantine, documents, reports, supplier-evidence) and the
--                           storage.objects policies: members upload only into quarantine, only under their own org folder and
--                           only for a document row they own that is still `uploaded`; members read an object only when
--                           app.document_readable() says so for the document that path belongs to; nobody but the worker reads
--                           quarantine; no UPDATE/DELETE for signed-in users.
--
-- Deferred to 0008: the assigned-operator read clause (needs project_assignments). Deferred to 0010: review-driven
-- `in_review → accepted` is performed by the review functions (they run as trusted writers).

-- ============================================================================
-- 1. Tables
-- ============================================================================

create table public.documents (
  id                   uuid primary key default gen_random_uuid(),
  org_id               uuid not null references public.organizations (id) on delete cascade,     -- owning tenant
  uploaded_by          uuid,
  source_type          public.source_type not null,
  rights_class         public.rights_class not null,
  source_permission_id uuid references public.source_permissions (id) on delete restrict,
  supplier_id          uuid references public.supplier_profiles (id) on delete restrict,         -- the supplier this file came from / is about
  storage_bucket       text not null default 'quarantine'
                       check (storage_bucket in ('quarantine', 'documents', 'reports', 'supplier-evidence')),
  storage_path         text not null,
  original_filename    text not null check (length(original_filename) between 1 and 255),
  mime                 text not null check (mime in (
                         'application/pdf', 'image/jpeg', 'image/png', 'image/webp',
                         'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/csv')),
  bytes                bigint not null check (bytes > 0 and bytes <= 26214400),                   -- 25 MB (SECURITY.md §4)
  sha256               text check (sha256 is null or sha256 ~ '^[0-9a-f]{64}$'),
  status               public.document_status not null default 'uploaded',
  scan_result          jsonb,
  page_count           integer check (page_count is null or (page_count >= 0 and page_count <= 500)),
  rejected_reason      text,
  retention_class      text not null default 'standard' check (retention_class in ('standard', 'forensic_7d', 'legal_hold')),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (storage_bucket, storage_path),
  -- a file that passed the scan has a hash; a quarantined one may not yet
  check (status in ('uploaded', 'scanning', 'rejected', 'discarded') or sha256 is not null),
  -- bucket follows status: nothing leaves quarantine until it is parsed
  check (case
           when status in ('uploaded', 'scanning', 'rejected') then storage_bucket = 'quarantine'
           when status in ('parsed', 'extracted', 'in_review', 'accepted') then storage_bucket <> 'quarantine'
           else true end),
  check (rights_class <> 'catalog_public_with_permission' or source_permission_id is not null),
  check (status <> 'rejected' or rejected_reason is not null)
);
comment on table public.documents is
  'Tenant-owned file records. Path convention <org_id>/<document_id>/<sha-prefix>-<name> is trigger-enforced; status machine ADR-033; served only via signed URLs logged in document_access_log.';
create index documents_org_idx on public.documents (org_id, created_at desc);
create index documents_supplier_idx on public.documents (supplier_id) where supplier_id is not null;
create index documents_status_idx on public.documents (status) where status in ('uploaded', 'scanning');

create table public.document_pages (
  id          uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents (id) on delete cascade,
  org_id      uuid not null references public.organizations (id) on delete cascade,   -- denormalized (trigger-set)
  page_no     integer not null check (page_no between 1 and 500),
  text        text,
  layout      jsonb,
  ocr_run_id  uuid references public.ai_runs (id) on delete set null,
  created_at  timestamptz not null default now(),
  unique (document_id, page_no)
);

create table public.document_cells (
  id          uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents (id) on delete cascade,
  org_id      uuid not null references public.organizations (id) on delete cascade,   -- denormalized (trigger-set)
  sheet       text not null check (length(sheet) between 1 and 64),
  row_no      integer not null check (row_no between 1 and 1048576),
  col_no      integer not null check (col_no between 1 and 16384),
  raw         text,                                                                   -- cached value as displayed; formulas are never evaluated
  parsed      jsonb,
  created_at  timestamptz not null default now(),
  unique (document_id, sheet, row_no, col_no)
);
comment on column public.document_cells.raw is 'Cached cell value from the workbook. Formulas are read as their cached result and never evaluated (SECURITY.md §4.3).';

-- 0003 created the access log without its FK (documents did not exist). Restrict, not cascade: the log must survive;
-- legal erasure is a documented superuser procedure.
alter table public.document_access_log
  add constraint document_access_log_document_fk foreign key (document_id) references public.documents (id) on delete restrict;

-- ============================================================================
-- 2. Helpers (after the tables they read)
-- ============================================================================

-- Who may read a document: members of the owning org, the supplier the file came from (its own submissions),
-- platform admins. 0008 adds assigned operators. The visibility_scope / rights_class columns are never consulted
-- as a label here — rights decide what the file may be USED for, membership decides who may READ it.
create or replace function app.document_readable(p_document uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.documents d
     where d.id = p_document
       and d.status <> 'discarded'
       and (app.is_member(d.org_id)
            or app.is_platform_admin()
            or (d.supplier_id is not null
                and d.rights_class in ('supplier_submitted_private', 'catalog_public_with_permission')
                and app.is_member(app.supplier_org_of(d.supplier_id)))));
$$;

-- Parse "<org_id>/<document_id>/<file>" without raising on garbage (a malformed path must deny, not error).
create or replace function app.storage_doc_id(p_name text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case
    when p_name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[^/]+$'
      then split_part(p_name, '/', 2)::uuid
    else null end;
$$;

create or replace function app.storage_org_id(p_name text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case
    when p_name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/'
      then split_part(p_name, '/', 1)::uuid
    else null end;
$$;

-- An object in a served bucket is readable iff its path names a document that (a) lives in that bucket at that path and
-- (b) the caller may read. The bucket+path equality means a stale object left behind by a failed promotion is unreadable.
create or replace function app.storage_object_readable(p_bucket text, p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.documents d
     where d.id = app.storage_doc_id(p_name)
       and d.storage_bucket = p_bucket
       and d.storage_path = p_name
       and p_bucket <> 'quarantine'
       and app.document_readable(d.id));
$$;

-- The only writer of document_access_log. Re-checks readability, then records the actor; raises if the caller may not read.
create or replace function app.log_document_access(p_document uuid, p_action text, p_ip_hash text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id  uuid;
  v_org uuid;
begin
  if p_action not in ('view', 'download', 'signed_url') then
    raise exception 'unknown document access action %', p_action using errcode = 'check_violation';
  end if;
  if not (app.document_readable(p_document) or app.is_trusted_writer()) then
    raise exception 'document % is not readable by the current user', p_document using errcode = 'insufficient_privilege';
  end if;
  select d.org_id into v_org from public.documents d where d.id = p_document;
  insert into public.document_access_log (document_id, user_id, org_id, action, ip_hash)
  values (p_document, auth.uid(), v_org, p_action, p_ip_hash)
  returning id into v_id;
  return v_id;
end;
$$;

-- Trigger functions ---------------------------------------------------------

create or replace function app.document_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.uploaded_by is null then new.uploaded_by := auth.uid(); end if;
  if new.storage_path !~ ('^' || new.org_id::text || '/' || new.id::text || '/[^/]+$') then
    raise exception 'storage_path must be <org_id>/<document_id>/<file> for this row' using errcode = 'check_violation';
  end if;
  if not app.is_trusted_writer() then
    -- a signed-in user can only register an upload; the worker owns everything after that
    if new.status <> 'uploaded' or new.storage_bucket <> 'quarantine' then
      raise exception 'new documents start as uploaded in quarantine' using errcode = 'check_violation';
    end if;
    new.sha256 := null; new.scan_result := null; new.page_count := null; new.rejected_reason := null;
  end if;
  if new.source_permission_id is not null then
    if not exists (select 1 from public.source_permissions p
                    where p.id = new.source_permission_id
                      and (p.supplier_id is null or new.supplier_id is null or p.supplier_id = new.supplier_id)) then
      raise exception 'source_permission_id does not belong to this supplier' using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

-- ADR-033 transition table. Trusted writer = worker (service_role) or a trusted SECURITY DEFINER caller.
create or replace function app.document_before_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_trusted boolean := app.is_trusted_writer();
  v_payload_old jsonb := to_jsonb(old) - 'status' - 'updated_at';
  v_payload_new jsonb := to_jsonb(new) - 'status' - 'updated_at';
begin
  if not v_trusted then
    -- members may only discard (and only from a non-terminal state); every other column is frozen for them
    if v_payload_old <> v_payload_new then
      raise exception 'documents are written by the processing worker; members may only discard' using errcode = 'insufficient_privilege';
    end if;
    if new.status is distinct from old.status then
      if new.status <> 'discarded' or old.status in ('rejected', 'accepted', 'discarded') then
        raise exception 'invalid document transition % -> % for a member', old.status, new.status using errcode = 'check_violation';
      end if;
    end if;
    return new;
  end if;

  if new.status is distinct from old.status then
    if not (
         (old.status = 'uploaded'  and new.status in ('scanning', 'discarded'))
      or (old.status = 'scanning'  and new.status in ('parsed', 'rejected', 'discarded'))
      or (old.status = 'parsed'    and new.status in ('extracted', 'discarded'))
      or (old.status = 'extracted' and new.status in ('in_review', 'discarded'))
      or (old.status = 'in_review' and new.status in ('accepted', 'discarded'))
    ) then
      raise exception 'invalid document transition % -> %', old.status, new.status using errcode = 'check_violation';
    end if;
    if old.status = 'scanning' and new.status = 'parsed' and new.sha256 is null then
      raise exception 'a parsed document must carry its sha256' using errcode = 'check_violation';
    end if;
  end if;
  -- promotion out of quarantine happens only on scanning -> parsed; the path must stay under <org>/<id>/
  if new.storage_bucket is distinct from old.storage_bucket
     and not (old.status = 'scanning' and new.status = 'parsed' and old.storage_bucket = 'quarantine') then
    raise exception 'storage_bucket changes only when a scanned document is promoted (scanning -> parsed)' using errcode = 'check_violation';
  end if;
  if new.storage_path !~ ('^' || new.org_id::text || '/' || new.id::text || '/[^/]+$') then
    raise exception 'storage_path must be <org_id>/<document_id>/<file> for this row' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create or replace function app.document_child_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select d.org_id into new.org_id from public.documents d where d.id = new.document_id;
  if new.org_id is null then
    raise exception 'unknown document_id %', new.document_id using errcode = 'foreign_key_violation';
  end if;
  return new;
end;
$$;

revoke execute on function
  app.document_readable(uuid), app.storage_doc_id(text), app.storage_org_id(text), app.storage_object_readable(text, text),
  app.log_document_access(uuid, text, text)
  from public, anon;
grant execute on function
  app.document_readable(uuid), app.storage_doc_id(text), app.storage_org_id(text), app.storage_object_readable(text, text),
  app.log_document_access(uuid, text, text)
  to authenticated, service_role;

-- ============================================================================
-- 3. Triggers
-- ============================================================================

create trigger documents_set_updated_at before update on public.documents
  for each row execute function app.set_updated_at();
create trigger documents_before_insert before insert on public.documents
  for each row execute function app.document_before_insert();
create trigger documents_before_update before update on public.documents
  for each row execute function app.document_before_update();
create trigger documents_owner_guard before update on public.documents
  for each row execute function app.prevent_owner_change('org_id', 'supplier_id', 'source_permission_id', 'rights_class', 'source_type');
create trigger document_pages_denorm before insert or update on public.document_pages
  for each row execute function app.document_child_before_write();
create trigger document_pages_owner_guard before update on public.document_pages
  for each row execute function app.prevent_owner_change('document_id', 'org_id');
create trigger document_cells_denorm before insert or update on public.document_cells
  for each row execute function app.document_child_before_write();
create trigger document_cells_owner_guard before update on public.document_cells
  for each row execute function app.prevent_owner_change('document_id', 'org_id');

-- Audit: document rows are audited in full (paths and hashes, never file contents); page/cell bodies are bulk parse
-- output and are not row-audited — the parse job is recorded in ai_runs / job logs instead.
create trigger documents_audit after insert or update or delete on public.documents
  for each row execute function app.audit_row_change('org_id');

-- ============================================================================
-- 4. RLS (tables)
-- ============================================================================

alter table public.documents      enable row level security;
alter table public.documents      force row level security;
alter table public.document_pages enable row level security;
alter table public.document_pages force row level security;
alter table public.document_cells enable row level security;
alter table public.document_cells force row level security;

revoke all on public.documents, public.document_pages, public.document_cells from public, anon, authenticated;
grant select, insert, update on public.documents to authenticated;
grant select on public.document_pages, public.document_cells to authenticated;     -- worker-only writes
grant all on public.documents, public.document_pages, public.document_cells to service_role;

create policy documents_select on public.documents for select to authenticated
  using (app.document_readable(id));
create policy documents_insert on public.documents for insert to authenticated
  with check (app.has_role(org_id, array['owner', 'admin', 'member']::public.member_role[])
          and uploaded_by = auth.uid());
create policy documents_update on public.documents for update to authenticated
  using (app.has_role(org_id, array['owner', 'admin', 'member']::public.member_role[]))
  with check (true);   -- the trigger restricts members to status -> discarded

create policy document_pages_select on public.document_pages for select to authenticated
  using (app.document_readable(document_id));
create policy document_cells_select on public.document_cells for select to authenticated
  using (app.document_readable(document_id));

-- ============================================================================
-- 5. Storage buckets + storage.objects policies (SECURITY_PERMISSION_MATRIX §5)
-- ============================================================================
-- BEGIN REFERENCE DATA
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('quarantine',        'quarantine',        false, 26214400,
     array['application/pdf', 'image/jpeg', 'image/png', 'image/webp',
           'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/csv']),
  ('documents',         'documents',         false, 26214400,
     array['application/pdf', 'image/jpeg', 'image/png', 'image/webp',
           'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/csv']),
  ('reports',           'reports',           false, 26214400, array['application/pdf', 'text/csv']),
  ('supplier-evidence', 'supplier-evidence', false, 26214400, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
-- END REFERENCE DATA

-- Upload: only into quarantine, only under the caller's own org folder, only for a document row the caller's org owns
-- that is still `uploaded` and whose registered path is exactly this object name.
create policy fbg_quarantine_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'quarantine'
    and app.storage_org_id(name) is not null
    and app.is_member(app.storage_org_id(name))
    and exists (select 1 from public.documents d
                 where d.id = app.storage_doc_id(name)
                   and d.org_id = app.storage_org_id(name)
                   and d.storage_bucket = 'quarantine'
                   and d.storage_path = name
                   and d.status = 'uploaded'));

-- Read: served buckets only, through the document's read rule. Quarantine is never readable by signed-in users.
create policy fbg_served_select on storage.objects for select to authenticated
  using (bucket_id in ('documents', 'reports', 'supplier-evidence')
         and app.storage_object_readable(bucket_id, name));

-- No update/delete policies for authenticated: promotion, purge and retention are worker (service_role) operations.
