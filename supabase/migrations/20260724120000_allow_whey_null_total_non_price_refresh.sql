begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $preflight$
begin
  if to_regprocedure(
       'public.atomic_import_validate_standard_plan_core(jsonb)'
     ) is null
     or to_regprocedure(
       'public.validate_product_import_plan_read_only(jsonb)'
     ) is null then
    raise exception 'existing atomic importer validator contract is missing';
  end if;
end
$preflight$;

do $whey_non_price_refresh$
declare
  v_definition text := pg_get_functiondef(
    'public.atomic_import_validate_standard_plan_core(jsonb)'::regprocedure
  );
  v_original text := $anchor$    ) and (
      (p_plan#>>'{offer,values,shipping_cost}' is null) <>
       (p_plan#>>'{offer,values,total_price}' is null)$anchor$;
  v_replacement text := $anchor$    ) and not (
      p_plan#>>'{meta,operation_type}' = 'standard_import'
      and p_plan#>>'{retailer,id}' = '3'
      and v_offer_action = 'update'
      and v_history_action = 'noop'
      and p_plan#>>'{offer,values,shipping_cost}' is not null
      and p_plan#>>'{offer,values,total_price}' is null
      and p_plan#>>'{expected_state,offer,total_price}' is null
      and (p_plan#>>'{offer,values,price}')::numeric is not distinct from
        nullif(p_plan#>>'{expected_state,offer,price}','')::numeric
      and (p_plan#>>'{offer,values,shipping_cost}')::numeric is not distinct from
        nullif(p_plan#>>'{expected_state,offer,shipping_cost}','')::numeric
    ) and (
      (p_plan#>>'{offer,values,shipping_cost}' is null) <>
       (p_plan#>>'{offer,values,total_price}' is null)$anchor$;
begin
  if position(v_original in v_definition) = 0
     or position(
       'Whey Okay historical null-total non-price refresh' in v_definition
     ) > 0 then
    raise exception 'Whey Okay null-total validator anchor/state mismatch';
  end if;
  v_replacement := replace(
    v_replacement,
    'p_plan#>>''{meta,operation_type}'' = ''standard_import''',
    'p_plan#>>''{meta,operation_type}'' = ''standard_import'' /* Whey Okay historical null-total non-price refresh */'
  );
  execute replace(v_definition, v_original, v_replacement);
end
$whey_non_price_refresh$;

alter function public.atomic_import_validate_standard_plan_core(jsonb)
  owner to postgres;

do $postflight$
declare
  v_definition text := pg_get_functiondef(
    'public.atomic_import_validate_standard_plan_core(jsonb)'::regprocedure
  );
begin
  if position(
       'Whey Okay historical null-total non-price refresh' in v_definition
     ) = 0
     or position(
       'and p_plan#>>''{retailer,id}'' = ''3''' in v_definition
     ) = 0 then
    raise exception 'Whey Okay null-total validator verification failed';
  end if;
end
$postflight$;

commit;
