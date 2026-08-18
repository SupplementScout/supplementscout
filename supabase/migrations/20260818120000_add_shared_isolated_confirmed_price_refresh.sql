begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

create or replace function public.require_retailer_price_confirmation(
  p_request jsonb,
  p_retailer_id text,
  p_retailer_slug text
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_proof jsonb:=p_request->'retailer_price_confirmation';
begin
  if not public.atomic_import_has_exact_keys(v_proof,array['kind','retailer_id','retailer_slug','first_source_fingerprint','second_source_fingerprint','first_mapped_fingerprint','second_mapped_fingerprint','second_captured_at','confirmed_offer_ids','proof_fingerprint'])
     or v_proof->>'kind'<>'retailer-two-capture-price-confirmation-v1'
     or v_proof->>'retailer_id'<>p_retailer_id
     or v_proof->>'retailer_slug'<>p_retailer_slug
     or p_request#>>'{artifact,target_environment}'<>'PRODUCTION'
     or p_request#>>'{artifact,retailer_id}'<>p_retailer_id
     or p_request#>>'{artifact,retailer_slug}'<>p_retailer_slug
     or v_proof->>'first_source_fingerprint' is distinct from p_request#>>'{artifact,source_snapshot_fingerprint}'
     or v_proof->>'first_mapped_fingerprint' is distinct from v_proof->>'second_mapped_fingerprint'
     or v_proof->>'first_mapped_fingerprint'!~'^[0-9a-f]{64}$'
     or v_proof->>'second_source_fingerprint'!~'^[0-9a-f]{64}$'
     or (v_proof->>'second_captured_at')::timestamptz<now()-interval '15 minutes'
     or (v_proof->>'second_captured_at')::timestamptz>now()+interval '2 minutes'
     or jsonb_typeof(v_proof->'confirmed_offer_ids') is distinct from 'array'
     or jsonb_array_length(v_proof->'confirmed_offer_ids')<1
     or v_proof->>'proof_fingerprint'!~'^[0-9a-f]{64}$'
     or public.retailer_catalogue_sha256_json(jsonb_set(v_proof,'{proof_fingerprint}','null'::jsonb,false)) is distinct from v_proof->>'proof_fingerprint'
     or p_request->>'package_fingerprint'!~'^[0-9a-f]{64}$'
     or public.retailer_catalogue_sha256_json(jsonb_set(p_request,'{package_fingerprint}','null'::jsonb,false)) is distinct from p_request->>'package_fingerprint'
     or exists(select 1 from jsonb_array_elements(p_request#>'{artifact,rows}') row(value)
       where (row.value#>>'{atomic_plan,offer,values,price}')::numeric<=0)
     or (select coalesce(jsonb_agg(value->>'offer_id' order by (value->>'offer_id')::bigint),'[]'::jsonb)
           from jsonb_array_elements(p_request#>'{artifact,rows}') row(value)
          where (value#>>'{changed_fields,price}')::boolean
            and (abs((value#>>'{atomic_plan,offer,values,price}')::numeric-(value#>>'{atomic_plan,expected_state,offer,price}')::numeric)>=(p_request#>>'{guardrails,limits,price_anomaly_absolute_gbp}')::numeric
              or abs((value#>>'{atomic_plan,offer,values,price}')::numeric-(value#>>'{atomic_plan,expected_state,offer,price}')::numeric)/greatest(0.01,(value#>>'{atomic_plan,expected_state,offer,price}')::numeric)>=(p_request#>>'{guardrails,limits,price_anomaly_ratio}')::numeric))
        is distinct from v_proof->'confirmed_offer_ids' then
    perform public.retailer_catalogue_raise('RSBI_GUARDRAIL_EXCEEDED','Retailer confirmed price scope or evidence mismatch');
  end if;
  p_request:=p_request-'retailer_price_confirmation';
  return jsonb_set(p_request,'{package_fingerprint}',to_jsonb(public.retailer_catalogue_sha256_json(jsonb_set(p_request,'{package_fingerprint}','null'::jsonb,false))),false);
end
$$;

do $shared_confirmed_validators$
declare
  v_target jsonb:=public.retailer_catalogue_actual_database_target();
  v_dispatch regprocedure:='public.retailer_offer_sync_validate_batch_read_only_internal(jsonb)'::regprocedure;
  v_dispatch_definition text:=pg_get_functiondef(v_dispatch);
  v_anchor text:=$old$  if p_request ? 'jons_price_confirmation'$old$;
  v_route text:=$new$  if p_request ? 'retailer_price_confirmation' then
    case p_request#>>'{artifact,retailer_id}'
      when '9' then return public.validate_fit_house_confirmed_price_read_only(p_request);
      when '7' then return public.validate_simply_confirmed_price_read_only(p_request);
      when '5' then return public.validate_dolphin_confirmed_price_read_only(p_request);
      else perform public.retailer_catalogue_raise('RSBI_GUARDRAIL_EXCEEDED','Unsupported retailer price confirmation scope');
    end case;
  end if;
  if p_request ? 'jons_price_confirmation'$new$;
  v_source regprocedure;
  v_definition text;
  v_source_name text;
  v_new_name text;
  v_id text;
  v_slug text;
  v_begin_anchor text:='begin'||chr(10);
  v_begin_replacement text;
  v_rows text[][]:=array[
    ['public.validate_fit_house_stable_oos_read_only(jsonb)','validate_fit_house_stable_oos_read_only','validate_fit_house_confirmed_price_read_only','9','fit-house'],
    ['public.retailer_offer_sync_validate_batch_read_only_unreviewed_interna(jsonb)','retailer_offer_sync_validate_batch_read_only_unreviewed_interna','validate_simply_confirmed_price_read_only','7','simply-supplements'],
    ['public.validate_dolphin_single_offer_read_only(jsonb)','validate_dolphin_single_offer_read_only','validate_dolphin_confirmed_price_read_only','5','dolphin-vegan-protein']
  ];
  v_row text[];
begin
  if current_user<>'postgres' or v_target->>'target_environment'<>'PRODUCTION' then
    raise exception 'Shared confirmed price validators require production database owner';
  end if;
  foreach v_row slice 1 in array v_rows loop
    v_source:=v_row[1]::regprocedure; v_source_name:=v_row[2]; v_new_name:=v_row[3]; v_id:=v_row[4]; v_slug:=v_row[5];
    if to_regprocedure('public.'||v_new_name||'(jsonb)') is not null then raise exception 'Confirmed validator already exists: %',v_new_name; end if;
    v_definition:=pg_get_functiondef(v_source);
    if position('or v_price_anomalies>0' in v_definition)=0 then raise exception 'Confirmed validator anomaly anchor mismatch: %',v_new_name; end if;
    v_definition:=replace(v_definition,v_source_name,v_new_name);
    v_begin_replacement:='begin'||chr(10)||'  p_request:=public.require_retailer_price_confirmation(p_request,'''||v_id||''','''||v_slug||''');'||chr(10);
    if position(v_begin_anchor in v_definition)=0 then raise exception 'Confirmed validator begin anchor mismatch: %',v_new_name; end if;
    v_definition:=overlay(v_definition placing v_begin_replacement from position(v_begin_anchor in v_definition) for length(v_begin_anchor));
    v_definition:=replace(v_definition,'or v_price_anomalies>0','or false /* price anomalies exactly confirmed above */');
    execute v_definition;
  end loop;
  if position(v_anchor in v_dispatch_definition)=0 then raise exception 'Shared confirmed price dispatcher anchor mismatch'; end if;
  execute replace(v_dispatch_definition,v_anchor,v_route);
end
$shared_confirmed_validators$;

do $allow_shared_isolated_batches$
declare
  v_function regprocedure;
  v_definition text;
  v_name text;
  v_names text[]:=array['register_fit_house_offer_sync_control_plan','register_simply_supplements_offer_sync_control_plan','register_dolphin_vegan_protein_offer_sync_control_plan'];
begin
  foreach v_name in array v_names loop
    v_function:=('public.'||v_name||'(jsonb)')::regprocedure;
    v_definition:=pg_get_functiondef(v_function);
    if position('v_row_count<>v_manifest_count' in v_definition)=0
       or position('cardinality(v_seen_mapping_ids)<>v_manifest_count' in v_definition)=0
       or position('cardinality(v_seen_offer_ids)<>v_manifest_count' in v_definition)=0
       or position('Child rows do not cover the exact approved manifest' in v_definition)=0 then
      raise exception 'Isolated registration anchor mismatch: %',v_name;
    end if;
    v_definition:=replace(v_definition,'v_row_count<>v_manifest_count','v_row_count<1 or v_row_count>v_manifest_count');
    v_definition:=replace(v_definition,'cardinality(v_seen_mapping_ids)<>v_manifest_count','cardinality(v_seen_mapping_ids)<>v_row_count');
    v_definition:=replace(v_definition,'cardinality(v_seen_offer_ids)<>v_manifest_count','cardinality(v_seen_offer_ids)<>v_row_count');
    v_definition:=replace(v_definition,'Child rows do not cover the exact approved manifest','Isolated child rows do not reconcile with the approved manifest');
    v_definition:=replace(v_definition,$old$'operation_count',v_manifest_count$old$,$new$'operation_count',v_row_count$new$);
    execute v_definition;
  end loop;
end
$allow_shared_isolated_batches$;

alter function public.require_retailer_price_confirmation(jsonb,text,text) owner to postgres;
revoke all on function public.require_retailer_price_confirmation(jsonb,text,text) from public,anon,authenticated,service_role;
alter function public.validate_fit_house_confirmed_price_read_only(jsonb) owner to postgres;
alter function public.validate_simply_confirmed_price_read_only(jsonb) owner to postgres;
alter function public.validate_dolphin_confirmed_price_read_only(jsonb) owner to postgres;
revoke all on function public.validate_fit_house_confirmed_price_read_only(jsonb) from public,anon,authenticated,service_role;
revoke all on function public.validate_simply_confirmed_price_read_only(jsonb) from public,anon,authenticated,service_role;
revoke all on function public.validate_dolphin_confirmed_price_read_only(jsonb) from public,anon,authenticated,service_role;

commit;
