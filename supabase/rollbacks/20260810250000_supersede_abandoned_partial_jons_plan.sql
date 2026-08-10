begin;
do $rollback$
begin
  raise exception 'forward-only control cleanup: the superseded partial Jon''s plan must not be reactivated; use a fresh guarded plan';
end
$rollback$;
rollback;
