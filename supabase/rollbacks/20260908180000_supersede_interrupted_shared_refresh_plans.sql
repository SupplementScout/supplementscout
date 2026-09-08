begin;
do $rollback$
begin
  raise exception 'forward-only control cleanup: superseded interrupted refresh plans must not be reactivated; generate a fresh guarded plan';
end
$rollback$;
rollback;
