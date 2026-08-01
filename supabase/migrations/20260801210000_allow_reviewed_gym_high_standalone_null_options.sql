begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- Twelve reviewed standalone GYM HIGH rows have no source options. Preserve
-- that null identity exactly; optioned rows remain limited to small objects.
do $allow_reviewed_gym_high_standalone_null_options$
declare
  v_definition text := pg_get_functiondef(
    'public.atomic_import_is_legacy_mapping_upgrade(jsonb)'::regprocedure
  );
  v_original text := $anchor$         and jsonb_typeof(v_values->'external_options') = 'object'
         /* GYM HIGH reviewed exact-tuple control binding */
         and (select count(*) from jsonb_each(v_values->'external_options')) between 0 and 2$anchor$;
  v_replacement text := $anchor$         and jsonb_typeof(v_values->'external_options') in ('object','null')
         /* GYM HIGH reviewed standalone null-options binding */
         and (select count(*) from jsonb_each(
           case when jsonb_typeof(v_values->'external_options') = 'object'
             then v_values->'external_options' else '{}'::jsonb end
         )) between 0 and 2$anchor$;
begin
  if v_definition is null
     or position($$'1:1:1:632:632:559'$$ in v_definition) = 0
     or position($$'529:387:554:4623:4623:507'$$ in v_definition) = 0
     or position(v_original in v_definition) = 0 then
    raise exception 'GYM HIGH standalone null-options precondition failed';
  end if;
  execute replace(v_definition, v_original, v_replacement);
end;
$allow_reviewed_gym_high_standalone_null_options$;

alter function public.atomic_import_is_legacy_mapping_upgrade(jsonb) owner to postgres;
revoke all on function public.atomic_import_is_legacy_mapping_upgrade(jsonb)
  from public, anon, authenticated, service_role;

do $verify_reviewed_gym_high_standalone_null_options$
declare
  v_definition text := pg_get_functiondef(
    'public.atomic_import_is_legacy_mapping_upgrade(jsonb)'::regprocedure
  );
begin
  if position('GYM HIGH reviewed standalone null-options binding' in v_definition) = 0
     or position($$jsonb_typeof(v_values->'external_options') in ('object','null')$$ in v_definition) = 0
     or position($$case when jsonb_typeof(v_values->'external_options') = 'object'$$ in v_definition) = 0 then
    raise exception 'GYM HIGH standalone null-options verification failed';
  end if;
end;
$verify_reviewed_gym_high_standalone_null_options$;

commit;
