begin;

do $seed_batch_a_canonical_variants$
declare
  v_expected constant jsonb := $batch_a_inventory$
  [
    {"product_id":178,"variant_key":"banana-1800g","display_name":"Banana / 1.8kg","flavour_code":"banana","flavour_label":"Banana","size_value":1800,"size_unit":"g","pack_count":1,"product_format":"powder","is_default":false,"is_active":true},
    {"product_id":178,"variant_key":"chocolate-1800g","display_name":"Chocolate / 1.8kg","flavour_code":"chocolate","flavour_label":"Chocolate","size_value":1800,"size_unit":"g","pack_count":1,"product_format":"powder","is_default":false,"is_active":true},
    {"product_id":178,"variant_key":"strawberry-1800g","display_name":"Strawberry / 1.8kg","flavour_code":"strawberry","flavour_label":"Strawberry","size_value":1800,"size_unit":"g","pack_count":1,"product_format":"powder","is_default":false,"is_active":true},
    {"product_id":178,"variant_key":"vanilla-1800g","display_name":"Vanilla / 1.8kg","flavour_code":"vanilla","flavour_label":"Vanilla","size_value":1800,"size_unit":"g","pack_count":1,"product_format":"powder","is_default":false,"is_active":true},
    {"product_id":38,"variant_key":"fruit-burst-375g","display_name":"Fruit Burst / 375g","flavour_code":"fruit burst","flavour_label":"Fruit Burst","size_value":375,"size_unit":"g","pack_count":1,"product_format":"powder","is_default":false,"is_active":true},
    {"product_id":38,"variant_key":"icy-blue-razz-375g","display_name":"Icy Blue Razz / 375g","flavour_code":"icy blue razz","flavour_label":"Icy Blue Razz","size_value":375,"size_unit":"g","pack_count":1,"product_format":"powder","is_default":false,"is_active":true},
    {"product_id":38,"variant_key":"rainbow-unicorn-375g","display_name":"Rainbow Unicorn / 375g","flavour_code":"rainbow unicorn","flavour_label":"Rainbow Unicorn","size_value":375,"size_unit":"g","pack_count":1,"product_format":"powder","is_default":false,"is_active":true},
    {"product_id":36,"variant_key":"candy-ice-blast-390g","display_name":"Candy Ice Blast / 390g","flavour_code":"candy ice blast","flavour_label":"Candy Ice Blast","size_value":390,"size_unit":"g","pack_count":1,"product_format":"powder","is_default":false,"is_active":true},
    {"product_id":36,"variant_key":"cherry-limeade-390g","display_name":"Cherry Limeade / 390g","flavour_code":"cherry limeade","flavour_label":"Cherry Limeade","size_value":390,"size_unit":"g","pack_count":1,"product_format":"powder","is_default":false,"is_active":true},
    {"product_id":36,"variant_key":"cola-millions-390g","display_name":"Cola Millions / 390g","flavour_code":"cola millions","flavour_label":"Cola Millions","size_value":390,"size_unit":"g","pack_count":1,"product_format":"powder","is_default":false,"is_active":true},
    {"product_id":36,"variant_key":"fruit-burst-390g","display_name":"Fruit Burst / 390g","flavour_code":"fruit burst","flavour_label":"Fruit Burst","size_value":390,"size_unit":"g","pack_count":1,"product_format":"powder","is_default":false,"is_active":true},
    {"product_id":36,"variant_key":"fruit-salad-390g","display_name":"Fruit Salad / 390g","flavour_code":"fruit salad","flavour_label":"Fruit Salad","size_value":390,"size_unit":"g","pack_count":1,"product_format":"powder","is_default":false,"is_active":true},
    {"product_id":36,"variant_key":"icy-blue-razz-390g","display_name":"Icy Blue Razz / 390g","flavour_code":"icy blue razz","flavour_label":"Icy Blue Razz","size_value":390,"size_unit":"g","pack_count":1,"product_format":"powder","is_default":false,"is_active":true},
    {"product_id":36,"variant_key":"pineapple-millions-390g","display_name":"Pineapple Millions / 390g","flavour_code":"pineapple millions","flavour_label":"Pineapple Millions","size_value":390,"size_unit":"g","pack_count":1,"product_format":"powder","is_default":false,"is_active":true},
    {"product_id":36,"variant_key":"raspberry-mojito-390g","display_name":"Raspberry Mojito / 390g","flavour_code":"raspberry mojito","flavour_label":"Raspberry Mojito","size_value":390,"size_unit":"g","pack_count":1,"product_format":"powder","is_default":false,"is_active":true},
    {"product_id":17,"variant_key":"blue-raspberry-330g","display_name":"Blue Raspberry / 330g","flavour_code":"blue raspberry","flavour_label":"Blue Raspberry","size_value":330,"size_unit":"g","pack_count":1,"product_format":"powder","is_default":false,"is_active":true},
    {"product_id":17,"variant_key":"fruit-punch-330g","display_name":"Fruit Punch / 330g","flavour_code":"fruit punch","flavour_label":"Fruit Punch","size_value":330,"size_unit":"g","pack_count":1,"product_format":"powder","is_default":false,"is_active":true},
    {"product_id":17,"variant_key":"green-apple-330g","display_name":"Green Apple / 330g","flavour_code":"green apple","flavour_label":"Green Apple","size_value":330,"size_unit":"g","pack_count":1,"product_format":"powder","is_default":false,"is_active":true},
    {"product_id":17,"variant_key":"watermelon-330g","display_name":"Watermelon / 330g","flavour_code":"watermelon","flavour_label":"Watermelon","size_value":330,"size_unit":"g","pack_count":1,"product_format":"powder","is_default":false,"is_active":true},
    {"product_id":80,"variant_key":"fruit-fusion-270g","display_name":"Fruit Fusion / 270g","flavour_code":"fruit fusion","flavour_label":"Fruit Fusion","size_value":270,"size_unit":"g","pack_count":1,"product_format":"powder","is_default":false,"is_active":true},
    {"product_id":80,"variant_key":"lemon-lime-270g","display_name":"Lemon Lime / 270g","flavour_code":"lemon lime","flavour_label":"Lemon Lime","size_value":270,"size_unit":"g","pack_count":1,"product_format":"powder","is_default":false,"is_active":true},
    {"product_id":80,"variant_key":"orange-270g","display_name":"Orange / 270g","flavour_code":"orange","flavour_label":"Orange","size_value":270,"size_unit":"g","pack_count":1,"product_format":"powder","is_default":false,"is_active":true},
    {"product_id":248,"variant_key":"chocolate-930g","display_name":"Chocolate / 930g","flavour_code":"chocolate","flavour_label":"Chocolate","size_value":930,"size_unit":"g","pack_count":1,"product_format":"powder","is_default":false,"is_active":true},
    {"product_id":248,"variant_key":"strawberry-930g","display_name":"Strawberry / 930g","flavour_code":"strawberry","flavour_label":"Strawberry","size_value":930,"size_unit":"g","pack_count":1,"product_format":"powder","is_default":false,"is_active":true},
    {"product_id":248,"variant_key":"vanilla-930g","display_name":"Vanilla / 930g","flavour_code":"vanilla","flavour_label":"Vanilla","size_value":930,"size_unit":"g","pack_count":1,"product_format":"powder","is_default":false,"is_active":true}
  ]
  $batch_a_inventory$::jsonb;
  v_missing integer;
  v_inserted integer;
begin
  if jsonb_typeof(v_expected) is distinct from 'array'
     or jsonb_array_length(v_expected) is distinct from 25 then
    raise exception 'Batch A variant seed blocked: expected inventory must contain exactly 25 variants';
  end if;

  if (select count(distinct e.product_id)
      from jsonb_to_recordset(v_expected) as e(product_id bigint)) is distinct from 6
     or exists (
       select 1 from jsonb_to_recordset(v_expected) as e(product_id bigint)
       where e.product_id = 124
     )
     or exists (
       select 1
       from jsonb_to_recordset(v_expected) as e(
         product_id bigint, variant_key text, size_value numeric, size_unit text,
         pack_count integer, product_format text, is_default boolean, is_active boolean
       )
       where e.product_id not in (17, 36, 38, 80, 178, 248)
          or e.variant_key is null or btrim(e.variant_key) = ''
          or e.size_value is null
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
     ) then
    raise exception 'Batch A variant seed blocked: expected inventory contract is invalid';
  end if;

  perform 1
  from public.products
  where id in (17, 36, 38, 80, 178, 248)
  order by id
  for update;

  lock table public.product_variants in share row exclusive mode;

  if exists (
    select 1
    from (values (17::bigint), (36), (38), (80), (178), (248)) as expected(product_id)
    left join public.products p on p.id = expected.product_id
    where p.id is null
       or p.is_active is distinct from true
       or p.merged_into_product_id is not null
       or p.merged_at is not null
  ) then
    raise exception 'Batch A variant seed blocked: canonical product identity or lifecycle changed';
  end if;

  if exists (
    select 1
    from (values
      (17::bigint, 1::bigint),
      (36, 59),
      (38, 6),
      (80, 52),
      (178, 176),
      (248, 300)
    ) as expected(product_id, default_variant_id)
    left join public.product_variants v on v.id = expected.default_variant_id
    where v.id is null
       or v.product_id is distinct from expected.product_id
       or v.variant_key is distinct from 'default'
       or v.is_default is distinct from true
       or v.is_active is distinct from true
  ) then
    raise exception 'Batch A variant seed blocked: default variant identity changed';
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
    raise exception 'Batch A variant seed blocked: expected variant key has drifted values';
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
    raise exception 'Batch A variant seed blocked: semantic duplicate exists under another key';
  end if;

  if exists (
    select 1
    from public.product_variants v
    where v.product_id in (17, 36, 38, 80, 178, 248)
      and v.is_default is distinct from true
      and not exists (
        select 1
        from jsonb_to_recordset(v_expected) as e(product_id bigint, variant_key text)
        where e.product_id = v.product_id and e.variant_key = v.variant_key
      )
  ) then
    raise exception 'Batch A variant seed blocked: unexpected non-default variant exists';
  end if;

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
  if v_inserted is distinct from v_missing then
    raise exception 'Batch A variant seed failed: inserted % variants instead of %', v_inserted, v_missing;
  end if;

  if (select count(*)
      from public.product_variants
      where product_id in (17, 36, 38, 80, 178, 248)
        and is_default is distinct from true) is distinct from 25
     or (select count(*)
         from jsonb_to_recordset(v_expected) as e(product_id bigint, variant_key text)
         join public.product_variants v
           on v.product_id = e.product_id and v.variant_key = e.variant_key) is distinct from 25 then
    raise exception 'Batch A variant seed failed: final target inventory is not exactly 25 variants';
  end if;
end;
$seed_batch_a_canonical_variants$;

commit;
