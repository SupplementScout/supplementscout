-- Mutates one already-applied Stage 2 function while preserving its signature
-- and metadata. A second migration run must reject every scenario before DDL.

\if :{?stage2_test_database_confirmed}
\else
  \quit 3
\endif
\if :{?stage2_test_host}
\else
  \quit 3
\endif
\if :{?stage2_expected_database}
\else
  \quit 3
\endif
\if :{?stage2_scenario}
\else
  \quit 3
\endif

select
  :'stage2_test_database_confirmed' = '1'
  and :'stage2_test_host' in ('127.0.0.1', 'localhost')
  and current_database() = :'stage2_expected_database'
  and current_database() like 'supplementscout_stage2_test_%'
  and position('aftboxmrdgyhizicfsfu' in current_database()) = 0
  and position('dlsbwshkzdsvzubjftbv' in current_database()) = 0
  as stage2_guard_ok
\gset
\if :stage2_guard_ok
\else
  \echo 'Refusing applied-state mutation: disposable database guard failed.'
  \quit 3
\endif

select :'stage2_scenario' = 'applied_helper_body_drift' as stage2_case \gset
\if :stage2_case
  create or replace function public.stage2_prepare_default_only_merge(
    canonical_id bigint,
    candidate_id bigint
  ) returns jsonb
  language plpgsql
  security definer
  set search_path to 'pg_catalog', 'public'
  as $drift$
  begin
    return jsonb_build_object('drifted', true);
  end;
  $drift$;
\endif

select :'stage2_scenario' = 'applied_wrapper_body_drift' as stage2_case \gset
\if :stage2_case
  create or replace function public.merge_products(
    canonical_id bigint,
    candidate_id bigint
  ) returns jsonb
  language plpgsql
  security definer
  set search_path to 'pg_catalog', 'public'
  as $drift$
  begin
    return jsonb_build_object('drifted', true);
  end;
  $drift$;
\endif

select :'stage2_scenario' = 'applied_legacy_body_drift' as stage2_case \gset
\if :stage2_case
  create or replace function public.merge_products_with_decisions_stage1_legacy(
    canonical_id bigint,
    candidate_id bigint,
    decisions jsonb
  ) returns jsonb
  language plpgsql
  security definer
  set search_path to 'pg_catalog', 'public'
  as $drift$
  begin
    return jsonb_build_object('drifted', true);
  end;
  $drift$;
\endif

select :'stage2_scenario' = 'applied_acl_legacy_merge_anon' as stage2_case \gset
\if :stage2_case
  grant execute on function public.merge_products_stage1_legacy(bigint, bigint)
    to anon;
\endif

select :'stage2_scenario' = 'applied_acl_legacy_decisions_authenticated' as stage2_case \gset
\if :stage2_case
  grant execute on function public.merge_products_with_decisions_stage1_legacy(
    bigint,
    bigint,
    jsonb
  ) to authenticated;
\endif

select :'stage2_scenario' = 'applied_acl_helper_service_role' as stage2_case \gset
\if :stage2_case
  grant execute on function public.stage2_prepare_default_only_merge(
    bigint,
    bigint
  ) to service_role;
\endif

select :'stage2_scenario' = 'applied_acl_helper_public' as stage2_case \gset
\if :stage2_case
  grant execute on function public.stage2_prepare_default_only_merge(
    bigint,
    bigint
  ) to public;
\endif

select :'stage2_scenario' = 'applied_acl_wrapper_merge_missing_service_role' as stage2_case \gset
\if :stage2_case
  revoke execute on function public.merge_products(bigint, bigint)
    from service_role;
\endif

select :'stage2_scenario' = 'applied_acl_wrapper_merge_anon' as stage2_case \gset
\if :stage2_case
  grant execute on function public.merge_products(bigint, bigint)
    to anon;
\endif

select :'stage2_scenario' = 'applied_acl_wrapper_decisions_missing_service_role' as stage2_case \gset
\if :stage2_case
  revoke execute on function public.merge_products_with_decisions(
    bigint,
    bigint,
    jsonb
  ) from service_role;
\endif

select :'stage2_scenario' = 'applied_acl_wrapper_decisions_authenticated' as stage2_case \gset
\if :stage2_case
  grant execute on function public.merge_products_with_decisions(
    bigint,
    bigint,
    jsonb
  ) to authenticated;
\endif

select :'stage2_scenario' in (
  'applied_helper_body_drift',
  'applied_wrapper_body_drift',
  'applied_legacy_body_drift',
  'applied_acl_legacy_merge_anon',
  'applied_acl_legacy_decisions_authenticated',
  'applied_acl_helper_service_role',
  'applied_acl_helper_public',
  'applied_acl_wrapper_merge_missing_service_role',
  'applied_acl_wrapper_merge_anon',
  'applied_acl_wrapper_decisions_missing_service_role',
  'applied_acl_wrapper_decisions_authenticated'
) as stage2_known_case
\gset
\if :stage2_known_case
\else
  \echo 'Refusing applied-state mutation: unknown scenario.'
  \quit 3
\endif

update stage2_test.state_before
set snapshot = stage2_test.capture_state();
