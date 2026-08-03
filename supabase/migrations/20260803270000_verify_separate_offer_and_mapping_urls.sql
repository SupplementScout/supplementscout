begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $separate_verified_urls$
declare
  v_target jsonb:=public.retailer_catalogue_actual_database_target();
  v_definition text;
  v_anchor text:=$old$or v_mapping.external_url is distinct from v_offer.url$old$;
  v_replacement text:=$new$or v_mapping.external_url is distinct from p_plan#>>'{retailer_product,values,external_url}'$new$;
begin
  if current_user<>'postgres'
     or v_target->>'target_environment'<>'PRODUCTION'
     or v_target->>'project_ref'<>'aftboxmrdgyhizicfsfu'
     or v_target->>'database_identity'<>'supplementscout-production:aftboxmrdgyhizicfsfu' then
    raise exception 'Separate verified offer and mapping URLs require production database owner';
  end if;
  v_definition:=pg_get_functiondef('public.validate_verified_offer_no_change_plan(jsonb)'::regprocedure);
  if position(v_anchor in v_definition)=0 then
    raise exception 'Verified no-change URL anchor is missing';
  end if;
  v_definition:=replace(v_definition,v_anchor,v_replacement);
  execute v_definition;
end
$separate_verified_urls$;

do $verify_separate_verified_urls$
declare
  v_definition text:=pg_get_functiondef('public.validate_verified_offer_no_change_plan(jsonb)'::regprocedure);
begin
  if position($check$v_mapping.external_url is distinct from p_plan#>>'{retailer_product,values,external_url}'$check$ in v_definition)=0
     or position($check$v_mapping.external_url is distinct from v_offer.url$check$ in v_definition)>0 then
    raise exception 'Separate verified URL verification failed';
  end if;
end
$verify_separate_verified_urls$;

commit;
