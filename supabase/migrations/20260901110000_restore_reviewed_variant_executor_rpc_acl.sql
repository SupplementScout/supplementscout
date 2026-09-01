begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $preflight$
declare
  v_target jsonb;
  v_owner text;
  v_security_definer boolean;
  v_search_path text[];
begin
  if current_user <> 'postgres' then
    raise exception 'reviewed variant executor ACL repair requires database owner postgres';
  end if;
  v_target := public.retailer_catalogue_actual_database_target();
  if v_target->>'target_environment' <> 'PRODUCTION'
     or v_target->>'project_ref' <> 'aftboxmrdgyhizicfsfu'
     or v_target->>'database_identity' <> 'supplementscout-production:aftboxmrdgyhizicfsfu' then
    raise exception 'reviewed variant executor ACL repair requires the exact production target';
  end if;
  if to_regprocedure('public.apply_approved_product_import_plan(uuid,text,text,text,bigint,text,text)') is null
     or to_regrole('retailer_catalogue_production_executor') is null
     or to_regrole('retailer_catalogue_production_approver') is null
     or to_regrole('retailer_catalogue_production_validator') is null then
    raise exception 'reviewed variant executor ACL repair requires the active RPC and production role family';
  end if;

  select r.rolname,p.prosecdef,p.proconfig
    into v_owner,v_security_definer,v_search_path
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  join pg_roles r on r.oid=p.proowner
  where p.oid='public.apply_approved_product_import_plan(uuid,text,text,text,bigint,text,text)'::regprocedure;

  if v_owner <> 'postgres'
     or not v_security_definer
     or v_search_path is distinct from array['search_path=pg_catalog, public, pg_temp']
     or has_function_privilege('public','public.apply_approved_product_import_plan(uuid,text,text,text,bigint,text,text)','execute')
     or has_function_privilege('anon','public.apply_approved_product_import_plan(uuid,text,text,text,bigint,text,text)','execute')
     or has_function_privilege('authenticated','public.apply_approved_product_import_plan(uuid,text,text,text,bigint,text,text)','execute')
     or has_function_privilege('retailer_catalogue_production_approver','public.apply_approved_product_import_plan(uuid,text,text,text,bigint,text,text)','execute')
     or has_function_privilege('retailer_catalogue_production_validator','public.apply_approved_product_import_plan(uuid,text,text,text,bigint,text,text)','execute')
     or not has_function_privilege('service_role','public.apply_approved_product_import_plan(uuid,text,text,text,bigint,text,text)','execute')
     or has_function_privilege('retailer_catalogue_production_executor','public.apply_approved_product_import_plan(uuid,text,text,text,bigint,text,text)','execute') then
    raise exception 'reviewed variant executor ACL repair preflight mismatch';
  end if;
end
$preflight$;

grant execute on function public.apply_approved_product_import_plan(uuid,text,text,text,bigint,text,text)
  to retailer_catalogue_production_executor;

do $postflight$
declare
  v_owner text;
  v_security_definer boolean;
  v_search_path text[];
begin
  select r.rolname,p.prosecdef,p.proconfig
    into v_owner,v_security_definer,v_search_path
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  join pg_roles r on r.oid=p.proowner
  where p.oid='public.apply_approved_product_import_plan(uuid,text,text,text,bigint,text,text)'::regprocedure;

  if v_owner <> 'postgres'
     or not v_security_definer
     or v_search_path is distinct from array['search_path=pg_catalog, public, pg_temp']
     or has_function_privilege('public','public.apply_approved_product_import_plan(uuid,text,text,text,bigint,text,text)','execute')
     or has_function_privilege('anon','public.apply_approved_product_import_plan(uuid,text,text,text,bigint,text,text)','execute')
     or has_function_privilege('authenticated','public.apply_approved_product_import_plan(uuid,text,text,text,bigint,text,text)','execute')
     or has_function_privilege('retailer_catalogue_production_approver','public.apply_approved_product_import_plan(uuid,text,text,text,bigint,text,text)','execute')
     or has_function_privilege('retailer_catalogue_production_validator','public.apply_approved_product_import_plan(uuid,text,text,text,bigint,text,text)','execute')
     or not has_function_privilege('service_role','public.apply_approved_product_import_plan(uuid,text,text,text,bigint,text,text)','execute')
     or not has_function_privilege('retailer_catalogue_production_executor','public.apply_approved_product_import_plan(uuid,text,text,text,bigint,text,text)','execute') then
    raise exception 'reviewed variant executor ACL repair postflight mismatch';
  end if;
end
$postflight$;

commit;
