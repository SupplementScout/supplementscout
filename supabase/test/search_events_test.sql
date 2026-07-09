-- Verification script for 20260709_create_search_events.sql.
-- Run only against a disposable/test database after applying the migration.

begin;

do $$
declare
  expected_columns jsonb := '{
    "id": "bigint",
    "created_at": "timestamp with time zone",
    "event_type": "text",
    "source_page": "text",
    "query": "text",
    "applied_query": "text",
    "corrected_query": "text",
    "result_count": "integer",
    "match_status": "text",
    "search_mode": "text",
    "suggestion_type": "text",
    "suggestion_label": "text",
    "suggestion_href": "text"
  }'::jsonb;
  column_name_value text;
  data_type_value text;
begin
  if not exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'search_events'
  ) then
    raise exception 'Missing table: public.search_events';
  end if;

  for column_name_value, data_type_value in
    select key, value #>> '{}'
    from jsonb_each(expected_columns)
  loop
    if not exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'search_events'
        and column_name = column_name_value
        and data_type = data_type_value
    ) then
      raise exception 'Missing or incorrect column type: % expected %',
        column_name_value,
        data_type_value;
    end if;
  end loop;

  raise notice 'Search event column checks passed.';
end;
$$;

do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'search_events'
      and constraint_name = 'search_events_event_type_check'
      and constraint_type = 'CHECK'
  ) then
    raise exception 'Missing search_events event_type check';
  end if;

  if not exists (
    select 1
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'search_events'
      and constraint_name = 'search_events_source_page_check'
      and constraint_type = 'CHECK'
  ) then
    raise exception 'Missing search_events source_page check';
  end if;

  if not exists (
    select 1
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'search_events'
      and constraint_name = 'search_events_match_status_check'
      and constraint_type = 'CHECK'
  ) then
    raise exception 'Missing search_events match_status check';
  end if;

  if not exists (
    select 1
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'search_events'
      and constraint_name = 'search_events_search_mode_check'
      and constraint_type = 'CHECK'
  ) then
    raise exception 'Missing search_events search_mode check';
  end if;

  raise notice 'Search event constraint checks passed.';
end;
$$;

do $$
begin
  insert into public.search_events (
    event_type,
    source_page,
    query,
    applied_query,
    result_count,
    match_status,
    search_mode
  )
  values
    (
      'search_results',
      'search_page',
      'magnesium',
      'magnesium',
      1,
      'exact',
      'standard_ilike'
    ),
    (
      'search_results',
      'search_page',
      'muscle gain',
      'whey protein, creatine, mass gainer',
      3,
      'exact',
      'goal_mapped_ilike'
    ),
    (
      'search_results',
      'search_page',
      'unknown',
      'unknown',
      0,
      'none',
      null
    );

  begin
    insert into public.search_events (
      event_type,
      source_page,
      query,
      search_mode
    )
    values (
      'search_results',
      'search_page',
      'invalid mode',
      'invalid_mode'
    );

    raise exception 'Invalid search_mode was accepted';
  exception
    when check_violation then
      null;
  end;

  raise notice 'Search event search_mode value checks passed.';
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'search_events'
      and indexname = 'search_events_created_at_idx'
  ) then
    raise exception 'Missing search_events_created_at_idx';
  end if;

  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'search_events'
      and indexname = 'search_events_event_type_created_at_idx'
  ) then
    raise exception 'Missing search_events_event_type_created_at_idx';
  end if;

  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'search_events'
      and indexname = 'search_events_match_status_created_at_idx'
  ) then
    raise exception 'Missing search_events_match_status_created_at_idx';
  end if;

  raise notice 'Search event index checks passed.';
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
      and table_class.relname = 'search_events'
      and table_class.relrowsecurity is true
  ) then
    raise exception 'RLS is not enabled for public.search_events';
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'search_events'
  ) then
    raise exception 'public.search_events should not expose direct table policies';
  end if;

  raise notice 'Search event RLS check passed.';
end;
$$;

rollback;
