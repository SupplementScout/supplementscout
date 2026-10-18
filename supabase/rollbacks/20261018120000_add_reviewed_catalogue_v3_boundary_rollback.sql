begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

select pg_advisory_xact_lock(hashtextextended('reviewed-catalogue-v3-schema',0));

do $preflight$
begin
  if to_regprocedure('public.validate_reviewed_catalogue_v3_plan_read_only(jsonb,jsonb)') is null
     or to_regprocedure('public.approve_reviewed_catalogue_v3_plan(jsonb,jsonb,timestamptz)') is null
     or to_regprocedure('public.apply_approved_reviewed_catalogue_v3_plan(uuid,jsonb,jsonb)') is null
     or to_regprocedure('public.validate_product_import_plan_read_only(jsonb)') is null
     or to_regprocedure('public.atomic_import_validate_product_before_reviewed_v3(jsonb)') is null
     or not exists(
       select 1 from information_schema.columns
       where table_schema='public' and table_name='approved_import_plans' and column_name='authorization_envelope'
     ) then
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
drop function public.validate_product_import_plan_read_only(jsonb);
alter function public.atomic_import_validate_product_before_reviewed_v3(jsonb)
  rename to validate_product_import_plan_read_only;

drop function public.atomic_import_reviewed_catalogue_v3_plan_allowed(jsonb);
drop function public.atomic_import_validate_reviewed_catalogue_v3_plan(jsonb,jsonb);
drop function public.atomic_import_reviewed_v3_physical_role_allowed(jsonb,jsonb);
drop function public.atomic_import_reviewed_v3_count_role_allowed(jsonb,jsonb);

do $restored_validator$
declare
  v_sha256 text;
begin
  select encode(pg_catalog.sha256(convert_to(pg_get_functiondef(
    'public.validate_product_import_plan_read_only(jsonb)'::regprocedure
  ),'UTF8')),'hex') into v_sha256;
  if v_sha256 not in (
    '70f134e6f7d3afa25de52353ff5e8aca3cc0f7c34a58d9da3577ead4ac11f4a9',
    'b9d99d9245ff2ea493fa9ed4d160f0e9ff4c450764cb40a5a23325d0ca069583'
  ) then
    raise exception 'reviewed catalogue V3 rollback did not restore the reviewed validator lineage';
  end if;
end
$restored_validator$;

alter table public.approved_import_plans
  drop constraint approved_import_plans_v3_envelope_check;
alter table public.approved_import_plans
  drop column authorization_envelope;

do $execution_result$
begin
  if exists(
    select 1 from pg_constraint
    where conrelid='public.approved_import_plans'::regclass
      and conname='approved_import_plans_v3_created_execution_result_check'
  ) then
    if exists(select 1 from public.approved_import_plans where execution_result is not null) then
      raise exception 'reviewed catalogue V3 rollback cannot remove non-empty V3-created execution_result';
    end if;
    alter table public.approved_import_plans
      drop constraint approved_import_plans_v3_created_execution_result_check;
    alter table public.approved_import_plans drop column execution_result;
  end if;
end
$execution_result$;

commit;
