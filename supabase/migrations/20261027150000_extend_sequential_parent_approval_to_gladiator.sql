begin;
set local lock_timeout='5s';
set local statement_timeout='120s';

do $guard$
declare
  v_target jsonb:=public.retailer_catalogue_actual_database_target();
  v_function regprocedure:='public.prepare_sequential_retailer_offer_sync_parent_approval(jsonb)'::regprocedure;
  v_definition text:=pg_get_functiondef(v_function);
  v_before jsonb;
  v_after jsonb;
  v_mappings_before text;
  v_offers_before text;
  v_history_before text;
  v_review_before text;
  v_request_before text;
  v_now timestamptz:=clock_timestamp();
  v_rows integer;
begin
  if current_user<>'postgres'
     or v_target->>'target_environment'<>'PRODUCTION'
     or v_target->>'project_ref'<>'aftboxmrdgyhizicfsfu'
     or v_target->>'database_identity'<>'supplementscout-production:aftboxmrdgyhizicfsfu' then
    raise exception 'Gladiator sequential parent approval target mismatch';
  end if;
  if encode(extensions.digest(convert_to(replace(v_definition,chr(13),''),'UTF8'),'sha256'),'hex')
       <>'d0972f334b5a7852a76cc14f877b40ff1a4c5c2b29c2b72382fce5c152862d79'
     or not exists(
       select 1 from pg_proc p
       where p.oid=v_function and p.proowner='postgres'::regrole
         and p.provolatile='v' and p.prosecdef
         and p.proconfig=array['search_path=pg_catalog, public, pg_temp']::text[]
         and p.proacl::text='{postgres=X/postgres,retailer_catalogue_production_approver=X/postgres}'
     ) then
    raise exception 'Gladiator sequential parent approval function lineage mismatch';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('retailer-offer-sync:global-execution',0));
  perform pg_advisory_xact_lock(hashtextextended('PRODUCTION:15',0));
  v_before:=public.retailer_catalogue_business_counts();
  select public.retailer_catalogue_sha256_json(coalesce(jsonb_agg(to_jsonb(rp) order by rp.id),'[]'::jsonb))
    into v_mappings_before from public.retailer_products rp where rp.retailer_id=15;
  select public.retailer_catalogue_sha256_json(coalesce(jsonb_agg(to_jsonb(o) order by o.id),'[]'::jsonb))
    into v_offers_before from public.offers o where o.retailer_id=15;
  select public.retailer_catalogue_sha256_json(coalesce(jsonb_agg(to_jsonb(ph) order by ph.id),'[]'::jsonb))
    into v_history_before
    from public.price_history ph join public.offers o on o.id=ph.offer_id where o.retailer_id=15;
  select public.retailer_catalogue_sha256_json(to_jsonb(q)) into v_review_before
    from public.product_match_review_queue q where q.id=2390;
  select public.retailer_catalogue_sha256_json(to_jsonb(r)) into v_request_before
    from public.automation_review_execution_requests r
    where r.id='b1129cb6-57c7-488e-9f69-7cce63e0bfdb'::uuid;

  perform 1 from public.retailer_catalogue_parent_plans p
  where p.id='6560bd60-bc36-4c52-8f13-32ac3ee84aa2'::uuid
    and p.parent_plan_fingerprint='fe1852be68326a27159eea115a581a1fb33525c9e48cb58f23911acf0f17d7ee'
    and p.retailer_id=15 and p.target_environment='PRODUCTION' and p.status='PLANNED'
    and p.approval_id is null and p.approved_by is null and p.approved_at is null
    and p.approval_expires_at is null and p.approval_consumed_at is null
    and p.created_by='github:SupplementScout/supplementscout:40521391539:1'
    and p.code_commit='40d5e93e8db21c93b9615263fcf5354b51c0011d'
    and p.created_at='2026-10-27T14:29:02.03652Z'::timestamptz
    and p.updated_at='2026-10-27T14:29:02.03652Z'::timestamptz
    and (p.plan_json->>'expires_at')::timestamptz='2026-10-27T15:13:01.354Z'::timestamptz
    and p.source_snapshot_fingerprint='042a167734fc319e3a039a9e128753a814da1a3e5c3891c73a005307024c4efb'
    and p.canonical_snapshot_fingerprint='66cf2bc813e3f542cb883dba7ab1ddd2b467a9666e84ad3a35cf67bced7e0710'
    and p.adapter_fingerprint='24bbd138a39f200ea7a134ee088853b82452915d1d0b259858850f96fbd84137'
    and p.policy_fingerprint='7bb83067fa94c01877616c5dc9b85aeb2fe7a82939c02f3194da1552de8d5290'
    and p.expected_state_fingerprint='66cf2bc813e3f542cb883dba7ab1ddd2b467a9666e84ad3a35cf67bced7e0710'
    and p.audit_log->>'event'='APPROVED_RETAILER_AUTOMATION_PLAN_REGISTERED'
    and p.audit_log->'workflow'->>'run_id'='40521391539'
    and p.audit_log->>'manifest_fingerprint'='834766bb56dd8783677df88a644bdde382fec9070a33801d11919555f4dc958a'
    and p.audit_log->>'approved_manifest_sha256'='F07122185A4D601E9E4172378D2FCF6636E5AB1833C33C749F69BCCD3FCD8078'
    and (p.audit_log->>'operation_count')::integer=20
  for update;
  if not found then raise exception 'Gladiator failed parent precondition mismatch'; end if;

  perform 1 from public.retailer_catalogue_child_plans c
  where c.id='16a6ed2d-931f-4081-969c-bd9340094eff'::uuid
    and c.parent_plan_id='6560bd60-bc36-4c52-8f13-32ac3ee84aa2'::uuid
    and c.child_plan_fingerprint='a3e338a85d7652c174b489e36f2a9525ace22e53d4ed3bf9acb109675dbd3cd1'
    and c.parent_plan_fingerprint='fe1852be68326a27159eea115a581a1fb33525c9e48cb58f23911acf0f17d7ee'
    and c.retailer_id=15 and c.target_environment='PRODUCTION' and c.status='PLANNED'
    and c.batch_index=0 and c.batch_count=1
    and c.approval_id is null and c.approved_at is null
    and c.approval_expires_at is null and c.approval_consumed_at is null
    and c.code_commit='40d5e93e8db21c93b9615263fcf5354b51c0011d'
    and c.created_at='2026-10-27T14:29:02.03652Z'::timestamptz
    and c.updated_at='2026-10-27T14:29:02.03652Z'::timestamptz
    and c.record_ids='["3887","3888","3890","3891","3892","3893","3894","3896","3897","3898","3899","3900","3901","3902","3903","3904","3905","3906","3907","3972"]'::jsonb
    and c.audit_log->>'event'='APPROVED_RETAILER_AUTOMATION_CHILD_REGISTERED'
    and c.audit_log->'workflow'->>'run_id'='40521391539'
    and c.audit_log->>'artifact_fingerprint'='a3e338a85d7652c174b489e36f2a9525ace22e53d4ed3bf9acb109675dbd3cd1'
  for update;
  if not found
     or (select count(*) from public.retailer_catalogue_child_plans where parent_plan_id='6560bd60-bc36-4c52-8f13-32ac3ee84aa2'::uuid)<>1
     or exists(select 1 from public.retailer_catalogue_apply_runs where parent_plan_id='6560bd60-bc36-4c52-8f13-32ac3ee84aa2'::uuid)
     or exists(select 1 from public.retailer_offer_sync_batch_approvals where child_plan_id='16a6ed2d-931f-4081-969c-bd9340094eff'::uuid)
     or exists(select 1 from public.approved_import_plans where run_id='40521391539' or plan_json::text like '%b1129cb6-57c7-488e-9f69-7cce63e0bfdb%' or authorization_envelope::text like '%b1129cb6-57c7-488e-9f69-7cce63e0bfdb%')
     or exists(select 1 from public.retailer_catalogue_production_recovery_manifests where child_plan_id='16a6ed2d-931f-4081-969c-bd9340094eff'::uuid)
     or exists(select 1 from public.retailer_catalogue_production_recovery_approvals where child_plan_id='16a6ed2d-931f-4081-969c-bd9340094eff'::uuid)
     or not exists(select 1 from public.product_match_review_queue where id=2390 and offer_id=3972 and retailer_product_id=4159 and review_status='FAILED' and execution_error_code='P0001')
     or not exists(select 1 from public.automation_review_execution_requests where id='b1129cb6-57c7-488e-9f69-7cce63e0bfdb'::uuid and review_id=2390 and status='FAILED' and run_id='40521391539' and commit_sha='40d5e93e8db21c93b9615263fcf5354b51c0011d' and database_writes=20 and error_code='P0001' and last_checkpoint='EXECUTION_FAILED')
     or (select count(*) from public.retailer_products where retailer_id=15)<>603
     or (select count(*) from public.offers where retailer_id=15)<>603 then
    raise exception 'Gladiator failed child/execution/business precondition mismatch';
  end if;

  update public.retailer_catalogue_child_plans
    set status='SUPERSEDED',updated_at=v_now,
        audit_log=audit_log||jsonb_build_array(jsonb_build_object(
          'event','FAILED_GLADIATOR_PARENT_APPROVAL_SUPERSEDED','at',v_now,
          'authority','owner-task-2026-10-27-shared-parent-approval-fix',
          'reason','SHARED_PARENT_APPROVAL_ALLOWLIST_MISSING_RETAILER_15','business_writes',0))
    where id='16a6ed2d-931f-4081-969c-bd9340094eff'::uuid and status='PLANNED';
  get diagnostics v_rows=row_count;
  if v_rows<>1 then raise exception 'Gladiator child supersede count mismatch'; end if;

  update public.retailer_catalogue_parent_plans
    set status='SUPERSEDED',updated_at=v_now,
        audit_log=audit_log||jsonb_build_array(jsonb_build_object(
          'event','FAILED_GLADIATOR_PARENT_APPROVAL_SUPERSEDED','at',v_now,
          'authority','owner-task-2026-10-27-shared-parent-approval-fix',
          'reason','SHARED_PARENT_APPROVAL_ALLOWLIST_MISSING_RETAILER_15','business_writes',0))
    where id='6560bd60-bc36-4c52-8f13-32ac3ee84aa2'::uuid and status='PLANNED';
  get diagnostics v_rows=row_count;
  if v_rows<>1 then raise exception 'Gladiator parent supersede count mismatch'; end if;

  v_after:=public.retailer_catalogue_business_counts();
  if v_after is distinct from v_before
     or (select public.retailer_catalogue_sha256_json(coalesce(jsonb_agg(to_jsonb(rp) order by rp.id),'[]'::jsonb)) from public.retailer_products rp where rp.retailer_id=15) is distinct from v_mappings_before
     or (select public.retailer_catalogue_sha256_json(coalesce(jsonb_agg(to_jsonb(o) order by o.id),'[]'::jsonb)) from public.offers o where o.retailer_id=15) is distinct from v_offers_before
     or (select public.retailer_catalogue_sha256_json(coalesce(jsonb_agg(to_jsonb(ph) order by ph.id),'[]'::jsonb)) from public.price_history ph join public.offers o on o.id=ph.offer_id where o.retailer_id=15) is distinct from v_history_before
     or (select public.retailer_catalogue_sha256_json(to_jsonb(q)) from public.product_match_review_queue q where q.id=2390) is distinct from v_review_before
     or (select public.retailer_catalogue_sha256_json(to_jsonb(r)) from public.automation_review_execution_requests r where r.id='b1129cb6-57c7-488e-9f69-7cce63e0bfdb'::uuid) is distinct from v_request_before then
    raise exception 'Gladiator failed plan supersede changed protected state';
  end if;
end
$guard$;

create or replace function public.prepare_sequential_retailer_offer_sync_parent_approval(p_request jsonb)
returns jsonb language plpgsql volatile security definer set search_path=pg_catalog,public,pg_temp as $prepare$
declare
  v_effective_role text:=current_setting('role',true);
  v_parent public.retailer_catalogue_parent_plans%rowtype;
  v_workflow jsonb;
  v_expected_actor text;
  v_slug text;
  v_result jsonb;
begin
  if v_effective_role is distinct from 'retailer_catalogue_production_approver'
     or session_user<>'supplementscout_production_approver_login' then
    perform public.retailer_catalogue_raise('RSBI_ENVIRONMENT_BLOCKED','Dedicated production approver identity required');
  end if;
  if not public.atomic_import_has_exact_keys(p_request,array['schema_version','parent_plan_id','parent_plan_fingerprint','retailer_id','approved_by','expires_at','workflow','production_project_ref','production_database_identity'])
     or p_request->>'schema_version'<>'1' then
    perform public.retailer_catalogue_raise('RSBI_SOURCE_SCHEMA_MISMATCH','Invalid sequential parent approval request');
  end if;
  perform public.retailer_catalogue_production_runtime_guard('PRODUCTION',p_request->>'production_project_ref',p_request->>'production_database_identity');
  if (p_request->>'expires_at')::timestamptz<=now()+interval '30 minutes'
     or (p_request->>'expires_at')::timestamptz>now()+interval '45 minutes' then
    perform public.retailer_catalogue_raise('RSBI_APPROVAL_EXPIRED','Sequential parent approval must be between 30 and 45 minutes');
  end if;
  v_workflow:=p_request->'workflow';
  if not public.atomic_import_has_exact_keys(v_workflow,array['repository','run_id','run_attempt','actor'])
     or v_workflow->>'repository'<>'SupplementScout/supplementscout' then
    perform public.retailer_catalogue_raise('RSBI_SOURCE_SCHEMA_MISMATCH','Invalid sequential workflow identity');
  end if;
  select * into v_parent from public.retailer_catalogue_parent_plans where id=(p_request->>'parent_plan_id')::uuid for update;
  if not found or v_parent.parent_plan_fingerprint is distinct from p_request->>'parent_plan_fingerprint'
     or v_parent.retailer_id is distinct from (p_request->>'retailer_id')::bigint
     or v_parent.retailer_id not in (4,5,7,8,9,14,15) or v_parent.target_environment<>'PRODUCTION'
     or v_parent.status<>'PLANNED' or v_parent.approval_id is not null
     or exists(select 1 from public.retailer_catalogue_child_plans c where c.parent_plan_id=v_parent.id and c.status<>'PLANNED') then
    perform public.retailer_catalogue_raise('RSBI_EXPECTED_STATE_MISMATCH','Sequential parent is not a fresh approved-retailer plan');
  end if;
  v_slug:=case v_parent.retailer_id when 4 then 'discount-supplements' when 5 then 'dolphin-fitness' when 7 then 'simply-supplements' when 8 then 'kior-health' when 9 then 'fit-house' when 14 then '10-reps' when 15 then 'gladiator-nutrition' end;
  v_expected_actor:='github-'||v_slug||'-sync:'||(v_workflow->>'run_id');
  if p_request->>'approved_by' is distinct from v_expected_actor
     or v_parent.created_by is distinct from 'github:'||(v_workflow->>'repository')||':'||(v_workflow->>'run_id')||':'||(v_workflow->>'run_attempt') then
    perform public.retailer_catalogue_raise('RSBI_APPROVAL_MISMATCH','Sequential parent workflow identity mismatch');
  end if;
  v_result:=public.approve_retailer_catalogue_parent_plan(v_parent.id,v_parent.parent_plan_fingerprint,v_expected_actor,(p_request->>'expires_at')::timestamptz);
  return v_result||jsonb_build_object('business_writes',0,'retailer_id',v_parent.retailer_id::text);
end
$prepare$;
alter function public.prepare_sequential_retailer_offer_sync_parent_approval(jsonb) owner to postgres;
revoke all on function public.prepare_sequential_retailer_offer_sync_parent_approval(jsonb) from public,anon,authenticated,service_role;
grant execute on function public.prepare_sequential_retailer_offer_sync_parent_approval(jsonb) to retailer_catalogue_production_approver;

do $postflight$
declare
  v_function regprocedure:='public.prepare_sequential_retailer_offer_sync_parent_approval(jsonb)'::regprocedure;
begin
  if encode(extensions.digest(convert_to(replace(pg_get_functiondef(v_function),chr(13),''),'UTF8'),'sha256'),'hex')
       <>'36ec800fd0056c5d556138ef3fe75f5dda627cd6fc6d193f2dc08ce6c1f23309'
     or not exists(
       select 1 from pg_proc p where p.oid=v_function and p.proowner='postgres'::regrole
         and p.provolatile='v' and p.prosecdef
         and p.proconfig=array['search_path=pg_catalog, public, pg_temp']::text[]
         and p.proacl::text='{postgres=X/postgres,retailer_catalogue_production_approver=X/postgres}'
     )
     or not exists(select 1 from public.retailer_catalogue_parent_plans where id='6560bd60-bc36-4c52-8f13-32ac3ee84aa2'::uuid and status='SUPERSEDED')
     or not exists(select 1 from public.retailer_catalogue_child_plans where id='16a6ed2d-931f-4081-969c-bd9340094eff'::uuid and status='SUPERSEDED') then
    raise exception 'Gladiator sequential parent approval postflight mismatch';
  end if;
end
$postflight$;

commit;
