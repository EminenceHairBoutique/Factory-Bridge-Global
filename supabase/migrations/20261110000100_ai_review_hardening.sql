-- 0010b ai_review_hardening (M0, 2026-11-10; ADR-039 §9). Forward-only: 0010 (20261109000100_ai_review.sql)
-- was merged to main via PR #34 before these fixes landed, so it is never edited; this migration replaces the
-- three affected definitions in place. Found in the M0 review of the B-18 commit:
--   1. app.accept_extraction checked the idempotent-replay shortcut BEFORE review_task_decidable, so a viewer or
--      outsider holding an earlier idempotency key learned the resulting quotation id.
--   2. The accepted payload could set source_type / rights_class, re-labelling a buyer-private operator import as a
--      supplier-portal or catalog price. Both are now forced from the document, like document_id / extraction_id.
--   3. documents_update let a project's assigned operator update (discard) ANY document on the buyer's project,
--      including the buyer's own uploads. The operator clause now requires source_type = 'operator_import'.
--   4. review_tasks status was protected only by the missing UPDATE grant; service_role (table grants) or any
--      privileged session could move status, attach an unrelated quotation, spoof resolved_by or edit a resolved
--      task. The UPDATE trigger now enforces those invariants for every role.
-- CREATE OR REPLACE keeps each function's owner and ACL; the execute grants are restated below so this file is
-- self-describing. Synthetic data only in the accompanying tests (supabase/tests/ai-review.test.ts).

-- 1 + 2 ----------------------------------------------------------------------

-- Accept an extraction review: the PERSON's payload (corrected in the UI) becomes a confirmed quotation through
-- app.supersede_quotation. document_id and extraction_id are taken from the task, and source_type / rights_class
-- from the document — never from the payload (a payload cannot re-label where a price came from).
-- p_old: null for a first version, or the current version this supersedes. Idempotent on p_idempotency_key.
create or replace function app.accept_extraction(p_task uuid, p_payload jsonb, p_old uuid, p_reason text, p_idempotency_key text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_task    public.review_tasks%rowtype;
  v_doc     public.documents%rowtype;
  v_payload jsonb;
  v_quote   uuid;
begin
  if auth.uid() is null then
    raise exception 'a review is accepted by a signed-in person, never by a job' using errcode = 'insufficient_privilege';
  end if;
  if p_idempotency_key is null or length(p_idempotency_key) < 8 then
    raise exception 'idempotency_key is required (>= 8 chars)' using errcode = 'check_violation';
  end if;
  select * into v_task from public.review_tasks where id = p_task for update;
  if v_task.id is null or not app.review_task_visible(p_task) then
    raise exception 'review task % not found', p_task using errcode = 'no_data_found';
  end if;
  if not app.review_task_decidable(p_task) then
    raise exception 'not permitted to review task %', p_task using errcode = 'insufficient_privilege';
  end if;
  if v_task.status = 'accepted' and v_task.accept_idempotency_key = p_idempotency_key then
    return v_task.result_quotation_id;     -- replay (only for someone who may decide)
  end if;
  if v_task.kind <> 'extraction' then
    raise exception 'review task % is not an extraction review', p_task using errcode = 'check_violation';
  end if;
  if v_task.status in ('accepted', 'rejected') then
    raise exception 'review task % is already %', p_task, v_task.status using errcode = 'check_violation';
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'payload must be a JSON object' using errcode = 'check_violation';
  end if;

  -- provenance comes from the task; thread identity from the task when the payload leaves it out
  select * into v_doc from public.documents where id = v_task.document_id;
  v_payload := p_payload
    || jsonb_build_object('document_id', v_task.document_id, 'extraction_id', v_task.subject_id,
                          'source_type', v_doc.source_type, 'rights_class', v_doc.rights_class);
  if p_old is null then
    if v_task.supplier_id is not null and not (v_payload ? 'supplier_id') then
      v_payload := v_payload || jsonb_build_object('supplier_id', v_task.supplier_id);
    end if;
    if v_task.brief_item_id is not null and not (v_payload ? 'brief_item_id') then
      v_payload := v_payload || jsonb_build_object('brief_item_id', v_task.brief_item_id);
    end if;
    if v_task.project_id is not null and not (v_payload ? 'buyer_org_id') then
      v_payload := v_payload || jsonb_build_object('buyer_org_id', v_task.org_id);
    end if;
    if v_task.supplier_id is not null and (v_payload ->> 'supplier_id')::uuid is distinct from v_task.supplier_id then
      raise exception 'payload.supplier_id differs from the review task' using errcode = 'check_violation';
    end if;
  end if;

  v_quote := app.supersede_quotation(p_old, v_payload, coalesce(nullif(btrim(p_reason), ''), 'review accepted'), p_idempotency_key);

  update public.review_tasks
     set status = 'accepted', resolved_by = auth.uid(), resolved_at = now(), result_quotation_id = v_quote,
         accept_idempotency_key = p_idempotency_key, resolution_reason = p_reason, updated_at = now()
   where id = p_task;

  if v_task.document_id is not null and not exists (
       select 1 from public.review_tasks o
        where o.document_id = v_task.document_id and o.kind = 'extraction' and o.status in ('pending', 'in_review')) then
    perform app.review_document_transition(v_task.document_id, 'in_review', 'accepted');
  end if;
  perform app.record_audit_event('review_tasks', p_task, 'accept', jsonb_build_object('status', v_task.status),
                                 jsonb_build_object('status', 'accepted', 'quotation_id', v_quote, 'reason', p_reason),
                                 v_task.org_id);
  return v_quote;
end;
$$;

revoke execute on function app.accept_extraction(uuid, jsonb, uuid, text, text) from public, anon;
grant execute on function app.accept_extraction(uuid, jsonb, uuid, text, text) to authenticated, service_role;

-- 3 --------------------------------------------------------------------------
-- Replaces 0010's documents_update (which replaced 0006's). documents_insert and fbg_quarantine_insert from 0010
-- are unchanged: an assigned operator may still REGISTER an operator_import on the buyer's project.

drop policy documents_update on public.documents;
create policy documents_update on public.documents for update to authenticated
  using (app.has_role(org_id, array['owner', 'admin', 'member']::public.member_role[])
      or (org_id = app.internal_org_id()
          and app.has_role(org_id, array['operator', 'compliance_reviewer', 'platform_admin']::public.member_role[]))
      or (project_id is not null and app.is_assigned_to_project(project_id) and source_type = 'operator_import'))
  with check (true);   -- the 0006 trigger still restricts non-workers to status -> discarded

-- 4 --------------------------------------------------------------------------
-- The trigger review_tasks_before_write (0010) keeps pointing at this function; only its body changes.

create or replace function app.review_task_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_doc  public.documents%rowtype;
  v_type public.org_type;
begin
  if tg_op = 'UPDATE' then
    -- identity and provenance never change; status columns are written only by the review functions (no UPDATE grant)
    if (new.org_id, new.project_id, new.kind, new.subject_id, new.document_id) is distinct from
       (old.org_id, old.project_id, old.kind, old.subject_id, old.document_id) then
      raise exception 'review task identity is immutable' using errcode = 'check_violation';
    end if;
    if old.status in ('accepted', 'rejected')
       and (to_jsonb(old) - 'updated_at') <> (to_jsonb(new) - 'updated_at') then
      raise exception 'a resolved review task cannot be reopened or edited' using errcode = 'check_violation';
    end if;
    -- defense in depth for privileged paths (service_role has table grants): status only ever moves by a person
    if new.status is distinct from old.status then
      if auth.uid() is null then
        raise exception 'review status is changed by a signed-in person, never by a job' using errcode = 'insufficient_privilege';
      end if;
      if new.status in ('accepted', 'rejected') and new.resolved_by is distinct from auth.uid() then
        raise exception 'resolved_by must be the person resolving the task' using errcode = 'check_violation';
      end if;
    end if;
    if new.status = 'accepted' and new.kind = 'extraction' and not exists (
         select 1 from public.quotations q
          where q.id = new.result_quotation_id and q.extraction_id = new.subject_id and q.document_id = new.document_id) then
      raise exception 'an accepted extraction task must point at a quotation citing its own document and extraction'
        using errcode = 'check_violation';
    end if;
    return new;
  end if;
  if new.status <> 'pending' then
    raise exception 'a new review task starts as pending' using errcode = 'check_violation';
  end if;
  if new.kind = 'extraction' then
    select d.* into v_doc from public.ai_extractions e join public.documents d on d.id = e.document_id where e.id = new.subject_id;
    if v_doc.id is null then
      raise exception 'extraction review subject % is not an ai_extractions row', new.subject_id using errcode = 'foreign_key_violation';
    end if;
    new.document_id := v_doc.id;
  elsif new.document_id is not null then
    select * into v_doc from public.documents where id = new.document_id;
  end if;
  if v_doc.id is null then
    raise exception 'a review task needs a document' using errcode = 'check_violation';
  end if;
  select o.org_type into v_type from public.organizations o where o.id = v_doc.org_id;
  if v_type = 'supplier' then
    raise exception 'supplier-owned documents are not reviewed through this path (Phase 2)' using errcode = 'check_violation';
  end if;
  new.org_id := v_doc.org_id;
  new.project_id := v_doc.project_id;
  if new.brief_item_id is not null and app.brief_item_project(new.brief_item_id) is distinct from new.project_id then
    raise exception 'brief_item_id must belong to the document''s project' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
