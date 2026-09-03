begin;

-- Source binding: eBay Offer Refresh run 33773580580, artifact 9900823759,
-- artifact digest sha256:e67a04ced4e9ad3b1d6940d6e79977297bbb90293b0aa62fd54282a6dded055d,
-- report sha256:8100a1687b981f1d9ed0f5c9f0379d166e6c5f97a6067048340f5b23c63d502e.
-- The migration expires with that read-only artifact and creates no catalogue entity.

set local lock_timeout = '5s';
set local statement_timeout = '120s';

lock table public.products, public.product_variants, public.retailer_products,
  public.offers, public.price_history in share row exclusive mode;

do $reviewed_ebay_34$
declare
  v_target jsonb := public.retailer_catalogue_actual_database_target();
  v_counts_before jsonb;
  v_rows integer;
begin
  if current_user <> 'postgres'
     or v_target->>'target_environment' <> 'PRODUCTION'
     or v_target->>'project_ref' <> 'aftboxmrdgyhizicfsfu'
     or v_target->>'database_identity' <> 'supplementscout-production:aftboxmrdgyhizicfsfu' then
    raise exception 'Reviewed eBay 34-row remediation requires production database owner';
  end if;
  if clock_timestamp() >= '2026-09-04T15:36:30.405Z'::timestamptz then
    raise exception 'Reviewed eBay artifact 9900823759 has expired';
  end if;
  if (select count(*) from public.retailer_products where retailer_id=12) <> 237
     or (select count(*) from public.offers where retailer_id=12) <> 237 then
    raise exception 'eBay exact 237-row scope precondition mismatch';
  end if;

  if (select count(*) from (values
      (2582,2767,832,1179,2910,'v1|315370516891|0'),
      (2583,2768,833,1180,2911,'v1|312254514051|0'),
      (2584,2769,834,1181,2912,'v1|203966597198|0'),
      (2585,2770,862,1267,2946,'v1|196375064210|0'),
      (2586,2771,932,1541,2929,'v1|311415993246|0'),
      (2587,2772,934,1543,2913,'v1|311968225657|0'),
      (2624,2810,791,1138,2881,'v1|327069519328|0'),
      (2625,2811,796,1143,2882,'v1|327060659620|0'),
      (2626,2812,799,1146,2883,'v1|327060632207|0'),
      (2627,2813,800,1147,2893,'v1|327062344315|0'),
      (2630,2816,927,1535,2927,'v1|326818790418|0'),
      (2636,2822,794,1141,2943,'v1|191651754387|0'),
      (2646,2832,683,544,3014,'v1|387049058279|0'),
      (2647,2833,684,545,3052,'v1|386965889328|0'),
      (2648,2834,703,579,3063,'v1|385435605679|0'),
      (2649,2835,707,583,3064,'v1|355703763092|0'),
      (2650,2836,720,599,2995,'v1|388955605779|0'),
      (2651,2837,741,615,3165,'v1|134979307941|0'),
      (2653,2839,807,1154,2894,'v1|389455624589|0'),
      (2654,2840,808,1155,2895,'v1|227315398173|0'),
      (2655,2841,810,1157,2900,'v1|389883997981|0'),
      (2656,2842,811,1158,2901,'v1|387996845027|0'),
      (2727,2913,786,1070,2880,'v1|327060618170|0')
    ) x(offer_id,mapping_id,product_id,old_variant_id,new_variant_id,external_variant_id)
    join public.products p on p.id=x.product_id and p.is_active and p.merged_into_product_id is null
    join public.product_variants old_v on old_v.id=x.old_variant_id and old_v.product_id=x.product_id and old_v.is_active and old_v.is_default
    join public.product_variants new_v on new_v.id=x.new_variant_id and new_v.product_id=x.product_id and new_v.is_active and not new_v.is_default
    join public.retailer_products rp on rp.id=x.mapping_id and rp.retailer_id=12 and rp.product_id=x.product_id and rp.product_variant_id=x.old_variant_id and rp.external_variant_id=x.external_variant_id
    join public.offers o on o.id=x.offer_id and o.retailer_id=12 and o.retailer_product_id=x.mapping_id and o.product_id=x.product_id and o.product_variant_id=x.old_variant_id and o.in_stock
  ) <> 23 then
    raise exception 'Reviewed eBay 23-rebind before-state mismatch';
  end if;

  if (select count(*) from (values
      (2554,2739,67,1033,35.08,14.58,49.66,'2026-08-25T06:10:01.652Z'::timestamptz,29.23,12.15,41.38,'2026-09-03T15:38:07.337Z'::timestamptz),
      (2617,2803,124,1754,43.97,0,43.97,'2026-09-01T10:30:39.197Z'::timestamptz,46.97,0,46.97,'2026-09-03T15:39:02.825Z'::timestamptz),
      (2642,2828,90,24,22,0,22,'2026-08-25T06:11:20.611Z'::timestamptz,20,0,20,'2026-09-03T15:39:22.214Z'::timestamptz),
      (2643,2829,139,142,8.49,0,8.49,'2026-08-25T06:11:21.490Z'::timestamptz,12.99,0,12.99,'2026-09-03T15:39:23.104Z'::timestamptz),
      (2689,2875,70,1622,28.63,0,28.63,'2026-08-31T11:53:06.817Z'::timestamptz,30.14,0,30.14,'2026-09-03T15:39:58.594Z'::timestamptz),
      (2704,2890,219,202,19.69,0,19.69,'2026-09-01T10:31:22.122Z'::timestamptz,18.79,0,18.79,'2026-09-03T15:40:11.344Z'::timestamptz),
      (2715,2901,518,455,9.14,0,9.14,'2026-08-22T10:46:45.006Z'::timestamptz,8.97,0,8.97,'2026-09-03T15:40:19.417Z'::timestamptz),
      (2728,2914,58,1609,37,0,37,'2026-08-23T07:53:53.106Z'::timestamptz,40,0,40,'2026-09-03T15:40:30.926Z'::timestamptz),
      (2731,2917,74,1627,34.99,0,34.99,'2026-09-01T10:31:36.057Z'::timestamptz,33.24,0,33.24,'2026-09-03T15:40:33.599Z'::timestamptz),
      (2735,2921,125,1053,46.24,0,46.24,'2026-08-23T07:53:55.217Z'::timestamptz,41.84,0,41.84,'2026-09-03T15:40:37.158Z'::timestamptz),
      (2742,2928,232,1811,40.95,0,40.95,'2026-08-31T11:53:33.356Z'::timestamptz,43.10,0,43.10,'2026-09-03T15:40:43.459Z'::timestamptz)
    ) x(offer_id,mapping_id,product_id,variant_id,old_price,old_shipping,old_total,old_checked_at,new_price,new_shipping,new_total,new_checked_at)
    join public.retailer_products rp on rp.id=x.mapping_id and rp.retailer_id=12 and rp.product_id=x.product_id and rp.product_variant_id=x.variant_id
    join public.offers o on o.id=x.offer_id and o.retailer_id=12 and o.retailer_product_id=x.mapping_id and o.product_id=x.product_id and o.product_variant_id=x.variant_id
      and o.price=x.old_price and o.shipping_cost=x.old_shipping and o.total_price=x.old_total and o.in_stock and o.last_checked_at=x.old_checked_at
  ) <> 11 then
    raise exception 'Reviewed eBay 11-commercial before-state mismatch';
  end if;

  select jsonb_build_object(
    'products',(select count(*) from public.products),
    'product_variants',(select count(*) from public.product_variants),
    'retailer_products',(select count(*) from public.retailer_products),
    'offers',(select count(*) from public.offers),
    'price_history',(select count(*) from public.price_history)
  ) into v_counts_before;

  with x(offer_id,mapping_id,product_id,old_variant_id,new_variant_id) as (values
    (2582,2767,832,1179,2910),(2583,2768,833,1180,2911),(2584,2769,834,1181,2912),(2585,2770,862,1267,2946),(2586,2771,932,1541,2929),(2587,2772,934,1543,2913),
    (2624,2810,791,1138,2881),(2625,2811,796,1143,2882),(2626,2812,799,1146,2883),(2627,2813,800,1147,2893),(2630,2816,927,1535,2927),(2636,2822,794,1141,2943),
    (2646,2832,683,544,3014),(2647,2833,684,545,3052),(2648,2834,703,579,3063),(2649,2835,707,583,3064),(2650,2836,720,599,2995),(2651,2837,741,615,3165),
    (2653,2839,807,1154,2894),(2654,2840,808,1155,2895),(2655,2841,810,1157,2900),(2656,2842,811,1158,2901),(2727,2913,786,1070,2880)
  ) update public.retailer_products rp set product_variant_id=x.new_variant_id,updated_at=clock_timestamp() from x where rp.id=x.mapping_id and rp.product_variant_id=x.old_variant_id;
  get diagnostics v_rows=row_count; if v_rows<>23 then raise exception 'Reviewed eBay rebind changed % mappings',v_rows; end if;

  with x(offer_id,mapping_id,product_id,old_variant_id,new_variant_id) as (values
    (2582,2767,832,1179,2910),(2583,2768,833,1180,2911),(2584,2769,834,1181,2912),(2585,2770,862,1267,2946),(2586,2771,932,1541,2929),(2587,2772,934,1543,2913),
    (2624,2810,791,1138,2881),(2625,2811,796,1143,2882),(2626,2812,799,1146,2883),(2627,2813,800,1147,2893),(2630,2816,927,1535,2927),(2636,2822,794,1141,2943),
    (2646,2832,683,544,3014),(2647,2833,684,545,3052),(2648,2834,703,579,3063),(2649,2835,707,583,3064),(2650,2836,720,599,2995),(2651,2837,741,615,3165),
    (2653,2839,807,1154,2894),(2654,2840,808,1155,2895),(2655,2841,810,1157,2900),(2656,2842,811,1158,2901),(2727,2913,786,1070,2880)
  ) update public.offers o set product_variant_id=x.new_variant_id from x where o.id=x.offer_id and o.retailer_product_id=x.mapping_id and o.product_id=x.product_id and o.product_variant_id=x.old_variant_id;
  get diagnostics v_rows=row_count; if v_rows<>23 then raise exception 'Reviewed eBay rebind changed % offers',v_rows; end if;

  with x(offer_id,new_price,new_shipping,new_total,new_checked_at) as (values
    (2554,29.23,12.15,41.38,'2026-09-03T15:38:07.337Z'::timestamptz),(2617,46.97,0,46.97,'2026-09-03T15:39:02.825Z'::timestamptz),
    (2642,20,0,20,'2026-09-03T15:39:22.214Z'::timestamptz),(2643,12.99,0,12.99,'2026-09-03T15:39:23.104Z'::timestamptz),(2689,30.14,0,30.14,'2026-09-03T15:39:58.594Z'::timestamptz),
    (2704,18.79,0,18.79,'2026-09-03T15:40:11.344Z'::timestamptz),(2715,8.97,0,8.97,'2026-09-03T15:40:19.417Z'::timestamptz),(2728,40,0,40,'2026-09-03T15:40:30.926Z'::timestamptz),
    (2731,33.24,0,33.24,'2026-09-03T15:40:33.599Z'::timestamptz),(2735,41.84,0,41.84,'2026-09-03T15:40:37.158Z'::timestamptz),(2742,43.10,0,43.10,'2026-09-03T15:40:43.459Z'::timestamptz)
  ) update public.offers o set price=x.new_price,shipping_cost=x.new_shipping,total_price=x.new_total,last_checked_at=x.new_checked_at from x where o.id=x.offer_id;
  get diagnostics v_rows=row_count; if v_rows<>11 then raise exception 'Reviewed eBay commercial apply changed % offers',v_rows; end if;

  insert into public.price_history(offer_id,price,shipping_cost,total_price,checked_at) values
    (2554,29.23,12.15,41.38,'2026-09-03T15:38:07.337Z'),(2617,46.97,0,46.97,'2026-09-03T15:39:02.825Z'),
    (2642,20,0,20,'2026-09-03T15:39:22.214Z'),(2643,12.99,0,12.99,'2026-09-03T15:39:23.104Z'),(2689,30.14,0,30.14,'2026-09-03T15:39:58.594Z'),
    (2704,18.79,0,18.79,'2026-09-03T15:40:11.344Z'),(2715,8.97,0,8.97,'2026-09-03T15:40:19.417Z'),(2728,40,0,40,'2026-09-03T15:40:30.926Z'),
    (2731,33.24,0,33.24,'2026-09-03T15:40:33.599Z'),(2735,41.84,0,41.84,'2026-09-03T15:40:37.158Z'),(2742,43.10,0,43.10,'2026-09-03T15:40:43.459Z');
  get diagnostics v_rows=row_count; if v_rows<>11 then raise exception 'Reviewed eBay commercial apply inserted % history rows',v_rows; end if;

  if jsonb_build_object(
      'products',(select count(*) from public.products),
      'product_variants',(select count(*) from public.product_variants),
      'retailer_products',(select count(*) from public.retailer_products),
      'offers',(select count(*) from public.offers),
      'price_history',(select count(*) from public.price_history)-11
    ) <> v_counts_before then
    raise exception 'Reviewed eBay remediation changed a forbidden row count';
  end if;
  if (select count(*) from (values
      (2582,2767,2910),(2583,2768,2911),(2584,2769,2912),(2585,2770,2946),(2586,2771,2929),(2587,2772,2913),(2624,2810,2881),(2625,2811,2882),(2626,2812,2883),(2627,2813,2893),(2630,2816,2927),(2636,2822,2943),
      (2646,2832,3014),(2647,2833,3052),(2648,2834,3063),(2649,2835,3064),(2650,2836,2995),(2651,2837,3165),(2653,2839,2894),(2654,2840,2895),(2655,2841,2900),(2656,2842,2901),(2727,2913,2880)
    ) x(offer_id,mapping_id,new_variant_id)
    join public.retailer_products rp on rp.id=x.mapping_id and rp.product_variant_id=x.new_variant_id
    join public.offers o on o.id=x.offer_id and o.retailer_product_id=x.mapping_id and o.product_variant_id=x.new_variant_id
  ) <> 23 then raise exception 'Reviewed eBay rebind postcondition mismatch'; end if;
  if (select count(*) from (values
      (2554,29.23,12.15,41.38,'2026-09-03T15:38:07.337Z'::timestamptz),(2617,46.97,0,46.97,'2026-09-03T15:39:02.825Z'::timestamptz),(2642,20,0,20,'2026-09-03T15:39:22.214Z'::timestamptz),(2643,12.99,0,12.99,'2026-09-03T15:39:23.104Z'::timestamptz),(2689,30.14,0,30.14,'2026-09-03T15:39:58.594Z'::timestamptz),(2704,18.79,0,18.79,'2026-09-03T15:40:11.344Z'::timestamptz),(2715,8.97,0,8.97,'2026-09-03T15:40:19.417Z'::timestamptz),(2728,40,0,40,'2026-09-03T15:40:30.926Z'::timestamptz),(2731,33.24,0,33.24,'2026-09-03T15:40:33.599Z'::timestamptz),(2735,41.84,0,41.84,'2026-09-03T15:40:37.158Z'::timestamptz),(2742,43.10,0,43.10,'2026-09-03T15:40:43.459Z'::timestamptz)
    ) x(offer_id,price,shipping,total_price,checked_at)
    join public.offers o on o.id=x.offer_id and o.price=x.price and o.shipping_cost=x.shipping and o.total_price=x.total_price and o.last_checked_at=x.checked_at
    join public.price_history ph on ph.offer_id=x.offer_id and ph.price=x.price and ph.shipping_cost=x.shipping and ph.total_price=x.total_price and ph.checked_at=x.checked_at
  ) <> 11 then raise exception 'Reviewed eBay commercial postcondition mismatch'; end if;
end
$reviewed_ebay_34$;

commit;
