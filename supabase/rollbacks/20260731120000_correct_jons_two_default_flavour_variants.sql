begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $rollback$
declare
  v_target jsonb:=public.retailer_catalogue_actual_database_target();
  v_installed_at timestamptz;
  v_rows integer;
begin
  if current_user<>'postgres'
     or v_target->>'target_environment'<>'PRODUCTION'
     or v_target->>'project_ref'<>'aftboxmrdgyhizicfsfu'
     or v_target->>'database_identity'<>'supplementscout-production:aftboxmrdgyhizicfsfu' then
    raise exception 'Jon''s default flavour rollback requires production database owner';
  end if;
  select installed_at into v_installed_at from public.retailer_catalogue_migration_ledger
  where version='20260731120000_correct_jons_two_default_flavour_variants';
  if v_installed_at is null then raise exception 'Jon''s default flavour migration ledger row is missing'; end if;
  if exists(select 1 from public.offers where id in (1116,1189) and last_checked_at>v_installed_at) then
    raise exception 'rollback is forbidden after either corrected offer has been refreshed';
  end if;
  if not exists(select 1 from public.product_variants where id=1188 and product_id=841 and variant_key='berry-465g' and not is_default)
     or not exists(select 1 from public.product_variants where id=1261 and product_id=856 and variant_key='fizzy-blue-bottles-300g' and not is_default)
     or not exists(select 1 from public.retailer_products where id=1302 and external_options='{"Size":"465g","Flavour":"Berry"}'::jsonb)
     or not exists(select 1 from public.retailer_products where id=1375 and external_options='{"Size":"300g","Flavour":"Fizzy Blue Bottles"}'::jsonb) then
    raise exception 'Jon''s default flavour rollback precondition mismatch';
  end if;

  update public.retailer_products set external_options='{}'::jsonb,updated_at=now()
  where id=1302 and product_variant_id=1188 and external_options='{"Size":"465g","Flavour":"Berry"}'::jsonb;
  get diagnostics v_rows=row_count;
  if v_rows<>1 then raise exception 'Conteh Berry mapping rollback affected % rows',v_rows; end if;
  update public.retailer_products set external_options='{}'::jsonb,updated_at=now()
  where id=1375 and product_variant_id=1261 and external_options='{"Size":"300g","Flavour":"Fizzy Blue Bottles"}'::jsonb;
  get diagnostics v_rows=row_count;
  if v_rows<>1 then raise exception 'Trained By JP mapping rollback affected % rows',v_rows; end if;

  update public.product_variants set variant_key='default',display_name='Default',flavour_code=null,
    flavour_label=null,size_value=null,size_unit=null,pack_count=null,product_format=null,is_default=true
  where id=1188 and product_id=841 and variant_key='berry-465g' and not is_default;
  get diagnostics v_rows=row_count;
  if v_rows<>1 then raise exception 'Conteh Berry variant rollback affected % rows',v_rows; end if;
  update public.product_variants set variant_key='default',display_name='Default',flavour_code=null,
    flavour_label=null,size_value=null,size_unit=null,pack_count=null,product_format=null,is_default=true
  where id=1261 and product_id=856 and variant_key='fizzy-blue-bottles-300g' and not is_default;
  get diagnostics v_rows=row_count;
  if v_rows<>1 then raise exception 'Trained By JP variant rollback affected % rows',v_rows; end if;
end
$rollback$;

commit;
