begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';

-- Emergency function-only rollback. This performs no catalogue DML.
do $rollback$
declare
  v_function regprocedure :=
    to_regprocedure('public.atomic_import_validate_variant_plan_core(jsonb)');
  v_definition text;
  v_old text;
  v_new text;
  v_start integer;
  v_end integer;
begin
  if v_function is null then
    raise exception 'shared-parent rollback preflight failed: validator is missing';
  end if;
  select pg_catalog.pg_get_functiondef(v_function) into v_definition;
  if pg_catalog.strpos(v_definition, 'Shared-parent identity contract v1') = 0 then
    raise exception 'shared-parent rollback preflight failed: forward definition is not installed';
  end if;

  v_old :=
    'not public.atomic_import_has_exact_keys(p_plan->''retailer_product'', array[''action'',''values'',''identity_contract''])';
  v_new :=
    'not public.atomic_import_has_exact_keys(p_plan->''retailer_product'', array[''action'',''values''])';
  if pg_catalog.strpos(v_definition, v_old) = 0 then
    raise exception 'shared-parent rollback preflight failed: schema assertion did not match';
  end if;
  v_definition := pg_catalog.replace(v_definition, v_old, v_new);

  v_start := pg_catalog.strpos(
    v_definition,
    '  -- Shared-parent identity contract v1.'
  );
  v_end := pg_catalog.strpos(
    v_definition,
    E'\n\n  return jsonb_build_object('
  );
  if v_start = 0 or v_end = 0 or v_end <= v_start then
    raise exception 'shared-parent rollback preflight failed: forward validation block did not match';
  end if;
  v_new := $old$
  if exists (
    select 1 from public.retailer_products
    where retailer_id=v_retailer_id and (
      external_variant_id=v_external_variant_id
      or external_url=v_external_url
    )
  ) then
    raise exception 'stale product import plan: retailer product identity';
  end if;
$old$;
  v_definition :=
    pg_catalog.substr(v_definition, 1, v_start - 1)
    || pg_catalog.substr(v_new, 2)
    || pg_catalog.substr(v_definition, v_end + 1);
  execute v_definition;
end
$rollback$;

do $post_validation$
declare
  v_definition text;
  v_definition_hash text;
begin
  select pg_catalog.pg_get_functiondef(
    'public.atomic_import_validate_variant_plan_core(jsonb)'::regprocedure
  ) into v_definition;
  v_definition_hash := encode(
    pg_catalog.sha256(convert_to(v_definition, 'UTF8')),
    'hex'
  );
  if v_definition_hash <>
     '955321b6f9fd577cc95b3e6c206fa7919fd8e7bf54755e9ed584c49b3d587179' then
    raise exception
      'shared-parent rollback validation failed: original function hash was not restored (%)',
      v_definition_hash;
  end if;
end
$post_validation$;

commit;
