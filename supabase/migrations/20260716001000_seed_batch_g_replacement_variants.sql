begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';

lock table public.products, public.product_variants, public.retailer_products, public.offers, public.price_history in share row exclusive mode;

do $seed_batch_g_replacement_variants$
declare
  v_expected constant jsonb := $batch_g_replacement_variants$
  [
    {
      "product_id": 337,
      "variant_key": "banana-600g",
      "display_name": "Banana / 600g",
      "flavour_code": "banana",
      "flavour_label": "Banana",
      "size_value": 600,
      "size_unit": "g",
      "pack_count": 1,
      "product_format": "powder",
      "is_default": false,
      "is_active": true
    },
    {
      "product_id": 337,
      "variant_key": "strawberry-600g",
      "display_name": "Strawberry / 600g",
      "flavour_code": "strawberry",
      "flavour_label": "Strawberry",
      "size_value": 600,
      "size_unit": "g",
      "pack_count": 1,
      "product_format": "powder",
      "is_default": false,
      "is_active": true
    }
  ]
  $batch_g_replacement_variants$::jsonb;
  v_before_products integer;
  v_before_variants integer;
  v_before_mappings integer;
  v_before_offers integer;
  v_before_history integer;
  v_after_products integer;
  v_after_variants integer;
  v_after_mappings integer;
  v_after_offers integer;
  v_after_history integer;
  v_missing integer;
  v_inserted integer;
begin
  if jsonb_typeof(v_expected) is distinct from 'array'
     or jsonb_array_length(v_expected) is distinct from 2 then
    raise exception 'Batch G replacement variant seed blocked: expected inventory must contain exactly 2 variants';
  end if;

  if exists (
       select 1
       from jsonb_to_recordset(v_expected) as e(
         product_id bigint, variant_key text, display_name text, flavour_code text,
         flavour_label text, size_value numeric, size_unit text, pack_count integer,
         product_format text, is_default boolean, is_active boolean
       )
       where e.product_id is distinct from 337
          or e.variant_key not in ('banana-600g', 'strawberry-600g')
          or e.display_name not in ('Banana / 600g', 'Strawberry / 600g')
          or e.flavour_code not in ('banana', 'strawberry')
          or e.flavour_label not in ('Banana', 'Strawberry')
          or e.size_value is distinct from 600
          or e.size_unit is distinct from 'g'
          or e.pack_count is distinct from 1
          or e.product_format is distinct from 'powder'
          or e.is_default is distinct from false
          or e.is_active is distinct from true
     )
     or exists (
       select 1
       from jsonb_to_recordset(v_expected) as e(product_id bigint, variant_key text)
       group by e.product_id, e.variant_key
       having count(*) <> 1
     )
     or exists (
       select 1
       from jsonb_to_recordset(v_expected) as e(
         product_id bigint, flavour_code text, size_value numeric, size_unit text,
         pack_count integer, product_format text
       )
       group by e.product_id, e.flavour_code, e.size_value, e.size_unit,
                e.pack_count, e.product_format
       having count(*) <> 1
     ) then
    raise exception 'Batch G replacement variant seed blocked: expected inventory contract is invalid';
  end if;

  perform 1
  from public.products
  where id = 337
  for update;

  if exists (
    select 1
    from public.products p
    where p.id = 337
      and (
        p.name is distinct from 'GYM HIGH Whey Pro Synergy 600g'
        or p.slug is distinct from 'gym-high-whey-pro-synergy-600g'
        or p.brand is distinct from 'GYM HIGH'
        or p.category is distinct from 'Whey Protein'
        or p.net_weight_g is distinct from 600
        or p.product_format is distinct from 'powder'
        or p.is_active is distinct from true
        or p.merged_into_product_id is not null
        or p.merged_at is not null
      )
  ) or not exists (select 1 from public.products where id = 337) then
    raise exception 'Batch G replacement variant seed blocked: canonical product identity or lifecycle changed';
  end if;

  if not exists (
    select 1
    from public.product_variants v
    where v.id = 333
      and v.product_id = 337
      and v.variant_key = 'default'
      and v.is_default is true
      and v.is_active is true
  ) then
    raise exception 'Batch G replacement variant seed blocked: default variant identity changed';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(v_expected) as e(
      product_id bigint, variant_key text, display_name text, flavour_code text,
      flavour_label text, size_value numeric, size_unit text, pack_count integer,
      product_format text, is_default boolean, is_active boolean
    )
    join public.product_variants v
      on v.product_id = e.product_id and v.variant_key = e.variant_key
    where v.display_name is distinct from e.display_name
       or v.flavour_code is distinct from e.flavour_code
       or v.flavour_label is distinct from e.flavour_label
       or v.size_value is distinct from e.size_value
       or v.size_unit is distinct from e.size_unit
       or v.pack_count is distinct from e.pack_count
       or v.product_format is distinct from e.product_format
       or v.gtin is not null
       or v.image is not null
       or v.nutrition_override is distinct from '{}'::jsonb
       or v.is_default is distinct from e.is_default
       or v.is_active is distinct from e.is_active
  ) then
    raise exception 'Batch G replacement variant seed blocked: expected variant key has drifted values';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(v_expected) as e(
      product_id bigint, variant_key text, flavour_code text, size_value numeric,
      size_unit text, pack_count integer, product_format text
    )
    join public.product_variants v
      on v.product_id is not distinct from e.product_id
     and v.flavour_code is not distinct from e.flavour_code
     and v.size_value is not distinct from e.size_value
     and v.size_unit is not distinct from e.size_unit
     and v.pack_count is not distinct from e.pack_count
     and v.product_format is not distinct from e.product_format
    where v.variant_key is distinct from e.variant_key
  ) then
    raise exception 'Batch G replacement variant seed blocked: semantic duplicate exists under another key';
  end if;

  select count(*) into v_before_products from public.products;
  select count(*) into v_before_variants from public.product_variants;
  select count(*) into v_before_mappings from public.retailer_products;
  select count(*) into v_before_offers from public.offers;
  select count(*) into v_before_history from public.price_history;

  select count(*) into v_missing
  from jsonb_to_recordset(v_expected) as e(product_id bigint, variant_key text)
  where not exists (
    select 1 from public.product_variants v
    where v.product_id = e.product_id and v.variant_key = e.variant_key
  );

  insert into public.product_variants (
    product_id, variant_key, display_name, flavour_code, flavour_label,
    size_value, size_unit, pack_count, product_format, gtin, image,
    nutrition_override, is_default, is_active
  )
  select
    e.product_id, e.variant_key, e.display_name, e.flavour_code, e.flavour_label,
    e.size_value, e.size_unit, e.pack_count, e.product_format, null, null,
    '{}'::jsonb, e.is_default, e.is_active
  from jsonb_to_recordset(v_expected) as e(
    product_id bigint, variant_key text, display_name text, flavour_code text,
    flavour_label text, size_value numeric, size_unit text, pack_count integer,
    product_format text, is_default boolean, is_active boolean
  )
  where not exists (
    select 1 from public.product_variants v
    where v.product_id = e.product_id and v.variant_key = e.variant_key
  )
  order by e.variant_key;

  get diagnostics v_inserted = row_count;

  select count(*) into v_after_products from public.products;
  select count(*) into v_after_variants from public.product_variants;
  select count(*) into v_after_mappings from public.retailer_products;
  select count(*) into v_after_offers from public.offers;
  select count(*) into v_after_history from public.price_history;

  if v_inserted is distinct from v_missing
     or v_after_variants is distinct from v_before_variants + v_inserted
     or v_after_products is distinct from v_before_products
     or v_after_mappings is distinct from v_before_mappings
     or v_after_offers is distinct from v_before_offers
     or v_after_history is distinct from v_before_history then
    raise exception 'Batch G replacement variant seed failed: unexpected table delta';
  end if;

  if (select count(*)
      from jsonb_to_recordset(v_expected) as e(product_id bigint, variant_key text)
      join public.product_variants v
        on v.product_id = e.product_id and v.variant_key = e.variant_key) is distinct from 2
     or (select count(*)
         from public.product_variants
         where product_id = 337
           and variant_key in ('banana-600g', 'strawberry-600g')
           and is_default is false
           and is_active is true
           and pack_count = 1
           and product_format = 'powder') is distinct from 2 then
    raise exception 'Batch G replacement variant seed failed: final target inventory is not exactly 2 variants';
  end if;
end;
$seed_batch_g_replacement_variants$;

commit;
