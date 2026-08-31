begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $repair_jsonb_operator$
declare
  v_target jsonb:=public.retailer_catalogue_actual_database_target();
  v_definition text;
begin
  if current_user<>'postgres'
     or v_target->>'target_environment' not in ('STAGING','PRODUCTION')
     or v_target->>'database_identity' not in (
       'supplementscout-staging:hxnrsyyqffztlvcrtgbf',
       'supplementscout-production:aftboxmrdgyhizicfsfu'
     ) then
    raise exception 'verified no-change JSONB timestamp guard operator repair requires an attested owner target';
  end if;

  v_definition:=pg_get_functiondef('public.validate_verified_offer_no_change_plan(jsonb)'::regprocedure);
  if position($old$p_plan#>'{expected_state,offer}' - 'last_checked_at'$old$ in v_definition)=0 then
    raise exception 'verified no-change JSONB timestamp guard operator anchor is missing';
  end if;
  v_definition:=replace(
    v_definition,
    $old$p_plan#>'{expected_state,offer}' - 'last_checked_at'$old$,
    $new$(p_plan#>'{expected_state,offer}') - 'last_checked_at'::text$new$
  );
  execute v_definition;
end
$repair_jsonb_operator$;

do $verify_jsonb_operator$
declare
  v_definition text:=pg_get_functiondef('public.validate_verified_offer_no_change_plan(jsonb)'::regprocedure);
begin
  if position($check$(p_plan#>'{expected_state,offer}') - 'last_checked_at'::text$check$ in v_definition)=0
     or position($check$p_plan#>'{expected_state,offer}' - 'last_checked_at'$check$ in v_definition)>0 then
    raise exception 'verified no-change JSONB timestamp guard operator repair verification failed';
  end if;
end
$verify_jsonb_operator$;

commit;
