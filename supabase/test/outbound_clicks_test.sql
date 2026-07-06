-- Verification script for 20260706_create_outbound_clicks.sql.
-- Run only against a disposable/test database after applying the migration.

begin;

do $$
declare
  expected_columns jsonb := '{
    "id": "bigint",
    "created_at": "timestamp with time zone",
    "offer_id": "bigint",
    "product_id": "bigint",
    "retailer_id": "bigint",
    "destination_url": "text",
    "source_page": "text"
  }'::jsonb;
  column_name_value text;
  data_type_value text;
begin
  if not exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'outbound_clicks'
  ) then
    raise exception 'Missing table: public.outbound_clicks';
  end if;

  for column_name_value, data_type_value in
    select key, value #>> '{}'
    from jsonb_each(expected_columns)
  loop
    if not exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'outbound_clicks'
        and column_name = column_name_value
        and data_type = data_type_value
    ) then
      raise exception 'Missing or incorrect column type: % expected %',
        column_name_value,
        data_type_value;
    end if;
  end loop;

  raise notice 'Outbound click column checks passed.';
end;
$$;

do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'outbound_clicks'
      and constraint_name = 'outbound_clicks_offer_id_fkey'
      and constraint_type = 'FOREIGN KEY'
  ) then
    raise exception 'Missing outbound_clicks offer foreign key';
  end if;

  if not exists (
    select 1
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'outbound_clicks'
      and constraint_name = 'outbound_clicks_product_id_fkey'
      and constraint_type = 'FOREIGN KEY'
  ) then
    raise exception 'Missing outbound_clicks product foreign key';
  end if;

  if not exists (
    select 1
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'outbound_clicks'
      and constraint_name = 'outbound_clicks_retailer_id_fkey'
      and constraint_type = 'FOREIGN KEY'
  ) then
    raise exception 'Missing outbound_clicks retailer foreign key';
  end if;

  if not exists (
    select 1
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'outbound_clicks'
      and constraint_name = 'outbound_clicks_source_page_check'
      and constraint_type = 'CHECK'
  ) then
    raise exception 'Missing outbound_clicks source_page check';
  end if;

  raise notice 'Outbound click constraint checks passed.';
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'outbound_clicks'
      and indexname = 'outbound_clicks_created_at_idx'
  ) then
    raise exception 'Missing outbound_clicks_created_at_idx';
  end if;

  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'outbound_clicks'
      and indexname = 'outbound_clicks_offer_id_idx'
  ) then
    raise exception 'Missing outbound_clicks_offer_id_idx';
  end if;

  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'outbound_clicks'
      and indexname = 'outbound_clicks_product_id_idx'
  ) then
    raise exception 'Missing outbound_clicks_product_id_idx';
  end if;

  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'outbound_clicks'
      and indexname = 'outbound_clicks_retailer_id_idx'
  ) then
    raise exception 'Missing outbound_clicks_retailer_id_idx';
  end if;

  raise notice 'Outbound click index checks passed.';
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_class table_class
    join pg_namespace namespace
      on namespace.oid = table_class.relnamespace
    where namespace.nspname = 'public'
      and table_class.relname = 'outbound_clicks'
      and table_class.relrowsecurity is true
  ) then
    raise exception 'RLS is not enabled for public.outbound_clicks';
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'outbound_clicks'
  ) then
    raise exception 'public.outbound_clicks should not expose direct table policies';
  end if;

  raise notice 'Outbound click RLS check passed.';
end;
$$;

rollback;
