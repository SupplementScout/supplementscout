begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- Preserve historical GYM HIGH commerce values while the exact owner-reviewed
-- legacy identities are upgraded. The normal total-price invariant remains in
-- force for every other plan and for any price or shipping change.
do $patch_reviewed_gym_high_null_total$
declare
  v_definition text := pg_get_functiondef(
    'public.atomic_import_validate_standard_plan_core(jsonb)'::regprocedure
  );
  v_original text := $anchor$    ) and not (
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
    ) and ($anchor$;
  v_replacement text := $anchor$    ) and not (
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
    ) and not (
      p_plan#>>'{meta,operation_type}' = 'legacy_mapping_upgrade'
      and p_plan#>>'{retailer,id}' = '1'
      and p_plan#>>'{product_variant,evidence,reviewed_gym_high_no_sku_identity}' = 'true'
      and v_offer_action in ('noop','identity_update')
      and v_history_action = 'noop'
      and public.atomic_import_is_legacy_mapping_upgrade(p_plan)
      and p_plan#>>'{offer,values,shipping_cost}' is not null
      and p_plan#>>'{offer,values,total_price}' is null
      and p_plan#>>'{expected_state,offer,total_price}' is null
      and (p_plan#>>'{offer,values,price}')::numeric is not distinct from
        nullif(p_plan#>>'{expected_state,offer,price}','')::numeric
      and (p_plan#>>'{offer,values,shipping_cost}')::numeric is not distinct from
        nullif(p_plan#>>'{expected_state,offer,shipping_cost}','')::numeric
      /* GYM HIGH reviewed legacy null-total identity upgrade */
    ) and ($anchor$;
begin
  if v_definition is null then
    raise exception 'atomic importer standard validator is missing';
  end if;
  if position('GYM HIGH reviewed legacy null-total identity upgrade' in v_definition) > 0 then
    raise exception 'GYM HIGH null-total validator exception is already installed';
  end if;
  if position(v_original in v_definition) = 0
     or position(v_original in substring(v_definition from position(v_original in v_definition) + length(v_original))) > 0 then
    raise exception 'GYM HIGH null-total validator anchor mismatch';
  end if;
  execute replace(v_definition, v_original, v_replacement);
end;
$patch_reviewed_gym_high_null_total$;

alter function public.atomic_import_validate_standard_plan_core(jsonb) owner to postgres;
revoke all on function public.atomic_import_validate_standard_plan_core(jsonb)
  from public, anon, authenticated, service_role;

do $verify_reviewed_gym_high_null_total$
declare
  v_definition text := pg_get_functiondef(
    'public.atomic_import_validate_standard_plan_core(jsonb)'::regprocedure
  );
begin
  if position('GYM HIGH reviewed legacy null-total identity upgrade' in v_definition) = 0
     or position($$p_plan#>>'{retailer,id}' = '1'$$ in v_definition) = 0
     or position($$public.atomic_import_is_legacy_mapping_upgrade(p_plan)$$ in v_definition) = 0
     or position($$v_offer_action in ('noop','identity_update')$$ in v_definition) = 0 then
    raise exception 'GYM HIGH null-total validator verification failed';
  end if;
end;
$verify_reviewed_gym_high_null_total$;

commit;
