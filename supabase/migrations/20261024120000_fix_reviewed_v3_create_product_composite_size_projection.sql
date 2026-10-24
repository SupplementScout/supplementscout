begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';

select pg_advisory_xact_lock(hashtextextended('reviewed-catalogue-v3-schema',0));

do $preflight$
declare
  v_target jsonb:=public.retailer_catalogue_actual_database_target();
  v_function regprocedure;
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
    raise exception 'reviewed V3 composite size projection target differs';
  end if;

  if exists(
    select 1 from public.approved_import_plans
    where source~'^reviewed-catalogue-package-v3:'
      and status='approved' and consumed_at is null and expires_at>now()
  ) then
    raise exception 'reviewed V3 composite size projection blocked by live approval';
  end if;

  foreach v_function in array array[
    'public.atomic_import_reviewed_v3_physical_role_allowed(jsonb,jsonb)'::regprocedure,
    'public.atomic_import_reviewed_v3_count_role_allowed(jsonb,jsonb)'::regprocedure,
    'public.atomic_import_reviewed_v3_legacy_validation_projection(jsonb,jsonb)'::regprocedure,
    'public.atomic_import_reviewed_v3_legacy_validation_evidence(jsonb,jsonb)'::regprocedure,
    'public.atomic_import_validate_reviewed_catalogue_v3_plan(jsonb,jsonb)'::regprocedure,
    'public.atomic_import_validate_pre_source_metadata_plan_core(jsonb)'::regprocedure,
    'public.atomic_import_apply_pre_source_metadata_plan_core(jsonb)'::regprocedure,
    'public.atomic_import_apply_standard_plan_core(jsonb)'::regprocedure
  ] loop
    if not exists(select 1 from pg_proc where oid=v_function) then
      raise exception 'reviewed V3 composite size projection prerequisite missing: %',v_function;
    end if;
  end loop;

  if encode(pg_catalog.sha256(convert_to(pg_get_functiondef(
       'public.atomic_import_reviewed_v3_physical_role_allowed(jsonb,jsonb)'::regprocedure
     ),'UTF8')),'hex') <> '154d86c8abd1a0dc5aaa0bc71704be17c590af578dfffbea2adff82847068a49'
     or encode(pg_catalog.sha256(convert_to(pg_get_functiondef(
       'public.atomic_import_reviewed_v3_count_role_allowed(jsonb,jsonb)'::regprocedure
     ),'UTF8')),'hex') <> '90afc70b4adfa0d2836d501d240e1e98c72fec0d8ce0df99227de86b7f548f5a'
     or encode(pg_catalog.sha256(convert_to(pg_get_functiondef(
       'public.atomic_import_reviewed_v3_legacy_validation_projection(jsonb,jsonb)'::regprocedure
     ),'UTF8')),'hex') <> 'cc0be112418a5843f1526d9ee2c746564cb9ec40d6be1ff26724fbc92934bda5'
     or encode(pg_catalog.sha256(convert_to(pg_get_functiondef(
       'public.atomic_import_reviewed_v3_legacy_validation_evidence(jsonb,jsonb)'::regprocedure
     ),'UTF8')),'hex') <> 'a5b8a05c0dc9cba672cbb4607c8d63660744165f88d2807e26d299159277b0f8'
     or encode(pg_catalog.sha256(convert_to(pg_get_functiondef(
       'public.atomic_import_validate_reviewed_catalogue_v3_plan(jsonb,jsonb)'::regprocedure
     ),'UTF8')),'hex') <> '04392ff0eff0e814ba54e41d0b9af38478174eda6f427e7eefcc35d18c7b3e0c'
     or encode(pg_catalog.sha256(convert_to(pg_get_functiondef(
       'public.atomic_import_validate_pre_source_metadata_plan_core(jsonb)'::regprocedure
     ),'UTF8')),'hex') not in ('c82e291550787e553fc906a669c348f0b7d6cd034bfb8bd326d7a9c646e7511a','c8370ee49d873f9cf8f6f375653848248b2cbe19f0e0b869f392e45405ae5daf')
     or encode(pg_catalog.sha256(convert_to(pg_get_functiondef(
       'public.atomic_import_apply_pre_source_metadata_plan_core(jsonb)'::regprocedure
     ),'UTF8')),'hex') <> 'ffa595f3b12b62a0d78eaa57a8b92384d85047471dc0bc4bb0b1b76536dedc6a'
     or encode(pg_catalog.sha256(convert_to(pg_get_functiondef(
       'public.atomic_import_apply_standard_plan_core(jsonb)'::regprocedure
     ),'UTF8')),'hex') not in ('0fb47d632b21b4323a16fd4e9a3ec9886b747a21014e247e8d73f7999a586209','9367d8cd30f742a163b2f4b4a8f48488b432862bb5c8b04d61755884ea72fe0c') then
    raise exception 'reviewed V3 composite size projection lineage differs';
  end if;

  v_function:='public.atomic_import_reviewed_v3_legacy_validation_projection(jsonb,jsonb)'::regprocedure;
  if not exists(
    select 1 from pg_proc p where p.oid=v_function and p.proowner='postgres'::regrole
      and p.provolatile='s' and p.prosecdef
      and p.proconfig=array['search_path=pg_catalog, public, pg_temp']::text[]
  ) or exists(
    select 1 from pg_proc p
    cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) acl
    where p.oid=v_function and acl.grantee<>p.proowner and acl.privilege_type='EXECUTE'
  ) then
    raise exception 'reviewed V3 composite size projection metadata differs';
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
  perform set_config('app.reviewed_v3_composite_projection_counts',v_counts::text,true);
end
$preflight$;

do $install_projection$
declare
  v_definition text:=pg_get_functiondef(
    'public.atomic_import_reviewed_v3_legacy_validation_projection(jsonb,jsonb)'::regprocedure
  );
  v_before text:=$needle$    if lower(btrim(coalesce(v_physical_key,'')))='size' then null;
$needle$;
  v_after text:=$replacement$    if lower(btrim(coalesce(v_physical_key,'')))='size' then
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
$replacement$;
begin
  if length(v_definition)-length(replace(v_definition,v_before,''))<>length(v_before) then
    raise exception 'reviewed V3 composite size projection install anchor differs';
  end if;
  execute replace(v_definition,v_before,v_after);
end
$install_projection$;

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
  v_counts_before jsonb:=current_setting('app.reviewed_v3_composite_projection_counts')::jsonb;
  v_counts_after jsonb;
  v_projection_sha text;
  v_function regprocedure:='public.atomic_import_reviewed_v3_legacy_validation_projection(jsonb,jsonb)'::regprocedure;
begin
  v_projection_sha:=encode(pg_catalog.sha256(convert_to(pg_get_functiondef(v_function),'UTF8')),'hex');
  if v_projection_sha<>'2548c3b702403a2fda4176dbe732c993d85e14690157286aa65029f434813dff' then
    raise exception 'reviewed V3 composite size projection postflight SHA: %, apply-pre-source SHA: %',
      v_projection_sha,
      encode(pg_catalog.sha256(convert_to(pg_get_functiondef(
        'public.atomic_import_apply_pre_source_metadata_plan_core(jsonb)'::regprocedure
      ),'UTF8')),'hex');
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
    raise exception 'reviewed V3 composite size projection postflight metadata differs';
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
    raise exception 'reviewed V3 composite size projection migration changed business counts';
  end if;
end
$postflight$;

commit;
