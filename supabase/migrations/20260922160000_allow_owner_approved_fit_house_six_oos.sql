begin;

-- Owner approval: six exact Fit House offers, 22 September 2026.
-- Manifest SHA-256: 967f378d7bb13f1ab71478843b776486ae6b0add65d3378f4c60ab3bd2296e07.
-- This changes only the Fit House production validator; it performs no catalogue write.
set local lock_timeout='5s';
set local statement_timeout='120s';

do $fit_six_preflight$
declare v_target jsonb:=public.retailer_catalogue_actual_database_target();
begin
  if current_user<>'postgres'
     or v_target->>'target_environment'<>'PRODUCTION'
     or v_target->>'project_ref'<>'aftboxmrdgyhizicfsfu'
     or v_target->>'database_identity'<>'supplementscout-production:aftboxmrdgyhizicfsfu'
     or to_regprocedure('public.fit_house_six_oos_baseline_exact()') is not null
     or to_regprocedure('public.fit_house_six_oos_owner_exception(jsonb)') is not null
     or md5(pg_get_functiondef('public.validate_fit_house_stable_oos_read_only(jsonb)'::regprocedure))<>'28ee622dcc83d5398d160d83b4e2e920'
     or md5(pg_get_functiondef('public.validate_fit_house_confirmed_price_read_only(jsonb)'::regprocedure))<>'3ece3becc90ebaff950c173905789621'
     or md5(pg_get_functiondef('public.retailer_offer_sync_validate_batch_read_only_internal(jsonb)'::regprocedure))<>'a9e191f447a1efda3cf788019b5bd79a'
     or md5(pg_get_functiondef('public.retailer_offer_sync_validate_batch_read_only_unreviewed_interna(jsonb)'::regprocedure))<>'49d36240cb3f7c9fed12f63b145e93f0'
     or (select count(*) from public.offers where retailer_id=9 and not in_stock)<>104 then
    raise exception 'Fit House six-offer migration preflight drift';
  end if;
end
$fit_six_preflight$;

create or replace function public.fit_house_six_oos_baseline_exact()
returns boolean language plpgsql stable security definer
set search_path to 'pg_catalog','public','pg_temp' as $fit_baseline$
declare
  v_rows constant jsonb := '[
    {"offer_id":"718","mapping_id":"742","product_id":"699","variant_id":"3060","external_product_id":"9058975187184","external_variant_id":"46667614945520","price":"12.99","url":"https://fithouse.uk/products/now-foods-choline-inositol-100-veg-caps?variant=46667614945520"},
    {"offer_id":"749","mapping_id":"863","product_id":"730","variant_id":"3074","external_product_id":"9347614343408","external_variant_id":"47199795413232","price":"16.99","url":"https://fithouse.uk/products/now-foods-5-htp-double-strength-200-mg-60-veg-capsules?variant=47199795413232"},
    {"offer_id":"757","mapping_id":"871","product_id":"768","variant_id":"933","external_product_id":"9041428283632","external_variant_id":"46620421816560","price":"11.99","url":"https://fithouse.uk/products/7-nutrition-beta-alanine-250g-unflavoured?variant=46620421816560"},
    {"offer_id":"759","mapping_id":"873","product_id":"740","variant_id":"3021","external_product_id":"9168824172784","external_variant_id":"46969725714672","price":"11.99","url":"https://fithouse.uk/products/7-nutrition-berberine-stack-90-vege-caps?variant=46969725714672"},
    {"offer_id":"913","mapping_id":"1099","product_id":"502","variant_id":"914","external_product_id":"9674414915824","external_variant_id":"48123945124080","price":"2.50","url":"https://fithouse.uk/products/lenny-larrys-fitzels-protein-pretzels-85-g?variant=48123945124080"},
    {"offer_id":"939","mapping_id":"1125","product_id":"766","variant_id":"926","external_product_id":"10021385273584","external_variant_id":"49719663100144","price":"9.99","url":"https://fithouse.uk/products/ostrovit-carbo-1000-g?variant=49719663100144"},
    {"offer_id":"940","mapping_id":"1126","product_id":"766","variant_id":"928","external_product_id":"10021385273584","external_variant_id":"49719663067376","price":"9.99","url":"https://fithouse.uk/products/ostrovit-carbo-1000-g?variant=49719663067376"}
  ]'::jsonb;
  v_row jsonb;
  v_stock boolean;
  v_applied integer:=0;
begin
  if (select count(*) from public.offers where retailer_id=9)<>286
     or (select count(*) from public.retailer_products where retailer_id=9)<>286 then return false; end if;
  for v_row in select value from jsonb_array_elements(v_rows) loop
    select o.in_stock into v_stock
      from public.offers o join public.retailer_products m on m.id=o.retailer_product_id
     where o.id=(v_row->>'offer_id')::bigint and o.retailer_id=9
       and o.retailer_product_id=(v_row->>'mapping_id')::bigint
       and o.product_id=(v_row->>'product_id')::bigint
       and o.product_variant_id=(v_row->>'variant_id')::bigint
       and o.price=(v_row->>'price')::numeric and o.shipping_cost=3.99
       and o.total_price=(v_row->>'price')::numeric+3.99
       and o.url=v_row->>'url' and m.external_url=v_row->>'url'
       and m.retailer_id=9 and m.product_id=(v_row->>'product_id')::bigint
       and m.product_variant_id=(v_row->>'variant_id')::bigint
       and m.external_product_id=v_row->>'external_product_id'
       and m.external_variant_id=v_row->>'external_variant_id'
       and m.external_sku is null;
    if not found then return false; end if;
    if v_row->>'offer_id'='939' then
      if v_stock then return false; end if;
    elsif not v_stock then v_applied:=v_applied+1; end if;
  end loop;
  return (select count(*) from public.offers where retailer_id=9 and not in_stock)=104+v_applied;
end
$fit_baseline$;

create or replace function public.fit_house_six_oos_owner_exception(p_request jsonb)
returns boolean language plpgsql stable security definer
set search_path to 'pg_catalog','public','pg_temp' as $fit_exception$
declare
  v_rows constant jsonb := '[
    {"offer_id":"718","mapping_id":"742","product_id":"699","variant_id":"3060","external_product_id":"9058975187184","external_variant_id":"46667614945520","price":"12.99","url":"https://fithouse.uk/products/now-foods-choline-inositol-100-veg-caps?variant=46667614945520"},
    {"offer_id":"749","mapping_id":"863","product_id":"730","variant_id":"3074","external_product_id":"9347614343408","external_variant_id":"47199795413232","price":"16.99","url":"https://fithouse.uk/products/now-foods-5-htp-double-strength-200-mg-60-veg-capsules?variant=47199795413232"},
    {"offer_id":"757","mapping_id":"871","product_id":"768","variant_id":"933","external_product_id":"9041428283632","external_variant_id":"46620421816560","price":"11.99","url":"https://fithouse.uk/products/7-nutrition-beta-alanine-250g-unflavoured?variant=46620421816560"},
    {"offer_id":"759","mapping_id":"873","product_id":"740","variant_id":"3021","external_product_id":"9168824172784","external_variant_id":"46969725714672","price":"11.99","url":"https://fithouse.uk/products/7-nutrition-berberine-stack-90-vege-caps?variant=46969725714672"},
    {"offer_id":"913","mapping_id":"1099","product_id":"502","variant_id":"914","external_product_id":"9674414915824","external_variant_id":"48123945124080","price":"2.50","url":"https://fithouse.uk/products/lenny-larrys-fitzels-protein-pretzels-85-g?variant=48123945124080"},
    {"offer_id":"940","mapping_id":"1126","product_id":"766","variant_id":"928","external_product_id":"10021385273584","external_variant_id":"49719663067376","price":"9.99","url":"https://fithouse.uk/products/ostrovit-carbo-1000-g?variant=49719663067376"}
  ]'::jsonb;
  v_row jsonb;
  v_review jsonb;
  v_changes integer:=0;
begin
  if p_request#>>'{artifact,target_environment}' is distinct from 'PRODUCTION'
     or p_request#>>'{artifact,retailer_id}' is distinct from '9'
     or p_request->>'source_snapshot_fingerprint' is distinct from 'ebe563f0f620ff4b501c1e8f56adfe51d854ff912e5089149688d5d0a60c43c1'
     or p_request#>>'{artifact,source_snapshot_fingerprint}' is distinct from 'ebe563f0f620ff4b501c1e8f56adfe51d854ff912e5089149688d5d0a60c43c1'
     or p_request->>'policy_fingerprint' is distinct from 'dd2f583394ffa3787b595d7009731dff5bb8e485b9114d3778084a71c120dfc1'
     or not public.fit_house_six_oos_baseline_exact() then return false; end if;
  for v_row in select value from jsonb_array_elements(p_request#>'{artifact,rows}') loop
    if v_row->>'action'='VERIFY_NO_CHANGE' then
      if v_row#>>'{atomic_plan,expected_state,offer,in_stock}' is distinct from 'true'
         or v_row#>>'{atomic_plan,offer,values,in_stock}' is distinct from 'true' then return false; end if;
    elsif v_row->>'action'='UPDATE_STOCK' then
      select value into v_review from jsonb_array_elements(v_rows)
       where value->>'offer_id'=v_row->>'offer_id';
      if not found then return false; end if;
      if v_row->>'retailer_product_id' is distinct from v_review->>'mapping_id'
         or v_row->>'external_product_id' is distinct from v_review->>'external_product_id'
         or v_row->>'external_variant_id' is distinct from v_review->>'external_variant_id'
         or v_row#>>'{changed_fields,stock}' is distinct from 'true'
         or v_row#>>'{changed_fields,price}' is distinct from 'false'
         or v_row#>>'{changed_fields,url}' is distinct from 'false'
         or v_row#>>'{atomic_plan,expected_state,product,id}' is distinct from v_review->>'product_id'
         or v_row#>>'{atomic_plan,expected_state,product_variant,id}' is distinct from v_review->>'variant_id'
         or v_row#>>'{atomic_plan,expected_state,retailer_product,id}' is distinct from v_review->>'mapping_id'
         or v_row#>>'{atomic_plan,expected_state,offer,id}' is distinct from v_review->>'offer_id'
         or v_row#>>'{atomic_plan,expected_state,offer,in_stock}' is distinct from 'true'
         or v_row#>>'{atomic_plan,offer,values,in_stock}' is distinct from 'false'
         or (v_row#>>'{atomic_plan,expected_state,offer,price}')::numeric is distinct from (v_review->>'price')::numeric
         or (v_row#>>'{atomic_plan,offer,values,price}')::numeric is distinct from (v_review->>'price')::numeric
         or (v_row#>>'{atomic_plan,expected_state,offer,shipping_cost}')::numeric is distinct from 3.99
         or (v_row#>>'{atomic_plan,offer,values,shipping_cost}')::numeric is distinct from 3.99
         or (v_row#>>'{atomic_plan,expected_state,offer,total_price}')::numeric is distinct from (v_review->>'price')::numeric+3.99
         or (v_row#>>'{atomic_plan,offer,values,total_price}')::numeric is distinct from (v_review->>'price')::numeric+3.99
         or v_row#>>'{atomic_plan,expected_state,offer,url}' is distinct from v_review->>'url'
         or v_row#>>'{atomic_plan,offer,values,url}' is distinct from v_review->>'url'
         or v_row#>>'{atomic_plan,expected_state,retailer_product,external_url}' is distinct from v_review->>'url'
         or v_row#>>'{atomic_plan,retailer_product,values,external_url}' is distinct from v_review->>'url' then return false; end if;
      v_changes:=v_changes+1;
    else return false; end if;
  end loop;
  return v_changes between 1 and 3;
end
$fit_exception$;

alter function public.fit_house_six_oos_baseline_exact() owner to postgres;
alter function public.fit_house_six_oos_owner_exception(jsonb) owner to postgres;
revoke all on function public.fit_house_six_oos_baseline_exact() from public,anon,authenticated,service_role;
revoke all on function public.fit_house_six_oos_owner_exception(jsonb) from public,anon,authenticated,service_role;

do $fit_six_install$
declare
  v_target jsonb:=public.retailer_catalogue_actual_database_target();
  v_record record;
  v_definition text;
  v_old_baseline constant text:='(select count(*) from public.offers where retailer_id=9 and not in_stock)>104';
  v_old_oos constant text:='or v_total_oos>v_previous_oos then';
begin
  if current_user<>'postgres'
     or v_target->>'target_environment'<>'PRODUCTION'
     or v_target->>'project_ref'<>'aftboxmrdgyhizicfsfu'
     or v_target->>'database_identity'<>'supplementscout-production:aftboxmrdgyhizicfsfu'
     or not public.fit_house_six_oos_baseline_exact()
     or (select count(*) from public.offers where retailer_id=9 and not in_stock)<>104 then
    raise exception 'Fit House six-offer migration requires exact owner target and 104-OOS before-state';
  end if;
  for v_record in select p.oid,p.proowner,p.proacl,p.proconfig,pg_get_functiondef(p.oid) definition,
        md5(pg_get_functiondef(p.oid)) digest,p.proname
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace
     where n.nspname='public' and p.proname in
       ('validate_fit_house_stable_oos_read_only','validate_fit_house_confirmed_price_read_only') loop
    if (v_record.proname='validate_fit_house_stable_oos_read_only' and v_record.digest<>'28ee622dcc83d5398d160d83b4e2e920')
       or (v_record.proname='validate_fit_house_confirmed_price_read_only' and v_record.digest<>'3ece3becc90ebaff950c173905789621')
       or (length(v_record.definition)-length(replace(v_record.definition,v_old_baseline,'')))<>length(v_old_baseline)
       or (length(v_record.definition)-length(replace(v_record.definition,v_old_oos,'')))<>length(v_old_oos) then
      raise exception 'Fit House six-offer validator definition drift';
    end if;
    v_definition:=replace(v_record.definition,v_old_baseline,'not public.fit_house_six_oos_baseline_exact()');
    if v_record.proname='validate_fit_house_stable_oos_read_only' then
      v_definition:=replace(v_definition,v_old_oos,
        'or (v_total_oos>v_previous_oos and not public.fit_house_six_oos_owner_exception(p_request)) then');
    end if;
    execute v_definition;
    if pg_get_functiondef(v_record.oid)<>v_definition
       or not exists(select 1 from pg_proc p where p.oid=v_record.oid
         and p.proowner=v_record.proowner and p.proacl is not distinct from v_record.proacl
         and p.proconfig is not distinct from v_record.proconfig) then
      raise exception 'Fit House six-offer validator owner, ACL, settings or definition drift';
    end if;
  end loop;
  if (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname in
        ('validate_fit_house_stable_oos_read_only','validate_fit_house_confirmed_price_read_only'))<>2
     or md5(pg_get_functiondef('public.retailer_offer_sync_validate_batch_read_only_internal(jsonb)'::regprocedure))<>'a9e191f447a1efda3cf788019b5bd79a'
     or md5(pg_get_functiondef('public.retailer_offer_sync_validate_batch_read_only_unreviewed_interna(jsonb)'::regprocedure))<>'49d36240cb3f7c9fed12f63b145e93f0' then
    raise exception 'Fit House six-offer dispatcher or shared validator changed';
  end if;
end
$fit_six_install$;

commit;
