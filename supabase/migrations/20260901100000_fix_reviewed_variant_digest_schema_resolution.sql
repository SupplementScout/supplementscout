begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $preflight$
declare
  v_target jsonb;
  v_definition text;
  v_unqualified_count integer;
  v_qualified_count integer;
  v_owner text;
  v_security_definer boolean;
  v_search_path text[];
begin
  if current_user <> 'postgres' then
    raise exception 'reviewed variant digest repair requires database owner postgres';
  end if;
  v_target := public.retailer_catalogue_actual_database_target();
  if v_target->>'target_environment' <> 'PRODUCTION'
     or v_target->>'project_ref' <> 'aftboxmrdgyhizicfsfu'
     or v_target->>'database_identity' <> 'supplementscout-production:aftboxmrdgyhizicfsfu' then
    raise exception 'reviewed variant digest repair requires the exact production target';
  end if;
  if to_regprocedure('public.validate_reviewed_variant_create_rebind_offer_update_plan(jsonb)') is null
     or to_regprocedure('extensions.digest(text,text)') is null then
    raise exception 'reviewed variant digest repair requires the active validator and extensions.digest(text,text)';
  end if;

  select pg_get_functiondef(p.oid),r.rolname,p.prosecdef,p.proconfig
    into v_definition,v_owner,v_security_definer,v_search_path
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  join pg_roles r on r.oid=p.proowner
  where p.oid='public.validate_reviewed_variant_create_rebind_offer_update_plan(jsonb)'::regprocedure;
  select count(*) into v_unqualified_count
  from regexp_matches(v_definition,'(^|[^A-Za-z0-9_.])digest\s*\(','g');
  select count(*) into v_qualified_count
  from regexp_matches(v_definition,'extensions\.digest\s*\(','g');

  if v_definition is null
     or v_owner <> 'postgres'
     or not v_security_definer
     or v_search_path is distinct from array['search_path=pg_catalog, public, pg_temp']
     or v_unqualified_count <> 4
     or v_qualified_count <> 0 then
    raise exception 'reviewed variant digest repair active definition preflight mismatch';
  end if;
end
$preflight$;

do $replace$
declare
  v_definition text;
begin
  select pg_get_functiondef('public.validate_reviewed_variant_create_rebind_offer_update_plan(jsonb)'::regprocedure)
    into v_definition;
  v_definition := replace(v_definition,'digest(', 'extensions.digest(');
  execute v_definition;
end
$replace$;

alter function public.validate_reviewed_variant_create_rebind_offer_update_plan(jsonb) owner to postgres;
revoke all on function public.validate_reviewed_variant_create_rebind_offer_update_plan(jsonb)
  from public,anon,authenticated,service_role;

do $postflight$
declare
  v_definition text;
  v_unqualified_count integer;
  v_qualified_count integer;
  v_owner text;
  v_security_definer boolean;
  v_search_path text[];
begin
  select pg_get_functiondef(p.oid),r.rolname,p.prosecdef,p.proconfig
    into v_definition,v_owner,v_security_definer,v_search_path
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  join pg_roles r on r.oid=p.proowner
  where p.oid='public.validate_reviewed_variant_create_rebind_offer_update_plan(jsonb)'::regprocedure;
  select count(*) into v_unqualified_count
  from regexp_matches(v_definition,'(^|[^A-Za-z0-9_.])digest\s*\(','g');
  select count(*) into v_qualified_count
  from regexp_matches(v_definition,'extensions\.digest\s*\(','g');

  if v_owner <> 'postgres'
     or not v_security_definer
     or v_search_path is distinct from array['search_path=pg_catalog, public, pg_temp']
     or v_unqualified_count <> 0
     or v_qualified_count <> 4
     or has_function_privilege('public','public.validate_reviewed_variant_create_rebind_offer_update_plan(jsonb)','execute')
     or has_function_privilege('anon','public.validate_reviewed_variant_create_rebind_offer_update_plan(jsonb)','execute')
     or has_function_privilege('authenticated','public.validate_reviewed_variant_create_rebind_offer_update_plan(jsonb)','execute')
     or has_function_privilege('service_role','public.validate_reviewed_variant_create_rebind_offer_update_plan(jsonb)','execute')
     or not has_function_privilege('service_role','public.apply_approved_product_import_plan(uuid,text,text,text,bigint,text,text)','execute')
     or has_function_privilege('anon','public.apply_approved_product_import_plan(uuid,text,text,text,bigint,text,text)','execute')
     or has_function_privilege('authenticated','public.apply_approved_product_import_plan(uuid,text,text,text,bigint,text,text)','execute') then
    raise exception 'reviewed variant digest repair security or definition postflight mismatch';
  end if;
end
$postflight$;

commit;
