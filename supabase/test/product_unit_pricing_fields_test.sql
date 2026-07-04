-- Verification script for 20260704_add_product_unit_pricing_fields.sql.
-- Run only against a disposable/test database after applying the migration.
-- The transaction rolls back all inserted rows.

begin;

do $$
declare
  expected_columns jsonb := '{
    "net_weight_g": "numeric",
    "serving_count_verified": "integer",
    "serving_size_g": "numeric",
    "protein_per_serving_g": "numeric",
    "creatine_per_serving_g": "numeric",
    "unit_count": "integer",
    "unit_type": "text",
    "product_format": "text",
    "unit_pricing_verified": "boolean",
    "nutrition_verified": "boolean"
  }'::jsonb;
  column_name_value text;
  data_type_value text;
begin
  for column_name_value, data_type_value in
    select key, value #>> '{}'
    from jsonb_each(expected_columns)
  loop
    if not exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'products'
        and column_name = column_name_value
        and data_type = data_type_value
    ) then
      raise exception 'Missing or incorrect column type: % expected %',
        column_name_value,
        data_type_value;
    end if;
  end loop;

  raise notice 'Column existence and type checks passed.';
end;
$$;

insert into public.products (
  name,
  slug,
  brand,
  category,
  servings,
  net_weight_g,
  serving_count_verified,
  serving_size_g,
  protein_per_serving_g,
  creatine_per_serving_g,
  unit_count,
  unit_type,
  product_format,
  unit_pricing_verified,
  nutrition_verified
)
values (
  'UNIT PRICING FOUNDATION TEST Valid Product',
  'unit-pricing-foundation-test-valid-product',
  'Unit Pricing Test',
  'Protein',
  30,
  1000.5,
  30,
  33.35,
  25.5,
  0.5,
  30,
  'serving',
  'powder',
  true,
  false
);

insert into public.products (
  name,
  slug,
  brand,
  category,
  servings,
  net_weight_g,
  serving_count_verified,
  serving_size_g,
  protein_per_serving_g,
  creatine_per_serving_g,
  unit_count,
  unit_type,
  product_format
)
values (
  'UNIT PRICING FOUNDATION TEST Null Product',
  'unit-pricing-foundation-test-null-product',
  'Unit Pricing Test',
  'Other',
  12,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null
);

insert into public.products (
  name,
  slug,
  brand,
  category,
  serving_size_g,
  protein_per_serving_g,
  creatine_per_serving_g,
  unit_pricing_verified,
  nutrition_verified
)
values (
  'UNIT PRICING FOUNDATION TEST Equal Values Product',
  'unit-pricing-foundation-test-equal-values-product',
  'Unit Pricing Test',
  'Creatine',
  5.5,
  5.5,
  5.5,
  false,
  true
);

do $$
declare
  flags record;
begin
  select unit_pricing_verified, nutrition_verified
  into flags
  from public.products
  where slug = 'unit-pricing-foundation-test-null-product';

  if flags.unit_pricing_verified is not false
     or flags.nutrition_verified is not false then
    raise exception 'Verification flags must default to false';
  end if;
end;
$$;

do $$
begin
  begin
    insert into public.products (name, slug, net_weight_g)
    values ('UNIT PRICING FOUNDATION TEST Bad Weight Zero', 'unit-pricing-foundation-test-bad-weight-zero', 0);
    raise exception 'Expected net_weight_g = 0 to fail';
  exception
    when check_violation then null;
  end;

  begin
    insert into public.products (name, slug, net_weight_g)
    values ('UNIT PRICING FOUNDATION TEST Bad Weight Negative', 'unit-pricing-foundation-test-bad-weight-negative', -1);
    raise exception 'Expected negative net_weight_g to fail';
  exception
    when check_violation then null;
  end;

  begin
    insert into public.products (name, slug, net_weight_g)
    values ('UNIT PRICING FOUNDATION TEST Bad Weight NaN', 'unit-pricing-foundation-test-bad-weight-nan', 'NaN'::numeric);
    raise exception 'Expected NaN net_weight_g to fail';
  exception
    when check_violation then null;
  end;

  begin
    insert into public.products (name, slug, serving_size_g)
    values ('UNIT PRICING FOUNDATION TEST Bad Serving Size NaN', 'unit-pricing-foundation-test-bad-serving-size-nan', 'NaN'::numeric);
    raise exception 'Expected NaN serving_size_g to fail';
  exception
    when check_violation then null;
  end;

  begin
    insert into public.products (name, slug, protein_per_serving_g)
    values ('UNIT PRICING FOUNDATION TEST Bad Protein NaN', 'unit-pricing-foundation-test-bad-protein-nan', 'NaN'::numeric);
    raise exception 'Expected NaN protein_per_serving_g to fail';
  exception
    when check_violation then null;
  end;

  begin
    insert into public.products (name, slug, creatine_per_serving_g)
    values ('UNIT PRICING FOUNDATION TEST Bad Creatine NaN', 'unit-pricing-foundation-test-bad-creatine-nan', 'NaN'::numeric);
    raise exception 'Expected NaN creatine_per_serving_g to fail';
  exception
    when check_violation then null;
  end;

  begin
    insert into public.products (name, slug, serving_count_verified)
    values ('UNIT PRICING FOUNDATION TEST Bad Servings Zero', 'unit-pricing-foundation-test-bad-servings-zero', 0);
    raise exception 'Expected serving_count_verified = 0 to fail';
  exception
    when check_violation then null;
  end;

  begin
    insert into public.products (name, slug, serving_count_verified)
    values ('UNIT PRICING FOUNDATION TEST Bad Servings Negative', 'unit-pricing-foundation-test-bad-servings-negative', -1);
    raise exception 'Expected negative serving_count_verified to fail';
  exception
    when check_violation then null;
  end;

  begin
    insert into public.products (name, slug, serving_count_verified)
    values ('UNIT PRICING FOUNDATION TEST Bad Servings Decimal', 'unit-pricing-foundation-test-bad-servings-decimal', '1.5');
    raise exception 'Expected decimal serving_count_verified to fail';
  exception
    when invalid_text_representation then null;
  end;

  begin
    insert into public.products (name, slug, unit_count)
    values ('UNIT PRICING FOUNDATION TEST Bad Unit Count Zero', 'unit-pricing-foundation-test-bad-unit-count-zero', 0);
    raise exception 'Expected unit_count = 0 to fail';
  exception
    when check_violation then null;
  end;

  begin
    insert into public.products (name, slug, unit_count)
    values ('UNIT PRICING FOUNDATION TEST Bad Unit Count Negative', 'unit-pricing-foundation-test-bad-unit-count-negative', -1);
    raise exception 'Expected negative unit_count to fail';
  exception
    when check_violation then null;
  end;

  begin
    insert into public.products (name, slug, unit_count)
    values ('UNIT PRICING FOUNDATION TEST Bad Unit Count Decimal', 'unit-pricing-foundation-test-bad-unit-count-decimal', '1.5');
    raise exception 'Expected decimal unit_count to fail';
  exception
    when invalid_text_representation then null;
  end;

  begin
    insert into public.products (name, slug, serving_size_g)
    values ('UNIT PRICING FOUNDATION TEST Bad Serving Size Negative', 'unit-pricing-foundation-test-bad-serving-size-negative', -5);
    raise exception 'Expected negative serving_size_g to fail';
  exception
    when check_violation then null;
  end;

  begin
    insert into public.products (name, slug, protein_per_serving_g)
    values ('UNIT PRICING FOUNDATION TEST Bad Protein Negative', 'unit-pricing-foundation-test-bad-protein-negative', -1);
    raise exception 'Expected negative protein_per_serving_g to fail';
  exception
    when check_violation then null;
  end;

  begin
    insert into public.products (name, slug, creatine_per_serving_g)
    values ('UNIT PRICING FOUNDATION TEST Bad Creatine Negative', 'unit-pricing-foundation-test-bad-creatine-negative', -1);
    raise exception 'Expected negative creatine_per_serving_g to fail';
  exception
    when check_violation then null;
  end;

  begin
    insert into public.products (name, slug, serving_size_g, protein_per_serving_g)
    values ('UNIT PRICING FOUNDATION TEST Protein Too High', 'unit-pricing-foundation-test-protein-too-high', 20, 21);
    raise exception 'Expected protein above serving size to fail';
  exception
    when check_violation then null;
  end;

  begin
    insert into public.products (name, slug, serving_size_g, creatine_per_serving_g)
    values ('UNIT PRICING FOUNDATION TEST Creatine Too High', 'unit-pricing-foundation-test-creatine-too-high', 5, 6);
    raise exception 'Expected creatine above serving size to fail';
  exception
    when check_violation then null;
  end;

  raise notice 'Constraint rejection checks passed.';
end;
$$;

do $$
begin
  if exists (
    select 1
    from public.products
    where (
      net_weight_g is not null
      and (net_weight_g::text = 'NaN' or net_weight_g <= 0)
    ) or (
      serving_count_verified is not null and serving_count_verified <= 0
    ) or (
      serving_size_g is not null
      and (serving_size_g::text = 'NaN' or serving_size_g <= 0)
    ) or (
      protein_per_serving_g is not null
      and (protein_per_serving_g::text = 'NaN' or protein_per_serving_g < 0)
    ) or (
      creatine_per_serving_g is not null
      and (creatine_per_serving_g::text = 'NaN' or creatine_per_serving_g < 0)
    ) or (
      unit_count is not null and unit_count <= 0
    ) or (
      protein_per_serving_g is not null
      and serving_size_g is not null
      and protein_per_serving_g > serving_size_g
    ) or (
      creatine_per_serving_g is not null
      and serving_size_g is not null
      and creatine_per_serving_g > serving_size_g
    )
  ) then
    raise exception 'Existing product rows violate unit pricing constraints';
  end if;

  raise notice 'Existing-row validity checks passed.';
end;
$$;

do $$
begin
  raise notice 'UNIT PRICING FOUNDATION VERIFICATION PASSED. Rolling back test rows now.';
end;
$$;

rollback;
