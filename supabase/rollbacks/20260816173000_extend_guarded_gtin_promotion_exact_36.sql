begin;

do $guard$
begin
  if exists(
    select 1
    from public.approved_import_plans
    where plan_kind='gtin_promotion'
      and plan_json#>>'{owner_review,scope_fingerprint}'='415142d4ba069103441a908bba4a15c3de73a828b9b7896a8556e29f32a97c02'
  ) then
    raise exception 'refusing exact-36 GTIN promotion rollback while approval audit rows exist';
  end if;
end;
$guard$;

revoke all on function public.apply_approved_gtin_promotion_plan(uuid,text,text,text,text) from public,anon,authenticated,service_role;
drop function public.apply_approved_gtin_promotion_plan(uuid,text,text,text,text);
drop function public.apply_approved_gtin_promotion_plan_exact_36(uuid,text,text,text,text);
revoke all on function public.validate_gtin_promotion_plan_read_only(jsonb) from public,anon,authenticated,service_role;
drop function public.validate_gtin_promotion_plan_read_only(jsonb);
drop function public.validate_gtin_promotion_plan_exact_36_read_only(jsonb);

alter function public.validate_gtin_promotion_plan_exact_45_read_only(jsonb)
  rename to validate_gtin_promotion_plan_read_only;
alter function public.apply_approved_gtin_promotion_plan_exact_45(uuid,text,text,text,text)
  rename to apply_approved_gtin_promotion_plan;

do $grants$
begin
  if to_regrole('retailer_catalogue_staging_executor') is not null then
    grant execute on function public.apply_approved_gtin_promotion_plan(uuid,text,text,text,text) to retailer_catalogue_staging_executor;
  elsif to_regrole('retailer_catalogue_production_executor') is not null then
    grant execute on function public.apply_approved_gtin_promotion_plan(uuid,text,text,text,text) to retailer_catalogue_production_executor;
  else raise exception 'GTIN promotion executor role missing'; end if;
end;
$grants$;

commit;
