begin;
set local lock_timeout='5s';
set local statement_timeout='120s';
select pg_advisory_xact_lock(hashtextextended('reviewed-catalogue-v3-schema',0));

do $preflight$
declare
  v_validator regprocedure:='public.atomic_import_validate_reviewed_catalogue_v3_plan(jsonb,jsonb)'::regprocedure;
begin
  if current_user<>'postgres' or encode(pg_catalog.sha256(convert_to(pg_get_functiondef(v_validator),'UTF8')),'hex')<>'04392ff0eff0e814ba54e41d0b9af38478174eda6f427e7eefcc35d18c7b3e0c' then
    raise exception 'reviewed V3 canonical evidence validator lineage differs';
  end if;
  if exists(select 1 from public.approved_import_plans where source~'^reviewed-catalogue-package-v3:' and status='approved' and consumed_at is null and expires_at>now()) then
    raise exception 'reviewed V3 canonical evidence blocked by live approval';
  end if;
end
$preflight$;

create function public.atomic_import_reviewed_v3_canonical_role_allowed(p_plan jsonb,p_envelope jsonb,p_role text)
returns boolean
language plpgsql
stable
security definer
set search_path=pg_catalog, public, pg_temp
as $canonical$
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
$canonical$;

alter function public.atomic_import_reviewed_v3_canonical_role_allowed(jsonb,jsonb,text) owner to postgres;
revoke all on function public.atomic_import_reviewed_v3_canonical_role_allowed(jsonb,jsonb,text) from public,anon,authenticated,service_role;

do $patch$
declare
  v_function regprocedure:='public.atomic_import_validate_reviewed_catalogue_v3_plan(jsonb,jsonb)'::regprocedure;
  v_definition text:=pg_get_functiondef(v_function);
begin
  v_definition:=replace(v_definition,$a$if not public.atomic_import_has_exact_keys(p_envelope,array[
       'schema_version','kind','source_platform','target_environment','target_project_ref','retailer',
       'profile_id','manifest_sha256','artifact_sha256','run_id','review_row','reviewed_action',
       'external_product_id','external_variant_id','direct_source_url','affiliate_url','external_options',
       'option_roles','source_structure','source_row_fingerprint','plan_fingerprint'
     ])$a$,$b$if not (
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
     )$b$);
  v_definition:=replace(v_definition,$a$or v_external_options is distinct from coalesce(v_mapping->'external_options','{}'::jsonb) then$a$,$b$or v_external_options is distinct from coalesce(v_mapping->'external_options','{}'::jsonb)
     or coalesce(p_envelope->'canonical_identity_evidence','null'::jsonb) is distinct from coalesce(p_plan#>'{product_variant,evidence,canonical_identity_evidence}','null'::jsonb) then$b$);
  v_definition:=replace(v_definition,$a$  if p_envelope->>'external_product_id' !~ '^[0-9]{10,}$'$a$,$b$  if p_envelope ? 'canonical_identity_evidence' and not public.atomic_import_reviewed_v3_canonical_role_allowed(p_plan,p_envelope,'_validate_only') then
    raise exception 'V3_CANONICAL_EVIDENCE_SCHEMA_MISMATCH';
  end if;

  if p_envelope->>'external_product_id' !~ '^[0-9]{10,}$'$b$);
  v_definition:=replace(v_definition,$a$if not public.atomic_import_reviewed_v3_physical_role_allowed(v_external_options,v_physical) then$a$,$b$if not public.atomic_import_reviewed_v3_physical_role_allowed(v_external_options,v_physical)
     and not public.atomic_import_reviewed_v3_canonical_role_allowed(p_plan,p_envelope,'physical_size') then$b$);
  v_definition:=replace(v_definition,$a$if not public.atomic_import_reviewed_v3_count_role_allowed(v_external_options,v_count) then$a$,$b$if not public.atomic_import_reviewed_v3_count_role_allowed(v_external_options,v_count)
     and not public.atomic_import_reviewed_v3_canonical_role_allowed(p_plan,p_envelope,'container_count') then$b$);
  v_definition:=replace(v_definition,$a$if not public.atomic_import_is_decimal_string(v_variant_values->>'size_value')
         or (v_variant_values->>'size_value')::numeric<=0
         or v_physical->>'size_value' is distinct from v_variant_values->>'size_value'
         or v_physical->>'size_unit' is distinct from v_variant_values->>'size_unit' then$a$,$b$if (
           not public.atomic_import_is_decimal_string(v_variant_values->>'size_value')
           or (v_variant_values->>'size_value')::numeric<=0
           or v_physical->>'size_value' is distinct from v_variant_values->>'size_value'
           or v_physical->>'size_unit' is distinct from v_variant_values->>'size_unit'
         ) and not public.atomic_import_reviewed_v3_canonical_role_allowed(p_plan,p_envelope,'physical_size') then$b$);
  v_definition:=replace(v_definition,$a$if v_variant_values->'size_value'<>'null'::jsonb or v_variant_values->'size_unit'<>'null'::jsonb
         or coalesce(v_product_values->>'unit_count',p_plan#>>'{product_variant,evidence,unit_count}') is distinct from v_count->>'count_value'
         or coalesce(v_product_values->>'unit_type',p_plan#>>'{product_variant,evidence,unit_type}') is distinct from v_count->>'count_unit' then$a$,$b$if (
           v_variant_values->'size_value'<>'null'::jsonb or v_variant_values->'size_unit'<>'null'::jsonb
           or coalesce(v_product_values->>'unit_count',p_plan#>>'{product_variant,evidence,unit_count}') is distinct from v_count->>'count_value'
           or coalesce(v_product_values->>'unit_type',p_plan#>>'{product_variant,evidence,unit_type}') is distinct from v_count->>'count_unit'
         ) and not public.atomic_import_reviewed_v3_canonical_role_allowed(p_plan,p_envelope,'container_count') then$b$);
  v_definition:=replace(v_definition,$a$if jsonb_typeof(v_count)='object' and (
      coalesce(v_product_values->>'unit_count',p_plan#>>'{product_variant,evidence,unit_count}') is distinct from v_count->>'count_value'
      or coalesce(v_product_values->>'unit_type',p_plan#>>'{product_variant,evidence,unit_type}') is distinct from v_count->>'count_unit'
    ) then$a$,$b$if jsonb_typeof(v_count)='object' and (
      coalesce(v_product_values->>'unit_count',p_plan#>>'{product_variant,evidence,unit_count}') is distinct from v_count->>'count_value'
      or coalesce(v_product_values->>'unit_type',p_plan#>>'{product_variant,evidence,unit_type}') is distinct from v_count->>'count_unit'
    ) and not public.atomic_import_reviewed_v3_canonical_role_allowed(p_plan,p_envelope,'container_count') then$b$);
  if v_definition=pg_get_functiondef(v_function) then raise exception 'reviewed V3 canonical evidence patch anchors differ'; end if;
  execute v_definition;
end
$patch$;

alter function public.atomic_import_validate_reviewed_catalogue_v3_plan(jsonb,jsonb) owner to postgres;

do $postflight$
declare
  v_function regprocedure:='public.atomic_import_validate_reviewed_catalogue_v3_plan(jsonb,jsonb)'::regprocedure;
  v_helper regprocedure:='public.atomic_import_reviewed_v3_canonical_role_allowed(jsonb,jsonb,text)'::regprocedure;
  v_sha text;
begin
  v_sha:=encode(pg_catalog.sha256(convert_to(pg_get_functiondef(v_function),'UTF8')),'hex');
  if v_sha<>'033cd54202f3ed2946eb78ba37a311c5a56a4f6eb421c0424b3239ad75c19baf' then raise exception 'reviewed V3 canonical evidence postflight lineage differs: %',v_sha; end if;
  if not exists(select 1 from pg_proc where oid=v_function and proowner='postgres'::regrole and provolatile='s' and prosecdef and proconfig=array['search_path=pg_catalog, public, pg_temp']::text[]) then raise exception 'reviewed V3 canonical evidence validator metadata differs'; end if;
  if not exists(select 1 from pg_proc where oid=v_helper and proowner='postgres'::regrole and provolatile='s' and prosecdef and proconfig=array['search_path=pg_catalog, public, pg_temp']::text[])
     or has_function_privilege('anon',v_helper,'EXECUTE') or has_function_privilege('authenticated',v_helper,'EXECUTE') or has_function_privilege('service_role',v_helper,'EXECUTE') then
    raise exception 'reviewed V3 canonical evidence helper security differs';
  end if;
end
$postflight$;
commit;
