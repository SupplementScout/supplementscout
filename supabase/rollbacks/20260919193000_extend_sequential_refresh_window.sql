begin;
raise exception 'Forward-only: the exact expired control-plan cleanup cannot be safely reactivated';
rollback;
