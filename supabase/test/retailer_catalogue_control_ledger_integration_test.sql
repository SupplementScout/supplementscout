\set ON_ERROR_STOP on

begin;

create function pg_temp.assert_true(condition boolean, message text)
returns text
language plpgsql
as $$
begin
  if not coalesce(condition, false) then
    raise exception 'assertion failed: %', message;
  end if;
  return 'ok - ' || message;
end;
$$;

select pg_temp.assert_true(current_database() = :'expected_database', 'runs only in the disposable database');
select pg_temp.assert_true((select count(*) = 3 from pg_tables where schemaname = 'public' and tablename like 'retailer_catalogue_%'), 'creates exactly three control tables');
select pg_temp.assert_true((select count(*) = 3 from pg_class where relnamespace = 'public'::regnamespace and relname like 'retailer_catalogue_%' and relrowsecurity), 'enables RLS on all control tables');
select pg_temp.assert_true((select count(*) = 3 from pg_class where relnamespace = 'public'::regnamespace and relname like 'retailer_catalogue_%' and relforcerowsecurity), 'forces RLS on all control tables');
select pg_temp.assert_true(not has_table_privilege('service_role', 'public.retailer_catalogue_parent_plans', 'INSERT'), 'service role has no parent-table INSERT');
select pg_temp.assert_true(not has_table_privilege('service_role', 'public.retailer_catalogue_child_plans', 'UPDATE'), 'service role has no child-table UPDATE');
select pg_temp.assert_true(not has_table_privilege('service_role', 'public.retailer_catalogue_apply_runs', 'DELETE'), 'service role has no run-table DELETE');
select pg_temp.assert_true(public.retailer_catalogue_parent_transition_allowed('PLANNED', 'APPROVED'), 'allows parent PLANNED to APPROVED');
select pg_temp.assert_true(not public.retailer_catalogue_parent_transition_allowed('PLANNED', 'COMPLETED'), 'blocks parent PLANNED to COMPLETED');
select pg_temp.assert_true(public.retailer_catalogue_child_transition_allowed('APPROVED', 'APPLYING'), 'allows child APPROVED to APPLYING');
select pg_temp.assert_true(not public.retailer_catalogue_child_transition_allowed('APPLIED', 'APPLYING'), 'blocks child APPLIED to APPLYING');
select pg_temp.assert_true(public.retailer_catalogue_apply_transition_allowed('STARTED', 'SUCCEEDED'), 'allows run STARTED to SUCCEEDED');
select pg_temp.assert_true(not public.retailer_catalogue_apply_transition_allowed('SUCCEEDED', 'STARTED'), 'blocks terminal run replay');
select pg_temp.assert_true((select count(*) = 11 from pg_proc where pronamespace = 'public'::regnamespace and proname in ('create_retailer_catalogue_parent_plan','approve_retailer_catalogue_parent_plan','generate_retailer_catalogue_child_plans','approve_retailer_catalogue_child_plan','begin_retailer_catalogue_child_apply','complete_retailer_catalogue_child_apply','fail_retailer_catalogue_child_apply','resume_retailer_catalogue_parent_plan','request_retailer_catalogue_child_rollback','complete_retailer_catalogue_child_rollback','get_retailer_catalogue_plan_status')), 'exposes exactly eleven ledger RPCs');
select pg_temp.assert_true((select count(*) = 17 from pg_proc where pronamespace = 'public'::regnamespace and proname like '%retailer_catalogue%'), 'installs the expected seventeen public functions');
select pg_temp.assert_true((select count(*) = 0 from pg_tables where schemaname = 'public' and tablename like '%review%queue%'), 'does not create a competing review queue');
select pg_temp.assert_true((select confdeltype = 'r' from pg_constraint where conname = 'retailer_catalogue_child_plans_parent_plan_id_fkey'), 'child-to-parent deletion is RESTRICT');
select pg_temp.assert_true((select confdeltype = 'r' from pg_constraint where conname = 'retailer_catalogue_apply_runs_parent_plan_id_fkey'), 'run-to-parent deletion is RESTRICT');
select pg_temp.assert_true((select confdeltype = 'r' from pg_constraint where conname = 'retailer_catalogue_apply_runs_child_plan_id_fkey'), 'run-to-child deletion is RESTRICT');
select pg_temp.assert_true((select count(*) = 0 from information_schema.role_table_grants where grantee in ('anon','authenticated','service_role') and table_schema = 'public' and table_name like 'retailer_catalogue_%'), 'API roles have no direct table grants');
select pg_temp.assert_true((select count(*) = 2 from information_schema.columns where table_schema = 'public' and table_name = 'retailer_catalogue_child_plans' and column_name in ('retailer_id','target_environment')), 'child plans seal retailer and target');
select pg_temp.assert_true((select count(*) = 6 from information_schema.columns where table_schema = 'public' and table_name = 'retailer_catalogue_apply_runs' and column_name in ('retailer_id','target_environment','approval_expires_at','rollback_manifest','updated_at','audit_log')), 'apply runs seal control and audit metadata');
select pg_temp.assert_true((select count(*) = 0 from pg_tables where schemaname = 'public' and tablename in ('products','product_variants','retailers','retailer_products','offers','price_history')), 'contract test contains no business tables');

rollback;
