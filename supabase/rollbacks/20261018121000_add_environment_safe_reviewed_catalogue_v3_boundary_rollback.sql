begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

select pg_advisory_xact_lock(hashtextextended('reviewed-catalogue-v3-schema',0));
lock table public.approved_import_plans in share mode;

do $preflight$
declare
  v_environment text := public.retailer_catalogue_actual_database_target()->>'target_environment';
  v_validator_role text;
  v_approver_role text;
  v_executor_role text;
  v_signatures text[] := array[
    'public.atomic_import_reviewed_v3_physical_role_allowed(jsonb,jsonb)',
    'public.atomic_import_reviewed_v3_count_role_allowed(jsonb,jsonb)',
    'public.atomic_import_validate_reviewed_catalogue_v3_plan(jsonb,jsonb)',
    'public.validate_reviewed_catalogue_v3_plan_read_only(jsonb,jsonb)',
    'public.atomic_import_reviewed_catalogue_v3_plan_allowed(jsonb)',
    'public.validate_product_import_plan_read_only(jsonb)',
    'public.approve_reviewed_catalogue_v3_plan(jsonb,jsonb,timestamptz)',
    'public.apply_approved_reviewed_catalogue_v3_plan(uuid,jsonb,jsonb)',
    'public.atomic_import_validate_product_before_reviewed_v3(jsonb)'
  ];
  v_hashes text[] := array[
    'dfe0e59fb14eb2f065729fb782ecfcd20f5774a2a36534b88fe8114d708ab6c8',
    '2714f3015ba3a14e5315f2c84ed296d584e4830b0e5722cd9aa6493e2baa3556',
    'f1f5697a7ca6c3064b358e9296b98a1e411907a127b03248d14f9d75f90b4307',
    '2941c201ca5b97af40d273d61a494658b97e9879635daec4be8f95b3b3b51a58',
    '8f938dc266a7f2d9f2e1cb8d6b4f2a82e5d8841ee72b64f8fc610edf6fa48e99',
    'b375c621bcf51557c9cb249a7a43953506da1884fb840af9751629d90aada203',
    '1f83251fc3628e2a772e8e647fe3f5be188fea0d221174cec263d7db968443c1',
    'b6670a735282f9d04d0064ce2a3bdbbca055d1b99201a4db87fed2d50a25c734',
    case v_environment
      when 'STAGING' then 'c8e47e4495fe78641b1cccf6ffe2dc6cbc980ae86ee341effd8278a8d86c918f'
      when 'PRODUCTION' then '47001d0eb21fce1b136b1050f2c91b392f54bb29cf67825d370a2f03a6f37d3a'
    end
  ];
  v_volatilities text[] := array['i','i','s','s','s','s','v','v','s'];
  v_expected_roles text[];
  v_function regprocedure;
  v_expected_role oid;
  v_definition text;
  v_owner oid;
  v_volatility "char";
  v_security_definer boolean;
  v_config text[];
  v_index integer;
  v_type text;
  v_not_null boolean;
  v_default text;
  v_constraint text;
  v_execution_marker boolean;
begin
  v_validator_role := case v_environment
    when 'STAGING' then 'retailer_catalogue_staging_validator'
    when 'PRODUCTION' then 'retailer_catalogue_production_validator'
  end;
  v_approver_role := case v_environment
    when 'STAGING' then 'retailer_catalogue_staging_approver'
    when 'PRODUCTION' then 'retailer_catalogue_production_approver'
  end;
  v_executor_role := case v_environment
    when 'STAGING' then 'retailer_catalogue_staging_executor'
    when 'PRODUCTION' then 'retailer_catalogue_production_executor'
  end;
  if v_validator_role is null or v_approver_role is null or v_executor_role is null
     or v_hashes[9] is null then
    raise exception 'reviewed catalogue V3 rollback unsupported database target';
  end if;

  v_expected_roles := array[
    null,null,null,v_validator_role,null,v_validator_role,
    v_approver_role,v_executor_role,v_validator_role
  ];

  for v_index in 1..array_length(v_signatures,1) loop
    v_function := to_regprocedure(v_signatures[v_index]);
    if v_function is null then
      raise exception 'reviewed catalogue V3 rollback target is missing: %',v_signatures[v_index];
    end if;
    v_expected_role := case when v_expected_roles[v_index] is null
      then null else to_regrole(v_expected_roles[v_index])::oid end;
    if v_expected_roles[v_index] is not null and v_expected_role is null then
      raise exception 'reviewed catalogue V3 rollback expected role is missing: %',v_expected_roles[v_index];
    end if;

    select pg_get_functiondef(p.oid),p.proowner,p.provolatile,p.prosecdef,p.proconfig
      into v_definition,v_owner,v_volatility,v_security_definer,v_config
      from pg_proc p where p.oid=v_function;

    if encode(pg_catalog.sha256(convert_to(v_definition,'UTF8')),'hex')<>v_hashes[v_index]
       or v_owner<>'postgres'::regrole
       or v_volatility::text<>v_volatilities[v_index]
       or not v_security_definer
       or v_config is distinct from array['search_path=pg_catalog, public, pg_temp']::text[]
       or (v_expected_role is null and exists(
         select 1 from pg_proc p
         cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) acl
         where p.oid=v_function and acl.grantee<>p.proowner
       ))
       or (v_expected_role is not null and not exists(
         select 1 from pg_proc p
         cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) acl
         where p.oid=v_function and acl.grantee=v_expected_role and acl.grantor=p.proowner
           and acl.privilege_type='EXECUTE' and not acl.is_grantable
       ))
       or exists(
         select 1 from pg_proc p
         cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) acl
         where p.oid=v_function
           and (
             acl.privilege_type<>'EXECUTE'
             or (v_expected_role is null and acl.grantee<>p.proowner)
             or (v_expected_role is not null and acl.grantee not in (p.proowner,v_expected_role))
             or (acl.grantee<>p.proowner and (acl.grantor<>p.proowner or acl.is_grantable))
           )
       ) then
      raise exception 'reviewed catalogue V3 rollback lineage or metadata differs: %',v_signatures[v_index];
    end if;
  end loop;

  select format_type(a.atttypid,a.atttypmod),a.attnotnull,pg_get_expr(d.adbin,d.adrelid)
    into v_type,v_not_null,v_default
    from pg_attribute a
    left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
    where a.attrelid='public.approved_import_plans'::regclass
      and a.attname='authorization_envelope' and not a.attisdropped;
  if not found or v_type<>'jsonb' or v_not_null or v_default is not null then
    raise exception 'reviewed catalogue V3 rollback authorization_envelope metadata differs';
  end if;

  select pg_get_constraintdef(c.oid,true) into v_constraint
    from pg_constraint c
    where c.conrelid='public.approved_import_plans'::regclass
      and c.conname='approved_import_plans_v3_envelope_check'
      and c.contype='c' and c.convalidated and not c.condeferrable and not c.condeferred;
  if v_constraint is distinct from
     'CHECK (source !~ ''^reviewed-catalogue-package-v3:''::text AND authorization_envelope IS NULL OR source ~ ''^reviewed-catalogue-package-v3:[A-Za-z0-9._-]+:[0-9a-f]{64}:(STAGING|PRODUCTION):[a-z0-9]{20}$''::text AND jsonb_typeof(authorization_envelope) = ''object''::text AND (authorization_envelope ->> ''kind''::text) = ''reviewed-catalogue-authorization-v3''::text)' then
    raise exception 'reviewed catalogue V3 rollback authorization envelope constraint differs';
  end if;

  if exists(select 1 from public.approved_import_plans
    where source ~ '^reviewed-catalogue-package-v3:' or authorization_envelope is not null) then
    raise exception 'reviewed catalogue V3 rollback blocked by durable approval evidence';
  end if;

  select format_type(a.atttypid,a.atttypmod),a.attnotnull,pg_get_expr(d.adbin,d.adrelid)
    into v_type,v_not_null,v_default
    from pg_attribute a
    left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
    where a.attrelid='public.approved_import_plans'::regclass
      and a.attname='execution_result' and not a.attisdropped;
  if not found or v_type<>'jsonb' or v_not_null or v_default is not null then
    raise exception 'reviewed catalogue V3 rollback execution_result metadata differs';
  end if;
  select exists(
    select 1 from pg_constraint c
    where c.conrelid='public.approved_import_plans'::regclass
      and c.conname='approved_import_plans_v3_created_execution_result_check'
  ) into v_execution_marker;
  if v_environment='STAGING' then
    if not v_execution_marker then
      raise exception 'reviewed catalogue V3 rollback execution_result marker is missing';
    end if;
    select pg_get_constraintdef(c.oid,true) into v_constraint
      from pg_constraint c
      where c.conrelid='public.approved_import_plans'::regclass
        and c.conname='approved_import_plans_v3_created_execution_result_check'
        and c.contype='c' and c.convalidated and not c.condeferrable and not c.condeferred;
    if v_constraint is distinct from
       'CHECK (execution_result IS NULL OR jsonb_typeof(execution_result) = ''object''::text)' then
      raise exception 'reviewed catalogue V3 rollback execution_result constraint differs';
    end if;
    if exists(select 1 from public.approved_import_plans where execution_result is not null) then
      raise exception 'reviewed catalogue V3 rollback cannot remove non-empty V3-created execution_result';
    end if;
  elsif v_execution_marker then
    raise exception 'reviewed catalogue V3 rollback unexpected production execution_result marker';
  end if;

end
$preflight$;

drop function public.apply_approved_reviewed_catalogue_v3_plan(uuid,jsonb,jsonb);
drop function public.approve_reviewed_catalogue_v3_plan(jsonb,jsonb,timestamptz);
drop function public.validate_reviewed_catalogue_v3_plan_read_only(jsonb,jsonb);
drop function public.validate_product_import_plan_read_only(jsonb);
alter function public.atomic_import_validate_product_before_reviewed_v3(jsonb)
  rename to validate_product_import_plan_read_only;

drop function public.atomic_import_reviewed_catalogue_v3_plan_allowed(jsonb);
drop function public.atomic_import_validate_reviewed_catalogue_v3_plan(jsonb,jsonb);
drop function public.atomic_import_reviewed_v3_physical_role_allowed(jsonb,jsonb);
drop function public.atomic_import_reviewed_v3_count_role_allowed(jsonb,jsonb);

do $restored_validator$
declare
  v_sha256 text;
  v_environment text := public.retailer_catalogue_actual_database_target()->>'target_environment';
  v_expected_sha text;
  v_expected_role oid;
  v_function regprocedure := 'public.validate_product_import_plan_read_only(jsonb)'::regprocedure;
begin
  v_expected_sha := case v_environment
    when 'STAGING' then '70f134e6f7d3afa25de52353ff5e8aca3cc0f7c34a58d9da3577ead4ac11f4a9'
    when 'PRODUCTION' then 'b9d99d9245ff2ea493fa9ed4d160f0e9ff4c450764cb40a5a23325d0ca069583'
  end;
  v_expected_role := to_regrole(case v_environment
    when 'STAGING' then 'retailer_catalogue_staging_validator'
    when 'PRODUCTION' then 'retailer_catalogue_production_validator'
  end);
  select encode(pg_catalog.sha256(convert_to(pg_get_functiondef(
    v_function
  ),'UTF8')),'hex') into v_sha256;
  if v_expected_sha is null or v_expected_role is null or v_sha256<>v_expected_sha
     or not exists(
       select 1 from pg_proc p where p.oid=v_function
         and p.proowner='postgres'::regrole and p.provolatile='s' and p.prosecdef
         and p.proconfig=array['search_path=pg_catalog, public, pg_temp']::text[]
     )
     or not exists(
       select 1 from pg_proc p
       cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) acl
       where p.oid=v_function and acl.grantee=v_expected_role and acl.grantor=p.proowner
         and acl.privilege_type='EXECUTE' and not acl.is_grantable
     )
     or exists(
       select 1 from pg_proc p
       cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) acl
       where p.oid=v_function
         and (acl.privilege_type<>'EXECUTE'
           or acl.grantee not in (p.proowner,v_expected_role)
           or (acl.grantee<>p.proowner and (acl.grantor<>p.proowner or acl.is_grantable)))
     ) then
    raise exception 'reviewed catalogue V3 rollback did not restore the reviewed validator lineage or metadata';
  end if;
end
$restored_validator$;

alter table public.approved_import_plans
  drop constraint approved_import_plans_v3_envelope_check;
alter table public.approved_import_plans
  drop column authorization_envelope;

do $execution_result$
begin
  if exists(
    select 1 from pg_constraint
    where conrelid='public.approved_import_plans'::regclass
      and conname='approved_import_plans_v3_created_execution_result_check'
  ) then
    if exists(select 1 from public.approved_import_plans where execution_result is not null) then
      raise exception 'reviewed catalogue V3 rollback cannot remove non-empty V3-created execution_result';
    end if;
    alter table public.approved_import_plans
      drop constraint approved_import_plans_v3_created_execution_result_check;
    alter table public.approved_import_plans drop column execution_result;
  end if;
end
$execution_result$;

commit;
