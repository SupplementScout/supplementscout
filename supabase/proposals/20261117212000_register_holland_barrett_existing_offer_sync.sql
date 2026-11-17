begin;
set local lock_timeout='5s';
set local statement_timeout='60s';

-- PREPARATION ONLY. This static frozen registration boundary reuses existing
-- control tables, validators, parent approvals, child executor and atomic importer.
-- No business row or approval is created by installation; no runtime cloning.
do $guard$
declare target jsonb:=public.retailer_catalogue_actual_database_target();
begin
  if current_user<>'postgres' or target->>'target_environment' is distinct from 'PRODUCTION' or target->>'project_ref' is distinct from 'aftboxmrdgyhizicfsfu' or target->>'database_identity' is distinct from 'supplementscout-production:aftboxmrdgyhizicfsfu' then raise exception 'HB_REGISTRATION_PROPOSAL_TARGET_MISMATCH'; end if;
  if to_regprocedure('public.register_holland_barrett_offer_sync_control_plan(jsonb)') is not null then raise exception 'HB_REGISTRATION_ALREADY_EXISTS'; end if;
  if to_regprocedure('public.retailer_offer_sync_parent_profiles()') is null then raise exception 'HB_PARENT_PROFILE_REQUIRED'; end if;
  if not exists(select 1 from public.retailer_offer_sync_parent_profiles() p where p.retailer_id=16 and p.retailer_slug='holland-barrett' and p.required_manifest_sha256='6c0ca5ee3bba035671ef587de2b9d08ae0a96402f1364e88e413b71f73cea3b8') then raise exception 'HB_PARENT_PROFILE_REQUIRED'; end if;
end
$guard$;

create function public.register_holland_barrett_offer_sync_control_plan(p_request jsonb)
returns jsonb language plpgsql volatile security definer
set search_path=pg_catalog,public,pg_temp
as $register$
declare
  v_effective_role text:=current_setting('role',true);
  v_expected_role text; v_expected_login text; v_target text;
  v_project_ref text; v_database_identity text; v_manifest jsonb;
  v_retailer_id bigint; v_expected_manifest_count integer;
  v_expected_manifest_sha text; v_expected_scope_fingerprint text;
  v_manifest_fingerprint text; v_entry jsonb; v_children jsonb; v_child jsonb;
  v_artifact jsonb; v_child_manifest jsonb:='[]'::jsonb;
  v_child_fingerprints jsonb:='[]'::jsonb; v_child_ids jsonb:='[]'::jsonb;
  v_expected_deltas jsonb:=jsonb_build_object(
    'row_count_deltas',jsonb_build_object('products',0,'product_variants',0,'retailer_products',0,'offers',0,'price_history',0),
    'logical_field_deltas',jsonb_build_object('offer_price_updates',0,'offer_shipping_updates',0,'offer_total_updates',0,'offer_stock_updates',0,'offer_url_updates',0,'mapping_url_updates',0,'mapping_updated_at_updates',0,'last_checked_at_updates',0));
  v_parent_hash_input jsonb; v_parent_plan jsonb; v_parent_id uuid;
  v_parent_fingerprint text; v_source_fingerprint text;
  v_source_captured_at timestamptz; v_expires_at timestamptz; v_code_commit text;
  v_first_expected_state text; v_first_adapter text; v_first_policy text;
  v_mapping public.retailer_products%rowtype; v_offer public.offers%rowtype;
  v_product public.products%rowtype; v_variant public.product_variants%rowtype;
  v_mapping_id bigint; v_offer_id bigint; v_previous_mapping_id bigint:=0;
  v_seen_mapping_ids bigint[]:='{}'::bigint[]; v_seen_offer_ids bigint[]:='{}'::bigint[];
  v_manifest_count integer; v_child_count integer; v_child_index integer:=0;
  v_row jsonb; v_row_count integer:=0; v_rows jsonb; v_record_ids jsonb;
  v_registration_actor text; v_approved_manifest_sha text; v_values jsonb; v_plan jsonb;
  v_price numeric; v_shipping numeric; v_total numeric;
begin
  if not public.atomic_import_has_exact_keys(p_request,array[
    'schema_version','kind','target_environment','target_project_ref','target_database_identity',
    'retailer_id','retailer_slug','source_platform','source_domain','source_country',
    'source_snapshot_fingerprint','source_captured_at','approved_manifest_sha256','manifest',
    'manifest_fingerprint','parent_plan_id','parent_plan_fingerprint','children','code_commit',
    'expires_at','workflow','request_fingerprint'])
    or p_request->>'schema_version'<>'1'
    or p_request->>'kind'<>'retailer-existing-offer-sync-control-plan-registration' then
    perform public.retailer_catalogue_raise('RSBI_SOURCE_SCHEMA_MISMATCH','Invalid approved retailer plan registration request');
  end if;

  v_target:=p_request->>'target_environment';
  if v_target is distinct from 'PRODUCTION' then
    perform public.retailer_catalogue_raise('RSBI_ENVIRONMENT_BLOCKED','H&B registration is production-only');
  end if;
  v_expected_role:='retailer_catalogue_production_validator';
  v_expected_login:='supplementscout_production_validator_login';
  v_project_ref:='aftboxmrdgyhizicfsfu';
  v_database_identity:='supplementscout-production:aftboxmrdgyhizicfsfu';
  v_retailer_id:=16;
  v_expected_manifest_count:=219;
  v_expected_manifest_sha:='6c0ca5ee3bba035671ef587de2b9d08ae0a96402f1364e88e413b71f73cea3b8';
  v_expected_scope_fingerprint:='a6823565ed36c9fb21f863a099ff34126a6863a5df249c6ed8848d332dabd89e';
  if p_request->>'target_project_ref' is distinct from v_project_ref
    or p_request->>'target_database_identity' is distinct from v_database_identity then
    perform public.retailer_catalogue_raise('RSBI_ENVIRONMENT_BLOCKED','Invalid target environment binding');
  end if;
  perform public.retailer_catalogue_production_runtime_guard(v_target,v_project_ref,v_database_identity);
  if v_effective_role is distinct from v_expected_role or session_user is distinct from v_expected_login then
    perform public.retailer_catalogue_raise('RSBI_ENVIRONMENT_BLOCKED','Dedicated workflow validator identity required');
  end if;
  if current_setting('app.safe_update',true) is not null then
    perform public.retailer_catalogue_raise('RSBI_ENVIRONMENT_BLOCKED','SAFE_UPDATE must remain unset');
  end if;

  if (p_request->>'request_fingerprint')!~'^[0-9a-f]{64}$'
    or public.retailer_catalogue_sha256_json(jsonb_set(p_request,'{request_fingerprint}','null'::jsonb,false)) is distinct from p_request->>'request_fingerprint' then
    perform public.retailer_catalogue_raise('RSBI_CHILD_FINGERPRINT_MISMATCH','Registration request fingerprint mismatch');
  end if;
  if not public.atomic_import_has_exact_keys(p_request->'workflow',array['repository','run_id','run_attempt','actor'])
    or p_request#>>'{workflow,repository}'<>'SupplementScout/supplementscout'
    or nullif(trim(p_request#>>'{workflow,run_id}'),'') is null
    or nullif(trim(p_request#>>'{workflow,run_attempt}'),'') is null
    or nullif(trim(p_request#>>'{workflow,actor}'),'') is null
    or p_request#>>'{workflow,run_id}'!~'^[A-Za-z0-9._:-]{1,128}$'
    or p_request#>>'{workflow,run_attempt}'!~'^[A-Za-z0-9._:-]{1,64}$' then
    perform public.retailer_catalogue_raise('RSBI_SOURCE_SCHEMA_MISMATCH','Invalid workflow audit identity');
  end if;

  -- Fail before any control INSERT if the existing parent entry point is not ready.
  if to_regprocedure('public.retailer_offer_sync_parent_profiles()') is null
    or to_regprocedure('public.prepare_sequential_retailer_offer_sync_parent_approval(jsonb)') is null then
    perform public.retailer_catalogue_raise('RSBI_ENVIRONMENT_BLOCKED','Shared parent approval profile is not installed');
  end if;
  if encode(sha256(convert_to(pg_get_functiondef('public.prepare_sequential_retailer_offer_sync_parent_approval(jsonb)'::regprocedure),'UTF8')),'hex') is distinct from 'ccd4e3b62e30ecb7b50ce067da3cece0ec104a603c9140afdfd337cd25bb0b70'
    or not exists(select 1 from public.retailer_offer_sync_parent_profiles() p where p.retailer_id=16 and p.retailer_slug='holland-barrett' and p.required_manifest_sha256=v_expected_manifest_sha) then
    perform public.retailer_catalogue_raise('RSBI_ENVIRONMENT_BLOCKED','Shared parent approval profile lineage mismatch');
  end if;

  v_approved_manifest_sha:=lower(p_request->>'approved_manifest_sha256');
  if p_request->>'retailer_id' is distinct from v_retailer_id::text or p_request->>'retailer_slug'<>'holland-barrett'
    or p_request->>'source_platform'<>'PARTNERIZE_PRODUCT_FEED'
    or lower(p_request->>'source_domain') is distinct from 'hollandandbarrett.com'
    or p_request->>'source_country'<>'GB'
    or v_approved_manifest_sha is distinct from v_expected_manifest_sha
    or not exists(select 1 from public.retailers where id=v_retailer_id and slug='holland-barrett' and website='https://www.hollandandbarrett.com') then
    perform public.retailer_catalogue_raise('RSBI_ENVIRONMENT_BLOCKED','Registration is restricted to the frozen Holland & Barrett Partnerize manifest');
  end if;

  v_source_fingerprint:=p_request->>'source_snapshot_fingerprint';
  v_code_commit:=p_request->>'code_commit';
  v_source_captured_at:=(p_request->>'source_captured_at')::timestamptz;
  v_expires_at:=(p_request->>'expires_at')::timestamptz;
  if v_source_fingerprint is null or v_code_commit is null or v_source_captured_at is null or v_expires_at is null
    or v_source_fingerprint!~'^[0-9a-f]{64}$' or v_code_commit!~'^[0-9a-f]{40}$'
    or v_source_captured_at<now()-interval '24 hours' or v_source_captured_at>now()+interval '5 minutes'
    or v_expires_at<=now() or v_expires_at>now()+interval '45 minutes' then
    perform public.retailer_catalogue_raise('RSBI_SOURCE_STALE','Invalid source fingerprint, commit or expiry');
  end if;

  v_manifest:=p_request->'manifest';
  if jsonb_typeof(v_manifest) is distinct from 'array' or jsonb_array_length(v_manifest) <> v_expected_manifest_count then
    perform public.retailer_catalogue_raise('RSBI_EXPECTED_STATE_MISMATCH','Manifest does not match the target environment approved Holland & Barrett count');
  end if;
  v_manifest_count:=jsonb_array_length(v_manifest);
  if public.retailer_catalogue_sha256_json(v_manifest) is distinct from v_expected_scope_fingerprint then
    perform public.retailer_catalogue_raise('RSBI_SOURCE_HASH_MISMATCH','Holland & Barrett approved scope fingerprint mismatch');
  end if;
  /* Holland & Barrett target-environment frozen existing-identity scope binding */
  v_manifest_fingerprint:=public.retailer_catalogue_sha256_json(jsonb_build_object(
    'approved_manifest_sha256',upper(v_approved_manifest_sha),'environment',v_target,'rows',v_manifest));
  if (p_request->>'manifest_fingerprint')!~'^[0-9a-f]{64}$' or p_request->>'manifest_fingerprint' is distinct from v_manifest_fingerprint then
    perform public.retailer_catalogue_raise('RSBI_SOURCE_HASH_MISMATCH','Manifest fingerprint mismatch');
  end if;

  for v_entry in select value from jsonb_array_elements(v_manifest) loop
    if not public.atomic_import_has_exact_keys(v_entry,array['mapping_id','offer_id','external_product_id','external_variant_id','canonical_product_id','canonical_variant_id']) then
      perform public.retailer_catalogue_raise('RSBI_SOURCE_SCHEMA_MISMATCH','Invalid approved mapping manifest row');
    end if;
    v_mapping_id:=(v_entry->>'mapping_id')::bigint; v_offer_id:=(v_entry->>'offer_id')::bigint;
    if v_mapping_id<=v_previous_mapping_id then
      perform public.retailer_catalogue_raise('RSBI_DUPLICATE_IDENTITY','Manifest mappings must be unique and ascending');
    end if;
    v_previous_mapping_id:=v_mapping_id;
    select * into v_mapping from public.retailer_products where id=v_mapping_id;
    select * into v_offer from public.offers where id=v_offer_id;
    if v_mapping.id is null or v_offer.id is null or v_mapping.retailer_id<>v_retailer_id or v_offer.retailer_id<>v_retailer_id
      or v_offer.retailer_product_id is distinct from v_mapping.id
      or v_offer.product_id is distinct from v_mapping.product_id
      or v_offer.product_variant_id is distinct from v_mapping.product_variant_id
      or v_mapping.product_id::text is distinct from v_entry->>'canonical_product_id'
      or v_mapping.product_variant_id::text is distinct from v_entry->>'canonical_variant_id'
      or v_mapping.external_product_id is distinct from v_entry->>'external_product_id'
      or v_mapping.external_variant_id is distinct from v_entry->>'external_variant_id'
      or nullif(trim(v_mapping.external_product_id),'') is null or nullif(trim(v_mapping.external_variant_id),'') is null then
      perform public.retailer_catalogue_raise('RSBI_EXPECTED_STATE_MISMATCH','Manifest row is not an approved Holland & Barrett mapping/offer identity');
    end if;
    select * into v_product from public.products where id=v_mapping.product_id;
    select * into v_variant from public.product_variants where id=v_mapping.product_variant_id;
    if v_product.id is null or v_variant.id is null or not coalesce(v_product.is_active,false)
      or v_product.merged_into_product_id is not null or v_product.merged_at is not null
      or not coalesce(v_variant.is_active,false) or v_variant.product_id is distinct from v_product.id then
      perform public.retailer_catalogue_raise('RSBI_EXPECTED_STATE_MISMATCH','Manifest contains inactive, merged or conflicting catalogue identity');
    end if;
  end loop;

  if exists(select 1 from public.retailer_products rp where rp.retailer_id=v_retailer_id
      and nullif(trim(rp.external_product_id),'') is not null and nullif(trim(rp.external_variant_id),'') is not null
      and not exists(select 1 from jsonb_array_elements(v_manifest) m where (m->>'mapping_id')::bigint=rp.id))
    or exists(select 1 from public.offers o join public.retailer_products rp on rp.id=o.retailer_product_id
      where o.retailer_id=v_retailer_id and nullif(trim(rp.external_product_id),'') is not null
      and nullif(trim(rp.external_variant_id),'') is not null
      and not exists(select 1 from jsonb_array_elements(v_manifest) m where (m->>'offer_id')::bigint=o.id)) then
    perform public.retailer_catalogue_raise('RSBI_EXPECTED_STATE_MISMATCH','Manifest omits an approved exact Holland & Barrett mapping or offer');
  end if;

  v_children:=p_request->'children';
  if jsonb_typeof(v_children) is distinct from 'array' then
    perform public.retailer_catalogue_raise('RSBI_SOURCE_SCHEMA_MISMATCH','Children must be an array');
  end if;
  v_child_count:=jsonb_array_length(v_children);
  if v_child_count<1 or v_child_count>50 then
    perform public.retailer_catalogue_raise('RSBI_GUARDRAIL_EXCEEDED','Invalid child count');
  end if;

  for v_child in select value from jsonb_array_elements(v_children) loop
    if not public.atomic_import_has_exact_keys(v_child,array['child_plan_id','artifact']) then
      perform public.retailer_catalogue_raise('RSBI_SOURCE_SCHEMA_MISMATCH','Invalid child registration row');
    end if;
    v_artifact:=v_child->'artifact';
    perform public.retailer_offer_sync_validate_manifest(v_artifact);
    perform public.retailer_catalogue_assert_migration_ledger(v_artifact->'expected_migration_versions',v_artifact->>'expected_migration_fingerprint');
    if v_artifact->>'retailer_id' is distinct from v_retailer_id::text or v_artifact->>'retailer_slug'<>'holland-barrett'
      or v_artifact->>'target_environment' is distinct from v_target
      or v_artifact->>'target_project_ref' is distinct from v_project_ref
      or v_artifact->>'target_database_identity' is distinct from v_database_identity
      or v_artifact->>'source_snapshot_fingerprint' is distinct from v_source_fingerprint
      or v_artifact->>'source_captured_at' is distinct from p_request->>'source_captured_at'
      or v_artifact->>'code_commit' is distinct from v_code_commit
      or v_artifact->>'artifact_fingerprint'!~'^[0-9a-f]{64}$' then
      perform public.retailer_catalogue_raise('RSBI_CHILD_FINGERPRINT_MISMATCH','Child artifact does not bind the registration');
    end if;
    if v_child_index=0 then
      v_first_expected_state:=v_artifact->>'expected_state_fingerprint'; v_first_adapter:=v_artifact->>'adapter_fingerprint'; v_first_policy:=v_artifact->>'policy_fingerprint';
    elsif v_artifact->>'expected_state_fingerprint' is distinct from v_first_expected_state
      or v_artifact->>'adapter_fingerprint' is distinct from v_first_adapter
      or v_artifact->>'policy_fingerprint' is distinct from v_first_policy then
      perform public.retailer_catalogue_raise('RSBI_CHILD_FINGERPRINT_MISMATCH','Children do not share immutable state bindings');
    end if;
    v_rows:=v_artifact->'rows'; v_record_ids:='[]'::jsonb;
    for v_row in select value from jsonb_array_elements(v_rows) loop
      v_mapping_id:=(v_row->>'retailer_product_id')::bigint; v_offer_id:=(v_row->>'offer_id')::bigint;
      if not exists(select 1 from jsonb_array_elements(v_manifest) m
        where (m->>'mapping_id')::bigint=v_mapping_id and (m->>'offer_id')::bigint=v_offer_id
        and m->>'external_product_id'=v_row->>'external_product_id'
        and m->>'external_variant_id'=v_row->>'external_variant_id') then
        perform public.retailer_catalogue_raise('RSBI_EXPECTED_STATE_MISMATCH','Child contains an identity outside the approved Holland & Barrett manifest');
      end if;
      if v_mapping_id=any(v_seen_mapping_ids) or v_offer_id=any(v_seen_offer_ids) then
        perform public.retailer_catalogue_raise('RSBI_DUPLICATE_IDENTITY','Child rows overlap');
      end if;
      -- The common validator/executor retain full expected-state, fingerprint and
      -- delta validation. This frozen boundary additionally limits H&B policy.
      select * into v_offer from public.offers where id=v_offer_id;
      v_plan:=v_row->'atomic_plan'; v_values:=v_plan#>'{offer,values}';
      if v_row->>'action' is null or v_row->>'action' not in ('VERIFY_NO_CHANGE','UPDATE_PRICE','UPDATE_STOCK','UPDATE_PRICE_AND_STOCK')
        or v_plan#>>'{product,action}' is distinct from 'existing'
        or v_plan#>>'{product_variant,action}' is distinct from 'existing'
        or v_plan#>>'{retailer,action}' is distinct from 'existing'
        or v_plan#>>'{retailer,id}' is distinct from '16'
        or v_plan#>>'{retailer_product,action}' is distinct from 'noop'
        or v_plan#>>'{offer,action}' is null or v_plan#>>'{offer,action}' not in ('update','verify_no_change')
        or v_plan#>>'{offer,id}' is distinct from v_offer_id::text
        or v_plan#>>'{retailer_product,id}' is distinct from v_mapping_id::text
        or v_plan#>>'{approval,approved}' is distinct from 'false'
        or jsonb_typeof(v_values->'in_stock') is distinct from 'boolean'
        or v_values->>'url' is distinct from v_offer.url
        or coalesce(v_values->>'price','')!~'^[0-9]+([.][0-9]{1,2})?$'
        or coalesce(v_values->>'shipping_cost','')!~'^[0-9]+([.][0-9]{1,2})?$'
        or coalesce(v_values->>'total_price','')!~'^[0-9]+([.][0-9]{1,2})?$' then
        perform public.retailer_catalogue_raise('RSBI_GUARDRAIL_EXCEEDED','H&B permits existing-offer price/stock/freshness only');
      end if;
      v_price:=(v_values->>'price')::numeric;
      v_shipping:=(v_values->>'shipping_cost')::numeric;
      v_total:=(v_values->>'total_price')::numeric;
      if v_offer.price is null or v_offer.price<=0 or v_price<=0
        or v_shipping is distinct from v_offer.shipping_cost or v_total<>v_price+v_shipping
        or abs(v_price-v_offer.price)>=20 or abs(v_price-v_offer.price)/v_offer.price>=0.25 then
        perform public.retailer_catalogue_raise('RSBI_GUARDRAIL_EXCEEDED','H&B delivery and hard-price guards require owner review');
      end if;
      v_seen_mapping_ids:=array_append(v_seen_mapping_ids,v_mapping_id);
      v_seen_offer_ids:=array_append(v_seen_offer_ids,v_offer_id);
      v_record_ids:=v_record_ids||to_jsonb(v_offer_id::text); v_row_count:=v_row_count+1;
    end loop;
    v_expected_deltas:=jsonb_set(v_expected_deltas,'{row_count_deltas,price_history}',to_jsonb((v_expected_deltas#>>'{row_count_deltas,price_history}')::int+(v_artifact#>>'{expected_deltas,row_count_deltas,price_history}')::int));
    v_expected_deltas:=jsonb_set(v_expected_deltas,'{logical_field_deltas,offer_price_updates}',to_jsonb((v_expected_deltas#>>'{logical_field_deltas,offer_price_updates}')::int+(v_artifact#>>'{expected_deltas,logical_field_deltas,offer_price_updates}')::int));
    v_expected_deltas:=jsonb_set(v_expected_deltas,'{logical_field_deltas,offer_shipping_updates}',to_jsonb((v_expected_deltas#>>'{logical_field_deltas,offer_shipping_updates}')::int+(v_artifact#>>'{expected_deltas,logical_field_deltas,offer_shipping_updates}')::int));
    v_expected_deltas:=jsonb_set(v_expected_deltas,'{logical_field_deltas,offer_total_updates}',to_jsonb((v_expected_deltas#>>'{logical_field_deltas,offer_total_updates}')::int+(v_artifact#>>'{expected_deltas,logical_field_deltas,offer_total_updates}')::int));
    v_expected_deltas:=jsonb_set(v_expected_deltas,'{logical_field_deltas,offer_stock_updates}',to_jsonb((v_expected_deltas#>>'{logical_field_deltas,offer_stock_updates}')::int+(v_artifact#>>'{expected_deltas,logical_field_deltas,offer_stock_updates}')::int));
    v_expected_deltas:=jsonb_set(v_expected_deltas,'{logical_field_deltas,offer_url_updates}',to_jsonb((v_expected_deltas#>>'{logical_field_deltas,offer_url_updates}')::int+(v_artifact#>>'{expected_deltas,logical_field_deltas,offer_url_updates}')::int));
    v_expected_deltas:=jsonb_set(v_expected_deltas,'{logical_field_deltas,mapping_url_updates}',to_jsonb((v_expected_deltas#>>'{logical_field_deltas,mapping_url_updates}')::int+(v_artifact#>>'{expected_deltas,logical_field_deltas,mapping_url_updates}')::int));
    v_expected_deltas:=jsonb_set(v_expected_deltas,'{logical_field_deltas,mapping_updated_at_updates}',to_jsonb((v_expected_deltas#>>'{logical_field_deltas,mapping_updated_at_updates}')::int+(v_artifact#>>'{expected_deltas,logical_field_deltas,mapping_updated_at_updates}')::int));
    v_expected_deltas:=jsonb_set(v_expected_deltas,'{logical_field_deltas,last_checked_at_updates}',to_jsonb((v_expected_deltas#>>'{logical_field_deltas,last_checked_at_updates}')::int+(v_artifact#>>'{expected_deltas,logical_field_deltas,last_checked_at_updates}')::int));
    v_child_manifest:=v_child_manifest||jsonb_build_array(jsonb_build_object(
      'child_plan_id',v_child->>'child_plan_id','parent_plan_id',p_request->>'parent_plan_id',
      'child_plan_fingerprint',v_artifact->>'artifact_fingerprint','batch_index',v_child_index,
      'batch_count',v_child_count,'dependency_group','retailer-offer-sync:'||v_retailer_id::text||':'||v_source_fingerprint,
      'rollback_group','retailer-offer-sync:'||v_retailer_id::text||':'||v_source_fingerprint,'record_ids',v_record_ids,
      'expected_deltas',v_artifact->'expected_deltas'));
    v_child_fingerprints:=v_child_fingerprints||to_jsonb(v_artifact->>'artifact_fingerprint');
    v_child_ids:=v_child_ids||to_jsonb(v_child->>'child_plan_id'); v_child_index:=v_child_index+1;
  end loop;
  if v_row_count<1 or v_row_count>v_manifest_count
    or cardinality(v_seen_mapping_ids)<>v_row_count or cardinality(v_seen_offer_ids)<>v_row_count then
    perform public.retailer_catalogue_raise('RSBI_EXPECTED_STATE_MISMATCH','Isolated child rows do not reconcile with the approved manifest');
  end if;

  v_parent_id:=(p_request->>'parent_plan_id')::uuid;
  v_parent_hash_input:=jsonb_build_object(
    'schema_version',1,'kind','retailer-existing-offer-sync-parent','parent_plan_id',v_parent_id,
    'target_environment',v_target,'target_project_ref',v_project_ref,'target_database_identity',v_database_identity,
    'retailer_id',v_retailer_id::text,'source_country','GB','source_snapshot_fingerprint',v_source_fingerprint,
    'source_captured_at',p_request->>'source_captured_at','manifest_fingerprint',v_manifest_fingerprint,
    'approved_manifest_sha256',upper(v_approved_manifest_sha),'child_plan_ids',v_child_ids,
    'child_fingerprints',v_child_fingerprints,'code_commit',v_code_commit,'expires_at',p_request->>'expires_at',
    'workflow',p_request->'workflow');
  v_parent_fingerprint:=public.retailer_catalogue_sha256_json(v_parent_hash_input);
  if (p_request->>'parent_plan_fingerprint')!~'^[0-9a-f]{64}$' or p_request->>'parent_plan_fingerprint' is distinct from v_parent_fingerprint then
    perform public.retailer_catalogue_raise('RSBI_PARENT_FINGERPRINT_MISMATCH','Parent plan fingerprint mismatch');
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_target||':'||v_retailer_id::text,0));
  if exists(select 1 from public.retailer_catalogue_parent_plans where parent_plan_fingerprint=v_parent_fingerprint or id=v_parent_id) then
    perform public.retailer_catalogue_raise('RSBI_REPLAY_BLOCKED','Registered or consumed plan cannot be replayed');
  end if;
  if exists(select 1 from public.retailer_catalogue_parent_plans where retailer_id=v_retailer_id and target_environment=v_target and status in ('PLANNED','APPROVED','PARTIALLY_APPLIED','FAILED')) then
    perform public.retailer_catalogue_raise('RSBI_REPLAY_BLOCKED','An equivalent Holland & Barrett control plan is already active');
  end if;

  v_registration_actor:='github:'||(p_request#>>'{workflow,repository}')||':'||(p_request#>>'{workflow,run_id}')||':'||(p_request#>>'{workflow,run_attempt}');
  v_parent_plan:=v_parent_hash_input||jsonb_build_object('parent_plan_fingerprint',v_parent_fingerprint,'manifest_count',v_manifest_count,'expected_deltas',v_expected_deltas);
  insert into public.retailer_catalogue_parent_plans(
    id,parent_plan_fingerprint,retailer_id,target_environment,source_snapshot_fingerprint,
    canonical_snapshot_fingerprint,adapter_fingerprint,policy_fingerprint,code_commit,
    expected_state_fingerprint,status,expected_deltas,plan_json,child_manifest,rollback_manifest,
    source_captured_at,canonical_snapshot_at,created_by,audit_log)
  values(v_parent_id,v_parent_fingerprint,v_retailer_id,v_target,v_source_fingerprint,v_first_expected_state,
    v_first_adapter,v_first_policy,v_code_commit,v_first_expected_state,'PLANNED',v_expected_deltas,
    v_parent_plan,v_child_manifest,jsonb_build_object('kind','MIXED_EXISTING_OFFER_UPDATE','mapping_ids',to_jsonb(v_seen_mapping_ids)),
    v_source_captured_at,now(),v_registration_actor,jsonb_build_array(jsonb_build_object(
      'event','APPROVED_RETAILER_AUTOMATION_PLAN_REGISTERED','at',now(),'caller_role',v_effective_role,
      'session_user',session_user,'workflow',p_request->'workflow','approved_manifest_sha256',upper(v_approved_manifest_sha),
      'manifest_fingerprint',v_manifest_fingerprint,'source_snapshot_fingerprint',v_source_fingerprint,'operation_count',v_row_count)));

  v_child_index:=0;
  for v_child in select value from jsonb_array_elements(v_children) loop
    v_artifact:=v_child->'artifact'; v_entry:=v_child_manifest->v_child_index;
    insert into public.retailer_catalogue_child_plans(
      id,parent_plan_id,retailer_id,target_environment,child_plan_fingerprint,parent_plan_fingerprint,
      source_snapshot_fingerprint,canonical_snapshot_fingerprint,adapter_fingerprint,policy_fingerprint,
      code_commit,expected_state_fingerprint,batch_index,batch_count,dependency_group,rollback_group,
      record_ids,status,expected_deltas,plan_json,rollback_manifest,audit_log)
    values((v_child->>'child_plan_id')::uuid,v_parent_id,v_retailer_id,v_target,v_artifact->>'artifact_fingerprint',
      v_parent_fingerprint,v_source_fingerprint,v_artifact->>'expected_state_fingerprint',v_first_adapter,
      v_first_policy,v_code_commit,v_artifact->>'expected_state_fingerprint',v_child_index,v_child_count,
      v_entry->>'dependency_group',v_entry->>'rollback_group',v_entry->'record_ids','PLANNED',
      v_artifact->'expected_deltas',v_artifact,'[]'::jsonb,jsonb_build_array(jsonb_build_object(
        'event','APPROVED_RETAILER_AUTOMATION_CHILD_REGISTERED','at',now(),'caller_role',v_effective_role,
        'workflow',p_request->'workflow','batch_index',v_child_index,'artifact_fingerprint',v_artifact->>'artifact_fingerprint')));
    v_child_index:=v_child_index+1;
  end loop;

  return jsonb_build_object('status','REGISTERED','parent_plan_id',v_parent_id,
    'parent_plan_fingerprint',v_parent_fingerprint,'child_plan_ids',v_child_ids,
    'child_fingerprints',v_child_fingerprints,'manifest_fingerprint',v_manifest_fingerprint,
    'approved_manifest_sha256',upper(v_approved_manifest_sha),'source_snapshot_fingerprint',v_source_fingerprint,
    'mapping_count',v_manifest_count,'child_count',v_child_count,'target_environment',v_target,
    'workflow',p_request->'workflow','control_writes',1+v_child_count,'business_writes',0);
end
$register$;
alter function public.register_holland_barrett_offer_sync_control_plan(jsonb) owner to postgres;
revoke all on function public.register_holland_barrett_offer_sync_control_plan(jsonb) from public,anon,authenticated,service_role;
grant execute on function public.register_holland_barrett_offer_sync_control_plan(jsonb) to retailer_catalogue_production_validator;

do $guard$
declare p pg_proc%rowtype; target jsonb:=public.retailer_catalogue_actual_database_target();
begin
  if current_user<>'postgres' or target->>'target_environment' is distinct from 'PRODUCTION' or target->>'project_ref' is distinct from 'aftboxmrdgyhizicfsfu' or target->>'database_identity' is distinct from 'supplementscout-production:aftboxmrdgyhizicfsfu' then raise exception 'HB_REGISTRATION_PROPOSAL_TARGET_MISMATCH'; end if;
  select * into p from pg_proc where oid='public.register_holland_barrett_offer_sync_control_plan(jsonb)'::regprocedure;
  if encode(sha256(convert_to(p.prosrc,'UTF8')),'hex') is distinct from 'b388ed2f7f4f7302ccd0655c96c410af6d3770b0950ba73ecf2eb439d6fde6e7' or pg_get_userbyid(p.proowner)<>'postgres' or not p.prosecdef or p.provolatile<>'v' or p.proconfig is distinct from array['search_path=pg_catalog, public, pg_temp']::text[] or p.proacl::text is distinct from '{postgres=X/postgres,retailer_catalogue_production_validator=X/postgres}' then raise exception 'HB_REGISTRATION_PROPOSAL_LINEAGE_MISMATCH'; end if;
end
$guard$;
commit;
