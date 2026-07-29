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
     or v_target->>'database_identity'
        <>'supplementscout-production:aftboxmrdgyhizicfsfu' then
    raise exception 'EssentialMAX Berrylicious rollback requires production database owner';
  end if;
  if exists(
    select 1
    from public.retailer_offer_sync_reviewed_mixed_change_bindings
    where authorization_id='jons-11-1d85825cbb358680-production'
  ) then
    raise exception 'rollback is forbidden after the reviewed Jon''s stock authorization is bound';
  end if;
  if not exists(
    select 1 from public.product_variants
    where id=1260
      and product_id=855
      and variant_key='berrylicious-450g'
      and display_name='Berrylicious / 450g'
      and flavour_code='berrylicious'
      and flavour_label='Berrylicious'
      and size_value=450
      and size_unit='g'
      and pack_count=1
      and product_format='powder'
      and is_active
      and not is_default
  ) or not exists(
    select 1 from public.retailer_products
    where id=1374
      and product_variant_id=1260
      and external_options='{"Size":"450g","Flavour":"Berrylicious"}'::jsonb
  ) then
    raise exception 'EssentialMAX Berrylicious rollback precondition mismatch';
  end if;

  update public.retailer_products
  set external_options='{}'::jsonb,
      updated_at=now()
  where id=1374
    and product_variant_id=1260
    and external_options='{"Size":"450g","Flavour":"Berrylicious"}'::jsonb;
  get diagnostics v_rows=row_count;
  if v_rows<>1 then
    raise exception 'EssentialMAX Berrylicious mapping rollback affected % rows',v_rows;
  end if;

  update public.product_variants
  set variant_key='default',
      display_name='Default',
      flavour_code=null,
      flavour_label=null,
      size_value=null,
      size_unit=null,
      pack_count=null,
      product_format=null,
      is_default=true
  where id=1260
    and product_id=855
    and variant_key='berrylicious-450g'
    and not is_default;
  get diagnostics v_rows=row_count;
  if v_rows<>1 then
    raise exception 'EssentialMAX Berrylicious variant rollback affected % rows',v_rows;
  end if;
end
$rollback$;

commit;
