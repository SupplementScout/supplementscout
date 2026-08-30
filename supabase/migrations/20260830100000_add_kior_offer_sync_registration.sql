begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- Reuse the shared existing-offer control-plane registration and freeze it to
-- the exact eleven owner-approved KIOR mappings. This migration creates no
-- catalogue rows and changes no commercial or freshness field.
do $clone_kior_registration$
declare
  v_definition text := pg_get_functiondef(
    'public.register_fit_house_offer_sync_control_plan(jsonb)'::regprocedure
  );
  v_count_anchor text := $anchor$  v_manifest_count := jsonb_array_length(v_manifest);$anchor$;
  v_count_replacement text := $anchor$  v_manifest_count := jsonb_array_length(v_manifest);
  if v_target <> 'PRODUCTION' then
    perform public.retailer_catalogue_raise(
      'RSBI_ENVIRONMENT_BLOCKED','KIOR approved scope is production-only'
    );
  end if;
  if public.retailer_catalogue_sha256_json(v_manifest) is distinct from
     '30e1dbc1147484a790384dd10f9fc79433ca6edd4728aab7ffbd7b4045fbef3c' then
    perform public.retailer_catalogue_raise(
      'RSBI_SOURCE_HASH_MISMATCH','KIOR approved scope fingerprint mismatch'
    );
  end if;
  /* KIOR frozen eleven-offer production scope binding */$anchor$;
begin
  if v_definition is null
     or position(v_count_anchor in v_definition) = 0
     or position('a1e596f7707c851534e04e30d13f4289439449556787c572736e77b279c75292' in v_definition) = 0 then
    raise exception 'KIOR registration clone precondition failed';
  end if;

  v_definition := replace(v_definition,
    'register_fit_house_offer_sync_control_plan',
    'register_kior_offer_sync_control_plan');
  v_definition := replace(v_definition, 'Fit House', 'KIOR Health');
  v_definition := replace(v_definition, 'fit-house', 'kior-health');
  v_definition := replace(v_definition, 'fithouse.uk', 'kior.uk');
  v_definition := replace(v_definition,
    'a1e596f7707c851534e04e30d13f4289439449556787c572736e77b279c75292',
    '7f28705b6f4900439c8a6a661e4f14baa14be5965345f0a30e15ec83dfb32036');
  v_definition := replace(v_definition, 'exactly 286', 'exactly 11');
  v_definition := replace(v_definition, '<> 286', '<> 11');
  v_definition := replace(v_definition, $$<> '9'$$, $$<> '8'$$);
  v_definition := replace(v_definition, 'where id=9 ', 'where id=8 ');
  v_definition := replace(v_definition, 'retailer_id <> 9', 'retailer_id <> 8');
  v_definition := replace(v_definition, 'retailer_id=9', 'retailer_id=8');
  v_definition := replace(v_definition, 'retailer-offer-sync:9:', 'retailer-offer-sync:8:');
  v_definition := replace(v_definition, $$'retailer_id','9'$$, $$'retailer_id','8'$$);
  v_definition := replace(v_definition, $$v_target||':9'$$, $$v_target||':8'$$);
  v_definition := replace(v_definition, 'v_parent_id,v_parent_fingerprint,9,v_target', 'v_parent_id,v_parent_fingerprint,8,v_target');
  v_definition := replace(v_definition, $$v_parent_id,9,v_target$$, $$v_parent_id,8,v_target$$);
  v_definition := replace(v_definition, v_count_anchor, v_count_replacement);

  execute v_definition;
end;
$clone_kior_registration$;

alter function public.register_kior_offer_sync_control_plan(jsonb) owner to postgres;
revoke all on function public.register_kior_offer_sync_control_plan(jsonb)
  from public, anon, authenticated, service_role;

do $grant_kior_registration$
begin
  if to_regrole('retailer_catalogue_production_validator') is not null then
    grant execute on function public.register_kior_offer_sync_control_plan(jsonb)
      to retailer_catalogue_production_validator;
  end if;
end;
$grant_kior_registration$;

do $verify_kior_registration$
declare
  v_definition text := pg_get_functiondef(
    'public.register_kior_offer_sync_control_plan(jsonb)'::regprocedure
  );
begin
  if position('KIOR frozen eleven-offer production scope binding' in v_definition) = 0
     or position('30e1dbc1147484a790384dd10f9fc79433ca6edd4728aab7ffbd7b4045fbef3c' in v_definition) = 0
     or position('7f28705b6f4900439c8a6a661e4f14baa14be5965345f0a30e15ec83dfb32036' in v_definition) = 0
     or position($$p_request->>'retailer_id' <> '8'$$ in v_definition) = 0
     or position($$p_request->>'retailer_slug' <> 'kior-health'$$ in v_definition) = 0
     or position($$p_request->>'source_platform' <> 'SHOPIFY'$$ in v_definition) = 0
     or position('jsonb_array_length(v_manifest) <> 11' in v_definition) = 0 then
    raise exception 'KIOR registration verification failed';
  end if;
end;
$verify_kior_registration$;

commit;
