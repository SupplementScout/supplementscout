-- Central, retailer-neutral, read-only control-plan status channel.
-- The caller role is intentionally created NOLOGIN. Credential activation is a
-- separate, short-lived operation and is never stored in this migration.

do $preflight$
declare
  v_target jsonb;
  v_rpc record;
begin
  if to_regprocedure('public.retailer_catalogue_actual_database_target()') is null then
    raise exception 'RA_STAB_CENTRAL_TARGET_ATTESTATION_MISSING';
  end if;
  select public.retailer_catalogue_actual_database_target() into v_target;
  if v_target->>'target_environment' <> 'PRODUCTION'
     or v_target->>'project_ref' <> 'aftboxmrdgyhizicfsfu'
     or v_target->>'database_identity' <> 'supplementscout-production:aftboxmrdgyhizicfsfu' then
    raise exception 'RA_STAB_CENTRAL_WRONG_TARGET';
  end if;

  select pg_get_userbyid(p.proowner) owner,p.provolatile,p.prosecdef,p.proconfig
    into v_rpc
  from pg_proc p
  where p.oid=to_regprocedure('public.get_retailer_catalogue_plan_status(uuid)');
  if not found or v_rpc.owner <> 'postgres' or v_rpc.provolatile <> 's'
     or not v_rpc.prosecdef
     or not ('search_path=pg_catalog, public, pg_temp'=any(v_rpc.proconfig))
     or has_function_privilege('public',
       'public.get_retailer_catalogue_plan_status(uuid)','EXECUTE') then
    raise exception 'RA_STAB_CENTRAL_SOURCE_RPC_DRIFT';
  end if;
  if to_regnamespace('retailer_readback') is not null
     or to_regprocedure('retailer_readback.read_control_plan_status_v1(uuid)') is not null
     or exists(select 1 from pg_roles where rolname='retailer_control_plan_readback_caller') then
    raise exception 'RA_STAB_CENTRAL_INTERFACE_ALREADY_EXISTS';
  end if;
end
$preflight$;

-- Restore the baseline contract. This event-trigger helper is administrative;
-- it was never intended to be executable through PostgreSQL PUBLIC.
revoke execute on function public.rls_auto_enable() from public;

create role retailer_control_plan_readback_caller
  nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls
  connection limit 1;

alter role retailer_control_plan_readback_caller set default_transaction_read_only=on;
alter role retailer_control_plan_readback_caller set statement_timeout='15s';
alter role retailer_control_plan_readback_caller set lock_timeout='5s';
alter role retailer_control_plan_readback_caller set idle_in_transaction_session_timeout='15s';
alter role retailer_control_plan_readback_caller set idle_session_timeout='1min';

create schema retailer_readback authorization postgres;
revoke all on schema retailer_readback from public,anon,authenticated,service_role,
  retailer_catalogue_production_validator,retailer_catalogue_production_approver,
  retailer_catalogue_production_executor,retailer_control_plan_readback_caller;

create function retailer_readback.read_control_plan_status_v1(p_parent_plan_id uuid)
returns jsonb
language sql
stable
security definer
set search_path=pg_catalog
as $readback$
  select public.get_retailer_catalogue_plan_status(p_parent_plan_id)
$readback$;

revoke all on function retailer_readback.read_control_plan_status_v1(uuid)
  from public,anon,authenticated,service_role,
       retailer_catalogue_production_validator,retailer_catalogue_production_approver,
       retailer_catalogue_production_executor,retailer_control_plan_readback_caller;
grant usage on schema retailer_readback to retailer_control_plan_readback_caller;
grant execute on function retailer_readback.read_control_plan_status_v1(uuid)
  to retailer_control_plan_readback_caller;

do $postflight$
declare
  v_role pg_roles%rowtype;
  v_function record;
  v_unexpected boolean;
begin
  select * into v_role from pg_roles where rolname='retailer_control_plan_readback_caller';
  if not found or v_role.rolcanlogin or v_role.rolinherit or v_role.rolsuper
     or v_role.rolcreatedb or v_role.rolcreaterole or v_role.rolreplication
     or v_role.rolbypassrls or v_role.rolconnlimit <> 1 then
    raise exception 'RA_STAB_CENTRAL_CALLER_ROLE_DRIFT';
  end if;
  if not array['default_transaction_read_only=on','statement_timeout=15s','lock_timeout=5s',
      'idle_in_transaction_session_timeout=15s','idle_session_timeout=1min']::text[]
      <@ coalesce(v_role.rolconfig,array[]::text[]) then
    raise exception 'RA_STAB_CENTRAL_CALLER_SETTINGS_DRIFT';
  end if;
  if exists(
    select 1 from pg_auth_members m join pg_roles r on r.oid=m.member
    where r.rolname='retailer_control_plan_readback_caller'
  ) then raise exception 'RA_STAB_CENTRAL_CALLER_MEMBERSHIP_DRIFT'; end if;

  select pg_get_userbyid(p.proowner) owner,p.provolatile,p.prosecdef,p.proconfig,p.prosrc
    into v_function from pg_proc p
  where p.oid='retailer_readback.read_control_plan_status_v1(uuid)'::regprocedure;
  if v_function.owner <> 'postgres'
     or v_function.provolatile <> 's' or not v_function.prosecdef
     or v_function.proconfig <> array['search_path=pg_catalog']::text[]
     or position('public.get_retailer_catalogue_plan_status(p_parent_plan_id)'
       in v_function.prosrc)=0 then
    raise exception 'RA_STAB_CENTRAL_WRAPPER_DRIFT';
  end if;

  select exists(
    select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname not in ('pg_catalog','information_schema')
      and has_schema_privilege('retailer_control_plan_readback_caller',n.oid,'USAGE')
      and case when c.relkind in ('r','p','v','m','f') then
        has_table_privilege('retailer_control_plan_readback_caller',c.oid,
          'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
      when c.relkind='S' then
        has_sequence_privilege('retailer_control_plan_readback_caller',c.oid,'USAGE,SELECT,UPDATE')
      else false end
  ) into v_unexpected;
  if v_unexpected then raise exception 'RA_STAB_CENTRAL_REACHABLE_RELATION_PRIVILEGE'; end if;

  if has_schema_privilege('retailer_control_plan_readback_caller','retailer_readback','CREATE')
     or not has_schema_privilege('retailer_control_plan_readback_caller','retailer_readback','USAGE')
     or not has_function_privilege('retailer_control_plan_readback_caller',
       'retailer_readback.read_control_plan_status_v1(uuid)','EXECUTE')
     or has_function_privilege('retailer_control_plan_readback_caller',
       'public.get_retailer_catalogue_plan_status(uuid)','EXECUTE')
     or has_function_privilege('public','public.rls_auto_enable()','EXECUTE')
     or exists(
       select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
       where n.nspname='public' and p.prosecdef
         and has_function_privilege('retailer_control_plan_readback_caller',p.oid,'EXECUTE')
     ) then
    raise exception 'RA_STAB_CENTRAL_CALLER_CAPABILITY_DRIFT';
  end if;
end
$postflight$;
