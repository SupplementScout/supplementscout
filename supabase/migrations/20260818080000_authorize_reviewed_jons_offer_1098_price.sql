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
    raise exception 'Jon''s reviewed offer 1098 authorization requires production database owner';
  end if;
  if exists(select 1 from public.retailer_offer_sync_reviewed_mixed_change_definitions
    where authorization_id='jons-1-dfb4624497699b00-production')
     or exists(select 1 from public.retailer_offer_sync_reviewed_mixed_change_bindings
    where authorization_id='jons-1-dfb4624497699b00-production') then
    raise exception 'Jon''s reviewed offer 1098 authorization already exists';
  end if;
end
$preflight$;

insert into public.retailer_offer_sync_reviewed_mixed_change_definitions(
  authorization_id,target_environment,retailer_id,reviewed_manifest_sha256,
  reviewed_source_fingerprint,reviewed_scope_hash,row_count,expected_deltas,
  authorized_by,contract_version
)
values(
  'jons-1-dfb4624497699b00-production','PRODUCTION',10,
  'dfb4624497699b00ae1d789df5d22d31464e404b025d36829c3a0e0e3036e86e',
  'c9431f5c3cf0091dbae3d574d6683c6bb1ebb01ea60d42e048aace0490e7b694',
  'e431297f792941134c4e836c56f1b552264bfeaab08aa5f77421975efc90d852',
  1,
  '{"row_count_deltas":{"products":0,"product_variants":0,"retailer_products":0,"offers":0,"price_history":1},"logical_field_deltas":{"offer_price_updates":1,"offer_shipping_updates":0,"offer_total_updates":1,"offer_stock_updates":0,"offer_url_updates":0,"mapping_url_updates":0,"mapping_updated_at_updates":0,"last_checked_at_updates":1}}'::jsonb,
  'owner-approved-chat-2026-08-18-offer-1098-price-9-99',1
);

do $support_validation$
declare
  v_function regprocedure:='public.retailer_offer_sync_validate_reviewed_mixed_change_internal(jsonb)'::regprocedure;
  v_definition text:=pg_get_functiondef(v_function);
  v_old text:=$old$elsif v_contract->>'authorization_id'='fit-house-1-f62ab94e89861f7f-production' then$old$;
  v_new text:=$new$elsif v_contract->>'authorization_id'='jons-1-dfb4624497699b00-production' then
    if (v_guardrails->>'source_product_count')::integer<=0
       or (v_guardrails->>'previous_source_product_count')::integer<=0
       or (v_guardrails->>'source_product_count')::numeric/(v_guardrails->>'previous_source_product_count')::numeric
          <(v_limits->>'minimum_source_count_ratio')::numeric
       or jsonb_array_length(v_artifact->'rows')<>1
       or (v_guardrails->>'required_source_rows')::integer<>1
       or (v_guardrails->>'matched_source_rows')::integer<>1
       or (v_guardrails->>'changed_row_count')::integer<>1
       or (v_guardrails->>'price_changed_row_count')::integer<>1
       or (v_guardrails->>'new_oos_count')::integer<>0
       or v_new_oos<>0
       or not exists(
         select 1 from jsonb_array_elements(v_artifact->'rows') row
         where row.value->>'offer_id'='1098'
           and row.value->>'retailer_product_id'='1284'
           and row.value->>'external_product_id'='10074965508434'
           and row.value->>'external_variant_id'='50781523575122'
           and row.value->>'action'='UPDATE_PRICE'
           and (row.value->'changed_fields'->>'price')::boolean
           and not (row.value->'changed_fields'->>'stock')::boolean
           and not (row.value->'changed_fields'->>'url')::boolean
           and not (row.value->'changed_fields'->>'blocked')::boolean
           and (row.value#>>'{atomic_plan,expected_state,offer,price}')::numeric=27.95
           and (row.value#>>'{atomic_plan,offer,values,price}')::numeric=9.99
           and (row.value#>>'{atomic_plan,expected_state,offer,in_stock}')::boolean
           and (row.value#>>'{atomic_plan,offer,values,in_stock}')::boolean
       ) then
      perform public.retailer_catalogue_raise('RSBI_EXPECTED_STATE_MISMATCH','Reviewed Jon''s offer 1098 price proof mismatch');
    end if;
  elsif v_contract->>'authorization_id'='fit-house-1-f62ab94e89861f7f-production' then$new$;
begin
  if position(v_old in v_definition)=0
     or position('Reviewed Jon''s offer 1098 price proof mismatch' in v_definition)>0 then
    raise exception 'Jon''s offer 1098 reviewed validation anchor mismatch';
  end if;
  execute replace(v_definition,v_old,v_new);
end
$support_validation$;

alter function public.retailer_offer_sync_validate_reviewed_mixed_change_internal(jsonb) owner to postgres;
revoke all on function public.retailer_offer_sync_validate_reviewed_mixed_change_internal(jsonb) from public,anon,authenticated,service_role;

commit;
