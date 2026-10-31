begin;

revoke all on function public.read_verified_automation_review_stock_transitions_v1(bigint)
  from public,anon,authenticated,service_role,
       retailer_catalogue_production_validator,
       retailer_catalogue_production_approver,
       retailer_catalogue_production_executor;
drop function public.read_verified_automation_review_stock_transitions_v1(bigint);

commit;
