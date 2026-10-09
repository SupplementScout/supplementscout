begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';

do $preflight$
declare
  v_executor text;
  v_recovery text;
  v_old_call constant text :=
    'public.retailer_catalogue_other_retailer_fingerprint(v_child.retailer_id)';
begin
  if to_regprocedure('public.retailer_catalogue_other_retailer_fingerprint(bigint)') is null
     or to_regprocedure('public.retailer_offer_sync_execute_batch_unreviewed_internal(jsonb)') is null
     or to_regprocedure('public.retailer_offer_sync_recover_batch_internal(jsonb)') is null then
    raise exception 'compact other-retailer fingerprint requires the current shared executor and recovery path';
  end if;
  if to_regprocedure('public.retailer_catalogue_other_retailer_fingerprint_v2(bigint)') is not null
     or to_regprocedure('public.retailer_catalogue_other_retailer_fingerprint_for_migration(bigint,jsonb)') is not null then
    raise exception 'compact other-retailer fingerprint is already installed';
  end if;

  v_executor:=pg_get_functiondef(
    'public.retailer_offer_sync_execute_batch_unreviewed_internal(jsonb)'::regprocedure);
  v_recovery:=pg_get_functiondef(
    'public.retailer_offer_sync_recover_batch_internal(jsonb)'::regprocedure);

  if (length(v_executor)-length(replace(v_executor,v_old_call,'')))/length(v_old_call)<>2
     or position('public.retailer_catalogue_protected_shared_fingerprint()' in v_executor)=0
     or position('public.retailer_catalogue_orphan_counts()' in v_executor)=0
     or position('public.retailer_offer_sync_row_state' in v_executor)=0
     or (length(v_recovery)-length(replace(v_recovery,v_old_call,'')))/length(v_old_call)<>1
     or position('RSBI_ROLLBACK_OWNERSHIP_CONFLICT' in v_recovery)=0 then
    raise exception 'shared executor or recovery fingerprint anchors drifted';
  end if;
end
$preflight$;

-- The legacy fingerprint remains immutable for every historical recovery
-- manifest. V2 hashes each complete row to a fixed-width digest before it
-- builds the relation digest, so the safety check stays exact without
-- materialising tens of thousands of wide JSON rows in one document.
create function public.retailer_catalogue_other_retailer_fingerprint_v2(
  p_retailer_id bigint
) returns text
language sql
stable
security definer
set search_path=pg_catalog,public
as $fingerprint_v2$
  with mapping_rows as (
    select count(*)::bigint row_count,
           encode(pg_catalog.sha256(convert_to(coalesce(string_agg(
             rp.id::text||':'||encode(pg_catalog.sha256(convert_to(to_jsonb(rp)::text,'UTF8')),'hex'),
             E'\n' order by rp.id),''),'UTF8')),'hex') rows_fingerprint
      from public.retailer_products rp
     where rp.retailer_id<>p_retailer_id
  ), offer_rows as (
    select count(*)::bigint row_count,
           encode(pg_catalog.sha256(convert_to(coalesce(string_agg(
             o.id::text||':'||encode(pg_catalog.sha256(convert_to(to_jsonb(o)::text,'UTF8')),'hex'),
             E'\n' order by o.id),''),'UTF8')),'hex') rows_fingerprint
      from public.offers o
     where o.retailer_id<>p_retailer_id
  ), history_rows as (
    select count(*)::bigint row_count,
           encode(pg_catalog.sha256(convert_to(coalesce(string_agg(
             ph.id::text||':'||encode(pg_catalog.sha256(convert_to(to_jsonb(ph)::text,'UTF8')),'hex'),
             E'\n' order by ph.id),''),'UTF8')),'hex') rows_fingerprint
      from public.price_history ph
      join public.offers o on o.id=ph.offer_id
     where o.retailer_id<>p_retailer_id
  )
  select public.retailer_catalogue_sha256_json(jsonb_build_object(
    'schema_version',2,
    'retailer_products',jsonb_build_object(
      'row_count',mapping_rows.row_count::text,
      'rows_fingerprint',mapping_rows.rows_fingerprint),
    'offers',jsonb_build_object(
      'row_count',offer_rows.row_count::text,
      'rows_fingerprint',offer_rows.rows_fingerprint),
    'price_history',jsonb_build_object(
      'row_count',history_rows.row_count::text,
      'rows_fingerprint',history_rows.rows_fingerprint)))
    from mapping_rows cross join offer_rows cross join history_rows
$fingerprint_v2$;

create function public.retailer_catalogue_other_retailer_fingerprint_for_migration(
  p_retailer_id bigint,
  p_migration_versions jsonb
) returns text
language plpgsql
stable
security definer
set search_path=pg_catalog,public,pg_temp
as $fingerprint_for_migration$
begin
  if jsonb_typeof(p_migration_versions)<>'array' then
    perform public.retailer_catalogue_raise(
      'RSBI_SOURCE_SCHEMA_MISMATCH',
      'Recovery manifest migration versions are not an array');
  end if;
  if p_migration_versions ? '20261009120000_add_compact_other_retailer_fingerprint' then
    return public.retailer_catalogue_other_retailer_fingerprint_v2(p_retailer_id);
  end if;
  return public.retailer_catalogue_other_retailer_fingerprint(p_retailer_id);
end
$fingerprint_for_migration$;

alter function public.retailer_catalogue_other_retailer_fingerprint_v2(bigint) owner to postgres;
alter function public.retailer_catalogue_other_retailer_fingerprint_for_migration(bigint,jsonb) owner to postgres;
revoke all on function public.retailer_catalogue_other_retailer_fingerprint_v2(bigint),
  public.retailer_catalogue_other_retailer_fingerprint_for_migration(bigint,jsonb)
  from public,anon,authenticated,service_role,
       retailer_catalogue_production_validator,
       retailer_catalogue_production_approver,
       retailer_catalogue_production_executor;

do $install$
declare
  v_executor text:=pg_get_functiondef(
    'public.retailer_offer_sync_execute_batch_unreviewed_internal(jsonb)'::regprocedure);
  v_recovery text:=pg_get_functiondef(
    'public.retailer_offer_sync_recover_batch_internal(jsonb)'::regprocedure);
  v_old_call constant text :=
    'public.retailer_catalogue_other_retailer_fingerprint(v_child.retailer_id)';
begin
  v_executor:=replace(
    v_executor,
    v_old_call,
    'public.retailer_catalogue_other_retailer_fingerprint_v2(v_child.retailer_id)');
  v_recovery:=replace(
    v_recovery,
    v_old_call,
    'public.retailer_catalogue_other_retailer_fingerprint_for_migration(v_child.retailer_id,v_manifest.mixed_batch_migration_versions)');
  execute v_executor;
  execute v_recovery;
end
$install$;

do $postflight$
declare
  v_executor text:=pg_get_functiondef(
    'public.retailer_offer_sync_execute_batch_unreviewed_internal(jsonb)'::regprocedure);
  v_recovery text:=pg_get_functiondef(
    'public.retailer_offer_sync_recover_batch_internal(jsonb)'::regprocedure);
  v_v2_call constant text :=
    'public.retailer_catalogue_other_retailer_fingerprint_v2(v_child.retailer_id)';
begin
  if (length(v_executor)-length(replace(v_executor,v_v2_call,'')))/length(v_v2_call)<>2
     or position('public.retailer_catalogue_other_retailer_fingerprint(v_child.retailer_id)' in v_executor)>0
     or position('public.retailer_catalogue_other_retailer_fingerprint_for_migration(v_child.retailer_id,v_manifest.mixed_batch_migration_versions)' in v_recovery)=0
     or position('public.retailer_catalogue_protected_shared_fingerprint()' in v_executor)=0
     or position('public.retailer_catalogue_orphan_counts()' in v_executor)=0
     or position('RSBI_ROLLBACK_OWNERSHIP_CONFLICT' in v_recovery)=0 then
    raise exception 'compact other-retailer fingerprint postflight failed';
  end if;
end
$postflight$;

commit;
