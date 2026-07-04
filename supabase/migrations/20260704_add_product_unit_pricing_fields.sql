alter table public.products
add column if not exists net_weight_g numeric,
add column if not exists serving_count_verified integer,
add column if not exists serving_size_g numeric,
add column if not exists protein_per_serving_g numeric,
add column if not exists creatine_per_serving_g numeric,
add column if not exists unit_count integer,
add column if not exists unit_type text,
add column if not exists product_format text,
add column if not exists unit_pricing_verified boolean not null default false,
add column if not exists nutrition_verified boolean not null default false;

alter table public.products
add constraint products_net_weight_g_positive
check (
  net_weight_g is null
  or (
    net_weight_g::text <> 'NaN'
    and net_weight_g > 0
  )
),
add constraint products_serving_count_verified_positive
check (
  serving_count_verified is null
  or serving_count_verified > 0
),
add constraint products_serving_size_g_positive
check (
  serving_size_g is null
  or (
    serving_size_g::text <> 'NaN'
    and serving_size_g > 0
  )
),
add constraint products_protein_per_serving_g_non_negative
check (
  protein_per_serving_g is null
  or (
    protein_per_serving_g::text <> 'NaN'
    and protein_per_serving_g >= 0
  )
),
add constraint products_creatine_per_serving_g_non_negative
check (
  creatine_per_serving_g is null
  or (
    creatine_per_serving_g::text <> 'NaN'
    and creatine_per_serving_g >= 0
  )
),
add constraint products_unit_count_positive
check (unit_count is null or unit_count > 0),
add constraint products_protein_not_above_serving_size
check (
  protein_per_serving_g is null
  or serving_size_g is null
  or protein_per_serving_g <= serving_size_g
),
add constraint products_creatine_not_above_serving_size
check (
  creatine_per_serving_g is null
  or serving_size_g is null
  or creatine_per_serving_g <= serving_size_g
);
