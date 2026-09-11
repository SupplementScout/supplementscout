begin;

alter table public.nutrition_candidates
  add column product_variant_id bigint references public.product_variants(id) on delete restrict,
  add column source_archive_uri text;

alter table public.nutrition_candidates
  add constraint nutrition_candidates_variant_requires_archive
    check (product_variant_id is null or source_archive_uri is not null),
  add constraint nutrition_candidates_source_archive_uri_private
    check (
      source_archive_uri is null
      or (
        length(source_archive_uri) between 36 and 1000
        and source_archive_uri ~ '^supabase-storage://nutrition-sources/[A-Za-z0-9._/-]+$'
        and position('..' in source_archive_uri) = 0
        and position('?' in source_archive_uri) = 0
        and position('#' in source_archive_uri) = 0
      )
    );

create index nutrition_candidates_variant_status_idx
  on public.nutrition_candidates (product_variant_id, status)
  where product_variant_id is not null;

create or replace function public.guard_nutrition_candidate_variant_identity()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.product_variant_id is null then
    return new;
  end if;

  if new.product_id is null or not exists (
    select 1
    from public.product_variants
    where id = new.product_variant_id
      and product_id = new.product_id
  ) then
    raise exception 'nutrition candidate variant does not belong to product';
  end if;

  return new;
end;
$$;

create trigger nutrition_candidates_variant_identity_guard
before insert or update of product_id, product_variant_id on public.nutrition_candidates
for each row execute function public.guard_nutrition_candidate_variant_identity();

create or replace function public.guard_nutrition_candidate_review_update()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if old.status <> 'pending' then
    raise exception 'nutrition candidate has already been reviewed';
  end if;

  if new.status not in ('approved', 'rejected') then
    raise exception 'nutrition candidate review must approve or reject';
  end if;

  if row(
    new.id, new.created_at, new.product_id, new.product_variant_id,
    new.retailer_id, new.source_type, new.source_url,
    new.source_file_sha256, new.source_snapshot_ref, new.source_archive_uri,
    new.source_domain, new.product_name, new.brand, new.proposed_field,
    new.proposed_value, new.proposed_unit, new.confidence,
    new.evidence_snippet, new.source_locator, new.warning_flags,
    new.run_id, new.candidate_fingerprint
  ) is distinct from row(
    old.id, old.created_at, old.product_id, old.product_variant_id,
    old.retailer_id, old.source_type, old.source_url,
    old.source_file_sha256, old.source_snapshot_ref, old.source_archive_uri,
    old.source_domain, old.product_name, old.brand, old.proposed_field,
    old.proposed_value, old.proposed_unit, old.confidence,
    old.evidence_snippet, old.source_locator, old.warning_flags,
    old.run_id, old.candidate_fingerprint
  ) then
    raise exception 'nutrition candidate evidence is immutable';
  end if;

  return new;
end;
$$;

revoke all on function public.guard_nutrition_candidate_variant_identity()
  from public, anon, authenticated;

comment on column public.nutrition_candidates.product_variant_id is
  'Optional exact canonical variant scope. NULL preserves the legacy product-scoped candidate path.';
comment on column public.nutrition_candidates.source_archive_uri is
  'Stable private object reference in the nutrition-sources bucket; never a signed URL.';

commit;
