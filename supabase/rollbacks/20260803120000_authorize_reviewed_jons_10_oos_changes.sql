begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $preflight$
declare
  v_target jsonb:=public.retailer_catalogue_actual_database_target();
begin
  if current_user<>'postgres'
     or v_target->>'target_environment'<>'PRODUCTION'
     or v_target->>'project_ref'<>'aftboxmrdgyhizicfsfu'
     or v_target->>'database_identity'
        <>'supplementscout-production:aftboxmrdgyhizicfsfu' then
    raise exception 'Jon''s 10-change reviewed rollback requires production database owner';
  end if;
  if not exists(
    select 1
    from public.retailer_offer_sync_reviewed_mixed_change_definitions
    where authorization_id='jons-10-3d3dec8e0087adf5-production'
  ) then
    raise exception 'Jon''s 10-change reviewed authorization is not installed';
  end if;
  if exists(
    select 1
    from public.retailer_offer_sync_reviewed_mixed_change_bindings
    where authorization_id='jons-10-3d3dec8e0087adf5-production'
  ) then
    raise exception 'rollback is forbidden after any Jon''s 10-change reviewed binding';
  end if;
end
$preflight$;

delete from public.retailer_offer_sync_reviewed_mixed_change_definitions
where authorization_id='jons-10-3d3dec8e0087adf5-production';

commit;
