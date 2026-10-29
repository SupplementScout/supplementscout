begin;

set local lock_timeout='5s';
set local statement_timeout='60s';

select pg_advisory_xact_lock(hashtextextended('reviewed-product-pack-correction-v1',0));

do $preflight$
declare
  v_target jsonb:=public.retailer_catalogue_actual_database_target();
  v_counts jsonb;
begin
  if current_user<>'postgres'
     or v_target->>'target_environment' not in ('STAGING','PRODUCTION')
     or (v_target->>'target_environment'='STAGING' and v_target->>'project_ref'<>'hxnrsyyqffztlvcrtgbf')
     or (v_target->>'target_environment'='PRODUCTION' and v_target->>'project_ref'<>'aftboxmrdgyhizicfsfu') then
    raise exception 'reviewed product pack correction target differs';
  end if;
  if to_regprocedure('public.atomic_import_has_exact_keys(jsonb,text[])') is null
     or to_regprocedure('public.atomic_import_canonical_json(jsonb)') is null
     or to_regprocedure('public.retailer_catalogue_raise(text,text,jsonb)') is null
     or to_regclass('public.approved_import_plans') is null then
    raise exception 'reviewed product pack correction dependencies are missing';
  end if;
  select jsonb_build_object(
    'products',(select count(*) from public.products),
    'product_variants',(select count(*) from public.product_variants),
    'retailer_products',(select count(*) from public.retailer_products),
    'offers',(select count(*) from public.offers),
    'price_history',(select count(*) from public.price_history),
    'approved_import_plans',(select count(*) from public.approved_import_plans)
  ) into v_counts;
  perform set_config('app.reviewed_product_pack_migration_counts',v_counts::text,true);
end
$preflight$;

create or replace function public.reviewed_product_pack_correction_validate_core(
  p_package jsonb,
  p_require_expected_before boolean
) returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,pg_temp
as $core$
declare
  v_target jsonb:=public.retailer_catalogue_actual_database_target();
  v_expected numeric;
  v_reviewed numeric;
  v_product public.products%rowtype;
  v_fingerprint text;
  v_products_count bigint;
begin
  if jsonb_typeof(p_package)<>'object'
     or not public.atomic_import_has_exact_keys(p_package,array[
       'schema_version','kind','status','authorized_by','authorized_at',
       'target_environment','target_project_ref','operation','evidence','policy','package_fingerprint'
     ])
     or p_package->>'schema_version'<>'1'
     or p_package->>'kind'<>'reviewed-catalogue-product-pack-correction-v1'
     or coalesce(p_package->>'status','') not in ('PREPARED','OWNER_APPROVED') then
    perform public.retailer_catalogue_raise('RSBI_SOURCE_SCHEMA_MISMATCH','Invalid reviewed product pack correction package');
  end if;
  if (p_package->>'status'='PREPARED' and (jsonb_typeof(p_package->'authorized_by')<>'null' or jsonb_typeof(p_package->'authorized_at')<>'null'))
     or (p_package->>'status'='OWNER_APPROVED' and (
       nullif(btrim(p_package->>'authorized_by'),'') is null
       or nullif(btrim(p_package->>'authorized_at'),'') is null
     )) then
    perform public.retailer_catalogue_raise('RSBI_APPROVAL_MISMATCH','Reviewed product pack correction authorization is invalid');
  end if;
  if p_package->>'status'='OWNER_APPROVED' then
    perform (p_package->>'authorized_at')::timestamptz;
  end if;
  if p_package->>'target_environment' is distinct from v_target->>'target_environment'
     or p_package->>'target_project_ref' is distinct from v_target->>'project_ref' then
    perform public.retailer_catalogue_raise('RSBI_ENVIRONMENT_BLOCKED','Reviewed product pack correction target mismatch');
  end if;
  if jsonb_typeof(p_package->'operation')<>'object'
     or not public.atomic_import_has_exact_keys(p_package->'operation',array[
       'table','product_id','field','expected_before','reviewed_after'
     ])
     or p_package#>>'{operation,table}'<>'products'
     or p_package#>>'{operation,field}'<>'net_weight_g'
     or p_package#>>'{operation,product_id}'!~'^[1-9][0-9]*$'
     or p_package#>>'{operation,expected_before}'!~'^(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$'
     or p_package#>>'{operation,reviewed_after}'!~'^(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$' then
    perform public.retailer_catalogue_raise('RSBI_SCOPE_MISMATCH','Reviewed product pack correction operation scope is invalid');
  end if;
  v_expected:=(p_package#>>'{operation,expected_before}')::numeric;
  v_reviewed:=(p_package#>>'{operation,reviewed_after}')::numeric;
  if v_expected<=0 or v_reviewed<=0 or v_expected is not distinct from v_reviewed
     or v_expected::text is distinct from p_package#>>'{operation,expected_before}'
     or v_reviewed::text is distinct from p_package#>>'{operation,reviewed_after}' then
    perform public.retailer_catalogue_raise('RSBI_SCOPE_MISMATCH','Reviewed product pack correction values are invalid');
  end if;
  if jsonb_typeof(p_package->'evidence')<>'object'
     or not public.atomic_import_has_exact_keys(p_package->'evidence',array['preparation_artifact','source_evidence'])
     or jsonb_typeof(p_package#>'{evidence,preparation_artifact}')<>'object'
     or not public.atomic_import_has_exact_keys(p_package#>'{evidence,preparation_artifact}',array['relative_path','sha256','artifact_fingerprint'])
     or jsonb_typeof(p_package#>'{evidence,source_evidence}')<>'object'
     or not public.atomic_import_has_exact_keys(p_package#>'{evidence,source_evidence}',array['relative_path','sha256'])
     or p_package#>>'{evidence,preparation_artifact,relative_path}' not like 'tmp/%'
     or p_package#>>'{evidence,source_evidence,relative_path}' not like 'tmp/%'
     or p_package#>>'{evidence,preparation_artifact,sha256}'!~'^[0-9a-f]{64}$'
     or p_package#>>'{evidence,preparation_artifact,artifact_fingerprint}'!~'^[0-9a-f]{64}$'
     or p_package#>>'{evidence,source_evidence,sha256}'!~'^[0-9a-f]{64}$' then
    perform public.retailer_catalogue_raise('RSBI_SOURCE_SCHEMA_MISMATCH','Reviewed product pack correction evidence binding is invalid');
  end if;
  if jsonb_typeof(p_package->'policy')<>'object'
     or not public.atomic_import_has_exact_keys(p_package->'policy',array[
       'single_product_row','single_field_only','exact_before_required',
       'strict_post_write_readback','row_count_delta_must_be_zero'
     ])
     or exists(
       select 1 from jsonb_each(p_package->'policy') e
       where e.value<>'true'::jsonb
     ) then
    perform public.retailer_catalogue_raise('RSBI_SCOPE_MISMATCH','Reviewed product pack correction policy is invalid');
  end if;
  v_fingerprint:=encode(pg_catalog.sha256(convert_to(public.atomic_import_canonical_json(
    jsonb_set(p_package,'{package_fingerprint}','null'::jsonb,false)
  ),'UTF8')),'hex');
  if p_package->>'package_fingerprint'!~'^[0-9a-f]{64}$'
     or p_package->>'package_fingerprint' is distinct from v_fingerprint then
    perform public.retailer_catalogue_raise('RSBI_FINGERPRINT_MISMATCH','Reviewed product pack correction fingerprint mismatch');
  end if;
  select * into v_product from public.products
  where id=(p_package#>>'{operation,product_id}')::bigint;
  if not found then
    perform public.retailer_catalogue_raise('RSBI_EXPECTED_STATE_MISMATCH','Reviewed product pack correction product is missing');
  end if;
  if p_require_expected_before and v_product.net_weight_g is distinct from v_expected then
    perform public.retailer_catalogue_raise('RSBI_EXPECTED_STATE_MISMATCH','Reviewed product pack correction expected_before is stale');
  end if;
  select count(*) into v_products_count from public.products;
  return jsonb_build_object(
    'valid',true,
    'table','products',
    'product_id',v_product.id::text,
    'field','net_weight_g',
    'current_value',v_product.net_weight_g::text,
    'products_count',v_products_count,
    'package_fingerprint',v_fingerprint,
    'target_environment',v_target->>'target_environment',
    'target_project_ref',v_target->>'project_ref'
  );
exception
  when invalid_text_representation or numeric_value_out_of_range or datetime_field_overflow then
    perform public.retailer_catalogue_raise('RSBI_SOURCE_SCHEMA_MISMATCH','Reviewed product pack correction contains an invalid typed value');
    return null;
end
$core$;

create or replace function public.reviewed_product_pack_correction_assert_session(
  p_package jsonb,
  p_kind text
) returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,pg_temp
as $session$
declare
  v_target jsonb:=public.retailer_catalogue_actual_database_target();
  v_environment text:=lower(v_target->>'target_environment');
  v_role text:='retailer_catalogue_'||v_environment||'_'||p_kind;
  v_login text:='supplementscout_'||v_environment||'_'||p_kind||'_login';
  v_marker text:='app.retailer_catalogue_'||v_environment||'_marker';
  v_opposite_marker text:=case v_environment when 'staging' then 'app.retailer_catalogue_production_marker' else 'app.retailer_catalogue_staging_marker' end;
begin
  if p_kind not in ('validator','approver','executor')
     or current_setting('role',true) is distinct from v_role
     or session_user is distinct from v_login
     or lower(coalesce(current_setting('app.safe_update',true),''))=any(array['1','on','true']) then
    perform public.retailer_catalogue_raise('RSBI_ENVIRONMENT_BLOCKED','Exact protected reviewed product pack correction session required');
  end if;
  if p_kind='validator' then
    if current_setting('transaction_read_only')<>'on' then
      perform public.retailer_catalogue_raise('RSBI_ENVIRONMENT_BLOCKED','Reviewed product pack correction validator must be read only');
    end if;
  elsif current_setting(v_marker,true) is distinct from '1'
     or current_setting('app.retailer_catalogue_allow',true) is distinct from '1'
     or current_setting(v_opposite_marker,true)='1' then
    perform public.retailer_catalogue_raise('RSBI_ENVIRONMENT_BLOCKED','Reviewed product pack correction transaction marker mismatch');
  end if;
  if p_package->>'target_environment' is distinct from v_target->>'target_environment'
     or p_package->>'target_project_ref' is distinct from v_target->>'project_ref' then
    perform public.retailer_catalogue_raise('RSBI_ENVIRONMENT_BLOCKED','Reviewed product pack correction session target mismatch');
  end if;
  return v_target;
end
$session$;

create or replace function public.validate_reviewed_product_pack_correction_read_only(p_package jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,pg_temp
as $validate$
begin
  perform public.reviewed_product_pack_correction_assert_session(p_package,'validator');
  return public.reviewed_product_pack_correction_validate_core(p_package,true);
end
$validate$;

create or replace function public.read_reviewed_product_pack_correction_state(p_package jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,pg_temp
as $readback$
begin
  perform public.reviewed_product_pack_correction_assert_session(p_package,'validator');
  return public.reviewed_product_pack_correction_validate_core(p_package,false);
end
$readback$;

create or replace function public.approve_reviewed_product_pack_correction(
  p_package jsonb,
  p_package_sha256 text,
  p_expires_at timestamptz default now()+interval '15 minutes'
) returns jsonb
language plpgsql
volatile
security definer
set search_path=pg_catalog,public,pg_temp
as $approve$
declare
  v_target jsonb;
  v_state jsonb;
  v_id uuid;
  v_plan_fingerprint text;
  v_package_fingerprint text:=p_package->>'package_fingerprint';
  v_run_id text:='product-pack-'||left(v_package_fingerprint,24);
begin
  v_target:=public.reviewed_product_pack_correction_assert_session(p_package,'approver');
  if p_package->>'status'<>'OWNER_APPROVED' then
    perform public.retailer_catalogue_raise('RSBI_APPROVAL_MISMATCH','Product pack correction package is not owner approved');
  end if;
  if p_package_sha256!~'^[0-9a-f]{64}$'
     or p_expires_at<=now() or p_expires_at>now()+interval '24 hours' then
    perform public.retailer_catalogue_raise('RSBI_APPROVAL_MISMATCH','Product pack correction approval binding is invalid');
  end if;
  v_state:=public.reviewed_product_pack_correction_validate_core(p_package,true);
  v_plan_fingerprint:=md5(public.atomic_import_canonical_json(
    jsonb_set(p_package,'{package_fingerprint}','null'::jsonb,false)
  ));
  if exists(
    select 1 from public.approved_import_plans
    where source='reviewed-product-pack-correction-v1:'||v_package_fingerprint
      and status='approved' and consumed_at is null and expires_at>now()
  ) then
    perform public.retailer_catalogue_raise('RSBI_APPROVAL_MISMATCH','A live product pack correction approval already exists');
  end if;
  insert into public.approved_import_plans(
    artifact_sha256,run_id,plan_fingerprint,source_row_fingerprint,
    plan_kind,retailer_id,expires_at,source,plan_json
  ) values (
    p_package_sha256,v_run_id,v_plan_fingerprint,
    p_package#>>'{evidence,preparation_artifact,artifact_fingerprint}',
    'manual',null,p_expires_at,'reviewed-product-pack-correction-v1:'||v_package_fingerprint,p_package
  ) returning id into v_id;
  return jsonb_build_object(
    'approval_id',v_id,
    'status','approved',
    'expires_at',p_expires_at,
    'artifact_sha256',p_package_sha256,
    'package_fingerprint',v_package_fingerprint,
    'product_id',p_package#>>'{operation,product_id}',
    'field','net_weight_g',
    'target_environment',v_target->>'target_environment',
    'target_project_ref',v_target->>'project_ref',
    'validated_state',v_state
  );
end
$approve$;

create or replace function public.apply_approved_reviewed_product_pack_correction(
  p_approval_id uuid,
  p_package jsonb,
  p_package_sha256 text
) returns jsonb
language plpgsql
volatile
security definer
set search_path=pg_catalog,public,pg_temp
as $apply$
declare
  v_target jsonb;
  v_approval public.approved_import_plans%rowtype;
  v_before public.products%rowtype;
  v_after public.products%rowtype;
  v_expected numeric;
  v_reviewed numeric;
  v_before_count bigint;
  v_after_count bigint;
  v_updated integer;
  v_consumed_at timestamptz;
  v_fingerprint text:=p_package->>'package_fingerprint';
begin
  v_target:=public.reviewed_product_pack_correction_assert_session(p_package,'executor');
  select * into v_approval from public.approved_import_plans
  where id=p_approval_id for update;
  if not found or v_approval.status<>'approved' or v_approval.consumed_at is not null
     or v_approval.expires_at<=now() then
    perform public.retailer_catalogue_raise('RSBI_APPROVAL_MISMATCH','Product pack correction approval is missing, consumed or expired');
  end if;
  if v_approval.artifact_sha256 is distinct from p_package_sha256
     or v_approval.plan_json is distinct from p_package
     or v_approval.source is distinct from 'reviewed-product-pack-correction-v1:'||v_fingerprint
     or v_approval.plan_kind<>'manual'
     or v_approval.retailer_id is not null
     or v_approval.plan_fingerprint is distinct from md5(public.atomic_import_canonical_json(
       jsonb_set(p_package,'{package_fingerprint}','null'::jsonb,false)
     ))
     or v_approval.source_row_fingerprint is distinct from p_package#>>'{evidence,preparation_artifact,artifact_fingerprint}' then
    perform public.retailer_catalogue_raise('RSBI_FINGERPRINT_MISMATCH','Product pack correction approval integrity mismatch');
  end if;
  perform public.reviewed_product_pack_correction_validate_core(p_package,true);
  v_expected:=(p_package#>>'{operation,expected_before}')::numeric;
  v_reviewed:=(p_package#>>'{operation,reviewed_after}')::numeric;
  select count(*) into v_before_count from public.products;
  select * into strict v_before from public.products
  where id=(p_package#>>'{operation,product_id}')::bigint for update;
  update public.products
     set net_weight_g=v_reviewed
   where id=v_before.id and net_weight_g is not distinct from v_expected;
  get diagnostics v_updated=row_count;
  if v_updated<>1 then
    perform public.retailer_catalogue_raise('RSBI_EXPECTED_STATE_MISMATCH','Product pack correction exact update count mismatch');
  end if;
  select * into strict v_after from public.products where id=v_before.id;
  select count(*) into v_after_count from public.products;
  if v_after.net_weight_g is distinct from v_reviewed
     or (to_jsonb(v_after)-'net_weight_g') is distinct from (to_jsonb(v_before)-'net_weight_g')
     or v_after_count<>v_before_count then
    perform public.retailer_catalogue_raise('RSBI_POSTCONDITION_MISMATCH','Product pack correction strict readback mismatch');
  end if;
  update public.approved_import_plans
     set status='consumed',consumed_at=now()
   where id=v_approval.id and status='approved'
   returning consumed_at into v_consumed_at;
  if not found then
    perform public.retailer_catalogue_raise('RSBI_APPROVAL_MISMATCH','Product pack correction approval consumption failed');
  end if;
  return jsonb_build_object(
    'approval_id',v_approval.id,
    'approval_status','consumed',
    'consumed_at',v_consumed_at,
    'artifact_sha256',p_package_sha256,
    'package_fingerprint',v_fingerprint,
    'product_id',v_after.id::text,
    'table','products',
    'field','net_weight_g',
    'before_value',v_before.net_weight_g::text,
    'after_value',v_after.net_weight_g::text,
    'updated_rows',v_updated,
    'row_count_delta',v_after_count-v_before_count,
    'target_environment',v_target->>'target_environment',
    'target_project_ref',v_target->>'project_ref'
  );
end
$apply$;

alter function public.reviewed_product_pack_correction_validate_core(jsonb,boolean) owner to postgres;
alter function public.reviewed_product_pack_correction_assert_session(jsonb,text) owner to postgres;
alter function public.validate_reviewed_product_pack_correction_read_only(jsonb) owner to postgres;
alter function public.read_reviewed_product_pack_correction_state(jsonb) owner to postgres;
alter function public.approve_reviewed_product_pack_correction(jsonb,text,timestamptz) owner to postgres;
alter function public.apply_approved_reviewed_product_pack_correction(uuid,jsonb,text) owner to postgres;

revoke all on function public.reviewed_product_pack_correction_validate_core(jsonb,boolean),
  public.reviewed_product_pack_correction_assert_session(jsonb,text),
  public.validate_reviewed_product_pack_correction_read_only(jsonb),
  public.read_reviewed_product_pack_correction_state(jsonb),
  public.approve_reviewed_product_pack_correction(jsonb,text,timestamptz),
  public.apply_approved_reviewed_product_pack_correction(uuid,jsonb,text)
from public,anon,authenticated,service_role,
  retailer_catalogue_staging_validator,retailer_catalogue_staging_approver,retailer_catalogue_staging_executor,
  retailer_catalogue_production_validator,retailer_catalogue_production_approver,retailer_catalogue_production_executor;

grant execute on function public.validate_reviewed_product_pack_correction_read_only(jsonb),
  public.read_reviewed_product_pack_correction_state(jsonb)
to retailer_catalogue_staging_validator,retailer_catalogue_production_validator;
grant execute on function public.approve_reviewed_product_pack_correction(jsonb,text,timestamptz)
to retailer_catalogue_staging_approver,retailer_catalogue_production_approver;
grant execute on function public.apply_approved_reviewed_product_pack_correction(uuid,jsonb,text)
to retailer_catalogue_staging_executor,retailer_catalogue_production_executor;

do $postflight$
declare
  v_before jsonb:=current_setting('app.reviewed_product_pack_migration_counts')::jsonb;
  v_after jsonb;
begin
  select jsonb_build_object(
    'products',(select count(*) from public.products),
    'product_variants',(select count(*) from public.product_variants),
    'retailer_products',(select count(*) from public.retailer_products),
    'offers',(select count(*) from public.offers),
    'price_history',(select count(*) from public.price_history),
    'approved_import_plans',(select count(*) from public.approved_import_plans)
  ) into v_after;
  if v_after is distinct from v_before then
    raise exception 'reviewed product pack correction migration changed data';
  end if;
end
$postflight$;

commit;
