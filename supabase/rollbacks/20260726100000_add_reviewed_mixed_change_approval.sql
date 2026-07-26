begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $preflight$
begin
  if to_regclass('public.retailer_offer_sync_reviewed_mixed_change_bindings') is null
     or to_regprocedure('public.retailer_offer_sync_validate_before_reviewed_mixed(jsonb)') is null
     or to_regprocedure('public.retailer_offer_sync_approve_before_reviewed_mixed(jsonb)') is null
     or to_regprocedure('public.retailer_offer_sync_execute_before_reviewed_mixed(jsonb)') is null then
    raise exception 'reviewed mixed-change rollback surface is incomplete';
  end if;
  if exists(select 1 from public.retailer_offer_sync_reviewed_mixed_change_bindings) then
    raise exception 'reviewed mixed-change rollback is forbidden after any approval binding';
  end if;
end
$preflight$;

-- Restore the exact pre-migration dispatcher definitions in place so the public
-- role-checking wrappers retain their existing dependency OIDs.
do $restore_dispatchers$
declare
  v_definition text;
begin
  select pg_get_functiondef('public.retailer_offer_sync_validate_before_reviewed_mixed(jsonb)'::regprocedure)
  into v_definition;
  execute replace(
    v_definition,
    'FUNCTION public.retailer_offer_sync_validate_before_reviewed_mixed',
    'FUNCTION public.retailer_offer_sync_validate_batch_read_only_internal');

  select pg_get_functiondef('public.retailer_offer_sync_approve_before_reviewed_mixed(jsonb)'::regprocedure)
  into v_definition;
  execute replace(
    v_definition,
    'FUNCTION public.retailer_offer_sync_approve_before_reviewed_mixed',
    'FUNCTION public.retailer_offer_sync_approve_batch_internal');

  select pg_get_functiondef('public.retailer_offer_sync_execute_before_reviewed_mixed(jsonb)'::regprocedure)
  into v_definition;
  execute replace(
    v_definition,
    'FUNCTION public.retailer_offer_sync_execute_before_reviewed_mixed',
    'FUNCTION public.retailer_offer_sync_execute_batch_internal');
end
$restore_dispatchers$;

drop function public.retailer_offer_sync_validate_reviewed_mixed_change_internal(jsonb);
drop function public.register_reviewed_mixed_change_control_plan(jsonb);
drop function public.retailer_offer_sync_validate_reviewed_mixed_change_contract(jsonb,jsonb,timestamptz);
drop function public.retailer_offer_sync_validate_before_reviewed_mixed(jsonb);
drop function public.retailer_offer_sync_approve_before_reviewed_mixed(jsonb);
drop function public.retailer_offer_sync_execute_before_reviewed_mixed(jsonb);
drop table public.retailer_offer_sync_reviewed_mixed_change_bindings;
drop table public.retailer_offer_sync_reviewed_mixed_change_definitions;

commit;
