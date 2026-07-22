begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $preflight$
begin
  if to_regprocedure('public.validate_product_import_plan_read_only(jsonb)') is null
     or to_regprocedure('public.apply_product_import_plan(jsonb)') is null
     or to_regprocedure('public.atomic_import_canonical_json(jsonb)') is null then
    raise exception 'retailer sync metadata alignment requires the existing atomic importer';
  end if;
  if to_regprocedure('public.atomic_import_validate_pre_source_metadata_plan_core(jsonb)') is not null
     or to_regprocedure('public.atomic_import_apply_pre_source_metadata_plan_core(jsonb)') is not null
     or to_regprocedure('public.atomic_import_validate_source_bound_offer_sync_plan(jsonb)') is not null then
    raise exception 'retailer sync metadata alignment is already installed';
  end if;
end
$preflight$;

alter function public.validate_product_import_plan_read_only(jsonb)
  rename to atomic_import_validate_pre_source_metadata_plan_core;
alter function public.apply_product_import_plan(jsonb)
  rename to atomic_import_apply_pre_source_metadata_plan_core;

create function public.atomic_import_is_source_bound_offer_sync_plan(p_plan jsonb)
returns boolean
language sql
immutable
strict
set search_path = pg_catalog, public
as $function$
  select p_plan#>>'{meta,operation_type}' = 'standard_import'
    and p_plan#>>'{meta,plan_kind}' = 'feed'
    and p_plan#>'{meta}' ? 'source_snapshot_sha256'
    and p_plan#>'{meta}' ? 'source_captured_at'
    and p_plan#>>'{product,action}' = 'existing'
    and p_plan#>>'{product_variant,action}' = 'existing'
    and p_plan#>>'{retailer,action}' = 'existing'
    and p_plan#>>'{retailer_product,action}' in ('noop','update')
    and p_plan#>>'{offer,action}' = 'update'
    and p_plan#>>'{price_history,action}' in ('noop','create')
$function$;

create function public.atomic_import_source_bound_offer_sync_core_plan(p_plan jsonb)
returns jsonb
language plpgsql
immutable
strict
set search_path = pg_catalog, public
as $function$
declare
  v_core jsonb;
begin
  v_core := p_plan #- '{meta,source_snapshot_sha256}' #- '{meta,source_captured_at}';
  v_core := jsonb_set(v_core, '{meta,plan_fingerprint}', 'null'::jsonb, false);
  return jsonb_set(
    v_core,
    '{meta,plan_fingerprint}',
    to_jsonb(md5(public.atomic_import_canonical_json(v_core))),
    false
  );
end
$function$;

create function public.atomic_import_validate_source_bound_offer_sync_plan(p_plan jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $function$
declare
  v_capture timestamptz;
  v_result jsonb;
begin
  if not public.atomic_import_is_source_bound_offer_sync_plan(p_plan)
     or not public.atomic_import_has_exact_keys(
       p_plan->'meta',
       array['version','plan_kind','operation_type','source_row_fingerprint','plan_fingerprint','source_snapshot_sha256','source_captured_at']
     )
     or p_plan#>>'{meta,version}' <> '2'
     or p_plan#>>'{meta,source_row_fingerprint}' !~ '^[0-9a-f]{64}$'
     or p_plan#>>'{meta,source_snapshot_sha256}' !~ '^[0-9a-f]{64}$'
     or p_plan#>>'{meta,plan_fingerprint}' !~ '^[0-9a-f]{32}$'
     or md5(public.atomic_import_canonical_json(
       jsonb_set(p_plan, '{meta,plan_fingerprint}', 'null'::jsonb, false)
     )) <> p_plan#>>'{meta,plan_fingerprint}' then
    raise exception 'invalid source-bound offer sync metadata or fingerprint';
  end if;

  begin
    v_capture := (p_plan#>>'{meta,source_captured_at}')::timestamptz;
  exception when others then
    raise exception 'invalid source-bound offer sync capture timestamp';
  end;
  if v_capture < now() - interval '24 hours'
     or v_capture > now() + interval '5 minutes' then
    raise exception 'source-bound offer sync capture is stale or in the future';
  end if;

  v_result := public.atomic_import_validate_pre_source_metadata_plan_core(
    public.atomic_import_source_bound_offer_sync_core_plan(p_plan)
  );
  return v_result || jsonb_build_object(
    'source_snapshot_sha256', p_plan#>>'{meta,source_snapshot_sha256}',
    'source_captured_at', to_char(v_capture at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    'source_bound_plan_fingerprint', p_plan#>>'{meta,plan_fingerprint}'
  );
end
$function$;

create function public.validate_product_import_plan_read_only(p_plan jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $function$
begin
  if public.atomic_import_is_source_bound_offer_sync_plan(p_plan) then
    return public.atomic_import_validate_source_bound_offer_sync_plan(p_plan);
  end if;
  return public.atomic_import_validate_pre_source_metadata_plan_core(p_plan);
end
$function$;

create function public.apply_product_import_plan(p_plan jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog, public, pg_temp
as $function$
declare
  v_result jsonb;
begin
  if public.atomic_import_is_source_bound_offer_sync_plan(p_plan) then
    perform public.atomic_import_validate_source_bound_offer_sync_plan(p_plan);
    v_result := public.atomic_import_apply_pre_source_metadata_plan_core(
      public.atomic_import_source_bound_offer_sync_core_plan(p_plan)
    );
    return v_result || jsonb_build_object(
      'plan_fingerprint', p_plan#>>'{meta,plan_fingerprint}',
      'source_snapshot_sha256', p_plan#>>'{meta,source_snapshot_sha256}',
      'source_captured_at', p_plan#>>'{meta,source_captured_at}'
    );
  end if;
  return public.atomic_import_apply_pre_source_metadata_plan_core(p_plan);
end
$function$;

alter function public.atomic_import_is_source_bound_offer_sync_plan(jsonb) owner to postgres;
alter function public.atomic_import_source_bound_offer_sync_core_plan(jsonb) owner to postgres;
alter function public.atomic_import_validate_source_bound_offer_sync_plan(jsonb) owner to postgres;
alter function public.atomic_import_validate_pre_source_metadata_plan_core(jsonb) owner to postgres;
alter function public.atomic_import_apply_pre_source_metadata_plan_core(jsonb) owner to postgres;
alter function public.validate_product_import_plan_read_only(jsonb) owner to postgres;
alter function public.apply_product_import_plan(jsonb) owner to postgres;

revoke all on function public.atomic_import_is_source_bound_offer_sync_plan(jsonb),
  public.atomic_import_source_bound_offer_sync_core_plan(jsonb),
  public.atomic_import_validate_source_bound_offer_sync_plan(jsonb),
  public.atomic_import_validate_pre_source_metadata_plan_core(jsonb),
  public.atomic_import_apply_pre_source_metadata_plan_core(jsonb),
  public.validate_product_import_plan_read_only(jsonb),
  public.apply_product_import_plan(jsonb)
  from public, anon, authenticated, service_role;

commit;
