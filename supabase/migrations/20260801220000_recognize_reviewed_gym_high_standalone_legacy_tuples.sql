begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- Extend the legacy helper's standalone branch only to the twelve exact
-- owner-reviewed GYM HIGH tuples. All existing state and identity checks that
-- follow this branch remain mandatory.
do $recognize_reviewed_gym_high_standalone_tuples$
declare
  v_definition text := pg_get_functiondef(
    'public.atomic_import_is_legacy_mapping_upgrade(jsonb)'::regprocedure
  );
  v_original text := $anchor$    and v_retailer_id = (select id from public.retailers where slug='whey-okay' limit 1)
    and v_values->>'external_product_id' = v_values->>'external_variant_id'$anchor$;
  v_replacement text := $anchor$    and (
      v_retailer_id = (select id from public.retailers where slug='whey-okay' limit 1)
      or (
        v_retailer_id = 1
        and v_retailer_id = (select id from public.retailers where slug='gym-high' limit 1)
        and concat_ws(':', v_product_id, v_mapping_id, v_offer_id,
          v_values->>'external_product_id', v_values->>'external_variant_id', v_variant_id)
          = any (array[
            '1:1:1:632:632:559',
            '444:77:542:702:702:533',
            '429:106:535:635:635:391',
            '508:136:550:2796:2796:435',
            '427:139:536:638:638:379',
            '412:141:540:700:700:400',
            '413:142:544:707:707:390',
            '445:144:546:712:712:574',
            '389:384:541:701:701:555',
            '516:385:551:3333:3333:572',
            '525:386:552:3405:3405:510',
            '529:387:554:4623:4623:507'
          ])
        /* GYM HIGH reviewed standalone legacy tuples */
      )
    )
    and v_values->>'external_product_id' = v_values->>'external_variant_id'$anchor$;
begin
  if v_definition is null
     or position('GYM HIGH reviewed standalone null-options binding' in v_definition) = 0
     or position(v_original in v_definition) = 0 then
    raise exception 'GYM HIGH standalone tuple recognition precondition failed';
  end if;
  execute replace(v_definition, v_original, v_replacement);
end;
$recognize_reviewed_gym_high_standalone_tuples$;

alter function public.atomic_import_is_legacy_mapping_upgrade(jsonb) owner to postgres;
revoke all on function public.atomic_import_is_legacy_mapping_upgrade(jsonb)
  from public, anon, authenticated, service_role;

do $verify_reviewed_gym_high_standalone_tuples$
declare
  v_definition text := pg_get_functiondef(
    'public.atomic_import_is_legacy_mapping_upgrade(jsonb)'::regprocedure
  );
begin
  if position('GYM HIGH reviewed standalone legacy tuples' in v_definition) = 0
     or position($$'1:1:1:632:632:559'$$ in v_definition) = 0
     or position($$'529:387:554:4623:4623:507'$$ in v_definition) = 0
     or position($$v_values->>'external_product_id' = v_values->>'external_variant_id'$$ in v_definition) = 0 then
    raise exception 'GYM HIGH standalone tuple recognition verification failed';
  end if;
end;
$verify_reviewed_gym_high_standalone_tuples$;

commit;
