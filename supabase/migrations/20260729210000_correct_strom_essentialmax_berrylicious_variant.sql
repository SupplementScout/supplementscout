begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $correction$
declare
  v_target jsonb:=public.retailer_catalogue_actual_database_target();
  v_rows integer;
begin
  if current_user<>'postgres'
     or v_target->>'target_environment'<>'PRODUCTION'
     or v_target->>'project_ref'<>'aftboxmrdgyhizicfsfu'
     or v_target->>'database_identity'
        <>'supplementscout-production:aftboxmrdgyhizicfsfu' then
    raise exception 'EssentialMAX Berrylicious correction requires production database owner';
  end if;
  if not exists(
    select 1
    from public.retailer_offer_sync_reviewed_mixed_change_definitions
    where authorization_id='jons-11-1d85825cbb358680-production'
  ) or exists(
    select 1
    from public.retailer_offer_sync_reviewed_mixed_change_bindings
    where authorization_id='jons-11-1d85825cbb358680-production'
  ) then
    raise exception 'reviewed Jon''s stock authorization is missing or already bound';
  end if;
  if not exists(
    select 1 from public.products
    where id=855
      and name='Strom Sports EssentialMAX EAA 450g'
      and is_active
      and merged_into_product_id is null
  ) then
    raise exception 'EssentialMAX canonical product precondition mismatch';
  end if;
  if not exists(
    select 1 from public.product_variants
    where id=1260
      and product_id=855
      and variant_key='default'
      and display_name='Default'
      and flavour_code is null
      and flavour_label is null
      and size_value is null
      and size_unit is null
      and pack_count is null
      and is_active
      and is_default
  ) then
    raise exception 'EssentialMAX default variant precondition mismatch';
  end if;
  if exists(
    select 1 from public.product_variants
    where product_id=855
      and id<>1260
      and (
        variant_key='berrylicious-450g'
        or lower(coalesce(flavour_code,''))='berrylicious'
        or lower(coalesce(flavour_label,''))='berrylicious'
      )
  ) then
    raise exception 'EssentialMAX Berrylicious variant already exists';
  end if;
  if (select count(*) from public.retailer_products where product_variant_id=1260)<>1
     or not exists(
       select 1 from public.retailer_products
       where id=1374
         and retailer_id=10
         and product_id=855
         and product_variant_id=1260
         and external_product_id='10074933920082'
         and external_variant_id='50781369696594'
         and external_sku='STM05002'
         and coalesce(external_options,'{}'::jsonb)='{}'::jsonb
     ) then
    raise exception 'EssentialMAX Berrylicious mapping precondition mismatch';
  end if;
  if (select count(*) from public.offers where product_variant_id=1260)<>1
     or not exists(
       select 1 from public.offers
       where id=1188
         and retailer_id=10
         and product_id=855
         and product_variant_id=1260
         and retailer_product_id=1374
     ) then
    raise exception 'EssentialMAX Berrylicious offer precondition mismatch';
  end if;

  update public.product_variants
  set variant_key='berrylicious-450g',
      display_name='Berrylicious / 450g',
      flavour_code='berrylicious',
      flavour_label='Berrylicious',
      size_value=450,
      size_unit='g',
      pack_count=1,
      product_format='powder',
      is_default=false
  where id=1260
    and product_id=855
    and variant_key='default'
    and is_default;
  get diagnostics v_rows=row_count;
  if v_rows<>1 then
    raise exception 'EssentialMAX Berrylicious variant correction affected % rows',v_rows;
  end if;

  update public.retailer_products
  set external_options='{"Size":"450g","Flavour":"Berrylicious"}'::jsonb,
      updated_at=now()
  where id=1374
    and retailer_id=10
    and product_id=855
    and product_variant_id=1260
    and external_product_id='10074933920082'
    and external_variant_id='50781369696594';
  get diagnostics v_rows=row_count;
  if v_rows<>1 then
    raise exception 'EssentialMAX Berrylicious mapping correction affected % rows',v_rows;
  end if;

  if not exists(
    select 1
    from public.product_variants v
    join public.retailer_products rp on rp.product_variant_id=v.id
    join public.offers o on o.retailer_product_id=rp.id
    where v.id=1260
      and v.product_id=855
      and v.variant_key='berrylicious-450g'
      and v.display_name='Berrylicious / 450g'
      and v.flavour_code='berrylicious'
      and v.flavour_label='Berrylicious'
      and v.size_value=450
      and v.size_unit='g'
      and v.pack_count=1
      and v.product_format='powder'
      and v.is_active
      and not v.is_default
      and rp.id=1374
      and rp.external_options='{"Size":"450g","Flavour":"Berrylicious"}'::jsonb
      and o.id=1188
      and o.product_variant_id=1260
  ) then
    raise exception 'EssentialMAX Berrylicious correction postcondition mismatch';
  end if;
end
$correction$;

commit;
