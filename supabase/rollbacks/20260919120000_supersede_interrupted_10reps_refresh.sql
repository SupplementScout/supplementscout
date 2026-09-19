begin;
do $rollback$
begin
  raise exception 'forward-only incident cleanup: preserved applied 10 Reps children must remain applied and superseded children must not be reactivated';
end
$rollback$;
rollback;
