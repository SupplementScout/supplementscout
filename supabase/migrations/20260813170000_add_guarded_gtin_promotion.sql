begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

alter table public.approved_import_plans
  drop constraint if exists approved_import_plans_plan_kind_check;
alter table public.approved_import_plans
  add constraint approved_import_plans_plan_kind_check
  check (plan_kind in ('feed', 'manual', 'gtin_promotion'));
alter table public.approved_import_plans
  add column if not exists apply_result jsonb;

create table if not exists public.gtin_promotion_quarantine (
  gtin text primary key check (gtin ~ '^[0-9]{8}$|^[0-9]{12,14}$'),
  product_id bigint not null references public.products(id) on delete restrict,
  product_variant_id bigint not null references public.product_variants(id) on delete restrict,
  reason text not null check (length(trim(reason)) between 1 and 500),
  source text not null check (length(trim(source)) between 1 and 200),
  created_at timestamptz not null default now()
);

alter table public.gtin_promotion_quarantine owner to postgres;
alter table public.gtin_promotion_quarantine enable row level security;
alter table public.gtin_promotion_quarantine force row level security;
revoke all on table public.gtin_promotion_quarantine
  from public, anon, authenticated, service_role;

insert into public.gtin_promotion_quarantine(gtin, product_id, product_variant_id, reason, source)
values
  ('6009544961161',87,38,'Pack conflict: 200 g canonical/source versus 230 g independent evidence','GTIN Confirmation Sprint'),
  ('850054547989',58,1007,'Pack conflict: 387 g canonical versus 372 g independent evidence','Scaled GTIN Confirmation Batch'),
  ('850054547996',58,1607,'Pack conflict: 387 g canonical versus 372 g independent evidence','Scaled GTIN Confirmation Batch'),
  ('850060014024',58,1611,'Pack conflict: 387 g canonical versus 372 g independent evidence','Scaled GTIN Confirmation Batch'),
  ('810028296107',49,1028,'Version/pack conflict: 350 g canonical versus 270 g V2 evidence','Scaled GTIN Confirmation Batch'),
  ('810028296084',49,1596,'Version/pack conflict: 350 g canonical versus 270 g V2 evidence','Scaled GTIN Confirmation Batch'),
  ('810028296114',49,1597,'Version/pack conflict: 350 g canonical versus 270 g V2 evidence','Scaled GTIN Confirmation Batch'),
  ('810028296091',49,1598,'Version/pack conflict: 350 g canonical versus 270 g V2 evidence','Scaled GTIN Confirmation Batch'),
  ('5033579002576',291,1040,'Pack conflict: 600 g canonical versus 400 g independent evidence','Scaled GTIN Confirmation Batch'),
  ('5033579002545',291,1691,'Pack conflict: 600 g canonical versus 400 g independent evidence','Scaled GTIN Confirmation Batch'),
  ('5033579002538',291,1692,'Pack conflict: 600 g canonical versus 400 g independent evidence','Scaled GTIN Confirmation Batch'),
  ('5033579002552',291,1693,'Pack conflict: 600 g canonical versus 400 g independent evidence','Scaled GTIN Confirmation Batch'),
  ('810028290532',232,1017,'Pack conflict: 989 g canonical versus 896 g independent evidence','Scaled GTIN Confirmation Batch'),
  ('850001610094',232,1812,'Pack conflict: 989 g canonical versus 896 g independent evidence','Scaled GTIN Confirmation Batch'),
  ('810028291942',232,1813,'Pack conflict: 989 g canonical versus 980 g independent evidence','Scaled GTIN Confirmation Batch'),
  ('5056569900409',27,1593,'Pack conflict: 195 g canonical versus 207 g independent evidence','Scaled GTIN Confirmation Batch')
on conflict (gtin) do update set
  product_id = excluded.product_id,
  product_variant_id = excluded.product_variant_id,
  reason = excluded.reason,
  source = excluded.source;

create unique index if not exists product_variants_gtin_unique
  on public.product_variants(gtin)
  where gtin is not null and btrim(gtin) <> '';

create or replace function public.gtin_promotion_is_valid_gtin(p_value text)
returns boolean
language plpgsql
immutable
strict
set search_path = pg_catalog
as $valid_gtin$
declare
  v_gtin text := regexp_replace(p_value, '[[:space:]-]+', '', 'g');
  v_sum integer := 0;
  v_position integer := 1;
  v_index integer;
begin
  if v_gtin !~ '^[0-9]{8}$|^[0-9]{12,14}$' then return false; end if;
  for v_index in reverse length(v_gtin)-1..1 loop
    v_sum := v_sum + substring(v_gtin from v_index for 1)::integer
      * case when v_position % 2 = 1 then 3 else 1 end;
    v_position := v_position + 1;
  end loop;
  return (10 - (v_sum % 10)) % 10 = right(v_gtin, 1)::integer;
end;
$valid_gtin$;

create or replace function public.validate_gtin_promotion_plan_read_only(p_plan jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $validate_gtin_promotion$
declare
  v_row jsonb;
  v_product public.products%rowtype;
  v_variant public.product_variants%rowtype;
  v_product_id bigint;
  v_variant_id bigint;
  v_gtin text;
  v_destination text;
  v_expected_product jsonb;
  v_expected_variant jsonb;
  v_expected_current text;
  v_actual_current text;
begin
  if not public.atomic_import_has_exact_keys(p_plan, array['meta','owner_review','rows'])
    or not public.atomic_import_has_exact_keys(
      p_plan->'meta',
      array['version','operation_type','plan_kind','plan_fingerprint','source_row_fingerprint','preview_fingerprint','canonical_snapshot_fingerprint']
    )
    or not public.atomic_import_has_exact_keys(
      p_plan->'owner_review',
      array['decision','reviewed_count','document','scope_fingerprint']
    )
    or p_plan#>>'{meta,version}' <> '1'
    or p_plan#>>'{meta,operation_type}' <> 'GTIN_PROMOTION'
    or p_plan#>>'{meta,plan_kind}' <> 'gtin_promotion'
    or (p_plan#>>'{meta,plan_fingerprint}') !~ '^[0-9a-f]{32}$'
    or (p_plan#>>'{meta,source_row_fingerprint}') !~ '^[0-9a-f]{64}$'
    or (p_plan#>>'{meta,preview_fingerprint}') !~ '^[0-9a-f]{64}$'
    or (p_plan#>>'{meta,canonical_snapshot_fingerprint}') !~ '^[0-9a-f]{64}$'
    or p_plan#>>'{owner_review,decision}' <> 'APPROVED_EXACT_SCOPE'
    or p_plan#>>'{owner_review,reviewed_count}' <> '45'
    or p_plan#>>'{owner_review,document}' <> 'docs/EBAY-UK-COVERAGE-PLAN.md'
    or (p_plan#>>'{owner_review,scope_fingerprint}') !~ '^[0-9a-f]{64}$'
    or jsonb_typeof(p_plan->'rows') <> 'array'
    or jsonb_array_length(p_plan->'rows') <> 45
    or md5(public.atomic_import_canonical_json(
      jsonb_set(p_plan, '{meta,plan_fingerprint}', 'null'::jsonb, false)
    )) <> p_plan#>>'{meta,plan_fingerprint}' then
    raise exception 'invalid GTIN promotion plan envelope or fingerprint';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_plan->'rows') item
    group by item->>'product_id', item->>'variant_id', item->>'destination_field'
    having count(*) > 1
  ) or exists (
    select 1 from jsonb_array_elements(p_plan->'rows') item
    group by item->>'gtin'
    having count(*) > 1
  ) then
    raise exception 'GTIN promotion plan contains duplicate targets or GTINs';
  end if;

  for v_row in select value from jsonb_array_elements(p_plan->'rows') loop
    if not public.atomic_import_has_exact_keys(
      v_row,
      array['product_id','variant_id','gtin','destination_field','expected_current_gtin','single_trade_item','evidence_count','evidence_sources','candidate_fingerprint','owner_decision','expected_product','expected_variant']
    )
      or not public.atomic_import_has_exact_keys(
        v_row->'expected_product',
        array['name','brand','product_format','is_active','merged_into_product_id','gtin']
      )
      or not public.atomic_import_has_exact_keys(
        v_row->'expected_variant',
        array['product_id','display_name','flavour_label','size_value','size_unit','pack_count','product_format','is_active','is_default','gtin']
      )
      or (v_row->>'product_id') !~ '^[1-9][0-9]*$'
      or (v_row->>'variant_id') !~ '^[1-9][0-9]*$'
      or v_row->>'destination_field' not in ('products.gtin','product_variants.gtin')
      or jsonb_typeof(v_row->'single_trade_item') <> 'boolean'
      or (v_row->>'evidence_count') !~ '^[2-9][0-9]*$'
      or jsonb_typeof(v_row->'evidence_sources') <> 'array'
      or jsonb_array_length(v_row->'evidence_sources') <> (v_row->>'evidence_count')::integer
      or (select count(distinct value) from jsonb_array_elements_text(v_row->'evidence_sources')) <> (v_row->>'evidence_count')::integer
      or (v_row->>'candidate_fingerprint') !~ '^[0-9a-f]{64}$'
      or v_row->>'owner_decision' <> 'APPROVE_CANDIDATE' then
      raise exception 'invalid GTIN promotion row schema or evidence';
    end if;

    v_product_id := (v_row->>'product_id')::bigint;
    v_variant_id := (v_row->>'variant_id')::bigint;
    v_gtin := regexp_replace(v_row->>'gtin', '[[:space:]-]+', '', 'g');
    v_destination := v_row->>'destination_field';
    v_expected_current := nullif(v_row->>'expected_current_gtin', '');
    if not public.gtin_promotion_is_valid_gtin(v_gtin)
      or v_gtin is distinct from v_row->>'gtin' then
      raise exception 'invalid or non-normalized GTIN in promotion plan';
    end if;
    if v_expected_current is not null and v_expected_current <> v_gtin then
      raise exception 'GTIN promotion cannot overwrite a conflicting value';
    end if;
    if exists(select 1 from public.gtin_promotion_quarantine q where q.gtin=v_gtin) then
      raise exception 'quarantined GTIN cannot be promoted';
    end if;

    select * into v_product from public.products where id=v_product_id;
    select * into v_variant from public.product_variants where id=v_variant_id;
    if not found or v_product.id is null or not v_product.is_active
      or v_product.merged_into_product_id is not null
      or v_variant.product_id <> v_product_id or not v_variant.is_active then
      raise exception 'inactive, merged or mismatched GTIN promotion target';
    end if;

    v_expected_product := jsonb_build_object(
      'name',v_product.name,'brand',v_product.brand,'product_format',v_product.product_format,
      'is_active',v_product.is_active,'merged_into_product_id',v_product.merged_into_product_id::text,
      'gtin',v_product.gtin
    );
    v_expected_variant := jsonb_build_object(
      'product_id',v_variant.product_id::text,'display_name',v_variant.display_name,
      'flavour_label',v_variant.flavour_label,'size_value',v_variant.size_value::text,
      'size_unit',v_variant.size_unit,'pack_count',v_variant.pack_count::text,
      'product_format',v_variant.product_format,'is_active',v_variant.is_active,
      'is_default',v_variant.is_default,'gtin',v_variant.gtin
    );
    if v_expected_product is distinct from v_row->'expected_product'
      or v_expected_variant is distinct from v_row->'expected_variant' then
      raise exception 'stale GTIN promotion canonical identity';
    end if;

    if v_destination='products.gtin' then
      if v_row->'single_trade_item' <> 'true'::jsonb or not v_variant.is_default
        or (select count(*) from public.product_variants where product_id=v_product_id and is_active) <> 1 then
        raise exception 'product GTIN destination requires one explicit trade item';
      end if;
      v_actual_current := nullif(btrim(v_product.gtin), '');
    else
      if v_row->'single_trade_item' <> 'false'::jsonb then
        raise exception 'variant GTIN destination cannot claim product-level identity';
      end if;
      v_actual_current := nullif(btrim(v_variant.gtin), '');
    end if;
    if v_actual_current is distinct from v_expected_current then
      raise exception 'stale GTIN promotion destination value';
    end if;

    if exists(
      select 1 from public.products p
      where nullif(btrim(p.gtin),'')=v_gtin
        and not (v_destination='products.gtin' and p.id=v_product_id)
    ) or exists(
      select 1 from public.product_variants pv
      where nullif(btrim(pv.gtin),'')=v_gtin
        and not (v_destination='product_variants.gtin' and pv.id=v_variant_id)
    ) then
      raise exception 'GTIN already belongs to another canonical identity';
    end if;
  end loop;

  return jsonb_build_object('status','VALID','row_count','45','database_writes','0');
end;
$validate_gtin_promotion$;

create or replace function public.approve_gtin_promotion_plan(
  p_plan jsonb,
  p_artifact_sha256 text,
  p_run_id text,
  p_source text default 'supplementscout_gtin_promotion',
  p_expires_at timestamptz default (now() + interval '15 minutes')
) returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog, public, pg_temp
as $approve_gtin_promotion$
declare
  v_id uuid;
begin
  if p_artifact_sha256 !~ '^[0-9a-f]{64}$'
    or p_run_id !~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$'
    or nullif(trim(p_source),'') is null
    or p_expires_at <= now() or p_expires_at > now()+interval '24 hours' then
    raise exception 'invalid GTIN promotion approval metadata';
  end if;
  perform public.validate_gtin_promotion_plan_read_only(p_plan);
  insert into public.approved_import_plans(
    artifact_sha256,run_id,plan_fingerprint,source_row_fingerprint,
    plan_kind,retailer_id,expires_at,source,plan_json
  ) values (
    p_artifact_sha256,p_run_id,p_plan#>>'{meta,plan_fingerprint}',
    p_plan#>>'{meta,source_row_fingerprint}','gtin_promotion',null,
    p_expires_at,trim(p_source),p_plan
  ) returning id into v_id;
  return jsonb_build_object(
    'approval_id',v_id,'status','approved','artifact_sha256',p_artifact_sha256,
    'run_id',p_run_id,'plan_fingerprint',p_plan#>>'{meta,plan_fingerprint}',
    'source_row_fingerprint',p_plan#>>'{meta,source_row_fingerprint}',
    'plan_kind','gtin_promotion','expires_at',p_expires_at
  );
end;
$approve_gtin_promotion$;

create or replace function public.apply_approved_gtin_promotion_plan(
  p_approval_id uuid,
  p_artifact_sha256 text,
  p_plan_fingerprint text,
  p_source_row_fingerprint text,
  p_run_id text
) returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog, public, pg_temp
as $apply_gtin_promotion$
declare
  v_approval public.approved_import_plans%rowtype;
  v_row jsonb;
  v_count integer := 0;
  v_affected integer;
  v_consumed_at timestamptz;
  v_result jsonb;
  v_rows jsonb := '[]'::jsonb;
begin
  perform pg_advisory_xact_lock(hashtext('supplementscout:gtin-promotion'));
  select * into v_approval from public.approved_import_plans
  where id=p_approval_id for update;
  if not found then raise exception 'approved GTIN promotion plan not found'; end if;
  if v_approval.status <> 'approved' or v_approval.consumed_at is not null then
    raise exception 'approved GTIN promotion plan already consumed';
  end if;
  if v_approval.expires_at <= now() then raise exception 'approved GTIN promotion plan expired'; end if;
  if v_approval.plan_kind <> 'gtin_promotion' or v_approval.retailer_id is not null
    or v_approval.artifact_sha256 is distinct from p_artifact_sha256
    or v_approval.run_id is distinct from p_run_id
    or v_approval.plan_fingerprint is distinct from p_plan_fingerprint
    or v_approval.source_row_fingerprint is distinct from p_source_row_fingerprint
    or v_approval.plan_fingerprint is distinct from v_approval.plan_json#>>'{meta,plan_fingerprint}'
    or md5(public.atomic_import_canonical_json(
      jsonb_set(v_approval.plan_json,'{meta,plan_fingerprint}','null'::jsonb,false)
    )) <> v_approval.plan_fingerprint then
    raise exception 'approved GTIN promotion metadata or ledger integrity mismatch';
  end if;

  perform 1 from public.products p
  where p.id in (select (value->>'product_id')::bigint from jsonb_array_elements(v_approval.plan_json->'rows'))
  order by p.id for update;
  perform 1 from public.product_variants pv
  where pv.id in (select (value->>'variant_id')::bigint from jsonb_array_elements(v_approval.plan_json->'rows'))
  order by pv.id for update;
  perform public.validate_gtin_promotion_plan_read_only(v_approval.plan_json);

  for v_row in select value from jsonb_array_elements(v_approval.plan_json->'rows') loop
    if v_row->>'destination_field'='products.gtin' then
      update public.products set gtin=v_row->>'gtin'
      where id=(v_row->>'product_id')::bigint
        and gtin is not distinct from nullif(v_row->>'expected_current_gtin','');
    else
      update public.product_variants set gtin=v_row->>'gtin'
      where id=(v_row->>'variant_id')::bigint
        and product_id=(v_row->>'product_id')::bigint
        and gtin is not distinct from nullif(v_row->>'expected_current_gtin','');
    end if;
    get diagnostics v_affected = row_count;
    if v_affected <> 1 then raise exception 'GTIN promotion row changed after validation'; end if;
    v_count := v_count+1;
    v_rows := v_rows || jsonb_build_array(jsonb_build_object(
      'product_id',v_row->>'product_id','variant_id',v_row->>'variant_id',
      'destination_field',v_row->>'destination_field',
      'before',nullif(v_row->>'expected_current_gtin',''),'after',v_row->>'gtin',
      'candidate_fingerprint',v_row->>'candidate_fingerprint'
    ));
    if current_setting('app.gtin_promotion_test_failpoint',true)='after_first_row' and v_count=1 then
      raise exception 'GTIN promotion test failpoint after first row';
    end if;
  end loop;
  if v_count <> 45 then raise exception 'GTIN promotion applied unexpected row count'; end if;

  v_result := jsonb_build_object(
    'status','APPLIED','operation_type','GTIN_PROMOTION','applied_count',v_count::text,
    'rows',v_rows,'artifact_sha256',v_approval.artifact_sha256,
    'plan_fingerprint',v_approval.plan_fingerprint,
    'source_row_fingerprint',v_approval.source_row_fingerprint
  );
  update public.approved_import_plans
  set status='consumed',consumed_at=now(),apply_result=v_result
  where id=v_approval.id returning consumed_at into v_consumed_at;
  return v_result || jsonb_build_object(
    'approval_id',v_approval.id,'approval_status','consumed',
    'consumed_at',v_consumed_at,'run_id',v_approval.run_id
  );
end;
$apply_gtin_promotion$;

alter function public.gtin_promotion_is_valid_gtin(text) owner to postgres;
alter function public.validate_gtin_promotion_plan_read_only(jsonb) owner to postgres;
alter function public.approve_gtin_promotion_plan(jsonb,text,text,text,timestamptz) owner to postgres;
alter function public.apply_approved_gtin_promotion_plan(uuid,text,text,text,text) owner to postgres;

revoke all on function public.gtin_promotion_is_valid_gtin(text) from public,anon,authenticated,service_role;
revoke all on function public.validate_gtin_promotion_plan_read_only(jsonb) from public,anon,authenticated,service_role;
revoke all on function public.approve_gtin_promotion_plan(jsonb,text,text,text,timestamptz) from public,anon,authenticated,service_role;
revoke all on function public.apply_approved_gtin_promotion_plan(uuid,text,text,text,text) from public,anon,authenticated,service_role;

do $grant_gtin_promotion$
declare
  v_has_staging boolean := to_regrole('retailer_catalogue_staging_approver') is not null
    and to_regrole('retailer_catalogue_staging_executor') is not null;
  v_has_production boolean := to_regrole('retailer_catalogue_production_approver') is not null
    and to_regrole('retailer_catalogue_production_executor') is not null;
begin
  if v_has_staging = v_has_production then
    raise exception 'GTIN promotion requires exactly one complete staging or production role family';
  end if;
  if v_has_staging then
    grant execute on function public.approve_gtin_promotion_plan(jsonb,text,text,text,timestamptz)
      to retailer_catalogue_staging_approver;
    grant execute on function public.apply_approved_gtin_promotion_plan(uuid,text,text,text,text)
      to retailer_catalogue_staging_executor;
  else
    grant execute on function public.approve_gtin_promotion_plan(jsonb,text,text,text,timestamptz)
      to retailer_catalogue_production_approver;
    grant execute on function public.apply_approved_gtin_promotion_plan(uuid,text,text,text,text)
      to retailer_catalogue_production_executor;
  end if;
end;
$grant_gtin_promotion$;

commit;
