begin;
set local lock_timeout='5s';
set local statement_timeout='60s';

do $repair$
declare
  v_target jsonb:=public.retailer_catalogue_actual_database_target();
  v_parent constant uuid:='c8656839-4b23-4316-991a-1984a4a0bef6';
  v_before jsonb;
  v_now timestamptz:=clock_timestamp();
  v_rows integer;
  v_function regprocedure;
  v_definition text;
begin
  if current_user<>'postgres' or v_target->>'target_environment'<>'PRODUCTION'
     or v_target->>'project_ref'<>'aftboxmrdgyhizicfsfu'
     or v_target->>'database_identity'<>'supplementscout-production:aftboxmrdgyhizicfsfu' then
    raise exception 'sequential refresh repair target mismatch';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('retailer-offer-sync:global-execution',0));
  perform pg_advisory_xact_lock(hashtextextended('PRODUCTION:14',0));
  v_before:=public.retailer_catalogue_business_counts();

  perform 1 from public.retailer_catalogue_parent_plans p where p.id=v_parent
    and p.parent_plan_fingerprint='24cad8b610b6b84292597f0cbffaa71463350d737c7754cdc7f9204da741c38f'
    and p.retailer_id=14 and p.target_environment='PRODUCTION' and p.status='PARTIALLY_APPLIED'
    and p.code_commit='e8ac42e5ac85ec71cf05c189b88e385f21d9b1da'
    and p.source_snapshot_fingerprint='4ac2def92a63eb99924a8481a2ac48050b85ee234d09f39f72f6b4f14f0e62a0'
    and p.source_captured_at='2026-09-19T18:00:16.096Z'::timestamptz
    and p.approval_expires_at='2026-09-19T18:15:15.420Z'::timestamptz
    and p.approval_expires_at<clock_timestamp() for update;
  if not found then raise exception 'current 10 Reps parent precondition mismatch'; end if;
  if (select count(*) from public.retailer_catalogue_child_plans where parent_plan_id=v_parent)<>19
     or (select count(*) from public.retailer_catalogue_child_plans where parent_plan_id=v_parent and status='APPLIED')<>15
     or (select count(*) from public.retailer_catalogue_child_plans where parent_plan_id=v_parent and status='PLANNED')<>4
     or (select coalesce(sum(jsonb_array_length(record_ids)),0) from public.retailer_catalogue_child_plans where parent_plan_id=v_parent and status='APPLIED')<>739
     or (select coalesce(sum(jsonb_array_length(record_ids)),0) from public.retailer_catalogue_child_plans where parent_plan_id=v_parent and status='PLANNED')<>196
     or (select array_agg(batch_index order by batch_index) from public.retailer_catalogue_child_plans where parent_plan_id=v_parent and status='PLANNED')<>array[15,16,17,18]
     or (select count(*) from public.retailer_catalogue_apply_runs where parent_plan_id=v_parent and status='SUCCEEDED')<>15
     or exists(select 1 from public.retailer_catalogue_apply_runs where parent_plan_id=v_parent and status='STARTED')
     or (select count(*) from public.retailer_offer_sync_batch_approvals a join public.retailer_catalogue_child_plans c on c.id=a.child_plan_id where c.parent_plan_id=v_parent and a.consumed_at is not null)<>15
     or exists(select 1 from public.retailer_offer_sync_batch_approvals a join public.retailer_catalogue_child_plans c on c.id=a.child_plan_id where c.parent_plan_id=v_parent and a.consumed_at is null and a.closed_at is null)
     or (select coalesce(sum((a.result->>'business_writes')::integer),0) from public.retailer_offer_sync_batch_approvals a join public.retailer_catalogue_child_plans c on c.id=a.child_plan_id where c.parent_plan_id=v_parent and a.consumed_at is not null)<>739 then
    raise exception 'current 10 Reps child/run/approval precondition mismatch';
  end if;
  update public.retailer_catalogue_child_plans set status='SUPERSEDED',updated_at=v_now,
    audit_log=audit_log||jsonb_build_array(jsonb_build_object('event','EXPIRED_SEQUENTIAL_REFRESH_SUPERSEDED','at',v_now,'authority','owner-approved-chat-2026-09-19'))
  where parent_plan_id=v_parent and status='PLANNED';
  get diagnostics v_rows=row_count;
  if v_rows<>4 then raise exception 'expected four planned children, got %',v_rows; end if;
  update public.retailer_catalogue_parent_plans set status='SUPERSEDED',updated_at=v_now,
    audit_log=audit_log||jsonb_build_array(jsonb_build_object('event','EXPIRED_SEQUENTIAL_REFRESH_SUPERSEDED','at',v_now,'authority','owner-approved-chat-2026-09-19','preserved_applied_children',15,'preserved_refreshed_offers',739))
  where id=v_parent and status='PARTIALLY_APPLIED';
  get diagnostics v_rows=row_count;
  if v_rows<>1 then raise exception 'parent cleanup mismatch'; end if;

  foreach v_function in array array[
    to_regprocedure('public.register_retailer_offer_sync_control_plan(jsonb)'),
    to_regprocedure('public.register_fit_house_offer_sync_control_plan(jsonb)')
  ] loop
    if v_function is null then raise exception 'required registration function missing'; end if;
    select pg_get_functiondef(v_function) into v_definition;
    if strpos(v_definition,'v_expires_at > now()+interval ''15 minutes''')=0 then
      raise exception 'registration expiry guard definition mismatch: %',v_function;
    end if;
    v_definition:=replace(v_definition,'v_expires_at > now()+interval ''15 minutes''','v_expires_at > now()+interval ''45 minutes''');
    execute v_definition;
  end loop;

  if public.retailer_catalogue_business_counts() is distinct from v_before
     or (select count(*) from public.retailer_catalogue_child_plans where parent_plan_id=v_parent and status='APPLIED')<>15
     or (select count(*) from public.retailer_catalogue_child_plans where parent_plan_id=v_parent and status='SUPERSEDED')<>4 then
    raise exception 'sequential refresh repair postcondition mismatch';
  end if;
end
$repair$;
commit;
