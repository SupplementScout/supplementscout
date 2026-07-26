begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- Control-plane tooling only. No business rows are changed.
-- This preserves the existing optioned legacy-mapping contract while allowing
-- an absent source SKU only for an exact Fit House Shopify variant identity.
do $patch_reviewed_fit_house_no_sku$
declare
  v_fn text;
  v_old text;
  v_new text;
begin
  select pg_get_functiondef(
    'public.atomic_import_is_legacy_mapping_upgrade(jsonb)'::regprocedure
  ) into v_fn;
  if v_fn is null then
    raise exception 'atomic_import_is_legacy_mapping_upgrade(jsonb) is missing';
  end if;

  v_old := $$or nullif(v_values->>'external_sku','') is null$$;
  v_new := $$or (
       nullif(v_values->>'external_sku','') is null
       and not (
         v_retailer_id = (
           select id from public.retailers where slug = 'fit-house' limit 1
         )
         and coalesce(v_expected->'external_sku', 'null'::jsonb) = 'null'::jsonb
         and (v_values->>'external_product_id') ~ '^[0-9]{10,}$'
         and (v_values->>'external_variant_id') ~ '^[0-9]{10,}$'
         and v_values->>'external_product_id'
           is distinct from v_values->>'external_variant_id'
         and (v_values->>'external_url') like 'https://fithouse.uk/products/%'
         and (v_values->>'external_url') ~ (
           '[?&]variant='
           || (v_values->>'external_variant_id')
           || '(&|$)'
         )
         and v_evidence->>'legacy_option_tuple_mode'
           = 'flavour_only_parent_size'
         and jsonb_typeof(v_values->'external_options') = 'object'
         and (select count(*) from jsonb_each(v_values->'external_options')) = 1
         and (v_values->'external_options' ? 'Flavour')
         and not (v_values->'external_options' ? 'Size')
       )
     )$$;

  if position(v_new in v_fn) = 0 then
    if position(v_old in v_fn) = 0 then
      raise exception 'reviewed Fit House no-SKU patch target not found';
    end if;
    if position(v_old in substring(
      v_fn from position(v_old in v_fn) + length(v_old)
    )) > 0 then
      raise exception 'reviewed Fit House no-SKU patch target is ambiguous';
    end if;
    v_fn := replace(v_fn, v_old, v_new);
    execute v_fn;
  end if;
end;
$patch_reviewed_fit_house_no_sku$;

alter function public.atomic_import_is_legacy_mapping_upgrade(jsonb) owner to postgres;
revoke all on function public.atomic_import_is_legacy_mapping_upgrade(jsonb)
  from public, anon, authenticated, service_role;

do $verify_reviewed_fit_house_no_sku$
declare
  v_fn text;
begin
  select pg_get_functiondef(
    'public.atomic_import_is_legacy_mapping_upgrade(jsonb)'::regprocedure
  ) into v_fn;
  if position(
    $$(v_values->>'external_url') like 'https://fithouse.uk/products/%'$$
    in v_fn
  ) = 0
  or position(
    $$v_evidence->>'legacy_option_tuple_mode'
           = 'flavour_only_parent_size'$$
    in v_fn
  ) = 0
  or position(
    $$(v_values->>'external_product_id') ~ '^[0-9]{10,}$'$$
    in v_fn
  ) = 0 then
    raise exception 'reviewed Fit House no-SKU patch verification failed';
  end if;
end;
$verify_reviewed_fit_house_no_sku$;

commit;
