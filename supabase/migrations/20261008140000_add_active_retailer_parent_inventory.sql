begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $preflight$
begin
  if to_regclass('public.retailer_catalogue_parent_plans') is null
     or to_regclass('public.retailer_catalogue_child_plans') is null
     or to_regclass('public.retailer_catalogue_apply_runs') is null
     or to_regclass('public.retailers') is null then
    raise exception 'retailer control ledger is missing';
  end if;
  if not exists(select 1 from pg_roles where rolname='retailer_catalogue_staging_validator')
     or not exists(select 1 from pg_roles where rolname='retailer_catalogue_production_validator') then
    raise exception 'retailer validator roles are missing';
  end if;
end
$preflight$;

create or replace function public.read_active_retailer_parent_inventory_v1()
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $inventory$
declare
  v_effective_role text := current_setting('role', true);
  v_rows jsonb;
begin
  if v_effective_role not in (
    'retailer_catalogue_staging_validator',
    'retailer_catalogue_production_validator'
  ) then
    perform public.retailer_catalogue_raise(
      'RSBI_ENVIRONMENT_BLOCKED',
      'Dedicated workflow validator role required'
    );
  end if;
  if current_setting('transaction_read_only') <> 'on'
     or current_setting('app.safe_update', true) is not null then
    perform public.retailer_catalogue_raise(
      'RSBI_ENVIRONMENT_BLOCKED',
      'Read-only transaction with SAFE_UPDATE unset required'
    );
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'parent_plan_id',p.id::text,
    'retailer_id',p.retailer_id::text,
    'retailer_name',r.name,
    'retailer_slug',r.slug,
    'target_environment',p.target_environment,
    'status',p.status,
    'created_at',p.created_at,
    'updated_at',p.updated_at,
    'approved_at',p.approved_at,
    'approval_expires_at',p.approval_expires_at,
    'approval_consumed_at',p.approval_consumed_at,
    'children',coalesce(children.counts,'{}'::jsonb),
    'apply_runs',coalesce(runs.counts,'{}'::jsonb)
  ) order by p.created_at,p.id),'[]'::jsonb)
  into v_rows
  from public.retailer_catalogue_parent_plans p
  join public.retailers r on r.id=p.retailer_id
  left join lateral (
    select jsonb_object_agg(status,row_count order by status) counts
    from (
      select c.status,count(*)::integer row_count
      from public.retailer_catalogue_child_plans c
      where c.parent_plan_id=p.id
      group by c.status
    ) grouped_children
  ) children on true
  left join lateral (
    select jsonb_object_agg(status,row_count order by status) counts
    from (
      select a.status,count(*)::integer row_count
      from public.retailer_catalogue_apply_runs a
      where a.parent_plan_id=p.id
      group by a.status
    ) grouped_runs
  ) runs on true
  where p.status in ('PLANNED','APPROVED','PARTIALLY_APPLIED');

  return jsonb_build_object(
    'schema_version',1,
    'active_parent_count',jsonb_array_length(v_rows),
    'active_parents',v_rows
  );
end
$inventory$;

alter function public.read_active_retailer_parent_inventory_v1() owner to postgres;
revoke all on function public.read_active_retailer_parent_inventory_v1()
  from public,anon,authenticated,service_role,
       retailer_catalogue_staging_approver,retailer_catalogue_staging_executor,
       retailer_catalogue_production_approver,retailer_catalogue_production_executor;
grant execute on function public.read_active_retailer_parent_inventory_v1()
  to retailer_catalogue_staging_validator,retailer_catalogue_production_validator;

do $postflight$
declare
  v_definition text;
begin
  v_definition:=pg_get_functiondef('public.read_active_retailer_parent_inventory_v1()'::regprocedure);
  if position('transaction_read_only' in v_definition)=0
     or position('app.safe_update' in v_definition)=0
     or position('PARTIALLY_APPLIED' in v_definition)=0
     or not has_function_privilege('retailer_catalogue_staging_validator','public.read_active_retailer_parent_inventory_v1()','EXECUTE')
     or not has_function_privilege('retailer_catalogue_production_validator','public.read_active_retailer_parent_inventory_v1()','EXECUTE')
     or has_function_privilege('public','public.read_active_retailer_parent_inventory_v1()','EXECUTE')
     or has_function_privilege('service_role','public.read_active_retailer_parent_inventory_v1()','EXECUTE')
     or has_function_privilege('retailer_catalogue_production_approver','public.read_active_retailer_parent_inventory_v1()','EXECUTE')
     or has_function_privilege('retailer_catalogue_production_executor','public.read_active_retailer_parent_inventory_v1()','EXECUTE') then
    raise exception 'active parent inventory postflight failed';
  end if;
end
$postflight$;

commit;
