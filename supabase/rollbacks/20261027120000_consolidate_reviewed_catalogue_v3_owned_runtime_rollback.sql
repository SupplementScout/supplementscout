begin;

set local lock_timeout='5s';
set local statement_timeout='120s';

select pg_advisory_xact_lock(hashtextextended('reviewed-catalogue-v3-schema',0));

create temporary table reviewed_v3_1_runtime_before on commit drop as
select p.oid::regprocedure::text signature,
       encode(pg_catalog.sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex') sha256,
       p.proowner::regrole::text owner,
       p.provolatile volatility,
       p.prosecdef security_definer,
       p.proconfig search_path,
       p.proacl acl
from pg_proc p
where p.oid=any(array[
  'public.atomic_import_reviewed_v3_physical_role_allowed(jsonb,jsonb)'::regprocedure,
  'public.atomic_import_reviewed_v3_count_role_allowed(jsonb,jsonb)'::regprocedure,
  'public.atomic_import_reviewed_v3_legacy_validation_projection(jsonb,jsonb)'::regprocedure,
  'public.atomic_import_reviewed_v3_legacy_validation_evidence(jsonb,jsonb)'::regprocedure,
  'public.atomic_import_reviewed_v3_canonical_role_allowed(jsonb,jsonb,text)'::regprocedure,
  'public.atomic_import_validate_reviewed_catalogue_v3_plan(jsonb,jsonb)'::regprocedure
]);

do $preflight$
declare
  v_target jsonb:=public.retailer_catalogue_actual_database_target();
  v_standard_sha text;
  v_pre_source_sha text;
  v_counts jsonb;
begin
  if current_user<>'postgres'
     or v_target->>'target_environment' not in ('STAGING','PRODUCTION')
     or (v_target->>'target_environment'='STAGING' and (
       v_target->>'project_ref'<>'hxnrsyyqffztlvcrtgbf'
       or v_target->>'database_identity'<>'supplementscout-staging:hxnrsyyqffztlvcrtgbf'
     ))
     or (v_target->>'target_environment'='PRODUCTION' and (
       v_target->>'project_ref'<>'aftboxmrdgyhizicfsfu'
       or v_target->>'database_identity'<>'supplementscout-production:aftboxmrdgyhizicfsfu'
     )) then
    raise exception 'reviewed V3.1 consolidation rollback target differs';
  end if;

  if not exists(
    select 1 from supabase_migrations.schema_migrations
    where version='20261027120000'
      and name='consolidate_reviewed_catalogue_v3_owned_runtime'
  ) then
    raise exception 'reviewed V3.1 consolidation rollback ledger entry missing';
  end if;

  if exists(
    select 1 from public.approved_import_plans
    where source~'^reviewed-catalogue-package-v3:'
      and status='approved' and consumed_at is null and expires_at>now()
  ) then
    raise exception 'reviewed V3.1 consolidation rollback blocked by live approval';
  end if;

  if (select count(*) from pg_temp.reviewed_v3_1_runtime_before)<>6
     or exists(
       select 1
       from (values
    ('atomic_import_reviewed_v3_physical_role_allowed(jsonb,jsonb)','154d86c8abd1a0dc5aaa0bc71704be17c590af578dfffbea2adff82847068a49','postgres','i',true,array['search_path=pg_catalog, public, pg_temp']::text[],'{postgres=X/postgres}'::aclitem[]),
    ('atomic_import_reviewed_v3_count_role_allowed(jsonb,jsonb)','90afc70b4adfa0d2836d501d240e1e98c72fec0d8ce0df99227de86b7f548f5a','postgres','i',true,array['search_path=pg_catalog, public, pg_temp']::text[],'{postgres=X/postgres}'::aclitem[]),
    ('atomic_import_reviewed_v3_legacy_validation_projection(jsonb,jsonb)','8bc6eb2fd25499182cfbd70f29f9316056f36f8d403232a5fa6ee35df786a80c','postgres','s',true,array['search_path=pg_catalog, public, pg_temp']::text[],'{postgres=X/postgres}'::aclitem[]),
    ('atomic_import_reviewed_v3_legacy_validation_evidence(jsonb,jsonb)','a5b8a05c0dc9cba672cbb4607c8d63660744165f88d2807e26d299159277b0f8','postgres','s',true,array['search_path=pg_catalog, public, pg_temp']::text[],'{postgres=X/postgres}'::aclitem[]),
    ('atomic_import_reviewed_v3_canonical_role_allowed(jsonb,jsonb,text)','cc6c8017e87a3f02129dbd855960d8078348eb8271713a274e26ef5dcdf15f46','postgres','s',true,array['search_path=pg_catalog, public, pg_temp']::text[],'{postgres=X/postgres}'::aclitem[]),
    ('atomic_import_validate_reviewed_catalogue_v3_plan(jsonb,jsonb)','033cd54202f3ed2946eb78ba37a311c5a56a4f6eb421c0424b3239ad75c19baf','postgres','s',true,array['search_path=pg_catalog, public, pg_temp']::text[],'{postgres=X/postgres}'::aclitem[])
       ) expected(signature,sha256,owner,volatility,security_definer,search_path,acl)
       left join pg_temp.reviewed_v3_1_runtime_before actual using(signature)
       where actual.signature is null
          or actual.sha256 is distinct from expected.sha256
          or actual.owner is distinct from expected.owner
          or actual.volatility is distinct from expected.volatility
          or actual.security_definer is distinct from expected.security_definer
          or actual.search_path is distinct from expected.search_path
          or actual.acl is distinct from expected.acl
     ) then
    raise exception 'reviewed V3.1 consolidation rollback six-function lineage or security metadata differs';
  end if;

  select encode(pg_catalog.sha256(convert_to(pg_get_functiondef(
           'public.atomic_import_apply_standard_plan_core(jsonb)'::regprocedure
         ),'UTF8')),'hex'),
         encode(pg_catalog.sha256(convert_to(pg_get_functiondef(
           'public.atomic_import_validate_pre_source_metadata_plan_core(jsonb)'::regprocedure
         ),'UTF8')),'hex')
    into v_standard_sha,v_pre_source_sha;
  if (v_target->>'target_environment'='STAGING' and (
       v_standard_sha<>'0fb47d632b21b4323a16fd4e9a3ec9886b747a21014e247e8d73f7999a586209'
       or v_pre_source_sha<>'c82e291550787e553fc906a669c348f0b7d6cd034bfb8bd326d7a9c646e7511a'
     )) or (v_target->>'target_environment'='PRODUCTION' and (
       v_standard_sha<>'9367d8cd30f742a163b2f4b4a8f48488b432862bb5c8b04d61755884ea72fe0c'
       or v_pre_source_sha<>'c8370ee49d873f9cf8f6f375653848248b2cbe19f0e0b869f392e45405ae5daf'
     )) then
    raise exception 'reviewed V3.1 consolidation rollback shared dependency lineage differs';
  end if;

  select jsonb_build_object(
    'retailers',(select count(*) from public.retailers),
    'products',(select count(*) from public.products),
    'product_variants',(select count(*) from public.product_variants),
    'retailer_products',(select count(*) from public.retailer_products),
    'offers',(select count(*) from public.offers),
    'price_history',(select count(*) from public.price_history),
    'approved_import_plans',(select count(*) from public.approved_import_plans)
  ) into v_counts;
  perform set_config('app.reviewed_v3_1_consolidation_counts',v_counts::text,true);
end
$preflight$;

CREATE OR REPLACE FUNCTION public.atomic_import_reviewed_v3_physical_role_allowed(p_options jsonb, p_role jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 IMMUTABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
declare
  v_candidates integer;
  v_match text[];
  v_amount numeric;
  v_unit text;
begin
  select count(*) into v_candidates from jsonb_each_text(p_options) option
    where lower(btrim(option.key)) in ('weight','size') and (
      option.value ~* '^[0-9]+(?:[.,][0-9]+)?\s*(mcg|mg|kg|g|ml|cl|l)$'
      or option.value ~* '^[1-9][0-9]*\s*(serving|servings|capsule|capsules|cap|caps|tablet|tablets|tab|tabs|softgel|softgels|sachet|sachets|shot|shots|piece|pieces|gummy|gummies)\s*\(\s*[0-9]+(?:[.,][0-9]+)?\s*(mcg|mg|kg|g|ml|cl|l)\s*\)$'
    );
  if jsonb_typeof(p_role)='null' then return v_candidates=0; end if;
  if jsonb_typeof(p_role)<>'object' or v_candidates<>1
     or not public.atomic_import_has_exact_keys(p_role,array['source_key','source_value','size_value','size_unit'])
     or lower(btrim(p_role->>'source_key')) not in ('weight','size')
     or p_options->>(p_role->>'source_key') is distinct from p_role->>'source_value' then return false; end if;
  v_match:=regexp_match(btrim(p_role->>'source_value'),'^(\d+(?:[.,]\d+)?)\s*(mcg|mg|kg|g|ml|cl|l)$','i');
  if v_match is null then
    v_match:=regexp_match(btrim(p_role->>'source_value'),'^[1-9][0-9]*\s*(?:serving|servings|capsule|capsules|cap|caps|tablet|tablets|tab|tabs|softgel|softgels|sachet|sachets|shot|shots|piece|pieces|gummy|gummies)\s*\(\s*(\d+(?:[.,]\d+)?)\s*(mcg|mg|kg|g|ml|cl|l)\s*\)$','i');
  end if;
  if v_match is null then return false; end if;
  v_amount:=replace(v_match[1],',','.')::numeric; v_unit:=lower(v_match[2]);
  if v_unit='kg' then v_amount:=v_amount*1000; v_unit:='g';
  elsif v_unit='l' then v_amount:=v_amount*1000; v_unit:='ml';
  elsif v_unit='cl' then v_amount:=v_amount*10; v_unit:='ml'; end if;
  return v_amount>0 and v_amount is not distinct from (p_role->>'size_value')::numeric
    and v_unit is not distinct from p_role->>'size_unit';
exception when invalid_text_representation or numeric_value_out_of_range then return false;
end
$function$;

CREATE OR REPLACE FUNCTION public.atomic_import_reviewed_v3_count_role_allowed(p_options jsonb, p_role jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 IMMUTABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
declare
  v_candidates integer;
  v_match text[];
  v_unit text;
begin
  select count(*) into v_candidates from jsonb_each_text(p_options) option
    where lower(btrim(option.key)) in ('size','servings','serving count','count','quantity') and (
      (option.value ~* '^[1-9][0-9]*(?:\s*/\s*[1-9][0-9]*)?\s*[a-z]+$'
       and lower(regexp_replace(option.value,'^.*?([a-z]+)$','\1','i')) in
         ('serving','servings','capsule','capsules','cap','caps','tablet','tablets','tab','tabs','softgel','softgels','sachet','sachets','shot','shots','piece','pieces','gummy','gummies'))
      or option.value ~* '^[1-9][0-9]*\s*(serving|servings|capsule|capsules|cap|caps|tablet|tablets|tab|tabs|softgel|softgels|sachet|sachets|shot|shots|piece|pieces|gummy|gummies)\s*\(\s*[0-9]+(?:[.,][0-9]+)?\s*(mcg|mg|kg|g|ml|cl|l)\s*\)$'
    );
  if jsonb_typeof(p_role)='null' then return v_candidates=0; end if;
  if jsonb_typeof(p_role)<>'object' or v_candidates<>1
     or not public.atomic_import_has_exact_keys(p_role,array['source_key','source_value','count_value','count_unit'])
     or lower(btrim(p_role->>'source_key')) not in ('size','servings','serving count','count','quantity')
     or p_options->>(p_role->>'source_key') is distinct from p_role->>'source_value' then return false; end if;
  v_match:=regexp_match(btrim(p_role->>'source_value'),'^(\d+(?:\s*/\s*\d+)?)\s*([a-z]+)$','i');
  if v_match is null then
    v_match:=regexp_match(btrim(p_role->>'source_value'),'^(\d+)\s*([a-z]+)\s*\(\s*[0-9]+(?:[.,][0-9]+)?\s*(?:mcg|mg|kg|g|ml|cl|l)\s*\)$','i');
  end if;
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
$function$;

CREATE OR REPLACE FUNCTION public.atomic_import_reviewed_v3_legacy_validation_projection(p_plan jsonb, p_envelope jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
declare
  v_evidence jsonb:=p_plan#>'{product_variant,evidence}';
  v_raw_options jsonb:=p_envelope->'external_options';
  v_validation_options jsonb;
  v_flavour jsonb:=p_envelope#>'{option_roles,flavour}';
  v_physical jsonb:=p_envelope#>'{option_roles,physical_size}';
  v_count jsonb:=p_envelope#>'{option_roles,count}';
  v_expected_variant jsonb:=p_plan#>'{expected_state,product_variant}';
  v_flavour_key text;
  v_flavour_normalized_key text;
  v_flavour_alias_count integer;
  v_validation_flavour text;
  v_physical_key text;
  v_count_key text;
  v_size_key text;
  v_size_key_count integer;
  v_physical_match boolean:=false;
  v_count_match boolean:=false;
  v_match_count integer:=0;
  v_selected_value text;
  v_selected_unit text;
  v_selected_token text;
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

  v_evidence:=v_evidence-array['unit_count','unit_type','canonical_identity_evidence'];
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

    v_validation_flavour:=v_flavour->>'source_value';
    if p_envelope->>'reviewed_action'='map_existing_variant'
       and lower(v_validation_flavour) not in (
         lower(coalesce(v_expected_variant->>'flavour_code','')),
         lower(coalesce(v_expected_variant->>'flavour_label',''))
       ) then
      if p_plan#>>'{product,action}'<>'existing'
         or p_plan#>>'{product_variant,action}'<>'existing'
         or p_plan#>>'{product,id}' !~ '^[1-9][0-9]*$'
         or p_plan#>>'{product_variant,id}' !~ '^[1-9][0-9]*$'
         or jsonb_typeof(v_expected_variant)<>'object'
         or not public.atomic_import_has_exact_keys(v_expected_variant,array[
           'id','product_id','variant_key','display_name','flavour_code','flavour_label',
           'size_value','size_unit','pack_count','product_format','is_default','is_active'
         ])
         or v_expected_variant->>'id' is distinct from p_plan#>>'{product_variant,id}'
         or v_expected_variant->>'product_id' is distinct from p_plan#>>'{product,id}'
         or v_expected_variant->'is_active'<>'true'::jsonb
         or v_expected_variant->'is_default'<>'false'::jsonb
         or nullif(btrim(v_expected_variant->>'flavour_label'),'') is null then
        raise exception 'V3_LEGACY_COMPATIBILITY_MISMATCH: existing variant alias target differs';
      end if;
      v_validation_flavour:=v_expected_variant->>'flavour_label';
    end if;

    if v_flavour_normalized_key in ('flavours','flavors') then
      v_validation_options:=jsonb_set(v_validation_options,array['Flavour'],to_jsonb(v_validation_flavour),true);
    elsif v_validation_flavour is distinct from v_flavour->>'source_value' then
      v_validation_options:=jsonb_set(v_validation_options,array[v_flavour_key],to_jsonb(v_validation_flavour),false);
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

  if jsonb_typeof(v_physical)='object' then v_physical_key:=v_physical->>'source_key';
  elsif jsonb_typeof(v_physical)<>'null' then raise exception 'V3_LEGACY_COMPATIBILITY_MISMATCH: invalid physical role'; end if;
  if jsonb_typeof(v_count)='object' then v_count_key:=v_count->>'source_key';
  elsif jsonb_typeof(v_count)<>'null' then raise exception 'V3_LEGACY_COMPATIBILITY_MISMATCH: invalid count role'; end if;

  if v_physical_key is not null and v_count_key is not null
     and lower(btrim(v_physical_key))=lower(btrim(v_count_key))
     and not (
       v_physical_key=v_count_key
       and v_physical->>'source_value' is not distinct from v_count->>'source_value'
       and v_physical->>'source_value' ~* '^[1-9][0-9]*\s*(serving|servings|capsule|capsules|cap|caps|tablet|tablets|tab|tabs|softgel|softgels|sachet|sachets|shot|shots|piece|pieces|gummy|gummies)\s*\(\s*[0-9]+(?:[.,][0-9]+)?\s*(mcg|mg|kg|g|ml|cl|l)\s*\)$'
     ) then
    raise exception 'V3_LEGACY_COMPATIBILITY_MISMATCH: physical and count roles conflict';
  end if;

  if p_envelope->>'reviewed_action'='map_existing_variant' then
    if p_plan#>>'{product,action}'<>'existing'
       or p_plan#>>'{product_variant,action}'<>'existing'
       or jsonb_typeof(v_expected_variant)<>'object'
       or not public.atomic_import_has_exact_keys(v_expected_variant,array[
         'id','product_id','variant_key','display_name','flavour_code','flavour_label',
         'size_value','size_unit','pack_count','product_format','is_default','is_active'
       ])
       or v_expected_variant->>'id' is distinct from p_plan#>>'{product_variant,id}'
       or v_expected_variant->>'product_id' is distinct from p_plan#>>'{product,id}'
       or v_expected_variant->'is_active'<>'true'::jsonb
       or v_expected_variant->'is_default'<>'false'::jsonb then
      raise exception 'V3_LEGACY_COMPATIBILITY_MISMATCH: existing variant target differs';
    end if;
    if (v_expected_variant->>'size_value' is null)<>(v_expected_variant->>'size_unit' is null) then
      raise exception 'V3_LEGACY_COMPATIBILITY_MISMATCH: canonical size is incomplete';
    end if;
    if v_expected_variant->>'size_value' is not null then
      if jsonb_typeof(v_physical)='object' then
        v_physical_match:=(v_physical->>'size_value')::numeric=(v_expected_variant->>'size_value')::numeric
          and lower(v_physical->>'size_unit')=lower(v_expected_variant->>'size_unit');
      end if;
      if jsonb_typeof(v_count)='object' and v_count->>'count_value' ~ '^[1-9][0-9]*$' then
        v_count_match:=(v_count->>'count_value')::numeric=(v_expected_variant->>'size_value')::numeric
          and lower(v_count->>'count_unit')=lower(v_expected_variant->>'size_unit');
      end if;
      v_match_count:=(case when v_physical_match then 1 else 0 end)+(case when v_count_match then 1 else 0 end);
      if v_match_count<>1 then
        raise exception 'V3_LEGACY_COMPATIBILITY_MISMATCH: canonical size does not select exactly one proven role';
      end if;
      if v_physical_match then
        v_selected_value:=v_physical->>'size_value'; v_selected_unit:=v_physical->>'size_unit';
        v_selected_token:=v_selected_value||v_selected_unit;
      else
        v_selected_value:=v_count->>'count_value'; v_selected_unit:=v_count->>'count_unit';
        v_selected_token:=v_selected_value||' '||v_selected_unit;
      end if;
      v_evidence:=jsonb_set(jsonb_set(v_evidence,'{size_value}',to_jsonb(v_selected_value),true),'{size_unit}',to_jsonb(v_selected_unit),true);
      if v_size_key_count=1 then
        v_validation_options:=jsonb_set(v_validation_options,array[v_size_key],to_jsonb(v_selected_token),false);
      else
        v_validation_options:=jsonb_set(v_validation_options,array['Size'],to_jsonb(v_selected_token),true);
      end if;
    end if;
    if nullif(btrim(v_expected_variant->>'flavour_label'),'') is not null then
      if jsonb_typeof(v_flavour)<>'object' then
        raise exception 'V3_LEGACY_COMPATIBILITY_MISMATCH: canonical flavour lacks proven role';
      end if;
      v_evidence:=jsonb_set(v_evidence,'{flavour}',to_jsonb(v_expected_variant->>'flavour_code'),true);
    end if;
    if nullif(btrim(v_evidence->>'product_format'),'') is null
       or public.atomic_import_normalize_product_format(v_evidence->>'product_format')
          is distinct from public.atomic_import_normalize_product_format(v_expected_variant->>'product_format') then
      raise exception 'V3_LEGACY_COMPATIBILITY_MISMATCH: canonical product format evidence differs';
    end if;
    if nullif(btrim(v_evidence->>'pack_count'),'') is null
       or (v_evidence->>'pack_count')::numeric is distinct from (v_expected_variant->>'pack_count')::numeric then
      raise exception 'V3_LEGACY_COMPATIBILITY_MISMATCH: canonical pack evidence differs';
    end if;
  elsif v_size_key_count=1 then
    if lower(btrim(coalesce(v_physical_key,'')))='size' then
      if v_count_key is not null
         and v_physical_key=v_count_key
         and v_physical->>'source_value' is not distinct from v_count->>'source_value' then
        if not (
          (p_envelope->>'reviewed_action'='create_product_with_variant'
           and p_plan#>>'{product,action}'='create_or_reuse_reviewed'
           and p_plan#>>'{product_variant,action}'='create_reviewed_variant')
          or
          (p_envelope->>'reviewed_action'='create_variant_on_existing_product'
           and p_plan#>>'{product,action}'='existing'
           and p_plan#>>'{product_variant,action}'='create_variant')
        ) then
          raise exception 'V3_LEGACY_COMPATIBILITY_MISMATCH: composite physical target action differs';
        end if;
        if p_plan#>>'{product_variant,values,size_value}' is null
           or p_plan#>>'{product_variant,values,size_unit}' is null
           or (p_plan#>>'{product_variant,values,size_value}')::numeric
                is distinct from (v_physical->>'size_value')::numeric
           or lower(p_plan#>>'{product_variant,values,size_unit}')
                is distinct from lower(v_physical->>'size_unit') then
          raise exception 'V3_LEGACY_COMPATIBILITY_MISMATCH: composite physical target differs';
        end if;
        v_validation_options:=jsonb_set(
          v_validation_options,
          array[v_size_key],
          to_jsonb((v_physical->>'size_value')||(v_physical->>'size_unit')),
          false
        );
      end if;
    elsif lower(btrim(coalesce(v_count_key,'')))='size' then
      if v_physical_key is null then v_validation_options:=v_validation_options-v_size_key;
      else v_validation_options:=jsonb_set(v_validation_options,array[v_size_key],to_jsonb(v_physical->>'source_value'),false); end if;
    elsif v_physical_key is not null and v_count_key is null then
      v_validation_options:=v_validation_options-v_size_key;
    end if;
  end if;

  return jsonb_set(v_evidence,'{external_options}',v_validation_options,false);
exception when invalid_text_representation or numeric_value_out_of_range then
  raise exception 'V3_LEGACY_COMPATIBILITY_MISMATCH: canonical distinguishing evidence is invalid';
end
$function$;

CREATE OR REPLACE FUNCTION public.atomic_import_reviewed_v3_legacy_validation_evidence(p_plan jsonb, p_envelope jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.atomic_import_reviewed_v3_canonical_role_allowed(p_plan jsonb, p_envelope jsonb, p_role text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
declare
  v_evidence jsonb:=p_envelope->'canonical_identity_evidence';
  v_plan_evidence jsonb:=p_plan#>'{product_variant,evidence,canonical_identity_evidence}';
  v_binding jsonb;
  v_review jsonb;
  v_selected jsonb;
  v_source jsonb;
  v_fact jsonb;
  v_operand jsonb;
  v_result numeric;
  v_operand_ids jsonb;
  v_expected_hash text;
  v_known_ids text[];
  v_physical_operands integer;
  v_external_options jsonb:=p_envelope->'external_options';
  v_option_roles jsonb:=p_envelope->'option_roles';
  v_obligations jsonb:='[]'::jsonb;
  v_raw_fact jsonb;
  v_raw_role text;
  v_source_key text;
  v_raw_value text;
  v_required_class text;
  v_match_count integer;
begin
  if v_evidence is null or v_evidence='null'::jsonb then return false; end if;
  if v_evidence is distinct from v_plan_evidence
     or not public.atomic_import_has_exact_keys(v_evidence,array['contract_version','binding','raw_source_facts','external_evidence_facts','derived_facts','canonical_selected_facts','conflict_records','evidence_review_decision'])
     or v_evidence->>'contract_version'<>'1' then
    raise exception 'V3_CANONICAL_EVIDENCE_SCHEMA_MISMATCH';
  end if;
  v_binding:=v_evidence->'binding';
  if not public.atomic_import_has_exact_keys(v_binding,array['retailer_id','external_product_id','external_variant_id','source_row_fingerprint','brand','product_identity','external_gtin','external_sku','package_authorized_at'])
     or v_binding->>'retailer_id' is distinct from p_envelope#>>'{retailer,id}'
     or v_binding->>'external_product_id' is distinct from p_envelope->>'external_product_id'
     or v_binding->>'external_variant_id' is distinct from p_envelope->>'external_variant_id'
     or v_binding->>'source_row_fingerprint' is distinct from p_envelope->>'source_row_fingerprint'
     or v_binding->>'source_row_fingerprint' !~ '^[0-9a-f]{64}$'
     or v_binding->>'package_authorized_at' is null
     or v_binding->>'external_gtin' is distinct from p_plan#>>'{retailer_product,values,external_gtin}'
     or v_binding->>'external_sku' is distinct from p_plan#>>'{retailer_product,values,external_sku}' then
    raise exception 'V3_CANONICAL_EVIDENCE_BINDING_MISMATCH';
  end if;
  if jsonb_typeof(v_evidence->'raw_source_facts')<>'array' or jsonb_typeof(v_evidence->'external_evidence_facts')<>'array'
     or jsonb_typeof(v_evidence->'derived_facts')<>'array' or jsonb_typeof(v_evidence->'canonical_selected_facts')<>'array'
     or jsonb_typeof(v_evidence->'conflict_records')<>'array'
     or jsonb_typeof(v_external_options)<>'object' or jsonb_typeof(v_option_roles)<>'object' then
    raise exception 'V3_CANONICAL_EVIDENCE_SCHEMA_MISMATCH';
  end if;
  if (select count(*)<>count(distinct x->>'fact_id') from (
       select x from jsonb_array_elements(v_evidence->'raw_source_facts') x union all
       select x from jsonb_array_elements(v_evidence->'external_evidence_facts') x union all
       select x from jsonb_array_elements(v_evidence->'derived_facts') x
     ) q) then raise exception 'V3_CANONICAL_EVIDENCE_SCHEMA_MISMATCH'; end if;

  for v_fact in select value from jsonb_array_elements(v_evidence->'raw_source_facts') loop
    if not public.atomic_import_has_exact_keys(v_fact,array['fact_id','role','raw_value','source_key','source_row_fingerprint'])
       or nullif(v_fact->>'fact_id','') is null or nullif(v_fact->>'raw_value','') is null
       or v_fact->>'source_row_fingerprint' is distinct from v_binding->>'source_row_fingerprint' then
      raise exception 'V3_CANONICAL_EVIDENCE_SCHEMA_MISMATCH';
    end if;
    if not (v_external_options ? (v_fact->>'source_key'))
       or v_external_options->>(v_fact->>'source_key') is distinct from v_fact->>'raw_value'
       or (
         (
           v_option_roles#>>'{physical_size,source_key}'=v_fact->>'source_key'
           or v_option_roles#>>'{count,source_key}'=v_fact->>'source_key'
         )
         and not (
           v_option_roles#>>'{physical_size,source_key}'=v_fact->>'source_key' and v_fact->>'role'='physical_size'
           or v_option_roles#>>'{count,source_key}'=v_fact->>'source_key' and (
             v_option_roles#>>'{count,count_unit}'='servings' and v_fact->>'role'='serving_count'
             or v_option_roles#>>'{count,count_unit}' in ('capsules','tablets','softgels','pieces') and v_fact->>'role'='container_count'
           )
         )
       ) then
      raise exception 'V3_CANONICAL_RAW_FACT_BINDING_MISMATCH';
    end if;
  end loop;
  if exists(
    select 1 from jsonb_array_elements(v_evidence->'raw_source_facts') raw
    group by raw->>'source_key',raw->>'role' having count(*)<>1
  ) then raise exception 'V3_CANONICAL_RAW_FACT_BINDING_MISMATCH'; end if;

  for v_fact in select value from jsonb_array_elements(v_evidence->'external_evidence_facts') loop
    if not public.atomic_import_has_exact_keys(v_fact,array['fact_id','role','normalized_value','unit','evidence_source_type','source_url','captured_at','source_content_sha256','identity_binding'])
       or not public.atomic_import_has_exact_keys(v_fact->'identity_binding',array['brand','product_identity','external_gtin','external_sku','pack_configuration'])
       or v_fact->>'evidence_source_type' not in ('manufacturer_product_page','manufacturer_label','manufacturer_structured_data','exact_retailer_gtin_sku','independent_exact_retailer')
       or v_fact->>'source_url' !~ '^https://' or v_fact->>'source_content_sha256' !~ '^[0-9a-f]{64}$'
       or (v_fact->>'captured_at')::timestamptz>(v_binding->>'package_authorized_at')::timestamptz
       or v_fact#>>'{identity_binding,brand}' is distinct from v_binding->>'brand'
       or v_fact#>>'{identity_binding,product_identity}' is distinct from v_binding->>'product_identity'
       or v_fact#>>'{identity_binding,external_gtin}' is distinct from v_binding->>'external_gtin'
       or v_fact#>>'{identity_binding,external_sku}' is distinct from v_binding->>'external_sku'
       or nullif(v_fact#>>'{identity_binding,pack_configuration}','') is null then
      raise exception 'V3_CANONICAL_EVIDENCE_IDENTITY_MISMATCH';
    end if;
    if (v_fact->>'role' in ('physical_size','total_content') and
          (v_fact->>'normalized_value' !~ '^(0|[1-9][0-9]*)(\.[0-9]*[1-9])?$' or v_fact->>'unit' not in ('g','ml')))
       or (v_fact->>'role'='container_count' and
          (v_fact->>'normalized_value' !~ '^[1-9][0-9]*$' or v_fact->>'unit' not in ('capsules','tablets','softgels','pieces')))
       or (v_fact->>'role'='pack_count' and
          (v_fact->>'normalized_value' !~ '^[1-9][0-9]*$' or v_fact->>'unit'<>'packs'))
       or (v_fact->>'role'='piece_count' and
          (v_fact->>'normalized_value' !~ '^[1-9][0-9]*$' or v_fact->>'unit'<>'pieces'))
       or (v_fact->>'role'='product_format' and
          (nullif(v_fact->>'normalized_value','') is null or v_fact->>'unit'<>'format'))
       or v_fact->>'role' not in ('physical_size','total_content','container_count','pack_count','piece_count','product_format') then
      raise exception 'V3_CANONICAL_EVIDENCE_AMBIGUOUS';
    end if;
  end loop;

  if exists(
    select 1 from jsonb_array_elements(v_evidence->'external_evidence_facts') fact
    where fact->>'evidence_source_type' not in ('manufacturer_product_page','manufacturer_label','manufacturer_structured_data')
      and not exists(
        select 1 from jsonb_array_elements(v_evidence->'external_evidence_facts') peer
        where peer->>'fact_id'<>fact->>'fact_id' and peer->>'role'=fact->>'role'
          and peer->>'normalized_value'=fact->>'normalized_value' and peer->>'unit'=fact->>'unit'
          and (peer->>'evidence_source_type' in ('manufacturer_product_page','manufacturer_label','manufacturer_structured_data')
            or ((v_binding->>'external_gtin' is not null or v_binding->>'external_sku' is not null)
              and peer->>'evidence_source_type'<>fact->>'evidence_source_type'))
      )
  ) then raise exception 'V3_CANONICAL_EVIDENCE_SOURCE_NOT_ADMISSIBLE'; end if;
  if exists(
    select 1 from jsonb_array_elements(v_evidence->'external_evidence_facts') fact
    where fact#>>'{identity_binding,pack_configuration}' is distinct from
      (v_evidence#>>'{external_evidence_facts,0,identity_binding,pack_configuration}')
  ) then raise exception 'V3_CANONICAL_EVIDENCE_IDENTITY_MISMATCH'; end if;
  if exists(
    select 1 from jsonb_array_elements(v_evidence->'external_evidence_facts') fact
    join jsonb_array_elements(v_evidence->'external_evidence_facts') peer
      on peer->>'fact_id'<>fact->>'fact_id' and peer->>'role'=fact->>'role'
    where peer->>'normalized_value' is distinct from fact->>'normalized_value' or peer->>'unit' is distinct from fact->>'unit'
  ) then raise exception 'V3_CANONICAL_EVIDENCE_AMBIGUOUS'; end if;

  select coalesce(array_agg(value->>'fact_id'),'{}'::text[]) into v_known_ids
  from jsonb_array_elements(v_evidence->'external_evidence_facts');

  for v_fact in select value from jsonb_array_elements(v_evidence->'derived_facts') loop
    if not public.atomic_import_has_exact_keys(v_fact,array['fact_id','role','formula_id','operand_fact_ids','normalized_value','unit','derivation_sha256'])
       or v_fact->>'formula_id'<>'multiply_exact_decimal_v1' or jsonb_array_length(v_fact->'operand_fact_ids')<2
       or v_fact->>'role' not in ('physical_size','total_content')
       or v_fact->>'normalized_value' !~ '^(0|[1-9][0-9]*)(\.[0-9]*[1-9])?$'
       or v_fact->>'unit' not in ('g','ml') then
      raise exception 'V3_CANONICAL_DERIVATION_MISMATCH';
    end if;
    v_result:=1; v_operand_ids:='[]'::jsonb; v_physical_operands:=0;
    for v_operand in select value from jsonb_array_elements(v_fact->'operand_fact_ids') loop
      select x into v_source from (
        select x from jsonb_array_elements(v_evidence->'external_evidence_facts') x
        union all select x from jsonb_array_elements(v_evidence->'derived_facts') x
      ) q where x->>'fact_id'=v_operand#>>'{}';
      if v_source is null or not ((v_operand#>>'{}')=any(v_known_ids)) or v_source->>'normalized_value' !~ '^(0|[1-9][0-9]*)(\.[0-9]*[1-9])?$' then raise exception 'V3_CANONICAL_DERIVATION_MISMATCH: operand %',v_operand; end if;
      if v_source->>'role' in ('physical_size','total_content') then
        v_physical_operands:=v_physical_operands+1;
        if v_source->>'unit'<>v_fact->>'unit' then raise exception 'V3_CANONICAL_DERIVATION_MISMATCH'; end if;
      elsif v_source->>'role' in ('pack_count','piece_count','container_count') then
        if v_source->>'normalized_value' !~ '^[1-9][0-9]*$' then raise exception 'V3_CANONICAL_DERIVATION_MISMATCH'; end if;
      else raise exception 'V3_CANONICAL_DERIVATION_MISMATCH';
      end if;
      v_result:=v_result*(v_source->>'normalized_value')::numeric;
      v_operand_ids:=v_operand_ids||jsonb_build_array(jsonb_build_object('fact_id',v_source->>'fact_id','normalized_value',v_source->>'normalized_value','unit',v_source->>'unit'));
    end loop;
    if v_physical_operands<>1 or v_result::text is distinct from v_fact->>'normalized_value' then raise exception 'V3_CANONICAL_DERIVATION_MISMATCH: result % expected %',v_result,v_fact->>'normalized_value'; end if;
    v_expected_hash:=encode(pg_catalog.sha256(convert_to(public.atomic_import_canonical_json(jsonb_build_object('formula_id',v_fact->>'formula_id','ordered_operands',v_operand_ids,'result',v_fact->>'normalized_value','unit',v_fact->>'unit')),'UTF8')),'hex');
    if v_fact->>'derivation_sha256' is distinct from v_expected_hash then raise exception 'V3_CANONICAL_DERIVATION_MISMATCH: hash % expected %',v_fact->>'derivation_sha256',v_expected_hash; end if;
    v_known_ids:=array_append(v_known_ids,v_fact->>'fact_id');
  end loop;

  if (select count(*)<>count(distinct value->>'role') from jsonb_array_elements(v_evidence->'canonical_selected_facts')) then raise exception 'V3_CANONICAL_EVIDENCE_SCHEMA_MISMATCH'; end if;
  for v_fact in select value from jsonb_array_elements(v_evidence->'canonical_selected_facts') loop
    if not public.atomic_import_has_exact_keys(v_fact,array['role','selected_fact_id','normalized_value','unit','evidence_review_decision'])
       or v_fact->>'role' not in ('physical_size','container_count','pack_count','product_format')
       or v_fact->>'evidence_review_decision'<>'ACCEPT_FOR_CANONICAL_IDENTITY' then raise exception 'V3_CANONICAL_EVIDENCE_SCHEMA_MISMATCH'; end if;
    select x into v_source from (
      select x from jsonb_array_elements(v_evidence->'external_evidence_facts') x
      union all select x from jsonb_array_elements(v_evidence->'derived_facts') x
    ) q where x->>'fact_id'=v_fact->>'selected_fact_id';
    if v_source is null or v_source->>'role' is distinct from v_fact->>'role' or v_source->>'normalized_value' is distinct from v_fact->>'normalized_value' or v_source->>'unit' is distinct from v_fact->>'unit' then raise exception 'V3_CANONICAL_EVIDENCE_CANONICAL_FACT_MISMATCH'; end if;
    if (v_fact->>'role'='physical_size' and (coalesce(p_plan#>>'{product_variant,values,size_value}',p_plan#>>'{product_variant,evidence,size_value}') is distinct from v_fact->>'normalized_value' or coalesce(p_plan#>>'{product_variant,values,size_unit}',p_plan#>>'{product_variant,evidence,size_unit}') is distinct from v_fact->>'unit'))
       or (v_fact->>'role'='container_count' and (coalesce(p_plan#>>'{product,values,unit_count}',p_plan#>>'{product_variant,evidence,unit_count}') is distinct from v_fact->>'normalized_value' or coalesce(p_plan#>>'{product,values,unit_type}',p_plan#>>'{product_variant,evidence,unit_type}') is distinct from v_fact->>'unit'))
       or (v_fact->>'role'='pack_count' and coalesce(p_plan#>>'{product_variant,values,pack_count}',p_plan#>>'{product_variant,evidence,pack_count}') is distinct from v_fact->>'normalized_value')
       or (v_fact->>'role'='product_format' and coalesce(p_plan#>>'{product_variant,values,product_format}',p_plan#>>'{product_variant,evidence,product_format}') is distinct from v_fact->>'normalized_value') then
      raise exception 'V3_CANONICAL_PROJECTION_MISMATCH';
    end if;
  end loop;
  if jsonb_array_length(v_evidence->'canonical_selected_facts')=0 then raise exception 'V3_CANONICAL_EVIDENCE_REVIEW_MISSING'; end if;

  for v_selected in select value from jsonb_array_elements(v_evidence->'canonical_selected_facts') loop
    v_raw_role:=null; v_source_key:=null; v_raw_value:=null; v_required_class:=null;
    if v_selected->>'role'='physical_size' and jsonb_typeof(v_option_roles->'physical_size')='object'
       and (v_option_roles#>>'{physical_size,size_value}' is distinct from v_selected->>'normalized_value'
         or v_option_roles#>>'{physical_size,size_unit}' is distinct from v_selected->>'unit') then
      v_raw_role:='physical_size';
      v_source_key:=v_option_roles#>>'{physical_size,source_key}';
      v_raw_value:=v_option_roles#>>'{physical_size,source_value}';
      v_required_class:='PHYSICAL';
    elsif v_selected->>'role'='container_count' and jsonb_typeof(v_option_roles->'count')='object'
       and (v_option_roles#>>'{count,count_value}' is distinct from v_selected->>'normalized_value'
         or v_option_roles#>>'{count,count_unit}' is distinct from v_selected->>'unit') then
      if v_option_roles#>>'{count,count_unit}'='servings' then
        v_raw_role:='serving_count'; v_required_class:='SERVING_COUNT_NOT_CONTAINER_COUNT';
      elsif v_option_roles#>>'{count,count_unit}' in ('capsules','tablets','softgels','pieces') then
        v_raw_role:='container_count'; v_required_class:='CONTAINER';
      else
        raise exception 'V3_CANONICAL_RAW_FACT_BINDING_MISMATCH';
      end if;
      v_source_key:=v_option_roles#>>'{count,source_key}';
      v_raw_value:=v_option_roles#>>'{count,source_value}';
    end if;
    if v_raw_role is not null then
      select count(*) into v_match_count
      from jsonb_array_elements(v_evidence->'raw_source_facts') raw
      where raw->>'role'=v_raw_role and raw->>'source_key'=v_source_key
        and raw->>'raw_value'=v_raw_value
        and raw->>'source_row_fingerprint'=v_binding->>'source_row_fingerprint';
      if v_match_count<>1 then raise exception 'V3_CANONICAL_RAW_FACT_BINDING_MISMATCH'; end if;
      select raw into v_raw_fact
      from jsonb_array_elements(v_evidence->'raw_source_facts') raw
      where raw->>'role'=v_raw_role and raw->>'source_key'=v_source_key
        and raw->>'raw_value'=v_raw_value
        and raw->>'source_row_fingerprint'=v_binding->>'source_row_fingerprint';
      v_obligations:=v_obligations||jsonb_build_array(jsonb_build_object(
        'raw_fact_id',v_raw_fact->>'fact_id','canonical_fact_id',v_selected->>'selected_fact_id','required_class',v_required_class
      ));
    end if;
  end loop;

  for v_fact in select value from jsonb_array_elements(v_evidence->'conflict_records') loop
    if not public.atomic_import_has_exact_keys(v_fact,array['raw_fact_id','canonical_fact_id','classification','disposition'])
       or v_fact->>'classification' not in ('UNEXPLAINED_CONFLICTING_METADATA','SERVING_COUNT_NOT_CONTAINER_COUNT','PACK_CONFIGURATION_CONFLICT')
       or v_fact->>'disposition'<>'PRESERVE_RAW_DO_NOT_USE_FOR_CANONICAL_IDENTITY'
       or not exists(select 1 from jsonb_array_elements(v_evidence->'raw_source_facts') raw where raw->>'fact_id'=v_fact->>'raw_fact_id')
       or not exists(select 1 from jsonb_array_elements(v_evidence->'canonical_selected_facts') selected_fact where selected_fact->>'selected_fact_id'=v_fact->>'canonical_fact_id')
       or not exists(select 1 from jsonb_array_elements(v_obligations) obligation
         where obligation->>'raw_fact_id'=v_fact->>'raw_fact_id'
           and obligation->>'canonical_fact_id'=v_fact->>'canonical_fact_id'
           and (obligation->>'required_class'=v_fact->>'classification'
             or obligation->>'required_class' in ('PHYSICAL','CONTAINER') and v_fact->>'classification' in ('UNEXPLAINED_CONFLICTING_METADATA','PACK_CONFIGURATION_CONFLICT'))) then
      raise exception 'V3_CANONICAL_EVIDENCE_SCHEMA_MISMATCH';
    end if;
  end loop;
  if exists(
    select 1 from jsonb_array_elements(v_obligations) obligation
    where (select count(*) from jsonb_array_elements(v_evidence->'conflict_records') conflict
      where conflict->>'raw_fact_id'=obligation->>'raw_fact_id'
        and conflict->>'canonical_fact_id'=obligation->>'canonical_fact_id'
        and (conflict->>'classification'=obligation->>'required_class'
          or obligation->>'required_class' in ('PHYSICAL','CONTAINER') and conflict->>'classification' in ('UNEXPLAINED_CONFLICTING_METADATA','PACK_CONFIGURATION_CONFLICT')))<>1
  ) then raise exception 'V3_CANONICAL_CONFLICT_RECORD_REQUIRED'; end if;
  if exists(
    select 1 from jsonb_array_elements(v_evidence->'conflict_records') conflict
    group by conflict->>'raw_fact_id',conflict->>'canonical_fact_id' having count(*)<>1
  ) then raise exception 'V3_CANONICAL_EVIDENCE_SCHEMA_MISMATCH'; end if;
  v_review:=v_evidence->'evidence_review_decision';
  if not public.atomic_import_has_exact_keys(v_review,array['decision','reviewed_fact_ids','reviewed_by','reviewed_at','decision_evidence_sha256'])
     or v_review->>'decision'<>'ACCEPT_EXACT_FACTS_FOR_CANONICAL_IDENTITY' or jsonb_array_length(v_review->'reviewed_fact_ids')=0
     or coalesce(v_review->>'reviewed_by','')~*'owner[_ -]?approved|robimy'
     or exists(select 1 from jsonb_array_elements_text(v_review->'reviewed_fact_ids') reviewed_id where not ((reviewed_id)=any(v_known_ids)))
     or exists(select 1 from jsonb_array_elements(v_evidence->'canonical_selected_facts') selected_fact where not (v_review->'reviewed_fact_ids') ? (selected_fact->>'selected_fact_id'))
     or (v_review->>'reviewed_at')::timestamptz>(v_binding->>'package_authorized_at')::timestamptz then raise exception 'V3_CANONICAL_EVIDENCE_REVIEW_MISSING'; end if;
  v_expected_hash:=encode(pg_catalog.sha256(convert_to(public.atomic_import_canonical_json(jsonb_set(v_evidence,'{evidence_review_decision,decision_evidence_sha256}','null'::jsonb,false)),'UTF8')),'hex');
  if v_review->>'decision_evidence_sha256' is distinct from v_expected_hash then raise exception 'V3_CANONICAL_EVIDENCE_HASH_MISMATCH'; end if;

  select value into v_selected from jsonb_array_elements(v_evidence->'canonical_selected_facts') where value->>'role'=p_role;
  if v_selected is null then return p_role='_validate_only'; end if;
  if not public.atomic_import_has_exact_keys(v_selected,array['role','selected_fact_id','normalized_value','unit','evidence_review_decision'])
     or (select count(*) from jsonb_array_elements(v_evidence->'canonical_selected_facts') where value->>'role'=p_role)<>1
     or v_selected->>'evidence_review_decision'<>'ACCEPT_FOR_CANONICAL_IDENTITY' then raise exception 'V3_CANONICAL_EVIDENCE_SCHEMA_MISMATCH'; end if;
  select x into v_source from (
    select x from jsonb_array_elements(v_evidence->'external_evidence_facts') x
    union all select x from jsonb_array_elements(v_evidence->'derived_facts') x
  ) q where x->>'fact_id'=v_selected->>'selected_fact_id';
  if v_source is null or v_source->>'role' is distinct from p_role or v_source->>'normalized_value' is distinct from v_selected->>'normalized_value' or v_source->>'unit' is distinct from v_selected->>'unit' then
    raise exception 'V3_CANONICAL_EVIDENCE_CANONICAL_FACT_MISMATCH';
  end if;
  v_review:=v_evidence->'evidence_review_decision';
  if not public.atomic_import_has_exact_keys(v_review,array['decision','reviewed_fact_ids','reviewed_by','reviewed_at','decision_evidence_sha256'])
     or v_review->>'decision'<>'ACCEPT_EXACT_FACTS_FOR_CANONICAL_IDENTITY' or jsonb_array_length(v_review->'reviewed_fact_ids')=0
     or coalesce(v_review->>'reviewed_by','')~*'owner[_ -]?approved|robimy'
     or exists(select 1 from jsonb_array_elements_text(v_review->'reviewed_fact_ids') reviewed_id
       where not exists(select 1 from (
         select x from jsonb_array_elements(v_evidence->'external_evidence_facts') x
         union all select x from jsonb_array_elements(v_evidence->'derived_facts') x
       ) q where q.x->>'fact_id'=reviewed_id))
     or exists(select 1 from jsonb_array_elements(v_evidence->'canonical_selected_facts') selected_fact
       where not (v_review->'reviewed_fact_ids') ? (selected_fact->>'selected_fact_id'))
     or (v_review->>'reviewed_at')::timestamptz>(v_binding->>'package_authorized_at')::timestamptz then raise exception 'V3_CANONICAL_EVIDENCE_REVIEW_MISSING'; end if;
  v_expected_hash:=encode(pg_catalog.sha256(convert_to(public.atomic_import_canonical_json(jsonb_set(v_evidence,'{evidence_review_decision,decision_evidence_sha256}','null'::jsonb,false)),'UTF8')),'hex');
  if v_review->>'decision_evidence_sha256' is distinct from v_expected_hash then raise exception 'V3_CANONICAL_EVIDENCE_HASH_MISMATCH'; end if;
  return case p_role
    when 'physical_size' then coalesce(p_plan#>>'{product_variant,values,size_value}',p_plan#>>'{product_variant,evidence,size_value}')=v_selected->>'normalized_value' and coalesce(p_plan#>>'{product_variant,values,size_unit}',p_plan#>>'{product_variant,evidence,size_unit}')=v_selected->>'unit'
    when 'container_count' then coalesce(p_plan#>>'{product,values,unit_count}',p_plan#>>'{product_variant,evidence,unit_count}')=v_selected->>'normalized_value' and coalesce(p_plan#>>'{product,values,unit_type}',p_plan#>>'{product_variant,evidence,unit_type}')=v_selected->>'unit'
    when '_validate_only' then true
    else false end;
end
$function$;

CREATE OR REPLACE FUNCTION public.atomic_import_validate_reviewed_catalogue_v3_plan(p_plan jsonb, p_envelope jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
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

  if not (
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
     )
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
     or v_external_options is distinct from coalesce(v_mapping->'external_options','{}'::jsonb)
     or coalesce(p_envelope->'canonical_identity_evidence','null'::jsonb) is distinct from coalesce(p_plan#>'{product_variant,evidence,canonical_identity_evidence}','null'::jsonb) then
    raise exception 'V3_BINDING_MISMATCH: plan and authorization envelope differ';
  end if;

  if p_envelope ? 'canonical_identity_evidence' and not public.atomic_import_reviewed_v3_canonical_role_allowed(p_plan,p_envelope,'_validate_only') then
    raise exception 'V3_CANONICAL_EVIDENCE_SCHEMA_MISMATCH';
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
  if (p_envelope->>'direct_source_url') not like regexp_replace(v_retailer.website,'/$','')||'/products/%'
     or (p_envelope->>'direct_source_url') !~ ('[?&]variant='||(p_envelope->>'external_variant_id')||'(&|$)') then
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
  if not public.atomic_import_reviewed_v3_physical_role_allowed(v_external_options,v_physical)
     and not public.atomic_import_reviewed_v3_canonical_role_allowed(p_plan,p_envelope,'physical_size') then
    raise exception 'V3_OPTION_ROLE_MISMATCH: physical size role is not exact raw evidence';
  end if;
  if not public.atomic_import_reviewed_v3_count_role_allowed(v_external_options,v_count)
     and not public.atomic_import_reviewed_v3_canonical_role_allowed(p_plan,p_envelope,'container_count') then
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
      if (
           not public.atomic_import_is_decimal_string(v_variant_values->>'size_value')
           or (v_variant_values->>'size_value')::numeric<=0
           or v_physical->>'size_value' is distinct from v_variant_values->>'size_value'
           or v_physical->>'size_unit' is distinct from v_variant_values->>'size_unit'
         ) and not public.atomic_import_reviewed_v3_canonical_role_allowed(p_plan,p_envelope,'physical_size') then
        raise exception 'V3_OPTION_ROLE_MISMATCH: canonical physical size differs from raw source evidence';
      end if;
    elsif jsonb_typeof(v_count)='object' then
      if (
           v_variant_values->'size_value'<>'null'::jsonb or v_variant_values->'size_unit'<>'null'::jsonb
           or coalesce(v_product_values->>'unit_count',p_plan#>>'{product_variant,evidence,unit_count}') is distinct from v_count->>'count_value'
           or coalesce(v_product_values->>'unit_type',p_plan#>>'{product_variant,evidence,unit_type}') is distinct from v_count->>'count_unit'
         ) and not public.atomic_import_reviewed_v3_canonical_role_allowed(p_plan,p_envelope,'container_count') then
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
    ) and not public.atomic_import_reviewed_v3_canonical_role_allowed(p_plan,p_envelope,'container_count') then
      raise exception 'V3_OPTION_ROLE_MISMATCH: default variant count differs from raw source evidence';
    end if;
  end if;

  if jsonb_typeof(p_plan#>'{product_variant,evidence}')='object' then
    perform public.atomic_import_reviewed_v3_legacy_validation_projection(p_plan,p_envelope);
  end if;

  return jsonb_build_object(
    'valid',true,'contract_kind','reviewed-catalogue-package-v3','target_environment',p_envelope->>'target_environment',
    'target_project_ref',p_envelope->>'target_project_ref','retailer_id',v_retailer.id::text,
    'product_action',v_product_action,'product_variant_action',v_variant_action,
    'plan_fingerprint',p_envelope->>'plan_fingerprint','source_row_fingerprint',p_envelope->>'source_row_fingerprint',
    'manifest_sha256',p_envelope->>'manifest_sha256','artifact_sha256',p_envelope->>'artifact_sha256'
  );
end
$function$;

do $postflight$
declare
  v_counts_before jsonb:=current_setting('app.reviewed_v3_1_consolidation_counts')::jsonb;
  v_counts_after jsonb;
begin
  if exists(
    select 1
    from (values
    ('atomic_import_reviewed_v3_physical_role_allowed(jsonb,jsonb)','154d86c8abd1a0dc5aaa0bc71704be17c590af578dfffbea2adff82847068a49','postgres','i',true,array['search_path=pg_catalog, public, pg_temp']::text[],'{postgres=X/postgres}'::aclitem[]),
    ('atomic_import_reviewed_v3_count_role_allowed(jsonb,jsonb)','90afc70b4adfa0d2836d501d240e1e98c72fec0d8ce0df99227de86b7f548f5a','postgres','i',true,array['search_path=pg_catalog, public, pg_temp']::text[],'{postgres=X/postgres}'::aclitem[]),
    ('atomic_import_reviewed_v3_legacy_validation_projection(jsonb,jsonb)','8bc6eb2fd25499182cfbd70f29f9316056f36f8d403232a5fa6ee35df786a80c','postgres','s',true,array['search_path=pg_catalog, public, pg_temp']::text[],'{postgres=X/postgres}'::aclitem[]),
    ('atomic_import_reviewed_v3_legacy_validation_evidence(jsonb,jsonb)','a5b8a05c0dc9cba672cbb4607c8d63660744165f88d2807e26d299159277b0f8','postgres','s',true,array['search_path=pg_catalog, public, pg_temp']::text[],'{postgres=X/postgres}'::aclitem[]),
    ('atomic_import_reviewed_v3_canonical_role_allowed(jsonb,jsonb,text)','cc6c8017e87a3f02129dbd855960d8078348eb8271713a274e26ef5dcdf15f46','postgres','s',true,array['search_path=pg_catalog, public, pg_temp']::text[],'{postgres=X/postgres}'::aclitem[]),
    ('atomic_import_validate_reviewed_catalogue_v3_plan(jsonb,jsonb)','033cd54202f3ed2946eb78ba37a311c5a56a4f6eb421c0424b3239ad75c19baf','postgres','s',true,array['search_path=pg_catalog, public, pg_temp']::text[],'{postgres=X/postgres}'::aclitem[])
    ) expected(signature,sha256,owner,volatility,security_definer,search_path,acl)
    left join lateral (
      select p.oid::regprocedure::text signature,
             encode(pg_catalog.sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex') sha256,
             p.proowner::regrole::text owner,
             p.provolatile volatility,
             p.prosecdef security_definer,
             p.proconfig search_path,
             p.proacl acl
      from pg_proc p where p.oid=expected.signature::regprocedure
    ) actual on true
    where actual.signature is null
       or actual.sha256 is distinct from expected.sha256
       or actual.owner is distinct from expected.owner
       or actual.volatility is distinct from expected.volatility
       or actual.security_definer is distinct from expected.security_definer
       or actual.search_path is distinct from expected.search_path
       or actual.acl is distinct from expected.acl
  ) then
    raise exception 'reviewed V3.1 consolidation rollback postflight lineage or security metadata differs';
  end if;

  if exists(
    select 1
    from pg_temp.reviewed_v3_1_runtime_before before
    join pg_proc p on p.oid=before.signature::regprocedure
    where p.proowner::regrole::text is distinct from before.owner
       or p.provolatile is distinct from before.volatility
       or p.prosecdef is distinct from before.security_definer
       or p.proconfig is distinct from before.search_path
       or p.proacl is distinct from before.acl
  ) then
    raise exception 'reviewed V3.1 consolidation rollback changed owner, volatility, security, search_path or ACL';
  end if;

  select jsonb_build_object(
    'retailers',(select count(*) from public.retailers),
    'products',(select count(*) from public.products),
    'product_variants',(select count(*) from public.product_variants),
    'retailer_products',(select count(*) from public.retailer_products),
    'offers',(select count(*) from public.offers),
    'price_history',(select count(*) from public.price_history),
    'approved_import_plans',(select count(*) from public.approved_import_plans)
  ) into v_counts_after;
  if v_counts_after is distinct from v_counts_before then
    raise exception 'reviewed V3.1 consolidation rollback changed business counts';
  end if;
end
$postflight$;

commit;
