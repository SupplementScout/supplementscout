begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';

-- One private GTIN identity rule for reviewed V2 and V3. No business DML.
create function public.validate_reviewed_catalogue_gtin_identity(p_plan jsonb)
returns void language plpgsql stable security definer
set search_path = pg_catalog, public, pg_temp
as $gtin_identity$
declare
  v_mapping jsonb := p_plan#>'{retailer_product,values}';
  v_retailer_id bigint := (p_plan#>>'{retailer,id}')::bigint;
begin
  if nullif(v_mapping->>'external_gtin','') is not null then
    if (v_mapping->>'external_gtin') !~ '^[0-9]{8}$|^[0-9]{12,14}$'
       or not public.gtin_promotion_is_valid_gtin(v_mapping->>'external_gtin') then
      raise exception 'invalid reviewed catalogue external GTIN';
    end if;
    -- A code at a different retailer may identify this exact product AND variant.
    -- Same-retailer reuse, missing bindings and other canonical targets still fail.
    -- GTIN-8/12/13/14 zero extensions compare consistently without rewriting data.
    if exists (
      select 1 from public.retailer_products rp
      where lpad(rp.external_gtin,14,'0')=lpad(v_mapping->>'external_gtin',14,'0')
        and (rp.retailer_id is not distinct from v_retailer_id
          or rp.product_id::text is distinct from p_plan#>>'{product,id}'
          or rp.product_variant_id::text is distinct from p_plan#>>'{product_variant,id}')
    ) or exists (
      select 1 from public.product_variants pv
      where (lpad(pv.gtin,14,'0')=lpad(v_mapping->>'external_gtin',14,'0')
        and (pv.id::text is distinct from p_plan#>>'{product_variant,id}'
          or pv.product_id::text is distinct from p_plan#>>'{product,id}'))
        or (pv.id::text=p_plan#>>'{product_variant,id}' and nullif(pv.gtin,'') is not null
          and lpad(pv.gtin,14,'0')<>lpad(v_mapping->>'external_gtin',14,'0'))
    ) or exists (
      select 1 from public.products p
      where lpad(p.gtin,14,'0')=lpad(v_mapping->>'external_gtin',14,'0')
        and p.id::text is distinct from p_plan#>>'{product,id}'
    ) then
      raise exception 'reviewed catalogue GTIN conflicts with another source row';
    end if;
  end if;
end
$gtin_identity$;

-- Reuse the deployed V2 validator's complete identity contract; keep its live
-- approval requirement in the existing approval/execution entry point.
do $migration$
declare
  v_definition text := pg_get_functiondef('public.validate_reviewed_catalogue_import_plan(jsonb)'::regprocedure);
  v_identity text;
  v_authorization text := $authorization$  if not public.atomic_import_reviewed_catalogue_plan_allowed(p_plan) then
    raise exception 'reviewed catalogue plan is not bound to a live approval';
  end if;
$authorization$;
  v_old text := $old$  if nullif(v_mapping->>'external_gtin','') is not null and exists (
    select 1 from public.retailer_products rp
    where rp.external_gtin=v_mapping->>'external_gtin'
      and (rp.retailer_id is distinct from v_retailer_id
        or rp.external_variant_id is distinct from v_mapping->>'external_variant_id')
  ) then
    raise exception 'reviewed catalogue GTIN conflicts with another source row';
  end if;$old$;
  v_variant_anchor text := $anchor$      raise exception 'stale or inactive reviewed catalogue variant';
    end if;$anchor$;
  v_variant_check text := $check$
    if exists (
      select 1 from jsonb_each(p_plan#>'{product_variant,evidence}') e
      where e.key in ('size_value','size_unit','pack_count','product_format','flavour')
        and e.value<>'null'::jsonb
        and nullif(e.value#>>'{}','') is not null
        and nullif(v_actual->>case when e.key='flavour' then 'flavour_label' else e.key end,'') is not null
        and case when e.key in ('size_value','pack_count') then
          (e.value#>>'{}')::numeric is distinct from (v_actual->>e.key)::numeric
        else public.atomic_import_normalized_identity(e.value#>>'{}') is distinct from
          public.atomic_import_normalized_identity(v_actual->>case when e.key='flavour' then 'flavour_label' else e.key end)
        end
    ) then
      raise exception 'reviewed catalogue existing variant evidence conflicts with sellable unit';
    end if;$check$;
begin
  if current_user<>'postgres' or to_regprocedure('public.gtin_promotion_is_valid_gtin(text)') is null then
    raise exception 'reviewed catalogue GTIN identity prerequisites missing';
  end if;
  if encode(sha256(convert_to(v_definition,'UTF8')),'hex')<>'40f59521fbaa2d062225ed1419e5a17ff11bc92feaece20765ab10632daf3a7c'
     or position(v_authorization in v_definition)=0 or position(v_old in v_definition)=0
     or position(v_variant_anchor in v_definition)=0 then
    raise exception 'reviewed catalogue identity validator definition drift';
  end if;
  v_identity := replace(v_definition,
    'FUNCTION public.validate_reviewed_catalogue_import_plan(',
    'FUNCTION public.validate_reviewed_catalogue_import_identity(');
  v_identity := replace(replace(replace(v_identity,v_authorization,''),v_old,
    '  perform public.validate_reviewed_catalogue_gtin_identity(p_plan);'),
    v_variant_anchor,v_variant_anchor||v_variant_check);
  execute v_identity;
end
$migration$;

-- V3 retains its authorization envelope, physical-role checks and error namespace.
do $v3_gtin$
declare
  v_signature regprocedure := to_regprocedure('public.atomic_import_validate_reviewed_catalogue_v3_plan(jsonb,jsonb)');
  v_definition text;
  v_old text := $old$  if nullif(v_mapping->>'external_gtin','') is not null and exists(
    select 1 from public.retailer_products rp where rp.external_gtin=v_mapping->>'external_gtin'
      and (rp.retailer_id is distinct from v_retailer.id or rp.external_variant_id is distinct from v_mapping->>'external_variant_id')
  ) then
    raise exception 'V3_GTIN_COLLISION: GTIN belongs to another source identity';
  end if;$old$;
  v_new text := $new$  begin
    perform public.validate_reviewed_catalogue_gtin_identity(p_plan);
  exception when raise_exception then
    raise exception 'V3_GTIN_COLLISION: %',sqlerrm;
  end;$new$;
begin
  -- A V2-only lineage has no V3 function to alter.
  if v_signature is null then return; end if;
  v_definition := pg_get_functiondef(v_signature);
  if encode(sha256(convert_to(v_definition,'UTF8')),'hex')<>'033cd54202f3ed2946eb78ba37a311c5a56a4f6eb421c0424b3239ad75c19baf'
     or position(v_old in v_definition)=0 then
    raise exception 'reviewed V3 GTIN validator definition drift';
  end if;
  execute replace(v_definition,v_old,v_new);
end
$v3_gtin$;

create or replace function public.validate_reviewed_catalogue_import_plan(p_plan jsonb)
returns jsonb language plpgsql stable security definer
set search_path = pg_catalog, public, pg_temp
as $approval_boundary$
begin
  if not public.atomic_import_reviewed_catalogue_plan_allowed(p_plan) then
    raise exception 'reviewed catalogue plan is not bound to a live approval';
  end if;
  return public.validate_reviewed_catalogue_import_identity(p_plan);
end
$approval_boundary$;

create function public.validate_reviewed_catalogue_import_plan_read_only(p_plan jsonb)
returns jsonb language plpgsql stable security definer
set search_path = pg_catalog, public, pg_temp
as $read_only$
begin
  if current_setting('transaction_read_only')<>'on' then
    raise exception 'reviewed catalogue preflight requires a read-only transaction';
  end if;
  perform public.validate_reviewed_catalogue_import_identity(p_plan);
  return jsonb_build_object('plan_kind',p_plan#>>'{meta,plan_kind}',
    'retailer_id',(p_plan#>>'{retailer,id}')::bigint);
end
$read_only$;

alter function public.validate_reviewed_catalogue_gtin_identity(jsonb) owner to postgres;
alter function public.validate_reviewed_catalogue_import_identity(jsonb) owner to postgres;
alter function public.validate_reviewed_catalogue_import_plan_read_only(jsonb) owner to postgres;
revoke all on function public.validate_reviewed_catalogue_gtin_identity(jsonb),
  public.validate_reviewed_catalogue_import_identity(jsonb),
  public.validate_reviewed_catalogue_import_plan_read_only(jsonb) from public;

do $acl$
declare v_role record;
begin
  for v_role in select rolname from pg_roles where rolname in (
    'anon','authenticated','service_role',
    'retailer_catalogue_production_validator','retailer_catalogue_staging_validator',
    'retailer_catalogue_production_approver','retailer_catalogue_staging_approver',
    'retailer_catalogue_production_executor','retailer_catalogue_staging_executor') loop
    execute format('revoke all on function public.validate_reviewed_catalogue_gtin_identity(jsonb), public.validate_reviewed_catalogue_import_identity(jsonb), public.validate_reviewed_catalogue_import_plan_read_only(jsonb) from %I',v_role.rolname);
    if v_role.rolname='retailer_catalogue_production_validator' then
      execute format('grant execute on function public.validate_reviewed_catalogue_import_plan_read_only(jsonb) to %I',v_role.rolname);
    end if;
  end loop;
end
$acl$;

commit;
