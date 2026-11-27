begin;
-- LOCAL PROPOSAL ONLY. Requires the reviewed v4 private serializer proposal.
-- Extends the existing approval ledger and correction executor; no data apply.
set local lock_timeout='5s';
set local statement_timeout='60s';
do $owner$
begin
  if current_user<>'postgres' or (select nspowner from pg_namespace where nspname='atomic_import_private') is distinct from
    (select oid from pg_roles where rolname='postgres') then raise exception 'FORMAT_V2_OWNER_REQUIRED';end if;
end
$owner$;

create function atomic_import_private.correction_canonical_json(p_package jsonb)
returns text language plpgsql immutable strict set search_path=pg_catalog
as $canonical$
begin
  if p_package->'schema_version'='1'::jsonb then return public.atomic_import_canonical_json(p_package);
  elsif p_package->'schema_version'='2'::jsonb then return atomic_import_private.canonical_json(p_package);
  end if;
  raise exception 'FORMAT_CORRECTION_VERSION_UNSUPPORTED';
end
$canonical$;

create function atomic_import_private.validate_format_correction(p_package jsonb,p_require_before boolean)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog
as $validate$
declare v_target jsonb:=public.retailer_catalogue_actual_database_target();v_op jsonb:=p_package->'operation';
  v_product public.products%rowtype;v_variant public.product_variants%rowtype;v_actual jsonb;v_compare jsonb;
  v_format text;v_fingerprint text;
begin
  if public.atomic_import_has_exact_keys(p_package,array['schema_version','kind','status','authorized_by','authorized_at',
    'target_environment','target_project_ref','operation','evidence','policy','package_fingerprint','expected_state']) is distinct from true or
    p_package->'schema_version' is distinct from '2'::jsonb or p_package->>'kind' is distinct from 'reviewed-catalogue-product-pack-correction-v2' or
    coalesce(p_package->>'status','') not in ('PREPARED','OWNER_APPROVED') then raise exception 'FORMAT_V2_SCHEMA_INVALID';end if;
  if (p_package->>'status'='PREPARED' and (p_package->'authorized_by' is distinct from 'null'::jsonb or p_package->'authorized_at' is distinct from 'null'::jsonb)) or
    (p_package->>'status'='OWNER_APPROVED' and (nullif(btrim(p_package->>'authorized_by'),'') is null or nullif(p_package->>'authorized_at','') is null)) then
    raise exception 'FORMAT_V2_AUTHORIZATION_INVALID';end if;
  if p_package->>'status'='OWNER_APPROVED' then perform (p_package->>'authorized_at')::timestamptz;end if;
  if p_package->>'target_environment' is distinct from v_target->>'target_environment' or
    p_package->>'target_project_ref' is distinct from v_target->>'project_ref' then raise exception 'FORMAT_V2_TARGET_MISMATCH';end if;
  if public.atomic_import_has_exact_keys(v_op,array['table','product_id','product_variant_id','field','expected_before','reviewed_after']) is distinct from true or
    coalesce(v_op->>'table','') not in ('products','product_variants') or v_op->>'field' is distinct from 'product_format' or
    v_op->'expected_before' is distinct from 'null'::jsonb or coalesce(v_op->>'reviewed_after','') not in ('powder','capsule') or
    jsonb_typeof(v_op->'product_id') is distinct from 'string' or coalesce(v_op->>'product_id','')!~'^[1-9][0-9]*$' or
    (v_op->>'table'='products' and v_op->'product_variant_id' is distinct from 'null'::jsonb) or
    (v_op->>'table'='product_variants' and (jsonb_typeof(v_op->'product_variant_id') is distinct from 'string' or coalesce(v_op->>'product_variant_id','')!~'^[1-9][0-9]*$')) then
    raise exception 'FORMAT_V2_OPERATION_SCOPE_INVALID';end if;
  if public.atomic_import_has_exact_keys(p_package->'evidence',array['preparation_artifact','source_evidence']) is distinct from true or
    public.atomic_import_has_exact_keys(p_package#>'{evidence,preparation_artifact}',array['relative_path','sha256','artifact_fingerprint']) is distinct from true or
    public.atomic_import_has_exact_keys(p_package#>'{evidence,source_evidence}',array['relative_path','sha256']) is distinct from true or
    coalesce(p_package#>>'{evidence,preparation_artifact,relative_path}','') not like 'tmp/%' or
    coalesce(p_package#>>'{evidence,source_evidence,relative_path}','') not like 'tmp/%' or
    coalesce(p_package#>>'{evidence,preparation_artifact,sha256}','')!~'^[0-9a-f]{64}$' or
    coalesce(p_package#>>'{evidence,preparation_artifact,artifact_fingerprint}','')!~'^[0-9a-f]{64}$' or
    coalesce(p_package#>>'{evidence,source_evidence,sha256}','')!~'^[0-9a-f]{64}$' then raise exception 'FORMAT_V2_EVIDENCE_INVALID';end if;
  if public.atomic_import_has_exact_keys(p_package->'policy',array['single_canonical_row','single_field_only','exact_before_required',
    'strict_post_write_readback','row_count_delta_must_be_zero']) is distinct from true or
    exists(select 1 from jsonb_each(p_package->'policy') where value is distinct from 'true'::jsonb) then raise exception 'FORMAT_V2_POLICY_INVALID';end if;
  v_fingerprint:=encode(sha256(convert_to(atomic_import_private.canonical_json(jsonb_set(p_package,'{package_fingerprint}','null'::jsonb,false)),'UTF8')),'hex');
  if p_package->>'package_fingerprint' is distinct from v_fingerprint then raise exception 'FORMAT_V2_FINGERPRINT_MISMATCH';end if;
  select * into strict v_product from public.products where id=(v_op->>'product_id')::bigint;
  if not v_product.is_active or v_product.merged_into_product_id is not null then raise exception 'FORMAT_V2_PRODUCT_INACTIVE';end if;
  v_actual:=jsonb_build_object('product',jsonb_build_object('id',v_product.id::text,'name',v_product.name,'brand',v_product.brand,
    'product_format',v_product.product_format,'is_active',v_product.is_active,'merged_into_product_id',v_product.merged_into_product_id::text),'variant',null);
  if v_op->>'table'='product_variants' then
    select * into strict v_variant from public.product_variants where id=(v_op->>'product_variant_id')::bigint;
    if v_variant.product_id<>v_product.id or not v_variant.is_active then raise exception 'FORMAT_V2_VARIANT_MISMATCH';end if;
    v_actual:=jsonb_set(v_actual,'{variant}',jsonb_build_object('id',v_variant.id::text,'product_id',v_variant.product_id::text,
      'display_name',v_variant.display_name,'flavour_label',v_variant.flavour_label,
      'size_value',case when v_variant.size_value is null then null else public.atomic_import_decimal_string(v_variant.size_value) end,
      'size_unit',v_variant.size_unit,'pack_count',v_variant.pack_count::text,'product_format',v_variant.product_format,'is_active',v_variant.is_active));
    v_format:=v_variant.product_format;
    v_compare:=jsonb_set(v_actual,'{variant,product_format}','null'::jsonb,false);
  else
    v_format:=v_product.product_format;
    v_compare:=jsonb_set(v_actual,'{product,product_format}','null'::jsonb,false);
  end if;
  if v_compare is distinct from p_package->'expected_state' or
    (p_require_before and v_format is not null) or
    (not p_require_before and v_format is not null and v_format is distinct from v_op->>'reviewed_after') then
    raise exception 'FORMAT_V2_EXPECTED_STATE_CHANGED';end if;
  return jsonb_build_object('valid',true,'table',v_op->>'table','product_id',v_product.id::text,
    'product_variant_id',v_op->>'product_variant_id','field','product_format','current_value',v_format,
    'single_canonical_row',true,'package_fingerprint',v_fingerprint,
    'target_environment',v_target->>'target_environment','target_project_ref',v_target->>'project_ref');
end
$validate$;
revoke all on function atomic_import_private.correction_canonical_json(jsonb),
  atomic_import_private.validate_format_correction(jsonb,boolean) from public,anon,authenticated,service_role;

-- Guarded consumer changes: preserve the legacy v1 branch and all existing ACLs.
do $upgrade$
declare v_definition text;v_owner text;
begin
 select pg_get_functiondef(p.oid),pg_get_userbyid(p.proowner) into strict v_definition,v_owner from pg_proc p where p.oid='public.reviewed_product_pack_correction_validate_core(jsonb,boolean)'::regprocedure;
 if v_owner<>'postgres' or encode(sha256(convert_to(v_definition,'UTF8')),'hex')<>'cee8080586229f182b973faa732bc1e2df2e96a5c86dfaf5b88d51038a661466' then raise exception 'FORMAT_V2_LINEAGE_MISMATCH: reviewed_product_pack_correction_validate_core';end if;
 if (length(v_definition)-length(replace(v_definition,$before$begin
  if jsonb_typeof(p_package)$before$,'')))/length($before$begin
  if jsonb_typeof(p_package)$before$)<>1 then raise exception 'FORMAT_V2_PATCH_SHAPE';end if;
 v_definition:=replace(v_definition,$before$begin
  if jsonb_typeof(p_package)$before$,$after$begin
  if p_package->'schema_version'='2'::jsonb then return atomic_import_private.validate_format_correction(p_package,p_require_expected_before);end if;
  if jsonb_typeof(p_package)$after$);
 execute v_definition;
end
$upgrade$;
do $upgrade$
declare v_definition text;v_owner text;
begin
 select pg_get_functiondef(p.oid),pg_get_userbyid(p.proowner) into strict v_definition,v_owner from pg_proc p where p.oid='public.approve_reviewed_product_pack_correction(jsonb,text,timestamp with time zone)'::regprocedure;
 if v_owner<>'postgres' or encode(sha256(convert_to(v_definition,'UTF8')),'hex')<>'d975f2fda38ebb53b432b72eb2f4f6b99ab54a0f60f215e444f67368bdaf46bc' then raise exception 'FORMAT_V2_LINEAGE_MISMATCH: approve_reviewed_product_pack_correction';end if;
 if (length(v_definition)-length(replace(v_definition,$before$public.atomic_import_canonical_json($before$,'')))/length($before$public.atomic_import_canonical_json($before$)<>1 then raise exception 'FORMAT_V2_PATCH_SHAPE';end if;
 v_definition:=replace(v_definition,$before$public.atomic_import_canonical_json($before$,$after$atomic_import_private.correction_canonical_json($after$);
 if (length(v_definition)-length(replace(v_definition,$before$'reviewed-product-pack-correction-v1:'||v_package_fingerprint$before$,'')))/length($before$'reviewed-product-pack-correction-v1:'||v_package_fingerprint$before$)<>2 then raise exception 'FORMAT_V2_PATCH_SHAPE';end if;
 v_definition:=replace(v_definition,$before$'reviewed-product-pack-correction-v1:'||v_package_fingerprint$before$,$after$'reviewed-product-pack-correction-v'||(p_package->>'schema_version')||':'||v_package_fingerprint$after$);
 if (length(v_definition)-length(replace(v_definition,$before$'field','net_weight_g'$before$,'')))/length($before$'field','net_weight_g'$before$)<>1 then raise exception 'FORMAT_V2_PATCH_SHAPE';end if;
 v_definition:=replace(v_definition,$before$'field','net_weight_g'$before$,$after$'field',p_package#>>'{operation,field}'$after$);
 execute v_definition;
end
$upgrade$;
do $upgrade$
declare v_definition text;v_owner text;
begin
 select pg_get_functiondef(p.oid),pg_get_userbyid(p.proowner) into strict v_definition,v_owner from pg_proc p where p.oid='public.apply_approved_reviewed_product_pack_correction(uuid,jsonb,text)'::regprocedure;
 if v_owner<>'postgres' or encode(sha256(convert_to(v_definition,'UTF8')),'hex')<>'d1a16c2027e49f168f14e907f13d1c9621e915fe3be5946d2a463007411bc976' then raise exception 'FORMAT_V2_LINEAGE_MISMATCH: apply_approved_reviewed_product_pack_correction';end if;
 -- Serialize both legacy weight and new format corrections before ledger/row
 -- locks, matching the existing import executor's table-lock ordering.
 if (length(v_definition)-length(replace(v_definition,$before$  v_target:=public.reviewed_product_pack_correction_assert_session(p_package,'executor');$before$,'')))/length($before$  v_target:=public.reviewed_product_pack_correction_assert_session(p_package,'executor');$before$)<>1 then raise exception 'FORMAT_V2_PATCH_SHAPE';end if;
 v_definition:=replace(v_definition,$before$  v_target:=public.reviewed_product_pack_correction_assert_session(p_package,'executor');$before$,$after$  v_target:=public.reviewed_product_pack_correction_assert_session(p_package,'executor');
  perform pg_advisory_xact_lock(hashtextextended('retailer-offer-sync:global-execution',0));$after$);
 if (length(v_definition)-length(replace(v_definition,$before$public.atomic_import_canonical_json($before$,'')))/length($before$public.atomic_import_canonical_json($before$)<>1 then raise exception 'FORMAT_V2_PATCH_SHAPE';end if;
 v_definition:=replace(v_definition,$before$public.atomic_import_canonical_json($before$,$after$atomic_import_private.correction_canonical_json($after$);
 if (length(v_definition)-length(replace(v_definition,$before$'reviewed-product-pack-correction-v1:'||v_fingerprint$before$,'')))/length($before$'reviewed-product-pack-correction-v1:'||v_fingerprint$before$)<>1 then raise exception 'FORMAT_V2_PATCH_SHAPE';end if;
 v_definition:=replace(v_definition,$before$'reviewed-product-pack-correction-v1:'||v_fingerprint$before$,$after$'reviewed-product-pack-correction-v'||(p_package->>'schema_version')||':'||v_fingerprint$after$);
 if (length(v_definition)-length(replace(v_definition,$before$  v_expected numeric;$before$,'')))/length($before$  v_expected numeric;$before$)<>1 then raise exception 'FORMAT_V2_PATCH_SHAPE';end if;
 v_definition:=replace(v_definition,$before$  v_expected numeric;$before$,$after$  v_format_before jsonb;v_format_after jsonb;
  v_expected numeric;$after$);
 if (length(v_definition)-length(replace(v_definition,$before$  v_expected:=(p_package#>>'{operation,expected_before}')::numeric;$before$,'')))/length($before$  v_expected:=(p_package#>>'{operation,expected_before}')::numeric;$before$)<>1 then raise exception 'FORMAT_V2_PATCH_SHAPE';end if;
 v_definition:=replace(v_definition,$before$  v_expected:=(p_package#>>'{operation,expected_before}')::numeric;$before$,$after$  if p_package->'schema_version'='2'::jsonb then
    select * into strict v_before from public.products where id=(p_package#>>'{operation,product_id}')::bigint for update;
    if p_package#>>'{operation,table}'='product_variants' then
      perform 1 from public.product_variants where id=(p_package#>>'{operation,product_variant_id}')::bigint for update;
    end if;
    perform public.reviewed_product_pack_correction_validate_core(p_package,true);
    if p_package#>>'{operation,table}'='products' then
      update public.products set product_format=p_package#>>'{operation,reviewed_after}' where id=v_before.id and product_format is null;
      get diagnostics v_updated=row_count;
      select to_jsonb(p) into v_format_after from public.products p where id=v_before.id;
      v_format_before:=to_jsonb(v_before);
    else
      select to_jsonb(v) into v_format_before from public.product_variants v where id=(p_package#>>'{operation,product_variant_id}')::bigint;
      update public.product_variants set product_format=p_package#>>'{operation,reviewed_after}'
        where id=(p_package#>>'{operation,product_variant_id}')::bigint and product_id=v_before.id and product_format is null;
      get diagnostics v_updated=row_count;
      select to_jsonb(v) into v_format_after from public.product_variants v where id=(p_package#>>'{operation,product_variant_id}')::bigint;
    end if;
    if v_updated<>1 or v_format_after->>'product_format' is distinct from p_package#>>'{operation,reviewed_after}' or
      (v_format_before-'product_format') is distinct from (v_format_after-'product_format') then raise exception 'FORMAT_V2_POSTCONDITION_MISMATCH';end if;
    perform public.reviewed_product_pack_correction_validate_core(p_package,false);
    update public.approved_import_plans set status='consumed',consumed_at=now()
      where id=v_approval.id and status='approved' returning consumed_at into v_consumed_at;
    if not found then raise exception 'FORMAT_V2_APPROVAL_CONSUMPTION_FAILED';end if;
    return jsonb_build_object('approval_id',v_approval.id,'approval_status','consumed','consumed_at',v_consumed_at,
      'artifact_sha256',p_package_sha256,'package_fingerprint',v_fingerprint,'product_id',v_before.id::text,
      'product_variant_id',p_package#>>'{operation,product_variant_id}','table',p_package#>>'{operation,table}',
      'field','product_format','before_value',null,'after_value',p_package#>>'{operation,reviewed_after}',
      'updated_rows',v_updated,'row_count_delta',0,'target_environment',v_target->>'target_environment','target_project_ref',v_target->>'project_ref');
  end if;
  v_expected:=(p_package#>>'{operation,expected_before}')::numeric;$after$);
 execute v_definition;
end
$upgrade$;
commit;
