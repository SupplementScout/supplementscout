begin;

alter table public.nutrition_candidates
  drop constraint nutrition_candidates_proposed_field_check,
  drop constraint nutrition_candidates_fact_shape_check,
  drop constraint nutrition_candidates_proposed_unit_check;

alter table public.nutrition_candidates
  add constraint nutrition_candidates_proposed_field_check check ((
    proposed_field in (
      'net_weight_g', 'net_volume_ml', 'serving_count_verified',
      'serving_size_g', 'serving_size_ml', 'protein_per_serving_g',
      'creatine_per_serving_g', 'caffeine_per_serving_mg',
      'citrulline_per_serving_mg', 'beta_alanine_per_serving_mg',
      'creatine_declared_form_per_serving_mg'
    )
  ) is true),
  add constraint nutrition_candidates_fact_shape_check check ((
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
        'beta_alanine_per_serving_mg',
        'creatine_declared_form_per_serving_mg'
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
          proposed_field = 'creatine_declared_form_per_serving_mg'
          and (
            (
              information_state in ('present_with_amount', 'present_amount_not_disclosed')
              and length(ingredient_form) between 1 and 100
              and ingredient_form ~ '^creatine_[a-z0-9]+(_[a-z0-9]+)*$'
            )
            or (
              information_state not in ('present_with_amount', 'present_amount_not_disclosed')
              and ingredient_form is null
            )
          )
          and ingredient_ratio is null
        )
        or (
          proposed_field not in (
            'citrulline_per_serving_mg',
            'creatine_declared_form_per_serving_mg'
          )
          and ingredient_form is null and ingredient_ratio is null
        )
      )
    )
  ) is true),
  add constraint nutrition_candidates_proposed_unit_check check ((
    (proposed_field in (
      'net_weight_g', 'serving_size_g', 'protein_per_serving_g',
      'creatine_per_serving_g'
    ) and proposed_unit = 'g')
    or (proposed_field in ('net_volume_ml', 'serving_size_ml') and proposed_unit = 'ml')
    or (proposed_field = 'serving_count_verified' and proposed_unit = 'count')
    or (proposed_field in (
      'caffeine_per_serving_mg', 'citrulline_per_serving_mg',
      'beta_alanine_per_serving_mg',
      'creatine_declared_form_per_serving_mg'
    ) and (
      (information_state = 'present_with_amount' and proposed_unit = 'mg')
      or (information_state <> 'present_with_amount' and proposed_unit is null)
    ))
  ) is true);

comment on column public.nutrition_candidates.ingredient_form is
  'Declared citrulline or creatine form. Compound mass is not converted to pure active-ingredient mass.';

commit;
