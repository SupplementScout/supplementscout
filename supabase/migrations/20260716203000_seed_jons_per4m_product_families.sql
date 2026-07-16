begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';

lock table public.products, public.product_variants, public.retailers,
  public.retailer_products, public.offers, public.price_history
  in share row exclusive mode;

create temporary table seed_jons_per4m_products (
  name text not null,
  slug text primary key,
  brand text not null,
  category text not null,
  net_weight_g numeric not null,
  servings integer,
  serving_count_verified integer,
  product_format text not null,
  is_active boolean not null,
  identity_key text not null unique
) on commit drop;

insert into seed_jons_per4m_products (
  name, slug, brand, category, net_weight_g, servings,
  serving_count_verified, product_format, is_active, identity_key
) values
  ('Per4m EAA Xtra 420g', 'per4m-eaa-xtra-420g', 'Per4m', 'Amino Acids', 420, null, null, 'powder', true, 'per4meaaxtra420g'),
  ('Per4m Pre-Workout Stim 570g', 'per4m-pre-workout-stim-570g', 'Per4m', 'Pre Workout', 570, 30, 30, 'powder', true, 'per4mpreworkoutstim570g'),
  ('Per4m Creatine Sherbet 310g', 'per4m-creatine-sherbet-310g', 'Per4m', 'Creatine', 310, 100, 100, 'powder', true, 'per4mcreatinesherbet310g');

create temporary table seed_jons_per4m_variants (
  product_slug text not null references seed_jons_per4m_products(slug),
  variant_key text not null,
  display_name text not null,
  flavour_code text,
  flavour_label text,
  size_value numeric,
  size_unit text,
  pack_count integer,
  product_format text not null,
  is_default boolean not null,
  is_active boolean not null,
  primary key (product_slug, variant_key)
) on commit drop;

insert into seed_jons_per4m_variants (
  product_slug, variant_key, display_name, flavour_code, flavour_label,
  size_value, size_unit, pack_count, product_format, is_default, is_active
) values
  ('per4m-eaa-xtra-420g', 'default', 'Default', null, null, null, null, null, 'powder', true, true),
  ('per4m-eaa-xtra-420g', 'blackberry-420g', 'Blackberry / 420g', 'blackberry', 'Blackberry', 420, 'g', 1, 'powder', false, true),
  ('per4m-eaa-xtra-420g', 'blue-raspberry-420g', 'Blue Raspberry / 420g', 'blue raspberry', 'Blue Raspberry', 420, 'g', 1, 'powder', false, true),
  ('per4m-eaa-xtra-420g', 'cherry-fizz-420g', 'Cherry Fizz / 420g', 'cherry fizz', 'Cherry Fizz', 420, 'g', 1, 'powder', false, true),
  ('per4m-eaa-xtra-420g', 'lemon-lime-splash-420g', 'Lemon Lime Splash / 420g', 'lemon lime splash', 'Lemon Lime Splash', 420, 'g', 1, 'powder', false, true),
  ('per4m-eaa-xtra-420g', 'mango-margarita-420g', 'Mango Margarita / 420g', 'mango margarita', 'Mango Margarita', 420, 'g', 1, 'powder', false, true),
  ('per4m-eaa-xtra-420g', 'passionfruit-420g', 'Passionfruit / 420g', 'passionfruit', 'Passionfruit', 420, 'g', 1, 'powder', false, true),
  ('per4m-eaa-xtra-420g', 'peach-iced-tea-420g', 'Peach Iced Tea / 420g', 'peach iced tea', 'Peach Iced Tea', 420, 'g', 1, 'powder', false, true),
  ('per4m-eaa-xtra-420g', 'rainbow-candy-420g', 'Rainbow Candy / 420g', 'rainbow candy', 'Rainbow Candy', 420, 'g', 1, 'powder', false, true),
  ('per4m-eaa-xtra-420g', 'strawberry-lime-twist-420g', 'Strawberry Lime Twist / 420g', 'strawberry lime twist', 'Strawberry Lime Twist', 420, 'g', 1, 'powder', false, true),
  ('per4m-eaa-xtra-420g', 'tropical-pineapple-420g', 'Tropical Pineapple / 420g', 'tropical pineapple', 'Tropical Pineapple', 420, 'g', 1, 'powder', false, true),
  ('per4m-pre-workout-stim-570g', 'default', 'Default', null, null, null, null, null, 'powder', true, true),
  ('per4m-pre-workout-stim-570g', 'blackberry-570g', 'Blackberry / 570g', 'blackberry', 'Blackberry', 570, 'g', 1, 'powder', false, true),
  ('per4m-pre-workout-stim-570g', 'berry-blast-570g', 'Berry Blast / 570g', 'berry blast', 'Berry Blast', 570, 'g', 1, 'powder', false, true),
  ('per4m-pre-workout-stim-570g', 'cola-bottles-570g', 'Cola Bottles / 570g', 'cola bottles', 'Cola Bottles', 570, 'g', 1, 'powder', false, true),
  ('per4m-pre-workout-stim-570g', 'lemon-sherbet-fizz-570g', 'Lemon Sherbet Fizz / 570g', 'lemon sherbet fizz', 'Lemon Sherbet Fizz', 570, 'g', 1, 'powder', false, true),
  ('per4m-pre-workout-stim-570g', 'orange-and-mango-570g', 'Orange & Mango / 570g', 'orange and mango', 'Orange & Mango', 570, 'g', 1, 'powder', false, true),
  ('per4m-pre-workout-stim-570g', 'passionfruit-570g', 'Passionfruit / 570g', 'passionfruit', 'Passionfruit', 570, 'g', 1, 'powder', false, true),
  ('per4m-pre-workout-stim-570g', 'pink-lemonade-570g', 'Pink Lemonade / 570g', 'pink lemonade', 'Pink Lemonade', 570, 'g', 1, 'powder', false, true),
  ('per4m-pre-workout-stim-570g', 'rainbow-candy-570g', 'Rainbow Candy / 570g', 'rainbow candy', 'Rainbow Candy', 570, 'g', 1, 'powder', false, true),
  ('per4m-pre-workout-stim-570g', 'watermelon-lemonade-570g', 'Watermelon Lemonade / 570g', 'watermelon lemonade', 'Watermelon Lemonade', 570, 'g', 1, 'powder', false, true),
  ('per4m-creatine-sherbet-310g', 'default', 'Default', null, null, null, null, null, 'powder', true, true),
  ('per4m-creatine-sherbet-310g', 'cherry-fizz-310g', 'Cherry Fizz / 310g', 'cherry fizz', 'Cherry Fizz', 310, 'g', 1, 'powder', false, true),
  ('per4m-creatine-sherbet-310g', 'fizzy-bubblegum-bottles-310g', 'Fizzy Bubblegum Bottles / 310g', 'fizzy bubblegum bottles', 'Fizzy Bubblegum Bottles', 310, 'g', 1, 'powder', false, true),
  ('per4m-creatine-sherbet-310g', 'original-sherbet-310g', 'Original Sherbet / 310g', 'original sherbet', 'Original Sherbet', 310, 'g', 1, 'powder', false, true),
  ('per4m-creatine-sherbet-310g', 'peach-sweets-310g', 'Peach Sweets / 310g', 'peach sweets', 'Peach Sweets', 310, 'g', 1, 'powder', false, true),
  ('per4m-creatine-sherbet-310g', 'rainbow-candy-310g', 'Rainbow Candy / 310g', 'rainbow candy', 'Rainbow Candy', 310, 'g', 1, 'powder', false, true);

create temporary table seed_jons_per4m_audit (
  relation_name text primary key,
  before_count bigint not null
) on commit drop;

insert into seed_jons_per4m_audit (relation_name, before_count)
select 'products', count(*) from public.products
union all select 'product_variants', count(*) from public.product_variants
union all select 'retailers', count(*) from public.retailers
union all select 'retailer_products', count(*) from public.retailer_products
union all select 'offers', count(*) from public.offers
union all select 'price_history', count(*) from public.price_history;

create temporary table seed_jons_per4m_state (
  mode text primary key check (mode in ('clean', 'rerun'))
) on commit drop;

do $seed_jons_per4m_precheck$
declare
  v_product_count integer;
  v_variant_count integer;
begin
  if (select count(*) from seed_jons_per4m_products) <> 3
     or (select count(*) from seed_jons_per4m_variants) <> 27
     or (select count(*) from seed_jons_per4m_variants where is_default) <> 3
     or (select count(*) from seed_jons_per4m_variants where not is_default) <> 24 then
    raise exception 'PER4M seed inventory count mismatch';
  end if;

  if exists (
    select 1
    from seed_jons_per4m_products p
    left join seed_jons_per4m_variants v
      on v.product_slug = p.slug and v.is_default
    group by p.slug
    having count(v.*) <> 1
  ) then
    raise exception 'PER4M seed requires exactly one technical default per product';
  end if;

  if exists (
    select 1 from seed_jons_per4m_variants
    where (is_default and (
      variant_key <> 'default' or display_name <> 'Default'
      or flavour_code is not null or flavour_label is not null
      or size_value is not null or size_unit is not null or pack_count is not null
      or product_format <> 'powder' or not is_active
    )) or (not is_default and (
      flavour_code is null or flavour_label is null or size_value is null
      or size_unit <> 'g' or pack_count <> 1
      or product_format <> 'powder' or not is_active
    ))
  ) then
    raise exception 'PER4M seed variant contract mismatch';
  end if;

  if exists (
    select 1
    from seed_jons_per4m_variants a
    join seed_jons_per4m_variants b
      on b.product_slug = a.product_slug
     and b.variant_key > a.variant_key
     and regexp_replace(lower(b.flavour_code), '[^a-z0-9]+', '', 'g')
         = regexp_replace(lower(a.flavour_code), '[^a-z0-9]+', '', 'g')
     and b.size_value is not distinct from a.size_value
     and b.size_unit is not distinct from a.size_unit
     and b.pack_count is not distinct from a.pack_count
  ) then
    raise exception 'PER4M seed contains a normalized flavour identity duplicate';
  end if;

  if exists (
    select 1
    from public.products p
    join seed_jons_per4m_products e on e.slug = p.slug
    where p.name is distinct from e.name
       or p.brand is distinct from e.brand
       or p.category is distinct from e.category
       or p.net_weight_g is distinct from e.net_weight_g
       or p.servings is distinct from e.servings
       or p.serving_count_verified is distinct from e.serving_count_verified
       or p.product_format is distinct from e.product_format
       or p.is_active is distinct from e.is_active
       or p.price is not null or p.retailer is not null or p.image is not null
       or p.description is not null or p.gtin is not null
       or p.merged_into_product_id is not null or p.merged_at is not null
       or p.net_volume_ml is not null or p.serving_size_g is not null
       or p.serving_size_ml is not null or p.protein_per_serving_g is not null
       or p.creatine_per_serving_g is not null or p.unit_count is not null
       or p.unit_type is not null or p.unit_pricing_verified
       or p.nutrition_verified
  ) then
    raise exception 'PER4M canonical product slug collision or field drift';
  end if;

  if exists (
    select 1
    from public.products p
    join seed_jons_per4m_products e
      on regexp_replace(lower(coalesce(p.name, '')), '[^a-z0-9]+', '', 'g') = e.identity_key
     and p.slug <> e.slug
  ) then
    raise exception 'PER4M canonical product normalized identity collision';
  end if;

  if exists (
    select 1
    from public.product_variants v
    join public.products p on p.id = v.product_id
    join seed_jons_per4m_variants e
      on e.product_slug = p.slug and e.variant_key = v.variant_key
    where v.display_name is distinct from e.display_name
       or v.flavour_code is distinct from e.flavour_code
       or v.flavour_label is distinct from e.flavour_label
       or v.size_value is distinct from e.size_value
       or v.size_unit is distinct from e.size_unit
       or v.pack_count is distinct from e.pack_count
       or v.product_format is distinct from e.product_format
       or v.is_default is distinct from e.is_default
       or v.is_active is distinct from e.is_active
       or v.gtin is not null or v.image is not null
       or v.nutrition_override <> '{}'::jsonb
  ) then
    raise exception 'PER4M canonical variant key collision or field drift';
  end if;

  if exists (
    select 1
    from public.product_variants v
    join public.products p on p.id = v.product_id
    join seed_jons_per4m_products ep on ep.slug = p.slug
    left join seed_jons_per4m_variants e
      on e.product_slug = p.slug and e.variant_key = v.variant_key
    where e.variant_key is null and v.is_default
  ) then
    raise exception 'PER4M technical default variant collision';
  end if;

  if exists (
    select 1
    from public.product_variants v
    join public.products p on p.id = v.product_id
    join seed_jons_per4m_variants e
      on e.product_slug = p.slug
     and e.flavour_code is not null
     and regexp_replace(lower(coalesce(v.flavour_code, '')), '[^a-z0-9]+', '', 'g')
         = regexp_replace(lower(e.flavour_code), '[^a-z0-9]+', '', 'g')
     and v.size_value is not distinct from e.size_value
     and v.size_unit is not distinct from e.size_unit
     and v.pack_count is not distinct from e.pack_count
     and v.variant_key <> e.variant_key
  ) then
    raise exception 'PER4M flavour normalization collision';
  end if;

  if exists (
    select 1
    from public.product_variants v
    join public.products p on p.id = v.product_id
    join seed_jons_per4m_products ep on ep.slug = p.slug
    left join seed_jons_per4m_variants e
      on e.product_slug = p.slug and e.variant_key = v.variant_key
    where e.variant_key is null
  ) then
    raise exception 'PER4M partial variant drift';
  end if;

  select count(*) into v_product_count
  from public.products p
  join seed_jons_per4m_products e on e.slug = p.slug;

  select count(*) into v_variant_count
  from public.product_variants v
  join public.products p on p.id = v.product_id
  join seed_jons_per4m_variants e
    on e.product_slug = p.slug and e.variant_key = v.variant_key;

  if v_product_count = 0 and v_variant_count = 0 then
    insert into seed_jons_per4m_state(mode) values ('clean');
  elsif v_product_count = 3 and v_variant_count = 27
        and (select count(*)
             from public.product_variants v
             join public.products p on p.id = v.product_id
             join seed_jons_per4m_products e on e.slug = p.slug) = 27 then
    insert into seed_jons_per4m_state(mode) values ('rerun');
  else
    raise exception 'PER4M partial target state: products %, variants %',
      v_product_count, v_variant_count;
  end if;
end
$seed_jons_per4m_precheck$;

insert into public.products (
  name, slug, brand, category, price, retailer, image, description,
  servings, gtin, merged_into_product_id, merged_at, is_active,
  net_weight_g, serving_count_verified, serving_size_g,
  protein_per_serving_g, creatine_per_serving_g, unit_count, unit_type,
  product_format, unit_pricing_verified, nutrition_verified,
  net_volume_ml, serving_size_ml
)
select p.name, p.slug, p.brand, p.category, null, null, null, null,
  p.servings, null, null, null, p.is_active,
  p.net_weight_g, p.serving_count_verified, null,
  null, null, null, null, p.product_format, false, false, null, null
from seed_jons_per4m_products p
where exists (select 1 from seed_jons_per4m_state where mode = 'clean');

insert into public.product_variants (
  product_id, variant_key, display_name, flavour_code, flavour_label,
  size_value, size_unit, pack_count, product_format, gtin, image,
  nutrition_override, is_active, is_default
)
select p.id, v.variant_key, v.display_name, v.flavour_code, v.flavour_label,
  v.size_value, v.size_unit, v.pack_count, v.product_format, null, null,
  '{}'::jsonb, v.is_active, v.is_default
from seed_jons_per4m_variants v
join public.products p on p.slug = v.product_slug
where exists (select 1 from seed_jons_per4m_state where mode = 'clean');

do $seed_jons_per4m_postcheck$
declare
  v_expected_delta integer;
begin
  select case mode when 'clean' then 1 else 0 end
  into v_expected_delta
  from seed_jons_per4m_state;

  if (select count(*) from public.products p
      join seed_jons_per4m_products e on e.slug = p.slug) <> 3 then
    raise exception 'PER4M product postcondition mismatch';
  end if;

  if (select count(*) from public.product_variants v
      join public.products p on p.id = v.product_id
      join seed_jons_per4m_variants e
        on e.product_slug = p.slug and e.variant_key = v.variant_key) <> 27 then
    raise exception 'PER4M variant postcondition mismatch';
  end if;

  if exists (
    select 1
    from seed_jons_per4m_products p
    join public.products actual on actual.slug = p.slug
    left join public.product_variants v
      on v.product_id = actual.id and v.is_default
    group by p.slug
    having count(v.*) <> 1
  ) then
    raise exception 'PER4M default variant postcondition mismatch';
  end if;

  if (select count(*) from public.products)
       <> (select before_count from seed_jons_per4m_audit where relation_name = 'products')
          + (3 * v_expected_delta)
     or (select count(*) from public.product_variants)
       <> (select before_count from seed_jons_per4m_audit where relation_name = 'product_variants')
          + (27 * v_expected_delta)
     or (select count(*) from public.retailers)
       <> (select before_count from seed_jons_per4m_audit where relation_name = 'retailers')
     or (select count(*) from public.retailer_products)
       <> (select before_count from seed_jons_per4m_audit where relation_name = 'retailer_products')
     or (select count(*) from public.offers)
       <> (select before_count from seed_jons_per4m_audit where relation_name = 'offers')
     or (select count(*) from public.price_history)
       <> (select before_count from seed_jons_per4m_audit where relation_name = 'price_history') then
    raise exception 'PER4M global relation delta mismatch';
  end if;
end
$seed_jons_per4m_postcheck$;

commit;
