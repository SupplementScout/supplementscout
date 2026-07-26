begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $preflight$
begin
  if to_regprocedure(
    'public.retailer_offer_sync_validate_reviewed_mixed_change_contract_v1(jsonb,jsonb,timestamptz)'
  ) is null then
    raise exception 'scoped reviewed mixed-change rollback target is not installed';
  end if;
  if exists(
    select 1
    from public.retailer_offer_sync_reviewed_mixed_change_bindings
    where authorization_id='jons-15-2b14b0d7b09ab70f-staging'
  ) then
    raise exception 'rollback is forbidden after any scoped reviewed approval binding';
  end if;
end
$preflight$;

delete from public.retailer_offer_sync_reviewed_mixed_change_definitions
where authorization_id='jons-15-2b14b0d7b09ab70f-staging';

drop function public.retailer_offer_sync_validate_reviewed_mixed_change_contract(
  jsonb,jsonb,timestamptz
);

alter function public.retailer_offer_sync_validate_reviewed_mixed_change_contract_v1(
  jsonb,jsonb,timestamptz
) rename to retailer_offer_sync_validate_reviewed_mixed_change_contract;

alter table public.retailer_offer_sync_reviewed_mixed_change_definitions
  drop column unmapped_source_delta_hash,
  drop column mapped_scope_fingerprint,
  drop column reviewed_full_source_fingerprint,
  drop column contract_version;

alter function public.retailer_offer_sync_validate_reviewed_mixed_change_contract(
  jsonb,jsonb,timestamptz
) owner to postgres;
revoke all on function public.retailer_offer_sync_validate_reviewed_mixed_change_contract(
  jsonb,jsonb,timestamptz
) from public,anon,authenticated,service_role;

commit;
