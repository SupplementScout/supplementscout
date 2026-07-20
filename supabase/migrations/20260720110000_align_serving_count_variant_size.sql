begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

create or replace function public.atomic_import_normalize_size(p_value text)
returns jsonb
language plpgsql
immutable
strict
set search_path = pg_catalog
as $normalize_size$
declare
  v_match text[];
  v_amount numeric;
  v_unit text;
begin
  v_match := regexp_match(
    lower(trim(p_value)),
    '^([0-9]+([.,][0-9]+)?)[[:space:]]*(kg|g|mg|mcg|iu|l|ml|serving|servings|serve|serves)$'
  );
  if v_match is null then return null; end if;
  v_amount := replace(v_match[1], ',', '.')::numeric;
  v_unit := v_match[3];
  if v_amount <= 0 then return null; end if;
  return case v_unit
    when 'kg' then jsonb_build_object('value', v_amount * 1000, 'unit', 'g', 'dimension', 'mass')
    when 'mg' then jsonb_build_object('value', v_amount / 1000, 'unit', 'g', 'dimension', 'mass')
    when 'mcg' then jsonb_build_object('value', v_amount / 1000000, 'unit', 'g', 'dimension', 'mass')
    when 'l' then jsonb_build_object('value', v_amount * 1000, 'unit', 'ml', 'dimension', 'volume')
    when 'ml' then jsonb_build_object('value', v_amount, 'unit', 'ml', 'dimension', 'volume')
    when 'iu' then jsonb_build_object('value', v_amount, 'unit', 'iu', 'dimension', 'potency')
    when 'serving' then jsonb_build_object('value', v_amount, 'unit', 'servings', 'dimension', 'count')
    when 'servings' then jsonb_build_object('value', v_amount, 'unit', 'servings', 'dimension', 'count')
    when 'serve' then jsonb_build_object('value', v_amount, 'unit', 'servings', 'dimension', 'count')
    when 'serves' then jsonb_build_object('value', v_amount, 'unit', 'servings', 'dimension', 'count')
    else jsonb_build_object('value', v_amount, 'unit', 'g', 'dimension', 'mass')
  end;
end;
$normalize_size$;

alter function public.atomic_import_normalize_size(text) owner to postgres;
revoke all on function public.atomic_import_normalize_size(text) from public, anon, authenticated, service_role;

commit;
