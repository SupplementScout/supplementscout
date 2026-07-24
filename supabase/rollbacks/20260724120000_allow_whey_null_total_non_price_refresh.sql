begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $whey_non_price_refresh_rollback$
declare
  v_definition text := pg_get_functiondef(
    'public.atomic_import_validate_standard_plan_core(jsonb)'::regprocedure
  );
  v_extended text := $anchor$    ) and not (
      p_plan#>>'{meta,operation_type}' = 'standard_import' /* Whey Okay historical null-total non-price refresh */
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
  v_original text := $anchor$    ) and (
      (p_plan#>>'{offer,values,shipping_cost}' is null) <>
       (p_plan#>>'{offer,values,total_price}' is null)$anchor$;
begin
  if position(v_extended in v_definition) = 0 then
    raise exception 'Whey Okay null-total rollback anchor/state mismatch';
  end if;
  execute replace(v_definition, v_extended, v_original);
end
$whey_non_price_refresh_rollback$;

alter function public.atomic_import_validate_standard_plan_core(jsonb)
  owner to postgres;

commit;
