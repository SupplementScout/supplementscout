\set ON_ERROR_STOP on

begin read only;
set local statement_timeout = '120s';

do $preflight$
declare
  v_count bigint;
begin
  if to_regclass('public.retailer_products_retailer_url_unique') is null
     or to_regclass('public.offers_retailer_url_unique') is null then
    raise exception 'Preflight failed: legacy URL constraints are missing';
  end if;
  if to_regclass('public.retailer_products_retailer_external_variant_unique_idx') is null then
    raise exception 'Preflight failed: exact external variant uniqueness is missing';
  end if;

  select count(*) into v_count
  from (
    select retailer_id, external_variant_id
    from public.retailer_products
    where external_variant_id is not null
    group by retailer_id, external_variant_id
    having count(*) > 1
  ) duplicates;
  if v_count <> 0 then raise exception 'Preflight failed: % duplicate exact source identities', v_count; end if;

  select count(*) into v_count
  from (
    select retailer_id, product_variant_id
    from public.retailer_products
    where external_variant_id is not null
    group by retailer_id, product_variant_id
    having count(*) > 1
  ) duplicates;
  if v_count <> 0 then raise exception 'Preflight failed: % duplicate exact canonical targets', v_count; end if;

  select count(*) into v_count
  from (
    select retailer_id, external_url
    from public.retailer_products
    where external_variant_id is null
    group by retailer_id, external_url
    having count(*) > 1
  ) duplicates;
  if v_count <> 0 then raise exception 'Preflight failed: % duplicate legacy URL identities', v_count; end if;

  select count(*) into v_count
  from (
    select retailer_product_id
    from public.offers
    group by retailer_product_id
    having count(*) > 1
  ) duplicates;
  if v_count <> 0 then raise exception 'Preflight failed: % duplicate offers per mapping', v_count; end if;
end
$preflight$;

select jsonb_build_object(
  'result', 'PASS',
  'retailer_products', (select count(*) from public.retailer_products),
  'offers', (select count(*) from public.offers),
  'price_history', (select count(*) from public.price_history),
  'exact_identity_mappings', (
    select count(*) from public.retailer_products
    where nullif(btrim(external_product_id), '') is not null
      and nullif(btrim(external_variant_id), '') is not null
  ),
  'legacy_mappings', (
    select count(*) from public.retailer_products
    where external_variant_id is null
  ),
  'shared_mapping_url_groups', (
    select count(*) from (
      select retailer_id, external_url
      from public.retailer_products
      group by retailer_id, external_url
      having count(*) > 1
    ) groups
  ),
  'shared_offer_url_groups', (
    select count(*) from (
      select retailer_id, url
      from public.offers
      group by retailer_id, url
      having count(*) > 1
    ) groups
  )
) as retailer_url_identity_preflight;

rollback;
