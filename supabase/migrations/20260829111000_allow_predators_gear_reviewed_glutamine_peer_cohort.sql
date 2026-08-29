begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- Policy only: after reviewed Orange is live, permit the exact reviewed
-- Pineapple sibling to treat Orange as a second approved shared-URL peer.
-- External variant and SKU collisions remain fail-closed.
do $preflight$
begin
  if to_regprocedure('public.atomic_import_validate_pre_source_metadata_plan_core(jsonb)') is null
     or to_regprocedure('public.atomic_import_predators_v3_parent_variant_transport_allowed(jsonb,jsonb)') is null
     or to_regclass('public.retailer_products') is null
     or to_regclass('public.product_variants') is null then
    raise exception 'Predators Gear reviewed Glutamine peer cohort prerequisites are missing';
  end if;
end
$preflight$;

do $reviewed_glutamine_peer_cohort$
declare
  v_definition text;
  v_updated text;
  v_old text := $old$
                and rp.product_id=1159
                and rp.product_variant_id=3212
                and rp.external_product_id='8594181603396'
                and rp.external_variant_id='8594181603399'
                and rp.external_sku='5901330024139'
                and rp.external_gtin='05901330024139'
                and rp.external_options=jsonb_build_object('Flavour','Lemon')
                and rp.external_url=v_external_url
                and exists (
                  select 1
                  from public.products p
                  join public.product_variants pv on pv.product_id=p.id
                  where p.id=1159 and p.is_active
                    and p.merged_into_product_id is null and p.merged_at is null
                    and pv.id=3212 and pv.is_active and not pv.is_default
                    and pv.flavour_label='Lemon'
                    and pv.size_value=500 and lower(pv.size_unit)='g'
                )
$old$;
  v_new text := $new$
                and rp.product_id=1159
                and rp.external_product_id='8594181603396'
                and rp.external_url=v_external_url
                and (
                  (
                    rp.product_variant_id=3212
                    and rp.external_variant_id='8594181603399'
                    and rp.external_sku='5901330024139'
                    and rp.external_gtin='05901330024139'
                    and rp.external_options=jsonb_build_object('Flavour','Lemon')
                    and exists (
                      select 1
                      from public.products p
                      join public.product_variants pv on pv.product_id=p.id
                      where p.id=1159 and p.is_active
                        and p.merged_into_product_id is null and p.merged_at is null
                        and pv.id=3212 and pv.is_active and not pv.is_default
                        and pv.flavour_label='Lemon'
                        and pv.size_value=500 and lower(pv.size_unit)='g'
                    )
                  )
                  or (
                    v_external_variant_id='8594181607759'
                    and rp.id=3008
                    and rp.product_variant_id=3215
                    and rp.external_variant_id='8594181603400'
                    and rp.external_sku='5901330024122'
                    and rp.external_gtin='05901330024122'
                    and rp.external_options=jsonb_build_object('Flavour','Orange')
                    and exists (
                      select 1
                      from public.products p
                      join public.product_variants pv on pv.product_id=p.id
                      where p.id=1159 and p.is_active
                        and p.merged_into_product_id is null and p.merged_at is null
                        and pv.id=3215 and pv.is_active and not pv.is_default
                        and pv.flavour_label='Orange'
                        and pv.size_value=500 and lower(pv.size_unit)='g'
                    )
                    and exists (
                      select 1 from public.offers o
                      where o.id=2821 and o.retailer_product_id=rp.id
                        and o.retailer_id=13 and o.product_id=1159
                        and o.product_variant_id=3215 and o.price=34.99
                        and o.shipping_cost=0 and o.total_price=34.99 and o.in_stock
                    )
                  )
                )
$new$;
begin
  select pg_get_functiondef('public.atomic_import_validate_pre_source_metadata_plan_core(jsonb)'::regprocedure)
  into v_definition;

  if (length(v_definition) - length(replace(v_definition, v_old, ''))) / length(v_old) <> 1
     or position('rp.id=3008' in v_definition) > 0 then
    raise exception 'reviewed Glutamine peer cohort anchor/state mismatch';
  end if;

  v_updated := replace(v_definition, v_old, v_new);
  execute v_updated;

  if position(
       'rp.id=3008' in
       pg_get_functiondef('public.atomic_import_validate_pre_source_metadata_plan_core(jsonb)'::regprocedure)
     ) = 0
     or position(
       'v_external_variant_id=''8594181607759''' in
       pg_get_functiondef('public.atomic_import_validate_pre_source_metadata_plan_core(jsonb)'::regprocedure)
     ) = 0 then
    raise exception 'Predators Gear reviewed Glutamine peer cohort guard was not installed';
  end if;
end
$reviewed_glutamine_peer_cohort$;

alter function public.atomic_import_validate_pre_source_metadata_plan_core(jsonb) owner to postgres;

commit;
