begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $support_simply_registration$
declare
  v_target jsonb:=public.retailer_catalogue_actual_database_target();
  v_definition text;
  v_registration_anchor text:=$old$or p_request->>'kind'<>'jons-existing-offer-sync-control-plan-registration'
     or p_request->>'source_platform'<>'SHOPIFY'
     or p_request->>'source_country'<>'GB'
     or p_request->>'retailer_slug'<>'jon-s-supplements'
     or v_retailer_id<>10$old$;
  v_registration_replacement text:=$new$or p_request->>'source_platform'<>'SHOPIFY'
     or p_request->>'source_country'<>'GB'
     or not (
       (p_request->>'kind'='jons-existing-offer-sync-control-plan-registration'
        and p_request->>'retailer_slug'='jon-s-supplements'
        and v_retailer_id=10)
       or
       (p_request->>'kind'='retailer-existing-offer-sync-control-plan-registration'
        and p_request->>'retailer_slug'='simply-supplements'
        and p_request->>'source_domain'='simplysupplements.co.uk'
        and v_retailer_id=7
        and v_contract->>'authorization_id'='simply-49-2bc798f9fb7db4af-production')
     )$new$;
  v_parent_anchor text:=$old$'schema_version',1,'kind','jons-existing-offer-sync-parent','parent_plan_id',v_parent_id,$old$;
  v_parent_replacement text:=$new$'schema_version',1,'kind',case when v_retailer_id=10 then 'jons-existing-offer-sync-parent' else 'retailer-existing-offer-sync-parent' end,'parent_plan_id',v_parent_id,$new$;
begin
  if current_user<>'postgres'
     or v_target->>'target_environment'<>'PRODUCTION'
     or v_target->>'project_ref'<>'aftboxmrdgyhizicfsfu'
     or v_target->>'database_identity'<>'supplementscout-production:aftboxmrdgyhizicfsfu' then
    raise exception 'Simply reviewed registration support requires production database owner';
  end if;
  if not exists(
    select 1 from public.retailer_offer_sync_reviewed_mixed_change_definitions
    where authorization_id='simply-49-2bc798f9fb7db4af-production'
      and retailer_id=7
      and contract_version=4
  ) then
    raise exception 'Simply reviewed commercial authorization is missing';
  end if;
  v_definition:=pg_get_functiondef('public.register_reviewed_mixed_change_control_plan(jsonb)'::regprocedure);
  if position(v_registration_anchor in v_definition)=0
     or position(v_parent_anchor in v_definition)=0 then
    raise exception 'Simply reviewed registration anchor is missing';
  end if;
  v_definition:=replace(v_definition,v_registration_anchor,v_registration_replacement);
  v_definition:=replace(v_definition,v_parent_anchor,v_parent_replacement);
  execute v_definition;
end
$support_simply_registration$;

do $verify_simply_registration$
declare
  v_definition text:=pg_get_functiondef('public.register_reviewed_mixed_change_control_plan(jsonb)'::regprocedure);
begin
  if position('simply-49-2bc798f9fb7db4af-production' in v_definition)=0
     or position($check$'retailer-existing-offer-sync-parent'$check$ in v_definition)=0
     or position($check$p_request->>'source_domain'='simplysupplements.co.uk'$check$ in v_definition)=0 then
    raise exception 'Simply reviewed registration verification failed';
  end if;
end
$verify_simply_registration$;

commit;
