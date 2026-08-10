begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $rollback_simply_sale$
declare
  v_target jsonb:=public.retailer_catalogue_actual_database_target();
  v_rows integer;
begin
  if current_user<>'postgres'
     or v_target->>'target_environment'<>'PRODUCTION'
     or v_target->>'project_ref'<>'aftboxmrdgyhizicfsfu'
     or v_target->>'database_identity'<>'supplementscout-production:aftboxmrdgyhizicfsfu' then
    raise exception 'Simply offer 635 reviewed sale rollback requires production database owner';
  end if;
  if exists(
    select 1 from public.retailer_offer_sync_reviewed_mixed_change_bindings
    where authorization_id='simply-offer635-sale-20260810-production'
  ) then
    raise exception 'rollback is forbidden after the Simply offer 635 authorization has been bound';
  end if;
  delete from public.retailer_offer_sync_reviewed_mixed_change_definitions
  where authorization_id='simply-offer635-sale-20260810-production'
    and target_environment='PRODUCTION'
    and retailer_id=7
    and reviewed_manifest_sha256='c1d1c794f39ea955df7c048f4856b6058efbd7df60a6c7e42ef7c057ba5fd1b9';
  get diagnostics v_rows=row_count;
  if v_rows<>1 then
    raise exception 'Simply offer 635 reviewed sale rollback affected % rows',v_rows;
  end if;
end
$rollback_simply_sale$;

commit;
