begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';

select pg_advisory_xact_lock(hashtextextended('reviewed-catalogue-v3-schema',0));

do $rollback$
declare
  v_validator regprocedure := 'public.atomic_import_validate_pre_source_metadata_plan_core(jsonb)'::regprocedure;
  v_definition text;
  v_restored text;
  v_sha256 text;
  v_owner oid;
  v_volatility "char";
  v_security_definer boolean;
  v_config text[];
  v_acl aclitem[];
  v_original_declaration text := '  v_matching_products bigint;';
  v_patched_declaration text := $patch$  v_matching_products bigint;
  v_trusted_v3 boolean;$patch$;
  v_original_begin text := $patch$begin
  if lower(coalesce(p_plan#>>'{product,values,name}','')$patch$;
  v_patched_begin text := $patch$begin
  v_trusted_v3 := public.atomic_import_reviewed_catalogue_v3_plan_allowed(p_plan);
  if lower(coalesce(p_plan#>>'{product,values,name}','')$patch$;
  v_original_family text := $patch$  if not public.atomic_import_reviewed_parent_variant_allowed(
    v_product_values->>'name',
    v_product_values->>'brand',
    v_product_values->>'category',
    v_product_values->>'product_format',
    v_variant_values->>'size_value',
    v_variant_values->>'size_unit'
  ) or p_plan#>>'{approval,approved_category}' is distinct from v_product_values->>'category' then$patch$;
  v_patched_family text := $patch$  if (not v_trusted_v3 and not public.atomic_import_reviewed_parent_variant_allowed(
    v_product_values->>'name',
    v_product_values->>'brand',
    v_product_values->>'category',
    v_product_values->>'product_format',
    v_variant_values->>'size_value',
    v_variant_values->>'size_unit'
  )) or p_plan#>>'{approval,approved_category}' is distinct from v_product_values->>'category' then$patch$;
  v_original_transport text := $patch$  if v_retailer_actual->>'slug' = 'jon-s-supplements' then$patch$;
  v_patched_transport text := $patch$  if v_trusted_v3 then
    null;
  elsif v_retailer_actual->>'slug' = 'jon-s-supplements' then$patch$;
begin
  if exists(
    select 1 from public.approved_import_plans
    where source ~ '^reviewed-catalogue-package-v3:'
      and status='approved' and consumed_at is null and expires_at>now()
      and plan_json#>>'{product,action}'='create_or_reuse_reviewed'
      and plan_json#>>'{product_variant,action}'='create_reviewed_variant'
  ) then
    raise exception 'trusted V3 reviewed-parent rollback blocked by live approval';
  end if;

  select pg_get_functiondef(v_validator),p.proowner,p.provolatile,p.prosecdef,p.proconfig,p.proacl
    into v_definition,v_owner,v_volatility,v_security_definer,v_config,v_acl
    from pg_proc p where p.oid=v_validator;
  v_sha256 := encode(pg_catalog.sha256(convert_to(v_definition,'UTF8')),'hex');
  if v_sha256 not in (
       '0f2308eb0759cff2a4d97708a3bdfca24d50820483310117771f1bd3a2a3149a',
       '80e9f09e1b9ad414689d0f42876bb8f169f528b4efad61d9713f3dad6850a942'
     )
     or v_owner<>'postgres'::regrole
     or v_volatility<>'s'
     or not v_security_definer
     or v_config is distinct from array['search_path=pg_catalog, public, pg_temp']::text[]
     or exists(
       select 1 from pg_proc p
       cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) acl
       where p.oid=v_validator and acl.grantee<>p.proowner and acl.privilege_type='EXECUTE'
     )
     or (length(v_definition)-length(replace(v_definition,v_patched_declaration,'')))/length(v_patched_declaration)<>1
     or (length(v_definition)-length(replace(v_definition,v_patched_begin,'')))/length(v_patched_begin)<>1
     or (length(v_definition)-length(replace(v_definition,v_patched_family,'')))/length(v_patched_family)<>1
     or (length(v_definition)-length(replace(v_definition,v_patched_transport,'')))/length(v_patched_transport)<>1 then
    raise exception 'trusted V3 reviewed-parent rollback lineage or metadata differs: %',v_sha256;
  end if;

  v_restored := replace(v_definition,v_patched_declaration,v_original_declaration);
  v_restored := replace(v_restored,v_patched_begin,v_original_begin);
  v_restored := replace(v_restored,v_patched_family,v_original_family);
  v_restored := replace(v_restored,v_patched_transport,v_original_transport);
  execute v_restored;

  select pg_get_functiondef(v_validator) into v_definition;
  if encode(pg_catalog.sha256(convert_to(v_definition,'UTF8')),'hex') not in (
       '47913d9e685b0b0804cac3349a7e8d037878834071a7ad4a69be0c826090e44e',
       '7771649ee17b055e5f90ad343a33abf6c950c90c293c575442ee3cb61d671c6e'
     )
     or not exists(
       select 1 from pg_proc p where p.oid=v_validator
         and p.proowner=v_owner and p.provolatile=v_volatility and p.prosecdef=v_security_definer
         and p.proconfig is not distinct from v_config and p.proacl is not distinct from v_acl
     ) then
    raise exception 'trusted V3 reviewed-parent rollback verification failed';
  end if;
end
$rollback$;

commit;
