begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $preflight$
declare
  v_function regprocedure := to_regprocedure('public.read_reviewed_catalogue_import_state(jsonb)');
  v_definition text;
  v_owner oid;
  v_volatility "char";
  v_security_definer boolean;
  v_config text[];
  v_environment text:=public.retailer_catalogue_actual_database_target()->>'target_environment';
  v_validator text;
begin
  if v_function is null then
    raise exception 'reviewed catalogue bounded-state rollback target is missing';
  end if;
  v_validator:=case v_environment
    when 'STAGING' then 'retailer_catalogue_staging_validator'
    when 'PRODUCTION' then 'retailer_catalogue_production_validator'
  end;
  if v_validator is null or to_regrole(v_validator) is null then
    raise exception 'reviewed catalogue bounded-state rollback required validator role is missing';
  end if;

  select pg_get_functiondef(p.oid),p.proowner,p.provolatile,p.prosecdef,p.proconfig
    into v_definition,v_owner,v_volatility,v_security_definer,v_config
    from pg_proc p where p.oid=v_function;

  if encode(pg_catalog.sha256(convert_to(v_definition,'UTF8')),'hex')
       <> '2e0f4696d3b9c437257e849f58db2ffc35b835d265eca83e6f3459a8cf2e44f4'
     or v_owner<>'postgres'::regrole
     or v_volatility<>'s'
     or not v_security_definer
     or v_config is distinct from array['search_path=pg_catalog, public, pg_temp']::text[]
     or not exists(
       select 1
       from pg_proc p
       cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) acl
       where p.oid=v_function
         and acl.grantee=to_regrole(v_validator)
         and acl.grantor=p.proowner
         and acl.privilege_type='EXECUTE'
         and not acl.is_grantable
     )
     or exists(
       select 1
       from pg_proc p
       cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) acl
       where p.oid=v_function
         and (
           acl.privilege_type<>'EXECUTE'
           or acl.grantee not in (p.proowner,to_regrole(v_validator))
           or (acl.grantee<>p.proowner and (acl.grantor<>p.proowner or acl.is_grantable))
         )
     ) then
    raise exception 'reviewed catalogue bounded-state rollback lineage or metadata differs';
  end if;
end
$preflight$;

drop function public.read_reviewed_catalogue_import_state(jsonb);

commit;
