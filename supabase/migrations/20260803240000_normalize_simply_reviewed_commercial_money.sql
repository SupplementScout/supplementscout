begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $normalize_commercial_money$
declare
  v_target jsonb:=public.retailer_catalogue_actual_database_target();
  v_definition text;
  v_pair text[];
  v_replacements text[][]:=array[
    array[$old$v_row#>>'{atomic_plan,expected_state,offer,price}' is distinct from v_reviewed_row#>>'{before,price}'$old$,$new$(v_row#>>'{atomic_plan,expected_state,offer,price}')::numeric is distinct from (v_reviewed_row#>>'{before,price}')::numeric$new$],
    array[$old$v_row#>>'{atomic_plan,expected_state,offer,shipping_cost}' is distinct from v_reviewed_row#>>'{before,shipping_cost}'$old$,$new$(v_row#>>'{atomic_plan,expected_state,offer,shipping_cost}')::numeric is distinct from (v_reviewed_row#>>'{before,shipping_cost}')::numeric$new$],
    array[$old$v_row#>>'{atomic_plan,expected_state,offer,total_price}' is distinct from v_reviewed_row#>>'{before,total_price}'$old$,$new$(v_row#>>'{atomic_plan,expected_state,offer,total_price}')::numeric is distinct from (v_reviewed_row#>>'{before,total_price}')::numeric$new$],
    array[$old$v_row#>>'{atomic_plan,offer,values,price}' is distinct from v_reviewed_row#>>'{after,price}'$old$,$new$(v_row#>>'{atomic_plan,offer,values,price}')::numeric is distinct from (v_reviewed_row#>>'{after,price}')::numeric$new$],
    array[$old$v_row#>>'{atomic_plan,offer,values,shipping_cost}' is distinct from v_reviewed_row#>>'{after,shipping_cost}'$old$,$new$(v_row#>>'{atomic_plan,offer,values,shipping_cost}')::numeric is distinct from (v_reviewed_row#>>'{after,shipping_cost}')::numeric$new$],
    array[$old$v_row#>>'{atomic_plan,offer,values,total_price}' is distinct from v_reviewed_row#>>'{after,total_price}'$old$,$new$(v_row#>>'{atomic_plan,offer,values,total_price}')::numeric is distinct from (v_reviewed_row#>>'{after,total_price}')::numeric$new$]
  ];
begin
  if current_user<>'postgres'
     or v_target->>'target_environment'<>'PRODUCTION'
     or v_target->>'project_ref'<>'aftboxmrdgyhizicfsfu'
     or v_target->>'database_identity'<>'supplementscout-production:aftboxmrdgyhizicfsfu' then
    raise exception 'Simply reviewed commercial money normalization requires production database owner';
  end if;
  if not exists(
    select 1 from public.retailer_offer_sync_reviewed_mixed_change_definitions
    where authorization_id='simply-49-2bc798f9fb7db4af-production'
      and contract_version=4
  ) then
    raise exception 'Simply reviewed commercial authorization is missing';
  end if;
  v_definition:=pg_get_functiondef('public.retailer_offer_sync_validate_reviewed_commercial_change_v4(jsonb,jsonb,timestamptz)'::regprocedure);
  foreach v_pair slice 1 in array v_replacements loop
    if position(v_pair[1] in v_definition)=0 then
      raise exception 'Simply reviewed commercial money anchor is missing';
    end if;
    v_definition:=replace(v_definition,v_pair[1],v_pair[2]);
  end loop;
  execute v_definition;
end
$normalize_commercial_money$;

do $verify_commercial_money$
declare
  v_definition text:=pg_get_functiondef('public.retailer_offer_sync_validate_reviewed_commercial_change_v4(jsonb,jsonb,timestamptz)'::regprocedure);
begin
  if position($check$(v_row#>>'{atomic_plan,offer,values,total_price}')::numeric is distinct from (v_reviewed_row#>>'{after,total_price}')::numeric$check$ in v_definition)=0
     or position($check$v_row#>>'{atomic_plan,offer,values,total_price}' is distinct from v_reviewed_row#>>'{after,total_price}'$check$ in v_definition)>0 then
    raise exception 'Simply reviewed commercial numeric-money verification failed';
  end if;
end
$verify_commercial_money$;

commit;
