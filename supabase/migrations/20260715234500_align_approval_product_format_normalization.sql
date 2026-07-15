begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- Keep the approval-ledger SQL validator semantically aligned with the importer
-- product_format parser. This is schema/RPC-only: it does not touch products,
-- variants, mappings, offers, price history, or approval ledger rows.
create or replace function public.atomic_import_normalize_product_format(p_value text)
returns text
language sql
immutable
strict
set search_path = pg_catalog
as $$
  select case lower(trim(p_value))
    when 'ready_to_drink' then 'liquid'
    when 'ready-to-drink' then 'liquid'
    when 'ready to drink' then 'liquid'
    when 'liquid' then 'liquid'
    when 'capsule' then 'capsules'
    when 'capsules' then 'capsules'
    when 'tablet' then 'tablets'
    when 'tablets' then 'tablets'
    when 'gummy' then 'gummies'
    when 'gummies' then 'gummies'
    when 'powder' then 'powder'
    when 'bar' then 'bar'
    else lower(trim(p_value))
  end;
$$;

alter function public.atomic_import_normalize_product_format(text) owner to postgres;
revoke all on function public.atomic_import_normalize_product_format(text) from public, anon, authenticated, service_role;

do $align_format_normalization$
declare
  v_old_validate text := $$lower(v_evidence->>'product_format') is distinct from lower(v_variant.product_format)$$;
  v_old_apply text := $$lower(coalesce(v_evidence->>'product_format','')) is distinct from lower(v_variant.product_format)$$;
  v_new text := $$public.atomic_import_normalize_product_format(v_evidence->>'product_format') is distinct from public.atomic_import_normalize_product_format(v_variant.product_format)$$;
  v_validate text;
  v_apply text;
begin
  select pg_get_functiondef('public.validate_product_import_plan_read_only(jsonb)'::regprocedure)
  into v_validate;
  if v_validate is null then
    raise exception 'validate_product_import_plan_read_only(jsonb) is missing';
  end if;
  if position(v_new in v_validate) = 0 then
    if position(v_old_validate in v_validate) = 0 then
      raise exception 'validate_product_import_plan_read_only(jsonb) format comparison target not found';
    end if;
    v_validate := replace(v_validate, v_old_validate, v_new);
  end if;
  execute v_validate;

  select pg_get_functiondef('public.apply_product_import_plan(jsonb)'::regprocedure)
  into v_apply;
  if v_apply is null then
    raise exception 'apply_product_import_plan(jsonb) is missing';
  end if;
  if position(v_new in v_apply) = 0 then
    if position(v_old_apply in v_apply) = 0 then
      raise exception 'apply_product_import_plan(jsonb) format comparison target not found';
    end if;
    v_apply := replace(v_apply, v_old_apply, v_new);
  end if;
  execute v_apply;
end;
$align_format_normalization$;

alter function public.validate_product_import_plan_read_only(jsonb) owner to postgres;
alter function public.apply_product_import_plan(jsonb) owner to postgres;

revoke all on function public.validate_product_import_plan_read_only(jsonb) from public, anon, authenticated, service_role;
revoke all on function public.apply_product_import_plan(jsonb) from public, anon, authenticated, service_role;

commit;
