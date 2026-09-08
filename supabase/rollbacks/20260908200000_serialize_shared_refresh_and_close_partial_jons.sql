begin;
do $rollback$
begin
  raise exception 'forward-only incident cleanup: the applied Jon''s child must remain preserved and superseded children must not be reactivated; generate a fresh guarded plan';
end
$rollback$;
rollback;
