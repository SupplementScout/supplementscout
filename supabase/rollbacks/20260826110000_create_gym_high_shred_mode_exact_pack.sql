begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';

do $rollback$
declare
  v_target jsonb := public.retailer_catalogue_actual_database_target();
  v_new_id bigint;
  v_rows integer;
  v_variants_before bigint;
  v_history_before bigint;
  v_series_before bigint;
begin
  if current_user<>'postgres'
     or v_target->>'target_environment'<>'PRODUCTION'
     or v_target->>'project_ref'<>'aftboxmrdgyhizicfsfu'
     or v_target->>'database_identity'<>'supplementscout-production:aftboxmrdgyhizicfsfu'
     or not exists(select 1 from supabase_migrations.schema_migrations
       where version='20260826110000' and name='create_gym_high_shred_mode_exact_pack') then
    raise exception 'GYM HIGH Shred Mode rollback target or ledger mismatch';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('supplementscout:gym-high-exact-pack:create_gym_high_shred_mode_exact_pack',0));
  select id into v_new_id from public.product_variants
    where product_id=508 and variant_key='60-servings' and display_name='60 Servings'
      and flavour_code is null and flavour_label is null and size_value=60
      and size_unit='servings' and pack_count=1 and product_format is null
      and gtin is null and image is null and nutrition_override='{}'::jsonb
      and is_active and not is_default for update;
  if v_new_id is null
     or not exists(select 1 from public.product_variants where id=435 and product_id=508
       and variant_key='default' and display_name='Default' and size_value is null
       and size_unit is null and pack_count is null and is_active and is_default)
     or not exists(select 1 from public.retailer_products where id=136 and retailer_id=1
       and product_id=508 and product_variant_id=v_new_id)
     or not exists(select 1 from public.offers where id=550 and retailer_id=1
       and product_id=508 and retailer_product_id=136 and product_variant_id=v_new_id)
     or exists(select 1 from public.price_identity_series where offer_id=550)
     or (select count(*) from public.retailer_products where product_variant_id=v_new_id)<>1
     or (select count(*) from public.offers where product_variant_id=v_new_id)<>1 then
    raise exception 'GYM HIGH Shred Mode rollback guard mismatch';
  end if;
  select count(*) into v_variants_before from public.product_variants;
  select count(*) into v_history_before from public.price_history;
  select count(*) into v_series_before from public.price_identity_series;
  update public.retailer_products set product_variant_id=435 where id=136 and retailer_id=1 and product_variant_id=v_new_id;
  get diagnostics v_rows=row_count;
  if v_rows<>1 then raise exception 'GYM HIGH Shred Mode mapping rollback affected % rows',v_rows; end if;
  update public.offers set product_variant_id=435 where id=550 and retailer_product_id=136 and product_variant_id=v_new_id;
  get diagnostics v_rows=row_count;
  if v_rows<>1 then raise exception 'GYM HIGH Shred Mode offer rollback affected % rows',v_rows; end if;
  delete from public.product_variants where id=v_new_id;
  get diagnostics v_rows=row_count;
  if v_rows<>1 then raise exception 'GYM HIGH Shred Mode variant rollback affected % rows',v_rows; end if;
  if (select count(*) from public.product_variants)<>v_variants_before-1
     or (select count(*) from public.price_history)<>v_history_before
     or (select count(*) from public.price_identity_series)<>v_series_before then
    raise exception 'GYM HIGH Shred Mode rollback postcondition mismatch';
  end if;
end
$rollback$;

commit;
