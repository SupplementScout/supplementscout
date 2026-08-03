begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- Reuse the existing guarded Shopify registration contract while freezing it
-- to the owner-approved 120-row Simply Supplements identity scope.
do $clone_simply_registration$
declare
  v_definition text := pg_get_functiondef(
    'public.register_fit_house_offer_sync_control_plan(jsonb)'::regprocedure
  );
  v_count_anchor text := $anchor$  v_manifest_count := jsonb_array_length(v_manifest);$anchor$;
  v_count_replacement text := $anchor$  v_manifest_count := jsonb_array_length(v_manifest);
  if public.retailer_catalogue_sha256_json(v_manifest) is distinct from
     '514327e15c2fd50013bc17dc853676331e3120734626bdf0da1ae4130b031611' then
    perform public.retailer_catalogue_raise(
      'RSBI_SOURCE_HASH_MISMATCH','Simply Supplements approved scope fingerprint mismatch'
    );
  end if;
  /* Simply Supplements frozen 120-row scope binding */$anchor$;
begin
  if v_definition is null
     or position(v_count_anchor in v_definition) = 0
     or position('8a3653774c7169b40db0dfa129bba83d3cb496b17f25513a256b8fa84999897f' in v_definition) = 0 then
    raise exception 'Simply Supplements registration clone precondition failed';
  end if;

  v_definition := replace(v_definition,
    'register_fit_house_offer_sync_control_plan',
    'register_simply_supplements_offer_sync_control_plan');
  v_definition := replace(v_definition, 'Fit House', 'Simply Supplements');
  v_definition := replace(v_definition, 'fit-house', 'simply-supplements');
  v_definition := replace(v_definition, 'fithouse.uk', 'simplysupplements.co.uk');
  v_definition := replace(v_definition, 'https://simplysupplements.co.uk', 'https://www.simplysupplements.co.uk');
  v_definition := replace(v_definition,
    '8a3653774c7169b40db0dfa129bba83d3cb496b17f25513a256b8fa84999897f',
    '73ad2a3268736ccc472c5fdf58523cf43f39a1cf6d1babd0b3fe118803f9c554');
  v_definition := replace(v_definition, 'exactly 286', 'exactly 120');
  v_definition := replace(v_definition, '<> 286', '<> 120');
  v_definition := replace(v_definition, $$<> '9'$$, $$<> '7'$$);
  v_definition := replace(v_definition, 'where id=9 ', 'where id=7 ');
  v_definition := replace(v_definition, 'retailer_id <> 9', 'retailer_id <> 7');
  v_definition := replace(v_definition, 'retailer_id=9', 'retailer_id=7');
  v_definition := replace(v_definition, 'retailer-offer-sync:9:', 'retailer-offer-sync:7:');
  v_definition := replace(v_definition, $$'retailer_id','9'$$, $$'retailer_id','7'$$);
  v_definition := replace(v_definition, $$v_target||':9'$$, $$v_target||':7'$$);
  v_definition := replace(v_definition, 'v_parent_id,v_parent_fingerprint,9,v_target', 'v_parent_id,v_parent_fingerprint,7,v_target');
  v_definition := replace(v_definition, $$v_parent_id,9,v_target$$, $$v_parent_id,7,v_target$$);
  v_definition := replace(v_definition, v_count_anchor, v_count_replacement);

  execute v_definition;
end;
$clone_simply_registration$;

alter function public.register_simply_supplements_offer_sync_control_plan(jsonb)
  owner to postgres;
revoke all on function public.register_simply_supplements_offer_sync_control_plan(jsonb)
  from public, anon, authenticated, service_role;

do $grant_simply_registration$
begin
  if to_regrole('retailer_catalogue_staging_validator') is not null then
    grant execute on function public.register_simply_supplements_offer_sync_control_plan(jsonb)
      to retailer_catalogue_staging_validator;
  end if;
  if to_regrole('retailer_catalogue_production_validator') is not null then
    grant execute on function public.register_simply_supplements_offer_sync_control_plan(jsonb)
      to retailer_catalogue_production_validator;
  end if;
end;
$grant_simply_registration$;

do $verify_simply_registration$
declare
  v_definition text := pg_get_functiondef(
    'public.register_simply_supplements_offer_sync_control_plan(jsonb)'::regprocedure
  );
begin
  if position('Simply Supplements frozen 120-row scope binding' in v_definition) = 0
     or position('514327e15c2fd50013bc17dc853676331e3120734626bdf0da1ae4130b031611' in v_definition) = 0
     or position('73ad2a3268736ccc472c5fdf58523cf43f39a1cf6d1babd0b3fe118803f9c554' in v_definition) = 0
     or position($$p_request->>'retailer_id' <> '7'$$ in v_definition) = 0
     or position($$p_request->>'retailer_slug' <> 'simply-supplements'$$ in v_definition) = 0
     or position('jsonb_array_length(v_manifest) <> 120' in v_definition) = 0 then
    raise exception 'Simply Supplements registration verification failed';
  end if;
end;
$verify_simply_registration$;

commit;
