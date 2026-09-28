-- Forward-only correction for the RA-004 transactional control-state response.
-- The applied interface migrations remain immutable. This migration is closed
-- in both selectors until a separate owner-authorized staging activation.
do $migration$
declare
  v_oid oid := to_regprocedure(
    'public.read_retailer_control_state_v1(bigint,text,text,text,timestamptz,text[],integer,integer)'
  );
  v_body text;
  v_old text := $old$'provider_identity',jsonb_build_object('mode','live-read-only','provider_id','transactional-rpc-v1',
      'credential_type','DEDICATED_CONTROL_STATE_EXPORTER','read_only_proven',true,
      'service_role',false,'mutation_capabilities','[]'::jsonb,
      'approved_interfaces',jsonb_build_array('public.read_retailer_control_state_v1'))$old$;
  v_new text := $new$'provider_identity',jsonb_build_object('mode','live-read-only','provider_id','transactional-rpc-v1',
      'credential_type','DEDICATED_CONTROL_STATE_EXPORTER','session_user',session_user,
      'read_only_proven',true,'service_role',false,'mutation_capabilities','[]'::jsonb,
      'approved_interfaces',jsonb_build_array('public.read_retailer_control_state_v1'))$new$;
begin
  if current_user <> 'postgres' then
    raise exception 'RA004_CONTROL_EXPORT_MIGRATION_USER_MISMATCH';
  end if;
  if v_oid is null then
    raise exception 'RA004_CONTROL_EXPORT_FUNCTION_MISSING';
  end if;
  if not exists (
    select 1
    from pg_proc
    where oid=v_oid
      and prokind='f'
      and pg_get_userbyid(proowner)='postgres'
      and provolatile='s'
      and prosecdef
      and coalesce(proconfig,array[]::text[]) @> array['search_path=pg_catalog']::text[]
  ) then
    raise exception 'RA004_CONTROL_EXPORT_FUNCTION_CONTRACT_DRIFT';
  end if;

  select prosrc into strict v_body from pg_proc where oid=v_oid;
  if length(v_body)-length(replace(v_body,v_old,'')) <> length(v_old)
     or position(v_new in v_body) <> 0
     or length(v_body)-length(replace(v_body,'''provider_id'',''transactional-rpc-v1''',''))
        <> length('''provider_id'',''transactional-rpc-v1''') then
    raise exception 'RA004_CONTROL_EXPORT_PROVIDER_IDENTITY_SOURCE_DRIFT';
  end if;

  v_body := replace(v_body,v_old,v_new);
  execute 'create or replace function public.read_retailer_control_state_v1('
    || 'p_retailer_id bigint,p_retailer_name text,p_baseline_sha text,'
    || 'p_authorization_fingerprint text,p_authorization_valid_until timestamptz,'
    || 'p_required_sources text[],p_max_records integer,p_max_bytes integer) returns jsonb '
    || 'language plpgsql stable security definer set search_path=pg_catalog as '
    || quote_literal(v_body);
end
$migration$;

alter function public.read_retailer_control_state_v1(bigint,text,text,text,timestamptz,text[],integer,integer)
  owner to postgres;

revoke all on function public.read_retailer_control_state_v1(bigint,text,text,text,timestamptz,text[],integer,integer)
  from public,anon,authenticated,service_role,
       retailer_catalogue_production_validator,retailer_catalogue_production_approver,
       retailer_catalogue_production_executor;

comment on function public.read_retailer_control_state_v1(bigint,text,text,text,timestamptz,text[],integer,integer) is
  'RA-004 v1 bounded one-statement control-state snapshot with request-bound provider identity. CLEAR is evidence only and never shadow authorization.';

do $verify$
declare
  v_oid oid := to_regprocedure(
    'public.read_retailer_control_state_v1(bigint,text,text,text,timestamptz,text[],integer,integer)'
  );
  v_body text;
begin
  select prosrc into strict v_body from pg_proc where oid=v_oid;
  if length(v_body)-length(replace(v_body,'''provider_id'',''transactional-rpc-v1''',''))
       <> length('''provider_id'',''transactional-rpc-v1''')
     or length(v_body)-length(replace(v_body,'''session_user'',session_user',''))
       <> length('''session_user'',session_user')
     or not exists (
       select 1 from pg_proc
       where oid=v_oid
         and pg_get_userbyid(proowner)='postgres'
         and provolatile='s'
         and prosecdef
         and coalesce(proconfig,array[]::text[]) @> array['search_path=pg_catalog']::text[]
     )
     or has_function_privilege('public',v_oid,'EXECUTE')
     or exists (
       select 1 from pg_roles
       where rolname in (
         'anon','authenticated','service_role',
         'retailer_catalogue_production_validator',
         'retailer_catalogue_production_approver',
         'retailer_catalogue_production_executor'
       )
         and has_function_privilege(oid,v_oid,'EXECUTE')
     ) then
    raise exception 'RA004_CONTROL_EXPORT_PROVIDER_IDENTITY_POSTCHECK_FAILED';
  end if;
end
$verify$;
