begin;

alter function public.validate_gtin_promotion_plan_read_only(jsonb)
  rename to validate_gtin_promotion_plan_exact_45_read_only;
alter function public.apply_approved_gtin_promotion_plan(uuid,text,text,text,text)
  rename to apply_approved_gtin_promotion_plan_exact_45;

create function public.validate_gtin_promotion_plan_exact_36_read_only(p_plan jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $validate_exact_36$
declare
  v_row jsonb;
  v_product public.products%rowtype;
  v_variant public.product_variants%rowtype;
  v_product_id bigint;
  v_variant_id bigint;
  v_gtin text;
  v_expected_product jsonb;
  v_expected_variant jsonb;
begin
  if not public.atomic_import_has_exact_keys(p_plan,array['meta','owner_review','rows'])
    or not public.atomic_import_has_exact_keys(p_plan->'meta',array['version','operation_type','plan_kind','plan_fingerprint','source_row_fingerprint','preview_fingerprint','canonical_snapshot_fingerprint'])
    or not public.atomic_import_has_exact_keys(p_plan->'owner_review',array['decision','reviewed_count','document','scope_fingerprint'])
    or p_plan#>>'{meta,version}'<>'1'
    or p_plan#>>'{meta,operation_type}'<>'GTIN_PROMOTION'
    or p_plan#>>'{meta,plan_kind}'<>'gtin_promotion'
    or (p_plan#>>'{meta,plan_fingerprint}')!~'^[0-9a-f]{32}$'
    or (p_plan#>>'{meta,source_row_fingerprint}')!~'^[0-9a-f]{64}$'
    or (p_plan#>>'{meta,preview_fingerprint}')!~'^[0-9a-f]{64}$'
    or (p_plan#>>'{meta,canonical_snapshot_fingerprint}')!~'^[0-9a-f]{64}$'
    or p_plan#>>'{owner_review,decision}'<>'APPROVED_EXACT_SCOPE'
    or p_plan#>>'{owner_review,reviewed_count}'<>'36'
    or p_plan#>>'{owner_review,document}'<>'docs/EBAY-UK-COVERAGE-PLAN.md'
    or p_plan#>>'{owner_review,scope_fingerprint}'<>'415142d4ba069103441a908bba4a15c3de73a828b9b7896a8556e29f32a97c02'
    or jsonb_typeof(p_plan->'rows')<>'array'
    or jsonb_array_length(p_plan->'rows')<>36
    or md5(public.atomic_import_canonical_json(jsonb_set(p_plan,'{meta,plan_fingerprint}','null'::jsonb,false)))<>p_plan#>>'{meta,plan_fingerprint}' then
    raise exception 'invalid exact-36 GTIN promotion envelope or fingerprint';
  end if;

  if exists(select 1 from jsonb_array_elements(p_plan->'rows') item group by item->>'product_id',item->>'variant_id',item->>'destination_field' having count(*)>1)
    or exists(select 1 from jsonb_array_elements(p_plan->'rows') item group by item->>'gtin' having count(*)>1) then
    raise exception 'exact-36 GTIN promotion contains duplicate targets or GTINs';
  end if;

  if exists(
    select 1 from jsonb_array_elements(p_plan->'rows') item
    left join (values
      ('769','2014','5903111089085'),('742','795','5056555202128'),('754','878','5060763896734'),
      ('231','783','5060245605397'),('755','883','5060751997351'),('1068','2252','5033579000084'),
      ('1108','2403','5902114017446'),('1067','2250','5902114018849'),('1107','2401','5902114017811'),
      ('863','1300','5060547319022'),('865','1307','5060547316106'),('866','1309','5060547316144'),
      ('867','1316','5060547316229'),('868','1320','5060547317752'),('746','1196','5060347312919'),
      ('843','1222','5060660087068'),('12','1099','5060660080212'),('897','1483','5060660082131'),
      ('902','1494','5060723199097'),('898','1486','5056371005545'),('874','1336','640516785468'),
      ('875','1339','659048417532'),('877','1350','659048417440'),('1032','2160','5907368855059'),
      ('1129','2471','5902837751917'),('1128','2469','5902837742663'),('1117','2421','5902837750415'),
      ('1116','2419','5902837742649'),('1115','2417','5902837749389'),('1054','2204','5902837731155'),
      ('1052','2200','5902837755762'),('1051','2198','5902837737447'),('1050','2196','5999076234554'),
      ('1033','2162','5999076216703'),('1037','2170','5999076234363'),('1022','2140','5999076232451')
    ) approved(product_id,variant_id,gtin)
      on approved.product_id=item->>'product_id' and approved.variant_id=item->>'variant_id' and approved.gtin=item->>'gtin'
    where approved.product_id is null
  ) then raise exception 'GTIN promotion row is outside exact-36 owner allowlist'; end if;

  for v_row in select value from jsonb_array_elements(p_plan->'rows') loop
    if not public.atomic_import_has_exact_keys(v_row,array['product_id','variant_id','gtin','destination_field','expected_current_gtin','single_trade_item','evidence_count','evidence_sources','candidate_fingerprint','owner_decision','expected_product','expected_variant'])
      or not public.atomic_import_has_exact_keys(v_row->'expected_product',array['name','brand','product_format','is_active','merged_into_product_id','gtin'])
      or not public.atomic_import_has_exact_keys(v_row->'expected_variant',array['product_id','display_name','flavour_label','size_value','size_unit','pack_count','product_format','is_active','is_default','gtin'])
      or (v_row->>'product_id')!~'^[1-9][0-9]*$' or (v_row->>'variant_id')!~'^[1-9][0-9]*$'
      or v_row->>'destination_field'<>'product_variants.gtin'
      or jsonb_typeof(v_row->'single_trade_item')<>'boolean'
      or v_row->'single_trade_item'<>'false'::jsonb
      or v_row->'expected_current_gtin'<>'null'::jsonb
      or (v_row->>'evidence_count')!~'^[2-9][0-9]*$'
      or jsonb_typeof(v_row->'evidence_sources')<>'array'
      or jsonb_array_length(v_row->'evidence_sources')<>(v_row->>'evidence_count')::integer
      or (select count(distinct value) from jsonb_array_elements_text(v_row->'evidence_sources'))<>(v_row->>'evidence_count')::integer
      or (v_row->>'candidate_fingerprint')!~'^[0-9a-f]{64}$'
      or v_row->>'owner_decision'<>'APPROVE_CANDIDATE' then
      raise exception 'invalid exact-36 GTIN promotion row';
    end if;
    v_product_id:=(v_row->>'product_id')::bigint;
    v_variant_id:=(v_row->>'variant_id')::bigint;
    v_gtin:=regexp_replace(v_row->>'gtin','[[:space:]-]+','','g');
    if not public.gtin_promotion_is_valid_gtin(v_gtin) or v_gtin is distinct from v_row->>'gtin' then raise exception 'invalid exact-36 GTIN'; end if;
    if exists(select 1 from public.gtin_promotion_quarantine q where q.gtin=v_gtin) then raise exception 'quarantined GTIN cannot be promoted'; end if;
    select * into v_product from public.products where id=v_product_id;
    select * into v_variant from public.product_variants where id=v_variant_id;
    if v_product.id is null or v_variant.id is null or not v_product.is_active or v_product.merged_into_product_id is not null or not v_variant.is_active or v_variant.product_id<>v_product_id then
      raise exception 'inactive, merged or mismatched exact-36 target';
    end if;
    v_expected_product:=jsonb_build_object('name',v_product.name,'brand',v_product.brand,'product_format',v_product.product_format,'is_active',v_product.is_active,'merged_into_product_id',v_product.merged_into_product_id::text,'gtin',v_product.gtin);
    v_expected_variant:=jsonb_build_object('product_id',v_variant.product_id::text,'display_name',v_variant.display_name,'flavour_label',v_variant.flavour_label,'size_value',v_variant.size_value::text,'size_unit',v_variant.size_unit,'pack_count',v_variant.pack_count::text,'product_format',v_variant.product_format,'is_active',v_variant.is_active,'is_default',v_variant.is_default,'gtin',v_variant.gtin);
    if v_expected_product is distinct from v_row->'expected_product' or v_expected_variant is distinct from v_row->'expected_variant' then raise exception 'stale exact-36 canonical identity'; end if;
    if nullif(btrim(v_variant.gtin),'') is not null then raise exception 'exact-36 destination value changed'; end if;
    if exists(select 1 from public.products p where nullif(btrim(p.gtin),'')=v_gtin)
      or exists(select 1 from public.product_variants pv where nullif(btrim(pv.gtin),'')=v_gtin and pv.id<>v_variant_id)
      or exists(select 1 from public.retailer_products rp where nullif(btrim(rp.external_gtin),'')=v_gtin and (rp.product_id is distinct from v_product_id or rp.product_variant_id is distinct from v_variant_id)) then
      raise exception 'exact-36 GTIN belongs to another identity';
    end if;
  end loop;
  return jsonb_build_object('status','VALID','row_count','36','database_writes','0');
end;
$validate_exact_36$;

create function public.validate_gtin_promotion_plan_read_only(p_plan jsonb)
returns jsonb language plpgsql stable security definer
set search_path=pg_catalog,public,pg_temp
as $dispatch_validate$
begin
  if p_plan#>>'{owner_review,scope_fingerprint}'='a79b0f29d9ba141e3421a76a58b4cda4fb0995f4513e9d7004e6ab6308d50046' then
    return public.validate_gtin_promotion_plan_exact_45_read_only(p_plan);
  elsif p_plan#>>'{owner_review,scope_fingerprint}'='415142d4ba069103441a908bba4a15c3de73a828b9b7896a8556e29f32a97c02' then
    return public.validate_gtin_promotion_plan_exact_36_read_only(p_plan);
  end if;
  raise exception 'unknown GTIN promotion owner scope';
end;
$dispatch_validate$;

create function public.apply_approved_gtin_promotion_plan_exact_36(p_approval_id uuid,p_artifact_sha256 text,p_plan_fingerprint text,p_source_row_fingerprint text,p_run_id text)
returns jsonb language plpgsql volatile security definer
set search_path=pg_catalog,public,pg_temp
as $apply_exact_36$
declare
  v_approval public.approved_import_plans%rowtype;
  v_row jsonb; v_count integer:=0; v_affected integer; v_consumed_at timestamptz;
  v_result jsonb; v_rows jsonb:='[]'::jsonb;
begin
  perform pg_advisory_xact_lock(hashtext('supplementscout:gtin-promotion'));
  select * into v_approval from public.approved_import_plans where id=p_approval_id for update;
  if not found or v_approval.status<>'approved' or v_approval.consumed_at is not null then raise exception 'exact-36 approval missing or consumed'; end if;
  if v_approval.expires_at<=now() then raise exception 'exact-36 approval expired'; end if;
  if v_approval.plan_kind<>'gtin_promotion' or v_approval.retailer_id is not null
    or v_approval.artifact_sha256 is distinct from p_artifact_sha256 or v_approval.run_id is distinct from p_run_id
    or v_approval.plan_fingerprint is distinct from p_plan_fingerprint or v_approval.source_row_fingerprint is distinct from p_source_row_fingerprint
    or v_approval.plan_fingerprint is distinct from v_approval.plan_json#>>'{meta,plan_fingerprint}'
    or md5(public.atomic_import_canonical_json(jsonb_set(v_approval.plan_json,'{meta,plan_fingerprint}','null'::jsonb,false)))<>v_approval.plan_fingerprint then
    raise exception 'exact-36 approval metadata mismatch';
  end if;
  perform 1 from public.products p where p.id in(select (value->>'product_id')::bigint from jsonb_array_elements(v_approval.plan_json->'rows')) order by p.id for update;
  perform 1 from public.product_variants pv where pv.id in(select (value->>'variant_id')::bigint from jsonb_array_elements(v_approval.plan_json->'rows')) order by pv.id for update;
  perform public.validate_gtin_promotion_plan_exact_36_read_only(v_approval.plan_json);
  for v_row in select value from jsonb_array_elements(v_approval.plan_json->'rows') loop
    update public.product_variants set gtin=v_row->>'gtin'
    where id=(v_row->>'variant_id')::bigint and product_id=(v_row->>'product_id')::bigint and gtin is null;
    get diagnostics v_affected=row_count;
    if v_affected<>1 then raise exception 'exact-36 row changed after validation'; end if;
    v_count:=v_count+1;
    v_rows:=v_rows||jsonb_build_array(jsonb_build_object('product_id',v_row->>'product_id','variant_id',v_row->>'variant_id','destination_field','product_variants.gtin','before',null,'after',v_row->>'gtin','candidate_fingerprint',v_row->>'candidate_fingerprint'));
    if current_setting('app.gtin_promotion_test_failpoint',true)='after_first_row' and v_count=1 then raise exception 'GTIN promotion test failpoint after first row'; end if;
  end loop;
  if v_count<>36 then raise exception 'exact-36 promotion applied unexpected row count'; end if;
  v_result:=jsonb_build_object('status','APPLIED','operation_type','GTIN_PROMOTION','applied_count',v_count::text,'rows',v_rows,'artifact_sha256',v_approval.artifact_sha256,'plan_fingerprint',v_approval.plan_fingerprint,'source_row_fingerprint',v_approval.source_row_fingerprint);
  update public.approved_import_plans set status='consumed',consumed_at=now(),apply_result=v_result where id=v_approval.id returning consumed_at into v_consumed_at;
  return v_result||jsonb_build_object('approval_id',v_approval.id,'approval_status','consumed','consumed_at',v_consumed_at,'run_id',v_approval.run_id);
end;
$apply_exact_36$;

create function public.apply_approved_gtin_promotion_plan(p_approval_id uuid,p_artifact_sha256 text,p_plan_fingerprint text,p_source_row_fingerprint text,p_run_id text)
returns jsonb language plpgsql volatile security definer
set search_path=pg_catalog,public,pg_temp
as $dispatch_apply$
declare v_scope text;
begin
  select plan_json#>>'{owner_review,scope_fingerprint}' into v_scope from public.approved_import_plans where id=p_approval_id;
  if v_scope='a79b0f29d9ba141e3421a76a58b4cda4fb0995f4513e9d7004e6ab6308d50046' then
    return public.apply_approved_gtin_promotion_plan_exact_45(p_approval_id,p_artifact_sha256,p_plan_fingerprint,p_source_row_fingerprint,p_run_id);
  elsif v_scope='415142d4ba069103441a908bba4a15c3de73a828b9b7896a8556e29f32a97c02' then
    return public.apply_approved_gtin_promotion_plan_exact_36(p_approval_id,p_artifact_sha256,p_plan_fingerprint,p_source_row_fingerprint,p_run_id);
  end if;
  raise exception 'unknown GTIN promotion apply scope';
end;
$dispatch_apply$;

alter function public.validate_gtin_promotion_plan_exact_45_read_only(jsonb) owner to postgres;
alter function public.validate_gtin_promotion_plan_exact_36_read_only(jsonb) owner to postgres;
alter function public.validate_gtin_promotion_plan_read_only(jsonb) owner to postgres;
alter function public.apply_approved_gtin_promotion_plan_exact_45(uuid,text,text,text,text) owner to postgres;
alter function public.apply_approved_gtin_promotion_plan_exact_36(uuid,text,text,text,text) owner to postgres;
alter function public.apply_approved_gtin_promotion_plan(uuid,text,text,text,text) owner to postgres;

revoke all on function public.validate_gtin_promotion_plan_exact_45_read_only(jsonb) from public,anon,authenticated,service_role;
revoke all on function public.validate_gtin_promotion_plan_exact_36_read_only(jsonb) from public,anon,authenticated,service_role;
revoke all on function public.validate_gtin_promotion_plan_read_only(jsonb) from public,anon,authenticated,service_role;
revoke all on function public.apply_approved_gtin_promotion_plan_exact_45(uuid,text,text,text,text) from public,anon,authenticated,service_role;
revoke all on function public.apply_approved_gtin_promotion_plan_exact_36(uuid,text,text,text,text) from public,anon,authenticated,service_role;
revoke all on function public.apply_approved_gtin_promotion_plan(uuid,text,text,text,text) from public,anon,authenticated,service_role;

do $grants$
begin
  if to_regrole('retailer_catalogue_staging_executor') is not null then
    revoke all on function public.apply_approved_gtin_promotion_plan_exact_45(uuid,text,text,text,text) from retailer_catalogue_staging_executor;
    grant execute on function public.apply_approved_gtin_promotion_plan(uuid,text,text,text,text) to retailer_catalogue_staging_executor;
  elsif to_regrole('retailer_catalogue_production_executor') is not null then
    revoke all on function public.apply_approved_gtin_promotion_plan_exact_45(uuid,text,text,text,text) from retailer_catalogue_production_executor;
    grant execute on function public.apply_approved_gtin_promotion_plan(uuid,text,text,text,text) to retailer_catalogue_production_executor;
  else raise exception 'GTIN promotion executor role missing'; end if;
end;
$grants$;

commit;
