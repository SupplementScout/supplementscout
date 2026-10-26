begin;

set local lock_timeout='5s';
set local statement_timeout='120s';

select pg_advisory_xact_lock(hashtextextended('reviewed-catalogue-v3-schema',0));

do $preflight$
declare
  v_target jsonb:=public.retailer_catalogue_actual_database_target();
  v_projection regprocedure:='public.atomic_import_reviewed_v3_legacy_validation_projection(jsonb,jsonb)'::regprocedure;
  v_counts jsonb;
begin
  if current_user<>'postgres'
     or v_target->>'target_environment' not in ('STAGING','PRODUCTION')
     or (v_target->>'target_environment'='STAGING' and (
       v_target->>'project_ref'<>'hxnrsyyqffztlvcrtgbf'
       or v_target->>'database_identity'<>'supplementscout-staging:hxnrsyyqffztlvcrtgbf'
     ))
     or (v_target->>'target_environment'='PRODUCTION' and (
       v_target->>'project_ref'<>'aftboxmrdgyhizicfsfu'
       or v_target->>'database_identity'<>'supplementscout-production:aftboxmrdgyhizicfsfu'
     )) then
    raise exception 'reviewed V3 canonical evidence apply projection rollback target differs';
  end if;
  if not exists(
    select 1 from supabase_migrations.schema_migrations
    where version='20261026120000'
      and name='fix_reviewed_v3_canonical_evidence_apply_projection'
  ) then
    raise exception 'reviewed V3 canonical evidence apply projection rollback ledger entry missing';
  end if;
  if exists(
    select 1 from public.approved_import_plans
    where source~'^reviewed-catalogue-package-v3:'
      and status='approved' and consumed_at is null and expires_at>now()
  ) then
    raise exception 'reviewed V3 canonical evidence apply projection rollback blocked by live approval';
  end if;
  if exists(
    select 1 from public.approved_import_plans
    where source~'^reviewed-catalogue-package-v3:'
      and status='consumed' and consumed_at is not null and execution_result is not null
      and authorization_envelope ? 'canonical_identity_evidence'
      and authorization_envelope->'canonical_identity_evidence'<>'null'::jsonb
  ) then
    raise exception 'reviewed V3 canonical evidence apply projection rollback blocked by dependent execution';
  end if;
  if encode(pg_catalog.sha256(convert_to(pg_get_functiondef(v_projection),'UTF8')),'hex')
       <> '8bc6eb2fd25499182cfbd70f29f9316056f36f8d403232a5fa6ee35df786a80c' then
    raise exception 'reviewed V3 canonical evidence apply projection rollback lineage differs';
  end if;
  if not exists(
    select 1 from pg_proc p where p.oid=v_projection and p.proowner='postgres'::regrole
      and p.provolatile='s' and p.prosecdef
      and p.proconfig=array['search_path=pg_catalog, public, pg_temp']::text[]
  ) or exists(
    select 1 from pg_proc p
    cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) acl
    where p.oid=v_projection and acl.grantee<>p.proowner and acl.privilege_type='EXECUTE'
  ) then
    raise exception 'reviewed V3 canonical evidence apply projection rollback metadata differs';
  end if;
  select jsonb_build_object(
    'retailers',(select count(*) from public.retailers),
    'products',(select count(*) from public.products),
    'product_variants',(select count(*) from public.product_variants),
    'retailer_products',(select count(*) from public.retailer_products),
    'offers',(select count(*) from public.offers),
    'price_history',(select count(*) from public.price_history),
    'approved_import_plans',(select count(*) from public.approved_import_plans)
  ) into v_counts;
  perform set_config('app.reviewed_v3_canonical_projection_rollback_counts',v_counts::text,true);
end
$preflight$;

do $restore_projection$
declare
  v_function regprocedure:='public.atomic_import_reviewed_v3_legacy_validation_projection(jsonb,jsonb)'::regprocedure;
  v_definition text:=pg_get_functiondef(v_function);
  v_before text:=$needle$v_evidence:=v_evidence-array['unit_count','unit_type','canonical_identity_evidence'];$needle$;
  v_after text:=$replacement$v_evidence:=v_evidence-array['unit_count','unit_type'];$replacement$;
begin
  if length(v_definition)-length(replace(v_definition,v_before,''))<>length(v_before) then
    raise exception 'reviewed V3 canonical evidence apply projection rollback anchor differs';
  end if;
  execute replace(v_definition,v_before,v_after);
end
$restore_projection$;

alter function public.atomic_import_reviewed_v3_legacy_validation_projection(jsonb,jsonb) owner to postgres;
revoke all on function public.atomic_import_reviewed_v3_legacy_validation_projection(jsonb,jsonb)
  from public,anon,authenticated,service_role;

do $environment_acl$
declare
  v_target jsonb:=public.retailer_catalogue_actual_database_target();
  v_role text:='retailer_catalogue_'||lower(v_target->>'target_environment')||'_executor';
begin
  if to_regrole(v_role) is not null then
    execute format(
      'revoke all on function public.atomic_import_reviewed_v3_legacy_validation_projection(jsonb,jsonb) from %I',
      v_role
    );
  end if;
end
$environment_acl$;

do $postflight$
declare
  v_counts_before jsonb:=current_setting('app.reviewed_v3_canonical_projection_rollback_counts')::jsonb;
  v_counts_after jsonb;
  v_projection regprocedure:='public.atomic_import_reviewed_v3_legacy_validation_projection(jsonb,jsonb)'::regprocedure;
begin
  if encode(pg_catalog.sha256(convert_to(pg_get_functiondef(v_projection),'UTF8')),'hex')
       <> '2548c3b702403a2fda4176dbe732c993d85e14690157286aa65029f434813dff' then
    raise exception 'reviewed V3 canonical evidence apply projection rollback restoration differs';
  end if;
  if not exists(
    select 1 from pg_proc p where p.oid=v_projection and p.proowner='postgres'::regrole
      and p.provolatile='s' and p.prosecdef
      and p.proconfig=array['search_path=pg_catalog, public, pg_temp']::text[]
  ) or exists(
    select 1 from pg_proc p
    cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) acl
    where p.oid=v_projection and acl.grantee<>p.proowner and acl.privilege_type='EXECUTE'
  ) then
    raise exception 'reviewed V3 canonical evidence apply projection rollback postflight metadata differs';
  end if;
  select jsonb_build_object(
    'retailers',(select count(*) from public.retailers),
    'products',(select count(*) from public.products),
    'product_variants',(select count(*) from public.product_variants),
    'retailer_products',(select count(*) from public.retailer_products),
    'offers',(select count(*) from public.offers),
    'price_history',(select count(*) from public.price_history),
    'approved_import_plans',(select count(*) from public.approved_import_plans)
  ) into v_counts_after;
  if v_counts_after is distinct from v_counts_before then
    raise exception 'reviewed V3 canonical evidence apply projection rollback changed business counts';
  end if;
end
$postflight$;

commit;
