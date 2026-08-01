begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- The reviewed source control is consumed while building the closed plan and
-- is not a product-variant evidence key. Bind execution to the existing exact
-- 21-tuple allowlist instead of requiring that non-schema control key.
do $repair_reviewed_gym_high_helper$
declare
  v_definition text := pg_get_functiondef(
    'public.atomic_import_is_legacy_mapping_upgrade(jsonb)'::regprocedure
  );
  v_original text := $anchor$         and v_evidence->>'reviewed_gym_high_no_sku_identity' = 'true'
         and jsonb_typeof(v_values->'external_options') = 'object'$anchor$;
  v_replacement text := $anchor$         and jsonb_typeof(v_values->'external_options') = 'object'
         /* GYM HIGH reviewed exact-tuple control binding */$anchor$;
begin
  if v_definition is null
     or position(v_original in v_definition) = 0
     or position($$'1:1:1:632:632:559'$$ in v_definition) = 0
     or position($$'529:387:554:4623:4623:507'$$ in v_definition) = 0 then
    raise exception 'GYM HIGH exact legacy helper repair precondition failed';
  end if;
  execute replace(v_definition, v_original, v_replacement);
end;
$repair_reviewed_gym_high_helper$;

do $repair_reviewed_gym_high_total_guard$
declare
  v_definition text := pg_get_functiondef(
    'public.atomic_import_validate_standard_plan_core(jsonb)'::regprocedure
  );
  v_original text := $anchor$      and p_plan#>>'{product_variant,evidence,reviewed_gym_high_no_sku_identity}' = 'true'
      and v_offer_action in ('noop','identity_update')$anchor$;
  v_replacement text := $anchor$      and v_offer_action in ('noop','identity_update')
      /* GYM HIGH null-total guard bound by exact legacy helper */$anchor$;
begin
  if v_definition is null
     or position('GYM HIGH reviewed legacy null-total identity upgrade' in v_definition) = 0
     or position($$and v_history_action = 'noop'$$ in v_definition) = 0
     or position(v_original in v_definition) = 0 then
    raise exception 'GYM HIGH null-total guard repair precondition failed';
  end if;
  execute replace(v_definition, v_original, v_replacement);
end;
$repair_reviewed_gym_high_total_guard$;

alter function public.atomic_import_is_legacy_mapping_upgrade(jsonb) owner to postgres;
alter function public.atomic_import_validate_standard_plan_core(jsonb) owner to postgres;
revoke all on function public.atomic_import_is_legacy_mapping_upgrade(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.atomic_import_validate_standard_plan_core(jsonb)
  from public, anon, authenticated, service_role;

do $verify_reviewed_gym_high_control_binding$
declare
  v_helper text := pg_get_functiondef(
    'public.atomic_import_is_legacy_mapping_upgrade(jsonb)'::regprocedure
  );
  v_validator text := pg_get_functiondef(
    'public.atomic_import_validate_standard_plan_core(jsonb)'::regprocedure
  );
begin
  if position('GYM HIGH reviewed exact-tuple control binding' in v_helper) = 0
     or position($$'1:1:1:632:632:559'$$ in v_helper) = 0
     or position($$'529:387:554:4623:4623:507'$$ in v_helper) = 0
     or position($$v_evidence->>'reviewed_gym_high_no_sku_identity'$$ in v_helper) > 0
     or position('GYM HIGH null-total guard bound by exact legacy helper' in v_validator) = 0
     or position($$public.atomic_import_is_legacy_mapping_upgrade(p_plan)$$ in v_validator) = 0
     or position($$product_variant,evidence,reviewed_gym_high_no_sku_identity$$ in v_validator) > 0 then
    raise exception 'GYM HIGH exact legacy control binding verification failed';
  end if;
end;
$verify_reviewed_gym_high_control_binding$;

commit;
