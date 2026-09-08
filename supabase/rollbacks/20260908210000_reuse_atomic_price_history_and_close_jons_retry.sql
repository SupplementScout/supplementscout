begin;
do $rollback$
begin
  raise exception 'forward-only price-history correction: closed Jon''s controls must not be reactivated and duplicate history behavior must not return';
end
$rollback$;
rollback;
