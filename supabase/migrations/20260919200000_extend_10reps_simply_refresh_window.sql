begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
do $patch$
declare
  v_target jsonb:=public.retailer_catalogue_actual_database_target();
  v_function regprocedure;
  v_definition text;
begin
  if current_user<>'postgres' or v_target->>'target_environment'<>'PRODUCTION'
     or v_target->>'project_ref'<>'aftboxmrdgyhizicfsfu'
     or v_target->>'database_identity'<>'supplementscout-production:aftboxmrdgyhizicfsfu' then
    raise exception '10 Reps/Simply refresh-window target mismatch';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('retailer-offer-sync:global-execution',0));
  foreach v_function in array array[
    to_regprocedure('public.register_10reps_offer_sync_control_plan(jsonb)'),
    to_regprocedure('public.register_simply_supplements_offer_sync_control_plan(jsonb)')
  ] loop
    if v_function is null then raise exception 'required dedicated registration function missing'; end if;
    select pg_get_functiondef(v_function) into v_definition;
    if strpos(v_definition,'v_expires_at > now()+interval ''15 minutes''')=0 then
      raise exception 'dedicated registration expiry guard mismatch: %',v_function;
    end if;
    execute replace(v_definition,'v_expires_at > now()+interval ''15 minutes''','v_expires_at > now()+interval ''45 minutes''');
  end loop;
end
$patch$;
commit;
