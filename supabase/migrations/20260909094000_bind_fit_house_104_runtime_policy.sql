begin;

-- Bind the owner-approved 104-OOS configuration to its actual runtime hash.
-- Approval SHA-256: 3bcac846d086c8bc71ce9c5bf5bf8e135f704f8e6eed543d03ab7bbaae0d578c
-- Only fingerprint literals change. No business rows or permissions change.
set local lock_timeout='5s';
set local statement_timeout='60s';

do $bind_fit_104$
declare
  v_target jsonb := public.retailer_catalogue_actual_database_target();
  v_old constant text := 'd72ab8f4b44cdc799d7743544b346eb73ae4e335d3b40b596d597a1165d21abf';
  v_new constant text := 'dd2f583394ffa3787b595d7009731dff5bb8e485b9114d3778084a71c120dfc1';
  v_spec record;
  v_function record;
  v_definition text;
begin
  if current_user<>'postgres'
    or v_target->>'target_environment'<>'PRODUCTION'
    or v_target->>'project_ref'<>'aftboxmrdgyhizicfsfu'
    or v_target->>'database_identity'<>'supplementscout-production:aftboxmrdgyhizicfsfu' then
    raise exception 'Fit House 104 runtime binding requires exact production owner';
  end if;
  for v_spec in select * from (values
    ('validate_fit_house_stable_oos_read_only(jsonb)','4f1f7a8c184a52e63ef94be0d6435829',2),
    ('validate_fit_house_confirmed_price_read_only(jsonb)','8b9d237b8ca02ecd0c483320fc55ba03',2),
    ('retailer_offer_sync_validate_batch_read_only_internal(jsonb)','a8512ea11c4acd06dd6674924ca2a442',1)
  ) as expected(name,digest,occurrences) loop
    select p.oid,p.proowner,p.proacl,p.proconfig,pg_get_functiondef(p.oid) definition
    into strict v_function from pg_proc p where p.oid=('public.'||v_spec.name)::regprocedure;
    if md5(v_function.definition)<>v_spec.digest
      or (length(v_function.definition)-length(replace(v_function.definition,v_old,'')))<>length(v_old)*v_spec.occurrences
      or position(v_new in v_function.definition)>0 then
      raise exception 'Fit House 104 runtime installed definition mismatch';
    end if;
    v_definition:=replace(v_function.definition,v_old,v_new);
    execute v_definition;
    if pg_get_functiondef(v_function.oid)<>v_definition
      or not exists (select 1 from pg_proc p where p.oid=v_function.oid
        and p.proowner=v_function.proowner and p.proacl is not distinct from v_function.proacl
        and p.proconfig is not distinct from v_function.proconfig) then
      raise exception 'Fit House 104 runtime definition or privileges drift';
    end if;
  end loop;
end
$bind_fit_104$;
commit;
