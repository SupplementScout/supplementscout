begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $rollback_two_jons_variants$
declare
  v_target jsonb:=public.retailer_catalogue_actual_database_target();
  v_installed_at timestamptz;
  v_rows integer;
begin
  if current_user<>'postgres'
     or v_target->>'target_environment'<>'PRODUCTION'
     or v_target->>'project_ref'<>'aftboxmrdgyhizicfsfu'
     or v_target->>'database_identity'<>'supplementscout-production:aftboxmrdgyhizicfsfu' then
    raise exception 'Two reviewed Jon''s rebind rollback requires production database owner';
  end if;
  select installed_at into v_installed_at
  from public.retailer_catalogue_migration_ledger
  where version='20260810200000_rebind_two_reviewed_jons_variants';
  if v_installed_at is null then raise exception 'Two Jon''s rebind migration row is missing'; end if;
  if exists(
    select 1 from public.offers
    where id in (1210,1239) and last_checked_at>v_installed_at
  ) then
    raise exception 'rollback is forbidden after corrected Jon''s offers have been refreshed';
  end if;

  update public.offers set url=case id
    when 1210 then 'https://jonssupplements.co.uk/products/cnp-professional-cream-of-rice-2kg?variant=50666562126162'
    when 1239 then 'https://jonssupplements.co.uk/products/cnp-professional-premium-whey-protein-900g?variant=50602413883730'
  end where id in (1210,1239);
  get diagnostics v_rows=row_count;
  if v_rows<>2 then raise exception 'Two Jon''s rollback offers affected % rows',v_rows; end if;

  update public.retailer_products set
    external_variant_id=case id when 1396 then '50666562126162' when 1425 then '50602413883730' end,
    external_options=case id
      when 1396 then '{"Size":"2000g","Flavour":"Chocomel cups"}'::jsonb
      when 1425 then '{"Flavour":"Salted Caramel"}'::jsonb end,
    external_url=case id
      when 1396 then 'https://jonssupplements.co.uk/products/cnp-professional-cream-of-rice-2kg?variant=50666562126162'
      when 1425 then 'https://jonssupplements.co.uk/products/cnp-professional-premium-whey-protein-900g?variant=50602413883730' end,
    updated_at=now()
  where id in (1396,1425)
    and external_variant_id in ('54182107578706','54181091279186');
  get diagnostics v_rows=row_count;
  if v_rows<>2 then raise exception 'Two Jon''s rollback mappings affected % rows',v_rows; end if;
end
$rollback_two_jons_variants$;

commit;
