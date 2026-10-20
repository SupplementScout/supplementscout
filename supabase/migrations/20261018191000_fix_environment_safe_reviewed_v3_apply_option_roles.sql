begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';

select pg_advisory_xact_lock(hashtextextended('reviewed-catalogue-v3-schema',0));

do $preflight$
declare
  v_standard regprocedure;
  v_pre_source regprocedure;
  v_definition text;
  v_pre_source_definition text;
  v_sha256 text;
  v_target jsonb;
begin
  if to_regprocedure('public.atomic_import_apply_standard_plan_core(jsonb)') is null
     or to_regprocedure('public.atomic_import_apply_pre_source_metadata_plan_core(jsonb)') is null
     or to_regprocedure('public.atomic_import_validate_pre_source_metadata_plan_core(jsonb)') is null
     or to_regprocedure('public.atomic_import_reviewed_catalogue_v3_plan_allowed(jsonb)') is null
     or to_regprocedure('public.atomic_import_validate_reviewed_catalogue_v3_plan(jsonb,jsonb)') is null
     or to_regprocedure('public.apply_approved_reviewed_catalogue_v3_plan(uuid,jsonb,jsonb)') is null then
    raise exception 'reviewed catalogue V3 option-role prerequisites are missing';
  end if;
  if to_regprocedure('public.atomic_import_reviewed_v3_legacy_validation_evidence(jsonb,jsonb)') is not null then
    raise exception 'reviewed catalogue V3 option-role compatibility already exists';
  end if;

  if encode(pg_catalog.sha256(convert_to(pg_get_functiondef(
       'public.atomic_import_reviewed_catalogue_v3_plan_allowed(jsonb)'::regprocedure
     ),'UTF8')),'hex') <> '8f938dc266a7f2d9f2e1cb8d6b4f2a82e5d8841ee72b64f8fc610edf6fa48e99'
     or encode(pg_catalog.sha256(convert_to(pg_get_functiondef(
       'public.atomic_import_validate_reviewed_catalogue_v3_plan(jsonb,jsonb)'::regprocedure
     ),'UTF8')),'hex') <> 'f1f5697a7ca6c3064b358e9296b98a1e411907a127b03248d14f9d75f90b4307'
     or encode(pg_catalog.sha256(convert_to(pg_get_functiondef(
       'public.apply_approved_reviewed_catalogue_v3_plan(uuid,jsonb,jsonb)'::regprocedure
     ),'UTF8')),'hex') <> 'b6670a735282f9d04d0064ce2a3bdbbca055d1b99201a4db87fed2d50a25c734' then
    raise exception 'reviewed catalogue V3 option-role boundary lineage differs';
  end if;

  v_standard := 'public.atomic_import_apply_standard_plan_core(jsonb)'::regprocedure;
  v_definition := pg_get_functiondef(v_standard);
  v_sha256 := encode(pg_catalog.sha256(convert_to(v_definition,'UTF8')),'hex');
  if v_sha256 not in (
       '69311caa0dda83010f986dfbd76bc0017d3a0f999c64b1dd5e35dcb87b7d4c48',
       '0b0bccb01e521228db93f495db7984372df5b177cf7009edc205620c1ddef634'
     ) then
    raise exception 'reviewed catalogue V3 unsupported apply lineage: %',v_sha256;
  end if;
  if (length(v_definition)-length(replace(v_definition,'  v_evidence jsonb;','')))/length('  v_evidence jsonb;') <> 1
     or (length(v_definition)-length(replace(v_definition,$anchor$  v_evidence := p_plan#>'{product_variant,evidence}';$anchor$,'')))/length($anchor$  v_evidence := p_plan#>'{product_variant,evidence}';$anchor$) <> 1
     or (length(v_definition)-length(replace(v_definition,$anchor$begin
  perform public.validate_product_import_plan_read_only(p_plan);$anchor$,'')))/length($anchor$begin
  perform public.validate_product_import_plan_read_only(p_plan);$anchor$) <> 1
     or (
       (length(v_definition)-length(replace(v_definition,$anchor$p_plan#>'{product_variant,evidence}',$anchor$,'')))/length($anchor$p_plan#>'{product_variant,evidence}',$anchor$)
       +(length(v_definition)-length(replace(v_definition,$anchor$(p_plan#>'{product_variant,evidence}') - array['unit_count','unit_type'],$anchor$,'')))/length($anchor$(p_plan#>'{product_variant,evidence}') - array['unit_count','unit_type'],$anchor$)
     ) <> 2
     or (length(v_definition)-length(replace(v_definition,$anchor$from jsonb_each_text(case
    when jsonb_typeof(v_evidence->'external_options') = 'object'
      then v_evidence->'external_options'
    else '{}'::jsonb
  end)$anchor$,'')))/length($anchor$from jsonb_each_text(case
    when jsonb_typeof(v_evidence->'external_options') = 'object'
      then v_evidence->'external_options'
    else '{}'::jsonb
  end)$anchor$) <> 2 then
    raise exception 'reviewed catalogue V3 apply evidence anchors differ';
  end if;
  if not exists(
       select 1 from pg_proc p
       where p.oid=v_standard and p.proowner='postgres'::regrole and p.provolatile='v' and p.prosecdef
         and p.proconfig=array['search_path=pg_catalog, public, pg_temp']::text[]
     )
     or exists(
       select 1 from pg_proc p cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) acl
       where p.oid=v_standard and acl.grantee<>p.proowner and acl.privilege_type='EXECUTE'
     ) then
    raise exception 'reviewed catalogue V3 apply ownership or ACL baseline differs';
  end if;

  v_pre_source := 'public.atomic_import_apply_pre_source_metadata_plan_core(jsonb)'::regprocedure;
  v_pre_source_definition := pg_get_functiondef(v_pre_source);
  if encode(pg_catalog.sha256(convert_to(v_pre_source_definition,'UTF8')),'hex')
       <> 'f560a7a93e3458db20d4a71451da35b53fe1fac9379bfedcd86ab98b76d3d648'
     or (length(v_pre_source_definition)-length(replace(v_pre_source_definition,$anchor$    v_product_created := true;
  end if;

  perform public.validate_product_import_plan_read_only(p_plan);

  insert into public.product_variants($anchor$,'')))/length($anchor$    v_product_created := true;
  end if;

  perform public.validate_product_import_plan_read_only(p_plan);

  insert into public.product_variants($anchor$)<>1
     or not exists(
       select 1 from pg_proc p
       where p.oid=v_pre_source and p.proowner='postgres'::regrole and p.provolatile='v' and p.prosecdef
         and p.proconfig=array['search_path=pg_catalog, public, pg_temp']::text[]
     )
     or exists(
       select 1 from pg_proc p cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) acl
       where p.oid=v_pre_source and acl.grantee<>p.proowner and acl.privilege_type='EXECUTE'
     ) then
    raise exception 'reviewed catalogue V3 pre-source apply lineage differs';
  end if;

  v_target := public.retailer_catalogue_actual_database_target();
  if v_target->>'target_environment' not in ('STAGING','PRODUCTION')
     or v_target->>'project_ref' not in ('hxnrsyyqffztlvcrtgbf','aftboxmrdgyhizicfsfu') then
    raise exception 'reviewed catalogue V3 unsupported database target';
  end if;
end
$preflight$;

create function public.atomic_import_reviewed_v3_legacy_validation_evidence(
  p_plan jsonb,
  p_envelope jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $compatibility$
declare
  v_evidence jsonb := p_plan#>'{product_variant,evidence}';
  v_raw_options jsonb := p_envelope->'external_options';
  v_validation_options jsonb;
  v_physical jsonb := p_envelope#>'{option_roles,physical_size}';
  v_count jsonb := p_envelope#>'{option_roles,count}';
  v_count_key text;
  v_physical_key text;
begin
  perform public.atomic_import_validate_reviewed_catalogue_v3_plan(p_plan,p_envelope);

  if jsonb_typeof(v_evidence)<>'object'
     or jsonb_typeof(v_evidence->'external_options')<>'object'
     or v_evidence->'external_options' is distinct from v_raw_options then
    raise exception 'V3_LEGACY_COMPATIBILITY_MISMATCH: original evidence options differ';
  end if;
  v_evidence := v_evidence-array['unit_count','unit_type'];
  if jsonb_typeof(v_count)='null' then
    return v_evidence;
  end if;
  if jsonb_typeof(v_count)<>'object' then
    raise exception 'V3_LEGACY_COMPATIBILITY_MISMATCH: invalid count role';
  end if;

  v_count_key := v_count->>'source_key';
  if lower(btrim(coalesce(v_count_key,'')))<>'size' then
    return v_evidence;
  end if;
  if v_raw_options->>v_count_key is distinct from v_count->>'source_value' then
    raise exception 'V3_LEGACY_COMPATIBILITY_MISMATCH: count role lost raw binding';
  end if;

  v_validation_options := v_raw_options;
  if jsonb_typeof(v_physical)='null' then
    v_validation_options := v_validation_options-v_count_key;
  elsif jsonb_typeof(v_physical)='object' then
    v_physical_key := v_physical->>'source_key';
    if lower(btrim(coalesce(v_physical_key,'')))=lower(btrim(v_count_key))
       or v_raw_options->>v_physical_key is distinct from v_physical->>'source_value' then
      raise exception 'V3_LEGACY_COMPATIBILITY_MISMATCH: physical role lost raw binding';
    end if;
    v_validation_options := jsonb_set(
      v_validation_options,
      array[v_count_key],
      to_jsonb(v_physical->>'source_value'),
      false
    );
  else
    raise exception 'V3_LEGACY_COMPATIBILITY_MISMATCH: invalid physical role';
  end if;

  return jsonb_set(v_evidence,'{external_options}',v_validation_options,false);
end
$compatibility$;

alter function public.atomic_import_reviewed_v3_legacy_validation_evidence(jsonb,jsonb) owner to postgres;
revoke all on function public.atomic_import_reviewed_v3_legacy_validation_evidence(jsonb,jsonb)
  from public,anon,authenticated,service_role;

do $install$
declare
  v_definition text := pg_get_functiondef(
    'public.atomic_import_apply_standard_plan_core(jsonb)'::regprocedure
  );
  v_original_declaration text := '  v_evidence jsonb;';
  v_patched_declaration text := $patch$  v_evidence jsonb;
  v_reviewed_v3_legacy_evidence jsonb;
  v_reviewed_v3_envelope jsonb;$patch$;
  v_original_beginning text := $patch$begin
  perform public.validate_product_import_plan_read_only(p_plan);$patch$;
  v_patched_beginning text := $patch$begin
  perform public.validate_product_import_plan_read_only(p_plan);
  if public.atomic_import_reviewed_catalogue_v3_plan_allowed(p_plan) then
    select authorization_envelope into v_reviewed_v3_envelope
    from public.approved_import_plans
    where id::text=current_setting('app.reviewed_catalogue_v3_approval_id',true);
    if not found then
      raise exception 'V3_LEGACY_COMPATIBILITY_MISMATCH: approval envelope unavailable';
    end if;
    v_reviewed_v3_legacy_evidence := public.atomic_import_reviewed_v3_legacy_validation_evidence(
      p_plan,
      v_reviewed_v3_envelope
    );
  else
    v_reviewed_v3_legacy_evidence := p_plan#>'{product_variant,evidence}';
  end if;$patch$;
  v_staging_schema_view text := $patch$p_plan#>'{product_variant,evidence}',$patch$;
  v_production_schema_view text := $patch$(p_plan#>'{product_variant,evidence}') - array['unit_count','unit_type'],$patch$;
  v_patched_schema_view text := 'v_reviewed_v3_legacy_evidence,';
  v_original_option_view text := $patch$from jsonb_each_text(case
    when jsonb_typeof(v_evidence->'external_options') = 'object'
      then v_evidence->'external_options'
    else '{}'::jsonb
  end)$patch$;
  v_patched_option_view text := $patch$from jsonb_each_text(case
    when jsonb_typeof(v_reviewed_v3_legacy_evidence->'external_options') = 'object'
      then v_reviewed_v3_legacy_evidence->'external_options'
    else '{}'::jsonb
  end)$patch$;
begin
  v_definition := replace(v_definition,v_original_declaration,v_patched_declaration);
  v_definition := replace(v_definition,v_original_beginning,v_patched_beginning);
  v_definition := replace(v_definition,v_staging_schema_view,v_patched_schema_view);
  v_definition := replace(v_definition,v_production_schema_view,v_patched_schema_view);
  v_definition := replace(v_definition,v_original_option_view,v_patched_option_view);
  execute v_definition;
end
$install$;

alter function public.atomic_import_apply_standard_plan_core(jsonb) owner to postgres;
revoke all on function public.atomic_import_apply_standard_plan_core(jsonb)
  from public,anon,authenticated,service_role;

do $install_pre_source$
declare
  v_definition text := pg_get_functiondef(
    'public.atomic_import_apply_pre_source_metadata_plan_core(jsonb)'::regprocedure
  );
  v_original text := $patch$    v_product_created := true;
  end if;

  perform public.validate_product_import_plan_read_only(p_plan);

  insert into public.product_variants($patch$;
  v_patched text := $patch$    v_product_created := true;
  end if;

  if public.atomic_import_reviewed_catalogue_v3_plan_allowed(p_plan) then
    perform public.atomic_import_validate_pre_source_metadata_plan_core(p_plan);
  else
    perform public.validate_product_import_plan_read_only(p_plan);
  end if;

  insert into public.product_variants($patch$;
begin
  v_definition := replace(v_definition,v_original,v_patched);
  execute v_definition;
end
$install_pre_source$;

alter function public.atomic_import_apply_pre_source_metadata_plan_core(jsonb) owner to postgres;
revoke all on function public.atomic_import_apply_pre_source_metadata_plan_core(jsonb)
  from public,anon,authenticated,service_role;

do $environment_acl$
declare
  v_environment text:=public.retailer_catalogue_actual_database_target()->>'target_environment';
  v_validator text;
  v_approver text;
  v_executor text;
  v_role text;
  v_signature text;
begin
  v_validator:=case v_environment
    when 'STAGING' then 'retailer_catalogue_staging_validator'
    when 'PRODUCTION' then 'retailer_catalogue_production_validator'
  end;
  v_approver:=case v_environment
    when 'STAGING' then 'retailer_catalogue_staging_approver'
    when 'PRODUCTION' then 'retailer_catalogue_production_approver'
  end;
  v_executor:=case v_environment
    when 'STAGING' then 'retailer_catalogue_staging_executor'
    when 'PRODUCTION' then 'retailer_catalogue_production_executor'
  end;
  if v_validator is null or v_approver is null or v_executor is null
     or to_regrole(v_validator) is null
     or to_regrole(v_approver) is null
     or to_regrole(v_executor) is null then
    raise exception 'reviewed catalogue V3 option-role required environment roles are missing';
  end if;

  foreach v_role in array array[
    'retailer_catalogue_staging_validator','retailer_catalogue_staging_approver','retailer_catalogue_staging_executor',
    'retailer_catalogue_production_validator','retailer_catalogue_production_approver','retailer_catalogue_production_executor'
  ] loop
    if to_regrole(v_role) is not null then
      foreach v_signature in array array[
        'public.atomic_import_reviewed_v3_legacy_validation_evidence(jsonb,jsonb)',
        'public.atomic_import_apply_standard_plan_core(jsonb)',
        'public.atomic_import_apply_pre_source_metadata_plan_core(jsonb)'
      ] loop
        execute format('revoke all on function %s from %I',v_signature,v_role);
      end loop;
    end if;
  end loop;
end
$environment_acl$;

do $postflight$
declare
  v_definition text := pg_get_functiondef(
    'public.atomic_import_apply_standard_plan_core(jsonb)'::regprocedure
  );
  v_pre_source_definition text := pg_get_functiondef(
    'public.atomic_import_apply_pre_source_metadata_plan_core(jsonb)'::regprocedure
  );
  v_helper regprocedure := 'public.atomic_import_reviewed_v3_legacy_validation_evidence(jsonb,jsonb)'::regprocedure;
  v_function regprocedure;
begin
  if position('v_reviewed_v3_legacy_evidence := public.atomic_import_reviewed_v3_legacy_validation_evidence(' in v_definition)=0
     or (length(v_definition)-length(replace(v_definition,'v_reviewed_v3_legacy_evidence->''external_options''','')))/length('v_reviewed_v3_legacy_evidence->''external_options''')<>4
     or position($anchor$insert into public.retailer_products($anchor$ in v_definition)=0
     or position($anchor$p_plan#>'{retailer_product,values,external_options}'$anchor$ in v_definition)=0
     or position('if public.atomic_import_reviewed_catalogue_v3_plan_allowed(p_plan) then' in v_pre_source_definition)=0
     or position('perform public.atomic_import_validate_pre_source_metadata_plan_core(p_plan);' in v_pre_source_definition)=0
     or not exists(
       select 1 from pg_proc p
       where p.oid=v_helper and p.proowner='postgres'::regrole and p.provolatile='s' and p.prosecdef
         and p.proconfig=array['search_path=pg_catalog, public, pg_temp']::text[]
     )
     or exists(
       select 1 from pg_proc p cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) acl
       where p.oid=v_helper and acl.grantee<>p.proowner and acl.privilege_type='EXECUTE'
     ) then
    raise exception 'reviewed catalogue V3 option-role compatibility verification failed';
  end if;
  foreach v_function in array array[
    'public.atomic_import_reviewed_v3_legacy_validation_evidence(jsonb,jsonb)'::regprocedure,
    'public.atomic_import_apply_standard_plan_core(jsonb)'::regprocedure,
    'public.atomic_import_apply_pre_source_metadata_plan_core(jsonb)'::regprocedure
  ] loop
    if exists(
      select 1 from pg_proc p
      cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) acl
      where p.oid=v_function and (
        acl.privilege_type<>'EXECUTE'
        or acl.grantee<>p.proowner
        or acl.grantor<>p.proowner
        or acl.is_grantable
      )
    ) then
      raise exception 'reviewed catalogue V3 option-role ACL verification failed: %',v_function;
    end if;
  end loop;
end
$postflight$;

commit;
