begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';

select pg_advisory_xact_lock(hashtextextended('reviewed-catalogue-v3-schema',0));

do $preflight$
declare
  v_target jsonb:=public.retailer_catalogue_actual_database_target();
  v_projection regprocedure:='public.atomic_import_reviewed_v3_legacy_validation_projection(jsonb,jsonb)'::regprocedure;
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
    raise exception 'reviewed V3 existing-variant flavour alias rollback target differs';
  end if;
  if not exists(
    select 1 from supabase_migrations.schema_migrations
    where version='20261022080000'
      and name='allow_reviewed_v3_existing_variant_flavour_alias_projection'
  ) then
    raise exception 'reviewed V3 existing-variant flavour alias rollback ledger entry missing';
  end if;
  if exists(
    select 1 from public.approved_import_plans
    where source~'^reviewed-catalogue-package-v3:'
      and status='approved' and consumed_at is null and expires_at>now()
  ) then
    raise exception 'reviewed V3 existing-variant flavour alias rollback blocked by live approval';
  end if;
  if exists(
    select 1 from public.approved_import_plans a
    where a.source~'^reviewed-catalogue-package-v3:'
      and a.status='consumed' and a.consumed_at is not null and a.execution_result is not null
      and a.authorization_envelope->>'reviewed_action'='map_existing_variant'
      and a.plan_json#>>'{product,action}'='existing'
      and a.plan_json#>>'{product_variant,action}'='existing'
      and jsonb_typeof(a.authorization_envelope#>'{option_roles,flavour}')='object'
      and lower(a.authorization_envelope#>>'{option_roles,flavour,source_value}') not in (
        lower(coalesce(a.plan_json#>>'{expected_state,product_variant,flavour_code}','')),
        lower(coalesce(a.plan_json#>>'{expected_state,product_variant,flavour_label}',''))
      )
  ) then
    raise exception 'reviewed V3 existing-variant flavour alias rollback blocked by dependent execution';
  end if;
  if encode(pg_catalog.sha256(convert_to(pg_get_functiondef(v_projection),'UTF8')),'hex')
       <> '7714cb21a64af063079c34cd5929b242030913c850532d5e71162839b974f1e6'
     or encode(pg_catalog.sha256(convert_to(pg_get_functiondef(
       'public.atomic_import_reviewed_v3_legacy_validation_evidence(jsonb,jsonb)'::regprocedure
     ),'UTF8')),'hex') <> 'a5b8a05c0dc9cba672cbb4607c8d63660744165f88d2807e26d299159277b0f8'
     or encode(pg_catalog.sha256(convert_to(pg_get_functiondef(
       'public.atomic_import_validate_reviewed_catalogue_v3_plan(jsonb,jsonb)'::regprocedure
     ),'UTF8')),'hex') <> '04392ff0eff0e814ba54e41d0b9af38478174eda6f427e7eefcc35d18c7b3e0c'
     or encode(pg_catalog.sha256(convert_to(pg_get_functiondef(
       'public.atomic_import_reviewed_catalogue_v3_plan_allowed(jsonb)'::regprocedure
     ),'UTF8')),'hex') <> '8f938dc266a7f2d9f2e1cb8d6b4f2a82e5d8841ee72b64f8fc610edf6fa48e99'
     or encode(pg_catalog.sha256(convert_to(pg_get_functiondef(
       'public.apply_approved_reviewed_catalogue_v3_plan(uuid,jsonb,jsonb)'::regprocedure
     ),'UTF8')),'hex') <> 'b6670a735282f9d04d0064ce2a3bdbbca055d1b99201a4db87fed2d50a25c734'
     or encode(pg_catalog.sha256(convert_to(pg_get_functiondef(
       'public.approve_reviewed_catalogue_v3_plan(jsonb,jsonb,timestamptz)'::regprocedure
     ),'UTF8')),'hex') <> '1f83251fc3628e2a772e8e647fe3f5be188fea0d221174cec263d7db968443c1' then
    raise exception 'reviewed V3 existing-variant flavour alias rollback lineage differs';
  end if;
  if not exists(
    select 1 from pg_proc p where p.oid=v_projection and p.proowner='postgres'::regrole
      and p.provolatile='s' and p.prosecdef
      and p.proconfig=array['search_path=pg_catalog, public, pg_temp']::text[]
  )
  or exists(
    select 1 from pg_proc p
    cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) acl
    where p.oid=v_projection and acl.grantee<>p.proowner and acl.privilege_type='EXECUTE'
  ) then
    raise exception 'reviewed V3 existing-variant flavour alias rollback metadata differs';
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
  perform set_config('app.reviewed_v3_alias_projection_rollback_counts',v_counts::text,true);
end
$preflight$;

create or replace function public.atomic_import_reviewed_v3_legacy_validation_projection(
  p_plan jsonb,
  p_envelope jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $projection$
declare
  v_evidence jsonb:=p_plan#>'{product_variant,evidence}';
  v_raw_options jsonb:=p_envelope->'external_options';
  v_validation_options jsonb;
  v_flavour jsonb:=p_envelope#>'{option_roles,flavour}';
  v_physical jsonb:=p_envelope#>'{option_roles,physical_size}';
  v_count jsonb:=p_envelope#>'{option_roles,count}';
  v_flavour_key text;
  v_flavour_normalized_key text;
  v_flavour_alias_count integer;
  v_physical_key text;
  v_count_key text;
  v_size_key text;
  v_size_key_count integer;
begin
  if jsonb_typeof(v_evidence)<>'object'
     or jsonb_typeof(v_evidence->'external_options')<>'object'
     or jsonb_typeof(v_raw_options)<>'object'
     or v_evidence->'external_options' is distinct from v_raw_options then
    raise exception 'V3_LEGACY_COMPATIBILITY_MISMATCH: original evidence options differ';
  end if;
  if not public.atomic_import_reviewed_v3_physical_role_allowed(v_raw_options,v_physical)
     or not public.atomic_import_reviewed_v3_count_role_allowed(v_raw_options,v_count) then
    raise exception 'V3_LEGACY_COMPATIBILITY_MISMATCH: option role lost raw binding';
  end if;

  v_evidence:=v_evidence-array['unit_count','unit_type'];
  v_validation_options:=v_raw_options;

  if jsonb_typeof(v_flavour)='null' then
    null;
  elsif jsonb_typeof(v_flavour)='object' then
    if not public.atomic_import_has_exact_keys(v_flavour,array['source_key','source_value']) then
      raise exception 'V3_LEGACY_COMPATIBILITY_MISMATCH: invalid flavour role';
    end if;
    v_flavour_key:=v_flavour->>'source_key';
    v_flavour_normalized_key:=lower(btrim(coalesce(v_flavour_key,'')));
    if v_flavour_normalized_key not in ('flavour','flavor','flavours','flavors')
       or v_raw_options->>v_flavour_key is distinct from v_flavour->>'source_value' then
      raise exception 'V3_LEGACY_COMPATIBILITY_MISMATCH: flavour role lost raw binding';
    end if;
    select count(*) into v_flavour_alias_count
    from jsonb_each_text(v_raw_options) as option_row(key,value)
    where lower(btrim(option_row.key)) in ('flavour','flavor','flavours','flavors');
    if v_flavour_alias_count<>1 then
      raise exception 'V3_LEGACY_COMPATIBILITY_MISMATCH: ambiguous flavour aliases';
    end if;
    if v_flavour_normalized_key in ('flavours','flavors') then
      v_validation_options:=jsonb_set(
        v_validation_options,array['Flavour'],to_jsonb(v_flavour->>'source_value'),true
      );
    end if;
  else
    raise exception 'V3_LEGACY_COMPATIBILITY_MISMATCH: invalid flavour role';
  end if;

  select count(*),min(option_row.key) into v_size_key_count,v_size_key
  from jsonb_each_text(v_raw_options) as option_row(key,value)
  where lower(btrim(option_row.key))='size';
  if v_size_key_count>1 then
    raise exception 'V3_LEGACY_COMPATIBILITY_MISMATCH: ambiguous size aliases';
  end if;

  if jsonb_typeof(v_physical)='object' then
    v_physical_key:=v_physical->>'source_key';
  elsif jsonb_typeof(v_physical)<>'null' then
    raise exception 'V3_LEGACY_COMPATIBILITY_MISMATCH: invalid physical role';
  end if;
  if jsonb_typeof(v_count)='object' then
    v_count_key:=v_count->>'source_key';
  elsif jsonb_typeof(v_count)<>'null' then
    raise exception 'V3_LEGACY_COMPATIBILITY_MISMATCH: invalid count role';
  end if;
  if v_physical_key is not null and v_count_key is not null
     and lower(btrim(v_physical_key))=lower(btrim(v_count_key)) then
    raise exception 'V3_LEGACY_COMPATIBILITY_MISMATCH: physical and count roles conflict';
  end if;

  if v_size_key_count=1 then
    if lower(btrim(coalesce(v_physical_key,'')))='size' then
      null;
    elsif lower(btrim(coalesce(v_count_key,'')))='size' then
      if v_physical_key is null then
        v_validation_options:=v_validation_options-v_size_key;
      else
        v_validation_options:=jsonb_set(
          v_validation_options,array[v_size_key],to_jsonb(v_physical->>'source_value'),false
        );
      end if;
    elsif v_physical_key is not null and v_count_key is null then
      v_validation_options:=v_validation_options-v_size_key;
    end if;
  end if;

  return jsonb_set(v_evidence,'{external_options}',v_validation_options,false);
end
$projection$;

alter function public.atomic_import_reviewed_v3_legacy_validation_projection(jsonb,jsonb) owner to postgres;
revoke all on function public.atomic_import_reviewed_v3_legacy_validation_projection(jsonb,jsonb)
  from public,anon,authenticated,service_role;

do $environment_acl$
declare
  v_role text;
begin
  foreach v_role in array array[
    'retailer_catalogue_staging_validator','retailer_catalogue_staging_approver','retailer_catalogue_staging_executor',
    'retailer_catalogue_production_validator','retailer_catalogue_production_approver','retailer_catalogue_production_executor'
  ] loop
    if to_regrole(v_role) is not null then
      execute format(
        'revoke all on function public.atomic_import_reviewed_v3_legacy_validation_projection(jsonb,jsonb) from %I',
        v_role
      );
    end if;
  end loop;
end
$environment_acl$;

do $postflight$
declare
  v_projection regprocedure:='public.atomic_import_reviewed_v3_legacy_validation_projection(jsonb,jsonb)'::regprocedure;
  v_counts_before jsonb:=current_setting('app.reviewed_v3_alias_projection_rollback_counts')::jsonb;
  v_counts_after jsonb;
begin
  if encode(pg_catalog.sha256(convert_to(pg_get_functiondef(v_projection),'UTF8')),'hex')
       <> '48ce4f1bf0cb9c9d5dd75f2617b92482a19806bc272bd9ee95adab3518e5d92a' then
    raise exception 'reviewed V3 existing-variant flavour alias rollback SHA differs';
  end if;
  if not exists(
    select 1 from pg_proc p where p.oid=v_projection and p.proowner='postgres'::regrole
      and p.provolatile='s' and p.prosecdef
      and p.proconfig=array['search_path=pg_catalog, public, pg_temp']::text[]
  )
  or exists(
    select 1 from pg_proc p
    cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) acl
    where p.oid=v_projection and acl.grantee<>p.proowner and acl.privilege_type='EXECUTE'
  ) then
    raise exception 'reviewed V3 existing-variant flavour alias rollback metadata changed';
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
    raise exception 'reviewed V3 existing-variant flavour alias rollback changed business counts';
  end if;
end
$postflight$;

commit;
