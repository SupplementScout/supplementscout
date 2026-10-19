begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';

select pg_advisory_xact_lock(hashtextextended('reviewed-catalogue-v3-schema',0));

do $install$
declare
  v_validator regprocedure;
  v_definition text;
  v_patched text;
  v_sha256 text;
  v_owner oid;
  v_volatility "char";
  v_security_definer boolean;
  v_config text[];
  v_acl aclitem[];
  v_original_declaration text := '  v_evidence jsonb;';
  v_patched_declaration text := $patch$  v_evidence jsonb;
  v_reviewed_v3_envelope jsonb;$patch$;
  v_original_assignment text := $patch$  v_evidence := p_plan#>'{product_variant,evidence}';$patch$;
  v_patched_assignment text := $patch$  if public.atomic_import_reviewed_catalogue_v3_plan_allowed(p_plan) then
    select authorization_envelope into v_reviewed_v3_envelope
    from public.approved_import_plans
    where id::text=current_setting('app.reviewed_catalogue_v3_approval_id',true);
    if not found then
      raise exception 'V3_POST_CREATE_COMPATIBILITY_MISMATCH: approval envelope unavailable';
    end if;
    v_evidence := public.atomic_import_reviewed_v3_legacy_validation_evidence(p_plan,v_reviewed_v3_envelope);
  else
    v_evidence := p_plan#>'{product_variant,evidence}';
  end if;$patch$;
begin
  if to_regprocedure('public.atomic_import_validate_pre_source_metadata_plan_core(jsonb)') is null
     or to_regprocedure('public.atomic_import_reviewed_catalogue_v3_plan_allowed(jsonb)') is null
     or to_regprocedure('public.atomic_import_reviewed_v3_legacy_validation_evidence(jsonb,jsonb)') is null
     or to_regprocedure('public.atomic_import_validate_reviewed_catalogue_v3_plan(jsonb,jsonb)') is null
     or to_regprocedure('public.apply_approved_reviewed_catalogue_v3_plan(uuid,jsonb,jsonb)') is null then
    raise exception 'reviewed catalogue V3 post-create option-role prerequisites are missing';
  end if;

  if encode(pg_catalog.sha256(convert_to(pg_get_functiondef(
       'public.atomic_import_reviewed_catalogue_v3_plan_allowed(jsonb)'::regprocedure
     ),'UTF8')),'hex') <> '8f938dc266a7f2d9f2e1cb8d6b4f2a82e5d8841ee72b64f8fc610edf6fa48e99'
     or encode(pg_catalog.sha256(convert_to(pg_get_functiondef(
       'public.atomic_import_reviewed_v3_legacy_validation_evidence(jsonb,jsonb)'::regprocedure
     ),'UTF8')),'hex') <> '849df8441e8994daf1acb514705808fde17467e033185e30cc432ad165a13905'
     or encode(pg_catalog.sha256(convert_to(pg_get_functiondef(
       'public.atomic_import_validate_reviewed_catalogue_v3_plan(jsonb,jsonb)'::regprocedure
     ),'UTF8')),'hex') <> 'f1f5697a7ca6c3064b358e9296b98a1e411907a127b03248d14f9d75f90b4307'
     or encode(pg_catalog.sha256(convert_to(pg_get_functiondef(
       'public.apply_approved_reviewed_catalogue_v3_plan(uuid,jsonb,jsonb)'::regprocedure
     ),'UTF8')),'hex') <> 'b6670a735282f9d04d0064ce2a3bdbbca055d1b99201a4db87fed2d50a25c734' then
    raise exception 'reviewed catalogue V3 post-create trust-boundary lineage differs';
  end if;

  v_validator := 'public.atomic_import_validate_pre_source_metadata_plan_core(jsonb)'::regprocedure;
  select pg_get_functiondef(v_validator),p.proowner,p.provolatile,p.prosecdef,p.proconfig,p.proacl
    into v_definition,v_owner,v_volatility,v_security_definer,v_config,v_acl
    from pg_proc p where p.oid=v_validator;
  v_sha256 := encode(pg_catalog.sha256(convert_to(v_definition,'UTF8')),'hex');
  if v_sha256 not in (
       '3b78fcd6f6d175c01a83484811b473a703b5d134b79faaac5f6dfb039f0039eb',
       'fbd7752889269b8bdc4b57c729b3233ce17507c6f5766be7a150d99363a6bf87'
     ) then
    raise exception 'reviewed catalogue V3 unsupported post-create validator lineage: %',v_sha256;
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
     or (length(v_definition)-length(replace(v_definition,v_original_assignment,'')))/length(v_original_assignment)<>1
     or position('reviewed variant option size mismatch' in v_definition)=0
     or position('atomic_import_reviewed_v3_legacy_validation_evidence(p_plan' in v_definition)>0 then
    raise exception 'reviewed catalogue V3 post-create validator anchors or metadata differ';
  end if;

  v_patched := replace(v_definition,v_original_declaration,v_patched_declaration);
  v_patched := replace(v_patched,v_original_assignment,v_patched_assignment);
  execute v_patched;

  select pg_get_functiondef(v_validator) into v_definition;
  v_sha256 := encode(pg_catalog.sha256(convert_to(v_definition,'UTF8')),'hex');
  if v_sha256 not in (
       '47913d9e685b0b0804cac3349a7e8d037878834071a7ad4a69be0c826090e44e',
       '7771649ee17b055e5f90ad343a33abf6c950c90c293c575442ee3cb61d671c6e'
     )
     or position('v_evidence := public.atomic_import_reviewed_v3_legacy_validation_evidence(p_plan,v_reviewed_v3_envelope);' in v_definition)=0
     or position($raw$p_plan#>'{retailer_product,values,external_options}'$raw$ in pg_get_functiondef(
       'public.atomic_import_apply_pre_source_metadata_plan_core(jsonb)'::regprocedure
     ))=0
     or not exists(
       select 1 from pg_proc p where p.oid=v_validator
         and p.proowner=v_owner and p.provolatile=v_volatility and p.prosecdef=v_security_definer
         and p.proconfig is not distinct from v_config and p.proacl is not distinct from v_acl
     ) then
    raise exception 'reviewed catalogue V3 post-create compatibility verification failed';
  end if;
end
$install$;

commit;
