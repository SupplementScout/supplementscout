begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $restore_whey_okay_manifest$
declare
  v_function regprocedure := to_regprocedure(
    'public.register_retailer_offer_sync_control_plan(jsonb)'
  );
  v_definition text;
  v_previous_hash text :=
    '9532725e0ad538b1656172c1531c49d8acd68e95d1ef459917bbdbd3f4e9d8f7';
  v_rebound_hash text :=
    '52565db2747d905fa2db68162ebd56b1b4e5b8a3d007bb10c144f2213e216905';
begin
  if v_function is null then
    raise exception 'Whey Okay registration function is missing';
  end if;

  select pg_get_functiondef(v_function) into v_definition;
  if strpos(v_definition, v_rebound_hash) = 0
     or strpos(v_definition, v_previous_hash) > 0
     or (
       length(v_definition) - length(replace(v_definition, v_rebound_hash, ''))
     ) / length(v_rebound_hash) <> 1 then
    raise exception 'Whey Okay registration rollback hash anchor/state mismatch';
  end if;

  execute replace(v_definition, v_rebound_hash, v_previous_hash);
end
$restore_whey_okay_manifest$;

alter function public.register_retailer_offer_sync_control_plan(jsonb)
  owner to postgres;

do $verify_whey_okay_manifest_restore$
declare
  v_definition text := pg_get_functiondef(
    'public.register_retailer_offer_sync_control_plan(jsonb)'::regprocedure
  );
begin
  if strpos(
       v_definition,
       '9532725e0ad538b1656172c1531c49d8acd68e95d1ef459917bbdbd3f4e9d8f7'
     ) = 0
     or strpos(
       v_definition,
       '52565db2747d905fa2db68162ebd56b1b4e5b8a3d007bb10c144f2213e216905'
     ) > 0 then
    raise exception 'Whey Okay registration manifest rollback verification failed';
  end if;
end
$verify_whey_okay_manifest_restore$;

commit;
