begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $outbound_click_classification_preflight$
declare
  v_existing_columns integer;
begin
  if current_user <> 'postgres' then
    raise exception 'Outbound click classification migration requires database owner postgres';
  end if;

  if to_regclass('public.outbound_clicks') is null then
    raise exception 'public.outbound_clicks is missing';
  end if;

  select count(*) into v_existing_columns
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

  if v_existing_columns <> 0 then
    raise exception 'Outbound click classification columns are partially or fully present';
  end if;
end
$outbound_click_classification_preflight$;

alter table public.outbound_clicks
  add column traffic_class text not null default 'unknown',
  add column classification_reason text not null default 'legacy_unclassified',
  add column client_family text not null default 'unknown',
  add column referrer_class text not null default 'missing',
  add column fetch_context text not null default 'missing',
  add column request_method text not null default 'GET';

alter table public.outbound_clicks
  add constraint outbound_clicks_traffic_class_check
    check (traffic_class in ('likely_human', 'likely_automated', 'unknown')),
  add constraint outbound_clicks_classification_reason_check
    check (classification_reason in (
      'legacy_unclassified',
      'browser_same_origin_navigation',
      'known_automation_client',
      'missing_user_agent',
      'non_navigation_fetch',
      'incomplete_navigation_signals'
    )),
  add constraint outbound_clicks_client_family_check
    check (client_family in (
      'chrome',
      'edge',
      'firefox',
      'safari',
      'other_browser',
      'automation_client',
      'unknown'
    )),
  add constraint outbound_clicks_referrer_class_check
    check (referrer_class in (
      'same_origin_product',
      'same_origin_other',
      'external',
      'missing',
      'invalid'
    )),
  add constraint outbound_clicks_fetch_context_check
    check (fetch_context in (
      'same_origin_navigation',
      'other_navigation',
      'non_navigation',
      'missing'
    )),
  add constraint outbound_clicks_request_method_check
    check (request_method = 'GET');

comment on column public.outbound_clicks.traffic_class is
  'Coarse redirect classification; never a guaranteed person count.';
comment on column public.outbound_clicks.client_family is
  'Derived browser/client family only; the full user-agent is not stored.';
comment on column public.outbound_clicks.referrer_class is
  'Derived referrer category only; the full referrer is not stored.';
comment on column public.outbound_clicks.fetch_context is
  'Derived Sec-Fetch navigation category only; raw request headers are not stored.';

commit;
