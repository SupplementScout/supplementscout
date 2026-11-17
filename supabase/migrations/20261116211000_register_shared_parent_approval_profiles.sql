begin;
set local lock_timeout='5s';
set local statement_timeout='60s';

-- PREPARATION ONLY: not selected for automatic migration. No control cleanup,
-- no catalogue/approval writes, no new approval path and no change to existing roles.
do $guard$
declare p pg_proc%rowtype; target jsonb:=public.retailer_catalogue_actual_database_target();
begin
  if current_user<>'postgres' or target->>'target_environment' is distinct from 'PRODUCTION' or target->>'project_ref' is distinct from 'aftboxmrdgyhizicfsfu' or target->>'database_identity' is distinct from 'supplementscout-production:aftboxmrdgyhizicfsfu' then raise exception 'PARENT_PROFILE_PROPOSAL_TARGET_MISMATCH'; end if;
  select * into p from pg_proc where oid='public.prepare_sequential_retailer_offer_sync_parent_approval(jsonb)'::regprocedure;
  if encode(sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex') is distinct from '36ec800fd0056c5d556138ef3fe75f5dda627cd6fc6d193f2dc08ce6c1f23309' or pg_get_userbyid(p.proowner)<>'postgres' or not p.prosecdef or p.provolatile<>'v' or p.proconfig is distinct from array['search_path=pg_catalog, public, pg_temp']::text[] or p.proacl::text is distinct from '{postgres=X/postgres,retailer_catalogue_production_approver=X/postgres}' then raise exception 'PARENT_PROFILE_PROPOSAL_LINEAGE_MISMATCH'; end if;
  if to_regprocedure('public.retailer_offer_sync_parent_profiles()') is not null then raise exception 'PARENT_PROFILE_REGISTRY_ALREADY_EXISTS'; end if;
end
$guard$;

-- Closed registration data, not an approval endpoint. Existing seven profiles keep
-- exactly their prior eligibility; only the separately owner-approved H&B manifest
-- may use the new profile. No caller-supplied profile rows or public grants.
create function public.retailer_offer_sync_parent_profiles()
returns table(retailer_id bigint,retailer_slug text,required_manifest_sha256 text)
language sql immutable security invoker set search_path=''
as $profiles$
  values
    (4::bigint,'discount-supplements'::text,null::text),
    (5::bigint,'dolphin-fitness'::text,null::text),
    (7::bigint,'simply-supplements'::text,null::text),
    (8::bigint,'kior-health'::text,null::text),
    (9::bigint,'fit-house'::text,null::text),
    (14::bigint,'10-reps'::text,null::text),
    (15::bigint,'gladiator-nutrition'::text,null::text),
    (16::bigint,'holland-barrett'::text,'6c0ca5ee3bba035671ef587de2b9d08ae0a96402f1364e88e413b71f73cea3b8'::text)
$profiles$;
alter function public.retailer_offer_sync_parent_profiles() owner to postgres;
revoke all on function public.retailer_offer_sync_parent_profiles() from public,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.prepare_sequential_retailer_offer_sync_parent_approval(p_request jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
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
     or not exists(select 1 from public.retailer_offer_sync_parent_profiles() allowed where allowed.retailer_id=v_parent.retailer_id and (allowed.required_manifest_sha256 is null or upper(v_parent.plan_json->>'approved_manifest_sha256')=upper(allowed.required_manifest_sha256))) or v_parent.target_environment<>'PRODUCTION'
     or v_parent.status<>'PLANNED' or v_parent.approval_id is not null
     or exists(select 1 from public.retailer_catalogue_child_plans c where c.parent_plan_id=v_parent.id and c.status<>'PLANNED') then
    perform public.retailer_catalogue_raise('RSBI_EXPECTED_STATE_MISMATCH','Sequential parent is not a fresh approved-retailer plan');
  end if;
  select allowed.retailer_slug into strict v_slug from public.retailer_offer_sync_parent_profiles() allowed where allowed.retailer_id=v_parent.retailer_id;
  v_expected_actor:='github-'||v_slug||'-sync:'||(v_workflow->>'run_id');
  if p_request->>'approved_by' is distinct from v_expected_actor
     or v_parent.created_by is distinct from 'github:'||(v_workflow->>'repository')||':'||(v_workflow->>'run_id')||':'||(v_workflow->>'run_attempt') then
    perform public.retailer_catalogue_raise('RSBI_APPROVAL_MISMATCH','Sequential parent workflow identity mismatch');
  end if;
  v_result:=public.approve_retailer_catalogue_parent_plan(v_parent.id,v_parent.parent_plan_fingerprint,v_expected_actor,(p_request->>'expires_at')::timestamptz);
  return v_result||jsonb_build_object('business_writes',0,'retailer_id',v_parent.retailer_id::text);
end
$function$
;
do $guard$
declare p pg_proc%rowtype; target jsonb:=public.retailer_catalogue_actual_database_target();
begin
  if current_user<>'postgres' or target->>'target_environment' is distinct from 'PRODUCTION' or target->>'project_ref' is distinct from 'aftboxmrdgyhizicfsfu' or target->>'database_identity' is distinct from 'supplementscout-production:aftboxmrdgyhizicfsfu' then raise exception 'PARENT_PROFILE_PROPOSAL_TARGET_MISMATCH'; end if;
  select * into p from pg_proc where oid='public.prepare_sequential_retailer_offer_sync_parent_approval(jsonb)'::regprocedure;
  if encode(sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex') is distinct from 'ccd4e3b62e30ecb7b50ce067da3cece0ec104a603c9140afdfd337cd25bb0b70' or pg_get_userbyid(p.proowner)<>'postgres' or not p.prosecdef or p.provolatile<>'v' or p.proconfig is distinct from array['search_path=pg_catalog, public, pg_temp']::text[] or p.proacl::text is distinct from '{postgres=X/postgres,retailer_catalogue_production_approver=X/postgres}' then raise exception 'PARENT_PROFILE_PROPOSAL_LINEAGE_MISMATCH'; end if;
  select * into p from pg_proc where oid='public.retailer_offer_sync_parent_profiles()'::regprocedure;
  if encode(sha256(convert_to(p.prosrc,'UTF8')),'hex') is distinct from '42b956696586a4a478f6089f4a33a752563008b2732cdca7697f51ae424733c1' or pg_get_userbyid(p.proowner)<>'postgres' or p.prosecdef or p.provolatile<>'i' or p.proconfig is distinct from array['search_path=""']::text[] or p.proacl::text is distinct from '{postgres=X/postgres}' then raise exception 'PARENT_PROFILE_REGISTRY_LINEAGE_MISMATCH'; end if;
end
$guard$;

commit;
