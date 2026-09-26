begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $fixture$
declare
  v_target jsonb;
  v_existing_count integer;
  v_retailer_id bigint;
  v_row_count integer;
begin
  if current_user <> 'postgres' then
    raise exception 'RA004_STAGING_RETAILER_OWNER_REQUIRED';
  end if;

  if to_regprocedure('public.retailer_catalogue_actual_database_target()') is null then
    raise exception 'RA004_STAGING_RETAILER_TARGET_ATTESTATION_MISSING';
  end if;

  v_target := public.retailer_catalogue_actual_database_target();
  if v_target->>'target_environment' <> 'STAGING'
     or v_target->>'project_ref' <> 'hxnrsyyqffztlvcrtgbf'
     or v_target->>'project_ref' = 'aftboxmrdgyhizicfsfu'
     or v_target->>'database_identity' <> 'supplementscout-staging:hxnrsyyqffztlvcrtgbf' then
    raise exception 'RA004_STAGING_RETAILER_TARGET_REJECTED';
  end if;

  if to_regclass('public.retailers') is null
     or to_regclass('public.retailers_id_seq') is null then
    raise exception 'RA004_STAGING_RETAILER_SCHEMA_MISSING';
  end if;

  lock table public.retailers in access exclusive mode;

  select count(*)::integer
  into v_existing_count
  from public.retailers
  where lower(name) = '10 reps'
     or lower(slug) = '10-reps';

  if v_existing_count <> 0 then
    raise exception 'RA004_STAGING_RETAILER_NOT_EMPTY: % matching rows', v_existing_count;
  end if;

  v_retailer_id := nextval('public.retailers_id_seq'::regclass);
  if v_retailer_id = 14 then
    v_retailer_id := nextval('public.retailers_id_seq'::regclass);
  end if;
  if v_retailer_id = 14 then
    raise exception 'RA004_STAGING_RETAILER_PRODUCTION_ID_REJECTED';
  end if;

  insert into public.retailers(id, name, slug)
  overriding system value
  values (v_retailer_id, '10 Reps', '10-reps');

  select count(*)::integer
  into v_row_count
  from public.retailers
  where id = v_retailer_id
    and name = '10 Reps'
    and slug = '10-reps'
    and website is null
    and logo is null
    and affiliate_network is null
    and affiliate_id is null;

  if v_row_count <> 1 then
    raise exception 'RA004_STAGING_RETAILER_POSTCONDITION_FAILED';
  end if;

  if (select count(*) from public.retailers where lower(name) = '10 reps' or lower(slug) = '10-reps') <> 1 then
    raise exception 'RA004_STAGING_RETAILER_UNIQUENESS_FAILED';
  end if;
end
$fixture$;

commit;
