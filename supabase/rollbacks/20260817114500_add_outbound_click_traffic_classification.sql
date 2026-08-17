begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $outbound_click_classification_rollback_preflight$
declare
  v_columns integer;
begin
  if current_user <> 'postgres' then
    raise exception 'Outbound click classification rollback requires database owner postgres';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260817114500'
      and name = 'add_outbound_click_traffic_classification'
  ) then
    raise exception 'Outbound click classification migration ledger row is missing';
  end if;

  select count(*) into v_columns
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'outbound_clicks'
    and column_name in (
      'traffic_class',
      'classification_reason',
      'client_family',
      'referrer_class',
      'fetch_context',
      'request_method'
    );

  if v_columns <> 6 then
    raise exception 'Outbound click classification rollback found an unexpected column state';
  end if;
end
$outbound_click_classification_rollback_preflight$;

alter table public.outbound_clicks
  drop constraint outbound_clicks_traffic_class_check,
  drop constraint outbound_clicks_classification_reason_check,
  drop constraint outbound_clicks_client_family_check,
  drop constraint outbound_clicks_referrer_class_check,
  drop constraint outbound_clicks_fetch_context_check,
  drop constraint outbound_clicks_request_method_check;

alter table public.outbound_clicks
  drop column traffic_class,
  drop column classification_reason,
  drop column client_family,
  drop column referrer_class,
  drop column fetch_context,
  drop column request_method;

commit;
