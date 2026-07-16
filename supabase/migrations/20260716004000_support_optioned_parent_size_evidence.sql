begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- Tooling/RPC only. This migration does not touch business tables.
-- It keeps true EKM source options intact for Whey Okay optioned legacy upgrades
-- where the variant option tuple is Flavour-only and size is fixed by the parent
-- product identity.

do $patch_optioned_parent_size$
declare
  v_fn text;
  v_old text;
  v_new text;
begin
  select pg_get_functiondef('public.atomic_import_is_legacy_mapping_upgrade(jsonb)'::regprocedure)
    into v_fn;
  if v_fn is null then
    raise exception 'atomic_import_is_legacy_mapping_upgrade(jsonb) is missing';
  end if;

  v_old := $$  v_optioned :=
    v_values->>'external_product_id' is distinct from v_values->>'external_variant_id'
    and jsonb_typeof(v_values->'external_options') = 'object'
    and (select count(*) from jsonb_each(v_values->'external_options')) = 2
    and (v_values->'external_options' ? 'Size')
    and (v_values->'external_options' ? 'Flavour')
    and nullif(v_evidence->>'size_value','') is not null
    and nullif(v_evidence->>'size_unit','') is not null
    and nullif(v_evidence->>'flavour','') is not null;$$;
  v_new := $$  v_optioned :=
    v_values->>'external_product_id' is distinct from v_values->>'external_variant_id'
    and jsonb_typeof(v_values->'external_options') = 'object'
    and nullif(v_evidence->>'size_value','') is not null
    and nullif(v_evidence->>'size_unit','') is not null
    and nullif(v_evidence->>'flavour','') is not null
    and (
      (
        coalesce(v_evidence->>'legacy_option_tuple_mode','') = ''
        and
        (select count(*) from jsonb_each(v_values->'external_options')) = 2
        and (v_values->'external_options' ? 'Size')
        and (v_values->'external_options' ? 'Flavour')
      )
      or (
        v_evidence->>'legacy_option_tuple_mode' = 'flavour_only_parent_size'
        and (select count(*) from jsonb_each(v_values->'external_options')) = 1
        and (v_values->'external_options' ? 'Flavour')
        and not (v_values->'external_options' ? 'Size')
        and jsonb_typeof(v_evidence->'external_options') = 'object'
        and (select count(*) from jsonb_each(v_evidence->'external_options')) = 1
        and (v_evidence->'external_options' ? 'Flavour')
        and not (v_evidence->'external_options' ? 'Size')
        and nullif(v_evidence->>'legacy_parent_size_value','') is not null
        and nullif(v_evidence->>'legacy_parent_size_unit','') is not null
        and nullif(v_evidence->>'legacy_parent_size_source','') is not null
        and v_evidence->>'legacy_parent_size_all_variants_same' = 'true'
      )
    );$$;
  if position(v_new in v_fn) = 0 then
    if position(v_old in v_fn) = 0 then
      raise exception 'optioned parent-size mode target not found';
    end if;
    v_fn := replace(v_fn, v_old, v_new);
  end if;

  v_old := $$    select value into v_option_size
    from jsonb_each_text(v_values->'external_options')
    where lower(key)='size' limit 1;
    v_normalized_option_size := public.atomic_import_normalize_size(v_option_size);
    if v_normalized_option_size is null
       or nullif(v_normalized_option_size->>'value','')::numeric is distinct from v_variant.size_value
       or v_normalized_option_size->>'unit' is distinct from v_variant.size_unit then
      return false;
    end if;$$;
  v_new := $$    if v_evidence->>'legacy_option_tuple_mode' = 'flavour_only_parent_size' then
      v_normalized_option_size := public.atomic_import_normalize_size(
        (v_evidence->>'legacy_parent_size_value') || (v_evidence->>'legacy_parent_size_unit')
      );
      if v_normalized_option_size is null
         or nullif(v_normalized_option_size->>'value','')::numeric is distinct from v_variant.size_value
         or v_normalized_option_size->>'unit' is distinct from v_variant.size_unit
         or nullif(v_evidence->>'legacy_parent_size_source','') is null
         or v_evidence->>'legacy_parent_size_all_variants_same' is distinct from 'true' then
        return false;
      end if;
    else
      select value into v_option_size
      from jsonb_each_text(v_values->'external_options')
      where lower(key)='size' limit 1;
      v_normalized_option_size := public.atomic_import_normalize_size(v_option_size);
      if v_normalized_option_size is null
         or nullif(v_normalized_option_size->>'value','')::numeric is distinct from v_variant.size_value
         or v_normalized_option_size->>'unit' is distinct from v_variant.size_unit then
        return false;
      end if;
    end if;$$;
  if position(v_new in v_fn) = 0 then
    if position(v_old in v_fn) = 0 then
      raise exception 'optioned parent-size size-check target not found';
    end if;
    v_fn := replace(v_fn, v_old, v_new);
  end if;

  execute v_fn;
end;
$patch_optioned_parent_size$;

alter function public.atomic_import_is_legacy_mapping_upgrade(jsonb) owner to postgres;
revoke all on function public.atomic_import_is_legacy_mapping_upgrade(jsonb) from public, anon, authenticated, service_role;

do $patch_parent_size_validation$
declare
  v_fn text;
  v_old text;
  v_new text;
begin
  select pg_get_functiondef('public.validate_product_import_plan_read_only(jsonb)'::regprocedure)
    into v_fn;
  if v_fn is null then
    raise exception 'validate_product_import_plan_read_only(jsonb) is missing';
  end if;

  v_old := $$  if not public.atomic_import_has_exact_keys(
      p_plan#>'{product_variant,evidence}',
      array['flavour','size_value','size_unit','pack_count','product_format','external_options','approved_mapping_id']
    )
    or jsonb_typeof(p_plan#>'{product_variant,evidence,external_options}') not in ('object','null')$$;
  v_new := $$  if not (
      public.atomic_import_has_exact_keys(
        p_plan#>'{product_variant,evidence}',
        array['flavour','size_value','size_unit','pack_count','product_format','external_options','approved_mapping_id']
      )
      or (
        p_plan#>>'{product_variant,evidence,legacy_option_tuple_mode}' = 'flavour_only_parent_size'
        and public.atomic_import_has_exact_keys(
          p_plan#>'{product_variant,evidence}',
          array['flavour','size_value','size_unit','pack_count','product_format','external_options','approved_mapping_id','legacy_option_tuple_mode','legacy_parent_size_value','legacy_parent_size_unit','legacy_parent_size_source','legacy_parent_size_all_variants_same']
        )
      )
    )
    or jsonb_typeof(p_plan#>'{product_variant,evidence,external_options}') not in ('object','null')$$;
  if position(v_new in v_fn) = 0 then
    if position(v_old in v_fn) = 0 then
      raise exception 'validate_product_import_plan_read_only(jsonb) parent-size evidence schema target not found';
    end if;
    v_fn := replace(v_fn, v_old, v_new);
  end if;

  execute v_fn;
end;
$patch_parent_size_validation$;

alter function public.validate_product_import_plan_read_only(jsonb) owner to postgres;
revoke all on function public.validate_product_import_plan_read_only(jsonb) from public, anon, authenticated, service_role;

do $patch_parent_size_apply$
declare
  v_fn text;
  v_old text;
  v_new text;
begin
  select pg_get_functiondef('public.apply_product_import_plan(jsonb)'::regprocedure)
    into v_fn;
  if v_fn is null then
    raise exception 'apply_product_import_plan(jsonb) is missing';
  end if;

  v_old := $$  if not public.atomic_import_has_exact_keys(
    p_plan#>'{product_variant,evidence}',
    array['flavour','size_value','size_unit','pack_count','product_format','external_options','approved_mapping_id']
  )
  or jsonb_typeof(p_plan#>'{product_variant,evidence,external_options}') not in ('object','null')$$;
  v_new := $$  if not (
    public.atomic_import_has_exact_keys(
      p_plan#>'{product_variant,evidence}',
      array['flavour','size_value','size_unit','pack_count','product_format','external_options','approved_mapping_id']
    )
    or (
      p_plan#>>'{product_variant,evidence,legacy_option_tuple_mode}' = 'flavour_only_parent_size'
      and public.atomic_import_has_exact_keys(
        p_plan#>'{product_variant,evidence}',
        array['flavour','size_value','size_unit','pack_count','product_format','external_options','approved_mapping_id','legacy_option_tuple_mode','legacy_parent_size_value','legacy_parent_size_unit','legacy_parent_size_source','legacy_parent_size_all_variants_same']
      )
    )
  )
  or jsonb_typeof(p_plan#>'{product_variant,evidence,external_options}') not in ('object','null')$$;
  if position(v_new in v_fn) = 0 then
    if position(v_old in v_fn) = 0 then
      raise exception 'apply_product_import_plan(jsonb) parent-size evidence schema target not found';
    end if;
    v_fn := replace(v_fn, v_old, v_new);
  end if;

  execute v_fn;
end;
$patch_parent_size_apply$;

alter function public.apply_product_import_plan(jsonb) owner to postgres;
revoke all on function public.apply_product_import_plan(jsonb) from public, anon, authenticated, service_role;

commit;
