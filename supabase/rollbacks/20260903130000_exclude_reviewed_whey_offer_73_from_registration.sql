begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $rollback$
declare
  v_target jsonb := public.retailer_catalogue_actual_database_target();
  v_function regprocedure := to_regprocedure('public.register_whey_okay_offer_sync_control_plan(jsonb)');
  v_definition text;
  v_guard_start text := '  if not exists('||chr(10)
    ||'    select 1 from public.retailer_products rp'||chr(10);
  v_guard_end text := '  end if;'||chr(10);
  v_start integer;
  v_end integer;
begin
  if current_user <> 'postgres'
     or v_target->>'target_environment' <> 'PRODUCTION'
     or v_function is null then
    raise exception 'Whey Okay registration exclusion rollback requires production database owner';
  end if;
  select pg_get_functiondef(v_function) into v_definition;
  v_start := strpos(v_definition,v_guard_start);
  v_end := strpos(substring(v_definition from v_start),v_guard_end);
  if v_start=0 or v_end=0
     or strpos(v_definition,'Reviewed Whey Okay offer 73 registration exclusion drift')=0
     or strpos(v_definition,'where rp.retailer_id=3 and rp.id<>65')=0
     or strpos(v_definition,'where o.retailer_id=3 and rp.id<>65')=0 then
    raise exception 'Whey Okay registration exclusion rollback state mismatch';
  end if;
  v_definition := overlay(v_definition placing '' from v_start for v_end+length(v_guard_end)-1);
  v_definition := replace(v_definition,'where rp.retailer_id=3 and rp.id<>65','where rp.retailer_id=3');
  v_definition := replace(v_definition,'where o.retailer_id=3 and rp.id<>65','where o.retailer_id=3');
  execute v_definition;
end
$rollback$;

alter function public.register_whey_okay_offer_sync_control_plan(jsonb) owner to postgres;

revoke execute on function public.validate_product_import_plan_read_only(jsonb)
  from retailer_catalogue_production_validator;

commit;
