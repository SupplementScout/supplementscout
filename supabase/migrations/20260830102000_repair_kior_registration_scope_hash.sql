begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $repair_kior_registration_hash$
declare
  v_old_hash constant text := '30e1dbc1147484a790384dd10f9fc79433ca6edd4728aab7ffbd7b4045fbef3c';
  v_new_hash constant text := '53332a61b4826f53dbeeeda66bceab580bcc20e4383ab9477ca29e2fb1a9addb';
  v_definition text := pg_get_functiondef(
    'public.register_kior_offer_sync_control_plan(jsonb)'::regprocedure
  );
begin
  if v_definition is null
     or position('KIOR frozen eleven-offer production scope binding' in v_definition) = 0
     or position(v_old_hash in v_definition) = 0
     or position(v_new_hash in v_definition) <> 0
     or position(v_old_hash in substr(v_definition, position(v_old_hash in v_definition) + length(v_old_hash))) <> 0 then
    raise exception 'KIOR registration hash repair precondition failed';
  end if;

  v_definition := replace(v_definition, v_old_hash, v_new_hash);
  execute v_definition;
end;
$repair_kior_registration_hash$;

do $verify_kior_registration_hash$
declare
  v_definition text := pg_get_functiondef(
    'public.register_kior_offer_sync_control_plan(jsonb)'::regprocedure
  );
begin
  if position('53332a61b4826f53dbeeeda66bceab580bcc20e4383ab9477ca29e2fb1a9addb' in v_definition) = 0
     or position('30e1dbc1147484a790384dd10f9fc79433ca6edd4728aab7ffbd7b4045fbef3c' in v_definition) <> 0
     or position('KIOR frozen eleven-offer production scope binding' in v_definition) = 0 then
    raise exception 'KIOR registration hash repair verification failed';
  end if;
end;
$verify_kior_registration_hash$;

commit;
