begin;

create table public.automation_review_queue_publications (
  id uuid primary key default gen_random_uuid(),
  retailer_id bigint not null references public.retailers(id) on delete restrict,
  retailer_slug text not null check (length(trim(retailer_slug)) between 1 and 200),
  batch_fingerprint text not null check (batch_fingerprint ~ '^[0-9a-f]{64}$'),
  changeset_fingerprint text not null check (changeset_fingerprint ~ '^[0-9a-f]{64}$'),
  idempotency_key text not null unique check (idempotency_key ~ '^[0-9a-f]{64}$'),
  workflow_run_id text not null check (length(trim(workflow_run_id)) between 1 and 200),
  artifact_id text not null check (length(trim(artifact_id)) between 1 and 200),
  commit_sha text not null check (commit_sha ~ '^[0-9a-f]{7,40}$'),
  capture_timestamp timestamptz not null,
  operation_count integer not null check (operation_count between 0 and 1000),
  operation_counts jsonb not null default '{}'::jsonb check (jsonb_typeof(operation_counts) = 'object'),
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  result jsonb not null check (jsonb_typeof(result) = 'object'),
  applied_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index automation_review_queue_publications_retailer_idx
  on public.automation_review_queue_publications (retailer_id, applied_at desc);

alter table public.automation_review_queue_publications enable row level security;
alter table public.automation_review_queue_publications force row level security;
revoke all on table public.automation_review_queue_publications from public, anon, authenticated, service_role;
grant select on table public.automation_review_queue_publications to service_role;

create or replace function public.publish_automation_review_queue_changes(p_request jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_retailer public.retailers%rowtype;
  v_existing_publication public.automation_review_queue_publications%rowtype;
  v_operation jsonb;
  v_row jsonb;
  v_existing_review public.product_match_review_queue%rowtype;
  v_replacement_id bigint;
  v_request_hash text;
  v_result jsonb;
  v_final_active_fingerprints jsonb;
  v_audit_before bigint;
  v_audit_after bigint;
  v_batch_fingerprint text;
  v_changeset_fingerprint text;
  v_idempotency_key text;
  v_retailer_id bigint;
  v_retailer_slug text;
  v_workflow_run_id text;
  v_artifact_id text;
  v_commit_sha text;
  v_capture_timestamp timestamptz;
  v_created_ids bigint[] := array[]::bigint[];
  v_refreshed_ids bigint[] := array[]::bigint[];
  v_superseded_ids bigint[] := array[]::bigint[];
  v_resolved_ids bigint[] := array[]::bigint[];
  v_expired_ids bigint[] := array[]::bigint[];
  v_operation_count integer;
  v_created integer := 0;
  v_refreshed integer := 0;
  v_superseded integer := 0;
  v_resolved integer := 0;
  v_expired integer := 0;
  v_create_count integer;
  v_refresh_count integer;
  v_supersede_count integer;
  v_resolve_count integer;
  v_expire_count integer;
  v_catalog_before jsonb;
  v_catalog_after jsonb;
  v_active_review_count bigint;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'AUTOMATION_REVIEW_PUBLICATION_SERVICE_ROLE_REQUIRED';
  end if;
  if jsonb_typeof(p_request) <> 'object' then
    raise exception 'AUTOMATION_REVIEW_PUBLICATION_REQUEST_INVALID';
  end if;
  if not public.atomic_import_has_exact_keys(
    p_request,
    array[
      'schema_version','kind','retailer','publisher_batch_fingerprint',
      'idempotency_key','changeset_fingerprint','workflow_run_id',
      'artifact_id','commit_sha','capture_timestamp','expected_baseline',
      'operations'
    ]
  ) then
    raise exception 'AUTOMATION_REVIEW_PUBLICATION_REQUEST_KEYS_INVALID';
  end if;
  if p_request->>'schema_version' <> '1'
     or p_request->>'kind' <> 'automation-review-queue-publication' then
    raise exception 'AUTOMATION_REVIEW_PUBLICATION_SCHEMA_INVALID';
  end if;
  if not public.atomic_import_has_exact_keys(p_request->'retailer', array['id','slug']) then
    raise exception 'AUTOMATION_REVIEW_PUBLICATION_RETAILER_KEYS_INVALID';
  end if;
  if not public.atomic_import_has_exact_keys(
    p_request->'expected_baseline',
    array['active_review_count','catalogue_counts','catalogue_hash_without_review_queue']
  ) then
    raise exception 'AUTOMATION_REVIEW_PUBLICATION_BASELINE_KEYS_INVALID';
  end if;

  v_retailer_id := nullif(p_request#>>'{retailer,id}', '')::bigint;
  v_retailer_slug := p_request#>>'{retailer,slug}';
  v_batch_fingerprint := p_request->>'publisher_batch_fingerprint';
  v_changeset_fingerprint := p_request->>'changeset_fingerprint';
  v_idempotency_key := p_request->>'idempotency_key';
  v_workflow_run_id := p_request->>'workflow_run_id';
  v_artifact_id := p_request->>'artifact_id';
  v_commit_sha := p_request->>'commit_sha';
  v_capture_timestamp := (p_request->>'capture_timestamp')::timestamptz;

  if v_retailer_id is null
     or coalesce(trim(v_retailer_slug), '') = ''
     or v_batch_fingerprint !~ '^[0-9a-f]{64}$'
     or v_changeset_fingerprint !~ '^[0-9a-f]{64}$'
     or v_idempotency_key !~ '^[0-9a-f]{64}$'
     or v_commit_sha !~ '^[0-9a-f]{7,40}$'
     or coalesce(trim(v_workflow_run_id), '') = ''
     or coalesce(trim(v_artifact_id), '') = '' then
    raise exception 'AUTOMATION_REVIEW_PUBLICATION_BINDING_INVALID';
  end if;
  if v_capture_timestamp > now() + interval '5 minutes' then
    raise exception 'AUTOMATION_REVIEW_PUBLICATION_CAPTURE_TIMESTAMP_INVALID';
  end if;
  if jsonb_typeof(p_request->'operations') <> 'array' then
    raise exception 'AUTOMATION_REVIEW_PUBLICATION_OPERATIONS_INVALID';
  end if;
  v_operation_count := jsonb_array_length(p_request->'operations');
  if v_operation_count > 1000 then
    raise exception 'AUTOMATION_REVIEW_PUBLICATION_BATCH_LIMIT_EXCEEDED';
  end if;

  select * into v_retailer
    from public.retailers
   where id = v_retailer_id
     and slug = v_retailer_slug;
  if not found then
    raise exception 'AUTOMATION_REVIEW_PUBLICATION_RETAILER_MISMATCH';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    concat_ws(':', 'supplementscout', 'automation-review-queue-publication', v_retailer_id::text),
    0
  ));

  v_request_hash := public.retailer_catalogue_sha256_json(p_request - 'idempotency_key');

  select * into v_existing_publication
    from public.automation_review_queue_publications
   where idempotency_key = v_idempotency_key
   for update;
  if found then
    if v_existing_publication.retailer_id <> v_retailer_id
       or v_existing_publication.batch_fingerprint <> v_batch_fingerprint
       or v_existing_publication.changeset_fingerprint <> v_changeset_fingerprint
       or v_existing_publication.request_hash <> v_request_hash then
      raise exception 'AUTOMATION_REVIEW_PUBLICATION_IDEMPOTENCY_CONFLICT';
    end if;
    return v_existing_publication.result
      || jsonb_build_object('already_applied', true, 'audit_event_delta', 0, 'database_writes', 0, 'catalogue_writes', 0);
  end if;

  select jsonb_build_object(
    'products', (select count(*) from public.products),
    'product_variants', (select count(*) from public.product_variants),
    'retailer_products', (select count(*) from public.retailer_products),
    'offers', (select count(*) from public.offers),
    'price_history', (select count(*) from public.price_history)
  ) into v_catalog_before;

  if p_request#>>'{expected_baseline,catalogue_hash_without_review_queue}' !~ '^[0-9a-f]{64}$'
     or public.retailer_catalogue_sha256_json(v_catalog_before) <> p_request#>>'{expected_baseline,catalogue_hash_without_review_queue}' then
    raise exception 'AUTOMATION_REVIEW_PUBLICATION_BASELINE_HASH_MISMATCH';
  end if;
  if p_request->'expected_baseline'->'catalogue_counts' <> v_catalog_before then
    raise exception 'AUTOMATION_REVIEW_PUBLICATION_BASELINE_CATALOGUE_COUNT_MISMATCH';
  end if;

  select count(*) into v_active_review_count
    from public.product_match_review_queue
   where retailer_id = v_retailer_id
     and review_status in ('PENDING','APPROVED');
  if (p_request#>>'{expected_baseline,active_review_count}') !~ '^[0-9]+$'
     or (p_request#>>'{expected_baseline,active_review_count}')::bigint <> v_active_review_count then
    raise exception 'AUTOMATION_REVIEW_PUBLICATION_BASELINE_ACTIVE_REVIEW_COUNT_MISMATCH';
  end if;

  select count(*) into v_audit_before from public.product_match_review_events;

  perform 1
    from public.product_match_review_queue q
   where q.id in (
     select (op#>>'{expected,review_id}')::bigint
       from jsonb_array_elements(p_request->'operations') op
      where op#>>'{expected,review_id}' is not null
        and (op#>>'{expected,review_id}') ~ '^[0-9]+$'
      order by (op#>>'{expected,review_id}')::bigint
   )
   order by q.id
   for update;

  for v_operation in select value from jsonb_array_elements(p_request->'operations') loop
    if not public.atomic_import_has_exact_keys(
      v_operation,
      array['op','expected','row','replacement_row']
    ) then
      raise exception 'AUTOMATION_REVIEW_PUBLICATION_OPERATION_KEYS_INVALID';
    end if;
    if v_operation->>'op' not in ('CREATE','REFRESH','SUPERSEDE','RESOLVE_BY_SOURCE','EXPIRE') then
      raise exception 'AUTOMATION_REVIEW_PUBLICATION_OPERATION_UNKNOWN';
    end if;
    if jsonb_typeof(v_operation->'expected') <> 'object' then
      raise exception 'AUTOMATION_REVIEW_PUBLICATION_EXPECTED_INVALID';
    end if;
    if not public.atomic_import_has_exact_keys(
      v_operation->'expected',
      array['review_id','review_status','source_row_fingerprint','superseded_by_review_id']
    ) then
      raise exception 'AUTOMATION_REVIEW_PUBLICATION_EXPECTED_KEYS_INVALID';
    end if;

    if v_operation->>'op' = 'CREATE' then
      v_row := v_operation->'row';
      if jsonb_typeof(v_row) <> 'object' then
        raise exception 'AUTOMATION_REVIEW_PUBLICATION_ROW_INVALID';
      end if;
      if not public.atomic_import_has_exact_keys(
        v_row,
        array[
          'snapshot_id','review_item_id','source_record_id','retailer','product_title',
          'variant_title','primary_status','reason_codes','confidence','canonical_candidates',
          'source_sku','source_gtin','source_weight','source_price','source_url','suggested_action',
          'retailer_id','retailer_product_id','offer_id','current_product_id','current_variant_id',
          'proposed_product_id','proposed_variant_id','review_status','review_kind','operation_type',
          'before_state','proposed_state','impact_summary','source_evidence','source_captured_at',
          'expires_at','workflow_run_url','artifact_url','source_row_fingerprint','artifact_fingerprint',
          'plan_fingerprint','plan_artifact_sha256'
        ]
      ) then
        raise exception 'AUTOMATION_REVIEW_PUBLICATION_ROW_KEYS_INVALID';
      end if;
      if (v_row->>'retailer_id')::bigint <> v_retailer_id
         or v_row->>'retailer' <> v_retailer.name
         or v_row->>'review_status' <> 'PENDING'
         or v_row->>'review_kind' not in ('IDENTITY_CONFLICT','COMMERCIAL_CHANGE','SOURCE_FAILURE','MAPPING_DRIFT','POLICY_REVIEW')
         or v_row->>'operation_type' not in (
           'VERIFY_NO_CHANGE','UPDATE_PRICE','UPDATE_STOCK','UPDATE_PRICE_AND_STOCK',
           'IDENTITY_PROMOTION','REBIND_EXISTING_VARIANT','SOURCE_MISSING','UNAVAILABLE_DECISION',
           'MANUAL_REVIEW','MANUAL_REVIEW_IDENTITY','SCOPE_EXPANSION_REVIEW'
         )
         or v_row->>'confidence' not in ('HIGH','MEDIUM','LOW')
         or (v_row->>'source_row_fingerprint') !~ '^[0-9a-f]{64}$'
         or (v_row->>'artifact_fingerprint') !~ '^[0-9a-f]{64}$'
         or coalesce(v_row->>'plan_fingerprint','') !~ '^$|^[0-9a-f]{64}$'
         or coalesce(v_row->>'plan_artifact_sha256','') !~ '^$|^[0-9a-f]{64}$'
         or exists (
           select 1
             from regexp_split_to_table(v_row->>'reason_codes', '[,|]') reason
            where btrim(reason) <> ''
              and btrim(reason) not in (
                'FRESHNESS_CONFIRMATION','STALE_OFFER','NO_CHANGE_CONFIRMATION','PRICE_CHANGE',
                'STOCK_CHANGE','PRICE_AND_STOCK_CHANGE','SOURCE_FAILURE','SOURCE_MISSING',
                'MISSING_FROM_SOURCE','IDENTITY_CONFLICT','MAPPING_DRIFT','POLICY_REVIEW',
                'SCOPE_EXPANSION_REVIEW','MANUAL_REVIEW','OUTSIDE_APPROVED_SCOPE'
              )
         ) then
        raise exception 'AUTOMATION_REVIEW_PUBLICATION_ROW_CONTRACT_INVALID';
      end if;
      if exists (
        select 1 from public.product_match_review_queue
         where retailer_id = v_retailer_id
           and offer_id = (v_row->>'offer_id')::bigint
           and review_status in ('PENDING','APPROVED')
           and source_row_fingerprint = v_row->>'source_row_fingerprint'
      ) then
        raise exception 'AUTOMATION_REVIEW_PUBLICATION_DUPLICATE_ACTIVE_ROW';
      end if;

      insert into public.product_match_review_queue (
        snapshot_id, review_item_id, source_record_id, retailer, product_title, variant_title,
        primary_status, reason_codes, confidence, canonical_candidates, source_sku, source_gtin,
        source_weight, source_price, source_url, suggested_action, decision,
        retailer_id, retailer_product_id, offer_id, current_product_id, current_variant_id,
        proposed_product_id, proposed_variant_id, review_status, review_kind, operation_type,
        before_state, proposed_state, impact_summary, source_evidence, source_captured_at,
        expires_at, workflow_run_url, artifact_url, source_row_fingerprint, artifact_fingerprint,
        plan_fingerprint, plan_artifact_sha256, decision_actor
      ) values (
        v_row->>'snapshot_id', v_row->>'review_item_id', v_row->>'source_record_id', v_row->>'retailer',
        v_row->>'product_title', nullif(v_row->>'variant_title',''), v_row->>'primary_status',
        v_row->>'reason_codes', v_row->>'confidence', v_row->'canonical_candidates',
        nullif(v_row->>'source_sku',''), nullif(v_row->>'source_gtin',''), nullif(v_row->>'source_weight',''),
        nullif(v_row->>'source_price','')::numeric, nullif(v_row->>'source_url',''), v_row->>'suggested_action',
        'PENDING', (v_row->>'retailer_id')::bigint, nullif(v_row->>'retailer_product_id','')::bigint,
        nullif(v_row->>'offer_id','')::bigint, nullif(v_row->>'current_product_id','')::bigint,
        nullif(v_row->>'current_variant_id','')::bigint, nullif(v_row->>'proposed_product_id','')::bigint,
        nullif(v_row->>'proposed_variant_id','')::bigint, v_row->>'review_status', v_row->>'review_kind',
        v_row->>'operation_type', nullif(v_row->'before_state','null'::jsonb), nullif(v_row->'proposed_state','null'::jsonb),
        v_row->'impact_summary', v_row->'source_evidence', (v_row->>'source_captured_at')::timestamptz,
        (v_row->>'expires_at')::timestamptz, nullif(v_row->>'workflow_run_url',''), nullif(v_row->>'artifact_url',''),
        v_row->>'source_row_fingerprint', v_row->>'artifact_fingerprint',
        nullif(v_row->>'plan_fingerprint',''), nullif(v_row->>'plan_artifact_sha256',''),
        'automation-review-publisher'
      ) returning id into v_replacement_id;
      v_created := v_created + 1;
      v_created_ids := array_append(v_created_ids, v_replacement_id);
    else
      if coalesce(v_operation#>>'{expected,review_id}', '') !~ '^[0-9]+$'
         or coalesce(v_operation#>>'{expected,source_row_fingerprint}', '') !~ '^[0-9a-f]{64}$'
         or v_operation#>>'{expected,review_status}' not in ('PENDING','APPROVED') then
        raise exception 'AUTOMATION_REVIEW_PUBLICATION_EXPECTED_CONTRACT_INVALID';
      end if;
      select * into v_existing_review
        from public.product_match_review_queue
       where id = (v_operation#>>'{expected,review_id}')::bigint
       for update;
      if not found
         or v_existing_review.retailer_id <> v_retailer_id
         or v_existing_review.review_status is distinct from v_operation#>>'{expected,review_status}'
         or v_existing_review.source_row_fingerprint is distinct from v_operation#>>'{expected,source_row_fingerprint}'
         or coalesce(v_existing_review.superseded_by_review_id::text, '') is distinct from coalesce(v_operation#>>'{expected,superseded_by_review_id}', '') then
        raise exception 'AUTOMATION_REVIEW_PUBLICATION_STALE_EXPECTED_STATE';
      end if;

      if v_operation->>'op' = 'REFRESH' then
        v_row := v_operation->'row';
        if jsonb_typeof(v_row) <> 'object'
           or not public.atomic_import_has_exact_keys(
             v_row,
             array['source_evidence','source_captured_at','expires_at','workflow_run_url','artifact_url','plan_fingerprint','plan_artifact_sha256']
           )
           or coalesce(v_row->>'plan_fingerprint','') !~ '^$|^[0-9a-f]{64}$'
           or coalesce(v_row->>'plan_artifact_sha256','') !~ '^$|^[0-9a-f]{64}$' then
          raise exception 'AUTOMATION_REVIEW_PUBLICATION_REFRESH_CONTRACT_INVALID';
        end if;
        update public.product_match_review_queue set
          source_evidence = v_row->'source_evidence',
          source_captured_at = (v_row->>'source_captured_at')::timestamptz,
          expires_at = (v_row->>'expires_at')::timestamptz,
          workflow_run_url = nullif(v_row->>'workflow_run_url',''),
          artifact_url = nullif(v_row->>'artifact_url',''),
          plan_fingerprint = nullif(v_row->>'plan_fingerprint',''),
          plan_artifact_sha256 = nullif(v_row->>'plan_artifact_sha256',''),
          decision_actor = 'automation-review-publisher',
          updated_at = now()
        where id = v_existing_review.id;
        v_refreshed := v_refreshed + 1;
        v_refreshed_ids := array_append(v_refreshed_ids, v_existing_review.id);
      elsif v_operation->>'op' in ('SUPERSEDE','RESOLVE_BY_SOURCE','EXPIRE') then
        v_replacement_id := null;
        if v_operation->>'op' = 'SUPERSEDE' then
          if jsonb_typeof(v_operation->'replacement_row') <> 'object'
             or not public.atomic_import_has_exact_keys(v_operation->'replacement_row', array['id','offer_id','source_row_fingerprint'])
             or coalesce(v_operation#>>'{replacement_row,offer_id}', '') !~ '^[0-9]+$'
             or coalesce(v_operation#>>'{replacement_row,source_row_fingerprint}', '') !~ '^[0-9a-f]{64}$' then
            raise exception 'AUTOMATION_REVIEW_PUBLICATION_REPLACEMENT_REQUIRED';
          end if;
          select id into v_replacement_id
            from public.product_match_review_queue
           where retailer_id = v_retailer_id
             and offer_id = (v_operation#>>'{replacement_row,offer_id}')::bigint
             and source_row_fingerprint = v_operation#>>'{replacement_row,source_row_fingerprint}'
             and review_status in ('PENDING','APPROVED')
           order by id desc
           limit 1
           for update;
          if not found then
            raise exception 'AUTOMATION_REVIEW_PUBLICATION_REPLACEMENT_NOT_FOUND';
          end if;
        end if;
        update public.product_match_review_queue set
          review_status = 'EXPIRED',
          superseded_by_review_id = v_replacement_id,
          execution_error_code = case
            when v_operation->>'op' = 'SUPERSEDE' then 'EVIDENCE_SUPERSEDED'
            when v_operation->>'op' = 'RESOLVE_BY_SOURCE' then 'RESOLVED_BY_SOURCE'
            else 'EXPIRED_BY_PUBLISHER'
          end,
          execution_error_message = case
            when v_operation->>'op' = 'SUPERSEDE' then 'Fresh evidence produced a new semantic problem fingerprint for this offer.'
            when v_operation->>'op' = 'RESOLVE_BY_SOURCE' then 'Fresh evidence no longer reports this active review problem.'
            else 'Review problem expired during publisher lifecycle reconciliation.'
          end,
          decision_actor = 'automation-review-publisher',
          updated_at = now()
        where id = v_existing_review.id;
        if v_operation->>'op' = 'SUPERSEDE' then
          v_superseded := v_superseded + 1;
          v_superseded_ids := array_append(v_superseded_ids, v_existing_review.id);
        elsif v_operation->>'op' = 'RESOLVE_BY_SOURCE' then
          v_resolved := v_resolved + 1;
          v_resolved_ids := array_append(v_resolved_ids, v_existing_review.id);
        else
          v_expired := v_expired + 1;
          v_expired_ids := array_append(v_expired_ids, v_existing_review.id);
        end if;
      end if;
    end if;
  end loop;

  select jsonb_build_object(
    'products', (select count(*) from public.products),
    'product_variants', (select count(*) from public.product_variants),
    'retailer_products', (select count(*) from public.retailer_products),
    'offers', (select count(*) from public.offers),
    'price_history', (select count(*) from public.price_history)
  ) into v_catalog_after;
  if v_catalog_after <> v_catalog_before then
    raise exception 'AUTOMATION_REVIEW_PUBLICATION_CATALOGUE_WRITE_DETECTED';
  end if;

  select count(*) into v_audit_after from public.product_match_review_events;
  select coalesce(jsonb_agg(jsonb_build_object(
    'review_id', q.id,
    'offer_id', q.offer_id,
    'source_row_fingerprint', q.source_row_fingerprint,
    'review_status', q.review_status
  ) order by q.offer_id, q.id), '[]'::jsonb)
    into v_final_active_fingerprints
    from public.product_match_review_queue q
   where q.retailer_id = v_retailer_id
     and q.review_status in ('PENDING','APPROVED');

  v_create_count := v_created;
  v_refresh_count := v_refreshed;
  v_supersede_count := v_superseded;
  v_resolve_count := v_resolved;
  v_expire_count := v_expired;
  if v_operation_count <> v_create_count + v_refresh_count + v_supersede_count + v_resolve_count + v_expire_count then
    raise exception 'AUTOMATION_REVIEW_PUBLICATION_OPERATION_COUNT_MISMATCH';
  end if;

  v_result := jsonb_build_object(
    'status', 'APPLIED',
    'batch_fingerprint', v_batch_fingerprint,
    'changeset_fingerprint', v_changeset_fingerprint,
    'idempotency_key', v_idempotency_key,
    'already_applied', false,
    'created_count', v_created,
    'refreshed_count', v_refreshed,
    'superseded_count', v_superseded,
    'resolved_by_source_count', v_resolved,
    'expired_count', v_expired,
    'created_ids', to_jsonb(v_created_ids),
    'refreshed_ids', to_jsonb(v_refreshed_ids),
    'superseded_ids', to_jsonb(v_superseded_ids),
    'resolved_by_source_ids', to_jsonb(v_resolved_ids),
    'expired_ids', to_jsonb(v_expired_ids),
    'audit_event_delta', v_audit_after - v_audit_before,
    'final_active_fingerprints', v_final_active_fingerprints,
    'database_writes', v_operation_count + (v_audit_after - v_audit_before) + 1,
    'catalogue_writes', 0
  );

  insert into public.automation_review_queue_publications (
    retailer_id, retailer_slug, batch_fingerprint, changeset_fingerprint,
    idempotency_key, workflow_run_id, artifact_id, commit_sha, capture_timestamp,
    operation_count, operation_counts, request_hash, result
  ) values (
    v_retailer_id, v_retailer_slug, v_batch_fingerprint, v_changeset_fingerprint,
    v_idempotency_key, v_workflow_run_id, v_artifact_id, v_commit_sha, v_capture_timestamp,
    v_operation_count,
    jsonb_build_object(
      'CREATE', v_created,
      'REFRESH', v_refreshed,
      'SUPERSEDE', v_superseded,
      'RESOLVE_BY_SOURCE', v_resolved,
      'EXPIRE', v_expired
    ),
    v_request_hash,
    v_result
  );

  return v_result;
end;
$$;

alter function public.publish_automation_review_queue_changes(jsonb) owner to postgres;
revoke all on function public.publish_automation_review_queue_changes(jsonb) from public, anon, authenticated, service_role;
grant execute on function public.publish_automation_review_queue_changes(jsonb) to service_role;

comment on table public.automation_review_queue_publications is
  'Idempotency seal for atomic Review Queue publisher lifecycle batches. It records control-plane writes only and never authorizes catalogue mutation.';
comment on function public.publish_automation_review_queue_changes(jsonb) is
  'Applies a validated Review Queue lifecycle changeset in one transaction. Allowed operations are CREATE, REFRESH, SUPERSEDE, RESOLVE_BY_SOURCE and EXPIRE; catalogue tables are checked read-only.';

commit;
