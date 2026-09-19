begin;
do $rollback$
begin
  raise exception 'forward-only incident cleanup: preserved applied Jon''s children must remain applied and superseded children must not be reactivated; create a fresh guarded plan';
end
$rollback$;
rollback;
