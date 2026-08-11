begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

lock table public.products in share row exclusive mode;

do $rollback_reviewed_mass_gainer_metadata$
declare
  v_target jsonb := public.retailer_catalogue_actual_database_target();
  v_rows integer;
begin
  if current_user <> 'postgres'
     or v_target->>'target_environment' <> 'PRODUCTION'
     or v_target->>'project_ref' <> 'aftboxmrdgyhizicfsfu'
     or v_target->>'database_identity' <> 'supplementscout-production:aftboxmrdgyhizicfsfu' then
    raise exception 'Reviewed Mass Gainer metadata rollback requires production database owner';
  end if;

  if not exists (
       select 1 from supabase_migrations.schema_migrations
       where version='20260811030000' and name='correct_reviewed_mass_gainer_metadata'
     )
     or not exists (
       select 1 from public.products
       where id=128 and name='7Nutrition Bodybuilder 1.5kg'
         and slug='7nutrition-bodybuilder-15kg' and brand='7Nutrition'
         and category='Mass Gainer' and product_format='powder'
         and is_active and merged_into_product_id is null and merged_at is null
     )
     or not exists (
       select 1 from public.products
       where id=132 and name='Applied Nutrition Critical Mass Lean Mass Gainz 2.4kg'
         and slug='applied-nutrition-critical-mass-lean-mass-gainz-24kg'
         and brand='Applied Nutrition'
         and category='Mass Gainer' and product_format='powder'
         and is_active and merged_into_product_id is null and merged_at is null
     ) then
    raise exception 'Reviewed Mass Gainer metadata rollback precondition mismatch';
  end if;

  update public.products
  set category='Health Supplements', product_format=null
  where id in (128,132)
    and category='Mass Gainer' and product_format='powder'
    and is_active and merged_into_product_id is null and merged_at is null;
  get diagnostics v_rows=row_count;
  if v_rows <> 2 then
    raise exception 'Reviewed Mass Gainer metadata rollback affected % products',v_rows;
  end if;

  if (select count(*) from public.products
      where id in (128,132) and category='Health Supplements' and product_format is null
        and is_active and merged_into_product_id is null and merged_at is null) <> 2 then
    raise exception 'Reviewed Mass Gainer metadata rollback postcondition mismatch';
  end if;
end
$rollback_reviewed_mass_gainer_metadata$;

commit;
