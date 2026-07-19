begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- Minimal importer unblock: grant only the existing reviewed-import RPC
-- entrypoints to the already-created approver/executor role pair for the
-- current environment. No roles, logins, tables, sequences or importer paths
-- are created or broadened here.
do $importer_rpc_grants$
declare
  v_has_staging boolean;
  v_has_production boolean;
begin
  if to_regprocedure('public.approve_product_import_plan(jsonb,text,text,text,timestamptz)') is null then
    raise exception 'approve_product_import_plan is missing';
  end if;

  if to_regprocedure('public.apply_approved_product_import_plan(uuid,text,text,text,bigint,text,text)') is null then
    raise exception 'apply_approved_product_import_plan is missing';
  end if;

  v_has_staging :=
    to_regrole('retailer_catalogue_staging_approver') is not null
    and to_regrole('retailer_catalogue_staging_executor') is not null;

  v_has_production :=
    to_regrole('retailer_catalogue_production_approver') is not null
    and to_regrole('retailer_catalogue_production_executor') is not null;

  if v_has_staging and v_has_production then
    raise exception 'refusing to grant importer RPCs: both staging and production role families exist';
  end if;

  if not v_has_staging and not v_has_production then
    raise exception 'refusing to grant importer RPCs: no complete existing importer role family found';
  end if;

  revoke all on function public.approve_product_import_plan(jsonb,text,text,text,timestamptz)
    from public, anon, authenticated;
  revoke all on function public.apply_approved_product_import_plan(uuid,text,text,text,bigint,text,text)
    from public, anon, authenticated;

  if to_regrole('retailer_catalogue_staging_validator') is not null then
    revoke execute on function public.approve_product_import_plan(jsonb,text,text,text,timestamptz)
      from retailer_catalogue_staging_validator;
    revoke execute on function public.apply_approved_product_import_plan(uuid,text,text,text,bigint,text,text)
      from retailer_catalogue_staging_validator;
  end if;

  if to_regrole('retailer_catalogue_production_validator') is not null then
    revoke execute on function public.approve_product_import_plan(jsonb,text,text,text,timestamptz)
      from retailer_catalogue_production_validator;
    revoke execute on function public.apply_approved_product_import_plan(uuid,text,text,text,bigint,text,text)
      from retailer_catalogue_production_validator;
  end if;

  if v_has_staging then
    grant execute on function public.approve_product_import_plan(jsonb,text,text,text,timestamptz)
      to retailer_catalogue_staging_approver;
    grant execute on function public.apply_approved_product_import_plan(uuid,text,text,text,bigint,text,text)
      to retailer_catalogue_staging_executor;
  end if;

  if v_has_production then
    grant execute on function public.approve_product_import_plan(jsonb,text,text,text,timestamptz)
      to retailer_catalogue_production_approver;
    grant execute on function public.apply_approved_product_import_plan(uuid,text,text,text,bigint,text,text)
      to retailer_catalogue_production_executor;
  end if;
end;
$importer_rpc_grants$;

commit;
