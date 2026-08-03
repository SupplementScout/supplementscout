begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $align_existing_offer_options$
declare
  v_target jsonb:=public.retailer_catalogue_actual_database_target();
  v_definition text;
  v_anchor text:=$old$if coalesce(p_plan#>'{product_variant,evidence,external_options}', 'null'::jsonb)
     is distinct from coalesce(p_plan#>'{retailer_product,values,external_options}', 'null'::jsonb) then
    raise exception 'invalid product import plan: option evidence mismatch';
  end if;$old$;
  v_replacement text:=$new$if not (
       p_plan#>>'{product_variant,action}'='existing'
       and p_plan#>>'{retailer_product,action}'='noop'
       and p_plan#>'{product_variant,evidence,external_options}'='null'::jsonb
       and p_plan#>>'{product_variant,evidence,approved_mapping_id}'=p_plan#>>'{retailer_product,id}'
     )
     and coalesce(p_plan#>'{product_variant,evidence,external_options}', 'null'::jsonb)
       is distinct from coalesce(p_plan#>'{retailer_product,values,external_options}', 'null'::jsonb) then
    raise exception 'invalid product import plan: option evidence mismatch';
  end if;$new$;
begin
  if current_user<>'postgres'
     or v_target->>'target_environment'<>'PRODUCTION'
     or v_target->>'project_ref'<>'aftboxmrdgyhizicfsfu'
     or v_target->>'database_identity'<>'supplementscout-production:aftboxmrdgyhizicfsfu' then
    raise exception 'Existing-offer option evidence alignment requires production database owner';
  end if;
  if not exists(
    select 1 from public.retailer_offer_sync_reviewed_mixed_change_definitions
    where authorization_id='simply-49-2bc798f9fb7db4af-production'
      and retailer_id=7
      and contract_version=4
  ) then
    raise exception 'Simply reviewed commercial authorization is missing';
  end if;
  v_definition:=pg_get_functiondef('public.atomic_import_apply_standard_plan_core(jsonb)'::regprocedure);
  if position(v_anchor in v_definition)=0 then
    raise exception 'Existing-offer option evidence anchor is missing';
  end if;
  v_definition:=replace(v_definition,v_anchor,v_replacement);
  execute v_definition;
end
$align_existing_offer_options$;

do $verify_existing_offer_options$
declare
  v_definition text:=pg_get_functiondef('public.atomic_import_apply_standard_plan_core(jsonb)'::regprocedure);
begin
  if position($check$p_plan#>>'{product_variant,evidence,approved_mapping_id}'=p_plan#>>'{retailer_product,id}'$check$ in v_definition)=0
     or position($check$p_plan#>>'{retailer_product,action}'='noop'$check$ in v_definition)=0 then
    raise exception 'Existing-offer option evidence verification failed';
  end if;
end
$verify_existing_offer_options$;

commit;
