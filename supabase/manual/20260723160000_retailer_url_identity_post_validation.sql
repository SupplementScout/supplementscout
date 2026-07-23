\set ON_ERROR_STOP on

begin read only;
set local statement_timeout = '120s';

do $post_validation$
declare
  v_count bigint;
begin
  if to_regclass('public.retailer_products_retailer_url_unique') is not null
     or to_regclass('public.offers_retailer_url_unique') is not null then
    raise exception 'Post-validation failed: obsolete URL uniqueness remains';
  end if;
  if to_regclass('public.retailer_products_retailer_external_variant_unique_idx') is null
     or to_regclass('public.retailer_products_retailer_exact_canonical_variant_unique_idx') is null
     or to_regclass('public.retailer_products_retailer_legacy_url_unique_idx') is null
     or to_regprocedure('public.retailer_products_enforce_url_identity_partition()') is null
     or not exists (
       select 1 from pg_catalog.pg_trigger
       where tgrelid = 'public.retailer_products'::regclass
         and tgname = 'retailer_products_url_identity_partition_guard'
         and not tgisinternal
         and tgenabled = 'O'
     ) then
    raise exception 'Post-validation failed: replacement identity indexes are incomplete';
  end if;

  select count(*) into v_count
  from (
    select retailer_id, external_variant_id
    from public.retailer_products
    where external_variant_id is not null
    group by retailer_id, external_variant_id
    having count(*) > 1
  ) duplicates;
  if v_count <> 0 then raise exception 'Post-validation failed: % duplicate exact source identities', v_count; end if;

  select count(*) into v_count
  from (
    select retailer_id, product_variant_id
    from public.retailer_products
    where external_variant_id is not null
    group by retailer_id, product_variant_id
    having count(*) > 1
  ) duplicates;
  if v_count <> 0 then raise exception 'Post-validation failed: % duplicate exact canonical targets', v_count; end if;

  select count(*) into v_count
  from (
    select retailer_id, external_url
    from public.retailer_products
    where external_variant_id is null
    group by retailer_id, external_url
    having count(*) > 1
  ) duplicates;
  if v_count <> 0 then raise exception 'Post-validation failed: % duplicate legacy URL identities', v_count; end if;

  select count(*) into v_count
  from (
    select retailer_product_id
    from public.offers
    group by retailer_product_id
    having count(*) > 1
  ) duplicates;
  if v_count <> 0 then raise exception 'Post-validation failed: % duplicate offers per mapping', v_count; end if;

  select count(*) into v_count
  from (
    select retailer_id, external_url
    from public.retailer_products
    group by retailer_id, external_url
    having count(*) > 1
       and (
         count(*) filter (where external_variant_id is null) > 1
         or count(distinct product_id) <> 1
         or count(*) filter (where external_variant_id is not null)
              <> count(distinct external_variant_id) filter (where external_variant_id is not null)
         or (
           count(*) filter (where external_variant_id is not null) > 0
           and (
             count(*) filter (
               where external_variant_id is not null
                 and nullif(btrim(external_product_id), '') is null
             ) > 0
             or count(distinct external_product_id) filter (
               where external_variant_id is not null
             ) <> 1
           )
         )
       )
  ) unsafe_shared_urls;
  if v_count <> 0 then raise exception 'Post-validation failed: % unsafe shared parent URL groups', v_count; end if;
end
$post_validation$;

select jsonb_build_object(
  'result', 'PASS',
  'retailer_products', (select count(*) from public.retailer_products),
  'offers', (select count(*) from public.offers),
  'price_history', (select count(*) from public.price_history),
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
) as retailer_url_identity_post_validation;

rollback;
