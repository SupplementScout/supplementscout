begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $rollback$
declare
  v_target jsonb:=public.retailer_catalogue_actual_database_target();
  v_rows integer;
begin
  if current_user<>'postgres'
     or v_target->>'target_environment'<>'PRODUCTION'
     or v_target->>'project_ref'<>'aftboxmrdgyhizicfsfu'
     or v_target->>'database_identity'<>'supplementscout-production:aftboxmrdgyhizicfsfu' then
    raise exception 'Jon''s Strom Buttered Pancake rollback requires production database owner';
  end if;
  if exists(
    select 1 from public.retailer_offer_sync_reviewed_mixed_change_bindings
    where authorization_id='jons-23-563ef072fa3fd68c-production'
  ) then
    raise exception 'rollback is forbidden after the reviewed Jon''s 23-OOS authorization is bound';
  end if;
  if not exists(
    select 1 from public.product_variants
    where id=1185 and product_id=838 and variant_key='buttered-pancake-2000g'
      and display_name='Buttered Pancake / 2000g'
      and flavour_code='buttered pancake' and flavour_label='Buttered Pancake'
      and size_value=2000 and size_unit='g' and pack_count=1
      and product_format='powder' and is_active and not is_default
  ) or not exists(
    select 1 from public.retailer_products
    where id=1299 and product_variant_id=1185
      and external_options='{"Size":"2000g","Flavour":"Buttered Pancake"}'::jsonb
  ) or not exists(
    select 1 from public.offers
    where id=1113 and product_variant_id=1185 and in_stock
      and price=17.99 and shipping_cost=3.99 and total_price=21.98
  ) then
    raise exception 'Strom Buttered Pancake rollback precondition mismatch';
  end if;

  update public.retailer_products
  set external_options='{}'::jsonb,updated_at=now()
  where id=1299 and product_variant_id=1185
    and external_options='{"Size":"2000g","Flavour":"Buttered Pancake"}'::jsonb;
  get diagnostics v_rows=row_count;
  if v_rows<>1 then
    raise exception 'Strom Buttered Pancake mapping rollback affected % rows',v_rows;
  end if;

  update public.product_variants
  set variant_key='default',display_name='Default',flavour_code=null,flavour_label=null,
      size_value=null,size_unit=null,pack_count=null,product_format=null,is_default=true
  where id=1185 and product_id=838 and variant_key='buttered-pancake-2000g'
    and not is_default;
  get diagnostics v_rows=row_count;
  if v_rows<>1 then
    raise exception 'Strom Buttered Pancake variant rollback affected % rows',v_rows;
  end if;
end
$rollback$;

commit;
