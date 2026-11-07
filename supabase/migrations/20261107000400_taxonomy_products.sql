-- 0004 taxonomy_products — Factory Bridge Global (MIGRATION_DEPENDENCY_MAP §2 row 0004; ADR-013 pilot families)
-- Reference data (taxonomy + attribute definitions) lives IN this migration with idempotent upserts, because
-- production needs it too (seed.sql is dev-only). Every attribute has label_en AND label_zh.
-- Blocked categories are present with compliance_state = 'blocked' so the rule is data, not a code comment.

-- ============================================================================
-- 1. Tables
-- ============================================================================

create table public.product_taxonomy (
  id               uuid primary key default gen_random_uuid(),
  parent_id        uuid references public.product_taxonomy (id) on delete restrict,
  code             text not null unique check (code ~ '^[a-z0-9_]+(\.[a-z0-9_]+)*$'),
  name_en          text not null,
  name_zh          text not null,
  search_terms_zh  text[] not null default '{}',   -- starting queries for MANUAL research only (never automated)
  compliance_state public.compliance_state not null default 'clear',
  compliance_note  text,
  pilot_flag       boolean not null default false,
  sort_order       int not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
comment on table public.product_taxonomy is 'Product families. compliance_state=blocked → no self-service quoting (CLAUDE.md §4).';

create table public.attribute_definitions (
  id              uuid primary key default gen_random_uuid(),
  taxonomy_id     uuid not null references public.product_taxonomy (id) on delete cascade,
  code            text not null check (code ~ '^[a-z][a-z0-9_]*$'),
  label_en        text not null,
  label_zh        text not null,
  data_type       text not null check (data_type in ('number', 'text', 'enum', 'bool')),
  unit            text,                                   -- canonical unit for numbers (mm, g, um, in, ...)
  allowed_values  jsonb,                                  -- for enum: [{"code":"bopp_white","en":"...","zh":"..."}]
  is_hard_default boolean not null default false,         -- hard attribute by default in comparisons (QUOTE_ENGINE_SPEC §2.2)
  tolerance       numeric(18,6),                          -- absolute tolerance for numeric equality
  required        boolean not null default false,
  sort_order      int not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (taxonomy_id, code),
  check (data_type <> 'enum' or jsonb_typeof(allowed_values) = 'array'),
  check (data_type = 'number' or tolerance is null)
);

create table public.products (
  id                uuid primary key default gen_random_uuid(),
  taxonomy_id       uuid not null references public.product_taxonomy (id) on delete restrict,
  owner_org_id      uuid references public.organizations (id) on delete cascade,  -- null = platform canonical
  canonical_name_en text not null,
  canonical_name_zh text,
  status            text not null default 'active' check (status in ('active', 'archived')),
  created_by        uuid,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index products_owner_idx on public.products (owner_org_id);
create index products_taxonomy_idx on public.products (taxonomy_id);

create table public.product_variants (
  id              uuid primary key default gen_random_uuid(),
  product_id      uuid not null references public.products (id) on delete cascade,
  owner_org_id    uuid references public.organizations (id) on delete cascade,  -- denormalized from product (trigger)
  variant_code    text,
  attributes      jsonb not null default '{}'::jsonb check (jsonb_typeof(attributes) = 'object'),
  -- jsonb stores keys in canonical order, so ::text is a stable canonical serialization.
  attributes_hash text generated always as (md5(attributes::text)) stored,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (product_id, attributes_hash)
);
create index product_variants_owner_idx on public.product_variants (owner_org_id);

-- Versioned, immutable specifications. A new version is a new row; brief_item_id gets its FK in 0008.
create table public.product_specifications (
  id                   uuid primary key default gen_random_uuid(),
  taxonomy_id          uuid not null references public.product_taxonomy (id) on delete restrict,
  variant_id           uuid references public.product_variants (id) on delete cascade,
  brief_item_id        uuid,                                                     -- FK added in 0008
  owner_org_id         uuid references public.organizations (id) on delete cascade,  -- null = platform canonical
  version              int not null default 1 check (version >= 1),
  attributes           jsonb not null check (jsonb_typeof(attributes) = 'object'),
  hard_attribute_codes text[] not null default '{}',
  text_en              text,
  text_zh              text,
  source_lang          text check (source_lang in ('en-US', 'zh-CN')),
  translation_run_id   uuid,                                                     -- ai_runs (0010), no FK yet
  confirmed_by         uuid,
  confirmed_at         timestamptz,
  created_by           uuid,
  created_at           timestamptz not null default now(),
  check (variant_id is not null or brief_item_id is not null),
  unique (variant_id, version),
  unique (brief_item_id, version)
);
create index product_specifications_owner_idx on public.product_specifications (owner_org_id);

-- ============================================================================
-- 2. Deterministic attribute validation (no AI; used by triggers and by the domain engine's seeds)
-- ============================================================================

-- Raises on: unknown attribute code for the taxonomy; wrong JSON type; enum value outside allowed_values;
-- missing required attributes. Numeric values must be JSON numbers (never strings) so comparisons are exact.
create or replace function app.validate_attributes(p_taxonomy uuid, p_attributes jsonb)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  k text;
  v jsonb;
  def public.attribute_definitions%rowtype;
  missing text[];
begin
  if jsonb_typeof(p_attributes) <> 'object' then
    raise exception 'attributes must be a JSON object' using errcode = 'check_violation';
  end if;
  for k, v in select * from jsonb_each(p_attributes) loop
    select * into def from public.attribute_definitions d where d.taxonomy_id = p_taxonomy and d.code = k;
    if def.id is null then
      raise exception 'unknown attribute "%" for taxonomy %', k, p_taxonomy using errcode = 'check_violation';
    end if;
    if jsonb_typeof(v) = 'null' then
      continue;  -- explicit unknown is allowed; "unknown ≠ default" is enforced by the engine
    end if;
    case def.data_type
      when 'number' then
        if jsonb_typeof(v) <> 'number' then
          raise exception 'attribute "%" must be a number', k using errcode = 'check_violation';
        end if;
      when 'bool' then
        if jsonb_typeof(v) <> 'boolean' then
          raise exception 'attribute "%" must be a boolean', k using errcode = 'check_violation';
        end if;
      when 'text' then
        if jsonb_typeof(v) <> 'string' then
          raise exception 'attribute "%" must be a string', k using errcode = 'check_violation';
        end if;
      when 'enum' then
        if jsonb_typeof(v) <> 'string' or not exists (
          select 1 from jsonb_array_elements(def.allowed_values) a where a ->> 'code' = v #>> '{}'
        ) then
          raise exception 'attribute "%" value % is not an allowed value', k, v using errcode = 'check_violation';
        end if;
    end case;
  end loop;
  select coalesce(array_agg(d.code), '{}') into missing
    from public.attribute_definitions d
   where d.taxonomy_id = p_taxonomy and d.required and not (p_attributes ? d.code);
  if array_length(missing, 1) > 0 then
    raise exception 'missing required attributes: %', array_to_string(missing, ', ') using errcode = 'check_violation';
  end if;
end;
$$;

revoke execute on function app.validate_attributes(uuid, jsonb) from public, anon;
grant execute on function app.validate_attributes(uuid, jsonb) to authenticated, service_role;

create or replace function app.variant_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tax uuid;
  v_owner uuid;
begin
  select p.taxonomy_id, p.owner_org_id into v_tax, v_owner from public.products p where p.id = new.product_id;
  if v_tax is null then
    raise exception 'product % does not exist', new.product_id using errcode = 'foreign_key_violation';
  end if;
  new.owner_org_id := v_owner;              -- denormalized; immutable afterwards via owner guard
  perform app.validate_attributes(v_tax, new.attributes);
  return new;
end;
$$;

create or replace function app.specification_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform app.validate_attributes(new.taxonomy_id, new.attributes);
  if tg_op = 'UPDATE' then
    -- Only confirmation columns may change; the specification payload is immutable (new version = new row).
    if new.attributes is distinct from old.attributes
       or new.hard_attribute_codes is distinct from old.hard_attribute_codes
       or new.text_en is distinct from old.text_en or new.text_zh is distinct from old.text_zh
       or new.version is distinct from old.version then
      raise exception 'product_specifications are immutable; insert a new version' using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

-- ============================================================================
-- 3. Triggers
-- ============================================================================

create trigger product_taxonomy_set_updated_at before update on public.product_taxonomy
  for each row execute function app.set_updated_at();
create trigger attribute_definitions_set_updated_at before update on public.attribute_definitions
  for each row execute function app.set_updated_at();
create trigger products_set_updated_at before update on public.products
  for each row execute function app.set_updated_at();
create trigger products_owner_guard before update on public.products
  for each row execute function app.prevent_owner_change('owner_org_id', 'taxonomy_id');
create trigger product_variants_set_updated_at before update on public.product_variants
  for each row execute function app.set_updated_at();
create trigger product_variants_validate before insert or update on public.product_variants
  for each row execute function app.variant_before_write();
create trigger product_variants_owner_guard before update on public.product_variants
  for each row execute function app.prevent_owner_change('product_id', 'owner_org_id');
create trigger product_specifications_validate before insert or update on public.product_specifications
  for each row execute function app.specification_before_write();
create trigger product_specifications_owner_guard before update on public.product_specifications
  for each row execute function app.prevent_owner_change('owner_org_id', 'taxonomy_id', 'variant_id', 'brief_item_id');

create trigger products_audit after insert or update or delete on public.products
  for each row execute function app.audit_row_change('owner_org_id');
create trigger product_variants_audit after insert or update or delete on public.product_variants
  for each row execute function app.audit_row_change('owner_org_id');
create trigger product_specifications_audit after insert or update or delete on public.product_specifications
  for each row execute function app.audit_row_change('owner_org_id');
create trigger product_taxonomy_audit after insert or update or delete on public.product_taxonomy
  for each row execute function app.audit_row_change('id');
create trigger attribute_definitions_audit after insert or update or delete on public.attribute_definitions
  for each row execute function app.audit_row_change('taxonomy_id');

-- ============================================================================
-- 4. RLS
-- ============================================================================

alter table public.product_taxonomy        enable row level security;
alter table public.product_taxonomy        force row level security;
alter table public.attribute_definitions   enable row level security;
alter table public.attribute_definitions   force row level security;
alter table public.products                enable row level security;
alter table public.products                force row level security;
alter table public.product_variants        enable row level security;
alter table public.product_variants        force row level security;
alter table public.product_specifications  enable row level security;
alter table public.product_specifications  force row level security;

-- Supabase default privileges grant ALL to anon/authenticated/service_role on new tables: revoke from
-- `authenticated` explicitly, then grant only what a policy can allow.
revoke all on public.product_taxonomy, public.attribute_definitions, public.products,
              public.product_variants, public.product_specifications from public, anon, authenticated;
grant select on public.product_taxonomy, public.attribute_definitions to authenticated;
grant select, insert, update on public.products, public.product_variants, public.product_specifications to authenticated;
grant all on public.product_taxonomy, public.attribute_definitions, public.products,
             public.product_variants, public.product_specifications to service_role;

-- Reference data: readable by every signed-in user; written only by platform admins (migrations run as superuser).
create policy product_taxonomy_select on public.product_taxonomy for select to authenticated using (true);
create policy attribute_definitions_select on public.attribute_definitions for select to authenticated using (true);

-- Products / variants / specifications: platform canonical (owner null) readable by all signed-in users;
-- org-owned rows by that org's members and platform admin. (0008 adds the assigned-operator clause.)
create policy products_select on public.products for select to authenticated
  using (owner_org_id is null or app.is_member(owner_org_id) or app.is_platform_admin());
create policy products_insert on public.products for insert to authenticated
  with check (
       (owner_org_id is null and app.is_internal())
    or (owner_org_id is not null and app.has_role(owner_org_id, array['owner', 'admin', 'member']::public.member_role[])));
create policy products_update on public.products for update to authenticated
  using ((owner_org_id is null and app.is_internal())
      or (owner_org_id is not null and app.has_role(owner_org_id, array['owner', 'admin', 'member']::public.member_role[]))
      or app.is_platform_admin())
  with check (true);

create policy product_variants_select on public.product_variants for select to authenticated
  using (owner_org_id is null or app.is_member(owner_org_id) or app.is_platform_admin());
create policy product_variants_insert on public.product_variants for insert to authenticated
  with check (exists (
    select 1 from public.products p where p.id = product_id
      and ((p.owner_org_id is null and app.is_internal())
        or (p.owner_org_id is not null and app.has_role(p.owner_org_id, array['owner', 'admin', 'member']::public.member_role[])))));
create policy product_variants_update on public.product_variants for update to authenticated
  using ((owner_org_id is null and app.is_internal())
      or (owner_org_id is not null and app.has_role(owner_org_id, array['owner', 'admin', 'member']::public.member_role[]))
      or app.is_platform_admin())
  with check (true);

create policy product_specifications_select on public.product_specifications for select to authenticated
  using (owner_org_id is null or app.is_member(owner_org_id) or app.is_platform_admin());
create policy product_specifications_insert on public.product_specifications for insert to authenticated
  with check (
       (owner_org_id is null and app.is_internal())
    or (owner_org_id is not null and app.has_role(owner_org_id, array['owner', 'admin', 'member']::public.member_role[])));
create policy product_specifications_update on public.product_specifications for update to authenticated
  using ((owner_org_id is not null and app.has_role(owner_org_id, array['owner', 'admin', 'member']::public.member_role[]))
      or app.is_internal())
  with check (true);  -- payload immutability enforced by trigger; only confirmation columns can change

-- ============================================================================
-- 5. Reference data (idempotent; re-running this block must change nothing)
-- ============================================================================
-- BEGIN REFERENCE DATA
insert into public.product_taxonomy (code, name_en, name_zh, search_terms_zh, compliance_state, pilot_flag, sort_order) values
  ('packaging',  'Custom packaging & labels',        '定制包装与标签',   '{}', 'clear', true,  10),
  ('apparel',    'Blank / private-label apparel',    '空白/贴牌服装',    '{}', 'clear', false, 20),
  ('hair',       'Human hair & salon supplies',      '人发与美发用品',   '{}', 'clear', true,  30),
  ('containers', 'Non-medical consumer packaging',   '非医疗消费包装',   '{}', 'clear', false, 40),
  ('industrial', 'General industrial consumables',   '通用工业耗材',     '{}', 'clear', false, 50),
  ('restricted', 'Restricted / compliance-held',     '受限/合规审查',    '{}', 'blocked', false, 90)
on conflict (code) do update set name_en = excluded.name_en, name_zh = excluded.name_zh,
  compliance_state = excluded.compliance_state, pilot_flag = excluded.pilot_flag, sort_order = excluded.sort_order;

insert into public.product_taxonomy (parent_id, code, name_en, name_zh, search_terms_zh, compliance_state, compliance_note, pilot_flag, sort_order)
select p.id, v.code, v.name_en, v.name_zh, v.terms, v.state::public.compliance_state, v.note, v.pilot, v.ord
from (values
  ('packaging',  'packaging.labels_roll',       'Custom pressure-sensitive roll labels', '定制卷筒不干胶标签', array['定制卷筒不干胶标签','防水不干胶标签定制'], 'clear', null, true,  11),
  ('packaging',  'packaging.cartons_folding',   'Printed folding cartons',               '定制彩盒包装盒',     array['定制彩盒包装盒','折叠彩盒印刷定制'],     'clear', null, true,  12),
  ('apparel',    'apparel.tee_cotton_heavy',    'Heavyweight cotton blank T-shirts',     '重磅纯棉空白T恤',    array['重磅纯棉空白T恤批发','230克纯棉T恤'],     'clear', null, false, 21),
  ('apparel',    'apparel.tee_polyester',       'Polyester performance blank shirts',    '涤纶速干空白T恤',    array['速干运动空白T恤批发','涤纶运动T恤'],       'clear', null, false, 22),
  ('hair',       'hair.bundles',                'Human-hair bundles / wefts',            '真人发发帘',         array['真人发发帘批发','原生发发束'],             'clear', null, true,  31),
  ('hair',       'hair.lace_wigs',              'Lace-front human-hair wigs',            '真人发蕾丝假发',     array['真人发蕾丝假发定制','高清蕾丝假发'],       'clear', null, false, 32),
  ('containers', 'containers.bottles_pet_hdpe', 'PET/HDPE cosmetic bottles',             'PET/HDPE化妆品瓶',   array['250ml PET化妆品瓶批发','HDPE包装瓶定制'],  'clear', null, false, 41),
  ('containers', 'containers.pumps',            'Pump closures & dispenser heads',       '乳液泵头',           array['乳液泵头批发','24/410按压泵头'],           'clear', null, false, 42),
  ('industrial', 'industrial.heat_sealer_consumables', 'Industrial heat-sealer consumables', '工业封口机耗材', array['工业封口机耗材','封口机加热条定制'],       'clear', null, false, 51),
  ('industrial', 'industrial.conveyor_belts',   'Custom light-duty conveyor belts',      '轻型输送带定制',     array['工业PVC输送带定制','轻型输送带'],          'clear', null, false, 52),
  ('restricted', 'restricted.medical_gloves',   'Medical examination / surgical gloves', '医用检查/外科手套',  '{}', 'blocked', 'FDA device rules depend on intended use; no self-service quoting (CLAUDE.md §4).', false, 91),
  ('restricted', 'restricted.sterile_vials',    'Sterile / medical vials',               '无菌/医用西林瓶',    '{}', 'blocked', 'Medical product; compliance review required.', false, 92),
  ('restricted', 'restricted.pill_press_encapsulation', 'Pill presses / encapsulating machines', '压片机/胶囊填充机', '{}', 'blocked', 'DEA-regulated machine transactions; blocked.', false, 93),
  ('restricted', 'restricted.ingestibles',      'Ingestibles / empty capsules / supplements', '可食用品/空胶囊/补剂', '{}', 'blocked', 'FDA; blocked pending category review.', false, 94),
  ('restricted', 'restricted.finished_cosmetics', 'Finished cosmetics',                  '成品化妆品',         '{}', 'blocked', 'MoCRA obligations; packaging only is a different category.', false, 95),
  ('restricted', 'restricted.lab_equipment',    'HPLC / export-sensitive machinery',     'HPLC/出口敏感设备',  '{}', 'blocked', 'Export-control and after-sales review; managed sourcing only, later.', false, 96)
) as v(parent_code, code, name_en, name_zh, terms, state, note, pilot, ord)
join public.product_taxonomy p on p.code = v.parent_code
on conflict (code) do update set name_en = excluded.name_en, name_zh = excluded.name_zh,
  search_terms_zh = excluded.search_terms_zh, compliance_state = excluded.compliance_state,
  compliance_note = excluded.compliance_note, pilot_flag = excluded.pilot_flag, sort_order = excluded.sort_order;

-- Attribute definitions for the three pilot families (QUALITY_ASSURANCE.md §6, PILOT_CATEGORY_SELECTION.md §6).
insert into public.attribute_definitions (taxonomy_id, code, label_en, label_zh, data_type, unit, allowed_values, is_hard_default, tolerance, required, sort_order)
select t.id, v.code, v.label_en, v.label_zh, v.data_type, v.unit, v.allowed::jsonb, v.hard, v.tol, v.req, v.ord
from (values
  -- packaging.labels_roll
  ('packaging.labels_roll', 'width_mm',        'Label width',            '标签宽度',     'number', 'mm', null, true,  0.5,  true,  1),
  ('packaging.labels_roll', 'height_mm',       'Label height',           '标签高度',     'number', 'mm', null, true,  0.5,  true,  2),
  ('packaging.labels_roll', 'shape',           'Shape',                  '形状',         'enum',   null, '[{"code":"rectangle","en":"Rectangle","zh":"矩形"},{"code":"round","en":"Round","zh":"圆形"},{"code":"oval","en":"Oval","zh":"椭圆"},{"code":"custom","en":"Custom die-cut","zh":"异形模切"}]', true, null, true, 3),
  ('packaging.labels_roll', 'face_stock',      'Face stock',             '面材',         'enum',   null, '[{"code":"bopp_white","en":"White BOPP","zh":"白色BOPP"},{"code":"bopp_clear","en":"Clear BOPP","zh":"透明BOPP"},{"code":"bopp_metallized","en":"Metallized BOPP","zh":"镀铝BOPP"},{"code":"pp","en":"PP","zh":"PP"},{"code":"pe","en":"PE","zh":"PE"},{"code":"paper_semigloss","en":"Semi-gloss paper","zh":"半光铜版纸"},{"code":"paper_matte","en":"Matte paper","zh":"哑光纸"},{"code":"paper_kraft","en":"Kraft paper","zh":"牛皮纸"}]', true, null, true, 4),
  ('packaging.labels_roll', 'thickness_um',    'Face stock thickness',   '面材厚度',     'number', 'um', null, false, 5,    false, 5),
  ('packaging.labels_roll', 'adhesive',        'Adhesive',               '胶粘剂',       'enum',   null, '[{"code":"permanent_acrylic","en":"Permanent acrylic","zh":"永久性丙烯酸"},{"code":"removable","en":"Removable","zh":"可移除"},{"code":"hot_melt","en":"Hot melt","zh":"热熔胶"},{"code":"freezer","en":"Freezer / cold-chain","zh":"冷冻级"}]', true, null, true, 6),
  ('packaging.labels_roll', 'liner',           'Liner',                  '底纸',         'enum',   null, '[{"code":"glassine","en":"Glassine","zh":"格拉辛"},{"code":"pet","en":"PET","zh":"PET"}]', false, null, false, 7),
  ('packaging.labels_roll', 'print_method',    'Print method',           '印刷方式',     'enum',   null, '[{"code":"flexo","en":"Flexo","zh":"柔印"},{"code":"digital","en":"Digital","zh":"数码印刷"},{"code":"offset","en":"Offset","zh":"胶印"}]', false, null, false, 8),
  ('packaging.labels_roll', 'print_colors',    'Print colors',           '印刷色数',     'text',   null, null, true,  null, true,  9),
  ('packaging.labels_roll', 'finish',          'Finish',                 '表面处理',     'enum',   null, '[{"code":"matte_lamination","en":"Matte lamination","zh":"哑膜"},{"code":"gloss_lamination","en":"Gloss lamination","zh":"亮膜"},{"code":"varnish","en":"Varnish","zh":"上光油"},{"code":"none","en":"None","zh":"无"}]', true, null, true, 10),
  ('packaging.labels_roll', 'corner_radius_mm','Corner radius',          '圆角半径',     'number', 'mm', null, false, 0.5,  false, 11),
  ('packaging.labels_roll', 'core_mm',         'Core inner diameter',    '卷芯内径',     'number', 'mm', null, false, 0,    false, 12),
  ('packaging.labels_roll', 'labels_per_roll', 'Labels per roll',        '每卷标签数',   'number', 'pc', null, false, 0,    false, 13),
  ('packaging.labels_roll', 'unwind_direction','Unwind direction (1–8)', '出卷方向(1–8)','number', null, null, false, 0,    false, 14),
  -- packaging.cartons_folding
  ('packaging.cartons_folding', 'length_mm',   'Length',                 '长',           'number', 'mm', null, true,  1,    true,  1),
  ('packaging.cartons_folding', 'width_mm',    'Width',                  '宽',           'number', 'mm', null, true,  1,    true,  2),
  ('packaging.cartons_folding', 'height_mm',   'Height',                 '高',           'number', 'mm', null, true,  1,    true,  3),
  ('packaging.cartons_folding', 'board',       'Board',                  '纸板',         'enum',   null, '[{"code":"sbs","en":"SBS","zh":"SBS白卡"},{"code":"c1s","en":"C1S","zh":"单面涂布白卡"},{"code":"ccnb","en":"CCNB","zh":"灰底白板"},{"code":"kraft","en":"Kraft","zh":"牛卡"},{"code":"corrugated_e","en":"E-flute corrugated","zh":"E楞瓦楞"}]', true, null, true, 4),
  ('packaging.cartons_folding', 'gsm',         'Board weight',           '克重',         'number', 'gsm', null, true, 20,   true,  5),
  ('packaging.cartons_folding', 'structure',   'Structure',              '盒型',         'enum',   null, '[{"code":"reverse_tuck","en":"Reverse tuck end","zh":"反插盒"},{"code":"straight_tuck","en":"Straight tuck end","zh":"直插盒"},{"code":"auto_lock_bottom","en":"Auto-lock bottom","zh":"自动锁底"},{"code":"crash_lock","en":"Crash-lock bottom","zh":"扣底"},{"code":"sleeve","en":"Sleeve","zh":"套盒"}]', true, null, true, 6),
  ('packaging.cartons_folding', 'print_colors','Print colors',           '印刷色数',     'text',   null, null, true,  null, true,  7),
  ('packaging.cartons_folding', 'finish',      'Finish',                 '表面处理',     'enum',   null, '[{"code":"matte_lamination","en":"Matte lamination","zh":"哑膜"},{"code":"gloss_lamination","en":"Gloss lamination","zh":"亮膜"},{"code":"soft_touch","en":"Soft-touch","zh":"触感膜"},{"code":"spot_uv","en":"Spot UV","zh":"局部UV"},{"code":"foil","en":"Foil stamping","zh":"烫金/烫银"},{"code":"none","en":"None","zh":"无"}]', false, null, false, 8),
  ('packaging.cartons_folding', 'glue',        'Glue',                   '胶水',         'enum',   null, '[{"code":"hot_melt","en":"Hot melt","zh":"热熔胶"},{"code":"pva","en":"PVA","zh":"白乳胶"},{"code":"none","en":"None (flat, unglued)","zh":"无(平板未粘)"}]', false, null, false, 9),
  ('packaging.cartons_folding', 'flat_shipped','Shipped flat',           '平板发货',     'bool',   null, null, false, null, false, 10),
  ('packaging.cartons_folding', 'insert',      'Insert',                 '内托',         'text',   null, null, false, null, false, 11),
  ('packaging.cartons_folding', 'barcode',     'Barcode printed',        '印刷条码',     'bool',   null, null, false, null, false, 12),
  -- hair.bundles
  ('hair.bundles', 'weight_g',                 'Bundle weight',          '每束重量',     'number', 'g',  null, true,  3,    true,  1),
  ('hair.bundles', 'length_in',                'Length',                 '长度',         'number', 'in', null, true,  0,    true,  2),
  ('hair.bundles', 'texture',                  'Texture',                '纹理',         'enum',   null, '[{"code":"natural_straight","en":"Natural straight","zh":"自然直"},{"code":"body_wave","en":"Body wave","zh":"大波浪"},{"code":"deep_wave","en":"Deep wave","zh":"深波浪"},{"code":"loose_wave","en":"Loose wave","zh":"松波浪"},{"code":"water_wave","en":"Water wave","zh":"水波纹"},{"code":"kinky_curly","en":"Kinky curly","zh":"小卷"}]', true, null, true, 3),
  ('hair.bundles', 'color',                    'Color',                  '颜色',         'text',   null, null, true,  null, true,  4),
  ('hair.bundles', 'processing_claim',         'Processing (claimed)',   '处理方式(声明)','enum',  null, '[{"code":"unprocessed","en":"Unprocessed","zh":"未经处理"},{"code":"steamed","en":"Steam-processed","zh":"蒸汽处理"},{"code":"chemically_treated","en":"Chemically treated","zh":"化学处理"},{"code":"unknown","en":"Unknown","zh":"未知"}]', true, null, true, 5),
  ('hair.bundles', 'origin_claim',             'Origin (claimed)',       '来源地(声明)', 'enum',   null, '[{"code":"vietnam","en":"Vietnam","zh":"越南"},{"code":"cambodia","en":"Cambodia","zh":"柬埔寨"},{"code":"india","en":"India","zh":"印度"},{"code":"china","en":"China","zh":"中国"},{"code":"myanmar","en":"Myanmar","zh":"缅甸"},{"code":"unknown","en":"Unknown","zh":"未知"}]', false, null, false, 6),
  ('hair.bundles', 'origin_doc_level',         'Origin documentation',   '来源证明级别', 'enum',   null, '[{"code":"self_declared","en":"Self-declared","zh":"自行声明"},{"code":"supplier_doc","en":"Supplier document","zh":"供应商文件"},{"code":"third_party","en":"Third-party verified","zh":"第三方核验"}]', false, null, false, 7),
  ('hair.bundles', 'weft_type',                'Weft construction',      '发帘工艺',     'enum',   null, '[{"code":"machine_double","en":"Machine double weft","zh":"机织双层"},{"code":"hand_tied","en":"Hand-tied","zh":"手工编织"}]', true, null, false, 8),
  ('hair.bundles', 'cuticle_aligned_claim',    'Cuticle aligned (claimed)','毛鳞片同向(声明)','bool', null, null, false, null, false, 9),
  ('hair.bundles', 'density',                  'Density / thickness',    '密度',         'text',   null, null, false, null, false, 10)
) as v(tax_code, code, label_en, label_zh, data_type, unit, allowed, hard, tol, req, ord)
join public.product_taxonomy t on t.code = v.tax_code
on conflict (taxonomy_id, code) do update set label_en = excluded.label_en, label_zh = excluded.label_zh,
  data_type = excluded.data_type, unit = excluded.unit, allowed_values = excluded.allowed_values,
  is_hard_default = excluded.is_hard_default, tolerance = excluded.tolerance, required = excluded.required,
  sort_order = excluded.sort_order;
-- END REFERENCE DATA
