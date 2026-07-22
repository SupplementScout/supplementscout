begin;

-- Standard importer plans deliberately use a closed meta schema. Snapshot identity
-- remains bound at the reviewed artifact and contract layers, so do not require
-- duplicate snapshot fields inside each atomic plan's meta object.
do $fix_reviewed_stock_only_binding$
declare
  v_function regprocedure := to_regprocedure('public.retailer_offer_sync_validate_reviewed_stock_only_internal(jsonb)');
  v_definition text;
  v_incompatible_check text := $incompatible$
  if exists(select 1 from jsonb_array_elements(v_artifact->'rows') r where r.value#>>'{atomic_plan,meta,source_snapshot_sha256}' is distinct from v_artifact->>'source_snapshot_fingerprint' or r.value#>>'{atomic_plan,meta,source_captured_at}' is distinct from v_artifact->>'source_captured_at') then
    perform public.retailer_catalogue_raise('RSBI_SOURCE_HASH_MISMATCH','Reviewed row source binding mismatch');
  end if;
$incompatible$;
begin
  if v_function is null then
    raise exception 'reviewed stock-only validator is missing';
  end if;

  select pg_get_functiondef(v_function) into v_definition;
  if strpos(v_definition,v_incompatible_check)=0 then
    raise exception 'reviewed stock-only validator binding check did not match';
  end if;

  execute replace(v_definition,v_incompatible_check,'');
end
$fix_reviewed_stock_only_binding$;

commit;
