begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $disable_fit_house_producer$
declare
  v_target jsonb := public.retailer_catalogue_actual_database_target();
  v_rows integer;
begin
  if current_user <> 'postgres'
     or v_target->>'target_environment' <> 'PRODUCTION'
     or v_target->>'project_ref' <> 'aftboxmrdgyhizicfsfu'
     or v_target->>'database_identity' <> 'supplementscout-production:aftboxmrdgyhizicfsfu' then
    raise exception 'Fit House producer rollback target mismatch';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('supplementscout:enable-fit-house-price-observation-producer', 0));
  update public.price_observation_producers
  set enabled=false,updated_at=clock_timestamp()
  where retailer_id=9 and retailer_slug='fit-house'
    and source_importer='retailer_offer_mixed_batch'
    and approved_scope='approved-286' and technically_capable and enabled
    and public_use='eligible-after-separate-approval'
    and terms_mode='standard-single-purchase-only';
  get diagnostics v_rows=row_count;
  if v_rows<>1 then raise exception 'Fit House producer rollback changed an unexpected row count'; end if;
  if (select count(*) from public.price_observation_producers where enabled)<>2
     or not exists(select 1 from public.price_observation_producers where retailer_id=1 and enabled)
     or not exists(select 1 from public.price_observation_producers where retailer_id=10 and enabled)
     or exists(select 1 from public.price_observation_producers where retailer_id=9 and enabled) then
    raise exception 'Fit House producer rollback postcondition failed';
  end if;
end
$disable_fit_house_producer$;

commit;
