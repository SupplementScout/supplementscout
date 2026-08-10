begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $rollback_jons_fruit_twist$
declare
  v_target jsonb:=public.retailer_catalogue_actual_database_target();
  v_installed_at timestamptz;
  v_rows integer;
begin
  if current_user<>'postgres'
     or v_target->>'target_environment'<>'PRODUCTION'
     or v_target->>'project_ref'<>'aftboxmrdgyhizicfsfu'
     or v_target->>'database_identity'<>'supplementscout-production:aftboxmrdgyhizicfsfu' then
    raise exception 'Jon''s Loaded EAA Fruit Twist rollback requires production database owner';
  end if;
  select installed_at into v_installed_at
  from public.retailer_catalogue_migration_ledger
  where version='20260810190000_rebind_jons_loaded_eaa_fruit_twist_variant';
  if v_installed_at is null then
    raise exception 'Jon''s Fruit Twist migration ledger row is missing';
  end if;
  if exists(select 1 from public.offers where id=1022 and last_checked_at>v_installed_at) then
    raise exception 'rollback is forbidden after corrected offer 1022 has been refreshed';
  end if;
  if not exists(
    select 1 from public.retailer_products rp
    join public.offers o on o.retailer_product_id=rp.id
    where rp.id=1208 and rp.external_variant_id='54181852283218'
      and rp.external_sku='CNP27003'
      and rp.external_options='{"Flavour":"Fruit Twist"}'::jsonb
      and o.id=1022
      and o.url='https://jonssupplements.co.uk/products/cnp-professional-loaded-eaa-300g?variant=54181852283218'
  ) then
    raise exception 'Jon''s Fruit Twist rollback precondition mismatch';
  end if;

  update public.offers
  set url='https://jonssupplements.co.uk/products/cnp-professional-loaded-eaa-300g?variant=50608174924114'
  where id=1022 and retailer_product_id=1208;
  get diagnostics v_rows=row_count;
  if v_rows<>1 then raise exception 'Jon''s Fruit Twist rollback affected % offers',v_rows; end if;

  update public.retailer_products
  set external_variant_id='50608174924114',external_sku='CNP27009',
      external_options='{"Flavour":"Twisted Fruit"}'::jsonb,
      external_url='https://jonssupplements.co.uk/products/cnp-professional-loaded-eaa-300g?variant=50608174924114',
      updated_at=now()
  where id=1208 and retailer_id=10 and product_id=745 and product_variant_id=823
    and external_variant_id='54181852283218';
  get diagnostics v_rows=row_count;
  if v_rows<>1 then raise exception 'Jon''s Fruit Twist rollback affected % mappings',v_rows; end if;
end
$rollback_jons_fruit_twist$;

commit;
