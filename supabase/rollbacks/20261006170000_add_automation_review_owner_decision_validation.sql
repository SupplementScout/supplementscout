begin;

create or replace function public.validate_retailer_offer_sync_batch_read_only(p_request jsonb)
returns jsonb
language plpgsql
stable
security invoker
set search_path=pg_catalog,public,pg_temp
as $validate_wrapper$
begin
  if current_user<>'retailer_catalogue_production_validator' then
    perform public.retailer_catalogue_raise(
      'RSBI_ENVIRONMENT_BLOCKED','Production validator role required');
  end if;
  return public.retailer_offer_sync_validate_batch_read_only_internal(p_request);
end
$validate_wrapper$;

alter function public.validate_retailer_offer_sync_batch_read_only(jsonb) owner to postgres;
revoke all on function public.validate_retailer_offer_sync_batch_read_only(jsonb)
  from public,anon,authenticated,service_role,
       retailer_catalogue_production_approver,retailer_catalogue_production_executor;
grant execute on function public.validate_retailer_offer_sync_batch_read_only(jsonb)
  to retailer_catalogue_production_validator;

revoke all on function public.validate_automation_review_owner_decision(jsonb)
  from public,anon,authenticated,service_role,
       retailer_catalogue_production_validator,retailer_catalogue_production_approver,
       retailer_catalogue_production_executor;
drop function public.validate_automation_review_owner_decision(jsonb);

commit;
