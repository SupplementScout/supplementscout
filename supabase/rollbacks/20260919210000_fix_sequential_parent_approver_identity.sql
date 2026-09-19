begin;
do $rollback$
begin
  raise exception 'forward-only role-identity repair: superseded empty control plans must not be reactivated';
end
$rollback$;
rollback;
