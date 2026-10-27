begin;
set local lock_timeout='5s';
set local statement_timeout='60s';

do $guard$
declare
  v_target jsonb:=public.retailer_catalogue_actual_database_target();
  v_function regprocedure:='public.prepare_sequential_retailer_offer_sync_parent_approval(jsonb)'::regprocedure;
begin
  if current_user<>'postgres'
     or v_target->>'target_environment'<>'PRODUCTION'
     or v_target->>'project_ref'<>'aftboxmrdgyhizicfsfu'
     or v_target->>'database_identity'<>'supplementscout-production:aftboxmrdgyhizicfsfu' then
    raise exception 'Gladiator sequential parent approval rollback target mismatch';
  end if;
  if encode(extensions.digest(convert_to(replace(pg_get_functiondef(v_function),chr(13),''),'UTF8'),'sha256'),'hex')
       <>'36ec800fd0056c5d556138ef3fe75f5dda627cd6fc6d193f2dc08ce6c1f23309'
     or not exists(
       select 1 from pg_proc p where p.oid=v_function and p.proowner='postgres'::regrole
         and p.provolatile='v' and p.prosecdef
         and p.proconfig=array['search_path=pg_catalog, public, pg_temp']::text[]
         and p.proacl::text='{postgres=X/postgres,retailer_catalogue_production_approver=X/postgres}'
     ) then
    raise exception 'Gladiator sequential parent approval rollback lineage mismatch';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('retailer-offer-sync:global-execution',0));
  perform pg_advisory_xact_lock(hashtextextended('PRODUCTION:15',0));
  if not exists(
       select 1 from public.retailer_catalogue_parent_plans
       where id='6560bd60-bc36-4c52-8f13-32ac3ee84aa2'::uuid and status='SUPERSEDED'
         and audit_log @> '[{"event":"FAILED_GLADIATOR_PARENT_APPROVAL_SUPERSEDED","authority":"owner-task-2026-10-27-shared-parent-approval-fix","reason":"SHARED_PARENT_APPROVAL_ALLOWLIST_MISSING_RETAILER_15","business_writes":0}]'::jsonb
     )
     or not exists(
       select 1 from public.retailer_catalogue_child_plans
       where id='16a6ed2d-931f-4081-969c-bd9340094eff'::uuid and status='SUPERSEDED'
         and audit_log @> '[{"event":"FAILED_GLADIATOR_PARENT_APPROVAL_SUPERSEDED","authority":"owner-task-2026-10-27-shared-parent-approval-fix","reason":"SHARED_PARENT_APPROVAL_ALLOWLIST_MISSING_RETAILER_15","business_writes":0}]'::jsonb
     ) then
    raise exception 'Gladiator terminal supersede evidence mismatch';
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
     or v_parent.retailer_id not in (4,5,7,8,9,14) or v_parent.target_environment<>'PRODUCTION'
     or v_parent.status<>'PLANNED' or v_parent.approval_id is not null
     or exists(select 1 from public.retailer_catalogue_child_plans c where c.parent_plan_id=v_parent.id and c.status<>'PLANNED') then
    perform public.retailer_catalogue_raise('RSBI_EXPECTED_STATE_MISMATCH','Sequential parent is not a fresh approved-retailer plan');
  end if;
  v_slug:=case v_parent.retailer_id when 4 then 'discount-supplements' when 5 then 'dolphin-fitness' when 7 then 'simply-supplements' when 8 then 'kior-health' when 9 then 'fit-house' when 14 then '10-reps' end;
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
       <>'d0972f334b5a7852a76cc14f877b40ff1a4c5c2b29c2b72382fce5c152862d79'
     or not exists(
       select 1 from pg_proc p where p.oid=v_function and p.proowner='postgres'::regrole
         and p.provolatile='v' and p.prosecdef
         and p.proconfig=array['search_path=pg_catalog, public, pg_temp']::text[]
         and p.proacl::text='{postgres=X/postgres,retailer_catalogue_production_approver=X/postgres}'
     )
     or not exists(select 1 from public.retailer_catalogue_parent_plans where id='6560bd60-bc36-4c52-8f13-32ac3ee84aa2'::uuid and status='SUPERSEDED')
     or not exists(select 1 from public.retailer_catalogue_child_plans where id='16a6ed2d-931f-4081-969c-bd9340094eff'::uuid and status='SUPERSEDED') then
    raise exception 'Gladiator sequential parent approval rollback postflight mismatch';
  end if;
end
$postflight$;

commit;
