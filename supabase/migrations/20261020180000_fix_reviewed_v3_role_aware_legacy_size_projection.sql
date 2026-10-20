begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';

select pg_advisory_xact_lock(hashtextextended('reviewed-catalogue-v3-schema',0));

do $preflight$
declare
  v_target jsonb;
  v_function regprocedure;
begin
  if to_regprocedure('public.atomic_import_reviewed_v3_legacy_validation_projection(jsonb,jsonb)') is not null
     or to_regprocedure('public.atomic_import_reviewed_v3_legacy_validation_evidence(jsonb,jsonb)') is null
     or to_regprocedure('public.atomic_import_validate_reviewed_catalogue_v3_plan(jsonb,jsonb)') is null
     or to_regprocedure('public.atomic_import_reviewed_catalogue_v3_plan_allowed(jsonb)') is null
     or to_regprocedure('public.atomic_import_reviewed_v3_physical_role_allowed(jsonb,jsonb)') is null
     or to_regprocedure('public.atomic_import_reviewed_v3_count_role_allowed(jsonb,jsonb)') is null
     or to_regprocedure('public.apply_approved_reviewed_catalogue_v3_plan(uuid,jsonb,jsonb)') is null then
    raise exception 'reviewed catalogue V3 role-aware size projection prerequisites are missing';
  end if;

  if encode(pg_catalog.sha256(convert_to(pg_get_functiondef(
       'public.atomic_import_reviewed_v3_legacy_validation_evidence(jsonb,jsonb)'::regprocedure
     ),'UTF8')),'hex') <> '3f25c76ae3407552f99e035d60f2629838ab878d5f127b20d29be02aa834fdfc'
     or encode(pg_catalog.sha256(convert_to(pg_get_functiondef(
       'public.atomic_import_validate_reviewed_catalogue_v3_plan(jsonb,jsonb)'::regprocedure
     ),'UTF8')),'hex') <> 'f1f5697a7ca6c3064b358e9296b98a1e411907a127b03248d14f9d75f90b4307'
     or encode(pg_catalog.sha256(convert_to(pg_get_functiondef(
       'public.atomic_import_reviewed_catalogue_v3_plan_allowed(jsonb)'::regprocedure
     ),'UTF8')),'hex') <> '8f938dc266a7f2d9f2e1cb8d6b4f2a82e5d8841ee72b64f8fc610edf6fa48e99'
     or encode(pg_catalog.sha256(convert_to(pg_get_functiondef(
       'public.apply_approved_reviewed_catalogue_v3_plan(uuid,jsonb,jsonb)'::regprocedure
     ),'UTF8')),'hex') <> 'b6670a735282f9d04d0064ce2a3bdbbca055d1b99201a4db87fed2d50a25c734' then
    raise exception 'reviewed catalogue V3 role-aware size projection lineage differs';
  end if;

  foreach v_function in array array[
    'public.atomic_import_reviewed_v3_legacy_validation_evidence(jsonb,jsonb)'::regprocedure,
    'public.atomic_import_validate_reviewed_catalogue_v3_plan(jsonb,jsonb)'::regprocedure
  ] loop
    if not exists(
      select 1 from pg_proc p
      where p.oid=v_function and p.proowner='postgres'::regrole and p.provolatile='s' and p.prosecdef
        and p.proconfig=array['search_path=pg_catalog, public, pg_temp']::text[]
    ) then
      raise exception 'reviewed catalogue V3 role-aware size projection metadata differs: %',v_function;
    end if;
  end loop;

  if exists(
    select 1 from public.approved_import_plans
    where source ~ '^reviewed-catalogue-package-v3:'
      and status='approved' and consumed_at is null and expires_at>now()
  ) then
    raise exception 'reviewed catalogue V3 role-aware size projection blocked by live approval';
  end if;

  v_target:=public.retailer_catalogue_actual_database_target();
  if v_target->>'target_environment' not in ('STAGING','PRODUCTION')
     or v_target->>'project_ref' not in ('hxnrsyyqffztlvcrtgbf','aftboxmrdgyhizicfsfu') then
    raise exception 'reviewed catalogue V3 role-aware size projection unsupported database target';
  end if;
  if exists(
       select 1 from pg_proc p
       cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) acl
       where p.oid in (
           'public.atomic_import_reviewed_v3_legacy_validation_evidence(jsonb,jsonb)'::regprocedure,
           'public.atomic_import_validate_reviewed_catalogue_v3_plan(jsonb,jsonb)'::regprocedure
         )
         and acl.grantee<>p.proowner and acl.privilege_type='EXECUTE'
     ) then
    raise exception 'reviewed catalogue V3 role-aware size projection ACL baseline differs';
  end if;
end
$preflight$;

create function public.atomic_import_reviewed_v3_legacy_validation_projection(
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

create or replace function public.atomic_import_reviewed_v3_legacy_validation_evidence(
  p_plan jsonb,
  p_envelope jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $compatibility$
begin
  if not public.atomic_import_reviewed_catalogue_v3_plan_allowed(p_plan) then
    raise exception 'V3_LEGACY_COMPATIBILITY_MISMATCH: trusted V3 context required';
  end if;
  if not exists(
    select 1 from public.approved_import_plans
    where id::text=current_setting('app.reviewed_catalogue_v3_approval_id',true)
      and plan_json=p_plan
      and authorization_envelope=p_envelope
  ) then
    raise exception 'V3_LEGACY_COMPATIBILITY_MISMATCH: approval envelope binding differs';
  end if;
  return public.atomic_import_reviewed_v3_legacy_validation_projection(p_plan,p_envelope);
end
$compatibility$;

alter function public.atomic_import_reviewed_v3_legacy_validation_evidence(jsonb,jsonb) owner to postgres;

do $validator_parity$
declare
  v_validator regprocedure:='public.atomic_import_validate_reviewed_catalogue_v3_plan(jsonb,jsonb)'::regprocedure;
  v_definition text;
  v_patched text;
  v_anchor text:=$patch$  return jsonb_build_object(
    'valid',true,'contract_kind','reviewed-catalogue-package-v3',$patch$;
  v_replacement text:=$patch$  if jsonb_typeof(p_plan#>'{product_variant,evidence}')='object' then
    perform public.atomic_import_reviewed_v3_legacy_validation_projection(p_plan,p_envelope);
  end if;

  return jsonb_build_object(
    'valid',true,'contract_kind','reviewed-catalogue-package-v3',$patch$;
begin
  select pg_get_functiondef(v_validator) into v_definition;
  if (length(v_definition)-length(replace(v_definition,v_anchor,'')))/length(v_anchor)<>1 then
    raise exception 'reviewed catalogue V3 validator parity anchor differs';
  end if;
  v_patched:=replace(v_definition,v_anchor,v_replacement);
  execute v_patched;
end
$validator_parity$;

do $postflight$
declare
  v_projection regprocedure:='public.atomic_import_reviewed_v3_legacy_validation_projection(jsonb,jsonb)'::regprocedure;
  v_helper regprocedure:='public.atomic_import_reviewed_v3_legacy_validation_evidence(jsonb,jsonb)'::regprocedure;
  v_validator regprocedure:='public.atomic_import_validate_reviewed_catalogue_v3_plan(jsonb,jsonb)'::regprocedure;
  v_function regprocedure;
begin
  if encode(pg_catalog.sha256(convert_to(pg_get_functiondef(v_projection),'UTF8')),'hex')
       <> '48ce4f1bf0cb9c9d5dd75f2617b92482a19806bc272bd9ee95adab3518e5d92a'
     or encode(pg_catalog.sha256(convert_to(pg_get_functiondef(v_helper),'UTF8')),'hex')
       <> 'a5b8a05c0dc9cba672cbb4607c8d63660744165f88d2807e26d299159277b0f8'
     or encode(pg_catalog.sha256(convert_to(pg_get_functiondef(v_validator),'UTF8')),'hex')
       <> '04392ff0eff0e814ba54e41d0b9af38478174eda6f427e7eefcc35d18c7b3e0c' then
    raise exception 'reviewed catalogue V3 role-aware size projection definition verification failed';
  end if;
  foreach v_function in array array[v_projection,v_helper,v_validator] loop
    if not exists(
      select 1 from pg_proc p where p.oid=v_function and p.proowner='postgres'::regrole
        and p.provolatile='s' and p.prosecdef
        and p.proconfig=array['search_path=pg_catalog, public, pg_temp']::text[]
    ) then
      raise exception 'reviewed catalogue V3 role-aware size projection metadata verification failed: %',v_function;
    end if;
  end loop;
  if exists(
    select 1 from pg_proc p
    cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) acl
    where p.oid in (v_projection,v_helper,v_validator)
      and acl.grantee<>p.proowner and acl.privilege_type='EXECUTE'
  ) then
    raise exception 'reviewed catalogue V3 role-aware size projection helper ACL verification failed';
  end if;
end
$postflight$;

commit;
