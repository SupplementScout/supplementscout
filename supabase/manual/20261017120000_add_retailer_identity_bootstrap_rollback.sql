begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $guard$
begin
  if exists(select 1 from public.approved_import_plans where plan_kind='retailer_identity_bootstrap') then
    raise exception 'retailer identity bootstrap rollback blocked: approval evidence exists';
  end if;
end
$guard$;

drop index if exists public.approved_import_plans_one_active_retailer_bootstrap_slug_idx;
drop index if exists public.retailers_normalized_slug_unique_idx;
drop function if exists public.apply_approved_retailer_identity_bootstrap(uuid,text,text,text,uuid,text,text,text);
drop function if exists public.approve_retailer_identity_bootstrap(jsonb,text,uuid,timestamptz);
drop function if exists public.validate_retailer_identity_bootstrap_plan(jsonb,text,uuid,timestamptz);
drop function if exists public.retailer_identity_website_origin(text);
drop function if exists public.retailer_identity_normalized_slug(text);
drop function if exists public.retailer_identity_normalized_name(text);

alter table public.approved_import_plans drop constraint approved_import_plans_plan_kind_check;
alter table public.approved_import_plans add constraint approved_import_plans_plan_kind_check
  check (plan_kind in ('feed','manual','gtin_promotion'));

commit;
