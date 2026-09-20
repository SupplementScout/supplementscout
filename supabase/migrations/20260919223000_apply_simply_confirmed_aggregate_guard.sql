begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $repair$
declare
  v_target jsonb:=public.retailer_catalogue_actual_database_target();
  v_function regprocedure;
  v_definition text;
begin
  if current_user<>'postgres' or v_target->>'target_environment'<>'PRODUCTION' then
    raise exception 'Simply aggregate confirmation guard requires production database owner';
  end if;

  v_function:='public.require_retailer_price_confirmation(jsonb,text,text)'::regprocedure;
  v_definition:=pg_get_functiondef(v_function);
  if position('v_kind text:=v_proof->>''kind''' in v_definition)=0
     or position('p_request:=p_request-''retailer_price_confirmation''' in v_definition)=0 then
    raise exception 'Simply aggregate confirmation proof anchor mismatch';
  end if;
  v_definition:=replace(v_definition,'begin'||chr(10)||'  if v_kind=',
    'begin'||chr(10)||'  perform set_config(''app.simply_aggregate_price_confirmation'',''false'',true);'||chr(10)||'  if v_kind=');
  v_definition:=replace(v_definition,'  p_request:=p_request-''retailer_price_confirmation'';',
    '  if v_kind=''retailer-two-capture-price-confirmation-v2'' then perform set_config(''app.simply_aggregate_price_confirmation'',''true'',true); end if;'||chr(10)||'  p_request:=p_request-''retailer_price_confirmation'';');
  execute v_definition;

  v_function:='public.validate_simply_confirmed_price_read_only(jsonb)'::regprocedure;
  v_definition:=pg_get_functiondef(v_function);
  if position('v_changed::numeric/v_row_count>v_maximum_changed' in v_definition)=0
     or position('v_price_changed::numeric/v_row_count>=v_mass_price_ratio' in v_definition)=0 then
    raise exception 'Simply confirmed validator aggregate guard anchor mismatch';
  end if;
  v_definition:=replace(v_definition,
    'v_changed::numeric/v_row_count>v_maximum_changed',
    '(case when current_setting(''app.simply_aggregate_price_confirmation'',true)=''true'' then v_changed-v_price_changed else v_changed end)::numeric/v_row_count>v_maximum_changed');
  v_definition:=replace(v_definition,
    'v_price_changed::numeric/v_row_count>=v_mass_price_ratio',
    '(current_setting(''app.simply_aggregate_price_confirmation'',true) is distinct from ''true'' and v_price_changed::numeric/v_row_count>=v_mass_price_ratio)');
  execute v_definition;
end
$repair$;

alter function public.require_retailer_price_confirmation(jsonb,text,text) owner to postgres;
alter function public.validate_simply_confirmed_price_read_only(jsonb) owner to postgres;
revoke all on function public.require_retailer_price_confirmation(jsonb,text,text) from public,anon,authenticated,service_role;

commit;
