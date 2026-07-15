begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

lock table public.products, public.product_variants, public.retailer_products, public.offers, public.price_history in share row exclusive mode;

do $correct_fit_house_batch_f_identity$
declare
  v_inventory constant jsonb := $batch_f_identity_corrections$
  [
    {
      "product_name": "HR Labs Hydro EAA 30 servings",
      "product_slug": "hr-labs-hydro-eaa-30-servings",
      "brand": "HR Labs",
      "old_key": "s-berry-peaches-30-servings",
      "old_display_name": "S-Berry Peaches / 30 servings",
      "old_flavour_code": "s berry peaches",
      "old_flavour_label": "S-Berry Peaches",
      "new_key": "s-berry-and-peaches-30-servings",
      "new_display_name": "S'Berry & Peaches / 30 servings",
      "new_flavour_code": "s'berry and peaches",
      "new_flavour_label": "S'Berry & Peaches",
      "size_value": 30,
      "size_unit": "servings",
      "product_format": "powder"
    },
    {
      "product_name": "OstroVit Creatine Monohydrate 300g",
      "product_slug": "ostrovit-creatine-monohydrate-300g",
      "brand": "OstroVit",
      "old_key": "unflavoured-300g",
      "old_display_name": "Unflavoured / 300g",
      "old_flavour_code": "unflavoured",
      "old_flavour_label": "Unflavoured",
      "new_key": "unflavored-300g",
      "new_display_name": "Unflavored / 300g",
      "new_flavour_code": "unflavored",
      "new_flavour_label": "Unflavored",
      "size_value": 300,
      "size_unit": "g",
      "product_format": "powder"
    }
  ]
  $batch_f_identity_corrections$::jsonb;
  v_products_before bigint; v_variants_before bigint; v_mappings_before bigint; v_offers_before bigint; v_history_before bigint;
  v_updated bigint;
begin
  if jsonb_array_length(v_inventory) <> 2
     or (select count(distinct e->>'product_slug') from jsonb_array_elements(v_inventory) e) <> 2
     or (select count(distinct (e->>'product_slug')||':'||(e->>'new_key')) from jsonb_array_elements(v_inventory) e) <> 2
  then raise exception 'Batch F identity correction blocked: closed inventory invalid'; end if;

  if exists (
    select 1 from jsonb_to_recordset(v_inventory) e(product_name text,product_slug text,brand text)
    left join public.products p on p.slug=e.product_slug
    where p.id is null or p.name is distinct from e.product_name or p.brand is distinct from e.brand
       or p.is_active is distinct from true or p.merged_into_product_id is not null
  ) then raise exception 'Batch F identity correction blocked: product identity drift'; end if;

  if exists (
    select 1
    from jsonb_to_recordset(v_inventory) e(product_slug text,old_key text,old_display_name text,old_flavour_code text,old_flavour_label text,new_key text,new_display_name text,new_flavour_code text,new_flavour_label text,size_value numeric,size_unit text,product_format text)
    join public.products p on p.slug=e.product_slug
    left join lateral (
      select count(*) filter(where v.variant_key=e.old_key and v.display_name=e.old_display_name and v.flavour_code=e.old_flavour_code and v.flavour_label=e.old_flavour_label and v.size_value=e.size_value and v.size_unit=e.size_unit and v.pack_count=1 and v.product_format=e.product_format and not v.is_default and v.is_active) old_exact,
             count(*) filter(where v.variant_key=e.new_key and v.display_name=e.new_display_name and v.flavour_code=e.new_flavour_code and v.flavour_label=e.new_flavour_label and v.size_value=e.size_value and v.size_unit=e.size_unit and v.pack_count=1 and v.product_format=e.product_format and not v.is_default and v.is_active) new_exact,
             count(*) filter(where v.variant_key in(e.old_key,e.new_key)) keyed
      from public.product_variants v where v.product_id=p.id
    ) c on true
    where c.keyed<>1 or c.old_exact+c.new_exact<>1
  ) then raise exception 'Batch F identity correction blocked: source variant identity drift or key collision'; end if;

  if exists (
    select 1 from jsonb_to_recordset(v_inventory) e(product_slug text,old_key text,new_key text,new_flavour_code text,size_value numeric,size_unit text)
    join public.products p on p.slug=e.product_slug join public.product_variants v on v.product_id=p.id
    where v.variant_key not in(e.old_key,e.new_key) and not v.is_default
      and lower(v.flavour_code)=lower(e.new_flavour_code) and v.size_value=e.size_value and v.size_unit=e.size_unit
  ) then raise exception 'Batch F identity correction blocked: semantic collision'; end if;

  select count(*) into v_products_before from public.products; select count(*) into v_variants_before from public.product_variants;
  select count(*) into v_mappings_before from public.retailer_products; select count(*) into v_offers_before from public.offers; select count(*) into v_history_before from public.price_history;

  update public.product_variants v
  set variant_key=e.new_key, display_name=e.new_display_name, flavour_code=e.new_flavour_code, flavour_label=e.new_flavour_label, updated_at=now()
  from jsonb_to_recordset(v_inventory) e(product_slug text,old_key text,old_display_name text,old_flavour_code text,old_flavour_label text,new_key text,new_display_name text,new_flavour_code text,new_flavour_label text,size_value numeric,size_unit text,product_format text)
  join public.products p on p.slug=e.product_slug
  where v.product_id=p.id and v.variant_key=e.old_key and v.display_name=e.old_display_name
    and v.flavour_code=e.old_flavour_code and v.flavour_label=e.old_flavour_label and v.size_value=e.size_value
    and v.size_unit=e.size_unit and v.pack_count=1 and v.product_format=e.product_format and not v.is_default and v.is_active;
  get diagnostics v_updated=row_count;
  if v_updated<0 or v_updated>2 then raise exception 'Batch F identity correction failed: update count invalid'; end if;

  if (select count(*) from public.products)<>v_products_before or (select count(*) from public.product_variants)<>v_variants_before
     or (select count(*) from public.retailer_products)<>v_mappings_before or (select count(*) from public.offers)<>v_offers_before
     or (select count(*) from public.price_history)<>v_history_before
  then raise exception 'Batch F identity correction failed: unexpected table delta'; end if;

  if exists (
    select 1 from jsonb_to_recordset(v_inventory) e(product_slug text,old_key text,new_key text,new_display_name text,new_flavour_code text,new_flavour_label text,size_value numeric,size_unit text,product_format text)
    join public.products p on p.slug=e.product_slug
    left join public.product_variants v on v.product_id=p.id and v.variant_key=e.new_key
    where v.id is null or v.display_name is distinct from e.new_display_name or v.flavour_code is distinct from e.new_flavour_code
       or v.flavour_label is distinct from e.new_flavour_label or v.size_value is distinct from e.size_value or v.size_unit is distinct from e.size_unit
       or v.pack_count is distinct from 1 or v.product_format is distinct from e.product_format or v.is_default or not v.is_active
       or exists(select 1 from public.product_variants old where old.product_id=p.id and old.variant_key=e.old_key)
  ) then raise exception 'Batch F identity correction failed: postcondition invalid'; end if;
end;
$correct_fit_house_batch_f_identity$;

commit;
