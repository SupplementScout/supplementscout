begin;

-- Permit a reviewed exact-set retry only after the existing close RPC has proved
-- that the prior approval expired unexecuted with zero business writes.
do $fix_reviewed_stock_only_retry$
declare
  v_function regprocedure := to_regprocedure('public.retailer_offer_sync_approve_batch_internal(jsonb)');
  v_definition text;
  v_insert text := $original$
  insert into public.retailer_offer_sync_reviewed_stock_only_authorizations(authorization_id,target_environment,approval_id,reviewed_plan_hash,artifact_fingerprint,contract)
$original$;
  v_replacement text := $replacement$
  delete from public.retailer_offer_sync_reviewed_stock_only_authorizations r
  using public.retailer_offer_sync_batch_approvals a
  where r.authorization_id=v_contract->>'authorization_id'
    and r.status='APPROVED' and r.consumed_at is null
    and a.id=r.approval_id and a.consumed_at is null and a.result is null
    and a.closed_at is not null and a.close_result->>'status'='EXPIRED'
    and a.close_result->>'business_writes'='0';
  insert into public.retailer_offer_sync_reviewed_stock_only_authorizations(authorization_id,target_environment,approval_id,reviewed_plan_hash,artifact_fingerprint,contract)
$replacement$;
begin
  if v_function is null then
    raise exception 'reviewed stock-only approver is missing';
  end if;

  select pg_get_functiondef(v_function) into v_definition;
  if strpos(v_definition,v_insert)=0 then
    raise exception 'reviewed stock-only approver insertion did not match';
  end if;

  execute replace(v_definition,v_insert,v_replacement);
end
$fix_reviewed_stock_only_retry$;

commit;
