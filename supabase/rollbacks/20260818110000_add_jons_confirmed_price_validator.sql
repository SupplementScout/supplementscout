begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $remove_jons_confirmed_price_validator$
declare
  v_target jsonb:=public.retailer_catalogue_actual_database_target();
  v_dispatch regprocedure:='public.retailer_offer_sync_validate_batch_read_only_internal(jsonb)'::regprocedure;
  v_definition text:=pg_get_functiondef(v_dispatch);
  v_added text:=$old$  if p_request ? 'jons_price_confirmation'
     and p_request#>>'{artifact,target_environment}'='PRODUCTION'
     and p_request#>>'{artifact,retailer_id}'='10' then
    return public.validate_jons_confirmed_price_read_only(p_request);
  end if;$old$;
begin
  if current_user<>'postgres' or v_target->>'target_environment'<>'PRODUCTION'
     or position(v_added in v_definition)=0 then
    raise exception 'Jon''s confirmed price validator rollback precondition failed';
  end if;
  execute replace(v_definition,v_added,'');
  drop function public.validate_jons_confirmed_price_read_only(jsonb);
end
$remove_jons_confirmed_price_validator$;

alter function public.retailer_offer_sync_validate_batch_read_only_internal(jsonb) owner to postgres;
revoke all on function public.retailer_offer_sync_validate_batch_read_only_internal(jsonb)
  from public,anon,authenticated,service_role;

commit;
