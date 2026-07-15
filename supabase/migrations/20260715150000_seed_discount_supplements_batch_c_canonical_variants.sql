begin;

do $seed_discount_supplements_batch_c_variants$
declare
  v_expected constant jsonb := $batch_c_inventory$
  [
    {"product_id":19,"variant_key":"blueberry-380g","display_name":"Blueberry / 380g","flavour_code":"blueberry","flavour_label":"Blueberry","size_value":380,"size_unit":"g","pack_count":1,"product_format":"powder","is_default":false,"is_active":true},
    {"product_id":19,"variant_key":"bubblegum-380g","display_name":"Bubblegum / 380g","flavour_code":"bubblegum","flavour_label":"Bubblegum","size_value":380,"size_unit":"g","pack_count":1,"product_format":"powder","is_default":false,"is_active":true},
    {"product_id":19,"variant_key":"cola-380g","display_name":"Cola / 380g","flavour_code":"cola","flavour_label":"Cola","size_value":380,"size_unit":"g","pack_count":1,"product_format":"powder","is_default":false,"is_active":true},
    {"product_id":19,"variant_key":"mango-380g","display_name":"Mango / 380g","flavour_code":"mango","flavour_label":"Mango","size_value":380,"size_unit":"g","pack_count":1,"product_format":"powder","is_default":false,"is_active":true},
    {"product_id":19,"variant_key":"mojito-380g","display_name":"Mojito / 380g","flavour_code":"mojito","flavour_label":"Mojito","size_value":380,"size_unit":"g","pack_count":1,"product_format":"powder","is_default":false,"is_active":true},
    {"product_id":19,"variant_key":"strawberry-380g","display_name":"Strawberry / 380g","flavour_code":"strawberry","flavour_label":"Strawberry","size_value":380,"size_unit":"g","pack_count":1,"product_format":"powder","is_default":false,"is_active":true},
    {"product_id":19,"variant_key":"watermelon-380g","display_name":"Watermelon / 380g","flavour_code":"watermelon","flavour_label":"Watermelon","size_value":380,"size_unit":"g","pack_count":1,"product_format":"powder","is_default":false,"is_active":true},
    {"product_id":124,"variant_key":"banana-6000g","display_name":"Banana / 6kg","flavour_code":"banana","flavour_label":"Banana","size_value":6000,"size_unit":"g","pack_count":1,"product_format":"powder","is_default":false,"is_active":true},
    {"product_id":124,"variant_key":"chocolate-6000g","display_name":"Chocolate / 6kg","flavour_code":"chocolate","flavour_label":"Chocolate","size_value":6000,"size_unit":"g","pack_count":1,"product_format":"powder","is_default":false,"is_active":true},
    {"product_id":124,"variant_key":"strawberry-6000g","display_name":"Strawberry / 6kg","flavour_code":"strawberry","flavour_label":"Strawberry","size_value":6000,"size_unit":"g","pack_count":1,"product_format":"powder","is_default":false,"is_active":true},
    {"product_id":124,"variant_key":"vanilla-6000g","display_name":"Vanilla / 6kg","flavour_code":"vanilla","flavour_label":"Vanilla","size_value":6000,"size_unit":"g","pack_count":1,"product_format":"powder","is_default":false,"is_active":true},
    {"product_id":124,"variant_key":"white-chocolate-bueno-6000g","display_name":"White Chocolate Bueno / 6kg","flavour_code":"white chocolate bueno","flavour_label":"White Chocolate Bueno","size_value":6000,"size_unit":"g","pack_count":1,"product_format":"powder","is_default":false,"is_active":true},
    {"product_id":157,"variant_key":"banana-2700g","display_name":"Banana / 2.7kg","flavour_code":"banana","flavour_label":"Banana","size_value":2700,"size_unit":"g","pack_count":1,"product_format":"powder","is_default":false,"is_active":true},
    {"product_id":157,"variant_key":"chocolate-2700g","display_name":"Chocolate / 2.7kg","flavour_code":"chocolate","flavour_label":"Chocolate","size_value":2700,"size_unit":"g","pack_count":1,"product_format":"powder","is_default":false,"is_active":true},
    {"product_id":157,"variant_key":"chocolate-peanut-2700g","display_name":"Chocolate Peanut / 2.7kg","flavour_code":"chocolate peanut","flavour_label":"Chocolate Peanut","size_value":2700,"size_unit":"g","pack_count":1,"product_format":"powder","is_default":false,"is_active":true},
    {"product_id":157,"variant_key":"cookies-and-cream-2700g","display_name":"Cookies & Cream / 2.7kg","flavour_code":"cookies and cream","flavour_label":"Cookies & Cream","size_value":2700,"size_unit":"g","pack_count":1,"product_format":"powder","is_default":false,"is_active":true},
    {"product_id":157,"variant_key":"strawberry-2700g","display_name":"Strawberry / 2.7kg","flavour_code":"strawberry","flavour_label":"Strawberry","size_value":2700,"size_unit":"g","pack_count":1,"product_format":"powder","is_default":false,"is_active":true},
    {"product_id":157,"variant_key":"vanilla-2700g","display_name":"Vanilla / 2.7kg","flavour_code":"vanilla","flavour_label":"Vanilla","size_value":2700,"size_unit":"g","pack_count":1,"product_format":"powder","is_default":false,"is_active":true},
    {"product_id":222,"variant_key":"vanilla-6800g","display_name":"Vanilla / 6.8kg","flavour_code":"vanilla","flavour_label":"Vanilla","size_value":6800,"size_unit":"g","pack_count":1,"product_format":"powder","is_default":false,"is_active":true},
    {"product_id":231,"variant_key":"unflavoured-317g","display_name":"Unflavoured / 317g","flavour_code":"unflavoured","flavour_label":"Unflavoured","size_value":317,"size_unit":"g","pack_count":1,"product_format":"powder","is_default":false,"is_active":true},
    {"product_id":253,"variant_key":"peach-and-passionfruit-266g","display_name":"Peach & Passionfruit / 266g","flavour_code":"peach and passionfruit","flavour_label":"Peach & Passionfruit","size_value":266,"size_unit":"g","pack_count":1,"product_format":"powder","is_default":false,"is_active":true},
    {"product_id":253,"variant_key":"raspberry-and-pomegranate-266g","display_name":"Raspberry & Pomegranate / 266g","flavour_code":"raspberry and pomegranate","flavour_label":"Raspberry & Pomegranate","size_value":266,"size_unit":"g","pack_count":1,"product_format":"powder","is_default":false,"is_active":true},
    {"product_id":253,"variant_key":"strawberry-kiwi-266g","display_name":"Strawberry Kiwi / 266g","flavour_code":"strawberry kiwi","flavour_label":"Strawberry Kiwi","size_value":266,"size_unit":"g","pack_count":1,"product_format":"powder","is_default":false,"is_active":true},
    {"product_id":292,"variant_key":"green-burst-390g","display_name":"Green Burst / 390g","flavour_code":"green burst","flavour_label":"Green Burst","size_value":390,"size_unit":"g","pack_count":1,"product_format":"powder","is_default":false,"is_active":true},
    {"product_id":292,"variant_key":"purple-power-390g","display_name":"Purple Power / 390g","flavour_code":"purple power","flavour_label":"Purple Power","size_value":390,"size_unit":"g","pack_count":1,"product_format":"powder","is_default":false,"is_active":true},
    {"product_id":292,"variant_key":"red-rush-390g","display_name":"Red Rush / 390g","flavour_code":"red rush","flavour_label":"Red Rush","size_value":390,"size_unit":"g","pack_count":1,"product_format":"powder","is_default":false,"is_active":true},
    {"product_id":296,"variant_key":"banana-4000g","display_name":"Banana / 4kg","flavour_code":"banana","flavour_label":"Banana","size_value":4000,"size_unit":"g","pack_count":1,"product_format":"powder","is_default":false,"is_active":true},
    {"product_id":296,"variant_key":"chocolate-4000g","display_name":"Chocolate / 4kg","flavour_code":"chocolate","flavour_label":"Chocolate","size_value":4000,"size_unit":"g","pack_count":1,"product_format":"powder","is_default":false,"is_active":true},
    {"product_id":296,"variant_key":"cookies-and-cream-4000g","display_name":"Cookies & Cream / 4kg","flavour_code":"cookies and cream","flavour_label":"Cookies & Cream","size_value":4000,"size_unit":"g","pack_count":1,"product_format":"powder","is_default":false,"is_active":true},
    {"product_id":296,"variant_key":"strawberry-4000g","display_name":"Strawberry / 4kg","flavour_code":"strawberry","flavour_label":"Strawberry","size_value":4000,"size_unit":"g","pack_count":1,"product_format":"powder","is_default":false,"is_active":true},
    {"product_id":296,"variant_key":"vanilla-4000g","display_name":"Vanilla / 4kg","flavour_code":"vanilla","flavour_label":"Vanilla","size_value":4000,"size_unit":"g","pack_count":1,"product_format":"powder","is_default":false,"is_active":true}
  ]
  $batch_c_inventory$::jsonb;
  v_before_count integer;
  v_after_count integer;
  v_missing integer;
  v_inserted integer;
begin
  if jsonb_typeof(v_expected) is distinct from 'array'
     or jsonb_array_length(v_expected) is distinct from 31 then
    raise exception 'Batch C variant seed blocked: expected inventory must contain exactly 31 variants';
  end if;

  if (select count(distinct e.product_id)
      from jsonb_to_recordset(v_expected) as e(product_id bigint)) is distinct from 8
     or exists (
       select 1
       from jsonb_to_recordset(v_expected) as e(
         product_id bigint, variant_key text, display_name text, flavour_code text,
         flavour_label text, size_value numeric, size_unit text, pack_count integer,
         product_format text, is_default boolean, is_active boolean
       )
       left join (values
         (19::bigint,380::numeric),(124,6000),(157,2700),(222,6800),
         (231,317),(253,266),(292,390),(296,4000)
       ) as allowed(product_id,size_value)
         on allowed.product_id=e.product_id and allowed.size_value=e.size_value
       where allowed.product_id is null
          or e.variant_key is null or btrim(e.variant_key)=''
          or e.display_name is null or btrim(e.display_name)=''
          or e.flavour_code is null or btrim(e.flavour_code)=''
          or e.flavour_label is null or btrim(e.flavour_label)=''
          or e.size_unit is distinct from 'g'
          or e.pack_count is distinct from 1
          or e.product_format is distinct from 'powder'
          or e.is_default is distinct from false
          or e.is_active is distinct from true
     )
     or exists (
       select 1 from jsonb_to_recordset(v_expected) as e(product_id bigint,variant_key text)
       group by e.product_id,e.variant_key having count(*)<>1
     )
     or exists (
       select 1
       from jsonb_to_recordset(v_expected) as e(
         product_id bigint,flavour_code text,size_value numeric,size_unit text,
         pack_count integer,product_format text
       )
       group by e.product_id,e.flavour_code,e.size_value,e.size_unit,e.pack_count,e.product_format
       having count(*)<>1
     ) then
    raise exception 'Batch C variant seed blocked: expected inventory contract is invalid';
  end if;

  perform 1
  from public.products
  where id in (19,124,157,222,231,253,292,296)
  order by id
  for update;

  lock table public.product_variants in share row exclusive mode;

  if exists (
    select 1
    from (values
      (19::bigint,'Dorian Yates Blood & Guts Pre Workout 380g'::text,'Dorian Yates'::text),
      (124,'Applied Nutrition Critical Mass Gainer 6kg','Applied Nutrition'),
      (157,'Optimum Nutrition Serious Mass 2.7kg','Optimum Nutrition'),
      (222,'Mutant Mass 6.8kg','Mutant'),
      (231,'Optimum Nutrition Micronised Creatine 317g','Optimum Nutrition'),
      (253,'Optimum Nutrition Gold Standard BCAA Train Sustain 266g','Optimum Nutrition'),
      (292,'BSN NO-Xplode 390g (New formula)','BSN'),
      (296,'USN Muscle Fuel Anabolic 4kg','USN')
    ) as expected(product_id,product_name,brand)
    left join public.products p on p.id=expected.product_id
    where p.id is null
       or p.name is distinct from expected.product_name
       or p.brand is distinct from expected.brand
       or p.is_active is distinct from true
       or p.merged_into_product_id is not null
       or p.merged_at is not null
  ) then
    raise exception 'Batch C variant seed blocked: canonical product identity or lifecycle changed';
  end if;

  if exists (
    select 1
    from (values
      (19::bigint,3::bigint),(124,115),(157,148),(222,187),
      (231,194),(253,229),(292,291),(296,292)
    ) as expected(product_id,default_variant_id)
    left join public.product_variants v on v.id=expected.default_variant_id
    where v.id is null
       or v.product_id is distinct from expected.product_id
       or v.variant_key is distinct from 'default'
       or v.is_default is distinct from true
       or v.is_active is distinct from true
  ) then
    raise exception 'Batch C variant seed blocked: default variant identity changed';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(v_expected) as e(
      product_id bigint,variant_key text,display_name text,flavour_code text,
      flavour_label text,size_value numeric,size_unit text,pack_count integer,
      product_format text,is_default boolean,is_active boolean
    )
    join public.product_variants v on v.product_id=e.product_id and v.variant_key=e.variant_key
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
    raise exception 'Batch C variant seed blocked: expected variant key has drifted values';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(v_expected) as e(
      product_id bigint,variant_key text,flavour_code text,size_value numeric,
      size_unit text,pack_count integer,product_format text
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
    raise exception 'Batch C variant seed blocked: semantic duplicate exists under another key';
  end if;

  select count(*) into v_before_count from public.product_variants;

  select count(*) into v_missing
  from jsonb_to_recordset(v_expected) as e(product_id bigint,variant_key text)
  where not exists (
    select 1 from public.product_variants v
    where v.product_id=e.product_id and v.variant_key=e.variant_key
  );

  insert into public.product_variants (
    product_id,variant_key,display_name,flavour_code,flavour_label,
    size_value,size_unit,pack_count,product_format,gtin,image,
    nutrition_override,is_default,is_active
  )
  select
    e.product_id,e.variant_key,e.display_name,e.flavour_code,e.flavour_label,
    e.size_value,e.size_unit,e.pack_count,e.product_format,null,null,
    '{}'::jsonb,e.is_default,e.is_active
  from jsonb_to_recordset(v_expected) as e(
    product_id bigint,variant_key text,display_name text,flavour_code text,
    flavour_label text,size_value numeric,size_unit text,pack_count integer,
    product_format text,is_default boolean,is_active boolean
  )
  where not exists (
    select 1 from public.product_variants v
    where v.product_id=e.product_id and v.variant_key=e.variant_key
  )
  order by e.product_id,e.variant_key;

  get diagnostics v_inserted=row_count;
  select count(*) into v_after_count from public.product_variants;

  if v_inserted is distinct from v_missing
     or v_after_count is distinct from v_before_count+v_inserted then
    raise exception 'Batch C variant seed failed: expected growth %, inserted %, observed growth %',
      v_missing,v_inserted,v_after_count-v_before_count;
  end if;

  if (select count(*)
      from jsonb_to_recordset(v_expected) as e(product_id bigint,variant_key text)
      join public.product_variants v on v.product_id=e.product_id and v.variant_key=e.variant_key) is distinct from 31
     or exists (
       select 1
       from (values
         (19::bigint,7::bigint),(124,5),(157,6),(222,1),
         (231,1),(253,3),(292,3),(296,5)
       ) as expected(product_id,expected_count)
       left join lateral (
         select count(*)::bigint as actual_count
         from jsonb_to_recordset(v_expected) e(product_id bigint,variant_key text)
         join public.product_variants v on v.product_id=e.product_id and v.variant_key=e.variant_key
         where e.product_id=expected.product_id
       ) actual on true
       where actual.actual_count is distinct from expected.expected_count
     ) then
    raise exception 'Batch C variant seed failed: final target inventory is not exactly 31 variants';
  end if;
end;
$seed_discount_supplements_batch_c_variants$;

commit;
