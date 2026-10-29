begin;

set local lock_timeout='5s';
set local statement_timeout='30s';

select pg_advisory_xact_lock(hashtextextended('reviewed-product-pack-correction-v1',0));

do $guard$
declare
  v_target jsonb:=public.retailer_catalogue_actual_database_target();
  v_counts jsonb;
begin
  if current_user<>'postgres'
     or v_target->>'target_environment'<>'PRODUCTION'
     or v_target->>'project_ref'<>'aftboxmrdgyhizicfsfu' then
    raise exception 'reviewed product pack correction reissue rollback requires exact PRODUCTION target';
  end if;
  if exists(
    select 1 from public.approved_import_plans
    where source like 'reviewed-product-pack-correction-v1:%'
      and status='approved' and consumed_at is null and expires_at>now()
  ) then
    raise exception 'reviewed product pack correction rollback blocked by live approval';
  end if;
  select jsonb_build_object(
    'products',(select count(*) from public.products),
    'product_variants',(select count(*) from public.product_variants),
    'retailer_products',(select count(*) from public.retailer_products),
    'offers',(select count(*) from public.offers),
    'price_history',(select count(*) from public.price_history),
    'approved_import_plans',(select count(*) from public.approved_import_plans)
  ) into v_counts;
  perform set_config('app.reviewed_product_pack_rollback_counts',v_counts::text,true);
end
$guard$;

revoke all on function public.reviewed_product_pack_correction_validate_core(jsonb,boolean),
  public.reviewed_product_pack_correction_assert_session(jsonb,text),
  public.validate_reviewed_product_pack_correction_read_only(jsonb),
  public.read_reviewed_product_pack_correction_state(jsonb),
  public.approve_reviewed_product_pack_correction(jsonb,text,timestamptz),
  public.apply_approved_reviewed_product_pack_correction(uuid,jsonb,text)
from public,anon,authenticated,service_role;

do $environment_acl$
declare
  v_role text;
  v_signature text;
begin
  foreach v_role in array array[
    'retailer_catalogue_staging_validator','retailer_catalogue_staging_approver','retailer_catalogue_staging_executor',
    'retailer_catalogue_production_validator','retailer_catalogue_production_approver','retailer_catalogue_production_executor'
  ] loop
    if to_regrole(v_role) is not null then
      foreach v_signature in array array[
        'public.reviewed_product_pack_correction_validate_core(jsonb,boolean)',
        'public.reviewed_product_pack_correction_assert_session(jsonb,text)',
        'public.validate_reviewed_product_pack_correction_read_only(jsonb)',
        'public.read_reviewed_product_pack_correction_state(jsonb)',
        'public.approve_reviewed_product_pack_correction(jsonb,text,timestamptz)',
        'public.apply_approved_reviewed_product_pack_correction(uuid,jsonb,text)'
      ] loop
        execute format('revoke all on function %s from %I',v_signature,v_role);
      end loop;
    end if;
  end loop;
end
$environment_acl$;

drop function if exists public.apply_approved_reviewed_product_pack_correction(uuid,jsonb,text);
drop function if exists public.approve_reviewed_product_pack_correction(jsonb,text,timestamptz);
drop function if exists public.read_reviewed_product_pack_correction_state(jsonb);
drop function if exists public.validate_reviewed_product_pack_correction_read_only(jsonb);
drop function if exists public.reviewed_product_pack_correction_assert_session(jsonb,text);
drop function if exists public.reviewed_product_pack_correction_validate_core(jsonb,boolean);

do $postflight$
declare
  v_before jsonb:=current_setting('app.reviewed_product_pack_rollback_counts')::jsonb;
  v_after jsonb;
begin
  select jsonb_build_object(
    'products',(select count(*) from public.products),
    'product_variants',(select count(*) from public.product_variants),
    'retailer_products',(select count(*) from public.retailer_products),
    'offers',(select count(*) from public.offers),
    'price_history',(select count(*) from public.price_history),
    'approved_import_plans',(select count(*) from public.approved_import_plans)
  ) into v_after;
  if v_after is distinct from v_before
     or to_regprocedure('public.reviewed_product_pack_correction_validate_core(jsonb,boolean)') is not null
     or to_regprocedure('public.reviewed_product_pack_correction_assert_session(jsonb,text)') is not null
     or to_regprocedure('public.validate_reviewed_product_pack_correction_read_only(jsonb)') is not null
     or to_regprocedure('public.read_reviewed_product_pack_correction_state(jsonb)') is not null
     or to_regprocedure('public.approve_reviewed_product_pack_correction(jsonb,text,timestamptz)') is not null
     or to_regprocedure('public.apply_approved_reviewed_product_pack_correction(uuid,jsonb,text)') is not null then
    raise exception 'reviewed product pack correction reissue rollback verification failed';
  end if;
end
$postflight$;

commit;
