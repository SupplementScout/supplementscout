begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';

-- This migration changes one validator function only. It does not migrate or
-- mutate catalogue data. Approval and apply continue to reach this validator
-- through the existing wrapper/function chain.
do $migration$
declare
  v_function regprocedure :=
    to_regprocedure('public.atomic_import_validate_variant_plan_core(jsonb)');
  v_definition text;
  v_definition_hash text;
  v_old text;
  v_new text;
begin
  if v_function is null then
    raise exception 'shared-parent identity migration preflight failed: create-variant validator is missing';
  end if;

  select pg_catalog.pg_get_functiondef(v_function) into v_definition;
  v_definition_hash := encode(
    pg_catalog.sha256(convert_to(v_definition, 'UTF8')),
    'hex'
  );
  if v_definition_hash <>
     '955321b6f9fd577cc95b3e6c206fa7919fd8e7bf54755e9ed584c49b3d587179' then
    raise exception
      'shared-parent identity migration preflight failed: create-variant validator drifted (%)',
      v_definition_hash;
  end if;

  v_old :=
    'not public.atomic_import_has_exact_keys(p_plan->''retailer_product'', array[''action'',''values''])';
  v_new :=
    'not public.atomic_import_has_exact_keys(p_plan->''retailer_product'', array[''action'',''values'',''identity_contract''])';
  if pg_catalog.strpos(v_definition, v_old) = 0 then
    raise exception 'shared-parent identity migration preflight failed: retailer-product schema assertion did not match';
  end if;
  v_definition := pg_catalog.replace(v_definition, v_old, v_new);

  v_old := $old$
  if exists (
    select 1 from public.retailer_products
    where retailer_id=v_retailer_id and (
      external_variant_id=v_external_variant_id
      or external_url=v_external_url
    )
  ) then
    raise exception 'stale product import plan: retailer product identity';
  end if;
$old$;

  v_new := $new$
  -- Shared-parent identity contract v1. external_url is cohort evidence, never
  -- the exclusive identity of an exact source variant.
  if not public.atomic_import_has_exact_keys(
    p_plan#>'{retailer_product,identity_contract}',
    array['version','incoming','approved_url_peers','peer_set_fingerprint']
  )
  or p_plan#>>'{retailer_product,identity_contract,version}' <> '1'
  or jsonb_typeof(p_plan#>'{retailer_product,identity_contract,incoming}') is distinct from 'object'
  or jsonb_typeof(p_plan#>'{retailer_product,identity_contract,approved_url_peers}') is distinct from 'array'
  or p_plan#>>'{retailer_product,identity_contract,peer_set_fingerprint}' !~ '^[0-9a-f]{64}$'
  or encode(pg_catalog.sha256(convert_to(public.atomic_import_canonical_json(
       p_plan#>'{retailer_product,identity_contract,approved_url_peers}'
     ), 'UTF8')), 'hex')
     is distinct from p_plan#>>'{retailer_product,identity_contract,peer_set_fingerprint}' then
    raise exception 'invalid product import plan: shared parent identity contract';
  end if;

  if not public.atomic_import_has_exact_keys(
    p_plan#>'{retailer_product,identity_contract,incoming}',
    array[
      'retailer_id','external_product_id','external_variant_id','product_id',
      'product_variant_id','canonical_variant','external_sku','external_gtin',
      'external_options','external_url','legacy'
    ]
  )
  or p_plan#>>'{retailer_product,identity_contract,incoming,retailer_id}'
     is distinct from v_retailer_id::text
  or p_plan#>>'{retailer_product,identity_contract,incoming,external_product_id}'
     is distinct from v_external_product_id
  or p_plan#>>'{retailer_product,identity_contract,incoming,external_variant_id}'
     is distinct from v_external_variant_id
  or p_plan#>>'{retailer_product,identity_contract,incoming,product_id}'
     is distinct from v_product_id::text
  or jsonb_typeof(p_plan#>'{retailer_product,identity_contract,incoming,product_variant_id}')
     is distinct from 'null'
  or p_plan#>'{retailer_product,identity_contract,incoming,canonical_variant}'
     is distinct from v_values
  or p_plan#>>'{retailer_product,identity_contract,incoming,external_sku}'
     is distinct from v_external_sku
  or p_plan#>>'{retailer_product,identity_contract,incoming,external_gtin}'
     is distinct from v_external_gtin
  or p_plan#>'{retailer_product,identity_contract,incoming,external_options}'
     is distinct from v_mapping_values->'external_options'
  or p_plan#>>'{retailer_product,identity_contract,incoming,external_url}'
     is distinct from v_external_url
  or p_plan#>'{retailer_product,identity_contract,incoming,legacy}' <> 'false'::jsonb then
    raise exception 'invalid product import plan: shared parent incoming identity';
  end if;

  if jsonb_array_length(
       p_plan#>'{retailer_product,identity_contract,approved_url_peers}'
     ) = 0
  or exists (
    select 1
    from jsonb_array_elements(
      p_plan#>'{retailer_product,identity_contract,approved_url_peers}'
    ) peer
    where not public.atomic_import_has_exact_keys(
      peer,
      array[
        'retailer_id','external_product_id','external_variant_id','product_id',
        'product_variant_id','canonical_variant','external_sku','external_gtin',
        'external_options','external_url','legacy'
      ]
    )
    or jsonb_typeof(peer->'legacy') is distinct from 'boolean'
    or nullif(btrim(peer->>'retailer_id'), '') is null
    or nullif(btrim(peer->>'product_id'), '') is null
    or nullif(btrim(peer->>'external_url'), '') is null
    or jsonb_typeof(peer->'external_options') not in ('object','null')
    or peer->>'retailer_id' is distinct from v_retailer_id::text
    or peer->>'product_id' is distinct from v_product_id::text
    or peer->>'external_url' is distinct from v_external_url
    or (
      (peer->>'legacy')::boolean
      and (
        jsonb_typeof(peer->'external_product_id') is distinct from 'null'
        or jsonb_typeof(peer->'external_variant_id') is distinct from 'null'
        or jsonb_typeof(peer->'product_variant_id') is distinct from 'string'
        or nullif(btrim(peer->>'product_variant_id'), '') is null
        or jsonb_typeof(peer->'canonical_variant') is distinct from 'null'
      )
    )
    or (
      not (peer->>'legacy')::boolean
      and (
        nullif(btrim(peer->>'external_product_id'), '') is null
        or peer->>'external_product_id' is distinct from v_external_product_id
        or nullif(btrim(peer->>'external_variant_id'), '') is null
        or (
          jsonb_typeof(peer->'product_variant_id') is distinct from 'string'
          and jsonb_typeof(peer->'product_variant_id') is distinct from 'null'
        )
        or (
          jsonb_typeof(peer->'product_variant_id') = 'string'
          and (
            nullif(btrim(peer->>'product_variant_id'), '') is null
            or jsonb_typeof(peer->'canonical_variant') is distinct from 'null'
          )
        )
        or (
          jsonb_typeof(peer->'product_variant_id') = 'null'
          and (
            jsonb_typeof(peer->'canonical_variant') is distinct from 'object'
            or not public.atomic_import_has_exact_keys(
              peer->'canonical_variant',
              array[
                'variant_key','display_name','flavour_code','flavour_label',
                'size_value','size_unit','pack_count','product_format'
              ]
            )
          )
        )
      )
    )
  ) then
    raise exception 'invalid product import plan: shared parent peer cohort';
  end if;

  if (
    select count(*)
    from jsonb_array_elements(
      p_plan#>'{retailer_product,identity_contract,approved_url_peers}'
    ) peer
    where not (peer->>'legacy')::boolean
      and peer->>'external_variant_id' = v_external_variant_id
      and peer is not distinct from
        p_plan#>'{retailer_product,identity_contract,incoming}'
  ) <> 1 then
    raise exception 'invalid product import plan: incoming identity is not uniquely bound to peer cohort';
  end if;

  if (
    select count(*)
    from jsonb_array_elements(
      p_plan#>'{retailer_product,identity_contract,approved_url_peers}'
    ) peer
    where (peer->>'legacy')::boolean
  ) > 1
  or (
    select count(*)
    from jsonb_array_elements(
      p_plan#>'{retailer_product,identity_contract,approved_url_peers}'
    ) peer
    where not (peer->>'legacy')::boolean
  ) <> (
    select count(distinct peer->>'external_variant_id')
    from jsonb_array_elements(
      p_plan#>'{retailer_product,identity_contract,approved_url_peers}'
    ) peer
    where not (peer->>'legacy')::boolean
  )
  or (
    select count(*)
    from jsonb_array_elements(
      p_plan#>'{retailer_product,identity_contract,approved_url_peers}'
    ) peer
    where not (peer->>'legacy')::boolean
  ) <> (
    select count(distinct coalesce(
      'id:' || nullif(peer->>'product_variant_id', ''),
      'planned:' || public.atomic_import_canonical_json(peer->'canonical_variant')
    ))
    from jsonb_array_elements(
      p_plan#>'{retailer_product,identity_contract,approved_url_peers}'
    ) peer
    where not (peer->>'legacy')::boolean
  )
  or exists (
    select 1
    from jsonb_array_elements(
      p_plan#>'{retailer_product,identity_contract,approved_url_peers}'
    ) peer
    where not (peer->>'legacy')::boolean
      and nullif(peer->>'external_sku', '') is not null
    group by peer->>'external_sku'
    having count(*) > 1
  )
  or exists (
    select 1
    from jsonb_array_elements(
      p_plan#>'{retailer_product,identity_contract,approved_url_peers}'
    ) peer
    where not (peer->>'legacy')::boolean
      and nullif(peer->>'external_gtin', '') is not null
    group by peer->>'external_gtin'
    having count(*) > 1
  )
  or exists (
    select 1
    from jsonb_array_elements(
      p_plan#>'{retailer_product,identity_contract,approved_url_peers}'
    ) peer
    where not (peer->>'legacy')::boolean
      and jsonb_typeof(peer->'external_options') = 'object'
    group by peer->'external_options'
    having count(*) > 1
  ) then
    raise exception 'invalid product import plan: shared parent peer identity collision';
  end if;

  -- Every current URL peer must be part of the approved cohort. Existing peers
  -- are bound by canonical ID; earlier planned siblings in this same cohort are
  -- bound by their exact canonical variant signature.
  if exists (
    select 1
    from public.retailer_products rp
    left join public.product_variants pv on pv.id = rp.product_variant_id
    where rp.retailer_id = v_retailer_id
      and rp.external_url = v_external_url
      and not exists (
        select 1
        from jsonb_array_elements(
          p_plan#>'{retailer_product,identity_contract,approved_url_peers}'
        ) peer
        where peer->>'retailer_id' = rp.retailer_id::text
          and peer->>'product_id' = rp.product_id::text
          and peer->>'external_url' = rp.external_url
          and peer->>'external_product_id' is not distinct from rp.external_product_id
          and peer->>'external_variant_id' is not distinct from rp.external_variant_id
          and peer->>'external_sku' is not distinct from rp.external_sku
          and peer->>'external_gtin' is not distinct from rp.external_gtin
          and peer->'external_options' is not distinct from
            case when rp.external_options is null then 'null'::jsonb else rp.external_options end
          and (peer->>'legacy')::boolean = (rp.external_variant_id is null)
          and (
            peer->>'product_variant_id' is not null
            and peer->>'product_variant_id' = rp.product_variant_id::text
            or (
              peer->>'product_variant_id' is null
              and peer->'canonical_variant' is not distinct from jsonb_build_object(
                'variant_key',pv.variant_key,
                'display_name',pv.display_name,
                'flavour_code',pv.flavour_code,
                'flavour_label',pv.flavour_label,
                'size_value',case when pv.size_value is null then null
                  else to_jsonb(public.atomic_import_decimal_string(pv.size_value)) end,
                'size_unit',case when pv.size_unit is null then null
                  else to_jsonb(lower(pv.size_unit)) end,
                'pack_count',to_jsonb(coalesce(pv.pack_count,1)::text),
                'product_format',case when pv.product_format is null then null
                  else to_jsonb(lower(pv.product_format)) end
              )
            )
          )
      )
  ) then
    raise exception 'stale product import plan: shared parent peer set changed';
  end if;

  -- Peers carrying an existing canonical ID were present at planning time and
  -- must still exist. Planned cohort members use a null ID and may appear only
  -- after an earlier approved sibling has been applied.
  if exists (
    select 1
    from jsonb_array_elements(
      p_plan#>'{retailer_product,identity_contract,approved_url_peers}'
    ) peer
    where peer->>'product_variant_id' is not null
      and not exists (
        select 1
        from public.retailer_products rp
        where rp.retailer_id::text = peer->>'retailer_id'
          and rp.product_id::text = peer->>'product_id'
          and rp.product_variant_id::text = peer->>'product_variant_id'
          and rp.external_url = peer->>'external_url'
          and rp.external_product_id is not distinct from peer->>'external_product_id'
          and rp.external_variant_id is not distinct from peer->>'external_variant_id'
          and rp.external_sku is not distinct from peer->>'external_sku'
          and rp.external_gtin is not distinct from peer->>'external_gtin'
          and (case when rp.external_options is null then 'null'::jsonb else rp.external_options end)
              is not distinct from peer->'external_options'
      )
  ) then
    raise exception 'stale product import plan: approved shared parent peer disappeared';
  end if;

  if exists (
    select 1 from public.retailer_products
    where retailer_id = v_retailer_id
      and external_variant_id = v_external_variant_id
  ) then
    raise exception 'stale product import plan: retailer external variant identity';
  end if;
  if v_external_sku is not null and exists (
    select 1 from public.retailer_products
    where retailer_id = v_retailer_id
      and external_sku = v_external_sku
      and external_variant_id is distinct from v_external_variant_id
  ) then
    raise exception 'stale product import plan: retailer external SKU collision';
  end if;
  if v_external_gtin is not null and exists (
    select 1 from public.retailer_products
    where retailer_id = v_retailer_id
      and external_gtin = v_external_gtin
      and external_variant_id is distinct from v_external_variant_id
  ) then
    raise exception 'stale product import plan: retailer external GTIN collision';
  end if;
  if exists (
    select 1 from public.retailer_products
    where retailer_id = v_retailer_id
      and external_product_id = v_external_product_id
      and product_id is distinct from v_product_id
  ) then
    raise exception 'stale product import plan: external parent canonical product drift';
  end if;
  if jsonb_typeof(v_mapping_values->'external_options') = 'object' and exists (
    select 1 from public.retailer_products
    where retailer_id = v_retailer_id
      and external_product_id = v_external_product_id
      and external_variant_id is distinct from v_external_variant_id
      and external_options is not distinct from v_mapping_values->'external_options'
  ) then
    raise exception 'stale product import plan: exact source option tuple collision';
  end if;
$new$;

  if pg_catalog.strpos(v_definition, v_old) = 0 then
    raise exception 'shared-parent identity migration preflight failed: stale identity assertion did not match';
  end if;
  v_definition := pg_catalog.replace(v_definition, v_old, v_new);
  execute v_definition;
end
$migration$;

do $post_validation$
declare
  v_definition text;
begin
  select pg_catalog.pg_get_functiondef(
    'public.atomic_import_validate_variant_plan_core(jsonb)'::regprocedure
  ) into v_definition;
  if pg_catalog.strpos(v_definition, 'Shared-parent identity contract v1') = 0
     or pg_catalog.strpos(v_definition, 'shared parent peer set changed') = 0
     or pg_catalog.strpos(v_definition, 'array[''action'',''values'',''identity_contract'']') = 0
     or pg_catalog.strpos(v_definition, 'or external_url=v_external_url') <> 0 then
    raise exception 'shared-parent identity migration validation failed: function definition is incomplete';
  end if;
  if (
    select pg_catalog.pg_get_userbyid(p.proowner) <> 'postgres'
      or has_function_privilege('anon', p.oid, 'EXECUTE')
      or has_function_privilege('authenticated', p.oid, 'EXECUTE')
      or has_function_privilege('service_role', p.oid, 'EXECUTE')
    from pg_catalog.pg_proc p
    where p.oid =
      'public.atomic_import_validate_variant_plan_core(jsonb)'::regprocedure
  ) then
    raise exception 'shared-parent identity migration validation failed: ownership or ACL drifted';
  end if;
end
$post_validation$;

commit;
