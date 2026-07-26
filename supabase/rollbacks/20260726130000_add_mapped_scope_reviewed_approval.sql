begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $preflight$
begin
  if to_regprocedure(
    'public.retailer_offer_sync_validate_reviewed_mixed_change_contract_v2(jsonb,jsonb,timestamptz)'
  ) is null
     or not exists(
       select 1
       from information_schema.columns
       where table_schema='public'
         and table_name='retailer_offer_sync_reviewed_mixed_change_definitions'
         and column_name='allowed_unmapped_collisions'
     ) then
    raise exception 'mapped-scope reviewed approval is not installed';
  end if;
  if exists(
    select 1
    from public.retailer_offer_sync_reviewed_mixed_change_definitions
    where contract_version=3
  ) then
    raise exception 'mapped-scope rollback is forbidden after any v3 reviewed definition';
  end if;
end
$preflight$;

do $restore_v2_dispatcher$
declare
  v_definition text;
begin
  select pg_get_functiondef(
    'public.retailer_offer_sync_validate_reviewed_mixed_change_contract_v2(jsonb,jsonb,timestamptz)'::regprocedure
  ) into v_definition;
  execute replace(
    v_definition,
    'FUNCTION public.retailer_offer_sync_validate_reviewed_mixed_change_contract_v2',
    'FUNCTION public.retailer_offer_sync_validate_reviewed_mixed_change_contract');
end
$restore_v2_dispatcher$;

drop function public.retailer_offer_sync_validate_reviewed_mixed_change_contract_v2(
  jsonb,jsonb,timestamptz
);

alter table public.retailer_offer_sync_reviewed_mixed_change_definitions
  drop constraint reviewed_mixed_change_v3_fields_check,
  drop constraint reviewed_mixed_change_contract_version_check,
  drop column unmapped_drift_policy,
  drop column allowed_unmapped_collisions_hash,
  drop column allowed_unmapped_collisions,
  add constraint reviewed_mixed_change_contract_version_check
    check (contract_version in (1,2));

alter function public.retailer_offer_sync_validate_reviewed_mixed_change_contract(
  jsonb,jsonb,timestamptz
) owner to postgres;
revoke all on function public.retailer_offer_sync_validate_reviewed_mixed_change_contract(
  jsonb,jsonb,timestamptz
) from public,anon,authenticated,service_role;

commit;
