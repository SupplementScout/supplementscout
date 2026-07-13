\if :{?atomic_import_test_database_confirmed}
\else
  \quit
\endif

select 1 / case
  when :'atomic_import_test_database_confirmed' = '1'
   and :'atomic_import_test_host' = '127.0.0.1'
   and current_database() like 'supplementscout_stage2_test_atomic_import_%'
   and current_database() = :'atomic_import_expected_database'
   and current_database() not like '%aftboxmrdgyhizicfsfu%'
   and current_database() not like '%dlsbwshkzdsvzubjftbv%'
  then 1 else 0
end as disposable_database_guard;

create or replace function public.atomic_test_decimalize(p_value jsonb)
returns jsonb
language plpgsql
immutable
as $$
declare v_result jsonb;
begin
  case jsonb_typeof(p_value)
    when 'object' then
      select coalesce(jsonb_object_agg(entry.key, public.atomic_test_decimalize(entry.value)), '{}'::jsonb)
      into v_result from jsonb_each(p_value) entry;
    when 'array' then
      select coalesce(jsonb_agg(public.atomic_test_decimalize(entry.value) order by entry.ordinality), '[]'::jsonb)
      into v_result from jsonb_array_elements(p_value) with ordinality entry(value, ordinality);
    when 'number' then
      v_result := to_jsonb(public.atomic_import_decimal_string((p_value#>>'{}')::numeric));
    else v_result := p_value;
  end case;
  return v_result;
end;
$$;

create or replace function public.atomic_test_finalize_plan(p_plan jsonb)
returns jsonb
language plpgsql
as $$
declare
  v_approval jsonb;
begin
  p_plan := public.atomic_test_decimalize(p_plan);
  if p_plan#>>'{approval,approval_type}' = 'safe_create' then
    v_approval := jsonb_set(p_plan->'approval', '{approval_fingerprint}', 'null'::jsonb, false);
    v_approval := jsonb_set(
      v_approval,
      '{approval_fingerprint}',
      to_jsonb(md5(public.atomic_import_canonical_json(v_approval))),
      false
    );
    p_plan := jsonb_set(p_plan, '{approval}', v_approval, false);
  end if;
  p_plan := jsonb_set(p_plan, '{meta,plan_fingerprint}', 'null'::jsonb, false);
  return jsonb_set(
    p_plan,
    '{meta,plan_fingerprint}',
    to_jsonb(md5(public.atomic_import_canonical_json(p_plan))),
    false
  );
end;
$$;

create or replace function public.atomic_test_safe_plan(
  p_slug text,
  p_external_variant text,
  p_format text default 'capsule'
) returns jsonb
language plpgsql
as $$
declare
  v_source text := repeat('a', 64);
  v_plan jsonb;
begin
  v_plan := jsonb_build_object(
    'meta', jsonb_build_object(
      'version', 2, 'plan_kind', 'feed',
      'source_row_fingerprint', v_source, 'plan_fingerprint', null
    ),
    'product', jsonb_build_object(
      'action', 'create',
      'values', jsonb_build_object(
        'name', p_slug, 'slug', p_slug, 'brand', 'Integration Brand',
        'category', 'Health Supplements', 'price', 10,
        'image', null, 'description', null, 'servings', null,
        'net_weight_g', null, 'net_volume_ml', null,
        'serving_count_verified', null, 'serving_size_g', null,
        'serving_size_ml', null, 'protein_per_serving_g', null,
        'creatine_per_serving_g', null, 'unit_count', null,
        'unit_type', null, 'product_format', p_format,
        'unit_pricing_verified', false, 'nutrition_verified', false,
        'gtin', null
      )
    ),
    'product_variant', jsonb_build_object(
      'action', 'create_default',
      'evidence', jsonb_build_object(
        'flavour', null, 'size_value', null, 'size_unit', null,
        'pack_count', 1, 'product_format', p_format,
        'external_options', null, 'approved_mapping_id', null
      )
    ),
    'retailer', jsonb_build_object('action', 'existing', 'id', 1),
    'retailer_product', jsonb_build_object(
      'action', 'create',
      'values', jsonb_build_object(
        'external_product_id', 'product-' || coalesce(p_external_variant, p_slug),
        'external_variant_id', p_external_variant,
        'external_sku', 'sku-' || coalesce(p_external_variant, p_slug),
        'external_options', null, 'external_name', p_slug,
        'external_slug', p_slug, 'external_gtin', 'retailer-only-gtin',
        'external_url', 'https://local.test/' || p_slug || '?variant=' || coalesce(p_external_variant, 'legacy'),
        'match_method', 'slug', 'match_confidence', 90,
        'product_variant_id', null
      )
    ),
    'offer', jsonb_build_object(
      'action', 'create',
      'values', jsonb_build_object(
        'price', 10, 'shipping_cost', 2, 'total_price', 12,
        'url', 'https://affiliate.local/' || p_slug,
        'in_stock', true, 'last_checked_at', '2026-07-13T18:00:00Z'
      )
    ),
    'price_history', jsonb_build_object('action', 'create'),
    'approval', jsonb_build_object(
      'approved', true, 'approval_type', 'safe_create',
      'approved_category', 'Health Supplements',
      'source_row_fingerprint', v_source, 'canonical_name', p_slug,
      'has_variant_evidence', false, 'approval_fingerprint', null
    ),
    'expected_state', jsonb_build_object(
      'product', null, 'retailer', (
        select jsonb_build_object('id',id,'name',name,'slug',slug,'website',website)
        from public.retailers where id = 1
      ),
      'product_variant', null, 'retailer_product', null, 'offer', null
    )
  );
  return public.atomic_test_finalize_plan(v_plan);
end;
$$;

create or replace function public.atomic_test_existing_plan(
  p_slug text,
  p_external_variant text,
  p_product_id bigint,
  p_variant_id bigint,
  p_kind text default 'feed'
) returns jsonb
language plpgsql
as $$
declare
  v_plan jsonb := public.atomic_test_safe_plan(p_slug, p_external_variant);
  v_product public.products%rowtype;
  v_variant public.product_variants%rowtype;
  v_options jsonb;
begin
  select * into strict v_product from public.products where id = p_product_id;
  select * into strict v_variant from public.product_variants where id = p_variant_id;
  v_options := case when v_variant.is_default then null else jsonb_build_object(
    'Flavour', coalesce(v_variant.flavour_label, v_variant.flavour_code),
    'Size', v_variant.size_value::text || v_variant.size_unit
  ) end;
  v_plan := jsonb_set(v_plan, '{meta,plan_kind}', to_jsonb(p_kind));
  v_plan := jsonb_set(v_plan, '{product}', jsonb_build_object('action','existing','id',p_product_id));
  v_plan := jsonb_set(v_plan, '{product_variant}', jsonb_build_object(
    'action','existing','id',p_variant_id,
    'evidence', jsonb_build_object(
      'flavour', case when v_variant.is_default then null else coalesce(v_variant.flavour_code,v_variant.flavour_label) end,
      'size_value', v_variant.size_value, 'size_unit', v_variant.size_unit,
      'pack_count', coalesce(v_variant.pack_count, 1),
      'product_format', coalesce(v_variant.product_format, v_product.product_format),
      'external_options', v_options, 'approved_mapping_id', null
    )
  ));
  v_plan := jsonb_set(v_plan, '{retailer_product,values,external_name}', to_jsonb(v_product.name));
  v_plan := jsonb_set(v_plan, '{retailer_product,values,external_slug}', to_jsonb(v_product.slug));
  v_plan := jsonb_set(v_plan, '{retailer_product,values,external_options}', coalesce(v_options, 'null'::jsonb));
  v_plan := jsonb_set(v_plan, '{retailer_product,values,product_variant_id}', to_jsonb(p_variant_id));
  v_plan := jsonb_set(v_plan, '{approval}', jsonb_build_object('approved',false,'approval_type','none'));
  v_plan := jsonb_set(v_plan, '{expected_state,product}', jsonb_build_object(
    'id',v_product.id,'name',v_product.name,'is_active',v_product.is_active,
    'merged_into_product_id',v_product.merged_into_product_id,'product_format',v_product.product_format
  ));
  v_plan := jsonb_set(v_plan, '{expected_state,product_variant}', jsonb_build_object(
    'id',v_variant.id,'product_id',v_variant.product_id,'variant_key',v_variant.variant_key,
    'display_name',v_variant.display_name,'flavour_code',v_variant.flavour_code,
    'flavour_label',v_variant.flavour_label,'size_value',v_variant.size_value,
    'size_unit',v_variant.size_unit,'pack_count',v_variant.pack_count,
    'product_format',v_variant.product_format,'is_active',v_variant.is_active,
    'is_default',v_variant.is_default
  ));
  return public.atomic_test_finalize_plan(v_plan);
end;
$$;

create or replace function public.atomic_test_current_plan(p_external_variant text)
returns jsonb
language plpgsql
as $$
declare
  v_mapping public.retailer_products%rowtype;
  v_offer public.offers%rowtype;
  v_plan jsonb;
begin
  select * into strict v_mapping from public.retailer_products where external_variant_id = p_external_variant;
  select * into strict v_offer from public.offers where retailer_product_id = v_mapping.id;
  v_plan := public.atomic_test_existing_plan(
    v_mapping.external_slug, p_external_variant,
    v_mapping.product_id, v_mapping.product_variant_id
  );
  v_plan := jsonb_set(v_plan, '{product_variant,evidence,approved_mapping_id}', to_jsonb(v_mapping.id));
  v_plan := jsonb_set(v_plan, '{retailer_product}', jsonb_build_object(
    'action','noop','id',v_mapping.id,
    'values', jsonb_build_object(
      'external_product_id',v_mapping.external_product_id,'external_variant_id',v_mapping.external_variant_id,
      'external_sku',v_mapping.external_sku,'external_options',v_mapping.external_options,
      'external_name',v_mapping.external_name,'external_slug',v_mapping.external_slug,
      'external_gtin',v_mapping.external_gtin,'external_url',v_mapping.external_url,
      'match_method',v_mapping.match_method,'match_confidence',v_mapping.match_confidence,
      'product_variant_id',v_mapping.product_variant_id
    )
  ));
  v_plan := jsonb_set(v_plan, '{offer}', jsonb_build_object(
    'action','noop','id',v_offer.id,
    'values',jsonb_build_object(
      'price',v_offer.price,'shipping_cost',v_offer.shipping_cost,'total_price',v_offer.total_price,
      'url',v_offer.url,'in_stock',v_offer.in_stock,'last_checked_at',v_offer.last_checked_at
    )
  ));
  v_plan := jsonb_set(v_plan, '{price_history}', jsonb_build_object('action','noop'));
  v_plan := jsonb_set(v_plan, '{expected_state,retailer_product}', to_jsonb(v_mapping) - 'created_at');
  v_plan := jsonb_set(v_plan, '{expected_state,offer}', jsonb_build_object(
    'id',v_offer.id,'product_id',v_offer.product_id,'retailer_id',v_offer.retailer_id,
    'product_variant_id',v_offer.product_variant_id,'retailer_product_id',v_offer.retailer_product_id,
    'price',v_offer.price,'shipping_cost',v_offer.shipping_cost,'total_price',v_offer.total_price,
    'in_stock',v_offer.in_stock,'url',v_offer.url,'last_checked_at',v_offer.last_checked_at
  ));
  return public.atomic_test_finalize_plan(v_plan);
end;
$$;

create or replace function public.atomic_test_expect_failure(p_plan jsonb, p_label text)
returns void
language plpgsql
as $$
begin
  begin
    perform public.approve_product_import_plan(
      p_plan, repeat('b',64), 'atomic-negative-run', 'atomic-negative-test'
    );
    raise exception 'expected rejection: %', p_label;
  exception when others then
    if sqlerrm like 'expected rejection:%' then raise; end if;
  end;
end;
$$;

create or replace function public.atomic_test_approve(p_plan jsonb)
returns uuid
language sql
as $$
  select (public.approve_product_import_plan(
    p_plan,
    repeat('b',64),
    'atomic-integration-run',
    'atomic-integration-test',
    now() + interval '15 minutes'
  )->>'approval_id')::uuid;
$$;

create or replace function public.atomic_test_consume(p_approval_id uuid)
returns jsonb
language plpgsql
as $$
declare v_approval public.approved_import_plans%rowtype;
begin
  select * into v_approval from public.approved_import_plans where id=p_approval_id;
  return public.apply_approved_product_import_plan(
    p_approval_id, v_approval.artifact_sha256, v_approval.plan_fingerprint,
    v_approval.source_row_fingerprint, v_approval.retailer_id,
    v_approval.plan_kind, v_approval.run_id
  );
end;
$$;

create or replace function public.atomic_test_expect_apply_failure(p_plan jsonb, p_label text)
returns void
language plpgsql
as $$
declare v_id uuid;
begin
  v_id := public.atomic_test_approve(p_plan);
  begin
    perform public.atomic_test_consume(v_id);
    raise exception 'expected apply rejection: %', p_label;
  exception when others then
    if sqlerrm like 'expected apply rejection:%' then raise; end if;
  end;
  if (select status from public.approved_import_plans where id=v_id) <> 'approved' then
    raise exception 'failed apply consumed approval: %', p_label;
  end if;
end;
$$;

create or replace function public.atomic_test_apply(p_plan jsonb)
returns jsonb
language plpgsql
as $$
declare v_approval_id uuid;
begin
  v_approval_id := public.atomic_test_approve(p_plan);
  return public.atomic_test_consume(v_approval_id);
end;
$$;

-- 0: Node stable JSON and PostgreSQL canonical JSON produce the same fingerprint.
do $$ begin
  if md5(public.atomic_import_canonical_json(
    '{"z":[3,null,{"q":"x"}],"a":{"beta":true,"alpha":12.5}}'::jsonb
  )) <> 'a96ac301210f600942eecb5d1f666884' then
    raise exception 'Node/PostgreSQL canonical fingerprint mismatch';
  end if;
end $$;

-- 1: approved safe-create succeeds atomically and keeps retailer GTIN isolated.
select public.atomic_test_apply(public.atomic_test_safe_plan('atomic-safe-success','atomic-safe-1'));
do $$
declare v_product_id bigint;
begin
  select id into strict v_product_id from public.products where slug='atomic-safe-success';
  if (select count(*) from public.product_variants where product_id=v_product_id and is_default) <> 1
     or (select count(*) from public.retailer_products where product_id=v_product_id) <> 1
     or (select count(*) from public.offers where product_id=v_product_id) <> 1
     or (select count(*) from public.price_history ph join public.offers o on o.id=ph.offer_id where o.product_id=v_product_id) <> 1
     or (select gtin from public.products where id=v_product_id) is not null then
    raise exception 'safe-create assertions failed';
  end if;
end $$;

create or replace function public.atomic_test_failure_trigger()
returns trigger
language plpgsql
as $$
declare v_failpoint text := current_setting('app.atomic_test_failpoint', true);
begin
  if (tg_table_name = 'products' and v_failpoint = 'after_product')
     or (tg_table_name = 'product_variants' and v_failpoint = 'after_default_variant')
     or (tg_table_name = 'retailer_products' and v_failpoint = 'after_retailer_product')
     or (tg_table_name = 'offers' and v_failpoint = 'after_offer')
     or (tg_table_name = 'price_history' and v_failpoint = 'before_price_history') then
    raise exception 'test-only failure at %', v_failpoint;
  end if;
  return new;
end;
$$;
create trigger atomic_test_fail_product after insert on public.products
for each row execute function public.atomic_test_failure_trigger();
create trigger atomic_test_fail_variant after insert on public.product_variants
for each row execute function public.atomic_test_failure_trigger();
create trigger atomic_test_fail_mapping after insert on public.retailer_products
for each row execute function public.atomic_test_failure_trigger();
create trigger atomic_test_fail_offer after insert on public.offers
for each row execute function public.atomic_test_failure_trigger();
create trigger atomic_test_fail_history before insert on public.price_history
for each row execute function public.atomic_test_failure_trigger();

-- 2-6: five injected failures roll the whole statement back.
do $$
declare v_failpoint text; v_slug text;
begin
  foreach v_failpoint in array array['after_product','after_default_variant','after_retailer_product','after_offer','before_price_history'] loop
    v_slug := 'atomic-fail-' || replace(v_failpoint,'_','-');
    perform set_config('app.atomic_test_failpoint',v_failpoint,true);
    perform public.atomic_test_expect_apply_failure(public.atomic_test_safe_plan(v_slug,'variant-'||v_failpoint),v_failpoint);
    perform set_config('app.atomic_test_failpoint','',true);
    if exists(select 1 from public.products where slug=v_slug) then raise exception 'failpoint left product'; end if;
  end loop;
end $$;

-- 7: duplicate external variant rolls a newly created product back.
select public.atomic_test_expect_apply_failure(public.atomic_test_safe_plan('duplicate-safe','atomic-safe-1'),'duplicate external variant');

-- 8: Discount Supplements-like A/B variants remain independent, including mixed create B.
insert into public.products(id,name,slug,brand,category,product_format,is_active)
values(900001,'Multi Variant Product','multi-variant-product','Integration Brand','Whey Protein','powder',true);
insert into public.product_variants(id,product_id,variant_key,display_name,flavour_code,flavour_label,size_value,size_unit,pack_count,product_format,is_active,is_default)
values
 (900001,900001,'chocolate-500g','Chocolate 500g','chocolate','Chocolate',500,'g',1,'powder',true,false),
 (900002,900001,'vanilla-1000g','Vanilla 1000g','vanilla','Vanilla',1000,'g',1,'powder',true,false);
select public.atomic_test_apply(public.atomic_test_existing_plan('multi-a','multi-a',900001,900001));
do $$ declare v_plan jsonb; begin
  v_plan := public.atomic_test_existing_plan('multi-b','multi-b',900001,900002);
  v_plan := jsonb_set(v_plan,'{product_variant,evidence,external_options}','{"Size":"1kg","Flavour":"Vanilla"}');
  v_plan := jsonb_set(v_plan,'{retailer_product,values,external_options}',v_plan#>'{product_variant,evidence,external_options}');
  perform public.atomic_test_apply(public.atomic_test_finalize_plan(v_plan));
end $$;
do $$ begin
  if (select count(*) from public.retailer_products where product_id=900001) <> 2
     or (select count(*) from public.offers where product_id=900001) <> 2 then
    raise exception 'mixed variant identity failed';
  end if;
end $$;

-- 9-15: normalized option sizes use the same base-unit contract as Node.
insert into public.product_variants(
  id,product_id,variant_key,display_name,flavour_code,flavour_label,
  size_value,size_unit,pack_count,product_format,is_active,is_default
) values
 (900003,900001,'strawberry-500g','Strawberry 500g','strawberry','Strawberry',500,'g',1,'powder',true,false),
 (900004,900001,'berry-1000ml','Berry 1000ml','berry','Berry',1000,'ml',1,'liquid',true,false);
do $$
declare v_plan jsonb; v_bad jsonb;
begin
  v_plan := public.atomic_test_existing_plan('half-kilo','half-kilo',900001,900003);
  v_plan := jsonb_set(v_plan,'{product_variant,evidence,external_options}','{"Size":"0.5kg","Flavour":"Strawberry"}');
  v_plan := jsonb_set(v_plan,'{retailer_product,values,external_options}',v_plan#>'{product_variant,evidence,external_options}');
  perform public.atomic_test_apply(public.atomic_test_finalize_plan(v_plan));

  v_plan := public.atomic_test_existing_plan('one-litre','one-litre',900001,900004);
  v_plan := jsonb_set(v_plan,'{product_variant,evidence,external_options}','{"Size":"1L","Flavour":"Berry"}');
  v_plan := jsonb_set(v_plan,'{retailer_product,values,external_options}',v_plan#>'{product_variant,evidence,external_options}');
  perform public.atomic_test_apply(public.atomic_test_finalize_plan(v_plan));

  v_bad := public.atomic_test_existing_plan('mass-volume-mismatch','mass-volume-mismatch',900001,900002);
  v_bad := jsonb_set(v_bad,'{product_variant,evidence,external_options}','{"Size":"1L","Flavour":"Vanilla"}');
  v_bad := jsonb_set(v_bad,'{retailer_product,values,external_options}',v_bad#>'{product_variant,evidence,external_options}');
  perform public.atomic_test_expect_failure(public.atomic_test_finalize_plan(v_bad),'mass must not match volume');

  foreach v_bad in array array[
    jsonb_set(public.atomic_test_existing_plan('unknown-size','unknown-size',900001,900002),'{product_variant,evidence,external_options}','{"Size":"500oz","Flavour":"Vanilla"}'),
    jsonb_set(public.atomic_test_existing_plan('invalid-size','invalid-size',900001,900002),'{product_variant,evidence,external_options}','{"Size":"0kg","Flavour":"Vanilla"}')
  ] loop
    v_bad := jsonb_set(v_bad,'{retailer_product,values,external_options}',v_bad#>'{product_variant,evidence,external_options}');
    perform public.atomic_test_expect_failure(public.atomic_test_finalize_plan(v_bad),'invalid normalized option size');
  end loop;
end $$;

-- 16-18: manual existing, KIOR-like default and Fit House-like default.
insert into public.products(id,name,slug,brand,category,product_format,is_active)
values
 (2010,'Manual Product','manual-product','Integration Brand','Vitamins',null,true),
 (910001,'KIOR Daily Capsules','kior-daily-capsules','KIOR','Health Supplements','capsule',true),
 (910002,'Fit House Creatine','fit-house-creatine','Fit House','Creatine','powder',true);
insert into public.product_variants(id,product_id,variant_key,display_name,nutrition_override,is_active,is_default)
values
 (2010,2010,'default','Default','{}',true,true),
 (910001,910001,'default','Default','{}',true,true),
 (910002,910002,'default','Default','{}',true,true);
select public.atomic_test_apply(public.atomic_test_existing_plan('manual-product','manual-default',2010,2010,'manual'));
select public.atomic_test_apply(public.atomic_test_existing_plan('kior-daily-capsules','kior-neutral',910001,910001));
select public.atomic_test_apply(public.atomic_test_existing_plan('fit-house-creatine','fit-neutral',910002,910002));

-- 12: legacy feed identity is exact retailer + URL with no external_variant_id.
select public.atomic_test_apply(public.atomic_test_safe_plan('legacy-url-only',null));

-- 13-17: create/update/noop price-history rules.
do $$
declare v_plan jsonb; v_offer_id bigint; v_history bigint;
begin
  v_plan := public.atomic_test_current_plan('manual-default');
  select id into v_offer_id from public.offers where retailer_product_id=(select id from public.retailer_products where external_variant_id='manual-default');
  select count(*) into v_history from public.price_history where offer_id=v_offer_id;

  v_plan := jsonb_set(v_plan,'{offer,action}','"update"');
  v_plan := jsonb_set(v_plan,'{offer,values,price}','11');
  v_plan := jsonb_set(v_plan,'{offer,values,total_price}','13');
  v_plan := jsonb_set(v_plan,'{price_history,action}','"create"');
  v_plan := public.atomic_test_finalize_plan(v_plan);
  perform public.atomic_test_apply(v_plan);
  if (select count(*) from public.price_history where offer_id=v_offer_id) <> v_history+1 then raise exception 'price update history failed'; end if;

  update public.offers set total_price=999 where id=v_offer_id;
  select count(*) into v_history from public.price_history where offer_id=v_offer_id;
  v_plan := public.atomic_test_current_plan('manual-default');
  v_plan := jsonb_set(v_plan,'{offer,action}','"update"');
  v_plan := jsonb_set(v_plan,'{offer,values,total_price}','13');
  v_plan := jsonb_set(v_plan,'{price_history,action}','"create"');
  perform public.atomic_test_apply(public.atomic_test_finalize_plan(v_plan));
  if (select total_price from public.offers where id=v_offer_id) <> 13
     or (select count(*) from public.price_history where offer_id=v_offer_id) <> v_history+1 then
    raise exception 'total-price-only update history failed';
  end if;
  v_history := v_history + 1;
  perform public.atomic_test_apply(public.atomic_test_current_plan('manual-default'));
  if (select count(*) from public.price_history where offer_id=v_offer_id) <> v_history then
    raise exception 'total-price rerun created duplicate history';
  end if;

  v_plan := public.atomic_test_current_plan('manual-default');
  v_plan := jsonb_set(v_plan,'{offer,action}','"update"');
  v_plan := jsonb_set(v_plan,'{offer,values,in_stock}','false');
  v_plan := public.atomic_test_finalize_plan(v_plan);
  perform public.atomic_test_apply(v_plan);

  v_plan := public.atomic_test_current_plan('manual-default');
  v_plan := jsonb_set(v_plan,'{offer,action}','"update"');
  v_plan := jsonb_set(v_plan,'{offer,values,url}','"https://affiliate.local/manual-product-new"');
  v_plan := public.atomic_test_finalize_plan(v_plan);
  perform public.atomic_test_apply(v_plan);

  v_plan := public.atomic_test_current_plan('manual-default');
  perform public.atomic_test_apply(v_plan);
  v_plan := jsonb_set(v_plan,'{price_history,action}','"create"');
  v_plan := public.atomic_test_finalize_plan(v_plan);
  perform public.atomic_test_expect_failure(v_plan,'unjustified history');
end $$;

-- 18-34: closed-schema, approval, arbitrary identity, evidence and stale-state negatives.
do $$
declare v_plan jsonb; v_bad jsonb;
begin
  v_plan := public.atomic_test_safe_plan('negative-base','negative-base');
  perform public.atomic_test_expect_failure(v_plan || '{"unknown":true}'::jsonb,'unknown top-level field');
  perform public.atomic_test_expect_failure(jsonb_set(v_plan,'{offer,values,unknown}','true'),'unknown nested field');
  perform public.atomic_test_expect_failure(v_plan #- '{offer,values,url}','missing required field');
  perform public.atomic_test_expect_failure(jsonb_set(v_plan,'{offer,values,price}','"ten"'),'wrong JSON type');
  perform public.atomic_test_expect_failure(jsonb_set(v_plan,'{offer,action}','"replace"'),'unknown action');

  v_bad := jsonb_set(v_plan,'{approval}',jsonb_build_object('approved',false,'approval_type','none'));
  v_bad := public.atomic_test_finalize_plan(v_bad);
  perform public.atomic_test_expect_failure(v_bad,'create without approval');
  v_bad := jsonb_set(v_plan,'{approval,canonical_name}','"forged"');
  v_bad := public.atomic_test_finalize_plan(v_bad);
  perform public.atomic_test_expect_failure(v_bad,'forged approval');

  v_bad := public.atomic_test_existing_plan('manual-product','negative-id',2010,2010);
  v_bad := jsonb_set(v_bad,'{product,id}','900001');
  v_bad := public.atomic_test_finalize_plan(v_bad);
  perform public.atomic_test_expect_failure(v_bad,'arbitrary product id');
  v_bad := public.atomic_test_existing_plan('manual-product','negative-variant',2010,2010);
  v_bad := jsonb_set(v_bad,'{product_variant,id}','900001');
  v_bad := public.atomic_test_finalize_plan(v_bad);
  perform public.atomic_test_expect_failure(v_bad,'arbitrary variant id');

  v_bad := public.atomic_test_existing_plan('multi-a-negative','negative-flavour',900001,900001);
  v_bad := jsonb_set(v_bad,'{product_variant,evidence,flavour}','"vanilla"');
  v_bad := public.atomic_test_finalize_plan(v_bad);
  perform public.atomic_test_expect_failure(v_bad,'flavour mismatch');
  v_bad := public.atomic_test_existing_plan('multi-a-negative','negative-size',900001,900001);
  v_bad := jsonb_set(v_bad,'{product_variant,evidence,size_value}','1000');
  v_bad := public.atomic_test_finalize_plan(v_bad);
  perform public.atomic_test_expect_failure(v_bad,'size mismatch');
  v_bad := public.atomic_test_existing_plan('multi-a-negative','negative-options',900001,900001);
  v_bad := jsonb_set(v_bad,'{product_variant,evidence,external_options,Flavour}','"Vanilla"');
  v_bad := jsonb_set(v_bad,'{retailer_product,values,external_options}',v_bad#>'{product_variant,evidence,external_options}');
  v_bad := public.atomic_test_finalize_plan(v_bad);
  perform public.atomic_test_expect_failure(v_bad,'options mismatch');

  v_bad := public.atomic_test_existing_plan('manual-product','stale-product',2010,2010);
  v_bad := jsonb_set(v_bad,'{expected_state,product,name}','"stale"');
  v_bad := public.atomic_test_finalize_plan(v_bad);
  perform public.atomic_test_expect_failure(v_bad,'stale product');
  v_bad := public.atomic_test_existing_plan('manual-product','stale-retailer',2010,2010);
  v_bad := jsonb_set(v_bad,'{expected_state,retailer,slug}','"stale"');
  v_bad := public.atomic_test_finalize_plan(v_bad);
  perform public.atomic_test_expect_failure(v_bad,'stale retailer');
  v_bad := public.atomic_test_existing_plan('manual-product','stale-variant',2010,2010);
  v_bad := jsonb_set(v_bad,'{expected_state,product_variant,display_name}','"stale"');
  v_bad := public.atomic_test_finalize_plan(v_bad);
  perform public.atomic_test_expect_failure(v_bad,'stale variant');

  v_bad := public.atomic_test_safe_plan('manual-unknown','manual-unknown');
  v_bad := jsonb_set(v_bad,'{meta,plan_kind}','"manual"');
  v_bad := public.atomic_test_finalize_plan(v_bad);
  perform public.atomic_test_expect_failure(v_bad,'manual unknown product');
end $$;

-- 35: real composite FK rejects mismatched identity.
do $$
declare v_mapping_id bigint;
begin
  insert into public.retailer_products(retailer_id,product_id,product_variant_id,external_name,external_url,external_variant_id,match_method,match_confidence)
  values(1,900001,900001,'Composite FK fixture','https://atomic.invalid/composite','composite-fk','exact_mapping',1)
  returning id into v_mapping_id;
  begin
    insert into public.offers(product_id,retailer_id,product_variant_id,retailer_product_id,price,url,in_stock)
    values(2010,1,2010,v_mapping_id,1,'https://invalid.local',true);
    set constraints all immediate;
    raise exception 'expected composite FK rejection';
  exception when foreign_key_violation then null;
  end;
end $$;

-- Approval ledger: one-time use, expiry, integrity, stale-state and rollback semantics.
do $$
declare
  v_id uuid;
  v_plan jsonb;
  v_status text;
  v_product_name text;
begin
  begin
    perform public.atomic_test_consume('00000000-0000-0000-0000-000000000000');
    raise exception 'expected missing approval rejection';
  exception when others then
    if sqlerrm = 'expected missing approval rejection' then raise; end if;
  end;

  v_id := public.atomic_test_approve(public.atomic_test_safe_plan('ledger-consumed','ledger-consumed'));
  perform public.atomic_test_consume(v_id);
  if (select status from public.approved_import_plans where id=v_id) <> 'consumed'
     or (select consumed_at from public.approved_import_plans where id=v_id) is null then
    raise exception 'successful approval was not consumed';
  end if;
  begin
    perform public.atomic_test_consume(v_id);
    raise exception 'expected consumed approval rejection';
  exception when others then
    if sqlerrm = 'expected consumed approval rejection' then raise; end if;
  end;

  v_id := public.atomic_test_approve(public.atomic_test_safe_plan('ledger-retailer-bound','ledger-retailer-bound'));
  perform public.atomic_test_consume(v_id);
  if (select retailer_id from public.retailer_products where external_variant_id='ledger-retailer-bound') <> 1 then
    raise exception 'approval was not bound to its retailer';
  end if;

  v_id := public.atomic_test_approve(public.atomic_test_safe_plan('ledger-expired','ledger-expired'));
  update public.approved_import_plans
  set created_at=now()-interval '2 hours', expires_at=now()-interval '1 hour'
  where id=v_id;
  begin
    perform public.atomic_test_consume(v_id);
    raise exception 'expected expired approval rejection';
  exception when others then
    if sqlerrm = 'expected expired approval rejection' then raise; end if;
  end;

  v_id := public.atomic_test_approve(public.atomic_test_safe_plan('ledger-tampered','ledger-tampered'));
  update public.approved_import_plans
  set plan_json=jsonb_set(plan_json,'{offer,values,price}','999')
  where id=v_id;
  begin
    perform public.atomic_test_consume(v_id);
    raise exception 'expected ledger fingerprint rejection';
  exception when others then
    if sqlerrm = 'expected ledger fingerprint rejection' then raise; end if;
  end;

  v_plan := public.atomic_test_current_plan('manual-default');
  v_id := public.atomic_test_approve(v_plan);
  select name into v_product_name from public.products where id=2010;
  update public.products set name=name || ' stale' where id=2010;
  begin
    perform public.atomic_test_consume(v_id);
    raise exception 'expected stale approved plan rejection';
  exception when others then
    if sqlerrm = 'expected stale approved plan rejection' then raise; end if;
  end;
  select status into v_status from public.approved_import_plans where id=v_id;
  if v_status <> 'approved' then raise exception 'stale approval was consumed'; end if;
  update public.products set name=v_product_name where id=2010;

  v_id := public.atomic_test_approve(public.atomic_test_safe_plan('ledger-rollback','ledger-rollback'));
  perform set_config('app.atomic_test_failpoint','after_offer',true);
  begin
    perform public.atomic_test_consume(v_id);
    raise exception 'expected apply rollback rejection';
  exception when others then
    if sqlerrm = 'expected apply rollback rejection' then raise; end if;
  end;
  perform set_config('app.atomic_test_failpoint','',true);
  if (select status from public.approved_import_plans where id=v_id) <> 'approved'
     or exists(select 1 from public.products where slug='ledger-rollback') then
    raise exception 'failed apply consumed approval or left partial data';
  end if;
end $$;

-- Approval creation is read-only, and every artifact/record metadata field is bound.
do $$
declare
  v_plan jsonb := public.atomic_test_safe_plan('ledger-read-only','ledger-read-only');
  v_id uuid;
  v_approval public.approved_import_plans%rowtype;
  v_before bigint;
  v_key text;
begin
  select last_value into v_before from public.products_id_seq;
  v_id := public.atomic_test_approve(v_plan);
  if exists(select 1 from public.products where slug='ledger-read-only')
    or (select last_value from public.products_id_seq) <> v_before then
    raise exception 'approval creation performed a write';
  end if;
  select * into strict v_approval from public.approved_import_plans where id=v_id;
  foreach v_key in array array['artifact','plan','source','retailer','kind','run'] loop
    begin
      perform public.apply_approved_product_import_plan(
        v_id,
        case when v_key='artifact' then repeat('d',64) else v_approval.artifact_sha256 end,
        case when v_key='plan' then repeat('e',32) else v_approval.plan_fingerprint end,
        case when v_key='source' then repeat('f',64) else v_approval.source_row_fingerprint end,
        case when v_key='retailer' then 999999 else v_approval.retailer_id end,
        case when v_key='kind' then 'manual' else v_approval.plan_kind end,
        case when v_key='run' then 'different-run' else v_approval.run_id end
      );
      raise exception 'expected metadata mismatch: %',v_key;
    exception when others then
      if sqlerrm like 'expected metadata mismatch:%' then raise; end if;
    end;
    if (select status from public.approved_import_plans where id=v_id) <> 'approved' then
      raise exception 'metadata mismatch consumed approval: %',v_key;
    end if;
  end loop;
  begin
    perform public.approve_product_import_plan(v_plan,'bad','bad run','test');
    raise exception 'expected invalid artifact SHA rejection';
  exception when others then
    if sqlerrm='expected invalid artifact SHA rejection' then raise; end if;
  end;
end $$;

-- Final owner, SECURITY DEFINER, volatility, search_path, RLS and ACL.
do $$
declare v_owner text; v_security boolean; v_volatility "char"; v_config text[]; v_grantable boolean;
begin
  select pg_get_userbyid(p.proowner), p.prosecdef, p.provolatile, p.proconfig
  into v_owner,v_security,v_volatility,v_config
  from pg_proc p where p.oid='public.apply_product_import_plan(jsonb)'::regprocedure;
  select coalesce(bool_or(x.is_grantable),false) into v_grantable
  from aclexplode((select proacl from pg_proc where oid='public.apply_product_import_plan(jsonb)'::regprocedure)) x
  where x.grantee='service_role'::regrole and x.privilege_type='EXECUTE';
  if v_owner <> 'postgres' or not v_security or v_volatility <> 'v'
     or v_config <> array['search_path=pg_catalog, public, pg_temp']
     or has_function_privilege('public','public.apply_product_import_plan(jsonb)','execute')
     or has_function_privilege('anon','public.apply_product_import_plan(jsonb)','execute')
     or has_function_privilege('authenticated','public.apply_product_import_plan(jsonb)','execute')
     or has_function_privilege('service_role','public.apply_product_import_plan(jsonb)','execute')
     or v_grantable then
    raise exception 'atomic import RPC owner or ACL mismatch';
  end if;
  if not has_function_privilege('service_role','public.approve_product_import_plan(jsonb,text,text,text,timestamptz)','execute')
     or not has_function_privilege('service_role','public.apply_approved_product_import_plan(uuid,text,text,text,bigint,text,text)','execute')
     or has_function_privilege('anon','public.approve_product_import_plan(jsonb,text,text,text,timestamptz)','execute')
     or has_function_privilege('authenticated','public.apply_approved_product_import_plan(uuid,text,text,text,bigint,text,text)','execute')
     or has_table_privilege('service_role','public.approved_import_plans','select')
     or has_table_privilege('service_role','public.approved_import_plans','insert')
     or has_table_privilege('service_role','public.approved_import_plans','update')
     or has_table_privilege('service_role','public.approved_import_plans','delete')
     or has_table_privilege('anon','public.approved_import_plans','select')
     or not (select relrowsecurity and relforcerowsecurity from pg_class where oid='public.approved_import_plans'::regclass)
     or (select pg_get_userbyid(relowner) from pg_class where oid='public.approved_import_plans'::regclass) <> 'postgres'
     or exists(select 1 from pg_policy where polrelid='public.approved_import_plans'::regclass)
     or has_function_privilege('service_role','public.atomic_import_has_exact_keys(jsonb,text[])','execute')
     or has_function_privilege('service_role','public.atomic_import_canonical_json(jsonb)','execute')
     or has_function_privilege('service_role','public.atomic_import_normalize_size(text)','execute')
     or exists(
       select 1 from pg_proc p, lateral aclexplode(p.proacl) x
       where p.oid in (
         'public.approve_product_import_plan(jsonb,text,text,text,timestamptz)'::regprocedure,
         'public.apply_approved_product_import_plan(uuid,text,text,text,bigint,text,text)'::regprocedure
       ) and x.grantee='service_role'::regrole and x.is_grantable
     ) then
    raise exception 'approval ledger owner, RLS or ACL mismatch';
  end if;
end $$;
