begin;
do $rollback$
begin
  raise exception 'forward-only control cleanup: superseded expired Discount/Jon''s refresh plans must not be reactivated; generate fresh guarded plans';
end
$rollback$;
rollback;
