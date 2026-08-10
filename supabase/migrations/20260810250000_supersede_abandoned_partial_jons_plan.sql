begin;

set local lock_timeout='5s';
set local statement_timeout='60s';

do $apply$
declare
  v_target jsonb:=public.retailer_catalogue_actual_database_target();
  v_parent constant uuid:='a36a61b0-97c0-495a-9662-f1e9928629b6';
  v_parent_fingerprint constant text:='4ad2f26291c87bec38a6520d7b33b73a3d71f593be78e77c4ffa2453116699ef';
  v_rows integer;
  v_products bigint;
  v_variants bigint;
  v_mappings bigint;
  v_offers bigint;
  v_history bigint;
begin
  if current_user<>'postgres' or v_target->>'target_environment'<>'PRODUCTION'
     or v_target->>'project_ref'<>'aftboxmrdgyhizicfsfu'
     or v_target->>'database_identity'<>'supplementscout-production:aftboxmrdgyhizicfsfu' then
    raise exception 'abandoned Jon''s control-plan cleanup target mismatch';
  end if;
  select count(*) into v_products from public.products;
  select count(*) into v_variants from public.product_variants;
  select count(*) into v_mappings from public.retailer_products;
  select count(*) into v_offers from public.offers;
  select count(*) into v_history from public.price_history;
  if (v_products,v_variants,v_mappings,v_offers,v_history)<>(1112,2641,2522,2522,2653) then
    raise exception 'abandoned Jon''s cleanup catalogue count precondition mismatch';
  end if;
  perform 1 from public.retailer_catalogue_parent_plans p where p.id=v_parent
    and p.parent_plan_fingerprint=v_parent_fingerprint and p.retailer_id=10
    and p.target_environment='PRODUCTION' and p.status='PARTIALLY_APPLIED'
    and p.code_commit='688a29504b461f20007e898d0c281eff4b8ce10a'
    and p.source_snapshot_fingerprint='cf2b4bf75deecedaae626a323895a3012c99140d2d939b8823915b62af9a1aa3'
    and p.source_captured_at='2026-08-10T16:48:00.792Z'::timestamptz
    and p.approval_expires_at<'2026-08-10T17:03:00Z'::timestamptz
    and p.approval_consumed_at is not null for update;
  if not found then raise exception 'abandoned Jon''s parent plan precondition mismatch'; end if;
  if (select count(*) from public.retailer_catalogue_child_plans where parent_plan_id=v_parent)<>11
     or (select count(*) from public.retailer_catalogue_child_plans where parent_plan_id=v_parent and status='APPLIED')<>1
     or (select count(*) from public.retailer_catalogue_child_plans where parent_plan_id=v_parent and status='APPROVED')<>1
     or (select count(*) from public.retailer_catalogue_child_plans where parent_plan_id=v_parent and status='PLANNED')<>9
     or not exists(select 1 from public.retailer_catalogue_child_plans c
       join public.retailer_catalogue_apply_runs r on r.child_plan_id=c.id
       where c.parent_plan_id=v_parent and c.id='1758c3b0-c438-4629-8935-711927d0c927'
         and c.batch_index=0 and c.status='APPLIED'
         and jsonb_array_length(c.record_ids)=46 and r.status='SUCCEEDED'
         and r.id='8c8ef7c4-04bf-4e60-b42d-640b876f64d7'
         and (r.expected_deltas#>>'{row_count_deltas,price_history}')::integer=2
         and exists(select 1 from public.retailer_offer_sync_batch_approvals a
           where a.child_plan_id=c.id and a.consumed_at is not null
             and (a.result->>'business_writes')::integer=46
             and (a.result->>'price_history_delta')::integer=2))
     or (select count(*) from public.retailer_catalogue_apply_runs r
       join public.retailer_catalogue_child_plans c on c.id=r.child_plan_id
       where c.parent_plan_id=v_parent)<>1
     or exists(select 1 from public.retailer_catalogue_apply_runs r
       join public.retailer_catalogue_child_plans c on c.id=r.child_plan_id
       where c.parent_plan_id=v_parent and r.status='STARTED')
     or exists(select 1 from public.retailer_offer_sync_batch_approvals a
       join public.retailer_catalogue_child_plans c on c.id=a.child_plan_id
       where c.parent_plan_id=v_parent and a.consumed_at is null and a.expires_at>clock_timestamp()) then
    raise exception 'abandoned Jon''s child/run/approval precondition mismatch';
  end if;
  update public.retailer_catalogue_child_plans
  set status='SUPERSEDED',updated_at=now(),audit_log=audit_log||jsonb_build_array(jsonb_build_object(
    'event','ABANDONED_PARTIAL_PLAN_SUPERSEDED','at',now(),'authority','owner-approved-chat-2026-08-10-resume-jons-after-guard-fix'))
  where parent_plan_id=v_parent and status in ('PLANNED','APPROVED');
  get diagnostics v_rows=row_count;
  if v_rows<>10 then raise exception 'abandoned Jon''s child cleanup affected % rows',v_rows; end if;
  update public.retailer_catalogue_parent_plans
  set status='SUPERSEDED',updated_at=now(),audit_log=audit_log||jsonb_build_array(jsonb_build_object(
    'event','ABANDONED_PARTIAL_PLAN_SUPERSEDED','at',now(),'authority','owner-approved-chat-2026-08-10-resume-jons-after-guard-fix',
    'preserved_applied_child','1758c3b0-c438-4629-8935-711927d0c927','preserved_business_writes',46))
  where id=v_parent and status='PARTIALLY_APPLIED';
  get diagnostics v_rows=row_count;
  if v_rows<>1 then raise exception 'abandoned Jon''s parent cleanup affected % rows',v_rows; end if;
  if exists(select 1 from public.retailer_catalogue_child_plans where parent_plan_id=v_parent and status not in ('APPLIED','SUPERSEDED'))
     or (select count(*) from public.retailer_catalogue_child_plans where parent_plan_id=v_parent and status='APPLIED')<>1
     or (select count(*) from public.retailer_catalogue_child_plans where parent_plan_id=v_parent and status='SUPERSEDED')<>10
     or (select status from public.retailer_catalogue_parent_plans where id=v_parent)<>'SUPERSEDED'
     or (select count(*) from public.products)<>v_products
     or (select count(*) from public.product_variants)<>v_variants
     or (select count(*) from public.retailer_products)<>v_mappings
     or (select count(*) from public.offers)<>v_offers
     or (select count(*) from public.price_history)<>v_history then
    raise exception 'abandoned Jon''s cleanup postcondition mismatch';
  end if;
end
$apply$;

commit;
