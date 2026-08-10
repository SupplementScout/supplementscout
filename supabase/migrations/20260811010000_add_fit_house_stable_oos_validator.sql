begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $fit_house_stable_oos_validator$
declare
  v_target jsonb:=public.retailer_catalogue_actual_database_target();
  v_source regprocedure:='public.retailer_offer_sync_validate_batch_read_only_unreviewed_interna(jsonb)'::regprocedure;
  v_definition text:=pg_get_functiondef(
    'public.retailer_offer_sync_validate_batch_read_only_unreviewed_interna(jsonb)'::regprocedure);
  v_source_sha_before text:=encode(pg_catalog.sha256(convert_to(v_definition,'UTF8')),'hex');
  v_begin_anchor text:=E'begin\n  if not public.atomic_import_has_exact_keys';
  v_begin_replacement text:=E'begin\n  if p_request#>>''{artifact,target_environment}''<>''PRODUCTION''\n'
    || E'     or p_request#>>''{artifact,retailer_id}''<>''9''\n'
    || E'     or p_request->>''policy_fingerprint''<>''6838770659dc772a3454846ad8e2e9e9620839b3ca688b118e9337231e520db6''\n'
    || E'     or p_request#>>''{artifact,policy_fingerprint}''<>''6838770659dc772a3454846ad8e2e9e9620839b3ca688b118e9337231e520db6''\n'
    || E'     or (select count(*) from public.retailer_products where retailer_id=9)<>286\n'
    || E'     or (select count(*) from public.offers where retailer_id=9)<>286\n'
    || E'     or (select count(*) from public.offers where retailer_id=9 and not in_stock)>103\n'
    || E'     or exists(select 1 from jsonb_array_elements(p_request#>''{artifact,rows}'') row(value)\n'
    || E'       where row.value#>>''{atomic_plan,retailer,id}''<>''9'') then\n'
    || E'    perform public.retailer_catalogue_raise(''RSBI_ENVIRONMENT_BLOCKED'',''Fit House stable OOS validator scope mismatch'');\n'
    || E'  end if;\n  /* Fit House exact approved stable OOS baseline: max 103 and no net increase */\n'
    || E'  if not public.atomic_import_has_exact_keys';
  v_total_anchor text:='or v_total_oos::numeric/v_row_count>v_maximum_total_oos';
  v_total_replacement text:='or v_total_oos>v_previous_oos';
  v_dispatch regprocedure:='public.retailer_offer_sync_validate_batch_read_only_internal(jsonb)'::regprocedure;
  v_dispatch_definition text:=pg_get_functiondef(v_dispatch);
  v_dispatch_anchor text:=$old$  if p_request ? 'reviewed_mixed_change_contract' then
    return public.retailer_offer_sync_validate_reviewed_mixed_change_internal(p_request);
  end if;$old$;
  v_dispatch_replacement text:=$new$  if p_request ? 'reviewed_mixed_change_contract' then
    return public.retailer_offer_sync_validate_reviewed_mixed_change_internal(p_request);
  end if;
  if p_request#>>'{artifact,target_environment}'='PRODUCTION'
     and p_request#>>'{artifact,retailer_id}'='9'
     and p_request->>'policy_fingerprint'='6838770659dc772a3454846ad8e2e9e9620839b3ca688b118e9337231e520db6' then
    return public.validate_fit_house_stable_oos_read_only(p_request);
  end if;$new$;
begin
  if current_user<>'postgres'
     or v_target->>'target_environment'<>'PRODUCTION'
     or v_target->>'project_ref'<>'aftboxmrdgyhizicfsfu'
     or v_target->>'database_identity'<>'supplementscout-production:aftboxmrdgyhizicfsfu' then
    raise exception 'Fit House stable OOS validator requires production database owner';
  end if;
  if to_regprocedure('public.validate_fit_house_stable_oos_read_only(jsonb)') is not null
     or v_source_sha_before<>'41f6add31de41778cf7d20b94f8c67647121815bbee1e50f8ef2f434f9eb19b8'
     or position(v_begin_anchor in v_definition)=0
     or position(v_total_anchor in v_definition)=0
     or position(v_dispatch_anchor in v_dispatch_definition)=0 then
    raise exception 'Fit House stable OOS validator exact anchor mismatch';
  end if;
  v_definition:=replace(v_definition,
    'retailer_offer_sync_validate_batch_read_only_unreviewed_interna',
    'validate_fit_house_stable_oos_read_only');
  v_definition:=replace(v_definition,v_begin_anchor,v_begin_replacement);
  v_definition:=replace(v_definition,v_total_anchor,v_total_replacement);
  execute v_definition;
  if to_regprocedure('public.validate_fit_house_stable_oos_read_only(jsonb)') is null
     or encode(pg_catalog.sha256(convert_to(pg_get_functiondef(v_source),'UTF8')),'hex')<>v_source_sha_before then
    raise exception 'Fit House stable OOS clone changed the shared source validator';
  end if;
  execute replace(v_dispatch_definition,v_dispatch_anchor,v_dispatch_replacement);
end
$fit_house_stable_oos_validator$;

alter function public.validate_fit_house_stable_oos_read_only(jsonb) owner to postgres;
revoke all on function public.validate_fit_house_stable_oos_read_only(jsonb)
  from public,anon,authenticated,service_role;
alter function public.retailer_offer_sync_validate_batch_read_only_internal(jsonb) owner to postgres;
revoke all on function public.retailer_offer_sync_validate_batch_read_only_internal(jsonb)
  from public,anon,authenticated,service_role;

do $verify$
declare
  v_fit text:=pg_get_functiondef('public.validate_fit_house_stable_oos_read_only(jsonb)'::regprocedure);
  v_dispatch text:=pg_get_functiondef('public.retailer_offer_sync_validate_batch_read_only_internal(jsonb)'::regprocedure);
begin
  if position('6838770659dc772a3454846ad8e2e9e9620839b3ca688b118e9337231e520db6' in v_fit)=0
     or position('retailer_id=9 and not in_stock)>103' in v_fit)=0
     or position('or v_total_oos>v_previous_oos' in v_fit)=0
     or position('or v_total_oos::numeric/v_row_count>v_maximum_total_oos' in v_fit)>0
     or position('v_maximum_new_oos not between 0 and 3' in v_fit)=0
     or position('v_maximum_oos_increase not between 0 and 0.15' in v_fit)=0
     or position('v_maximum_changed not between 0 and 0.25' in v_fit)=0
     or position('v_mass_price_ratio<=0 or v_mass_price_ratio>0.20' in v_fit)=0
     or position('validate_fit_house_stable_oos_read_only' in v_dispatch)=0 then
    raise exception 'Fit House stable OOS validator verification failed';
  end if;
end
$verify$;

commit;
