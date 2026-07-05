-- Manual template for verifying one product's normalized net weight.
-- Replace the placeholder values after checking an authoritative retailer or manufacturer source.
-- Do not update serving, nutrition, protein, or creatine fields with this template.

begin;

select
  id,
  name,
  net_weight_g,
  product_format,
  unit_pricing_verified
from public.products
where id = '<product id>';

update public.products
set
  net_weight_g = <verified net weight in grams>,
  product_format = '<powder | food | bar | capsule | tablet | gummy | liquid | sachet | accessory | clothing | other>',
  unit_pricing_verified = true
where id = '<product id>';

select
  id,
  name,
  net_weight_g,
  product_format,
  unit_pricing_verified
from public.products
where id = '<product id>';

-- Use commit only after reviewing the before/after rows.
-- commit;
rollback;
