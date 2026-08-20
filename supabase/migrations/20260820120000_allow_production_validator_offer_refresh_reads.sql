begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $validator_read_scope$
declare
  v_target jsonb:=public.retailer_catalogue_actual_database_target();
begin
  if current_user<>'postgres' or v_target->>'target_environment'<>'PRODUCTION' then
    raise exception 'Production validator read scope requires production database owner';
  end if;
  if to_regrole('retailer_catalogue_production_validator') is null then
    raise exception 'Production validator role is missing';
  end if;
end
$validator_read_scope$;

grant select on table
  public.retailers,
  public.products,
  public.product_variants,
  public.retailer_products,
  public.offers,
  public.price_history
to retailer_catalogue_production_validator;

commit;
