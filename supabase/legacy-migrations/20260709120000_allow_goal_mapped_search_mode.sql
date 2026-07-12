alter table public.search_events
  drop constraint if exists search_events_search_mode_check;

alter table public.search_events
  add constraint search_events_search_mode_check
    check (
      search_mode is null
      or search_mode in ('standard_ilike', 'goal_mapped_ilike')
    );
