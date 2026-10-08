begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $rollback_shared_stable_oos$
declare
  v_target jsonb := public.retailer_catalogue_actual_database_target();
  v_shared regprocedure :=
    'public.retailer_offer_sync_validate_batch_read_only_unreviewed_interna(jsonb)'::regprocedure;
  v_dispatch regprocedure :=
    'public.retailer_offer_sync_validate_batch_read_only_internal(jsonb)'::regprocedure;
  v_shared_record record;
  v_dispatch_record record;
  v_shared_definition text;
  v_dispatch_definition text;
  v_old_oos_guard constant text :=
    'or v_total_oos::numeric/v_row_count>v_maximum_total_oos then';
  v_new_oos_guard constant text :=
    'or (v_new_oos>0 and v_total_oos::numeric/v_row_count>v_maximum_total_oos) then';
  v_fit_route constant text := $route$  if p_request#>>'{artifact,target_environment}'='PRODUCTION'
     and p_request#>>'{artifact,retailer_id}'='9'
     and p_request->>'policy_fingerprint'='dd2f583394ffa3787b595d7009731dff5bb8e485b9114d3778084a71c120dfc1' then
    return public.validate_fit_house_stable_oos_read_only(p_request);
  end if;
$route$;
  v_dispatch_anchor constant text :=
    '  return public.retailer_offer_sync_validate_batch_read_only_unreviewed_interna(p_request);';
begin
  if current_user <> 'postgres'
     or v_target->>'target_environment' <> 'PRODUCTION'
     or v_target->>'project_ref' <> 'aftboxmrdgyhizicfsfu'
     or v_target->>'database_identity' <>
       'supplementscout-production:aftboxmrdgyhizicfsfu' then
    raise exception 'Shared stable OOS rollback requires exact production owner';
  end if;

  select p.oid, p.proowner, p.proacl, p.proconfig, pg_get_functiondef(p.oid) definition
  into strict v_shared_record from pg_proc p where p.oid = v_shared;
  select p.oid, p.proowner, p.proacl, p.proconfig, pg_get_functiondef(p.oid) definition
  into strict v_dispatch_record from pg_proc p where p.oid = v_dispatch;

  v_shared_definition := v_shared_record.definition;
  v_dispatch_definition := v_dispatch_record.definition;
  if (length(v_shared_definition)-length(replace(
       v_shared_definition, v_new_oos_guard, ''))) <> length(v_new_oos_guard)
     or position(v_old_oos_guard in v_shared_definition) > 0
     or position(v_fit_route in v_dispatch_definition) > 0
     or (length(v_dispatch_definition)-length(replace(
       v_dispatch_definition, v_dispatch_anchor, ''))) <> length(v_dispatch_anchor) then
    raise exception 'Shared stable OOS rollback anchor mismatch';
  end if;

  v_shared_definition := replace(
    v_shared_definition, v_new_oos_guard, v_old_oos_guard);
  v_dispatch_definition := replace(
    v_dispatch_definition, v_dispatch_anchor, v_fit_route || v_dispatch_anchor);
  execute v_shared_definition;
  execute v_dispatch_definition;

  if pg_get_functiondef(v_shared_record.oid) <> v_shared_definition
     or pg_get_functiondef(v_dispatch_record.oid) <> v_dispatch_definition
     or md5(pg_get_functiondef(v_shared_record.oid)) <> '49d36240cb3f7c9fed12f63b145e93f0'
     or md5(pg_get_functiondef(v_dispatch_record.oid)) <> 'a9e191f447a1efda3cf788019b5bd79a'
     or not exists (
       select 1 from pg_proc p where p.oid = v_shared_record.oid
       and p.proowner = v_shared_record.proowner
       and p.proacl is not distinct from v_shared_record.proacl
       and p.proconfig is not distinct from v_shared_record.proconfig)
     or not exists (
       select 1 from pg_proc p where p.oid = v_dispatch_record.oid
       and p.proowner = v_dispatch_record.proowner
       and p.proacl is not distinct from v_dispatch_record.proacl
       and p.proconfig is not distinct from v_dispatch_record.proconfig) then
    raise exception 'Shared stable OOS rollback verification failed';
  end if;
end
$rollback_shared_stable_oos$;

commit;
