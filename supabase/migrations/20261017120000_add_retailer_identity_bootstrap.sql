begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';

do $prerequisites$
begin
  if current_user <> 'postgres'
     or to_regclass('public.retailers') is null
     or to_regclass('public.approved_import_plans') is null
     or to_regprocedure('public.atomic_import_has_exact_keys(jsonb,text[])') is null
     or to_regprocedure('public.atomic_import_canonical_json(jsonb)') is null
     or to_regprocedure('public.retailer_catalogue_sha256_json(jsonb)') is null
     or to_regprocedure('public.retailer_catalogue_actual_database_target()') is null then
    raise exception 'retailer identity bootstrap prerequisites are missing';
  end if;
end
$prerequisites$;

create function public.retailer_identity_normalized_name(p_value text) returns text
language sql immutable strict parallel safe
set search_path = pg_catalog, public, pg_temp
as $function$
  select lower(regexp_replace(btrim(normalize(p_value, NFKC)), '\s+', ' ', 'g'))
$function$;

create function public.retailer_identity_normalized_slug(p_value text) returns text
language sql immutable strict parallel safe
set search_path = pg_catalog, public, pg_temp
as $function$
  select replace(lower(btrim(normalize(p_value, NFKC))), '_', '-')
$function$;

create function public.retailer_identity_website_origin(p_value text) returns text
language sql immutable strict parallel safe
set search_path = pg_catalog, public, pg_temp
as $function$
  select case
    when btrim(p_value) ~* '^https?://[^/?#]+' then
      lower(substring(btrim(p_value) from '^(https?://[^/?#]+)'))
    else null
  end
$function$;

do $collision_preflight$
declare
  v_exact_slug integer;
  v_normalized_slug integer;
  v_website integer;
  v_name integer;
begin
  select count(*) into v_exact_slug from (
    select slug from public.retailers where nullif(btrim(slug),'') is not null group by slug having count(*) > 1
  ) collisions;
  select count(*) into v_normalized_slug from (
    select public.retailer_identity_normalized_slug(slug) value from public.retailers
    where nullif(btrim(slug),'') is not null group by value having count(*) > 1
  ) collisions;
  select count(*) into v_website from (
    select public.retailer_identity_website_origin(website) value from public.retailers
    where public.retailer_identity_website_origin(website) is not null group by value having count(*) > 1
  ) collisions;
  select count(*) into v_name from (
    select public.retailer_identity_normalized_name(name) value from public.retailers
    where nullif(btrim(name),'') is not null group by value having count(*) > 1
  ) collisions;
  if v_exact_slug <> 0 or v_normalized_slug <> 0 or v_website <> 0 or v_name <> 0 then
    raise exception 'retailer identity collision preflight failed: exact_slug %, normalized_slug %, website_origin %, normalized_name %',
      v_exact_slug, v_normalized_slug, v_website, v_name;
  end if;
end
$collision_preflight$;

create unique index retailers_normalized_slug_unique_idx
  on public.retailers(public.retailer_identity_normalized_slug(slug))
  where nullif(btrim(slug),'') is not null;

alter table public.approved_import_plans
  drop constraint approved_import_plans_plan_kind_check;
alter table public.approved_import_plans
  add constraint approved_import_plans_plan_kind_check
  check (plan_kind in ('feed','manual','gtin_promotion','retailer_identity_bootstrap'));

create unique index approved_import_plans_one_active_retailer_bootstrap_slug_idx
  on public.approved_import_plans((plan_json#>>'{retailer,slug}'))
  where plan_kind = 'retailer_identity_bootstrap' and status = 'approved';

create function public.validate_retailer_identity_bootstrap_plan(
  p_plan jsonb,
  p_artifact_sha256 text,
  p_authorization_id uuid,
  p_expires_at timestamptz
) returns jsonb
language plpgsql stable security definer
set search_path = pg_catalog, public, pg_temp
as $validate$
declare
  v_target jsonb;
  v_slug_count integer;
  v_name_count integer;
  v_website_count integer;
  v_expected_delta constant jsonb := '{"retailers":1,"products":0,"product_variants":0,"retailer_products":0,"offers":0,"price_history":0}'::jsonb;
begin
  if not public.atomic_import_has_exact_keys(p_plan,array['meta','environment','retailer','expected_absent','expected_delta'])
     or not public.atomic_import_has_exact_keys(p_plan->'meta',array['version','plan_kind','source_artifact_sha256','source_fingerprint','plan_fingerprint','authorization_id','expires_at'])
     or not public.atomic_import_has_exact_keys(p_plan->'environment',array['target_environment','project_ref','database_identity'])
     or not public.atomic_import_has_exact_keys(p_plan->'retailer',array['name','normalized_name','slug','website_origin'])
     or not public.atomic_import_has_exact_keys(p_plan->'expected_absent',array['normalized_slug_matches','normalized_name_matches','canonical_website_origin_matches'])
     or not public.atomic_import_has_exact_keys(p_plan->'expected_delta',array['retailers','products','product_variants','retailer_products','offers','price_history']) then
    raise exception 'invalid retailer identity bootstrap schema';
  end if;
  if p_plan#>>'{meta,version}' <> '1'
     or p_plan#>>'{meta,plan_kind}' <> 'retailer_identity_bootstrap'
     or p_artifact_sha256 !~ '^[0-9a-f]{64}$'
     or p_plan#>>'{meta,source_artifact_sha256}' is distinct from p_artifact_sha256
     or p_plan#>>'{meta,source_fingerprint}' !~ '^[0-9a-f]{64}$'
     or p_plan#>>'{meta,plan_fingerprint}' !~ '^[0-9a-f]{32}$'
     or (p_plan#>>'{meta,authorization_id}')::uuid is distinct from p_authorization_id
     or (p_plan#>>'{meta,expires_at}')::timestamptz is distinct from p_expires_at
     or p_expires_at <= now() or p_expires_at > now() + interval '24 hours' then
    raise exception 'invalid retailer identity bootstrap binding or expiry';
  end if;
  if md5(public.atomic_import_canonical_json(jsonb_set(p_plan,'{meta,plan_fingerprint}','null'::jsonb,false)))
       is distinct from p_plan#>>'{meta,plan_fingerprint}' then
    raise exception 'retailer identity bootstrap plan fingerprint mismatch';
  end if;
  if public.retailer_catalogue_sha256_json(jsonb_build_object('environment',p_plan->'environment','retailer',p_plan->'retailer'))
       is distinct from p_plan#>>'{meta,source_fingerprint}' then
    raise exception 'retailer identity bootstrap source fingerprint mismatch';
  end if;
  if nullif(btrim(p_plan#>>'{retailer,name}'),'') is null
     or length(p_plan#>>'{retailer,name}') > 200
     or public.retailer_identity_normalized_name(p_plan#>>'{retailer,name}') is distinct from p_plan#>>'{retailer,normalized_name}'
     or public.retailer_identity_normalized_slug(p_plan#>>'{retailer,slug}') is distinct from p_plan#>>'{retailer,slug}'
     or p_plan#>>'{retailer,slug}' !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
     or p_plan#>>'{retailer,website_origin}' !~ '^https://[a-z0-9][a-z0-9.-]*(?::[0-9]{1,5})?$'
     or public.retailer_identity_website_origin(p_plan#>>'{retailer,website_origin}') is distinct from p_plan#>>'{retailer,website_origin}' then
    raise exception 'retailer identity values are not normalized';
  end if;
  if p_plan->'expected_absent' is distinct from '{"normalized_slug_matches":0,"normalized_name_matches":0,"canonical_website_origin_matches":0}'::jsonb
     or p_plan->'expected_delta' is distinct from v_expected_delta then
    raise exception 'retailer identity expected state or delta is invalid';
  end if;
  v_target := public.retailer_catalogue_actual_database_target();
  if v_target->>'target_environment' is distinct from p_plan#>>'{environment,target_environment}'
     or v_target->>'project_ref' is distinct from p_plan#>>'{environment,project_ref}'
     or v_target->>'database_identity' is distinct from p_plan#>>'{environment,database_identity}' then
    raise exception 'retailer identity bootstrap environment mismatch';
  end if;
  select count(*) into v_slug_count from public.retailers
    where public.retailer_identity_normalized_slug(slug)=p_plan#>>'{retailer,slug}';
  select count(*) into v_name_count from public.retailers
    where public.retailer_identity_normalized_name(name)=p_plan#>>'{retailer,normalized_name}';
  select count(*) into v_website_count from public.retailers
    where public.retailer_identity_website_origin(website)=p_plan#>>'{retailer,website_origin}';
  if v_slug_count <> 0 or v_name_count <> 0 or v_website_count <> 0 then
    raise exception 'retailer identity expected-absent mismatch: slug %, name %, website %', v_slug_count,v_name_count,v_website_count;
  end if;
  return jsonb_build_object('status','validated','plan_fingerprint',p_plan#>>'{meta,plan_fingerprint}',
    'source_fingerprint',p_plan#>>'{meta,source_fingerprint}','artifact_sha256',p_artifact_sha256,
    'authorization_id',p_authorization_id,'expires_at',p_expires_at,'environment',v_target,
    'expected_absent',p_plan->'expected_absent','expected_delta',v_expected_delta);
end
$validate$;

create function public.approve_retailer_identity_bootstrap(
  p_plan jsonb,
  p_artifact_sha256 text,
  p_authorization_id uuid,
  p_expires_at timestamptz
) returns jsonb
language plpgsql volatile security definer
set search_path = pg_catalog, public, pg_temp
as $approve$
declare
  v_id uuid;
begin
  perform public.validate_retailer_identity_bootstrap_plan(p_plan,p_artifact_sha256,p_authorization_id,p_expires_at);
  insert into public.approved_import_plans(
    artifact_sha256,run_id,plan_fingerprint,source_row_fingerprint,plan_kind,
    retailer_id,expires_at,source,plan_json
  ) values (
    p_artifact_sha256,p_authorization_id::text,p_plan#>>'{meta,plan_fingerprint}',
    p_plan#>>'{meta,source_fingerprint}','retailer_identity_bootstrap',null,p_expires_at,
    'retailer-identity-bootstrap-v1',p_plan
  ) returning id into v_id;
  return jsonb_build_object('status','approved','approval_id',v_id,'artifact_sha256',p_artifact_sha256,
    'plan_fingerprint',p_plan#>>'{meta,plan_fingerprint}','source_fingerprint',p_plan#>>'{meta,source_fingerprint}',
    'authorization_id',p_authorization_id,'expires_at',p_expires_at,'plan_kind','retailer_identity_bootstrap');
end
$approve$;

create function public.apply_approved_retailer_identity_bootstrap(
  p_approval_id uuid,
  p_artifact_sha256 text,
  p_plan_fingerprint text,
  p_source_fingerprint text,
  p_authorization_id uuid,
  p_target_environment text,
  p_project_ref text,
  p_database_identity text
) returns jsonb
language plpgsql volatile security definer
set search_path = pg_catalog, public, pg_temp
as $apply$
declare
  v_approval public.approved_import_plans%rowtype;
  v_plan jsonb;
  v_retailer_id bigint;
  v_rows integer;
  v_before jsonb;
  v_after jsonb;
begin
  select * into v_approval from public.approved_import_plans where id=p_approval_id for update;
  if not found then raise exception 'retailer identity bootstrap approval not found'; end if;
  if v_approval.plan_kind <> 'retailer_identity_bootstrap'
     or v_approval.status <> 'approved' or v_approval.consumed_at is not null then
    raise exception 'retailer identity bootstrap approval already consumed or invalid';
  end if;
  if v_approval.expires_at <= now() then raise exception 'retailer identity bootstrap approval expired'; end if;
  v_plan := v_approval.plan_json;
  if v_approval.artifact_sha256 is distinct from p_artifact_sha256
     or v_approval.plan_fingerprint is distinct from p_plan_fingerprint
     or v_approval.source_row_fingerprint is distinct from p_source_fingerprint
     or v_approval.run_id is distinct from p_authorization_id::text
     or v_plan#>>'{environment,target_environment}' is distinct from p_target_environment
     or v_plan#>>'{environment,project_ref}' is distinct from p_project_ref
     or v_plan#>>'{environment,database_identity}' is distinct from p_database_identity then
    raise exception 'retailer identity bootstrap approval binding mismatch';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('retailer_identity_bootstrap_v1',0));
  perform public.validate_retailer_identity_bootstrap_plan(v_plan,v_approval.artifact_sha256,p_authorization_id,v_approval.expires_at);
  select jsonb_build_object('retailers',(select count(*) from public.retailers),
    'products',(select count(*) from public.products),'product_variants',(select count(*) from public.product_variants),
    'retailer_products',(select count(*) from public.retailer_products),'offers',(select count(*) from public.offers),
    'price_history',(select count(*) from public.price_history)) into v_before;
  insert into public.retailers(name,slug,website) values (
    v_plan#>>'{retailer,name}',v_plan#>>'{retailer,slug}',v_plan#>>'{retailer,website_origin}'
  ) returning id into v_retailer_id;
  get diagnostics v_rows = row_count;
  if v_rows <> 1 or v_retailer_id is null then raise exception 'retailer identity bootstrap insert count mismatch'; end if;
  select jsonb_build_object('retailers',(select count(*) from public.retailers),
    'products',(select count(*) from public.products),'product_variants',(select count(*) from public.product_variants),
    'retailer_products',(select count(*) from public.retailer_products),'offers',(select count(*) from public.offers),
    'price_history',(select count(*) from public.price_history)) into v_after;
  if (v_after->>'retailers')::bigint <> (v_before->>'retailers')::bigint + 1
     or (v_after-'retailers') is distinct from (v_before-'retailers') then
    raise exception 'retailer identity bootstrap postflight delta mismatch';
  end if;
  if not exists(select 1 from public.retailers where id=v_retailer_id
    and name=v_plan#>>'{retailer,name}' and slug=v_plan#>>'{retailer,slug}'
    and website=v_plan#>>'{retailer,website_origin}') then
    raise exception 'retailer identity bootstrap exact postflight mismatch';
  end if;
  update public.approved_import_plans set status='consumed',consumed_at=now()
    where id=v_approval.id and status='approved' and consumed_at is null;
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then raise exception 'retailer identity bootstrap approval consumption mismatch'; end if;
  return jsonb_build_object('status','consumed','approval_id',v_approval.id,'retailer_id',v_retailer_id::text,
    'artifact_sha256',v_approval.artifact_sha256,'plan_fingerprint',v_approval.plan_fingerprint,
    'source_fingerprint',v_approval.source_row_fingerprint,'authorization_id',p_authorization_id,
    'expected_delta',v_plan->'expected_delta','before_counts',v_before,'after_counts',v_after);
end
$apply$;

alter function public.retailer_identity_normalized_name(text) owner to postgres;
alter function public.retailer_identity_normalized_slug(text) owner to postgres;
alter function public.retailer_identity_website_origin(text) owner to postgres;
alter function public.validate_retailer_identity_bootstrap_plan(jsonb,text,uuid,timestamptz) owner to postgres;
alter function public.approve_retailer_identity_bootstrap(jsonb,text,uuid,timestamptz) owner to postgres;
alter function public.apply_approved_retailer_identity_bootstrap(uuid,text,text,text,uuid,text,text,text) owner to postgres;

revoke all on function public.retailer_identity_normalized_name(text),
  public.retailer_identity_normalized_slug(text),public.retailer_identity_website_origin(text),
  public.validate_retailer_identity_bootstrap_plan(jsonb,text,uuid,timestamptz),
  public.approve_retailer_identity_bootstrap(jsonb,text,uuid,timestamptz),
  public.apply_approved_retailer_identity_bootstrap(uuid,text,text,text,uuid,text,text,text) from public;

do $roles$
declare
  v_role text;
  v_suffix text;
begin
  foreach v_role in array array['anon','authenticated','service_role',
    'retailer_catalogue_staging_validator','retailer_catalogue_staging_approver','retailer_catalogue_staging_executor',
    'retailer_catalogue_production_validator','retailer_catalogue_production_approver','retailer_catalogue_production_executor'] loop
    if to_regrole(v_role) is not null then
      execute format('revoke all on function public.validate_retailer_identity_bootstrap_plan(jsonb,text,uuid,timestamptz), public.approve_retailer_identity_bootstrap(jsonb,text,uuid,timestamptz), public.apply_approved_retailer_identity_bootstrap(uuid,text,text,text,uuid,text,text,text) from %I',v_role);
    end if;
  end loop;
  foreach v_suffix in array array['staging','production'] loop
    if to_regrole('retailer_catalogue_'||v_suffix||'_validator') is not null then
      execute format('grant execute on function public.validate_retailer_identity_bootstrap_plan(jsonb,text,uuid,timestamptz) to %I','retailer_catalogue_'||v_suffix||'_validator');
    end if;
    if to_regrole('retailer_catalogue_'||v_suffix||'_approver') is not null then
      execute format('grant execute on function public.approve_retailer_identity_bootstrap(jsonb,text,uuid,timestamptz) to %I','retailer_catalogue_'||v_suffix||'_approver');
    end if;
    if to_regrole('retailer_catalogue_'||v_suffix||'_executor') is not null then
      execute format('grant execute on function public.apply_approved_retailer_identity_bootstrap(uuid,text,text,text,uuid,text,text,text) to %I','retailer_catalogue_'||v_suffix||'_executor');
    end if;
  end loop;
end
$roles$;

commit;
