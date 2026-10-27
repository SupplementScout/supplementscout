begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- Clone the existing shared existing-offer registration boundary and freeze it
-- to Gladiator Nutrition's exact 603-row, existing-identity-only scope. This
-- migration creates no catalogue, offer, mapping, approval or price-history row.
do $clone_gladiator_registration$
declare
  v_definition text := pg_get_functiondef(
    'public.register_fit_house_offer_sync_control_plan(jsonb)'::regprocedure
  );
  v_count_anchor text := $anchor$  v_manifest_count := jsonb_array_length(v_manifest);$anchor$;
  v_count_replacement text := $anchor$  v_manifest_count := jsonb_array_length(v_manifest);
  if public.retailer_catalogue_sha256_json(v_manifest) is distinct from
     'f2e46baa948348ccd92535095ad6833ee2a4b3b7a11547335c580e7a1b07962a' then
    perform public.retailer_catalogue_raise(
      'RSBI_SOURCE_HASH_MISMATCH','Gladiator Nutrition approved scope fingerprint mismatch'
    );
  end if;
  /* Gladiator Nutrition frozen 603-offer existing-identity scope binding */$anchor$;
  v_validation_anchor text := $anchor$    perform public.retailer_offer_sync_validate_manifest(v_artifact);$anchor$;
  v_validation_replacement text := $anchor$    perform public.retailer_offer_sync_validate_manifest(v_artifact);
    perform public.retailer_catalogue_assert_migration_ledger(
      v_artifact->'expected_migration_versions',
      v_artifact->>'expected_migration_fingerprint'
    );$anchor$;
begin
  if v_definition is null
     or position(v_count_anchor in v_definition) = 0
     or position('a1e596f7707c851534e04e30d13f4289439449556787c572736e77b279c75292' in v_definition) = 0
     or position(v_validation_anchor in v_definition) = 0 then
    raise exception 'Gladiator Nutrition registration clone precondition failed';
  end if;

  v_definition := replace(v_definition,
    'register_fit_house_offer_sync_control_plan',
    'register_gladiator_nutrition_offer_sync_control_plan');
  v_definition := replace(v_definition, 'Fit House', 'Gladiator Nutrition');
  v_definition := replace(v_definition, 'fit-house', 'gladiator-nutrition');
  v_definition := replace(v_definition, 'fithouse.uk', 'gladiatornutrition.co.uk');
  v_definition := replace(v_definition,
    'a1e596f7707c851534e04e30d13f4289439449556787c572736e77b279c75292',
    'f07122185a4d601e9e4172378d2fcf6636e5ab1833c33c749f69bccd3fcd8078');
  v_definition := replace(v_definition, 'exactly 286', 'exactly 603');
  v_definition := replace(v_definition, '<> 286', '<> 603');
  v_definition := replace(v_definition, $$<> '9'$$, $$<> '15'$$);
  v_definition := replace(v_definition, 'where id=9 ', 'where id=15 ');
  v_definition := replace(v_definition, 'retailer_id <> 9', 'retailer_id <> 15');
  v_definition := replace(v_definition, 'retailer_id=9', 'retailer_id=15');
  v_definition := replace(v_definition, 'retailer-offer-sync:9:', 'retailer-offer-sync:15:');
  v_definition := replace(v_definition, $$'retailer_id','9'$$, $$'retailer_id','15'$$);
  v_definition := replace(v_definition, $$v_target||':9'$$, $$v_target||':15'$$);
  v_definition := replace(v_definition, 'v_parent_id,v_parent_fingerprint,9,v_target', 'v_parent_id,v_parent_fingerprint,15,v_target');
  v_definition := replace(v_definition, $$v_parent_id,9,v_target$$, $$v_parent_id,15,v_target$$);
  v_definition := replace(v_definition, v_count_anchor, v_count_replacement);
  v_definition := replace(v_definition, v_validation_anchor, v_validation_replacement);

  execute v_definition;
end;
$clone_gladiator_registration$;

alter function public.register_gladiator_nutrition_offer_sync_control_plan(jsonb)
  owner to postgres;
revoke all on function public.register_gladiator_nutrition_offer_sync_control_plan(jsonb)
  from public, anon, authenticated, service_role;

do $grant_gladiator_registration$
begin
  if to_regrole('retailer_catalogue_staging_validator') is not null then
    grant execute on function public.register_gladiator_nutrition_offer_sync_control_plan(jsonb)
      to retailer_catalogue_staging_validator;
  end if;
  if to_regrole('retailer_catalogue_production_validator') is not null then
    grant execute on function public.register_gladiator_nutrition_offer_sync_control_plan(jsonb)
      to retailer_catalogue_production_validator;
  end if;
end;
$grant_gladiator_registration$;

do $verify_gladiator_registration$
declare
  v_definition text := pg_get_functiondef(
    'public.register_gladiator_nutrition_offer_sync_control_plan(jsonb)'::regprocedure
  );
  v_owner text;
  v_security_definer boolean;
  v_volatility "char";
  v_config text[];
begin
  select owner.rolname, proc.prosecdef, proc.provolatile, proc.proconfig
  into v_owner, v_security_definer, v_volatility, v_config
  from pg_proc proc
  join pg_namespace namespace on namespace.oid=proc.pronamespace
  join pg_roles owner on owner.oid=proc.proowner
  where namespace.nspname='public'
    and proc.oid='public.register_gladiator_nutrition_offer_sync_control_plan(jsonb)'::regprocedure;

  if position('Gladiator Nutrition frozen 603-offer existing-identity scope binding' in v_definition) = 0
     or position('f2e46baa948348ccd92535095ad6833ee2a4b3b7a11547335c580e7a1b07962a' in v_definition) = 0
     or position('f07122185a4d601e9e4172378d2fcf6636e5ab1833c33c749f69bccd3fcd8078' in v_definition) = 0
     or position($$p_request->>'retailer_id' <> '15'$$ in v_definition) = 0
     or position($$p_request->>'retailer_slug' <> 'gladiator-nutrition'$$ in v_definition) = 0
     or position($$p_request->>'source_platform' <> 'SHOPIFY'$$ in v_definition) = 0
     or position($$lower(p_request->>'source_domain') <> 'gladiatornutrition.co.uk'$$ in v_definition) = 0
     or position('jsonb_array_length(v_manifest) <> 603' in v_definition) = 0
     or position('public.retailer_catalogue_assert_migration_ledger' in v_definition) = 0
     or v_owner <> 'postgres'
     or v_security_definer is distinct from true
     or v_volatility <> 'v'
     or v_config is distinct from array['search_path=pg_catalog, public, pg_temp']::text[]
     or has_function_privilege('public', 'public.register_gladiator_nutrition_offer_sync_control_plan(jsonb)', 'EXECUTE')
     or (to_regrole('anon') is not null and has_function_privilege('anon', 'public.register_gladiator_nutrition_offer_sync_control_plan(jsonb)', 'EXECUTE'))
     or (to_regrole('authenticated') is not null and has_function_privilege('authenticated', 'public.register_gladiator_nutrition_offer_sync_control_plan(jsonb)', 'EXECUTE'))
     or (to_regrole('service_role') is not null and has_function_privilege('service_role', 'public.register_gladiator_nutrition_offer_sync_control_plan(jsonb)', 'EXECUTE'))
     or (to_regrole('retailer_catalogue_staging_validator') is not null and not has_function_privilege('retailer_catalogue_staging_validator', 'public.register_gladiator_nutrition_offer_sync_control_plan(jsonb)', 'EXECUTE'))
     or (to_regrole('retailer_catalogue_production_validator') is not null and not has_function_privilege('retailer_catalogue_production_validator', 'public.register_gladiator_nutrition_offer_sync_control_plan(jsonb)', 'EXECUTE'))
     or (to_regrole('retailer_catalogue_staging_approver') is not null and has_function_privilege('retailer_catalogue_staging_approver', 'public.register_gladiator_nutrition_offer_sync_control_plan(jsonb)', 'EXECUTE'))
     or (to_regrole('retailer_catalogue_production_approver') is not null and has_function_privilege('retailer_catalogue_production_approver', 'public.register_gladiator_nutrition_offer_sync_control_plan(jsonb)', 'EXECUTE'))
     or (to_regrole('retailer_catalogue_staging_executor') is not null and has_function_privilege('retailer_catalogue_staging_executor', 'public.register_gladiator_nutrition_offer_sync_control_plan(jsonb)', 'EXECUTE'))
     or (to_regrole('retailer_catalogue_production_executor') is not null and has_function_privilege('retailer_catalogue_production_executor', 'public.register_gladiator_nutrition_offer_sync_control_plan(jsonb)', 'EXECUTE')) then
    raise exception 'Gladiator Nutrition registration verification failed';
  end if;
end;
$verify_gladiator_registration$;

commit;
