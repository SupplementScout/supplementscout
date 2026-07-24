begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

revoke all on function public.register_retailer_offer_sync_control_plan(jsonb)
  from public,anon,authenticated,service_role;
revoke all on function public.read_retailer_offer_sync_approved_state(bigint)
  from public,anon,authenticated,service_role;

do $revoke_roles$
begin
  if exists(
    select 1 from pg_roles
    where rolname='retailer_catalogue_staging_validator'
  ) then
    revoke execute on function
      public.register_retailer_offer_sync_control_plan(jsonb)
      from retailer_catalogue_staging_validator;
    revoke execute on function
      public.read_retailer_offer_sync_approved_state(bigint)
      from retailer_catalogue_staging_validator;
  end if;
  if exists(
    select 1 from pg_roles
    where rolname='retailer_catalogue_production_validator'
  ) then
    revoke execute on function
      public.register_retailer_offer_sync_control_plan(jsonb)
      from retailer_catalogue_production_validator;
    revoke execute on function
      public.read_retailer_offer_sync_approved_state(bigint)
      from retailer_catalogue_production_validator;
  end if;
end
$revoke_roles$;

drop function public.register_retailer_offer_sync_control_plan(jsonb);
drop function public.read_retailer_offer_sync_approved_state(bigint);

commit;
