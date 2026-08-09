const RETURN_TARGET_PATTERN = /^nutrition-(?:candidate-review|product-[1-9]\d*|work-item-[1-9]\d*)$/;

export function parseNutritionCandidateReturnTarget(value: FormDataEntryValue | null) {
  return typeof value === "string" && RETURN_TARGET_PATTERN.test(value)
    ? value
    : null;
}

export function addNutritionCandidateReturnTarget(url: URL, value: FormDataEntryValue | null) {
  const target = parseNutritionCandidateReturnTarget(value);
  if (target) url.hash = target;
  return url;
}
