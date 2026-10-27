begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $guard_gladiator_registration_rollback$
declare
  v_oid oid := to_regprocedure('public.register_gladiator_nutrition_offer_sync_control_plan(jsonb)');
  v_definition text;
  v_sha256 text;
  v_owner text;
  v_security_definer boolean;
  v_volatility "char";
  v_config text[];
begin
  if v_oid is null then
    raise exception 'Gladiator Nutrition registration rollback target is absent';
  end if;
  v_definition := pg_get_functiondef(v_oid);
  v_sha256 := encode(digest(v_definition, 'sha256'), 'hex');
  select owner.rolname, proc.prosecdef, proc.provolatile, proc.proconfig
  into v_owner, v_security_definer, v_volatility, v_config
  from pg_proc proc
  join pg_roles owner on owner.oid=proc.proowner
  where proc.oid=v_oid;

  if v_sha256 <> '08883b3ccb14da0804ce8ab38c67d900ec455783177177e078e2d6007a57609e'
     or position('Gladiator Nutrition frozen 603-offer existing-identity scope binding' in v_definition) = 0
     or v_owner <> 'postgres'
     or v_security_definer is distinct from true
     or v_volatility <> 'v'
     or v_config is distinct from array['search_path=pg_catalog, public, pg_temp']::text[]
     or has_function_privilege('public', v_oid, 'EXECUTE')
     or (to_regrole('anon') is not null and has_function_privilege('anon', v_oid, 'EXECUTE'))
     or (to_regrole('authenticated') is not null and has_function_privilege('authenticated', v_oid, 'EXECUTE'))
     or (to_regrole('service_role') is not null and has_function_privilege('service_role', v_oid, 'EXECUTE'))
     or (to_regrole('retailer_catalogue_staging_approver') is not null and has_function_privilege('retailer_catalogue_staging_approver', v_oid, 'EXECUTE'))
     or (to_regrole('retailer_catalogue_production_approver') is not null and has_function_privilege('retailer_catalogue_production_approver', v_oid, 'EXECUTE'))
     or (to_regrole('retailer_catalogue_staging_executor') is not null and has_function_privilege('retailer_catalogue_staging_executor', v_oid, 'EXECUTE'))
     or (to_regrole('retailer_catalogue_production_executor') is not null and has_function_privilege('retailer_catalogue_production_executor', v_oid, 'EXECUTE')) then
    raise exception 'Gladiator Nutrition registration rollback lineage or security guard failed';
  end if;
end;
$guard_gladiator_registration_rollback$;

drop function public.register_gladiator_nutrition_offer_sync_control_plan(jsonb);

commit;
