begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- Owner-approved Group A extension. This changes only the immutable registration
-- contract from the previous fourteen rows to the exact combined 109-row scope.
-- It performs no catalogue or freshness write.
do $expand_discount_scope$
declare
  v_target jsonb := public.retailer_catalogue_actual_database_target();
  v_definition text := pg_get_functiondef(
    'public.register_discount_supplements_offer_sync_control_plan(jsonb)'::regprocedure
  );
  v_old_rows_hash constant text := 'cf09dcd18094e03ac5c02d62a631588f644439e72b94486b1c0a6723e1d3e9c8';
  v_new_rows_hash constant text := 'e8eb51a75a31fa41b5cc9eab009a87ee5fe3491ddc130c0caafd621f2fd843e2';
  v_old_file_hash constant text := 'ce13e2a72d12024aac98005d5d40288bd5f109b6f2a63b4f30c9016d46e017a7';
  v_new_file_hash constant text := '308ab2f082abaf1c541210917b168b2ce6bc69ffd78026bf8d18c9801f898746';
begin
  if current_user <> 'postgres'
     or v_target->>'target_environment' <> 'PRODUCTION'
     or v_target->>'project_ref' <> 'aftboxmrdgyhizicfsfu'
     or v_target->>'database_identity' <> 'supplementscout-production:aftboxmrdgyhizicfsfu' then
    raise exception 'Discount Supplements 109-row control extension requires production database owner';
  end if;

  if position(v_old_rows_hash in v_definition) = 0
     or position(v_old_file_hash in v_definition) = 0
     or position('jsonb_array_length(v_manifest) <> 14' in v_definition) = 0
     or position('exactly 14 approved' in v_definition) = 0
     or position(v_new_rows_hash in v_definition) > 0
     or position(v_new_file_hash in v_definition) > 0 then
    raise exception 'Discount Supplements 109-row control extension anchor mismatch';
  end if;

  v_definition := replace(v_definition, v_old_rows_hash, v_new_rows_hash);
  v_definition := replace(v_definition, v_old_file_hash, v_new_file_hash);
  v_definition := replace(v_definition, 'jsonb_array_length(v_manifest) <> 14', 'jsonb_array_length(v_manifest) <> 109');
  v_definition := replace(v_definition, 'exactly 14 approved', 'exactly 109 approved');
  execute v_definition;
end;
$expand_discount_scope$;

alter function public.register_discount_supplements_offer_sync_control_plan(jsonb) owner to postgres;
revoke all on function public.register_discount_supplements_offer_sync_control_plan(jsonb)
  from public, anon, authenticated, service_role;

do $grant_discount_scope$
begin
  if to_regrole('retailer_catalogue_production_validator') is not null then
    grant execute on function public.register_discount_supplements_offer_sync_control_plan(jsonb)
      to retailer_catalogue_production_validator;
  end if;
end;
$grant_discount_scope$;

do $verify_discount_scope$
declare
  v_definition text := pg_get_functiondef(
    'public.register_discount_supplements_offer_sync_control_plan(jsonb)'::regprocedure
  );
begin
  if position('e8eb51a75a31fa41b5cc9eab009a87ee5fe3491ddc130c0caafd621f2fd843e2' in v_definition) = 0
     or position('308ab2f082abaf1c541210917b168b2ce6bc69ffd78026bf8d18c9801f898746' in v_definition) = 0
     or position('jsonb_array_length(v_manifest) <> 109' in v_definition) = 0
     or position('exactly 109 approved' in v_definition) = 0 then
    raise exception 'Discount Supplements 109-row control extension verification failed';
  end if;
end;
$verify_discount_scope$;

commit;
