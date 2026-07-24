begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $preflight$
begin
  if to_regprocedure('public.register_jons_offer_sync_control_plan(jsonb)') is null
     or to_regprocedure('public.retailer_offer_sync_validate_manifest(jsonb)') is null
     or to_regprocedure('public.retailer_catalogue_sha256_json(jsonb)') is null then
    raise exception 'approved retailer sync registration requires the existing Jon''s control plane';
  end if;
end
$preflight$;

create or replace function public.read_retailer_offer_sync_approved_state(
  p_retailer_id bigint
) returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $state$
declare
  v_effective_role text := current_setting('role', true);
  v_expected_role text;
  v_retailer public.retailers%rowtype;
  v_records jsonb;
  v_exceptions jsonb;
  v_approved_count integer;
  v_legacy_count integer;
begin
  if p_retailer_id <> 3 then
    perform public.retailer_catalogue_raise(
      'RSBI_ENVIRONMENT_BLOCKED',
      'Approved state snapshot is restricted to Whey Okay'
    );
  end if;
  if v_effective_role = 'retailer_catalogue_staging_validator' then
    v_expected_role := 'retailer_catalogue_staging_validator';
  elsif v_effective_role = 'retailer_catalogue_production_validator' then
    v_expected_role := 'retailer_catalogue_production_validator';
  else
    perform public.retailer_catalogue_raise(
      'RSBI_ENVIRONMENT_BLOCKED',
      'Dedicated workflow validator role required'
    );
  end if;
  if v_effective_role is distinct from v_expected_role then
    perform public.retailer_catalogue_raise(
      'RSBI_ENVIRONMENT_BLOCKED',
      'Validator role mismatch'
    );
  end if;
  if current_setting('app.safe_update', true) is not null then
    perform public.retailer_catalogue_raise(
      'RSBI_ENVIRONMENT_BLOCKED',
      'SAFE_UPDATE must remain unset'
    );
  end if;

  select * into v_retailer
  from public.retailers
  where id = 3 and slug = 'whey-okay' and website = 'https://wheyokay.com';
  if v_retailer.id is null then
    perform public.retailer_catalogue_raise(
      'RSBI_EXPECTED_STATE_MISMATCH',
      'Whey Okay retailer identity drift'
    );
  end if;

  select count(*)::integer,
         count(*) filter (
           where nullif(trim(external_product_id),'') is null
              or nullif(trim(external_variant_id),'') is null
         )::integer
  into v_approved_count, v_legacy_count
  from public.retailer_products
  where retailer_id = 3;
  v_approved_count := v_approved_count - v_legacy_count;
  if v_approved_count <> 586 or v_legacy_count <> 284 then
    perform public.retailer_catalogue_raise(
      'RSBI_EXPECTED_STATE_MISMATCH',
      'Whey Okay approved or legacy mapping count drift'
    );
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'product', jsonb_build_object(
        'id',p.id,'name',p.name,'is_active',p.is_active,
        'merged_into_product_id',p.merged_into_product_id,
        'product_format',p.product_format
      ),
      'variant', jsonb_build_object(
        'id',v.id,'product_id',v.product_id,'variant_key',v.variant_key,
        'display_name',v.display_name,'flavour_code',v.flavour_code,
        'flavour_label',v.flavour_label,'size_value',v.size_value,
        'size_unit',v.size_unit,'pack_count',v.pack_count,
        'product_format',v.product_format,'is_active',v.is_active,
        'is_default',v.is_default
      ),
      'retailer', jsonb_build_object(
        'id',r.id,'name',r.name,'slug',r.slug,'website',r.website
      ),
      'mapping', jsonb_build_object(
        'id',rp.id,'retailer_id',rp.retailer_id,
        'product_id',rp.product_id,
        'product_variant_id',rp.product_variant_id,
        'external_product_id',rp.external_product_id,
        'external_variant_id',rp.external_variant_id,
        'external_sku',rp.external_sku,
        'external_options',rp.external_options,
        'external_name',rp.external_name,
        'external_slug',rp.external_slug,
        'external_gtin',rp.external_gtin,
        'external_url',rp.external_url,
        'match_method',rp.match_method,
        'match_confidence',rp.match_confidence,
        'updated_at',rp.updated_at
      ),
      'offer', jsonb_build_object(
        'id',o.id,'product_id',o.product_id,'retailer_id',o.retailer_id,
        'product_variant_id',o.product_variant_id,
        'retailer_product_id',o.retailer_product_id,'price',o.price,
        'shipping_cost',o.shipping_cost,'total_price',o.total_price,
        'in_stock',o.in_stock,'url',o.url,
        'last_checked_at',o.last_checked_at
      )
    ) order by rp.id
  ), '[]'::jsonb)
  into v_records
  from public.retailer_products rp
  join public.offers o
    on o.retailer_product_id = rp.id
   and o.retailer_id = rp.retailer_id
  join public.products p on p.id = rp.product_id
  join public.product_variants v on v.id = rp.product_variant_id
  join public.retailers r on r.id = rp.retailer_id
  where rp.retailer_id = 3
    and nullif(trim(rp.external_product_id),'') is not null
    and nullif(trim(rp.external_variant_id),'') is not null;
  if jsonb_array_length(v_records) <> 586 then
    perform public.retailer_catalogue_raise(
      'RSBI_EXPECTED_STATE_MISMATCH',
      'Whey Okay approved mapping/offer coverage drift'
    );
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object('mapping',to_jsonb(rp),'offer',to_jsonb(o))
    order by rp.id
  ), '[]'::jsonb)
  into v_exceptions
  from public.retailer_products rp
  join public.offers o on o.retailer_product_id = rp.id
  where rp.id = any(array[11,150,191,249]::bigint[]);
  if jsonb_array_length(v_exceptions) <> 4 then
    perform public.retailer_catalogue_raise(
      'RSBI_EXPECTED_STATE_MISMATCH',
      'Reviewed Whey Okay exception row missing'
    );
  end if;

  return jsonb_build_object(
    'retailer', to_jsonb(v_retailer),
    'records', v_records,
    'reviewed_exceptions', v_exceptions,
    'counts', jsonb_build_object(
      'retailers', (select count(*) from public.retailers),
      'products', (select count(*) from public.products),
      'active_products', (select count(*) from public.products where is_active),
      'product_variants', (select count(*) from public.product_variants),
      'retailer_products', (select count(*) from public.retailer_products),
      'offers', (select count(*) from public.offers),
      'price_history', (select count(*) from public.price_history),
      'approved_mappings', v_approved_count,
      'approved_offers', jsonb_array_length(v_records),
      'legacy_mappings', v_legacy_count
    ),
    'controls', jsonb_build_object(
      'import_approvals', (
        select count(*) from public.approved_import_plans
        where consumed_at is null and expires_at > now()
      ),
      'offer_approvals', (
        select count(*) from public.retailer_offer_sync_batch_approvals
        where consumed_at is null and expires_at > now()
      ),
      'parents', (
        select count(*) from public.retailer_catalogue_parent_plans
        where status in ('PLANNED','APPROVED','PARTIALLY_APPLIED')
      ),
      'children', (
        select count(*) from public.retailer_catalogue_child_plans
        where status in ('PLANNED','APPROVED','APPLYING')
      ),
      'runs', (
        select count(*) from public.retailer_catalogue_apply_runs
        where status = 'STARTED'
      ),
      'active_conflicting_sessions', (
        select count(*) from pg_stat_activity
        where pid <> pg_backend_pid()
          and state = 'active'
          and (
            application_name ilike '%import%'
            or application_name ilike '%retailer%'
            or application_name ilike '%offer%sync%'
            or application_name ilike '%jons%'
            or application_name ilike '%whey%'
          )
      )
    )
  );
end
$state$;

create or replace function public.register_retailer_offer_sync_control_plan(
  p_request jsonb
) returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog, public, pg_temp
as $register$
declare
  v_effective_role text := current_setting('role', true);
  v_expected_role text;
  v_expected_login text;
  v_target text;
  v_project_ref text;
  v_database_identity text;
  v_manifest jsonb;
  v_manifest_fingerprint text;
  v_entry jsonb;
  v_children jsonb;
  v_child jsonb;
  v_artifact jsonb;
  v_child_manifest jsonb := '[]'::jsonb;
  v_child_fingerprints jsonb := '[]'::jsonb;
  v_child_ids jsonb := '[]'::jsonb;
  v_expected_deltas jsonb := jsonb_build_object(
    'row_count_deltas', jsonb_build_object(
      'products',0,'product_variants',0,'retailer_products',0,
      'offers',0,'price_history',0
    ),
    'logical_field_deltas', jsonb_build_object(
      'offer_price_updates',0,'offer_shipping_updates',0,
      'offer_total_updates',0,'offer_stock_updates',0,
      'offer_url_updates',0,'mapping_url_updates',0,
      'mapping_updated_at_updates',0,'last_checked_at_updates',0
    )
  );
  v_parent_hash_input jsonb;
  v_parent_plan jsonb;
  v_parent_id uuid;
  v_parent_fingerprint text;
  v_source_fingerprint text;
  v_source_captured_at timestamptz;
  v_expires_at timestamptz;
  v_code_commit text;
  v_first_expected_state text;
  v_first_adapter text;
  v_first_policy text;
  v_mapping public.retailer_products%rowtype;
  v_offer public.offers%rowtype;
  v_product public.products%rowtype;
  v_variant public.product_variants%rowtype;
  v_mapping_id bigint;
  v_offer_id bigint;
  v_previous_mapping_id bigint := 0;
  v_seen_mapping_ids bigint[] := '{}'::bigint[];
  v_seen_offer_ids bigint[] := '{}'::bigint[];
  v_manifest_count integer;
  v_child_count integer;
  v_child_index integer := 0;
  v_row jsonb;
  v_row_count integer := 0;
  v_rows jsonb;
  v_record_ids jsonb;
  v_registration_actor text;
  v_approved_manifest_sha text;
begin
  if not public.atomic_import_has_exact_keys(p_request,array[
    'schema_version','kind','target_environment','target_project_ref',
    'target_database_identity','retailer_id','retailer_slug',
    'source_platform','source_domain','source_country',
    'source_snapshot_fingerprint','source_captured_at',
    'approved_manifest_sha256','manifest','manifest_fingerprint',
    'parent_plan_id','parent_plan_fingerprint','children','code_commit',
    'expires_at','workflow','request_fingerprint'
  ]) or p_request->>'schema_version'<>'1'
     or p_request->>'kind'<>'retailer-existing-offer-sync-control-plan-registration' then
    perform public.retailer_catalogue_raise(
      'RSBI_SOURCE_SCHEMA_MISMATCH',
      'Invalid approved retailer plan registration request'
    );
  end if;

  v_target := p_request->>'target_environment';
  v_project_ref := p_request->>'target_project_ref';
  v_database_identity := p_request->>'target_database_identity';
  if v_target = 'STAGING' then
    v_expected_role := 'retailer_catalogue_staging_validator';
    v_expected_login := 'supplementscout_staging_validator_login';
    if v_project_ref <> 'hxnrsyyqffztlvcrtgbf'
       or v_database_identity <> 'supplementscout-staging:hxnrsyyqffztlvcrtgbf' then
      perform public.retailer_catalogue_raise(
        'RSBI_ENVIRONMENT_BLOCKED','Invalid staging target binding'
      );
    end if;
    perform public.retailer_catalogue_staging_runtime_guard(
      'STAGING',v_project_ref,v_database_identity
    );
  elsif v_target = 'PRODUCTION' then
    v_expected_role := 'retailer_catalogue_production_validator';
    v_expected_login := 'supplementscout_production_validator_login';
    if v_project_ref <> 'aftboxmrdgyhizicfsfu'
       or v_database_identity <> 'supplementscout-production:aftboxmrdgyhizicfsfu' then
      perform public.retailer_catalogue_raise(
        'RSBI_ENVIRONMENT_BLOCKED','Invalid production target binding'
      );
    end if;
    perform public.retailer_catalogue_production_runtime_guard(
      'PRODUCTION',v_project_ref,v_database_identity
    );
  else
    perform public.retailer_catalogue_raise(
      'RSBI_ENVIRONMENT_BLOCKED','Unsupported registration target'
    );
  end if;
  if v_effective_role is distinct from v_expected_role
     or session_user is distinct from v_expected_login then
    perform public.retailer_catalogue_raise(
      'RSBI_ENVIRONMENT_BLOCKED',
      'Dedicated workflow validator identity required'
    );
  end if;
  if current_setting('app.safe_update', true) is not null then
    perform public.retailer_catalogue_raise(
      'RSBI_ENVIRONMENT_BLOCKED','SAFE_UPDATE must remain unset'
    );
  end if;

  if (p_request->>'request_fingerprint') !~ '^[0-9a-f]{64}$'
     or public.retailer_catalogue_sha256_json(
       jsonb_set(p_request,'{request_fingerprint}','null'::jsonb,false)
     ) is distinct from p_request->>'request_fingerprint' then
    perform public.retailer_catalogue_raise(
      'RSBI_CHILD_FINGERPRINT_MISMATCH',
      'Registration request fingerprint mismatch'
    );
  end if;
  if not public.atomic_import_has_exact_keys(
       p_request->'workflow',array['repository','run_id','run_attempt','actor']
     )
     or p_request#>>'{workflow,repository}' <> 'SupplementScout/supplementscout'
     or nullif(trim(p_request#>>'{workflow,run_id}'),'') is null
     or nullif(trim(p_request#>>'{workflow,run_attempt}'),'') is null
     or nullif(trim(p_request#>>'{workflow,actor}'),'') is null
     or p_request#>>'{workflow,run_id}' !~ '^[A-Za-z0-9._:-]{1,128}$'
     or p_request#>>'{workflow,run_attempt}' !~ '^[A-Za-z0-9._:-]{1,64}$' then
    perform public.retailer_catalogue_raise(
      'RSBI_SOURCE_SCHEMA_MISMATCH','Invalid workflow audit identity'
    );
  end if;

  v_approved_manifest_sha := lower(p_request->>'approved_manifest_sha256');
  if p_request->>'retailer_id' <> '3'
     or p_request->>'retailer_slug' <> 'whey-okay'
     or p_request->>'source_platform' <> 'EKM_GOOGLE_PRODUCT_FEED'
     or lower(p_request->>'source_domain') <> 'wheyokay.com'
     or p_request->>'source_country' <> 'GB'
     or v_approved_manifest_sha <>
       '54d828af0e3c20f548708832e0a7ad9dcaf74b1cbc6ab043ed7696d6f7c4d731'
     or not exists(
       select 1 from public.retailers
       where id=3 and slug='whey-okay' and website='https://wheyokay.com'
     ) then
    perform public.retailer_catalogue_raise(
      'RSBI_ENVIRONMENT_BLOCKED',
      'Registration is restricted to the frozen Whey Okay EKM manifest'
    );
  end if;

  v_source_fingerprint := p_request->>'source_snapshot_fingerprint';
  v_code_commit := p_request->>'code_commit';
  v_source_captured_at := (p_request->>'source_captured_at')::timestamptz;
  v_expires_at := (p_request->>'expires_at')::timestamptz;
  if v_source_fingerprint !~ '^[0-9a-f]{64}$'
     or v_code_commit !~ '^[0-9a-f]{40}$'
     or v_source_captured_at < now()-interval '24 hours'
     or v_source_captured_at > now()+interval '5 minutes'
     or v_expires_at <= now()
     or v_expires_at > now()+interval '15 minutes' then
    perform public.retailer_catalogue_raise(
      'RSBI_SOURCE_STALE','Invalid source fingerprint, commit or expiry'
    );
  end if;

  v_manifest := p_request->'manifest';
  if jsonb_typeof(v_manifest) is distinct from 'array'
     or jsonb_array_length(v_manifest) <> 586 then
    perform public.retailer_catalogue_raise(
      'RSBI_EXPECTED_STATE_MISMATCH',
      'Manifest must contain exactly 586 approved Whey Okay mappings'
    );
  end if;
  v_manifest_count := jsonb_array_length(v_manifest);
  v_manifest_fingerprint := public.retailer_catalogue_sha256_json(
    jsonb_build_object(
      'approved_manifest_sha256',upper(v_approved_manifest_sha),
      'environment',v_target,
      'rows',v_manifest
    )
  );
  if (p_request->>'manifest_fingerprint') !~ '^[0-9a-f]{64}$'
     or p_request->>'manifest_fingerprint' is distinct from v_manifest_fingerprint then
    perform public.retailer_catalogue_raise(
      'RSBI_SOURCE_HASH_MISMATCH','Manifest fingerprint mismatch'
    );
  end if;

  for v_entry in select value from jsonb_array_elements(v_manifest) loop
    if not public.atomic_import_has_exact_keys(v_entry,array[
      'mapping_id','offer_id','external_product_id','external_variant_id',
      'canonical_product_id','canonical_variant_id'
    ]) then
      perform public.retailer_catalogue_raise(
        'RSBI_SOURCE_SCHEMA_MISMATCH','Invalid approved mapping manifest row'
      );
    end if;
    v_mapping_id := (v_entry->>'mapping_id')::bigint;
    v_offer_id := (v_entry->>'offer_id')::bigint;
    if v_mapping_id <= v_previous_mapping_id
       or v_mapping_id = any(array[11,150,191,249]::bigint[]) then
      perform public.retailer_catalogue_raise(
        'RSBI_DUPLICATE_IDENTITY',
        'Manifest mappings must be unique, ascending and exclude reviewed exceptions'
      );
    end if;
    v_previous_mapping_id := v_mapping_id;
    select * into v_mapping from public.retailer_products where id=v_mapping_id;
    select * into v_offer from public.offers where id=v_offer_id;
    if v_mapping.id is null or v_offer.id is null
       or v_mapping.retailer_id <> 3 or v_offer.retailer_id <> 3
       or v_offer.retailer_product_id is distinct from v_mapping.id
       or v_offer.product_id is distinct from v_mapping.product_id
       or v_offer.product_variant_id is distinct from v_mapping.product_variant_id
       or v_mapping.product_id::text is distinct from v_entry->>'canonical_product_id'
       or v_mapping.product_variant_id::text is distinct from v_entry->>'canonical_variant_id'
       or v_mapping.external_product_id is distinct from v_entry->>'external_product_id'
       or v_mapping.external_variant_id is distinct from v_entry->>'external_variant_id'
       or nullif(trim(v_mapping.external_product_id),'') is null
       or nullif(trim(v_mapping.external_variant_id),'') is null then
      perform public.retailer_catalogue_raise(
        'RSBI_EXPECTED_STATE_MISMATCH',
        'Manifest row is not an approved Whey Okay mapping/offer identity'
      );
    end if;
    select * into v_product from public.products where id=v_mapping.product_id;
    select * into v_variant from public.product_variants
    where id=v_mapping.product_variant_id;
    if v_product.id is null or v_variant.id is null
       or not coalesce(v_product.is_active,false)
       or v_product.merged_into_product_id is not null
       or v_product.merged_at is not null
       or not coalesce(v_variant.is_active,false)
       or v_variant.product_id is distinct from v_product.id then
      perform public.retailer_catalogue_raise(
        'RSBI_EXPECTED_STATE_MISMATCH',
        'Manifest contains inactive, merged or conflicting catalogue identity'
      );
    end if;
  end loop;

  if exists(
    select 1 from public.retailer_products rp
    where rp.retailer_id=3
      and nullif(trim(rp.external_product_id),'') is not null
      and nullif(trim(rp.external_variant_id),'') is not null
      and not exists(
        select 1 from jsonb_array_elements(v_manifest) m
        where (m->>'mapping_id')::bigint=rp.id
      )
  ) or exists(
    select 1 from public.offers o
    join public.retailer_products rp on rp.id=o.retailer_product_id
    where o.retailer_id=3
      and nullif(trim(rp.external_product_id),'') is not null
      and nullif(trim(rp.external_variant_id),'') is not null
      and not exists(
        select 1 from jsonb_array_elements(v_manifest) m
        where (m->>'offer_id')::bigint=o.id
      )
  ) then
    perform public.retailer_catalogue_raise(
      'RSBI_EXPECTED_STATE_MISMATCH',
      'Manifest omits an approved exact Whey Okay mapping or offer'
    );
  end if;

  v_children := p_request->'children';
  if jsonb_typeof(v_children) is distinct from 'array' then
    perform public.retailer_catalogue_raise(
      'RSBI_SOURCE_SCHEMA_MISMATCH','Children must be an array'
    );
  end if;
  v_child_count := jsonb_array_length(v_children);
  if v_child_count < 1 or v_child_count > 20 then
    perform public.retailer_catalogue_raise(
      'RSBI_GUARDRAIL_EXCEEDED','Invalid child count'
    );
  end if;

  for v_child in select value from jsonb_array_elements(v_children) loop
    if not public.atomic_import_has_exact_keys(
      v_child,array['child_plan_id','artifact']
    ) then
      perform public.retailer_catalogue_raise(
        'RSBI_SOURCE_SCHEMA_MISMATCH','Invalid child registration row'
      );
    end if;
    v_artifact := v_child->'artifact';
    perform public.retailer_offer_sync_validate_manifest(v_artifact);
    if v_artifact->>'retailer_id' <> '3'
       or v_artifact->>'retailer_slug' <> 'whey-okay'
       or v_artifact->>'target_environment' is distinct from v_target
       or v_artifact->>'target_project_ref' is distinct from v_project_ref
       or v_artifact->>'target_database_identity' is distinct from v_database_identity
       or v_artifact->>'source_snapshot_fingerprint' is distinct from v_source_fingerprint
       or v_artifact->>'source_captured_at' is distinct from p_request->>'source_captured_at'
       or v_artifact->>'code_commit' is distinct from v_code_commit
       or v_artifact->>'artifact_fingerprint' !~ '^[0-9a-f]{64}$' then
      perform public.retailer_catalogue_raise(
        'RSBI_CHILD_FINGERPRINT_MISMATCH',
        'Child artifact does not bind the registration'
      );
    end if;
    if v_child_index=0 then
      v_first_expected_state := v_artifact->>'expected_state_fingerprint';
      v_first_adapter := v_artifact->>'adapter_fingerprint';
      v_first_policy := v_artifact->>'policy_fingerprint';
    elsif v_artifact->>'expected_state_fingerprint' is distinct from v_first_expected_state
       or v_artifact->>'adapter_fingerprint' is distinct from v_first_adapter
       or v_artifact->>'policy_fingerprint' is distinct from v_first_policy then
      perform public.retailer_catalogue_raise(
        'RSBI_CHILD_FINGERPRINT_MISMATCH',
        'Children do not share immutable state bindings'
      );
    end if;
    v_rows := v_artifact->'rows';
    v_record_ids := '[]'::jsonb;
    for v_row in select value from jsonb_array_elements(v_rows) loop
      v_mapping_id := (v_row->>'retailer_product_id')::bigint;
      v_offer_id := (v_row->>'offer_id')::bigint;
      if not exists(
        select 1 from jsonb_array_elements(v_manifest) m
        where (m->>'mapping_id')::bigint=v_mapping_id
          and (m->>'offer_id')::bigint=v_offer_id
          and m->>'external_product_id'=v_row->>'external_product_id'
          and m->>'external_variant_id'=v_row->>'external_variant_id'
      ) then
        perform public.retailer_catalogue_raise(
          'RSBI_EXPECTED_STATE_MISMATCH',
          'Child contains an identity outside the approved Whey Okay manifest'
        );
      end if;
      if v_mapping_id=any(v_seen_mapping_ids)
         or v_offer_id=any(v_seen_offer_ids) then
        perform public.retailer_catalogue_raise(
          'RSBI_DUPLICATE_IDENTITY','Child rows overlap'
        );
      end if;
      v_seen_mapping_ids := array_append(v_seen_mapping_ids,v_mapping_id);
      v_seen_offer_ids := array_append(v_seen_offer_ids,v_offer_id);
      v_record_ids := v_record_ids||to_jsonb(v_offer_id::text);
      v_row_count := v_row_count+1;
    end loop;
    v_expected_deltas := jsonb_set(
      v_expected_deltas,'{row_count_deltas,price_history}',
      to_jsonb(
        (v_expected_deltas#>>'{row_count_deltas,price_history}')::int+
        (v_artifact#>>'{expected_deltas,row_count_deltas,price_history}')::int
      )
    );
    v_expected_deltas := jsonb_set(
      v_expected_deltas,'{logical_field_deltas,offer_price_updates}',
      to_jsonb(
        (v_expected_deltas#>>'{logical_field_deltas,offer_price_updates}')::int+
        (v_artifact#>>'{expected_deltas,logical_field_deltas,offer_price_updates}')::int
      )
    );
    v_expected_deltas := jsonb_set(
      v_expected_deltas,'{logical_field_deltas,offer_shipping_updates}',
      to_jsonb(
        (v_expected_deltas#>>'{logical_field_deltas,offer_shipping_updates}')::int+
        (v_artifact#>>'{expected_deltas,logical_field_deltas,offer_shipping_updates}')::int
      )
    );
    v_expected_deltas := jsonb_set(
      v_expected_deltas,'{logical_field_deltas,offer_total_updates}',
      to_jsonb(
        (v_expected_deltas#>>'{logical_field_deltas,offer_total_updates}')::int+
        (v_artifact#>>'{expected_deltas,logical_field_deltas,offer_total_updates}')::int
      )
    );
    v_expected_deltas := jsonb_set(
      v_expected_deltas,'{logical_field_deltas,offer_stock_updates}',
      to_jsonb(
        (v_expected_deltas#>>'{logical_field_deltas,offer_stock_updates}')::int+
        (v_artifact#>>'{expected_deltas,logical_field_deltas,offer_stock_updates}')::int
      )
    );
    v_expected_deltas := jsonb_set(
      v_expected_deltas,'{logical_field_deltas,offer_url_updates}',
      to_jsonb(
        (v_expected_deltas#>>'{logical_field_deltas,offer_url_updates}')::int+
        (v_artifact#>>'{expected_deltas,logical_field_deltas,offer_url_updates}')::int
      )
    );
    v_expected_deltas := jsonb_set(
      v_expected_deltas,'{logical_field_deltas,mapping_url_updates}',
      to_jsonb(
        (v_expected_deltas#>>'{logical_field_deltas,mapping_url_updates}')::int+
        (v_artifact#>>'{expected_deltas,logical_field_deltas,mapping_url_updates}')::int
      )
    );
    v_expected_deltas := jsonb_set(
      v_expected_deltas,'{logical_field_deltas,mapping_updated_at_updates}',
      to_jsonb(
        (v_expected_deltas#>>'{logical_field_deltas,mapping_updated_at_updates}')::int+
        (v_artifact#>>'{expected_deltas,logical_field_deltas,mapping_updated_at_updates}')::int
      )
    );
    v_expected_deltas := jsonb_set(
      v_expected_deltas,'{logical_field_deltas,last_checked_at_updates}',
      to_jsonb(
        (v_expected_deltas#>>'{logical_field_deltas,last_checked_at_updates}')::int+
        (v_artifact#>>'{expected_deltas,logical_field_deltas,last_checked_at_updates}')::int
      )
    );
    v_child_manifest := v_child_manifest||jsonb_build_array(
      jsonb_build_object(
        'child_plan_id',v_child->>'child_plan_id',
        'parent_plan_id',p_request->>'parent_plan_id',
        'child_plan_fingerprint',v_artifact->>'artifact_fingerprint',
        'batch_index',v_child_index,'batch_count',v_child_count,
        'dependency_group','retailer-offer-sync:3:'||v_source_fingerprint,
        'rollback_group','retailer-offer-sync:3:'||v_source_fingerprint,
        'record_ids',v_record_ids,
        'expected_deltas',v_artifact->'expected_deltas'
      )
    );
    v_child_fingerprints := v_child_fingerprints||
      to_jsonb(v_artifact->>'artifact_fingerprint');
    v_child_ids := v_child_ids||to_jsonb(v_child->>'child_plan_id');
    v_child_index := v_child_index+1;
  end loop;
  if v_row_count<>v_manifest_count
     or cardinality(v_seen_mapping_ids)<>v_manifest_count
     or cardinality(v_seen_offer_ids)<>v_manifest_count then
    perform public.retailer_catalogue_raise(
      'RSBI_EXPECTED_STATE_MISMATCH',
      'Child rows do not cover the exact approved manifest'
    );
  end if;

  v_parent_id := (p_request->>'parent_plan_id')::uuid;
  v_parent_hash_input := jsonb_build_object(
    'schema_version',1,'kind','retailer-existing-offer-sync-parent',
    'parent_plan_id',v_parent_id,'target_environment',v_target,
    'target_project_ref',v_project_ref,
    'target_database_identity',v_database_identity,
    'retailer_id','3','source_country','GB',
    'source_snapshot_fingerprint',v_source_fingerprint,
    'source_captured_at',p_request->>'source_captured_at',
    'manifest_fingerprint',v_manifest_fingerprint,
    'approved_manifest_sha256',upper(v_approved_manifest_sha),
    'child_plan_ids',v_child_ids,
    'child_fingerprints',v_child_fingerprints,
    'code_commit',v_code_commit,'expires_at',p_request->>'expires_at',
    'workflow',p_request->'workflow'
  );
  v_parent_fingerprint := public.retailer_catalogue_sha256_json(
    v_parent_hash_input
  );
  if (p_request->>'parent_plan_fingerprint') !~ '^[0-9a-f]{64}$'
     or p_request->>'parent_plan_fingerprint' is distinct from v_parent_fingerprint then
    perform public.retailer_catalogue_raise(
      'RSBI_PARENT_FINGERPRINT_MISMATCH','Parent plan fingerprint mismatch'
    );
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_target||':3',0));
  if exists(
    select 1 from public.retailer_catalogue_parent_plans
    where parent_plan_fingerprint=v_parent_fingerprint or id=v_parent_id
  ) then
    perform public.retailer_catalogue_raise(
      'RSBI_REPLAY_BLOCKED','Registered or consumed plan cannot be replayed'
    );
  end if;
  if exists(
    select 1 from public.retailer_catalogue_parent_plans
    where retailer_id=3 and target_environment=v_target
      and status in ('PLANNED','APPROVED','PARTIALLY_APPLIED','FAILED')
  ) then
    perform public.retailer_catalogue_raise(
      'RSBI_REPLAY_BLOCKED',
      'An equivalent Whey Okay control plan is already active'
    );
  end if;

  v_registration_actor := 'github:'||
    (p_request#>>'{workflow,repository}')||':'||
    (p_request#>>'{workflow,run_id}')||':'||
    (p_request#>>'{workflow,run_attempt}');
  v_parent_plan := v_parent_hash_input||jsonb_build_object(
    'parent_plan_fingerprint',v_parent_fingerprint,
    'manifest_count',v_manifest_count,
    'expected_deltas',v_expected_deltas
  );
  insert into public.retailer_catalogue_parent_plans(
    id,parent_plan_fingerprint,retailer_id,target_environment,
    source_snapshot_fingerprint,canonical_snapshot_fingerprint,
    adapter_fingerprint,policy_fingerprint,code_commit,
    expected_state_fingerprint,status,expected_deltas,plan_json,
    child_manifest,rollback_manifest,source_captured_at,
    canonical_snapshot_at,created_by,audit_log
  ) values (
    v_parent_id,v_parent_fingerprint,3,v_target,v_source_fingerprint,
    v_first_expected_state,v_first_adapter,v_first_policy,v_code_commit,
    v_first_expected_state,'PLANNED',v_expected_deltas,v_parent_plan,
    v_child_manifest,jsonb_build_object(
      'kind','MIXED_EXISTING_OFFER_UPDATE',
      'mapping_ids',to_jsonb(v_seen_mapping_ids)
    ),
    v_source_captured_at,now(),v_registration_actor,
    jsonb_build_array(jsonb_build_object(
      'event','APPROVED_RETAILER_AUTOMATION_PLAN_REGISTERED','at',now(),
      'caller_role',v_effective_role,'session_user',session_user,
      'workflow',p_request->'workflow',
      'approved_manifest_sha256',upper(v_approved_manifest_sha),
      'manifest_fingerprint',v_manifest_fingerprint,
      'source_snapshot_fingerprint',v_source_fingerprint,
      'operation_count',v_manifest_count
    ))
  );

  v_child_index := 0;
  for v_child in select value from jsonb_array_elements(v_children) loop
    v_artifact := v_child->'artifact';
    v_entry := v_child_manifest->v_child_index;
    insert into public.retailer_catalogue_child_plans(
      id,parent_plan_id,retailer_id,target_environment,
      child_plan_fingerprint,parent_plan_fingerprint,
      source_snapshot_fingerprint,canonical_snapshot_fingerprint,
      adapter_fingerprint,policy_fingerprint,code_commit,
      expected_state_fingerprint,batch_index,batch_count,
      dependency_group,rollback_group,record_ids,status,expected_deltas,
      plan_json,rollback_manifest,audit_log
    ) values (
      (v_child->>'child_plan_id')::uuid,v_parent_id,3,v_target,
      v_artifact->>'artifact_fingerprint',v_parent_fingerprint,
      v_source_fingerprint,v_artifact->>'expected_state_fingerprint',
      v_first_adapter,v_first_policy,v_code_commit,
      v_artifact->>'expected_state_fingerprint',v_child_index,v_child_count,
      v_entry->>'dependency_group',v_entry->>'rollback_group',
      v_entry->'record_ids','PLANNED',v_artifact->'expected_deltas',
      v_artifact,'[]'::jsonb,
      jsonb_build_array(jsonb_build_object(
        'event','APPROVED_RETAILER_AUTOMATION_CHILD_REGISTERED','at',now(),
        'caller_role',v_effective_role,'workflow',p_request->'workflow',
        'batch_index',v_child_index,
        'artifact_fingerprint',v_artifact->>'artifact_fingerprint'
      ))
    );
    v_child_index := v_child_index+1;
  end loop;

  return jsonb_build_object(
    'status','REGISTERED','parent_plan_id',v_parent_id,
    'parent_plan_fingerprint',v_parent_fingerprint,
    'child_plan_ids',v_child_ids,
    'child_fingerprints',v_child_fingerprints,
    'manifest_fingerprint',v_manifest_fingerprint,
    'approved_manifest_sha256',upper(v_approved_manifest_sha),
    'source_snapshot_fingerprint',v_source_fingerprint,
    'mapping_count',v_manifest_count,'child_count',v_child_count,
    'target_environment',v_target,'workflow',p_request->'workflow',
    'control_writes',1+v_child_count,'business_writes',0
  );
end
$register$;

alter function public.read_retailer_offer_sync_approved_state(bigint)
  owner to postgres;
alter function public.register_retailer_offer_sync_control_plan(jsonb)
  owner to postgres;

revoke all on function public.read_retailer_offer_sync_approved_state(bigint)
  from public,anon,authenticated,service_role;
revoke all on function public.register_retailer_offer_sync_control_plan(jsonb)
  from public,anon,authenticated,service_role;

do $grants$
begin
  if exists(
    select 1 from pg_roles
    where rolname='retailer_catalogue_staging_validator'
  ) then
    grant execute on function
      public.read_retailer_offer_sync_approved_state(bigint)
      to retailer_catalogue_staging_validator;
    grant execute on function
      public.register_retailer_offer_sync_control_plan(jsonb)
      to retailer_catalogue_staging_validator;
  end if;
  if exists(
    select 1 from pg_roles
    where rolname='retailer_catalogue_production_validator'
  ) then
    grant execute on function
      public.read_retailer_offer_sync_approved_state(bigint)
      to retailer_catalogue_production_validator;
    grant execute on function
      public.register_retailer_offer_sync_control_plan(jsonb)
      to retailer_catalogue_production_validator;
  end if;
end
$grants$;

commit;
