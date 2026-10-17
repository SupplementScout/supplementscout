begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

create or replace function public.read_reviewed_catalogue_import_state(p_request jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $state$
declare
  v_target jsonb;
  v_retailer public.retailers%rowtype;
  v_products jsonb;
  v_variants jsonb;
  v_mappings jsonb;
  v_offers jsonb;
  v_history jsonb;
  v_counts jsonb;
  v_role text:=current_setting('role',true);
  v_expected_role text;
  v_expected_login text;
  v_row_count integer;
begin
  if not public.atomic_import_has_exact_keys(
    p_request,
    array['schema_version','target_environment','target_project_ref','retailer','rows']
  ) or p_request->>'schema_version'<>'1'
     or jsonb_typeof(p_request->'retailer')<>'object'
     or not public.atomic_import_has_exact_keys(p_request->'retailer',array['id','slug'])
     or jsonb_typeof(p_request->'rows')<>'array' then
    perform public.retailer_catalogue_raise('RSBI_SOURCE_SCHEMA_MISMATCH','Invalid reviewed catalogue state request');
  end if;

  v_row_count:=jsonb_array_length(p_request->'rows');
  if v_row_count<1 or v_row_count>200 then
    perform public.retailer_catalogue_raise('RSBI_SCOPE_MISMATCH','Reviewed catalogue state request exceeds its bounded scope');
  end if;
  if exists(
    select 1 from jsonb_array_elements(p_request->'rows') r(value)
    where jsonb_typeof(r.value)<>'object'
       or not public.atomic_import_has_exact_keys(r.value,array[
         'external_gtin','external_product_id','external_sku','external_url','external_variant_id',
         'product_brand','product_category','product_gtin','product_id','product_name_key','product_slug','product_variant_id'
       ])
       or nullif(r.value->>'external_variant_id','') is null
  ) or (select count(distinct value->>'external_variant_id') from jsonb_array_elements(p_request->'rows'))<>v_row_count then
    perform public.retailer_catalogue_raise('RSBI_SCOPE_MISMATCH','Reviewed catalogue state row scope is invalid or duplicated');
  end if;

  v_target:=public.retailer_catalogue_actual_database_target();
  if p_request->>'target_environment' is distinct from v_target->>'target_environment'
     or p_request->>'target_project_ref' is distinct from v_target->>'project_ref' then
    perform public.retailer_catalogue_raise('RSBI_ENVIRONMENT_BLOCKED','Reviewed catalogue state target mismatch');
  end if;
  v_expected_role:=case v_target->>'target_environment'
    when 'STAGING' then 'retailer_catalogue_staging_validator'
    when 'PRODUCTION' then 'retailer_catalogue_production_validator'
    else null end;
  v_expected_login:=case v_target->>'target_environment'
    when 'STAGING' then 'supplementscout_staging_validator_login'
    when 'PRODUCTION' then 'supplementscout_production_validator_login'
    else null end;
  if v_role is distinct from v_expected_role or session_user is distinct from v_expected_login
     or current_setting('transaction_read_only')<>'on'
     or lower(coalesce(current_setting('app.safe_update',true),''))=any(array['1','on','true']) then
    perform public.retailer_catalogue_raise('RSBI_ENVIRONMENT_BLOCKED','Exact read-only reviewed catalogue validator session required');
  end if;

  select * into v_retailer from public.retailers
  where id=(p_request#>>'{retailer,id}')::bigint
    and slug=p_request#>>'{retailer,slug}';
  if not found then
    perform public.retailer_catalogue_raise('RSBI_EXPECTED_STATE_MISMATCH','Reviewed catalogue retailer identity mismatch');
  end if;

  with requested as (
    select value from jsonb_array_elements(p_request->'rows')
  ), matched_mappings as (
    select distinct rp.* from public.retailer_products rp
    where (
      rp.retailer_id=v_retailer.id and exists(select 1 from requested r where
        rp.external_variant_id=r.value->>'external_variant_id'
        or nullif(r.value->>'external_product_id','') is not null and rp.external_product_id=r.value->>'external_product_id'
        or nullif(r.value->>'external_sku','') is not null and rp.external_sku=r.value->>'external_sku'
        or nullif(r.value->>'external_url','') is not null and rp.external_url=r.value->>'external_url'
        or nullif(r.value->>'product_id','') is not null and rp.product_id=(r.value->>'product_id')::bigint
        or nullif(r.value->>'product_variant_id','') is not null and rp.product_variant_id=(r.value->>'product_variant_id')::bigint
      )
    ) or exists(select 1 from requested r where nullif(r.value->>'external_gtin','') is not null and rp.external_gtin=r.value->>'external_gtin')
  )
  select coalesce(jsonb_agg(to_jsonb(m) order by m.id),'[]'::jsonb) into v_mappings from matched_mappings m;
  if jsonb_array_length(v_mappings)>1000 then
    perform public.retailer_catalogue_raise('RSBI_SCOPE_MISMATCH','Reviewed catalogue mapping state exceeds its bound');
  end if;

  with requested as (
    select value from jsonb_array_elements(p_request->'rows')
  ), mapping_products as (
    select distinct (value->>'product_id')::bigint id from jsonb_array_elements(v_mappings)
  ), matched_products as (
    select distinct p.* from public.products p
    where p.id in(select id from mapping_products)
       or exists(select 1 from requested r where
         nullif(r.value->>'product_id','') is not null and p.id=(r.value->>'product_id')::bigint
         or nullif(r.value->>'product_slug','') is not null and p.slug=r.value->>'product_slug'
         or nullif(r.value->>'product_gtin','') is not null and p.gtin=r.value->>'product_gtin'
         or nullif(r.value->>'product_name_key','') is not null
            and p.brand=r.value->>'product_brand' and p.category=r.value->>'product_category'
            and trim(regexp_replace(regexp_replace(regexp_replace(lower(p.name),'\m(gym high|capsules|caps|powder|servings|serves)\M',' ','g'),'[^[:alnum:]]+',' ','g'),'[[:space:]]+',' ','g'))=r.value->>'product_name_key'
       )
  )
  select coalesce(jsonb_agg(to_jsonb(p) order by p.id),'[]'::jsonb) into v_products from matched_products p;
  if jsonb_array_length(v_products)>400 then
    perform public.retailer_catalogue_raise('RSBI_SCOPE_MISMATCH','Reviewed catalogue product state exceeds its bound');
  end if;

  with requested as (
    select value from jsonb_array_elements(p_request->'rows')
  ), product_ids as (
    select distinct (value->>'id')::bigint id from jsonb_array_elements(v_products)
  ), mapping_variants as (
    select distinct (value->>'product_variant_id')::bigint id from jsonb_array_elements(v_mappings)
    where nullif(value->>'product_variant_id','') is not null
  ), matched_variants as (
    select distinct v.* from public.product_variants v
    where v.product_id in(select id from product_ids) or v.id in(select id from mapping_variants)
       or exists(select 1 from requested r where nullif(r.value->>'product_variant_id','') is not null and v.id=(r.value->>'product_variant_id')::bigint)
  )
  select coalesce(jsonb_agg(to_jsonb(v) order by v.id),'[]'::jsonb) into v_variants from matched_variants v;
  if jsonb_array_length(v_variants)>2000 then
    perform public.retailer_catalogue_raise('RSBI_SCOPE_MISMATCH','Reviewed catalogue variant state exceeds its bound');
  end if;

  with mapping_ids as (
    select distinct (value->>'id')::bigint id from jsonb_array_elements(v_mappings)
  ), matched_offers as (
    select distinct o.* from public.offers o where o.retailer_product_id in(select id from mapping_ids)
  )
  select coalesce(jsonb_agg(to_jsonb(o) order by o.id),'[]'::jsonb) into v_offers from matched_offers o;
  if jsonb_array_length(v_offers)>1000 then
    perform public.retailer_catalogue_raise('RSBI_SCOPE_MISMATCH','Reviewed catalogue offer state exceeds its bound');
  end if;

  with offer_ids as (
    select distinct (value->>'id')::bigint id from jsonb_array_elements(v_offers)
  ), matched_history as (
    select ph.* from public.price_history ph where ph.offer_id in(select id from offer_ids)
  )
  select coalesce(jsonb_agg(to_jsonb(ph) order by ph.id),'[]'::jsonb) into v_history from matched_history ph;
  if jsonb_array_length(v_history)>2000 then
    perform public.retailer_catalogue_raise('RSBI_SCOPE_MISMATCH','Reviewed catalogue price history state exceeds its bound');
  end if;

  select jsonb_build_object(
    'products',(select count(*) from public.products),
    'product_variants',(select count(*) from public.product_variants),
    'retailer_products',(select count(*) from public.retailer_products where retailer_id=v_retailer.id),
    'offers',(select count(*) from public.offers where retailer_id=v_retailer.id),
    'price_history',(select count(*) from public.price_history ph join public.offers o on o.id=ph.offer_id where o.retailer_id=v_retailer.id)
  ) into v_counts;

  return jsonb_build_object(
    'schema_version',1,
    'target_environment',v_target->>'target_environment',
    'target_project_ref',v_target->>'project_ref',
    'retailer',to_jsonb(v_retailer),
    'products',v_products,
    'product_variants',v_variants,
    'retailer_products',v_mappings,
    'offers',v_offers,
    'price_history',v_history,
    'counts',v_counts
  );
end
$state$;

alter function public.read_reviewed_catalogue_import_state(jsonb) owner to postgres;
revoke all on function public.read_reviewed_catalogue_import_state(jsonb)
  from public, anon, authenticated, service_role,
       retailer_catalogue_staging_approver, retailer_catalogue_staging_executor,
       retailer_catalogue_production_approver, retailer_catalogue_production_executor;
grant execute on function public.read_reviewed_catalogue_import_state(jsonb)
  to retailer_catalogue_staging_validator, retailer_catalogue_production_validator;

commit;
