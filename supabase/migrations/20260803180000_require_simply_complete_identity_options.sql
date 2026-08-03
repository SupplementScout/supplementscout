begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- Replace the temporary null-options branch with the complete, owner-reviewed
-- Shopify identity: exact Size plus the single-unit [Multibuy 1] selection.
do $require_simply_complete_options$
declare
  v_definition text := pg_get_functiondef(
    'public.atomic_import_is_simply_identity_only_upgrade(jsonb)'::regprocedure
  );
  v_declaration_original text := $anchor$  v_values jsonb := p_plan#>'{retailer_product,values}';$anchor$;
  v_declaration_replacement text := $anchor$  v_values jsonb := p_plan#>'{retailer_product,values}';
  v_evidence jsonb := p_plan#>'{product_variant,evidence}';$anchor$;
  v_original text := $anchor$     or coalesce(v_expected->'external_options','null'::jsonb) <> 'null'::jsonb
     or coalesce(v_values->'external_options','null'::jsonb) <> 'null'::jsonb$anchor$;
  v_replacement text := $anchor$     or coalesce(v_expected->'external_options','null'::jsonb) <> 'null'::jsonb
     or jsonb_typeof(v_values->'external_options') is distinct from 'object'
     or (select count(*) from jsonb_each(
          case when jsonb_typeof(v_values->'external_options')='object'
            then v_values->'external_options' else '{}'::jsonb end
        )) <> 2
     or not (v_values->'external_options' ? 'Size')
     or not (v_values->'external_options' ? 'Subscription')
     or nullif(v_values#>>'{external_options,Size}','') is null
     or v_values#>>'{external_options,Subscription}' is distinct from '[Multibuy 1]'
     or v_values->'external_options' is distinct from v_evidence->'external_options'
     /* Simply complete reviewed options binding */$anchor$;
begin
  if v_definition is null
     or position(v_declaration_original in v_definition) = 0
     or position(v_original in v_definition) = 0 then
    raise exception 'Simply complete options precondition failed';
  end if;
  v_definition := replace(v_definition, v_declaration_original, v_declaration_replacement);
  execute replace(v_definition, v_original, v_replacement);
end;
$require_simply_complete_options$;

alter function public.atomic_import_is_simply_identity_only_upgrade(jsonb) owner to postgres;
revoke all on function public.atomic_import_is_simply_identity_only_upgrade(jsonb)
  from public, anon, authenticated, service_role;

do $verify_simply_complete_options$
declare
  v_definition text := pg_get_functiondef(
    'public.atomic_import_is_simply_identity_only_upgrade(jsonb)'::regprocedure
  );
begin
  if position('Simply complete reviewed options binding' in v_definition) = 0
     or position($$v_values#>>'{external_options,Subscription}' is distinct from '[Multibuy 1]'$$ in v_definition) = 0
     or position($$v_values->'external_options' is distinct from v_evidence->'external_options'$$ in v_definition) = 0 then
    raise exception 'Simply complete options verification failed';
  end if;
end;
$verify_simply_complete_options$;

commit;
