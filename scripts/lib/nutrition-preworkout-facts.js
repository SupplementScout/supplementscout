const PREWORKOUT_INGREDIENT_FIELDS = Object.freeze([
  "caffeine_per_serving_mg",
  "citrulline_per_serving_mg",
  "beta_alanine_per_serving_mg",
]);
const PREWORKOUT_FIELD_SET = new Set(PREWORKOUT_INGREDIENT_FIELDS);
const INFORMATION_STATES = Object.freeze([
  "present_with_amount",
  "present_amount_not_disclosed",
  "confirmed_absent",
  "no_information",
  "conflicting_information",
]);
const INFORMATION_STATE_SET = new Set(INFORMATION_STATES);
const CITRULLINE_FORMS = Object.freeze(["l_citrulline", "citrulline_malate"]);
const CITRULLINE_FORM_SET = new Set(CITRULLINE_FORMS);
const TARGET_FIELD_BY_CANDIDATE_FIELD = Object.freeze({
  caffeine_per_serving_mg: "caffeine",
  citrulline_per_serving_mg: "citrulline",
  beta_alanine_per_serving_mg: "beta_alanine",
});

function finitePositive(value) {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function nullable(value) {
  return value === undefined ? null : value;
}

function normalizedMg(value, unit) {
  if (!finitePositive(value) || !["mg", "g"].includes(unit)) return null;
  return unit === "g" ? value * 1000 : value;
}

function ratioValid(value) {
  return value === null || (typeof value === "string" && /^[1-9][0-9]*(?:\.[0-9]+)?:[1-9][0-9]*(?:\.[0-9]+)?$/.test(value));
}

function validatePreworkoutIngredientCandidate(candidate) {
  if (!PREWORKOUT_FIELD_SET.has(candidate?.field_name)) return false;
  const state = candidate.information_state;
  if (!INFORMATION_STATE_SET.has(state) || candidate.product_variant_id == null) return false;
  const quantified = state === "present_with_amount";
  const present = quantified || state === "present_amount_not_disclosed";
  const sourceValue = nullable(candidate.source_quantity_value);
  const sourceUnit = nullable(candidate.source_quantity_unit);
  const servingValue = nullable(candidate.serving_basis_value);
  const servingUnit = nullable(candidate.serving_basis_unit);
  const servingText = nullable(candidate.serving_basis_text);
  const form = nullable(candidate.ingredient_form);
  const ratio = nullable(candidate.ingredient_ratio);

  if (quantified) {
    const converted = normalizedMg(sourceValue, sourceUnit);
    if (converted === null || candidate.value_numeric !== converted || candidate.unit !== "mg" ||
        candidate.basis !== "per_serving" || typeof servingText !== "string" ||
        !servingText.trim() || servingText.length > 300) return false;
    if ((servingValue === null) !== (servingUnit === null) ||
        (servingValue !== null && (!finitePositive(servingValue) || !["g", "ml", "count"].includes(servingUnit)))) return false;
  } else if (candidate.value_numeric !== null || candidate.unit !== null || candidate.basis !== null ||
      sourceValue !== null || sourceUnit !== null || servingValue !== null || servingUnit !== null || servingText !== null) {
    return false;
  }

  if (candidate.field_name === "citrulline_per_serving_mg") {
    if (present && !CITRULLINE_FORM_SET.has(form)) return false;
    if (!present && form !== null) return false;
    if (!ratioValid(ratio) || (ratio !== null && form !== "citrulline_malate")) return false;
  } else if (form !== null || ratio !== null) {
    return false;
  }
  return true;
}

function ingredientFact(candidate, approvedValue = candidate.approved_value) {
  if (!validatePreworkoutIngredientCandidate({
    ...candidate,
    field_name: candidate.field_name || candidate.proposed_field,
    value_numeric: candidate.value_numeric ?? (candidate.proposed_value == null ? null : Number(candidate.proposed_value)),
    unit: candidate.unit ?? candidate.proposed_unit ?? null,
  })) throw new Error("Invalid structured pre-workout ingredient candidate");
  const state = candidate.information_state;
  const fact = { information_state: state };
  if (state === "present_with_amount") {
    const normalized = Number(approvedValue);
    if (!Number.isFinite(normalized) || normalized <= 0 || normalized !== Number(candidate.proposed_value ?? candidate.value_numeric)) {
      throw new Error("Structured ingredient amount must match its deterministic source conversion");
    }
    Object.assign(fact, {
      amount_per_serving_mg: normalized,
      source_quantity_value: Number(candidate.source_quantity_value),
      source_quantity_unit: candidate.source_quantity_unit,
      quantity_basis: "per_serving",
      serving_basis_text: candidate.serving_basis_text,
    });
    if (candidate.serving_basis_value != null) {
      fact.serving_basis_value = Number(candidate.serving_basis_value);
      fact.serving_basis_unit = candidate.serving_basis_unit;
    }
  }
  if (["present_with_amount", "present_amount_not_disclosed"].includes(state) && candidate.ingredient_form != null) {
    fact.ingredient_form = candidate.ingredient_form;
    if (candidate.ingredient_ratio != null) fact.ingredient_ratio = candidate.ingredient_ratio;
  }
  return fact;
}

module.exports = {
  CITRULLINE_FORMS,
  INFORMATION_STATES,
  PREWORKOUT_INGREDIENT_FIELDS,
  PREWORKOUT_FIELD_SET,
  TARGET_FIELD_BY_CANDIDATE_FIELD,
  ingredientFact,
  normalizedMg,
  validatePreworkoutIngredientCandidate,
};
