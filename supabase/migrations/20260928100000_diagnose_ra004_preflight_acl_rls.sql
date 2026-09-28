-- Forward-only correction for the RA-004 preflight ACL/RLS contract.
-- The applied 20260927103000 migration remains immutable. This migration is
-- closed in both selectors until a separate owner-authorized activation.
do $migration$
declare
  v_oid oid := to_regprocedure('public.read_ra004_staging_preflight_v1(text,text,text,integer,text,text,integer)');
  v_body text;
  v_marker text := '  if not has_function_privilege(p_expected_session_user, v_function_oid, ''EXECUTE'')';
  v_table_old text := $old$
     or exists (
       select 1 from pg_class relation join pg_namespace namespace on namespace.oid=relation.relnamespace
       where namespace.nspname not in ('pg_catalog','information_schema')
         and namespace.nspname !~ '^pg_toast'
         and relation.relkind in ('r','p','v','m','f')
         and (has_table_privilege(p_expected_session_user,relation.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
           or has_any_column_privilege(p_expected_session_user,relation.oid,'SELECT,INSERT,UPDATE,REFERENCES'))
     )
      or exists (
        select 1 from pg_class sequence join pg_namespace namespace on namespace.oid=sequence.relnamespace
        where namespace.nspname not in ('pg_catalog','information_schema')
          and namespace.nspname !~ '^pg_toast'
          and case when sequence.relkind='S' then
            has_sequence_privilege(p_expected_session_user,sequence.oid,'USAGE,SELECT,UPDATE')
          else false end
      )$old$;
  v_table_new text := $new$
     or exists (
       select 1 from pg_class relation
       cross join lateral aclexplode(coalesce(relation.relacl,acldefault(
         case when relation.relkind='S' then 'S'::"char" else 'r'::"char" end,relation.relowner))) acl
       where acl.grantee=(select oid from pg_roles where rolname=p_expected_session_user)
         and relation.relkind in ('r','p','v','m','f')
     )
     or exists (
       select 1 from pg_attribute attribute
       cross join lateral aclexplode(attribute.attacl) acl
       where acl.grantee=(select oid from pg_roles where rolname=p_expected_session_user)
     )
     or exists (
       select 1 from pg_class sequence
       cross join lateral aclexplode(coalesce(sequence.relacl,acldefault('S',sequence.relowner))) acl
       where sequence.relkind='S'
         and acl.grantee=(select oid from pg_roles where rolname=p_expected_session_user)
     )$new$;
  v_diagnostics text := $diagnostics$
  if not has_function_privilege(p_expected_session_user, v_function_oid, 'EXECUTE') then
    raise exception 'RA004_PREFLIGHT_RPC_EXECUTE_MISSING: expected session role lacks RPC execute';
  end if;
  if has_function_privilege('public', v_function_oid, 'EXECUTE') then
    raise exception 'RA004_PREFLIGHT_PUBLIC_EXECUTE_UNSAFE: PUBLIC may execute preflight RPC';
  end if;
  if exists (
    select 1 from pg_roles forbidden
    where forbidden.rolname=any(v_forbidden_roles)
      and has_function_privilege(forbidden.oid,v_function_oid,'EXECUTE')
  ) then
    raise exception 'RA004_PREFLIGHT_FORBIDDEN_ROLE_EXECUTE_UNSAFE: forbidden role may execute preflight RPC';
  end if;
  if exists (
    select 1 from pg_proc proc
    cross join lateral aclexplode(coalesce(proc.proacl,acldefault('f',proc.proowner))) acl
    left join pg_roles grantee on grantee.oid=acl.grantee
    where proc.oid=v_function_oid
      and (coalesce(grantee.rolname,'PUBLIC') not in ('postgres',p_expected_session_user)
        or (grantee.rolname <> 'postgres' and acl.privilege_type <> 'EXECUTE'))
  ) then
    raise exception 'RA004_PREFLIGHT_FUNCTION_GRANT_MISMATCH: preflight RPC grant list differs';
  end if;
  if exists (
    select 1 from pg_class relation
    cross join lateral aclexplode(coalesce(relation.relacl,acldefault(
      case when relation.relkind='S' then 'S'::"char" else 'r'::"char" end,relation.relowner))) acl
    where relation.relkind in ('r','p','v','m','f')
      and acl.grantee=(select oid from pg_roles where rolname=p_expected_session_user)
  ) then
    raise exception 'RA004_PREFLIGHT_TABLE_PRIVILEGE_UNSAFE: direct table grant exists';
  end if;
  if exists (
    select 1 from pg_attribute attribute
    cross join lateral aclexplode(attribute.attacl) acl
    where acl.grantee=(select oid from pg_roles where rolname=p_expected_session_user)
  ) then
    raise exception 'RA004_PREFLIGHT_COLUMN_PRIVILEGE_UNSAFE: direct column grant exists';
  end if;
  if exists (
    select 1 from pg_class sequence
    cross join lateral aclexplode(coalesce(sequence.relacl,acldefault('S',sequence.relowner))) acl
    where sequence.relkind='S'
      and acl.grantee=(select oid from pg_roles where rolname=p_expected_session_user)
  ) then
    raise exception 'RA004_PREFLIGHT_SEQUENCE_PRIVILEGE_UNSAFE: direct sequence grant exists';
  end if;
  if not exists (
    select 1 from pg_class relation
    where relation.oid='public.retailer_control_state_evidence_v1'::regclass
      and relation.relrowsecurity
  ) then
    raise exception 'RA004_PREFLIGHT_RLS_NOT_ENABLED: evidence ledger RLS is disabled';
  end if;
  if not exists (
    select 1 from pg_class relation
    where relation.oid='public.retailer_control_state_evidence_v1'::regclass
      and relation.relforcerowsecurity
  ) then
    raise exception 'RA004_PREFLIGHT_RLS_NOT_FORCED: evidence ledger RLS is not forced';
  end if;
  if (select count(*) from pg_policy where polrelid='public.retailer_control_state_evidence_v1'::regclass) <> 3 then
    raise exception 'RA004_PREFLIGHT_POLICY_COUNT_MISMATCH: evidence ledger policy count differs';
  end if;
  if exists (
    select 1 from pg_policy policy
    where policy.polrelid='public.retailer_control_state_evidence_v1'::regclass
      and policy.polroles <> case policy.polname
        when 'retailer_control_state_evidence_owner_insert_v1' then array['postgres'::regrole::oid]
        when 'retailer_control_state_evidence_owner_select_v1' then array['postgres'::regrole::oid]
        when 'retailer_control_state_read_owner_select_v1' then array['postgres'::regrole::oid]
        else array[]::oid[] end
  ) then
    raise exception 'RA004_PREFLIGHT_POLICY_ROLE_MISMATCH: evidence ledger policy role differs';
  end if;
  if exists (
    select 1 from pg_policy policy
    where policy.polrelid='public.retailer_control_state_evidence_v1'::regclass
      and (not policy.polpermissive
        or policy.polcmd <> case policy.polname when 'retailer_control_state_evidence_owner_insert_v1' then 'a'::"char" else 'r'::"char" end)
  ) then
    raise exception 'RA004_PREFLIGHT_POLICY_COMMAND_MISMATCH: evidence ledger policy command differs';
  end if;
  if exists (
    select 1 from pg_policy policy
    where policy.polrelid='public.retailer_control_state_evidence_v1'::regclass
      and (coalesce(pg_get_expr(policy.polqual,policy.polrelid),'') <> case policy.polname
             when 'retailer_control_state_evidence_owner_insert_v1' then '' else 'true' end
        or coalesce(pg_get_expr(policy.polwithcheck,policy.polrelid),'') <> case policy.polname
             when 'retailer_control_state_evidence_owner_insert_v1' then 'true' else '' end)
  ) then
    raise exception 'RA004_PREFLIGHT_POLICY_EXPRESSION_MISMATCH: evidence ledger policy expression differs';
  end if;
$diagnostics$;
begin
  if current_user <> 'postgres' or v_oid is null then
    raise exception 'RA004_ACL_DIAGNOSTIC_MIGRATION_TARGET_MISMATCH';
  end if;
  select prosrc into v_body from pg_proc where oid=v_oid;
  if length(v_body)-length(replace(v_body,v_marker,'')) <> length(v_marker)
     or length(v_body)-length(replace(v_body,v_table_old,'')) <> length(v_table_old)
     or position('RA004_PREFLIGHT_ACL_UNSAFE: grant or RLS mismatch' in v_body)=0
     or position('RA004_PREFLIGHT_ACL_UNSAFE: retailer metadata policy mismatch' in v_body)=0 then
    raise exception 'RA004_ACL_DIAGNOSTIC_SOURCE_DRIFT';
  end if;
  v_body := replace(v_body,v_marker,v_diagnostics||v_marker);
  v_body := replace(v_body,v_table_old,v_table_new);
  v_body := replace(v_body,'RA004_PREFLIGHT_ACL_UNSAFE: grant or RLS mismatch',
    'RA004_PREFLIGHT_UNCLASSIFIED_SECURITY_MISMATCH: reviewed ACL/RLS checks diverged');
  v_body := replace(v_body,'RA004_PREFLIGHT_ACL_UNSAFE: retailer metadata policy mismatch',
    'RA004_PREFLIGHT_RETAILER_POLICY_MISMATCH: retailer read policy differs');
  execute 'create or replace function public.read_ra004_staging_preflight_v1(p_environment text,p_retailer_name text,p_retailer_slug text,p_expected_ledger_count integer,p_expected_ledger_fingerprint text,p_expected_session_user text,p_max_bytes integer) returns jsonb language plpgsql stable security definer set search_path=pg_catalog as '
    || quote_literal(v_body);
end
$migration$;

alter function public.read_ra004_staging_preflight_v1(text,text,text,integer,text,text,integer) owner to postgres;
revoke all on function public.read_ra004_staging_preflight_v1(text,text,text,integer,text,text,integer) from public;
