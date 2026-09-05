begin;

-- Owner-approved immutable source: run 33978002980, artifact 9972941188.
-- Read-only remediation artifact SHA-256:
-- 59c6d03a2bbcff0b384b86065f76e6f456e3538ca538613cf83e5e017ec11a9d
-- Exact scope: five existing-mapping listing rebinds, eighteen OOS transitions,
-- three price updates, and eight price-history rows. No catalogue entity creates.

set local lock_timeout = '5s';
set local statement_timeout = '120s';

lock table public.products, public.product_variants, public.retailer_products,
  public.offers, public.price_history in share row exclusive mode;

create temp table _reviewed_ebay_26_before on commit drop as
select * from (values
  ('OOS',2604,2789,220,1810,'404774853352','v1|404774853352|674791941889',36.99,0,36.99,true,'2026-09-05T09:41:53.060Z'::timestamptz,'9bee9b95b48179d3b93bc1999be58d4453733a850f6be89c33d5b10394904a9a'),
  ('PRICE',2606,2791,112,1012,'267459060041','v1|267459060041|567236756567',33.99,5.49,39.48,true,'2026-09-03T10:08:16.153Z'::timestamptz,'ced6e9a51b3fb0633b3b257d9a6979215a2047e3b0ac03a44282b9e9f1bfb140'),
  ('PRICE',2609,2794,324,1060,'267460401796','v1|267460401796|567238268029',12.29,5.49,17.78,true,'2026-09-03T10:08:17.990Z'::timestamptz,'d00ab30d33141bcb92e8aed4b4ab16f2a2c2ed12978f6add61f01fa1723639c6'),
  ('OOS',2620,2806,788,1075,'326796105372','v1|326796105372|515780120440',25.99,0,25.99,true,'2026-09-05T09:42:06.733Z'::timestamptz,'330c49145eec93f698891266cc4e350e164d3e1526e65d1cb17c1fb82968f96c'),
  ('OOS',2628,2814,882,1396,'326584491660','v1|326584491660|515650737150',22.49,0,22.49,true,'2026-09-05T09:42:13.335Z'::timestamptz,'4c2b908e8aee4bc2a045b1b234ce29ed02f8fdee0c641d0787278ec9c0de0032'),
  ('REBIND',2637,2823,673,513,'317649341455','v1|317649341455|0',21.14,0,21.14,true,'2026-08-25T06:11:16.152Z'::timestamptz,'8862beaa59f38cd0965e2a193f99e8e997a97f149b55adc53d22ad4831fd5085'),
  ('REBIND',2638,2824,696,568,'358007221826','v1|358007221826|0',29.04,0,29.04,true,'2026-08-25T06:11:17.047Z'::timestamptz,'0795668c6781b6c09d9796a5121826a66ec7061afdfb317ee9dd849eb391e434'),
  ('OOS',2656,2842,811,2901,'387996845027','v1|387996845027|0',39.19,0,39.19,true,'2026-09-05T09:42:34.774Z'::timestamptz,'84154559f9ce7cde2c75b3fa0f6fff01e1b276d338174ac95cf088c719086a54'),
  ('OOS',2661,2847,10,1712,'323304007010','v1|323304007010|515706626595',77.99,0,77.99,true,'2026-09-05T09:42:38.914Z'::timestamptz,'4ea60000fa945d7acfdd12949bb310ca6d21de863f7ba5967c64a56bf7839a14'),
  ('REBIND',2681,2867,24,1582,'317649344086','v1|317649344086|0',33.89,0,33.89,true,'2026-09-01T10:31:11.112Z'::timestamptz,'5af449d480d3fa9dc42f55fa4f2f7bd9249a287f7cedbd1176b4b38271aee101'),
  ('OOS',2685,2871,273,1819,'137252056707','v1|137252056707|435559918154',21.95,0,21.95,true,'2026-09-05T09:42:57.095Z'::timestamptz,'fa10dbbef4ce590d9fff7bae0740c47888b86c5177e76195c1a3c14c67ee2799'),
  ('OOS',2687,2873,788,1080,'267461430373','v1|267461430373|567539198324',23.95,3.95,27.90,true,'2026-09-05T09:42:57.911Z'::timestamptz,'7c1415c68a46502b3c6ec39dcb53cb552fc48f15f521db743e0225a2cdc497c3'),
  ('REBIND',2708,2894,360,364,'187833104047','v1|187833104047|0',19.09,0,19.09,true,'2026-09-01T10:31:24.211Z'::timestamptz,'fe54abe83bb1eb85b9fb1513b0c31720c4034744707190c1b74284c6cc25d877'),
  ('PRICE',2715,2901,518,455,'398059958397','v1|398059958397|0',8.97,0,8.97,true,'2026-09-05T14:27:14.686Z'::timestamptz,'cd63a803be9ed50f42a663339628ebb8e52c336ae3150ca71fb4936495da6444'),
  ('OOS',2719,2905,217,166,'155926124418','v1|155926124418|0',26.99,0,26.99,true,'2026-09-05T09:43:21.901Z'::timestamptz,'580111908bce13c0e2ee9b7dc1f7b19673d22b75251335bf55d4057bffefeb02'),
  ('OOS',2724,2910,24,1583,'167879148689','v1|167879148689|467421651920',34.99,0,34.99,true,'2026-09-05T09:43:26.010Z'::timestamptz,'fa318308a3d1651270f8001729f85eb48610ceb26700876d914c3c73b1c1dac2'),
  ('OOS',2731,2917,74,1627,'800319414198','v1|800319414198|657404220498',33.24,0,33.24,true,'2026-09-05T09:43:31.833Z'::timestamptz,'cb529664bfdad4090aa8430500e72e17fa0ca79f56c4ca57d575db1be81f8e8e'),
  ('OOS',2742,2928,232,1811,'234899416364','v1|234899416364|534748630032',43.10,0,43.10,true,'2026-09-05T09:43:40.885Z'::timestamptz,'acbbd402dbcfaa00da34cffb8cdca579f4bc2dadd0ef57ad7820f1252c7a6bb7'),
  ('OOS',2748,2934,449,1788,'354343324643','v1|354343324643|623744168324',20.99,0,20.99,true,'2026-09-05T09:43:47.374Z'::timestamptz,'88798faa8b54d76f9073540d4db102c673c56de3216def14954385fb8219551f'),
  ('OOS',2749,2935,450,1049,'137239727747','v1|137239727747|435555053157',27.99,0,27.99,true,'2026-09-05T09:43:48.501Z'::timestamptz,'0d7c0da95a83c254ac4db709fb4edefd01f1ddcfd34e58040da0c0f08e46d906'),
  ('OOS',2755,2941,1104,2395,'235526727416','v1|235526727416|0',49.99,3,52.99,true,'2026-09-05T09:43:53.572Z'::timestamptz,'9588921ddd82cb4e6df2b9b2a49bb82dba08b93b9da388a154e880e7acf74493'),
  ('OOS',2758,2944,755,883,'287487748050','v1|287487748050|0',21.99,0,21.99,true,'2026-08-23T09:40:03.571Z'::timestamptz,'8a9244b144f8467b00d0c0b6ab97e1f8e454e6400fb1e2b3e03797893b11f2c0'),
  ('OOS',2769,2955,385,332,'146086688061','v1|146086688061|445043246478',9.75,0,9.75,true,'2026-09-05T09:44:01.882Z'::timestamptz,'09b9cb56e48f4787c1cc85bdba13c5f40d9a5019911a2a246aafd7ac54cb74c8'),
  ('REBIND',2770,2956,386,352,'187837047801','v1|187837047801|0',12.36,0,12.36,true,'2026-08-23T09:40:07.943Z'::timestamptz,'c53498a56e59353eb897ecf6b4b536965567163c6d9c898d5b350146d716b04b'),
  ('OOS',2771,2957,428,407,'166550190737','v1|166550190737|466197712102',17.69,0,17.69,true,'2026-09-05T09:44:02.727Z'::timestamptz,'87e7d0aa385fa53265b1abc9ca94176d7f0fbb3f6b27717a411ee5ee69ca3507'),
  ('OOS',2774,2960,513,486,'354869780698','v1|354869780698|0',9.49,0,9.49,true,'2026-09-05T09:44:05.213Z'::timestamptz,'02eb6dd8ff3b05292a6dc7d43f4f0b5f0158df1dedf94d9596cb1ead95225778')
) as v(action,offer_id,mapping_id,product_id,variant_id,old_external_product_id,old_external_variant_id,old_price,old_shipping,old_total,old_in_stock,old_checked_at,url_pair_sha256);

create temp table _reviewed_ebay_26_changes on commit drop as
select * from (values
  (2637,'352221379935','v1|352221379935|0','https://www.ebay.co.uk/itm/352221379935','https://www.ebay.co.uk/itm/352221379935?campid=5339189922&customid=&mkcid=1&mkevt=1&mkrid=710-53481-19255-0&toolid=10050',16.59,0,16.59,'2026-09-05T16:34:02.639Z'::timestamptz),
  (2638,'277793153663','v1|277793153663|0','https://www.ebay.co.uk/itm/277793153663','https://www.ebay.co.uk/itm/277793153663?campid=5339189922&customid=&mkcid=1&mkevt=1&mkrid=710-53481-19255-0&toolid=10050',37.07,0,37.07,'2026-09-05T16:34:02.639Z'::timestamptz),
  (2681,'167879148689','v1|167879148689|467421651917','https://www.ebay.co.uk/itm/167879148689?var=467421651917','https://www.ebay.co.uk/itm/167879148689?campid=5339189922&customid=&mkcid=1&mkevt=1&mkrid=710-53481-19255-0&toolid=10050&var=467421651917',34.99,0,34.99,'2026-09-05T16:34:02.639Z'::timestamptz),
  (2708,'134979308772','v1|134979308772|0','https://www.ebay.co.uk/itm/134979308772','https://www.ebay.co.uk/itm/134979308772?campid=5339189922&customid=&mkcid=1&mkevt=1&mkrid=710-53481-19255-0&toolid=10050',19.93,0,19.93,'2026-09-05T16:34:02.639Z'::timestamptz),
  (2770,'146086688061','v1|146086688061|445043246476','https://www.ebay.co.uk/itm/146086688061?var=445043246476','https://www.ebay.co.uk/itm/146086688061?campid=5339189922&customid=&mkcid=1&mkevt=1&mkrid=710-53481-19255-0&toolid=10050&var=445043246476',9.75,0,9.75,'2026-09-05T16:34:02.639Z'::timestamptz),
  (2606,null,null,null,null,34.99,5.49,40.48,'2026-09-05T16:31:27.115Z'::timestamptz),
  (2609,null,null,null,null,11.29,5.49,16.78,'2026-09-05T16:31:28.656Z'::timestamptz),
  (2715,null,null,null,null,9.51,0,9.51,'2026-09-05T16:32:18.538Z'::timestamptz)
) as v(offer_id,new_external_product_id,new_external_variant_id,new_external_url,new_offer_url,new_price,new_shipping,new_total,new_checked_at);

do $reviewed_ebay_26$
declare
  v_target jsonb := public.retailer_catalogue_actual_database_target();
  v_counts_before jsonb;
  v_rows integer;
begin
  if current_user <> 'postgres'
     or v_target->>'target_environment' <> 'PRODUCTION'
     or v_target->>'project_ref' <> 'aftboxmrdgyhizicfsfu'
     or v_target->>'database_identity' <> 'supplementscout-production:aftboxmrdgyhizicfsfu' then
    raise exception 'Reviewed eBay 26-row remediation requires production database owner';
  end if;
  if clock_timestamp() >= '2026-09-06T16:29:22.405Z'::timestamptz then
    raise exception 'Reviewed eBay artifact 9972941188 has expired';
  end if;
  if (select count(*) from public.products) <> 1130
     or (select count(*) from public.product_variants) <> 2850
     or (select count(*) from public.retailer_products) <> 2808
     or (select count(*) from public.offers) <> 2808
     or (select count(*) from public.price_history) <> 9069
     or (select count(*) from public.retailer_products where retailer_id=12) <> 237
     or (select count(*) from public.offers where retailer_id=12) <> 237 then
    raise exception 'Reviewed eBay artifact baseline count mismatch';
  end if;
  if (select count(*) from _reviewed_ebay_26_before) <> 26
     or (select count(*) from _reviewed_ebay_26_before where action='REBIND') <> 5
     or (select count(*) from _reviewed_ebay_26_before where action='OOS') <> 18
     or (select count(*) from _reviewed_ebay_26_before where action='PRICE') <> 3 then
    raise exception 'Reviewed eBay action scope mismatch';
  end if;
  if (select count(*)
      from _reviewed_ebay_26_before b
      join public.retailer_products rp on rp.id=b.mapping_id and rp.retailer_id=12
        and rp.product_id=b.product_id and rp.product_variant_id=b.variant_id
        and rp.external_product_id=b.old_external_product_id and rp.external_variant_id=b.old_external_variant_id
      join public.offers o on o.id=b.offer_id and o.retailer_id=12 and o.retailer_product_id=b.mapping_id
        and o.product_id=b.product_id and o.product_variant_id=b.variant_id
        and o.price=b.old_price and o.shipping_cost=b.old_shipping and o.total_price=b.old_total
        and o.in_stock=b.old_in_stock and o.last_checked_at=b.old_checked_at
        and encode(extensions.digest(convert_to(coalesce(rp.external_url,'') || E'\n' || coalesce(o.url,''),'UTF8'),'sha256'),'hex')=b.url_pair_sha256
  ) <> 26 then
    raise exception 'Reviewed eBay exact before-state mismatch';
  end if;
  if exists (
    select 1 from _reviewed_ebay_26_changes c
    join _reviewed_ebay_26_before b using(offer_id)
    join public.retailer_products rp on rp.retailer_id=12
      and rp.external_variant_id=c.new_external_variant_id and rp.id<>b.mapping_id
    where b.action='REBIND'
  ) then raise exception 'Reviewed eBay replacement collision'; end if;

  select jsonb_build_object(
    'products',(select count(*) from public.products),
    'product_variants',(select count(*) from public.product_variants),
    'retailer_products',(select count(*) from public.retailer_products),
    'offers',(select count(*) from public.offers),
    'price_history',(select count(*) from public.price_history)
  ) into v_counts_before;

  update public.retailer_products rp
  set external_product_id=c.new_external_product_id,
      external_variant_id=c.new_external_variant_id,
      external_url=c.new_external_url,
      updated_at=c.new_checked_at
  from _reviewed_ebay_26_before b join _reviewed_ebay_26_changes c using(offer_id)
  where b.action='REBIND' and rp.id=b.mapping_id;
  get diagnostics v_rows=row_count;
  if v_rows<>5 then raise exception 'Reviewed eBay rebind changed % mappings',v_rows; end if;

  update public.offers o
  set url=case when b.action='REBIND' then c.new_offer_url else o.url end,
      price=case when b.action in ('REBIND','PRICE') then c.new_price else o.price end,
      shipping_cost=case when b.action in ('REBIND','PRICE') then c.new_shipping else o.shipping_cost end,
      total_price=case when b.action in ('REBIND','PRICE') then c.new_total else o.total_price end,
      in_stock=case when b.action='OOS' then false else true end,
      last_checked_at=case when b.action='OOS' then '2026-09-05T16:29:22.405Z'::timestamptz else c.new_checked_at end
  from _reviewed_ebay_26_before b left join _reviewed_ebay_26_changes c using(offer_id)
  where o.id=b.offer_id and o.retailer_product_id=b.mapping_id;
  get diagnostics v_rows=row_count;
  if v_rows<>26 then raise exception 'Reviewed eBay remediation changed % offers',v_rows; end if;

  insert into public.price_history(offer_id,price,shipping_cost,total_price,checked_at)
  select offer_id,new_price,new_shipping,new_total,new_checked_at
  from _reviewed_ebay_26_changes;
  get diagnostics v_rows=row_count;
  if v_rows<>8 then raise exception 'Reviewed eBay remediation inserted % history rows',v_rows; end if;

  if jsonb_build_object(
      'products',(select count(*) from public.products),
      'product_variants',(select count(*) from public.product_variants),
      'retailer_products',(select count(*) from public.retailer_products),
      'offers',(select count(*) from public.offers),
      'price_history',(select count(*) from public.price_history)-8
    ) <> v_counts_before then
    raise exception 'Reviewed eBay remediation changed a forbidden row count';
  end if;
  if (select count(*)
      from _reviewed_ebay_26_before b
      join public.retailer_products rp on rp.id=b.mapping_id
      join public.offers o on o.id=b.offer_id and o.retailer_product_id=b.mapping_id
      left join _reviewed_ebay_26_changes c using(offer_id)
      where (b.action='OOS' and not o.in_stock and o.last_checked_at='2026-09-05T16:29:22.405Z'::timestamptz)
         or (b.action='PRICE' and o.in_stock and o.price=c.new_price and o.shipping_cost=c.new_shipping and o.total_price=c.new_total and o.last_checked_at=c.new_checked_at)
         or (b.action='REBIND' and rp.external_product_id=c.new_external_product_id and rp.external_variant_id=c.new_external_variant_id and rp.external_url=c.new_external_url
             and o.in_stock and o.url=c.new_offer_url and o.price=c.new_price and o.shipping_cost=c.new_shipping and o.total_price=c.new_total and o.last_checked_at=c.new_checked_at)
  ) <> 26 then raise exception 'Reviewed eBay remediation postcondition mismatch'; end if;
  if (select count(*) from public.price_history ph join _reviewed_ebay_26_changes c
      on ph.offer_id=c.offer_id and ph.price=c.new_price and ph.shipping_cost=c.new_shipping
      and ph.total_price=c.new_total and ph.checked_at=c.new_checked_at) <> 8 then
    raise exception 'Reviewed eBay price-history postcondition mismatch';
  end if;
end
$reviewed_ebay_26$;

commit;
