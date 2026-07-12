alter table public.products
add column if not exists net_volume_ml numeric,
add column if not exists serving_size_ml numeric;

alter table public.products
add constraint products_net_volume_ml_positive
check (
  net_volume_ml is null
  or (
    net_volume_ml::text <> 'NaN'
    and net_volume_ml > 0
  )
),
add constraint products_serving_size_ml_positive
check (
  serving_size_ml is null
  or (
    serving_size_ml::text <> 'NaN'
    and serving_size_ml > 0
  )
);
