begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $preflight$
begin
  if to_regprocedure('public.validate_reviewed_catalogue_v3_plan_read_only(jsonb,jsonb)') is null
     or to_regprocedure('public.approve_reviewed_catalogue_v3_plan(jsonb,jsonb,timestamptz)') is null
     or to_regprocedure('public.apply_approved_reviewed_catalogue_v3_plan(uuid,jsonb,jsonb)') is null
     or to_regprocedure('public.atomic_import_validate_reviewed_catalogue_before_v3(jsonb)') is null then
    raise exception 'reviewed catalogue V3 rollback target is missing';
  end if;
  if exists(select 1 from public.approved_import_plans
    where source ~ '^reviewed-catalogue-package-v3:' or authorization_envelope is not null) then
    raise exception 'reviewed catalogue V3 rollback blocked by durable approval evidence';
  end if;
end
$preflight$;

drop function public.apply_approved_reviewed_catalogue_v3_plan(uuid,jsonb,jsonb);
drop function public.approve_reviewed_catalogue_v3_plan(jsonb,jsonb,timestamptz);
drop function public.validate_reviewed_catalogue_v3_plan_read_only(jsonb,jsonb);
drop function public.validate_reviewed_catalogue_import_plan(jsonb);
alter function public.atomic_import_validate_reviewed_catalogue_before_v3(jsonb)
  rename to validate_reviewed_catalogue_import_plan;

create or replace function public.atomic_import_reviewed_catalogue_plan_allowed(p_plan jsonb)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $allowed$
  select exists (
    select 1
    from public.approved_import_plans a
    where a.status = 'approved'
      and a.consumed_at is null
      and a.expires_at > now()
      and a.source ~ '^reviewed-catalogue-package-v1:[A-Za-z0-9._-]+:[0-9a-f]{64}$'
      and a.plan_json = p_plan
      and a.plan_fingerprint = p_plan#>>'{meta,plan_fingerprint}'
      and a.source_row_fingerprint = p_plan#>>'{meta,source_row_fingerprint}'
      and a.plan_kind = p_plan#>>'{meta,plan_kind}'
      and a.retailer_id = nullif(p_plan#>>'{retailer,id}','')::bigint
      and md5(public.atomic_import_canonical_json(
        jsonb_set(p_plan,'{meta,plan_fingerprint}','null'::jsonb,false)
      )) = a.plan_fingerprint
  )
$allowed$;

drop function public.atomic_import_reviewed_catalogue_v3_plan_allowed(jsonb);
drop function public.atomic_import_validate_reviewed_catalogue_v3_plan(jsonb,jsonb);
drop function public.atomic_import_reviewed_v3_physical_role_allowed(jsonb,jsonb);
drop function public.atomic_import_reviewed_v3_count_role_allowed(jsonb,jsonb);

alter function public.atomic_import_reviewed_catalogue_plan_allowed(jsonb) owner to postgres;
alter function public.validate_reviewed_catalogue_import_plan(jsonb) owner to postgres;
revoke all on function public.atomic_import_reviewed_catalogue_plan_allowed(jsonb),
  public.validate_reviewed_catalogue_import_plan(jsonb)
  from public,anon,authenticated,service_role,
    retailer_catalogue_staging_validator,retailer_catalogue_staging_approver,retailer_catalogue_staging_executor,
    retailer_catalogue_production_validator,retailer_catalogue_production_approver,retailer_catalogue_production_executor;

alter table public.approved_import_plans
  drop constraint approved_import_plans_v3_envelope_check;
alter table public.approved_import_plans
  drop column authorization_envelope;

commit;
