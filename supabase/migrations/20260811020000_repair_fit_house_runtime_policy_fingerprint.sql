begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $repair$
declare
  v_target jsonb:=public.retailer_catalogue_actual_database_target();
  v_dispatch regprocedure:='public.retailer_offer_sync_validate_batch_read_only_internal(jsonb)'::regprocedure;
  v_fit regprocedure:='public.validate_fit_house_stable_oos_read_only(jsonb)'::regprocedure;
  v_source regprocedure:='public.retailer_offer_sync_validate_batch_read_only_unreviewed_interna(jsonb)'::regprocedure;
  v_dispatch_definition text:=pg_get_functiondef(v_dispatch);
  v_fit_definition text:=pg_get_functiondef(v_fit);
  v_old constant text:='6838770659dc772a3454846ad8e2e9e9620839b3ca688b118e9337231e520db6';
  v_new constant text:='d72ab8f4b44cdc799d7743544b346eb73ae4e335d3b40b596d597a1165d21abf';
begin
  if current_user<>'postgres'
     or v_target->>'target_environment'<>'PRODUCTION'
     or v_target->>'project_ref'<>'aftboxmrdgyhizicfsfu'
     or v_target->>'database_identity'<>'supplementscout-production:aftboxmrdgyhizicfsfu' then
    raise exception 'Fit House runtime policy repair requires production database owner';
  end if;
  if encode(pg_catalog.sha256(convert_to(v_dispatch_definition,'UTF8')),'hex')<>'6eb5e7dac346ec21660537f57d6105b95205a8fcf224e5fcb250a2d0e26b1a2f'
     or encode(pg_catalog.sha256(convert_to(v_fit_definition,'UTF8')),'hex')<>'0ae5fe76ad6bbed34f8fbf65a7df9c436710f101af83fb04a5992b4ce8301b15'
     or encode(pg_catalog.sha256(convert_to(pg_get_functiondef(v_source),'UTF8')),'hex')<>'41f6add31de41778cf7d20b94f8c67647121815bbee1e50f8ef2f434f9eb19b8'
     or position(v_old in v_dispatch_definition)=0 or position(v_new in v_dispatch_definition)>0
     or position(v_old in v_fit_definition)=0 or position(v_new in v_fit_definition)>0 then
    raise exception 'Fit House runtime policy repair exact installed state mismatch';
  end if;
  execute replace(v_fit_definition,v_old,v_new);
  execute replace(v_dispatch_definition,v_old,v_new);
  v_fit_definition:=pg_get_functiondef(v_fit);
  v_dispatch_definition:=pg_get_functiondef(v_dispatch);
  if encode(pg_catalog.sha256(convert_to(v_fit_definition,'UTF8')),'hex')<>'9fdd5fa3256f4a64a127c02a575f01b777e97119321efab044eb9300fab27de6'
     or encode(pg_catalog.sha256(convert_to(v_dispatch_definition,'UTF8')),'hex')<>'fc698a59b88e293322bad5dd5726d9530a7a3c64345f11008478d830b9a44d71'
     or encode(pg_catalog.sha256(convert_to(pg_get_functiondef(v_source),'UTF8')),'hex')<>'41f6add31de41778cf7d20b94f8c67647121815bbee1e50f8ef2f434f9eb19b8'
     or position(v_old in v_fit_definition)>0 or position(v_old in v_dispatch_definition)>0
     or position(v_new in v_fit_definition)=0 or position(v_new in v_dispatch_definition)=0
     or position('reviewed_mixed_change_contract' in v_dispatch_definition)>=position('validate_fit_house_stable_oos_read_only' in v_dispatch_definition)
     or position('retailer_id=9 and not in_stock)>103' in v_fit_definition)=0
     or position('or v_total_oos>v_previous_oos' in v_fit_definition)=0
     or position('v_maximum_new_oos not between 0 and 3' in v_fit_definition)=0
     or position('v_maximum_oos_increase not between 0 and 0.15' in v_fit_definition)=0
     or position('v_maximum_changed not between 0 and 0.25' in v_fit_definition)=0
     or position('v_mass_price_ratio<=0 or v_mass_price_ratio>0.20' in v_fit_definition)=0 then
    raise exception 'Fit House runtime policy repair verification failed';
  end if;
end
$repair$;

alter function public.validate_fit_house_stable_oos_read_only(jsonb) owner to postgres;
revoke all on function public.validate_fit_house_stable_oos_read_only(jsonb)
  from public,anon,authenticated,service_role;
alter function public.retailer_offer_sync_validate_batch_read_only_internal(jsonb) owner to postgres;
revoke all on function public.retailer_offer_sync_validate_batch_read_only_internal(jsonb)
  from public,anon,authenticated,service_role;

commit;
