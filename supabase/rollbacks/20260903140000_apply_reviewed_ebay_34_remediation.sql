begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';

lock table public.products, public.product_variants, public.retailer_products,
  public.offers, public.price_history in share row exclusive mode;

do $rollback_reviewed_ebay_34$
declare
  v_target jsonb := public.retailer_catalogue_actual_database_target();
  v_rows integer;
begin
  if current_user <> 'postgres'
     or v_target->>'target_environment' <> 'PRODUCTION'
     or v_target->>'project_ref' <> 'aftboxmrdgyhizicfsfu'
     or v_target->>'database_identity' <> 'supplementscout-production:aftboxmrdgyhizicfsfu' then
    raise exception 'Reviewed eBay 34-row rollback requires production database owner';
  end if;

  if (select count(*) from (values
      (2582,2767,2910),(2583,2768,2911),(2584,2769,2912),(2585,2770,2946),(2586,2771,2929),(2587,2772,2913),(2624,2810,2881),(2625,2811,2882),(2626,2812,2883),(2627,2813,2893),(2630,2816,2927),(2636,2822,2943),
      (2646,2832,3014),(2647,2833,3052),(2648,2834,3063),(2649,2835,3064),(2650,2836,2995),(2651,2837,3165),(2653,2839,2894),(2654,2840,2895),(2655,2841,2900),(2656,2842,2901),(2727,2913,2880)
    ) x(offer_id,mapping_id,new_variant_id)
    join public.retailer_products rp on rp.id=x.mapping_id and rp.retailer_id=12 and rp.product_variant_id=x.new_variant_id
    join public.offers o on o.id=x.offer_id and o.retailer_id=12 and o.retailer_product_id=x.mapping_id and o.product_variant_id=x.new_variant_id
  ) <> 23 then raise exception 'Reviewed eBay rollback rebind state mismatch'; end if;
  if (select count(*) from (values
      (2554,29.23,12.15,41.38,'2026-09-03T15:38:07.337Z'::timestamptz),(2617,46.97,0,46.97,'2026-09-03T15:39:02.825Z'::timestamptz),(2642,20,0,20,'2026-09-03T15:39:22.214Z'::timestamptz),(2643,12.99,0,12.99,'2026-09-03T15:39:23.104Z'::timestamptz),(2689,30.14,0,30.14,'2026-09-03T15:39:58.594Z'::timestamptz),(2704,18.79,0,18.79,'2026-09-03T15:40:11.344Z'::timestamptz),(2715,8.97,0,8.97,'2026-09-03T15:40:19.417Z'::timestamptz),(2728,40,0,40,'2026-09-03T15:40:30.926Z'::timestamptz),(2731,33.24,0,33.24,'2026-09-03T15:40:33.599Z'::timestamptz),(2735,41.84,0,41.84,'2026-09-03T15:40:37.158Z'::timestamptz),(2742,43.10,0,43.10,'2026-09-03T15:40:43.459Z'::timestamptz)
    ) x(offer_id,price,shipping,total_price,checked_at)
    join public.offers o on o.id=x.offer_id and o.price=x.price and o.shipping_cost=x.shipping and o.total_price=x.total_price and o.last_checked_at=x.checked_at
    join public.price_history ph on ph.offer_id=x.offer_id and ph.price=x.price and ph.shipping_cost=x.shipping and ph.total_price=x.total_price and ph.checked_at=x.checked_at
  ) <> 11 then raise exception 'Reviewed eBay rollback commercial state mismatch'; end if;

  delete from public.price_history where (offer_id,price,shipping_cost,total_price,checked_at) in (values
    (2554,29.23,12.15,41.38,'2026-09-03T15:38:07.337Z'::timestamptz),(2617,46.97,0,46.97,'2026-09-03T15:39:02.825Z'::timestamptz),(2642,20,0,20,'2026-09-03T15:39:22.214Z'::timestamptz),(2643,12.99,0,12.99,'2026-09-03T15:39:23.104Z'::timestamptz),(2689,30.14,0,30.14,'2026-09-03T15:39:58.594Z'::timestamptz),(2704,18.79,0,18.79,'2026-09-03T15:40:11.344Z'::timestamptz),(2715,8.97,0,8.97,'2026-09-03T15:40:19.417Z'::timestamptz),(2728,40,0,40,'2026-09-03T15:40:30.926Z'::timestamptz),(2731,33.24,0,33.24,'2026-09-03T15:40:33.599Z'::timestamptz),(2735,41.84,0,41.84,'2026-09-03T15:40:37.158Z'::timestamptz),(2742,43.10,0,43.10,'2026-09-03T15:40:43.459Z'::timestamptz));
  get diagnostics v_rows=row_count; if v_rows<>11 then raise exception 'Reviewed eBay rollback removed % history rows',v_rows; end if;

  with x(offer_id,old_price,old_shipping,old_total,old_checked_at) as (values
    (2554,35.08,14.58,49.66,'2026-08-25T06:10:01.652Z'::timestamptz),(2617,43.97,0,43.97,'2026-09-01T10:30:39.197Z'::timestamptz),(2642,22,0,22,'2026-08-25T06:11:20.611Z'::timestamptz),(2643,8.49,0,8.49,'2026-08-25T06:11:21.490Z'::timestamptz),(2689,28.63,0,28.63,'2026-08-31T11:53:06.817Z'::timestamptz),(2704,19.69,0,19.69,'2026-09-01T10:31:22.122Z'::timestamptz),(2715,9.14,0,9.14,'2026-08-22T10:46:45.006Z'::timestamptz),(2728,37,0,37,'2026-08-23T07:53:53.106Z'::timestamptz),(2731,34.99,0,34.99,'2026-09-01T10:31:36.057Z'::timestamptz),(2735,46.24,0,46.24,'2026-08-23T07:53:55.217Z'::timestamptz),(2742,40.95,0,40.95,'2026-08-31T11:53:33.356Z'::timestamptz)
  ) update public.offers o set price=x.old_price,shipping_cost=x.old_shipping,total_price=x.old_total,last_checked_at=x.old_checked_at from x where o.id=x.offer_id;
  get diagnostics v_rows=row_count; if v_rows<>11 then raise exception 'Reviewed eBay rollback restored % offers',v_rows; end if;

  with x(offer_id,mapping_id,old_variant_id,new_variant_id) as (values
    (2582,2767,1179,2910),(2583,2768,1180,2911),(2584,2769,1181,2912),(2585,2770,1267,2946),(2586,2771,1541,2929),(2587,2772,1543,2913),(2624,2810,1138,2881),(2625,2811,1143,2882),(2626,2812,1146,2883),(2627,2813,1147,2893),(2630,2816,1535,2927),(2636,2822,1141,2943),(2646,2832,544,3014),(2647,2833,545,3052),(2648,2834,579,3063),(2649,2835,583,3064),(2650,2836,599,2995),(2651,2837,615,3165),(2653,2839,1154,2894),(2654,2840,1155,2895),(2655,2841,1157,2900),(2656,2842,1158,2901),(2727,2913,1070,2880)
  ) update public.offers o set product_variant_id=x.old_variant_id from x where o.id=x.offer_id and o.retailer_product_id=x.mapping_id and o.product_variant_id=x.new_variant_id;
  get diagnostics v_rows=row_count; if v_rows<>23 then raise exception 'Reviewed eBay rollback restored % offers',v_rows; end if;

  with x(mapping_id,old_variant_id,new_variant_id) as (values
    (2767,1179,2910),(2768,1180,2911),(2769,1181,2912),(2770,1267,2946),(2771,1541,2929),(2772,1543,2913),(2810,1138,2881),(2811,1143,2882),(2812,1146,2883),(2813,1147,2893),(2816,1535,2927),(2822,1141,2943),(2832,544,3014),(2833,545,3052),(2834,579,3063),(2835,583,3064),(2836,599,2995),(2837,615,3165),(2839,1154,2894),(2840,1155,2895),(2841,1157,2900),(2842,1158,2901),(2913,1070,2880)
  ) update public.retailer_products rp set product_variant_id=x.old_variant_id,updated_at=rp.created_at from x where rp.id=x.mapping_id and rp.product_variant_id=x.new_variant_id;
  get diagnostics v_rows=row_count; if v_rows<>23 then raise exception 'Reviewed eBay rollback restored % mappings',v_rows; end if;
end
$rollback_reviewed_ebay_34$;

commit;
