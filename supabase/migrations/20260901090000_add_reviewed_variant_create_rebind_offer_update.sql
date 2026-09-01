begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $preflight$
declare v_target jsonb;
begin
  if to_regprocedure('public.validate_product_import_plan_read_only(jsonb)') is null
     or to_regprocedure('public.apply_product_import_plan(jsonb)') is null
     or to_regprocedure('public.apply_approved_product_import_plan(uuid,text,text,text,bigint,text,text)') is null
     or to_regprocedure('public.record_identity_proven_price_observation(bigint,text,text,text,bigint)') is null
     or to_regprocedure('public.retailer_catalogue_actual_database_target()') is null
     or to_regprocedure('public.atomic_import_canonical_json(jsonb)') is null
     or to_regclass('public.approved_import_plans') is null
     or not exists(select 1 from information_schema.columns where table_schema='public' and table_name='approved_import_plans' and column_name='identity_observation_result') then
    raise exception 'reviewed variant rebind requires the existing guarded importer and approval ledger';
  end if;
  if current_user <> 'postgres' then raise exception 'reviewed variant create/rebind migration requires database owner postgres'; end if;
  v_target:=public.retailer_catalogue_actual_database_target();
  if v_target->>'target_environment' <> 'PRODUCTION'
     or v_target->>'project_ref' <> 'aftboxmrdgyhizicfsfu'
     or v_target->>'database_identity' <> 'supplementscout-production:aftboxmrdgyhizicfsfu' then
    raise exception 'reviewed variant create/rebind migration requires the exact production target';
  end if;
  if to_regprocedure('public.atomic_import_validate_before_reviewed_variant_rebind(jsonb)') is not null then
    raise exception 'reviewed variant create/rebind path is already installed';
  end if;
end
$preflight$;

alter table public.approved_import_plans
  add column if not exists execution_result jsonb;
alter table public.approved_import_plans
  add constraint approved_import_plans_execution_result_check
  check(execution_result is null or jsonb_typeof(execution_result)='object');

create unique index if not exists approved_import_plans_reviewed_variant_idempotency_idx
  on public.approved_import_plans ((plan_json#>>'{meta,idempotency_key}'))
  where plan_json#>>'{meta,operation_type}' = 'reviewed_variant_create_rebind_offer_update';

alter function public.validate_product_import_plan_read_only(jsonb)
  rename to atomic_import_validate_before_reviewed_variant_rebind;
alter function public.apply_product_import_plan(jsonb)
  rename to atomic_import_apply_before_reviewed_variant_rebind;
alter function public.apply_approved_product_import_plan(uuid,text,text,text,bigint,text,text)
  rename to atomic_import_apply_approved_before_reviewed_variant_rebind;

create function public.validate_reviewed_variant_create_rebind_offer_update_plan(p_plan jsonb)
returns jsonb
language plpgsql stable security definer
set search_path=pg_catalog,public,pg_temp
as $validate$
declare
  v_product public.products%rowtype;
  v_variant public.product_variants%rowtype;
  v_retailer public.retailers%rowtype;
  v_mapping public.retailer_products%rowtype;
  v_offer public.offers%rowtype;
  v_actual jsonb;
  v_source jsonb;
  v_target jsonb;
  v_before_hash text;
  v_idempotency text;
  v_approval_fingerprint text;
  v_capture_1 timestamptz;
  v_capture_2 timestamptz;
  v_expiry timestamptz;
  v_expected_deltas constant jsonb := '{"row_count_deltas":{"products":"0","product_variants":"1","retailer_products":"0","offers":"0","price_history":"1"},"logical_field_deltas":{"product_variant_creates":"1","mapping_rebinds":"1","mapping_identity_updates":"1","offer_rebinds":"1","offer_price_updates":"1","offer_shipping_updates":"0","offer_total_updates":"1","offer_stock_updates":"1","offer_url_updates":"0","last_checked_at_updates":"1","parent_product_updates":"0"}}'::jsonb;
begin
  if not public.atomic_import_has_exact_keys(p_plan,array['meta','source_record','product','product_variant','retailer','retailer_product','offer','price_history','approval','expected_state','expected_deltas'])
     or jsonb_path_exists(p_plan,'$.** ? (@.type() == "number")') then
    raise exception 'invalid reviewed variant rebind plan: closed decimal-string schema';
  end if;
  if not public.atomic_import_has_exact_keys(p_plan->'meta',array['version','plan_kind','operation_type','source_row_fingerprint','plan_fingerprint','source_snapshot_sha256','source_captured_at','approval_fingerprint','idempotency_key','expires_at'])
     or p_plan#>>'{meta,version}' <> '3'
     or p_plan#>>'{meta,plan_kind}' <> 'feed'
     or p_plan#>>'{meta,operation_type}' <> 'reviewed_variant_create_rebind_offer_update'
     or p_plan#>>'{meta,source_row_fingerprint}' !~ '^[0-9a-f]{64}$'
     or p_plan#>>'{meta,source_snapshot_sha256}' !~ '^[0-9a-f]{64}$'
     or p_plan#>>'{meta,approval_fingerprint}' !~ '^[0-9a-f]{64}$'
     or p_plan#>>'{meta,idempotency_key}' !~ '^[0-9a-f]{64}$'
     or p_plan#>>'{meta,plan_fingerprint}' !~ '^[0-9a-f]{32}$'
     or md5(public.atomic_import_canonical_json(jsonb_set(p_plan,'{meta,plan_fingerprint}','null'::jsonb,false))) <> p_plan#>>'{meta,plan_fingerprint}' then
    raise exception 'invalid reviewed variant rebind plan: metadata or plan fingerprint';
  end if;

  v_source := p_plan->'source_record';
  if not public.atomic_import_has_exact_keys(v_source,array['schema_version','retailer_slug','source_product_id','source_variant_id','exact_title','option_name','option_value','weight_value','weight_unit','price','shipping_cost','in_stock','url','source_url','gtin','mpn','captures'])
     or v_source->>'schema_version' <> '1'
     or jsonb_typeof(v_source->'captures') <> 'array'
     or jsonb_array_length(v_source->'captures') <> 2
     or not public.atomic_import_has_exact_keys(v_source#>'{captures,0}',array['captured_at','semantic_fingerprint'])
     or not public.atomic_import_has_exact_keys(v_source#>'{captures,1}',array['captured_at','semantic_fingerprint'])
     or v_source#>>'{captures,0,semantic_fingerprint}' is distinct from p_plan#>>'{meta,source_snapshot_sha256}'
     or v_source#>>'{captures,1,semantic_fingerprint}' is distinct from p_plan#>>'{meta,source_snapshot_sha256}'
     or encode(digest(public.atomic_import_canonical_json(v_source),'sha256'),'hex') <> p_plan#>>'{meta,source_row_fingerprint}'
     or lower(v_source->>'option_name') <> 'flavour'
     or lower(v_source->>'weight_unit') <> 'g'
     or (v_source->>'weight_value') !~ '^[1-9][0-9]*$'
     or (v_source->>'in_stock')::boolean is not true
     or position(lower(v_source->>'option_value') in lower(v_source->>'exact_title')) = 0
     or nullif(trim(v_source->>'source_product_id'),'') is null
     or nullif(trim(v_source->>'source_variant_id'),'') is null then
    raise exception 'invalid reviewed variant rebind plan: source semantics or two-capture proof';
  end if;
  begin
    v_capture_1 := (v_source#>>'{captures,0,captured_at}')::timestamptz;
    v_capture_2 := (v_source#>>'{captures,1,captured_at}')::timestamptz;
    v_expiry := (p_plan#>>'{meta,expires_at}')::timestamptz;
  exception when others then
    raise exception 'invalid reviewed variant rebind plan: timestamp';
  end;
  if v_capture_1 >= v_capture_2 or v_capture_2 < now()-interval '24 hours' or v_capture_2 > now()+interval '5 minutes'
     or v_capture_2 is distinct from (p_plan#>>'{meta,source_captured_at}')::timestamptz
     or v_expiry <= now() or v_expiry > now()+interval '24 hours' then
    raise exception 'invalid reviewed variant rebind plan: stale captures or expiry';
  end if;

  if not public.atomic_import_has_exact_keys(p_plan->'product',array['action','id']) or p_plan#>>'{product,action}' <> 'existing'
     or not public.atomic_import_has_exact_keys(p_plan->'retailer',array['action','id']) or p_plan#>>'{retailer,action}' <> 'existing'
     or not public.atomic_import_has_exact_keys(p_plan->'product_variant',array['action','values','evidence']) or p_plan#>>'{product_variant,action}' <> 'create_variant'
     or not public.atomic_import_has_exact_keys(p_plan#>'{product_variant,values}',array['variant_key','display_name','flavour_code','flavour_label','size_value','size_unit','pack_count','product_format'])
     or not public.atomic_import_has_exact_keys(p_plan#>'{product_variant,evidence}',array['external_options','approved_mapping_id'])
     or not public.atomic_import_has_exact_keys(p_plan->'retailer_product',array['action','id','values']) or p_plan#>>'{retailer_product,action}' <> 'update'
     or not public.atomic_import_has_exact_keys(p_plan#>'{retailer_product,values}',array['external_product_id','external_variant_id','external_sku','external_options','external_name','external_slug','external_gtin','external_url','match_method','match_confidence','product_variant_id'])
     or not public.atomic_import_has_exact_keys(p_plan->'offer',array['action','id','values']) or p_plan#>>'{offer,action}' <> 'update'
     or not public.atomic_import_has_exact_keys(p_plan#>'{offer,values}',array['product_variant_id','price','shipping_cost','total_price','in_stock','url','last_checked_at'])
     or p_plan->'price_history' <> '{"action":"create"}'::jsonb
     or p_plan->'approval' <> jsonb_build_object('approved',false,'approval_type','owner_reviewed_variant_create_rebind_offer_update','approval_fingerprint',p_plan#>>'{meta,approval_fingerprint}')
     or not public.atomic_import_has_exact_keys(p_plan->'expected_state',array['product','product_variant','retailer','retailer_product','offer'])
     or p_plan->'expected_deltas' is distinct from v_expected_deltas then
    raise exception 'invalid reviewed variant rebind plan: actions or expected deltas';
  end if;
  if p_plan#>'{retailer_product,values,product_variant_id}' <> 'null'::jsonb
     or p_plan#>'{offer,values,product_variant_id}' <> 'null'::jsonb
     or p_plan#>>'{product_variant,evidence,approved_mapping_id}' is distinct from p_plan#>>'{retailer_product,id}'
     or p_plan#>'{product_variant,evidence,external_options}' is distinct from p_plan#>'{retailer_product,values,external_options}'
     or p_plan#>'{retailer_product,values,external_options}' is distinct from jsonb_build_object(v_source->>'option_name',v_source->>'option_value')
     or p_plan#>>'{retailer_product,values,external_product_id}' is distinct from v_source->>'source_product_id'
     or p_plan#>>'{retailer_product,values,external_variant_id}' is distinct from v_source->>'source_variant_id'
     or p_plan#>>'{retailer_product,values,external_sku}' is distinct from v_source->>'mpn'
     or p_plan#>>'{retailer_product,values,external_gtin}' is distinct from v_source->>'gtin'
     or p_plan#>>'{retailer_product,values,match_method}' <> 'external_id'
     or p_plan#>>'{retailer_product,values,match_confidence}' <> '100'
     or p_plan#>>'{retailer_product,values,external_name}' is distinct from p_plan#>>'{expected_state,retailer_product,external_name}'
     or p_plan#>>'{retailer_product,values,external_slug}' is distinct from p_plan#>>'{expected_state,retailer_product,external_slug}'
     or p_plan#>>'{retailer_product,values,external_url}' is distinct from p_plan#>>'{expected_state,retailer_product,external_url}'
     or p_plan#>>'{product_variant,values,flavour_label}' is distinct from v_source->>'option_value'
     or p_plan#>>'{product_variant,values,size_value}' is distinct from v_source->>'weight_value'
     or p_plan#>>'{product_variant,values,size_unit}' is distinct from v_source->>'weight_unit'
     or p_plan#>>'{product_variant,values,pack_count}' <> '1'
     or p_plan#>>'{product_variant,values,display_name}' is distinct from concat(v_source->>'option_value',' / ',v_source->>'weight_value',v_source->>'weight_unit')
     or p_plan#>>'{product_variant,values,flavour_code}' is distinct from trim(both '-' from regexp_replace(lower(replace(v_source->>'option_value','&',' and ')),'[^a-z0-9]+','-','g'))
     or p_plan#>>'{product_variant,values,variant_key}' is distinct from concat(trim(both '-' from regexp_replace(lower(replace(v_source->>'option_value','&',' and ')),'[^a-z0-9]+','-','g')),'-',v_source->>'weight_value',v_source->>'weight_unit')
     or p_plan#>>'{offer,values,price}' is distinct from v_source->>'price'
     or p_plan#>>'{offer,values,shipping_cost}' is distinct from v_source->>'shipping_cost'
     or (p_plan#>>'{offer,values,total_price}')::numeric is distinct from ((v_source->>'price')::numeric+(v_source->>'shipping_cost')::numeric)
     or (p_plan#>>'{offer,values,in_stock}')::boolean is not true
     or (p_plan#>>'{offer,values,last_checked_at}')::timestamptz is distinct from v_capture_2 then
    raise exception 'invalid reviewed variant rebind plan: source-to-target binding';
  end if;

  select * into v_product from public.products where id=(p_plan#>>'{product,id}')::bigint;
  select * into v_variant from public.product_variants where id=(p_plan#>>'{expected_state,product_variant,id}')::bigint;
  select * into v_retailer from public.retailers where id=(p_plan#>>'{retailer,id}')::bigint;
  select * into v_mapping from public.retailer_products where id=(p_plan#>>'{retailer_product,id}')::bigint;
  select * into v_offer from public.offers where id=(p_plan#>>'{offer,id}')::bigint;
  if v_product.id is null or v_variant.id is null or v_retailer.id is null or v_mapping.id is null or v_offer.id is null then
    raise exception 'stale reviewed variant rebind plan: target missing';
  end if;

  v_actual:=jsonb_build_object('id',v_product.id::text,'name',v_product.name,'slug',v_product.slug,'brand',v_product.brand,'category',v_product.category,
    'net_weight_g',case when v_product.net_weight_g is null then null else to_jsonb(public.atomic_import_decimal_string(v_product.net_weight_g)) end,
    'product_format',v_product.product_format,'is_active',v_product.is_active,'merged_into_product_id',case when v_product.merged_into_product_id is null then null else to_jsonb(v_product.merged_into_product_id::text) end);
  if v_actual is distinct from p_plan#>'{expected_state,product}' or not v_product.is_active or v_product.merged_into_product_id is not null then raise exception 'stale reviewed variant rebind plan: product'; end if;
  v_actual:=jsonb_build_object('id',v_retailer.id::text,'name',v_retailer.name,'slug',v_retailer.slug,'website',v_retailer.website);
  if v_actual is distinct from p_plan#>'{expected_state,retailer}' or v_retailer.slug is distinct from v_source->>'retailer_slug' then raise exception 'stale reviewed variant rebind plan: retailer'; end if;
  v_actual:=jsonb_build_object('id',v_variant.id::text,'product_id',v_variant.product_id::text,'variant_key',v_variant.variant_key,'display_name',v_variant.display_name,
    'flavour_code',v_variant.flavour_code,'flavour_label',v_variant.flavour_label,'size_value',case when v_variant.size_value is null then null else to_jsonb(public.atomic_import_decimal_string(v_variant.size_value)) end,
    'size_unit',v_variant.size_unit,'pack_count',case when v_variant.pack_count is null then null else to_jsonb(v_variant.pack_count::text) end,'product_format',v_variant.product_format,
    'gtin',v_variant.gtin,'is_active',v_variant.is_active,'is_default',v_variant.is_default);
  if v_actual is distinct from p_plan#>'{expected_state,product_variant}' or not v_variant.is_active or not v_variant.is_default or v_variant.product_id<>v_product.id then raise exception 'stale reviewed variant rebind plan: current variant'; end if;
  v_actual:=jsonb_build_object('id',v_mapping.id::text,'retailer_id',v_mapping.retailer_id::text,'product_id',v_mapping.product_id::text,'product_variant_id',v_mapping.product_variant_id::text,
    'external_product_id',v_mapping.external_product_id,'external_variant_id',v_mapping.external_variant_id,'external_sku',v_mapping.external_sku,'external_options',v_mapping.external_options,
    'external_name',v_mapping.external_name,'external_slug',v_mapping.external_slug,'external_gtin',v_mapping.external_gtin,'external_url',v_mapping.external_url,'match_method',v_mapping.match_method,
    'match_confidence',case when v_mapping.match_confidence is null then null else to_jsonb(public.atomic_import_decimal_string(v_mapping.match_confidence)) end,
    'updated_at',to_char(v_mapping.updated_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));
  if (v_actual-'updated_at'::text) is distinct from ((p_plan#>'{expected_state,retailer_product}')-'updated_at'::text)
     or v_mapping.updated_at is distinct from (p_plan#>>'{expected_state,retailer_product,updated_at}')::timestamptz
     or v_mapping.product_id<>v_product.id or v_mapping.product_variant_id<>v_variant.id or v_mapping.retailer_id<>v_retailer.id then raise exception 'stale reviewed variant rebind plan: mapping'; end if;
  v_actual:=jsonb_build_object('id',v_offer.id::text,'product_id',v_offer.product_id::text,'retailer_id',v_offer.retailer_id::text,'product_variant_id',v_offer.product_variant_id::text,
    'retailer_product_id',v_offer.retailer_product_id::text,'price',public.atomic_import_decimal_string(v_offer.price),
    'shipping_cost',case when v_offer.shipping_cost is null then null else to_jsonb(public.atomic_import_decimal_string(v_offer.shipping_cost)) end,
    'total_price',case when v_offer.total_price is null then null else to_jsonb(public.atomic_import_decimal_string(v_offer.total_price)) end,
    'in_stock',v_offer.in_stock,'url',v_offer.url,'last_checked_at',to_char(v_offer.last_checked_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));
  if (v_actual-'last_checked_at'::text) is distinct from ((p_plan#>'{expected_state,offer}')-'last_checked_at'::text)
     or v_offer.last_checked_at is distinct from (p_plan#>>'{expected_state,offer,last_checked_at}')::timestamptz
     or v_offer.product_id<>v_product.id or v_offer.product_variant_id<>v_variant.id or v_offer.retailer_product_id<>v_mapping.id or v_offer.retailer_id<>v_retailer.id
     or v_offer.price is distinct from (p_plan#>>'{expected_state,offer,price}')::numeric
     or v_offer.shipping_cost is distinct from (p_plan#>>'{offer,values,shipping_cost}')::numeric
     or v_offer.in_stock is not false or v_offer.url is distinct from p_plan#>>'{offer,values,url}'
     or v_mapping.external_url is distinct from v_offer.url or v_source->>'url' is distinct from v_offer.url or split_part(v_source->>'source_url','?',1) is distinct from v_offer.url
     or v_capture_2<=v_offer.last_checked_at then raise exception 'stale reviewed variant rebind plan: offer or commercial state'; end if;
  if (select count(*) from public.product_variants where product_id=v_product.id and is_active)<>1
     or position(lower(v_mapping.external_name) in lower(v_source->>'exact_title'))<>1
     or exists(select 1 from public.product_variants where product_id=v_product.id and (lower(variant_key)=lower(p_plan#>>'{product_variant,values,variant_key}') or lower(display_name)=lower(p_plan#>>'{product_variant,values,display_name}')))
     or exists(select 1 from public.retailer_products where retailer_id=v_retailer.id and id<>v_mapping.id and (external_variant_id=v_source->>'source_variant_id' or (external_product_id=v_source->>'source_product_id' and external_options=p_plan#>'{retailer_product,values,external_options}'))) then
    raise exception 'reviewed variant rebind duplicate or variant-set drift';
  end if;

  v_before_hash:=encode(digest(public.atomic_import_canonical_json(jsonb_build_object('product',p_plan#>'{expected_state,product}','currentVariant',p_plan#>'{expected_state,product_variant}','retailer',p_plan#>'{expected_state,retailer}','mapping',p_plan#>'{expected_state,retailer_product}','offer',p_plan#>'{expected_state,offer}')),'sha256'),'hex');
  v_target:=jsonb_build_object('product_id',p_plan#>>'{product,id}','retailer_id',p_plan#>>'{retailer,id}','mapping_id',p_plan#>>'{retailer_product,id}','offer_id',p_plan#>>'{offer,id}',
    'expected_current_variant_id',p_plan#>>'{expected_state,product_variant,id}','source_product_id',v_source->>'source_product_id','source_variant_id',v_source->>'source_variant_id',
    'variant_key',p_plan#>>'{product_variant,values,variant_key}','display_name',p_plan#>>'{product_variant,values,display_name}','price',p_plan#>>'{offer,values,price}',
    'shipping_cost',p_plan#>>'{offer,values,shipping_cost}','total_price',p_plan#>>'{offer,values,total_price}','in_stock',(p_plan#>>'{offer,values,in_stock}')::boolean,'last_checked_at',p_plan#>>'{offer,values,last_checked_at}');
  v_idempotency:=encode(digest(public.atomic_import_canonical_json(jsonb_build_object('operation_type','reviewed_variant_create_rebind_offer_update','sourceFingerprint',p_plan#>>'{meta,source_row_fingerprint}','beforeHash',v_before_hash,'target',v_target)),'sha256'),'hex');
  v_approval_fingerprint:=encode(digest(public.atomic_import_canonical_json(jsonb_build_object('operation_type','reviewed_variant_create_rebind_offer_update','sourceFingerprint',p_plan#>>'{meta,source_row_fingerprint}','beforeHash',v_before_hash,'target',v_target,'idempotency_key',v_idempotency,'expires_at',p_plan#>>'{meta,expires_at}')),'sha256'),'hex');
  if v_idempotency<>p_plan#>>'{meta,idempotency_key}' or v_approval_fingerprint<>p_plan#>>'{meta,approval_fingerprint}' then raise exception 'invalid reviewed variant rebind plan: approval or idempotency fingerprint'; end if;
  return jsonb_build_object('valid',true,'operation_type','reviewed_variant_create_rebind_offer_update','product_id',v_product.id::text,'current_variant_id',v_variant.id::text,'mapping_id',v_mapping.id::text,'offer_id',v_offer.id::text,'idempotency_key',v_idempotency);
end
$validate$;

create function public.apply_reviewed_variant_create_rebind_offer_update_plan(p_plan jsonb)
returns jsonb language plpgsql volatile security definer set search_path=pg_catalog,public,pg_temp
as $apply$
declare
  v_product_id bigint:=(p_plan#>>'{product,id}')::bigint;
  v_old_variant_id bigint:=(p_plan#>>'{expected_state,product_variant,id}')::bigint;
  v_retailer_id bigint:=(p_plan#>>'{retailer,id}')::bigint;
  v_mapping_id bigint:=(p_plan#>>'{retailer_product,id}')::bigint;
  v_offer_id bigint:=(p_plan#>>'{offer,id}')::bigint;
  v_new_variant_id bigint; v_history_id bigint; v_rows integer; v_parent_before jsonb;
  v_variant_count bigint; v_mapping_count bigint; v_offer_count bigint; v_history_count bigint;
begin
  perform pg_advisory_xact_lock(hashtextextended(concat_ws('|','reviewed-variant-rebind',v_product_id::text,p_plan#>>'{product_variant,values,variant_key}'),0));
  perform pg_advisory_xact_lock(hashtextextended(concat_ws('|',v_retailer_id::text,p_plan#>>'{source_record,source_variant_id}'),0));
  perform public.validate_reviewed_variant_create_rebind_offer_update_plan(p_plan);
  select to_jsonb(p) into v_parent_before from public.products p where id=v_product_id for update;
  perform 1 from public.retailer_products where id=v_mapping_id for update;
  perform 1 from public.offers where id=v_offer_id for update;
  perform 1 from public.product_variants where id=v_old_variant_id for update;
  perform public.validate_reviewed_variant_create_rebind_offer_update_plan(p_plan);
  select count(*) into v_variant_count from public.product_variants where product_id=v_product_id;
  select count(*) into v_mapping_count from public.retailer_products where product_id=v_product_id and retailer_id=v_retailer_id;
  select count(*) into v_offer_count from public.offers where product_id=v_product_id and retailer_id=v_retailer_id;
  select count(*) into v_history_count from public.price_history where offer_id=v_offer_id;
  insert into public.product_variants(product_id,variant_key,display_name,flavour_code,flavour_label,size_value,size_unit,pack_count,product_format,gtin,nutrition_override,is_active,is_default)
  values(v_product_id,p_plan#>>'{product_variant,values,variant_key}',p_plan#>>'{product_variant,values,display_name}',p_plan#>>'{product_variant,values,flavour_code}',p_plan#>>'{product_variant,values,flavour_label}',
    (p_plan#>>'{product_variant,values,size_value}')::numeric,p_plan#>>'{product_variant,values,size_unit}',(p_plan#>>'{product_variant,values,pack_count}')::integer,p_plan#>>'{product_variant,values,product_format}',null,'{}'::jsonb,true,false)
  returning id into v_new_variant_id;
  update public.retailer_products set product_variant_id=v_new_variant_id,external_product_id=p_plan#>>'{retailer_product,values,external_product_id}',external_variant_id=p_plan#>>'{retailer_product,values,external_variant_id}',
    external_sku=p_plan#>>'{retailer_product,values,external_sku}',external_options=p_plan#>'{retailer_product,values,external_options}',external_gtin=p_plan#>>'{retailer_product,values,external_gtin}',
    match_method=p_plan#>>'{retailer_product,values,match_method}',match_confidence=(p_plan#>>'{retailer_product,values,match_confidence}')::numeric,updated_at=now() where id=v_mapping_id;
  get diagnostics v_rows=row_count; if v_rows<>1 then raise exception 'reviewed variant rebind mapping write count mismatch'; end if;
  update public.offers set product_variant_id=v_new_variant_id,price=(p_plan#>>'{offer,values,price}')::numeric,shipping_cost=(p_plan#>>'{offer,values,shipping_cost}')::numeric,
    total_price=(p_plan#>>'{offer,values,total_price}')::numeric,in_stock=(p_plan#>>'{offer,values,in_stock}')::boolean,url=p_plan#>>'{offer,values,url}',last_checked_at=(p_plan#>>'{offer,values,last_checked_at}')::timestamptz where id=v_offer_id;
  get diagnostics v_rows=row_count; if v_rows<>1 then raise exception 'reviewed variant rebind offer write count mismatch'; end if;
  insert into public.price_history(offer_id,price,shipping_cost,total_price,checked_at)
  values(v_offer_id,(p_plan#>>'{offer,values,price}')::numeric,(p_plan#>>'{offer,values,shipping_cost}')::numeric,(p_plan#>>'{offer,values,total_price}')::numeric,(p_plan#>>'{offer,values,last_checked_at}')::timestamptz)
  returning id into v_history_id;
  if (select to_jsonb(p) from public.products p where id=v_product_id) is distinct from v_parent_before then raise exception 'reviewed variant rebind modified parent product'; end if;
  if (select count(*) from public.product_variants where product_id=v_product_id)<>v_variant_count+1
     or (select count(*) from public.retailer_products where product_id=v_product_id and retailer_id=v_retailer_id)<>v_mapping_count
     or (select count(*) from public.offers where product_id=v_product_id and retailer_id=v_retailer_id)<>v_offer_count
     or (select count(*) from public.price_history where offer_id=v_offer_id)<>v_history_count+1 then raise exception 'reviewed variant rebind post-write row delta mismatch'; end if;
  return jsonb_build_object('status','APPLIED','product_id',v_product_id,'product_action','existing','old_product_variant_id',v_old_variant_id,'product_variant_id',v_new_variant_id,'product_variant_action','create_variant',
    'retailer_id',v_retailer_id,'retailer_product_id',v_mapping_id,'retailer_product_action','rebind','offer_id',v_offer_id,'offer_action','update_price_and_stock','price_history_id',v_history_id,'price_history_action','create',
    'plan_fingerprint',p_plan#>>'{meta,plan_fingerprint}','source_row_fingerprint',p_plan#>>'{meta,source_row_fingerprint}','approval_fingerprint',p_plan#>>'{meta,approval_fingerprint}','idempotency_key',p_plan#>>'{meta,idempotency_key}');
end
$apply$;

create function public.validate_product_import_plan_read_only(p_plan jsonb) returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public,pg_temp as $wrapper$
begin
  if p_plan#>>'{meta,operation_type}'='reviewed_variant_create_rebind_offer_update' then return public.validate_reviewed_variant_create_rebind_offer_update_plan(p_plan); end if;
  return public.atomic_import_validate_before_reviewed_variant_rebind(p_plan);
end $wrapper$;

create function public.apply_product_import_plan(p_plan jsonb) returns jsonb language plpgsql volatile security definer set search_path=pg_catalog,public,pg_temp as $wrapper$
begin
  if p_plan#>>'{meta,operation_type}'='reviewed_variant_create_rebind_offer_update' then return public.apply_reviewed_variant_create_rebind_offer_update_plan(p_plan); end if;
  return public.atomic_import_apply_before_reviewed_variant_rebind(p_plan);
end $wrapper$;

create function public.apply_approved_product_import_plan(p_approval_id uuid,p_artifact_sha256 text,p_plan_fingerprint text,p_source_row_fingerprint text,p_retailer_id bigint,p_plan_kind text,p_run_id text)
returns jsonb language plpgsql volatile security definer set search_path=pg_catalog,public,pg_temp as $approved$
declare v_approval public.approved_import_plans%rowtype; v_result jsonb; v_observation jsonb; v_consumed_at timestamptz; v_kind text;
begin
  select * into v_approval from public.approved_import_plans where id=p_approval_id for update;
  if not found then raise exception 'approved import plan not found'; end if;
  if v_approval.plan_json#>>'{meta,operation_type}'<>'reviewed_variant_create_rebind_offer_update' then
    return public.atomic_import_apply_approved_before_reviewed_variant_rebind(p_approval_id,p_artifact_sha256,p_plan_fingerprint,p_source_row_fingerprint,p_retailer_id,p_plan_kind,p_run_id);
  end if;
  if v_approval.artifact_sha256 is distinct from p_artifact_sha256 or v_approval.run_id is distinct from p_run_id or v_approval.plan_fingerprint is distinct from p_plan_fingerprint
     or v_approval.source_row_fingerprint is distinct from p_source_row_fingerprint or v_approval.retailer_id is distinct from p_retailer_id or v_approval.plan_kind is distinct from p_plan_kind then raise exception 'approved import plan metadata mismatch'; end if;
  if v_approval.plan_fingerprint is distinct from v_approval.plan_json#>>'{meta,plan_fingerprint}' or v_approval.source_row_fingerprint is distinct from v_approval.plan_json#>>'{meta,source_row_fingerprint}'
     or v_approval.plan_kind is distinct from v_approval.plan_json#>>'{meta,plan_kind}' or v_approval.retailer_id is distinct from (v_approval.plan_json#>>'{retailer,id}')::bigint
     or md5(public.atomic_import_canonical_json(jsonb_set(v_approval.plan_json,'{meta,plan_fingerprint}','null'::jsonb,false)))<>v_approval.plan_fingerprint
     or v_approval.expires_at is distinct from (v_approval.plan_json#>>'{meta,expires_at}')::timestamptz then raise exception 'approved import plan ledger integrity mismatch'; end if;
  if v_approval.status='consumed' and v_approval.consumed_at is not null and v_approval.execution_result is not null then
    return v_approval.execution_result||jsonb_build_object('status','ALREADY_APPLIED','already_applied',true,'consumed_at',v_approval.consumed_at);
  end if;
  if v_approval.status<>'approved' or v_approval.consumed_at is not null then raise exception 'approved import plan already consumed without replay evidence'; end if;
  if v_approval.expires_at<=now() then raise exception 'approved import plan expired'; end if;
  v_result:=public.apply_reviewed_variant_create_rebind_offer_update_plan(v_approval.plan_json);
  v_kind:=case when v_result->>'price_history_action'='create' then 'delivered_price_changed' else 'daily_confirmation' end;
  v_observation:=public.record_identity_proven_price_observation((v_result->>'offer_id')::bigint,v_kind,v_approval.run_id,v_approval.source,nullif(v_result->>'price_history_id','')::bigint);
  v_consumed_at:=now();
  v_result:=v_result||jsonb_build_object('approval_id',v_approval.id,'approval_status','consumed','consumed_at',v_consumed_at,'artifact_sha256',v_approval.artifact_sha256,'run_id',v_approval.run_id,
    'retailer_id',v_approval.retailer_id::text,'plan_kind',v_approval.plan_kind,'identity_observation',v_observation,'already_applied',false);
  update public.approved_import_plans set status='consumed',consumed_at=v_consumed_at,identity_observation_result=v_observation,execution_result=v_result where id=v_approval.id;
  return v_result;
end $approved$;

alter function public.validate_reviewed_variant_create_rebind_offer_update_plan(jsonb) owner to postgres;
alter function public.apply_reviewed_variant_create_rebind_offer_update_plan(jsonb) owner to postgres;
alter function public.atomic_import_validate_before_reviewed_variant_rebind(jsonb) owner to postgres;
alter function public.atomic_import_apply_before_reviewed_variant_rebind(jsonb) owner to postgres;
alter function public.atomic_import_apply_approved_before_reviewed_variant_rebind(uuid,text,text,text,bigint,text,text) owner to postgres;
alter function public.validate_product_import_plan_read_only(jsonb) owner to postgres;
alter function public.apply_product_import_plan(jsonb) owner to postgres;
alter function public.apply_approved_product_import_plan(uuid,text,text,text,bigint,text,text) owner to postgres;

revoke all on function public.validate_reviewed_variant_create_rebind_offer_update_plan(jsonb),public.apply_reviewed_variant_create_rebind_offer_update_plan(jsonb),
  public.atomic_import_validate_before_reviewed_variant_rebind(jsonb),public.atomic_import_apply_before_reviewed_variant_rebind(jsonb),
  public.atomic_import_apply_approved_before_reviewed_variant_rebind(uuid,text,text,text,bigint,text,text),public.validate_product_import_plan_read_only(jsonb),public.apply_product_import_plan(jsonb)
  from public,anon,authenticated,service_role;
revoke all on function public.apply_approved_product_import_plan(uuid,text,text,text,bigint,text,text) from public,anon,authenticated;
grant execute on function public.apply_approved_product_import_plan(uuid,text,text,text,bigint,text,text) to service_role;

commit;
