begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';

select pg_advisory_xact_lock(hashtextextended('reviewed-catalogue-v3-schema',0));

do $install$
declare
  v_validator regprocedure := 'public.atomic_import_validate_pre_source_metadata_plan_core(jsonb)'::regprocedure;
  v_definition text;
  v_patched text;
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
  if to_regprocedure('public.atomic_import_reviewed_catalogue_v3_plan_allowed(jsonb)') is null
     or to_regprocedure('public.atomic_import_validate_reviewed_catalogue_v3_plan(jsonb,jsonb)') is null
     or to_regprocedure('public.apply_approved_reviewed_catalogue_v3_plan(uuid,jsonb,jsonb)') is null then
    raise exception 'trusted V3 reviewed-parent policy prerequisites are missing';
  end if;

  if encode(pg_catalog.sha256(convert_to(pg_get_functiondef(
       'public.atomic_import_reviewed_catalogue_v3_plan_allowed(jsonb)'::regprocedure
     ),'UTF8')),'hex') <> '8f938dc266a7f2d9f2e1cb8d6b4f2a82e5d8841ee72b64f8fc610edf6fa48e99'
     or encode(pg_catalog.sha256(convert_to(pg_get_functiondef(
       'public.atomic_import_validate_reviewed_catalogue_v3_plan(jsonb,jsonb)'::regprocedure
     ),'UTF8')),'hex') <> 'f1f5697a7ca6c3064b358e9296b98a1e411907a127b03248d14f9d75f90b4307'
     or encode(pg_catalog.sha256(convert_to(pg_get_functiondef(
       'public.apply_approved_reviewed_catalogue_v3_plan(uuid,jsonb,jsonb)'::regprocedure
     ),'UTF8')),'hex') <> 'b6670a735282f9d04d0064ce2a3bdbbca055d1b99201a4db87fed2d50a25c734' then
    raise exception 'trusted V3 reviewed-parent trust-boundary lineage differs';
  end if;

  select pg_get_functiondef(v_validator),p.proowner,p.provolatile,p.prosecdef,p.proconfig,p.proacl
    into v_definition,v_owner,v_volatility,v_security_definer,v_config,v_acl
    from pg_proc p where p.oid=v_validator;
  v_sha256 := encode(pg_catalog.sha256(convert_to(v_definition,'UTF8')),'hex');
  if v_sha256 not in (
       '47913d9e685b0b0804cac3349a7e8d037878834071a7ad4a69be0c826090e44e',
       '7771649ee17b055e5f90ad343a33abf6c950c90c293c575442ee3cb61d671c6e'
     ) then
    raise exception 'trusted V3 reviewed-parent unsupported validator lineage: %',v_sha256;
  end if;
  if v_owner<>'postgres'::regrole
     or v_volatility<>'s'
     or not v_security_definer
     or v_config is distinct from array['search_path=pg_catalog, public, pg_temp']::text[]
     or exists(
       select 1 from pg_proc p
       cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) acl
       where p.oid=v_validator and acl.grantee<>p.proowner and acl.privilege_type='EXECUTE'
     )
     or (length(v_definition)-length(replace(v_definition,v_original_declaration,'')))/length(v_original_declaration)<>1
     or (length(v_definition)-length(replace(v_definition,v_original_begin,'')))/length(v_original_begin)<>1
     or (length(v_definition)-length(replace(v_definition,v_original_family,'')))/length(v_original_family)<>1
     or (length(v_definition)-length(replace(v_definition,v_original_transport,'')))/length(v_original_transport)<>1
     or position('v_trusted_v3 boolean' in v_definition)>0 then
    raise exception 'trusted V3 reviewed-parent validator anchors or metadata differ';
  end if;

  v_patched := replace(v_definition,v_original_declaration,v_patched_declaration);
  v_patched := replace(v_patched,v_original_begin,v_patched_begin);
  v_patched := replace(v_patched,v_original_family,v_patched_family);
  v_patched := replace(v_patched,v_original_transport,v_patched_transport);
  execute v_patched;

  select pg_get_functiondef(v_validator) into v_definition;
  if (length(v_definition)-length(replace(v_definition,'  v_trusted_v3 boolean;','')))/length('  v_trusted_v3 boolean;')<>1
     or (length(v_definition)-length(replace(v_definition,$marker$  v_trusted_v3 := public.atomic_import_reviewed_catalogue_v3_plan_allowed(p_plan);$marker$,'')))/length($marker$  v_trusted_v3 := public.atomic_import_reviewed_catalogue_v3_plan_allowed(p_plan);$marker$)<>1
     or (length(v_definition)-length(replace(v_definition,v_patched_family,'')))/length(v_patched_family)<>1
     or (length(v_definition)-length(replace(v_definition,v_patched_transport,'')))/length(v_patched_transport)<>1
     or not exists(
       select 1 from pg_proc p where p.oid=v_validator
         and p.proowner=v_owner and p.provolatile=v_volatility and p.prosecdef=v_security_definer
         and p.proconfig is not distinct from v_config and p.proacl is not distinct from v_acl
     ) then
    raise exception 'trusted V3 reviewed-parent policy verification failed';
  end if;
end
$install$;

commit;
