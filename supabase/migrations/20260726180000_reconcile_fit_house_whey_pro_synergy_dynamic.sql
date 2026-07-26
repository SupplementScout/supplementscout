begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

lock table
  public.products,
  public.product_variants,
  public.retailer_products,
  public.offers,
  public.price_history,
  public.outbound_clicks
in share row exclusive mode;

do $reconcile_fit_house_whey_pro_synergy_dynamic$
declare
  v_source_product_id constant bigint := 337;
  v_target_product_id constant bigint := 510;
  v_external_product_id constant text := '9554213830896';
  v_expected_variants constant jsonb := $expected_fit_house_variants$
  [
    {
      "external_variant_id": "47792261431536",
      "variant_key": "banana-600g",
      "display_name": "Banana / 600g",
      "flavour_code": "banana",
      "flavour_label": "Banana"
    },
    {
      "external_variant_id": "47792261464304",
      "variant_key": "vanilla-600g",
      "display_name": "Vanilla / 600g",
      "flavour_code": "vanilla",
      "flavour_label": "Vanilla"
    },
    {
      "external_variant_id": "47792261497072",
      "variant_key": "strawberry-600g",
      "display_name": "Strawberry / 600g",
      "flavour_code": "strawberry",
      "flavour_label": "Strawberry"
    }
  ]
  $expected_fit_house_variants$::jsonb;
  v_products_before bigint;
  v_variants_before bigint;
  v_mappings_before bigint;
  v_offers_before bigint;
  v_history_before bigint;
  v_clicks_before bigint;
  v_variant_updates bigint;
  v_mapping_updates bigint;
  v_offer_updates bigint;
  v_click_updates bigint;
begin
  if jsonb_typeof(v_expected_variants) is distinct from 'array'
     or jsonb_array_length(v_expected_variants) is distinct from 3
     or (
       select count(distinct e.external_variant_id)
       from jsonb_to_recordset(v_expected_variants) e(external_variant_id text)
     ) is distinct from 3
     or (
       select count(distinct e.variant_key)
       from jsonb_to_recordset(v_expected_variants) e(variant_key text)
     ) is distinct from 3 then
    raise exception 'Fit House Whey Pro Synergy reconciliation blocked: closed inventory invalid';
  end if;

  if not exists (
    select 1
    from public.products
    where id = v_source_product_id
      and name = 'GYM HIGH Whey Pro Synergy 600g'
      and slug = 'gym-high-whey-pro-synergy-600g'
      and brand = 'GYM HIGH'
      and category = 'Whey Protein'
      and net_weight_g = 600
      and product_format = 'powder'
      and is_active
      and merged_into_product_id is null
      and merged_at is null
  ) or not exists (
    select 1
    from public.products
    where id = v_target_product_id
      and name = 'GYM HIGH Whey Pro Synergy Dynamic 600g'
      and slug = 'gym-high-whey-pro-synergy-dynamic-600g'
      and brand = 'GYM HIGH'
      and category = 'Whey Protein'
      and net_weight_g = 600
      and product_format = 'powder'
      and is_active
      and merged_into_product_id is null
      and merged_at is null
  ) then
    raise exception 'Fit House Whey Pro Synergy reconciliation blocked: canonical product identity drift';
  end if;

  if (
    select count(*)
    from public.retailer_products rp
    where rp.retailer_id = 9
      and rp.external_product_id = v_external_product_id
  ) is distinct from 3 or exists (
    select 1
    from jsonb_to_recordset(v_expected_variants) e(
      external_variant_id text,
      variant_key text,
      display_name text,
      flavour_code text,
      flavour_label text
    )
    left join public.retailer_products rp
      on rp.retailer_id = 9
     and rp.external_product_id = v_external_product_id
     and rp.external_variant_id = e.external_variant_id
    left join public.product_variants v on v.id = rp.product_variant_id
    left join public.offers o on o.retailer_product_id = rp.id
    where rp.id is null
       or rp.product_id not in (v_source_product_id, v_target_product_id)
       or v.id is null
       or v.product_id is distinct from rp.product_id
       or v.variant_key is distinct from e.variant_key
       or v.display_name is distinct from e.display_name
       or v.flavour_code is distinct from e.flavour_code
       or v.flavour_label is distinct from e.flavour_label
       or v.size_value is distinct from 600
       or v.size_unit is distinct from 'g'
       or v.pack_count is distinct from 1
       or v.product_format is distinct from 'powder'
       or v.is_default
       or not v.is_active
       or o.id is null
       or o.product_id is distinct from rp.product_id
       or o.retailer_id is distinct from 9
       or o.product_variant_id is distinct from rp.product_variant_id
  ) then
    raise exception 'Fit House Whey Pro Synergy reconciliation blocked: mapping, variant, or offer drift';
  end if;

  if (
    select count(*)
    from public.retailer_products rp
    join jsonb_to_recordset(v_expected_variants) e(external_variant_id text)
      on e.external_variant_id = rp.external_variant_id
    where rp.retailer_id = 9
      and rp.external_product_id = v_external_product_id
      and rp.product_id = v_source_product_id
  ) not in (0, 3) then
    raise exception 'Fit House Whey Pro Synergy reconciliation blocked: partially applied state';
  end if;

  if exists (
    select 1
    from public.product_variants target
    join jsonb_to_recordset(v_expected_variants) e(
      external_variant_id text,
      variant_key text,
      flavour_code text
    ) on true
    where target.product_id = v_target_product_id
      and target.id <> (
        select rp.product_variant_id
        from public.retailer_products rp
        where rp.retailer_id = 9
          and rp.external_product_id = v_external_product_id
          and rp.external_variant_id = e.external_variant_id
      )
      and (
        target.variant_key = e.variant_key
        or (
          lower(target.flavour_code) = lower(e.flavour_code)
          and target.size_value = 600
          and target.size_unit = 'g'
          and target.pack_count = 1
          and target.product_format = 'powder'
        )
      )
  ) then
    raise exception 'Fit House Whey Pro Synergy reconciliation blocked: target variant collision';
  end if;

  if exists (
    select 1
    from public.retailer_products rp
    join jsonb_to_recordset(v_expected_variants) e(external_variant_id text)
      on e.external_variant_id = rp.external_variant_id
    where rp.retailer_id = 9
      and rp.external_product_id = v_external_product_id
      and exists (
        select 1
        from public.retailer_products other
        where other.product_variant_id = rp.product_variant_id
          and other.id <> rp.id
      )
  ) or exists (
    select 1
    from public.retailer_products rp
    join jsonb_to_recordset(v_expected_variants) e(external_variant_id text)
      on e.external_variant_id = rp.external_variant_id
    where rp.retailer_id = 9
      and rp.external_product_id = v_external_product_id
      and exists (
        select 1
        from public.offers other
        where other.product_variant_id = rp.product_variant_id
          and other.retailer_product_id <> rp.id
      )
  ) then
    raise exception 'Fit House Whey Pro Synergy reconciliation blocked: variant has unrelated consumers';
  end if;

  if exists (
    select 1
    from public.outbound_clicks oc
    join public.offers o on o.id = oc.offer_id
    join public.retailer_products rp on rp.id = o.retailer_product_id
    join jsonb_to_recordset(v_expected_variants) e(external_variant_id text)
      on e.external_variant_id = rp.external_variant_id
    where rp.retailer_id = 9
      and rp.external_product_id = v_external_product_id
      and oc.product_id not in (v_source_product_id, v_target_product_id)
  ) then
    raise exception 'Fit House Whey Pro Synergy reconciliation blocked: outbound click identity drift';
  end if;

  select count(*) into v_products_before from public.products;
  select count(*) into v_variants_before from public.product_variants;
  select count(*) into v_mappings_before from public.retailer_products;
  select count(*) into v_offers_before from public.offers;
  select count(*) into v_history_before from public.price_history;
  select count(*) into v_clicks_before from public.outbound_clicks;

  update public.product_variants v
  set product_id = v_target_product_id
  from public.retailer_products rp
  join jsonb_to_recordset(v_expected_variants) e(external_variant_id text)
    on e.external_variant_id = rp.external_variant_id
  where rp.retailer_id = 9
    and rp.external_product_id = v_external_product_id
    and rp.product_id = v_source_product_id
    and v.id = rp.product_variant_id
    and v.product_id = v_source_product_id;
  get diagnostics v_variant_updates = row_count;

  update public.retailer_products rp
  set product_id = v_target_product_id
  from jsonb_to_recordset(v_expected_variants) e(external_variant_id text)
  where rp.retailer_id = 9
    and rp.external_product_id = v_external_product_id
    and rp.external_variant_id = e.external_variant_id
    and rp.product_id = v_source_product_id;
  get diagnostics v_mapping_updates = row_count;

  update public.offers o
  set product_id = v_target_product_id
  from public.retailer_products rp
  where rp.id = o.retailer_product_id
    and rp.retailer_id = 9
    and rp.external_product_id = v_external_product_id
    and o.product_id = v_source_product_id;
  get diagnostics v_offer_updates = row_count;

  update public.outbound_clicks oc
  set product_id = v_target_product_id
  from public.offers o
  join public.retailer_products rp on rp.id = o.retailer_product_id
  where oc.offer_id = o.id
    and rp.retailer_id = 9
    and rp.external_product_id = v_external_product_id
    and oc.product_id = v_source_product_id;
  get diagnostics v_click_updates = row_count;

  if v_variant_updates not in (0, 3)
     or v_mapping_updates is distinct from v_variant_updates
     or v_offer_updates is distinct from v_variant_updates
     or v_click_updates < 0 then
    raise exception 'Fit House Whey Pro Synergy reconciliation failed: write counts invalid';
  end if;

  if (select count(*) from public.products) is distinct from v_products_before
     or (select count(*) from public.product_variants) is distinct from v_variants_before
     or (select count(*) from public.retailer_products) is distinct from v_mappings_before
     or (select count(*) from public.offers) is distinct from v_offers_before
     or (select count(*) from public.price_history) is distinct from v_history_before
     or (select count(*) from public.outbound_clicks) is distinct from v_clicks_before then
    raise exception 'Fit House Whey Pro Synergy reconciliation failed: unexpected table delta';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(v_expected_variants) e(external_variant_id text)
    left join public.retailer_products rp
      on rp.retailer_id = 9
     and rp.external_product_id = v_external_product_id
     and rp.external_variant_id = e.external_variant_id
    left join public.product_variants v
      on v.id = rp.product_variant_id
     and v.product_id = v_target_product_id
    left join public.offers o
      on o.retailer_product_id = rp.id
     and o.product_id = v_target_product_id
     and o.product_variant_id = v.id
    where rp.product_id is distinct from v_target_product_id
       or v.id is null
       or o.id is null
  ) or exists (
    select 1
    from public.outbound_clicks oc
    join public.offers o on o.id = oc.offer_id
    join public.retailer_products rp on rp.id = o.retailer_product_id
    where rp.retailer_id = 9
      and rp.external_product_id = v_external_product_id
      and oc.product_id is distinct from v_target_product_id
  ) then
    raise exception 'Fit House Whey Pro Synergy reconciliation failed: final identity invalid';
  end if;

  if exists (
    select 1
    from public.retailer_products
    where id = 324
      and (
        retailer_id is distinct from 3
        or product_id is distinct from v_source_product_id
        or product_variant_id is distinct from 333
        or external_url is distinct from 'https://wheyokay.com/gym-high-whey-pro-synergy-600g-2407-p.asp'
      )
  ) then
    raise exception 'Fit House Whey Pro Synergy reconciliation failed: unrelated Whey Okay mapping changed';
  end if;
end;
$reconcile_fit_house_whey_pro_synergy_dynamic$;

commit;
