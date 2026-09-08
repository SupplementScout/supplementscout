begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- Bind the shared existing-offer control plane to the frozen 950-row 10 Reps
-- owner-reviewed baseline. This creates no catalogue or commercial rows.
do $clone_10reps_registration$
declare
  v_definition text := pg_get_functiondef(
    'public.register_fit_house_offer_sync_control_plan(jsonb)'::regprocedure
  );
  v_count_anchor text := $anchor$  v_manifest_count := jsonb_array_length(v_manifest);$anchor$;
  v_count_replacement text := $anchor$  v_manifest_count := jsonb_array_length(v_manifest);
  if v_target <> 'PRODUCTION' then
    perform public.retailer_catalogue_raise(
      'RSBI_ENVIRONMENT_BLOCKED','10 Reps approved scope is production-only'
    );
  end if;
  if public.retailer_catalogue_sha256_json(v_manifest) is distinct from
     '47ad2a2cf797de5b3b163a91b511383e45f19ee5a2a6ee9d0a4d5bdd63747fe4' then
    perform public.retailer_catalogue_raise(
      'RSBI_SOURCE_HASH_MISMATCH','10 Reps approved scope fingerprint mismatch'
    );
  end if;
  /* 10 Reps frozen 950-offer production scope binding */$anchor$;
begin
  if v_definition is null
     or position(v_count_anchor in v_definition) = 0
     or position('a1e596f7707c851534e04e30d13f4289439449556787c572736e77b279c75292' in v_definition) = 0 then
    raise exception '10 Reps registration clone precondition failed';
  end if;

  v_definition := replace(v_definition,
    'register_fit_house_offer_sync_control_plan',
    'register_10reps_offer_sync_control_plan');
  v_definition := replace(v_definition, 'Fit House', '10 Reps');
  v_definition := replace(v_definition, 'fit-house', '10-reps');
  v_definition := replace(v_definition, 'fithouse.uk', '10reps.co.uk');
  v_definition := replace(v_definition, 'https://10reps.co.uk', 'https://www.10reps.co.uk/');
  v_definition := replace(v_definition, 'SHOPIFY', 'CSV_PRODUCT_FEED');
  v_definition := replace(v_definition,
    'a1e596f7707c851534e04e30d13f4289439449556787c572736e77b279c75292',
    '5b5c4583fc456a0cc2d1348bcada5e07faa18be3fadd8bafb8de01b9dcf7c4f8');
  v_definition := replace(v_definition, 'exactly 286', 'exactly 950');
  v_definition := replace(v_definition, '<> 286', '<> 950');
  v_definition := replace(v_definition, $$<> '9'$$, $$<> '14'$$);
  v_definition := replace(v_definition, 'where id=9 ', 'where id=14 ');
  v_definition := replace(v_definition, 'retailer_id <> 9', 'retailer_id <> 14');
  v_definition := replace(v_definition, 'retailer_id=9', 'retailer_id=14');
  v_definition := replace(v_definition, 'retailer-offer-sync:9:', 'retailer-offer-sync:14:');
  v_definition := replace(v_definition, $$'retailer_id','9'$$, $$'retailer_id','14'$$);
  v_definition := replace(v_definition, $$v_target||':9'$$, $$v_target||':14'$$);
  v_definition := replace(v_definition, 'v_parent_id,v_parent_fingerprint,9,v_target', 'v_parent_id,v_parent_fingerprint,14,v_target');
  v_definition := replace(v_definition, $$v_parent_id,9,v_target$$, $$v_parent_id,14,v_target$$);
  v_definition := replace(v_definition, v_count_anchor, v_count_replacement);

  execute v_definition;
end;
$clone_10reps_registration$;

alter function public.register_10reps_offer_sync_control_plan(jsonb) owner to postgres;
revoke all on function public.register_10reps_offer_sync_control_plan(jsonb)
  from public, anon, authenticated, service_role;

do $grant_10reps_registration$
begin
  if to_regrole('retailer_catalogue_production_validator') is not null then
    grant execute on function public.register_10reps_offer_sync_control_plan(jsonb)
      to retailer_catalogue_production_validator;
  end if;
end;
$grant_10reps_registration$;

do $verify_10reps_registration$
declare
  v_definition text := pg_get_functiondef(
    'public.register_10reps_offer_sync_control_plan(jsonb)'::regprocedure
  );
begin
  if position('10 Reps frozen 950-offer production scope binding' in v_definition) = 0
     or position('47ad2a2cf797de5b3b163a91b511383e45f19ee5a2a6ee9d0a4d5bdd63747fe4' in v_definition) = 0
     or position('5b5c4583fc456a0cc2d1348bcada5e07faa18be3fadd8bafb8de01b9dcf7c4f8' in v_definition) = 0
     or position($$p_request->>'retailer_id' <> '14'$$ in v_definition) = 0
     or position($$p_request->>'retailer_slug' <> '10-reps'$$ in v_definition) = 0
     or position($$p_request->>'source_platform' <> 'CSV_PRODUCT_FEED'$$ in v_definition) = 0
     or position('jsonb_array_length(v_manifest) <> 950' in v_definition) = 0 then
    raise exception '10 Reps registration verification failed';
  end if;
end;
$verify_10reps_registration$;

commit;
