begin;

drop policy if exists "Public can read active product variants"
on public.product_variants;

create policy "Public can read active product variants"
on public.product_variants
for select
to anon
using (is_active = true);

grant select on table public.product_variants to anon;

commit;
