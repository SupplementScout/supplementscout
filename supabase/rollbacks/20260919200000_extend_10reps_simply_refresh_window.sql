begin;
raise exception 'Forward-only: reducing the active sequential window can strand an in-progress refresh';
rollback;
