begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $preflight$
declare
  v_missing text;
begin
  if to_regprocedure('public.read_ra004_staging_preflight_v1(text,text,text,integer,text,text,integer)') is not null then
    raise exception 'RA004_PREFLIGHT_SCHEMA_DRIFT: metadata interface v1 already exists';
  end if;
  if to_regclass('public.retailers') is null
     or to_regclass('supabase_migrations.schema_migrations') is null
     or to_regclass('public.retailer_control_state_evidence_v1') is null
     or to_regprocedure('public.read_retailer_control_state_v1(bigint,text,text,text,timestamptz,text[],integer,integer)') is null
     or to_regprocedure('public.write_retailer_control_state_evidence_v1(uuid,integer,text,bigint,boolean,text,text,text,text,timestamptz,timestamptz,timestamptz,text,text,jsonb,text,text)') is null then
    raise exception 'RA004_PREFLIGHT_OBJECT_MISSING: prerequisite object is absent';
  end if;

  select required.object_name into v_missing
  from (values
    ('public.retailers.id'), ('public.retailers.name'), ('public.retailers.slug'),
    ('supabase_migrations.schema_migrations.version'),
    ('supabase_migrations.schema_migrations.name')
  ) required(object_name)
  left join information_schema.columns actual
    on required.object_name = actual.table_schema || '.' || actual.table_name || '.' || actual.column_name
  where actual.column_name is null
  limit 1;
  if found then
    raise exception 'RA004_PREFLIGHT_SCHEMA_DRIFT: required column % is absent', v_missing;
  end if;

  if exists (
    select 1 from pg_roles
    where rolname in ('ra004_staging_preflight_owner', 'ra004_staging_preflight_caller')
  ) then
    raise exception 'RA004_PREFLIGHT_SCHEMA_DRIFT: dedicated role already exists';
  end if;
end
$preflight$;

create role ra004_staging_preflight_owner
  nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
create role ra004_staging_preflight_caller
  nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;

alter role ra004_staging_preflight_caller set default_transaction_read_only = on;
alter role ra004_staging_preflight_caller set statement_timeout = '15s';
alter role ra004_staging_preflight_caller set idle_in_transaction_session_timeout = '30s';

grant usage on schema public, supabase_migrations to ra004_staging_preflight_owner;
grant select (id, name, slug) on table public.retailers to ra004_staging_preflight_owner;
grant select (version, name) on table supabase_migrations.schema_migrations to ra004_staging_preflight_owner;
create policy ra004_staging_preflight_retailer_read_v1
  on public.retailers for select to ra004_staging_preflight_owner
  using (lower(name) = '10 reps' or lower(slug) = '10-reps');

create function public.read_ra004_staging_preflight_v1(
  p_environment text,
  p_retailer_name text,
  p_retailer_slug text,
  p_expected_ledger_count integer,
  p_expected_ledger_fingerprint text,
  p_expected_session_user text,
  p_max_bytes integer
) returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog
as $ra004_preflight$
declare
  v_retailer_count integer;
  v_retailer jsonb;
  v_ledger_count integer;
  v_ledger_fingerprint text;
  v_target_count integer;
  v_target_name text;
  v_objects jsonb;
  v_functions jsonb;
  v_roles jsonb;
  v_acl jsonb;
  v_result jsonb;
  v_fingerprint text;
  v_function_oid oid := 'public.read_ra004_staging_preflight_v1(text,text,text,integer,text,text,integer)'::regprocedure::oid;
  v_forbidden_roles constant text[] := array[
    'service_role',
    'retailer_catalogue_staging_validator',
    'retailer_catalogue_staging_approver',
    'retailer_catalogue_staging_executor',
    'retailer_catalogue_production_validator',
    'retailer_catalogue_production_approver',
    'retailer_catalogue_production_executor',
    'retailer_control_state_exporter'
  ];
begin
  if p_environment is distinct from 'STAGING'
     or current_database() ~* '(^|[_-])(prod|production)([_-]|$)'
     or current_database() = 'aftboxmrdgyhizicfsfu' then
    raise exception 'RA004_PREFLIGHT_TARGET_BLOCKED: staging-only target required';
  end if;
  if (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname='read_ra004_staging_preflight_v1') <> 1 then
    raise exception 'RA004_PREFLIGHT_SCHEMA_DRIFT: metadata interface overload mismatch';
  end if;
  if p_retailer_name is distinct from '10 Reps'
     or p_retailer_slug is distinct from '10-reps'
     or p_expected_session_user is null
     or p_expected_session_user !~ '^[a-z][a-z0-9_]{2,62}$'
     or session_user is distinct from p_expected_session_user then
    raise exception 'RA004_PREFLIGHT_TARGET_BLOCKED: exact retailer and session identity required';
  end if;
  if p_expected_ledger_count < 1 or p_expected_ledger_count > 10000
     or p_expected_ledger_fingerprint !~ '^[0-9a-f]{64}$'
     or p_max_bytes < 4096 or p_max_bytes > 131072 then
    raise exception 'RA004_PREFLIGHT_LIMIT_INVALID: bounded ledger and output limits required';
  end if;

  select count(*)::integer,
         (array_agg(jsonb_build_object('id', r.id::text, 'name', r.name, 'slug', r.slug, 'match_count', 1) order by r.id))[1]
    into v_retailer_count, v_retailer
  from (
    select id, name, slug
    from public.retailers
    where lower(name) = lower(p_retailer_name) or lower(slug) = lower(p_retailer_slug)
    order by id
    limit 2
  ) r;
  if v_retailer_count <> 1 then
    raise exception 'RA004_PREFLIGHT_RETAILER_AMBIGUOUS: expected one retailer, found %', v_retailer_count;
  end if;

  with ordered as (
    select version, name, row_number() over (order by version, name)::integer ordinal
    from supabase_migrations.schema_migrations
  ), canonical as (
    select '{"migrations":[' || coalesce(string_agg(
      '{"identifier":' || to_json(version || '_' || name)::text ||
      ',"name":' || to_json(name)::text ||
      ',"ordinal":' || ordinal::text ||
      ',"version":' || to_json(version)::text || '}', ',' order by ordinal
    ), '') || '],"schema_version":1,"target_environment":"STAGING"}' document,
    count(*)::integer ledger_count
    from ordered
  )
  select ledger_count, encode(pg_catalog.sha256(convert_to(document, 'UTF8')), 'hex')
    into v_ledger_count, v_ledger_fingerprint
  from canonical;
  if v_ledger_count <> p_expected_ledger_count
     or v_ledger_fingerprint <> p_expected_ledger_fingerprint then
    raise exception 'RA004_PREFLIGHT_LEDGER_UNKNOWN: count or fingerprint mismatch';
  end if;

  select count(*)::integer, min(name)
    into v_target_count, v_target_name
  from supabase_migrations.schema_migrations
  where version = '20260924100000';
  if v_target_count <> 1
     or v_target_name is distinct from 'add_transactional_retailer_control_state_interface' then
    raise exception 'RA004_PREFLIGHT_LEDGER_UNKNOWN: control-state migration entry mismatch';
  end if;

  with expected(object_schema, object_name, object_kind, expected_state, object_oid) as (
    values
      ('public','retailers','TABLE','PRESENT',to_regclass('public.retailers')::oid),
      ('supabase_migrations','schema_migrations','TABLE','PRESENT',to_regclass('supabase_migrations.schema_migrations')::oid),
      ('public','retailer_control_state_evidence_v1','TABLE','PRESENT',to_regclass('public.retailer_control_state_evidence_v1')::oid),
      ('public','read_retailer_control_state_v1','FUNCTION','PRESENT',to_regprocedure('public.read_retailer_control_state_v1(bigint,text,text,text,timestamptz,text[],integer,integer)')::oid),
      ('public','write_retailer_control_state_evidence_v1','FUNCTION','PRESENT',to_regprocedure('public.write_retailer_control_state_evidence_v1(uuid,integer,text,bigint,boolean,text,text,text,text,timestamptz,timestamptz,timestamptz,text,text,jsonb,text,text)')::oid),
      ('public','read_ra004_staging_preflight_v1','FUNCTION','PRESENT',v_function_oid)
  )
  select jsonb_agg(jsonb_build_object(
    'object_schema', object_schema, 'object_name', object_name,
    'object_kind', object_kind, 'exists', object_oid is not null,
    'expected_state', expected_state
  ) order by object_schema, object_name)
  into v_objects from expected;
  if exists (
    select 1 from jsonb_array_elements(v_objects) item where not (item->>'exists')::boolean
  ) or jsonb_array_length(v_objects) > 32 then
    raise exception 'RA004_PREFLIGHT_OBJECT_MISSING: closed object inventory mismatch';
  end if;

  with expected(signature, expected_owner, expected_security, expected_volatility) as (
    values
      ('public.read_retailer_control_state_v1(bigint,text,text,text,timestamptz,text[],integer,integer)', 'retailer_control_state_read_owner', true, 's'),
      ('public.write_retailer_control_state_evidence_v1(uuid,integer,text,bigint,boolean,text,text,text,text,timestamptz,timestamptz,timestamptz,text,text,jsonb,text,text)', 'retailer_control_state_evidence_owner', true, 'v'),
      ('public.read_ra004_staging_preflight_v1(text,text,text,integer,text,text,integer)', 'ra004_staging_preflight_owner', true, 's')
  ), actual as (
    select e.*, p.oid, p.prosecdef, p.provolatile,
      pg_get_userbyid(p.proowner) owner,
      p.proconfig,
      encode(pg_catalog.sha256(convert_to(pg_get_functiondef(p.oid), 'UTF8')), 'hex') definition_sha256
    from expected e
    left join pg_proc p on p.oid = to_regprocedure(e.signature)
  )
  select jsonb_agg(jsonb_build_object(
    'schema','public', 'signature',signature, 'owner',owner,
    'security_definer',prosecdef, 'volatility',provolatile,
    'search_path',coalesce(to_jsonb(proconfig),'[]'::jsonb),
    'definition_sha256',definition_sha256
  ) order by signature)
  into v_functions from actual;
  if exists (
    select 1 from (
      with expected(signature, expected_owner, expected_security, expected_volatility) as (
        values
          ('public.read_retailer_control_state_v1(bigint,text,text,text,timestamptz,text[],integer,integer)', 'retailer_control_state_read_owner', true, 's'),
          ('public.write_retailer_control_state_evidence_v1(uuid,integer,text,bigint,boolean,text,text,text,text,timestamptz,timestamptz,timestamptz,text,text,jsonb,text,text)', 'retailer_control_state_evidence_owner', true, 'v'),
          ('public.read_ra004_staging_preflight_v1(text,text,text,integer,text,text,integer)', 'ra004_staging_preflight_owner', true, 's')
      )
      select e.*, p.oid, p.prosecdef, p.provolatile, pg_get_userbyid(p.proowner) owner, p.proconfig
      from expected e left join pg_proc p on p.oid=to_regprocedure(e.signature)
    ) f
    where f.oid is null or f.owner <> f.expected_owner
       or f.prosecdef is distinct from f.expected_security
       or f.provolatile <> f.expected_volatility
       or f.proconfig is distinct from array['search_path=pg_catalog']::text[]
  ) or jsonb_array_length(v_functions) > 8 then
    raise exception 'RA004_PREFLIGHT_SCHEMA_DRIFT: function contract mismatch';
  end if;

  with scoped_roles as (
    select r.oid, r.rolname, r.rolsuper, r.rolinherit, r.rolcreaterole, r.rolcreatedb,
      r.rolcanlogin, r.rolreplication, r.rolbypassrls
    from pg_roles r
    where r.rolname = any(array_append(v_forbidden_roles,
      'ra004_staging_preflight_owner') || array['ra004_staging_preflight_caller', p_expected_session_user])
  ), memberships as (
    select member_role.rolname member_name, granted_role.rolname membership_role,
      membership.set_option, membership.admin_option
    from pg_auth_members membership
    join pg_roles member_role on member_role.oid = membership.member
    join pg_roles granted_role on granted_role.oid = membership.roleid
    where member_role.rolname in ('ra004_staging_preflight_owner','ra004_staging_preflight_caller',p_expected_session_user)
       or granted_role.rolname in ('ra004_staging_preflight_owner','ra004_staging_preflight_caller')
  )
  select jsonb_agg(jsonb_build_object(
    'role_name', r.rolname, 'rolsuper',r.rolsuper, 'rolinherit',r.rolinherit,
    'rolcreaterole',r.rolcreaterole, 'rolcreatedb',r.rolcreatedb,
    'rolcanlogin',r.rolcanlogin, 'rolreplication',r.rolreplication,
    'rolbypassrls',r.rolbypassrls,
    'membership_role',m.membership_role, 'set_option',m.set_option,
    'admin_option',m.admin_option
  ) order by r.rolname, m.membership_role)
  into v_roles
  from scoped_roles r left join memberships m on m.member_name=r.rolname;

  if not exists (select 1 from pg_roles where rolname=p_expected_session_user and rolcanlogin)
     or exists (
       select 1 from pg_roles
       where rolname in ('ra004_staging_preflight_owner','ra004_staging_preflight_caller',p_expected_session_user)
         and (rolsuper or rolinherit or rolcreaterole or rolcreatedb or rolreplication or rolbypassrls
           or (rolname <> p_expected_session_user and rolcanlogin))
     )
     or exists (
       select 1 from pg_auth_members membership
       join pg_roles member_role on member_role.oid=membership.member
       join pg_roles granted_role on granted_role.oid=membership.roleid
       where member_role.rolname in ('ra004_staging_preflight_owner','ra004_staging_preflight_caller',p_expected_session_user)
          or granted_role.rolname in ('ra004_staging_preflight_owner','ra004_staging_preflight_caller')
     )
     or exists (
       select 1 from pg_roles forbidden
       where forbidden.rolname=any(v_forbidden_roles)
         and (pg_has_role(p_expected_session_user, forbidden.oid, 'MEMBER')
           or pg_has_role('ra004_staging_preflight_caller', forbidden.oid, 'MEMBER'))
     )
     or jsonb_array_length(v_roles) > 24 then
    raise exception 'RA004_PREFLIGHT_ROLE_UNSAFE: attribute or membership mismatch';
  end if;

  if not has_function_privilege(p_expected_session_user, v_function_oid, 'EXECUTE')
     or has_function_privilege('public', v_function_oid, 'EXECUTE')
     or not has_function_privilege('ra004_staging_preflight_caller', v_function_oid, 'EXECUTE')
     or exists (
       select 1 from pg_roles forbidden
       where forbidden.rolname=any(v_forbidden_roles)
         and has_function_privilege(forbidden.oid, v_function_oid, 'EXECUTE')
     )
     or exists (
       select 1
       from pg_proc proc
       cross join lateral aclexplode(coalesce(proc.proacl, acldefault('f',proc.proowner))) acl
       left join pg_roles grantee on grantee.oid=acl.grantee
       where proc.oid=v_function_oid
         and (
           coalesce(grantee.rolname,'PUBLIC') not in (
             'ra004_staging_preflight_owner','ra004_staging_preflight_caller',p_expected_session_user
           )
           or (grantee.rolname <> 'ra004_staging_preflight_owner' and acl.privilege_type <> 'EXECUTE')
         )
     )
     or exists (
       select 1 from pg_class relation join pg_namespace namespace on namespace.oid=relation.relnamespace
       where namespace.nspname not in ('pg_catalog','information_schema')
         and namespace.nspname !~ '^pg_toast'
         and relation.relkind in ('r','p','v','m','f')
         and (has_table_privilege(p_expected_session_user,relation.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
           or has_any_column_privilege(p_expected_session_user,relation.oid,'SELECT,INSERT,UPDATE,REFERENCES')
           or has_table_privilege('ra004_staging_preflight_caller',relation.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
           or has_any_column_privilege('ra004_staging_preflight_caller',relation.oid,'SELECT,INSERT,UPDATE,REFERENCES'))
     )
      or exists (
        select 1 from pg_class sequence join pg_namespace namespace on namespace.oid=sequence.relnamespace
        where namespace.nspname not in ('pg_catalog','information_schema')
          and namespace.nspname !~ '^pg_toast'
          and case when sequence.relkind='S' then
            has_sequence_privilege(p_expected_session_user,sequence.oid,'USAGE,SELECT,UPDATE')
            or has_sequence_privilege('ra004_staging_preflight_caller',sequence.oid,'USAGE,SELECT,UPDATE')
          else false end
      )
      or exists (
        select 1 from information_schema.table_privileges privilege
        where privilege.grantee='ra004_staging_preflight_owner'
      )
      or exists (
        select 1 from information_schema.column_privileges privilege
        where privilege.grantee='ra004_staging_preflight_owner'
          and not (
            privilege.privilege_type='SELECT'
            and ((privilege.table_schema='public' and privilege.table_name='retailers'
                  and privilege.column_name in ('id','name','slug'))
              or (privilege.table_schema='supabase_migrations' and privilege.table_name='schema_migrations'
                  and privilege.column_name in ('version','name')))
          )
      )
      or (select count(*) from information_schema.column_privileges privilege
          where privilege.grantee='ra004_staging_preflight_owner' and privilege.privilege_type='SELECT') <> 5
      or exists (
        select 1 from pg_class sequence join pg_namespace namespace on namespace.oid=sequence.relnamespace
        where case when sequence.relkind='S' then
          has_sequence_privilege('ra004_staging_preflight_owner',sequence.oid,'USAGE,SELECT,UPDATE')
        else false end
      )
      or not exists (
       select 1 from pg_class c
       where c.oid='public.retailer_control_state_evidence_v1'::regclass
         and c.relrowsecurity and c.relforcerowsecurity
      )
      or (select count(*) from pg_policy where polrelid='public.retailer_control_state_evidence_v1'::regclass) <> 3
      or exists (
        select 1 from pg_policy policy
        where policy.polrelid='public.retailer_control_state_evidence_v1'::regclass
          and not (
            policy.polpermissive
            and policy.polroles = case policy.polname
              when 'retailer_control_state_evidence_owner_insert_v1' then array['retailer_control_state_evidence_owner'::regrole::oid]
              when 'retailer_control_state_evidence_owner_select_v1' then array['retailer_control_state_evidence_owner'::regrole::oid]
              when 'retailer_control_state_read_owner_select_v1' then array['retailer_control_state_read_owner'::regrole::oid]
              else array[]::oid[]
            end
            and policy.polcmd = case policy.polname
              when 'retailer_control_state_evidence_owner_insert_v1' then 'a'::"char"
              else 'r'::"char"
            end
            and coalesce(pg_get_expr(policy.polqual,policy.polrelid),'') = case policy.polname
              when 'retailer_control_state_evidence_owner_insert_v1' then ''
              else 'true'
            end
            and coalesce(pg_get_expr(policy.polwithcheck,policy.polrelid),'') = case policy.polname
              when 'retailer_control_state_evidence_owner_insert_v1' then 'true'
              else ''
            end
          )
      ) then
    raise exception 'RA004_PREFLIGHT_ACL_UNSAFE: grant or RLS mismatch';
  end if;
  if not exists (
    select 1 from pg_policy policy join pg_class relation on relation.oid=policy.polrelid
    where policy.polrelid='public.retailers'::regclass
      and policy.polname='ra004_staging_preflight_retailer_read_v1'
      and policy.polcmd='r'
      and policy.polroles=array['ra004_staging_preflight_owner'::regrole::oid]
      and relation.relrowsecurity
      and pg_get_expr(policy.polqual,policy.polrelid) = '((lower(name) = ''10 reps''::text) OR (lower(slug) = ''10-reps''::text))'
      and policy.polwithcheck is null
  ) then
    raise exception 'RA004_PREFLIGHT_ACL_UNSAFE: retailer metadata policy mismatch';
  end if;

  with policy_rows as (
    select n.nspname object_schema, c.relname object_name,
      pg_get_userbyid(c.relowner) owner, c.relrowsecurity rls_enabled,
      c.relforcerowsecurity rls_forced, p.polname policy_name,
      p.polcmd::text policy_command,
      (select jsonb_agg(role_name order by role_name)
       from (select pg_get_userbyid(role_oid) role_name from unnest(p.polroles) role_oid) roles) policy_roles,
      pg_get_expr(p.polqual,p.polrelid) policy_using,
      pg_get_expr(p.polwithcheck,p.polrelid) policy_with_check,
      null::text grantee, null::text privilege_type
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    left join pg_policy p on p.polrelid=c.oid
    where c.oid in ('public.retailer_control_state_evidence_v1'::regclass,'public.retailers'::regclass)
      and (c.oid='public.retailer_control_state_evidence_v1'::regclass
        or p.polname='ra004_staging_preflight_retailer_read_v1')
  ), function_acl as (
    select 'public'::name object_schema, 'read_ra004_staging_preflight_v1'::name object_name,
      pg_get_userbyid(proc.proowner) owner, false rls_enabled, false rls_forced,
      null::name policy_name, null::text policy_command, null::jsonb policy_roles,
      null::text policy_using, null::text policy_with_check,
      coalesce(grantee.rolname,'PUBLIC') grantee, acl.privilege_type
    from pg_proc proc
    cross join lateral aclexplode(coalesce(proc.proacl, acldefault('f',proc.proowner))) acl
    left join pg_roles grantee on grantee.oid=acl.grantee
    where proc.oid=v_function_oid
  ), combined as (
    select * from policy_rows union all select * from function_acl
  )
  select jsonb_agg(jsonb_build_object(
    'object_schema',object_schema, 'object_name',object_name, 'owner',owner,
    'rls_enabled',rls_enabled, 'rls_forced',rls_forced,
    'policy_name',policy_name, 'policy_command',policy_command,
    'policy_roles',policy_roles, 'policy_using',policy_using,
    'policy_with_check',policy_with_check, 'grantee',grantee,
    'privilege_type',privilege_type
  ) order by object_schema,object_name,policy_name,grantee,privilege_type)
  into v_acl from combined;
  if jsonb_array_length(v_acl) > 64 then
    raise exception 'RA004_PREFLIGHT_LIMIT_EXCEEDED: ACL row cap';
  end if;

  v_result := jsonb_build_object(
    'schema_version','ra-004-staging-preflight-metadata-v1',
    'q2_retailer',v_retailer,
    'q3_migration_ledger',jsonb_build_object(
      'target_version','20260924100000',
      'target_name',v_target_name,
      'target_match_count',v_target_count,
      'ordered_ledger_count',v_ledger_count,
      'ordered_ledger_fingerprint',v_ledger_fingerprint
    ),
    'q4_objects',v_objects,
    'q5_functions',v_functions,
    'q6_roles',v_roles,
    'q7_acl_rls',v_acl,
    'snapshot',jsonb_build_object(
      'isolation','ONE_POSTGRESQL_STATEMENT',
      'metadata_only',true,
      'retailer_rows_read',v_retailer_count,
      'business_rows_read',0
    ),
    'metadata_fingerprint',repeat('0',64)
  );
  v_fingerprint := encode(pg_catalog.sha256(convert_to(v_result::text,'UTF8')),'hex');
  v_result := jsonb_set(v_result,'{metadata_fingerprint}',to_jsonb(v_fingerprint));
  if octet_length(v_result::text) > p_max_bytes
     or v_result::text ~* '(postgres(ql)?://|bearer[[:space:]]+[a-z0-9._~+/-]{8,}|"(password|token|secret|authorization|cookie|connection_string|database_url|service_role_key)"[[:space:]]*:)' then
    raise exception 'RA004_PREFLIGHT_LIMIT_EXCEEDED: unsafe or oversized output';
  end if;
  return v_result;
end
$ra004_preflight$;

alter function public.read_ra004_staging_preflight_v1(text,text,text,integer,text,text,integer)
  owner to ra004_staging_preflight_owner;

revoke all on function public.read_ra004_staging_preflight_v1(text,text,text,integer,text,text,integer)
  from public, anon, authenticated, service_role,
       retailer_catalogue_production_validator,
       retailer_catalogue_production_approver,
       retailer_catalogue_production_executor,
       retailer_control_state_exporter,
       ra004_staging_preflight_caller;
grant execute on function public.read_ra004_staging_preflight_v1(text,text,text,integer,text,text,integer)
  to ra004_staging_preflight_caller;

revoke all on all tables in schema public from ra004_staging_preflight_caller;
revoke all on all sequences in schema public from ra004_staging_preflight_caller;
revoke execute on all functions in schema public from ra004_staging_preflight_caller;
grant usage on schema public to ra004_staging_preflight_caller;
grant execute on function public.read_ra004_staging_preflight_v1(text,text,text,integer,text,text,integer)
  to ra004_staging_preflight_caller;

revoke service_role,
  retailer_catalogue_production_validator,
  retailer_catalogue_production_approver,
  retailer_catalogue_production_executor,
  retailer_control_state_exporter,
  retailer_control_state_read_owner,
  retailer_control_state_evidence_owner
from ra004_staging_preflight_owner, ra004_staging_preflight_caller;

comment on function public.read_ra004_staging_preflight_v1(text,text,text,integer,text,text,integer) is
  'RA-004 staging-only bounded metadata Q2-Q7. It never authorizes execution, production access, business reads, or writes.';

commit;
