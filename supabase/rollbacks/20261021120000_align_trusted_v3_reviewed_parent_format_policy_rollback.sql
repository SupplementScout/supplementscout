begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';

select pg_advisory_xact_lock(hashtextextended('reviewed-catalogue-v3-schema',0));

do $rollback$
declare
  v_validator regprocedure := 'public.atomic_import_validate_pre_source_metadata_plan_core(jsonb)'::regprocedure;
  v_target jsonb;
  v_definition text;
  v_restored text;
  v_sha256 text;
  v_owner oid;
  v_volatility "char";
  v_security_definer boolean;
  v_config text[];
  v_acl aclitem[];
  v_original_format text;
  v_patched_format text;
  v_expected_pre_sha text;
begin
  if exists(
    select 1 from public.approved_import_plans
    where source ~ '^reviewed-catalogue-package-v3:'
      and status='approved' and consumed_at is null and expires_at>now()
  ) then
    raise exception 'trusted V3 reviewed-parent format rollback blocked by live approval';
  end if;
  if exists(
    select 1 from public.approved_import_plans
    where source ~ '^reviewed-catalogue-package-v3:'
      and created_at>=timestamptz '2026-10-21 11:00:00+00'
  ) then
    raise exception 'trusted V3 reviewed-parent format rollback blocked by later durable approval evidence';
  end if;

  v_target:=public.retailer_catalogue_actual_database_target();
  if v_target->>'target_environment' not in ('STAGING','PRODUCTION')
     or v_target->>'project_ref' not in ('hxnrsyyqffztlvcrtgbf','aftboxmrdgyhizicfsfu') then
    raise exception 'trusted V3 reviewed-parent format rollback unsupported database target';
  end if;

  select pg_get_functiondef(v_validator),p.proowner,p.provolatile,p.prosecdef,p.proconfig,p.proacl
    into v_definition,v_owner,v_volatility,v_security_definer,v_config,v_acl
    from pg_proc p where p.oid=v_validator;
  v_sha256:=encode(pg_catalog.sha256(convert_to(v_definition,'UTF8')),'hex');

  if v_sha256='c82e291550787e553fc906a669c348f0b7d6cd034bfb8bd326d7a9c646e7511a' then
    v_original_format:=$patch$  or v_product_values->>'product_format' not in ('powder','bar')$patch$;
    v_patched_format:=$patch$  or (not v_trusted_v3 and v_product_values->>'product_format' not in ('powder','bar'))$patch$;
    v_expected_pre_sha:='0f2308eb0759cff2a4d97708a3bdfca24d50820483310117771f1bd3a2a3149a';
  elsif v_sha256='c8370ee49d873f9cf8f6f375653848248b2cbe19f0e0b869f392e45405ae5daf' then
    v_original_format:=$patch$  or (
    v_product_values->>'product_format' not in ('powder','bar')
    and not public.atomic_import_10reps_v10_parent_variant_transport_allowed($patch$;
    v_patched_format:=$patch$  or (
    not v_trusted_v3
    and v_product_values->>'product_format' not in ('powder','bar')
    and not public.atomic_import_10reps_v10_parent_variant_transport_allowed($patch$;
    v_expected_pre_sha:='80e9f09e1b9ad414689d0f42876bb8f169f528b4efad61d9713f3dad6850a942';
  else
    raise exception 'trusted V3 reviewed-parent format rollback lineage differs: %',v_sha256;
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
     or (length(v_definition)-length(replace(v_definition,v_patched_format,'')))/length(v_patched_format)<>1 then
    raise exception 'trusted V3 reviewed-parent format rollback anchors or metadata differ';
  end if;

  v_restored:=replace(v_definition,v_patched_format,v_original_format);
  execute v_restored;

  select pg_get_functiondef(v_validator) into v_definition;
  if encode(pg_catalog.sha256(convert_to(v_definition,'UTF8')),'hex')<>v_expected_pre_sha
     or not exists(
       select 1 from pg_proc p where p.oid=v_validator
         and p.proowner=v_owner and p.provolatile=v_volatility and p.prosecdef=v_security_definer
         and p.proconfig is not distinct from v_config and p.proacl is not distinct from v_acl
     ) then
    raise exception 'trusted V3 reviewed-parent format rollback verification failed';
  end if;
end
$rollback$;

commit;
