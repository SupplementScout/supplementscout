begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $preflight$
begin
  if to_regprocedure('public.atomic_import_has_exact_keys(jsonb,text[])') is null
     or to_regprocedure('public.retailer_catalogue_sha256_json(jsonb)') is null
     or to_regprocedure('public.retailer_catalogue_actual_database_target()') is null then
    raise exception 'reviewed variant nutrition apply requires the existing catalogue control plane';
  end if;
  if to_regclass('public.product_variant_nutrition_reviewed_applications') is not null
     or to_regprocedure('public.apply_reviewed_product_variant_nutrition(jsonb,boolean)') is not null then
    raise exception 'reviewed variant nutrition apply is already installed; rerun rejected';
  end if;
end
$preflight$;

create table public.product_variant_nutrition_reviewed_applications (
  authorization_id text primary key,
  target_environment text not null check (target_environment in ('STAGING','PRODUCTION')),
  reviewed_manifest_sha256 text not null check (reviewed_manifest_sha256 ~ '^[0-9a-f]{64}$'),
  reviewed_scope_hash text not null check (reviewed_scope_hash ~ '^[0-9a-f]{64}$'),
  reviewed_contract_hash text not null unique check (reviewed_contract_hash ~ '^[0-9a-f]{64}$'),
  row_count integer not null check (row_count between 1 and 100),
  contract jsonb not null check (jsonb_typeof(contract) = 'object'),
  authorized_by text not null check (length(trim(authorized_by)) between 1 and 200),
  authorized_at timestamptz not null,
  applied_by text not null,
  applied_at timestamptz not null default now()
);

alter table public.product_variant_nutrition_reviewed_applications owner to postgres;
alter table public.product_variant_nutrition_reviewed_applications enable row level security;
alter table public.product_variant_nutrition_reviewed_applications force row level security;
revoke all on table public.product_variant_nutrition_reviewed_applications
from public, anon, authenticated, service_role;

create or replace function public.apply_reviewed_product_variant_nutrition(
  p_contract jsonb,
  p_dry_run boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $apply$
declare
  v_actual_environment text;
  v_change jsonb;
  v_previous_change jsonb;
  v_variant public.product_variants%rowtype;
  v_row_count integer;
  v_before_count integer := 0;
  v_after_count integer := 0;
  v_updated_count integer := 0;
  v_existing public.product_variant_nutrition_reviewed_applications%rowtype;
begin
  if not public.atomic_import_has_exact_keys(p_contract, array[
       'schema_version','kind','authorization_id','target_environment',
       'reviewed_manifest_sha256','reviewed_scope_hash','reviewed_contract_hash',
       'authorized_by','authorized_at','changes'])
     or p_contract->>'schema_version' <> '1'
     or p_contract->>'kind' <> 'reviewed-product-variant-nutrition-v1'
     or jsonb_typeof(p_contract->'changes') is distinct from 'array'
     or jsonb_array_length(p_contract->'changes') not between 1 and 100
     or p_contract->>'authorization_id' !~ '^[a-z0-9][a-z0-9._:-]{7,199}$'
     or p_contract->>'target_environment' not in ('STAGING','PRODUCTION')
     or p_contract->>'reviewed_manifest_sha256' !~ '^[0-9a-f]{64}$'
     or p_contract->>'reviewed_scope_hash' !~ '^[0-9a-f]{64}$'
     or p_contract->>'reviewed_contract_hash' !~ '^[0-9a-f]{64}$'
     or length(trim(coalesce(p_contract->>'authorized_by',''))) not between 1 and 200
     or (p_contract->>'authorized_at')::timestamptz > now() + interval '5 minutes' then
    raise exception 'PVN_SOURCE_SCHEMA_MISMATCH: invalid reviewed nutrition contract';
  end if;

  if public.retailer_catalogue_sha256_json(p_contract->'changes')
       is distinct from p_contract->>'reviewed_scope_hash'
     or public.retailer_catalogue_sha256_json(p_contract-'reviewed_contract_hash')
       is distinct from p_contract->>'reviewed_contract_hash' then
    raise exception 'PVN_SOURCE_HASH_MISMATCH: immutable contract hash mismatch';
  end if;

  v_actual_environment :=
    public.retailer_catalogue_actual_database_target()->>'target_environment';
  if v_actual_environment is distinct from p_contract->>'target_environment' then
    raise exception 'PVN_ENVIRONMENT_BLOCKED: trusted database target mismatch';
  end if;

  select * into v_existing
  from public.product_variant_nutrition_reviewed_applications
  where authorization_id = p_contract->>'authorization_id';
  if found then
    if v_existing.target_environment is distinct from p_contract->>'target_environment'
       or v_existing.reviewed_manifest_sha256 is distinct from p_contract->>'reviewed_manifest_sha256'
       or v_existing.reviewed_scope_hash is distinct from p_contract->>'reviewed_scope_hash'
       or v_existing.reviewed_contract_hash is distinct from p_contract->>'reviewed_contract_hash'
       or v_existing.row_count <> jsonb_array_length(p_contract->'changes')
       or v_existing.contract is distinct from p_contract then
      raise exception 'PVN_APPROVAL_MISMATCH: authorization ID is bound to another contract';
    end if;
  end if;

  for v_change in
    select value
    from jsonb_array_elements(p_contract->'changes')
    with ordinality rows(value, ordinality)
    order by ordinality
  loop
    if not public.atomic_import_has_exact_keys(v_change, array[
         'product_id','expected_product_name','variant_id','expected_variant_key',
         'expected_display_name','before_nutrition_override','after_nutrition_override',
         'source_url','evidence'])
       or v_change->>'product_id' !~ '^[1-9][0-9]*$'
       or v_change->>'variant_id' !~ '^[1-9][0-9]*$'
       or length(trim(coalesce(v_change->>'expected_product_name',''))) = 0
       or length(trim(coalesce(v_change->>'expected_variant_key',''))) = 0
       or length(trim(coalesce(v_change->>'expected_display_name',''))) = 0
       or jsonb_typeof(v_change->'before_nutrition_override') is distinct from 'object'
       or jsonb_typeof(v_change->'after_nutrition_override') is distinct from 'object'
       or v_change->>'source_url' !~ '^https://'
       or length(trim(coalesce(v_change->>'evidence',''))) < 20
       or not public.atomic_import_has_exact_keys(
         v_change->'after_nutrition_override',
         array[
           'net_weight_g','serving_count_verified','serving_size_g',
           'protein_per_serving_g','creatine_per_serving_g','product_format',
           'unit_pricing_verified','nutrition_verified','source_url',
           'source_type','evidence'
         ])
       or jsonb_typeof(v_change#>'{after_nutrition_override,net_weight_g}')
            is distinct from 'number'
       or jsonb_typeof(v_change#>'{after_nutrition_override,serving_count_verified}')
            is distinct from 'number'
       or jsonb_typeof(v_change#>'{after_nutrition_override,serving_size_g}')
            is distinct from 'number'
       or jsonb_typeof(v_change#>'{after_nutrition_override,protein_per_serving_g}')
            not in ('number','null')
       or jsonb_typeof(v_change#>'{after_nutrition_override,creatine_per_serving_g}')
            not in ('number','null')
       or jsonb_typeof(v_change#>'{after_nutrition_override,unit_pricing_verified}')
            is distinct from 'boolean'
       or jsonb_typeof(v_change#>'{after_nutrition_override,nutrition_verified}')
            is distinct from 'boolean'
       or v_change#>>'{after_nutrition_override,source_url}' is distinct from v_change->>'source_url'
       or v_change#>>'{after_nutrition_override,evidence}' is distinct from v_change->>'evidence'
       or v_change#>>'{after_nutrition_override,source_type}' <> 'manufacturer_product_page'
       or (v_change#>>'{after_nutrition_override,net_weight_g}')::numeric <= 0
       or (v_change#>>'{after_nutrition_override,serving_count_verified}')::numeric <= 0
       or (v_change#>>'{after_nutrition_override,serving_count_verified}')::numeric
            <> trunc((v_change#>>'{after_nutrition_override,serving_count_verified}')::numeric)
       or (v_change#>>'{after_nutrition_override,serving_size_g}')::numeric <= 0
       or abs(
            (v_change#>>'{after_nutrition_override,net_weight_g}')::numeric
            - (
              (v_change#>>'{after_nutrition_override,serving_count_verified}')::numeric
              * (v_change#>>'{after_nutrition_override,serving_size_g}')::numeric
            )
          ) > (v_change#>>'{after_nutrition_override,serving_size_g}')::numeric
       or coalesce((v_change#>>'{after_nutrition_override,protein_per_serving_g}')::numeric,0) < 0
       or coalesce((v_change#>>'{after_nutrition_override,creatine_per_serving_g}')::numeric,0) < 0
       or greatest(
            coalesce((v_change#>>'{after_nutrition_override,protein_per_serving_g}')::numeric,0),
            coalesce((v_change#>>'{after_nutrition_override,creatine_per_serving_g}')::numeric,0)
          ) > (v_change#>>'{after_nutrition_override,serving_size_g}')::numeric
       or (
         coalesce((v_change#>>'{after_nutrition_override,protein_per_serving_g}')::numeric,0) = 0
         and coalesce((v_change#>>'{after_nutrition_override,creatine_per_serving_g}')::numeric,0) = 0
       )
       or v_change#>>'{after_nutrition_override,product_format}' <> 'powder'
       or (v_change#>>'{after_nutrition_override,unit_pricing_verified}')::boolean is not true
       or (v_change#>>'{after_nutrition_override,nutrition_verified}')::boolean is not true then
      raise exception 'PVN_SOURCE_SCHEMA_MISMATCH: invalid reviewed nutrition row';
    end if;

    if v_previous_change is not null
       and (v_change->>'variant_id')::bigint
            <= (v_previous_change->>'variant_id')::bigint then
      raise exception 'PVN_DUPLICATE_IDENTITY: variant rows must be unique and sorted';
    end if;
    v_previous_change := v_change;

    if p_dry_run then
      select v.* into v_variant
      from public.product_variants v
      join public.products p on p.id = v.product_id
      where v.id = (v_change->>'variant_id')::bigint
        and p.id = (v_change->>'product_id')::bigint
        and p.name = v_change->>'expected_product_name'
        and v.variant_key = v_change->>'expected_variant_key'
        and v.display_name = v_change->>'expected_display_name'
        and v.is_active
        and p.is_active
        and p.merged_into_product_id is null
        and p.merged_at is null;
    else
      select v.* into v_variant
      from public.product_variants v
      join public.products p on p.id = v.product_id
      where v.id = (v_change->>'variant_id')::bigint
        and p.id = (v_change->>'product_id')::bigint
        and p.name = v_change->>'expected_product_name'
        and v.variant_key = v_change->>'expected_variant_key'
        and v.display_name = v_change->>'expected_display_name'
        and v.is_active
        and p.is_active
        and p.merged_into_product_id is null
        and p.merged_at is null
      for update of v;
    end if;
    if not found then
      raise exception 'PVN_IDENTITY_DRIFT: reviewed product or variant identity mismatch';
    end if;

    if v_variant.nutrition_override = v_change->'before_nutrition_override' then
      v_before_count := v_before_count + 1;
    elsif v_variant.nutrition_override = v_change->'after_nutrition_override' then
      v_after_count := v_after_count + 1;
    else
      raise exception 'PVN_STATE_DRIFT: nutrition override differs from reviewed before and after';
    end if;
  end loop;

  v_row_count := jsonb_array_length(p_contract->'changes');
  if v_before_count > 0 and v_after_count > 0 then
    raise exception 'PVN_PARTIAL_APPLY: mixed before and after state rejected';
  end if;
  if v_existing.authorization_id is not null and v_after_count <> v_row_count then
    raise exception 'PVN_LEDGER_DRIFT: applied ledger does not match current variant state';
  end if;
  if v_existing.authorization_id is null and v_after_count = v_row_count then
    raise exception 'PVN_UNRECORDED_APPLY: after state exists without application ledger';
  end if;

  if p_dry_run then
    return jsonb_build_object(
      'status',case
        when v_existing.authorization_id is not null then 'ALREADY_APPLIED'
        else 'READY'
      end,
      'mode','dry-run',
      'target_environment',v_actual_environment,
      'authorization_id',p_contract->>'authorization_id',
      'row_count',v_row_count,
      'business_writes',0,
      'control_plane_writes',0
    );
  end if;

  if v_existing.authorization_id is not null then
    return jsonb_build_object(
      'status','ALREADY_APPLIED',
      'mode','apply',
      'target_environment',v_actual_environment,
      'authorization_id',p_contract->>'authorization_id',
      'row_count',v_row_count,
      'business_writes',0,
      'control_plane_writes',0
    );
  end if;

  with reviewed as (
    select value
    from jsonb_array_elements(p_contract->'changes')
  )
  update public.product_variants v
  set nutrition_override = reviewed.value->'after_nutrition_override'
  from reviewed
  where v.id = (reviewed.value->>'variant_id')::bigint
    and v.product_id = (reviewed.value->>'product_id')::bigint
    and v.nutrition_override = reviewed.value->'before_nutrition_override';
  get diagnostics v_updated_count = row_count;
  if v_updated_count <> v_row_count then
    raise exception 'PVN_ATOMIC_WRITE_MISMATCH: updated row count differs from reviewed scope';
  end if;

  insert into public.product_variant_nutrition_reviewed_applications(
    authorization_id,target_environment,reviewed_manifest_sha256,
    reviewed_scope_hash,reviewed_contract_hash,row_count,contract,
    authorized_by,authorized_at,applied_by
  ) values (
    p_contract->>'authorization_id',v_actual_environment,
    p_contract->>'reviewed_manifest_sha256',
    p_contract->>'reviewed_scope_hash',
    p_contract->>'reviewed_contract_hash',
    v_row_count,p_contract,p_contract->>'authorized_by',
    (p_contract->>'authorized_at')::timestamptz,current_user
  );

  return jsonb_build_object(
    'status','APPLIED',
    'mode','apply',
    'target_environment',v_actual_environment,
    'authorization_id',p_contract->>'authorization_id',
    'row_count',v_row_count,
    'business_writes',v_updated_count,
    'control_plane_writes',1
  );
end
$apply$;

alter function public.apply_reviewed_product_variant_nutrition(jsonb,boolean)
owner to postgres;
revoke all on function public.apply_reviewed_product_variant_nutrition(jsonb,boolean)
from public, anon, authenticated, service_role;
grant execute on function public.apply_reviewed_product_variant_nutrition(jsonb,boolean)
to postgres;

commit;
