begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';

select pg_advisory_xact_lock(hashtextextended('reviewed-catalogue-v3-schema',0));

do $preflight$
declare
  v_target jsonb:=public.retailer_catalogue_actual_database_target();
  v_function regprocedure:='public.atomic_import_reviewed_v3_legacy_validation_projection(jsonb,jsonb)'::regprocedure;
  v_counts jsonb;
begin
  if current_user<>'postgres'
     or v_target->>'target_environment' not in ('STAGING','PRODUCTION')
     or (v_target->>'target_environment'='STAGING' and (
       v_target->>'project_ref'<>'hxnrsyyqffztlvcrtgbf'
       or v_target->>'database_identity'<>'supplementscout-staging:hxnrsyyqffztlvcrtgbf'
     ))
     or (v_target->>'target_environment'='PRODUCTION' and (
       v_target->>'project_ref'<>'aftboxmrdgyhizicfsfu'
       or v_target->>'database_identity'<>'supplementscout-production:aftboxmrdgyhizicfsfu'
     )) then
    raise exception 'reviewed V3 composite size projection rollback target differs';
  end if;
  if not exists(
    select 1 from supabase_migrations.schema_migrations
    where version='20261024120000'
      and name='fix_reviewed_v3_create_product_composite_size_projection'
  ) then
    raise exception 'reviewed V3 composite size projection rollback ledger entry missing';
  end if;
  if exists(
    select 1 from public.approved_import_plans
    where source~'^reviewed-catalogue-package-v3:'
      and status='approved' and consumed_at is null and expires_at>now()
  ) then
    raise exception 'reviewed V3 composite size projection rollback blocked by live approval';
  end if;
  if exists(
    select 1 from public.approved_import_plans a
    where a.source~'^reviewed-catalogue-package-v3:'
      and a.status='consumed' and a.consumed_at is not null and a.execution_result is not null
      and a.authorization_envelope->>'reviewed_action' in (
        'create_product_with_variant','create_variant_on_existing_product'
      )
      and a.authorization_envelope#>>'{option_roles,physical_size,source_key}'
            is not distinct from a.authorization_envelope#>>'{option_roles,count,source_key}'
      and a.authorization_envelope#>>'{option_roles,physical_size,source_value}'
            is not distinct from a.authorization_envelope#>>'{option_roles,count,source_value}'
      and a.authorization_envelope#>>'{option_roles,physical_size,source_value}' ~*
        '^[1-9][0-9]*\s*(serving|servings|capsule|capsules|cap|caps|tablet|tablets|tab|tabs|softgel|softgels|sachet|sachets|shot|shots|piece|pieces|gummy|gummies)\s*\(\s*[0-9]+(?:[.,][0-9]+)?\s*(mcg|mg|kg|g|ml|cl|l)\s*\)$'
  ) then
    raise exception 'reviewed V3 composite size projection rollback blocked by dependent execution';
  end if;
  if encode(pg_catalog.sha256(convert_to(pg_get_functiondef(v_function),'UTF8')),'hex')
       <> '2548c3b702403a2fda4176dbe732c993d85e14690157286aa65029f434813dff' then
    raise exception 'reviewed V3 composite size projection rollback lineage differs';
  end if;
  if not exists(
    select 1 from pg_proc p where p.oid=v_function and p.proowner='postgres'::regrole
      and p.provolatile='s' and p.prosecdef
      and p.proconfig=array['search_path=pg_catalog, public, pg_temp']::text[]
  ) or exists(
    select 1 from pg_proc p
    cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) acl
    where p.oid=v_function and acl.grantee<>p.proowner and acl.privilege_type='EXECUTE'
  ) then
    raise exception 'reviewed V3 composite size projection rollback metadata differs';
  end if;
  select jsonb_build_object(
    'retailers',(select count(*) from public.retailers),
    'products',(select count(*) from public.products),
    'product_variants',(select count(*) from public.product_variants),
    'retailer_products',(select count(*) from public.retailer_products),
    'offers',(select count(*) from public.offers),
    'price_history',(select count(*) from public.price_history),
    'approved_import_plans',(select count(*) from public.approved_import_plans)
  ) into v_counts;
  perform set_config('app.reviewed_v3_composite_projection_rollback_counts',v_counts::text,true);
end
$preflight$;

do $restore_projection$
declare
  v_definition text:=pg_get_functiondef(
    'public.atomic_import_reviewed_v3_legacy_validation_projection(jsonb,jsonb)'::regprocedure
  );
  v_before text:=$needle$    if lower(btrim(coalesce(v_physical_key,'')))='size' then
      if v_count_key is not null
         and v_physical_key=v_count_key
         and v_physical->>'source_value' is not distinct from v_count->>'source_value' then
        if not (
          (p_envelope->>'reviewed_action'='create_product_with_variant'
           and p_plan#>>'{product,action}'='create_or_reuse_reviewed'
           and p_plan#>>'{product_variant,action}'='create_reviewed_variant')
          or
          (p_envelope->>'reviewed_action'='create_variant_on_existing_product'
           and p_plan#>>'{product,action}'='existing'
           and p_plan#>>'{product_variant,action}'='create_variant')
        ) then
          raise exception 'V3_LEGACY_COMPATIBILITY_MISMATCH: composite physical target action differs';
        end if;
        if p_plan#>>'{product_variant,values,size_value}' is null
           or p_plan#>>'{product_variant,values,size_unit}' is null
           or (p_plan#>>'{product_variant,values,size_value}')::numeric
                is distinct from (v_physical->>'size_value')::numeric
           or lower(p_plan#>>'{product_variant,values,size_unit}')
                is distinct from lower(v_physical->>'size_unit') then
          raise exception 'V3_LEGACY_COMPATIBILITY_MISMATCH: composite physical target differs';
        end if;
        v_validation_options:=jsonb_set(
          v_validation_options,
          array[v_size_key],
          to_jsonb((v_physical->>'size_value')||(v_physical->>'size_unit')),
          false
        );
      end if;
$needle$;
  v_after text:=$replacement$    if lower(btrim(coalesce(v_physical_key,'')))='size' then null;
$replacement$;
begin
  if length(v_definition)-length(replace(v_definition,v_before,''))<>length(v_before) then
    raise exception 'reviewed V3 composite size projection rollback anchor differs';
  end if;
  execute replace(v_definition,v_before,v_after);
end
$restore_projection$;

alter function public.atomic_import_reviewed_v3_legacy_validation_projection(jsonb,jsonb) owner to postgres;
revoke all on function public.atomic_import_reviewed_v3_legacy_validation_projection(jsonb,jsonb)
  from public,anon,authenticated,service_role;

do $environment_acl$
declare
  v_target jsonb:=public.retailer_catalogue_actual_database_target();
  v_role text:='retailer_catalogue_'||lower(v_target->>'target_environment')||'_executor';
begin
  if to_regrole(v_role) is not null then
    execute format(
      'revoke all on function public.atomic_import_reviewed_v3_legacy_validation_projection(jsonb,jsonb) from %I',
      v_role
    );
  end if;
end
$environment_acl$;

do $postflight$
declare
  v_counts_before jsonb:=current_setting('app.reviewed_v3_composite_projection_rollback_counts')::jsonb;
  v_counts_after jsonb;
  v_function regprocedure:='public.atomic_import_reviewed_v3_legacy_validation_projection(jsonb,jsonb)'::regprocedure;
begin
  if encode(pg_catalog.sha256(convert_to(pg_get_functiondef(v_function),'UTF8')),'hex')
       <> 'cc0be112418a5843f1526d9ee2c746564cb9ec40d6be1ff26724fbc92934bda5' then
    raise exception 'reviewed V3 composite size projection rollback restoration differs';
  end if;
  if not exists(
    select 1 from pg_proc p where p.oid=v_function and p.proowner='postgres'::regrole
      and p.provolatile='s' and p.prosecdef
      and p.proconfig=array['search_path=pg_catalog, public, pg_temp']::text[]
  ) or exists(
    select 1 from pg_proc p
    cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) acl
    where p.oid=v_function and acl.grantee<>p.proowner and acl.privilege_type='EXECUTE'
  ) then
    raise exception 'reviewed V3 composite size projection rollback postflight metadata differs';
  end if;
  select jsonb_build_object(
    'retailers',(select count(*) from public.retailers),
    'products',(select count(*) from public.products),
    'product_variants',(select count(*) from public.product_variants),
    'retailer_products',(select count(*) from public.retailer_products),
    'offers',(select count(*) from public.offers),
    'price_history',(select count(*) from public.price_history),
    'approved_import_plans',(select count(*) from public.approved_import_plans)
  ) into v_counts_after;
  if v_counts_after is distinct from v_counts_before then
    raise exception 'reviewed V3 composite size projection rollback changed business counts';
  end if;
end
$postflight$;

commit;
