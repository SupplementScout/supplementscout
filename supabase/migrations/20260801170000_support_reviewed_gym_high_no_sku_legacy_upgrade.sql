begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- Control-plane tooling only. No business rows are changed. Extend the existing
-- no-SKU exception for one owner-reviewed GYM HIGH legacy mapping tuple only.
do $patch_reviewed_gym_high_no_sku$
declare
  v_fn text;
  v_old text;
  v_new text;
begin
  select pg_get_functiondef('public.atomic_import_is_legacy_mapping_upgrade(jsonb)'::regprocedure) into v_fn;
  if v_fn is null then
    raise exception 'atomic_import_is_legacy_mapping_upgrade(jsonb) is missing';
  end if;

  v_old := $fragment$and not (v_values->'external_options' ? 'Size')
       )
     )$fragment$;
  v_new := $fragment$and not (v_values->'external_options' ? 'Size')
       )
       and not (
         v_retailer_id = 1
         and v_retailer_id = (select id from public.retailers where slug = 'gym-high' limit 1)
         and v_mapping_id = 78
         and v_offer_id = 543
         and v_product_id = 390
         and v_variant_id = 1064
         and coalesce(v_expected->'external_sku', 'null'::jsonb) = 'null'::jsonb
         and v_values->>'external_product_id' = '703'
         and v_values->>'external_variant_id' = '704'
         and nullif(v_values->>'external_sku','') is null
         and v_values->>'external_url' = 'https://gymhigh.co.uk/?post_type=product&p=703'
         and v_evidence->>'reviewed_gym_high_no_sku_identity' = 'true'
         and jsonb_typeof(v_values->'external_options') = 'object'
         and (select count(*) from jsonb_each(v_values->'external_options')) = 2
         and v_values->'external_options' = '{"Size":"600g","Flavour":"Berry Bliss"}'::jsonb
       )
     )$fragment$;

  if position(v_new in v_fn) = 0 then
    if position(v_old in v_fn) = 0 then
      raise exception 'reviewed GYM HIGH no-SKU patch target not found';
    end if;
    if position(v_old in substring(v_fn from position(v_old in v_fn) + length(v_old))) > 0 then
      raise exception 'reviewed GYM HIGH no-SKU patch target is ambiguous';
    end if;
    v_fn := replace(v_fn, v_old, v_new);
    execute v_fn;
  end if;
end;
$patch_reviewed_gym_high_no_sku$;

alter function public.atomic_import_is_legacy_mapping_upgrade(jsonb) owner to postgres;
revoke all on function public.atomic_import_is_legacy_mapping_upgrade(jsonb) from public, anon, authenticated, service_role;

do $verify_reviewed_gym_high_no_sku$
declare
  v_fn text;
begin
  select pg_get_functiondef('public.atomic_import_is_legacy_mapping_upgrade(jsonb)'::regprocedure) into v_fn;
  if position($$v_mapping_id = 78$$ in v_fn) = 0
     or position($$v_values->>'external_variant_id' = '704'$$ in v_fn) = 0
     or position($$v_evidence->>'reviewed_gym_high_no_sku_identity' = 'true'$$ in v_fn) = 0 then
    raise exception 'reviewed GYM HIGH no-SKU patch verification failed';
  end if;
end;
$verify_reviewed_gym_high_no_sku$;

commit;
