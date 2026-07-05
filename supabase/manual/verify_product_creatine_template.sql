-- Manual template for verifying one product's actual creatine per serving.
-- Replace the placeholder values after checking an authoritative retailer or manufacturer source.
-- Do not update legacy servings, weight, protein, format, or offer data with this template.

begin;

select
  id,
  name,
  servings as legacy_servings,
  serving_count_verified,
  creatine_per_serving_g,
  unit_pricing_verified,
  nutrition_verified
from public.products
where id = '<product id>';

update public.products
set
  serving_count_verified = <verified serving count>,
  creatine_per_serving_g = <verified creatine per serving in grams>,
  unit_pricing_verified = true,
  nutrition_verified = true
where id = '<product id>';

select
  id,
  name,
  servings as legacy_servings,
  serving_count_verified,
  creatine_per_serving_g,
  unit_pricing_verified,
  nutrition_verified
from public.products
where id = '<product id>';

-- Use commit only after reviewing the before/after rows.
-- commit;
rollback;
