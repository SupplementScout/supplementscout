begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';
select pg_advisory_xact_lock(hashtextextended('reviewed-catalogue-v2-new-product-identity',0));

-- Keep one complete V2 identity implementation. The private second argument
-- identifies only a parent just inserted by the existing atomic executor.
-- Public preflight/approval always use the one-argument, absence-checking entry.
do $identity$
declare
  v_definition text;
  v_anchor text := $anchor$      raise exception 'invalid reviewed catalogue product creation';
    end if;$anchor$;
  v_check text := $check$
    if v_variant_action='create_reviewed_variant' and (
      v_variant_values->>'product_format' is distinct from v_product_values->>'product_format'
      or (p_plan#>>'{product_variant,evidence,unit_count}' is not null and
        v_variant_values->>'product_format' is distinct from
          case p_plan#>>'{product_variant,evidence,unit_type}'
            when 'tablets' then 'tablet' when 'capsules' then 'capsule'
            when 'gummies' then 'gummy' when 'chews' then 'chew' end)
    ) then
      raise exception 'reviewed catalogue new product and variant format mismatch';
    end if;
    if p_created_product_id is null then
      if exists (
        select 1 from public.products p
        where public.atomic_import_normalized_identity(p.name)=
                public.atomic_import_normalized_identity(v_product_values->>'name')
           or lower(btrim(p.slug))=lower(btrim(v_product_values->>'slug'))
      ) then
        raise exception 'reviewed catalogue new product identity collision: use an explicit existing product plan';
      end if;
    else
      -- Formula and strength remain in the exact reviewed name. Counts/form
      -- are checked independently; no family aliases or retailer exceptions.
      if not exists (
        select 1 from public.products p
        where p.id=p_created_product_id
          and p.name=v_product_values->>'name'
          and p.slug=v_product_values->>'slug'
          and p.brand=v_product_values->>'brand'
          and p.category=v_product_values->>'category'
          and p.product_format is not distinct from v_product_values->>'product_format'
          and p.unit_count is not distinct from (v_product_values->>'unit_count')::integer
          and p.unit_type is not distinct from v_product_values->>'unit_type'
          and p.gtin is null and p.is_active=true
          and p.merged_into_product_id is null and p.merged_at is null
      ) or exists (
        select 1 from public.products p
        where p.id<>p_created_product_id and (
          public.atomic_import_normalized_identity(p.name)=
            public.atomic_import_normalized_identity(v_product_values->>'name')
          or lower(btrim(p.slug))=lower(btrim(v_product_values->>'slug'))
        )
      ) then
        raise exception 'reviewed catalogue created product identity mismatch';
      end if;
    end if;$check$;
begin
  if current_user<>'postgres'
     or to_regprocedure('public.validate_reviewed_catalogue_import_identity(jsonb)') is null
     or to_regprocedure('public.validate_reviewed_catalogue_import_identity(jsonb,bigint)') is not null then
    raise exception 'reviewed new product identity prerequisites missing or already installed';
  end if;
  v_definition := pg_get_functiondef('public.validate_reviewed_catalogue_import_identity(jsonb)'::regprocedure);
  if encode(sha256(convert_to(v_definition,'UTF8')),'hex')<>'799496fe9191ef7d7c8752f81421b78342ca805374eca17dd8df372505a256e3'
     or position(v_anchor in v_definition)=0 then
    raise exception 'reviewed new product identity validator definition drift';
  end if;
  v_definition := replace(v_definition,
    'FUNCTION public.validate_reviewed_catalogue_import_identity(p_plan jsonb)',
    'FUNCTION public.validate_reviewed_catalogue_import_identity(p_plan jsonb, p_created_product_id bigint)');
  execute replace(v_definition,v_anchor,v_anchor||v_check);
end
$identity$;

create or replace function public.validate_reviewed_catalogue_import_identity(p_plan jsonb)
returns jsonb language plpgsql stable security definer
set search_path = pg_catalog, public, pg_temp
as $identity_entry$
begin
  return public.validate_reviewed_catalogue_import_identity(p_plan,null::bigint);
end
$identity_entry$;

-- Preserve the V3 and legacy branches byte-for-byte. A bound V2 NEW plan
-- inserts a new parent or fails; it never resolves an existing parent by OR.
do $executor$
declare
  v_definition text;
  v_declaration text := '  v_variant_values jsonb;';
  v_assignment text := $assignment$  v_retailer_id := (p_plan#>>'{retailer,id}')::bigint;$assignment$;
  v_select text := $selection$  select id into v_product_id
  from public.products
  where public.atomic_import_normalized_identity(name)=public.atomic_import_normalized_identity(v_product_values->>'name')
     or slug = v_product_values->>'slug'
  for update;$selection$;
  v_post text := $post$  if public.atomic_import_reviewed_catalogue_v3_plan_allowed(p_plan) then
    perform public.atomic_import_validate_pre_source_metadata_plan_core(p_plan);
  else
    perform public.validate_product_import_plan_read_only(p_plan);
  end if;$post$;
  v_new_post text := $post$  if public.atomic_import_reviewed_catalogue_v3_plan_allowed(p_plan) then
    perform public.atomic_import_validate_pre_source_metadata_plan_core(p_plan);
  elsif v_reviewed_v2 then
    if not v_product_created then
      raise exception 'reviewed catalogue new product was not created';
    end if;
    perform public.validate_reviewed_catalogue_import_identity(p_plan,v_product_id);
  else
    perform public.validate_product_import_plan_read_only(p_plan);
  end if;$post$;
begin
  if to_regprocedure('public.atomic_import_apply_pre_source_metadata_plan_core(jsonb)') is null then
    raise exception 'reviewed new product executor prerequisite missing';
  end if;
  v_definition := pg_get_functiondef('public.atomic_import_apply_pre_source_metadata_plan_core(jsonb)'::regprocedure);
  if encode(sha256(convert_to(v_definition,'UTF8')),'hex')<>'ffa595f3b12b62a0d78eaa57a8b92384d85047471dc0bc4bb0b1b76536dedc6a'
     or position(v_declaration in v_definition)=0 or position(v_assignment in v_definition)=0
     or position(v_select in v_definition)=0 or position(v_post in v_definition)=0 then
    raise exception 'reviewed new product executor definition drift';
  end if;
  v_definition := replace(v_definition,v_declaration,v_declaration||E'\n  v_reviewed_v2 boolean;');
  v_definition := replace(v_definition,v_assignment,v_assignment||$assignment$
  v_reviewed_v2 := public.atomic_import_reviewed_catalogue_plan_allowed(p_plan);
  if v_reviewed_v2 then
    perform pg_advisory_xact_lock(hashtextextended(concat_ws('|','reviewed-new-parent-name',
      public.atomic_import_normalized_identity(v_product_values->>'name')),0));
  end if;$assignment$);
  v_definition := replace(v_definition,v_select,
    E'  if not v_reviewed_v2 then\n'||v_select||E'\n  end if;');
  execute replace(v_definition,v_post,v_new_post);
end
$executor$;

alter function public.validate_reviewed_catalogue_import_identity(jsonb,bigint) owner to postgres;
revoke all on function public.validate_reviewed_catalogue_import_identity(jsonb,bigint) from public;
do $acl$
declare v_role record;
begin
  for v_role in select rolname from pg_roles where rolname in (
    'anon','authenticated','service_role',
    'retailer_catalogue_production_validator','retailer_catalogue_staging_validator',
    'retailer_catalogue_production_approver','retailer_catalogue_staging_approver',
    'retailer_catalogue_production_executor','retailer_catalogue_staging_executor') loop
    execute format('revoke all on function public.validate_reviewed_catalogue_import_identity(jsonb,bigint) from %I',v_role.rolname);
  end loop;
end
$acl$;

commit;
