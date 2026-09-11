begin;

alter table public.nutrition_candidates
  add column information_state text,
  add column source_quantity_value numeric,
  add column source_quantity_unit text,
  add column quantity_basis text,
  add column serving_basis_value numeric,
  add column serving_basis_unit text,
  add column serving_basis_text text,
  add column ingredient_form text,
  add column ingredient_ratio text;

alter table public.nutrition_candidates
  drop constraint nutrition_candidates_proposed_field_check,
  drop constraint nutrition_candidates_proposed_value_check,
  drop constraint nutrition_candidates_check,
  drop constraint nutrition_candidates_approved_value_positive,
  drop constraint nutrition_candidates_approved_value_review_state,
  alter column proposed_value drop not null,
  alter column proposed_unit drop not null;

alter table public.nutrition_candidates
  add constraint nutrition_candidates_proposed_field_check check (
    proposed_field in (
      'net_weight_g', 'net_volume_ml', 'serving_count_verified',
      'serving_size_g', 'serving_size_ml', 'protein_per_serving_g',
      'creatine_per_serving_g', 'caffeine_per_serving_mg',
      'citrulline_per_serving_mg', 'beta_alanine_per_serving_mg'
    )
  ),
  add constraint nutrition_candidates_fact_shape_check check (
    (
      proposed_field in (
        'net_weight_g', 'net_volume_ml', 'serving_count_verified',
        'serving_size_g', 'serving_size_ml', 'protein_per_serving_g',
        'creatine_per_serving_g'
      )
      and proposed_value > 0
      and information_state is null
      and source_quantity_value is null and source_quantity_unit is null
      and quantity_basis is null
      and serving_basis_value is null and serving_basis_unit is null
      and serving_basis_text is null and ingredient_form is null
      and ingredient_ratio is null
    )
    or
    (
      proposed_field in (
        'caffeine_per_serving_mg', 'citrulline_per_serving_mg',
        'beta_alanine_per_serving_mg'
      )
      and product_variant_id is not null
      and information_state in (
        'present_with_amount', 'present_amount_not_disclosed',
        'confirmed_absent', 'no_information', 'conflicting_information'
      )
      and (
        (
          information_state = 'present_with_amount'
          and proposed_value > 0 and proposed_unit = 'mg'
          and source_quantity_value > 0 and source_quantity_unit in ('mg', 'g')
          and proposed_value = source_quantity_value *
            case source_quantity_unit when 'g' then 1000 else 1 end
          and quantity_basis = 'per_serving'
          and length(btrim(serving_basis_text)) between 1 and 300
          and (
            (serving_basis_value is null and serving_basis_unit is null)
            or (serving_basis_value > 0 and serving_basis_unit in ('g', 'ml', 'count'))
          )
        )
        or
        (
          information_state <> 'present_with_amount'
          and proposed_value is null and proposed_unit is null
          and source_quantity_value is null and source_quantity_unit is null
          and quantity_basis is null
          and serving_basis_value is null and serving_basis_unit is null
          and serving_basis_text is null
        )
      )
      and (
        (
          proposed_field = 'citrulline_per_serving_mg'
          and (
            (
              information_state in ('present_with_amount', 'present_amount_not_disclosed')
              and ingredient_form in ('l_citrulline', 'citrulline_malate')
            )
            or (
              information_state not in ('present_with_amount', 'present_amount_not_disclosed')
              and ingredient_form is null
            )
          )
          and (
            ingredient_ratio is null
            or (
              ingredient_form = 'citrulline_malate'
              and ingredient_ratio ~ '^[1-9][0-9]*(\.[0-9]+)?:[1-9][0-9]*(\.[0-9]+)?$'
            )
          )
        )
        or (
          proposed_field <> 'citrulline_per_serving_mg'
          and ingredient_form is null and ingredient_ratio is null
        )
      )
    )
  ),
  add constraint nutrition_candidates_proposed_unit_check check (
    (proposed_field in (
      'net_weight_g', 'serving_size_g', 'protein_per_serving_g',
      'creatine_per_serving_g'
    ) and proposed_unit = 'g')
    or (proposed_field in ('net_volume_ml', 'serving_size_ml') and proposed_unit = 'ml')
    or (proposed_field = 'serving_count_verified' and proposed_unit = 'count')
    or (proposed_field in (
      'caffeine_per_serving_mg', 'citrulline_per_serving_mg',
      'beta_alanine_per_serving_mg'
    ) and (
      (information_state = 'present_with_amount' and proposed_unit = 'mg')
      or (information_state <> 'present_with_amount' and proposed_unit is null)
    ))
  ),
  add constraint nutrition_candidates_approved_value_positive check (
    approved_value is null or approved_value > 0
  ),
  add constraint nutrition_candidates_approved_value_review_state check (
    (status in ('pending', 'rejected') and approved_value is null)
    or (
      status = 'approved'
      and (
        (information_state is null and approved_value is not null)
        or (information_state = 'present_with_amount' and approved_value = proposed_value)
        or (information_state in (
          'present_amount_not_disclosed', 'confirmed_absent',
          'no_information', 'conflicting_information'
        ) and approved_value is null)
      )
    )
  );

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
    new.retailer_id, new.source_type, new.source_url, new.source_file_sha256,
    new.source_snapshot_ref, new.source_archive_uri, new.source_domain,
    new.product_name, new.brand, new.proposed_field, new.proposed_value,
    new.proposed_unit, new.information_state, new.source_quantity_value,
    new.source_quantity_unit, new.quantity_basis, new.serving_basis_value,
    new.serving_basis_unit, new.serving_basis_text, new.ingredient_form,
    new.ingredient_ratio, new.confidence, new.evidence_snippet,
    new.source_locator, new.warning_flags, new.run_id, new.candidate_fingerprint
  ) is distinct from row(
    old.id, old.created_at, old.product_id, old.product_variant_id,
    old.retailer_id, old.source_type, old.source_url, old.source_file_sha256,
    old.source_snapshot_ref, old.source_archive_uri, old.source_domain,
    old.product_name, old.brand, old.proposed_field, old.proposed_value,
    old.proposed_unit, old.information_state, old.source_quantity_value,
    old.source_quantity_unit, old.quantity_basis, old.serving_basis_value,
    old.serving_basis_unit, old.serving_basis_text, old.ingredient_form,
    old.ingredient_ratio, old.confidence, old.evidence_snippet,
    old.source_locator, old.warning_flags, old.run_id, old.candidate_fingerprint
  ) then
    raise exception 'nutrition candidate evidence is immutable';
  end if;
  return new;
end;
$$;

comment on column public.nutrition_candidates.information_state is
  'Ingredient evidence state, independent of pending/approved/rejected review status.';
comment on column public.nutrition_candidates.source_quantity_value is
  'Original disclosed amount before deterministic g-to-mg normalization.';
comment on column public.nutrition_candidates.serving_basis_text is
  'Exact source wording that defines the serving; never an inferred scoop mass.';
comment on column public.nutrition_candidates.ingredient_form is
  'Exact citrulline form; citrulline malate is not converted to pure L-citrulline.';

commit;
