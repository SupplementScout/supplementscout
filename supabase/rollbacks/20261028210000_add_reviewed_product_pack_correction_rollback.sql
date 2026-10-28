begin;

set local lock_timeout='5s';
set local statement_timeout='30s';

select pg_advisory_xact_lock(hashtextextended('reviewed-product-pack-correction-v1',0));

do $guard$
begin
  if current_user<>'postgres' then
    raise exception 'reviewed product pack correction rollback requires postgres';
  end if;
  if exists(
    select 1 from public.approved_import_plans
    where source like 'reviewed-product-pack-correction-v1:%'
      and status='approved' and consumed_at is null and expires_at>now()
  ) then
    raise exception 'reviewed product pack correction rollback blocked by live approval';
  end if;
end
$guard$;

drop function if exists public.apply_approved_reviewed_product_pack_correction(uuid,jsonb,text);
drop function if exists public.approve_reviewed_product_pack_correction(jsonb,text,timestamptz);
drop function if exists public.read_reviewed_product_pack_correction_state(jsonb);
drop function if exists public.validate_reviewed_product_pack_correction_read_only(jsonb);
drop function if exists public.reviewed_product_pack_correction_assert_session(jsonb,text);
drop function if exists public.reviewed_product_pack_correction_validate_core(jsonb,boolean);

commit;
