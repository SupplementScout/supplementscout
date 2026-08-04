begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- Reuse the established guarded registration contract and freeze it to the
-- single owner-approved, already-existing Dolphin offer. No catalogue DML.
do $clone_dolphin_registration$
declare
  v_definition text := pg_get_functiondef(
    'public.register_fit_house_offer_sync_control_plan(jsonb)'::regprocedure
  );
  v_count_anchor text := $anchor$  v_manifest_count := jsonb_array_length(v_manifest);$anchor$;
  v_count_replacement text := $anchor$  v_manifest_count := jsonb_array_length(v_manifest);
  if v_target <> 'PRODUCTION' then
    perform public.retailer_catalogue_raise(
      'RSBI_ENVIRONMENT_BLOCKED','Dolphin approved scope is production-only'
    );
  end if;
  if public.retailer_catalogue_sha256_json(v_manifest) is distinct from
     '45dd6ef34aa0efeaf370e634b9304119ecfd2f552fa7a6e096a0dd56283ec41f' then
    perform public.retailer_catalogue_raise(
      'RSBI_SOURCE_HASH_MISMATCH','Dolphin approved scope fingerprint mismatch'
    );
  end if;
  /* Dolphin frozen one-offer production scope binding */$anchor$;
begin
  if v_definition is null
     or position(v_count_anchor in v_definition) = 0
     or position('8a3653774c7169b40db0dfa129bba83d3cb496b17f25513a256b8fa84999897f' in v_definition) = 0 then
    raise exception 'Dolphin registration clone precondition failed';
  end if;

  v_definition := replace(v_definition,
    'register_fit_house_offer_sync_control_plan',
    'register_dolphin_vegan_protein_offer_sync_control_plan');
  v_definition := replace(v_definition, 'Fit House', 'Dolphin Fitness');
  v_definition := replace(v_definition, 'fit-house', 'dolphin-fitness');
  v_definition := replace(v_definition, 'fithouse.uk', 'dolphinfitness.co.uk');
  v_definition := replace(v_definition, 'https://dolphinfitness.co.uk', 'https://www.dolphinfitness.co.uk');
  v_definition := replace(v_definition, $$'source_platform' <> 'SHOPIFY'$$, $$'source_platform' <> 'PRODUCT_PAGE'$$);
  v_definition := replace(v_definition, 'Shopify manifest', 'product-page manifest');
  v_definition := replace(v_definition,
    '8a3653774c7169b40db0dfa129bba83d3cb496b17f25513a256b8fa84999897f',
    'fe0d6d278328d82f23c39711d91e262cdea8d8fa8f870f345d1260c6b6d234b7');
  v_definition := replace(v_definition, 'exactly 286', 'exactly 1');
  v_definition := replace(v_definition, '<> 286', '<> 1');
  v_definition := replace(v_definition, $$<> '9'$$, $$<> '5'$$);
  v_definition := replace(v_definition, 'where id=9 ', 'where id=5 ');
  v_definition := replace(v_definition, 'retailer_id <> 9', 'retailer_id <> 5');
  v_definition := replace(v_definition, 'retailer_id=9', 'retailer_id=5');
  v_definition := replace(v_definition, 'retailer-offer-sync:9:', 'retailer-offer-sync:5:');
  v_definition := replace(v_definition, $$'retailer_id','9'$$, $$'retailer_id','5'$$);
  v_definition := replace(v_definition, $$v_target||':9'$$, $$v_target||':5'$$);
  v_definition := replace(v_definition, 'v_parent_id,v_parent_fingerprint,9,v_target', 'v_parent_id,v_parent_fingerprint,5,v_target');
  v_definition := replace(v_definition, $$v_parent_id,9,v_target$$, $$v_parent_id,5,v_target$$);
  v_definition := replace(v_definition, v_count_anchor, v_count_replacement);

  execute v_definition;
end;
$clone_dolphin_registration$;

alter function public.register_dolphin_vegan_protein_offer_sync_control_plan(jsonb)
  owner to postgres;
revoke all on function public.register_dolphin_vegan_protein_offer_sync_control_plan(jsonb)
  from public, anon, authenticated, service_role;

do $grant_dolphin_registration$
begin
  if to_regrole('retailer_catalogue_production_validator') is not null then
    grant execute on function public.register_dolphin_vegan_protein_offer_sync_control_plan(jsonb)
      to retailer_catalogue_production_validator;
  end if;
end;
$grant_dolphin_registration$;

do $verify_dolphin_registration$
declare
  v_definition text := pg_get_functiondef(
    'public.register_dolphin_vegan_protein_offer_sync_control_plan(jsonb)'::regprocedure
  );
begin
  if position('Dolphin frozen one-offer production scope binding' in v_definition) = 0
     or position('45dd6ef34aa0efeaf370e634b9304119ecfd2f552fa7a6e096a0dd56283ec41f' in v_definition) = 0
     or position('fe0d6d278328d82f23c39711d91e262cdea8d8fa8f870f345d1260c6b6d234b7' in v_definition) = 0
     or position($$p_request->>'retailer_id' <> '5'$$ in v_definition) = 0
     or position($$p_request->>'retailer_slug' <> 'dolphin-fitness'$$ in v_definition) = 0
     or position($$p_request->>'source_platform' <> 'PRODUCT_PAGE'$$ in v_definition) = 0
     or position('jsonb_array_length(v_manifest) <> 1' in v_definition) = 0 then
    raise exception 'Dolphin registration verification failed';
  end if;
end;
$verify_dolphin_registration$;

commit;
