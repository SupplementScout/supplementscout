begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';

select pg_advisory_xact_lock(hashtextextended('reviewed-catalogue-v3-schema',0));

do $rollback$
declare
  v_standard regprocedure;
  v_helper regprocedure;
  v_definition text;
  v_restored text;
  v_restored_sha256 text;
  v_original_declaration text := '  v_evidence jsonb;';
  v_patched_declaration text := $patch$  v_evidence jsonb;
  v_reviewed_v3_legacy_evidence jsonb;
  v_reviewed_v3_envelope jsonb;$patch$;
  v_original_beginning text := $patch$begin
  perform public.validate_product_import_plan_read_only(p_plan);$patch$;
  v_patched_beginning text := $patch$begin
  perform public.validate_product_import_plan_read_only(p_plan);
  if public.atomic_import_reviewed_catalogue_v3_plan_allowed(p_plan) then
    select authorization_envelope into v_reviewed_v3_envelope
    from public.approved_import_plans
    where id::text=current_setting('app.reviewed_catalogue_v3_approval_id',true);
    if not found then
      raise exception 'V3_LEGACY_COMPATIBILITY_MISMATCH: approval envelope unavailable';
    end if;
    v_reviewed_v3_legacy_evidence := public.atomic_import_reviewed_v3_legacy_validation_evidence(
      p_plan,
      v_reviewed_v3_envelope
    );
  else
    v_reviewed_v3_legacy_evidence := p_plan#>'{product_variant,evidence}';
  end if;$patch$;
  v_staging_schema_view text := $patch$p_plan#>'{product_variant,evidence}',$patch$;
  v_production_schema_view text := $patch$(p_plan#>'{product_variant,evidence}') - array['unit_count','unit_type'],$patch$;
  v_patched_schema_view text := 'v_reviewed_v3_legacy_evidence,';
  v_original_option_view text := $patch$from jsonb_each_text(case
    when jsonb_typeof(v_evidence->'external_options') = 'object'
      then v_evidence->'external_options'
    else '{}'::jsonb
  end)$patch$;
  v_patched_option_view text := $patch$from jsonb_each_text(case
    when jsonb_typeof(v_reviewed_v3_legacy_evidence->'external_options') = 'object'
      then v_reviewed_v3_legacy_evidence->'external_options'
    else '{}'::jsonb
  end)$patch$;
begin
  if to_regprocedure('public.atomic_import_apply_standard_plan_core(jsonb)') is null
     or to_regprocedure('public.atomic_import_reviewed_v3_legacy_validation_evidence(jsonb,jsonb)') is null then
    raise exception 'reviewed catalogue V3 option-role rollback target is missing';
  end if;
  v_standard := 'public.atomic_import_apply_standard_plan_core(jsonb)'::regprocedure;
  v_helper := 'public.atomic_import_reviewed_v3_legacy_validation_evidence(jsonb,jsonb)'::regprocedure;
  v_definition := pg_get_functiondef(v_standard);
  if (length(v_definition)-length(replace(v_definition,v_patched_declaration,'')))/length(v_patched_declaration)<>1
     or (length(v_definition)-length(replace(v_definition,v_patched_beginning,'')))/length(v_patched_beginning)<>1
     or (length(v_definition)-length(replace(v_definition,v_patched_schema_view,'')))/length(v_patched_schema_view)<>2
     or (length(v_definition)-length(replace(v_definition,v_patched_option_view,'')))/length(v_patched_option_view)<>2
     or not exists(
       select 1 from pg_proc p
       where p.oid=v_standard and p.proowner='postgres'::regrole and p.provolatile='v' and p.prosecdef
         and p.proconfig=array['search_path=pg_catalog, public, pg_temp']::text[]
     )
     or not exists(
       select 1 from pg_proc p
       where p.oid=v_helper and p.proowner='postgres'::regrole and p.provolatile='s' and p.prosecdef
         and p.proconfig=array['search_path=pg_catalog, public, pg_temp']::text[]
     ) then
    raise exception 'reviewed catalogue V3 option-role rollback blocked by runtime drift';
  end if;

  v_restored := replace(v_definition,v_patched_option_view,v_original_option_view);
  v_restored := replace(v_restored,v_patched_beginning,v_original_beginning);
  v_restored := replace(v_restored,v_patched_declaration,v_original_declaration);
  v_restored := replace(v_restored,v_patched_schema_view,v_staging_schema_view);
  v_restored_sha256 := encode(pg_catalog.sha256(convert_to(v_restored,'UTF8')),'hex');
  if v_restored_sha256 not in (
       '69311caa0dda83010f986dfbd76bc0017d3a0f999c64b1dd5e35dcb87b7d4c48',
       '0b0bccb01e521228db93f495db7984372df5b177cf7009edc205620c1ddef634'
     ) then
    v_restored := replace(v_definition,v_patched_option_view,v_original_option_view);
    v_restored := replace(v_restored,v_patched_beginning,v_original_beginning);
    v_restored := replace(v_restored,v_patched_declaration,v_original_declaration);
    v_restored := replace(v_restored,v_patched_schema_view,v_production_schema_view);
    v_restored_sha256 := encode(pg_catalog.sha256(convert_to(v_restored,'UTF8')),'hex');
  end if;
  if v_restored_sha256 not in (
       '69311caa0dda83010f986dfbd76bc0017d3a0f999c64b1dd5e35dcb87b7d4c48',
       '0b0bccb01e521228db93f495db7984372df5b177cf7009edc205620c1ddef634'
     ) then
    raise exception 'reviewed catalogue V3 option-role rollback cannot restore known lineage: %',v_restored_sha256;
  end if;
  execute v_restored;
end
$rollback$;

alter function public.atomic_import_apply_standard_plan_core(jsonb) owner to postgres;
revoke all on function public.atomic_import_apply_standard_plan_core(jsonb)
  from public,anon,authenticated,service_role,
    retailer_catalogue_staging_validator,retailer_catalogue_staging_approver,retailer_catalogue_staging_executor,
    retailer_catalogue_production_validator,retailer_catalogue_production_approver,retailer_catalogue_production_executor;

drop function public.atomic_import_reviewed_v3_legacy_validation_evidence(jsonb,jsonb);

commit;
