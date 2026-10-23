begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';

select pg_advisory_xact_lock(hashtextextended('reviewed-catalogue-v3-schema',0));

do $preflight$
declare
  v_target jsonb:=public.retailer_catalogue_actual_database_target();
  v_function regprocedure;
  v_counts jsonb;
  v_standard_core_sha text;
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
    raise exception 'reviewed V3 evidence parity target differs';
  end if;

  if exists(
    select 1 from public.approved_import_plans
    where source~'^reviewed-catalogue-package-v3:'
      and status='approved' and consumed_at is null and expires_at>now()
  ) then
    raise exception 'reviewed V3 evidence parity blocked by live approval';
  end if;

  foreach v_function in array array[
    'public.atomic_import_reviewed_v3_physical_role_allowed(jsonb,jsonb)'::regprocedure,
    'public.atomic_import_reviewed_v3_count_role_allowed(jsonb,jsonb)'::regprocedure,
    'public.atomic_import_reviewed_v3_legacy_validation_projection(jsonb,jsonb)'::regprocedure,
    'public.atomic_import_reviewed_v3_legacy_validation_evidence(jsonb,jsonb)'::regprocedure,
    'public.atomic_import_validate_reviewed_catalogue_v3_plan(jsonb,jsonb)'::regprocedure,
    'public.atomic_import_reviewed_catalogue_v3_plan_allowed(jsonb)'::regprocedure,
    'public.apply_approved_reviewed_catalogue_v3_plan(uuid,jsonb,jsonb)'::regprocedure,
    'public.approve_reviewed_catalogue_v3_plan(jsonb,jsonb,timestamptz)'::regprocedure
  ] loop
    if not exists(select 1 from pg_proc where oid=v_function) then
      raise exception 'reviewed V3 evidence parity prerequisite missing: %',v_function;
    end if;
  end loop;

  v_standard_core_sha:=encode(pg_catalog.sha256(convert_to(pg_get_functiondef(
    'public.atomic_import_apply_standard_plan_core(jsonb)'::regprocedure
  ),'UTF8')),'hex');
  if v_standard_core_sha not in ('0ddc773b546656bc6a47ab712f429559dabb7ebf9c340db7bef91fb9c3a56500','247edebff3cdbf5d2b73a73c8e3186ed6d2a1f0fd813d5009608cdc79a4a98ae') then
    raise exception 'reviewed V3 evidence parity standard core lineage differs: %',v_standard_core_sha;
  end if;

  if encode(pg_catalog.sha256(convert_to(pg_get_functiondef(
       'public.atomic_import_reviewed_v3_physical_role_allowed(jsonb,jsonb)'::regprocedure
     ),'UTF8')),'hex') <> 'dfe0e59fb14eb2f065729fb782ecfcd20f5774a2a36534b88fe8114d708ab6c8'
     or encode(pg_catalog.sha256(convert_to(pg_get_functiondef(
       'public.atomic_import_reviewed_v3_count_role_allowed(jsonb,jsonb)'::regprocedure
     ),'UTF8')),'hex') <> '2714f3015ba3a14e5315f2c84ed296d584e4830b0e5722cd9aa6493e2baa3556'
     or encode(pg_catalog.sha256(convert_to(pg_get_functiondef(
       'public.atomic_import_reviewed_v3_legacy_validation_projection(jsonb,jsonb)'::regprocedure
     ),'UTF8')),'hex') <> '7714cb21a64af063079c34cd5929b242030913c850532d5e71162839b974f1e6'
     or encode(pg_catalog.sha256(convert_to(pg_get_functiondef(
       'public.atomic_import_reviewed_v3_legacy_validation_evidence(jsonb,jsonb)'::regprocedure
     ),'UTF8')),'hex') <> 'a5b8a05c0dc9cba672cbb4607c8d63660744165f88d2807e26d299159277b0f8'
     or encode(pg_catalog.sha256(convert_to(pg_get_functiondef(
       'public.atomic_import_validate_reviewed_catalogue_v3_plan(jsonb,jsonb)'::regprocedure
     ),'UTF8')),'hex') <> '04392ff0eff0e814ba54e41d0b9af38478174eda6f427e7eefcc35d18c7b3e0c'
     or encode(pg_catalog.sha256(convert_to(pg_get_functiondef(
       'public.atomic_import_reviewed_catalogue_v3_plan_allowed(jsonb)'::regprocedure
     ),'UTF8')),'hex') <> '8f938dc266a7f2d9f2e1cb8d6b4f2a82e5d8841ee72b64f8fc610edf6fa48e99'
     or encode(pg_catalog.sha256(convert_to(pg_get_functiondef(
       'public.apply_approved_reviewed_catalogue_v3_plan(uuid,jsonb,jsonb)'::regprocedure
     ),'UTF8')),'hex') <> 'b6670a735282f9d04d0064ce2a3bdbbca055d1b99201a4db87fed2d50a25c734'
     or encode(pg_catalog.sha256(convert_to(pg_get_functiondef(
       'public.approve_reviewed_catalogue_v3_plan(jsonb,jsonb,timestamptz)'::regprocedure
     ),'UTF8')),'hex') <> '1f83251fc3628e2a772e8e647fe3f5be188fea0d221174cec263d7db968443c1' then
    raise exception 'reviewed V3 evidence parity lineage differs';
  end if;

  foreach v_function in array array[
    'public.atomic_import_reviewed_v3_physical_role_allowed(jsonb,jsonb)'::regprocedure,
    'public.atomic_import_reviewed_v3_count_role_allowed(jsonb,jsonb)'::regprocedure
  ] loop
    if not exists(
      select 1 from pg_proc p where p.oid=v_function and p.proowner='postgres'::regrole
        and p.provolatile='i' and p.prosecdef
        and p.proconfig=array['search_path=pg_catalog, public, pg_temp']::text[]
    ) or exists(
      select 1 from pg_proc p
      cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) acl
      where p.oid=v_function and acl.grantee<>p.proowner and acl.privilege_type='EXECUTE'
    ) then
      raise exception 'reviewed V3 evidence parity role metadata differs: %',v_function;
    end if;
  end loop;

  v_function:='public.atomic_import_reviewed_v3_legacy_validation_projection(jsonb,jsonb)'::regprocedure;
  if not exists(
    select 1 from pg_proc p where p.oid=v_function and p.proowner='postgres'::regrole
      and p.provolatile='s' and p.prosecdef
      and p.proconfig=array['search_path=pg_catalog, public, pg_temp']::text[]
  ) or exists(
    select 1 from pg_proc p
    cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) acl
    where p.oid=v_function and acl.grantee<>p.proowner and acl.privilege_type='EXECUTE'
  ) then
    raise exception 'reviewed V3 evidence parity projection metadata differs';
  end if;
  v_function:='public.atomic_import_apply_standard_plan_core(jsonb)'::regprocedure;
  if not exists(
    select 1 from pg_proc p where p.oid=v_function and p.proowner='postgres'::regrole
      and p.provolatile='v' and p.prosecdef
      and p.proconfig=array['search_path=pg_catalog, public, pg_temp']::text[]
  ) or exists(
    select 1 from pg_proc p
    cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) acl
    where p.oid=v_function and acl.grantee<>p.proowner and acl.privilege_type='EXECUTE'
  ) then
    raise exception 'reviewed V3 evidence parity standard core metadata differs';
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
  perform set_config('app.reviewed_v3_evidence_parity_counts',v_counts::text,true);
end
$preflight$;

create or replace function public.atomic_import_reviewed_v3_physical_role_allowed(p_options jsonb,p_role jsonb)
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
$physical$;

create or replace function public.atomic_import_reviewed_v3_count_role_allowed(p_options jsonb,p_role jsonb)
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
$count$;

create or replace function public.atomic_import_reviewed_v3_legacy_validation_projection(
  p_plan jsonb,
  p_envelope jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $projection$
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

  v_evidence:=v_evidence-array['unit_count','unit_type'];
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
    if lower(btrim(coalesce(v_physical_key,'')))='size' then null;
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
$projection$;

do $install_standard_core$
declare
  v_definition text:=pg_get_functiondef('public.atomic_import_apply_standard_plan_core(jsonb)'::regprocedure);
  v_original text:=$anchor$  v_evidence := p_plan#>'{product_variant,evidence}';$anchor$;
  v_patched text:=$anchor$  v_evidence := v_reviewed_v3_legacy_evidence;$anchor$;
begin
  if (length(v_definition)-length(replace(v_definition,v_original,'')))/length(v_original)<>1
     or position('v_reviewed_v3_legacy_evidence := public.atomic_import_reviewed_v3_legacy_validation_evidence(' in v_definition)=0 then
    raise exception 'reviewed V3 evidence parity standard core anchor differs';
  end if;
  execute replace(v_definition,v_original,v_patched);
end
$install_standard_core$;

alter function public.atomic_import_reviewed_v3_physical_role_allowed(jsonb,jsonb) owner to postgres;
alter function public.atomic_import_reviewed_v3_count_role_allowed(jsonb,jsonb) owner to postgres;
alter function public.atomic_import_reviewed_v3_legacy_validation_projection(jsonb,jsonb) owner to postgres;
alter function public.atomic_import_apply_standard_plan_core(jsonb) owner to postgres;
revoke all on function public.atomic_import_reviewed_v3_physical_role_allowed(jsonb,jsonb) from public,anon,authenticated,service_role;
revoke all on function public.atomic_import_reviewed_v3_count_role_allowed(jsonb,jsonb) from public,anon,authenticated,service_role;
revoke all on function public.atomic_import_reviewed_v3_legacy_validation_projection(jsonb,jsonb) from public,anon,authenticated,service_role;
revoke all on function public.atomic_import_apply_standard_plan_core(jsonb) from public,anon,authenticated,service_role;

do $environment_acl$
declare v_role text; v_function text;
begin
  foreach v_role in array array[
    'retailer_catalogue_staging_validator','retailer_catalogue_staging_approver','retailer_catalogue_staging_executor',
    'retailer_catalogue_production_validator','retailer_catalogue_production_approver','retailer_catalogue_production_executor'
  ] loop
    if to_regrole(v_role) is not null then
      foreach v_function in array array[
        'public.atomic_import_reviewed_v3_physical_role_allowed(jsonb,jsonb)',
        'public.atomic_import_reviewed_v3_count_role_allowed(jsonb,jsonb)',
        'public.atomic_import_reviewed_v3_legacy_validation_projection(jsonb,jsonb)',
        'public.atomic_import_apply_standard_plan_core(jsonb)'
      ] loop
        execute format('revoke all on function %s from %I',v_function,v_role);
      end loop;
    end if;
  end loop;
end
$environment_acl$;

do $postflight$
declare
  v_counts_before jsonb:=current_setting('app.reviewed_v3_evidence_parity_counts')::jsonb;
  v_counts_after jsonb;
  v_physical_sha text;
  v_count_sha text;
  v_projection_sha text;
  v_standard_core_sha text;
  v_function regprocedure;
begin
  v_physical_sha:=encode(pg_catalog.sha256(convert_to(pg_get_functiondef('public.atomic_import_reviewed_v3_physical_role_allowed(jsonb,jsonb)'::regprocedure),'UTF8')),'hex');
  v_count_sha:=encode(pg_catalog.sha256(convert_to(pg_get_functiondef('public.atomic_import_reviewed_v3_count_role_allowed(jsonb,jsonb)'::regprocedure),'UTF8')),'hex');
  v_projection_sha:=encode(pg_catalog.sha256(convert_to(pg_get_functiondef('public.atomic_import_reviewed_v3_legacy_validation_projection(jsonb,jsonb)'::regprocedure),'UTF8')),'hex');
  v_standard_core_sha:=encode(pg_catalog.sha256(convert_to(pg_get_functiondef('public.atomic_import_apply_standard_plan_core(jsonb)'::regprocedure),'UTF8')),'hex');
  if v_physical_sha<>'154d86c8abd1a0dc5aaa0bc71704be17c590af578dfffbea2adff82847068a49'
     or v_count_sha<>'90afc70b4adfa0d2836d501d240e1e98c72fec0d8ce0df99227de86b7f548f5a'
     or v_projection_sha<>'cc0be112418a5843f1526d9ee2c746564cb9ec40d6be1ff26724fbc92934bda5' then
    raise exception 'reviewed V3 evidence parity postflight SHAs: physical=%, count=%, projection=%',v_physical_sha,v_count_sha,v_projection_sha;
  end if;
  if v_standard_core_sha not in ('0fb47d632b21b4323a16fd4e9a3ec9886b747a21014e247e8d73f7999a586209','9367d8cd30f742a163b2f4b4a8f48488b432862bb5c8b04d61755884ea72fe0c') then
    raise exception 'reviewed V3 evidence parity postflight standard core SHA: %',v_standard_core_sha;
  end if;
  if encode(pg_catalog.sha256(convert_to(pg_get_functiondef('public.atomic_import_reviewed_v3_legacy_validation_evidence(jsonb,jsonb)'::regprocedure),'UTF8')),'hex')
       <> 'a5b8a05c0dc9cba672cbb4607c8d63660744165f88d2807e26d299159277b0f8'
     or encode(pg_catalog.sha256(convert_to(pg_get_functiondef('public.atomic_import_validate_reviewed_catalogue_v3_plan(jsonb,jsonb)'::regprocedure),'UTF8')),'hex')
       <> '04392ff0eff0e814ba54e41d0b9af38478174eda6f427e7eefcc35d18c7b3e0c' then
    raise exception 'reviewed V3 evidence parity changed supporting lineage';
  end if;
  foreach v_function in array array[
    'public.atomic_import_reviewed_v3_physical_role_allowed(jsonb,jsonb)'::regprocedure,
    'public.atomic_import_reviewed_v3_count_role_allowed(jsonb,jsonb)'::regprocedure,
    'public.atomic_import_reviewed_v3_legacy_validation_projection(jsonb,jsonb)'::regprocedure,
    'public.atomic_import_apply_standard_plan_core(jsonb)'::regprocedure
  ] loop
    if not exists(
      select 1 from pg_proc p where p.oid=v_function and p.proowner='postgres'::regrole and p.prosecdef
        and p.proconfig=array['search_path=pg_catalog, public, pg_temp']::text[]
        and p.provolatile=case
          when v_function::text like '%physical_role_allowed%' or v_function::text like '%count_role_allowed%' then 'i'::"char"
          when v_function::text like '%legacy_validation_projection%' then 's'::"char"
          else 'v'::"char" end
    ) or exists(
      select 1 from pg_proc p
      cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) acl
      where p.oid=v_function and acl.grantee<>p.proowner and acl.privilege_type='EXECUTE'
    ) then
      raise exception 'reviewed V3 evidence parity postflight metadata differs: %',v_function;
    end if;
  end loop;
  select jsonb_build_object(
    'retailers',(select count(*) from public.retailers),'products',(select count(*) from public.products),
    'product_variants',(select count(*) from public.product_variants),'retailer_products',(select count(*) from public.retailer_products),
    'offers',(select count(*) from public.offers),'price_history',(select count(*) from public.price_history),
    'approved_import_plans',(select count(*) from public.approved_import_plans)
  ) into v_counts_after;
  if v_counts_after is distinct from v_counts_before then
    raise exception 'reviewed V3 evidence parity migration changed business counts';
  end if;
end
$postflight$;

commit;
