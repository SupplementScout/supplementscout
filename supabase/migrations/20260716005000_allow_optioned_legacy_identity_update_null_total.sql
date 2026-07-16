begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- Allow historical null-total Whey Okay optioned legacy upgrades to move only
-- retailer/offer identity from the default variant to the reviewed non-default
-- variant. The existing legacy upgrade helper remains the fail-closed guard for
-- unchanged offer business fields and exact variant identity.

do $patch_validate_identity_update_null_total$
declare
  v_fn text;
  v_old text;
  v_new text;
begin
  select pg_get_functiondef('public.validate_product_import_plan_read_only(jsonb)'::regprocedure)
    into v_fn;
  if v_fn is null then
    raise exception 'validate_product_import_plan_read_only(jsonb) is missing';
  end if;

  v_old := $$  if not (
      p_plan#>>'{meta,operation_type}' = 'legacy_mapping_upgrade'
      and v_offer_action = 'noop'
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
       (p_plan#>>'{offer,values,total_price}' is null)
      or (p_plan#>>'{offer,values,total_price}' is not null and
          (p_plan#>>'{offer,values,total_price}')::numeric is distinct from
          (p_plan#>>'{offer,values,price}')::numeric + (p_plan#>>'{offer,values,shipping_cost}')::numeric)
    ) then
    raise exception 'invalid product import plan: offer total';
  end if;$$;
  v_new := $$  if not (
      p_plan#>>'{meta,operation_type}' = 'legacy_mapping_upgrade'
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
    ) and (
      (p_plan#>>'{offer,values,shipping_cost}' is null) <>
       (p_plan#>>'{offer,values,total_price}' is null)
      or (p_plan#>>'{offer,values,total_price}' is not null and
          (p_plan#>>'{offer,values,total_price}')::numeric is distinct from
          (p_plan#>>'{offer,values,price}')::numeric + (p_plan#>>'{offer,values,shipping_cost}')::numeric)
    ) then
    raise exception 'invalid product import plan: offer total';
  end if;$$;
  if position(v_new in v_fn) = 0 then
    if position(v_old in v_fn) = 0 then
      raise exception 'validate_product_import_plan_read_only(jsonb) legacy identity_update null-total target not found';
    end if;
    v_fn := replace(v_fn, v_old, v_new);
  end if;

  execute v_fn;
end;
$patch_validate_identity_update_null_total$;

alter function public.validate_product_import_plan_read_only(jsonb) owner to postgres;
revoke all on function public.validate_product_import_plan_read_only(jsonb) from public, anon, authenticated, service_role;

commit;
