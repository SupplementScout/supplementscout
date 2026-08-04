begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $correct_dolphin_scope_fingerprint$
declare
  v_definition text := pg_get_functiondef(
    'public.register_dolphin_vegan_protein_offer_sync_control_plan(jsonb)'::regprocedure
  );
begin
  if v_definition is null
     or position('45dd6ef34aa0efeaf370e634b9304119ecfd2f552fa7a6e096a0dd56283ec41f' in v_definition)=0
     or position('494ce31407d2e564c93c2d9ad3ee7cb049d49b05b0806bd6c8d1f5a09421f8c1' in v_definition)>0 then
    raise exception 'Dolphin scope fingerprint correction precondition failed';
  end if;
  v_definition := replace(v_definition,
    '45dd6ef34aa0efeaf370e634b9304119ecfd2f552fa7a6e096a0dd56283ec41f',
    '494ce31407d2e564c93c2d9ad3ee7cb049d49b05b0806bd6c8d1f5a09421f8c1');
  execute v_definition;
end;
$correct_dolphin_scope_fingerprint$;

do $verify_dolphin_scope_fingerprint$
declare
  v_definition text := pg_get_functiondef(
    'public.register_dolphin_vegan_protein_offer_sync_control_plan(jsonb)'::regprocedure
  );
begin
  if position('494ce31407d2e564c93c2d9ad3ee7cb049d49b05b0806bd6c8d1f5a09421f8c1' in v_definition)=0
     or position('45dd6ef34aa0efeaf370e634b9304119ecfd2f552fa7a6e096a0dd56283ec41f' in v_definition)>0
     or position('fe0d6d278328d82f23c39711d91e262cdea8d8fa8f870f345d1260c6b6d234b7' in v_definition)=0 then
    raise exception 'Dolphin scope fingerprint correction verification failed';
  end if;
end;
$verify_dolphin_scope_fingerprint$;

commit;
