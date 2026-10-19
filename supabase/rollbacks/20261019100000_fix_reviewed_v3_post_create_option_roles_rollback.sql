begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';

select pg_advisory_xact_lock(hashtextextended('reviewed-catalogue-v3-schema',0));

do $rollback$
declare
  v_validator regprocedure;
  v_definition text;
  v_restored text;
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
  if to_regprocedure('public.atomic_import_validate_pre_source_metadata_plan_core(jsonb)') is null then
    raise exception 'reviewed catalogue V3 post-create rollback target is missing';
  end if;
  if exists(
    select 1 from public.approved_import_plans
    where source like 'reviewed-catalogue-package-v3:%'
      and status='approved' and consumed_at is null and expires_at>now()
  ) then
    raise exception 'reviewed catalogue V3 post-create rollback blocked by live approval';
  end if;

  v_validator := 'public.atomic_import_validate_pre_source_metadata_plan_core(jsonb)'::regprocedure;
  select pg_get_functiondef(v_validator),p.proowner,p.provolatile,p.prosecdef,p.proconfig,p.proacl
    into v_definition,v_owner,v_volatility,v_security_definer,v_config,v_acl
    from pg_proc p where p.oid=v_validator;
  v_sha256 := encode(pg_catalog.sha256(convert_to(v_definition,'UTF8')),'hex');
  if v_sha256 not in (
       '47913d9e685b0b0804cac3349a7e8d037878834071a7ad4a69be0c826090e44e',
       '7771649ee17b055e5f90ad343a33abf6c950c90c293c575442ee3cb61d671c6e'
     )
     or (length(v_definition)-length(replace(v_definition,v_patched_declaration,'')))/length(v_patched_declaration)<>1
     or (length(v_definition)-length(replace(v_definition,v_patched_assignment,'')))/length(v_patched_assignment)<>1 then
    raise exception 'reviewed catalogue V3 post-create rollback blocked by runtime drift: %',v_sha256;
  end if;

  v_restored := replace(v_definition,v_patched_assignment,v_original_assignment);
  v_restored := replace(v_restored,v_patched_declaration,v_original_declaration);
  v_sha256 := encode(pg_catalog.sha256(convert_to(v_restored,'UTF8')),'hex');
  if v_sha256 not in (
       '3b78fcd6f6d175c01a83484811b473a703b5d134b79faaac5f6dfb039f0039eb',
       'fbd7752889269b8bdc4b57c729b3233ce17507c6f5766be7a150d99363a6bf87'
     ) then
    raise exception 'reviewed catalogue V3 post-create rollback cannot restore known lineage: %',v_sha256;
  end if;
  execute v_restored;

  if not exists(
    select 1 from pg_proc p where p.oid=v_validator
      and p.proowner=v_owner and p.provolatile=v_volatility and p.prosecdef=v_security_definer
      and p.proconfig is not distinct from v_config and p.proacl is not distinct from v_acl
  ) then
    raise exception 'reviewed catalogue V3 post-create rollback changed function metadata';
  end if;
end
$rollback$;

commit;
