begin;
set local lock_timeout='5s';
set local statement_timeout='120s';
select pg_advisory_xact_lock(hashtextextended('reviewed-catalogue-v3-schema',0));
do $rollback$
declare
  v_function regprocedure:='public.atomic_import_validate_reviewed_catalogue_v3_plan(jsonb,jsonb)'::regprocedure;
  v_helper regprocedure:='public.atomic_import_reviewed_v3_canonical_role_allowed(jsonb,jsonb,text)'::regprocedure;
  v_definition text:=pg_get_functiondef(v_function);
begin
  if encode(pg_catalog.sha256(convert_to(v_definition,'UTF8')),'hex')<>'033cd54202f3ed2946eb78ba37a311c5a56a4f6eb421c0424b3239ad75c19baf' then raise exception 'reviewed V3 canonical evidence rollback lineage differs'; end if;
  if encode(pg_catalog.sha256(convert_to(pg_get_functiondef(v_helper),'UTF8')),'hex')<>'cc6c8017e87a3f02129dbd855960d8078348eb8271713a274e26ef5dcdf15f46' then raise exception 'reviewed V3 canonical evidence helper rollback lineage differs'; end if;
  if exists(select 1 from public.approved_import_plans where authorization_envelope ? 'canonical_identity_evidence' and authorization_envelope->'canonical_identity_evidence'<>'null'::jsonb) then
    raise exception 'reviewed V3 canonical evidence rollback blocked by durable evidence-backed approval';
  end if;
  v_definition:=replace(v_definition,$a$if not (
       public.atomic_import_has_exact_keys(p_envelope,array[
         'schema_version','kind','source_platform','target_environment','target_project_ref','retailer',
         'profile_id','manifest_sha256','artifact_sha256','run_id','review_row','reviewed_action',
         'external_product_id','external_variant_id','direct_source_url','affiliate_url','external_options',
         'option_roles','source_structure','source_row_fingerprint','plan_fingerprint'
       ])
       or public.atomic_import_has_exact_keys(p_envelope,array[
         'schema_version','kind','source_platform','target_environment','target_project_ref','retailer',
         'profile_id','manifest_sha256','artifact_sha256','run_id','review_row','reviewed_action',
         'external_product_id','external_variant_id','direct_source_url','affiliate_url','external_options',
         'option_roles','source_structure','source_row_fingerprint','plan_fingerprint','canonical_identity_evidence'
       ])
     )$a$,$b$if not public.atomic_import_has_exact_keys(p_envelope,array[
       'schema_version','kind','source_platform','target_environment','target_project_ref','retailer',
       'profile_id','manifest_sha256','artifact_sha256','run_id','review_row','reviewed_action',
       'external_product_id','external_variant_id','direct_source_url','affiliate_url','external_options',
       'option_roles','source_structure','source_row_fingerprint','plan_fingerprint'
     ])$b$);
  v_definition:=replace(v_definition,$a$or v_external_options is distinct from coalesce(v_mapping->'external_options','{}'::jsonb)
     or coalesce(p_envelope->'canonical_identity_evidence','null'::jsonb) is distinct from coalesce(p_plan#>'{product_variant,evidence,canonical_identity_evidence}','null'::jsonb) then$a$,$b$or v_external_options is distinct from coalesce(v_mapping->'external_options','{}'::jsonb) then$b$);
  v_definition:=replace(v_definition,$a$  if p_envelope ? 'canonical_identity_evidence' and not public.atomic_import_reviewed_v3_canonical_role_allowed(p_plan,p_envelope,'_validate_only') then
    raise exception 'V3_CANONICAL_EVIDENCE_SCHEMA_MISMATCH';
  end if;

  if p_envelope->>'external_product_id' !~ '^[0-9]{10,}$'$a$,$b$  if p_envelope->>'external_product_id' !~ '^[0-9]{10,}$'$b$);
  v_definition:=replace(v_definition,$a$if not public.atomic_import_reviewed_v3_physical_role_allowed(v_external_options,v_physical)
     and not public.atomic_import_reviewed_v3_canonical_role_allowed(p_plan,p_envelope,'physical_size') then$a$,$b$if not public.atomic_import_reviewed_v3_physical_role_allowed(v_external_options,v_physical) then$b$);
  v_definition:=replace(v_definition,$a$if not public.atomic_import_reviewed_v3_count_role_allowed(v_external_options,v_count)
     and not public.atomic_import_reviewed_v3_canonical_role_allowed(p_plan,p_envelope,'container_count') then$a$,$b$if not public.atomic_import_reviewed_v3_count_role_allowed(v_external_options,v_count) then$b$);
  v_definition:=replace(v_definition,$a$if (
           not public.atomic_import_is_decimal_string(v_variant_values->>'size_value')
           or (v_variant_values->>'size_value')::numeric<=0
           or v_physical->>'size_value' is distinct from v_variant_values->>'size_value'
           or v_physical->>'size_unit' is distinct from v_variant_values->>'size_unit'
         ) and not public.atomic_import_reviewed_v3_canonical_role_allowed(p_plan,p_envelope,'physical_size') then$a$,$b$if not public.atomic_import_is_decimal_string(v_variant_values->>'size_value')
         or (v_variant_values->>'size_value')::numeric<=0
         or v_physical->>'size_value' is distinct from v_variant_values->>'size_value'
         or v_physical->>'size_unit' is distinct from v_variant_values->>'size_unit' then$b$);
  v_definition:=replace(v_definition,$a$if (
           v_variant_values->'size_value'<>'null'::jsonb or v_variant_values->'size_unit'<>'null'::jsonb
           or coalesce(v_product_values->>'unit_count',p_plan#>>'{product_variant,evidence,unit_count}') is distinct from v_count->>'count_value'
           or coalesce(v_product_values->>'unit_type',p_plan#>>'{product_variant,evidence,unit_type}') is distinct from v_count->>'count_unit'
         ) and not public.atomic_import_reviewed_v3_canonical_role_allowed(p_plan,p_envelope,'container_count') then$a$,$b$if v_variant_values->'size_value'<>'null'::jsonb or v_variant_values->'size_unit'<>'null'::jsonb
         or coalesce(v_product_values->>'unit_count',p_plan#>>'{product_variant,evidence,unit_count}') is distinct from v_count->>'count_value'
         or coalesce(v_product_values->>'unit_type',p_plan#>>'{product_variant,evidence,unit_type}') is distinct from v_count->>'count_unit' then$b$);
  v_definition:=replace(v_definition,$a$if jsonb_typeof(v_count)='object' and (
      coalesce(v_product_values->>'unit_count',p_plan#>>'{product_variant,evidence,unit_count}') is distinct from v_count->>'count_value'
      or coalesce(v_product_values->>'unit_type',p_plan#>>'{product_variant,evidence,unit_type}') is distinct from v_count->>'count_unit'
    ) and not public.atomic_import_reviewed_v3_canonical_role_allowed(p_plan,p_envelope,'container_count') then$a$,$b$if jsonb_typeof(v_count)='object' and (
      coalesce(v_product_values->>'unit_count',p_plan#>>'{product_variant,evidence,unit_count}') is distinct from v_count->>'count_value'
      or coalesce(v_product_values->>'unit_type',p_plan#>>'{product_variant,evidence,unit_type}') is distinct from v_count->>'count_unit'
    ) then$b$);
  execute v_definition;
  if encode(pg_catalog.sha256(convert_to(pg_get_functiondef(v_function),'UTF8')),'hex')<>'04392ff0eff0e814ba54e41d0b9af38478174eda6f427e7eefcc35d18c7b3e0c' then raise exception 'reviewed V3 canonical evidence rollback restore differs'; end if;
end
$rollback$;
drop function public.atomic_import_reviewed_v3_canonical_role_allowed(jsonb,jsonb,text);
commit;
