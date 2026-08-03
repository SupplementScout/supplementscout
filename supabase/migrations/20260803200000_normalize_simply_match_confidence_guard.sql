begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- The shared plan schema canonicalizes numeric confidence (90.00 -> "90").
-- Compare the existing Simply confidence numerically while preserving every
-- other exact expected-state guard.
do $normalize_simply_match_confidence$
declare
  v_definition text := pg_get_functiondef(
    'public.atomic_import_is_simply_identity_only_upgrade(jsonb)'::regprocedure
  );
  v_original text := $anchor$     or v_mapping.match_confidence::text is distinct from v_expected->>'match_confidence'$anchor$;
  v_replacement text := $anchor$     or v_mapping.match_confidence is distinct from
        nullif(v_expected->>'match_confidence','')::numeric
     /* Simply canonical numeric confidence binding */$anchor$;
begin
  if v_definition is null
     or position('Simply complete reviewed options binding' in v_definition) = 0
     or position(v_original in v_definition) = 0 then
    raise exception 'Simply confidence normalization precondition failed';
  end if;
  execute replace(v_definition, v_original, v_replacement);
end;
$normalize_simply_match_confidence$;

alter function public.atomic_import_is_simply_identity_only_upgrade(jsonb) owner to postgres;
revoke all on function public.atomic_import_is_simply_identity_only_upgrade(jsonb)
  from public, anon, authenticated, service_role;

do $verify_simply_match_confidence$
declare
  v_definition text := pg_get_functiondef(
    'public.atomic_import_is_simply_identity_only_upgrade(jsonb)'::regprocedure
  );
begin
  if position('Simply canonical numeric confidence binding' in v_definition) = 0
     or position($$nullif(v_expected->>'match_confidence','')::numeric$$ in v_definition) = 0 then
    raise exception 'Simply confidence normalization verification failed';
  end if;
end;
$verify_simply_match_confidence$;

commit;
