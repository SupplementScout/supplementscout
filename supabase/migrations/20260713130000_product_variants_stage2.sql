begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';

lock table
  public.products,
  public.product_variants,
  public.retailer_products,
  public.offers,
  public.price_history,
  public.outbound_clicks
in share row exclusive mode;

do $stage2_preflight$
declare
  legacy_constraint_exists boolean;
  final_constraint_count integer;
  final_index_exists boolean;
  final_not_null_count integer;
  final_constraints_exact boolean;
  final_index_exact boolean;
  legacy_constraint_exact boolean;
  retailer_url_constraint_exact boolean;
  old_variant_fkeys_exact boolean;
  old_variant_fkeys_absent boolean;
  final_named_constraint_count integer;
  final_index_name_exists boolean;
  merge_functions_before_exact boolean;
  merge_functions_applied_exact boolean;
  merge_function_permissions_applied boolean;
  offer_row public.offers%rowtype;
  mapping_137 public.retailer_products%rowtype;
  mapping_549 public.retailer_products%rowtype;
  eligible_count integer;
  eligible_id bigint;
begin
  select exists (
    select 1
    from pg_catalog.pg_constraint
    where conrelid = 'public.offers'::regclass
      and conname = 'offers_product_retailer_unique'
  ) into legacy_constraint_exists;

  select count(*)
  into final_constraint_count
  from pg_catalog.pg_constraint
  where conname = any (array[
    'offers_retailer_product_unique',
    'product_variants_id_product_id_unique',
    'retailer_products_offer_identity_unique',
    'retailer_products_variant_product_fkey',
    'offers_retailer_product_identity_fkey'
  ]::text[])
    and conrelid = any (array[
      'public.offers'::regclass,
      'public.product_variants'::regclass,
      'public.retailer_products'::regclass
    ]::oid[]);

  final_named_constraint_count := final_constraint_count;

  select to_regclass(
    'public.retailer_products_retailer_external_variant_unique_idx'
  ) is not null
  into final_index_exists;
  final_index_name_exists := final_index_exists;

  select count(*)
  into final_not_null_count
  from pg_catalog.pg_attribute
  where (attrelid, attname) in (
    ('public.retailer_products'::regclass, 'product_variant_id'),
    ('public.offers'::regclass, 'product_id'),
    ('public.offers'::regclass, 'retailer_id'),
    ('public.offers'::regclass, 'product_variant_id'),
    ('public.offers'::regclass, 'retailer_product_id')
  )
    and attnotnull
    and not attisdropped;

  select exists (
    select 1 from pg_catalog.pg_constraint c
    where c.conrelid = 'public.offers'::regclass
      and c.conname = 'offers_product_retailer_unique'
      and c.contype = 'u'
      and c.convalidated
      and lower(regexp_replace(pg_get_constraintdef(c.oid, true), '\s+', ' ', 'g'))
        = 'unique (product_id, retailer_id)'
  ) into legacy_constraint_exact;

  select exists (
    select 1 from pg_catalog.pg_constraint c
    where c.conrelid = 'public.retailer_products'::regclass
      and c.conname = 'retailer_products_retailer_url_unique'
      and c.contype = 'u'
      and c.convalidated
      and lower(regexp_replace(pg_get_constraintdef(c.oid, true), '\s+', ' ', 'g'))
        = 'unique (retailer_id, external_url)'
  ) into retailer_url_constraint_exact;

  select count(*) = 3
  into old_variant_fkeys_exact
  from pg_catalog.pg_constraint c
  where (
    c.conrelid = 'public.retailer_products'::regclass
    and c.conname = 'retailer_products_product_variant_id_fkey'
    and c.confrelid = 'public.product_variants'::regclass
    and lower(regexp_replace(pg_get_constraintdef(c.oid, true), '\s+', ' ', 'g'))
      = 'foreign key (product_variant_id) references product_variants(id) on delete set null'
  ) or (
    c.conrelid = 'public.offers'::regclass
    and c.conname = 'offers_product_variant_id_fkey'
    and c.confrelid = 'public.product_variants'::regclass
    and lower(regexp_replace(pg_get_constraintdef(c.oid, true), '\s+', ' ', 'g'))
      = 'foreign key (product_variant_id) references product_variants(id) on delete set null'
  ) or (
    c.conrelid = 'public.offers'::regclass
    and c.conname = 'offers_retailer_product_id_fkey'
    and c.confrelid = 'public.retailer_products'::regclass
    and lower(regexp_replace(pg_get_constraintdef(c.oid, true), '\s+', ' ', 'g'))
      = 'foreign key (retailer_product_id) references retailer_products(id) on delete set null'
  );

  select count(*) = 0
  into old_variant_fkeys_absent
  from pg_catalog.pg_constraint
  where conname = any (array[
    'retailer_products_product_variant_id_fkey',
    'offers_product_variant_id_fkey',
    'offers_retailer_product_id_fkey'
  ]::text[])
    and conrelid = any (array[
      'public.offers'::regclass,
      'public.retailer_products'::regclass
    ]::oid[]);

  select count(*) = 5
  into final_constraints_exact
  from pg_catalog.pg_constraint c
  where (
    c.conrelid = 'public.offers'::regclass
    and c.conname = 'offers_retailer_product_unique'
    and c.contype = 'u'
    and c.convalidated
    and lower(regexp_replace(pg_get_constraintdef(c.oid, true), '\s+', ' ', 'g'))
      = 'unique (retailer_product_id)'
  ) or (
    c.conrelid = 'public.product_variants'::regclass
    and c.conname = 'product_variants_id_product_id_unique'
    and c.contype = 'u'
    and c.convalidated
    and lower(regexp_replace(pg_get_constraintdef(c.oid, true), '\s+', ' ', 'g'))
      = 'unique (id, product_id)'
  ) or (
    c.conrelid = 'public.retailer_products'::regclass
    and c.conname = 'retailer_products_offer_identity_unique'
    and c.contype = 'u'
    and c.convalidated
    and lower(regexp_replace(pg_get_constraintdef(c.oid, true), '\s+', ' ', 'g'))
      = 'unique (id, product_id, retailer_id, product_variant_id)'
  ) or (
    c.conrelid = 'public.retailer_products'::regclass
    and c.conname = 'retailer_products_variant_product_fkey'
    and c.contype = 'f'
    and c.confrelid = 'public.product_variants'::regclass
    and c.confmatchtype = 'f'
    and c.confupdtype = 'a'
    and c.confdeltype = 'a'
    and c.condeferrable
    and c.condeferred
    and c.convalidated
    and lower(regexp_replace(pg_get_constraintdef(c.oid, true), '\s+', ' ', 'g'))
      = 'foreign key (product_variant_id, product_id) references product_variants(id, product_id) match full deferrable initially deferred'
  ) or (
    c.conrelid = 'public.offers'::regclass
    and c.conname = 'offers_retailer_product_identity_fkey'
    and c.contype = 'f'
    and c.confrelid = 'public.retailer_products'::regclass
    and c.confmatchtype = 'f'
    and c.confupdtype = 'a'
    and c.confdeltype = 'a'
    and c.condeferrable
    and c.condeferred
    and c.convalidated
    and lower(regexp_replace(pg_get_constraintdef(c.oid, true), '\s+', ' ', 'g'))
      = 'foreign key (retailer_product_id, product_id, retailer_id, product_variant_id) references retailer_products(id, product_id, retailer_id, product_variant_id) match full deferrable initially deferred'
  );

  select exists (
    select 1
    from pg_catalog.pg_class index_class
    join pg_catalog.pg_namespace index_namespace
      on index_namespace.oid = index_class.relnamespace
    join pg_catalog.pg_index index_data
      on index_data.indexrelid = index_class.oid
    where index_namespace.nspname = 'public'
      and index_class.relname = 'retailer_products_retailer_external_variant_unique_idx'
      and index_data.indrelid = 'public.retailer_products'::regclass
      and index_data.indisunique
      and index_data.indisvalid
      and index_data.indisready
      and lower(regexp_replace(pg_get_indexdef(index_class.oid), '\s+', ' ', 'g'))
        ~ 'create unique index retailer_products_retailer_external_variant_unique_idx on public\.retailer_products using btree \(retailer_id, external_variant_id\) where \(external_variant_id is not null\)'
      and lower(regexp_replace(pg_get_expr(index_data.indpred, index_data.indrelid), '\s+', ' ', 'g'))
        in ('external_variant_id is not null', '(external_variant_id is not null)')
  ) into final_index_exact;

  select count(*) = 2
  into merge_functions_before_exact
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  join pg_catalog.pg_language l on l.oid = p.prolang
  where n.nspname = 'public'
    and l.lanname = 'plpgsql'
    and p.provolatile = 'v'
    and p.prosecdef
    and p.proconfig = array['search_path=pg_catalog, public']::text[]
    and pg_catalog.pg_get_userbyid(p.proowner) = 'postgres'
    and pg_catalog.pg_get_function_result(p.oid) = 'jsonb'
    and (
      (
        p.proname = 'merge_products'
        and pg_catalog.pg_get_function_identity_arguments(p.oid)
          = 'canonical_id bigint, candidate_id bigint'
        and md5(btrim(regexp_replace(
          pg_catalog.pg_get_functiondef(p.oid), E'\\s+', ' ', 'g'
        ))) = '34bf8c53329c4a9be41dda8a1eba3da3'
      )
      or (
        p.proname = 'merge_products_with_decisions'
        and pg_catalog.pg_get_function_identity_arguments(p.oid)
          = 'canonical_id bigint, candidate_id bigint, decisions jsonb'
        and md5(btrim(regexp_replace(
          pg_catalog.pg_get_functiondef(p.oid), E'\\s+', ' ', 'g'
        ))) = '6ebf2e1f8f9cfc32f7bef382af461f6a'
      )
    );

  merge_functions_before_exact := merge_functions_before_exact
    and to_regprocedure('public.merge_products_stage1_legacy(bigint,bigint)') is null
    and to_regprocedure('public.merge_products_with_decisions_stage1_legacy(bigint,bigint,jsonb)') is null
    and to_regprocedure('public.stage2_prepare_default_only_merge(bigint,bigint)') is null;

  select count(*) = 5
  into merge_functions_applied_exact
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  join pg_catalog.pg_language l on l.oid = p.prolang
  where n.nspname = 'public'
    and l.lanname = 'plpgsql'
    and p.provolatile = 'v'
    and p.prosecdef
    and p.proconfig = array['search_path=pg_catalog, public']::text[]
    and pg_catalog.pg_get_userbyid(p.proowner) = 'postgres'
    and pg_catalog.pg_get_function_result(p.oid) = 'jsonb'
    and (
      (
        p.proname = 'merge_products'
        and pg_catalog.pg_get_function_identity_arguments(p.oid)
          = 'canonical_id bigint, candidate_id bigint'
        and md5(btrim(regexp_replace(
          pg_catalog.pg_get_functiondef(p.oid), E'\\s+', ' ', 'g'
        ))) = '35cba59e3569f85e3360fb64bf0dc48e'
      )
      or (
        p.proname = 'merge_products_stage1_legacy'
        and pg_catalog.pg_get_function_identity_arguments(p.oid)
          = 'canonical_id bigint, candidate_id bigint'
        and md5(btrim(regexp_replace(
          pg_catalog.pg_get_functiondef(p.oid), E'\\s+', ' ', 'g'
        ))) = '62226ae6e19fd551be2e00cc725c6999'
      )
      or (
        p.proname = 'merge_products_with_decisions'
        and pg_catalog.pg_get_function_identity_arguments(p.oid)
          = 'canonical_id bigint, candidate_id bigint, decisions jsonb'
        and md5(btrim(regexp_replace(
          pg_catalog.pg_get_functiondef(p.oid), E'\\s+', ' ', 'g'
        ))) = '903e75eeb3d5a321fc291abdf279b10f'
      )
      or (
        p.proname = 'merge_products_with_decisions_stage1_legacy'
        and pg_catalog.pg_get_function_identity_arguments(p.oid)
          = 'canonical_id bigint, candidate_id bigint, decisions jsonb'
        and md5(btrim(regexp_replace(
          pg_catalog.pg_get_functiondef(p.oid), E'\\s+', ' ', 'g'
        ))) = '434a2e843215bab5440e66c5f3c92eeb'
      )
      or (
        p.proname = 'stage2_prepare_default_only_merge'
        and pg_catalog.pg_get_function_identity_arguments(p.oid)
          = 'canonical_id bigint, candidate_id bigint'
        and md5(btrim(regexp_replace(
          pg_catalog.pg_get_functiondef(p.oid), E'\\s+', ' ', 'g'
        ))) = '6e136a36eb821fab6e2e032cb7fd1df5'
      )
    );

  if merge_functions_applied_exact then
    select count(*) = 5
    into merge_function_permissions_applied
    from (
      values
        ('public.merge_products(bigint,bigint)'::regprocedure, true),
        ('public.merge_products_with_decisions(bigint,bigint,jsonb)'::regprocedure, true),
        ('public.merge_products_stage1_legacy(bigint,bigint)'::regprocedure, false),
        ('public.merge_products_with_decisions_stage1_legacy(bigint,bigint,jsonb)'::regprocedure, false),
        ('public.stage2_prepare_default_only_merge(bigint,bigint)'::regprocedure, false)
    ) expected(function_oid, is_wrapper)
    join pg_catalog.pg_proc p on p.oid = expected.function_oid
    where not exists (
      select 1
      from pg_catalog.aclexplode(
        coalesce(
          p.proacl,
          pg_catalog.acldefault('f', p.proowner)
        )
      ) direct_acl
      where direct_acl.privilege_type = 'EXECUTE'
        and direct_acl.grantee <> p.proowner
        and (
          not expected.is_wrapper
          or direct_acl.grantee <> 'service_role'::regrole
        )
    )
      and (
        not expected.is_wrapper
        or exists (
          select 1
          from pg_catalog.aclexplode(
            coalesce(
              p.proacl,
              pg_catalog.acldefault('f', p.proowner)
            )
          ) direct_acl
          where direct_acl.privilege_type = 'EXECUTE'
            and direct_acl.grantee = 'service_role'::regrole
            and direct_acl.grantor = p.proowner
            and not direct_acl.is_grantable
        )
      )
      and not pg_catalog.has_function_privilege(
        'anon',
        expected.function_oid,
        'EXECUTE'
      )
      and not pg_catalog.has_function_privilege(
        'authenticated',
        expected.function_oid,
        'EXECUTE'
      )
      and pg_catalog.has_function_privilege(
        'service_role',
        expected.function_oid,
        'EXECUTE'
      ) = expected.is_wrapper;
  else
    merge_function_permissions_applied := false;
  end if;

  select * into offer_row
  from public.offers
  where id = 538;
  if not found then
    raise exception 'Product Variants Stage 2 preflight failed: offer 538 does not exist';
  end if;

  select * into mapping_137
  from public.retailer_products
  where id = 137;
  if not found then
    raise exception 'Product Variants Stage 2 preflight failed: retailer_product 137 does not exist';
  end if;

  select * into mapping_549
  from public.retailer_products
  where id = 549;
  if not found then
    raise exception 'Product Variants Stage 2 preflight failed: retailer_product 549 does not exist';
  end if;

  if offer_row.retailer_id is distinct from 1
     or offer_row.product_id is distinct from 510
     or offer_row.product_variant_id is distinct from 603 then
    raise exception 'Product Variants Stage 2 preflight failed: offer 538 identity changed';
  end if;

  if mapping_137.retailer_id is distinct from offer_row.retailer_id
     or mapping_137.product_id is distinct from offer_row.product_id
     or mapping_137.product_variant_id is distinct from offer_row.product_variant_id
     or mapping_137.external_url is distinct from offer_row.url then
    raise exception 'Product Variants Stage 2 preflight failed: retailer_product 137 evidence does not exactly match offer 538';
  end if;

  if mapping_549.retailer_id is not distinct from offer_row.retailer_id
     and mapping_549.product_id is not distinct from offer_row.product_id
     and mapping_549.product_variant_id is not distinct from offer_row.product_variant_id
     and mapping_549.external_url is not distinct from offer_row.url then
    raise exception 'Product Variants Stage 2 preflight failed: retailer_product 549 also qualifies for offer 538';
  end if;

  select count(*), min(rp.id)
  into eligible_count, eligible_id
  from public.retailer_products rp
  where rp.retailer_id is not distinct from offer_row.retailer_id
    and rp.product_id is not distinct from offer_row.product_id
    and rp.product_variant_id is not distinct from offer_row.product_variant_id
    and rp.external_url is not distinct from offer_row.url;

  if (
    select count(*)
    from public.retailer_products rp
    where rp.retailer_id is not distinct from offer_row.retailer_id
      and rp.product_id is not distinct from offer_row.product_id
      and rp.product_variant_id is not distinct from offer_row.product_variant_id
      and rp.external_url is not distinct from offer_row.url
  ) <> 1 or eligible_id is distinct from 137 then
    raise exception 'Product Variants Stage 2 preflight failed: offer 538 has % eligible mappings instead of exactly retailer_product 137', eligible_count;
  end if;

  if not legacy_constraint_exists
     and final_named_constraint_count = 5
     and final_constraints_exact
     and final_index_name_exists
     and final_index_exact
     and retailer_url_constraint_exact
     and old_variant_fkeys_absent
     and final_not_null_count = 5
     and merge_functions_applied_exact
     and merge_function_permissions_applied
     and offer_row.retailer_product_id = 137 then
    raise exception 'Product Variants Stage 2 already applied';
  end if;

  if not (
    legacy_constraint_exists
    and legacy_constraint_exact
    and retailer_url_constraint_exact
    and final_named_constraint_count = 0
    and not final_index_name_exists
    and final_not_null_count = 0
    and old_variant_fkeys_exact
    and merge_functions_before_exact
    and offer_row.retailer_product_id is null
  ) then
    raise exception using
      message = 'Product Variants Stage 2 preflight failed: partial or inconsistent migration state',
      detail = format(
        'legacy=%s final_constraints=%s final_index=%s final_not_null=%s offer_538_retailer_product_id=%s',
        legacy_constraint_exists,
        final_constraint_count,
        final_index_exists,
        final_not_null_count,
        coalesce(offer_row.retailer_product_id::text, 'NULL')
      );
  end if;

  if exists (
    select 1 from public.retailer_products
    where product_variant_id is null
  ) then
    raise exception 'Product Variants Stage 2 preflight failed: retailer_products.product_variant_id contains NULL';
  end if;

  if exists (
    select 1 from public.offers
    where product_variant_id is null
       or product_id is null
       or retailer_id is null
  ) then
    raise exception 'Product Variants Stage 2 preflight failed: offer identity contains NULL';
  end if;

  if exists (
    select 1 from public.offers
    where retailer_product_id is null
      and id <> 538
  ) then
    raise exception 'Product Variants Stage 2 preflight failed: an offer other than 538 is missing retailer_product_id';
  end if;

  if exists (
    select 1
    from public.retailer_products rp
    join public.product_variants pv on pv.id = rp.product_variant_id
    where rp.product_id <> pv.product_id
  ) then
    raise exception 'Product Variants Stage 2 preflight failed: retailer_product points to a variant from another product';
  end if;

  if exists (
    select 1
    from public.offers o
    join public.retailer_products rp on rp.id = o.retailer_product_id
    where o.product_id is distinct from rp.product_id
       or o.retailer_id is distinct from rp.retailer_id
       or o.product_variant_id is distinct from rp.product_variant_id
  ) then
    raise exception 'Product Variants Stage 2 preflight failed: offer and retailer_product identities disagree';
  end if;

  if exists (
    select 1
    from public.offers
    where retailer_product_id is not null
    group by retailer_product_id
    having count(*) > 1
  ) then
    raise exception 'Product Variants Stage 2 preflight failed: duplicate offers for retailer_product_id';
  end if;

  if exists (
    select 1
    from public.retailer_products
    where external_variant_id is not null
    group by retailer_id, external_variant_id
    having count(*) > 1
  ) then
    raise exception 'Product Variants Stage 2 preflight failed: duplicate retailer external_variant_id';
  end if;
end;
$stage2_preflight$;

create temporary table product_variants_stage2_offer_538_before on commit drop as
select to_jsonb(o) as row_snapshot
from public.offers o
where o.id = 538;

create temporary table product_variants_stage2_price_history_before on commit drop as
select coalesce(jsonb_agg(to_jsonb(ph) order by ph.id), '[]'::jsonb) as rows_snapshot
from public.price_history ph
where ph.offer_id = 538;

create temporary table product_variants_stage2_outbound_clicks_before on commit drop as
select coalesce(jsonb_agg(to_jsonb(oc) order by oc.id), '[]'::jsonb) as rows_snapshot
from public.outbound_clicks oc
where oc.offer_id = 538;

create temporary table product_variants_stage2_product_gtin_before on commit drop as
select id, gtin
from public.products
where id = 510;

do $resolve_offer_538$
declare
  changed_count integer;
begin
  update public.offers
  set retailer_product_id = 137
  where id = 538
    and retailer_product_id is null;

  get diagnostics changed_count = row_count;
  if changed_count <> 1 then
    raise exception 'Product Variants Stage 2 failed to update exactly offer 538';
  end if;
end;
$resolve_offer_538$;

do $stage2_snapshot_assertions$
declare
  offer_before jsonb;
  offer_after jsonb;
  history_before jsonb;
  history_after jsonb;
  clicks_before jsonb;
  clicks_after jsonb;
begin
  select row_snapshot into offer_before
  from product_variants_stage2_offer_538_before;
  select to_jsonb(o) into offer_after
  from public.offers o
  where o.id = 538;

  if (offer_after - 'retailer_product_id')
     is distinct from (offer_before - 'retailer_product_id')
     or (offer_after ->> 'retailer_product_id')::bigint is distinct from 137 then
    raise exception 'Stage 2 changed protected offer 538 fields';
  end if;

  select rows_snapshot into history_before
  from product_variants_stage2_price_history_before;
  select coalesce(jsonb_agg(to_jsonb(ph) order by ph.id), '[]'::jsonb)
  into history_after
  from public.price_history ph
  where ph.offer_id = 538;
  if history_after is distinct from history_before then
    raise exception 'Stage 2 changed offer 538 price history';
  end if;

  select rows_snapshot into clicks_before
  from product_variants_stage2_outbound_clicks_before;
  select coalesce(jsonb_agg(to_jsonb(oc) order by oc.id), '[]'::jsonb)
  into clicks_after
  from public.outbound_clicks oc
  where oc.offer_id = 538;
  if clicks_after is distinct from clicks_before then
    raise exception 'Stage 2 changed offer 538 outbound clicks';
  end if;

  if (select gtin from product_variants_stage2_product_gtin_before where id = 510)
     is distinct from (select gtin from public.products where id = 510)
     or not exists (select 1 from public.products where id = 510) then
    raise exception 'Stage 2 changed products.gtin';
  end if;
end;
$stage2_snapshot_assertions$;

do $stage2_not_null_preflight$
begin
  if exists (
    select 1 from public.retailer_products
    where product_variant_id is null
  ) then
    raise exception 'Stage 2 cannot set retailer_products.product_variant_id NOT NULL';
  end if;

  if exists (
    select 1 from public.offers
    where product_id is null
       or retailer_id is null
       or product_variant_id is null
       or retailer_product_id is null
  ) then
    raise exception 'Stage 2 cannot set offer identity linkage NOT NULL';
  end if;
end;
$stage2_not_null_preflight$;

alter table public.retailer_products
  alter column product_variant_id set not null;

alter table public.offers
  alter column product_id set not null,
  alter column retailer_id set not null,
  alter column product_variant_id set not null,
  alter column retailer_product_id set not null;

alter table public.product_variants
  add constraint product_variants_id_product_id_unique
  unique (id, product_id);

alter table public.retailer_products
  add constraint retailer_products_offer_identity_unique
  unique (id, product_id, retailer_id, product_variant_id);

create unique index retailer_products_retailer_external_variant_unique_idx
  on public.retailer_products (retailer_id, external_variant_id)
  where external_variant_id is not null;

alter table public.offers
  add constraint offers_retailer_product_unique
  unique (retailer_product_id);

alter table public.retailer_products
  add constraint retailer_products_variant_product_fkey
  foreign key (product_variant_id, product_id)
  references public.product_variants (id, product_id)
  match full
  on update no action
  on delete no action
  deferrable initially deferred;

alter table public.offers
  add constraint offers_retailer_product_identity_fkey
  foreign key (retailer_product_id, product_id, retailer_id, product_variant_id)
  references public.retailer_products (
    id,
    product_id,
    retailer_id,
    product_variant_id
  )
  match full
  on update no action
  on delete no action
  deferrable initially deferred;

alter table public.retailer_products
  drop constraint retailer_products_product_variant_id_fkey;

alter table public.offers
  drop constraint offers_product_variant_id_fkey,
  drop constraint offers_retailer_product_id_fkey;

alter function public.merge_products(bigint, bigint)
  rename to merge_products_stage1_legacy;

alter function public.merge_products_with_decisions(bigint, bigint, jsonb)
  rename to merge_products_with_decisions_stage1_legacy;

create or replace function public.stage2_prepare_default_only_merge(
  canonical_id bigint,
  candidate_id bigint
) returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $stage2_merge_prepare$
declare
  locked_count integer;
  canonical_default_variant_id bigint;
  candidate_default_variant_id bigint;
begin
  if canonical_id is null or candidate_id is null
     or canonical_id <= 0 or candidate_id <= 0
     or canonical_id = candidate_id then
    raise exception 'Stage 2 merge requires two different positive product IDs';
  end if;

  select count(*) into locked_count
  from (
    select id
    from public.products
    where id in (canonical_id, candidate_id)
    order by id
    for update
  ) locked_products;
  if locked_count <> 2 then
    raise exception 'Both products must exist';
  end if;

  if exists (
    select 1
    from public.product_variants
    where product_id in (canonical_id, candidate_id)
      and is_active
      and not is_default
  ) then
    raise exception 'Merge blocked: Product Variants Stage 2 does not merge products with active non-default variants';
  end if;

  select id into canonical_default_variant_id
  from public.product_variants
  where product_id = canonical_id
    and is_default
    and is_active;
  if not found then
    raise exception 'Merge blocked: canonical product has no active default variant';
  end if;

  select id into candidate_default_variant_id
  from public.product_variants
  where product_id = candidate_id
    and is_default
    and is_active;
  if not found then
    raise exception 'Merge blocked: candidate product has no active default variant';
  end if;

  if exists (
    select 1 from public.retailer_products
    where product_id = canonical_id
      and product_variant_id <> canonical_default_variant_id
  ) or exists (
    select 1 from public.offers
    where product_id = canonical_id
      and product_variant_id <> canonical_default_variant_id
  ) or exists (
    select 1 from public.retailer_products
    where product_id = candidate_id
      and product_variant_id <> candidate_default_variant_id
  ) or exists (
    select 1 from public.offers
    where product_id = candidate_id
      and product_variant_id <> candidate_default_variant_id
  ) then
    raise exception 'Merge blocked: default-only product contains non-default variant linkage';
  end if;

  update public.offers
  set product_variant_id = canonical_default_variant_id
  where product_id = candidate_id;

  update public.retailer_products
  set product_variant_id = canonical_default_variant_id
  where product_id = candidate_id;

  return jsonb_build_object(
    'canonical_default_variant_id', canonical_default_variant_id,
    'candidate_default_variant_id', candidate_default_variant_id
  );
end;
$stage2_merge_prepare$;

create or replace function public.merge_products(
  canonical_id bigint,
  candidate_id bigint
) returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $stage2_merge_wrapper$
declare
  result jsonb;
begin
  create temporary table if not exists pg_temp.stage2_merge_click_snapshot (
    click_id bigint primary key,
    row_snapshot jsonb not null
  ) on commit drop;
  truncate table pg_temp.stage2_merge_click_snapshot;

  insert into pg_temp.stage2_merge_click_snapshot (click_id, row_snapshot)
  select oc.id, to_jsonb(oc)
  from public.outbound_clicks oc
  join public.offers o on o.id = oc.offer_id
  where o.product_id = candidate_id;

  perform public.stage2_prepare_default_only_merge(canonical_id, candidate_id);
  result := public.merge_products_stage1_legacy(canonical_id, candidate_id);

  update public.outbound_clicks oc
  set product_id = canonical_id
  from pg_temp.stage2_merge_click_snapshot snapshot
  where oc.id = snapshot.click_id;

  if exists (
    select 1
    from pg_temp.stage2_merge_click_snapshot snapshot
    left join public.outbound_clicks oc on oc.id = snapshot.click_id
    where oc.id is null
       or (to_jsonb(oc) - 'product_id')
          is distinct from (snapshot.row_snapshot - 'product_id')
  ) then
    raise exception 'Merge blocked: outbound_clicks changed unexpectedly';
  end if;

  return result;
end;
$stage2_merge_wrapper$;

create or replace function public.merge_products_with_decisions(
  canonical_id bigint,
  candidate_id bigint,
  decisions jsonb
) returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $stage2_merge_decisions_wrapper$
declare
  result jsonb;
begin
  create temporary table if not exists pg_temp.stage2_merge_click_snapshot (
    click_id bigint primary key,
    row_snapshot jsonb not null
  ) on commit drop;
  truncate table pg_temp.stage2_merge_click_snapshot;

  insert into pg_temp.stage2_merge_click_snapshot (click_id, row_snapshot)
  select oc.id, to_jsonb(oc)
  from public.outbound_clicks oc
  join public.offers o on o.id = oc.offer_id
  where o.product_id in (canonical_id, candidate_id);

  create temporary table if not exists pg_temp.stage2_merge_offer_reassignments (
    deleted_offer_id bigint primary key,
    kept_offer_id bigint not null
  ) on commit drop;
  truncate table pg_temp.stage2_merge_offer_reassignments;

  insert into pg_temp.stage2_merge_offer_reassignments (
    deleted_offer_id,
    kept_offer_id
  )
  select
    case item->>'decision'
      when 'keep_canonical' then (item->>'candidateOfferId')::bigint
      when 'keep_candidate' then (item->>'canonicalOfferId')::bigint
    end,
    case item->>'decision'
      when 'keep_canonical' then (item->>'canonicalOfferId')::bigint
      when 'keep_candidate' then (item->>'candidateOfferId')::bigint
    end
  from jsonb_array_elements(coalesce(decisions->'offerConflicts', '[]'::jsonb)) item
  where item->>'decision' in ('keep_canonical', 'keep_candidate');

  if exists (
    select 1
    from jsonb_array_elements(
      coalesce(decisions->'retailerProductConflicts', '[]'::jsonb)
    ) item
    join public.retailer_products rp
      on rp.id = case item->>'decision'
        when 'keep_canonical' then (item->>'candidateMappingId')::bigint
        when 'keep_candidate' then (item->>'canonicalMappingId')::bigint
      end
    where item->>'decision' in ('keep_canonical', 'keep_candidate')
      and not exists (
        select 1 from public.offers o where o.retailer_product_id = rp.id
      )
  ) then
    raise exception 'Merge blocked: retailer_products mapping without an offer must be preserved';
  end if;

  perform public.stage2_prepare_default_only_merge(canonical_id, candidate_id);
  result := public.merge_products_with_decisions_stage1_legacy(
    canonical_id,
    candidate_id,
    decisions
  );

  update public.outbound_clicks oc
  set
    offer_id = coalesce(reassignment.kept_offer_id, oc.offer_id),
    product_id = canonical_id
  from pg_temp.stage2_merge_click_snapshot snapshot
  left join pg_temp.stage2_merge_offer_reassignments reassignment
    on reassignment.deleted_offer_id = (snapshot.row_snapshot->>'offer_id')::bigint
  where oc.id = snapshot.click_id;

  if exists (
    select 1
    from pg_temp.stage2_merge_click_snapshot snapshot
    left join public.outbound_clicks oc on oc.id = snapshot.click_id
    left join pg_temp.stage2_merge_offer_reassignments reassignment
      on reassignment.deleted_offer_id = (snapshot.row_snapshot->>'offer_id')::bigint
    where oc.id is null
       or oc.offer_id is distinct from coalesce(
         reassignment.kept_offer_id,
         (snapshot.row_snapshot->>'offer_id')::bigint
       )
       or oc.product_id is distinct from canonical_id
       or (to_jsonb(oc) - 'offer_id' - 'product_id')
          is distinct from (snapshot.row_snapshot - 'offer_id' - 'product_id')
  ) then
    raise exception 'Merge blocked: outbound_clicks were not preserved';
  end if;

  return result;
end;
$stage2_merge_decisions_wrapper$;

revoke all on function public.merge_products_stage1_legacy(bigint, bigint)
  from public, anon, authenticated, service_role;
revoke all on function public.merge_products_with_decisions_stage1_legacy(
  bigint,
  bigint,
  jsonb
) from public, anon, authenticated, service_role;
revoke all on function public.stage2_prepare_default_only_merge(bigint, bigint)
  from public, anon, authenticated, service_role;
revoke all on function public.merge_products(bigint, bigint)
  from public, anon, authenticated, service_role;
revoke all on function public.merge_products_with_decisions(bigint, bigint, jsonb)
  from public, anon, authenticated, service_role;

grant execute on function public.merge_products(bigint, bigint)
  to service_role;
grant execute on function public.merge_products_with_decisions(bigint, bigint, jsonb)
  to service_role;

do $stage2_drop_legacy_preflight$
begin
  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conrelid = 'public.offers'::regclass
      and conname = 'offers_retailer_product_unique'
  ) or not exists (
    select 1
    from pg_catalog.pg_constraint
    where conrelid = 'public.offers'::regclass
      and conname = 'offers_retailer_product_identity_fkey'
  ) or not exists (
    select 1
    from pg_catalog.pg_constraint
    where conrelid = 'public.retailer_products'::regclass
      and conname = 'retailer_products_variant_product_fkey'
  ) or to_regclass(
    'public.retailer_products_retailer_external_variant_unique_idx'
  ) is null then
    raise exception 'Product Variants Stage 2 refused to remove legacy offer uniqueness before final protections exist';
  end if;
end;
$stage2_drop_legacy_preflight$;

alter table public.offers
  drop constraint offers_product_retailer_unique;

do $stage2_final_assertions$
declare
  offer_before jsonb;
  offer_after jsonb;
  history_before jsonb;
  history_after jsonb;
  clicks_before jsonb;
  clicks_after jsonb;
begin
  select row_snapshot into offer_before
  from product_variants_stage2_offer_538_before;
  select to_jsonb(o) into offer_after
  from public.offers o where o.id = 538;
  if (offer_after - 'retailer_product_id')
     is distinct from (offer_before - 'retailer_product_id')
     or (offer_after ->> 'retailer_product_id')::bigint is distinct from 137 then
    raise exception 'Stage 2 changed protected offer 538 fields';
  end if;

  select rows_snapshot into history_before
  from product_variants_stage2_price_history_before;
  select coalesce(jsonb_agg(to_jsonb(ph) order by ph.id), '[]'::jsonb)
  into history_after from public.price_history ph where ph.offer_id = 538;
  if history_after is distinct from history_before then
    raise exception 'Stage 2 changed offer 538 price history';
  end if;

  select rows_snapshot into clicks_before
  from product_variants_stage2_outbound_clicks_before;
  select coalesce(jsonb_agg(to_jsonb(oc) order by oc.id), '[]'::jsonb)
  into clicks_after from public.outbound_clicks oc where oc.offer_id = 538;
  if clicks_after is distinct from clicks_before then
    raise exception 'Stage 2 changed offer 538 outbound clicks';
  end if;

  if (select gtin from product_variants_stage2_product_gtin_before where id = 510)
     is distinct from (select gtin from public.products where id = 510)
     or not exists (select 1 from public.products where id = 510) then
    raise exception 'Stage 2 changed products.gtin';
  end if;

  if exists (
    select 1 from public.offers
    where product_id is null
       or retailer_id is null
       or retailer_product_id is null
       or product_variant_id is null
  )
     or exists (select 1 from public.retailer_products where product_variant_id is null) then
    raise exception 'Product Variants Stage 2 final assertion failed: required linkage contains NULL';
  end if;
end;
$stage2_final_assertions$;

commit;
