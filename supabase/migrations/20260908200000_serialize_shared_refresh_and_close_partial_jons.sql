begin;

set local lock_timeout='5s';
set local statement_timeout='60s';

create or replace function public.execute_retailer_offer_sync_batch(p_request jsonb)
returns jsonb
language plpgsql
volatile
security invoker
set search_path=pg_catalog,public,pg_temp
as $execute_wrapper$
begin
  if current_user<>'retailer_catalogue_production_executor' then
    raise exception 'mixed-batch execution requires the dedicated executor role';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('retailer-offer-sync:global-execution',0));
  return public.retailer_offer_sync_execute_batch_internal(p_request);
end
$execute_wrapper$;

do $cleanup$
declare
  v_target jsonb:=public.retailer_catalogue_actual_database_target();
  v_parent constant uuid:='8079673c-ae56-47df-9aec-60e11060f736';
  v_parent_fingerprint constant text:='bb40a9ab0baf8623f652ae01aafd0cf2851ee55a84004409ded758decc969ee2';
  v_applied_child constant uuid:='f9a906f7-f870-4226-9b31-de8e4cb257ef';
  v_open_child constant uuid:='870a4a80-9b0e-4b86-bbda-98433293d50e';
  v_open_approval constant uuid:='fdd2f32a-90b0-4c0c-8f64-48a2c7e66b0a';
  v_now timestamptz:=clock_timestamp();
  v_before jsonb;
  v_after jsonb;
  v_rows integer;
begin
  if current_user<>'postgres' or v_target->>'target_environment'<>'PRODUCTION'
     or v_target->>'project_ref'<>'aftboxmrdgyhizicfsfu'
     or v_target->>'database_identity'<>'supplementscout-production:aftboxmrdgyhizicfsfu' then
    raise exception 'partial Jon''s refresh cleanup target mismatch';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('retailer-offer-sync:global-execution',0));
  perform pg_advisory_xact_lock(hashtextextended('PRODUCTION:10',0));
  v_before:=public.retailer_catalogue_business_counts();
  if v_before<>jsonb_build_object('products',1337,'product_variants',3632,'retailer_products',3758,'offers',3758,'price_history',4053) then
    raise exception 'partial Jon''s refresh cleanup catalogue count precondition mismatch';
  end if;

  perform 1 from public.retailer_catalogue_parent_plans p where p.id=v_parent
    and p.parent_plan_fingerprint=v_parent_fingerprint and p.retailer_id=10
    and p.target_environment='PRODUCTION' and p.status='PARTIALLY_APPLIED'
    and p.code_commit='a861f0a59a06e02f79273e0d9f585d40275c9b2b'
    and p.source_snapshot_fingerprint='c672471fb70d6ed0e63f62d0313c52713e003265235a989b36e5afe7f2dd4af2'
    and p.source_captured_at='2026-09-08T19:37:12.638Z'::timestamptz
    and p.approval_expires_at='2026-09-08T19:51:26.390Z'::timestamptz
    and p.approval_expires_at<clock_timestamp() for update;
  if not found then raise exception 'partial Jon''s parent precondition mismatch'; end if;

  if (select count(*) from public.retailer_catalogue_child_plans where parent_plan_id=v_parent)<>11
     or (select count(*) from public.retailer_catalogue_child_plans where parent_plan_id=v_parent and status='APPLIED')<>1
     or (select count(*) from public.retailer_catalogue_child_plans where parent_plan_id=v_parent and status='APPROVED')<>1
     or (select count(*) from public.retailer_catalogue_child_plans where parent_plan_id=v_parent and status='PLANNED')<>9
     or not exists(select 1 from public.retailer_catalogue_child_plans where id=v_applied_child and parent_plan_id=v_parent and status='APPLIED' and jsonb_array_length(record_ids)=50)
     or not exists(select 1 from public.retailer_catalogue_child_plans where id=v_open_child and parent_plan_id=v_parent and status='APPROVED' and jsonb_array_length(record_ids)=50)
     or (select count(*) from public.retailer_catalogue_apply_runs r join public.retailer_catalogue_child_plans c on c.id=r.child_plan_id where c.parent_plan_id=v_parent and r.status='SUCCEEDED')<>1
     or exists(select 1 from public.retailer_catalogue_apply_runs r join public.retailer_catalogue_child_plans c on c.id=r.child_plan_id where c.parent_plan_id=v_parent and r.status='STARTED')
     or (select count(*) from public.retailer_offer_sync_batch_approvals a where a.id=v_open_approval and a.child_plan_id=v_open_child and a.consumed_at is null and a.closed_at is null and a.expires_at<clock_timestamp())<>1 then
    raise exception 'partial Jon''s child/run/approval precondition mismatch';
  end if;

  update public.retailer_offer_sync_batch_approvals
  set closed_at=v_now,closed_by='supplementscout-owner-approved-six-retailer-recovery',
      close_reason='Expired unexecuted child of partial refresh superseded',
      close_request_fingerprint=encode(extensions.digest(convert_to(id::text||':2026-09-08-serialized-refresh-recovery','UTF8'),'sha256'),'hex'),
      close_result=jsonb_build_object('status','SUPERSEDED','approval_id',id,'closed_at',v_now,'business_writes',0,'price_history_writes',0)
  where id=v_open_approval and child_plan_id=v_open_child and consumed_at is null and closed_at is null and expires_at<clock_timestamp();
  get diagnostics v_rows=row_count;
  if v_rows<>1 then raise exception 'partial Jon''s approval cleanup affected % rows',v_rows; end if;

  update public.retailer_catalogue_child_plans
  set status='SUPERSEDED',updated_at=v_now,audit_log=audit_log||jsonb_build_array(jsonb_build_object(
    'event','EXPIRED_PARTIAL_REFRESH_SUPERSEDED','at',v_now,'authority','owner-approved-chat-2026-09-08-six-retailer-recovery'))
  where parent_plan_id=v_parent and status in ('PLANNED','APPROVED');
  get diagnostics v_rows=row_count;
  if v_rows<>10 then raise exception 'partial Jon''s child cleanup affected % rows',v_rows; end if;

  update public.retailer_catalogue_parent_plans
  set status='SUPERSEDED',updated_at=v_now,audit_log=audit_log||jsonb_build_array(jsonb_build_object(
    'event','EXPIRED_PARTIAL_REFRESH_SUPERSEDED','at',v_now,'authority','owner-approved-chat-2026-09-08-six-retailer-recovery',
    'preserved_applied_children',1,'preserved_refreshed_offers',50))
  where id=v_parent and status='PARTIALLY_APPLIED';
  get diagnostics v_rows=row_count;
  if v_rows<>1 then raise exception 'partial Jon''s parent cleanup affected % rows',v_rows; end if;

  v_after:=public.retailer_catalogue_business_counts();
  if v_after is distinct from v_before
     or not exists(select 1 from public.retailer_catalogue_child_plans where id=v_applied_child and status='APPLIED')
     or (select count(*) from public.retailer_catalogue_child_plans where parent_plan_id=v_parent and status='SUPERSEDED')<>10
     or not exists(select 1 from public.retailer_catalogue_parent_plans where id=v_parent and status='SUPERSEDED') then
    raise exception 'partial Jon''s refresh cleanup postcondition mismatch';
  end if;
end
$cleanup$;

revoke all on function public.execute_retailer_offer_sync_batch(jsonb) from public,anon,authenticated,service_role,retailer_catalogue_production_validator,retailer_catalogue_production_approver;
grant execute on function public.execute_retailer_offer_sync_batch(jsonb) to retailer_catalogue_production_executor;

commit;
