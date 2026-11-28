begin;
-- LOCAL PROPOSAL ONLY. Existing-target identity-only mode, version 5.
set local lock_timeout='5s';
set local statement_timeout='60s';
do $owner$ begin if current_user<>'postgres' or (select pg_get_userbyid(nspowner) from pg_namespace where nspname='atomic_import_private') is distinct from 'postgres' then raise exception 'IDENTITY_V5_OWNER_REQUIRED';end if;end $owner$;
create function atomic_import_private.identity_state_projection(p_row jsonb,p_keys text[])
returns jsonb language sql immutable strict set search_path=pg_catalog as $projection$
 select jsonb_object_agg(key,case
   when p_row->key='null'::jsonb then 'null'::jsonb
   when key in ('updated_at','last_checked_at','checked_at') then to_jsonb(
     to_char((p_row->>key)::timestamptz at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS')||
     case when to_char((p_row->>key)::timestamptz,'US')='000000' then '' else '.'||rtrim(to_char((p_row->>key)::timestamptz,'US'),'0') end||'Z')
   when jsonb_typeof(p_row->key)='number' then to_jsonb(public.atomic_import_decimal_string((p_row->>key)::numeric))
   else p_row->key end) from unnest(p_keys) key
$projection$;
create function atomic_import_private.validate_identity_rebind(p_plan jsonb)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $validate$
declare v_product public.products%rowtype;v_old public.product_variants%rowtype;v_target public.product_variants%rowtype;
 v_mapping public.retailer_products%rowtype;v_offer public.offers%rowtype;v_retailer public.retailers%rowtype;
 v_actual jsonb;v_history jsonb;v_source jsonb:=p_plan->'source_record';v_review jsonb:=p_plan->'owner_resolution';
 v_code text;v_codes text[]:=array[]::text[];
begin
 perform atomic_import_private.assert_quarantine_reader();
 if public.atomic_import_has_exact_keys(p_plan,array['meta','source_record','owner_resolution','product','product_variant','retailer','retailer_product','offer','price_history','approval','expected_state']) is distinct from true or
   public.atomic_import_has_exact_keys(p_plan->'meta',array['version','plan_kind','operation_type','source_row_fingerprint','plan_fingerprint','expires_at']) is distinct from true or
   p_plan#>>'{meta,version}' is distinct from '5' or p_plan#>>'{meta,plan_kind}' is distinct from 'manual' or
   p_plan#>>'{meta,operation_type}' is distinct from 'reviewed_variant_create_rebind_offer_update' or
   p_plan#>>'{meta,plan_fingerprint}' is distinct from atomic_import_private.plan_fingerprint(p_plan) or
   (p_plan#>>'{meta,expires_at}')::timestamptz<=now() or (p_plan#>>'{meta,expires_at}')::timestamptz>now()+interval '24 hours' then raise exception 'IDENTITY_V5_META_INVALID';end if;
 if p_plan->'product' is distinct from jsonb_build_object('action','existing','id',p_plan#>>'{expected_state,product,id}') or
   p_plan->'product_variant' is distinct from jsonb_build_object('action','existing','id',p_plan#>>'{expected_state,target_variant,id}') or
   p_plan->'retailer' is distinct from jsonb_build_object('action','existing','id',p_plan#>>'{expected_state,retailer,id}') or
   p_plan->'retailer_product' is distinct from jsonb_build_object('action','identity_rebind','id',p_plan#>>'{expected_state,retailer_product,id}') or
   p_plan->'offer' is distinct from jsonb_build_object('action','identity_rebind','id',p_plan#>>'{expected_state,offer,id}') or
   p_plan->'price_history' is distinct from '{"action":"noop"}'::jsonb or
   p_plan->'approval' is distinct from '{"approved":false,"approval_type":"owner_reviewed_variant_create_rebind_offer_update"}'::jsonb then raise exception 'IDENTITY_V5_ACTION_SCOPE_INVALID';end if;
 select * into strict v_product from public.products where id=(p_plan#>>'{product,id}')::bigint;
 select * into strict v_target from public.product_variants where id=(p_plan#>>'{product_variant,id}')::bigint;
 select * into strict v_old from public.product_variants where id=(p_plan#>>'{expected_state,product_variant,id}')::bigint;
 select * into strict v_mapping from public.retailer_products where id=(p_plan#>>'{retailer_product,id}')::bigint;
 select * into strict v_offer from public.offers where id=(p_plan#>>'{offer,id}')::bigint;
 select * into strict v_retailer from public.retailers where id=(p_plan#>>'{retailer,id}')::bigint;
 select coalesce(jsonb_agg(atomic_import_private.identity_state_projection(to_jsonb(h),array['id','offer_id','price','shipping_cost','total_price','checked_at','identity_series_id']) order by atomic_import_private.utf16_sort_key(h.id::text)),'[]'::jsonb)
   into v_history from public.price_history h where h.offer_id=v_offer.id;
 v_actual:=jsonb_build_object('product',atomic_import_private.identity_state_projection(to_jsonb(v_product),array['id','name','slug','brand','category','net_weight_g','product_format','is_active','merged_into_product_id','gtin']),'product_variant',atomic_import_private.identity_state_projection(to_jsonb(v_old),array['id','product_id','variant_key','display_name','flavour_code','flavour_label','size_value','size_unit','pack_count','product_format','gtin','is_active','is_default']),
   'target_variant',atomic_import_private.identity_state_projection(to_jsonb(v_target),array['id','product_id','variant_key','display_name','flavour_code','flavour_label','size_value','size_unit','pack_count','product_format','gtin','is_active','is_default']),'retailer',atomic_import_private.identity_state_projection(to_jsonb(v_retailer),array['id','name','slug','website']),
   'retailer_product',atomic_import_private.identity_state_projection(to_jsonb(v_mapping),array['id','retailer_id','product_id','product_variant_id','external_product_id','external_variant_id','external_sku','external_options','external_name','external_slug','external_gtin','external_url','match_method','match_confidence','updated_at']),'offer',atomic_import_private.identity_state_projection(to_jsonb(v_offer),array['id','product_id','retailer_id','product_variant_id','retailer_product_id','price','shipping_cost','total_price','in_stock','url','last_checked_at']),'history',v_history);
 if v_actual is distinct from p_plan->'expected_state' or not v_product.is_active or v_product.merged_into_product_id is not null or
   not v_old.is_active or not v_target.is_active or v_target.is_default or v_old.id=v_target.id or
   v_old.product_id<>v_product.id or v_target.product_id<>v_product.id or v_mapping.product_id<>v_product.id or
   v_mapping.product_variant_id<>v_old.id or v_mapping.retailer_id<>v_retailer.id or v_offer.product_id<>v_product.id or
   v_offer.product_variant_id<>v_old.id or v_offer.retailer_product_id<>v_mapping.id or v_offer.retailer_id<>v_retailer.id or
   v_offer.url is distinct from v_mapping.external_url then raise exception 'IDENTITY_V5_STALE_STATE';end if;
 if exists(select 1 from public.price_identity_series where offer_id=v_offer.id) or
   exists(select 1 from public.price_history where offer_id=v_offer.id and identity_series_id is not null) then raise exception 'IDENTITY_V5_MANAGED_HISTORY_UNSUPPORTED';end if;
 if public.atomic_import_has_exact_keys(v_source,array['kind','seller','brand','product_name','product_version','external_product_id','external_variant_id','url','flavour','size_value','size_unit','pack_count','product_format','gtin','evidence']) is distinct from true or
   v_source->>'kind' is distinct from 'same-physical-unit-evidence-v1' or jsonb_typeof(v_source->'seller') is distinct from 'string' or
   jsonb_typeof(v_source->'product_version') is distinct from 'string' or nullif(btrim(v_source->>'seller'),'') is null or nullif(btrim(v_source->>'product_version'),'') is null or
   public.atomic_import_has_exact_keys(v_source->'evidence',array['relative_path','sha256']) is distinct from true or
   coalesce(v_source#>>'{evidence,relative_path}','') not like 'tmp/%' or coalesce(v_source#>>'{evidence,sha256}','')!~'^[0-9a-f]{64}$' or
   v_source->>'brand' is distinct from v_product.brand or v_source->>'product_name' is distinct from v_product.name or
   v_source->>'external_product_id' is distinct from v_mapping.external_product_id or v_source->>'external_variant_id' is distinct from v_mapping.external_variant_id or
   v_source->>'url' is distinct from v_mapping.external_url or v_source->>'flavour' is distinct from v_target.flavour_label or
   v_source->>'size_value' is distinct from public.atomic_import_decimal_string(v_target.size_value) or v_source->>'size_unit' is distinct from v_target.size_unit or
   v_source->>'pack_count' is distinct from v_target.pack_count::text or v_source->>'product_format' is distinct from v_target.product_format or
   v_target.product_format is distinct from v_product.product_format or v_source->>'gtin' is null or
   v_source->>'gtin' is distinct from v_mapping.external_gtin or (v_target.gtin is not null and v_source->>'gtin' is distinct from v_target.gtin) or
   (v_product.net_weight_g is not null and (v_target.size_unit<>'g' or v_target.pack_count<>1 or v_product.net_weight_g is distinct from v_target.size_value)) or
   (v_old.size_value is not null and (v_old.size_value is distinct from v_target.size_value or v_old.size_unit is distinct from v_target.size_unit)) or
   (not v_old.is_default and v_old.flavour_label is distinct from v_target.flavour_label) or
   (v_old.pack_count is not null and v_old.pack_count is distinct from v_target.pack_count) then raise exception 'IDENTITY_V5_PHYSICAL_PROOF_MISMATCH';end if;
 if p_plan#>>'{meta,source_row_fingerprint}' is distinct from encode(sha256(convert_to(atomic_import_private.canonical_json(v_source),'UTF8')),'hex') or
   public.atomic_import_has_exact_keys(v_review,array['kind','decision','authorized_by','authorized_at','expected_state_fingerprint','source_evidence_fingerprint','mapping_id','offer_id','target_variant_id','decision_evidence_sha256']) is distinct from true or
   v_review->>'kind' is distinct from 'existing-target-identity-rebind-owner-v1' or v_review->>'decision' is distinct from 'OWNER_CONFIRMED_SAME_PHYSICAL_UNIT_REBIND' or
   coalesce(v_review->>'authorized_by','')!~'^[a-z][a-z0-9._-]{2,63}$' or jsonb_typeof(v_review->'authorized_at') is distinct from 'string' or nullif(v_review->>'authorized_at','') is null or
   (v_review->>'authorized_at')::timestamptz>= (p_plan#>>'{meta,expires_at}')::timestamptz or
   v_review->>'expected_state_fingerprint' is distinct from encode(sha256(convert_to(atomic_import_private.canonical_json(v_actual),'UTF8')),'hex') or
   v_review->>'source_evidence_fingerprint' is distinct from p_plan#>>'{meta,source_row_fingerprint}' or
   v_review->>'mapping_id' is distinct from v_mapping.id::text or v_review->>'offer_id' is distinct from v_offer.id::text or
   v_review->>'target_variant_id' is distinct from v_target.id::text or
   v_review->>'decision_evidence_sha256' is distinct from encode(sha256(convert_to(atomic_import_private.canonical_json(jsonb_set(v_review,'{decision_evidence_sha256}','null'::jsonb,false)),'UTF8')),'hex') then raise exception 'IDENTITY_V5_OWNER_RESOLUTION_INVALID';end if;
 foreach v_code in array array[v_product.gtin,v_old.gtin,v_target.gtin,v_mapping.external_gtin] loop v_codes:=v_codes||atomic_import_private.gtin_aliases(v_code);end loop;
 if exists(select 1 from public.gtin_promotion_quarantine where gtin=any(v_codes)) or
   exists(select 1 from public.products where gtin=any(v_codes) and id<>v_product.id) or
   exists(select 1 from public.product_variants where gtin=any(v_codes) and id<>v_target.id) or
   exists(select 1 from public.retailer_products where id<>v_mapping.id and external_gtin=any(v_codes) and (product_id<>v_product.id or product_variant_id is distinct from v_target.id)) or
   exists(select 1 from public.retailer_products where retailer_id=v_retailer.id and id<>v_mapping.id and
     (product_variant_id=v_target.id or external_variant_id=v_mapping.external_variant_id or
       (external_sku is not null and external_sku=v_mapping.external_sku))) then raise exception 'IDENTITY_V5_IDENTITY_OR_GTIN_COLLISION';end if;
 return jsonb_build_object('valid',true,'operation_type','reviewed_variant_create_rebind_offer_update','mode','existing_target_identity_only',
   'product_id',v_product.id::text,'product_variant_id',v_target.id::text,'mapping_id',v_mapping.id::text,'offer_id',v_offer.id::text);
end
$validate$;
revoke all on function atomic_import_private.identity_state_projection(jsonb,text[]),atomic_import_private.validate_identity_rebind(jsonb) from public,anon,authenticated,service_role;
-- Guarded consumer changes
do $upgrade$
declare v_definition text;v_owner text;
begin
 select pg_get_functiondef(p.oid),pg_get_userbyid(p.proowner) into strict v_definition,v_owner from pg_proc p where p.oid='public.validate_reviewed_variant_create_rebind_offer_update_plan(jsonb)'::regprocedure;
 if v_owner<>'postgres' or encode(sha256(convert_to(v_definition,'UTF8')),'hex')<>'6f27f6a49d8ddde5bb1764b71ee8b987d3519c880f070ef0768d55670b2bcab0' then raise exception 'IDENTITY_V5_LINEAGE_MISMATCH: validate_reviewed_variant_create_rebind_offer_update_plan';end if;
 if (length(v_definition)-length(replace(v_definition,$before$begin
  if not public.atomic_import_has_exact_keys$before$,'')))/length($before$begin
  if not public.atomic_import_has_exact_keys$before$)<>1 then raise exception 'IDENTITY_V5_PATCH_SHAPE';end if;
 v_definition:=replace(v_definition,$before$begin
  if not public.atomic_import_has_exact_keys$before$,$after$begin
  if p_plan#>>'{meta,version}'='5' then return atomic_import_private.validate_identity_rebind(p_plan);end if;
  if not public.atomic_import_has_exact_keys$after$);
 execute v_definition;
end
$upgrade$;
do $upgrade$
declare v_definition text;v_owner text;
begin
 select pg_get_functiondef(p.oid),pg_get_userbyid(p.proowner) into strict v_definition,v_owner from pg_proc p where p.oid='public.apply_reviewed_variant_create_rebind_offer_update_plan(jsonb)'::regprocedure;
 if v_owner<>'postgres' or encode(sha256(convert_to(v_definition,'UTF8')),'hex')<>'241fcc6fb393fe95289b9d9e64e15ba5842586a3ef8a2cfe9b4e4a8404e065d2' then raise exception 'IDENTITY_V5_LINEAGE_MISMATCH: apply_reviewed_variant_create_rebind_offer_update_plan';end if;
 if (length(v_definition)-length(replace(v_definition,$before$  v_variant_count bigint;$before$,'')))/length($before$  v_variant_count bigint;$before$)<>1 then raise exception 'IDENTITY_V5_PATCH_SHAPE';end if;
 v_definition:=replace(v_definition,$before$  v_variant_count bigint;$before$,$after$  v_mapping_before jsonb;v_offer_before jsonb;v_history_before jsonb;v_series_before jsonb;v_variants_before jsonb;v_v5_lock_timeout text;
  v_variant_count bigint;$after$);
 if (length(v_definition)-length(replace(v_definition,$before$begin
  perform pg_advisory_xact_lock$before$,'')))/length($before$begin
  perform pg_advisory_xact_lock$before$)<>1 then raise exception 'IDENTITY_V5_PATCH_SHAPE';end if;
 v_definition:=replace(v_definition,$before$begin
  perform pg_advisory_xact_lock$before$,$after$begin
  if p_plan#>>'{meta,version}'='5' then
    perform pg_advisory_xact_lock(hashtextextended('retailer-offer-sync:global-execution',0));
    -- Acquire predicate guards before rows to avoid a lock-upgrade cycle.
    v_v5_lock_timeout:=current_setting('lock_timeout');
    perform set_config('lock_timeout','5s',true);
    lock table public.products,public.product_variants in share mode;
    lock table public.gtin_promotion_quarantine in share mode;
    lock table public.retailer_products in share row exclusive mode;
    lock table public.price_identity_series,public.price_history in share mode;
    perform set_config('lock_timeout',v_v5_lock_timeout,true);
    perform 1 from public.retailers where id=v_retailer_id for update;
    select to_jsonb(p) into v_parent_before from public.products p where id=v_product_id for update;
    perform 1 from public.product_variants where id in (v_old_variant_id,(p_plan#>>'{product_variant,id}')::bigint) order by id for update;
    perform 1 from public.retailer_products where id=v_mapping_id for update;
    perform 1 from public.offers where id=v_offer_id for update;
    perform atomic_import_private.validate_identity_rebind(p_plan);
    select to_jsonb(r) into v_mapping_before from public.retailer_products r where id=v_mapping_id;
    select to_jsonb(o) into v_offer_before from public.offers o where id=v_offer_id;
    select coalesce(jsonb_agg(to_jsonb(h) order by h.id),'[]'::jsonb) into v_history_before from public.price_history h where h.offer_id=v_offer_id;
    select coalesce(jsonb_agg(to_jsonb(s) order by s.id),'[]'::jsonb) into v_series_before from public.price_identity_series s where s.offer_id=v_offer_id;
    select jsonb_agg(to_jsonb(v) order by v.id) into v_variants_before from public.product_variants v where v.product_id=v_product_id;
    select count(*) into v_mapping_count from public.retailer_products where product_id=v_product_id and retailer_id=v_retailer_id;
    select count(*) into v_offer_count from public.offers where product_id=v_product_id and retailer_id=v_retailer_id;
    update public.retailer_products set product_variant_id=(p_plan#>>'{product_variant,id}')::bigint
      where id=v_mapping_id and product_variant_id=v_old_variant_id;
    get diagnostics v_rows=row_count;if v_rows<>1 then raise exception 'IDENTITY_V5_MAPPING_COUNT';end if;
    update public.offers set product_variant_id=(p_plan#>>'{product_variant,id}')::bigint where id=v_offer_id and product_variant_id=v_old_variant_id;
    get diagnostics v_rows=row_count;if v_rows<>1 then raise exception 'IDENTITY_V5_OFFER_COUNT';end if;
    if (select to_jsonb(r)-'product_variant_id' from public.retailer_products r where id=v_mapping_id) is distinct from (v_mapping_before-'product_variant_id') or
      (select to_jsonb(o)-'product_variant_id' from public.offers o where id=v_offer_id) is distinct from (v_offer_before-'product_variant_id') or
      (select to_jsonb(p) from public.products p where id=v_product_id) is distinct from v_parent_before or
      (select coalesce(jsonb_agg(to_jsonb(h) order by h.id),'[]'::jsonb) from public.price_history h where h.offer_id=v_offer_id) is distinct from v_history_before or
      (select coalesce(jsonb_agg(to_jsonb(s) order by s.id),'[]'::jsonb) from public.price_identity_series s where s.offer_id=v_offer_id) is distinct from v_series_before or
      (select jsonb_agg(to_jsonb(v) order by v.id) from public.product_variants v where v.product_id=v_product_id) is distinct from v_variants_before or
      (select count(*) from public.retailer_products where product_id=v_product_id and retailer_id=v_retailer_id)<>v_mapping_count or
      (select count(*) from public.offers where product_id=v_product_id and retailer_id=v_retailer_id)<>v_offer_count then raise exception 'IDENTITY_V5_POSTCONDITION_MISMATCH';end if;
    return jsonb_build_object('status','APPLIED','product_id',v_product_id,'product_action','existing','product_variant_id',p_plan#>>'{product_variant,id}',
      'product_variant_action','existing','retailer_id',v_retailer_id,'retailer_product_id',v_mapping_id,'retailer_product_action','identity_rebind',
      'offer_id',v_offer_id,'offer_action','identity_rebind','price_history_action','noop','commercial_updates',0,'history_writes',0,'freshness_updates',0,
      'plan_fingerprint',p_plan#>>'{meta,plan_fingerprint}','source_row_fingerprint',p_plan#>>'{meta,source_row_fingerprint}');
  end if;
  perform pg_advisory_xact_lock$after$);
 execute v_definition;
end
$upgrade$;
do $outer$ declare v_definition text;begin
 v_definition:=pg_get_functiondef('public.apply_approved_product_import_plan(uuid,text,text,text,bigint,text,text)'::regprocedure);
 if encode(sha256(convert_to(v_definition,'UTF8')),'hex')<>'64ee52256ff59611c8b84cf89259d98de03fcbb36e9f8a25a2ec0a83dfa83095' then raise exception 'IDENTITY_V5_OUTER_LINEAGE_MISMATCH';end if;
 v_definition:=replace(v_definition,$before$  v_observation:=public.record_identity_proven_price_observation(
    (v_result->>'offer_id')::bigint,v_kind,v_approval.run_id,v_approval.source,
    nullif(v_result->>'price_history_id','')::bigint);$before$,$after$  if v_approval.plan_json#>>'{meta,version}'='5' and v_result->>'offer_action'='identity_rebind' then
    v_observation:=jsonb_build_object('status','IDENTITY_ONLY_NO_OBSERVATION');
  else
  v_observation:=public.record_identity_proven_price_observation(
    (v_result->>'offer_id')::bigint,v_kind,v_approval.run_id,v_approval.source,
    nullif(v_result->>'price_history_id','')::bigint);
  end if;$after$);execute v_definition;end $outer$;
commit;
