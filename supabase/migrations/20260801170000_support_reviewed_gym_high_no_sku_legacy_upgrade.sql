begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- Control-plane tooling only. No business rows are changed. The exception is
-- limited to the 21 exact owner-reviewed supplement/simple GYM HIGH legacy
-- identity tuples. Three accessory identities use a separate transactional
-- migration because they do not have numeric size evidence.
do $patch_reviewed_gym_high_no_sku$
declare
  v_fn text;
  v_old text;
  v_new text;
begin
  select pg_get_functiondef('public.atomic_import_is_legacy_mapping_upgrade(jsonb)'::regprocedure) into v_fn;
  if v_fn is null then
    raise exception 'atomic_import_is_legacy_mapping_upgrade(jsonb) is missing';
  end if;

  v_old := $fragment$and not (v_values->'external_options' ? 'Size')
       )
     )$fragment$;
  v_new := $fragment$and not (v_values->'external_options' ? 'Size')
       )
       and not (
         v_retailer_id = 1
         and v_retailer_id = (select id from public.retailers where slug = 'gym-high' limit 1)
         and concat_ws(':', v_product_id, v_mapping_id, v_offer_id,
           v_values->>'external_product_id', v_values->>'external_variant_id', v_variant_id)
           = any (array[
             '1:1:1:632:632:559',
             '403:3:4:661:676:956',
             '367:4:5:696:697:1044',
             '414:5:6:639:640:2741',
             '411:76:539:680:681:1047',
             '444:77:542:702:702:533',
             '390:78:543:703:704:1064',
             '429:106:535:635:635:391',
             '495:135:549:738:739:1843',
             '508:136:550:2796:2796:435',
             '510:137:538:3627:4299:999',
             '527:138:553:3955:3957:2711',
             '427:139:536:638:638:379',
             '408:140:537:646:1337:2735',
             '412:141:540:700:700:400',
             '413:142:544:707:707:390',
             '445:144:546:712:712:574',
             '389:384:541:701:701:555',
             '516:385:551:3333:3333:572',
             '525:386:552:3405:3405:510',
             '529:387:554:4623:4623:507'
           ])
         and coalesce(v_expected->'external_sku', 'null'::jsonb) = 'null'::jsonb
         and nullif(v_values->>'external_sku','') is null
         and v_values->>'external_url' = 'https://gymhigh.co.uk/?post_type=product&p=' || (v_values->>'external_product_id')
         and v_evidence->>'reviewed_gym_high_no_sku_identity' = 'true'
         and jsonb_typeof(v_values->'external_options') = 'object'
         and (select count(*) from jsonb_each(v_values->'external_options')) between 0 and 2
       )
     )$fragment$;

  if position(v_new in v_fn) = 0 then
    if position(v_old in v_fn) = 0 then
      raise exception 'reviewed GYM HIGH no-SKU patch target not found';
    end if;
    if position(v_old in substring(v_fn from position(v_old in v_fn) + length(v_old))) > 0 then
      raise exception 'reviewed GYM HIGH no-SKU patch target is ambiguous';
    end if;
    v_fn := replace(v_fn, v_old, v_new);
    execute v_fn;
  end if;
end;
$patch_reviewed_gym_high_no_sku$;

alter function public.atomic_import_is_legacy_mapping_upgrade(jsonb) owner to postgres;
revoke all on function public.atomic_import_is_legacy_mapping_upgrade(jsonb) from public, anon, authenticated, service_role;

do $verify_reviewed_gym_high_no_sku$
declare
  v_fn text;
begin
  select pg_get_functiondef('public.atomic_import_is_legacy_mapping_upgrade(jsonb)'::regprocedure) into v_fn;
  if position($$'1:1:1:632:632:559'$$ in v_fn) = 0
     or position($$'390:78:543:703:704:1064'$$ in v_fn) = 0
     or position($$'529:387:554:4623:4623:507'$$ in v_fn) = 0
     or position($$v_evidence->>'reviewed_gym_high_no_sku_identity' = 'true'$$ in v_fn) = 0 then
    raise exception 'reviewed GYM HIGH no-SKU patch verification failed';
  end if;
end;
$verify_reviewed_gym_high_no_sku$;

commit;
