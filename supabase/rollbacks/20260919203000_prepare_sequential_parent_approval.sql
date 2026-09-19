begin;
do $rollback$
begin
  raise exception 'forward-only sequential approval repair: preserved applied offers and superseded control children must not be reactivated';
end
$rollback$;
rollback;
