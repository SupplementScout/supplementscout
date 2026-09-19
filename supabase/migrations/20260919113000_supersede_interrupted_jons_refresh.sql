begin;

set local lock_timeout='5s';
set local statement_timeout='60s';

do $cleanup$
declare
  v_target jsonb:=public.retailer_catalogue_actual_database_target();
  v_parent constant uuid:='2c54a71a-50c4-4592-9ad4-64819853934d';
  v_parent_fingerprint constant text:='ea4d7f3f175a75d265c134b0add38cf5c900416a02fe5603d58b542b06316ded';
  v_open_child constant uuid:='001b63da-bcff-4500-a6d3-9b16671b91a8';
  v_open_approval constant uuid:='d92a23d8-e0c9-478a-930d-9d24f0383b6b';
  v_now timestamptz:=clock_timestamp();
  v_before jsonb;
  v_after jsonb;
  v_rows integer;
begin
  if current_user<>'postgres' or v_target->>'target_environment'<>'PRODUCTION'
     or v_target->>'project_ref'<>'aftboxmrdgyhizicfsfu'
     or v_target->>'database_identity'<>'supplementscout-production:aftboxmrdgyhizicfsfu' then
    raise exception 'interrupted Jon''s refresh cleanup target mismatch';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('retailer-offer-sync:global-execution',0));
  perform pg_advisory_xact_lock(hashtextextended('PRODUCTION:10',0));
  v_before:=public.retailer_catalogue_business_counts();
  if v_before<>jsonb_build_object('products',1337,'product_variants',3632,'retailer_products',3758,'offers',3758,'price_history',4072) then
    raise exception 'interrupted Jon''s cleanup catalogue count precondition mismatch';
  end if;

  perform 1 from public.retailer_catalogue_parent_plans p where p.id=v_parent
    and p.parent_plan_fingerprint=v_parent_fingerprint and p.retailer_id=10
    and p.target_environment='PRODUCTION' and p.status='PARTIALLY_APPLIED'
    and p.code_commit='3aa792a086d2212dd152d2db2991228aaa4ae1dc'
    and p.source_snapshot_fingerprint='b4014db705d77b5f74a9db719602a457db899bb3b2c4d7ae775876e320209293'
    and p.source_captured_at='2026-09-19T09:59:19.732Z'::timestamptz
    and p.approval_expires_at='2026-09-19T10:13:48.411Z'::timestamptz
    and p.approval_expires_at<clock_timestamp() for update;
  if not found then raise exception 'interrupted Jon''s parent precondition mismatch'; end if;

  if (select count(*) from public.retailer_catalogue_child_plans where parent_plan_id=v_parent)<>11
     or (select count(*) from public.retailer_catalogue_child_plans where parent_plan_id=v_parent and status='APPLIED')<>3
     or (select count(*) from public.retailer_catalogue_child_plans where parent_plan_id=v_parent and status='APPROVED')<>1
     or (select count(*) from public.retailer_catalogue_child_plans where parent_plan_id=v_parent and status='PLANNED')<>7
     or (select coalesce(sum(jsonb_array_length(record_ids)),0) from public.retailer_catalogue_child_plans where parent_plan_id=v_parent and status='APPLIED')<>138
     or not exists(select 1 from public.retailer_catalogue_child_plans where id=v_open_child and parent_plan_id=v_parent and batch_index=3 and status='APPROVED' and jsonb_array_length(record_ids)=46)
     or (select count(*) from public.retailer_catalogue_apply_runs r join public.retailer_catalogue_child_plans c on c.id=r.child_plan_id where c.parent_plan_id=v_parent and r.status='SUCCEEDED')<>3
     or exists(select 1 from public.retailer_catalogue_apply_runs r join public.retailer_catalogue_child_plans c on c.id=r.child_plan_id where c.parent_plan_id=v_parent and r.status='STARTED')
     or (select coalesce(sum((a.result->>'business_writes')::integer),0) from public.retailer_offer_sync_batch_approvals a join public.retailer_catalogue_child_plans c on c.id=a.child_plan_id where c.parent_plan_id=v_parent and a.consumed_at is not null)<>138
     or (select count(*) from public.retailer_offer_sync_batch_approvals a where a.id=v_open_approval and a.child_plan_id=v_open_child and a.consumed_at is null and a.closed_at is null and a.expires_at<clock_timestamp())<>1 then
    raise exception 'interrupted Jon''s child/run/approval precondition mismatch';
  end if;

  update public.retailer_offer_sync_batch_approvals
  set closed_at=v_now,closed_by='supplementscout-owner-approved-jons-refresh-2026-09-19',
      close_reason='Expired unexecuted child of interrupted freshness-only Jon''s refresh superseded',
      close_request_fingerprint=encode(extensions.digest(convert_to(id::text||':2026-09-19-jons-refresh-recovery','UTF8'),'sha256'),'hex'),
      close_result=jsonb_build_object('status','SUPERSEDED','approval_id',id,'closed_at',v_now,'business_writes',0,'price_history_writes',0)
  where id=v_open_approval and child_plan_id=v_open_child and consumed_at is null and closed_at is null and expires_at<clock_timestamp();
  get diagnostics v_rows=row_count;
  if v_rows<>1 then raise exception 'interrupted Jon''s approval cleanup affected % rows',v_rows; end if;

  update public.retailer_catalogue_child_plans
  set status='SUPERSEDED',updated_at=v_now,audit_log=audit_log||jsonb_build_array(jsonb_build_object(
    'event','INTERRUPTED_FRESHNESS_REFRESH_SUPERSEDED','at',v_now,
    'authority','owner-approved-chat-2026-09-19-refresh-168-ebay-502-jons'))
  where parent_plan_id=v_parent and status in ('PLANNED','APPROVED');
  get diagnostics v_rows=row_count;
  if v_rows<>8 then raise exception 'interrupted Jon''s child cleanup affected % rows',v_rows; end if;

  update public.retailer_catalogue_parent_plans
  set status='SUPERSEDED',updated_at=v_now,audit_log=audit_log||jsonb_build_array(jsonb_build_object(
    'event','INTERRUPTED_FRESHNESS_REFRESH_SUPERSEDED','at',v_now,
    'authority','owner-approved-chat-2026-09-19-refresh-168-ebay-502-jons',
    'preserved_applied_children',3,'preserved_refreshed_offers',138))
  where id=v_parent and status='PARTIALLY_APPLIED';
  get diagnostics v_rows=row_count;
  if v_rows<>1 then raise exception 'interrupted Jon''s parent cleanup affected % rows',v_rows; end if;

  v_after:=public.retailer_catalogue_business_counts();
  if v_after is distinct from v_before
     or (select count(*) from public.retailer_catalogue_child_plans where parent_plan_id=v_parent and status='APPLIED')<>3
     or (select count(*) from public.retailer_catalogue_child_plans where parent_plan_id=v_parent and status='SUPERSEDED')<>8
     or (select status from public.retailer_catalogue_parent_plans where id=v_parent)<>'SUPERSEDED' then
    raise exception 'interrupted Jon''s refresh cleanup postcondition mismatch';
  end if;
end
$cleanup$;

commit;
