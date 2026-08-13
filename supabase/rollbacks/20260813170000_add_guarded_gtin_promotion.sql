begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $rollback_guard$
begin
  if exists(select 1 from public.approved_import_plans where plan_kind='gtin_promotion') then
    raise exception 'refusing GTIN promotion rollback while approval audit rows exist';
  end if;
  if exists(select 1 from public.product_variants where gtin is not null and btrim(gtin)<>'') then
    raise exception 'refusing GTIN promotion rollback while canonical variant GTINs exist';
  end if;
end;
$rollback_guard$;

drop function if exists public.apply_approved_gtin_promotion_plan(uuid,text,text,text,text);
drop function if exists public.approve_gtin_promotion_plan(jsonb,text,text,text,timestamptz);
drop function if exists public.validate_gtin_promotion_plan_read_only(jsonb);
drop function if exists public.gtin_promotion_is_valid_gtin(text);
drop table if exists public.gtin_promotion_quarantine;
drop index if exists public.product_variants_gtin_unique;
alter table public.approved_import_plans drop column if exists apply_result;
alter table public.approved_import_plans
  drop constraint if exists approved_import_plans_plan_kind_check;
alter table public.approved_import_plans
  add constraint approved_import_plans_plan_kind_check
  check (plan_kind in ('feed','manual'));

commit;
