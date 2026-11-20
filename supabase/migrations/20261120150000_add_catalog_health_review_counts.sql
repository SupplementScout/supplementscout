BEGIN;
-- Add current Catalog Health counters to the existing admin queue reader.
set local lock_timeout = '5s';
set local statement_timeout = '60s';

create or replace function public.read_automation_review_queue_page_v1(p_request jsonb)
returns jsonb language plpgsql stable security invoker set search_path = pg_catalog, public, pg_temp as $$
declare
  v_page integer := (p_request->>'page')::integer;
  v_size integer := (p_request->>'page_size')::integer;
  v_result jsonb;
begin
  if current_user <> 'service_role' then raise exception 'ADMIN_REVIEW_READER_ROLE_REQUIRED' using errcode='42501'; end if;
  if jsonb_typeof(p_request) is distinct from 'object' or p_request->>'schema_version' is distinct from '1'
     or v_page is null or v_size is null or v_page < 1 or v_page > 1000000 or v_size < 1 or v_size > 50
     or jsonb_typeof(p_request->'filters') is distinct from 'object'
     or jsonb_typeof(p_request->'capabilities') is distinct from 'object'
     or (nullif(p_request->>'revision','') is not null and p_request->>'revision' !~ '^[0-9a-f]{32}$') then
    raise exception 'ADMIN_REVIEW_READER_REQUEST_INVALID';
  end if;
  with queue as materialized (
    select q.id,q.retailer,q.retailer_id,q.offer_id,q.product_title,q.variant_title,q.source_price,q.source_url,
      q.current_product_id,q.current_variant_id,q.review_status,q.review_kind,q.operation_type,q.reason_codes,
      q.before_state,q.proposed_state,q.impact_summary,q.source_evidence,q.source_captured_at,q.expires_at,
      q.source_row_fingerprint,q.plan_fingerprint,q.workflow_run_url,q.artifact_url,q.superseded_by_review_id,
      q.execution_error_code,q.execution_error_message,q.updated_at,
      row_number() over(partition by q.retailer_id,q.offer_id,case when q.offer_id is null then q.id else null end order by (q.superseded_by_review_id is null) desc,q.updated_at desc nulls last,q.id desc) current_rank
    from public.product_match_review_queue q where q.review_status is not null
      and (coalesce((p_request->'filters'->>'history')::boolean,false) or q.superseded_by_review_id is null)
  ), selected as (
    select * from queue where coalesce((p_request->'filters'->>'history')::boolean,false) or current_rank=1
  ), joined as materialized (
    select q.*, to_jsonb(e) execution_request,
      case when e.id is null then null when e.review_fingerprint=q.source_row_fingerprint and e.plan_fingerprint=q.plan_fingerprint
        then e.status else 'EVIDENCE_CHANGED' end execution_status,e.requested_at execution_requested_at,
      case upper(coalesce(q.operation_type,''))
        when 'VERIFY_OFFER_NO_CHANGE' then 'VERIFY_NO_CHANGE'
        when 'MANUAL_REVIEW_IDENTITY' then 'IDENTITY_PROMOTION'
        when 'MANUAL_REVIEW' then case q.review_kind when 'MAPPING_DRIFT' then 'REBIND_EXISTING_VARIANT'
          when 'SOURCE_FAILURE' then 'SOURCE_MISSING' when 'POLICY_REVIEW' then 'POLICY_REVIEW' else 'MANUAL_REVIEW' end
        when '' then case q.review_kind when 'SOURCE_FAILURE' then 'SOURCE_MISSING' when 'MAPPING_DRIFT' then 'REBIND_EXISTING_VARIANT'
          when 'IDENTITY_CONFLICT' then 'IDENTITY_PROMOTION' else 'UNKNOWN' end
        else upper(q.operation_type) end normalized_operation
    from selected q left join lateral (
      select r.id,r.review_id,r.review_fingerprint,r.plan_fingerprint,r.status,r.requested_at,r.run_url,r.last_checkpoint,
        r.error_code,r.error_message,r.postflight_hash,r.idempotency_result,r.database_writes
      from public.automation_review_execution_requests r where r.review_id=q.id
      order by r.requested_at desc,r.id desc limit 1
    ) e on true
  ), classified as (
    select j.*,
      coalesce(p_request#>>array['capabilities',j.retailer_id::text,j.normalized_operation],'UNSUPPORTED') capability,
      case when execution_status='EVIDENCE_CHANGED' then 'EVIDENCE_CHANGED'
        when execution_status in ('QUEUED','DISPATCHED','EXECUTING') and review_status not in ('EXECUTED','REJECTED','IGNORED') then execution_status
        when expires_at<=now() and review_status in ('PENDING','APPROVED') then 'EXPIRED' else review_status end lifecycle,
      case when normalized_operation='VERIFY_NO_CHANGE' then 'Freshness-only'
        when normalized_operation in ('UPDATE_PRICE','UPDATE_STOCK','UPDATE_PRICE_AND_STOCK','POLICY_REVIEW') then 'Stock and price'
        when normalized_operation in ('IDENTITY_PROMOTION','REBIND_EXISTING_VARIANT') or review_kind in ('IDENTITY_CONFLICT','MAPPING_DRIFT') then 'Identity'
        when normalized_operation in ('SOURCE_MISSING','UNAVAILABLE_DECISION') or review_kind='SOURCE_FAILURE' or reason_codes ~ 'SOURCE|UNAVAILABLE|MISSING' then 'Source problems'
        else 'Identity' end decision_group,
      upper(coalesce(nullif(source_evidence->>'confidence',''),nullif(source_evidence->>'identity_confidence',''),
        nullif(impact_summary->>'confidence',''),nullif(impact_summary->>'recommendation_confidence',''),'RECORDED')) confidence
    from joined j
  ), model as materialized (
    select c.*,case
      when execution_status='EVIDENCE_CHANGED' then 'TECHNICAL'
      when execution_status in ('QUEUED','DISPATCHED','EXECUTING') then 'PROCESSING'
      when lifecycle='APPROVED' and execution_status is not null then 'TECHNICAL'
      when lifecycle='PENDING' and capability='REVIEW_EXECUTABLE' then 'DECIDE'
      when lifecycle='APPROVED' and capability='REVIEW_EXECUTABLE' and plan_fingerprint is not null then 'EXECUTE'
      when lifecycle='EXECUTING' then 'PROCESSING'
      when lifecycle in ('EXECUTED','REJECTED','IGNORED','EXPIRED') then 'COMPLETED' else 'TECHNICAL' end work_bucket
    from classified c
  ), filtered as materialized (
    select m.* from model m where
      (coalesce(p_request#>>'{filters,reviewId}','')='' or id::text=p_request#>>'{filters,reviewId}')
      and (coalesce(p_request#>>'{filters,scope}','DECISIONS')='ALL' or capability<>'AUTONOMOUS')
      and (coalesce(p_request#>>'{filters,status}','ALL')='ALL' or lifecycle=p_request#>>'{filters,status}')
      and (coalesce(p_request#>>'{filters,bucket}','ALL')='ALL' or work_bucket=p_request#>>'{filters,bucket}')
      and (coalesce(p_request#>>'{filters,retailer}','')='' or retailer=p_request#>>'{filters,retailer}')
      and (coalesce(p_request#>>'{filters,kind}','')='' or review_kind=p_request#>>'{filters,kind}')
      and (coalesce(p_request#>>'{filters,group}','')='' or decision_group=p_request#>>'{filters,group}')
      and (coalesce(p_request#>>'{filters,confidence}','')='' or confidence=p_request#>>'{filters,confidence}')
      and (coalesce(p_request#>>'{filters,capability}','')='' or capability=p_request#>>'{filters,capability}')
      and (coalesce(p_request#>>'{filters,query}','')='' or strpos(lower(concat_ws(' ',id,retailer,product_title,variant_title,offer_id,
        current_product_id,current_variant_id,operation_type,reason_codes,source_evidence::text)),lower(p_request#>>'{filters,query}'))>0)
  ), revision as (
    select md5(coalesce(string_agg(concat_ws(':',id,updated_at,execution_request->>'id',execution_status,lifecycle,capability,work_bucket),',' order by id),'')) value from model
  ), totals as (
    select count(*) total,greatest(1,ceil(count(*)::numeric/v_size)::integer) total_pages from filtered
  ), page_rows as (
    select f.* from filtered f order by updated_at desc nulls last,id desc
      limit v_size offset ((select least(v_page,total_pages) from totals)-1)*v_size
  ), current_summary as (
    select * from model where superseded_by_review_id is null and current_rank=1 and capability<>'AUTONOMOUS'
  ), retailer_summary as (
    select retailer_id,retailer,count(*) filter(where work_bucket='DECIDE') decide,count(*) filter(where work_bucket='EXECUTE') execute,
      count(*) filter(where work_bucket='PROCESSING') processing,count(*) filter(where work_bucket='TECHNICAL') technical,
      count(*) filter(where work_bucket='COMPLETED') completed,count(*) total,
      count(*) filter(where lifecycle='PENDING') pending,
      count(*) filter(where lifecycle='PENDING' and review_kind='SOURCE_FAILURE') source_unavailable,
      count(*) filter(where lifecycle='FAILED') blocked
      from current_summary group by retailer_id,retailer
  )
  select jsonb_build_object('schema_version',1,'as_of',now(),'revision',revision.value,
    'revision_changed',coalesce(nullif(p_request->>'revision','')<>revision.value,false),
    'page',least(v_page,totals.total_pages),'page_size',v_size,'total',totals.total,'total_pages',totals.total_pages,
    'rows',coalesce((select jsonb_agg(to_jsonb(p)-'current_rank'-'normalized_operation' order by updated_at desc nulls last,id desc) from page_rows p),'[]'::jsonb),
    'retailers',coalesce((select jsonb_agg(retailer order by retailer) from (select distinct retailer from queue) names),'[]'::jsonb),
    'summary',(select jsonb_build_object('decide',count(*) filter(where work_bucket='DECIDE'),'execute',count(*) filter(where work_bucket='EXECUTE'),
      'processing',count(*) filter(where work_bucket='PROCESSING'),'technical',count(*) filter(where work_bucket='TECHNICAL'),
      'completed',count(*) filter(where work_bucket='COMPLETED'),'total',count(*),
      'ownerRemaining',count(*) filter(where work_bucket in ('DECIDE','EXECUTE')),
      'completedToday',count(*) filter(where lifecycle in ('EXECUTED','REJECTED','IGNORED') and (updated_at at time zone 'Europe/London')::date=(now() at time zone 'Europe/London')::date),
      'submittedToday',count(*) filter(where (execution_requested_at at time zone 'Europe/London')::date=(now() at time zone 'Europe/London')::date),
      'retailers',coalesce((select jsonb_agg(to_jsonb(r) order by decide+execute desc,retailer) from retailer_summary r),'[]'::jsonb)) from current_summary))
    into v_result from totals cross join revision;
  if (v_result->>'revision_changed')::boolean then v_result=jsonb_set(v_result,'{rows}','[]'); end if;
  return v_result;
end $$;
COMMIT;
