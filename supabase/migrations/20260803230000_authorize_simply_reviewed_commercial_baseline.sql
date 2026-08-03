begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $preflight$
declare
  v_target jsonb:=public.retailer_catalogue_actual_database_target();
begin
  if current_user<>'postgres'
     or v_target->>'target_environment'<>'PRODUCTION'
     or v_target->>'project_ref'<>'aftboxmrdgyhizicfsfu'
     or v_target->>'database_identity'<>'supplementscout-production:aftboxmrdgyhizicfsfu' then
    raise exception 'Simply reviewed commercial baseline requires production database owner';
  end if;
  if to_regprocedure('public.retailer_offer_sync_validate_reviewed_mixed_change_contract(jsonb,jsonb,timestamptz)') is null
     or to_regprocedure('public.retailer_offer_sync_validate_reviewed_mixed_change_contract_v3(jsonb,jsonb,timestamptz)') is not null
     or exists(
       select 1 from public.retailer_offer_sync_reviewed_mixed_change_definitions
       where authorization_id='simply-49-2bc798f9fb7db4af-production'
     ) then
    raise exception 'Simply reviewed commercial baseline precondition failed';
  end if;
end
$preflight$;

do $replace_contract_version_check$
begin
  if not exists(
    select 1 from pg_constraint
    where conrelid='public.retailer_offer_sync_reviewed_mixed_change_definitions'::regclass
      and conname='reviewed_mixed_change_contract_version_check'
  ) then
    raise exception 'reviewed mixed-change version constraint is missing';
  end if;
  alter table public.retailer_offer_sync_reviewed_mixed_change_definitions
    drop constraint reviewed_mixed_change_contract_version_check;
  if not exists(
    select 1 from pg_constraint
    where conrelid='public.retailer_offer_sync_reviewed_mixed_change_definitions'::regclass
      and conname='reviewed_mixed_change_v3_fields_check'
  ) then
    raise exception 'reviewed mixed-change v3 fields constraint is missing';
  end if;
  alter table public.retailer_offer_sync_reviewed_mixed_change_definitions
    drop constraint reviewed_mixed_change_v3_fields_check;
end
$replace_contract_version_check$;

alter table public.retailer_offer_sync_reviewed_mixed_change_definitions
  add constraint reviewed_mixed_change_contract_version_check
    check (contract_version in (1,2,3,4)),
  add constraint reviewed_mixed_change_v4_fields_check
    check (
      (contract_version in (1,2,4)
        and allowed_unmapped_collisions is null
        and allowed_unmapped_collisions_hash is null
        and unmapped_drift_policy is null)
      or
      (contract_version=3
        and jsonb_typeof(allowed_unmapped_collisions)='array'
        and allowed_unmapped_collisions_hash ~ '^[0-9a-f]{64}$'
        and unmapped_drift_policy='ALLOW_UNMAPPED_ADD_REMOVE_WITHOUT_NEW_MAPPED_IDENTITY_COLLISIONS')
    );

alter function public.retailer_offer_sync_validate_reviewed_mixed_change_contract(
  jsonb,jsonb,timestamptz
) rename to retailer_offer_sync_validate_reviewed_mixed_change_contract_v3;

create function public.retailer_offer_sync_validate_reviewed_commercial_change_v4(
  p_artifact jsonb,
  p_contract jsonb,
  p_validation_expires_at timestamptz
)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,pg_temp
as $commercial_v4$
declare
  v_definition public.retailer_offer_sync_reviewed_mixed_change_definitions%rowtype;
  v_row jsonb;
  v_reviewed_row jsonb;
  v_expected_action text;
  v_expected_row_delta jsonb;
  v_price_changed boolean;
  v_shipping_changed boolean;
  v_total_changed boolean;
  v_money_changed boolean;
  v_stock_changed boolean;
  v_url_changed boolean;
begin
  if not public.atomic_import_has_exact_keys(p_contract,array[
       'schema_version','kind','authorization_id','target_environment','retailer_id',
       'source_country','reviewed_manifest_sha256','reviewed_source_fingerprint',
       'reviewed_scope_hash','reviewed_rows','expected_deltas','source_captured_at',
       'expires_at','artifact_fingerprint','reviewed_contract_hash'])
     or p_contract->>'schema_version'<>'4'
     or p_contract->>'kind'<>'retailer-reviewed-commercial-change-v4'
     or p_contract->>'source_country'<>'GB'
     or jsonb_typeof(p_contract->'reviewed_rows') is distinct from 'array'
     or jsonb_typeof(p_contract->'expected_deltas') is distinct from 'object' then
    perform public.retailer_catalogue_raise('RSBI_SOURCE_SCHEMA_MISMATCH','Invalid reviewed commercial-change v4 contract');
  end if;

  select * into v_definition
  from public.retailer_offer_sync_reviewed_mixed_change_definitions
  where authorization_id=p_contract->>'authorization_id';
  if not found
     or v_definition.contract_version<>4
     or v_definition.target_environment is distinct from p_contract->>'target_environment'
     or v_definition.retailer_id::text is distinct from p_contract->>'retailer_id'
     or v_definition.reviewed_manifest_sha256 is distinct from p_contract->>'reviewed_manifest_sha256'
     or v_definition.reviewed_source_fingerprint is distinct from p_contract->>'reviewed_source_fingerprint'
     or v_definition.reviewed_scope_hash is distinct from p_contract->>'reviewed_scope_hash'
     or v_definition.row_count<>jsonb_array_length(p_contract->'reviewed_rows')
     or v_definition.expected_deltas is distinct from p_contract->'expected_deltas' then
    perform public.retailer_catalogue_raise('RSBI_APPROVAL_MISMATCH','Reviewed commercial-change v4 definition mismatch');
  end if;

  if p_contract->>'reviewed_scope_hash'!~'^[0-9a-f]{64}$'
     or public.retailer_catalogue_sha256_json(p_contract->'reviewed_rows') is distinct from p_contract->>'reviewed_scope_hash'
     or p_contract->>'reviewed_contract_hash'!~'^[0-9a-f]{64}$'
     or public.retailer_catalogue_sha256_json(p_contract-'reviewed_contract_hash') is distinct from p_contract->>'reviewed_contract_hash'
     or p_contract->>'target_environment' is distinct from p_artifact->>'target_environment'
     or p_contract->>'retailer_id' is distinct from p_artifact->>'retailer_id'
     or p_contract->>'reviewed_source_fingerprint' is distinct from p_artifact->>'source_snapshot_fingerprint'
     or (p_contract->>'source_captured_at')::timestamptz is distinct from (p_artifact->>'source_captured_at')::timestamptz
     or (p_contract->>'source_captured_at')::timestamptz<now()-interval '15 minutes'
     or (p_contract->>'source_captured_at')::timestamptz>now()+interval '5 minutes'
     or (p_contract->>'expires_at')::timestamptz is distinct from p_validation_expires_at
     or p_validation_expires_at<=now()
     or p_validation_expires_at>now()+interval '15 minutes'
     or p_contract->>'artifact_fingerprint' is distinct from p_artifact->>'artifact_fingerprint'
     or jsonb_array_length(p_artifact->'rows')<>v_definition.row_count
     or p_artifact->'expected_deltas' is distinct from v_definition.expected_deltas then
    perform public.retailer_catalogue_raise('RSBI_SOURCE_HASH_MISMATCH','Reviewed commercial-change v4 immutable binding mismatch');
  end if;

  if exists(
    select 1
    from jsonb_array_elements(p_contract->'reviewed_rows') with ordinality row(value,ordinality)
    left join lateral (
      select prior.value
      from jsonb_array_elements(p_contract->'reviewed_rows') with ordinality prior(value,ordinality)
      where prior.ordinality=row.ordinality-1
    ) prior on true
    where not public.atomic_import_has_exact_keys(row.value,array[
      'external_product_id','external_variant_id','action','changed_fields','before','after'])
      or jsonb_typeof(row.value->'changed_fields') is distinct from 'array'
      or not public.atomic_import_has_exact_keys(row.value->'before',array['price','shipping_cost','total_price','in_stock','url'])
      or not public.atomic_import_has_exact_keys(row.value->'after',array['price','shipping_cost','total_price','in_stock','url'])
      or (prior.value is not null and (
        (row.value->>'external_product_id')::numeric<(prior.value->>'external_product_id')::numeric
        or ((row.value->>'external_product_id')::numeric=(prior.value->>'external_product_id')::numeric
          and (row.value->>'external_variant_id')::numeric<=(prior.value->>'external_variant_id')::numeric)
      ))
  ) then
    perform public.retailer_catalogue_raise('RSBI_DUPLICATE_IDENTITY','Reviewed commercial-change v4 identity scope is invalid');
  end if;

  for v_row in select value from jsonb_array_elements(p_artifact->'rows') loop
    select value into v_reviewed_row
    from jsonb_array_elements(p_contract->'reviewed_rows')
    where value->>'external_product_id'=v_row->>'external_product_id'
      and value->>'external_variant_id'=v_row->>'external_variant_id';
    if not found then
      perform public.retailer_catalogue_raise('RSBI_APPROVAL_MISMATCH','Artifact row is outside reviewed commercial scope');
    end if;

    v_price_changed:=v_reviewed_row#>>'{before,price}' is distinct from v_reviewed_row#>>'{after,price}';
    v_shipping_changed:=v_reviewed_row#>>'{before,shipping_cost}' is distinct from v_reviewed_row#>>'{after,shipping_cost}';
    v_total_changed:=v_reviewed_row#>>'{before,total_price}' is distinct from v_reviewed_row#>>'{after,total_price}';
    v_money_changed:=v_price_changed or v_shipping_changed or v_total_changed;
    v_stock_changed:=(v_reviewed_row#>>'{before,in_stock}')::boolean is distinct from (v_reviewed_row#>>'{after,in_stock}')::boolean;
    v_url_changed:=v_reviewed_row#>>'{before,url}' is distinct from v_reviewed_row#>>'{after,url}';
    v_expected_action:=case
      when v_money_changed and v_stock_changed and v_url_changed then 'UPDATE_PRICE_STOCK_URL'
      when v_money_changed and v_stock_changed then 'UPDATE_PRICE_AND_STOCK'
      when v_money_changed then 'UPDATE_PRICE'
      when v_stock_changed then 'UPDATE_STOCK'
      when v_url_changed then 'UPDATE_URL'
      else null end;
    v_expected_row_delta:=jsonb_build_object(
      'row_count_deltas',jsonb_build_object(
        'products',0,'product_variants',0,'retailer_products',0,'offers',0,
        'price_history',case when v_money_changed then 1 else 0 end),
      'logical_field_deltas',jsonb_build_object(
        'offer_price_updates',case when v_price_changed then 1 else 0 end,
        'offer_shipping_updates',case when v_shipping_changed then 1 else 0 end,
        'offer_total_updates',case when v_total_changed then 1 else 0 end,
        'offer_stock_updates',case when v_stock_changed then 1 else 0 end,
        'offer_url_updates',case when v_url_changed then 1 else 0 end,
        'mapping_url_updates',case when v_url_changed then 1 else 0 end,
        'mapping_updated_at_updates',case when v_url_changed then 1 else 0 end,
        'last_checked_at_updates',1));

    if v_expected_action is null
       or v_row->>'action' is distinct from v_expected_action
       or (v_row->'changed_fields'->>'price')::boolean is distinct from v_money_changed
       or (v_row->'changed_fields'->>'stock')::boolean is distinct from v_stock_changed
       or (v_row->'changed_fields'->>'url')::boolean is distinct from v_url_changed
       or (v_row->'changed_fields'->>'blocked')::boolean is distinct from false
       or v_row->'expected_deltas' is distinct from v_expected_row_delta
       or v_row#>>'{atomic_plan,meta,operation_type}'<>'standard_import'
       or v_row#>>'{atomic_plan,product,action}'<>'existing'
       or v_row#>>'{atomic_plan,product_variant,action}'<>'existing'
       or v_row#>>'{atomic_plan,retailer,action}'<>'existing'
       or v_row#>>'{atomic_plan,retailer,id}' is distinct from v_definition.retailer_id::text
       or v_row#>>'{atomic_plan,retailer_product,action}' is distinct from (case when v_url_changed then 'update' else 'noop' end)
       or v_row#>>'{atomic_plan,retailer_product,id}' is distinct from v_row->>'retailer_product_id'
       or v_row#>>'{atomic_plan,offer,action}'<>'update'
       or v_row#>>'{atomic_plan,offer,id}' is distinct from v_row->>'offer_id'
       or v_row#>>'{atomic_plan,expected_state,offer,price}' is distinct from v_reviewed_row#>>'{before,price}'
       or v_row#>>'{atomic_plan,expected_state,offer,shipping_cost}' is distinct from v_reviewed_row#>>'{before,shipping_cost}'
       or v_row#>>'{atomic_plan,expected_state,offer,total_price}' is distinct from v_reviewed_row#>>'{before,total_price}'
       or (v_row#>>'{atomic_plan,expected_state,offer,in_stock}')::boolean is distinct from (v_reviewed_row#>>'{before,in_stock}')::boolean
       or v_row#>>'{atomic_plan,expected_state,offer,url}' is distinct from v_reviewed_row#>>'{before,url}'
       or v_row#>>'{atomic_plan,offer,values,price}' is distinct from v_reviewed_row#>>'{after,price}'
       or v_row#>>'{atomic_plan,offer,values,shipping_cost}' is distinct from v_reviewed_row#>>'{after,shipping_cost}'
       or v_row#>>'{atomic_plan,offer,values,total_price}' is distinct from v_reviewed_row#>>'{after,total_price}'
       or (v_row#>>'{atomic_plan,offer,values,in_stock}')::boolean is distinct from (v_reviewed_row#>>'{after,in_stock}')::boolean
       or v_row#>>'{atomic_plan,offer,values,url}' is distinct from v_reviewed_row#>>'{after,url}'
       or v_row#>>'{atomic_plan,retailer_product,values,external_url}' is distinct from v_row#>>'{atomic_plan,expected_state,retailer_product,external_url}'
       or v_row#>>'{atomic_plan,price_history,action}' is distinct from (case when v_money_changed then 'create' else 'noop' end)
       or v_row#>>'{atomic_plan,approval,approved}'<>'false'
       or v_row#>>'{atomic_plan,approval,approval_type}'<>'none' then
      perform public.retailer_catalogue_raise('RSBI_APPROVAL_MISMATCH','Reviewed commercial-change v4 row differs from approved values');
    end if;
  end loop;

  return jsonb_build_object(
    'valid',true,'authorization_id',v_definition.authorization_id,
    'reviewed_contract_hash',p_contract->>'reviewed_contract_hash',
    'reviewed_manifest_sha256',v_definition.reviewed_manifest_sha256,
    'row_count',v_definition.row_count,'contract_version',4);
end
$commercial_v4$;

create function public.retailer_offer_sync_validate_reviewed_mixed_change_contract(
  p_artifact jsonb,
  p_contract jsonb,
  p_validation_expires_at timestamptz
)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,pg_temp
as $dispatch_v4$
begin
  if p_contract->>'kind'='retailer-reviewed-commercial-change-v4' then
    return public.retailer_offer_sync_validate_reviewed_commercial_change_v4(
      p_artifact,p_contract,p_validation_expires_at);
  end if;
  return public.retailer_offer_sync_validate_reviewed_mixed_change_contract_v3(
    p_artifact,p_contract,p_validation_expires_at);
end
$dispatch_v4$;

insert into public.retailer_offer_sync_reviewed_mixed_change_definitions(
  authorization_id,target_environment,retailer_id,reviewed_manifest_sha256,
  reviewed_source_fingerprint,reviewed_scope_hash,row_count,expected_deltas,
  authorized_by,contract_version
)
values(
  'simply-49-2bc798f9fb7db4af-production','PRODUCTION',7,
  '2bc798f9fb7db4af8ff248f5d4b702b6bb0b5b91d85425afa9a842c9baa0f0e7',
  'a9992d8e824d79a1ce32e82678b5bcf75c1cd0769720f9bfb0ef880818e4a520',
  '9d54826e215388fe90b31d5a65d5947b1755abb32f3dd6a167886324172bc971',
  49,
  '{
    "row_count_deltas":{"products":0,"product_variants":0,"retailer_products":0,"offers":0,"price_history":43},
    "logical_field_deltas":{"offer_price_updates":43,"offer_shipping_updates":6,"offer_total_updates":43,"offer_stock_updates":6,"offer_url_updates":0,"mapping_url_updates":0,"mapping_updated_at_updates":0,"last_checked_at_updates":49}
  }'::jsonb,
  'owner-approved-chat-2026-08-03-manifest-b44c99f8',4
);

alter function public.retailer_offer_sync_validate_reviewed_mixed_change_contract_v3(jsonb,jsonb,timestamptz) owner to postgres;
alter function public.retailer_offer_sync_validate_reviewed_commercial_change_v4(jsonb,jsonb,timestamptz) owner to postgres;
alter function public.retailer_offer_sync_validate_reviewed_mixed_change_contract(jsonb,jsonb,timestamptz) owner to postgres;
revoke all on function public.retailer_offer_sync_validate_reviewed_mixed_change_contract_v3(jsonb,jsonb,timestamptz) from public,anon,authenticated,service_role;
revoke all on function public.retailer_offer_sync_validate_reviewed_commercial_change_v4(jsonb,jsonb,timestamptz) from public,anon,authenticated,service_role;
revoke all on function public.retailer_offer_sync_validate_reviewed_mixed_change_contract(jsonb,jsonb,timestamptz) from public,anon,authenticated,service_role;

commit;
