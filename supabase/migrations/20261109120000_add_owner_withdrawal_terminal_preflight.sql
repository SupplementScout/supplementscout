begin;
-- Supersedes the never-applied 20261109100000 package; original bytes remain excluded.
-- No request status/history repair. Same bounded withdrawal data and SQL bindings.
set local lock_timeout = '5s';
set local statement_timeout = '120s';

-- Same write boundary as every approved import/mixed batch. No second executor.
select pg_advisory_xact_lock(hashtextextended('retailer-offer-sync:global-execution',0));

alter table public.products
  add column owner_withdrawal_state text,
  add column owner_withdrawal_reason text,
  add column owner_withdrawn_at timestamptz;

alter table public.products drop constraint products_merge_state_consistent;
alter table public.products add constraint products_merge_state_consistent check (
  (owner_withdrawal_state is null and owner_withdrawal_reason is null and owner_withdrawn_at is null
    and ((is_active = true and merged_into_product_id is null and merged_at is null)
      or (is_active = false and merged_into_product_id is not null and merged_at is not null)))
  or
  (owner_withdrawal_state is not null
    and owner_withdrawal_state in ('OWNER_EXCLUDED','OWNER_DEFERRED')
    and owner_withdrawal_reason is not null and length(btrim(owner_withdrawal_reason)) between 1 and 1000
    and owner_withdrawn_at is not null and is_active = false
    and merged_into_product_id is null and merged_at is null)
);

comment on column public.products.owner_withdrawal_state is
  'Owner-only withdrawal; ACTIVE/MERGED continue using is_active and merge fields. Not an offer action.';

create function public.guard_owner_product_lifecycle() returns trigger
language plpgsql set search_path=pg_catalog,public,pg_temp as $guard$
declare v_owner name;
begin
  select pg_get_userbyid(relowner) into strict v_owner from pg_class where oid=TG_RELID;
  if TG_OP='DELETE' then
    if OLD.owner_withdrawal_state is not null then
      raise exception 'OWNER_WITHDRAWAL_HISTORY_IMMUTABLE';
    end if;
    return OLD;
  end if;
  if (TG_OP='INSERT' and NEW.owner_withdrawal_state is not null)
    or (TG_OP='UPDATE' and
      (row(NEW.owner_withdrawal_state,NEW.owner_withdrawal_reason,NEW.owner_withdrawn_at)
         is distinct from row(OLD.owner_withdrawal_state,OLD.owner_withdrawal_reason,OLD.owner_withdrawn_at)
       or (OLD.owner_withdrawal_state is not null and row(NEW.is_active,NEW.merged_into_product_id,NEW.merged_at)
         is distinct from row(OLD.is_active,OLD.merged_into_product_id,OLD.merged_at)))) then
    -- session_user survives SECURITY DEFINER: an ordinary approved offer writer
    -- cannot clear withdrawal metadata by executing an owner-owned function.
    if session_user <> v_owner then raise exception 'OWNER_LIFECYCLE_REQUIRES_DATABASE_OWNER'; end if;
  end if;
  return NEW;
end
$guard$;
revoke all on function public.guard_owner_product_lifecycle() from public;
create trigger owner_product_lifecycle_guard before insert or update or delete on public.products
for each row execute function public.guard_owner_product_lifecycle();

create function public.guard_withdrawn_catalogue_write() returns trigger
language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $guard$
declare v_product_id bigint; v_state text; v_owner name; v_ids bigint[];
begin
  if TG_TABLE_NAME='price_history' then
    if TG_OP='INSERT' then select array[product_id] into v_ids from public.offers where id=NEW.offer_id;
    elsif TG_OP='DELETE' then select array[product_id] into v_ids from public.offers where id=OLD.offer_id;
    else select array_agg(distinct product_id) into v_ids from public.offers where id in (OLD.offer_id,NEW.offer_id); end if;
  else
    v_ids:=case when TG_OP='INSERT' then array[NEW.product_id]
      when TG_OP='DELETE' then array[OLD.product_id] else array[OLD.product_id,NEW.product_id] end;
  end if;
  for v_product_id in select distinct id from unnest(v_ids) t(id) loop
    select owner_withdrawal_state into v_state from public.products where id=v_product_id for share;
    if v_state is not null then
      select pg_get_userbyid(relowner) into strict v_owner from pg_class where oid=TG_RELID;
      if TG_TABLE_NAME='product_variants' and TG_OP='UPDATE' and session_user=v_owner then
        if not NEW.is_active and NEW.product_id=OLD.product_id
          and (to_jsonb(NEW)-'is_active'-'updated_at')=(to_jsonb(OLD)-'is_active'-'updated_at') then
          return NEW;
        end if;
      end if;
      raise exception 'OWNER_WITHDRAWN_PRODUCT_WRITE_BLOCKED: %',v_product_id;
    end if;
  end loop;
  if TG_OP='DELETE' then return OLD; end if;
  return NEW;
end
$guard$;
revoke all on function public.guard_withdrawn_catalogue_write() from public;
create trigger owner_withdrawn_offer_guard before insert or update or delete on public.offers
for each row execute function public.guard_withdrawn_catalogue_write();
create trigger owner_withdrawn_mapping_guard before insert or update or delete on public.retailer_products
for each row execute function public.guard_withdrawn_catalogue_write();
create trigger owner_withdrawn_variant_guard before insert or update or delete on public.product_variants
for each row execute function public.guard_withdrawn_catalogue_write();
create trigger owner_withdrawn_price_history_guard before insert or update or delete on public.price_history
for each row execute function public.guard_withdrawn_catalogue_write();

create function public.check_withdrawn_product_variants() returns trigger
language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $check$
declare v_id bigint;
begin
  if TG_TABLE_NAME='products' then v_id:=NEW.id; else v_id:=NEW.product_id; end if;
  if exists(select 1 from public.products p join public.product_variants v on v.product_id=p.id
    where p.id=v_id and p.owner_withdrawal_state is not null and v.is_active) then
    raise exception 'OWNER_WITHDRAWAL_ACTIVE_VARIANT';
  end if;
  return null;
end
$check$;
revoke all on function public.check_withdrawn_product_variants() from public;
create constraint trigger owner_withdrawal_variants_consistent after insert or update on public.products
deferrable initially deferred for each row execute function public.check_withdrawn_product_variants();
create constraint trigger owner_withdrawal_parent_consistent after insert or update on public.product_variants
deferrable initially deferred for each row execute function public.check_withdrawn_product_variants();


-- OWNER_ACTIVATION_BEGIN: bounded catalogue data, never an offer refresh.
do $owner_activation$
declare
  v_target jsonb:=public.retailer_catalogue_actual_database_target();
  v_expected constant jsonb:='{"products":[{"id":"1114","hash":"fa5e1540e5bbf4b0392f721505c7f1047830a046a143ac121b8183b63f498b55"},{"id":"951","hash":"e32c699bf874145ba37ffc18cd6a1b3726eb66fcc88ea2771d084a5801e66253"},{"id":"999","hash":"dc4fdf7172000312240575d5999d717b785540d742b97057e88a52f565f5ba89"}],"product_variants":[{"id":"1853","hash":"8cb33463c409d07ad7a78c5ffbe86fd8b729a46701666ac6685de0e89c170c42"},{"id":"1960","hash":"3d18bcff205448f5755352597cf2c62133485a3f604c8ee1d161755cba3f5e44"},{"id":"2414","hash":"9bad48565303ac281f7a0b165985526d7c2f82b80a0143ff5410edc7fbf4acb9"},{"id":"2415","hash":"0dfa1abd59613af9bb492e1f73f920ac67af4d052ce2002317b62ec3796ec834"}],"retailer_products":[{"id":"2082","hash":"5b45f5f917b4c65d9554449987d6d4fcbd48d4b520fcfb927b432f86f9433f3f"},{"id":"2151","hash":"e65ea60bb1a538d431e3e3cd8ce2f02b5c5bc9955d2e49fe0b41bdd687180119"},{"id":"2170","hash":"a6045b548ffd0a9c0990fb2c0740b2df7c9f791775d0e9eb265cdc176670af04"},{"id":"2582","hash":"bd734fdd2b90858afe0762ee7d10bd8509d7da60c53882dfa570714150ec2e53"}],"offers":[{"id":"1896","hash":"d81f928b7c45be902acdeb9dcbdec969a53bbdbe5581ef03e7b26eb3ea5a81dd"},{"id":"1965","hash":"3003518637a33a3f3da7b6395b9e12450c335a9f9a47e467cb18763ffdb6fea6"},{"id":"1984","hash":"9867e2930cb72a733116a4464f80a2baca0084cc8ca680b56036faae58dfffab"},{"id":"2396","hash":"e2fb94105542843e8720c0df8eabd92fb16b992075cfd2d50ebc1e41efa4e5c6"}],"price_history":[{"id":"1900","hash":"4ce44c7364c0a828741d6ce5de9271ee226f21d4720886551655a79d67f14f20"},{"id":"1969","hash":"ec6a398f77528236b8aa1c34bf7784078c4ccd3caefac8d32b5cabf5676a1c80"},{"id":"1988","hash":"5730464ac37d8570a363619a02ba3fa6100ee4a4591bb315487b3a1ddd67c14f"},{"id":"2003","hash":"ba980e3adec01b337e2a93e38a8ee301eedde465acb31fe65651a195cd699c2c"},{"id":"2415","hash":"dc8e95183e495e2f65af1f328e560bf3e86ec4f992c572fd8bbb964b09bd41bf"}]}'::jsonb;
  v_patches constant jsonb:='[{"name":"validate_fit_house_stable_oos_read_only","signature":"public.validate_fit_house_stable_oos_read_only(jsonb)","old_md5":"2ceb7dc5bf04ca04db3f6cc6380999f1","new_md5":"1b37576eb8230618412d185130144cb4","steps":[{"old":"dd2f583394ffa3787b595d7009731dff5bb8e485b9114d3778084a71c120dfc1","new":"bd01649903badb820d3595ea5c9776311370c2c97341783078e39d64e867c5da","count":2}]},{"name":"validate_fit_house_confirmed_price_read_only","signature":"public.validate_fit_house_confirmed_price_read_only(jsonb)","old_md5":"b6f0195b7f431a2a9ec25312088ee9aa","new_md5":"3116404ce957bebdbab42f556e3db11d","steps":[{"old":"dd2f583394ffa3787b595d7009731dff5bb8e485b9114d3778084a71c120dfc1","new":"bd01649903badb820d3595ea5c9776311370c2c97341783078e39d64e867c5da","count":2}]},{"name":"fit_house_six_oos_owner_exception","signature":"public.fit_house_six_oos_owner_exception(jsonb)","old_md5":"d7fc5bacbac87fd38e7f58314cb1b0e2","new_md5":"121d1d60efb9320011aaef6b1ed19be1","steps":[{"old":"dd2f583394ffa3787b595d7009731dff5bb8e485b9114d3778084a71c120dfc1","new":"bd01649903badb820d3595ea5c9776311370c2c97341783078e39d64e867c5da","count":1}]},{"name":"register_fit_house_offer_sync_control_plan","signature":"public.register_fit_house_offer_sync_control_plan(jsonb)","old_md5":"9c92303c81971ae8f648fb889383362b","new_md5":"e29277687d21e1d38a89295169b5993d","steps":[{"old":"a1e596f7707c851534e04e30d13f4289439449556787c572736e77b279c75292","new":"b25aaafadecb848e08507ba488f34a4b4a84871f67d993d93538eff50600e3b5","count":1},{"old":"jsonb_array_length(v_manifest) <> 286","new":"jsonb_array_length(v_manifest) <> 284","count":1},{"old":"exactly 286 approved","new":"exactly 284 approved","count":1},{"old":"where rp.retailer_id=9","new":"where rp.retailer_id=9 and exists(select 1 from public.products p where p.id=rp.product_id and p.is_active and p.owner_withdrawal_state is null)","count":1},{"old":"where o.retailer_id=9","new":"where o.retailer_id=9 and exists(select 1 from public.products p where p.id=o.product_id and p.is_active and p.owner_withdrawal_state is null)","count":1},{"old":"  v_manifest := p_request->''manifest'';","new":"  if (select public.retailer_catalogue_sha256_json(coalesce(jsonb_agg(jsonb_build_object(\n  ''mapping_id'',rp.id::text,''offer_id'',o.id::text,''external_product_id'',rp.external_product_id,\n  ''external_variant_id'',rp.external_variant_id,''canonical_product_id'',rp.product_id::text,\n  ''canonical_variant_id'',rp.product_variant_id::text) order by rp.id),''[]''::jsonb))\n  from public.retailer_products rp join public.offers o on o.retailer_product_id=rp.id and o.retailer_id=rp.retailer_id where rp.retailer_id=9) is distinct from ''680ed543fd70f6defd8ec6971f4e0e30326ef26d72688045e919cedad7040041'' then\n    raise exception ''OWNER_PHYSICAL_SCOPE_DRIFT''; end if;\n  v_manifest := p_request->''manifest'';","count":1}]},{"name":"fit_house_six_oos_baseline_exact","signature":"public.fit_house_six_oos_baseline_exact()","old_md5":"9dbc2ae0cb6b979fd7781dd0fbbb4a51","new_md5":"600ac86939c54b98ab9cf81881b683a8","steps":[{"count":1,"old":"return (select count(*) from public.offers where retailer_id=9 and not in_stock)=104+v_applied;","new":"return (select count(*) from public.offers where retailer_id=9 and not in_stock)=104+v_applied+\n    coalesce((select sum(proof.delta) from (\n      select distinct on (o.id) o.id,case when r.before_state->''in_stock''=''true''::jsonb then 1 else -1 end delta\n      from public.product_match_review_queue r join public.automation_review_execution_requests e\n        on e.review_id=r.id and e.retailer_id=r.retailer_id\n      join public.offers o on o.id=r.offer_id and o.retailer_id=r.retailer_id\n      where r.retailer_id=9 and r.review_status=''EXECUTED'' and r.operation_type=''UPDATE_STOCK''\n        and e.status=''EXECUTED'' and e.operation_type=''UPDATE_STOCK''\n        and r.source_row_fingerprint=e.review_fingerprint and r.plan_fingerprint=e.plan_fingerprint\n        and jsonb_typeof(r.before_state->''in_stock'')=''boolean'' and jsonb_typeof(r.proposed_state->''in_stock'')=''boolean''\n        and r.before_state->''in_stock''<>r.proposed_state->''in_stock''\n        and to_jsonb(o.in_stock)=r.proposed_state->''in_stock''\n        and e.postflight_hash ~ ''^[0-9a-f]{64}$'' and e.idempotency_result=''PASS''\n        and e.last_checkpoint in (''POSTFLIGHT_PASSED'',''IDEMPOTENCY_PASSED'',''VERIFIED_POSTFLIGHT_RECOVERY'')\n        and case when jsonb_typeof(e.executed_offer_ids)=''array'' then exists(select 1 from jsonb_array_elements_text(e.executed_offer_ids) x(id) where x.id=o.id::text) else false end\n        and case when jsonb_typeof(e.failed_offer_ids)=''array'' then jsonb_array_length(e.failed_offer_ids) else -1 end=0\n        and case when jsonb_typeof(e.remaining_offer_ids)=''array'' then jsonb_array_length(e.remaining_offer_ids) else -1 end=0\n        and (e.actual_deltas->>''stock'')::numeric=1 and e.database_writes>=1 and e.completed_at is not null\n        and not exists(select 1 from jsonb_array_elements(v_rows) legacy where legacy->>''offer_id''=o.id::text)\n      order by o.id,e.completed_at desc,e.id desc\n    ) proof),0);"}]}]'::jsonb;
  v_table text; v_entry jsonb; v_hash text; v_spec jsonb; v_step jsonb;
  v_function record; v_definition text; v_new text; v_already boolean;
  v_selected_preflight_blockers jsonb;
  v_products_before jsonb; v_variants_before jsonb; v_producer_before jsonb; v_changed integer;
begin
  if session_user<>'postgres' or current_user<>'postgres'
    or v_target->>'target_environment' is distinct from 'PRODUCTION'
    or v_target->>'project_ref' is distinct from 'aftboxmrdgyhizicfsfu'
    or v_target->>'database_identity' is distinct from 'supplementscout-production:aftboxmrdgyhizicfsfu' then
    raise exception 'OWNER_WITHDRAWAL_TARGET_REJECTED'; end if;
  -- SELECTED_MIGRATION_PREFLIGHT_BEGIN
  with terminal_before_write as (
    select r.id
    from public.automation_review_execution_requests r
    join public.product_match_review_queue q on q.id=r.review_id and q.retailer_id=r.retailer_id
    cross join lateral (
      select count(*) n,jsonb_agg(to_jsonb(e) order by e.created_at,e.id) chain
      from public.automation_review_execution_events e where e.execution_request_id=r.id
    ) events
    where r.operation_type=q.operation_type
      and r.status='FAILED' and r.last_checkpoint='EXECUTION_FAILED' and r.database_writes=0
      and r.workflow_name='automation-review-queue-worker.yml' and r.execution_mode='review-queue'
      and r.environment_name='production-readonly'
      and r.run_id ~ '^[1-9][0-9]*$' and r.commit_sha ~ '^[0-9a-f]{40}$'
      and r.run_url='https://github.com/SupplementScout/supplementscout/actions/runs/'||r.run_id
      and r.review_fingerprint=q.source_row_fingerprint and r.plan_fingerprint=q.plan_fingerprint
      and r.review_fingerprint ~ '^[0-9a-f]{64}$' and r.plan_fingerprint ~ '^[0-9a-f]{64}$'
      and r.idempotency_key ~ '^[0-9a-f]{64}$'
      and r.requested_at is not null and r.completed_at>=r.requested_at
      and r.before_state_hash is null and r.expected_deltas is null and r.actual_deltas is null
      and r.price_history_delta is null and r.postflight_hash is null and r.idempotency_result is null
      and (r.executed_offer_ids is null or r.executed_offer_ids='[]'::jsonb)
      and (r.failed_offer_ids is null or r.failed_offer_ids='[]'::jsonb)
      and (r.remaining_offer_ids is null or r.remaining_offer_ids='[]'::jsonb)
      -- A terminal request cannot be replayed by the QUEUED-only worker. Its
      -- approved review must also be closed, with matching immutable bindings.
      and ((q.review_status='EXPIRED' and q.expires_at<=statement_timestamp() and q.execution_id is null)
        or (q.review_status='EXECUTED' and exists (
          select 1 from public.automation_review_execution_requests successor
          where successor.id::text=q.execution_id::text and successor.review_id=q.id
            and successor.retailer_id=r.retailer_id and successor.status='EXECUTED'
            and successor.review_fingerprint=q.source_row_fingerprint and successor.plan_fingerprint=q.plan_fingerprint
            and successor.completed_at is not null and successor.postflight_hash ~ '^[0-9a-f]{64}$'
            and successor.idempotency_result='PASS' and successor.actual_deltas is not null
            and successor.last_checkpoint in ('IDEMPOTENCY_PASSED','VERIFIED_POSTFLIGHT_RECOVERY')
            and successor.failed_offer_ids='[]'::jsonb and successor.remaining_offer_ids='[]'::jsonb
            and case when jsonb_typeof(successor.executed_offer_ids)='array'
              then successor.executed_offer_ids ? q.offer_id::text else false end
        )))
      -- The audited worker awaits REVALIDATION_PASSED before registration or
      -- approvals and pessimistically marks the nonempty write scope first.
      -- Exactly this complete pre-write chain is evidence; zero alone is not.
      and events.n=3
      and events.chain->0->>'previous_status' is null
      and events.chain->0->>'new_status'='QUEUED' and events.chain->0->>'checkpoint'='REQUEST_CREATED'
      and events.chain->0#>>'{evidence,idempotency_key}'=r.idempotency_key
      and events.chain->1->>'previous_status'='QUEUED' and events.chain->1->>'new_status'='DISPATCHED'
      and events.chain->1->>'checkpoint'='WORKFLOW_DISPATCH_CLAIMED'
      and events.chain->1#>>'{evidence,run_id}'=r.run_id
      and events.chain->1#>>'{evidence,commit_sha}'=r.commit_sha
      and events.chain->1#>>'{evidence,run_url}'=r.run_url
      and events.chain->1#>'{evidence,database_writes}'='0'::jsonb
      and events.chain->2->>'previous_status'='DISPATCHED' and events.chain->2->>'new_status'='FAILED'
      and events.chain->2->>'checkpoint'='EXECUTION_FAILED'
      and events.chain->2#>>'{evidence,run_id}'=r.run_id
      and events.chain->2#>>'{evidence,commit_sha}'=r.commit_sha
      and events.chain->2#>'{evidence,database_writes}'='0'::jsonb
      and events.chain->2#>>'{evidence,error_code}'=r.error_code and length(r.error_code)>0
      and (events.chain->2->>'created_at')::timestamptz=r.completed_at
      and not exists (select 1 from jsonb_array_elements(events.chain) e
        where e->>'review_id' is distinct from r.review_id::text)
  ), blockers as (
    select 'parent_plan' kind,p.id::text id,p.retailer_id,p.status
    from public.retailer_catalogue_parent_plans p where p.retailer_id in (9,11)
      and coalesce(p.status,'') not in ('COMPLETED','EXPIRED','SUPERSEDED','CLOSED','CANCELLED')
    union all
    select 'approval',a.id::text,a.retailer_id,a.status
    from public.approved_import_plans a where a.status='approved' and a.consumed_at is null
      and a.expires_at>statement_timestamp() and a.plan_json#>>'{product,id}' in ('951','999','1114')
    union all
    select 'execution_request',r.id::text,r.retailer_id,r.status
    from public.automation_review_execution_requests r where r.retailer_id in (9,11)
      and coalesce(r.status,'') not in ('EXECUTED','EXPIRED','SUPERSEDED','CANCELLED')
      and not exists(select 1 from terminal_before_write terminal where terminal.id=r.id)
  )
  select coalesce(jsonb_agg(to_jsonb(blockers) order by kind,id),'[]'::jsonb) as blockers
    into v_selected_preflight_blockers
  from blockers;
  -- SELECTED_MIGRATION_PREFLIGHT_END
  if jsonb_array_length(v_selected_preflight_blockers)>0 then
    raise exception 'OWNER_WITHDRAWAL_PENDING_CONTROL' using detail=v_selected_preflight_blockers::text;
  end if;
  perform id from public.products where id in (951,999,1114) order by id for update;
  perform id from public.product_variants where id in (1853,1960,2414,2415) order by id for update;
  v_already:=(select count(*)=3 from public.products where id in (951,999,1114) and not is_active
    and owner_withdrawal_state=case when id=1114 then 'OWNER_DEFERRED' else 'OWNER_EXCLUDED' end
    and owner_withdrawal_reason='owner-catalogue-decision-2026-11-08' and owner_withdrawn_at is not null);
  if (select count(*) from public.product_variants where product_id in (951,999,1114))<>4
    or (select count(*) from public.retailer_products where product_id in (951,999,1114))<>4
    or (select count(*) from public.offers where product_id in (951,999,1114))<>4
    or exists(select 1 from public.products where merged_into_product_id in (951,999,1114)) then
    raise exception 'OWNER_WITHDRAWAL_DEPENDENCY_DRIFT'; end if;
  if not exists(select 1 from public.price_observation_producers where retailer_id=9 and retailer_slug='fit-house'
    and approved_scope=case when v_already then 'approved-284' else 'approved-286' end
    and enabled and technically_capable and source_importer='retailer_offer_mixed_batch'
    and public_use='eligible-after-separate-approval' and terms_mode='standard-single-purchase-only') then
    raise exception 'OWNER_PRODUCER_SCOPE_DRIFT'; end if;
  select to_jsonb(p)-'approved_scope'-'updated_at' into v_producer_before from public.price_observation_producers p where retailer_id=9;
  for v_table in select jsonb_object_keys(v_expected) loop
    if v_already and v_table in ('products','product_variants') then continue; end if;
    for v_entry in select value from jsonb_array_elements(v_expected->v_table) loop
      if v_table='products' then
        execute format('select encode(pg_catalog.sha256(convert_to((to_jsonb(t)-''owner_withdrawal_state''-''owner_withdrawal_reason''-''owner_withdrawn_at'')::text,''UTF8'')),''hex'') from public.%I t where id=$1',v_table) into v_hash using (v_entry->>'id')::bigint;
      else
        execute format('select encode(pg_catalog.sha256(convert_to(to_jsonb(t)::text,''UTF8'')),''hex'') from public.%I t where id=$1',v_table) into v_hash using (v_entry->>'id')::bigint;
      end if;
      if v_hash is distinct from v_entry->>'hash' then raise exception 'OWNER_EXPECTED_STATE_DRIFT: %/%',v_table,v_entry->>'id'; end if;
    end loop;
  end loop;
  if (select count(*) from public.price_history where offer_id in (1896,1965,1984,2396))<>5
    or (select count(*) from public.retailer_products where retailer_id=9)<>286
    or (select count(*) from public.offers where retailer_id=9)<>286
    or (select count(*) from public.retailer_products where retailer_id=11)<>506
    or (select count(*) from public.offers where retailer_id=11)<>506
    or (select public.retailer_catalogue_sha256_json(coalesce(jsonb_agg(jsonb_build_object(
  'mapping_id',rp.id::text,'offer_id',o.id::text,'external_product_id',rp.external_product_id,
  'external_variant_id',rp.external_variant_id,'canonical_product_id',rp.product_id::text,
  'canonical_variant_id',rp.product_variant_id::text) order by rp.id),'[]'::jsonb))
  from public.retailer_products rp join public.offers o on o.retailer_product_id=rp.id and o.retailer_id=rp.retailer_id where rp.retailer_id=9) is distinct from '680ed543fd70f6defd8ec6971f4e0e30326ef26d72688045e919cedad7040041'
    or (select public.retailer_catalogue_sha256_json(coalesce(jsonb_agg(jsonb_build_object(
  'mapping_id',rp.id::text,'offer_id',o.id::text,'external_product_id',rp.external_product_id,
  'external_variant_id',rp.external_variant_id,'canonical_product_id',rp.product_id::text,
  'canonical_variant_id',rp.product_variant_id::text) order by rp.id),'[]'::jsonb))
  from public.retailer_products rp join public.offers o on o.retailer_product_id=rp.id and o.retailer_id=rp.retailer_id where rp.retailer_id=11) is distinct from 'f5fa3477901de32f3255e64a16d773ca276c7d992f6ce0a6d98adaa219e72b5b' then
    raise exception 'OWNER_PHYSICAL_SCOPE_DRIFT'; end if;
  select jsonb_agg(to_jsonb(p)-'owner_withdrawal_state'-'owner_withdrawal_reason'-'owner_withdrawn_at'-'is_active'-'updated_at' order by id)
    into v_products_before from public.products p where id in (951,999,1114);
  select jsonb_agg(to_jsonb(v)-'is_active'-'updated_at' order by id)
    into v_variants_before from public.product_variants v where id in (1853,1960,2414,2415);
  if not v_already then
    update public.products set is_active=false,owner_withdrawal_state=case when id=1114 then 'OWNER_DEFERRED' else 'OWNER_EXCLUDED' end,
      owner_withdrawal_reason='owner-catalogue-decision-2026-11-08',owner_withdrawn_at=statement_timestamp()
      where id in (951,999,1114);
    update public.product_variants set is_active=false where id in (1853,1960,2414,2415);
    update public.price_observation_producers set approved_scope='approved-284',updated_at=statement_timestamp()
      where retailer_id=9 and approved_scope='approved-286' and enabled and technically_capable;
    get diagnostics v_changed=row_count;
    if v_changed<>1 then raise exception 'OWNER_PRODUCER_SCOPE_DRIFT'; end if;
  end if;
  for v_spec in select value from jsonb_array_elements(v_patches) loop
    select p.oid,p.proowner,p.proacl,p.proconfig,pg_get_functiondef(p.oid) definition into strict v_function
      from pg_proc p where p.oid=(v_spec->>'signature')::regprocedure;
    if v_already then
      if md5(v_function.definition)<>v_spec->>'new_md5' then raise exception 'OWNER_REGISTRATION_DRIFT'; end if;
      continue;
    end if;
    if md5(v_function.definition)<>v_spec->>'old_md5' then raise exception 'OWNER_REGISTRATION_DRIFT'; end if;
    v_new:=v_function.definition;
    for v_step in select value from jsonb_array_elements(v_spec->'steps') loop
      if (length(v_new)-length(replace(v_new,v_step->>'old','')))/length(v_step->>'old')<>(v_step->>'count')::integer then
        raise exception 'OWNER_REGISTRATION_ANCHOR_DRIFT'; end if;
      v_new:=replace(v_new,v_step->>'old',v_step->>'new');
    end loop;
    execute v_new;
    if pg_get_functiondef(v_function.oid)<>v_new or not exists(select 1 from pg_proc p where p.oid=v_function.oid
      and p.proowner=v_function.proowner and p.proacl is not distinct from v_function.proacl
      and p.proconfig is not distinct from v_function.proconfig) then raise exception 'OWNER_REGISTRATION_PRIVILEGE_DRIFT'; end if;
  end loop;
  if exists(select 1 from public.products where id in (951,999,1114) and (is_active or merged_into_product_id is not null or merged_at is not null))
    or exists(select 1 from public.product_variants where product_id in (951,999,1114) and is_active)
    or (select jsonb_agg(to_jsonb(p)-'owner_withdrawal_state'-'owner_withdrawal_reason'-'owner_withdrawn_at'-'is_active'-'updated_at' order by id)
      from public.products p where id in (951,999,1114)) is distinct from v_products_before
    or (select jsonb_agg(to_jsonb(v)-'is_active'-'updated_at' order by id)
      from public.product_variants v where id in (1853,1960,2414,2415)) is distinct from v_variants_before
    or (select count(*) from public.offers o join public.products p on p.id=o.product_id where o.retailer_id=9 and p.is_active)<>284
    or (select count(*) from public.offers o join public.products p on p.id=o.product_id where o.retailer_id=11 and p.is_active)<>504
    or (select to_jsonb(p)-'approved_scope'-'updated_at' from public.price_observation_producers p where retailer_id=9) is distinct from v_producer_before
    or not public.fit_house_six_oos_baseline_exact() then raise exception 'OWNER_WITHDRAWAL_POSTFLIGHT_FAILED'; end if;
end
$owner_activation$;
-- OWNER_ACTIVATION_END

commit;
