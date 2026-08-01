begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- Owner-reviewed identity repair only. Commerce fields (price, shipping, stock,
-- URL and timestamps on offers) are deliberately preserved.
do $upgrade_exact_gym_high_identities$
declare
  v_count integer;
begin
  if (select id from public.retailers where slug = 'gym-high') is distinct from 1 then
    raise exception 'GYM HIGH retailer identity drift';
  end if;

  select count(*) into v_count
  from public.retailer_products rp
  join (values
    (121::bigint,496::bigint,560::bigint,'GYM HIGH 7mm Leather Weight Lifting Belt','gym-high-7mm-leather-weight-lifting-belt','https://gymhigh.co.uk/?post_type=product&p=713'),
    (122::bigint,476::bigint,431::bigint,'GYM HIGH Performance T-Shirt','gym-high-performance-t-shirt','https://gymhigh.co.uk/?post_type=product&p=719'),
    (143::bigint,432::bigint,550::bigint,'GYM HIGH Shaker Bottle','gym-high-shaker-bottle','https://gymhigh.co.uk/?post_type=product&p=708'),
    (549::bigint,510::bigint,603::bigint,'GYM HIGH Whey Pro Synergy Dynamic 600g','gym-high-whey-pro-synergy-dynamic-600g','https://gymhigh.co.uk/?post_type=product&p=655')
  ) e(id,product_id,product_variant_id,external_name,external_slug,external_url)
    on rp.id=e.id and rp.retailer_id=1 and rp.product_id=e.product_id
   and rp.product_variant_id=e.product_variant_id
   and rp.external_product_id is null and rp.external_variant_id is null
   and rp.external_sku is null and rp.external_options is null
   and rp.external_name=e.external_name and rp.external_slug=e.external_slug
   and rp.external_url=e.external_url;
  if v_count <> 4 then raise exception 'GYM HIGH legacy mapping precondition drift'; end if;

  select count(*) into v_count
  from public.offers o
  join (values
    (547::bigint,121::bigint,496::bigint,560::bigint),
    (548::bigint,122::bigint,476::bigint,431::bigint),
    (545::bigint,143::bigint,432::bigint,550::bigint)
  ) e(id,retailer_product_id,product_id,product_variant_id)
    on o.id=e.id and o.retailer_id=1 and o.retailer_product_id=e.retailer_product_id
   and o.product_id=e.product_id and o.product_variant_id=e.product_variant_id;
  if v_count <> 3 then raise exception 'GYM HIGH legacy offer precondition drift'; end if;

  select count(*) into v_count
  from public.product_variants v
  join (values
    (2720::bigint,496::bigint,'L'),
    (2714::bigint,476::bigint,'L'),
    (2725::bigint,432::bigint,'Black'),
    (2730::bigint,337::bigint,'American Strawberry Milkshake')
  ) e(id,product_id,flavour_label)
    on v.id=e.id and v.product_id=e.product_id and v.flavour_label=e.flavour_label
   and v.is_active=true and v.is_default=false;
  if v_count <> 4 then raise exception 'GYM HIGH target variant identity drift'; end if;

  if exists (
    select 1 from public.retailer_products
    where retailer_id=1 and external_variant_id in ('714','720','709','656')
  ) then raise exception 'GYM HIGH target external variant already mapped'; end if;

  update public.retailer_products set
    product_variant_id=2720, external_product_id='713', external_variant_id='714',
    external_options='{"Fit":"L"}'::jsonb, updated_at=now()
  where id=121;
  update public.offers set product_variant_id=2720 where id=547;

  update public.retailer_products set
    product_variant_id=2714, external_product_id='719', external_variant_id='720',
    external_options='{"Fit":"L"}'::jsonb, updated_at=now()
  where id=122;
  update public.offers set product_variant_id=2714 where id=548;

  update public.retailer_products set
    product_variant_id=2725, external_product_id='708', external_variant_id='709',
    external_options='{"Colour":"Black"}'::jsonb, updated_at=now()
  where id=143;
  update public.offers set product_variant_id=2725 where id=545;

  update public.retailer_products set
    product_id=337, product_variant_id=2730,
    external_product_id='655', external_variant_id='656',
    external_options='{"Size":"600g","Flavour":"American Strawberry Milkshake"}'::jsonb,
    external_name='GYM HIGH Whey Pro Synergy 600g',
    external_slug='gym-high-whey-pro-synergy-600g', updated_at=now()
  where id=549;

  if (select count(*) from public.retailer_products
      where (id,product_id,product_variant_id,external_product_id,external_variant_id) in (
        (121,496,2720,'713','714'),(122,476,2714,'719','720'),
        (143,432,2725,'708','709'),(549,337,2730,'655','656')
      )) <> 4 then
    raise exception 'GYM HIGH identity upgrade postcondition failed';
  end if;
  if (select count(*) from public.offers
      where (id,retailer_product_id,product_id,product_variant_id) in (
        (547,121,496,2720),(548,122,476,2714),(545,143,432,2725)
      )) <> 3 then
    raise exception 'GYM HIGH offer identity upgrade postcondition failed';
  end if;
end;
$upgrade_exact_gym_high_identities$;

commit;
