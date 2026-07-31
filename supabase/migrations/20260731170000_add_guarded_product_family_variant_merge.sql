begin;

create or replace function public.merge_product_into_existing_variant(
  canonical_id bigint,
  candidate_id bigint,
  target_variant_id bigint
) returns jsonb
language plpgsql
security definer
set search_path = 'pg_catalog', 'public'
as $family_merge$
declare
  canonical_product public.products%rowtype;
  candidate_product public.products%rowtype;
  candidate_variant public.product_variants%rowtype;
  target_variant public.product_variants%rowtype;
  candidate_variant_id bigint;
  locked_count integer;
  candidate_active_variant_count integer;
  candidate_offer_ids bigint[] := '{}';
  candidate_mapping_ids bigint[] := '{}';
  price_history_offer_ids bigint[] := '{}';
  candidate_offers_before jsonb := '[]'::jsonb;
  candidate_mappings_before jsonb := '[]'::jsonb;
  candidate_clicks_before jsonb := '[]'::jsonb;
  price_history_count integer := 0;
  merged_at_value timestamptz := now();
  merge_history_id bigint;
begin
  if canonical_id is null or candidate_id is null or target_variant_id is null
     or canonical_id <= 0 or candidate_id <= 0 or target_variant_id <= 0
     or canonical_id = candidate_id then
    raise exception 'Positive, different canonical/candidate IDs and a positive target variant ID are required';
  end if;

  select count(*) into locked_count
  from (
    select id
    from public.products
    where id in (canonical_id, candidate_id)
    order by id
    for update
  ) locked_products;

  if locked_count <> 2 then
    raise exception 'Both products must exist';
  end if;

  select * into canonical_product
  from public.products where id = canonical_id;
  select * into candidate_product
  from public.products where id = candidate_id;

  if canonical_product.is_active is not true
     or canonical_product.merged_into_product_id is not null
     or canonical_product.merged_at is not null then
    raise exception 'Canonical product is already merged or inactive';
  end if;

  if candidate_product.is_active is not true
     or candidate_product.merged_into_product_id is not null
     or candidate_product.merged_at is not null then
    raise exception 'Candidate product is already merged or inactive';
  end if;

  if lower(btrim(coalesce(canonical_product.brand, '')))
     <> lower(btrim(coalesce(candidate_product.brand, ''))) then
    raise exception 'Family merge blocked: products have different brands';
  end if;

  if lower(btrim(coalesce(canonical_product.category, '')))
     <> lower(btrim(coalesce(candidate_product.category, ''))) then
    raise exception 'Family merge blocked: products have different categories';
  end if;

  select * into target_variant
  from public.product_variants
  where id = target_variant_id
  for update;

  if not found
     or target_variant.product_id <> canonical_id
     or target_variant.is_active is not true then
    raise exception 'Target variant must be active and belong to the canonical product';
  end if;

  select count(*), min(id)
    into candidate_active_variant_count, candidate_variant_id
  from public.product_variants
  where product_id = candidate_id
    and is_active is true;

  if candidate_active_variant_count <> 1 then
    raise exception 'Family merge requires exactly one active candidate variant';
  end if;

  select * into candidate_variant
  from public.product_variants
  where id = candidate_variant_id
  for update;

  if candidate_variant.is_default is not true then
    raise exception 'Family merge candidate variant must be the default variant';
  end if;

  if exists (
    select 1 from public.offers
    where product_id = candidate_id
      and product_variant_id <> candidate_variant.id
  ) or exists (
    select 1 from public.retailer_products
    where product_id = candidate_id
      and product_variant_id <> candidate_variant.id
  ) then
    raise exception 'Family merge blocked: candidate linkage is not default-only';
  end if;

  if exists (
    select 1
    from public.offers candidate_offer
    join public.offers canonical_offer
      on canonical_offer.product_id = canonical_id
     and canonical_offer.product_variant_id = target_variant_id
     and canonical_offer.retailer_id = candidate_offer.retailer_id
    where candidate_offer.product_id = candidate_id
  ) then
    raise exception 'Family merge blocked: target variant already has an offer from a candidate retailer';
  end if;

  if exists (
    select 1
    from public.retailer_products candidate_mapping
    where candidate_mapping.product_id = candidate_id
      and nullif(btrim(coalesce(candidate_mapping.external_url, '')), '') is null
  ) or exists (
    select 1
    from public.offers candidate_offer
    where candidate_offer.product_id = candidate_id
      and nullif(btrim(coalesce(candidate_offer.url, '')), '') is null
  ) then
    raise exception 'Family merge blocked: candidate source URL is missing';
  end if;

  select
    coalesce(array_agg(id order by id), '{}'),
    coalesce(jsonb_agg(to_jsonb(candidate_offer) order by id), '[]'::jsonb)
  into candidate_offer_ids, candidate_offers_before
  from public.offers candidate_offer
  where product_id = candidate_id;

  select
    coalesce(array_agg(id order by id), '{}'),
    coalesce(jsonb_agg(to_jsonb(candidate_mapping) order by id), '[]'::jsonb)
  into candidate_mapping_ids, candidate_mappings_before
  from public.retailer_products candidate_mapping
  where product_id = candidate_id;

  select
    count(*),
    coalesce(array_agg(distinct offer_id order by offer_id), '{}')
  into price_history_count, price_history_offer_ids
  from public.price_history
  where offer_id = any(candidate_offer_ids);

  select coalesce(jsonb_agg(to_jsonb(click_row) order by id), '[]'::jsonb)
  into candidate_clicks_before
  from public.outbound_clicks click_row
  where offer_id = any(candidate_offer_ids);

  update public.retailer_products
  set product_id = canonical_id,
      product_variant_id = target_variant_id
  where product_id = candidate_id;

  update public.offers
  set product_id = canonical_id,
      product_variant_id = target_variant_id
  where product_id = candidate_id;

  update public.outbound_clicks
  set product_id = canonical_id
  where offer_id = any(candidate_offer_ids);

  if exists (
    select 1
    from jsonb_array_elements(candidate_clicks_before) snapshot
    left join public.outbound_clicks current_click
      on current_click.id = (snapshot->>'id')::bigint
    where current_click.id is null
       or current_click.product_id is distinct from canonical_id
       or (to_jsonb(current_click) - 'product_id')
          is distinct from (snapshot - 'product_id')
  ) then
    raise exception 'Family merge blocked: outbound click evidence changed unexpectedly';
  end if;

  update public.products
  set merged_into_product_id = canonical_id,
      merged_at = merged_at_value,
      is_active = false
  where id = candidate_id;

  insert into public.product_merge_history (
    canonical_product_id,
    candidate_product_id,
    merged_at,
    offers_moved,
    retailer_products_moved,
    price_history_preserved,
    moved_offer_ids,
    moved_retailer_product_ids,
    candidate_offer_ids,
    price_history_offer_ids,
    snapshot,
    source
  ) values (
    canonical_id,
    candidate_id,
    merged_at_value,
    cardinality(candidate_offer_ids),
    cardinality(candidate_mapping_ids),
    price_history_count,
    candidate_offer_ids,
    candidate_mapping_ids,
    candidate_offer_ids,
    price_history_offer_ids,
    jsonb_build_object(
      'canonical_before_merge', to_jsonb(canonical_product),
      'candidate_before_merge', to_jsonb(candidate_product),
      'candidate_variant_before', to_jsonb(candidate_variant),
      'target_variant', to_jsonb(target_variant),
      'candidate_offer_ids', candidate_offer_ids,
      'candidate_retailer_product_ids', candidate_mapping_ids,
      'candidate_offers_before', candidate_offers_before,
      'candidate_retailer_products_before', candidate_mappings_before,
      'candidate_outbound_clicks_before', candidate_clicks_before,
      'moved_offer_ids', candidate_offer_ids,
      'moved_retailer_product_ids', candidate_mapping_ids,
      'price_history_offer_ids', price_history_offer_ids,
      'price_history_preserved', price_history_count,
      'merged_at', merged_at_value,
      'source', 'admin_family_variant_merge_rpc'
    ),
    'admin_family_variant_merge_rpc'
  ) returning id into merge_history_id;

  return jsonb_build_object(
    'merge_history_id', merge_history_id,
    'canonical_product_id', canonical_id,
    'candidate_product_id', candidate_id,
    'target_variant_id', target_variant_id,
    'merged_at', merged_at_value,
    'offers_moved', cardinality(candidate_offer_ids),
    'retailer_products_moved', cardinality(candidate_mapping_ids),
    'price_history_preserved', price_history_count,
    'redirect_to', '/product/' || canonical_id::text
  );
end;
$family_merge$;

revoke all on function public.merge_product_into_existing_variant(bigint, bigint, bigint)
  from public, anon, authenticated, service_role;
grant execute on function public.merge_product_into_existing_variant(bigint, bigint, bigint)
  to service_role;

comment on function public.merge_product_into_existing_variant(bigint, bigint, bigint) is
  'Guarded family consolidation for a default-only candidate whose mappings and offers have been reviewed to belong to one existing canonical variant.';

commit;
