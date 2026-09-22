begin;
set local lock_timeout='5s';
set local statement_timeout='60s';

do $cleanup$
declare
  v_target jsonb:=public.retailer_catalogue_actual_database_target();
  v_before jsonb;
  v_after jsonb;
  v_now timestamptz:=clock_timestamp();
  v_plan record;
  v_rows integer;
begin
  if current_user<>'postgres' or v_target->>'target_environment'<>'PRODUCTION'
     or v_target->>'project_ref'<>'aftboxmrdgyhizicfsfu'
     or v_target->>'database_identity'<>'supplementscout-production:aftboxmrdgyhizicfsfu' then
    raise exception 'failed-refresh cleanup target mismatch';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('retailer-offer-sync:global-execution',0));
  perform pg_advisory_xact_lock(hashtextextended('PRODUCTION:4',0));
  perform pg_advisory_xact_lock(hashtextextended('PRODUCTION:5',0));
  perform pg_advisory_xact_lock(hashtextextended('PRODUCTION:8',0));
  v_before:=public.retailer_catalogue_business_counts();

  for v_plan in
    select * from (values
      ('dfdaaaa4-fd5a-4fe8-b775-a019f61b79ae'::uuid,4::bigint,'61071c3345db0f257d824928aae26dd6c3ace24fcb64fd072d26647b5665b1f8'::text,'github:SupplementScout/supplementscout:35730589993:1'::text,'2026-09-22T13:44:30.909Z'::timestamptz,3::integer),
      ('9c3bb11e-797c-4dbf-86f8-1084c6dc09fc'::uuid,5::bigint,'e615ef54055888bb4dc06dfb2424fcff6967c5b4b744214d5d0c14e8c07bd988'::text,'github:SupplementScout/supplementscout:35730593515:1'::text,'2026-09-22T13:44:24.766Z'::timestamptz,1::integer),
      ('541138a2-3df3-4ca6-8563-3ec9550b459b'::uuid,8::bigint,'516eda5e64a14472926683f962e1fcfc6c9fcaaa7e45d8bd69973d866878b125'::text,'github:SupplementScout/supplementscout:35729432643:1'::text,'2026-09-22T13:33:05.540Z'::timestamptz,1::integer)
    ) as exact(id,retailer_id,fingerprint,created_by,expires_at,children)
  loop
    perform 1 from public.retailer_catalogue_parent_plans p
    where p.id=v_plan.id and p.retailer_id=v_plan.retailer_id
      and p.parent_plan_fingerprint=v_plan.fingerprint
      and p.created_by=v_plan.created_by
      and p.target_environment='PRODUCTION' and p.status='PLANNED'
      and p.approval_id is null and p.approval_consumed_at is null
      and (p.plan_json->>'expires_at')::timestamptz=v_plan.expires_at
      and v_plan.expires_at<v_now
    for update;
    if not found then raise exception 'failed-refresh parent precondition mismatch: %',v_plan.id; end if;
    if (select count(*) from public.retailer_catalogue_child_plans c where c.parent_plan_id=v_plan.id)<>v_plan.children
       or (select count(*) from public.retailer_catalogue_child_plans c where c.parent_plan_id=v_plan.id and c.status='PLANNED')<>v_plan.children
       or exists(select 1 from public.retailer_catalogue_apply_runs r join public.retailer_catalogue_child_plans c on c.id=r.child_plan_id where c.parent_plan_id=v_plan.id)
       or exists(select 1 from public.retailer_offer_sync_batch_approvals a join public.retailer_catalogue_child_plans c on c.id=a.child_plan_id where c.parent_plan_id=v_plan.id) then
      raise exception 'failed-refresh child/run/approval precondition mismatch: %',v_plan.id;
    end if;
    update public.retailer_catalogue_child_plans
      set status='SUPERSEDED',updated_at=v_now,audit_log=audit_log||jsonb_build_array(jsonb_build_object('event','EXPIRED_FAILED_REFRESH_SUPERSEDED','at',v_now,'authority','owner-chat-2026-09-22-retry-three-retailers'))
      where parent_plan_id=v_plan.id and status='PLANNED';
    get diagnostics v_rows=row_count;
    if v_rows<>v_plan.children then raise exception 'failed-refresh child cleanup count mismatch: %',v_plan.id; end if;
    update public.retailer_catalogue_parent_plans
      set status='SUPERSEDED',updated_at=v_now,audit_log=audit_log||jsonb_build_array(jsonb_build_object('event','EXPIRED_FAILED_REFRESH_SUPERSEDED','at',v_now,'authority','owner-chat-2026-09-22-retry-three-retailers','business_writes',0))
      where id=v_plan.id and status='PLANNED';
    get diagnostics v_rows=row_count;
    if v_rows<>1 then raise exception 'failed-refresh parent cleanup count mismatch: %',v_plan.id; end if;
  end loop;
  v_after:=public.retailer_catalogue_business_counts();
  if v_after is distinct from v_before then raise exception 'failed-refresh cleanup changed business counts'; end if;
end
$cleanup$;

commit;
