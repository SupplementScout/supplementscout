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
  v_kind text:=v_proof->>'kind';
  v_expected_ids jsonb;
begin
  if v_kind='retailer-two-capture-price-confirmation-v2' and p_retailer_id='7' then
    select coalesce(jsonb_agg(value->>'offer_id' order by (value->>'offer_id')::bigint),'[]'::jsonb)
      into v_expected_ids
      from jsonb_array_elements(p_request#>'{artifact,rows}') row(value)
     where (value#>>'{changed_fields,price}')::boolean;
  elsif v_kind='retailer-two-capture-price-confirmation-v1' then
    select coalesce(jsonb_agg(value->>'offer_id' order by (value->>'offer_id')::bigint),'[]'::jsonb)
      into v_expected_ids
      from jsonb_array_elements(p_request#>'{artifact,rows}') row(value)
     where (value#>>'{changed_fields,price}')::boolean
       and (abs((value#>>'{atomic_plan,offer,values,price}')::numeric-(value#>>'{atomic_plan,expected_state,offer,price}')::numeric)>=(p_request#>>'{guardrails,limits,price_anomaly_absolute_gbp}')::numeric
         or abs((value#>>'{atomic_plan,offer,values,price}')::numeric-(value#>>'{atomic_plan,expected_state,offer,price}')::numeric)/greatest(0.01,(value#>>'{atomic_plan,expected_state,offer,price}')::numeric)>=(p_request#>>'{guardrails,limits,price_anomaly_ratio}')::numeric);
  else
    perform public.retailer_catalogue_raise('RSBI_GUARDRAIL_EXCEEDED','Retailer confirmed price scope or evidence mismatch');
  end if;

  if not public.atomic_import_has_exact_keys(v_proof,array['kind','retailer_id','retailer_slug','first_source_fingerprint','second_source_fingerprint','first_mapped_fingerprint','second_mapped_fingerprint','second_captured_at','confirmed_offer_ids','proof_fingerprint'])
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
     or v_expected_ids is distinct from v_proof->'confirmed_offer_ids' then
    perform public.retailer_catalogue_raise('RSBI_GUARDRAIL_EXCEEDED','Retailer confirmed price scope or evidence mismatch');
  end if;
  p_request:=p_request-'retailer_price_confirmation';
  return jsonb_set(p_request,'{package_fingerprint}',to_jsonb(public.retailer_catalogue_sha256_json(jsonb_set(p_request,'{package_fingerprint}','null'::jsonb,false))),false);
end
$$;

alter function public.require_retailer_price_confirmation(jsonb,text,text) owner to postgres;
revoke all on function public.require_retailer_price_confirmation(jsonb,text,text) from public,anon,authenticated,service_role;

commit;
