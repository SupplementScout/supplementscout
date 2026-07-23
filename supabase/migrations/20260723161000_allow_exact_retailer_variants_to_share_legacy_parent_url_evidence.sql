begin;

set local lock_timeout = '10s';
set local statement_timeout = '120s';

lock table
  public.retailer_products,
  public.offers,
  public.price_history
in share row exclusive mode;

do $preflight$
declare
  v_count bigint;
  v_definition text;
begin
  if to_regclass('public.retailer_products_retailer_url_unique') is not null
     or to_regclass('public.offers_retailer_url_unique') is not null
     or to_regclass('public.retailer_products_retailer_external_variant_unique_idx') is null
     or to_regclass('public.retailer_products_retailer_exact_canonical_variant_unique_idx') is null
     or to_regclass('public.retailer_products_retailer_legacy_url_unique_idx') is null
     or to_regprocedure('public.retailer_products_enforce_url_identity_partition()') is null
     or not exists (
       select 1 from pg_catalog.pg_trigger
       where tgrelid = 'public.retailer_products'::regclass
         and tgname = 'retailer_products_url_identity_partition_guard'
         and not tgisinternal
         and tgenabled = 'O'
     ) then
    raise exception 'legacy parent URL refinement preflight failed: base URL identity migration is incomplete';
  end if;

  select pg_catalog.pg_get_functiondef(
    'public.retailer_products_enforce_url_identity_partition()'::regprocedure
  ) into v_definition;
  if position(
    'legacy and shared exact mappings cannot coexist' in v_definition
  ) = 0 then
    raise exception 'legacy parent URL refinement preflight failed: base guard definition drifted or refinement already installed';
  end if;

  select count(*) into v_count
  from (
    select retailer_id, external_variant_id
    from public.retailer_products
    where external_variant_id is not null
    group by retailer_id, external_variant_id
    having count(*) > 1
  ) duplicates;
  if v_count <> 0 then
    raise exception 'legacy parent URL refinement preflight failed: % duplicate exact source identities', v_count;
  end if;

  select count(*) into v_count
  from (
    select retailer_id, product_variant_id
    from public.retailer_products
    where external_variant_id is not null
    group by retailer_id, product_variant_id
    having count(*) > 1
  ) duplicates;
  if v_count <> 0 then
    raise exception 'legacy parent URL refinement preflight failed: % duplicate exact canonical targets', v_count;
  end if;

  select count(*) into v_count
  from (
    select retailer_id, external_url
    from public.retailer_products
    group by retailer_id, external_url
    having count(*) > 1
       and (
         count(*) filter (where external_variant_id is null) > 1
         or count(distinct product_id) <> 1
         or count(*) filter (where external_variant_id is not null)
              <> count(distinct external_variant_id) filter (where external_variant_id is not null)
         or (
           count(*) filter (where external_variant_id is not null) > 0
           and (
             count(*) filter (
               where external_variant_id is not null
                 and nullif(btrim(external_product_id), '') is null
             ) > 0
             or count(distinct external_product_id) filter (
               where external_variant_id is not null
             ) <> 1
           )
         )
       )
  ) unsafe_groups;
  if v_count <> 0 then
    raise exception 'legacy parent URL refinement preflight failed: % unsafe existing shared URL groups', v_count;
  end if;
end
$preflight$;

create or replace function public.retailer_products_enforce_url_identity_partition()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $guard$
declare
  v_exact_peer public.retailer_products%rowtype;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      concat_ws('|', 'retailer-product-url-identity', new.retailer_id::text, new.external_url),
      0
    )
  );

  if new.external_variant_id is null then
    if exists (
      select 1
      from public.retailer_products
      where retailer_id = new.retailer_id
        and external_url = new.external_url
        and id is distinct from new.id
        and external_variant_id is not null
    ) then
      raise exception 'retailer URL identity collision: a legacy mapping cannot enter an exact shared parent URL';
    end if;
    return new;
  end if;

  if nullif(btrim(new.external_product_id), '') is null then
    raise exception 'retailer exact variant identity requires an external product identity';
  end if;

  if exists (
    select 1
    from public.retailer_products
    where retailer_id = new.retailer_id
      and external_url = new.external_url
      and id is distinct from new.id
      and product_id is distinct from new.product_id
  ) then
    raise exception 'retailer shared parent URL canonical product conflict';
  end if;

  select *
  into v_exact_peer
  from public.retailer_products
  where retailer_id = new.retailer_id
    and external_url = new.external_url
    and id is distinct from new.id
    and external_variant_id is not null
  order by id
  limit 1;

  if found and (
    nullif(btrim(v_exact_peer.external_product_id), '') is null
    or new.external_product_id is distinct from v_exact_peer.external_product_id
  ) then
    raise exception 'retailer shared parent URL external product identity conflict';
  end if;

  return new;
end
$guard$;

alter function public.retailer_products_enforce_url_identity_partition()
  owner to postgres;

revoke all on function public.retailer_products_enforce_url_identity_partition()
  from public, anon, authenticated, service_role;

do $post_validation$
declare
  v_definition text;
begin
  select pg_catalog.pg_get_functiondef(
    'public.retailer_products_enforce_url_identity_partition()'::regprocedure
  ) into v_definition;
  if position(
    'a legacy mapping cannot enter an exact shared parent URL' in v_definition
  ) = 0 or position(
    'retailer shared parent URL external product identity conflict' in v_definition
  ) = 0 then
    raise exception 'legacy parent URL refinement validation failed: refined guard definition is incomplete';
  end if;

  if (
    select pg_catalog.pg_get_userbyid(p.proowner) <> 'postgres'
      or has_function_privilege('anon', p.oid, 'EXECUTE')
      or has_function_privilege('authenticated', p.oid, 'EXECUTE')
      or has_function_privilege('service_role', p.oid, 'EXECUTE')
    from pg_catalog.pg_proc p
    where p.oid = 'public.retailer_products_enforce_url_identity_partition()'::regprocedure
  ) then
    raise exception 'legacy parent URL refinement validation failed: guard ownership or ACL drifted';
  end if;
end
$post_validation$;

commit;
