-- Executed only in the disposable publication database, after the real queue
-- migrations and production hashing helpers have been loaded by the runner.
do $guard$
begin
  if current_database() !~ '^supplementscout_stage2_test_atomic_import_[a-z0-9_]+$'
     or inet_server_addr() is not null then raise exception 'LOCAL_PUBLICATION_SCENARIOS_ONLY'; end if;
end
$guard$;
set request.jwt.claim.role='service_role';
\if :{?expect_flat_rejection}
set test.expect_flat_rejection='on';
\endif

create or replace function pg_temp.catalogue_snapshot() returns jsonb language sql as $$
  select jsonb_build_object(
    'products',(select jsonb_agg(to_jsonb(t) order by id) from public.products t),
    'product_variants',(select jsonb_agg(to_jsonb(t) order by id) from public.product_variants t),
    'retailer_products',(select jsonb_agg(to_jsonb(t) order by id) from public.retailer_products t),
    'offers',(select jsonb_agg(to_jsonb(t) order by id) from public.offers t),
    'price_history',(select jsonb_agg(to_jsonb(t) order by id) from public.price_history t))
$$;
create or replace function pg_temp.control_snapshot() returns jsonb language sql as $$
  select jsonb_build_object(
    'queue',(select jsonb_agg(to_jsonb(t) order by id) from public.product_match_review_queue t),
    'events',(select jsonb_agg(to_jsonb(t) order by id) from public.product_match_review_events t),
    'receipts',(select jsonb_agg(to_jsonb(t) order by id) from public.automation_review_queue_publications t))
$$;

-- Same retained incident partition: 38 REFRESH operations, 16 commercial stock
-- changes and 22 noncommercial reviews. All identities and URLs are synthetic.
insert into public.product_match_review_queue(
  snapshot_id,review_item_id,source_record_id,retailer,product_title,primary_status,
  confidence,reason_codes,source_row_fingerprint,artifact_fingerprint,
  retailer_id,retailer_product_id,offer_id,current_product_id,current_variant_id,
  review_status,review_kind,operation_type,before_state,proposed_state,
  source_captured_at,expires_at,plan_fingerprint,plan_artifact_sha256
)
select 'fixture','review-'||i,'record-'||i,'Fixture Retailer','Product '||i,'PENDING','HIGH',
  case when i<=16 then 'STOCK_CHANGE' else 'IDENTITY_CONFLICT' end,
  public.retailer_catalogue_sha256_json(to_jsonb(i)),repeat('a',64),901,i,i,i,i,
  'PENDING',case when i<=16 then 'COMMERCIAL_CHANGE' else 'IDENTITY_CONFLICT' end,
  case when i<=16 then 'UPDATE_STOCK' else 'MANUAL_REVIEW_IDENTITY' end,
  jsonb_build_object('in_stock',true),jsonb_build_object('in_stock',false),
  now()-interval '1 hour',now()+interval '1 day',repeat('b',64),repeat('c',64)
from generate_series(1,38) i
where not exists(select 1 from public.product_match_review_queue q where q.offer_id=i);

create or replace function pg_temp.make_refresh(p_shape text) returns jsonb
language plpgsql as $request$
declare
  v_review public.product_match_review_queue%rowtype;
  v_before jsonb; v_proposed jsonb; v_binding jsonb; v_identity jsonb;
  v_operations jsonb:='[]'; v_counts jsonb; v_nonce text:=gen_random_uuid()::text;
  v_capture timestamptz:=clock_timestamp();
begin
  for v_review in select * from public.product_match_review_queue order by offer_id loop
    select jsonb_build_object(
      'offer_id',o.id::text,'retailer_product_id',rp.id::text,
      'product_id',o.product_id::text,'product_variant_id',o.product_variant_id::text,
      'price',o.price::text,'shipping_cost',o.shipping_cost::text,'total_price',o.total_price::text,
      'in_stock',o.in_stock,'url',o.url,'external_url',rp.external_url,
      'external_product_id',rp.external_product_id,'external_variant_id',rp.external_variant_id)
    into v_before from public.offers o join public.retailer_products rp on rp.id=o.retailer_product_id
    where o.id=v_review.offer_id;
    v_proposed:=jsonb_set(v_before,'{in_stock}','false');
    if p_shape='nested' then v_proposed:=jsonb_build_object('offer',v_proposed); end if;
    v_binding:=case when v_review.review_kind='COMMERCIAL_CHANGE' then jsonb_build_object(
      'source_price',v_before->>'price','source_url',v_before->>'url',
      'before_state',v_before,'proposed_state',v_proposed,
      'impact_summary',jsonb_build_object('catalogue_writes',0,'executable',false,'review_only',true),
      'artifact_fingerprint',repeat('d',64),'plan_fingerprint',repeat('e',64),'plan_artifact_sha256',repeat('f',64))
      else 'null'::jsonb end;
    v_identity:=jsonb_build_object(
      'retailer_id',v_review.retailer_id::text,'retailer_product_id',v_review.retailer_product_id::text,
      'offer_id',v_review.offer_id::text,'current_product_id',v_review.current_product_id::text,
      'current_variant_id',v_review.current_variant_id::text,'proposed_product_id',null,'proposed_variant_id',null,
      'review_kind',v_review.review_kind,'operation_type',v_review.operation_type,
      'reason_codes',v_review.reason_codes,'source_row_fingerprint',v_review.source_row_fingerprint);
    v_operations:=v_operations||jsonb_build_array(jsonb_build_object(
      'op','REFRESH','expected',jsonb_build_object('review_id',v_review.id::text,
        'review_status',v_review.review_status,'source_row_fingerprint',v_review.source_row_fingerprint,'superseded_by_review_id',null),
      'row',jsonb_build_object('identity',v_identity,'execution_binding',v_binding,
        'source_evidence',jsonb_build_object('fixture_capture',v_nonce),
        'source_captured_at',v_capture,'expires_at',v_capture+interval '1 day',
        'workflow_run_url','https://fixture.invalid/run','artifact_url','https://fixture.invalid/artifact'),
      'replacement_row',null));
  end loop;
  select jsonb_build_object('products',(select count(*) from public.products),
    'product_variants',(select count(*) from public.product_variants),
    'retailer_products',(select count(*) from public.retailer_products),
    'offers',(select count(*) from public.offers),'price_history',(select count(*) from public.price_history)) into v_counts;
  return jsonb_build_object('schema_version',1,'kind','automation-review-queue-publication',
    'retailer',jsonb_build_object('id','901','slug','fixture-retailer'),
    'publisher_batch_fingerprint',public.retailer_catalogue_sha256_json(to_jsonb(v_nonce||'batch')),
    'idempotency_key',public.retailer_catalogue_sha256_json(to_jsonb(v_nonce||'key')),
    'changeset_fingerprint',public.retailer_catalogue_sha256_json(to_jsonb(v_nonce||'changes')),
    'workflow_run_id','fixture-run','artifact_id','fixture-artifact','commit_sha',repeat('a',40),
    'capture_timestamp',v_capture,'expected_baseline',jsonb_build_object(
      'active_review_count',(select count(*) from public.product_match_review_queue where review_status in ('PENDING','APPROVED')),
      'catalogue_counts',v_counts,'catalogue_hash_without_review_queue',public.retailer_catalogue_sha256_json(v_counts)),
    'operations',v_operations);
end
$request$;

do $scenario$
declare
  v_request jsonb; v_result jsonb; v_catalogue jsonb:=pg_temp.catalogue_snapshot();
  v_control jsonb; v_proposal jsonb; v_mutation jsonb; v_error text;
  v_format text; v_case integer; v_passed integer:=0;
begin
  -- The immediately preceding function must reproduce the retained incident.
  if current_setting('test.expect_flat_rejection',true)='on' then
    update public.product_match_review_queue set review_status='PENDING',decision_actor=null where review_status='APPROVED';
    v_request:=pg_temp.make_refresh('flat'); v_control:=pg_temp.control_snapshot();
    begin
      perform public.publish_automation_review_queue_changes(v_request);
      raise exception 'FIXTURE_EXPECTED_FLAT_REJECTION';
    exception when others then
      if sqlerrm<>'AUTOMATION_REVIEW_PUBLICATION_REFRESH_BINDING_INVALID' then raise; end if;
    end;
    if pg_temp.control_snapshot() is distinct from v_control then raise exception 'REJECTION_CHANGED_CONTROL_STATE'; end if;
    return;
  end if;

  foreach v_format in array array['flat','nested'] loop
    v_request:=pg_temp.make_refresh(v_format);
    v_result:=public.publish_automation_review_queue_changes(v_request);
    if (v_result->>'refreshed_count')::int<>38 or (v_result->>'catalogue_writes')::int<>0 then
      raise exception 'FULL_38_ROW_PARTITION_NOT_REFRESHED';
    end if;
    if exists(select 1 from public.product_match_review_queue q where review_kind='COMMERCIAL_CHANGE'
      and q.proposed_state is distinct from v_request#>array['operations',(q.offer_id-1)::text,'row','execution_binding','proposed_state']) then
      raise exception 'STORED_PROPOSAL_SHAPE_OR_VALUES_CHANGED';
    end if;
    v_control:=pg_temp.control_snapshot();
    v_result:=public.publish_automation_review_queue_changes(v_request);
    if v_result->>'already_applied'<>'true' or pg_temp.control_snapshot() is distinct from v_control then
      raise exception 'REPLAY_MUTATED_CONTROL_STATE';
    end if;
    for v_case in 1..18 loop
      v_request:=pg_temp.make_refresh(v_format);
      v_proposal:=v_request#>'{operations,15,row,execution_binding,proposed_state}';
      -- Mutate the sixteenth commercial row so previous updates/audit events
      -- would have occurred if publication were not transactionally atomic.
      v_mutation:=v_request#>'{operations,15,row,execution_binding}';
      case v_case
        when 1 then v_mutation:=jsonb_set(v_mutation,'{source_price}','"11.00"');
        when 2 then v_mutation:=jsonb_set(v_mutation,'{source_url}','"https://fixture.invalid/wrong"');
        when 3 then v_mutation:=jsonb_set(v_mutation,'{before_state,offer_id}','"99999"');
        when 4 then v_mutation:=jsonb_set(v_mutation,'{before_state,product_variant_id}','"99999"');
        when 5 then v_mutation:=jsonb_set(v_mutation,'{before_state,external_variant_id}','"wrong-variant"');
        when 6 then v_mutation:=jsonb_set(v_mutation,'{before_state,in_stock}','false');
        when 7 then v_mutation:=jsonb_set(v_mutation,'{artifact_fingerprint}','"invalid"');
        when 8 then v_mutation:=v_mutation-'plan_fingerprint';
        when 9 then v_mutation:=jsonb_set(v_mutation,'{proposed_state}','[]');
        when 10 then v_mutation:=jsonb_set(v_mutation,'{proposed_state}',jsonb_build_object('offer','null'::jsonb,'price','10.00'));
        when 11 then v_mutation:=jsonb_set(v_mutation,'{proposed_state}',jsonb_build_object('offer','[]'::jsonb));
        when 12 then
          v_mutation:=jsonb_set(v_mutation,'{proposed_state}',jsonb_build_object('offer',case when v_format='nested' then v_proposal->'offer' else v_proposal end,'price','10.00'));
        when 13 then
          v_mutation:=jsonb_set(v_mutation,'{proposed_state}',jsonb_build_object('offer',case when v_format='nested' then v_proposal->'offer' else v_proposal end,'in_stock',false));
        else
          if v_format='nested' then v_proposal:=v_proposal->'offer'; end if;
          case v_case
            when 14 then v_proposal:=jsonb_set(v_proposal,'{shipping_cost}','"4.99"');
            when 15 then v_proposal:=jsonb_set(v_proposal,'{total_price}','"14.99"');
            when 16 then v_proposal:=jsonb_set(v_proposal,'{url}','"https://fixture.invalid/wrong"');
            when 17 then v_proposal:=jsonb_set(v_proposal,'{in_stock}','"false"');
            when 18 then v_proposal:=v_proposal-'price';
          end case;
          v_mutation:=jsonb_set(v_mutation,'{proposed_state}',case when v_format='nested' then jsonb_build_object('offer',v_proposal) else v_proposal end);
      end case;
      v_request:=jsonb_set(v_request,'{operations,15,row,execution_binding}',v_mutation);
      v_control:=pg_temp.control_snapshot(); v_error:=null;
      begin
        perform public.publish_automation_review_queue_changes(v_request);
      exception when others then v_error:=sqlerrm; end;
      if v_error is distinct from 'AUTOMATION_REVIEW_PUBLICATION_REFRESH_BINDING_INVALID' then
        raise exception 'NEGATIVE_CASE_NOT_REJECTED: shape=%, case=%, error=%',v_format,v_case,v_error;
      end if;
      if pg_temp.control_snapshot() is distinct from v_control then raise exception 'NEGATIVE_CASE_PARTIAL_WRITE'; end if;
      v_passed:=v_passed+1;
    end loop;
  end loop;
  -- A decision already made by an owner is never refreshed.
  update public.product_match_review_queue set review_status='APPROVED',decision_actor='fixture-owner' where offer_id=1;
  v_request:=pg_temp.make_refresh('flat'); v_control:=pg_temp.control_snapshot(); v_error:=null;
  begin perform public.publish_automation_review_queue_changes(v_request);
  exception when others then v_error:=sqlerrm; end;
  if v_error is distinct from 'AUTOMATION_REVIEW_PUBLICATION_REFRESH_CONTRACT_INVALID'
     or pg_temp.control_snapshot() is distinct from v_control then raise exception 'APPROVED_EVIDENCE_NOT_IMMUTABLE'; end if;
  perform set_config('request.jwt.claim.role','anon',false); v_error:=null;
  begin perform public.publish_automation_review_queue_changes(v_request);
  exception when others then v_error:=sqlerrm; end;
  if v_error is distinct from 'AUTOMATION_REVIEW_PUBLICATION_SERVICE_ROLE_REQUIRED' then raise exception 'SERVICE_ROLE_BOUNDARY_WEAKENED'; end if;
  perform set_config('request.jwt.claim.role','service_role',false);
  if pg_temp.catalogue_snapshot() is distinct from v_catalogue then raise exception 'CATALOGUE_CHANGED'; end if;
  if has_function_privilege('anon','public.publish_automation_review_queue_changes(jsonb)','EXECUTE')
     or has_function_privilege('authenticated','public.publish_automation_review_queue_changes(jsonb)','EXECUTE')
     or not has_function_privilege('service_role','public.publish_automation_review_queue_changes(jsonb)','EXECUTE') then
    raise exception 'PUBLICATION_ACL_DRIFT';
  end if;
  raise notice 'SHARED_PUBLICATION_PROPOSED_STATE_PASS: partition=38 commercial=16 noncommercial=22 negative_cases=%',v_passed;
end
$scenario$;
