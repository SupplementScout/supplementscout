begin;

do $seed_discount_supplements_batch_b_variants$
declare
  v_expected constant jsonb := $batch_b_inventory$
  [
    {"product_id":481,"variant_key":"blue-razz-500g","display_name":"Blue Razz / 500g","flavour_code":"blue razz","flavour_label":"Blue Razz","size_value":500,"size_unit":"g","pack_count":1,"product_format":"powder","is_default":false,"is_active":true},
    {"product_id":481,"variant_key":"red-hawaiian-500g","display_name":"Red Hawaiian / 500g","flavour_code":"red hawaiian","flavour_label":"Red Hawaiian","size_value":500,"size_unit":"g","pack_count":1,"product_format":"powder","is_default":false,"is_active":true},
    {"product_id":481,"variant_key":"slush-puppie-500g","display_name":"Slush Puppie / 500g","flavour_code":"slush puppie","flavour_label":"Slush Puppie","size_value":500,"size_unit":"g","pack_count":1,"product_format":"powder","is_default":false,"is_active":true},
    {"product_id":481,"variant_key":"tigers-blood-500g","display_name":"Tigers Blood / 500g","flavour_code":"tigers blood","flavour_label":"Tigers Blood","size_value":500,"size_unit":"g","pack_count":1,"product_format":"powder","is_default":false,"is_active":true},
    {"product_id":37,"variant_key":"fruit-burst-450g","display_name":"Fruit Burst / 450g","flavour_code":"fruit burst","flavour_label":"Fruit Burst","size_value":450,"size_unit":"g","pack_count":1,"product_format":"powder","is_default":false,"is_active":true},
    {"product_id":37,"variant_key":"green-apple-450g","display_name":"Green Apple / 450g","flavour_code":"green apple","flavour_label":"Green Apple","size_value":450,"size_unit":"g","pack_count":1,"product_format":"powder","is_default":false,"is_active":true},
    {"product_id":37,"variant_key":"ice-blue-razz-450g","display_name":"Ice Blue Razz / 450g","flavour_code":"ice blue razz","flavour_label":"Ice Blue Razz","size_value":450,"size_unit":"g","pack_count":1,"product_format":"powder","is_default":false,"is_active":true},
    {"product_id":37,"variant_key":"lemon-and-lime-450g","display_name":"Lemon & Lime / 450g","flavour_code":"lemon and lime","flavour_label":"Lemon & Lime","size_value":450,"size_unit":"g","pack_count":1,"product_format":"powder","is_default":false,"is_active":true},
    {"product_id":37,"variant_key":"orange-and-mango-450g","display_name":"Orange & Mango / 450g","flavour_code":"orange and mango","flavour_label":"Orange & Mango","size_value":450,"size_unit":"g","pack_count":1,"product_format":"powder","is_default":false,"is_active":true},
    {"product_id":37,"variant_key":"pineapple-450g","display_name":"Pineapple / 450g","flavour_code":"pineapple","flavour_label":"Pineapple","size_value":450,"size_unit":"g","pack_count":1,"product_format":"powder","is_default":false,"is_active":true},
    {"product_id":37,"variant_key":"watermelon-450g","display_name":"Watermelon / 450g","flavour_code":"watermelon","flavour_label":"Watermelon","size_value":450,"size_unit":"g","pack_count":1,"product_format":"powder","is_default":false,"is_active":true},
    {"product_id":409,"variant_key":"apple-and-cherry-1800g","display_name":"Apple & Cherry / 1.8kg","flavour_code":"apple and cherry","flavour_label":"Apple & Cherry","size_value":1800,"size_unit":"g","pack_count":1,"product_format":"powder","is_default":false,"is_active":true},
    {"product_id":409,"variant_key":"blue-raspberry-1800g","display_name":"Blue Raspberry / 1.8kg","flavour_code":"blue raspberry","flavour_label":"Blue Raspberry","size_value":1800,"size_unit":"g","pack_count":1,"product_format":"powder","is_default":false,"is_active":true},
    {"product_id":409,"variant_key":"fruit-burst-1800g","display_name":"Fruit Burst / 1.8kg","flavour_code":"fruit burst","flavour_label":"Fruit Burst","size_value":1800,"size_unit":"g","pack_count":1,"product_format":"powder","is_default":false,"is_active":true},
    {"product_id":409,"variant_key":"summer-fruit-1800g","display_name":"Summer Fruit / 1.8kg","flavour_code":"summer fruit","flavour_label":"Summer Fruit","size_value":1800,"size_unit":"g","pack_count":1,"product_format":"powder","is_default":false,"is_active":true},
    {"product_id":158,"variant_key":"banana-5400g","display_name":"Banana / 5.4kg","flavour_code":"banana","flavour_label":"Banana","size_value":5400,"size_unit":"g","pack_count":1,"product_format":"powder","is_default":false,"is_active":true},
    {"product_id":158,"variant_key":"chocolate-5400g","display_name":"Chocolate / 5.4kg","flavour_code":"chocolate","flavour_label":"Chocolate","size_value":5400,"size_unit":"g","pack_count":1,"product_format":"powder","is_default":false,"is_active":true},
    {"product_id":158,"variant_key":"chocolate-peanut-5400g","display_name":"Chocolate Peanut / 5.4kg","flavour_code":"chocolate peanut","flavour_label":"Chocolate Peanut","size_value":5400,"size_unit":"g","pack_count":1,"product_format":"powder","is_default":false,"is_active":true},
    {"product_id":158,"variant_key":"cookies-and-cream-5400g","display_name":"Cookies & Cream / 5.4kg","flavour_code":"cookies and cream","flavour_label":"Cookies & Cream","size_value":5400,"size_unit":"g","pack_count":1,"product_format":"powder","is_default":false,"is_active":true},
    {"product_id":158,"variant_key":"strawberry-5400g","display_name":"Strawberry / 5.4kg","flavour_code":"strawberry","flavour_label":"Strawberry","size_value":5400,"size_unit":"g","pack_count":1,"product_format":"powder","is_default":false,"is_active":true},
    {"product_id":158,"variant_key":"vanilla-5400g","display_name":"Vanilla / 5.4kg","flavour_code":"vanilla","flavour_label":"Vanilla","size_value":5400,"size_unit":"g","pack_count":1,"product_format":"powder","is_default":false,"is_active":true},
    {"product_id":222,"variant_key":"chocolate-fudge-brownie-6800g","display_name":"Chocolate Fudge Brownie / 6.8kg","flavour_code":"chocolate fudge brownie","flavour_label":"Chocolate Fudge Brownie","size_value":6800,"size_unit":"g","pack_count":1,"product_format":"powder","is_default":false,"is_active":true},
    {"product_id":222,"variant_key":"cookies-and-cream-6800g","display_name":"Cookies & Cream / 6.8kg","flavour_code":"cookies and cream","flavour_label":"Cookies & Cream","size_value":6800,"size_unit":"g","pack_count":1,"product_format":"powder","is_default":false,"is_active":true},
    {"product_id":222,"variant_key":"strawberry-and-banana-6800g","display_name":"Strawberry & Banana / 6.8kg","flavour_code":"strawberry and banana","flavour_label":"Strawberry & Banana","size_value":6800,"size_unit":"g","pack_count":1,"product_format":"powder","is_default":false,"is_active":true},
    {"product_id":222,"variant_key":"triple-chocolate-6800g","display_name":"Triple Chocolate / 6.8kg","flavour_code":"triple chocolate","flavour_label":"Triple Chocolate","size_value":6800,"size_unit":"g","pack_count":1,"product_format":"powder","is_default":false,"is_active":true}
  ]
  $batch_b_inventory$::jsonb;
  v_before_count integer;
  v_after_count integer;
  v_missing integer;
  v_inserted integer;
begin
  if jsonb_typeof(v_expected) is distinct from 'array'
     or jsonb_array_length(v_expected) is distinct from 25 then
    raise exception 'Batch B variant seed blocked: expected inventory must contain exactly 25 variants';
  end if;

  if (select count(distinct e.product_id)
      from jsonb_to_recordset(v_expected) as e(product_id bigint)) is distinct from 5
     or exists (
       select 1
       from jsonb_to_recordset(v_expected) as e(
         product_id bigint, variant_key text, display_name text, flavour_code text,
         flavour_label text, size_value numeric, size_unit text, pack_count integer,
         product_format text, is_default boolean, is_active boolean
       )
       where e.product_id not in (37, 158, 222, 409, 481)
          or e.variant_key is null or btrim(e.variant_key) = ''
          or e.display_name is null or btrim(e.display_name) = ''
          or e.flavour_code is null or btrim(e.flavour_code) = ''
          or e.flavour_label is null or btrim(e.flavour_label) = ''
          or e.size_value not in (450, 500, 1800, 5400, 6800)
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
    raise exception 'Batch B variant seed blocked: expected inventory contract is invalid';
  end if;

  perform 1
  from public.products
  where id in (37, 158, 222, 409, 481)
  order by id
  for update;

  lock table public.product_variants in share row exclusive mode;

  if exists (
    select 1
    from (values
      (37::bigint, 'Applied Nutrition BCAA Amino Hydrate 450g'::text),
      (158, 'Optimum Nutrition Serious Mass  5.4kg'),
      (222, 'Mutant Mass 6.8kg'),
      (409, 'NXT Beef Protein Isolate 1.8kg'),
      (481, 'Applied Nutrition ABE Pump 500g')
    ) as expected(product_id, product_name)
    left join public.products p on p.id = expected.product_id
    where p.id is null
       or p.name is distinct from expected.product_name
       or p.is_active is distinct from true
       or p.merged_into_product_id is not null
       or p.merged_at is not null
  ) then
    raise exception 'Batch B variant seed blocked: canonical product identity or lifecycle changed';
  end if;

  if exists (
    select 1
    from (values
      (37::bigint, 75::bigint),
      (158, 149),
      (222, 187),
      (409, 387),
      (481, 475)
    ) as expected(product_id, default_variant_id)
    left join public.product_variants v on v.id = expected.default_variant_id
    where v.id is null
       or v.product_id is distinct from expected.product_id
       or v.variant_key is distinct from 'default'
       or v.is_default is distinct from true
       or v.is_active is distinct from true
  ) then
    raise exception 'Batch B variant seed blocked: default variant identity changed';
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
    raise exception 'Batch B variant seed blocked: expected variant key has drifted values';
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
    raise exception 'Batch B variant seed blocked: semantic duplicate exists under another key';
  end if;

  if exists (
    select 1
    from public.product_variants v
    where v.product_id in (37, 158, 222, 409, 481)
      and v.is_default is distinct from true
      and not exists (
        select 1
        from jsonb_to_recordset(v_expected) as e(product_id bigint, variant_key text)
        where e.product_id = v.product_id and e.variant_key = v.variant_key
      )
  ) then
    raise exception 'Batch B variant seed blocked: unexpected non-default variant exists';
  end if;

  select count(*) into v_before_count from public.product_variants;

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
  order by e.product_id, e.variant_key;

  get diagnostics v_inserted = row_count;
  select count(*) into v_after_count from public.product_variants;

  if v_inserted is distinct from v_missing
     or v_after_count is distinct from v_before_count + v_inserted then
    raise exception 'Batch B variant seed failed: expected growth %, inserted %, observed growth %',
      v_missing, v_inserted, v_after_count - v_before_count;
  end if;

  if (select count(*)
      from public.product_variants
      where product_id in (37, 158, 222, 409, 481)
        and is_default is distinct from true) is distinct from 25
     or (select count(*)
         from jsonb_to_recordset(v_expected) as e(product_id bigint, variant_key text)
         join public.product_variants v
           on v.product_id = e.product_id and v.variant_key = e.variant_key) is distinct from 25 then
    raise exception 'Batch B variant seed failed: final target inventory is not exactly 25 variants';
  end if;
end;
$seed_discount_supplements_batch_b_variants$;

commit;
