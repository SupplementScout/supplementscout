begin;

set local lock_timeout='5s';
set local statement_timeout='60s';

do $cleanup$
declare
  v_target jsonb:=public.retailer_catalogue_actual_database_target();
  v_discount_parent constant uuid:='a072732f-df0e-4ed8-b3e7-1bb60f62fe51';
  v_discount_fingerprint constant text:='444c1eb4b5127a9edc8ae00527f8ded6bbc082b6f9e6a4b642fccf8857f6ac01';
  v_discount_approval constant uuid:='8afb103b-661b-4b30-a32a-301dd0a83ce4';
  v_jons_parent constant uuid:='2335b43b-0bfd-4fc1-8e62-65bfb7e430b3';
  v_jons_fingerprint constant text:='ec18d2639dc6adaef669f18f81d366136b24d183a0837d96a86cfe7af52b8282';
  v_jons_approval constant uuid:='52be46a4-43fd-4db6-803a-d62930f585dd';
  v_now timestamptz:=clock_timestamp();
  v_rows integer;
  v_before jsonb;
  v_after jsonb;
begin
  if current_user<>'postgres' or v_target->>'target_environment'<>'PRODUCTION'
     or v_target->>'project_ref'<>'aftboxmrdgyhizicfsfu'
     or v_target->>'database_identity'<>'supplementscout-production:aftboxmrdgyhizicfsfu' then
    raise exception 'expired Discount/Jon''s refresh cleanup target mismatch';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('PRODUCTION:4',0));
  perform pg_advisory_xact_lock(hashtextextended('PRODUCTION:10',0));
  v_before:=public.retailer_catalogue_business_counts();
  if v_before<>jsonb_build_object('products',1337,'product_variants',3632,'retailer_products',3758,'offers',3758,'price_history',4053) then
    raise exception 'expired Discount/Jon''s refresh cleanup catalogue count precondition mismatch';
  end if;

  perform 1 from public.retailer_catalogue_parent_plans p where p.id=v_discount_parent
    and p.parent_plan_fingerprint=v_discount_fingerprint and p.retailer_id=4
    and p.target_environment='PRODUCTION' and p.status='APPROVED'
    and p.code_commit='d4d336907519f89b90d04b64dda6feac3148a203'
    and p.source_snapshot_fingerprint='f885ada8f3e6e4a19de4d9794c853f46778b2a0d4ac0d74cdea2412bce106215'
    and p.source_captured_at='2026-09-06T11:21:41.448Z'::timestamptz
    and p.approval_expires_at='2026-09-06T11:35:50.450Z'::timestamptz
    and p.approval_expires_at<clock_timestamp() and p.approval_consumed_at is null for update;
  if not found then raise exception 'expired Discount parent precondition mismatch'; end if;

  perform 1 from public.retailer_catalogue_parent_plans p where p.id=v_jons_parent
    and p.parent_plan_fingerprint=v_jons_fingerprint and p.retailer_id=10
    and p.target_environment='PRODUCTION' and p.status='APPROVED'
    and p.code_commit='66f191e809192c9781369a229208461f031c463d'
    and p.source_snapshot_fingerprint='81711cbc6a2911bd81c62f6942d366ea8955e982114342a61921d3b56887119d'
    and p.source_captured_at='2026-09-05T08:39:07.201Z'::timestamptz
    and p.approval_expires_at='2026-09-05T08:53:41.819Z'::timestamptz
    and p.approval_expires_at<clock_timestamp() and p.approval_consumed_at is null for update;
  if not found then raise exception 'expired Jon''s parent precondition mismatch'; end if;

  if (select count(*) from public.retailer_catalogue_child_plans where parent_plan_id=v_discount_parent)<>3
     or (select count(*) from public.retailer_catalogue_child_plans where parent_plan_id=v_discount_parent and status='APPROVED')<>1
     or (select count(*) from public.retailer_catalogue_child_plans where parent_plan_id=v_discount_parent and status='PLANNED')<>2
     or exists(select 1 from public.retailer_catalogue_apply_runs r join public.retailer_catalogue_child_plans c on c.id=r.child_plan_id where c.parent_plan_id=v_discount_parent)
     or (select count(*) from public.retailer_offer_sync_batch_approvals a join public.retailer_catalogue_child_plans c on c.id=a.child_plan_id where c.parent_plan_id=v_discount_parent and a.id=v_discount_approval and a.consumed_at is null and a.closed_at is null and a.expires_at<clock_timestamp())<>1 then
    raise exception 'expired Discount child/run/approval precondition mismatch';
  end if;
  if (select count(*) from public.retailer_catalogue_child_plans where parent_plan_id=v_jons_parent)<>11
     or (select count(*) from public.retailer_catalogue_child_plans where parent_plan_id=v_jons_parent and status='APPROVED')<>1
     or (select count(*) from public.retailer_catalogue_child_plans where parent_plan_id=v_jons_parent and status='PLANNED')<>10
     or exists(select 1 from public.retailer_catalogue_apply_runs r join public.retailer_catalogue_child_plans c on c.id=r.child_plan_id where c.parent_plan_id=v_jons_parent)
     or (select count(*) from public.retailer_offer_sync_batch_approvals a join public.retailer_catalogue_child_plans c on c.id=a.child_plan_id where c.parent_plan_id=v_jons_parent and a.id=v_jons_approval and a.consumed_at is null and a.closed_at is null and a.expires_at<clock_timestamp())<>1 then
    raise exception 'expired Jon''s child/run/approval precondition mismatch';
  end if;

  update public.retailer_offer_sync_batch_approvals a
  set closed_at=v_now,closed_by='supplementscout-owner-approved-six-retailer-recovery',
      close_reason='Expired unexecuted refresh plan superseded',
      close_request_fingerprint=encode(extensions.digest(convert_to(a.id::text||':2026-09-08-six-retailer-recovery','UTF8'),'sha256'),'hex'),
      close_result=jsonb_build_object('status','SUPERSEDED','approval_id',a.id,'closed_at',v_now,'business_writes',0,'price_history_writes',0)
  from public.retailer_catalogue_child_plans c
  where a.child_plan_id=c.id and c.parent_plan_id in (v_discount_parent,v_jons_parent)
    and a.id in (v_discount_approval,v_jons_approval)
    and a.consumed_at is null and a.closed_at is null and a.expires_at<clock_timestamp();
  get diagnostics v_rows=row_count;
  if v_rows<>2 then raise exception 'expired Discount/Jon''s approval cleanup affected % rows',v_rows; end if;

  update public.retailer_catalogue_child_plans
  set status='SUPERSEDED',updated_at=v_now,audit_log=audit_log||jsonb_build_array(jsonb_build_object(
    'event','EXPIRED_REFRESH_SUPERSEDED','at',v_now,'authority','owner-approved-chat-2026-09-08-six-retailer-recovery'))
  where parent_plan_id in (v_discount_parent,v_jons_parent) and status in ('PLANNED','APPROVED');
  get diagnostics v_rows=row_count;
  if v_rows<>14 then raise exception 'expired Discount/Jon''s child cleanup affected % rows',v_rows; end if;

  update public.retailer_catalogue_parent_plans
  set status='SUPERSEDED',updated_at=v_now,audit_log=audit_log||jsonb_build_array(jsonb_build_object(
    'event','EXPIRED_REFRESH_SUPERSEDED','at',v_now,'authority','owner-approved-chat-2026-09-08-six-retailer-recovery',
    'preserved_applied_children',0,'preserved_refreshed_offers',0))
  where id in (v_discount_parent,v_jons_parent) and status='APPROVED';
  get diagnostics v_rows=row_count;
  if v_rows<>2 then raise exception 'expired Discount/Jon''s parent cleanup affected % rows',v_rows; end if;

  v_after:=public.retailer_catalogue_business_counts();
  if v_after is distinct from v_before
     or exists(select 1 from public.retailer_catalogue_child_plans where parent_plan_id in (v_discount_parent,v_jons_parent) and status<>'SUPERSEDED')
     or (select count(*) from public.retailer_catalogue_child_plans where parent_plan_id in (v_discount_parent,v_jons_parent) and status='SUPERSEDED')<>14
     or (select count(*) from public.retailer_catalogue_parent_plans where id in (v_discount_parent,v_jons_parent) and status='SUPERSEDED')<>2 then
    raise exception 'expired Discount/Jon''s refresh cleanup postcondition mismatch';
  end if;
end
$cleanup$;

commit;
