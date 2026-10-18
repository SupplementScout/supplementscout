begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $preflight$
begin
  if to_regprocedure('public.atomic_import_reviewed_catalogue_plan_allowed(jsonb)') is null
     or to_regprocedure('public.validate_reviewed_catalogue_import_plan(jsonb)') is null
     or to_regprocedure('public.validate_product_import_plan_read_only(jsonb)') is null
     or to_regprocedure('public.apply_approved_product_import_plan(uuid,text,text,text,bigint,text,text)') is null
     or to_regprocedure('public.retailer_catalogue_actual_database_target()') is null
     or to_regprocedure('public.atomic_import_canonical_json(jsonb)') is null
     or to_regprocedure('public.atomic_import_has_exact_keys(jsonb,text[])') is null
     or to_regprocedure('public.atomic_import_is_decimal_string(text)') is null
     or to_regprocedure('public.atomic_import_normalized_identity(text)') is null then
    raise exception 'reviewed catalogue V3 prerequisites are missing';
  end if;
  if to_regprocedure('public.atomic_import_validate_reviewed_catalogue_before_v3(jsonb)') is not null
     or to_regprocedure('public.validate_reviewed_catalogue_v3_plan_read_only(jsonb,jsonb)') is not null
     or exists(select 1 from information_schema.columns where table_schema='public' and table_name='approved_import_plans' and column_name='authorization_envelope') then
    raise exception 'reviewed catalogue V3 boundary already exists';
  end if;
end
$preflight$;

alter table public.approved_import_plans
  add column authorization_envelope jsonb;
alter table public.approved_import_plans
  add constraint approved_import_plans_v3_envelope_check check (
    (source !~ '^reviewed-catalogue-package-v3:' and authorization_envelope is null)
    or (
      source ~ '^reviewed-catalogue-package-v3:[A-Za-z0-9._-]+:[0-9a-f]{64}:(STAGING|PRODUCTION):[a-z0-9]{20}$'
      and jsonb_typeof(authorization_envelope)='object'
      and authorization_envelope->>'kind'='reviewed-catalogue-authorization-v3'
    )
  );

create function public.atomic_import_reviewed_v3_physical_role_allowed(p_options jsonb,p_role jsonb)
returns boolean
language plpgsql
immutable
security definer
set search_path = pg_catalog, public, pg_temp
as $physical$
declare
  v_candidates integer;
  v_match text[];
  v_amount numeric;
  v_unit text;
begin
  select count(*) into v_candidates from jsonb_each_text(p_options) option
    where lower(btrim(option.key)) in ('weight','size')
      and option.value ~* '^[0-9]+(?:[.,][0-9]+)?\s*(mcg|mg|kg|g|ml|cl|l)$';
  if jsonb_typeof(p_role)='null' then return v_candidates=0; end if;
  if jsonb_typeof(p_role)<>'object' or v_candidates<>1
     or not public.atomic_import_has_exact_keys(p_role,array['source_key','source_value','size_value','size_unit'])
     or lower(btrim(p_role->>'source_key')) not in ('weight','size')
     or p_options->>(p_role->>'source_key') is distinct from p_role->>'source_value' then return false; end if;
  v_match:=regexp_match(btrim(p_role->>'source_value'),'^(\d+(?:[.,]\d+)?)\s*(mcg|mg|kg|g|ml|cl|l)$','i');
  if v_match is null then return false; end if;
  v_amount:=replace(v_match[1],',','.')::numeric; v_unit:=lower(v_match[2]);
  if v_unit='kg' then v_amount:=v_amount*1000; v_unit:='g';
  elsif v_unit='l' then v_amount:=v_amount*1000; v_unit:='ml';
  elsif v_unit='cl' then v_amount:=v_amount*10; v_unit:='ml'; end if;
  return v_amount>0 and v_amount is not distinct from (p_role->>'size_value')::numeric
    and v_unit is not distinct from p_role->>'size_unit';
exception when invalid_text_representation or numeric_value_out_of_range then return false;
end
$physical$;

create function public.atomic_import_reviewed_v3_count_role_allowed(p_options jsonb,p_role jsonb)
returns boolean
language plpgsql
immutable
security definer
set search_path = pg_catalog, public, pg_temp
as $count$
declare
  v_candidates integer;
  v_match text[];
  v_unit text;
begin
  select count(*) into v_candidates from jsonb_each_text(p_options) option
    where lower(btrim(option.key)) in ('size','servings','serving count','count','quantity')
      and option.value ~* '^[1-9][0-9]*(?:\s*/\s*[1-9][0-9]*)?\s*[a-z]+$'
      and lower(regexp_replace(option.value,'^.*?([a-z]+)$','\1','i')) in
        ('serving','servings','capsule','capsules','cap','caps','tablet','tablets','tab','tabs','softgel','softgels','sachet','sachets','shot','shots','piece','pieces','gummy','gummies');
  if jsonb_typeof(p_role)='null' then return v_candidates=0; end if;
  if jsonb_typeof(p_role)<>'object' or v_candidates<>1
     or not public.atomic_import_has_exact_keys(p_role,array['source_key','source_value','count_value','count_unit'])
     or lower(btrim(p_role->>'source_key')) not in ('size','servings','serving count','count','quantity')
     or p_options->>(p_role->>'source_key') is distinct from p_role->>'source_value' then return false; end if;
  v_match:=regexp_match(btrim(p_role->>'source_value'),'^(\d+(?:\s*/\s*\d+)?)\s*([a-z]+)$','i');
  if v_match is null then return false; end if;
  v_unit:=case lower(v_match[2])
    when 'serving' then 'servings' when 'servings' then 'servings'
    when 'capsule' then 'capsules' when 'capsules' then 'capsules' when 'cap' then 'capsules' when 'caps' then 'capsules'
    when 'tablet' then 'tablets' when 'tablets' then 'tablets' when 'tab' then 'tablets' when 'tabs' then 'tablets'
    when 'softgel' then 'softgels' when 'softgels' then 'softgels'
    when 'sachet' then 'sachets' when 'sachets' then 'sachets'
    when 'shot' then 'shots' when 'shots' then 'shots'
    when 'piece' then 'pieces' when 'pieces' then 'pieces'
    when 'gummy' then 'gummies' when 'gummies' then 'gummies' end;
  return replace(v_match[1],' ','') is not distinct from p_role->>'count_value'
    and v_unit is not null and v_unit is not distinct from p_role->>'count_unit';
end
$count$;

create function public.atomic_import_validate_reviewed_catalogue_v3_plan(p_plan jsonb,p_envelope jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $validate$
declare
  v_target jsonb:=public.retailer_catalogue_actual_database_target();
  v_retailer public.retailers%rowtype;
  v_product_action text:=p_plan#>>'{product,action}';
  v_variant_action text:=p_plan#>>'{product_variant,action}';
  v_reviewed_action text:=p_envelope->>'reviewed_action';
  v_mapping jsonb:=p_plan#>'{retailer_product,values}';
  v_offer jsonb:=p_plan#>'{offer,values}';
  v_product_values jsonb:=p_plan#>'{product,values}';
  v_variant_values jsonb:=p_plan#>'{product_variant,values}';
  v_roles jsonb:=p_envelope->'option_roles';
  v_flavour jsonb:=p_envelope#>'{option_roles,flavour}';
  v_physical jsonb:=p_envelope#>'{option_roles,physical_size}';
  v_count jsonb:=p_envelope#>'{option_roles,count}';
  v_structure jsonb:=p_envelope->'source_structure';
  v_external_options jsonb:=p_envelope->'external_options';
  v_product_id bigint;
  v_variant_id bigint;
  v_actual jsonb;
begin
  if not public.atomic_import_has_exact_keys(p_plan,array[
       'meta','product','product_variant','retailer','retailer_product','offer','price_history','approval','expected_state'
     ])
     or jsonb_path_exists(p_plan,'$.** ? (@.type() == "number")')
     or p_plan#>>'{meta,version}'<>'2'
     or p_plan#>>'{meta,plan_kind}'<>'feed'
     or p_plan#>>'{meta,operation_type}'<>'standard_import'
     or p_plan#>>'{meta,source_row_fingerprint}' !~ '^[0-9a-f]{64}$'
     or p_plan#>>'{meta,plan_fingerprint}' !~ '^[0-9a-f]{32}$'
     or md5(public.atomic_import_canonical_json(jsonb_set(p_plan,'{meta,plan_fingerprint}','null'::jsonb,false)))<>p_plan#>>'{meta,plan_fingerprint}' then
    raise exception 'V3_PLAN_SCHEMA_MISMATCH: invalid closed atomic plan';
  end if;

  if not public.atomic_import_has_exact_keys(p_envelope,array[
       'schema_version','kind','source_platform','target_environment','target_project_ref','retailer',
       'profile_id','manifest_sha256','artifact_sha256','run_id','review_row','reviewed_action',
       'external_product_id','external_variant_id','direct_source_url','affiliate_url','external_options',
       'option_roles','source_structure','source_row_fingerprint','plan_fingerprint'
     ])
     or p_envelope->>'schema_version'<>'3'
     or p_envelope->>'kind'<>'reviewed-catalogue-authorization-v3'
     or p_envelope->>'source_platform'<>'shopify'
     or not public.atomic_import_has_exact_keys(p_envelope->'retailer',array['id','name','slug','website'])
     or not public.atomic_import_has_exact_keys(v_roles,array['flavour','physical_size','count'])
     or not public.atomic_import_has_exact_keys(v_structure,array['product_variant_count','meaningful_variant_axes'])
     or p_envelope->>'manifest_sha256' !~ '^[0-9a-f]{64}$'
     or p_envelope->>'artifact_sha256' !~ '^[0-9a-f]{64}$'
     or p_envelope->>'source_row_fingerprint' !~ '^[0-9a-f]{64}$'
     or p_envelope->>'plan_fingerprint' !~ '^[0-9a-f]{32}$'
     or p_envelope->>'profile_id' !~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$'
     or p_envelope->>'run_id' !~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$'
     or p_envelope->>'review_row' !~ '^[1-9][0-9]*$'
     or jsonb_typeof(v_external_options)<>'object'
     or jsonb_typeof(v_structure->'meaningful_variant_axes')<>'array'
     or (v_structure->>'product_variant_count') !~ '^[1-9][0-9]*$' then
    raise exception 'V3_ENVELOPE_SCHEMA_MISMATCH: invalid closed authorization envelope';
  end if;

  if p_envelope->>'target_environment' is distinct from v_target->>'target_environment'
     or p_envelope->>'target_project_ref' is distinct from v_target->>'project_ref' then
    raise exception 'V3_TARGET_MISMATCH: environment or project does not match this database';
  end if;
  if p_envelope->>'source_row_fingerprint' is distinct from p_plan#>>'{meta,source_row_fingerprint}'
     or p_envelope->>'plan_fingerprint' is distinct from p_plan#>>'{meta,plan_fingerprint}'
     or p_envelope#>>'{retailer,id}' is distinct from p_plan#>>'{retailer,id}'
     or p_envelope->>'external_product_id' is distinct from v_mapping->>'external_product_id'
     or p_envelope->>'external_variant_id' is distinct from v_mapping->>'external_variant_id'
     or p_envelope->>'direct_source_url' is distinct from v_mapping->>'external_url'
     or p_envelope->>'affiliate_url' is distinct from v_offer->>'url'
     or v_external_options is distinct from coalesce(v_mapping->'external_options','{}'::jsonb) then
    raise exception 'V3_BINDING_MISMATCH: plan and authorization envelope differ';
  end if;

  if p_envelope->>'external_product_id' !~ '^[0-9]{10,}$'
     or p_envelope->>'external_variant_id' !~ '^[0-9]{10,}$'
     or p_envelope->>'external_product_id'=p_envelope->>'external_variant_id'
     or p_envelope->>'direct_source_url' !~ '^https://'
     or p_envelope->>'affiliate_url' !~ '^https://' then
    raise exception 'V3_SOURCE_IDENTITY_MISMATCH: invalid Shopify source identity';
  end if;

  select * into v_retailer from public.retailers where id=(p_envelope#>>'{retailer,id}')::bigint;
  if not found
     or jsonb_build_object('id',v_retailer.id::text,'name',v_retailer.name,'slug',v_retailer.slug,'website',v_retailer.website)
        is distinct from p_envelope->'retailer'
     or p_plan#>'{expected_state,retailer}' is distinct from p_envelope->'retailer'
     or p_plan#>>'{retailer,action}'<>'existing' then
    raise exception 'V3_RETAILER_MISMATCH: exact existing retailer identity required';
  end if;
  if p_envelope->>'direct_source_url' not like regexp_replace(v_retailer.website,'/$','')||'/products/%'
     or p_envelope->>'direct_source_url' !~ ('[?&]variant='||p_envelope->>'external_variant_id'||'(&|$)') then
    raise exception 'V3_SOURCE_URL_MISMATCH: strict Shopify variant URL required';
  end if;

  if jsonb_typeof(v_flavour) not in ('object','null')
     or jsonb_typeof(v_physical) not in ('object','null')
     or jsonb_typeof(v_count) not in ('object','null') then
    raise exception 'V3_OPTION_ROLE_MISMATCH: option role must be an object or null';
  end if;
  if jsonb_typeof(v_flavour)='object' and (
       not public.atomic_import_has_exact_keys(v_flavour,array['source_key','source_value'])
       or lower(btrim(v_flavour->>'source_key')) not in ('flavour','flavor','flavours','flavors')
       or v_external_options->>(v_flavour->>'source_key') is distinct from v_flavour->>'source_value'
     ) then
    raise exception 'V3_OPTION_ROLE_MISMATCH: flavour role is not exact raw evidence';
  end if;
  if (jsonb_typeof(v_flavour)='object') is distinct from (
       (select count(*) from jsonb_each_text(v_external_options) option
        where lower(btrim(option.key)) in ('flavour','flavor','flavours','flavors'))=1
     ) then
    raise exception 'V3_OPTION_ROLE_MISMATCH: flavour role coverage differs from raw evidence';
  end if;
  if not public.atomic_import_reviewed_v3_physical_role_allowed(v_external_options,v_physical) then
    raise exception 'V3_OPTION_ROLE_MISMATCH: physical size role is not exact raw evidence';
  end if;
  if not public.atomic_import_reviewed_v3_count_role_allowed(v_external_options,v_count) then
    raise exception 'V3_OPTION_ROLE_MISMATCH: count role is not exact raw evidence';
  end if;

  if v_reviewed_action='create_product_with_default_variant' then
    if v_product_action<>'create' or v_variant_action<>'create_default'
       or v_structure->>'product_variant_count'<>'1'
       or jsonb_array_length(v_structure->'meaningful_variant_axes')<>0
       or jsonb_typeof(v_flavour)<>'null' then
      raise exception 'V3_ACTION_MISMATCH: default variant source structure is not exact';
    end if;
  elsif v_reviewed_action='create_product_with_variant' then
    if v_product_action<>'create_or_reuse_reviewed' or v_variant_action<>'create_reviewed_variant'
       or jsonb_typeof(v_flavour)<>'object'
       or not (v_structure->'meaningful_variant_axes' ? 'flavour') then
      raise exception 'V3_ACTION_MISMATCH: reviewed new-family variant action is not exact';
    end if;
  elsif v_reviewed_action='create_variant_on_existing_product' then
    if v_product_action<>'existing' or v_variant_action<>'create_variant'
       or jsonb_typeof(v_flavour)<>'object'
       or not (v_structure->'meaningful_variant_axes' ? 'flavour') then
      raise exception 'V3_ACTION_MISMATCH: reviewed existing-family variant action is not exact';
    end if;
  elsif v_reviewed_action='map_existing_variant' then
    if v_product_action<>'existing' or v_variant_action<>'existing' then
      raise exception 'V3_ACTION_MISMATCH: existing variant action is not exact';
    end if;
  else
    raise exception 'V3_ACTION_MISMATCH: unsupported reviewed action';
  end if;

  if p_plan#>>'{retailer_product,action}'<>'create'
     or p_plan#>>'{offer,action}'<>'create'
     or p_plan#>>'{price_history,action}'<>'create'
     or p_plan#>'{expected_state,retailer_product}'<>'null'::jsonb
     or p_plan#>'{expected_state,offer}'<>'null'::jsonb
     or v_mapping->>'external_url' is null
     or v_offer->>'url' is null
     or not public.atomic_import_is_decimal_string(v_offer->>'price')
     or (v_offer->>'price')::numeric<=0
     or not public.atomic_import_is_decimal_string(v_offer->>'shipping_cost')
     or (v_offer->>'shipping_cost')::numeric<0
     or not public.atomic_import_is_decimal_string(v_offer->>'total_price')
     or (v_offer->>'total_price')::numeric is distinct from (v_offer->>'price')::numeric+(v_offer->>'shipping_cost')::numeric
     or jsonb_typeof(v_offer->'in_stock')<>'boolean' then
    raise exception 'V3_PLAN_SCHEMA_MISMATCH: invalid commercial action or value';
  end if;
  perform (v_offer->>'last_checked_at')::timestamptz;

  if concat_ws(' ',coalesce(v_product_values->>'name',p_plan#>>'{expected_state,product,name}'),v_mapping->>'external_name',v_mapping->>'external_slug',v_mapping->>'external_url')
     ~* '\m(bundle|stack|with\s+free|plus\s+free|free\s+item|bbe|dated|best\s+before|short\s+date|short\s+dated)\M' then
    raise exception 'V3_SOURCE_EXCLUDED: commercial bundle, free or dated identity';
  end if;
  if lower(coalesce(v_product_values->>'name','')||' '||coalesce(v_product_values->>'brand',''))
     ~ '(sarms?|ostarine|mk[- ]?2866|ligandrol|lgd[- ]?4033|testolone|rad[- ]?140|andarine|cardarine|gw[- ]?501516|ibutamoren|mk[- ]?677|yk[- ]?11|acp[- ]?105|s[- ]?23|sr[- ]?9009|bpc[- ]?157|tb[- ]?500|cjc[- ]?1295|ipamorelin|ghrp[- ]?[246]|hexarelin|sermorelin|tesamorelin|melanotan|retatrutide)' then
    raise exception 'V3_PROHIBITED_PRODUCT: SARM or peptide';
  end if;

  if exists(select 1 from public.retailer_products rp where rp.retailer_id=v_retailer.id and (
       rp.external_variant_id=v_mapping->>'external_variant_id'
       or rp.external_url=v_mapping->>'external_url'
       or (nullif(v_mapping->>'external_sku','') is not null and rp.external_sku=v_mapping->>'external_sku')
     )) then
    raise exception 'V3_MAPPING_COLLISION: equivalent retailer mapping exists';
  end if;
  if nullif(v_mapping->>'external_gtin','') is not null and exists(
    select 1 from public.retailer_products rp where rp.external_gtin=v_mapping->>'external_gtin'
      and (rp.retailer_id is distinct from v_retailer.id or rp.external_variant_id is distinct from v_mapping->>'external_variant_id')
  ) then
    raise exception 'V3_GTIN_COLLISION: GTIN belongs to another source identity';
  end if;

  if v_product_action='existing' then
    v_product_id:=(p_plan#>>'{product,id}')::bigint;
    select jsonb_build_object('id',id::text,'name',name,'is_active',is_active,'merged_into_product_id',merged_into_product_id::text,'product_format',product_format)
      into v_actual from public.products where id=v_product_id;
    if v_actual is null or v_actual is distinct from p_plan#>'{expected_state,product}'
       or v_actual->'is_active'<>'true'::jsonb or v_actual->>'merged_into_product_id' is not null then
      raise exception 'V3_EXPECTED_STATE_MISMATCH: existing product changed';
    end if;
  else
    if p_plan#>'{expected_state,product}'<>'null'::jsonb
       or p_plan#>'{expected_state,product_variant}'<>'null'::jsonb
       or nullif(btrim(v_product_values->>'name'),'') is null
       or nullif(btrim(v_product_values->>'slug'),'') is null
       or nullif(btrim(v_product_values->>'brand'),'') is null
       or nullif(btrim(v_product_values->>'category'),'') is null
       or nullif(btrim(v_product_values->>'product_format'),'') is null
       or v_product_values->>'gtin' is not null then
      raise exception 'V3_PLAN_SCHEMA_MISMATCH: invalid canonical product creation';
    end if;
    if exists(select 1 from public.products p where p.is_active=true and p.merged_into_product_id is null and (
       p.slug=v_product_values->>'slug'
       or (p.brand=v_product_values->>'brand' and p.category=v_product_values->>'category'
         and public.atomic_import_normalized_identity(p.name)=public.atomic_import_normalized_identity(v_product_values->>'name'))
    )) then
      raise exception 'V3_CANONICAL_COLLISION: equivalent canonical product exists';
    end if;
  end if;

  if v_variant_action='existing' then
    v_variant_id:=(p_plan#>>'{product_variant,id}')::bigint;
    select jsonb_build_object('id',id::text,'product_id',product_id::text,'variant_key',variant_key,'display_name',display_name,
      'flavour_code',flavour_code,'flavour_label',flavour_label,'size_value',size_value::text,'size_unit',size_unit,
      'pack_count',pack_count::text,'product_format',product_format,'is_default',is_default,'is_active',is_active)
      into v_actual from public.product_variants where id=v_variant_id;
    if v_actual is null or v_actual is distinct from p_plan#>'{expected_state,product_variant}'
       or v_actual->'is_active'<>'true'::jsonb or v_actual->>'product_id' is distinct from v_product_id::text then
      raise exception 'V3_EXPECTED_STATE_MISMATCH: existing variant changed';
    end if;
  elsif v_variant_action in ('create_variant','create_reviewed_variant') then
    if p_plan#>'{expected_state,product_variant}'<>'null'::jsonb
       or nullif(btrim(v_variant_values->>'variant_key'),'') is null
       or nullif(btrim(v_variant_values->>'display_name'),'') is null
       or public.atomic_import_normalized_identity(v_variant_values->>'variant_key')='default'
       or public.atomic_import_normalized_identity(v_variant_values->>'display_name')='default'
       or (v_variant_values->>'pack_count') !~ '^[1-9][0-9]*$'
       or nullif(btrim(v_variant_values->>'product_format'),'') is null then
      raise exception 'V3_PLAN_SCHEMA_MISMATCH: invalid explicit variant creation';
    end if;
    if jsonb_typeof(v_physical)='object' then
      if not public.atomic_import_is_decimal_string(v_variant_values->>'size_value')
         or (v_variant_values->>'size_value')::numeric<=0
         or v_physical->>'size_value' is distinct from v_variant_values->>'size_value'
         or v_physical->>'size_unit' is distinct from v_variant_values->>'size_unit' then
        raise exception 'V3_OPTION_ROLE_MISMATCH: canonical physical size differs from raw source evidence';
      end if;
    elsif jsonb_typeof(v_count)='object' then
      if v_variant_values->'size_value'<>'null'::jsonb or v_variant_values->'size_unit'<>'null'::jsonb
         or coalesce(v_product_values->>'unit_count',p_plan#>>'{product_variant,evidence,unit_count}') is distinct from v_count->>'count_value'
         or coalesce(v_product_values->>'unit_type',p_plan#>>'{product_variant,evidence,unit_type}') is distinct from v_count->>'count_unit' then
        raise exception 'V3_OPTION_ROLE_MISMATCH: canonical count differs from raw source evidence';
      end if;
    else
      raise exception 'V3_OPTION_ROLE_MISMATCH: explicit variant requires physical size or count evidence';
    end if;
    if v_product_action='existing' and exists(select 1 from public.product_variants pv where pv.product_id=v_product_id and pv.is_active=true and (
       pv.variant_key=v_variant_values->>'variant_key'
       or (pv.flavour_code is not distinct from v_variant_values->>'flavour_code'
         and pv.size_value is not distinct from (v_variant_values->>'size_value')::numeric
         and pv.size_unit is not distinct from v_variant_values->>'size_unit'
         and pv.pack_count is not distinct from (v_variant_values->>'pack_count')::integer)
    )) then
      raise exception 'V3_CANONICAL_COLLISION: equivalent canonical variant exists';
    end if;
  else
    if v_product_action<>'create' or p_plan#>'{product_variant,values}'<>'null'::jsonb
       or nullif(btrim(p_plan#>>'{product_variant,evidence,product_format}'),'') is null then
      raise exception 'V3_PLAN_SCHEMA_MISMATCH: invalid default variant creation';
    end if;
    if jsonb_typeof(v_count)='object' and (
      coalesce(v_product_values->>'unit_count',p_plan#>>'{product_variant,evidence,unit_count}') is distinct from v_count->>'count_value'
      or coalesce(v_product_values->>'unit_type',p_plan#>>'{product_variant,evidence,unit_type}') is distinct from v_count->>'count_unit'
    ) then
      raise exception 'V3_OPTION_ROLE_MISMATCH: default variant count differs from raw source evidence';
    end if;
  end if;

  return jsonb_build_object(
    'valid',true,'contract_kind','reviewed-catalogue-package-v3','target_environment',p_envelope->>'target_environment',
    'target_project_ref',p_envelope->>'target_project_ref','retailer_id',v_retailer.id::text,
    'product_action',v_product_action,'product_variant_action',v_variant_action,
    'plan_fingerprint',p_envelope->>'plan_fingerprint','source_row_fingerprint',p_envelope->>'source_row_fingerprint',
    'manifest_sha256',p_envelope->>'manifest_sha256','artifact_sha256',p_envelope->>'artifact_sha256'
  );
end
$validate$;

create function public.validate_reviewed_catalogue_v3_plan_read_only(p_plan jsonb,p_envelope jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $read_only$
declare
  v_target jsonb:=public.retailer_catalogue_actual_database_target();
  v_role text:=current_setting('role',true);
  v_expected_role text;
  v_expected_login text;
begin
  v_expected_role:=case v_target->>'target_environment'
    when 'STAGING' then 'retailer_catalogue_staging_validator'
    when 'PRODUCTION' then 'retailer_catalogue_production_validator' end;
  v_expected_login:=case v_target->>'target_environment'
    when 'STAGING' then 'supplementscout_staging_validator_login'
    when 'PRODUCTION' then 'supplementscout_production_validator_login' end;
  if v_role is distinct from v_expected_role or session_user is distinct from v_expected_login
     or current_setting('transaction_read_only')<>'on'
     or lower(coalesce(current_setting('app.safe_update',true),''))=any(array['1','on','true']) then
    raise exception 'V3_SESSION_BLOCKED: exact read-only validator session required';
  end if;
  return public.atomic_import_validate_reviewed_catalogue_v3_plan(p_plan,p_envelope);
end
$read_only$;

create function public.atomic_import_reviewed_catalogue_v3_plan_allowed(p_plan jsonb)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $allowed$
  select exists(
    select 1 from public.approved_import_plans a
    where a.id::text=nullif(current_setting('app.reviewed_catalogue_v3_approval_id',true),'')
      and a.status='approved' and a.consumed_at is null and a.expires_at>now()
      and a.source ~ '^reviewed-catalogue-package-v3:[A-Za-z0-9._-]+:[0-9a-f]{64}:(STAGING|PRODUCTION):[a-z0-9]{20}$'
      and a.plan_json=p_plan and a.authorization_envelope->>'kind'='reviewed-catalogue-authorization-v3'
      and current_setting('role',true)=case a.authorization_envelope->>'target_environment'
        when 'STAGING' then 'retailer_catalogue_staging_executor'
        when 'PRODUCTION' then 'retailer_catalogue_production_executor' end
      and session_user=case a.authorization_envelope->>'target_environment'
        when 'STAGING' then 'supplementscout_staging_executor_login'
        when 'PRODUCTION' then 'supplementscout_production_executor_login' end
  )
$allowed$;

create or replace function public.atomic_import_reviewed_catalogue_plan_allowed(p_plan jsonb)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $allowed$
  select exists (
    select 1 from public.approved_import_plans a
    where a.status = 'approved'
      and a.consumed_at is null
      and a.expires_at > now()
      and a.source ~ '^reviewed-catalogue-package-v1:[A-Za-z0-9._-]+:[0-9a-f]{64}$'
      and a.plan_json = p_plan
      and a.plan_fingerprint = p_plan#>>'{meta,plan_fingerprint}'
      and a.source_row_fingerprint = p_plan#>>'{meta,source_row_fingerprint}'
      and a.plan_kind = p_plan#>>'{meta,plan_kind}'
      and a.retailer_id = nullif(p_plan#>>'{retailer,id}','')::bigint
      and md5(public.atomic_import_canonical_json(jsonb_set(p_plan,'{meta,plan_fingerprint}','null'::jsonb,false))) = a.plan_fingerprint
  ) or public.atomic_import_reviewed_catalogue_v3_plan_allowed(p_plan)
$allowed$;

alter function public.validate_reviewed_catalogue_import_plan(jsonb)
  rename to atomic_import_validate_reviewed_catalogue_before_v3;

create function public.validate_reviewed_catalogue_import_plan(p_plan jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $wrapper$
declare
  v_envelope jsonb;
begin
  if public.atomic_import_reviewed_catalogue_v3_plan_allowed(p_plan) then
    select authorization_envelope into v_envelope from public.approved_import_plans
      where id::text=current_setting('app.reviewed_catalogue_v3_approval_id',true);
    return public.atomic_import_validate_reviewed_catalogue_v3_plan(p_plan,v_envelope);
  end if;
  return public.atomic_import_validate_reviewed_catalogue_before_v3(p_plan);
end
$wrapper$;

create function public.approve_reviewed_catalogue_v3_plan(
  p_plan jsonb,p_envelope jsonb,p_expires_at timestamptz default (now()+interval '15 minutes'))
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog, public, pg_temp
as $approve$
declare
  v_target jsonb:=public.retailer_catalogue_actual_database_target();
  v_expected_role text;
  v_expected_login text;
  v_source text;
  v_id uuid;
begin
  v_expected_role:=case v_target->>'target_environment'
    when 'STAGING' then 'retailer_catalogue_staging_approver'
    when 'PRODUCTION' then 'retailer_catalogue_production_approver' end;
  v_expected_login:=case v_target->>'target_environment'
    when 'STAGING' then 'supplementscout_staging_approver_login'
    when 'PRODUCTION' then 'supplementscout_production_approver_login' end;
  if current_setting('role',true) is distinct from v_expected_role
     or session_user is distinct from v_expected_login
     or current_setting('transaction_read_only')<>'off'
     or current_setting(case v_target->>'target_environment' when 'STAGING' then 'app.retailer_catalogue_staging_marker' else 'app.retailer_catalogue_production_marker' end,true)<>'1'
     or current_setting('app.retailer_catalogue_allow',true)<>'1'
     or lower(coalesce(current_setting('app.safe_update',true),''))=any(array['1','on','true']) then
    raise exception 'V3_SESSION_BLOCKED: exact approver session required';
  end if;
  if p_expires_at<=now() or p_expires_at>now()+interval '24 hours' then
    raise exception 'V3_APPROVAL_MISMATCH: approval expiry invalid';
  end if;
  perform public.atomic_import_validate_reviewed_catalogue_v3_plan(p_plan,p_envelope);
  if exists(select 1 from public.approved_import_plans where status='approved' and consumed_at is null and expires_at>now()
      and source ~ '^reviewed-catalogue-package-v3:' and plan_fingerprint=p_envelope->>'plan_fingerprint') then
    raise exception 'V3_APPROVAL_MISMATCH: a live approval already exists for this plan';
  end if;
  v_source:='reviewed-catalogue-package-v3:'||p_envelope->>'profile_id'||':'||p_envelope->>'manifest_sha256'||':'||
    p_envelope->>'target_environment'||':'||p_envelope->>'target_project_ref';
  insert into public.approved_import_plans(
    artifact_sha256,run_id,plan_fingerprint,source_row_fingerprint,plan_kind,retailer_id,
    expires_at,source,plan_json,authorization_envelope
  ) values (
    p_envelope->>'artifact_sha256',p_envelope->>'run_id',p_envelope->>'plan_fingerprint',
    p_envelope->>'source_row_fingerprint','feed',(p_envelope#>>'{retailer,id}')::bigint,
    p_expires_at,v_source,p_plan,p_envelope
  ) returning id into v_id;
  return jsonb_build_object(
    'approval_id',v_id,'status','approved','contract_kind','reviewed-catalogue-package-v3',
    'artifact_sha256',p_envelope->>'artifact_sha256','manifest_sha256',p_envelope->>'manifest_sha256',
    'run_id',p_envelope->>'run_id','plan_fingerprint',p_envelope->>'plan_fingerprint',
    'source_row_fingerprint',p_envelope->>'source_row_fingerprint','retailer_id',p_envelope#>>'{retailer,id}',
    'plan_kind','feed','target_environment',p_envelope->>'target_environment',
    'target_project_ref',p_envelope->>'target_project_ref','expires_at',p_expires_at
  );
end
$approve$;

create function public.apply_approved_reviewed_catalogue_v3_plan(p_approval_id uuid,p_plan jsonb,p_envelope jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog, public, pg_temp
as $execute$
declare
  v_target jsonb:=public.retailer_catalogue_actual_database_target();
  v_expected_role text;
  v_expected_login text;
  v_approval public.approved_import_plans%rowtype;
  v_result jsonb;
begin
  v_expected_role:=case v_target->>'target_environment'
    when 'STAGING' then 'retailer_catalogue_staging_executor'
    when 'PRODUCTION' then 'retailer_catalogue_production_executor' end;
  v_expected_login:=case v_target->>'target_environment'
    when 'STAGING' then 'supplementscout_staging_executor_login'
    when 'PRODUCTION' then 'supplementscout_production_executor_login' end;
  if current_setting('role',true) is distinct from v_expected_role
     or session_user is distinct from v_expected_login
     or current_setting('transaction_read_only')<>'off'
     or current_setting(case v_target->>'target_environment' when 'STAGING' then 'app.retailer_catalogue_staging_marker' else 'app.retailer_catalogue_production_marker' end,true)<>'1'
     or current_setting('app.retailer_catalogue_allow',true)<>'1'
     or lower(coalesce(current_setting('app.safe_update',true),''))=any(array['1','on','true']) then
    raise exception 'V3_SESSION_BLOCKED: exact executor session required';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('retailer-offer-sync:global-execution',0));
  select * into v_approval from public.approved_import_plans where id=p_approval_id for update;
  if not found then raise exception 'V3_APPROVAL_MISMATCH: approval not found'; end if;
  if v_approval.source !~ '^reviewed-catalogue-package-v3:'
     or v_approval.plan_json is distinct from p_plan
     or v_approval.authorization_envelope is distinct from p_envelope
     or v_approval.artifact_sha256 is distinct from p_envelope->>'artifact_sha256'
     or v_approval.run_id is distinct from p_envelope->>'run_id'
     or v_approval.plan_fingerprint is distinct from p_envelope->>'plan_fingerprint'
     or v_approval.source_row_fingerprint is distinct from p_envelope->>'source_row_fingerprint'
     or v_approval.retailer_id is distinct from (p_envelope#>>'{retailer,id}')::bigint then
    raise exception 'V3_APPROVAL_MISMATCH: immutable approval binding differs';
  end if;
  if v_approval.status='consumed' and v_approval.consumed_at is not null and v_approval.execution_result is not null then
    return v_approval.execution_result||jsonb_build_object('status','ALREADY_APPLIED','already_applied',true,'consumed_at',v_approval.consumed_at);
  end if;
  if v_approval.status<>'approved' or v_approval.consumed_at is not null then
    raise exception 'V3_APPROVAL_MISMATCH: approval is not live';
  end if;
  if v_approval.expires_at<=now() then raise exception 'V3_APPROVAL_MISMATCH: approval expired'; end if;
  perform public.atomic_import_validate_reviewed_catalogue_v3_plan(p_plan,p_envelope);
  perform set_config('app.reviewed_catalogue_v3_approval_id',v_approval.id::text,true);
  v_result:=public.apply_approved_product_import_plan(
    v_approval.id,v_approval.artifact_sha256,v_approval.plan_fingerprint,v_approval.source_row_fingerprint,
    v_approval.retailer_id,v_approval.plan_kind,v_approval.run_id
  );
  v_result:=v_result||jsonb_build_object(
    'contract_kind','reviewed-catalogue-package-v3','manifest_sha256',p_envelope->>'manifest_sha256',
    'target_environment',p_envelope->>'target_environment','target_project_ref',p_envelope->>'target_project_ref',
    'already_applied',false
  );
  update public.approved_import_plans set execution_result=v_result where id=v_approval.id;
  return v_result;
end
$execute$;

alter function public.atomic_import_validate_reviewed_catalogue_v3_plan(jsonb,jsonb) owner to postgres;
alter function public.atomic_import_reviewed_v3_physical_role_allowed(jsonb,jsonb) owner to postgres;
alter function public.atomic_import_reviewed_v3_count_role_allowed(jsonb,jsonb) owner to postgres;
alter function public.validate_reviewed_catalogue_v3_plan_read_only(jsonb,jsonb) owner to postgres;
alter function public.atomic_import_reviewed_catalogue_v3_plan_allowed(jsonb) owner to postgres;
alter function public.atomic_import_reviewed_catalogue_plan_allowed(jsonb) owner to postgres;
alter function public.atomic_import_validate_reviewed_catalogue_before_v3(jsonb) owner to postgres;
alter function public.validate_reviewed_catalogue_import_plan(jsonb) owner to postgres;
alter function public.approve_reviewed_catalogue_v3_plan(jsonb,jsonb,timestamptz) owner to postgres;
alter function public.apply_approved_reviewed_catalogue_v3_plan(uuid,jsonb,jsonb) owner to postgres;

revoke all on function public.atomic_import_validate_reviewed_catalogue_v3_plan(jsonb,jsonb),
  public.atomic_import_reviewed_v3_physical_role_allowed(jsonb,jsonb),
  public.atomic_import_reviewed_v3_count_role_allowed(jsonb,jsonb),
  public.validate_reviewed_catalogue_v3_plan_read_only(jsonb,jsonb),
  public.atomic_import_reviewed_catalogue_v3_plan_allowed(jsonb),
  public.atomic_import_validate_reviewed_catalogue_before_v3(jsonb),
  public.validate_reviewed_catalogue_import_plan(jsonb),
  public.approve_reviewed_catalogue_v3_plan(jsonb,jsonb,timestamptz),
  public.apply_approved_reviewed_catalogue_v3_plan(uuid,jsonb,jsonb)
  from public,anon,authenticated,service_role,
    retailer_catalogue_staging_validator,retailer_catalogue_staging_approver,retailer_catalogue_staging_executor,
    retailer_catalogue_production_validator,retailer_catalogue_production_approver,retailer_catalogue_production_executor;
grant execute on function public.validate_reviewed_catalogue_v3_plan_read_only(jsonb,jsonb)
  to retailer_catalogue_staging_validator,retailer_catalogue_production_validator;
grant execute on function public.approve_reviewed_catalogue_v3_plan(jsonb,jsonb,timestamptz)
  to retailer_catalogue_staging_approver,retailer_catalogue_production_approver;
grant execute on function public.apply_approved_reviewed_catalogue_v3_plan(uuid,jsonb,jsonb)
  to retailer_catalogue_staging_executor,retailer_catalogue_production_executor;

commit;
