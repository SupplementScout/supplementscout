-- Manual template for verifying one product's serving count.
-- Replace the placeholder values after checking an authoritative retailer or manufacturer source.
-- Do not update legacy products.servings or any nutrition/weight fields with this template.

begin;

select
  id,
  name,
  servings as legacy_servings,
  serving_count_verified,
  unit_pricing_verified
from public.products
where id = '<product id>';

update public.products
set
  serving_count_verified = <verified serving count>,
  unit_pricing_verified = true
where id = '<product id>';

select
  id,
  name,
  servings as legacy_servings,
  serving_count_verified,
  unit_pricing_verified
from public.products
where id = '<product id>';

-- Use commit only after reviewing the before/after rows.
-- commit;
rollback;
