begin;
-- LOCAL PROPOSAL ONLY. Unregistered and unapplied to production/staging.
-- Consumers support explicit new plans; existing producers still default to v2.
-- Reviewed create/rebind already owns v3. Historical helpers/approvals keep bytes.
set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $owner_guard$
begin
  if current_user<>'postgres' then raise exception 'IMPORT_V4_MIGRATION_OWNER_REQUIRED';end if;
  if (select rolsuper or rolbypassrls from pg_roles where rolname=current_user) is distinct from true then
    raise exception 'IMPORT_V4_QUARANTINE_READER_NOT_AUTHORIZED';
  end if;
  if to_regnamespace('atomic_import_private') is not null then
    raise exception 'IMPORT_V4_PRIVATE_NAMESPACE_ALREADY_EXISTS';
  end if;
  if (select relowner from pg_class where oid='public.gtin_promotion_quarantine'::regclass)
       is distinct from (select oid from pg_roles where rolname='postgres') then
    raise exception 'IMPORT_V4_QUARANTINE_OWNER_MISMATCH';
  end if;
end
$owner_guard$;
create schema atomic_import_private authorization postgres;
revoke all on schema atomic_import_private from public,anon,authenticated,service_role;

create function atomic_import_private.utf16_sort_key(p_text text)
returns bytea language sql immutable strict set search_path=pg_catalog
as $utf16$
  select decode(coalesce(string_agg(case when cp<=65535 then lpad(to_hex(cp),4,'0')
    else lpad(to_hex(55296+((cp-65536)/1024)),4,'0') ||
         lpad(to_hex(56320+((cp-65536)%1024)),4,'0') end,'' order by position),''),'hex')
  from (select position,ascii(substr(p_text,position,1)) cp
        from generate_series(1,length(p_text)) position) codepoints
$utf16$;

create function atomic_import_private.canonical_json(p_value jsonb)
returns text language plpgsql immutable strict set search_path=pg_catalog
as $canonical$
declare v_result text;v_number text;
begin
  case jsonb_typeof(p_value)
    when 'object' then
      select '{'||coalesce(string_agg(to_jsonb(e.key)::text||':'||
        atomic_import_private.canonical_json(e.value),','
        order by atomic_import_private.utf16_sort_key(e.key)),'')||'}'
      into v_result from jsonb_each(p_value) e;
    when 'array' then
      select '['||coalesce(string_agg(atomic_import_private.canonical_json(e.value),','
        order by e.ordinality),'')||']'
      into v_result from jsonb_array_elements(p_value) with ordinality e(value,ordinality);
    when 'number' then
      -- Same decimal domain as the existing JS helper; metadata remains numeric.
      v_number:=trim_scale((p_value::text)::numeric)::text;
      if length(ltrim(replace(replace(v_number,'-',''),'.',''),'0'))>38 or
         (position('.' in v_number)>0 and length(split_part(v_number,'.',2))>18) then
        raise exception 'IMPORT_V4_DECIMAL_DOMAIN';
      end if;
      v_result:=v_number;
    else v_result:=p_value::text;
  end case;
  return v_result;
end
$canonical$;

create function atomic_import_private.plan_fingerprint(p_plan jsonb)
returns text language plpgsql immutable strict set search_path=pg_catalog
as $fingerprint$
declare v_version text:=p_plan#>>'{meta,version}';
begin
  if (v_version='4' and p_plan#>>'{meta,operation_type}'='standard_import') or
     (v_version='5' and p_plan#>>'{meta,operation_type}'='reviewed_variant_create_rebind_offer_update') then
    return md5(atomic_import_private.canonical_json(jsonb_set(p_plan,'{meta,plan_fingerprint}','null'::jsonb,false)));
  elsif v_version in ('2','3') then
    return md5(public.atomic_import_canonical_json(jsonb_set(p_plan,'{meta,plan_fingerprint}','null'::jsonb,false)));
  end if;
  raise exception 'IMPORT_CONTRACT_VERSION_UNSUPPORTED';
end
$fingerprint$;

create function atomic_import_private.gtin_aliases(p_value text)
returns text[] language plpgsql immutable set search_path=pg_catalog
as $aliases$
declare v_gtin text:=regexp_replace(coalesce(p_value,''),'[[:space:]-]+','','g');v_base text;
begin
  if v_gtin='' then return array[]::text[];end if;
  if public.gtin_promotion_is_valid_gtin(v_gtin) is distinct from true then
    raise exception 'IMPORT_V4_GTIN_INVALID';
  end if;
  v_base:=ltrim(v_gtin,'0');
  if v_base='' then raise exception 'IMPORT_V4_GTIN_INVALID';end if;
  return array(select distinct lpad(v_base,width,'0') from unnest(array[8,12,13,14]) width
    where width>=length(v_base));
end
$aliases$;

create function atomic_import_private.physical_count_matches(p_label text,p_count text,p_unit text)
returns boolean language plpgsql immutable set search_path=pg_catalog
as $count$
declare v_text text:=replace(coalesce(p_label,''),'-',' ');v_matches text[];v_seen integer:=0;v_unit text;v_ok boolean:=false;
begin
  if v_text~*'\m([0-9]+\s*[x×]|packs?\M)' then return false;end if;
  for v_matches in select regexp_matches(v_text,
    '(^|[[:space:]/])([1-9][0-9]*)[[:space:]]*(tablets?|tabs?|capsules?|caps?|softgels?|sachets?|shots?|pieces?|gummy|gummies)(?=$|[[:space:]/)])','gi') loop
    v_seen:=v_seen+1;
    v_unit:=case lower(v_matches[3]) when 'tab' then 'tablets' when 'tabs' then 'tablets'
      when 'tablet' then 'tablets' when 'cap' then 'capsules' when 'caps' then 'capsules'
      when 'capsule' then 'capsules' when 'softgel' then 'softgels' when 'sachet' then 'sachets'
      when 'shot' then 'shots' when 'piece' then 'pieces' when 'gummy' then 'gummies' else lower(v_matches[3]) end;
    v_ok:=v_matches[2]=p_count and v_unit=p_unit;
  end loop;
  return v_seen=1 and v_ok;
end
$count$;

create function atomic_import_private.assert_quarantine_reader()
returns void language plpgsql stable security invoker set search_path=pg_catalog
as $reader$
begin
  if current_user<>'postgres' or (select rolsuper or rolbypassrls from pg_roles where rolname=current_user) is distinct from true then
    raise exception 'IMPORT_V4_QUARANTINE_READER_NOT_AUTHORIZED';
  end if;
end
$reader$;

create function atomic_import_private.assert_owner_resolution(p_plan jsonb)
returns void language plpgsql stable security definer set search_path=pg_catalog
as $resolution$
declare v_review jsonb:=p_plan#>'{product_variant,evidence,owner_resolutions}';v_alias jsonb;v_binding jsonb;
  v_product public.products%rowtype;v_variant public.product_variants%rowtype;v_literal text;
begin
  if v_review is null then return;end if;
  if public.atomic_import_has_exact_keys(v_review,array['kind','decision','authorized_by','authorized_at',
    'source_row_fingerprint','expected_state_fingerprint','binding','flavour_aliases','parent_membership','decision_evidence_sha256']) is distinct from true or
    v_review->>'kind' is distinct from 'manual-identity-owner-resolution-v1' or
    v_review->>'decision' is distinct from 'OWNER_CONFIRMED_EXACT_IDENTITY_RESOLUTION' or
    coalesce(v_review->>'authorized_by','')!~'^[a-z][a-z0-9._-]{2,63}$' or
    coalesce(v_review->>'authorized_at','')!~'^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$' or
    v_review->>'source_row_fingerprint' is distinct from p_plan#>>'{meta,source_row_fingerprint}' or
    v_review->>'expected_state_fingerprint' is distinct from encode(sha256(convert_to(atomic_import_private.canonical_json(p_plan->'expected_state'),'UTF8')),'hex') or
    v_review->>'decision_evidence_sha256' is distinct from encode(sha256(convert_to(atomic_import_private.canonical_json(
      jsonb_set(v_review,'{decision_evidence_sha256}','null'::jsonb,false)),'UTF8')),'hex') then
    raise exception 'IMPORT_V4_OWNER_RESOLUTION_INVALID';
  end if;
  perform (v_review->>'authorized_at')::timestamptz;
  v_binding:=v_review->'binding';
  select * into strict v_product from public.products where id=(p_plan#>>'{product,id}')::bigint;
  select * into strict v_variant from public.product_variants where id=(p_plan#>>'{product_variant,id}')::bigint;
  if public.atomic_import_has_exact_keys(v_binding,array['seller','brand','product_name','product_version','source_evidence_fingerprint']) is distinct from true or
    exists(select 1 from jsonb_each(v_binding) where jsonb_typeof(value)<>'string' or btrim(value#>>'{}')='') or
    coalesce(v_binding->>'source_evidence_fingerprint','')!~'^[0-9a-f]{64}$' or
    v_binding->>'brand' is distinct from v_product.brand or v_binding->>'product_name' is distinct from v_product.name or
    (v_review->'flavour_aliases'='null'::jsonb and v_review->'parent_membership'='null'::jsonb) then
    raise exception 'IMPORT_V4_OWNER_BINDING_CHANGED';
  end if;
  if v_review->'flavour_aliases'<>'null'::jsonb then
    if public.atomic_import_has_exact_keys(v_review->'flavour_aliases',array[p_plan#>>'{retailer_product,values,external_variant_id}']) is distinct from true then
      raise exception 'IMPORT_V4_FLAVOUR_SCOPE_CHANGED';
    end if;
    v_alias:=v_review->'flavour_aliases'->(p_plan#>>'{retailer_product,values,external_variant_id}');
    if public.atomic_import_has_exact_keys(v_alias,array['source','canonical','resolution']) is distinct from true or
      v_alias->>'resolution' is distinct from 'OWNER_CONFIRMED_EQUIVALENT_PRODUCT_VARIANT' or
      nullif(btrim(v_alias->>'source'),'') is null or
      v_alias->>'canonical' is distinct from v_variant.flavour_label then raise exception 'IMPORT_V4_FLAVOUR_TARGET_CHANGED';end if;
    select value into v_literal from jsonb_each_text(p_plan#>'{product_variant,evidence,external_options}')
      where lower(key) in ('flavour','flavor') limit 1;
    if v_literal is distinct from v_alias->>'source' or exists(
      select 1 from jsonb_each_text(p_plan#>'{product_variant,evidence,external_options}')
      where lower(key) in ('flavour','flavor') and value is distinct from v_alias->>'source') then
      raise exception 'IMPORT_V4_FLAVOUR_SOURCE_CHANGED';
    end if;
  end if;
end
$resolution$;

create function atomic_import_private.assert_parent_membership(p_plan jsonb)
returns void language plpgsql stable security definer set search_path=pg_catalog
as $parent$
declare v_membership jsonb:=p_plan#>'{product_variant,evidence,owner_resolutions,parent_membership}';
  v_actual jsonb;v_incoming jsonb;v_retailer bigint:=(p_plan#>>'{retailer,id}')::bigint;
  v_parent text:=p_plan#>>'{retailer_product,values,external_product_id}';v_values jsonb:=p_plan#>'{retailer_product,values}';
begin
  if p_plan#>>'{retailer_product,action}'<>'create' then
    if v_membership is not null and v_membership<>'null'::jsonb then raise exception 'IMPORT_V4_PARENT_CREATE_REQUIRED';end if;
    return;
  end if;
  if exists(select 1 from public.retailer_products r where r.retailer_id=v_retailer and (
    r.external_variant_id=v_values->>'external_variant_id' or
    (r.external_sku is not null and r.external_sku=v_values->>'external_sku') or
    (r.external_gtin is not null and r.external_gtin=v_values->>'external_gtin') or
    r.product_variant_id=(p_plan#>>'{product_variant,id}')::bigint or
    (r.external_product_id=v_parent and r.external_options=v_values->'external_options' and r.external_options is not null))) then
    raise exception 'IMPORT_V4_PARENT_IDENTITY_COLLISION';
  end if;
  if v_membership is null or v_membership='null'::jsonb then
    if exists(select 1 from public.retailer_products r where r.retailer_id=v_retailer and
      (r.external_product_id=v_parent or r.external_url=v_values->>'external_url') and
      r.product_id<>(p_plan#>>'{product,id}')::bigint) then raise exception 'IMPORT_V4_PARENT_REVIEW_REQUIRED';end if;
    return;
  end if;
  if public.atomic_import_has_exact_keys(v_membership,array['complete_scope','incoming','expected_peers','peer_set_fingerprint']) is distinct from true or
     v_membership->'complete_scope' is distinct from 'true'::jsonb or
     jsonb_typeof(v_membership->'expected_peers') is distinct from 'array' or
     jsonb_array_length(v_membership->'expected_peers')=0 then raise exception 'IMPORT_V4_PARENT_SCOPE_INVALID';end if;
  v_incoming:=jsonb_build_object('retailer_id',v_retailer::text,'product_id',p_plan#>>'{product,id}',
    'product_variant_id',p_plan#>>'{product_variant,id}','canonical_variant',null,'legacy',false,
    'external_product_id',v_parent,'external_variant_id',v_values->>'external_variant_id','external_sku',v_values->>'external_sku',
    'external_gtin',v_values->>'external_gtin','external_options',v_values->'external_options','external_url',v_values->>'external_url');
  select coalesce(jsonb_agg(jsonb_build_object('mapping_id',r.id::text,
    'updated_at',to_char(r.updated_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS')||
      case when to_char(r.updated_at,'US')='000000' then '' else '.'||rtrim(to_char(r.updated_at,'US'),'0') end||'Z',
    'retailer_id',r.retailer_id::text,'product_id',r.product_id::text,'product_variant_id',r.product_variant_id::text,
    'canonical_variant',null,'legacy',r.external_variant_id is null,'external_product_id',r.external_product_id,
    'external_variant_id',r.external_variant_id,'external_sku',r.external_sku,'external_gtin',r.external_gtin,
    'external_options',r.external_options,'external_url',r.external_url) order by atomic_import_private.utf16_sort_key(r.id::text)),'[]'::jsonb)
    into v_actual from public.retailer_products r where r.retailer_id=v_retailer and r.external_product_id=v_parent;
  if v_membership->'incoming' is distinct from v_incoming or v_membership->'expected_peers' is distinct from v_actual or
    v_membership->>'peer_set_fingerprint' is distinct from encode(sha256(convert_to(atomic_import_private.canonical_json(v_actual),'UTF8')),'hex') or
    exists(select 1 from public.retailer_products r where r.retailer_id=v_retailer and
      ((r.external_url=v_values->>'external_url' and r.external_product_id is distinct from v_parent) or
       (r.external_product_id=v_parent and (r.external_variant_id is null or nullif(btrim(r.external_url),'') is null)))) then
    raise exception 'IMPORT_V4_PARENT_PEERS_CHANGED';
  end if;
end
$parent$;

create function atomic_import_private.assert_standard_plan(p_plan jsonb)
returns void language plpgsql stable security definer set search_path=pg_catalog
as $check$
declare v_product public.products%rowtype;v_variant public.product_variants%rowtype;
  v_evidence jsonb:=p_plan#>'{product_variant,evidence}';v_gtins jsonb;
  v_codes text[]:=array[]::text[];v_code text;
begin
  perform atomic_import_private.assert_quarantine_reader();
  if p_plan#>>'{meta,version}' is distinct from '4' or
     p_plan#>>'{meta,operation_type}' is distinct from 'standard_import' or
     p_plan#>>'{product,action}' is distinct from 'existing' or
     p_plan#>>'{product_variant,action}' is distinct from 'existing' or
     p_plan#>>'{retailer,action}' is distinct from 'existing' then
    raise exception 'IMPORT_V4_EXISTING_TARGET_REQUIRED';
  end if;
  select * into strict v_product from public.products where id=(p_plan#>>'{product,id}')::bigint;
  select * into strict v_variant from public.product_variants where id=(p_plan#>>'{product_variant,id}')::bigint;
  if v_variant.product_id is distinct from v_product.id then raise exception 'IMPORT_V4_TARGET_MISMATCH';end if;
  if coalesce(v_evidence->>'source_captured_at','')!~'^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$' then raise exception 'IMPORT_V4_SOURCE_CAPTURE_REQUIRED';end if;
  perform (v_evidence->>'source_captured_at')::timestamptz;
  if p_plan#>>'{offer,action}'<>'noop' and p_plan#>>'{offer,values,last_checked_at}' is distinct from v_evidence->>'source_captured_at' then
    raise exception 'IMPORT_V4_SOURCE_CAPTURE_CHANGED';
  end if;
  v_gtins:=v_evidence->'canonical_gtins';
  if public.atomic_import_has_exact_keys(v_gtins,array['product','variant']) is distinct from true or
     (v_gtins->>'product') is distinct from v_product.gtin or
     (v_gtins->>'variant') is distinct from v_variant.gtin then
    raise exception 'IMPORT_V4_CANONICAL_GTIN_STATE_CHANGED';
  end if;
  perform atomic_import_private.assert_owner_resolution(p_plan);
  perform atomic_import_private.assert_parent_membership(p_plan);
  if v_evidence ? 'unit_count' or (coalesce(v_variant.display_name,'')||' '||coalesce(v_variant.variant_key,''))~*'[0-9]+[ -]*(tablets?|tabs?|capsules?|caps?|softgels?|sachets?|shots?|pieces?|gummy|gummies)\M' then
    if not ((v_evidence->>'unit_count')~'^[1-9][0-9]*$' and
       (v_evidence->>'unit_type') in ('tablets','capsules','softgels','sachets','shots','pieces','gummies') and
       (atomic_import_private.physical_count_matches(v_variant.display_name,v_evidence->>'unit_count',v_evidence->>'unit_type') or
        atomic_import_private.physical_count_matches(v_variant.variant_key,v_evidence->>'unit_count',v_evidence->>'unit_type'))) is true then
      raise exception 'IMPORT_V4_PHYSICAL_COUNT_MISMATCH';
    end if;
  end if;
  foreach v_code in array array[v_product.gtin,v_variant.gtin,
    p_plan#>>'{retailer_product,values,external_gtin}',p_plan#>>'{expected_state,retailer_product,external_gtin}'] loop
    v_codes:=v_codes||atomic_import_private.gtin_aliases(v_code);
  end loop;
  -- These are exact indexed lookups, including equivalent leading-zero forms.
  if exists(select 1 from public.gtin_promotion_quarantine q where q.gtin=any(v_codes)) then
    raise exception 'IMPORT_V4_GTIN_QUARANTINED';
  end if;
  if exists(select 1 from public.products p where p.gtin is not null and btrim(p.gtin)<>'' and p.gtin=any(v_codes) and p.id<>v_product.id) or
     exists(select 1 from public.product_variants v where v.gtin is not null and btrim(v.gtin)<>'' and v.gtin=any(v_codes) and v.id<>v_variant.id) or
     exists(select 1 from public.retailer_products r where r.external_gtin=any(v_codes)
       and (r.product_id is distinct from v_product.id or r.product_variant_id is distinct from v_variant.id)) then
    raise exception 'IMPORT_V4_FOREIGN_GTIN_CLAIM';
  end if;
end
$check$;

-- Private helpers have no direct API capability. Existing protected entry points
-- keep their ACLs, security definer owner, source binding and approval ledger.
revoke all on all functions in schema atomic_import_private from public,anon,authenticated,service_role;

-- Guarded consumer changes: fail on unexpected lineage, owner or patch shape.
do $upgrade_atomic_import_validate_standard_plan_core$
declare v_definition text;v_owner text;
begin
  select pg_get_functiondef(p.oid),pg_get_userbyid(p.proowner) into strict v_definition,v_owner
  from pg_proc p where p.oid='public.atomic_import_validate_standard_plan_core(jsonb)'::regprocedure;
  if v_owner<>'postgres' or encode(sha256(convert_to(v_definition,'UTF8')),'hex')<>'4454641348265eb6b39fc84916ad95ad23f4ea4ddb307c2643862c57e1ea115c' then
    raise exception 'IMPORT_V4_CONSUMER_LINEAGE_MISMATCH: atomic_import_validate_standard_plan_core';
  end if;
  if (length(v_definition)-length(replace(v_definition,$before$p_plan#>>'{meta,version}' <> '2'$before$,'')))/length($before$p_plan#>>'{meta,version}' <> '2'$before$)<>1 then
    raise exception 'IMPORT_V4_CONSUMER_PATCH_SHAPE: atomic_import_validate_standard_plan_core';
  end if;
  v_definition:=replace(v_definition,$before$p_plan#>>'{meta,version}' <> '2'$before$,$after$(p_plan#>>'{meta,version}' not in ('2','4') or (p_plan#>>'{meta,version}'='4' and p_plan#>>'{meta,operation_type}'<>'standard_import'))$after$);
  if (length(v_definition)-length(replace(v_definition,$before$md5(public.atomic_import_canonical_json(
      jsonb_set(p_plan, '{meta,plan_fingerprint}', 'null'::jsonb, false)
    ))$before$,'')))/length($before$md5(public.atomic_import_canonical_json(
      jsonb_set(p_plan, '{meta,plan_fingerprint}', 'null'::jsonb, false)
    ))$before$)<>1 then
    raise exception 'IMPORT_V4_CONSUMER_PATCH_SHAPE: atomic_import_validate_standard_plan_core';
  end if;
  v_definition:=replace(v_definition,$before$md5(public.atomic_import_canonical_json(
      jsonb_set(p_plan, '{meta,plan_fingerprint}', 'null'::jsonb, false)
    ))$before$,$after$atomic_import_private.plan_fingerprint(p_plan)$after$);
  if (length(v_definition)-length(replace(v_definition,$before$  v_product_action := p_plan#>>'{product,action}';$before$,'')))/length($before$  v_product_action := p_plan#>>'{product,action}';$before$)<>1 then
    raise exception 'IMPORT_V4_CONSUMER_PATCH_SHAPE: atomic_import_validate_standard_plan_core';
  end if;
  v_definition:=replace(v_definition,$before$  v_product_action := p_plan#>>'{product,action}';$before$,$after$  if p_plan#>>'{meta,version}'='4' then perform atomic_import_private.assert_standard_plan(p_plan);end if;

  v_product_action := p_plan#>>'{product,action}';$after$);
  if (length(v_definition)-length(replace(v_definition,$before$(p_plan#>'{product_variant,evidence}') - array['unit_count','unit_type']$before$,'')))/length($before$(p_plan#>'{product_variant,evidence}') - array['unit_count','unit_type']$before$)<>2 then
    raise exception 'IMPORT_V4_CONSUMER_PATCH_SHAPE: atomic_import_validate_standard_plan_core';
  end if;
  v_definition:=replace(v_definition,$before$(p_plan#>'{product_variant,evidence}') - array['unit_count','unit_type']$before$,$after$(p_plan#>'{product_variant,evidence}') - array['unit_count','unit_type'] - case when p_plan#>>'{meta,version}'='4' then array['canonical_gtins','owner_resolutions','source_captured_at'] else array[]::text[] end$after$);
  if (length(v_definition)-length(replace(v_definition,$before$    if v_option_flavour is not null and not v_variant.is_default and v_option_flavour not in$before$,'')))/length($before$    if v_option_flavour is not null and not v_variant.is_default and v_option_flavour not in$before$)<>1 then
    raise exception 'IMPORT_V4_CONSUMER_PATCH_SHAPE: atomic_import_validate_standard_plan_core';
  end if;
  v_definition:=replace(v_definition,$before$    if v_option_flavour is not null and not v_variant.is_default and v_option_flavour not in$before$,$after$    if p_plan#>>'{meta,version}'='4' then v_option_flavour:=nullif(btrim(v_option_flavour),'');end if;
    if p_plan#>>'{meta,version}'='4' and p_plan#>'{product_variant,evidence,owner_resolutions,flavour_aliases}'<>'null'::jsonb then
      v_option_flavour:=lower(p_plan#>'{product_variant,evidence,owner_resolutions,flavour_aliases}'->(p_plan#>>'{retailer_product,values,external_variant_id}')->>'canonical');
    end if;
    if v_option_flavour is not null and not v_variant.is_default and v_option_flavour not in$after$);
  execute v_definition;
end
$upgrade_atomic_import_validate_standard_plan_core$;

do $upgrade_atomic_import_apply_standard_plan_core$
declare v_definition text;v_owner text;
begin
  select pg_get_functiondef(p.oid),pg_get_userbyid(p.proowner) into strict v_definition,v_owner
  from pg_proc p where p.oid='public.atomic_import_apply_standard_plan_core(jsonb)'::regprocedure;
  if v_owner<>'postgres' or encode(sha256(convert_to(v_definition,'UTF8')),'hex')<>'9367d8cd30f742a163b2f4b4a8f48488b432862bb5c8b04d61755884ea72fe0c' then
    raise exception 'IMPORT_V4_CONSUMER_LINEAGE_MISMATCH: atomic_import_apply_standard_plan_core';
  end if;
  if (length(v_definition)-length(replace(v_definition,$before$  v_legacy_mapping_upgrade_allowed boolean := false;$before$,'')))/length($before$  v_legacy_mapping_upgrade_allowed boolean := false;$before$)<>1 then
    raise exception 'IMPORT_V4_CONSUMER_PATCH_SHAPE: atomic_import_apply_standard_plan_core';
  end if;
  v_definition:=replace(v_definition,$before$  v_legacy_mapping_upgrade_allowed boolean := false;$before$,$after$  v_legacy_mapping_upgrade_allowed boolean := false;
  v_v4_lock_timeout text;$after$);
  if (length(v_definition)-length(replace(v_definition,$before$(p_plan#>>'{meta,version}')::integer <> 2$before$,'')))/length($before$(p_plan#>>'{meta,version}')::integer <> 2$before$)<>1 then
    raise exception 'IMPORT_V4_CONSUMER_PATCH_SHAPE: atomic_import_apply_standard_plan_core';
  end if;
  v_definition:=replace(v_definition,$before$(p_plan#>>'{meta,version}')::integer <> 2$before$,$after$p_plan#>>'{meta,version}' not in ('2','4')$after$);
  if (length(v_definition)-length(replace(v_definition,$before$md5(public.atomic_import_canonical_json(
    jsonb_set(p_plan, '{meta,plan_fingerprint}', 'null'::jsonb, false)
  ))$before$,'')))/length($before$md5(public.atomic_import_canonical_json(
    jsonb_set(p_plan, '{meta,plan_fingerprint}', 'null'::jsonb, false)
  ))$before$)<>1 then
    raise exception 'IMPORT_V4_CONSUMER_PATCH_SHAPE: atomic_import_apply_standard_plan_core';
  end if;
  v_definition:=replace(v_definition,$before$md5(public.atomic_import_canonical_json(
    jsonb_set(p_plan, '{meta,plan_fingerprint}', 'null'::jsonb, false)
  ))$before$,$after$atomic_import_private.plan_fingerprint(p_plan)$after$);
  if (length(v_definition)-length(replace(v_definition,$before$begin
  perform public.validate_product_import_plan_read_only(p_plan);$before$,'')))/length($before$begin
  perform public.validate_product_import_plan_read_only(p_plan);$before$)<>1 then
    raise exception 'IMPORT_V4_CONSUMER_PATCH_SHAPE: atomic_import_apply_standard_plan_core';
  end if;
  v_definition:=replace(v_definition,$before$begin
  perform public.validate_product_import_plan_read_only(p_plan);$before$,$after$begin
  perform public.validate_product_import_plan_read_only(p_plan);
  -- Acquire predicate guards before rows to avoid a lock-upgrade cycle.
  if p_plan#>>'{meta,version}'='4' then
    v_v4_lock_timeout:=current_setting('lock_timeout');
    perform set_config('lock_timeout','5s',true);
    lock table public.products,public.product_variants in share mode;
    lock table public.gtin_promotion_quarantine in share mode;
    lock table public.retailer_products in share row exclusive mode;
    perform set_config('lock_timeout',v_v4_lock_timeout,true);
  end if;$after$);
  if (length(v_definition)-length(replace(v_definition,$before$    v_reviewed_v3_legacy_evidence := p_plan#>'{product_variant,evidence}';$before$,'')))/length($before$    v_reviewed_v3_legacy_evidence := p_plan#>'{product_variant,evidence}';$before$)<>1 then
    raise exception 'IMPORT_V4_CONSUMER_PATCH_SHAPE: atomic_import_apply_standard_plan_core';
  end if;
  v_definition:=replace(v_definition,$before$    v_reviewed_v3_legacy_evidence := p_plan#>'{product_variant,evidence}';$before$,$after$    v_reviewed_v3_legacy_evidence := p_plan#>'{product_variant,evidence}';
    if p_plan#>>'{meta,version}'='4' then
      v_reviewed_v3_legacy_evidence:=v_reviewed_v3_legacy_evidence-array['canonical_gtins','owner_resolutions','source_captured_at','unit_count','unit_type'];
    end if;$after$);
  if (length(v_definition)-length(replace(v_definition,$before$  if v_option_flavour is not null and not v_variant.is_default
$before$,'')))/length($before$  if v_option_flavour is not null and not v_variant.is_default
$before$)<>1 then
    raise exception 'IMPORT_V4_CONSUMER_PATCH_SHAPE: atomic_import_apply_standard_plan_core';
  end if;
  v_definition:=replace(v_definition,$before$  if v_option_flavour is not null and not v_variant.is_default
$before$,$after$  if p_plan#>>'{meta,version}'='4' then v_option_flavour:=nullif(btrim(v_option_flavour),'');end if;
  if p_plan#>>'{meta,version}'='4' and p_plan#>'{product_variant,evidence,owner_resolutions,flavour_aliases}'<>'null'::jsonb then
    v_option_flavour:=lower(p_plan#>'{product_variant,evidence,owner_resolutions,flavour_aliases}'->(p_plan#>>'{retailer_product,values,external_variant_id}')->>'canonical');
  end if;
  if v_option_flavour is not null and not v_variant.is_default
$after$);
  if (length(v_definition)-length(replace(v_definition,$before$  if v_option_size is not null
$before$,'')))/length($before$  if v_option_size is not null
$before$)<>1 then
    raise exception 'IMPORT_V4_CONSUMER_PATCH_SHAPE: atomic_import_apply_standard_plan_core';
  end if;
  v_definition:=replace(v_definition,$before$  if v_option_size is not null
$before$,$after$  if p_plan#>>'{meta,version}'='4' and p_plan#>>'{product_variant,evidence,unit_count}' is not null and v_option_size is not null then
    if atomic_import_private.physical_count_matches(v_option_size,p_plan#>>'{product_variant,evidence,unit_count}',p_plan#>>'{product_variant,evidence,unit_type}') is distinct from true then
      raise exception 'IMPORT_V4_SOURCE_COUNT_MISMATCH';
    end if;
    v_option_size:=null; -- comparison view only; the sealed source options stay literal.
  end if;
  if v_option_size is not null
$after$);
  if (length(v_definition)-length(replace(v_definition,$before$  if v_mapping_action = 'create' then
    if exists ($before$,'')))/length($before$  if v_mapping_action = 'create' then
    if exists ($before$)<>1 then
    raise exception 'IMPORT_V4_CONSUMER_PATCH_SHAPE: atomic_import_apply_standard_plan_core';
  end if;
  v_definition:=replace(v_definition,$before$  if v_mapping_action = 'create' then
    if exists ($before$,$after$  -- Recheck while the table predicate guards and original row locks are held.
  if p_plan#>>'{meta,version}'='4' then
    perform atomic_import_private.assert_standard_plan(p_plan);
  end if;

  if v_mapping_action = 'create' then
    if exists ($after$);
  execute v_definition;
end
$upgrade_atomic_import_apply_standard_plan_core$;

do $upgrade_apply_approved_product_import_plan$
declare v_definition text;v_owner text;
begin
  select pg_get_functiondef(p.oid),pg_get_userbyid(p.proowner) into strict v_definition,v_owner
  from pg_proc p where p.oid='public.apply_approved_product_import_plan(uuid,text,text,text,bigint,text,text)'::regprocedure;
  if v_owner<>'postgres' or encode(sha256(convert_to(v_definition,'UTF8')),'hex')<>'8c7171d64af45518444f2942fa4110e2a9e6a6bc0cbb9d7474ae7d25557549ab' then
    raise exception 'IMPORT_V4_CONSUMER_LINEAGE_MISMATCH: apply_approved_product_import_plan';
  end if;
  if (length(v_definition)-length(replace(v_definition,$before$md5(public.atomic_import_canonical_json(jsonb_set(v_approval.plan_json,'{meta,plan_fingerprint}','null'::jsonb,false)))$before$,'')))/length($before$md5(public.atomic_import_canonical_json(jsonb_set(v_approval.plan_json,'{meta,plan_fingerprint}','null'::jsonb,false)))$before$)<>1 then
    raise exception 'IMPORT_V4_CONSUMER_PATCH_SHAPE: apply_approved_product_import_plan';
  end if;
  v_definition:=replace(v_definition,$before$md5(public.atomic_import_canonical_json(jsonb_set(v_approval.plan_json,'{meta,plan_fingerprint}','null'::jsonb,false)))$before$,$after$atomic_import_private.plan_fingerprint(v_approval.plan_json)$after$);
  execute v_definition;
end
$upgrade_apply_approved_product_import_plan$;

-- New manual approvals cross the new contract boundary. Existing ledger rows
-- and the existing feed contract retain their original consumers.
do $upgrade_approve_product_import_plan$
declare v_definition text;v_owner text;v_before constant text:='  perform public.validate_product_import_plan_read_only(p_plan);';
begin
  select pg_get_functiondef(p.oid),pg_get_userbyid(p.proowner) into strict v_definition,v_owner
  from pg_proc p where p.oid='public.approve_product_import_plan(jsonb,text,text,text,timestamp with time zone)'::regprocedure;
  if v_owner<>'postgres' or encode(sha256(convert_to(v_definition,'UTF8')),'hex')<>'3c6a252b1eefa8e75fd8751d0f0a969b9849d7eb7801603ec246376c5892400d' then
    raise exception 'IMPORT_V4_CONSUMER_LINEAGE_MISMATCH: approve_product_import_plan';
  end if;
  if (length(v_definition)-length(replace(v_definition,v_before,'')))/length(v_before)<>1 then
    raise exception 'IMPORT_V4_CONSUMER_PATCH_SHAPE: approve_product_import_plan';
  end if;
  v_definition:=replace(v_definition,v_before,$after$  if p_plan#>>'{meta,plan_kind}'='manual' and
     p_plan#>>'{meta,operation_type}'='standard_import' and
     p_plan#>>'{meta,version}' is distinct from '4' then
    raise exception 'IMPORT_V4_REQUIRED_FOR_NEW_MANUAL_APPROVAL';
  end if;
  perform public.validate_product_import_plan_read_only(p_plan);$after$);
  execute v_definition;
end
$upgrade_approve_product_import_plan$;

commit;
