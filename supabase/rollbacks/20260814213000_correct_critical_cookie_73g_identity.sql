begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

lock table public.products, public.product_variants in share row exclusive mode;

do $rollback_critical_cookie_73g_identity$
declare
  v_target jsonb := public.retailer_catalogue_actual_database_target();
  v_rows integer;
begin
  if current_user <> 'postgres'
     or v_target->>'target_environment' <> 'PRODUCTION'
     or v_target->>'project_ref' <> 'aftboxmrdgyhizicfsfu'
     or v_target->>'database_identity' <> 'supplementscout-production:aftboxmrdgyhizicfsfu' then
    raise exception 'Critical Cookie 73g rollback requires production database owner';
  end if;

  if not exists (
       select 1 from supabase_migrations.schema_migrations
       where version='20260814213000' and name='correct_critical_cookie_73g_identity'
     )
     or not exists (
       select 1 from public.products
       where id=468 and name='Critical Cookie 12 x 73g'
         and slug='critical-cookie-12-x-85g' and is_active and merged_into_product_id is null
     )
     or (select count(*) from public.product_variants
         where product_id=468 and id in (2696,2697,2698,2710)
           and size_value=73 and size_unit='g' and pack_count=12
           and product_format='snack' and is_active and not is_default) <> 4 then
    raise exception 'Critical Cookie 73g rollback precondition mismatch';
  end if;

  update public.products
  set name='Critical Cookie 12 x 85g'
  where id=468 and name='Critical Cookie 12 x 73g'
    and slug='critical-cookie-12-x-85g' and is_active and merged_into_product_id is null;
  get diagnostics v_rows=row_count;
  if v_rows <> 1 then raise exception 'Critical Cookie product rollback affected % rows',v_rows; end if;

  update public.product_variants
  set variant_key=case id
        when 2696 then 'double-chocolate-85g-12-pack'
        when 2697 then 'chocolate-chip-85g-12-pack'
        when 2698 then 'white-chocolate-raspberry-85g-12-pack'
        when 2710 then 'salted-caramel-85g-12-pack'
      end,
      display_name=case id
        when 2696 then 'Double Chocolate Box of 12 / 85g'
        when 2697 then 'Chocolate Chip Box of 12 / 85g'
        when 2698 then 'White Chocolate & Raspberry Box of 12 / 85g'
        when 2710 then 'Salted Caramel Box of 12 / 85g'
      end,
      size_value=85
  where product_id=468 and id in (2696,2697,2698,2710)
    and size_value=73 and size_unit='g' and pack_count=12 and product_format='snack'
    and is_active and not is_default;
  get diagnostics v_rows=row_count;
  if v_rows <> 4 then raise exception 'Critical Cookie variant rollback affected % rows',v_rows; end if;

  if not exists (select 1 from public.products where id=468 and name='Critical Cookie 12 x 85g' and slug='critical-cookie-12-x-85g')
     or (select count(*) from public.product_variants
         where product_id=468 and id in (2696,2697,2698,2710)
           and size_value=85 and size_unit='g' and pack_count=12
           and product_format='snack' and is_active and not is_default) <> 4 then
    raise exception 'Critical Cookie 73g rollback postcondition mismatch';
  end if;
end
$rollback_critical_cookie_73g_identity$;

commit;
