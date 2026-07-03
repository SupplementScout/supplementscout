alter table public.product_merge_history
add column if not exists conflict_kept_offer_ids bigint[] not null default '{}',
add column if not exists conflict_deleted_offer_ids bigint[] not null default '{}',
add column if not exists conflict_kept_retailer_product_ids bigint[] not null default '{}',
add column if not exists conflict_deleted_retailer_product_ids bigint[] not null default '{}',
add column if not exists canonical_price_history_before integer not null default 0,
add column if not exists candidate_price_history_before integer not null default 0,
add column if not exists total_price_history_after integer not null default 0,
add column if not exists price_history_reassigned integer not null default 0,
add column if not exists admin_decisions jsonb not null default '{}'::jsonb;

create or replace function public.merge_products_with_decisions(
  canonical_id bigint,
  candidate_id bigint,
  decisions jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  canonical_product public.products%rowtype;
  candidate_product public.products%rowtype;
  locked_count integer;
  canonical_size_value numeric;
  canonical_size_dimension text;
  candidate_size_value numeric;
  candidate_size_dimension text;
  offer_decision record;
  mapping_decision record;
  conflict_count integer;
  decision_count integer;
  reassigned_count integer;
  total_reassigned_count integer := 0;
  deleted_reference_count integer := 0;
  remaining_candidate_offers integer := 0;
  remaining_candidate_mappings integer := 0;
  canonical_price_history_before_value integer := 0;
  candidate_price_history_before_value integer := 0;
  total_price_history_before_value integer := 0;
  total_price_history_after_value integer := 0;
  candidate_offer_ids bigint[] := '{}';
  candidate_retailer_product_ids bigint[] := '{}';
  candidate_price_history_offer_ids bigint[] := '{}';
  moved_offer_ids bigint[] := '{}';
  moved_retailer_product_ids bigint[] := '{}';
  conflict_kept_offer_ids_value bigint[] := '{}';
  conflict_deleted_offer_ids_value bigint[] := '{}';
  conflict_kept_retailer_product_ids_value bigint[] := '{}';
  conflict_deleted_retailer_product_ids_value bigint[] := '{}';
  products_before jsonb := '[]'::jsonb;
  offers_before jsonb := '[]'::jsonb;
  retailer_products_before jsonb := '[]'::jsonb;
  price_history_before jsonb := '[]'::jsonb;
  merged_at_value timestamptz := now();
  merge_history_id bigint;
begin
  if canonical_id is null or candidate_id is null or decisions is null then
    raise exception 'canonical_id, candidate_id, and decisions are required';
  end if;

  if jsonb_typeof(decisions) <> 'object' then
    raise exception 'decisions must be a JSON object';
  end if;

  if canonical_id <= 0 or candidate_id <= 0 then
    raise exception 'canonical_id and candidate_id must be positive integers';
  end if;

  if canonical_id = candidate_id then
    raise exception 'canonical_id and candidate_id must be different';
  end if;

  select count(*)
  into locked_count
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

  perform locked_offer.id
  from (
    select id
    from public.offers
    where product_id in (canonical_id, candidate_id)
    order by id
    for update
  ) locked_offer;

  perform locked_mapping.id
  from (
    select id
    from public.retailer_products
    where product_id in (canonical_id, candidate_id)
    order by id
    for update
  ) locked_mapping;

  perform locked_price_history.id
  from (
    select ph.id
    from public.price_history ph
    join public.offers o
      on o.id = ph.offer_id
    where o.product_id in (canonical_id, candidate_id)
    order by ph.id
    for update of ph
  ) locked_price_history;

  select *
  into canonical_product
  from public.products
  where id = canonical_id;

  select *
  into candidate_product
  from public.products
  where id = candidate_id;

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

  if nullif(btrim(coalesce(canonical_product.gtin, '')), '') is not null
     and nullif(btrim(coalesce(candidate_product.gtin, '')), '') is not null
     and btrim(canonical_product.gtin) <> btrim(candidate_product.gtin) then
    raise exception 'Merge blocked: products have different non-empty GTINs';
  end if;

  if lower(btrim(coalesce(canonical_product.brand, '')))
     <> lower(btrim(coalesce(candidate_product.brand, ''))) then
    raise exception 'Merge blocked: products have different brands';
  end if;

  if lower(btrim(coalesce(canonical_product.category, '')))
     <> lower(btrim(coalesce(candidate_product.category, ''))) then
    raise exception 'Merge blocked: products have different categories';
  end if;

  if canonical_product.servings is not null
     and candidate_product.servings is not null
     and canonical_product.servings <> candidate_product.servings then
    raise exception 'Merge blocked: products have different servings';
  end if;

  select value, dimension
  into canonical_size_value, canonical_size_dimension
  from public.extract_product_size(canonical_product.name)
  limit 1;

  select value, dimension
  into candidate_size_value, candidate_size_dimension
  from public.extract_product_size(candidate_product.name)
  limit 1;

  if canonical_size_value is not null
     and candidate_size_value is not null
     and (
       canonical_size_value <> candidate_size_value
       or canonical_size_dimension <> candidate_size_dimension
     ) then
    raise exception 'Merge blocked: products have different detected sizes';
  end if;

  select coalesce(jsonb_agg(to_jsonb(p) order by p.id), '[]'::jsonb)
  into products_before
  from public.products p
  where p.id in (canonical_id, candidate_id);

  select coalesce(jsonb_agg(to_jsonb(o) order by o.id), '[]'::jsonb)
  into offers_before
  from public.offers o
  where o.product_id in (canonical_id, candidate_id);

  select coalesce(jsonb_agg(to_jsonb(rp) order by rp.id), '[]'::jsonb)
  into retailer_products_before
  from public.retailer_products rp
  where rp.product_id in (canonical_id, candidate_id);

  select coalesce(jsonb_agg(to_jsonb(ph) order by ph.id), '[]'::jsonb)
  into price_history_before
  from public.price_history ph
  join public.offers o
    on o.id = ph.offer_id
  where o.product_id in (canonical_id, candidate_id);

  select coalesce(array_agg(id order by id), '{}')
  into candidate_offer_ids
  from public.offers
  where product_id = candidate_id;

  select coalesce(array_agg(id order by id), '{}')
  into candidate_retailer_product_ids
  from public.retailer_products
  where product_id = candidate_id;

  select count(*)
  into canonical_price_history_before_value
  from public.price_history ph
  join public.offers o
    on o.id = ph.offer_id
  where o.product_id = canonical_id;

  select count(*)
  into candidate_price_history_before_value
  from public.price_history ph
  join public.offers o
    on o.id = ph.offer_id
  where o.product_id = candidate_id;

  total_price_history_before_value :=
    canonical_price_history_before_value + candidate_price_history_before_value;

  select coalesce(array_agg(distinct ph.offer_id order by ph.offer_id), '{}')
  into candidate_price_history_offer_ids
  from public.price_history ph
  join public.offers o
    on o.id = ph.offer_id
  where o.product_id = candidate_id;

  create temporary table if not exists pg_temp.merge_offer_conflicts (
    canonical_offer_id bigint not null,
    candidate_offer_id bigint not null,
    primary key (canonical_offer_id, candidate_offer_id)
  ) on commit drop;

  truncate table pg_temp.merge_offer_conflicts;

  insert into pg_temp.merge_offer_conflicts (
    canonical_offer_id,
    candidate_offer_id
  )
  select canonical_offer.id, candidate_offer.id
  from public.offers candidate_offer
  join public.offers canonical_offer
    on canonical_offer.product_id = canonical_id
   and canonical_offer.retailer_id = candidate_offer.retailer_id
  where candidate_offer.product_id = candidate_id
    and candidate_offer.retailer_id is not null;

  create temporary table if not exists pg_temp.merge_mapping_conflicts (
    canonical_mapping_id bigint not null,
    candidate_mapping_id bigint not null,
    primary key (canonical_mapping_id, candidate_mapping_id)
  ) on commit drop;

  truncate table pg_temp.merge_mapping_conflicts;

  insert into pg_temp.merge_mapping_conflicts (
    canonical_mapping_id,
    candidate_mapping_id
  )
  select canonical_mapping.id, candidate_mapping.id
  from public.retailer_products candidate_mapping
  join public.retailer_products canonical_mapping
    on canonical_mapping.product_id = canonical_id
   and canonical_mapping.retailer_id = candidate_mapping.retailer_id
  where candidate_mapping.product_id = candidate_id;

  if exists (
    select 1
    from pg_temp.merge_offer_conflicts
    group by canonical_offer_id
    having count(*) > 1
  ) then
    raise exception 'Merge blocked: canonical offer appears in multiple conflicts';
  end if;

  if exists (
    select 1
    from pg_temp.merge_offer_conflicts
    group by candidate_offer_id
    having count(*) > 1
  ) then
    raise exception 'Merge blocked: candidate offer appears in multiple conflicts';
  end if;

  if exists (
    select 1
    from pg_temp.merge_mapping_conflicts
    group by canonical_mapping_id
    having count(*) > 1
  ) then
    raise exception 'Merge blocked: canonical retailer_products mapping appears in multiple conflicts';
  end if;

  if exists (
    select 1
    from pg_temp.merge_mapping_conflicts
    group by candidate_mapping_id
    having count(*) > 1
  ) then
    raise exception 'Merge blocked: candidate retailer_products mapping appears in multiple conflicts';
  end if;

  if coalesce(jsonb_typeof(decisions->'offerConflicts'), 'array') <> 'array' then
    raise exception 'offerConflicts must be an array';
  end if;

  if coalesce(jsonb_typeof(decisions->'retailerProductConflicts'), 'array') <> 'array' then
    raise exception 'retailerProductConflicts must be an array';
  end if;

  select count(*)
  into conflict_count
  from pg_temp.merge_offer_conflicts;

  select count(*)
  into decision_count
  from jsonb_array_elements(coalesce(decisions->'offerConflicts', '[]'::jsonb));

  if decision_count <> conflict_count then
    raise exception 'Offer conflict decisions must exactly match detected conflicts';
  end if;

  select count(*)
  into conflict_count
  from pg_temp.merge_mapping_conflicts;

  select count(*)
  into decision_count
  from jsonb_array_elements(coalesce(decisions->'retailerProductConflicts', '[]'::jsonb));

  if decision_count <> conflict_count then
    raise exception 'Retailer product conflict decisions must exactly match detected conflicts';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(coalesce(decisions->'offerConflicts', '[]'::jsonb)) item
    where jsonb_typeof(item) <> 'object'
       or coalesce(item->>'decision', '') not in (
         'keep_canonical',
         'keep_candidate'
       )
       or coalesce(item->>'canonicalOfferId', '') !~ '^[1-9][0-9]*$'
       or coalesce(item->>'candidateOfferId', '') !~ '^[1-9][0-9]*$'
  ) then
    raise exception 'Invalid offer conflict decision';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(coalesce(decisions->'retailerProductConflicts', '[]'::jsonb)) item
    where jsonb_typeof(item) <> 'object'
       or coalesce(item->>'decision', '') not in (
         'keep_canonical',
         'keep_candidate'
       )
       or coalesce(item->>'canonicalMappingId', '') !~ '^[1-9][0-9]*$'
       or coalesce(item->>'candidateMappingId', '') !~ '^[1-9][0-9]*$'
  ) then
    raise exception 'Invalid retailer product conflict decision';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(coalesce(decisions->'offerConflicts', '[]'::jsonb)) item
    left join pg_temp.merge_offer_conflicts conflict
      on conflict.canonical_offer_id = (item->>'canonicalOfferId')::bigint
     and conflict.candidate_offer_id = (item->>'candidateOfferId')::bigint
    where conflict.canonical_offer_id is null
  ) then
    raise exception 'Offer conflict decision does not match a detected conflict';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(coalesce(decisions->'offerConflicts', '[]'::jsonb)) item
    group by (item->>'canonicalOfferId')::bigint, (item->>'candidateOfferId')::bigint
    having count(*) > 1
  ) then
    raise exception 'Duplicate offer conflict decision';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(coalesce(decisions->'retailerProductConflicts', '[]'::jsonb)) item
    left join pg_temp.merge_mapping_conflicts conflict
      on conflict.canonical_mapping_id = (item->>'canonicalMappingId')::bigint
     and conflict.candidate_mapping_id = (item->>'candidateMappingId')::bigint
    where conflict.canonical_mapping_id is null
  ) then
    raise exception 'Retailer product conflict decision does not match a detected conflict';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(coalesce(decisions->'retailerProductConflicts', '[]'::jsonb)) item
    group by (item->>'canonicalMappingId')::bigint, (item->>'candidateMappingId')::bigint
    having count(*) > 1
  ) then
    raise exception 'Duplicate retailer product conflict decision';
  end if;

  create temporary table if not exists pg_temp.merge_deleted_offers (
    offer_id bigint primary key
  ) on commit drop;

  truncate table pg_temp.merge_deleted_offers;

  insert into pg_temp.merge_deleted_offers (offer_id)
  select
    case item->>'decision'
      when 'keep_canonical' then (item->>'candidateOfferId')::bigint
      when 'keep_candidate' then (item->>'canonicalOfferId')::bigint
    end
  from jsonb_array_elements(coalesce(decisions->'offerConflicts', '[]'::jsonb)) item;

  create temporary table if not exists pg_temp.merge_kept_offers (
    offer_id bigint primary key
  ) on commit drop;

  truncate table pg_temp.merge_kept_offers;

  insert into pg_temp.merge_kept_offers (offer_id)
  select id
  from public.offers
  where product_id in (canonical_id, candidate_id)
    and id not in (
      select offer_id
      from pg_temp.merge_deleted_offers
    );

  if exists (
    select 1
    from pg_temp.merge_kept_offers kept
    join public.offers kept_offer
      on kept_offer.id = kept.offer_id
    where kept_offer.retailer_id is null
       or nullif(btrim(coalesce(kept_offer.url, '')), '') is null
  ) then
    raise exception 'Merge blocked: kept offer is missing retailer_id or URL';
  end if;

  if exists (
    select 1
    from pg_temp.merge_kept_offers kept
    join public.offers kept_offer
      on kept_offer.id = kept.offer_id
    join public.offers other_offer
      on other_offer.id <> kept_offer.id
     and other_offer.retailer_id = kept_offer.retailer_id
     and nullif(btrim(coalesce(other_offer.url, '')), '')
       = nullif(btrim(coalesce(kept_offer.url, '')), '')
    where other_offer.id not in (
      select offer_id
      from pg_temp.merge_deleted_offers
    )
  ) then
    raise exception 'Merge blocked: kept offer URL conflicts with another offer';
  end if;

  create temporary table if not exists pg_temp.merge_deleted_mappings (
    mapping_id bigint primary key
  ) on commit drop;

  truncate table pg_temp.merge_deleted_mappings;

  insert into pg_temp.merge_deleted_mappings (mapping_id)
  select
    case item->>'decision'
      when 'keep_canonical' then (item->>'candidateMappingId')::bigint
      when 'keep_candidate' then (item->>'canonicalMappingId')::bigint
    end
  from jsonb_array_elements(coalesce(decisions->'retailerProductConflicts', '[]'::jsonb)) item;

  create temporary table if not exists pg_temp.merge_kept_mappings (
    mapping_id bigint primary key
  ) on commit drop;

  truncate table pg_temp.merge_kept_mappings;

  insert into pg_temp.merge_kept_mappings (mapping_id)
  select id
  from public.retailer_products
  where product_id in (canonical_id, candidate_id)
    and id not in (
      select mapping_id
      from pg_temp.merge_deleted_mappings
    );

  if exists (
    select 1
    from pg_temp.merge_kept_mappings kept
    join public.retailer_products kept_mapping
      on kept_mapping.id = kept.mapping_id
    where nullif(btrim(coalesce(kept_mapping.external_url, '')), '') is null
  ) then
    raise exception 'Merge blocked: kept retailer_products mapping is missing external_url';
  end if;

  if exists (
    select 1
    from pg_temp.merge_kept_mappings kept
    join public.retailer_products kept_mapping
      on kept_mapping.id = kept.mapping_id
    join public.retailer_products other_mapping
      on other_mapping.id <> kept_mapping.id
     and other_mapping.retailer_id = kept_mapping.retailer_id
     and other_mapping.external_url = kept_mapping.external_url
    where other_mapping.id not in (
      select mapping_id
      from pg_temp.merge_deleted_mappings
    )
  ) then
    raise exception 'Merge blocked: kept retailer_products external_url conflicts with another mapping';
  end if;

  for offer_decision in
    select
      (item->>'canonicalOfferId')::bigint as canonical_offer_id,
      (item->>'candidateOfferId')::bigint as candidate_offer_id,
      item->>'decision' as decision
    from jsonb_array_elements(coalesce(decisions->'offerConflicts', '[]'::jsonb)) item
    order by (item->>'canonicalOfferId')::bigint, (item->>'candidateOfferId')::bigint
  loop
    if offer_decision.decision = 'keep_canonical' then
      update public.price_history
      set offer_id = offer_decision.canonical_offer_id
      where offer_id = offer_decision.candidate_offer_id;

      get diagnostics reassigned_count = row_count;
      total_reassigned_count := total_reassigned_count + reassigned_count;

      delete from public.offers
      where id = offer_decision.candidate_offer_id
        and product_id = candidate_id;

      if not found then
        raise exception 'Candidate offer % could not be deleted',
          offer_decision.candidate_offer_id;
      end if;

      conflict_kept_offer_ids_value := array_append(
        conflict_kept_offer_ids_value,
        offer_decision.canonical_offer_id
      );
      conflict_deleted_offer_ids_value := array_append(
        conflict_deleted_offer_ids_value,
        offer_decision.candidate_offer_id
      );
    elsif offer_decision.decision = 'keep_candidate' then
      update public.price_history
      set offer_id = offer_decision.candidate_offer_id
      where offer_id = offer_decision.canonical_offer_id;

      get diagnostics reassigned_count = row_count;
      total_reassigned_count := total_reassigned_count + reassigned_count;

      delete from public.offers
      where id = offer_decision.canonical_offer_id
        and product_id = canonical_id;

      if not found then
        raise exception 'Canonical offer % could not be deleted',
          offer_decision.canonical_offer_id;
      end if;

      update public.offers
      set product_id = canonical_id
      where id = offer_decision.candidate_offer_id
        and product_id = candidate_id;

      if not found then
        raise exception 'Candidate offer % could not be moved',
          offer_decision.candidate_offer_id;
      end if;

      moved_offer_ids := array_append(moved_offer_ids, offer_decision.candidate_offer_id);
      conflict_kept_offer_ids_value := array_append(
        conflict_kept_offer_ids_value,
        offer_decision.candidate_offer_id
      );
      conflict_deleted_offer_ids_value := array_append(
        conflict_deleted_offer_ids_value,
        offer_decision.canonical_offer_id
      );
    end if;
  end loop;

  with moved_non_conflicting_offers as (
    update public.offers
    set product_id = canonical_id
    where product_id = candidate_id
      and id not in (
        select candidate_offer_id
        from pg_temp.merge_offer_conflicts
      )
    returning id
  )
  select coalesce(array_agg(id order by id), '{}')
  into moved_offer_ids
  from (
    select unnest(moved_offer_ids) as id
    union all
    select id from moved_non_conflicting_offers
  ) moved_offer_list;

  if exists (
    select 1
    from public.price_history
    where offer_id = any(conflict_deleted_offer_ids_value)
  ) then
    raise exception 'Merge blocked: price_history still references deleted offers';
  end if;

  for mapping_decision in
    select
      (item->>'canonicalMappingId')::bigint as canonical_mapping_id,
      (item->>'candidateMappingId')::bigint as candidate_mapping_id,
      item->>'decision' as decision
    from jsonb_array_elements(coalesce(decisions->'retailerProductConflicts', '[]'::jsonb)) item
    order by (item->>'canonicalMappingId')::bigint, (item->>'candidateMappingId')::bigint
  loop
    if mapping_decision.decision = 'keep_canonical' then
      delete from public.retailer_products
      where id = mapping_decision.candidate_mapping_id
        and product_id = candidate_id;

      if not found then
        raise exception 'Candidate retailer_products mapping % could not be deleted',
          mapping_decision.candidate_mapping_id;
      end if;

      conflict_kept_retailer_product_ids_value := array_append(
        conflict_kept_retailer_product_ids_value,
        mapping_decision.canonical_mapping_id
      );
      conflict_deleted_retailer_product_ids_value := array_append(
        conflict_deleted_retailer_product_ids_value,
        mapping_decision.candidate_mapping_id
      );
    elsif mapping_decision.decision = 'keep_candidate' then
      delete from public.retailer_products
      where id = mapping_decision.canonical_mapping_id
        and product_id = canonical_id;

      if not found then
        raise exception 'Canonical retailer_products mapping % could not be deleted',
          mapping_decision.canonical_mapping_id;
      end if;

      update public.retailer_products
      set product_id = canonical_id
      where id = mapping_decision.candidate_mapping_id
        and product_id = candidate_id;

      if not found then
        raise exception 'Candidate retailer_products mapping % could not be moved',
          mapping_decision.candidate_mapping_id;
      end if;

      moved_retailer_product_ids := array_append(
        moved_retailer_product_ids,
        mapping_decision.candidate_mapping_id
      );
      conflict_kept_retailer_product_ids_value := array_append(
        conflict_kept_retailer_product_ids_value,
        mapping_decision.candidate_mapping_id
      );
      conflict_deleted_retailer_product_ids_value := array_append(
        conflict_deleted_retailer_product_ids_value,
        mapping_decision.canonical_mapping_id
      );
    end if;
  end loop;

  with moved_non_conflicting_mappings as (
    update public.retailer_products
    set product_id = canonical_id
    where product_id = candidate_id
      and id not in (
        select candidate_mapping_id
        from pg_temp.merge_mapping_conflicts
      )
    returning id
  )
  select coalesce(array_agg(id order by id), '{}')
  into moved_retailer_product_ids
  from (
    select unnest(moved_retailer_product_ids) as id
    union all
    select id from moved_non_conflicting_mappings
  ) moved_mapping_list;

  select count(*)
  into deleted_reference_count
  from public.price_history
  where offer_id = any(conflict_deleted_offer_ids_value);

  if deleted_reference_count <> 0 then
    raise exception 'Merge blocked: deleted offers still have price_history references';
  end if;

  select count(*)
  into total_price_history_after_value
  from public.price_history ph
  join public.offers o
    on o.id = ph.offer_id
  where o.product_id = canonical_id;

  if total_price_history_after_value <> total_price_history_before_value then
    raise exception 'Merge blocked: price_history count changed during merge';
  end if;

  select count(*)
  into remaining_candidate_offers
  from public.offers
  where product_id = candidate_id;

  if remaining_candidate_offers <> 0 then
    raise exception 'Merge blocked: candidate product still has offers';
  end if;

  select count(*)
  into remaining_candidate_mappings
  from public.retailer_products
  where product_id = candidate_id;

  if remaining_candidate_mappings <> 0 then
    raise exception 'Merge blocked: candidate product still has retailer_products';
  end if;

  update public.products
  set
    merged_into_product_id = canonical_id,
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
    source,
    conflict_kept_offer_ids,
    conflict_deleted_offer_ids,
    conflict_kept_retailer_product_ids,
    conflict_deleted_retailer_product_ids,
    canonical_price_history_before,
    candidate_price_history_before,
    total_price_history_after,
    price_history_reassigned,
    admin_decisions
  )
  values (
    canonical_id,
    candidate_id,
    merged_at_value,
    cardinality(moved_offer_ids),
    cardinality(moved_retailer_product_ids),
    candidate_price_history_before_value,
    moved_offer_ids,
    moved_retailer_product_ids,
    candidate_offer_ids,
    candidate_price_history_offer_ids,
    jsonb_build_object(
      'products_before', products_before,
      'offers_before', offers_before,
      'retailer_products_before', retailer_products_before,
      'price_history_before', price_history_before,
      'canonical_price_history_before', canonical_price_history_before_value,
      'candidate_price_history_before', candidate_price_history_before_value,
      'total_price_history_before', total_price_history_before_value,
      'total_price_history_after', total_price_history_after_value,
      'offer_conflicts', (
        select coalesce(jsonb_agg(to_jsonb(c) order by c.canonical_offer_id, c.candidate_offer_id), '[]'::jsonb)
        from pg_temp.merge_offer_conflicts c
      ),
      'retailer_product_conflicts', (
        select coalesce(jsonb_agg(to_jsonb(c) order by c.canonical_mapping_id, c.candidate_mapping_id), '[]'::jsonb)
        from pg_temp.merge_mapping_conflicts c
      ),
      'admin_decisions', decisions,
      'conflict_kept_offer_ids', conflict_kept_offer_ids_value,
      'conflict_deleted_offer_ids', conflict_deleted_offer_ids_value,
      'conflict_kept_retailer_product_ids', conflict_kept_retailer_product_ids_value,
      'conflict_deleted_retailer_product_ids', conflict_deleted_retailer_product_ids_value,
      'price_history_reassigned', total_reassigned_count,
      'merged_at', merged_at_value,
      'source', 'admin_merge_rpc_with_decisions'
    ),
    'admin_merge_rpc_with_decisions',
    conflict_kept_offer_ids_value,
    conflict_deleted_offer_ids_value,
    conflict_kept_retailer_product_ids_value,
    conflict_deleted_retailer_product_ids_value,
    canonical_price_history_before_value,
    candidate_price_history_before_value,
    total_price_history_after_value,
    total_reassigned_count,
    decisions
  )
  returning id into merge_history_id;

  return jsonb_build_object(
    'merge_history_id', merge_history_id,
    'canonical_product_id', canonical_id,
    'candidate_product_id', candidate_id,
    'merged_at', merged_at_value,
    'offers_moved', cardinality(moved_offer_ids),
    'retailer_products_moved', cardinality(moved_retailer_product_ids),
    'conflict_kept_offer_ids', conflict_kept_offer_ids_value,
    'conflict_deleted_offer_ids', conflict_deleted_offer_ids_value,
    'conflict_kept_retailer_product_ids', conflict_kept_retailer_product_ids_value,
    'conflict_deleted_retailer_product_ids', conflict_deleted_retailer_product_ids_value,
    'canonical_price_history_before', canonical_price_history_before_value,
    'candidate_price_history_before', candidate_price_history_before_value,
    'total_price_history_after', total_price_history_after_value,
    'price_history_reassigned', total_reassigned_count
  );
end;
$$;

revoke all on function public.merge_products_with_decisions(bigint, bigint, jsonb)
from public, anon, authenticated, service_role;

grant execute on function public.merge_products_with_decisions(bigint, bigint, jsonb)
to service_role;
