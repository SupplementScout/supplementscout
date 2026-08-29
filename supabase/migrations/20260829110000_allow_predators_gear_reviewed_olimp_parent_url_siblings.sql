begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- Policy only: permit three exact reviewed WooCommerce siblings to share the
-- already-live parent URL. Exact external variant and SKU collisions remain
-- fail-closed, and no catalogue or offer row is mutated here.
do $preflight$
begin
  if to_regprocedure('public.atomic_import_validate_pre_source_metadata_plan_core(jsonb)') is null
     or to_regprocedure('public.atomic_import_predators_v3_parent_variant_transport_allowed(jsonb,jsonb)') is null
     or to_regclass('public.retailer_products') is null
     or to_regclass('public.products') is null
     or to_regclass('public.product_variants') is null then
    raise exception 'Predators Gear reviewed Olimp parent URL sibling prerequisites are missing';
  end if;
end
$preflight$;

do $reviewed_olimp_parent_url_siblings$
declare
  v_definition text;
  v_updated text;
  v_old text := $old$
  if exists (
    select 1 from public.retailer_products rp
    where rp.retailer_id=v_retailer_id and (
      rp.external_variant_id=v_external_variant_id
      or (v_external_sku is not null and rp.external_sku=v_external_sku and rp.external_variant_id is distinct from v_external_variant_id)
      or (
        rp.external_url=v_external_url
        and not (
          v_retailer_id=13
          and v_product_values->>'name'='DY Nutrition The Creatine Complex 316g'
          and v_product_values->>'slug'='dy-nutrition-the-creatine-complex-316g'
          and v_product_values->>'brand'='DY Nutrition'
          and v_product_values->>'category'='Creatine'
          and v_product_values->>'product_format'='powder'
          and v_external_product_id='8594181604892'
          and v_external_variant_id in ('8594181604896','8594181604897')
          and v_external_url='https://predatorsgear.co.uk/supplements-vitamins-shop/dorian-yates-the-creatine-complex-316g/'
          and rp.product_id=1143
          and rp.external_product_id='8594181604892'
          and rp.external_url=v_external_url
          and (
            (rp.external_variant_id='8594181604895'
              and rp.external_sku='5060763890503'
              and rp.external_gtin='05060763890503'
              and rp.external_options=jsonb_build_object('Flavour','Cherry')
              and rp.product_variant_id=3188)
            or (rp.external_variant_id='8594181604896'
              and rp.external_sku='5060763890510'
              and rp.external_gtin='05060763890510'
              and rp.external_options=jsonb_build_object('Flavour','Peach')
              and exists (
                select 1 from public.product_variants pv
                where pv.id=rp.product_variant_id
                  and pv.product_id=1143
                  and pv.is_active
                  and not pv.is_default
                  and pv.flavour_label='Peach'
                  and pv.size_value=316
                  and lower(pv.size_unit)='g'
              ))
            or (rp.external_variant_id='8594181604897'
              and rp.external_sku='5060763890527'
              and rp.external_gtin='05060763890527'
              and rp.external_options=jsonb_build_object('Flavour','Strawberry')
              and exists (
                select 1 from public.product_variants pv
                where pv.id=rp.product_variant_id
                  and pv.product_id=1143
                  and pv.is_active
                  and not pv.is_default
                  and pv.flavour_label='Strawberry'
                  and pv.size_value=316
                  and lower(pv.size_unit)='g'
              ))
          )
        )
      )
    )
  ) then
    raise exception 'stale product import plan: retailer product identity';
  end if;
$old$;
  v_new text := $new$
  if exists (
    select 1 from public.retailer_products rp
    where rp.retailer_id=v_retailer_id and (
      rp.external_variant_id=v_external_variant_id
      or (v_external_sku is not null and rp.external_sku=v_external_sku and rp.external_variant_id is distinct from v_external_variant_id)
      or (
        rp.external_url=v_external_url
        and not (
          (
            v_retailer_id=13
            and v_product_values->>'name'='DY Nutrition The Creatine Complex 316g'
            and v_product_values->>'slug'='dy-nutrition-the-creatine-complex-316g'
            and v_product_values->>'brand'='DY Nutrition'
            and v_product_values->>'category'='Creatine'
            and v_product_values->>'product_format'='powder'
            and v_external_product_id='8594181604892'
            and v_external_variant_id in ('8594181604896','8594181604897')
            and v_external_url='https://predatorsgear.co.uk/supplements-vitamins-shop/dorian-yates-the-creatine-complex-316g/'
            and rp.product_id=1143
            and rp.external_product_id='8594181604892'
            and rp.external_url=v_external_url
            and (
              (rp.external_variant_id='8594181604895'
                and rp.external_sku='5060763890503'
                and rp.external_gtin='05060763890503'
                and rp.external_options=jsonb_build_object('Flavour','Cherry')
                and rp.product_variant_id=3188)
              or (rp.external_variant_id='8594181604896'
                and rp.external_sku='5060763890510'
                and rp.external_gtin='05060763890510'
                and rp.external_options=jsonb_build_object('Flavour','Peach')
                and exists (
                  select 1 from public.product_variants pv
                  where pv.id=rp.product_variant_id
                    and pv.product_id=1143
                    and pv.is_active
                    and not pv.is_default
                    and pv.flavour_label='Peach'
                    and pv.size_value=316
                    and lower(pv.size_unit)='g'
                ))
              or (rp.external_variant_id='8594181604897'
                and rp.external_sku='5060763890527'
                and rp.external_gtin='05060763890527'
                and rp.external_options=jsonb_build_object('Flavour','Strawberry')
                and exists (
                  select 1 from public.product_variants pv
                  where pv.id=rp.product_variant_id
                    and pv.product_id=1143
                    and pv.is_active
                    and not pv.is_default
                    and pv.flavour_label='Strawberry'
                    and pv.size_value=316
                    and lower(pv.size_unit)='g'
                ))
            )
          )
          or (
            public.atomic_import_predators_v3_parent_variant_transport_allowed(p_plan,v_retailer_actual)
            and (
              (
                v_external_product_id='8594181603360'
                and v_external_variant_id='8594181607205'
                and v_external_url='https://predatorsgear.co.uk/supplements-vitamins-shop/olimp-bcaa-xplode-powder-branched-chain-amino-acids-glutamine-vitamin-b6-leucine-1000g-500g-280g/'
                and rp.product_id=1158
                and rp.product_variant_id=3211
                and rp.external_product_id='8594181603360'
                and rp.external_variant_id='8594181603369'
                and rp.external_sku='5901330039614'
                and rp.external_gtin='05901330039614'
                and rp.external_options=jsonb_build_object('Flavour','Fruit Punch')
                and rp.external_url=v_external_url
                and exists (
                  select 1
                  from public.products p
                  join public.product_variants pv on pv.product_id=p.id
                  where p.id=1158 and p.is_active
                    and p.merged_into_product_id is null and p.merged_at is null
                    and pv.id=3211 and pv.is_active and not pv.is_default
                    and pv.flavour_label='Fruit Punch'
                    and pv.size_value=500 and lower(pv.size_unit)='g'
                )
              )
              or (
                v_external_product_id='8594181603396'
                and v_external_variant_id in ('8594181603400','8594181607759')
                and v_external_url='https://predatorsgear.co.uk/supplements-vitamins-shop/olimp-glutamine-xplode-powder-500g/'
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
              )
            )
          )
        )
      )
    )
  ) then
    raise exception 'stale product import plan: retailer product identity';
  end if;
$new$;
begin
  select pg_get_functiondef('public.atomic_import_validate_pre_source_metadata_plan_core(jsonb)'::regprocedure)
  into v_definition;

  if (length(v_definition) - length(replace(v_definition, v_old, ''))) / length(v_old) <> 1
     or position('v_external_variant_id=''8594181607205''' in v_definition) > 0 then
    raise exception 'reviewed Olimp parent URL collision guard anchor/state mismatch';
  end if;

  v_updated := replace(v_definition, v_old, v_new);
  execute v_updated;

  if position(
       'v_external_variant_id=''8594181607205''' in
       pg_get_functiondef('public.atomic_import_validate_pre_source_metadata_plan_core(jsonb)'::regprocedure)
     ) = 0
     or position(
       'v_external_variant_id in (''8594181603400'',''8594181607759'')' in
       pg_get_functiondef('public.atomic_import_validate_pre_source_metadata_plan_core(jsonb)'::regprocedure)
     ) = 0 then
    raise exception 'Predators Gear reviewed Olimp parent URL sibling guard was not installed';
  end if;
end
$reviewed_olimp_parent_url_siblings$;

alter function public.atomic_import_validate_pre_source_metadata_plan_core(jsonb) owner to postgres;

commit;
