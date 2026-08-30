begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

lock table public.products, public.product_variants, public.retailer_products,
  public.offers, public.price_history in share row exclusive mode;

do $owner_approved_kior_11$
declare
  v_target jsonb := public.retailer_catalogue_actual_database_target();
  v_counts_before jsonb;
  v_rows integer;
begin
  if current_user <> 'postgres'
     or v_target->>'target_environment' <> 'PRODUCTION'
     or v_target->>'project_ref' <> 'aftboxmrdgyhizicfsfu'
     or v_target->>'database_identity' <> 'supplementscout-production:aftboxmrdgyhizicfsfu' then
    raise exception 'Owner-approved KIOR identity promotion requires production database owner';
  end if;
  if (select count(*) from public.retailer_products where retailer_id=8) <> 11
     or (select count(*) from public.offers where retailer_id=8) <> 11 then
    raise exception 'KIOR exact 11-row scope precondition mismatch';
  end if;
  if (select count(*) from public.retailer_products where retailer_id=8 and external_product_id is null and external_variant_id is null) <> 11
     or exists(select 1 from public.retailer_products where retailer_id=8 and (external_sku is not null or external_options is not null)) then
    raise exception 'KIOR legacy identity before-state mismatch';
  end if;
  if exists(
    select 1 from (values
      (670,678,439,422,'6717613539421','39821206192221','https://kior.uk/products/astragalus?variant=39821206192221',9.99::numeric,true),
      (671,679,441,424,'6825718546525','40172613533789','https://kior.uk/products/green-tea?variant=40172613533789',7.50,true),
      (672,680,438,418,'6717636903005','39821296009309','https://kior.uk/products/super-beets?variant=39821296009309',9.99,true),
      (673,681,437,416,'6717637328989','39821296992349','https://kior.uk/products/clear-mind-clear-focus?variant=39821296992349',24.57,true),
      (674,682,436,415,'6825707929693','40172596068445','https://kior.uk/products/brain-wave?variant=40172596068445',19.99,true),
      (675,683,435,414,'6758522355805','39962446921821','https://kior.uk/products/collagen-probio?variant=39962446921821',15.99,true),
      (676,684,434,413,'6758548078685','39962495746141','https://kior.uk/products/tumeric-ginger?variant=39962495746141',9.99,true),
      (677,685,442,419,'6766403551325','39984169058397','https://kior.uk/products/ksm-66-ashwaganda?variant=39984169058397',14.99,true),
      (678,686,460,427,'7067692138589','40939513741405','https://kior.uk/products/collagen-yellow?variant=40939513741405',23.99,true),
      (679,687,461,492,'7067692531805','40939514232925','https://kior.uk/products/collagen-blue?variant=40939514232925',23.99,true),
      (680,688,458,457,'6758526025821','39962452426845','https://kior.uk/products/digestive-enzyme?variant=39962452426845',16.99,false)
    ) as x(mapping_id,offer_id,product_id,variant_id,external_product_id,external_variant_id,url,price,in_stock)
    where not exists(select 1 from public.retailer_products rp where rp.id=x.mapping_id and rp.retailer_id=8 and rp.product_id=x.product_id and rp.product_variant_id=x.variant_id and rp.external_product_id is null and rp.external_variant_id is null and rp.external_url=x.url)
       or not exists(select 1 from public.offers o where o.id=x.offer_id and o.retailer_id=8 and o.retailer_product_id=x.mapping_id and o.product_id=x.product_id and o.product_variant_id=x.variant_id and o.price=x.price and o.shipping_cost=3.99 and o.total_price=x.price+3.99 and o.in_stock=x.in_stock and o.url=x.url)
  ) then raise exception 'KIOR reviewed row before-state mismatch'; end if;

  select jsonb_build_object('products',(select count(*) from public.products),'variants',(select count(*) from public.product_variants),'mappings',(select count(*) from public.retailer_products),'offers',(select count(*) from public.offers),'history',(select count(*) from public.price_history)) into v_counts_before;
  update public.retailer_products rp set external_product_id=x.external_product_id, external_variant_id=x.external_variant_id, updated_at=now()
  from (values
    (670,'6717613539421','39821206192221'),(671,'6825718546525','40172613533789'),(672,'6717636903005','39821296009309'),(673,'6717637328989','39821296992349'),(674,'6825707929693','40172596068445'),(675,'6758522355805','39962446921821'),(676,'6758548078685','39962495746141'),(677,'6766403551325','39984169058397'),(678,'7067692138589','40939513741405'),(679,'7067692531805','40939514232925'),(680,'6758526025821','39962452426845')
  ) as x(mapping_id,external_product_id,external_variant_id)
  where rp.id=x.mapping_id and rp.retailer_id=8 and rp.external_product_id is null and rp.external_variant_id is null;
  get diagnostics v_rows=row_count;
  if v_rows<>11 then raise exception 'KIOR identity promotion affected % mappings',v_rows; end if;

  if v_counts_before <> jsonb_build_object('products',(select count(*) from public.products),'variants',(select count(*) from public.product_variants),'mappings',(select count(*) from public.retailer_products),'offers',(select count(*) from public.offers),'history',(select count(*) from public.price_history))
     or (select count(*) from public.retailer_products where retailer_id=8 and external_product_id is not null and external_variant_id is not null)<>11
     or (select count(*) from public.offers where retailer_id=8)<>11 then
    raise exception 'KIOR identity promotion postcondition mismatch';
  end if;
end
$owner_approved_kior_11$;

commit;
