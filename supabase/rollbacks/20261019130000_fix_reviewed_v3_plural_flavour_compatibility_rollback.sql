begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';

select pg_advisory_xact_lock(hashtextextended('reviewed-catalogue-v3-schema',0));

do $rollback$
declare
  v_helper regprocedure := 'public.atomic_import_reviewed_v3_legacy_validation_evidence(jsonb,jsonb)'::regprocedure;
  v_definition text;
  v_restored text;
  v_owner oid;
  v_volatility "char";
  v_security_definer boolean;
  v_config text[];
  v_acl aclitem[];
  v_original_declaration text := $patch$  v_physical jsonb := p_envelope#>'{option_roles,physical_size}';
  v_count jsonb := p_envelope#>'{option_roles,count}';
  v_count_key text;
  v_physical_key text;$patch$;
  v_patched_declaration text := $patch$  v_flavour jsonb := p_envelope#>'{option_roles,flavour}';
  v_physical jsonb := p_envelope#>'{option_roles,physical_size}';
  v_count jsonb := p_envelope#>'{option_roles,count}';
  v_flavour_key text;
  v_flavour_normalized_key text;
  v_flavour_alias_count integer;
  v_count_key text;
  v_physical_key text;$patch$;
  v_original_compatibility text := $patch$  v_evidence := v_evidence-array['unit_count','unit_type'];
  if jsonb_typeof(v_count)='null' then
    return v_evidence;
  end if;$patch$;
  v_patched_compatibility text := $patch$  v_evidence := v_evidence-array['unit_count','unit_type'];
  v_validation_options := v_raw_options;

  if jsonb_typeof(v_flavour)='null' then
    null;
  elsif jsonb_typeof(v_flavour)='object' then
    if not public.atomic_import_has_exact_keys(v_flavour,array['source_key','source_value']) then
      raise exception 'V3_LEGACY_COMPATIBILITY_MISMATCH: invalid flavour role';
    end if;
    v_flavour_key := v_flavour->>'source_key';
    v_flavour_normalized_key := lower(btrim(coalesce(v_flavour_key,'')));
    if v_flavour_normalized_key not in ('flavour','flavor','flavours','flavors')
       or v_raw_options->>v_flavour_key is distinct from v_flavour->>'source_value' then
      raise exception 'V3_LEGACY_COMPATIBILITY_MISMATCH: flavour role lost raw binding';
    end if;
    select count(*) into v_flavour_alias_count
    from jsonb_each_text(v_raw_options) as option_row(key,value)
    where lower(btrim(option_row.key)) in ('flavour','flavor','flavours','flavors');
    if v_flavour_alias_count<>1 then
      raise exception 'V3_LEGACY_COMPATIBILITY_MISMATCH: ambiguous flavour aliases';
    end if;
    if v_flavour_normalized_key in ('flavours','flavors') then
      v_validation_options := jsonb_set(
        v_validation_options,
        array['Flavour'],
        to_jsonb(v_flavour->>'source_value'),
        true
      );
    end if;
  else
    raise exception 'V3_LEGACY_COMPATIBILITY_MISMATCH: invalid flavour role';
  end if;

  if jsonb_typeof(v_count)='null' then
    return jsonb_set(v_evidence,'{external_options}',v_validation_options,false);
  end if;$patch$;
  v_original_tail text := $patch$  v_validation_options := v_raw_options;
  if jsonb_typeof(v_physical)='null' then$patch$;
  v_patched_tail text := $patch$  if jsonb_typeof(v_physical)='null' then$patch$;
begin
  if exists(
    select 1 from public.approved_import_plans
    where source ~ '^reviewed-catalogue-package-v3:'
      and status='approved' and consumed_at is null and expires_at>now()
  ) then
    raise exception 'reviewed catalogue V3 plural-flavour rollback blocked by live approval';
  end if;

  select pg_get_functiondef(v_helper),p.proowner,p.provolatile,p.prosecdef,p.proconfig,p.proacl
    into v_definition,v_owner,v_volatility,v_security_definer,v_config,v_acl
    from pg_proc p where p.oid=v_helper;
  if encode(pg_catalog.sha256(convert_to(v_definition,'UTF8')),'hex') <> '3f25c76ae3407552f99e035d60f2629838ab878d5f127b20d29be02aa834fdfc'
     or v_owner<>'postgres'::regrole
     or v_volatility<>'s'
     or not v_security_definer
     or v_config is distinct from array['search_path=pg_catalog, public, pg_temp']::text[]
     or exists(
       select 1 from pg_proc p
       cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) acl
       where p.oid=v_helper and acl.grantee<>p.proowner and acl.privilege_type='EXECUTE'
     )
     or (length(v_definition)-length(replace(v_definition,v_patched_declaration,'')))/length(v_patched_declaration)<>1
     or (length(v_definition)-length(replace(v_definition,v_patched_compatibility,'')))/length(v_patched_compatibility)<>1
     or (length(v_definition)-length(replace(v_definition,v_patched_tail,'')))/length(v_patched_tail)<>1 then
    raise exception 'reviewed catalogue V3 plural-flavour rollback lineage, anchors or metadata differ';
  end if;

  v_restored := replace(v_definition,v_patched_declaration,v_original_declaration);
  v_restored := replace(v_restored,v_patched_compatibility,v_original_compatibility);
  v_restored := replace(v_restored,v_patched_tail,v_original_tail);
  execute v_restored;

  select pg_get_functiondef(v_helper) into v_definition;
  if encode(pg_catalog.sha256(convert_to(v_definition,'UTF8')),'hex')
       <> '906cb5abad08deb8452fa9ae4fed8be8669b760e6f2ef088ae8846f5536b27db'
     or not exists(
       select 1 from pg_proc p where p.oid=v_helper
         and p.proowner=v_owner and p.provolatile=v_volatility and p.prosecdef=v_security_definer
         and p.proconfig is not distinct from v_config and p.proacl is not distinct from v_acl
     ) then
    raise exception 'reviewed catalogue V3 plural-flavour rollback verification failed';
  end if;
end
$rollback$;

commit;
