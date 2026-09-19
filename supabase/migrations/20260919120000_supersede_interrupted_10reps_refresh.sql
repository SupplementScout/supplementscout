begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
do $cleanup$
declare
  v_target jsonb:=public.retailer_catalogue_actual_database_target();
  v_parent constant uuid:='522b2186-4200-4d5a-9c7d-263185830039';
  v_now timestamptz:=clock_timestamp();
  v_before jsonb;
  v_rows integer;
begin
  if current_user<>'postgres' or v_target->>'target_environment'<>'PRODUCTION'
     or v_target->>'project_ref'<>'aftboxmrdgyhizicfsfu'
     or v_target->>'database_identity'<>'supplementscout-production:aftboxmrdgyhizicfsfu' then
    raise exception 'interrupted 10 Reps cleanup target mismatch';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('retailer-offer-sync:global-execution',0));
  perform pg_advisory_xact_lock(hashtextextended('PRODUCTION:14',0));
  v_before:=public.retailer_catalogue_business_counts();
  perform 1 from public.retailer_catalogue_parent_plans p where p.id=v_parent
    and p.parent_plan_fingerprint='52184a2d996f5ff8786dcc26982dd4058c56678f4094ac532c4a9676747199ba'
    and p.retailer_id=14 and p.target_environment='PRODUCTION' and p.status='PARTIALLY_APPLIED'
    and p.code_commit='8a5ec6f50d65912d31ad42c4efa7cd60a3ba5307'
    and p.source_snapshot_fingerprint='9793e8fa7ef51d33c2142dfbf51a364a31898e36744cb87711e84b401832d749'
    and p.source_captured_at='2026-09-15T08:02:51.282Z'::timestamptz
    and p.approval_expires_at='2026-09-15T08:17:36.889Z'::timestamptz
    and p.approval_expires_at<clock_timestamp() for update;
  if not found then raise exception 'interrupted 10 Reps parent precondition mismatch'; end if;
  if (select count(*) from public.retailer_catalogue_child_plans where parent_plan_id=v_parent)<>19
     or (select count(*) from public.retailer_catalogue_child_plans where parent_plan_id=v_parent and status='APPLIED')<>16
     or (select count(*) from public.retailer_catalogue_child_plans where parent_plan_id=v_parent and status='PLANNED')<>3
     or (select coalesce(sum(jsonb_array_length(record_ids)),0) from public.retailer_catalogue_child_plans where parent_plan_id=v_parent and status='APPLIED')<>791
     or (select coalesce(sum(jsonb_array_length(record_ids)),0) from public.retailer_catalogue_child_plans where parent_plan_id=v_parent and status='PLANNED')<>147
     or (select array_agg(batch_index order by batch_index) from public.retailer_catalogue_child_plans where parent_plan_id=v_parent and status='PLANNED')<>array[16,17,18]
     or (select count(*) from public.retailer_catalogue_apply_runs r join public.retailer_catalogue_child_plans c on c.id=r.child_plan_id where c.parent_plan_id=v_parent and r.status='SUCCEEDED')<>16
     or exists(select 1 from public.retailer_catalogue_apply_runs r join public.retailer_catalogue_child_plans c on c.id=r.child_plan_id where c.parent_plan_id=v_parent and r.status='STARTED')
     or (select count(*) from public.retailer_offer_sync_batch_approvals a join public.retailer_catalogue_child_plans c on c.id=a.child_plan_id where c.parent_plan_id=v_parent and a.consumed_at is not null)<>16
     or exists(select 1 from public.retailer_offer_sync_batch_approvals a join public.retailer_catalogue_child_plans c on c.id=a.child_plan_id where c.parent_plan_id=v_parent and a.consumed_at is null and a.closed_at is null)
     or (select coalesce(sum((a.result->>'business_writes')::integer),0) from public.retailer_offer_sync_batch_approvals a join public.retailer_catalogue_child_plans c on c.id=a.child_plan_id where c.parent_plan_id=v_parent and a.consumed_at is not null)<>791
     or (select coalesce(sum((a.result->>'price_history_delta')::integer),0) from public.retailer_offer_sync_batch_approvals a join public.retailer_catalogue_child_plans c on c.id=a.child_plan_id where c.parent_plan_id=v_parent and a.consumed_at is not null)<>0 then
    raise exception 'interrupted 10 Reps child/run/approval precondition mismatch';
  end if;
  update public.retailer_catalogue_child_plans set status='SUPERSEDED',updated_at=v_now,
    audit_log=audit_log||jsonb_build_array(jsonb_build_object('event','INTERRUPTED_REFRESH_SUPERSEDED','at',v_now,'authority','owner-directed-chat-2026-09-19-recover-retailer-refreshes'))
  where parent_plan_id=v_parent and status='PLANNED';
  get diagnostics v_rows=row_count;
  if v_rows<>3 then raise exception 'interrupted 10 Reps child cleanup affected % rows',v_rows; end if;
  update public.retailer_catalogue_parent_plans set status='SUPERSEDED',updated_at=v_now,
    audit_log=audit_log||jsonb_build_array(jsonb_build_object('event','INTERRUPTED_REFRESH_SUPERSEDED','at',v_now,'authority','owner-directed-chat-2026-09-19-recover-retailer-refreshes','preserved_applied_children',16,'preserved_refreshed_offers',791))
  where id=v_parent and status='PARTIALLY_APPLIED';
  get diagnostics v_rows=row_count;
  if v_rows<>1 or public.retailer_catalogue_business_counts() is distinct from v_before
     or (select count(*) from public.retailer_catalogue_child_plans where parent_plan_id=v_parent and status='APPLIED')<>16
     or (select count(*) from public.retailer_catalogue_child_plans where parent_plan_id=v_parent and status='SUPERSEDED')<>3 then
    raise exception 'interrupted 10 Reps cleanup postcondition mismatch';
  end if;
end
$cleanup$;
commit;
