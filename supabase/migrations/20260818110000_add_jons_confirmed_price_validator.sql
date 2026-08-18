begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $jons_confirmed_price_validator$
declare
  v_target jsonb:=public.retailer_catalogue_actual_database_target();
  v_source regprocedure:='public.retailer_offer_sync_validate_batch_read_only_unreviewed_interna(jsonb)'::regprocedure;
  v_definition text:=pg_get_functiondef(v_source);
  v_begin_anchor text:=E'begin\n  if not public.atomic_import_has_exact_keys';
  v_begin_replacement text:=E'begin\n  /* Jon''s automatic prices require two identical mapped-source captures. */\n'
    || E'  if not (p_request ? ''jons_price_confirmation'')\n'
    || E'     or p_request#>>''{artifact,target_environment}''<>''PRODUCTION''\n'
    || E'     or p_request#>>''{artifact,retailer_id}''<>''10''\n'
    || E'     or p_request#>>''{artifact,retailer_slug}''<>''jon-s-supplements''\n'
    || E'     or not public.atomic_import_has_exact_keys(p_request->''jons_price_confirmation'',array[''kind'',''first_source_fingerprint'',''second_source_fingerprint'',''first_mapped_fingerprint'',''second_mapped_fingerprint'',''second_captured_at'',''confirmed_offer_ids'',''proof_fingerprint''])\n'
    || E'     or p_request#>>''{jons_price_confirmation,kind}''<>''jons-two-capture-price-confirmation-v1''\n'
    || E'     or p_request#>>''{jons_price_confirmation,first_source_fingerprint}'' is distinct from p_request#>>''{artifact,source_snapshot_fingerprint}''\n'
    || E'     or p_request#>>''{jons_price_confirmation,first_mapped_fingerprint}'' is distinct from p_request#>>''{jons_price_confirmation,second_mapped_fingerprint}''\n'
    || E'     or p_request#>>''{jons_price_confirmation,first_mapped_fingerprint}''!~''^[0-9a-f]{64}$''\n'
    || E'     or p_request#>>''{jons_price_confirmation,second_source_fingerprint}''!~''^[0-9a-f]{64}$''\n'
    || E'     or (p_request#>>''{jons_price_confirmation,second_captured_at}'')::timestamptz<now()-interval ''15 minutes''\n'
    || E'     or (p_request#>>''{jons_price_confirmation,second_captured_at}'')::timestamptz>now()+interval ''2 minutes''\n'
    || E'     or jsonb_typeof(p_request#>''{jons_price_confirmation,confirmed_offer_ids}'') is distinct from ''array''\n'
    || E'     or jsonb_array_length(p_request#>''{jons_price_confirmation,confirmed_offer_ids}'')<1\n'
    || E'     or p_request#>>''{jons_price_confirmation,proof_fingerprint}''!~''^[0-9a-f]{64}$''\n'
    || E'     or public.retailer_catalogue_sha256_json(jsonb_set(p_request->''jons_price_confirmation'',''{proof_fingerprint}'',''null''::jsonb,false)) is distinct from p_request#>>''{jons_price_confirmation,proof_fingerprint}''\n'
    || E'     or p_request->>''package_fingerprint''!~''^[0-9a-f]{64}$''\n'
    || E'     or public.retailer_catalogue_sha256_json(jsonb_set(p_request,''{package_fingerprint}'',''null''::jsonb,false)) is distinct from p_request->>''package_fingerprint''\n'
    || E'     or exists(select 1 from jsonb_array_elements(p_request#>''{artifact,rows}'') row(value)\n'
    || E'       where (row.value#>>''{atomic_plan,offer,values,price}'')::numeric<=0)\n'
    || E'     or (select coalesce(jsonb_agg(value->>''offer_id'' order by (value->>''offer_id'')::bigint),''[]''::jsonb)\n'
    || E'         from jsonb_array_elements(p_request#>''{artifact,rows}'') row(value)\n'
    || E'         where (value#>>''{changed_fields,price}'')::boolean\n'
    || E'           and (abs((value#>>''{atomic_plan,offer,values,price}'')::numeric-(value#>>''{atomic_plan,expected_state,offer,price}'')::numeric)>=(p_request#>>''{guardrails,limits,price_anomaly_absolute_gbp}'')::numeric\n'
    || E'             or abs((value#>>''{atomic_plan,offer,values,price}'')::numeric-(value#>>''{atomic_plan,expected_state,offer,price}'')::numeric)/greatest(0.01,(value#>>''{atomic_plan,expected_state,offer,price}'')::numeric)>=(p_request#>>''{guardrails,limits,price_anomaly_ratio}'')::numeric))\n'
    || E'        is distinct from p_request#>''{jons_price_confirmation,confirmed_offer_ids}'' then\n'
    || E'    perform public.retailer_catalogue_raise(''RSBI_GUARDRAIL_EXCEEDED'',''Jon''''s confirmed price scope or evidence mismatch'');\n'
    || E'  end if;\n'
    || E'  p_request:=p_request-''jons_price_confirmation'';\n'
    || E'  p_request:=jsonb_set(p_request,''{package_fingerprint}'',to_jsonb(public.retailer_catalogue_sha256_json(jsonb_set(p_request,''{package_fingerprint}'',''null''::jsonb,false))),false);\n'
    || E'  if not public.atomic_import_has_exact_keys';
  v_dispatch regprocedure:='public.retailer_offer_sync_validate_batch_read_only_internal(jsonb)'::regprocedure;
  v_dispatch_definition text:=pg_get_functiondef(v_dispatch);
  v_dispatch_anchor text:=$old$  if p_request ? 'reviewed_mixed_change_contract' then
    return public.retailer_offer_sync_validate_reviewed_mixed_change_internal(p_request);
  end if;$old$;
  v_dispatch_replacement text:=$new$  if p_request ? 'reviewed_mixed_change_contract' then
    return public.retailer_offer_sync_validate_reviewed_mixed_change_internal(p_request);
  end if;
  if p_request ? 'jons_price_confirmation'
     and p_request#>>'{artifact,target_environment}'='PRODUCTION'
     and p_request#>>'{artifact,retailer_id}'='10' then
    return public.validate_jons_confirmed_price_read_only(p_request);
  end if;$new$;
begin
  if current_user<>'postgres'
     or v_target->>'target_environment'<>'PRODUCTION'
     or v_target->>'project_ref'<>'aftboxmrdgyhizicfsfu'
     or v_target->>'database_identity'<>'supplementscout-production:aftboxmrdgyhizicfsfu' then
    raise exception 'Jon''s confirmed price validator requires production database owner';
  end if;
  if to_regprocedure('public.validate_jons_confirmed_price_read_only(jsonb)') is not null
     or position(v_begin_anchor in v_definition)=0
     or position('or v_price_anomalies>0' in v_definition)=0
     or position(v_dispatch_anchor in v_dispatch_definition)=0 then
    raise exception 'Jon''s confirmed price validator exact anchor mismatch';
  end if;
  v_definition:=replace(v_definition,
    'retailer_offer_sync_validate_batch_read_only_unreviewed_interna',
    'validate_jons_confirmed_price_read_only');
  v_definition:=replace(v_definition,v_begin_anchor,v_begin_replacement);
  v_definition:=replace(v_definition,'or v_price_anomalies>0','or false /* Jon''s anomalies were exactly confirmed above */');
  execute v_definition;
  execute replace(v_dispatch_definition,v_dispatch_anchor,v_dispatch_replacement);
end
$jons_confirmed_price_validator$;

alter function public.validate_jons_confirmed_price_read_only(jsonb) owner to postgres;
revoke all on function public.validate_jons_confirmed_price_read_only(jsonb)
  from public,anon,authenticated,service_role;
alter function public.retailer_offer_sync_validate_batch_read_only_internal(jsonb) owner to postgres;
revoke all on function public.retailer_offer_sync_validate_batch_read_only_internal(jsonb)
  from public,anon,authenticated,service_role;

do $verify_jons_confirmed_price_validator$
declare
  v_validator text:=pg_get_functiondef('public.validate_jons_confirmed_price_read_only(jsonb)'::regprocedure);
  v_dispatch text:=pg_get_functiondef('public.retailer_offer_sync_validate_batch_read_only_internal(jsonb)'::regprocedure);
begin
  if position('Jon''s automatic prices require two identical mapped-source captures' in v_validator)=0
     or position('jons-two-capture-price-confirmation-v1' in v_validator)=0
     or position('or false /* Jon''s anomalies were exactly confirmed above */' in v_validator)=0
     or position('validate_jons_confirmed_price_read_only' in v_dispatch)=0 then
    raise exception 'Jon''s confirmed price validator verification failed';
  end if;
end
$verify_jons_confirmed_price_validator$;

commit;
