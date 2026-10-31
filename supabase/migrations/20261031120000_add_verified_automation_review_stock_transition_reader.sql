begin;

set local lock_timeout='5s';
set local statement_timeout='120s';

do $preflight$
begin
  if current_user <> 'postgres' then
    raise exception 'VERIFIED_AUTOMATION_REVIEW_READER_POSTGRES_REQUIRED';
  end if;
  if to_regclass('public.retailers') is null
     or to_regclass('public.product_match_review_queue') is null
     or to_regclass('public.automation_review_execution_requests') is null then
    raise exception 'VERIFIED_AUTOMATION_REVIEW_READER_PREREQUISITE_MISSING';
  end if;
  if not exists (
    select 1 from pg_roles
     where rolname='retailer_catalogue_production_validator'
       and rolcanlogin=false
       and rolsuper=false
       and rolcreaterole=false
       and rolcreatedb=false
       and rolreplication=false
       and rolbypassrls=false
  ) then
    raise exception 'VERIFIED_AUTOMATION_REVIEW_READER_VALIDATOR_ROLE_MISMATCH';
  end if;
  if to_regprocedure('public.read_verified_automation_review_stock_transitions_v1(bigint)') is not null then
    raise exception 'VERIFIED_AUTOMATION_REVIEW_READER_ALREADY_EXISTS';
  end if;
end
$preflight$;

create function public.read_verified_automation_review_stock_transitions_v1(
  p_retailer_id bigint
) returns table (
  review_id bigint,
  execution_request_id uuid,
  offer_id bigint,
  retailer_id bigint,
  review_operation_type text,
  review_status text,
  source_row_fingerprint text,
  review_plan_fingerprint text,
  before_in_stock boolean,
  proposed_in_stock boolean,
  execution_operation_type text,
  execution_status text,
  review_fingerprint text,
  execution_plan_fingerprint text,
  postflight_hash text,
  executed_offer_ids jsonb,
  failed_offer_ids jsonb,
  remaining_offer_ids jsonb,
  actual_deltas jsonb,
  database_writes integer,
  idempotency_result text,
  last_checkpoint text,
  completed_at timestamptz
)
language plpgsql
stable
security definer
set search_path=pg_catalog,public,pg_temp
as $reader$
begin
  if current_setting('role',true) is distinct from 'retailer_catalogue_production_validator' then
    raise exception 'VERIFIED_AUTOMATION_REVIEW_READER_VALIDATOR_REQUIRED';
  end if;
  if p_retailer_id is null or p_retailer_id <= 0 then
    raise exception 'VERIFIED_AUTOMATION_REVIEW_READER_RETAILER_INVALID';
  end if;
  if not exists(select 1 from public.retailers where id=p_retailer_id) then
    raise exception 'VERIFIED_AUTOMATION_REVIEW_READER_RETAILER_NOT_FOUND';
  end if;

  return query
  select review.id,
         execution.id,
         review.offer_id,
         review.retailer_id,
         review.operation_type,
         review.review_status,
         review.source_row_fingerprint,
         review.plan_fingerprint,
         case when jsonb_typeof(review.before_state->'in_stock')='boolean'
              then (review.before_state->>'in_stock')::boolean end,
         case when jsonb_typeof(review.proposed_state->'in_stock')='boolean'
              then (review.proposed_state->>'in_stock')::boolean end,
         execution.operation_type,
         execution.status,
         execution.review_fingerprint,
         execution.plan_fingerprint,
         execution.postflight_hash,
         execution.executed_offer_ids,
         execution.failed_offer_ids,
         execution.remaining_offer_ids,
         execution.actual_deltas,
         execution.database_writes,
         execution.idempotency_result,
         execution.last_checkpoint,
         execution.completed_at
    from public.product_match_review_queue review
    join public.automation_review_execution_requests execution
      on execution.review_id=review.id
     and execution.retailer_id=p_retailer_id
   where review.retailer_id=p_retailer_id
     and review.review_status='EXECUTED'
     and execution.status='EXECUTED'
     and review.operation_type='UPDATE_STOCK'
     and execution.operation_type='UPDATE_STOCK'
   order by execution.completed_at,execution.id;
end
$reader$;

alter function public.read_verified_automation_review_stock_transitions_v1(bigint)
  owner to postgres;

revoke all on function public.read_verified_automation_review_stock_transitions_v1(bigint)
  from public,anon,authenticated,service_role,
       retailer_catalogue_production_validator,
       retailer_catalogue_production_approver,
       retailer_catalogue_production_executor;
grant execute on function public.read_verified_automation_review_stock_transitions_v1(bigint)
  to retailer_catalogue_production_validator;

revoke all on table public.product_match_review_queue
  from retailer_catalogue_production_validator;
revoke all on table public.automation_review_execution_requests
  from retailer_catalogue_production_validator;

comment on function public.read_verified_automation_review_stock_transitions_v1(bigint) is
  'Retailer-scoped SELECT-only evidence projection for protected validation. Existing JavaScript remains responsible for durable stock-transition verification.';

do $postflight$
declare
  v_function_oid oid := 'public.read_verified_automation_review_stock_transitions_v1(bigint)'::regprocedure::oid;
begin
  if not exists (
    select 1
      from pg_proc function
      join pg_roles owner on owner.oid=function.proowner
     where function.oid=v_function_oid
       and function.prosecdef
       and function.provolatile='s'
       and function.proowner='postgres'::regrole
       and function.proconfig @> array['search_path=pg_catalog, public, pg_temp']::text[]
  ) then
    raise exception 'VERIFIED_AUTOMATION_REVIEW_READER_FUNCTION_MISMATCH';
  end if;
  if not has_function_privilege(
       'retailer_catalogue_production_validator',
       'public.read_verified_automation_review_stock_transitions_v1(bigint)',
       'EXECUTE')
     or has_function_privilege('public','public.read_verified_automation_review_stock_transitions_v1(bigint)','EXECUTE')
     or has_function_privilege('anon','public.read_verified_automation_review_stock_transitions_v1(bigint)','EXECUTE')
     or has_function_privilege('authenticated','public.read_verified_automation_review_stock_transitions_v1(bigint)','EXECUTE')
     or has_function_privilege('service_role','public.read_verified_automation_review_stock_transitions_v1(bigint)','EXECUTE') then
    raise exception 'VERIFIED_AUTOMATION_REVIEW_READER_ACL_MISMATCH';
  end if;
  if has_table_privilege('retailer_catalogue_production_validator','public.product_match_review_queue','SELECT')
     or has_table_privilege('retailer_catalogue_production_validator','public.automation_review_execution_requests','SELECT') then
    raise exception 'VERIFIED_AUTOMATION_REVIEW_READER_RAW_TABLE_ACCESS_PRESENT';
  end if;
end
$postflight$;

commit;
