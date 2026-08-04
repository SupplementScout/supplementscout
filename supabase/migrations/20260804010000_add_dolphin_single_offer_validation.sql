begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- Clone the established read-only validator, widen percentage-only limits for
-- one exact pre-approved Dolphin row, and leave the global validator untouched.
do $clone_dolphin_validator$
declare
  v_definition text := pg_get_functiondef(
    'public.retailer_offer_sync_validate_batch_read_only_unreviewed_internal(jsonb)'::regprocedure
  );
  v_begin_anchor text := E'begin\n  if not public.atomic_import_has_exact_keys';
  v_begin_replacement text := E'begin\n  if p_request#>>''{artifact,target_environment}'' <> ''PRODUCTION''\n'
    || E'     or p_request#>>''{artifact,retailer_id}'' <> ''5''\n'
    || E'     or jsonb_array_length(p_request#>''{artifact,rows}'') <> 1\n'
    || E'     or p_request#>>''{artifact,rows,0,offer_id}'' <> ''2490''\n'
    || E'     or p_request#>>''{artifact,rows,0,retailer_product_id}'' <> ''2676''\n'
    || E'     or p_request#>>''{artifact,rows,0,external_product_id}'' <> ''193943''\n'
    || E'     or p_request#>>''{artifact,rows,0,external_variant_id}'' <> ''193943-VANILLA''\n'
    || E'     or p_request#>>''{artifact,rows,0,atomic_plan,product,action}'' <> ''existing''\n'
    || E'     or p_request#>>''{artifact,rows,0,atomic_plan,product_variant,action}'' <> ''existing''\n'
    || E'     or p_request#>>''{artifact,rows,0,atomic_plan,retailer,action}'' <> ''existing''\n'
    || E'     or p_request#>>''{artifact,rows,0,atomic_plan,retailer,id}'' <> ''5''\n'
    || E'     or p_request#>>''{artifact,rows,0,atomic_plan,retailer_product,id}'' <> ''2676''\n'
    || E'     or p_request#>>''{artifact,rows,0,atomic_plan,retailer_product,action}'' <> ''noop''\n'
    || E'     or p_request#>>''{artifact,rows,0,atomic_plan,offer,id}'' <> ''2490''\n'
    || E'     or p_request#>>''{artifact,rows,0,atomic_plan,offer,action}'' not in (''update'',''verify_no_change'')\n'
    || E'     or p_request#>>''{artifact,rows,0,atomic_plan,price_history,action}'' not in (''create'',''noop'') then\n'
    || E'    perform public.retailer_catalogue_raise(''RSBI_ENVIRONMENT_BLOCKED'',''Dolphin singleton validator scope mismatch'');\n'
    || E'  end if;\n  /* Dolphin exact singleton validation scope */\n  if not public.atomic_import_has_exact_keys';
begin
  if v_definition is null
     or position(v_begin_anchor in v_definition) = 0
     or position('v_maximum_changed not between 0 and 0.25' in v_definition) = 0
     or position('v_mass_price_ratio>0.20' in v_definition) = 0 then
    raise exception 'Dolphin singleton validator clone precondition failed';
  end if;

  v_definition := replace(v_definition,
    'retailer_offer_sync_validate_batch_read_only_unreviewed_internal',
    'retailer_offer_sync_validate_dolphin_singleton_internal');
  v_definition := replace(v_definition, v_begin_anchor, v_begin_replacement);
  v_definition := replace(v_definition,
    'v_maximum_oos_increase not between 0 and 0.15',
    'v_maximum_oos_increase not between 0 and 1');
  v_definition := replace(v_definition,
    'v_maximum_total_oos not between 0 and 0.35',
    'v_maximum_total_oos not between 0 and 1');
  v_definition := replace(v_definition,
    'v_maximum_changed not between 0 and 0.25',
    'v_maximum_changed not between 0 and 1');
  v_definition := replace(v_definition,
    'v_mass_price_ratio<=0 or v_mass_price_ratio>0.20',
    'v_mass_price_ratio<=0 or v_mass_price_ratio>2');

  execute v_definition;
end;
$clone_dolphin_validator$;

create or replace function public.retailer_offer_sync_validate_batch_read_only_internal(p_request jsonb)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public,pg_temp as $dispatch$
begin
  if p_request#>>'{artifact,target_environment}'='PRODUCTION'
     and p_request#>>'{artifact,retailer_id}'='5' then
    return public.retailer_offer_sync_validate_dolphin_singleton_internal(p_request);
  end if;
  if p_request ? 'reviewed_mixed_change_contract' then
    return public.retailer_offer_sync_validate_reviewed_mixed_change_internal(p_request);
  end if;
  return public.retailer_offer_sync_validate_before_reviewed_mixed(p_request);
end
$dispatch$;

alter function public.retailer_offer_sync_validate_dolphin_singleton_internal(jsonb) owner to postgres;
revoke all on function public.retailer_offer_sync_validate_dolphin_singleton_internal(jsonb)
  from public, anon, authenticated, service_role;

do $verify_dolphin_validator$
declare
  v_definition text := pg_get_functiondef(
    'public.retailer_offer_sync_validate_dolphin_singleton_internal(jsonb)'::regprocedure
  );
begin
  if position('Dolphin exact singleton validation scope' in v_definition)=0
     or position($$offer_id}' <> '2490'$$ in v_definition)=0
     or position($$retailer_product_id}' <> '2676'$$ in v_definition)=0
     or position($$external_variant_id}' <> '193943-VANILLA'$$ in v_definition)=0
     or position('v_maximum_changed not between 0 and 1' in v_definition)=0
     or position('v_mass_price_ratio > 2' in v_definition)=0 then
    raise exception 'Dolphin singleton validator verification failed';
  end if;
end;
$verify_dolphin_validator$;

commit;
