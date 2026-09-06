begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';

-- Policy only: allow exactly the owner-reviewed 10 Reps v8 sibling plans to
-- add named variants to the three live reviewed parents that have no default.
create or replace function public.atomic_import_10reps_v8_sibling_variant_allowed(
  p_plan jsonb
) returns boolean
language sql
immutable
set search_path = pg_catalog, public, pg_temp
as $function$
  with allowed(fingerprint,product_id,external_product_id,external_variant_id,external_sku,price,total_price,in_stock) as (
    values
      ('e1a52211982ad9e86eb31227fd8868e0','1161','469','11125','CHA074','25.99','29.98',true),
      ('2ef1a539fd5bd001d07331cbfdb83365','1161','469','477',null,'24.99','28.98',true),
      ('a78538498e4cc470399f7ad21211f1cd','1161','469','2279','CHA081','25.99','29.98',true),
      ('49ea3748020ba4ee28483cfd39752cb8','1161','469','479','CHA080','25.99','29.98',true),
      ('c7dd7aae8148e8f3be3458177999cf11','1161','469','480','CHA082','25.99','29.98',true),
      ('74fea21530d77c5ee9696d22edc0d385','1162','530','8097','AKL037','20.99','24.98',false),
      ('18b0d461ee42cda635c1fc0a2d5a2922','1162','530','8098','AKL005','20.99','24.98',false),
      ('b825158eabffac0e5bce76e7b7719133','1162','530','8100','AKL040','20.99','24.98',false),
      ('155267542b77bd723400d4922456c4e4','1162','530','8101','AKL039','20.99','24.98',true),
      ('ea5d10186e9bd2f9a7f682fd97e7c7ff','1162','530','8102','AKL043','21.99','25.98',false),
      ('cdfabde12b19ff9c51695846273a7248','1162','530','8103','AKL001','20.99','24.98',false),
      ('7bbd7dca65c513c59f5cab2082a0b042','1162','530','534','AKL042','21.99','25.98',false),
      ('27ca7de1de8fb297a0e2b0e0c8a3e5cf','1162','530','535','AKL006','20.99','24.98',true),
      ('a022a77cb6615bd69c8a5d09695d0bbe','1162','530','536','AKL041','21.99','25.98',false),
      ('1d1505504bf011292195ec10bf3f925c','1163','554','560',null,'29.99','33.98',false),
      ('270af38616d5e3de2c6bdc56da99686e','1163','554','3741',null,'29.99','33.98',false),
      ('dcc1061f93220c12801ff9d2507984a9','1163','554','561',null,'29.99','33.98',true),
      ('6228303288bd43a228926e3658b6f01a','1163','554','562',null,'29.99','33.98',true)
  )
  select exists (
    select 1 from allowed a
    where p_plan#>>'{meta,plan_fingerprint}' = a.fingerprint
      and p_plan#>>'{product,action}' = 'existing'
      and p_plan#>>'{product,id}' = a.product_id
      and p_plan#>>'{product_variant,action}' = 'create_variant'
      and p_plan#>>'{retailer,action}' = 'existing'
      and p_plan#>>'{retailer,id}' = '14'
      and p_plan#>>'{retailer_product,action}' = 'create'
      and p_plan#>>'{retailer_product,values,external_product_id}' = a.external_product_id
      and p_plan#>>'{retailer_product,values,external_variant_id}' = a.external_variant_id
      and case when a.external_sku is null
        then p_plan#>'{retailer_product,values,external_sku}' = 'null'::jsonb
        else p_plan#>>'{retailer_product,values,external_sku}' = a.external_sku
      end
      and p_plan#>'{retailer_product,values,external_gtin}' = 'null'::jsonb
      and p_plan#>'{retailer_product,values,product_variant_id}' = 'null'::jsonb
      and p_plan#>>'{retailer_product,values,external_url}' ~ '^https://www\.10reps\.co\.uk/product/'
      and p_plan#>>'{offer,action}' = 'create'
      and p_plan#>>'{offer,values,url}' = p_plan#>>'{retailer_product,values,external_url}'
      and p_plan#>>'{offer,values,price}' = a.price
      and p_plan#>>'{offer,values,shipping_cost}' = '3.99'
      and p_plan#>>'{offer,values,total_price}' = a.total_price
      and (p_plan#>>'{offer,values,in_stock}')::boolean = a.in_stock
      and p_plan#>>'{price_history,action}' = 'create'
      and p_plan#>'{approval,approved}' = 'false'::jsonb
      and p_plan#>>'{approval,approval_type}' = 'none'
      and p_plan#>'{expected_state,product_variant}' = 'null'::jsonb
      and p_plan#>'{expected_state,retailer_product}' = 'null'::jsonb
      and p_plan#>'{expected_state,offer}' = 'null'::jsonb
  )
$function$;

do $patch_validator$
declare
  v_definition text := pg_get_functiondef(
    'public.atomic_import_validate_variant_plan_core(jsonb)'::regprocedure
  );
  v_hash text := encode(sha256(convert_to(v_definition, 'UTF8')), 'hex');
  v_old text;
  v_new text;
begin
  if v_hash <> '3a909be49aad0919c619c4ccfb1b30b796fd0bed6f209d7a607a1c3aca38e1f9' then
    raise exception '10 Reps v8 sibling validator drifted (%)', v_hash;
  end if;

  v_old := 'if v_external_sku is null then';
  v_new := 'if v_external_sku is null
     and not public.atomic_import_10reps_v8_sibling_variant_allowed(p_plan) then';
  if (length(v_definition)-length(replace(v_definition,v_old,'')))/length(v_old) <> 1 then
    raise exception '10 Reps v8 sibling no-SKU anchor mismatch';
  end if;
  v_definition := replace(v_definition,v_old,v_new);

  v_old := $old$if (select count(*) from public.product_variants where product_id=v_product_id and is_active and is_default) > 1
     or ((select count(*) from public.product_variants where product_id=v_product_id and is_active and is_default) = 0
       and v_external_sku is not null) then$old$;
  v_new := $new$if (
       (select count(*) from public.product_variants where product_id=v_product_id and is_active and is_default) > 1
       or ((select count(*) from public.product_variants where product_id=v_product_id and is_active and is_default) = 0
         and v_external_sku is not null)
     )
     and not public.atomic_import_10reps_v8_sibling_variant_allowed(p_plan) then$new$;
  if (length(v_definition)-length(replace(v_definition,v_old,'')))/length(v_old) <> 1 then
    raise exception '10 Reps v8 sibling default anchor mismatch';
  end if;
  execute replace(v_definition,v_old,v_new);
end
$patch_validator$;

alter function public.atomic_import_10reps_v8_sibling_variant_allowed(jsonb) owner to postgres;
alter function public.atomic_import_validate_variant_plan_core(jsonb) owner to postgres;

revoke all on function public.atomic_import_10reps_v8_sibling_variant_allowed(jsonb)
  from public, anon, authenticated, service_role;

do $postflight$
declare
  v_definition text := pg_get_functiondef(
    'public.atomic_import_validate_variant_plan_core(jsonb)'::regprocedure
  );
begin
  if position('atomic_import_10reps_v8_sibling_variant_allowed(p_plan)' in v_definition) = 0
     or has_function_privilege(
       'service_role',
       'public.atomic_import_10reps_v8_sibling_variant_allowed(jsonb)',
       'EXECUTE'
     ) then
    raise exception '10 Reps v8 sibling variant policy verification failed';
  end if;
end
$postflight$;

commit;
