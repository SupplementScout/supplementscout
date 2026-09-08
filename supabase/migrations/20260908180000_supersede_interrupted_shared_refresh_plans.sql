begin;

set local lock_timeout='5s';
set local statement_timeout='60s';

do $cleanup$
declare
  v_target jsonb:=public.retailer_catalogue_actual_database_target();
  v_fit_parent constant uuid:='c2e1d342-072d-4fc0-aefa-79c345ab4e3b';
  v_fit_fingerprint constant text:='36c5e024442662bdd599c0946c8d607788ecd75d80d03d50f712af5c2ccee5f6';
  v_ten_parent constant uuid:='c0290d21-70f8-46fb-a7d8-5eda0ed389f2';
  v_ten_fingerprint constant text:='84eadbcafb859cb1515672fb56cad9447afa9850c368077378f677f5a2031de3';
  v_now timestamptz:=clock_timestamp();
  v_rows integer;
  v_before jsonb;
  v_after jsonb;
begin
  if current_user<>'postgres' or v_target->>'target_environment'<>'PRODUCTION'
     or v_target->>'project_ref'<>'aftboxmrdgyhizicfsfu'
     or v_target->>'database_identity'<>'supplementscout-production:aftboxmrdgyhizicfsfu' then
    raise exception 'interrupted shared refresh cleanup target mismatch';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('PRODUCTION:9',0));
  perform pg_advisory_xact_lock(hashtextextended('PRODUCTION:14',0));
  v_before:=public.retailer_catalogue_business_counts();
  if v_before<>jsonb_build_object('products',1337,'product_variants',3632,'retailer_products',3758,'offers',3758,'price_history',4053) then
    raise exception 'interrupted shared refresh cleanup catalogue count precondition mismatch';
  end if;

  perform 1 from public.retailer_catalogue_parent_plans p where p.id=v_fit_parent
    and p.parent_plan_fingerprint=v_fit_fingerprint and p.retailer_id=9
    and p.target_environment='PRODUCTION' and p.status='PARTIALLY_APPLIED'
    and p.code_commit='5769a15392589ee29a56d58fc367fa94555875bc'
    and p.source_snapshot_fingerprint='99a9a2a94a7a2f7ced160c4b9b1fbf072ea089f2bcbbb54b3880ed0771f7ce5a'
    and p.source_captured_at='2026-09-08T15:34:30.503Z'::timestamptz
    and p.approval_expires_at='2026-09-08T15:48:51.300Z'::timestamptz
    and p.approval_expires_at<clock_timestamp() and p.approval_consumed_at is not null for update;
  if not found then raise exception 'interrupted Fit House parent precondition mismatch'; end if;

  perform 1 from public.retailer_catalogue_parent_plans p where p.id=v_ten_parent
    and p.parent_plan_fingerprint=v_ten_fingerprint and p.retailer_id=14
    and p.target_environment='PRODUCTION' and p.status='PARTIALLY_APPLIED'
    and p.code_commit='5769a15392589ee29a56d58fc367fa94555875bc'
    and p.source_snapshot_fingerprint='47e3aa94be866b5ddec529f0c053f3f2c26f32368dcb0b0b50b2ce5f4beef034'
    and p.source_captured_at='2026-09-08T15:34:48.206Z'::timestamptz
    and p.approval_expires_at='2026-09-08T15:49:45.311Z'::timestamptz
    and p.approval_expires_at<clock_timestamp() and p.approval_consumed_at is not null for update;
  if not found then raise exception 'interrupted 10 Reps parent precondition mismatch'; end if;

  if (select count(*) from public.retailer_catalogue_child_plans where parent_plan_id=v_fit_parent)<>6
     or (select count(*) from public.retailer_catalogue_child_plans where parent_plan_id=v_fit_parent and status='APPLIED')<>4
     or (select count(*) from public.retailer_catalogue_child_plans where parent_plan_id=v_fit_parent and status='APPROVED')<>1
     or (select count(*) from public.retailer_catalogue_child_plans where parent_plan_id=v_fit_parent and status='PLANNED')<>1
     or (select coalesce(sum(jsonb_array_length(record_ids)),0) from public.retailer_catalogue_child_plans where parent_plan_id=v_fit_parent and status='APPLIED')<>192
     or (select count(*) from public.retailer_catalogue_apply_runs r join public.retailer_catalogue_child_plans c on c.id=r.child_plan_id where c.parent_plan_id=v_fit_parent and r.status='SUCCEEDED')<>4
     or exists(select 1 from public.retailer_catalogue_apply_runs r join public.retailer_catalogue_child_plans c on c.id=r.child_plan_id where c.parent_plan_id=v_fit_parent and r.status='STARTED')
     or (select count(*) from public.retailer_offer_sync_batch_approvals a join public.retailer_catalogue_child_plans c on c.id=a.child_plan_id where c.parent_plan_id=v_fit_parent and a.consumed_at is null and a.closed_at is null and a.expires_at<clock_timestamp())<>1 then
    raise exception 'interrupted Fit House child/run/approval precondition mismatch';
  end if;
  if (select count(*) from public.retailer_catalogue_child_plans where parent_plan_id=v_ten_parent)<>19
     or (select count(*) from public.retailer_catalogue_child_plans where parent_plan_id=v_ten_parent and status='APPLIED')<>1
     or (select count(*) from public.retailer_catalogue_child_plans where parent_plan_id=v_ten_parent and status='APPROVED')<>1
     or (select count(*) from public.retailer_catalogue_child_plans where parent_plan_id=v_ten_parent and status='PLANNED')<>17
     or (select coalesce(sum(jsonb_array_length(record_ids)),0) from public.retailer_catalogue_child_plans where parent_plan_id=v_ten_parent and status='APPLIED')<>50
     or (select count(*) from public.retailer_catalogue_apply_runs r join public.retailer_catalogue_child_plans c on c.id=r.child_plan_id where c.parent_plan_id=v_ten_parent and r.status='SUCCEEDED')<>1
     or exists(select 1 from public.retailer_catalogue_apply_runs r join public.retailer_catalogue_child_plans c on c.id=r.child_plan_id where c.parent_plan_id=v_ten_parent and r.status='STARTED')
     or (select count(*) from public.retailer_offer_sync_batch_approvals a join public.retailer_catalogue_child_plans c on c.id=a.child_plan_id where c.parent_plan_id=v_ten_parent and a.consumed_at is null and a.closed_at is null and a.expires_at<clock_timestamp())<>1 then
    raise exception 'interrupted 10 Reps child/run/approval precondition mismatch';
  end if;

  update public.retailer_offer_sync_batch_approvals a
  set closed_at=v_now,closed_by='owner-approved-shared-refresh-cleanup',
      close_reason='Interrupted expired shared refresh plan superseded',
      close_request_fingerprint=encode(extensions.digest(convert_to(a.id::text||':2026-09-08-interrupted-shared-refresh','UTF8'),'sha256'),'hex'),
      close_result=jsonb_build_object('status','SUPERSEDED','approval_id',a.id,'closed_at',v_now,'business_writes',0,'price_history_writes',0)
  from public.retailer_catalogue_child_plans c
  where a.child_plan_id=c.id and c.parent_plan_id in (v_fit_parent,v_ten_parent)
    and a.consumed_at is null and a.closed_at is null and a.expires_at<clock_timestamp();
  get diagnostics v_rows=row_count;
  if v_rows<>2 then raise exception 'interrupted shared refresh approval cleanup affected % rows',v_rows; end if;

  update public.retailer_catalogue_child_plans
  set status='SUPERSEDED',updated_at=v_now,audit_log=audit_log||jsonb_build_array(jsonb_build_object(
    'event','INTERRUPTED_SHARED_REFRESH_SUPERSEDED','at',v_now,'authority','owner-approved-chat-2026-09-08-shared-refresh-cleanup'))
  where parent_plan_id in (v_fit_parent,v_ten_parent) and status in ('PLANNED','APPROVED');
  get diagnostics v_rows=row_count;
  if v_rows<>20 then raise exception 'interrupted shared refresh child cleanup affected % rows',v_rows; end if;

  update public.retailer_catalogue_parent_plans
  set status='SUPERSEDED',updated_at=v_now,audit_log=audit_log||jsonb_build_array(jsonb_build_object(
    'event','INTERRUPTED_SHARED_REFRESH_SUPERSEDED','at',v_now,'authority','owner-approved-chat-2026-09-08-shared-refresh-cleanup',
    'preserved_applied_children',case when id=v_fit_parent then 4 else 1 end,
    'preserved_refreshed_offers',case when id=v_fit_parent then 192 else 50 end))
  where id in (v_fit_parent,v_ten_parent) and status='PARTIALLY_APPLIED';
  get diagnostics v_rows=row_count;
  if v_rows<>2 then raise exception 'interrupted shared refresh parent cleanup affected % rows',v_rows; end if;

  v_after:=public.retailer_catalogue_business_counts();
  if v_after is distinct from v_before
     or exists(select 1 from public.retailer_catalogue_child_plans where parent_plan_id in (v_fit_parent,v_ten_parent) and status not in ('APPLIED','SUPERSEDED'))
     or (select count(*) from public.retailer_catalogue_child_plans where parent_plan_id in (v_fit_parent,v_ten_parent) and status='APPLIED')<>5
     or (select count(*) from public.retailer_catalogue_child_plans where parent_plan_id in (v_fit_parent,v_ten_parent) and status='SUPERSEDED')<>20
     or (select count(*) from public.retailer_catalogue_parent_plans where id in (v_fit_parent,v_ten_parent) and status='SUPERSEDED')<>2 then
    raise exception 'interrupted shared refresh cleanup postcondition mismatch';
  end if;
end
$cleanup$;

commit;
